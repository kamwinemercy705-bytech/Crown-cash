<?php
declare(strict_types=1);

/*
|--------------------------------------------------------------------------
| Crown Cash - Admin Withdrawals API
|--------------------------------------------------------------------------
|
| GET:
|   Lists customer withdrawal requests.
|
| POST:
|   Approves or rejects a pending withdrawal.
|
| IMPORTANT:
|   Approval here records the administrative decision.
|   It does NOT automatically send Mobile Money.
|
|   Actual MTN/Airtel payout should only be performed through an
|   authorized payment API after the applicable business/legal
|   requirements have been verified.
|
|--------------------------------------------------------------------------
*/

header("Content-Type: application/json; charset=UTF-8");

header(
    "Access-Control-Allow-Origin: https://crown-cash.vercel.app"
);

header("Access-Control-Allow-Credentials: true");

header(
    "Access-Control-Allow-Methods: GET, POST, OPTIONS"
);

header(
    "Access-Control-Allow-Headers: Content-Type, Authorization"
);

if ($_SERVER["REQUEST_METHOD"] === "OPTIONS") {
    http_response_code(204);
    exit;
}


/*
|--------------------------------------------------------------------------
| SESSION
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


/*
|--------------------------------------------------------------------------
| HELPERS
|--------------------------------------------------------------------------
*/

function jsonResponse(
    array $data,
    int $status = 200
): void {

    http_response_code($status);

    echo json_encode(
        $data,
        JSON_UNESCAPED_SLASHES |
        JSON_UNESCAPED_UNICODE
    );

    exit;
}


function getRequestData(): array
{
    $raw = file_get_contents("php://input");

    if (!$raw) {
        return $_POST ?? [];
    }

    $data = json_decode(
        $raw,
        true
    );

    if (is_array($data)) {
        return $data;
    }

    return $_POST ?? [];
}


function isAdmin(): bool
{
    if (
        empty($_SESSION["logged_in"]) ||
        $_SESSION["logged_in"] !== true
    ) {
        return false;
    }

    $role = strtolower(
        trim(
            (string)(
                $_SESSION["role"] ?? ""
            )
        )
    );

    $accountType = strtolower(
        trim(
            (string)(
                $_SESSION["account_type"] ?? ""
            )
        )
    );

    return (
        $role === "admin" ||
        $accountType === "admin"
    );
}


function stringValue($value): string
{
    if ($value === null) {
        return "";
    }

    if (
        $value instanceof
        \MongoDB\BSON\ObjectId
    ) {
        return (string)$value;
    }

    if (
        $value instanceof
        \MongoDB\BSON\Decimal128
    ) {
        return $value->__toString();
    }

    if (
        $value instanceof
        \MongoDB\BSON\Int64
    ) {
        return $value->__toString();
    }

    return trim((string)$value);
}


function numberValue($value): float
{
    if ($value === null) {
        return 0.0;
    }

    if (
        $value instanceof
        \MongoDB\BSON\Decimal128
    ) {
        return (float)$value->__toString();
    }

    if (
        $value instanceof
        \MongoDB\BSON\Int64
    ) {
        return (float)$value->__toString();
    }

    if (is_numeric($value)) {
        return (float)$value;
    }

    return 0.0;
}


function dateValue($value)
{
    if ($value === null) {
        return null;
    }

    if (
        $value instanceof
        \MongoDB\BSON\UTCDateTime
    ) {
        return $value
            ->toDateTime()
            ->format("c");
    }

    return stringValue($value);
}


