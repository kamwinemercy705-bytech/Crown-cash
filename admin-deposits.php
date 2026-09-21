<?php

declare(strict_types=1);

/*
|--------------------------------------------------------------------------
| Crown Cash - Admin Deposits API
|--------------------------------------------------------------------------
| GET  = View deposits
| POST = Approve / reject deposits
|
| Security:
| - Protected by admin-auth.php
| - Only the designated administrator can use this API
| - Deposit approval is atomic
| - A deposit cannot be approved twice
| - User balance is credited only once
| - Passwords and sensitive account data are never returned
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

function depositResponse(
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

function depositAmountToFloat($value): float
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
| GET - Load deposits
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
        | Payment method filter
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
                    "reference" => $searchRegex
                ],
                [
                    "transaction_reference" =>
                        $searchRegex
                ],
                [
                    "phone" => $searchRegex
                ],
                [
                    "user_email" => $searchRegex
                ]
            ];
        }


        /*
        |--------------------------------------------------------------------------
        | Fetch deposits
        |--------------------------------------------------------------------------
        */

        $cursor = $deposits->find(
            $query,
            [
                "limit" => $limit,
                "sort" => [
                    "_id" => -1
                ]
            ]
        );


        $depositList = [];


        foreach ($cursor as $deposit) {

            $depositId = isset($deposit["_id"])
                ? (string)$deposit["_id"]
                : "";


            /*
            |--------------------------------------------------------------------------
            | User ID
            |--------------------------------------------------------------------------
            */

            $userId = "";

            if (isset($deposit["user_id"])) {

                if (
                    $deposit["user_id"]
                    instanceof MongoDB\BSON\ObjectId
                ) {

                    $userId =
                        (string)$deposit["user_id"];

                } else {

                    $userId =
                        (string)$deposit["user_id"];
                }
            }


            /*
            |--------------------------------------------------------------------------
            | Amount
            |--------------------------------------------------------------------------
            */

            $amount = depositAmountToFloat(
                $deposit["amount"] ?? 0
            );


            /*
            |--------------------------------------------------------------------------
            | Date
            |--------------------------------------------------------------------------
            */

            $createdAt = "";

            if (
                isset($deposit["created_at"]) &&
                $deposit["created_at"]
                    instanceof MongoDB\BSON\UTCDateTime
            ) {

                $createdAt =
                    $deposit["created_at"]
                        ->toDateTime()
                        ->format("Y-m-d H:i:s");
            }


            /*
            |--------------------------------------------------------------------------
            | Approved date
            |--------------------------------------------------------------------------
            */

            $approvedAt = "";

            if (
                isset($deposit["approved_at"]) &&
                $deposit["approved_at"]
                    instanceof MongoDB\BSON\UTCDateTime
            ) {

                $approvedAt =
                    $deposit["approved_at"]
                        ->toDateTime()
                        ->format("Y-m-d H:i:s");
            }


            /*
            |--------------------------------------------------------------------------
            | Deposit information
            |--------------------------------------------------------------------------
            */

            $depositList[] = [

                "id" => $depositId,

                "user_id" => $userId,

                "user_email" =>
                    (string)(
                        $deposit["user_email"]
                        ?? ""
                    ),

                "user_name" =>
                    (string)(
                        $deposit["user_name"]
                        ?? ""
                    ),

                "amount" => $amount,

                "method" =>
                    (string)(
                        $deposit["method"]
                        ?? ""
                    ),

                "phone" =>
                    (string)(
                        $deposit["phone"]
                        ?? ""
                    ),

                "reference" =>
                    (string)(
                        $deposit["reference"]
                        ??
                        $deposit[
                            "transaction_reference"
                        ]
                        ??
                        ""
                    ),

                "status" =>
                    (string)(
                        $deposit["status"]
                        ?? "pending"
                    ),

                "payment_verified" =>
                    (bool)(
                        $deposit["payment_verified"]
                        ?? false
                    ),

                "created_at" => $createdAt,

                "approved_at" => $approvedAt,

                "approved_by" =>
                    (string)(
                        $deposit["approved_by"]
                        ?? ""
                    )
            ];
        }


        /*
        |--------------------------------------------------------------------------
        | Statistics
        |--------------------------------------------------------------------------
        */

        $total = $deposits->countDocuments([]);

        $pending = $deposits->countDocuments([
            "status" => "pending"
        ]);

        $approved = $deposits->countDocuments([
            "status" => "approved"
        ]);

        $rejected = $deposits->countDocuments([
            "status" => "rejected"
        ]);


        /*
        |--------------------------------------------------------------------------
        | Total approved amount
        |--------------------------------------------------------------------------
        */

        $approvedAmount = 0.0;

        $approvedCursor = $deposits->find([
            "status" => "approved"
        ]);


        foreach ($approvedCursor as $approvedDeposit) {

            $approvedAmount +=
                depositAmountToFloat(
                    $approvedDeposit["amount"] ?? 0
                );
        }


        depositResponse(
            true,
            "Deposits loaded successfully.",
            [
                "deposits" => $depositList,

                "stats" => [
                    "total" => $total,
                    "pending" => $pending,
                    "approved" => $approved,
                    "rejected" => $rejected,
                    "approved_amount" =>
                        $approvedAmount
                ]
            ]
        );

    } catch (Throwable $e) {

        error_log(
            "Admin deposits GET error: " .
            $e->getMessage()
        );

        depositResponse(
            false,
            "Unable to load deposits.",
            [],
            500
        );
    }
}


