<?php

declare(strict_types=1);

/*
|--------------------------------------------------------------------------
| Crown Cash - Admin Deposits API
|--------------------------------------------------------------------------
| GET  /admin-deposits.php
|      Load deposit statistics and deposit records.
|
| POST /admin-deposits.php
|      Approve or reject a pending deposit.
|
| Required POST:
| {
|     "deposit_id": "...",
|     "action": "approve" | "reject",
|     "payment_verified": true
| }
|--------------------------------------------------------------------------
*/

session_set_cookie_params([
    "lifetime" => 0,
    "path" => "/",
    "secure" => true,
    "httponly" => true,
    "samesite" => "None"
]);

session_start();

header("Content-Type: application/json; charset=utf-8");
header("Access-Control-Allow-Origin: https://crown-cash.vercel.app");
header("Access-Control-Allow-Credentials: true");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");

if ($_SERVER["REQUEST_METHOD"] === "OPTIONS") {
    http_response_code(204);
    exit;
}

/*
|--------------------------------------------------------------------------
| Helpers
|--------------------------------------------------------------------------
*/

function respond(
    bool $success,
    string $message = "",
    array $extra = [],
    int $statusCode = 200
): void {

    http_response_code($statusCode);

    echo json_encode(
        array_merge(
            [
                "success" => $success,
                "message" => $message
            ],
            $extra
        ),
        JSON_UNESCAPED_SLASHES
    );

    exit;
}


function objectIdOrNull(mixed $value): ?MongoDB\BSON\ObjectId
{
    if ($value instanceof MongoDB\BSON\ObjectId) {
        return $value;
    }

    if (!is_string($value)) {
        return null;
    }

    $value = trim($value);

    if (!preg_match('/^[a-fA-F0-9]{24}$/', $value)) {
        return null;
    }

    try {
        return new MongoDB\BSON\ObjectId($value);
    } catch (Throwable $e) {
        return null;
    }
}


function idsMatch(mixed $a, mixed $b): bool
{
    if ($a instanceof MongoDB\BSON\ObjectId) {
        $a = (string)$a;
    }

    if ($b instanceof MongoDB\BSON\ObjectId) {
        $b = (string)$b;
    }

    return trim((string)$a) === trim((string)$b);
}


function normalizeNumber(mixed $value): float
{
    if ($value instanceof MongoDB\BSON\Decimal128) {
        return (float)$value->__toString();
    }

    if ($value instanceof MongoDB\BSON\Int64) {
        return (float)$value->__toString();
    }

    if (is_numeric($value)) {
        return (float)$value;
    }

    return 0.0;
}


function normalizeDate(mixed $value): ?string
{
    if ($value instanceof MongoDB\BSON\UTCDateTime) {
        return $value
            ->toDateTime()
            ->format("c");
    }

    if ($value instanceof DateTimeInterface) {
        return $value->format("c");
    }

    if (is_string($value) && trim($value) !== "") {
        return $value;
    }

    return null;
}


function normalizeMethod(mixed $method): string
{
    $method = strtolower(trim((string)$method));

    if (
        $method === "mtn" ||
        $method === "mtn_mobile_money" ||
        $method === "mtn mobile money" ||
        $method === "mobile money"
    ) {
        return "MTN";
    }

    if (
        $method === "airtel" ||
        $method === "airtel_money" ||
        $method === "airtel money"
    ) {
        return "Airtel";
    }

    return ucfirst($method ?: "Other");
}


function findUserById(
    MongoDB\Collection $users,
    mixed $userId
): ?array {

    if ($userId instanceof MongoDB\BSON\ObjectId) {

        $user = $users->findOne([
            "_id" => $userId
        ]);

        return $user ? $user->getArrayCopy() : null;
    }

    $userIdString = trim((string)$userId);

    if ($userIdString === "") {
        return null;
    }

    $objectId = objectIdOrNull($userIdString);

    if ($objectId) {

        $user = $users->findOne([
            "_id" => $objectId
        ]);

        if ($user) {
            return $user->getArrayCopy();
        }
    }

    $user = $users->findOne([
        "_id" => $userIdString
    ]);

    return $user ? $user->getArrayCopy() : null;
}


