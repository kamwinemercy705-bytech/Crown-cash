<?php

declare(strict_types=1);

/*
|--------------------------------------------------------------------------
| Crown Cash - Admin Withdrawals API
|--------------------------------------------------------------------------
| GET  = View withdrawals
| POST = Approve / reject withdrawals
|
| Security:
| - Protected by admin-auth.php
| - Only designated administrator can access
| - Only pending withdrawals can be processed
| - Approval is atomic
| - Balance is checked and deducted atomically
| - Same withdrawal cannot be approved twice
| - Rejected withdrawals do not deduct balance
|--------------------------------------------------------------------------
*/

require_once __DIR__ . "/admin-auth.php";

header("Content-Type: application/json; charset=utf-8");

header(
    "Access-Control-Allow-Origin: https://crown-cash.vercel.app"
);

header("Access-Control-Allow-Credentials: true");

header(
    "Access-Control-Allow-Methods: GET, POST, OPTIONS"
);

header(
    "Access-Control-Allow-Headers: Content-Type"
);


/*
|--------------------------------------------------------------------------
| OPTIONS
|--------------------------------------------------------------------------
*/

if ($_SERVER["REQUEST_METHOD"] === "OPTIONS") {
    http_response_code(204);
    exit;
}


/*
|--------------------------------------------------------------------------
| JSON response helper
|--------------------------------------------------------------------------
*/

