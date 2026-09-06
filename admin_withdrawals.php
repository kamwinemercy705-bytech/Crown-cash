<?php

/*
|--------------------------------------------------------------------------
| Crown Cash — Admin Withdrawal Management API
|--------------------------------------------------------------------------
|
| GET:
|   Returns withdrawal requests for the admin dashboard.
|
| POST:
|   Approves or rejects a pending withdrawal.
|
| IMPORTANT:
|   - Admin authorization is checked on the SERVER.
|   - Normal users cannot approve withdrawals.
|   - Rejecting a withdrawal restores the reserved balance.
|   - Approving a withdrawal keeps the amount deducted.
|   - This endpoint does NOT automatically send Mobile Money.
|
|--------------------------------------------------------------------------
*/

header("Access-Control-Allow-Origin: https://crown-cash.vercel.app");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");
header("Access-Control-Allow-Credentials: true");
header("Content-Type: application/json; charset=UTF-8");

header("Cache-Control: no-store, no-cache, must-revalidate, max-age=0");
header("Pragma: no-cache");


/*
|--------------------------------------------------------------------------
| CORS OPTIONS
|--------------------------------------------------------------------------
*/

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
    "domain" => "",
    "secure" => true,
    "httponly" => true,
    "samesite" => "None"
]);

session_start();


/*
|--------------------------------------------------------------------------
| DATABASE
|--------------------------------------------------------------------------
*/

require_once __DIR__ . "/config.php";


/*
|--------------------------------------------------------------------------
| JSON RESPONSE HELPER
|--------------------------------------------------------------------------
*/

function sendResponse(
    int $statusCode,
    array $data
): void {

    http_response_code($statusCode);

    echo json_encode(
        $data,
        JSON_UNESCAPED_SLASHES
    );

    exit;
}


/*
|--------------------------------------------------------------------------
| CHECK ADMIN
|--------------------------------------------------------------------------
|
| We do NOT trust localStorage or JavaScript for admin security.
|
| The logged-in user's MongoDB record must contain:
|
|     role: "admin"
|
|--------------------------------------------------------------------------
*/

function requireAdmin(
    MongoDB\Collection $users
): array {

    if (
        empty($_SESSION["logged_in"]) ||
        empty($_SESSION["user_id"])
    ) {

        sendResponse(401, [
            "success" => false,
            "message" => "Please login first."
        ]);
    }


    try {

        $adminId =
            new MongoDB\BSON\ObjectId(
                $_SESSION["user_id"]
            );

    } catch (Throwable $e) {

        sendResponse(401, [
            "success" => false,
            "message" => "Invalid user session."
        ]);
    }


    $admin =
        $users->findOne([
            "_id" => $adminId
        ]);


    if (!$admin) {

        sendResponse(401, [
            "success" => false,
            "message" => "Admin account was not found."
        ]);
    }


    $role =
        strtolower(
            trim(
                (string)($admin["role"] ?? "")
            )
        );


    if ($role !== "admin") {

        sendResponse(403, [
            "success" => false,
            "message" => "Access denied. Administrator permission is required."
        ]);
    }


    return [
        "id" => $adminId,
        "email" => $admin["email"] ?? "",
        "firstName" => $admin["firstName"] ?? "",
        "lastName" => $admin["lastName"] ?? ""
    ];
}


/*
|--------------------------------------------------------------------------
| ADMIN AUTHORIZATION
|--------------------------------------------------------------------------
*/

$admin = requireAdmin($users);


/*
|--------------------------------------------------------------------------
| GET WITHDRAWALS
|--------------------------------------------------------------------------
*/

