<?php

declare(strict_types=1);

/*
=========================================================
 CROWN CASH
 ADMIN WITHDRAWALS API
=========================================================

GET
----
Returns withdrawal requests for administrators.

POST
-----
Approve:
{
    "withdrawal_id": "...",
    "action": "approve"
}

Reject:
{
    "withdrawal_id": "...",
    "action": "reject"
}

IMPORTANT
---------
- Withdrawal fee = 20%
- Minimum withdrawal is normally enforced by withdrawal.php
- User balance is NOT deducted when the user requests withdrawal
- Balance is deducted ONLY when admin approves
- The requested amount is deducted from balance
- The payout amount is requested amount - 20% fee
- Approval sets payout_status = awaiting_payout
- This endpoint does NOT automatically send MTN/Airtel money
=========================================================
*/


/* =========================================================
   CORS
========================================================= */

header("Content-Type: application/json; charset=UTF-8");

header(
    "Access-Control-Allow-Origin: https://crown-cash.vercel.app"
);

header(
    "Access-Control-Allow-Credentials: true"
);

header(
    "Access-Control-Allow-Methods: GET, POST, OPTIONS"
);

header(
    "Access-Control-Allow-Headers: Content-Type, Accept"
);


/* =========================================================
   OPTIONS
========================================================= */

if (
    ($_SERVER["REQUEST_METHOD"] ?? "GET") ===
    "OPTIONS"
) {
    http_response_code(204);
    exit;
}


/* =========================================================
   SECURE CROSS-SITE SESSION
========================================================= */

session_set_cookie_params([
    "lifetime" => 0,
    "path" => "/",
    "secure" => true,
    "httponly" => true,
    "samesite" => "None"
]);

session_start();


/* =========================================================
   JSON RESPONSE HELPER
========================================================= */