function userFilter($userId): array
{
    $or = [];

    if (
        $userId instanceof
        \MongoDB\BSON\ObjectId
    ) {
        $or[] = [
            "_id" => $userId
        ];

        $or[] = [
            "user_id" => $userId
        ];
    }

    $id = stringValue($userId);

    if ($id !== "") {

        $or[] = [
            "_id" => $id
        ];

        $or[] = [
            "user_id" => $id
        ];

        if (
            preg_match(
                '/^[a-f0-9]{24}$/i',
                $id
            )
        ) {

            try {

                $objectId =
                    new \MongoDB\BSON\ObjectId($id);

                $or[] = [
                    "_id" => $objectId
                ];

                $or[] = [
                    "user_id" => $objectId
                ];

            } catch (Throwable $ignored) {
            }
        }
    }

    return [
        '$or' => $or
    ];
}


function findUser(
    $users,
    $userId
) {

    if (
        $userId === null ||
        $userId === ""
    ) {
        return null;
    }

    $filter = userFilter($userId);

    if (
        empty($filter["$or"])
    ) {
        return null;
    }

    return $users->findOne(
        $filter
    );
}


/*
|--------------------------------------------------------------------------
| AUTHENTICATION
|--------------------------------------------------------------------------
*/

if (!isAdmin()) {

    jsonResponse([
        "success" => false,
        "message" =>
            "Admin access required."
    ], 403);
}


/*
|--------------------------------------------------------------------------
| DATABASE
|--------------------------------------------------------------------------
*/

try {

    require_once __DIR__ . "/config.php";

} catch (Throwable $e) {

    error_log(
        "Admin withdrawals config error: " .
        $e->getMessage()
    );

    jsonResponse([
        "success" => false,
        "message" =>
            "Database configuration could not be loaded."
    ], 500);
}


if (
    !isset($withdrawals) ||
    !isset($users)
) {

    jsonResponse([
        "success" => false,
        "message" =>
            "Required database collections are not configured."
    ], 500);
}


/*
|--------------------------------------------------------------------------
| GET WITHDRAWALS
|--------------------------------------------------------------------------
*/

