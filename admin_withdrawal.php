<?php
declare(strict_types=1);

/*
|--------------------------------------------------------------------------
| Crown Cash - Admin Withdrawal API
|--------------------------------------------------------------------------
| File: admin_withdrawal.php
|
| GET
|   Loads withdrawal requests for the admin withdrawal page.
|
| POST
|   Approves or rejects a withdrawal.
|
| Accounting rules
|   1. Withdrawal amount is reserved/deducted when withdrawal is created.
|   2. Approval does NOT deduct the wallet again.
|   3. Rejection restores the amount to the user's wallet.
|   4. A withdrawal cannot be processed twice.
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


/*
|--------------------------------------------------------------------------
| RESPONSE
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
| SESSION
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
| GENERAL HELPERS
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

    if (is_int($value) || is_float($value)) {
        return (float)$value;
    }

    if (is_numeric($value)) {
        return (float)$value;
    }

    if (is_string($value)) {

        $clean = str_replace(
            [",", "UGX", "ugx", " "],
            "",
            $value
        );

        if (is_numeric($clean)) {
            return (float)$clean;
        }
    }

    return 0.0;
}


function withdrawalBool(
    $value,
    bool $default = false
): bool {

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
            [
                "1",
                "true",
                "yes",
                "on"
            ],
            true
        );
    }

    return $default;
}


function withdrawalDate($value): ?string
{
    try {

        if ($value instanceof UTCDateTime) {

            return $value
                ->toDateTime()
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

            $date->setTimezone(
                new DateTimeZone("UTC")
            );

            return $date->format("c");
        }

    } catch (Throwable $e) {

        error_log(
            "Crown Cash withdrawal date error: " .
            $e->getMessage()
        );
    }

    return null;
}


function withdrawalObjectId($value): ?ObjectId
{
    if ($value instanceof ObjectId) {
        return $value;
    }

    if (
        is_string($value) &&
        preg_match(
            '/^[a-fA-F0-9]{24}$/',
            trim($value)
        )
    ) {

        try {

            return new ObjectId(
                trim($value)
            );

        } catch (Throwable $e) {

            return null;
        }
    }

    return null;
}


/*
|--------------------------------------------------------------------------
| GET USER ID FROM WITHDRAWAL
|--------------------------------------------------------------------------
|
| Supports all known Crown Cash field names.
|--------------------------------------------------------------------------
*/

function getWithdrawalUserId($withdrawal)
{
    $fields = [
        "user_id",
        "userId",
        "userid",
        "userID",
        "user"
    ];

    foreach ($fields as $field) {

        if (
            isset($withdrawal[$field]) &&
            $withdrawal[$field] !== null
        ) {

            $value = $withdrawal[$field];

            if ($value instanceof ObjectId) {
                return $value;
            }

            if (is_string($value) && trim($value) !== "") {
                return trim($value);
            }

            if (is_scalar($value)) {
                return (string)$value;
            }
        }
    }

    return null;
}


/*
|--------------------------------------------------------------------------
| GET USER ID FROM POST INPUT
|--------------------------------------------------------------------------
*/

function getPostedUserId(array $input)
{
    $fields = [
        "user_id",
        "userId",
        "userid",
        "userID"
    ];

    foreach ($fields as $field) {

        if (
            isset($input[$field]) &&
            $input[$field] !== null
        ) {

            $value = $input[$field];

            if ($value instanceof ObjectId) {
                return $value;
            }

            if (is_string($value) && trim($value) !== "") {
                return trim($value);
            }

            if (is_scalar($value)) {
                return (string)$value;
            }
        }
    }

    return null;
}


/*
|--------------------------------------------------------------------------
| WITHDRAWAL ID FILTER
|--------------------------------------------------------------------------
*/

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
                [
                    "_id" => $objectId
                ],
                [
                    "reference" => $value
                ],
                [
                    "transaction_id" => $value
                ]
            ]
        ];
    }

    return [
        '$or' => [
            [
                "reference" => $value
            ],
            [
                "transaction_id" => $value
            ]
        ]
    ];
}