function jsonResponse(
    bool $success,
    string $message = "",
    array $data = [],
    int $statusCode = 200
): void {

    http_response_code($statusCode);

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


/* =========================================================
   BASIC AUTHENTICATION
========================================================= */

if (
    !isset($_SESSION["logged_in"]) ||
    $_SESSION["logged_in"] !== true ||
    empty($_SESSION["user_id"])
) {
    jsonResponse(
        false,
        "Administrator login is required.",
        [],
        401
    );
}


/* =========================================================
   LOAD DATABASE
========================================================= */

try {

    require_once __DIR__ . "/config.php";

} catch (Throwable $e) {

    error_log(
        "admin-withdrawals.php config error: " .
        $e->getMessage()
    );

    jsonResponse(
        false,
        "Database configuration could not be loaded.",
        [],
        500
    );
}


/* =========================================================
   VERIFY ADMIN
========================================================= */

try {

    $currentUserIdString =
        (string)$_SESSION["user_id"];


    /*
     * Convert current session ID to ObjectId.
     */
    try {

        $currentUserObjectId =
            new MongoDB\BSON\ObjectId(
                $currentUserIdString
            );

    } catch (Throwable $e) {

        jsonResponse(
            false,
            "Invalid administrator session.",
            [],
            401
        );
    }


    /*
     * Find administrator.
     */
    $adminUser =
        $users->findOne([
            "_id" => $currentUserObjectId
        ]);


    if (!$adminUser) {

        jsonResponse(
            false,
            "Administrator account was not found.",
            [],
            403
        );
    }


    /*
     * Check account status.
     */
    $adminStatus =
        strtolower(
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


    if (
        in_array(
            $adminStatus,
            $blockedStatuses,
            true
        )
    ) {

        jsonResponse(
            false,
            "Administrator account is not active.",
            [],
            403
        );
    }


    /*
     * Check role.
     */
    $role =
        strtolower(
            trim(
                (string)(
                    $adminUser["role"] ??
                    ""
                )
            )
        );


    /*
     * Check account type.
     */
    $accountType =
        strtolower(
            trim(
                (string)(
                    $adminUser["account_type"] ??
                    ""
                )
            )
        );


    $isAdmin =
        (
            $role === "admin" ||
            $role === "administrator" ||
            $accountType === "admin" ||
            $accountType === "administrator"
        );


    if (!$isAdmin) {

        jsonResponse(
            false,
            "Administrator privileges are required.",
            [],
            403
        );
    }


    /*
     * Optional ADMIN_USER_ID protection.
     *
     * If configured in Render environment,
     * only that exact account can use admin APIs.
     */
    $configuredAdminId =
        trim(
            (string)(
                getenv("ADMIN_USER_ID") ?: ""
            )
        );


    if (
        $configuredAdminId !== "" &&
        $configuredAdminId !==
        $currentUserIdString
    ) {

        jsonResponse(
            false,
            "Administrator authorization failed.",
            [],
            403
        );
    }


} catch (Throwable $e) {

    error_log(
        "admin-withdrawals.php admin verification error: " .
        $e->getMessage()
    );

    jsonResponse(
        false,
        "Unable to verify administrator access.",
        [],
        500
    );
}


/* =========================================================
   CONSTANTS
========================================================= */

const WITHDRAWAL_FEE_RATE = 0.20;


/* =========================================================
   HELPER FUNCTIONS
========================================================= */

function mongoNumberToFloat(
    mixed $value
): float {

    if (
        $value instanceof MongoDB\BSON\Decimal128
    ) {
        return (float)$value->__toString();
    }


    if (
        $value instanceof MongoDB\BSON\Int64
    ) {
        return (float)$value->__toString();
    }


    if (
        $value instanceof MongoDB\BSON\Int32
    ) {
        return (float)$value->__toString();
    }


    if (
        is_numeric($value)
    ) {
        return (float)$value;
    }


    return 0.0;
}


function formatDateValue(
    mixed $value
): ?string {

    if (
        $value instanceof MongoDB\BSON\UTCDateTime
    ) {

        return $value
            ->toDateTime()
            ->format(
                DATE_ATOM
            );
    }


    if (
        $value instanceof DateTimeInterface
    ) {

        return $value->format(
            DATE_ATOM
        );
    }


    if (
        is_string($value) &&
        trim($value) !== ""
    ) {

        $timestamp =
            strtotime($value);

        if ($timestamp !== false) {

            return date(
                DATE_ATOM,
                $timestamp
            );
        }
    }


    return null;
}


function objectIdToString(
    mixed $value
): string {

    if (
        $value instanceof MongoDB\BSON\ObjectId
    ) {
        return (string)$value;
    }


    if (
        is_string($value)
    ) {
        return $value;
    }


    return "";
}


function getWithdrawalUserId(
    array|object $withdrawal
): string {

    $possibleFields = [
        "user_id",
        "userId",
        "customer_id",
        "customerId"
    ];


    foreach ($possibleFields as $field) {

        if (
            isset($withdrawal[$field])
        ) {

            return objectIdToString(
                $withdrawal[$field]
            );
        }
    }


    return "";
}


function getUserName(
    array|object $user
): string {

    $fullName =
        trim(
            (string)(
                $user["full_name"] ??
                ""
            )
        );


    if ($fullName !== "") {
        return $fullName;
    }


    $first =
        trim(
            (string)(
                $user["first_name"] ??
                ""
            )
        );


    $last =
        trim(
            (string)(
                $user["last_name"] ??
                ""
            )
        );


    $name =
        trim(
            $first . " " . $last
        );


    return $name !== ""
        ? $name
        : "Unknown User";
}


/* =========================================================
   COLLECTIONS
========================================================= */

try {

    $withdrawals =
        $db->selectCollection(
            "withdrawals"
        );

    $transactions =
        $db->selectCollection(
            "transactions"
        );

    $auditLogs =
        $db->selectCollection(
            "audit_logs"
        );

} catch (Throwable $e) {

    error_log(
        "admin-withdrawals.php collection error: " .
        $e->getMessage()
    );

    jsonResponse(
        false,
        "Required database collections could not be loaded.",
        [],
        500
    );
}


/* =========================================================
   REQUEST METHOD
========================================================= */

$requestMethod =
    strtoupper(
        $_SERVER["REQUEST_METHOD"] ?? "GET"
    );


/* =========================================================
   GET — LIST WITHDRAWALS
========================================================= */

if (
    $requestMethod === "GET"
) {

    try {

        /*
         * Get withdrawals.
         *
         * We sort newest first.
         */
        $cursor =
            $withdrawals->find(
                [],
                [
                    "sort" => [
                        "created_at" => -1
                    ],
                    "limit" => 1000
                ]
            );


        $withdrawalList = [];


        foreach ($cursor as $withdrawalDocument) {

            /*
             * Convert BSON document to array.
             */
            $withdrawal =
                $withdrawalDocument->getArrayCopy();


            $withdrawalId =
                objectIdToString(
                    $withdrawal["_id"] ?? ""
                );


            /*
             * Locate customer.
             */
            $userId =
                getWithdrawalUserId(
                    $withdrawal
                );


            $user = null;


            if ($userId !== "") {

                try {

                    $userObjectId =
                        new MongoDB\BSON\ObjectId(
                            $userId
                        );


                    $user =
                        $users->findOne([
                            "_id" =>
                                $userObjectId
                        ]);

                } catch (Throwable $e) {

                    /*
                     * Some older records may contain
                     * string IDs rather than ObjectIds.
                     */
                    $user =
                        $users->findOne([
                            "_id" =>
                                $userId
                        ]);
                }
            }


            /*
             * User information.
             */
            $fullName =
                $user
                    ? getUserName($user)
                    : (
                        (string)(
                            $withdrawal["full_name"] ??
                            $withdrawal["user_name"] ??
                            "Unknown User"
                        )
                    );


            $email =
                $user
                    ? (string)(
                        $user["email"] ??
                        ""
                    )
                    : (string)(
                        $withdrawal["email"] ??
                        ""
                    );


            $phone =
                (string)(
                    $withdrawal["phone"] ??
                    $withdrawal["phone_number"] ??
                    $withdrawal["mobile"] ??
                    $withdrawal["registered_phone"] ??
                    (
                        $user
                            ? (
                                $user["phone"] ??
                                $user["phone_number"] ??
                                $user["mobile"] ??
                                ""
                            )
                            : ""
                    )
                );


            /*
             * Amount.
             */
            $amount =
                mongoNumberToFloat(
                    $withdrawal["amount"] ??
                    $withdrawal["requested_amount"] ??
                    $withdrawal["withdrawal_amount"] ??
                    0
                );


            /*
             * Fee.
             *
             * If the original withdrawal record
             * already contains a fee, use it.
             *
             * Otherwise calculate 20%.
             */
            $fee =
                mongoNumberToFloat(
                    $withdrawal["fee"] ??
                    $withdrawal["withdrawal_fee"] ??
                    $withdrawal["fee_amount"] ??
                    0
                );


            if (
                $fee <= 0 &&
                $amount > 0
            ) {

                $fee =
                    round(
                        $amount *
                        WITHDRAWAL_FEE_RATE,
                        0
                    );
            }


            /*
             * Payout.
             */
            $payoutAmount =
                mongoNumberToFloat(
                    $withdrawal["payout_amount"] ??
                    $withdrawal["payout"] ??
                    $withdrawal["net_amount"] ??
                    0
                );


            if (
                $payoutAmount <= 0 &&
                $amount > 0
            ) {

                $payoutAmount =
                    max(
                        0,
                        $amount - $fee
                    );
            }


            /*
             * Status.
             */
            $status =
                strtolower(
                    trim(
                        (string)(
                            $withdrawal["status"] ??
                            "pending"
                        )
                    )
                );


            /*
             * Payment method.
             */
            $paymentMethod =
                (string)(
                    $withdrawal["payment_method"] ??
                    $withdrawal["method"] ??
                    ""
                );


            /*
             * Payout status.
             */
            $payoutStatus =
                strtolower(
                    trim(
                        (string)(
                            $withdrawal["payout_status"] ??
                            "not_required"
                        )
                    )
                );


            /*
             * Date.
             */
            $createdAt =
                formatDateValue(
                    $withdrawal["created_at"] ??
                    $withdrawal["createdAt"] ??
                    $withdrawal["requested_at"] ??
                    $withdrawal["date"] ??
                    null
                );


            /*
             * Admin note.
             */
            $adminNote =
                (string)(
                    $withdrawal["admin_note"] ??
                    $withdrawal["adminNote"] ??
                    $withdrawal["note"] ??
                    $withdrawal["rejection_reason"] ??
                    ""
                );


            /*
             * Return normalized object.
             */
            $withdrawalList[] = [
                "id" =>
                    $withdrawalId,

                "_id" =>
                    $withdrawalId,

                "withdrawal_id" =>
                    $withdrawalId,

                "user_id" =>
                    $userId,

                "first_name" =>
                    $user
                        ? (string)(
                            $user["first_name"] ??
                            ""
                        )
                        : "",

                "last_name" =>
                    $user
                        ? (string)(
                            $user["last_name"] ??
                            ""
                        )
                        : "",

                "full_name" =>
                    $fullName,

                "email" =>
                    $email,

                "phone" =>
                    $phone,

                "payment_method" =>
                    $paymentMethod,

                "amount" =>
                    $amount,

                "requested_amount" =>
                    $amount,

                "fee" =>
                    $fee,

                "withdrawal_fee" =>
                    $fee,

                "payout_amount" =>
                    $payoutAmount,

                "status" =>
                    $status,

                "payout_status" =>
                    $payoutStatus,

                "created_at" =>
                    $createdAt,

                "admin_note" =>
                    $adminNote
            ];
        }


        /*
         * Calculate monetary summary.
         */
        $totalAmount = 0.0;
        $pendingAmount = 0.0;
        $approvedAmount = 0.0;
        $rejectedAmount = 0.0;


        $pendingCount = 0;
        $approvedCount = 0;
        $rejectedCount = 0;


        foreach (
            $withdrawalList as $item
        ) {

            $amount =
                (float)(
                    $item["amount"] ?? 0
                );


            $totalAmount +=
                $amount;


            $itemStatus =
                strtolower(
                    (string)(
                        $item["status"] ??
                        ""
                    )
                );


            if (
                $itemStatus ===
                "pending"
            ) {

                $pendingAmount +=
                    $amount;

                $pendingCount++;

            } elseif (
                $itemStatus ===
                "approved"
            ) {

                $approvedAmount +=
                    $amount;

                $approvedCount++;

            } elseif (
                $itemStatus ===
                "rejected"
            ) {

                $rejectedAmount +=
                    $amount;

                $rejectedCount++;
            }
        }


        jsonResponse(
            true,
            "Withdrawal requests loaded successfully.",
            [
                "withdrawals" =>
                    $withdrawalList,

                "summary" => [
                    "total" =>
                        $totalAmount,

                    "pending" =>
                        $pendingAmount,

                    "approved" =>
                        $approvedAmount,

                    "rejected" =>
                        $rejectedAmount,

                    "total_count" =>
                        count(
                            $withdrawalList
                        ),

                    "pending_count" =>
                        $pendingCount,

                    "approved_count" =>
                        $approvedCount,

                    "rejected_count" =>
                        $rejectedCount
                ],

                /*
                 * These aliases make the API
                 * compatible with the JS.
                 */
                "total_withdrawals" =>
                    $totalAmount,

                "pending_withdrawals" =>
                    $pendingAmount,

                "approved_withdrawals" =>
                    $approvedAmount,

                "rejected_withdrawals" =>
                    $rejectedAmount
            ]
        );


    } catch (Throwable $e) {

        error_log(
            "admin-withdrawals.php GET error: " .
            $e->getMessage()
        );

        jsonResponse(
            false,
            "Unable to load withdrawal requests.",
            [],
            500
        );
    }
}


/* =========================================================
   POST — APPROVE / REJECT
========================================================= */

if (
    $requestMethod === "POST"
) {

    /*
     * Read JSON body.
     */
    $rawInput =
        file_get_contents(
            "php://input"
        );


    $input = [];


    if (
        $rawInput !== false &&
        trim($rawInput) !== ""
    ) {

        $decoded =
            json_decode(
                $rawInput,
                true
            );


        if (
            is_array($decoded)
        ) {
            $input = $decoded;
        }
    }


    /*
     * Also support normal POST form data.
     */
    if (
        empty($input) &&
        !empty($_POST)
    ) {
        $input = $_POST;
    }


    $withdrawalId =
        trim(
            (string)(
                $input["withdrawal_id"] ??
                $input["id"] ??
                ""
            )
        );


    $action =
        strtolower(
            trim(
                (string)(
                    $input["action"] ??
                    ""
                )
            )
        );


    /*
     * Validate action.
     */
    if (
        !in_array(
            $action,
            [
                "approve",
                "reject"
            ],
            true
        )
    ) {

        jsonResponse(
            false,
            "Invalid withdrawal action.",
            [],
            400
        );
    }


    /*
     * Validate withdrawal ID.
     */
    if (
        $withdrawalId === ""
    ) {

        jsonResponse(
            false,
            "Withdrawal ID is required.",
            [],
            400
        );
    }


    /*
     * Convert withdrawal ID.
     */
    try {

        $withdrawalObjectId =
            new MongoDB\BSON\ObjectId(
                $withdrawalId
            );

    } catch (Throwable $e) {

        jsonResponse(
            false,
            "Invalid withdrawal ID.",
            [],
            400
        );
    }


    /* =====================================================
       APPROVAL / REJECTION
    ====================================================== */

    try {

        /*
         * Find current withdrawal.
         */
        $withdrawal =
            $withdrawals->findOne([
                "_id" =>
                    $withdrawalObjectId
            ]);


        if (!$withdrawal) {

            jsonResponse(
                false,
                "Withdrawal request was not found.",
                [],
                404
            );
        }


        /*
         * Convert document to array.
         */
        $withdrawalArray =
            $withdrawal->getArrayCopy();


        /*
         * Only pending withdrawals may
         * be approved or rejected.
         */
        $currentStatus =
            strtolower(
                trim(
                    (string)(
                        $withdrawalArray["status"] ??
                        "pending"
                    )
                )
            );


        if (
            $currentStatus !==
            "pending"
        ) {

            jsonResponse(
                false,
                "This withdrawal has already been processed.",
                [
                    "current_status" =>
                        $currentStatus
                ],
                409
            );
        }


        /*
         * Locate customer.
         */
        $userId =
            getWithdrawalUserId(
                $withdrawalArray
            );


        if (
            $userId === ""
        ) {

            jsonResponse(
                false,
                "The withdrawal is not linked to a valid user.",
                [],
                400
            );
        }


        /*
         * Find customer.
         */
        $userObjectId = null;

        try {

            $userObjectId =
                new MongoDB\BSON\ObjectId(
                    $userId
                );


            $customer =
                $users->findOne([
                    "_id" =>
                        $userObjectId
                ]);

        } catch (Throwable $e) {

            $customer =
                $users->findOne([
                    "_id" =>
                        $userId
                ]);
        }


        if (!$customer) {

            jsonResponse(
                false,
                "The customer account associated with this withdrawal was not found.",
                [],
                404
            );
        }


        /*
         * Customer status.
         */
        $customerStatus =
            strtolower(
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
                    "banned",
                    "inactive"
                ],
                true
            )
        ) {

            /*
             * We do not approve money from
             * a blocked/suspended account.
             */
            if (
                $action ===
                "approve"
            ) {

                jsonResponse(
                    false,
                    "This customer's account is not active. The withdrawal cannot be approved.",
                    [],
                    403
                );
            }
        }


        /*
         * Amount.
         */
        $amount =
            mongoNumberToFloat(
                $withdrawalArray["amount"] ??
                $withdrawalArray["requested_amount"] ??
                $withdrawalArray["withdrawal_amount"] ??
                0
            );


        if (
            $amount < 5000
        ) {

            jsonResponse(
                false,
                "Withdrawal amount is below the minimum withdrawal limit.",
                [],
                400
            );
        }


        /*
         * Whole UGX only.
         */
        if (
            floor($amount) !==
            $amount
        ) {

            jsonResponse(
                false,
                "Withdrawal amount must be a whole UGX amount.",
                [],
                400
            );
        }


        /*
         * Calculate 20% fee.
         */
        $fee =
            mongoNumberToFloat(
                $withdrawalArray["fee"] ??
                $withdrawalArray["withdrawal_fee"] ??
                $withdrawalArray["fee_amount"] ??
                0
            );


        if (
            $fee <= 0
        ) {

            $fee =
                round(
                    $amount *
                    WITHDRAWAL_FEE_RATE,
                    0
                );
        }


        /*
         * Payout.
         */
        $payoutAmount =
            mongoNumberToFloat(
                $withdrawalArray["payout_amount"] ??
                $withdrawalArray["payout"] ??
                $withdrawalArray["net_amount"] ??
                0
            );


        if (
            $payoutAmount <= 0
        ) {

            $payoutAmount =
                max(
                    0,
                    $amount - $fee
                );
        }


        /*
         * Payment method.
         */
        $paymentMethod =
            (string)(
                $withdrawalArray["payment_method"] ??
                $withdrawalArray["method"] ??
                ""
            );


        /*
         * Customer registered phone.
         */
        $registeredPhone =
            (string)(
                $customer["phone"] ??
                $customer["phone_number"] ??
                $customer["mobile"] ??
                ""
            );


        /*
         * Use withdrawal phone if customer phone
         * field is not available.
         */
        if (
            trim($registeredPhone) === ""
        ) {

            $registeredPhone =
                (string)(
                    $withdrawalArray["phone"] ??
                    $withdrawalArray["phone_number"] ??
                    $withdrawalArray["mobile"] ??
                    ""
                );
        }


        /* =================================================
           REJECT
        ================================================== */

        if (
            $action ===
            "reject"
        ) {

            /*
             * Atomic status transition:
             *
             * pending -> rejected
             *
             * If another admin processed it at the
             * same time, modifiedCount becomes 0.
             */
            $updateResult =
                $withdrawals->updateOne(
                    [
                        "_id" =>
                            $withdrawalObjectId,

                        "status" =>
                            "pending"
                    ],
                    [
                        '$set' => [
                            "status" =>
                                "rejected",

                            "payout_status" =>
                                "not_required",

                            "rejected_at" =>
                                new MongoDB\BSON\UTCDateTime(),

                            "rejected_by" =>
                                $currentUserObjectId,

                            "updated_at" =>
                                new MongoDB\BSON\UTCDateTime()
                        ]
                    ]
                );


            if (
                $updateResult->getModifiedCount() !==
                1
            ) {

                jsonResponse(
                    false,
                    "This withdrawal was already processed by another administrator.",
                    [],
                    409
                );
            }


            /*
             * Add transaction record.
             */
            try {

                $transactions->insertOne([
                    "user_id" =>
                        $customer["_id"] ?? $userId,

                    "type" =>
                        "withdrawal",

                    "transaction_type" =>
                        "withdrawal",

                    "reference" =>
                        "WD-" .
                        strtoupper(
                            substr(
                                $withdrawalId,
                                -10
                            )
                        ),

                    "withdrawal_id" =>
                        $withdrawalObjectId,

                    "amount" =>
                        $amount,

                    "fee" =>
                        $fee,

                    "payout_amount" =>
                        $payoutAmount,

                    "payment_method" =>
                        $paymentMethod,

                    "phone" =>
                        $registeredPhone,

                    "status" =>
                        "rejected",

                    "description" =>
                        "Withdrawal rejected by administrator.",

                    "created_at" =>
                        new MongoDB\BSON\UTCDateTime(),

                    "updated_at" =>
                        new MongoDB\BSON\UTCDateTime()
                ]);

            } catch (Throwable $e) {

                /*
                 * Withdrawal status has already changed.
                 * Log transaction insertion failure rather
                 * than falsely returning success with no record.
                 */
                error_log(
                    "Withdrawal rejection transaction log error: " .
                    $e->getMessage()
                );
            }


            /*
             * Audit log.
             */
            try {

                $auditLogs->insertOne([
                    "action" =>
                        "admin_withdrawal_rejected",

                    "event" =>
                        "withdrawal_rejected",

                    "admin_user_id" =>
                        $currentUserObjectId,

                    "target_user_id" =>
                        $customer["_id"] ?? $userId,

                    "withdrawal_id" =>
                        $withdrawalObjectId,

                    "amount" =>
                        $amount,

                    "fee" =>
                        $fee,

                    "payout_amount" =>
                        $payoutAmount,

                    "payment_method" =>
                        $paymentMethod,

                    "phone" =>
                        $registeredPhone,

                    "created_at" =>
                        new MongoDB\BSON\UTCDateTime()
                ]);

            } catch (Throwable $e) {

                error_log(
                    "Withdrawal rejection audit error: " .
                    $e->getMessage()
                );
            }


            jsonResponse(
                true,
                "Withdrawal rejected successfully.",
                [
                    "withdrawal_id" =>
                        $withdrawalId,

                    "status" =>
                        "rejected",

                    "payout_status" =>
                        "not_required",

                    "amount" =>
                        $amount,

                    "fee" =>
                        $fee,

                    "payout_amount" =>
                        $payoutAmount
                ]
            );
        }


        /* =================================================
           APPROVE
        ================================================== */

        /*
         * Get current customer balance.
         */
        $balance =
            mongoNumberToFloat(
                $customer["balance"] ??
                $customer["wallet_balance"] ??
                0
            );


        /*
         * The requested amount is what leaves
         * the user's Crown Cash balance.
         *
         * Example:
         *
         * Balance:       20,000
         * Withdrawal:    10,000
         * Fee:             2,000
         * Payout:          8,000
         *
         * User balance after approval:
         * 10,000
         */
        if (
            $balance <
            $amount
        ) {

            jsonResponse(
                false,
                "The customer does not have enough balance to approve this withdrawal.",
                [
                    "balance" =>
                        $balance,

                    "requested_amount" =>
                        $amount
                ],
                400
            );
        }


        /*
         * Registered phone is required.
         */
        if (
            trim($registeredPhone) === ""
        ) {

            jsonResponse(
                false,
                "The customer does not have a registered phone number.",
                [],
                400
            );
        }


        /*
         * Start MongoDB transaction.
         *
         * MongoDB Atlas supports transactions.
         */
        $mongoClient = null;
        $session = null;


        /*
         * config.php normally exposes $client.
         *
         * If it does not, use the existing MongoDB
         * manager where available.
         */
        if (
            isset($client) &&
            $client instanceof MongoDB\Client
        ) {

            $mongoClient =
                $client;

        } elseif (
            isset($mongo) &&
            $mongo instanceof MongoDB\Client
        ) {

            $mongoClient =
                $mongo;
        }


        /*
         * If config.php does not expose a MongoDB Client,
         *