if (
    $_SERVER["REQUEST_METHOD"] === "GET"
) {

    try {

        $status =
            strtolower(
                trim(
                    (string)(
                        $_GET["status"] ?? "all"
                    )
                )
            );

        $filter = [];

        if (
            $status !== "" &&
            $status !== "all"
        ) {
            $filter["status"] =
                $status;
        }

        $cursor =
            $withdrawals->find(
                $filter,
                [
                    "sort" => [
                        "created_at" => -1,
                        "_id" => -1
                    ],
                    "limit" => 500
                ]
            );

        $items = [];

        foreach ($cursor as $withdrawal) {

            $withdrawalId =
                isset($withdrawal->_id)
                    ? (string)$withdrawal->_id
                    : "";


            /*
             * USER ID
             */

            $userId =
                $withdrawal->user_id
                ?? $withdrawal->user
                ?? $withdrawal->userId
                ?? $withdrawal->account_id
                ?? null;


            /*
             * USER
             */

            $user =
                findUser(
                    $users,
                    $userId
                );


            $name = "";
            $email = "";
            $phone = "";


            if ($user) {

                $firstName =
                    stringValue(
                        $user->first_name ?? ""
                    );

                $lastName =
                    stringValue(
                        $user->last_name ?? ""
                    );

                $name =
                    stringValue(
                        $user->full_name ?? ""
                    );

                if ($name === "") {

                    $name =
                        trim(
                            $firstName .
                            " " .
                            $lastName
                        );
                }

                if ($name === "") {

                    $name =
                        stringValue(
                            $user->name ?? ""
                        );
                }

                $email =
                    stringValue(
                        $user->email ?? ""
                    );

                $phone =
                    stringValue(
                        $user->phone ?? ""
                    );
            }


            /*
             * WITHDRAWAL DATA
             */

            $amount =
                numberValue(
                    $withdrawal->amount ?? 0
                );


            $method =
                strtolower(
                    stringValue(
                        $withdrawal->payment_method
                        ?? $withdrawal->method
                        ?? ""
                    )
                );


            if (
                $method === "mtn_momo"
            ) {
                $method = "mtn";
            }

            if (
                $method === "airtel_money"
            ) {
                $method = "airtel";
            }


            $account =
                stringValue(
                    $withdrawal->phone
                    ?? $withdrawal->account
                    ?? $withdrawal->account_number
                    ?? $withdrawal->mobile_number
                    ?? ""
                );


            $reference =
                stringValue(
                    $withdrawal->reference
                    ?? $withdrawal->transaction_reference
                    ?? $withdrawal->withdrawal_reference
                    ?? ""
                );


            $withdrawalStatus =
                strtolower(
                    stringValue(
                        $withdrawal->status
                        ?? "pending"
                    )
                );


            $createdAt =
                dateValue(
                    $withdrawal->created_at
                    ?? null
                );


            $updatedAt =
                dateValue(
                    $withdrawal->updated_at
                    ?? null
                );


            $approvedAt =
                dateValue(
                    $withdrawal->approved_at
                    ?? null
                );


            $rejectedAt =
                dateValue(
                    $withdrawal->rejected_at
                    ?? null
                );


            $paidAt =
                dateValue(
                    $withdrawal->paid_at
                    ?? null
                );


            $items[] = [

                "id" =>
                    $withdrawalId,

                "withdrawal_id" =>
                    $withdrawalId,

                "user_id" =>
                    stringValue(
                        $userId
                    ),

                "user" => [
                    "name" =>
                        $name,

                    "email" =>
                        $email,

                    "phone" =>
                        $phone
                ],

                "name" =>
                    $name,

                "email" =>
                    $email,

                "phone" =>
                    $phone,

                "amount" =>
                    $amount,

                "payment_method" =>
                    $method,

                "method" =>
                    $method,

                "account" =>
                    $account,

                "phone_number" =>
                    $account,

                "reference" =>
                    $reference,

                "status" =>
                    $withdrawalStatus,

                "created_at" =>
                    $createdAt,

                "updated_at" =>
                    $updatedAt,

                "approved_at" =>
                    $approvedAt,

                "rejected_at" =>
                    $rejectedAt,

                "paid_at" =>
                    $paidAt,

                "approved_by" =>
                    stringValue(
                        $withdrawal->approved_by
                        ?? ""
                    ),

                "rejected_by" =>
                    stringValue(
                        $withdrawal->rejected_by
                        ?? ""
                    )
            ];
        }


        /*
         * COUNTS
         */

        $pending =
            (int)$withdrawals
                ->countDocuments([
                    "status" => "pending"
                ]);


        $approved =
            (int)$withdrawals
                ->countDocuments([
                    "status" => "approved"
                ]);


        $rejected =
            (int)$withdrawals
                ->countDocuments([
                    "status" => "rejected"
                ]);


        $paid =
            (int)$withdrawals
                ->countDocuments([
                    "status" => "paid"
                ]);


        $totalAmount = 0.0;

        foreach ($items as $item) {

            $totalAmount +=
                (float)$item["amount"];
        }


        jsonResponse([

            "success" =>
                true,

            "counts" => [

                "pending" =>
                    $pending,

                "approved" =>
                    $approved,

                "rejected" =>
                    $rejected,

                "paid" =>
                    $paid,

                "total" =>
                    count($items)
            ],

            "total_amount" =>
                $totalAmount,

            "withdrawals" =>
                $items
        ]);

    } catch (Throwable $e) {

        error_log(
            "Admin withdrawals GET error: " .
            $e->getMessage()
        );

        jsonResponse([
            "success" => false,
            "message" =>
                "Unable to load withdrawals.",
            "error" =>
                $e->getMessage()
        ], 500);
    }
}


/*
|--------------------------------------------------------------------------
| POST ACTION
|--------------------------------------------------------------------------
*/