function withdrawalResponse(
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


/*
|--------------------------------------------------------------------------
| Convert MongoDB numeric values to float
|--------------------------------------------------------------------------
*/

function withdrawalAmountToFloat($value): float
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


/*
|--------------------------------------------------------------------------
| GET - Load withdrawals
|--------------------------------------------------------------------------
*/

if ($_SERVER["REQUEST_METHOD"] === "GET") {

    try {

        $search = trim(
            (string)($_GET["search"] ?? "")
        );

        $status = strtolower(
            trim((string)($_GET["status"] ?? ""))
        );

        $method = strtolower(
            trim((string)($_GET["method"] ?? ""))
        );

        $limit = (int)($_GET["limit"] ?? 100);

        if ($limit < 1) {
            $limit = 100;
        }

        if ($limit > 500) {
            $limit = 500;
        }


        /*
        |--------------------------------------------------------------------------
        | Build query
        |--------------------------------------------------------------------------
        */

        $query = [];


        /*
        |--------------------------------------------------------------------------
        | Status filter
        |--------------------------------------------------------------------------
        */

        if ($status !== "") {
            $query["status"] = $status;
        }


        /*
        |--------------------------------------------------------------------------
        | Method filter
        |--------------------------------------------------------------------------
        */

        if ($method !== "") {
            $query["method"] = $method;
        }


        /*
        |--------------------------------------------------------------------------
        | Search
        |--------------------------------------------------------------------------
        */

        if ($search !== "") {

            $searchRegex = [
                "\$regex" => preg_quote($search),
                "\$options" => "i"
            ];

            $query["\$or"] = [
                [
                    "user_email" =>
                        $searchRegex
                ],
                [
                    "phone" =>
                        $searchRegex
                ],
                [
                    "reference" =>
                        $searchRegex
                ],
                [
                    "withdrawal_reference" =>
                        $searchRegex
                ]
            ];
        }


        /*
        |--------------------------------------------------------------------------
        | Fetch withdrawals
        |--------------------------------------------------------------------------
        */

        $cursor = $withdrawals->find(
            $query,
            [
                "limit" => $limit,
                "sort" => [
                    "_id" => -1
                ]
            ]
        );


        $withdrawalList = [];


        foreach ($cursor as $withdrawal) {

            $withdrawalId =
                isset($withdrawal["_id"])
                ? (string)$withdrawal["_id"]
                : "";


            /*
            |--------------------------------------------------------------------------
            | User ID
            |--------------------------------------------------------------------------
            */

            $userId = "";

            if (isset($withdrawal["user_id"])) {

                if (
                    $withdrawal["user_id"]
                    instanceof MongoDB\BSON\ObjectId
                ) {

                    $userId =
                        (string)$withdrawal["user_id"];

                } else {

                    $userId =
                        (string)$withdrawal["user_id"];
                }
            }


            /*
            |--------------------------------------------------------------------------
            | Amount
            |--------------------------------------------------------------------------
            */

            $amount =
                withdrawalAmountToFloat(
                    $withdrawal["amount"] ?? 0
                );


            /*
            |--------------------------------------------------------------------------
            | Dates
            |--------------------------------------------------------------------------
            */

            $createdAt = "";

            if (
                isset($withdrawal["created_at"]) &&
                $withdrawal["created_at"]
                    instanceof MongoDB\BSON\UTCDateTime
            ) {

                $createdAt =
                    $withdrawal["created_at"]
                        ->toDateTime()
                        ->format("Y-m-d H:i:s");
            }


            $approvedAt = "";

            if (
                isset($withdrawal["approved_at"]) &&
                $withdrawal["approved_at"]
                    instanceof MongoDB\BSON\UTCDateTime
            ) {

                $approvedAt =
                    $withdrawal["approved_at"]
                        ->toDateTime()
                        ->format("Y-m-d H:i:s");
            }


            $rejectedAt = "";

            if (
                isset($withdrawal["rejected_at"]) &&
                $withdrawal["rejected_at"]
                    instanceof MongoDB\BSON\UTCDateTime
            ) {

                $rejectedAt =
                    $withdrawal["rejected_at"]
                        ->toDateTime()
                        ->format("Y-m-d H:i:s");
            }


            /*
            |--------------------------------------------------------------------------
            | Return safe information only
            |--------------------------------------------------------------------------
            */

            $withdrawalList[] = [

                "id" =>
                    $withdrawalId,

                "user_id" =>
                    $userId,

                "user_name" =>
                    (string)(
                        $withdrawal["user_name"]
                        ?? ""
                    ),

                "user_email" =>
                    (string)(
                        $withdrawal["user_email"]
                        ?? ""
                    ),

                "amount" =>
                    $amount,

                "method" =>
                    (string)(
                        $withdrawal["method"]
                        ?? ""
                    ),

                "phone" =>
                    (string)(
                        $withdrawal["phone"]
                        ?? ""
                    ),

                "reference" =>
                    (string)(
                        $withdrawal["reference"]
                        ??
                        $withdrawal[
                            "withdrawal_reference"
                        ]
                        ??
                        ""
                    ),

                "status" =>
                    (string)(
                        $withdrawal["status"]
                        ?? "pending"
                    ),

                "payout_status" =>
                    (string)(
                        $withdrawal["payout_status"]
                        ?? ""
                    ),

                "created_at" =>
                    $createdAt,

                "approved_at" =>
                    $approvedAt,

                "rejected_at" =>
                    $rejectedAt,

                "rejection_reason" =>
                    (string)(
                        $withdrawal[
                            "rejection_reason"
                        ]
                        ?? ""
                    )
            ];
        }


        /*
        |--------------------------------------------------------------------------
        | Statistics
        |--------------------------------------------------------------------------
        */

        $total =
            $withdrawals->countDocuments([]);

        $pending =
            $withdrawals->countDocuments([
                "status" => "pending"
            ]);

        $approved =
            $withdrawals->countDocuments([
                "status" => "approved"
            ]);

        $rejected =
            $withdrawals->countDocuments([
                "status" => "rejected"
            ]);


        /*
        |--------------------------------------------------------------------------
        | Total approved withdrawals
        |--------------------------------------------------------------------------
        */

        $approvedAmount = 0.0;

        $approvedCursor =
            $withdrawals->find([
                "status" => "approved"
            ]);


        foreach ($approvedCursor as $approvedWithdrawal) {

            $approvedAmount +=
                withdrawalAmountToFloat(
                    $approvedWithdrawal["amount"]
                    ?? 0
                );
        }


        withdrawalResponse(
            true,
            "Withdrawals loaded successfully.",
            [
                "withdrawals" =>
                    $withdrawalList,

                "stats" => [
                    "total" =>
                        $total,

                    "pending" =>
                        $pending,

                    "approved" =>
                        $approved,

                    "rejected" =>
                        $rejected,

                    "approved_amount" =>
                        $approvedAmount
                ]
            ]
        );

    } catch (Throwable $e) {

        error_log(
            "Admin withdrawals GET error: " .
            $e->getMessage()
        );

        withdrawalResponse(
            false,
            "Unable to load withdrawals.",
            [],
            500
        );
    }
}


/*
|--------------------------------------------------------------------------
| POST - Approve / reject withdrawal
|--------------------------------------------------------------------------
*/

if ($_SERVER["REQUEST_METHOD"] === "POST") {

    try {

        $rawInput =
            file_get_contents("php://input");

        $data = json_decode(
            $rawInput,
            true
        );


        if (!is_array($data)) {

            withdrawalResponse(
                false,
                "Invalid request data.",
                [],
                400
            );
        }


        $action = strtolower(
            trim((string)(
                $data["action"] ?? ""
            ))
        );

        $withdrawalId = trim(
            (string)(
                $data["withdrawal_id"] ?? ""
            )
        );


        /*
        |--------------------------------------------------------------------------
        | Validate action
        |--------------------------------------------------------------------------
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

            withdrawalResponse(
                false,
                "Invalid withdrawal action.",
                [],
                400
            );
        }


        /*
        |--------------------------------------------------------------------------
        | Validate withdrawal ID
        |--------------------------------------------------------------------------
        */

        if ($withdrawalId === "") {

            withdrawalResponse(
                false,
                "Withdrawal ID is required.",
                [],
                400
            );
        }


        try {

            $withdrawalObjectId =
                new MongoDB\BSON\ObjectId(
                    $withdrawalId
                );

        } catch (Throwable $e) {

            withdrawalResponse(
                false,
                "Invalid withdrawal ID.",
                [],
                400
            );
        }


        /*
        |--------------------------------------------------------------------------
        | Find withdrawal
        |--------------------------------------------------------------------------
        */

        $withdrawal =
            $withdrawals->findOne([
                "_id" =>
                    $withdrawalObjectId
            ]);


        if (!$withdrawal) {

            withdrawalResponse(
                false,
                "Withdrawal was not found.",
                [],
                404
            );
        }


        /*
        |--------------------------------------------------------------------------
        | Only pending withdrawals can be processed
        |--------------------------------------------------------------------------
        */

        $currentStatus =
            strtolower(
                trim((string)(
                    $withdrawal["status"]
                    ?? "pending"
                ))
            );


        if ($currentStatus !== "pending") {

            withdrawalResponse(
                false,
                "This withdrawal has already been processed.",
                [],
                409
            );
        }


        /*
        |--------------------------------------------------------------------------
        | User ID
        |--------------------------------------------------------------------------
        */

        if (!isset($withdrawal["user_id"])) {

            withdrawalResponse(
                false,
                "Withdrawal has no associated user.",
                [],
                400
            );
        }


        $withdrawalUserId =
            $withdrawal["user_id"];


        /*
        |--------------------------------------------------------------------------
        | Convert user ID
        |--------------------------------------------------------------------------
        */

        if (
            $withdrawalUserId
            instanceof MongoDB\BSON\ObjectId
        ) {

            $userObjectId =
                $withdrawalUserId;

        } else {

            try {

                $userObjectId =
                    new MongoDB\BSON\ObjectId(
                        (string)$withdrawalUserId
                    );

            } catch (Throwable $e) {

                withdrawalResponse(
                    false,
                    "Invalid withdrawal user ID.",
                    [],
                    400
                );
            }
        }


        /*
        |--------------------------------------------------------------------------
        | Find user
        |--------------------------------------------------------------------------
        */

        $user =
            $users->findOne([
                "_id" =>
                    $userObjectId
            ]);


        if (!$user) {

            withdrawalResponse(
                false,
                "Withdrawal user account was not found.",
                [],
                404
            );
        }


        /*
        |--------------------------------------------------------------------------
        | Amount
        |--------------------------------------------------------------------------
        */

        $amount =
            withdrawalAmountToFloat(
                $withdrawal["amount"] ?? 0
            );


        if ($amount < 10000) {

            withdrawalResponse(
                false,
                "Invalid withdrawal amount.",
                [],
                400
            );
        }


        /*
        |--------------------------------------------------------------------------
        | APPROVE
        |--------------------------------------------------------------------------
        */

        if ($action === "approve") {

            /*
            |--------------------------------------------------------------------------
            | Get admin ID
            |--------------------------------------------------------------------------
            */

            $adminId =
                (string)(
                    $_SESSION["user_id"]
                    ?? ""
                );


            /*
            |--------------------------------------------------------------------------
            | Atomically reserve/deduct balance
            |--------------------------------------------------------------------------
            |
            | This condition is critical:
            |
            | balance >= requested withdrawal
            |
            | MongoDB performs this update atomically.
            |
            | Two simultaneous approvals cannot both spend
            | the same balance.
            |--------------------------------------------------------------------------
            */

            $balanceUpdate =
                $users->updateOne(
                    [
                        "_id" =>
                            $userObjectId,

                        "balance" => [
                            "\$gte" =>
                                $amount
                        ],

                        "status" => [
                            "\$nin" => [
                                "blocked",
                                "suspended",
                                "disabled",
                                "banned"
                            ]
                        ]
                    ],
                    [
                        "\$inc" => [
                            "balance" =>
                                -$amount
                        ],

                        "\$set" => [
                            "updated_at" =>
                                new MongoDB\BSON\UTCDateTime()
                        ]
                    ]
                );


            /*
            |--------------------------------------------------------------------------
            | Insufficient balance
            |--------------------------------------------------------------------------
            */

            if (
                $balanceUpdate->getModifiedCount()
                !== 1
            ) {

                withdrawalResponse(
                    false,
                    "Insufficient available balance or user account is not active.",
                    [],
                    400
                );
            }


            /*
            |--------------------------------------------------------------------------
            | Now atomically approve the withdrawal
            |--------------------------------------------------------------------------
            |
            | It MUST still be pending.
            |--------------------------------------------------------------------------
            */

            $withdrawalUpdate =
                $withdrawals->updateOne(
                    [
                        "_id" =>
                            $withdrawalObjectId,

                        "status" =>
                            "pending"
                    ],
                    [
                        "\$set" => [

                            "status" =>
                                "approved",

                            "payout_status" =>
                                "awaiting_payout",

                            "approved_at" =>
                                new MongoDB\BSON\UTCDateTime(),

                            "approved_by" =>
                                $adminId,

                            "updated_at" =>
                                new MongoDB\BSON\UTCDateTime()
                        ]
                    ]
                );


            /*
            |--------------------------------------------------------------------------
            | Critical protection
            |--------------------------------------------------------------------------
            |
            | If another request processed this withdrawal between
            | our checks, the balance has already been deducted.
            |
            | We therefore log the problem immediately.
            |--------------------------------------------------------------------------
            */

            if (
                $withdrawalUpdate->getModifiedCount()
                !== 1
            {

                error_log(
                    "CRITICAL: Withdrawal balance deducted but withdrawal approval failed. " .
                    "Withdrawal ID: " .
                    $withdrawalId .
                    " User ID: " .
                    (string)$userObjectId .
                    " Amount: " .
                    $amount
                );


                withdrawalResponse(
                    false,
                    "Withdrawal requires administrator investigation.",
                    [],
                    500
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
                        "\$or" => [
                            [
                                "withdrawal_id" =>
                                    $withdrawalObjectId
                            ],
                            [
                                "reference" =>
                                    (string)(
                                        $withdrawal[
                                            "reference"
                                        ]
                                        ??
                                        ""
                                    )
                            ]
                        ]
                    ],
                    [
                        "\$set" => [
                            "status" =>
                                "approved",

                            "updated_at" =>
                                new MongoDB\BSON\UTCDateTime()
                        ]
                    ]
                );

            } catch (Throwable $transactionError) {

                error_log(
                    "Withdrawal transaction update error: " .
                    $transactionError->getMessage()
                );
            }


            /*
            |--------------------------------------------------------------------------
            | Audit log
            |--------------------------------------------------------------------------
            */

            try {

                $auditLogs->insertOne([
                    "action" =>
                        "withdrawal_approved",

                    "admin_id" =>
                        $adminId,

                    "user_id" =>
                        $userObjectId,

                    "withdrawal_id" =>
                        $withdrawalObjectId,

                    "amount" =>
                        $amount,

                    "created_at" =>
                        new MongoDB\BSON\UTCDateTime()
                ]);

            } catch (Throwable $auditError) {

                error_log(
                    "Withdrawal audit log error: " .
                    $auditError->getMessage()
                );
            }


            /*
            |--------------------------------------------------------------------------
            | IMPORTANT
            |--------------------------------------------------------------------------
            |
            | This approval DOES NOT send Mobile Money.
            |
            | payout_status = awaiting_payout
            |
            | A real MTN/Airtel payout must be performed through
            | an authorized payment integration.
            |--------------------------------------------------------------------------
            */

            withdrawalResponse(
                true,
                "Withdrawal approved. Balance deducted and payout is awaiting processing.",
                [
                    "withdrawal_id" =>
                        $withdrawalId,

                    "amount" =>
                        $amount,

                    "payout_status" =>
                        "awaiting_payout"
                ]
            );
        }


        /*
        |--------------------------------------------------------------------------
        | REJECT
        |--------------------------------------------------------------------------
        */

        if ($action === "reject") {

            $adminId =
                (string)(
                    $_SESSION["user_id"]
                    ?? ""
                );


            /*
            |--------------------------------------------------------------------------
            | Rejection reason
            |--------------------------------------------------------------------------
            */

            $reason = trim(
                (string)(
                    $data["reason"] ?? ""
                )
            );

            if ($reason === "") {

                $reason =
                    "Withdrawal rejected by administrator.";
            }


            /*
            |--------------------------------------------------------------------------
            | Atomically reject pending withdrawal
            |--------------------------------------------------------------------------
            */

            $rejectUpdate =
                $withdrawals->updateOne(
                    [
                        "_id" =>
                            $withdrawalObjectId,

                        "status" =>
                            "pending"
                    ],
                    [
                        "\$set" => [

                            "status" =>
                                "rejected",

                            "rejection_reason" =>
                                $reason,

                            "rejected_at" =>
                                new MongoDB\BSON\UTCDateTime(),

                            "rejected_by" =>
                                $adminId,

                            "updated_at" =>
                                new MongoDB\BSON\UTCDateTime()
                        ]
                    ]
                );


            if (
                $rejectUpdate->getModifiedCount()
                !== 1
            ) {

                withdrawalResponse(
                    false,
                    "Withdrawal was already processed.",
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
                        "\$or" => [
                            [
                                "withdrawal_id" =>
                                    $withdrawalObjectId
                            ],
                            [
                                "reference" =>
                                    (string)(
                                        $withdrawal[
                                            "reference"
                                        ]
                                        ??
                                        ""
                                    )
                            ]
                        ]
                    ],
                    [
                        "\$set" => [
                            "status" =>
                                "rejected",

                            "updated_at" =>
                                new MongoDB\BSON\UTCDateTime()
                        ]
                    ]
                );

            } catch (Throwable $transactionError) {

                error_log(
                    "Withdrawal rejection transaction error: " .
                    $transactionError->getMessage()
                );
            }


            /*
            |--------------------------------------------------------------------------
            | Audit log
            |--------------------------------------------------------------------------
            */

            try {

                $auditLogs->insertOne([
                    "action" =>
                        "withdrawal_rejected",

                    "admin_id" =>
                        $adminId,

                    "user_id" =>
                        $userObjectId,

                    "withdrawal_id" =>
                        $withdrawalObjectId,

                    "reason" =>
                        $reason,

                    "created_at" =>
                        new MongoDB\BSON\UTCDateTime()
                ]);

            } catch (Throwable $auditError) {

                error_log(
                    "Withdrawal audit log error: " .
                    $auditError->getMessage()
                );
            }


            withdrawalResponse(
                true,
                "Withdrawal rejected successfully.",
                [
                    "withdrawal_id" =>
                        $withdrawalId
                ]
            );
        }

    } catch (MongoDB\Driver\Exception\Exception $e) {

        error_log(
            "Admin withdrawals MongoDB error: " .
            $e->getMessage()
        );

        withdrawalResponse(
            false,
            "Database error while processing withdrawal.",
            [],
            500
        );

    } catch (Throwable $e) {

        error_log(
            "Admin withdrawals POST error: " .
            $e->getMessage()
        );

        withdrawalResponse(
            false,
            "Unable to process withdrawal.",
            [],
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

?>