/*
|--------------------------------------------------------------------------
| FIND USER
|--------------------------------------------------------------------------
*/

function findWithdrawalUser($userId)
{
    global $users;

    if ($userId === null) {
        return null;
    }

    $userString = withdrawalString($userId);

    if ($userString === "") {
        return null;
    }

    /*
    |--------------------------------------------------------------------------
    | ObjectId lookup
    |--------------------------------------------------------------------------
    */

    $objectId = withdrawalObjectId($userId);

    if ($objectId !== null) {

        try {

            $user = $users->findOne([
                "_id" => $objectId
            ]);

            if ($user !== null) {
                return $user;
            }

        } catch (Throwable $e) {

            error_log(
                "Crown Cash ObjectId user lookup error: " .
                $e->getMessage()
            );
        }
    }

    /*
    |--------------------------------------------------------------------------
    | String ID lookup
    |--------------------------------------------------------------------------
    */

    try {

        $user = $users->findOne([
            "id" => $userString
        ]);

        if ($user !== null) {
            return $user;
        }

    } catch (Throwable $e) {

        error_log(
            "Crown Cash string user lookup error: " .
            $e->getMessage()
        );
    }

    /*
    |--------------------------------------------------------------------------
    | _id stored as string
    |--------------------------------------------------------------------------
    */

    try {

        $user = $users->findOne([
            "_id" => $userString
        ]);

        if ($user !== null) {
            return $user;
        }

    } catch (Throwable $e) {

        // Ignore invalid _id type.
    }

    /*
    |--------------------------------------------------------------------------
    | Email fallback if supplied as an email-like ID
    |--------------------------------------------------------------------------
    */

    if (filter_var($userString, FILTER_VALIDATE_EMAIL)) {

        try {

            $user = $users->findOne([
                "email" => strtolower($userString)
            ]);

            if ($user !== null) {
                return $user;
            }

        } catch (Throwable $e) {

            error_log(
                "Crown Cash email user lookup error: " .
                $e->getMessage()
            );
        }
    }

    return null;
}


/*
|--------------------------------------------------------------------------
| FIND WALLET FIELD
|--------------------------------------------------------------------------
|
| Returns:
|
| [
|   "type" => "top_level",
|   "field" => "balance"
| ]
|
| or
|
| [
|   "type" => "nested",
|   "field" => "wallet.balance"
| ]
|--------------------------------------------------------------------------
*/

function getWalletField($user): array
{
    if (array_key_exists("balance", $user)) {

        return [
            "type" => "top_level",
            "field" => "balance"
        ];
    }

    if (array_key_exists("wallet_balance", $user)) {

        return [
            "type" => "top_level",
            "field" => "wallet_balance"
        ];
    }

    if (array_key_exists("walletBalance", $user)) {

        return [
            "type" => "top_level",
            "field" => "walletBalance"
        ];
    }

    if (
        isset($user["wallet"]) &&
        (
            is_array($user["wallet"]) ||
            $user["wallet"] instanceof \MongoDB\Model\BSONDocument
        )
    ) {

        return [
            "type" => "nested",
            "field" => "wallet.balance"
        ];
    }

    /*
    |--------------------------------------------------------------------------
    | Default Crown Cash wallet field
    |--------------------------------------------------------------------------
    */

    return [
        "type" => "top_level",
        "field" => "balance"
    ];
}


/*
|--------------------------------------------------------------------------
| GET USER BALANCE
|--------------------------------------------------------------------------
*/

function getUserWalletBalance($user): float
{
    $wallet = getWalletField($user);

    if ($wallet["type"] === "nested") {

        return withdrawalMoney(
            $user["wallet"]["balance"] ?? 0
        );
    }

    return withdrawalMoney(
        $user[$wallet["field"]] ?? 0
    );
}


/*
|--------------------------------------------------------------------------
| UPDATE USER WALLET BALANCE
|--------------------------------------------------------------------------
*/