if ($_SERVER["REQUEST_METHOD"] === "GET") {

    try {

        /*
        |--------------------------------------------------------------------------
        | Find withdrawal transactions
        |--------------------------------------------------------------------------
        |
        | The current create_withdrawal.php records have:
        |
        |   payout_sent
        |   balance_reserved
        |   admin_approved
        |
        | Some older records may not yet have:
        |
        |   type = withdrawal
        |
        | Therefore we support both formats here.
        |
        */

        $withdrawalFilter = [
            '$or' => [

                [
                    "type" => "withdrawal"
                ],

                [
                    "method" => [
                        '$in' => [
                            "MTN",
                            "AIRTEL"
                        ]
                    ],
                    "payout_sent" => [
                        '$exists' => true
                    ]
                ]

            ]
        ];


        $cursor =
            $transactions->find(
                $withdrawalFilter,
                [
                    "sort" => [
                        "created_at" => -1
                    ],
                    "limit" => 500
                ]
            );


        $withdrawals = [];

        /*
        |--------------------------------------------------------------------------
        | User cache
        |--------------------------------------------------------------------------
        |
        | Prevents repeatedly requesting the same user.
        |
        */

        $userCache = [];


        foreach ($cursor as $withdrawal) {

            /*
            |--------------------------------------------------------------------------
            | Withdrawal ID
            |--------------------------------------------------------------------------
            */

            $withdrawalId =
                isset($withdrawal["_id"])
                    ? (string)$withdrawal["_id"]
                    : "";


            /*
            |--------------------------------------------------------------------------
            | USER INFORMATION
            |--------------------------------------------------------------------------
            */

            $userId = null;

            $userName = "Unknown User";

            $userEmail = "";

            $userPhone = "";


            if (
                isset($withdrawal["user_id"]) &&
                $withdrawal["user_id"] instanceof MongoDB\BSON\ObjectId
            ) {

                $userId =
                    $withdrawal["user_id"];


                $userKey =
                    (string)$userId;


                if (!isset($userCache[$userKey])) {

                    $userCache[$userKey] =
                        $users->findOne([
                            "_id" => $userId
                        ]);
                }


                $user =
                    $userCache[$userKey];


                if ($user) {

                    $firstName =
                        trim(
                            (string)(
                                $user["firstName"] ?? ""
                            )
                        );


                    $lastName =
                        trim(
                            (string)(
                                $user["lastName"] ?? ""
                            )
                        );


                    $userName =
                        trim(
                            $firstName .
                            " " .
                            $lastName
                        );


                    if ($userName === "") {

                        $userName =
                            "Unknown User";
                    }


                    $userEmail =
                        (string)(
                            $user["email"] ?? ""
                        );


                    $userPhone =
                        (string)(
                            $user["phone"] ?? ""
                        );
                }
            }


            /*
            |--------------------------------------------------------------------------
            | DATE
            |--------------------------------------------------------------------------
            */

            $createdAt = null;


            if (
                isset($withdrawal["created_at"]) &&
                $withdrawal["created_at"]
                    instanceof MongoDB\BSON\UTCDateTime
            ) {

                $createdAt =
                    $withdrawal["created_at"]
                        ->toDateTime()
                        ->format(DATE_ATOM);
            }


            $updatedAt = null;


            if (
                isset($withdrawal["updated_at"]) &&
                $withdrawal["updated_at"]
                    instanceof MongoDB\BSON\UTCDateTime
            ) {

                $updatedAt =
                    $withdrawal["updated_at"]
                        ->toDateTime()
                        ->format(DATE_ATOM);
            }


            /*
            |--------------------------------------------------------------------------
            | RETURN WITHDRAWAL
            |--------------------------------------------------------------------------
            */

            $withdrawals[] = [

                "id" =>
                    $withdrawalId,

                "reference" =>
                    (string)(
                        $withdrawal["reference"] ?? ""
                    ),

                "user_id" =>
                    $userId
                        ? (string)$userId
                        : "",

                "user_name" =>
                    $userName,

                "user_email" =>
                    $userEmail,

                "user_phone" =>
                    $userPhone,

                "amount" =>
                    (float)(
                        $withdrawal["amount"] ?? 0
                    ),

                "currency" =>
                    (string)(
                        $withdrawal["currency"] ?? "UGX"
                    ),

                "method" =>
                    strtoupper(
                        (string)(
                            $withdrawal["method"] ?? ""
                        )
                    ),

                "account" =>
                    (string)(
                        $withdrawal["account"] ?? ""
                    ),

                "status" =>
                    strtolower(
                        (string)(
                            $withdrawal["status"] ?? "pending"
                        )
                    ),

                "balance_reserved" =>
                    (bool)(
                        $withdrawal["balance_reserved"] ?? false
                    ),

                "balance_deducted" =>
                    (bool)(
                        $withdrawal["balance_deducted"] ?? false
                    ),

                "balance_restored" =>
                    (bool)(
                        $withdrawal["balance_restored"] ?? false
                    ),

                "payout_sent" =>
                    (bool)(
                        $withdrawal["payout_sent"] ?? false
                    ),

                "admin_approved" =>
                    (bool)(
                        $withdrawal["admin_approved"] ?? false
                    ),

                "created_at" =>
                    $createdAt,

                "updated_at" =>
                    $updatedAt

            ];
        }


        /*
        |--------------------------------------------------------------------------
        | SUCCESS
        |--------------------------------------------------------------------------
        */

        sendResponse(200, [

            "success" => true,

            "message" =>
                "Withdrawals loaded successfully.",

            "withdrawals" =>
                $withdrawals,

            "count" =>
                count($withdrawals)

        ]);

    } catch (Throwable $e) {

        error_log(
            "CROWN CASH ADMIN WITHDRAWAL GET ERROR: " .
            $e->getMessage()
        );


        sendResponse(500, [

            "success" => false,

            "message" =>
                "Unable to load withdrawals."

        ]);
    }
}


