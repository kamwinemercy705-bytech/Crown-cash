<?php

declare(strict_types=1);

/*
|--------------------------------------------------------------------------
| Crown Cash - Admin Withdrawals API
|--------------------------------------------------------------------------
|
| GET  = View withdrawals
| POST = Approve / reject withdrawals
|
| Withdrawal rules:
| - Minimum withdrawal: UGX 5,000
| - Withdrawal fee: 10%
| - Fee is deducted from requested amount
| - Example:
|     Request = UGX 20,000
|     Fee     = UGX 2,000
|     Payout  = UGX 18,000
|
| Approval:
| - Only pending withdrawals can be approved/rejected
| - User balance is checked atomically
| - Requested amount is deducted exactly once
| - Withdrawal becomes approved
| - payout_status becomes awaiting_payout
| - Transaction is updated
| - Audit record is created
| - MongoDB transaction protects against partial updates
|
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
| CONSTANTS
|--------------------------------------------------------------------------
*/

const MINIMUM_WITHDRAWAL = 5000;
const WITHDRAWAL_FEE_RATE = 0.10;


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
| Convert MongoDB date to string
|--------------------------------------------------------------------------
*/

function withdrawalDateToString($value): string
{
    if (
        $value instanceof MongoDB\BSON\UTCDateTime
    ) {
        return $value
            ->toDateTime()
            ->format("Y-m-d H:i:s");
    }

    return "";
}


/*
|--------------------------------------------------------------------------
| GET - Load withdrawals
|--------------------------------------------------------------------------
*/