function setUserWalletBalance(
    $user,
    float $newBalance
): bool {

    global $users;

    $wallet = getWalletField($user);

    if (isset($user["_id"])) {

        $userFilter = [
            "_id" => $user["_id"]
        ];

    } elseif (isset($user["id"])) {

        $userFilter = [
            "id" => $user["id"]
        ];

    } else {

        return false;
    }

    if ($wallet["type"] === "nested") {

        $result = $users->updateOne(
            $userFilter,
            [
                '$set' => [
                    "wallet.balance" => $newBalance
                ]
            ]
        );

    } else {

        $result = $users->updateOne(
            $userFilter,
            [
                '$set' => [
                    $wallet["field"] => $newBalance
                ]
            ]
        );
    }

    return $result->getMatchedCount() > 0;
}


/*
|--------------------------------------------------------------------------
| ADMIN AUTHENTICATION
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

        $objectId = withdrawalObjectId(
            $sessionUserId
        );

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

    if (
        $user === null &&
        $sessionUserId !== null
    ) {

        try {

            $user = $users->findOne([
                "id" => withdrawalString(
                    $sessionUserId
                )
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

    if (
        $user === null &&
        $sessionEmail !== null
    ) {

        try {

            $user = $users->findOne([
                "email" => strtolower(
                    trim(
                        (string)$sessionEmail
                    )
                )
            ]);

        } catch (Throwable $e) {

            $user = null;
        }
    }

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
    | Account status
    |--------------------------------------------------------------------------
    */

    foreach (
        [
            "blocked",
            "suspended",
            "disabled",
            "banned"
        ] as $field
    ) {

        if (
            isset($user[$field]) &&
            withdrawalBool(
                $user[$field],
                false
            )
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
            strtolower(
                withdrawalString(
                    $user["status"]
                )
            ),
            [
                "blocked",
                "suspended",
                "disabled",
                "banned",
                "inactive"
            ],
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
    | Role
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
        in_array(
            $role,
            [
                "admin",
                "administrator"
            ],
            true
        ) ||
        in_array(
            $accountType,
            [
                "admin",
                "administrator"
            ],
            true
        );

    /*
    |--------------------------------------------------------------------------
    | Environment administrator
    |--------------------------------------------------------------------------
    */

    $configuredAdminEmail = strtolower(
        trim(
            (string)(
                getenv("ADMIN_EMAIL") ?: ""
            )
        )
    );

    $configuredAdminId = trim(
        (string)(
            getenv("ADMIN_USER_ID") ?: ""
        )
    );

    $currentEmail = strtolower(
        withdrawalString(
            $user["email"] ?? ""
        )
    );

    $currentId = "";

    if (isset($user["_id"])) {

        $currentId = (string)$user["_id"];

    } elseif (isset($user["id"])) {

        $currentId = withdrawalString(
            $user["id"]
        );
    }

    if (
        $configuredAdminEmail !== "" &&
        $currentEmail !== "" &&
        hash_equals(
            $configuredAdminEmail,
            $currentEmail
        )
    ) {

        $isAdmin = true;
    }

    if (
        $configuredAdminId !== "" &&
        $currentId !== "" &&
        hash_equals(
            $configuredAdminId,
            $currentId
        )
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
| AUTHENTICATE ADMIN
|--------------------------------------------------------------------------
*/

$admin = authenticateWithdrawalAdmin();


/*
|--------------------------------------------------------------------------
| GET
|--------------------------------------------------------------------------
*/

if ($_SERVER["REQUEST_METHOD"] === "GET") {

    try {

        /*
        |--------------------------------------------------------------------------
        | Withdrawal query
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
                ],

                [
                    "withdrawal_amount" => [
                        '$exists' => true
                    ]
                ]
            ]
        ];

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

                $reference = withdrawalString(
                    $withdrawal["reference"] ?? ""
                );

                if ($reference === "") {

                    $reference = withdrawalString(
                        $withdrawal["transaction_id"] ?? ""
                    );
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
                        $withdrawal["status"] ??
                        "pending"
                    )
                );

                if ($status === "") {
                    $status = "pending";
                }

                $userId = getWithdrawalUserId(
                    $withdrawal
                );

                $user = findWithdrawalUser(
                    $userId
                );

                /*
                |--------------------------------------------------------------------------
                | User details
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
                            $firstName .
                            " " .
                            $lastName
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
                | If withdrawal itself contains user information,
                | use it as fallback.
                |--------------------------------------------------------------------------
                */

                if ($fullName === "") {

                    $fullName = withdrawalString(
                        $withdrawal["name"] ??
                        $withdrawal["full_name"] ??
                        ""
                    );
                }

                if ($phone === "") {

                    $phone = withdrawalString(
                        $withdrawal["phone"] ??
                        $withdrawal["phone_number"] ??
                        ""
                    );
                }

                if ($email === "") {

                    $email = withdrawalString(
                        $withdrawal["email"] ??
                        ""
                    );
                }

                /*
                |--------------------------------------------------------------------------
                | Payment method
                |--------------------------------------------------------------------------
                */

                $method = withdrawalString(
                    $withdrawal["method"] ??
                    $withdrawal["payment_method"] ??
                    $withdrawal["withdrawal_method"] ??
                    ""
                );

                /*
                |--------------------------------------------------------------------------
                | Account
                |--------------------------------------------------------------------------
                */

                $accountNumber = withdrawalString(
                    $withdrawal["account_number"] ??
                    $withdrawal["accountNumber"] ??
                    $withdrawal["phone"] ??
                    $withdrawal["phone_number"] ??
                    $phone
                );

                $accountName = withdrawalString(
                    $withdrawal["account_name"] ??
                    $withdrawal["accountName"] ??
                    $withdrawal["recipient_name"] ??
                    $fullName
                );

                /*
                |--------------------------------------------------------------------------
                | Dates
                |--------------------------------------------------------------------------
                */

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

                /*
                |--------------------------------------------------------------------------
                | Admin note
                |--------------------------------------------------------------------------
                */

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

                } elseif (
                    $status === "approved" ||
                    $status === "completed"
                ) {

                    $approvedWithdrawals += $amount;

                } elseif ($status === "rejected") {

                    $rejectedWithdrawals += $amount;
                }

                /*
                |--------------------------------------------------------------------------
                | Response
                |--------------------------------------------------------------------------
                */

                $normalizedUserId =
                    $userId instanceof ObjectId
                        ? (string)$userId
                        : withdrawalString($userId);

                $withdrawals[] = [

                    "id" => $id,

                    "_id" => $id,

                    "reference" => $reference,

                    "user_id" => $normalizedUserId,

                    "userId" => $normalizedUserId,

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

                    "withdrawals" =>
                        $totalWithdrawals,

                    "total_withdrawals" =>
                        $totalWithdrawals,

                    "pending" =>
                        $pendingWithdrawals,

                    "pending_withdrawals" =>
                        $pendingWithdrawals,

                    "approved" =>
                        $approvedWithdrawals,

                    "approved_withdrawals" =>
                        $approvedWithdrawals,

                    "rejected" =>
                        $rejectedWithdrawals,

                    "rejected_withdrawals" =>
                        $rejectedWithdrawals
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
| POST
|--------------------------------------------------------------------------
*/

if ($_SERVER["REQUEST_METHOD"] === "POST") {

    try {

        /*
        |--------------------------------------------------------------------------
        | Read JSON
        |--------------------------------------------------------------------------
        */

        $rawBody = file_get_contents(
            "php://input"
        );

        $input = json_decode(
            $rawBody ?: "{}",
            true
        );

        if (!is_array($input)) {
            $input = [];
        }

        /*
        |--------------------------------------------------------------------------
        | Withdrawal ID
        |--------------------------------------------------------------------------
        */

        $withdrawalId =
            $input["withdrawalId"] ??
            $input["withdrawal_id"] ??
            $input["id"] ??
            "";

        $withdrawalId = withdrawalString(
            $withdrawalId
        );

        /*
        |--------------------------------------------------------------------------
        | Action
        |--------------------------------------------------------------------------
        */

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

        if (
            !in_array(
                $action,
                [
                    "approve",
                    "approved",
                    "reject",
                    "rejected"
                ],
                true
            )
        ) {

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

        $idFilter = withdrawalIdFilter(
            $withdrawalId
        );

        if ($idFilter === null) {

            withdrawalResponse(
                false,
                "Invalid withdrawal ID.",
                [],
                400
            );
        }

        $withdrawal = $transactions->findOne(
            $idFilter
        );

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
        | Verify withdrawal
        |--------------------------------------------------------------------------
        */

        $type = strtolower(
            withdrawalString(
                $withdrawal["type"] ?? ""
            )
        );

        $isWithdrawal =
            $type === "withdrawal" ||
            isset($withdrawal["payout_sent"]) ||
            isset($withdrawal["balance_reserved"]) ||
            isset($withdrawal["withdrawal_amount"]) ||
            isset($withdrawal["withdrawal_method"]);

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
        | Status
        |--------------------------------------------------------------------------
        */

        $currentStatus = strtolower(
            withdrawalString(
                $withdrawal["status"] ??
                "pending"
            )
        );

        if ($currentStatus === "") {
            $currentStatus = "pending";
        }

        if ($currentStatus !== "pending") {

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
            $withdrawal["value"] ??
            0
        );

        if ($amount <= 0) {

            withdrawalResponse(
                false,
                "Withdrawal amount is invalid.",
                [
                    "amount" => $amount
                ],
                400
            );
        }

        /*
        |--------------------------------------------------------------------------
        | USER ID
        |--------------------------------------------------------------------------
        |
        | FIRST:
        |   Get it directly from the database withdrawal record.
        |
        | SECOND:
        |   Use the user_id supplied by the frontend if the database record
        |   does not contain it.
        |--------------------------------------------------------------------------
        */

        $userId = getWithdrawalUserId(
            $withdrawal
        );

        if (
            $userId === null ||
            withdrawalString($userId) === ""
        ) {

            $postedUserId = getPostedUserId(
                $input
            );

            if (
                $postedUserId !== null &&
                withdrawalString($postedUserId) !== ""
            ) {

                $userId = $postedUserId;
            }
        }

        /*
        |--------------------------------------------------------------------------
        | Final user ID validation
        |--------------------------------------------------------------------------
        */

        if (
            $userId === null ||
            withdrawalString($userId) === ""
        ) {

            withdrawalResponse(
                false,
                "Withdrawal is missing the user ID.",
                [
                    "withdrawal_id" => $withdrawalId,
                    "reference" =>
                        withdrawalString(
                            $withdrawal["reference"] ?? ""
                        ),
                    "available_user_fields" => [
                        "user_id" =>
                            isset($withdrawal["user_id"]),

                        "userId" =>
                            isset($withdrawal["userId"]),

                        "userid" =>
                            isset($withdrawal["userid"]),

                        "userID" =>
                            isset($withdrawal["userID"])
                    ]
                ],
                400
            );
        }

        /*
        |--------------------------------------------------------------------------
        | If frontend sent a user ID, make sure it matches the database user ID
        |--------------------------------------------------------------------------
        */

        $databaseUserId =
            getWithdrawalUserId(
                $withdrawal
            );

        $postedUserId =
            getPostedUserId(
                $input
            );

        if (
            $databaseUserId !== null &&
            $postedUserId !== null
        ) {

            $dbUserString =
                withdrawalString(
                    $databaseUserId
                );

            $postedUserString =
                withdrawalString(
                    $postedUserId
                );

            if (
                $dbUserString !== "" &&
                $postedUserString !== "" &&
                $dbUserString !== $postedUserString
            ) {

                withdrawalResponse(
                    false,
                    "The supplied user ID does not match the withdrawal owner.",
                    [
                        "withdrawal_user_id" =>
                            $dbUserString,

                        "submitted_user_id" =>
                            $postedUserString
                    ],
                    400
                );
            }
        }

        /*
        |--------------------------------------------------------------------------
        | ADMIN DETAILS
        |--------------------------------------------------------------------------
        */

        $adminUser = $admin["user"];

        $adminId = "";

        if (isset($adminUser["_id"])) {

            $adminId = (string)$adminUser["_id"];

        } elseif (isset($adminUser["id"])) {

            $adminId = withdrawalString(
                $adminUser["id"]
            );
        }

        $adminEmail = withdrawalString(
            $adminUser["email"] ?? ""
        );

        $adminName = withdrawalString(
            $adminUser["name"] ??
            $adminUser["full_name"] ??
            $adminUser["fullName"] ??
            ""
        );

        /*
        |--------------------------------------------------------------------------
        | Transaction ID
        |--------------------------------------------------------------------------
        */

        $transactionId =
            $withdrawal["_id"] ?? null;

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
        | IMPORTANT:
        |
        | Approval does NOT change the wallet.
        |
        | The money was already reserved/deducted when the withdrawal
        | request was created.
        |--------------------------------------------------------------------------
        */

        if ($action === "approve") {

            $updateResult =
                $transactions->updateOne(
                    [
                        "_id" => $transactionId,
                        "status" => "pending"
                    ],
                    [
                        '$set' => [

                            "status" =>
                                "approved",

                            "admin_approved" =>
                                true,

                            "balance_reserved" =>
                                false,

                            "balance_deducted" =>
                                true,

                            "processed_at" =>
                                new UTCDateTime(),

                            "updated_at" =>
                                new UTCDateTime(),

                            "admin_id" =>
                                $adminId,

                            "admin_email" =>
                                $adminEmail,

                            "admin_name" =>
                                $adminName,

                            "admin_action" =>
                                "approved"
                        ]
                    ]
                );

            if (
                $updateResult->getMatchedCount() === 0
            ) {

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

                        "id" =>
                            (string)$transactionId,

                        "reference" =>
                            withdrawalString(
                                $withdrawal["reference"] ??
                                ""
                            ),

                        "user_id" =>
                            withdrawalString(
                                $userId
                            ),

                        "status" =>
                            "approved",

                        "amount" =>
                            $amount
                    ]
                ]
            );
        }


        /*
        |--------------------------------------------------------------------------
        | REJECT
        |--------------------------------------------------------------------------
        */

        if ($action === "reject") {

            /*
            |--------------------------------------------------------------------------
            | Find user
            |--------------------------------------------------------------------------
            */

            $user = findWithdrawalUser(
                $userId
            );

            if ($user === null) {

                withdrawalResponse(
                    false,
                    "The user associated with this withdrawal could not be found.",
                    [
                        "user_id" =>
                            withdrawalString($userId)
                    ],
                    404
                );
            }

            /*
            |--------------------------------------------------------------------------
            | Get current wallet balance
            |--------------------------------------------------------------------------
            */

            $currentBalance =
                getUserWalletBalance(
                    $user
                );

            /*
            |--------------------------------------------------------------------------
            | IMPORTANT:
            |
            | Claim the withdrawal first.
            |
            | This prevents two admin requests from both restoring the
            | same withdrawal amount.
            |--------------------------------------------------------------------------
            */

            $claimResult =
                $transactions->updateOne(
                    [
                        "_id" => $transactionId,
                        "status" => "pending"
                    ],
                    [
                        '$set' => [

                            "status" =>
                                "rejection_processing",

                            "updated_at" =>
                                new UTCDateTime(),

                            "admin_id" =>
                                $adminId,

                            "admin_email" =>
                                $adminEmail,

                            "admin_name" =>
                                $adminName,

                            "admin_action" =>
                                "rejecting"
                        ]
                    ]
                );

            if (
                $claimResult->getMatchedCount() === 0
            ) {

                withdrawalResponse(
                    false,
                    "Withdrawal could not be rejected because it was already processed.",
                    [],
                    409
                );
            }

            /*
            |--------------------------------------------------------------------------
            | Restore funds
            |--------------------------------------------------------------------------
            */

            $newBalance =
                $currentBalance + $amount;

            $balanceRestored =
                setUserWalletBalance(
                    $user,
                    $newBalance
                );

            if (!$balanceRestored) {

                /*
                |--------------------------------------------------------------------------
                | Return withdrawal to pending because wallet restoration failed.
                |--------------------------------------------------------------------------
                */

                try {

                    $transactions->updateOne(
                        [
                            "_id" => $transactionId,
                            "status" =>
                                "rejection_processing"
                        ],
                        [
                            '$set' => [
                                "status" =>
                                    "pending",

                                "updated_at" =>
                                    new UTCDateTime(),

                                "admin_action" =>
                                    "rejection_failed"
                            ]
                        ]
                    );

                } catch (Throwable $rollbackError) {

                    error_log(
                        "Crown Cash withdrawal rejection status rollback error: " .
                        $rollbackError->getMessage()
                    );
                }

                withdrawalResponse(
                    false,
                    "Unable to restore the user's wallet balance.",
                    [
                        "user_id" =>
                            withdrawalString($user),

                        "amount" =>
                            $amount
                    ],
                    500
                );
            }

            /*
            |--------------------------------------------------------------------------
            | Mark rejected
            |--------------------------------------------------------------------------
            */

            $rejectResult =
                $transactions->updateOne(
                    [
                        "_id" => $transactionId,
                        "status" =>
                            "rejection_processing"
                    ],
                    [
                        '$set' => [

                            "status" =>
                                "rejected",

                            "admin_approved" =>
                                false,

                            "balance_reserved" =>
                                false,

                            "balance_deducted" =>
                                false,

                            "processed_at" =>
                                new UTCDateTime(),

                            "updated_at" =>
                                new UTCDateTime(),

                            "admin_id" =>
                                $adminId,

                            "admin_email" =>
                                $adminEmail,

                            "admin_name" =>
                                $adminName,

                            "admin_action" =>
                                "rejected"
                        ]
                    ]
                );

            if (
                $rejectResult->getMatchedCount() === 0
            ) {

                /*
                |--------------------------------------------------------------------------
                | The withdrawal status could not be finalized.
                |
                | Restore the previous balance.
                |--------------------------------------------------------------------------
                */

                try {

                    setUserWalletBalance(
                        $user,
                        $currentBalance
                    );

                } catch (Throwable $rollbackError) {

                    error_log(
                        "Crown Cash withdrawal wallet rollback error: " .
                        $rollbackError->getMessage()
                    );
                }

                try {

                    $transactions->updateOne(
                        [
                            "_id" => $transactionId,
                            "status" =>
                                "rejection_processing"
                        ],
                        [
                            '$set' => [
                                "status" =>
                                    "pending",

                                "updated_at" =>
                                    new UTCDateTime(),

                                "admin_action" =>
                                    "rejection_rollback"
                            ]
                        ]
                    );

                } catch (Throwable $statusRollbackError) {

                    error_log(
                        "Crown Cash withdrawal status rollback error: " .
                        $statusRollbackError->getMessage()
                    );
                }

                withdrawalResponse(
                    false,
                    "Withdrawal rejection could not be completed. The wallet restoration was rolled back.",
                    [],
                    500
                );
            }

            /*
            |--------------------------------------------------------------------------
            | SUCCESS
            |--------------------------------------------------------------------------
            */

            withdrawalResponse(
                true,
                "Withdrawal rejected and funds restored successfully.",
                [
                    "withdrawal" => [

                        "id" =>
                            (string)$transactionId,

                        "reference" =>
                            withdrawalString(
                                $withdrawal["reference"] ??
                                ""
                            ),

                        "user_id" =>
                            withdrawalString(
                                $userId
                            ),

                        "status" =>
                            "rejected",

                        "amount" =>
                            $amount,

                        "restored_balance" =>
                            $newBalance
                    ]
                ]
            );
        }

        /*
        |--------------------------------------------------------------------------
        | Unsupported action
        |--------------------------------------------------------------------------
        */

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
                "error" =>
                    $e->getMessage(),

                "exception" =>
                    get_class($e)
            ],
            500
        );
    }
}


/*
|--------------------------------------------------------------------------
| METHOD NOT ALLOWED
|--------------------------------------------------------------------------
*/

withdrawalResponse(
    false,
    "Method not allowed.",
    [],
    405
);