function getSessionUserId(): mixed
{
    return $_SESSION["user_id"] ?? null;
}


/*
|--------------------------------------------------------------------------
| Authentication
|--------------------------------------------------------------------------
*/

if (
    !isset($_SESSION["logged_in"]) ||
    $_SESSION["logged_in"] !== true ||
    !isset($_SESSION["user_id"])
) {
    respond(
        false,
        "Your administrator session has expired. Please login again.",
        [],
        401
    );
}


/*
|--------------------------------------------------------------------------
| Database
|--------------------------------------------------------------------------
*/

require_once __DIR__ . "/config.php";

try {

    /*
    |--------------------------------------------------------------------------
    | Collections
    |--------------------------------------------------------------------------
    */

    $users = $db->selectCollection("users");
    $deposits = $db->selectCollection("deposits");
    $transactions = $db->selectCollection("transactions");
    $auditLogs = $db->selectCollection("audit_logs");


    /*
    |--------------------------------------------------------------------------
    | Verify administrator
    |--------------------------------------------------------------------------
    */

    $sessionUserId = getSessionUserId();

    if (!$sessionUserId) {
        respond(
            false,
            "Administrator identity is missing from the session.",
            [],
            401
        );
    }

    $adminUser = findUserById(
        $users,
        $sessionUserId
    );

    if (!$adminUser) {
        respond(
            false,
            "Administrator account could not be found.",
            [],
            403
        );
    }


    /*
    |--------------------------------------------------------------------------
    | Check account status
    |--------------------------------------------------------------------------
    */

    $accountStatus = strtolower(
        trim(
            (string)(
                $adminUser["status"] ??
                "active"
            )
        )
    );

    $blockedStatuses = [
        "blocked",
        "suspended",
        "disabled",
        "banned",
        "inactive"
    ];

    if (in_array($accountStatus, $blockedStatuses, true)) {
        respond(
            false,
            "This administrator account is not active.",
            [],
            403
        );
    }


    /*
    |--------------------------------------------------------------------------
    | Check role / account type
    |--------------------------------------------------------------------------
    */

    $role = strtolower(
        trim(
            (string)(
                $adminUser["role"] ??
                ""
            )
        )
    );

    $accountType = strtolower(
        trim(
            (string)(
                $adminUser["account_type"] ??
                ""
            )
        )
    );

    $isAdminRole = (
        $role === "admin" ||
        $role === "administrator"
    );

    $isAdminAccount = (
        $accountType === "admin" ||
        $accountType === "administrator"
    );

    if (!$isAdminRole && !$isAdminAccount) {
        respond(
            false,
            "Administrator privileges are required.",
            [],
            403
        );
    }


    /*
    |--------------------------------------------------------------------------
    | Optional ADMIN_USER_ID protection
    |--------------------------------------------------------------------------
    */

    $configuredAdminId = trim(
        (string)(getenv("ADMIN_USER_ID") ?: "")
    );

    $configuredAdminEmail = strtolower(
        trim(
            (string)(getenv("ADMIN_EMAIL") ?: "")
        )
    );


    /*
    |--------------------------------------------------------------------------
    | Fail closed if no admin identity is configured
    |--------------------------------------------------------------------------
    */

    if (
        $configuredAdminId === "" &&
        $configuredAdminEmail === ""
    ) {
        respond(
            false,
            "Administrator identity is not configured on the server.",
            [],
            500
        );
    }


    /*
    |--------------------------------------------------------------------------
    | Verify configured administrator ID
    |--------------------------------------------------------------------------
    */

    if ($configuredAdminId !== "") {

        $adminIdMatches = idsMatch(
            $sessionUserId,
            $configuredAdminId
        );

        if (!$adminIdMatches) {

            respond(
                false,
                "You are not authorized to manage deposits.",
                [],
                403
            );
        }
    }


    /*
    |--------------------------------------------------------------------------
    | Verify configured administrator email
    |--------------------------------------------------------------------------
    */

    if ($configuredAdminEmail !== "") {

        $adminEmail = strtolower(
            trim(
                (string)(
                    $adminUser["email"] ??
                    ""
                )
            )
        );

        if (
            $adminEmail === "" ||
            $adminEmail !== $configuredAdminEmail
        ) {

            respond(
                false,
                "Administrator email authorization failed.",
                [],
                403
            );
        }
    }


    /*
    |--------------------------------------------------------------------------
    | Refresh administrator session
    |--------------------------------------------------------------------------
    */

    $_SESSION["role"] = "admin";
    $_SESSION["account_type"] = "admin";
    $_SESSION["admin_verified"] = true;
    $_SESSION["admin_verified_at"] = time();


    /*
    |--------------------------------------------------------------------------
    | GET - Load deposits
    |--------------------------------------------------------------------------
    */

    if ($_SERVER["REQUEST_METHOD"] === "GET") {

        $cursor = $deposits->find(
            [],
            [
                "sort" => [
                    "created_at" => -1
                ],
                "limit" => 500
            ]
        );

        $depositList = [];

        $totalAmount = 0;
        $pendingAmount = 0;
        $approvedAmount = 0;
        $rejectedAmount = 0;

        $pendingCount = 0;
        $approvedCount = 0;
        $rejectedCount = 0;


        foreach ($cursor as $depositDocument) {

            $deposit = $depositDocument->getArrayCopy();

            $depositId = $deposit["_id"] ?? null;

            $userId =
                $deposit["user_id"] ??
                $deposit["userId"] ??
                $deposit["customer_id"] ??
                $deposit["customerId"] ??
                null;

            $user = null;

            if ($userId !== null) {
                $user = findUserById(
                    $users,
                    $userId
                );
            }


            /*
            |--------------------------------------------------------------------------
            | Customer information
            |--------------------------------------------------------------------------
            */

            $customerName =
                $deposit["full_name"] ??
                $deposit["customer_name"] ??
                $deposit["name"] ??
                "";

            $customerEmail =
                $deposit["email"] ??
                "";

            $customerPhone =
                $deposit["phone"] ??
                $deposit["phone_number"] ??
                $deposit["mobile"] ??
                "";


            if ($user) {

                if ($customerName === "") {
                    $customerName =
                        $user["full_name"] ??
                        $user["name"] ??
                        "";
                }

                if ($customerEmail === "") {
                    $customerEmail =
                        $user["email"] ??
                        "";
                }

                if ($customerPhone === "") {
                    $customerPhone =
                        $user["phone"] ??
                        $user["phone_number"] ??
                        $user["mobile"] ??
                        "";
                }
            }


            if ($customerName === "") {
                $customerName = "Customer";
            }


            /*
            |--------------------------------------------------------------------------
            | Amount
            |--------------------------------------------------------------------------
            */

            $amount = normalizeNumber(
                $deposit["amount"] ??
                $deposit["deposit_amount"] ??
                0
            );


            /*
            |--------------------------------------------------------------------------
            | Status
            |--------------------------------------------------------------------------
            */

            $status = strtolower(
                trim(
                    (string)(
                        $deposit["status"] ??
                        "pending"
                    )
                )
            );

            if ($status === "") {
                $status = "pending";
            }


            /*
            |--------------------------------------------------------------------------
            | Payment method
            |--------------------------------------------------------------------------
            */

            $method = normalizeMethod(
                $deposit["payment_method"] ??
                $deposit["method"] ??
                $deposit["paymentMethod"] ??
                ""
            );


            /*
            |--------------------------------------------------------------------------
            | Reference
            |--------------------------------------------------------------------------
            */

            $reference =
                (string)(
                    $deposit["transaction_reference"] ??
                    $deposit["reference"] ??
                    $deposit["transaction_id"] ??
                    $deposit["transactionId"] ??
                    ""
                );


            /*
            |--------------------------------------------------------------------------
            | Payment verification
            |--------------------------------------------------------------------------
            */

            $paymentVerified =
                filter_var(
                    $deposit["payment_verified"] ?? false,
                    FILTER_VALIDATE_BOOLEAN
                );


            /*
            |--------------------------------------------------------------------------
            | Dates
            |--------------------------------------------------------------------------
            */

            $createdAt = normalizeDate(
                $deposit["created_at"] ??
                $deposit["createdAt"] ??
                null
            );

            $updatedAt = normalizeDate(
                $deposit["updated_at"] ??
                $deposit["updatedAt"] ??
                null
            );

            $approvedAt = normalizeDate(
                $deposit["approved_at"] ??
                null
            );

            $rejectedAt = normalizeDate(
                $deposit["rejected_at"] ??
                null
            );


            /*
            |--------------------------------------------------------------------------
            | Update statistics
            |--------------------------------------------------------------------------
            */

            $totalAmount += $amount;

            if ($status === "pending") {
                $pendingAmount += $amount;
                $pendingCount++;
            }

            if ($status === "approved") {
                $approvedAmount += $amount;
                $approvedCount++;
            }

            if ($status === "rejected") {
                $rejectedAmount += $amount;
                $rejectedCount++;
            }


            /*
            |--------------------------------------------------------------------------
            | Build response object
            |--------------------------------------------------------------------------
            */

            $depositList[] = [
                "id" => $depositId
                    ? (string)$depositId
                    : "",

                "_id" => $depositId
                    ? (string)$depositId
                    : "",

                "deposit_id" => $depositId
                    ? (string)$depositId
                    : "",

                "user_id" => $userId !== null
                    ? (string)$userId
                    : "",

                "customer_name" => $customerName,

                "full_name" => $customerName,

                "email" => (string)$customerEmail,

                "phone" => (string)$customerPhone,

                "amount" => $amount,

                "status" => $status,

                "payment_method" => $method,

                "method" => $method,

                "reference" => $reference,

                "transaction_reference" => $reference,

                "payment_verified" => $paymentVerified,

                "created_at" => $createdAt,

                "updated_at" => $updatedAt,

                "approved_at" => $approvedAt,

                "rejected_at" => $rejectedAt,

                "rejection_reason" => (string)(
                    $deposit["rejection_reason"] ??
                    ""
                )
            ];
        }


        respond(
            true,
            "Deposits loaded successfully.",
            [
                "deposits" => $depositList,

                "summary" => [
                    "total_deposits" => count($depositList),

                    "total_amount" => $totalAmount,

                    "pending_count" => $pendingCount,

                    "pending_amount" => $pendingAmount,

                    "approved_count" => $approvedCount,

                    "approved_amount" => $approvedAmount,

                    "rejected_count" => $rejectedCount,

                    "rejected_amount" => $rejectedAmount
                ],

                "statistics" => [
                    "total_deposits" => count($depositList),

                    "total_amount" => $totalAmount,

                    "pending_count" => $pendingCount,

                    "pending_amount" => $pendingAmount,

                    "approved_count" => $approvedCount,

                    "approved_amount" => $approvedAmount,

                    "rejected_count" => $rejectedCount,

                    "rejected_amount" => $rejectedAmount
                ]
            ]
        );
    }


    /*
    |--------------------------------------------------------------------------
    | POST - Approve / Reject Deposit
    |--------------------------------------------------------------------------
    */

    if ($_SERVER["REQUEST_METHOD"] === "POST") {

        $rawInput = file_get_contents("php://input");

        $input = json_decode(
            $rawInput,
            true
        );

        if (!is_array($input)) {
            $input = $_POST;
        }

        $depositIdString = trim(
            (string)(
                $input["deposit_id"] ??
                $input["depositId"] ??
                ""
            )
        );

        $action = strtolower(
            trim(
                (string)(
                    $input["action"] ??
                    ""
                )
            )
        );

        $paymentVerified = filter_var(
            $input["payment_verified"] ?? false,
            FILTER_VALIDATE_BOOLEAN
        );


        /*
        |--------------------------------------------------------------------------
        | Validate deposit ID
        |--------------------------------------------------------------------------
        */

        $depositObjectId = objectIdOrNull(
            $depositIdString
        );

        if (!$depositObjectId) {

            respond(
                false,
                "Invalid deposit ID.",
                [],
                400
            );
        }


        /*
        |--------------------------------------------------------------------------
        | Validate action
        |--------------------------------------------------------------------------
        */

        if (
            $action !== "approve" &&
            $action !== "reject"
        ) {

            respond(
                false,
                "Invalid deposit action.",
                [],
                400
            );
        }


        /*
        |--------------------------------------------------------------------------
        | Find deposit
        |--------------------------------------------------------------------------
        */

        $deposit = $deposits->findOne([
            "_id" => $depositObjectId
        ]);

        if (!$deposit) {

            respond(
                false,
                "Deposit was not found.",
                [],
                404
            );
        }


        $deposit = $deposit->getArrayCopy();


        /*
        |--------------------------------------------------------------------------
        | Pending only
        |--------------------------------------------------------------------------
        */

        $currentStatus = strtolower(
            trim(
                (string)(
                    $deposit["status"] ??
                    "pending"
                )
            )
        );

        if ($currentStatus !== "pending") {

            respond(
                false,
                "This deposit has already been processed.",
                [
                    "current_status" => $currentStatus
                ],
                409
            );
        }


        /*
        |--------------------------------------------------------------------------
        | Amount
        |--------------------------------------------------------------------------
        */

        $amount = normalizeNumber(
            $deposit["amount"] ??
            $deposit["deposit_amount"] ??
            0
        );

        if ($amount <= 0) {

            respond(
                false,
                "This deposit has an invalid amount.",
                [],
                400
            );
        }


        /*
        |--------------------------------------------------------------------------
        | Customer
        |--------------------------------------------------------------------------
        */

        $customerUserId =
            $deposit["user_id"] ??
            $deposit["userId"] ??
            $deposit["customer_id"] ??
            $deposit["customerId"] ??
            null;

        if ($customerUserId === null) {

            respond(
                false,
                "This deposit is not linked to a customer account.",
                [],
                400
            );
        }


        /*
        |--------------------------------------------------------------------------
        | Reject
        |--------------------------------------------------------------------------
        */

        if ($action === "reject") {

            $rejectionReason = trim(
                (string)(
                    $input["rejection_reason"] ??
                    $input["reason"] ??
                    "Deposit rejected by administrator."
                )
            );

            if ($rejectionReason === "") {
                $rejectionReason =
                    "Deposit rejected by administrator.";
            }


            $now = new MongoDB\BSON\UTCDateTime();


            $updateResult = $deposits->updateOne(
                [
                    "_id" => $depositObjectId,
                    "status" => "pending"
                ],
                [
                    '$set' => [
                        "status" => "rejected",
                        "payment_verified" => false,
                        "rejection_reason" => $rejectionReason,
                        "rejected_at" => $now,
                        "updated_at" => $now,
                        "processed_by" => $sessionUserId
                            ? (string)$sessionUserId
                            : ""
                    ]
                ]
            );


            if ($updateResult->getModifiedCount() !== 1) {

                respond(
                    false,
                    "The deposit could not be rejected. It may already have been processed.",
                    [],
                    409
                );
            }


            /*
            |--------------------------------------------------------------------------
            | Update transaction
            |--------------------------------------------------------------------------
            */

            try {

                $transactions->updateMany(
                    [
                        "deposit_id" => (string)$depositObjectId
                    ],
                    [
                        '$set' => [
                            "status" => "rejected",
                            "updated_at" => $now,
                            "rejection_reason" => $rejectionReason
                        ]
                    ]
                );

            } catch (Throwable $e) {
                // Deposit status remains authoritative.
            }


            /*
            |--------------------------------------------------------------------------
            | Audit log
            |--------------------------------------------------------------------------
            */

            try {

                $auditLogs->insertOne([
                    "action" => "deposit_rejected",
                    "type" => "deposit",
                    "deposit_id" => (string)$depositObjectId,
                    "user_id" => (string)$customerUserId,
                    "admin_id" => (string)$sessionUserId,
                    "amount" => $amount,
                    "reason" => $rejectionReason,
                    "created_at" => $now
                ]);

            } catch (Throwable $e) {
                // Do not undo a successfully rejected deposit.
            }


            respond(
                true,
                "Deposit rejected successfully.",
                [
                    "deposit_id" => (string)$depositObjectId,
                    "status" => "rejected",
                    "amount" => $amount
                ]
            );
        }


        /*
        |--------------------------------------------------------------------------
        | APPROVE
        |--------------------------------------------------------------------------
        |
        | The admin must explicitly confirm payment verification.
        |--------------------------------------------------------------------------
        */

        if ($action === "approve") {

            if ($paymentVerified !== true) {

                respond(
                    false,
                    "Please confirm that the payment has been verified before approving this deposit.",
                    [
                        "requires_payment_verification" => true
                    ],
                    400
                );
            }


            /*
            |--------------------------------------------------------------------------
            | Find customer
            |--------------------------------------------------------------------------
            */

            $customer = findUserById(
                $users,
                $customerUserId
            );

            if (!$customer) {

                respond(
                    false,
                    "The customer account linked to this deposit was not found.",
                    [],
                    404
                );
            }


            $customerStatus = strtolower(
                trim(
                    (string)(
                        $customer["status"] ??
                        "active"
                    )
                )
            );

            if (
                in_array(
                    $customerStatus,
                    [
                        "blocked",
                        "suspended",
                        "disabled",
                        "banned"
                    ],
                    true
                )
            ) {

                respond(
                    false,
                    "This customer account cannot receive a deposit while it is blocked.",
                    [],
                    403
                );
            }


            /*
            |--------------------------------------------------------------------------
            | Customer ObjectId
            |--------------------------------------------------------------------------
            */

            $customerObjectId = $customer["_id"] ?? null;

            if (!$customerObjectId) {

                respond(
                    false,
                    "Customer account ID is invalid.",
                    [],
                    500
                );
            }


            /*
            |--------------------------------------------------------------------------
            | Use MongoDB transaction when possible
            |--------------------------------------------------------------------------
            */

            $client = null;

            try {

                if (isset($db)) {

                    /*
                    | config.php normally exposes the selected database.
                    | MongoDB PHP library can start a transaction only from
                    | a Client session. We therefore perform the critical
                    | balance operation using conditional updates below.
                    */
                }

            } catch (Throwable $e) {
                // Continue using atomic conditional updates.
            }


            /*
            |--------------------------------------------------------------------------
            | First atomically mark the deposit approved.
            |--------------------------------------------------------------------------
            |
            | This prevents two administrators from approving the same
            | pending deposit and crediting the balance twice.
            |--------------------------------------------------------------------------
            */

            $now = new MongoDB\BSON\UTCDateTime();


            $approvalResult = $deposits->updateOne(
                [
                    "_id" => $depositObjectId,
                    "status" => "pending"
                ],
                [
                    '$set' => [
                        "status" => "approved",
                        "payment_verified" => true,
                        "approved_at" => $now,
                        "updated_at" => $now,
                        "processed_by" => $sessionUserId
                            ? (string)$sessionUserId
                            : ""
                    ]
                ]
            );


            if ($approvalResult->getModifiedCount() !== 1) {

                respond(
                    false,
                    "This deposit has already been processed or could not be approved.",
                    [],
                    409
                );
            }


            /*
            |--------------------------------------------------------------------------
            | Credit customer balance
            |--------------------------------------------------------------------------
            */

            try {

                $balanceResult = $users->updateOne(
                    [
                        "_id" => $customerObjectId
                    ],
                    [
                        '$inc' => [
                            "balance" => $amount,
                            "wallet_balance" => $amount
                        ],
                        '$set' => [
                            "updated_at" => $now
                        ]
                    ]
                );


                if ($balanceResult->getModifiedCount() !== 1) {

                    /*
                    |--------------------------------------------------------------------------
                    | Roll back deposit approval if balance failed.
                    |--------------------------------------------------------------------------
                    */

                    $deposits->updateOne(
                        [
                            "_id" => $depositObjectId,
                            "status" => "approved"
                        ],
                        [
                            '$set' => [
                                "status" => "pending",
                                "payment_verified" => false,
                                "updated_at" => new MongoDB\BSON\UTCDateTime()
                            ],
                            '$unset' => [
                                "approved_at" => "",
                                "processed_by" => ""
                            ]
                        ]
                    );


                    respond(
                        false,
                        "Deposit approval failed because the customer balance could not be updated.",
                        [],
                        500
                    );
                }

            } catch (Throwable $balanceError) {

                /*
                |--------------------------------------------------------------------------
                | Roll back approval.
                |--------------------------------------------------------------------------
                */

                try {

                    $deposits->updateOne(
                        [
                            "_id" => $depositObjectId,
                            "status" => "approved"
                        ],
                        [
                            '$set' => [
                                "status" => "pending",
                                "payment_verified" => false,
                                "updated_at" => new MongoDB\BSON\UTCDateTime()
                            ],
                            '$unset' => [
                                "approved_at" => "",
                                "processed_by" => ""
                            ]
                        ]
                    );

                } catch (Throwable $rollbackError) {
                    // Logically failed state should be investigated from audit logs.
                }


                respond(
                    false,
                    "Deposit approval failed while updating the customer balance.",
                    [],
                    500
                );
            }


            /*
            |--------------------------------------------------------------------------
            | Update matching transaction
            |--------------------------------------------------------------------------
            */

            try {

                $transactionUpdate = $transactions->updateMany(
                    [
                        "deposit_id" => (string)$depositObjectId
                    ],
                    [
                        '$set' => [
                            "status" => "completed",
                            "transaction_status" => "completed",
                            "type" => "deposit",
                            "updated_at" => $now,
                            "completed_at" => $now
                        ]
                    ]
                );


                /*
                |--------------------------------------------------------------------------
                | If no matching transaction exists, create one.
                |--------------------------------------------------------------------------
                */

                if ($transactionUpdate->getMatchedCount() === 0) {

                    $transactions->insertOne([
                        "user_id" => $customerObjectId,
                        "deposit_id" => (string)$depositObjectId,
                        "type" => "deposit",
                        "transaction_type" => "deposit",
                        "amount" => $amount,
                        "status" => "completed",
                        "transaction_status" => "completed",
                        "description" => "Deposit approved",
                        "created_at" => $now,
                        "completed_at" => $now
                    ]);
                }

            } catch (Throwable $transactionError) {

                /*
                | The customer's balance and deposit status have already
                | been successfully updated. Do not reverse the financial
                | operation because an auxiliary transaction record failed.
                */
            }


            /*
            |--------------------------------------------------------------------------
            | Audit log
            |--------------------------------------------------------------------------
            */

            try {

                $auditLogs->insertOne([
                    "action" => "deposit_approved",
                    "type" => "deposit",
                    "deposit_id" => (string)$depositObjectId,
                    "user_id" => (string)$customerObjectId,
                    "admin_id" => (string)$sessionUserId,
                    "amount" => $amount,
                    "payment_verified" => true,
                    "created_at" => $now
                ]);

            } catch (Throwable $auditError) {
                // Financial operation remains successful.
            }


            /*
            |--------------------------------------------------------------------------
            | Return success
            |--------------------------------------------------------------------------
            */

            $newBalance = normalizeNumber(
                $customer["balance"] ?? 0
            );

            $newBalance += $amount;


            respond(
                true,
                "Deposit approved successfully and customer balance credited.",
                [
                    "deposit_id" => (string)$depositObjectId,

                    "status" => "approved",

                    "payment_verified" => true,

                    "amount" => $amount,

                    "credited_amount" => $amount,

                    "new_balance" => $newBalance
                ]
            );
        }
    }


    /*
    |--------------------------------------------------------------------------
    | Unsupported method
    |--------------------------------------------------------------------------
    */

    respond(
        false,
        "Method not allowed.",
        [],
        405
    );


} catch (MongoDB\Driver\Exception\Exception $e) {

    error_log(
        "Crown Cash admin deposits MongoDB error: " .
        $e->getMessage()
    );

    respond(
        false,
        "A database error occurred while processing deposits.",
        [],
        500
    );

} catch (Throwable $e) {

    error_log(
        "Crown Cash admin deposits error: " .
        $e->getMessage()
    );

    respond(
        false,
        "Unable to process the deposit request.",
        [],
        500
    );
}
?>