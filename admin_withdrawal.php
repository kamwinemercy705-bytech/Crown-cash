<?php
declare(strict_types=1);

/*
|--------------------------------------------------------------------------
| Crown Cash - Admin Withdrawal API
|--------------------------------------------------------------------------
| File: admin_withdrawal.php
|
| GET:
|   Returns withdrawal requests for the admin panel.
|
| POST:
|   Approves or rejects a pending withdrawal.
|
| Important:
|   - Uses literal '$or' and '$exists' MongoDB operators.
|   - Supports ObjectId and string IDs.
|   - Does NOT use MongoDB transactions.
|   - Approval does not deduct the wallet again because the balance was
|     already reserved when the withdrawal was created.
|   - Rejection restores the reserved amount to the user's balance.
|--------------------------------------------------------------------------
*/

header("Content-Type: application/json; charset=utf-8");
header("Access-Control-Allow-Origin: https://crown-cash.vercel.app");
header("Access-Control-Allow-Credentials: true");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");

if ($_SERVER["REQUEST_METHOD"] === "OPTIONS") {
    http_response_code(204);
    exit;
}

require_once __DIR__ . "/config.php";

use MongoDB\BSON\ObjectId;
use MongoDB\BSON\UTCDateTime;
use MongoDB\BSON\Decimal128;
use MongoDB\BSON\Regex;

/*
|--------------------------------------------------------------------------
| Response helpers
|--------------------------------------------------------------------------
*/

function withdrawalResponse(
    bool $success,
    string $message = "",
    array $data = [],
    int $status = 200
): void {
    http_response_code($status);

    echo json_encode(
        array_merge(
            [
                "success" => $success,
                "message" => $message
            ],
            $data
        ),
        JSON_UNESCAPED_SLASHES
    );

    exit;
}

/*
|--------------------------------------------------------------------------
| Session
|--------------------------------------------------------------------------
*/

if (function_exists("startSecureSession")) {
    startSecureSession();
} else {
    if (session_status() !== PHP_SESSION_ACTIVE) {
        session_set_cookie_params([
            "lifetime" => 0,
            "path" => "/",
            "secure" => true,
            "httponly" => true,
            "samesite" => "None"
        ]);

        session_start();
    }
}

/*
|--------------------------------------------------------------------------
| General helpers
|--------------------------------------------------------------------------
*/

function withdrawalString($value, string $default = ""): string
{
    if ($value === null) {
        return $default;
    }

    if (is_string($value)) {
        return trim($value);
    }

    if (is_scalar($value)) {
        return trim((string)$value);
    }

    return $default;
}

function withdrawalMoney($value): float
{
    if ($value instanceof Decimal128) {
        return (float)$value->__toString();
    }

    if (is_numeric($value)) {
        return (float)$value;
    }

    if (is_string($value)) {
        $clean = str_replace([",", "UGX", "ugx", " "], "", $value);

        if (is_numeric($clean)) {
            return (float)$clean;
        }
    }

    return 0.0;
}

function withdrawalBool($value, bool $default = false): bool
{
    if ($value === null) {
        return $default;
    }

    if (is_bool($value)) {
        return $value;
    }

    if (is_numeric($value)) {
        return ((int)$value) === 1;
    }

    if (is_string($value)) {
        return in_array(
            strtolower(trim($value)),
            ["1", "true", "yes", "on"],
            true
        );
    }

    return $default;
}

function withdrawalDate($value): ?string
{
    try {
        if ($value instanceof UTCDateTime) {
            return $value->toDateTime()
                ->setTimezone(new DateTimeZone("UTC"))
                ->format("c");
        }

        if ($value instanceof DateTimeInterface) {
            return $value
                ->setTimezone(new DateTimeZone("UTC"))
                ->format("c");
        }

        if (is_string($value) && trim($value) !== "") {
            $date = new DateTime($value);
            $date->setTimezone(new DateTimeZone("UTC"));
            return $date->format("c");
        }
    } catch (Throwable $e) {
        // Ignore invalid date values.
    }

    return null;
}