if ($_SERVER["REQUEST_METHOD"] === "GET") {

    try {

        $search = trim(
            (string)(
                $_GET["search"] ?? ""
            )
        );

        $status = strtolower(
            trim(
                (string)(
                    $_GET["status"] ?? ""
                )
            )
        );

        $method = strtolower(
            trim(
                (string)(
                    $_GET["method"] ?? ""
                )
            )
        );

        $limit = (int)(
            $_GET["limit"] ?? 100
        );


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

            $query["status"] =
                $status;
        }


        /*
        |--------------------------------------------------------------------------
        | Method filter
        |--------------------------------------------------------------------------
        */

        if ($method !== "") {

            $query["method"] =
                $method;
        }


        /*
        |--------------------------------------------------------------------------
        | Search
        |--------------------------------------------------------------------------
        */

        if ($search !== "") {

            $searchRegex = [
                "\$regex" =>
                    preg_quote(
                        $search,
                        "/"
                    ),

                "\$options" =>
                    "i"
            ];


            $query["\$or"] = [

                [
                    "user_email" =>
                        $searchRegex
                ],

                [
                    "user_name" =>
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

        $cursor =
            $withdrawals->find(
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

            /*
            |--------------------------------------------------------------------------
            | Withdrawal ID
            |--------------------------------------------------------------------------
            */

            $withdrawalId = "";

            if (
                isset($withdrawal["_id"])
            ) {

                $withdrawalId =
                    (string)(
                        $withdrawal["_id"]
                    );
            }


            /*
            |--------------------------------------------------------------------------
            | User ID
            |--------------------------------------------------------------------------
            */

            $userId = "";

            if (
                isset($withdrawal["user_id"])
            ) {

                $userId =
                    (string)(
                        $withdrawal["user_id"]
                    );
            }


            /*
            |--------------------------------------------------------------------------
            | Requested amount
            |--------------------------------------------------------------------------
            */

            $requestedAmount =
                withdrawalAmountToFloat(
                    $withdrawal[
                        "requested_amount"
                    ]
                    ??
                    $withdrawal[
                        "amount"
                    ]
                    ??
                    0
                );


            /*
            |--------------------------------------------------------------------------
            | Amount
            |--------------------------------------------------------------------------
            */

            $amount =
                withdrawalAmountToFloat(
                    $withdrawal[
                        "amount"
                    ]
                    ?? 0
                );


            /*
            |--------------------------------------------------------------------------
            | Fee
            |--------------------------------------------------------------------------
            */

            $fee =
                withdrawalAmountToFloat(
                    $withdrawal[
                        "fee"
                    ]
                    ?? 0
                );


            /*
            |--------------------------------------------------------------------------
            | Fee rate
            |--------------------------------------------------------------------------
            */

            $feeRate =
                withdrawalAmountToFloat(
                    $withdrawal[
                        "fee_rate"
                    ]
                    ?? WITHDRAWAL_FEE_RATE
                );


            /*
            |--------------------------------------------------------------------------
            | Payout
            |--------------------------------------------------------------------------
            */

            $payoutAmount =
                withdrawalAmountToFloat(
                    $withdrawal[
                        "payout_amount"
                    ]
                    ?? (
                        $requestedAmount - $fee
                    )
                );


            /*
            |--------------------------------------------------------------------------
            | Dates
            |--------------------------------------------------------------------------
            */

            $createdAt =
                withdrawalDateToString(
                    $withdrawal[
                        "created_at"
                    ]
                    ?? null
                );


            $approvedAt =
                withdrawalDateToString(
                    $withdrawal[
                        "approved_at"
                    ]
                    ?? null
                );


            $rejectedAt =
                withdrawalDateToString(
                    $withdrawal[
                        "rejected_at"
                    ]
                    ?? null
                );


            /*
            |--------------------------------------------------------------------------
            | Safe withdrawal information
            |--------------------------------------------------------------------------
            */

            $withdrawalList[] = [

                "id" =>
                    $withdrawalId,

                "user_id" =>
                    $userId,

                "user_name" =>
                    (string)(
                        $withdrawal[
                            "user_name"
                        ]
                        ?? ""
                    ),

                "user_email" =>
                    (string)(
                        $withdrawal[
                            "user_email"
                        ]
                        ?? ""
                    ),

                "amount" =>
                    $amount,

                "requested_amount" =>
                    $requestedAmount,

                "fee_rate" =>
                    $feeRate,

                "fee" =>
                    $fee,

                "payout_amount" =>
                    $payoutAmount,

                "method" =>
                    (string)(
                        $withdrawal[
                            "method"
                        ]
                        ?? ""
                    ),

                "payment_method" =>
                    (string)(
                        $withdrawal[
                            "payment_method"
                        ]
                        ?? ""
                    ),

                "phone" =>
                    (string)(
                        $withdrawal[
                            "phone"
                        ]
                        ?? ""
                    ),

                "account" =>
                    (string)(
                        $withdrawal[
                            "account"
                        ]
                        ?? ""
                    ),

                "reference" =>
                    (string)(
                        $withdrawal[
                            "reference"
                        ]
                        ??
                        $withdrawal[
                            "withdrawal_reference"
                        ]
                        ??
                        ""
                    ),

                "status" =>
                    (string)(
                        $withdrawal[
                            "status"
                        ]
                        ?? "pending"
                    ),

                "payout_status" =>
                    (string)(
                        $withdrawal[
                            "payout_status"
                        ]
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
                "status" =>
                    "pending"
            ]);


        $approved =
            $withdrawals->countDocuments([
                "status" =>
                    "approved"
            ]);


        $rejected =
            $withdrawals->countDocuments([
                "status" =>
                    "rejected"
            ]);


        /*
        |--------------------------------------------------------------------------
        | Approved withdrawal totals
        |--------------------------------------------------------------------------
        */

        $approvedAmount = 0.0;

        $approvedPayoutAmount = 0.0;

        $approvedFeeAmount = 0.0;


        $approvedCursor =
            $withdrawals->find([
                "status" =>
                    "approved"
            ]);


        foreach (
            $approvedCursor
            as $approvedWithdrawal
        ) {

            $approvedRequested =
                withdrawalAmountToFloat(
                    $approvedWithdrawal[
                        "requested_amount"
                    ]
                    ??
                    $approvedWithdrawal[
                        "amount"
                    ]
                    ?? 0
                );


            $approvedFee =
                withdrawalAmountToFloat(
                    $approvedWithdrawal[
                        "fee"
                    ]
                    ?? 0
                );


            $approvedPayout =
                withdrawalAmountToFloat(
                    $approvedWithdrawal[
                        "payout_amount"
                    ]
                    ?? (
                        $approvedRequested -
                        $approvedFee
                    )
                );


            $approvedAmount +=
                $approvedRequested;


            $approvedFeeAmount +=
                $approvedFee;


            $approvedPayoutAmount +=
                $approvedPayout;
        }


        /*
        |--------------------------------------------------------------------------
        | Response
        |--------------------------------------------------------------------------
        */

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
                        $approvedAmount,

                    "approved_fee" =>
                        $approvedFeeAmount,

                    "approved_payout" =>
                        $approvedPayoutAmount
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
| POST - Approve / reject
|--------------------------------------------------------------------------
*/

if ($_SERVER["REQUEST_METHOD"] === "POST") {

    try {

        /*
        |--------------------------------------------------------------------------
        | Read JSON
        |--------------------------------------------------------------------------
        */

        $rawInput =
            file_get_contents(
                "php://input"
            );


        $data =
            json_decode(
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


        /*
        |--------------------------------------------------------------------------
        | Action
        |--------------------------------------------------------------------------
        */

        $action =
            strtolower(
                trim(
                    (string)(
                        $data[
                            "action"
                        ]
                        ?? ""
                    )
                )
            );


        /*
        |--------------------------------------------------------------------------
        | Withdrawal ID
        |--------------------------------------------------------------------------
        */

        $withdrawalId =
            trim(
                (string)(
                    $data[
                        "withdrawal_id"
                    ]
                    ?? ""
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
        | Validate ID
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
        | Only pending withdrawals
        |--------------------------------------------------------------------------
        */

        $currentStatus =
            strtolower(
                trim(
                    (string)(
                        $withdrawal[
                            "status"
                        ]
                        ?? "pending"
                    )
                )
            );


        if (
            $currentStatus !==
            "pending"
        ) {

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

        if (
            !isset(
                $withdrawal[
                    "user_id"
                ]
            )
        ) {

            withdrawalResponse(
                false,
                "Withdrawal has no associated user.",
                [],
                400
            );
        }


        $withdrawalUserId =
            $withdrawal[
                "user_id"
            ];


        /*
        |--------------------------------------------------------------------------
        | Convert user ID to ObjectId
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
        | Requested withdrawal amount
        |--------------------------------------------------------------------------
        */

        $requestedAmount =
            withdrawalAmountToFloat(
                $withdrawal[
                    "requested_amount"
                ]
                ??
                $withdrawal[
                    "amount"
                ]
                ?? 0
            );


        /*
        |--------------------------------------------------------------------------
        | Validate minimum
        |--------------------------------------------------------------------------
        */

        if (
            $requestedAmount <
            MINIMUM_WITHDRAWAL
        ) {

            withdrawalResponse(
                false,
                "Invalid withdrawal amount. Minimum withdrawal is UGX 5,000.",
                [],
                400
            );
        }


        /*
        |--------------------------------------------------------------------------
        | Validate whole thousand
        |--------------------------------------------------------------------------
        */

        if (
            fmod(
                $requestedAmount,
                1000
            ) !== 0.0
        ) {

            withdrawalResponse(
                false,
                "Withdrawal amount must be in multiples of UGX 1,000.",
                [],
                400
            );
        }


        /*
        |--------------------------------------------------------------------------
        | Calculate fee SERVER-SIDE
        |--------------------------------------------------------------------------
        */

        $feeRate =
            WITHDRAWAL_FEE_RATE;


        $fee =
            (int)round(
                $requestedAmount *
                $feeRate
            );


        $payoutAmount =
            $requestedAmount -
            $fee;


        if ($payoutAmount <= 0) {

            withdrawalResponse(
                false,
                "Invalid payout amount.",
                [],
                400
            );
        }


        /*
        |--------------------------------------------------------------------------
        | ADMIN ID
        |--------------------------------------------------------------------------
        */

        $adminId =
            (string)(
                $_SESSION[
                    "user_id"
                ]
                ?? ""
            );


        /*
        |--------------------------------------------------------------------------
        | APPROVE
        |--------------------------------------------------------------------------
        */

        if ($action === "approve") {

            /*
            |--------------------------------------------------------------------------
            | Start MongoDB transaction
            |--------------------------------------------------------------------------
            */

            $mongoSession = null;

            try {

                $mongoSession =
                    $mongoClient->startSession();


                $mongoSession->startTransaction();


                /*
                |--------------------------------------------------------------------------
                | Atomically deduct requested amount
                |--------------------------------------------------------------------------
                |
                | Important:
                |
                | The balance is reduced by the FULL requested
                | amount, not the payout amount.
                |
                | Example:
                |
                | Balance       = 50,000
                | Requested     = 20,000
                | Fee           = 2,000
                | Payout        = 18,000
                |
                | New balance   = 30,000
                |
                |--------------------------------------------------------------------------
                */

                $balanceUpdate =
                    $users->updateOne(
                        [

                            "_id" =>
                                $userObjectId,

                            "balance" => [
                                "\$gte" =>
                                    $requestedAmount
                            ],

                            "status" => [
                                "\$nin" => [
                                    "blocked",
                                    "suspended",
                                    "disabled",
                                    "banned",
                                    "inactive"
                                ]
                            ]

                        ],
                        [

                            "\$inc" => [

                                "balance" =>
                                    -$requestedAmount

                            ],

                            "\$set" => [

                                "updated_at" =>
                                    new MongoDB\BSON\UTCDateTime()

                            ]

                        ],
                        [
                            "session" =>
                                $mongoSession
                        ]
                    );


                /*
                |--------------------------------------------------------------------------
                | Balance protection
                |--------------------------------------------------------------------------
                */

                if (
                    $balanceUpdate
                        ->getModifiedCount()
                    !== 1
                ) {

                    $mongoSession
                        ->abortTransaction();

                    $mongoSession = null;


                    withdrawalResponse(
                        false,
                        "Insufficient available balance or user account is not active.",
                        [],
                        400
                    );
                }


                /*
                |--------------------------------------------------------------------------
                | Approve withdrawal ONLY while pending
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

                                "requested_amount" =>
                                    $requestedAmount,

                                "amount" =>
                                    $requestedAmount,

                                "fee_rate" =>
                                    $feeRate,

                                "fee" =>
                                    $fee,

                                "payout_amount" =>
                                    $payoutAmount,

                                "approved_at" =>
                                    new MongoDB\BSON\UTCDateTime(),

                                "approved_by" =>
                                    $adminId,

                                "updated_at" =>
                                    new MongoDB\BSON\UTCDateTime()

                            ]

                        ],
                        [
                            "session" =>
                                $mongoSession
                        ]
                    );


                /*
                |--------------------------------------------------------------------------
                | Withdrawal must be changed exactly once
                |--------------------------------------------------------------------------
                */

                if (
                    $withdrawalUpdate
                        ->getModifiedCount()
                    !== 1
                ) {

                    throw new RuntimeException(
                        "Withdrawal approval state could not be updated."
                    );
                }


                /*
                |--------------------------------------------------------------------------
                | Update transaction
                |--------------------------------------------------------------------------
                */

                $withdrawalReference =
                    (string)(
                        $withdrawal[
                            "reference"
                        ]
                        ??
                        $withdrawal[
                            "withdrawal_reference"
                        ]
                        ??
                        ""
                    );


                $transactionQuery = [
                    "\$or" => [

                        [
                            "withdrawal_id" =>
                                $withdrawalObjectId
                        ]

                    ]
                ];


                if (
                    $withdrawalReference !== ""
                ) {

                    $transactionQuery[
                        "\$or"
                    ][] = [

                        "reference" =>
                            $withdrawalReference

                    ];
                }


                $transactions->updateMany(
                    $transactionQuery,
                    [
                        "\$set" => [

                            "status" =>
                                "approved",

                            "requested_amount" =>
                                $requestedAmount,

                            "amount" =>
                                $requestedAmount,

                            "fee_rate" =>
                                $feeRate,

                            "fee" =>
                                $fee,

                            "payout_amount" =>
                                $payoutAmount,

                            "payout_status" =>
                                "awaiting_payout",

                            "updated_at" =>
                                new MongoDB\BSON\UTCDateTime()

                        ]

                    ],
                    [
                        "session" =>
                            $mongoSession
                    ]
                );


                /*
                |--------------------------------------------------------------------------
                | Audit log
                |--------------------------------------------------------------------------
                */

                $auditLogs->insertOne(
                    [

                        "action" =>
                            "withdrawal_approved",

                        "admin_id" =>
                            $adminId,

                        "user_id" =>
                            $userObjectId,

                        "withdrawal_id" =>
                            $withdrawalObjectId,

                        "requested_amount" =>
                            $requestedAmount,

                        "fee_rate" =>
                            $feeRate,

                        "fee" =>
                            $fee,

                        "payout_amount" =>
                            $payoutAmount,

                        "created_at" =>
                            new MongoDB\BSON\UTCDateTime()

                    ],
                    [
                        "session" =>
                            $mongoSession
                    ]
                );


                /*
                |--------------------------------------------------------------------------
                | Commit
                |--------------------------------------------------------------------------
                */

                $mongoSession
                    ->commitTransaction();

                $mongoSession = null;


                /*
                |--------------------------------------------------------------------------
                | Success
                |--------------------------------------------------------------------------
                |
                | NOTE:
                | No Mobile Money payout is sent here yet.
                |
                | payout_status = awaiting_payout
                |
                |--------------------------------------------------------------------------
                */

                withdrawalResponse(
                    true,
                    "Withdrawal approved successfully. Balance deducted and payout is awaiting processing.",
                    [

                        "withdrawal_id" =>
                            $withdrawalId,

                        "requested_amount" =>
                            $requestedAmount,

                        "fee_rate" =>
                            $feeRate,

                        "fee" =>
                            $fee,

                        "payout_amount" =>
                            $payoutAmount,

                        "payout_status" =>
                            "awaiting_payout"

                    ]
                );

            } catch (Throwable $e) {

                /*
                |--------------------------------------------------------------------------
                | Rollback
                |--------------------------------------------------------------------------
                */

                if (
                    $mongoSession !== null
                ) {

                    try {

                        $mongoSession
                            ->abortTransaction();

                    } catch (Throwable $rollbackError) {

                        error_log(
                            "Withdrawal rollback error: " .
                            $rollbackError->getMessage()
                        );
                    }
                }


                error_log(
                    "Withdrawal approval transaction error: " .
                    $e->getMessage()
                );


                withdrawalResponse(
                    false,
                    "Withdrawal approval failed. No balance was deducted.",
                    [],
                    500
                );
            }
        }


        /*
        |--------------------------------------------------------------------------
        | REJECT
        |--------------------------------------------------------------------------
        */

        if ($action === "reject") {

            /*
            |--------------------------------------------------------------------------
            | Rejection reason
            |--------------------------------------------------------------------------
            */

            $reason =
                trim(
                    (string)(
                        $data[
                            "reason"
                        ]
                        ?? ""
                    )
                );


            if ($reason === "") {

                $reason =
                    "Withdrawal rejected by administrator.";
            }


            /*
            |--------------------------------------------------------------------------
            | Atomic rejection
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

                            "payout_status" =>
                                "not_paid",

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
                $rejectUpdate
                    ->getModifiedCount()
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

                $withdrawalReference =
                    (string)(
                        $withdrawal[
                            "reference"
                        ]
                        ??
                        $withdrawal[
                            "withdrawal_reference"
                        ]
                        ??
                        ""
                    );


                $transactionQuery = [
                    "\$or" => [

                        [
                            "withdrawal_id" =>
                                $withdrawalObjectId
                        ]

                    ]
                ];


                if (
                    $withdrawalReference !== ""
                ) {

                    $transactionQuery[
                        "\$or"
                    ][] = [

                        "reference" =>
                            $withdrawalReference

                    ];
                }


                $transactions->updateMany(
                    $transactionQuery,
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

                $auditLogs->insertOne(
                    [

                        "action" =>
                            "withdrawal_rejected",

                        "admin_id" =>
                            $adminId,

                        "user_id" =>
                            $userObjectId,

                        "withdrawal_id" =>
                            $withdrawalObjectId,

                        "requested_amount" =>
                            $requestedAmount,

                        "fee_rate" =>
                            $feeRate,

                        "fee" =>
                            $fee,

                        "payout_amount" =>
                            $payoutAmount,

                        "reason" =>
                            $reason,

                        "created_at" =>
                            new MongoDB\BSON\UTCDateTime()

                    ]
                );

            } catch (Throwable $auditError) {

                error_log(
                    "Withdrawal rejection audit error: " .
                    $auditError->getMessage()
                );
            }


            /*
            |--------------------------------------------------------------------------
            | Important
            |--------------------------------------------------------------------------
            |
            | No balance was deducted for a pending withdrawal.
            | Therefore, rejection does NOT need a balance refund.
            |
            |--------------------------------------------------------------------------
            */

            withdrawalResponse(
                true,
                "Withdrawal rejected successfully.",
                [

                    "withdrawal_id" =>
                        $withdrawalId,

                    "requested_amount" =>
                        $requestedAmount,

                    "fee" =>
                        $fee,

                    "payout_amount" =>
                        $payoutAmount,

                    "payout_status" =>
                        "not_paid"

                ]
            );
        }

    } catch (
        MongoDB\Driver\Exception\Exception $e
    ) {

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