if (
    $_SERVER["REQUEST_METHOD"] === "POST"
) {

    $data =
        getRequestData();


    $withdrawalId =
        trim(
            (string)(
                $data["withdrawal_id"]
                ?? ""
            )
        );


    $action =
        strtolower(
            trim(
                (string)(
                    $data["action"]
                    ?? ""
                )
            )
        );


    if ($withdrawalId === "") {

        jsonResponse([
            "success" => false,
            "message" =>
                "Withdrawal ID is required."
        ], 400);
    }


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

        jsonResponse([
            "success" => false,
            "message" =>
                "Invalid withdrawal action."
        ], 400);
    }


    try {

        /*
         * OBJECT ID
         */

        try {

            $objectId =
                new \MongoDB\BSON\ObjectId(
                    $withdrawalId
                );

        } catch (Throwable $e) {

            jsonResponse([
                "success" => false,
                "message" =>
                    "Invalid withdrawal ID."
            ], 400);
        }


        /*
         * FIND WITHDRAWAL
         */

        $withdrawal =
            $withdrawals->findOne([
                "_id" =>
                    $objectId
            ]);


        if (!$withdrawal) {

            jsonResponse([
                "success" => false,
                "message" =>
                    "Withdrawal was not found."
            ], 404);
        }


        /*
         * ONLY PENDING REQUESTS
         */

        $currentStatus =
            strtolower(
                stringValue(
                    $withdrawal->status
                    ?? "pending"
                )
            );


        if (
            $currentStatus !==
            "pending"
        ) {

            jsonResponse([
                "success" => false,
                "message" =>
                    "This withdrawal has already been processed.",
                "status" =>
                    $currentStatus
            ], 409);
        }


        /*
         * USER
         */

        $userId =
            $withdrawal->user_id
            ?? $withdrawal->user
            ?? $withdrawal->userId
            ?? $withdrawal->account_id
            ?? null;


        if (
            $userId === null ||
            $userId === ""
        ) {

            jsonResponse([
                "success" => false,
                "message" =>
                    "Withdrawal is not linked to a user."
            ], 400);
        }


        $user =
            findUser(
                $users,
                $userId
            );


        if (!$user) {

            jsonResponse([
                "success" => false,
                "message" =>
                    "Withdrawal user account was not found."
            ], 404);
        }


        $adminId =
            $_SESSION["user_id"]
            ?? null;


        $now =
            new \MongoDB\BSON\UTCDateTime();


        /*
         * AMOUNT
         */

        $amount =
            numberValue(
                $withdrawal->amount
                ?? 0
            );


        if ($amount < 10000) {

            jsonResponse([
                "success" => false,
                "message" =>
                    "Invalid withdrawal amount."
            ], 400);
        }


        /*
         * REJECT
         */

        if (
            $action === "reject"
        ) {

            /*
             * IMPORTANT:
             *
             * Because the existing withdrawal.php checks the user's
             * balance but does not reserve the money, rejection does
             * not deduct anything.
             */

            $result =
                $withdrawals->findOneAndUpdate(

                    [
                        "_id" =>
                            $objectId,

                        "status" =>
                            "pending"
                    ],

                    [
                        '$set' => [

                            "status" =>
                                "rejected",

                            "rejected_at" =>
                                $now,

                            "rejected_by" =>
                                $adminId,

                            "updated_at" =>
                                $now
                        ]
                    ],

                    [
                        "returnDocument" =>
                            \MongoDB\Operation\
                            FindOneAndUpdate\
                            ::RETURN_DOCUMENT_AFTER
                    ]
                );


            if (!$result) {

                jsonResponse([
                    "success" => false,
                    "message" =>
                        "Withdrawal was already processed."
                ], 409);
            }


            /*
             * TRANSACTION
             */

            if (
                isset($transactions)
            ) {

                try {

                    $transactions->updateMany(

                        [
                            '$or' => [

                                [
                                    "withdrawal_id" =>
                                        $objectId
                                ],

                                [
                                    "withdrawal_id" =>
                                        $withdrawalId
                                ]
                            ]
                        ],

                        [
                            '$set' => [

                                "status" =>
                                    "rejected",

                                "updated_at" =>
                                    $now
                            ]
                        ]
                    );

                } catch (Throwable $ignored) {
                }
            }


            /*
             * AUDIT
             */

            if (
                isset($audit_logs)
            ) {

                try {

                    $audit_logs->insertOne([

                        "action" =>
                            "withdrawal_rejected",

                        "admin_id" =>
                            $adminId,

                        "withdrawal_id" =>
                            $objectId,

                        "user_id" =>
                            $userId,

                        "amount" =>
                            new \MongoDB\BSON\Decimal128(
                                (string)$amount
                            ),

                        "created_at" =>
                            $now
                    ]);

                } catch (Throwable $ignored) {
                }
            }


            jsonResponse([

                "success" =>
                    true,

                "message" =>
                    "Withdrawal rejected successfully.",

                "status" =>
                    "rejected"
            ]);
        }


        /*
         * APPROVE
         *
         * Approval here means the request has passed admin review.
         * It does NOT send Mobile Money.
         */

        $result =
            $withdrawals->findOneAndUpdate(

                [
                    "_id" =>
                        $objectId,

                    "status" =>
                        "pending"
                ],

                [
                    '$set' => [

                        "status" =>
                            "approved",

                        "approved_at" =>
                            $now,

                        "approved_by" =>
                            $adminId,

                        "updated_at" =>
                            $now,

                        "payout_status" =>
                            "awaiting_payout"
                    ]
                ],

                [
                    "returnDocument" =>
                        \MongoDB\Operation\
                        FindOneAndUpdate\
                        ::RETURN_DOCUMENT_AFTER
                ]
            );


        if (!$result) {

            jsonResponse([
                "success" => false,
                "message" =>
                    "Withdrawal was already processed."
            ], 409);
        }


        /*
         * TRANSACTION
         *
         * Keep the transaction pending/approved until actual payout
         * is completed by the authorized payment system.
         */

        if (
            isset($transactions)
        ) {

            try {

                $transactions->updateMany(

                    [
                        '$or' => [

                            [
                                "withdrawal_id" =>
                                    $objectId
                            ],

                            [
                                "withdrawal_id" =>
                                    $withdrawalId
                            ]
                        ]
                    ],

                    [
                        '$set' => [

                            "status" =>
                                "approved",

                            "updated_at" =>
                                $now
                        ]
                    ]
                );

            } catch (Throwable $ignored) {
            }
        }


        /*
         * AUDIT
         */

        if (
            isset($audit_logs)
        ) {

            try {

                $audit_logs->insertOne([

                    "action" =>
                        "withdrawal_approved",

                    "admin_id" =>
                        $adminId,

                    "withdrawal_id" =>
                        $objectId,

                    "user_id" =>
                        $userId,

                    "amount" =>
                        new \MongoDB\BSON\Decimal128(
                            (string)$amount
                        ),

                    "created_at" =>
                        $now
                ]);

            } catch (Throwable $ignored) {
            }
        }


        jsonResponse([

            "success" =>
                true,

            "message" =>
                "Withdrawal approved and placed in the payout queue.",

            "status" =>
                "approved",

            "payout_status" =>
                "awaiting_payout",

            "amount" =>
                $amount
        ]);
    }

    catch (Throwable $e) {

        error_log(
            "Admin withdrawals POST error: " .
            $e->getMessage()
        );

        jsonResponse([
            "success" => false,
            "message" =>
                "Unable to process withdrawal.",
            "error" =>
                $e->getMessage()
        ], 500);
    }
}


/*
|--------------------------------------------------------------------------
| METHOD NOT ALLOWED
|--------------------------------------------------------------------------
*/

jsonResponse([
    "success" => false,
    "message" =>
        "Method not allowed."
], 405);
?>