function withdrawalObjectId($value): ?ObjectId
{
    if ($value instanceof ObjectId) {
        return $value;
    }

    if (is_string($value) && preg_match('/^[a-fA-F0-9]{24}$/', trim($value))) {
        try {
            return new ObjectId(trim($value));
        } catch (Throwable $e) {
            return null;
        }
    }

    return null;
}

function withdrawalIdFilter($value): ?array
{
    $value = withdrawalString($value);

    if ($value === "") {
        return null;
    }

    $objectId = withdrawalObjectId($value);

    if ($objectId !== null) {
        return [
            '$or' => [
                ["_id" => $objectId],
                ["reference" => $value]
            ]
        ];
    }

    return [
        "reference" => $value
    ];
}

function getWithdrawalUserId($withdrawal)
{
    if (isset($withdrawal["user_id"])) {
        return $withdrawal["user_id"];
    }

    if (isset($withdrawal["userId"])) {
        return $withdrawal["userId"];
    }

    if (isset($withdrawal["userid"])) {
        return $withdrawal["userid"];
    }

    return null;
}

/*
|--------------------------------------------------------------------------
| Admin authentication
|--------------------------------------------------------------------------
*/

function authenticateWithdrawalAdmin(): array
{
    global $users;

    $sessionUserId =
        $_SESSION["user_id"] ??
        $_SESSION["userId"] ??
        null;

    $sessionEmail =
        $_SESSION["email"] ??
        $_SESSION["user_email"] ??
        null;

    $user = null;

    /*
    |--------------------------------------------------------------------------
    | Find by ObjectId
    |--------------------------------------------------------------------------
    */

    if ($sessionUserId !== null) {
        $objectId = withdrawalObjectId($sessionUserId);

        if ($objectId !== null) {
            try {
                $user = $users->findOne([
                    "_id" => $objectId
                ]);
            } catch (Throwable $e) {
                $user = null;
            }
        }
    }

    /*
    |--------------------------------------------------------------------------
    | Find by string ID
    |--------------------------------------------------------------------------
    */

    if ($user === null && $sessionUserId !== null) {
        try {
            $user = $users->findOne([
                "id" => withdrawalString($sessionUserId)
            ]);
        } catch (Throwable $e) {
            $user = null;
        }
    }

    /*
    |--------------------------------------------------------------------------
    | Find by email
    |--------------------------------------------------------------------------
    */

    if ($user === null && $sessionEmail !== null) {
        try {
            $user = $users->findOne([
                "email" => strtolower(trim((string)$sessionEmail))
            ]);
        } catch (Throwable $e) {
            $user = null;
        }
    }

    /*
    |--------------------------------------------------------------------------
    | If no user was found, reject
    |--------------------------------------------------------------------------
    */

    if ($user === null) {
        withdrawalResponse(
            false,
            "Administrator authentication required.",
            [],
            401
        );
    }

    /*
    |--------------------------------------------------------------------------
    | Check account status
    |--------------------------------------------------------------------------
    */

    $statusFields = [
        "blocked",
        "suspended",
        "disabled",
        "banned"
    ];

    foreach ($statusFields as $field) {
        if (
            isset($user[$field]) &&
            withdrawalBool($user[$field], false) === true
        ) {
            withdrawalResponse(
                false,
                "Administrator account is disabled.",
                [],
                403
            );
        }
    }

    if (
        isset($user["status"]) &&
        in_array(
            strtolower(withdrawalString($user["status"])),
            ["blocked", "suspended", "disabled", "banned", "inactive"],
            true
        )
    ) {
        withdrawalResponse(
            false,
            "Administrator account is not active.",
            [],
            403
        );
    }

    /*
    |--------------------------------------------------------------------------
    | Determine admin status
    |--------------------------------------------------------------------------
    */

    $role = strtolower(
        withdrawalString(
            $user["role"] ??
            $user["user_role"] ??
            ""
        )
    );

    $accountType = strtolower(
        withdrawalString(
            $user["account_type"] ??
            $user["accountType"] ??
            ""
        )
    );

    $isAdmin =
        in_array($role, ["admin", "administrator"], true) ||
        in_array($accountType, ["admin", "administrator"], true);

    /*
    |--------------------------------------------------------------------------
    | Environment-configured administrator
    |--------------------------------------------------------------------------
    */

    $configuredAdminEmail = strtolower(
        trim((string)(getenv("ADMIN_EMAIL") ?: ""))
    );

    $configuredAdminId = trim(
        (string)(getenv("ADMIN_USER_ID") ?: "")
    );

    $currentEmail = strtolower(
        withdrawalString($user["email"] ?? "")
    );

    $currentId = "";

    if (isset($user["_id"])) {
        $currentId = (string)$user["_id"];
    } elseif (isset($user["id"])) {
        $currentId = withdrawalString($user["id"]);
    }

    if (
        $configuredAdminEmail !== "" &&
        $currentEmail !== "" &&
        hash_equals($configuredAdminEmail, $currentEmail)
    ) {
        $isAdmin = true;
    }

    if (
        $configuredAdminId !== "" &&
        $currentId !== "" &&
        hash_equals($configuredAdminId, $currentId)
    ) {
        $isAdmin = true;
    }

    if (!$isAdmin) {
        withdrawalResponse(
            false,
            "Administrator access required.",
            [],
            403
        );
    }

    return [
        "user" => $user,
        "id" => $currentId,
        "email" => $currentEmail
    ];
}