/*
|--------------------------------------------------------------------------
| POST — APPROVE OR REJECT
|--------------------------------------------------------------------------
*/

if ($_SERVER["REQUEST_METHOD"] === "POST") {

    try {

        /*
        |--------------------------------------------------------------------------
        | READ REQUEST
        |--------------------------------------------------------------------------
        */

        $rawData =
            file_get_contents(
                "php://input"
            );


        $data =
            json_decode(
                $rawData,
                true
            );


        if (!is_array($data)) {

            sendResponse(400, [

                "success" => false,

                "message" =>
                    "Invalid request data."

            ]);
        }


        $withdrawalId =
            trim(
                (string)(
                    $data["withdrawalId"] ?? ""
                )
            );


        $action =
            strtolower(
                trim(
                    (string)(
                        $data["action"] ?? ""
                    )
                )
            );


        /*
        |--------------------------------------------------------------------------
        | VALIDATE ACTION
        |--------------------------------------------------------------------------
        */

        if ($withdrawalId === "") {

            sendResponse(400, [

                "success" => false,

                "message" =>
                    "Withdrawal ID is required."

            ]);
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

            sendResponse(400, [

                "success" => false,

                "message" =>
                    "Invalid withdrawal action."

            ]);
        }


        /*
        |--------------------------------------------------------------------------
        | BUILD WITHDRAWAL ID FILTER
        |--------------------------------------------------------------------------
        */

        $idFilter = null;


        try {

            $idFilter = [
                "_id" =>
                    new MongoDB\BSON\ObjectId(
                        $withdrawalId
                    )
            ];

        } catch (Throwable $e) {

            /*
            |--------------------------------------------------------------------------
            | If it is not an ObjectId, treat it as a reference.
            |--------------------------------------------------------------------------
            */

            $idFilter = [
                "reference" =>
                    $withdrawalId
            ];
        }


        /*
        |--------------------------------------------------------------------------
        | START MONGODB TRANSACTION
        |--------------------------------------------------------------------------
        |
        | This is especially important when rejecting a withdrawal.
        |
        | We must:
        |
        |   1. Restore the user's balance.
        |   2. Mark withdrawal as rejected.
        |
        | Both operations must succeed together.
        |
        */

        $session =
            $client->startSession();


        try {

            $session->startTransaction();


            /*
            |--------------------------------------------------------------------------
            | FIND PENDING WITHDRAWAL
            |--------------------------------------------------------------------------
            */

            $withdrawal =
                $transactions->findOne(
                    [
                        '$and' => [

                            $idFilter,

                            [
                                '$or' => [

                                    [
                                        "type" =>
                                            "withdrawal"
                                    ],

                                    [
                                        "payout_sent" => [
                                            '$exists' => true
                                        ]
                                    ]

                                ]
                            ],

                            [
                                "status" =>
                                    "pending"
                            ],

                            [
                                "balance_reserved" =>
                                    true
                            ]

                        ]
                    ],
                    [
                        "session" =>
                            $session
                    ]
                );


            if (!$withdrawal) {

                $session->abortTransaction();


                sendResponse(409, [

                    "success" => false,

                    "message" =>
                        "This withdrawal is no longer pending, has already been processed, or could not be found."

                ]);
            }


            /*
            |--------------------------------------------------------------------------
            | WITHDRAWAL AMOUNT
            |--------------------------------------------------------------------------
            */

            $amount =
                (float)(
                    $withdrawal["amount"] ?? 0
                );


            if ($amount <= 0) {

                $session->abortTransaction();


                sendResponse(400, [

                    "success" => false,

                    "message" =>
                        "Invalid withdrawal amount."

                ]);
            }


            /*
            |--------------------------------------------------------------------------
            | USER ID
            |--------------------------------------------------------------------------
            */

            if (
                !isset($withdrawal["user_id"]) ||
                !(
                    $withdrawal["user_id"]
                    instanceof MongoDB\BSON\ObjectId
                )
            ) {

                $session->abortTransaction();


                sendResponse(400, [

                    "success" => false,

                    "message" =>
                        "Withdrawal has an invalid user account."

                ]);
            }


            $withdrawalUserId =
                $withdrawal["user_id"];


            /*
            |--------------------------------------------------------------------------
            | CURRENT TIME
            |--------------------------------------------------------------------------
            */

            $now =
                new MongoDB\BSON\UTCDateTime();


            /*
            |--------------------------------------------------------------------------
            | APPROVE
            |--------------------------------------------------------------------------
            */

            if ($action === "approve") {

                $updateResult =
                    $transactions->updateOne(

                        [
                            "_id" =>
                                $withdrawal["_id"],

                            "status" =>
                                "pending",

                            "balance_reserved" =>
                                true

                        ],

                        [
                            '$set' => [

                                "status" =>
                                    "approved",

                                "admin_approved" =>
                                    true,

                                "admin_rejected" =>
                                    false,

                                "balance_reserved" =>
                                    false,

                                "balance_deducted" =>
                                    true,

                                "balance_restored" =>
                                    false,

                                "admin_id" =>
                                    $admin["id"],

                                "admin_email" =>
                                    $admin["email"],

                                "admin_action_at" =>
                                    $now,

                                "updated_at" =>
                                    $now

                            ]
                        ],

                        [
                            "session" =>
                                $session
                        ]
                    );


                if (
                    $updateResult->getModifiedCount()
                    !== 1
                ) {

                    $session->abortTransaction();


                    sendResponse(409, [

                        "success" => false,

                        "message" =>
                            "The withdrawal could not be approved because it was already processed."

                    ]);
                }


                $session->commitTransaction();


                sendResponse(200, [

                    "success" => true,

                    "message" =>
                        "Withdrawal approved successfully. The payout still needs to be sent and verified through the authorized payment provider.",

                    "withdrawal" => [

                        "id" =>
                            (string)(
                                $withdrawal["_id"]
                            ),

                        "reference" =>
                            (string)(
                                $withdrawal["reference"]
                                ?? ""
                            ),

                        "amount" =>
                            $amount,

                        "status" =>
                            "approved"

                    ]

                ]);
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

                $user =
                    $users->findOne(
                        [
                            "_id" =>
                                $withdrawalUserId
                        ],
                        [
                            "session" =>
                                $session
                        ]
                    );


                if (!$user) {

                    $session->abortTransaction();


                    sendResponse(404, [

                        "success" => false,

                        "message" =>
                            "The user account connected to this withdrawal was not found."

                    ]);
                }


                /*
                |--------------------------------------------------------------------------
                | Restore balance
                |--------------------------------------------------------------------------
                */

                $balanceRestore =
                    $users->updateOne(

                        [
                            "_id" =>
                                $withdrawalUserId
                        ],

                        [
                            '$inc' => [

                                "balance" =>
                                    $amount

                            ],

                            '$set' => [

                                "updated_at" =>
                                    $now

                            ]

                        ],

                        [
                            "session" =>
                                $session
                        ]
                    );


                if (
                    $balanceRestore->getModifiedCount()
                    !== 1
                ) {

                    $session->abortTransaction();


                    sendResponse(500, [

                        "success" => false,

                        "message" =>
                            "The user's balance could not be restored."

                    ]);
                }


                /*
                |--------------------------------------------------------------------------
                | Mark withdrawal rejected
                |--------------------------------------------------------------------------
                */

                $updateResult =
                    $transactions->updateOne(

                        [
                            "_id" =>
                                $withdrawal["_id"],

                            "status" =>
                                "pending",

                            "balance_reserved" =>
                                true

                        ],

                        [
                            '$set' => [

                                "status" =>
                                    "rejected",

                                "admin_approved" =>
                                    false,

                                "admin_rejected" =>
                                    true,

                                "balance_reserved" =>
                                    false,

                                "balance_deducted" =>
                                    false,

                                "balance_restored" =>
                                    true,

                                "payout_sent" =>
                                    false,

                                "admin_id" =>
                                    $admin["id"],

                                "admin_email" =>
                                    $admin["email"],

                                "admin_action_at" =>
                                    $now,

                                "updated_at" =>
                                    $now

                            ]
                        ],

                        [
                            "session" =>
                                $session
                        ]
                    );


                if (
                    $updateResult->getModifiedCount()
                    !== 1
                ) {

                    $session->abortTransaction();


                    sendResponse(409, [

                        "success" => false,

                        "message" =>
                            "The withdrawal could not be rejected because it was already processed."

                    ]);
                }


                /*
                |--------------------------------------------------------------------------
                | COMMIT
                |--------------------------------------------------------------------------
                */

                $session->commitTransaction();


                sendResponse(200, [

                    "success" => true,

                    "message" =>
                        "Withdrawal rejected successfully and the amount has been returned to the user's available balance.",

                    "withdrawal" => [

                        "id" =>
                            (string)(
                                $withdrawal["_id"]
                            ),

                        "reference" =>
                            (string)(
                                $withdrawal["reference"]
                                ?? ""
                            ),

                        "amount" =>
                            $amount,

                        "status" =>
                            "rejected",

                        "balance_restored" =>
                            true

                    ]

                ]);
            }


            /*
            |--------------------------------------------------------------------------
            | SAFETY FALLBACK
            |--------------------------------------------------------------------------
            */

            $session->abortTransaction();


            sendResponse(400, [

                "success" => false,

                "message" =>
                    "Unknown withdrawal action."

            ]);

        } catch (Throwable $transactionError) {

            try {

                $session->abortTransaction();

            } catch (Throwable $abortError) {

                error_log(
                    "CROWN CASH TRANSACTION ABORT ERROR: " .
                    $abortError->getMessage()
                );
            }


            throw $transactionError;
        }

    } catch (Throwable $e) {

        error_log(
            "CROWN CASH ADMIN WITHDRAWAL POST ERROR: " .
            $e->getMessage()
        );


        sendResponse(500, [

            "success" => false,

            "message" =>
                "Unable to process the withdrawal request."

        ]);
    }
}


/*
|--------------------------------------------------------------------------
| METHOD NOT ALLOWED
|--------------------------------------------------------------------------
*/

sendResponse(405, [

    "success" => false,

    "message" =>
        "Method not allowed."

]);

?>