/*
|--------------------------------------------------------------------------
| POST - Approve / reject deposit
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

            depositResponse(
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

        $depositId = trim(
            (string)(
                $data["deposit_id"] ?? ""
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

            depositResponse(
                false,
                "Invalid deposit action.",
                [],
                400
            );
        }


        /*
        |--------------------------------------------------------------------------
        | Validate deposit ID
        |--------------------------------------------------------------------------
        */

        if ($depositId === "") {

            depositResponse(
                false,
                "Deposit ID is required.",
                [],
                400
            );
        }


        try {

            $depositObjectId =
                new MongoDB\BSON\ObjectId(
                    $depositId
                );

        } catch (Throwable $e) {

            depositResponse(
                false,
                "Invalid deposit ID.",
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

            depositResponse(
                false,
                "Deposit was not found.",
                [],
                404
            );
        }


        /*
        |--------------------------------------------------------------------------
        | Only pending deposits can be processed
        |--------------------------------------------------------------------------
        */

        $currentStatus = strtolower(
            trim((string)(
                $deposit["status"]
                ?? "pending"
            ))
        );


        if ($currentStatus !== "pending") {

            depositResponse(
                false,
                "This deposit has already been processed.",
                [],
                409
            );
        }


        /*
        |--------------------------------------------------------------------------
        | User ID
        |--------------------------------------------------------------------------
        */

        if (!isset($deposit["user_id"])) {

            depositResponse(
                false,
                "Deposit has no associated user.",
                [],
                400
            );
        }


        $depositUserId =
            $deposit["user_id"];


        /*
        |--------------------------------------------------------------------------
        | Find user
        |--------------------------------------------------------------------------
        */

        if (
            $depositUserId
            instanceof MongoDB\BSON\ObjectId
        ) {

            $userObjectId =
                $depositUserId;

        } else {

            try {

                $userObjectId =
                    new MongoDB\BSON\ObjectId(
                        (string)$depositUserId
                    );

            } catch (Throwable $e) {

                depositResponse(
                    false,
                    "Invalid deposit user ID.",
                    [],
                    400
                );
            }
        }


        $user = $users->findOne([
            "_id" => $userObjectId
        ]);


        if (!$user) {

            depositResponse(
                false,
                "Deposit user account was not found.",
                [],
                404
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
            | Payment must be verified
            |--------------------------------------------------------------------------
            |
            | Do not treat a customer-entered reference as proof of payment.
            |--------------------------------------------------------------------------
            */

            if (
                !isset(
                    $deposit["payment_verified"]
                ) ||
                $deposit["payment_verified"] !== true
            ) {

                depositResponse(
                    false,
                    "Payment must be verified before approval.",
                    [],
                    400
                );
            }


            /*
            |--------------------------------------------------------------------------
            | Validate amount
            |--------------------------------------------------------------------------
            */

            $amount =
                depositAmountToFloat(
                    $deposit["amount"] ?? 0
                );


            if ($amount < 10000) {

                depositResponse(
                    false,
                    "Invalid deposit amount.",
                    [],
                    400
                );
            }


            /*
            |--------------------------------------------------------------------------
            | Admin ID
            |--------------------------------------------------------------------------
            */

            $adminId =
                (string)(
                    $_SESSION["user_id"]
                    ?? ""
                );


            /*
            |--------------------------------------------------------------------------
            | Atomic deposit approval
            |--------------------------------------------------------------------------
            |
            | The status must STILL be pending.
            |
            | This prevents two requests from approving the
            | same deposit and crediting the balance twice.
            |--------------------------------------------------------------------------
            */

            $depositUpdate =
                $deposits->updateOne(
                    [
                        "_id" => $depositObjectId,
                        "status" => "pending",
                        "payment_verified" => true
                    ],
                    [
                        "\$set" => [
                            "status" => "approved",

                            "approved_at" =>
                                new MongoDB\BSON\UTCDateTime(),

                            "approved_by" =>
                                $adminId
                        ]
                    ]
                );


            /*
            |--------------------------------------------------------------------------
            | Someone else may have processed it first
            |--------------------------------------------------------------------------
            */

            if (
                $depositUpdate->getModifiedCount()
                !== 1
            ) {

                depositResponse(
                    false,
                    "Deposit was already processed or could not be approved.",
                    [],
                    409
                );
            }


            /*
            |--------------------------------------------------------------------------
            | Credit user balance
            |--------------------------------------------------------------------------
            */

            $balanceUpdate =
                $users->updateOne(
                    [
                        "_id" => $userObjectId
                    ],
                    [
                        "\$inc" => [
                            "balance" => $amount
                        ],

                        "\$set" => [
                            "updated_at" =>
                                new MongoDB\BSON\UTCDateTime()
                        ]
                    ]
                );


            /*
            |--------------------------------------------------------------------------
            | Make sure user was actually updated
            |--------------------------------------------------------------------------
            */

            if (
                $balanceUpdate->getMatchedCount()
                !== 1
            ) {

                /*
                |--------------------------------------------------------------------------
                | IMPORTANT:
                | Deposit is already marked approved at this point.
                |
                | This situation should be extremely rare.
                | Log it so the administrator can investigate.
                |--------------------------------------------------------------------------
                */

                error_log(
                    "CRITICAL: Deposit approved but user balance was not updated. " .
                    "Deposit ID: " .
                    $depositId .
                    " User ID: " .
                    (string)$userObjectId
                );


                depositResponse(
                    false,
                    "Deposit approval requires administrator investigation.",
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
                                "reference" =>
                                    (string)(
                                        $deposit["reference"]
                                        ??
                                        ""
                                    )
                            ],
                            [
                                "deposit_id" =>
                                    $depositObjectId
                            ]
                        ]
                    ],
                    [
                        "\$set" => [
                            "status" => "approved",

                            "updated_at" =>
                                new MongoDB\BSON\UTCDateTime()
                        ]
                    ]
                );

            } catch (Throwable $transactionError) {

                error_log(
                    "Deposit transaction update error: " .
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
                        "deposit_approved",

                    "admin_id" =>
                        $adminId,

                    "user_id" =>
                        $userObjectId,

                    "deposit_id" =>
                        $depositObjectId,

                    "amount" =>
                        $amount,

                    "created_at" =>
                        new MongoDB\BSON\UTCDateTime()
                ]);

            } catch (Throwable $auditError) {

                error_log(
                    "Deposit audit log error: " .
                    $auditError->getMessage()
                );
            }


            depositResponse(
                true,
                "Deposit approved and user balance credited.",
                [
                    "deposit_id" =>
                        $depositId,

                    "amount" =>
                        $amount
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
            | Optional rejection reason
            |--------------------------------------------------------------------------
            */

            $reason = trim(
                (string)(
                    $data["reason"] ?? ""
                )
            );

            if ($reason === "") {
                $reason = "Deposit rejected by administrator.";
            }


            /*
            |--------------------------------------------------------------------------
            | Atomic rejection
            |--------------------------------------------------------------------------
            */

            $rejectUpdate =
                $deposits->updateOne(
                    [
                        "_id" => $depositObjectId,
                        "status" => "pending"
                    ],
                    [
                        "\$set" => [
                            "status" => "rejected",

                            "rejection_reason" =>
                                $reason,

                            "rejected_at" =>
                                new MongoDB\BSON\UTCDateTime(),

                            "rejected_by" =>
                                $adminId
                        ]
                    ]
                );


            if (
                $rejectUpdate->getModifiedCount()
                !== 1
            ) {

                depositResponse(
                    false,
                    "Deposit was already processed.",
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
                                "reference" =>
                                    (string)(
                                        $deposit["reference"]
                                        ??
                                        ""
                                    )
                            ],
                            [
                                "deposit_id" =>
                                    $depositObjectId
                            ]
                        ]
                    ],
                    [
                        "\$set" => [
                            "status" => "rejected",

                            "updated_at" =>
                                new MongoDB\BSON\UTCDateTime()
                        ]
                    ]
                );

            } catch (Throwable $transactionError) {

                error_log(
                    "Deposit rejection transaction error: " .
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
                        "deposit_rejected",

                    "admin_id" =>
                        $adminId,

                    "user_id" =>
                        $userObjectId,

                    "deposit_id" =>
                        $depositObjectId,

                    "reason" =>
                        $reason,

                    "created_at" =>
                        new MongoDB\BSON\UTCDateTime()
                ]);

            } catch (Throwable $auditError) {

                error_log(
                    "Deposit rejection audit error: " .
                    $auditError->getMessage()
                );
            }


            depositResponse(
                true,
                "Deposit rejected successfully.",
                [
                    "deposit_id" =>
                        $depositId
                ]
            );
        }


    } catch (MongoDB\Driver\Exception\Exception $e) {

        error_log(
            "Admin deposits POST MongoDB error: " .
            $e->getMessage()
        );

        depositResponse(
            false,
            "Database error while processing deposit.",
            [],
            500
        );

    } catch (Throwable $e) {

        error_log(
            "Admin deposits POST error: " .
            $e->getMessage()
        );

        depositResponse(
            false,
            "Unable to process deposit.",
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

depositResponse(
    false,
    "Method not allowed.",
    [],
    405
);

?>