/*
|--------------------------------------------------------------------------
| Authenticate
|--------------------------------------------------------------------------
*/

$admin = authenticateWithdrawalAdmin();

/*
|--------------------------------------------------------------------------
| GET - Load withdrawal requests
|--------------------------------------------------------------------------
*/

if ($_SERVER["REQUEST_METHOD"] === "GET") {

    try {

        /*
        |--------------------------------------------------------------------------
        | IMPORTANT:
        |
        | These are literal MongoDB operators.
        |
        | Correct:
        | '$or'
        | '$exists'
        |
        | Never use:
        | "$or"
        | '$exists"'
        |--------------------------------------------------------------------------
        */

        $withdrawalFilter = [
            '$or' => [
                [
                    "type" => [
                        '$in' => [
                            "withdrawal",
                            "Withdrawal",
                            "WITHDRAWAL"
                        ]
                    ]
                ],
                [
                    "payout_sent" => [
                        '$exists' => true
                    ]
                ],
                [
                    "balance_reserved" => true
                ],
                [
                    "admin_approved" => true
                ]
            ]
        ];

        /*
        |--------------------------------------------------------------------------
        | Fetch transactions
        |--------------------------------------------------------------------------
        */

        $cursor = $transactions->find(
            $withdrawalFilter,
            [
                "sort" => [
                    "created_at" => -1,
                    "_id" => -1
                ],
                "limit" => 500
            ]
        );

        $withdrawals = [];

        $totalWithdrawals = 0.0;
        $pendingWithdrawals = 0.0;
        $approvedWithdrawals = 0.0;
        $rejectedWithdrawals = 0.0;

        foreach ($cursor as $withdrawal) {

            try {

                $id = isset($withdrawal["_id"])
                    ? (string)$withdrawal["_id"]
                    : "";

                $reference =
                    withdrawalString($withdrawal["reference"] ?? "");

                if ($reference === "") {
                    $reference =
                        withdrawalString($withdrawal["transaction_id"] ?? "");
                }

                if ($reference === "") {
                    $reference = $id;
                }

                $amount = withdrawalMoney(
                    $withdrawal["amount"] ??
                    $withdrawal["withdrawal_amount"] ??
                    $withdrawal["value"] ??
                    0
                );

                $status = strtolower(
                    withdrawalString(
                        $withdrawal["status"] ?? "pending"
                    )
                );

                if ($status === "") {
                    $status = "pending";
                }

                $userId = getWithdrawalUserId($withdrawal);

                $user = null;

                /*
                |--------------------------------------------------------------------------
                | Find associated user
                |--------------------------------------------------------------------------
                */

                if ($userId !== null) {

                    $userObjectId = withdrawalObjectId($userId);

                    if ($userObjectId !== null) {
                        try {
                            $user = $users->findOne([
                                "_id" => $userObjectId
                            ]);
                        } catch (Throwable $e) {
                            $user = null;
                        }
                    }

                    /*
                    |--------------------------------------------------------------------------
                    | Try string ID if ObjectId lookup did not work
                    |--------------------------------------------------------------------------
                    */

                    if ($user === null) {
                        try {
                            $user = $users->findOne([
                                "id" => withdrawalString($userId)
                            ]);
                        } catch (Throwable $e) {
                            $user = null;
                        }
                    }
                }

                /*
                |--------------------------------------------------------------------------
                | User information
                |--------------------------------------------------------------------------
                */

                $firstName = "";
                $lastName = "";
                $fullName = "";
                $phone = "";
                $email = "";

                if ($user !== null) {

                    $firstName = withdrawalString(
                        $user["firstName"] ??
                        $user["first_name"] ??
                        ""
                    );

                    $lastName = withdrawalString(
                        $user["lastName"] ??
                        $user["last_name"] ??
                        ""
                    );

                    $fullName = withdrawalString(
                        $user["name"] ??
                        $user["full_name"] ??
                        $user["fullName"] ??
                        ""
                    );

                    if ($fullName === "") {
                        $fullName = trim(
                            $firstName . " " . $lastName
                        );
                    }

                    $phone = withdrawalString(
                        $user["phone"] ??
                        $user["phone_number"] ??
                        $user["mobile"] ??
                        ""
                    );

                    $email = withdrawalString(
                        $user["email"] ?? ""
                    );
                }

                /*
                |--------------------------------------------------------------------------
                | Withdrawal fields
                |--------------------------------------------------------------------------
                */

                $method = withdrawalString(
                    $withdrawal["method"] ??
                    $withdrawal["payment_method"] ??
                    $withdrawal["withdrawal_method"] ??
                    ""
                );

                $accountNumber = withdrawalString(
                    $withdrawal["account_number"] ??
                    $withdrawal["accountNumber"] ??
                    $withdrawal["phone"] ??
                    $withdrawal["phone_number"] ??
                    ""
                );

                $accountName = withdrawalString(
                    $withdrawal["account_name"] ??
                    $withdrawal["accountName"] ??
                    $withdrawal["recipient_name"] ??
                    $fullName
                );

                $createdAt = withdrawalDate(
                    $withdrawal["created_at"] ??
                    $withdrawal["createdAt"] ??
                    $withdrawal["date"] ??
                    null
                );

                $processedAt = withdrawalDate(
                    $withdrawal["processed_at"] ??
                    $withdrawal["updated_at"] ??
                    null
                );

                $adminNote = withdrawalString(
                    $withdrawal["admin_note"] ??
                    $withdrawal["adminNote"] ??
                    $withdrawal["rejection_reason"] ??
                    ""
                );

                /*
                |--------------------------------------------------------------------------
                | Totals
                |--------------------------------------------------------------------------
                */

                $totalWithdrawals += $amount;

                if ($status === "pending") {
                    $pendingWithdrawals += $amount;
                } elseif ($status === "approved" || $status === "completed") {
                    $approvedWithdrawals += $amount;
                } elseif ($status === "rejected") {
                    $rejectedWithdrawals += $amount;
                }

                /*
                |--------------------------------------------------------------------------
                | Response record
                |--------------------------------------------------------------------------
                */

                $withdrawals[] = [
                    "id" => $id,
                    "_id" => $id,
                    "reference" => $reference,

                    "user_id" =>
                        $userId instanceof ObjectId
                            ? (string)$userId
                            : withdrawalString($userId),

                    "userId" =>
                        $userId instanceof ObjectId
                            ? (string)$userId
                            : withdrawalString($userId),

                    "name" => $fullName,
                    "full_name" => $fullName,
                    "firstName" => $firstName,
                    "lastName" => $lastName,

                    "email" => $email,
                    "phone" => $phone,

                    "amount" => $amount,
                    "status" => $status,

                    "method" => $method,
                    "payment_method" => $method,

                    "account_number" => $accountNumber,
                    "accountNumber" => $accountNumber,

                    "account_name" => $accountName,
                    "accountName" => $accountName,

                    "balance_reserved" =>
                        withdrawalBool(
                            $withdrawal["balance_reserved"] ?? false
                        ),

                    "balance_deducted" =>
                        withdrawalBool(
                            $withdrawal["balance_deducted"] ?? false
                        ),

                    "admin_approved" =>
                        withdrawalBool(
                            $withdrawal["admin_approved"] ?? false
                        ),

                    "payout_sent" =>
                        withdrawalBool(
                            $withdrawal["payout_sent"] ?? false
                        ),

                    "created_at" => $createdAt,
                    "processed_at" => $processedAt,

                    "admin_note" => $adminNote,

                    "admin_id" =>
                        withdrawalString(
                            $withdrawal["admin_id"] ?? ""
                        ),

                    "admin_email" =>
                        withdrawalString(
                            $withdrawal["admin_email"] ?? ""
                        )
                ];

            } catch (Throwable $rowError) {

                /*
                |--------------------------------------------------------------------------
                | Do not allow one malformed transaction record to break the
                | entire withdrawal page.
                |--------------------------------------------------------------------------
                */

                error_log(
                    "Crown Cash withdrawal row error: " .
                    $rowError->getMessage()
                );

                continue;
            }
        }

        withdrawalResponse(
            true,
            "Withdrawals loaded successfully.",
            [
                "withdrawals" => $withdrawals,

                "data" => $withdrawals,

                "total" => count($withdrawals),

                "totals" => [
                    "withdrawals" => $totalWithdrawals,
                    "total_withdrawals" => $totalWithdrawals,

                    "pending" => $pendingWithdrawals,
                    "pending_withdrawals" => $pendingWithdrawals,

                    "approved" => $approvedWithdrawals,
                    "approved_withdrawals" => $approvedWithdrawals,

                    "rejected" => $rejectedWithdrawals,
                    "rejected_withdrawals" => $rejectedWithdrawals
                ]
            ]
        );

    } catch (Throwable $e) {

        error_log(
            "Crown Cash admin_withdrawal.php GET error: " .
            $e->getMessage()
        );

        withdrawalResponse(
            false,
            "Unable to load withdrawals.",
            [
                "error" => $e->getMessage()
            ],
            500
        );
    }
}

/*
|--------------------------------------------------------------------------
| POST - Approve or reject withdrawal
|--------------------------------------------------------------------------
*/

if ($_SERVER["REQUEST_METHOD"] === "POST") {

    try {

        $rawBody = file_get_contents("php://input");

        $input = json_decode(
            $rawBody ?: "{}",
            true
        );

        if (!is_array($input)) {
            $input = [];
        }

        $withdrawalId =
            $input["withdrawalId"] ??
            $input["withdrawal_id"] ??
            $input["id"] ??
            "";

        $action = strtolower(
            withdrawalString(
                $input["action"] ??
                $input["status"] ??
                ""
            )
        );

        if ($withdrawalId === "") {
            withdrawalResponse(
                false,
                "Withdrawal ID is required.",
                [],
                400
            );
        }

        if (!in_array($action, ["approve", "approved", "reject", "rejected"], true)) {
            withdrawalResponse(
                false,
                "Invalid withdrawal action.",
                [],
                400
            );
        }

        if ($action === "approved") {
            $action = "approve";
        }

        if ($action === "rejected") {
            $action = "reject";
        }

        /*
        |--------------------------------------------------------------------------
        | Find withdrawal
        |--------------------------------------------------------------------------
        */

        $idFilter = withdrawalIdFilter($withdrawalId);

        if ($idFilter === null) {
            withdrawalResponse(
                false,
                "Invalid withdrawal ID.",
                [],
                400
            );
        }

        $withdrawal = $transactions->findOne($idFilter);

        if ($withdrawal === null) {
            withdrawalResponse(
                false,
                "Withdrawal request not found.",
                [],
                404
            );
        }

        /*
        |--------------------------------------------------------------------------
        | Verify it is a withdrawal
        |--------------------------------------------------------------------------
        */

        $type = strtolower(
            withdrawalString($withdrawal["type"] ?? "")
        );

        $isWithdrawal =
            $type === "withdrawal" ||
            isset($withdrawal["payout_sent"]) ||
            isset($withdrawal["balance_reserved"]) ||
            isset($withdrawal["withdrawal_amount"]);

        if (!$isWithdrawal) {
            withdrawalResponse(
                false,
                "The selected transaction is not a withdrawal request.",
                [],
                400
            );
        }

        /*
        |--------------------------------------------------------------------------
        | Verify current status
        |--------------------------------------------------------------------------
        */

        $currentStatus = strtolower(
            withdrawalString(
                $withdrawal["status"] ?? "pending"
            )
        );

        if (
            $currentStatus !== "pending" &&
            $currentStatus !== ""
        ) {
            withdrawalResponse(
                false,
                "This withdrawal has already been processed.",
                [
                    "status" => $currentStatus
                ],
                409
            );
        }

        /*
        |--------------------------------------------------------------------------
        | Amount
        |--------------------------------------------------------------------------
        */

        $amount = withdrawalMoney(
            $withdrawal["amount"] ??
            $withdrawal["withdrawal_amount"] ??
            0
        );

        if ($amount <= 0) {
            withdrawalResponse(
                false,
                "Withdrawal amount is invalid.",
                [],
                400
            );
        }

        /*
        |--------------------------------------------------------------------------
        | User ID
        |--------------------------------------------------------------------------
        */

        $userId = getWithdrawalUserId($withdrawal);

        if ($userId === null || withdrawalString($userId) === "") {
            withdrawalResponse(
                false,
                "Withdrawal is missing the user ID.",
                [],
                400
            );
        }

        /*
        |--------------------------------------------------------------------------
        | Admin information
        |--------------------------------------------------------------------------
        */

        $adminUser = $admin["user"];

        $adminId = "";

        if (isset($adminUser["_id"])) {
            $adminId = (string)$adminUser["_id"];
        } elseif (isset($adminUser["id"])) {
            $adminId = withdrawalString($adminUser["id"]);
        }

        $adminEmail = withdrawalString(
            $adminUser["email"] ?? ""
        );

        $adminName = withdrawalString(
            $adminUser["name"] ??
            $adminUser["full_name"] ??
            ""
        );

        /*
        |--------------------------------------------------------------------------
        | Common update filter
        |--------------------------------------------------------------------------
        */

        $transactionId = $withdrawal["_id"] ?? null;

        if ($transactionId === null) {
            withdrawalResponse(
                false,
                "Withdrawal record has no database ID.",
                [],
                400
            );
        }

        /*
        |--------------------------------------------------------------------------
        | APPROVE
        |--------------------------------------------------------------------------
        |
        | The principal was already reserved when the withdrawal was created.
        | Therefore approval does NOT subtract the amount again.
        |--------------------------------------------------------------------------
        */

        if ($action === "approve") {

            $updateResult = $transactions->updateOne(
                [
                    "_id" => $transactionId,
                    "status" => "pending"
                ],
                [
                    '$set' => [
                        "status" => "approved",
                        "admin_approved" => true,
                        "balance_reserved" => false,
                        "balance_deducted" => true,
                        "processed_at" => new UTCDateTime(),
                        "updated_at" => new UTCDateTime(),
                        "admin_id" => $adminId,
                        "admin_email" => $adminEmail,
                        "admin_name" => $adminName,
                        "admin_action" => "approved"
                    ]
                ]
            );

            if ($updateResult->getMatchedCount() === 0) {
                withdrawalResponse(
                    false,
                    "Withdrawal could not be approved because it was already processed.",
                    [],
                    409
                );
            }

            withdrawalResponse(
                true,
                "Withdrawal approved successfully.",
                [
                    "withdrawal" => [
                        "id" => (string)$transactionId,
                        "status" => "approved",
                        "amount" => $amount
                    ]
                ]
            );
        }

        /*
        |--------------------------------------------------------------------------
        | REJECT
        |--------------------------------------------------------------------------
        |
        | Rejection returns the previously reserved amount to the user's wallet.
        |--------------------------------------------------------------------------
        */

        if ($action === "reject") {

            /*
            |--------------------------------------------------------------------------
            | Find user
            |--------------------------------------------------------------------------
            */

            $user = null;

            $userObjectId = withdrawalObjectId($userId);

            if ($userObjectId !== null) {
                try {
                    $user = $users->findOne([
                        "_id" => $userObjectId
                    ]);
                } catch (Throwable $e) {
                    $user = null;
                }
            }

            if ($user === null) {
                try {
                    $user = $users->findOne([
                        "id" => withdrawalString($userId)
                    ]);
                } catch (Throwable $e) {
                    $user = null;
                }
            }

            if ($user === null) {
                withdrawalResponse(
                    false,
                    "The user associated with this withdrawal could not be found.",
                    [],
                    404
                );
            }

            /*
            |--------------------------------------------------------------------------
            | Determine wallet field
            |--------------------------------------------------------------------------
            */

            $balanceField = "balance";

            if (array_key_exists("balance", $user)) {
                $balanceField = "balance";
            } elseif (array_key_exists("wallet_balance", $user)) {
                $balanceField = "wallet_balance";
            } elseif (array_key_exists("walletBalance", $user)) {
                $balanceField = "walletBalance";
            } elseif (isset($user["wallet"]) && is_array($user["wallet"])) {
                /*
                |--------------------------------------------------------------------------
                | Nested wallet support
                |--------------------------------------------------------------------------
                */

                $oldWalletBalance = withdrawalMoney(
                    $user["wallet"]["balance"] ?? 0
                );

                $walletUpdate = $users->updateOne(
                    [
                        "_id" => $user["_id"] ?? null
                    ],
                    [
                        '$set' => [
                            "wallet.balance" =>
                                $oldWalletBalance + $amount
                        ]
                    ]
                );

                if ($walletUpdate->getMatchedCount() === 0) {
                    withdrawalResponse(
                        false,
                        "Unable to restore the user's wallet balance.",
                        [],
                        500
                    );
                }

                /*
                |--------------------------------------------------------------------------
                | Mark rejected after successful wallet restoration.
                |--------------------------------------------------------------------------
                */

                $rejectResult = $transactions->updateOne(
                    [
                        "_id" => $transactionId,
                        "status" => "pending"
                    ],
                    [
                        '$set' => [
                            "status" => "rejected",
                            "admin_approved" => false,
                            "balance_reserved" => false,
                            "balance_deducted" => false,
                            "processed_at" => new UTCDateTime(),
                            "updated_at" => new UTCDateTime(),
                            "admin_id" => $adminId,
                            "admin_email" => $adminEmail,
                            "admin_name" => $adminName,
                            "admin_action" => "rejected"
                        ]
                    ]
                );

                if ($rejectResult->getMatchedCount() === 0) {

                    /*
                    |--------------------------------------------------------------------------
                    | Attempt to undo wallet restoration.
                    |--------------------------------------------------------------------------
                    */

                    try {
                        $users->updateOne(
                            [
                                "_id" => $user["_id"]
                            ],
                            [
                                '$inc' => [
                                    "wallet.balance" => -$amount
                                ]
                            ]
                        );
                    } catch (Throwable $rollbackError) {
                        error_log(
                            "Crown Cash withdrawal rollback error: " .
                            $rollbackError->getMessage()
                        );
                    }

                    withdrawalResponse(
                        false,
                        "Withdrawal could not be rejected because it was already processed.",
                        [],
                        409
                    );
                }

                withdrawalResponse(
                    true,
                    "Withdrawal rejected and funds restored successfully.",
                    [
                        "withdrawal" => [
                            "id" => (string)$transactionId,
                            "status" => "rejected",
                            "amount" => $amount
                        ]
                    ]
                );
            }

            /*
            |--------------------------------------------------------------------------
            | Read current balance
            |--------------------------------------------------------------------------
            */

            $currentBalance = withdrawalMoney(
                $user[$balanceField] ?? 0
            );

            /*
            |--------------------------------------------------------------------------
            | Restore reserved withdrawal amount.
            |--------------------------------------------------------------------------
            */

            $newBalance = $currentBalance + $amount;

            $userFilter = [];

            if (isset($user["_id"])) {
                $userFilter = [
                    "_id" => $user["_id"]
                ];
            } elseif (isset($user["id"])) {
                $userFilter = [
                    "id" => $user["id"]
                ];
            } else {
                withdrawalResponse(
                    false,
                    "User record has no valid identifier.",
                    [],
                    500
                );
            }

            $balanceUpdate = $users->updateOne(
                $userFilter,
                [
                    '$set' => [
                        $balanceField => $newBalance
                    ]
                ]
            );

            if ($balanceUpdate->getMatchedCount() === 0) {
                withdrawalResponse(
                    false,
                    "Unable to restore the user's wallet balance.",
                    [],
                    500
                );
            }

            /*
            |--------------------------------------------------------------------------
            | Mark withdrawal rejected.
            |--------------------------------------------------------------------------
            */

            $rejectResult = $transactions->updateOne(
                [
                    "_id" => $transactionId,
                    "status" => "pending"
                ],
                [
                    '$set' => [
                        "status" => "rejected",
                        "admin_approved" => false,
                        "balance_reserved" => false,
                        "balance_deducted" => false,
                        "processed_at" => new UTCDateTime(),
                        "updated_at" => new UTCDateTime(),
                        "admin_id" => $adminId,
                        "admin_email" => $adminEmail,
                        "admin_name" => $adminName,
                        "admin_action" => "rejected"
                    ]
                ]
            );

            if ($rejectResult->getMatchedCount() === 0) {

                /*
                |--------------------------------------------------------------------------
                | Attempt manual rollback because we are intentionally not
                | using MongoDB transactions.
                |--------------------------------------------------------------------------
                */

                try {
                    $users->updateOne(
                        $userFilter,
                        [
                            '$set' => [
                                $balanceField => $currentBalance
                            ]
                        ]
                    );
                } catch (Throwable $rollbackError) {
                    error_log(
                        "Crown Cash withdrawal balance rollback error: " .
                        $rollbackError->getMessage()
                    );
                }

                withdrawalResponse(
                    false,
                    "Withdrawal could not be rejected because it was already processed.",
                    [],
                    409
                );
            }

            withdrawalResponse(
                true,
                "Withdrawal rejected and funds restored successfully.",
                [
                    "withdrawal" => [
                        "id" => (string)$transactionId,
                        "status" => "rejected",
                        "amount" => $amount,
                        "restored_balance" => $newBalance
                    ]
                ]
            );
        }

        withdrawalResponse(
            false,
            "Unsupported withdrawal action.",
            [],
            400
        );

    } catch (Throwable $e) {

        error_log(
            "Crown Cash admin_withdrawal.php POST error: " .
            $e->getMessage()
        );

        withdrawalResponse(
            false,
            "Unable to process withdrawal.",
            [
                "error" => $e->getMessage()
            ],
            500
        );
    }
}

/*
|--------------------------------------------------------------------------
| Unsupported method
|--------------------------------------------------------------------------
*/

withdrawalResponse(
    false,
    "Method not allowed.",
    [],
    405
);