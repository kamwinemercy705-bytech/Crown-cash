<?php

/*
|--------------------------------------------------------------------------
| CROWN CASH — ADMIN TRANSACTIONS API
|--------------------------------------------------------------------------
|
| GET:
|   Returns transaction history for the administrator.
|
| IMPORTANT:
|   - Admin authorization is checked on the SERVER.
|   - Normal users cannot access transaction history through this endpoint.
|   - Uses the existing MongoDB "transactions" collection.
|   - User information is loaded from the existing "users" collection.
|   - This endpoint is READ-ONLY.
|
|--------------------------------------------------------------------------
*/


/*
|--------------------------------------------------------------------------
| CORS
|--------------------------------------------------------------------------
*/

header(
    "Access-Control-Allow-Origin: https://crown-cash.vercel.app"
);

header(
    "Access-Control-Allow-Methods: GET, OPTIONS"
);

header(
    "Access-Control-Allow-Headers: Content-Type"
);

header(
    "Access-Control-Allow-Credentials: true"
);

header(
    "Content-Type: application/json; charset=UTF-8"
);


/*
|--------------------------------------------------------------------------
| CACHE CONTROL
|--------------------------------------------------------------------------
*/

header(
    "Cache-Control: no-store, no-cache, must-revalidate, max-age=0"
);

header(
    "Pragma: no-cache"
);


/*
|--------------------------------------------------------------------------
| CORS OPTIONS
|--------------------------------------------------------------------------
*/

if (
    $_SERVER["REQUEST_METHOD"] === "OPTIONS"
) {

    http_response_code(204);

    exit;
}


/*
|--------------------------------------------------------------------------
| ONLY GET ALLOWED
|--------------------------------------------------------------------------
*/

if (
    $_SERVER["REQUEST_METHOD"] !== "GET"
) {

    http_response_code(405);

    echo json_encode([
        "success" => false,
        "message" => "Method not allowed."
    ]);

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
| ADMIN AUTHORIZATION
|--------------------------------------------------------------------------
|
| We NEVER trust:
|
|   localStorage
|   JavaScript
|   URL parameters
|   frontend role information
|
| The administrator must be authenticated through the
| server-side PHP session and must have:
|
|     role: "admin"
|
|--------------------------------------------------------------------------
*/

function requireAdmin(
    MongoDB\Collection $users
): array {

    /*
    |--------------------------------------------------------------------------
    | CHECK LOGIN
    |--------------------------------------------------------------------------
    */

    if (
        empty($_SESSION["logged_in"]) ||
        empty($_SESSION["user_id"])
    ) {

        sendResponse(401, [
            "success" => false,
            "message" => "Please login first."
        ]);
    }


    /*
    |--------------------------------------------------------------------------
    | CONVERT USER ID
    |--------------------------------------------------------------------------
    */

    try {

        $adminId =
            new MongoDB\BSON\ObjectId(
                (string)$_SESSION["user_id"]
            );

    } catch (Throwable $e) {

        sendResponse(401, [
            "success" => false,
            "message" => "Invalid user session."
        ]);
    }


    /*
    |--------------------------------------------------------------------------
    | FIND ADMIN ACCOUNT
    |--------------------------------------------------------------------------
    */

    try {

        $admin =
            $users->findOne([
                "_id" => $adminId
            ]);

    } catch (Throwable $e) {

        error_log(
            "CROWN CASH ADMIN TRANSACTIONS AUTH ERROR: " .
            $e->getMessage()
        );

        sendResponse(500, [
            "success" => false,
            "message" => "Unable to verify administrator account."
        ]);
    }


    /*
    |--------------------------------------------------------------------------
    | ADMIN NOT FOUND
    |--------------------------------------------------------------------------
    */

    if (!$admin) {

        sendResponse(401, [
            "success" => false,
            "message" => "Admin account was not found."
        ]);
    }


    /*
    |--------------------------------------------------------------------------
    | CHECK ROLE
    |--------------------------------------------------------------------------
    */

    $role =
        strtolower(
            trim(
                (string)(
                    $admin["role"] ?? ""
                )
            )
        );


    if ($role !== "admin") {

        sendResponse(403, [
            "success" => false,
            "message" =>
                "Access denied. Administrator permission is required."
        ]);
    }


    /*
    |--------------------------------------------------------------------------
    | RETURN ADMIN INFORMATION
    |--------------------------------------------------------------------------
    */

    return [

        "id" =>
            $adminId,

        "email" =>
            (string)(
                $admin["email"] ?? ""
            ),

        "firstName" =>
            (string)(
                $admin["firstName"] ?? ""
            ),

        "lastName" =>
            (string)(
                $admin["lastName"] ?? ""
            )

    ];
}


/*
|--------------------------------------------------------------------------
| VERIFY ADMIN
|--------------------------------------------------------------------------
*/

$admin =
    requireAdmin($users);


/*
|--------------------------------------------------------------------------
| LOAD TRANSACTIONS
|--------------------------------------------------------------------------
*/

try {

    /*
    |--------------------------------------------------------------------------
    | LIMIT
    |--------------------------------------------------------------------------
    |
    | We limit the initial response to 500 records.
    |
    | Pagination on the frontend can safely work with this result.
    |
    |--------------------------------------------------------------------------
    */

    $limit = 500;


    /*
    |--------------------------------------------------------------------------
    | TRANSACTION QUERY
    |--------------------------------------------------------------------------
    |
    | We intentionally do not restrict the "type" here.
    |
    | This allows the admin transaction page to display:
    |
    |   deposits
    |   withdrawals
    |   investments
    |   returns
    |   bonuses
    |   referrals
    |   other system transactions
    |
    | already stored in the collection.
    |
    |--------------------------------------------------------------------------
    */

    $cursor =
        $transactions->find(
            [],
            [
                "sort" => [
                    "created_at" => -1
                ],

                "limit" =>
                    $limit
            ]
        );


    /*
    |--------------------------------------------------------------------------
    | RESULT ARRAY
    |--------------------------------------------------------------------------
    */

    $transactionList = [];


    /*
    |--------------------------------------------------------------------------
    | USER CACHE
    |--------------------------------------------------------------------------
    |
    | Avoid querying the users collection repeatedly
    | for the same user.
    |
    |--------------------------------------------------------------------------
    */

    $userCache = [];


    /*
    |--------------------------------------------------------------------------
    | LOOP THROUGH TRANSACTIONS
    |--------------------------------------------------------------------------
    */

    foreach ($cursor as $transaction) {

        /*
        |--------------------------------------------------------------------------
        | TRANSACTION ID
        |--------------------------------------------------------------------------
        */

        $transactionId = "";


        if (
            isset($transaction["_id"])
        ) {

            $transactionId =
                (string)$transaction["_id"];

        }


        /*
        |--------------------------------------------------------------------------
        | USER INFORMATION
        |--------------------------------------------------------------------------
        */

        $userId = "";

        $userName =
            "Unknown User";

        $userEmail = "";

        $userPhone = "";


        /*
        |--------------------------------------------------------------------------
        | USER ID
        |--------------------------------------------------------------------------
        |
        | Crown Cash transactions normally store user_id
        | as MongoDB ObjectId.
        |
        | We also safely handle string IDs.
        |
        |--------------------------------------------------------------------------
        */

        if (
            isset($transaction["user_id"])
        ) {

            if (
                $transaction["user_id"]
                instanceof MongoDB\BSON\ObjectId
            ) {

                $transactionUserId =
                    $transaction["user_id"];

                $userId =
                    (string)$transactionUserId;

            } else {

                $userId =
                    (string)(
                        $transaction["user_id"]
                    );

                $transactionUserId = null;

                try {

                    $transactionUserId =
                        new MongoDB\BSON\ObjectId(
                            $userId
                        );

                } catch (Throwable $e) {

                    $transactionUserId = null;

                }

            }


            /*
            |--------------------------------------------------------------------------
            | LOAD USER
            |--------------------------------------------------------------------------
            */

            if (
                $transactionUserId
                instanceof MongoDB\BSON\ObjectId
            ) {

                $userKey =
                    (string)$transactionUserId;


                if (
                    !isset(
                        $userCache[$userKey]
                    )
                ) {

                    try {

                        $userCache[$userKey] =
                            $users->findOne([
                                "_id" =>
                                    $transactionUserId
                            ]);

                    } catch (Throwable $e) {

                        $userCache[$userKey] =
                            null;

                    }

                }


                $user =
                    $userCache[$userKey];


                /*
                |--------------------------------------------------------------------------
                | BUILD USER NAME
                |--------------------------------------------------------------------------
                */

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


                    $combinedName =
                        trim(
                            $firstName .
                            " " .
                            $lastName
                        );


                    if (
                        $combinedName !== ""
                    ) {

                        $userName =
                            $combinedName;

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

        }


        /*
        |--------------------------------------------------------------------------
        | TRANSACTION TYPE
        |--------------------------------------------------------------------------
        */

        $type =
            strtolower(
                trim(
                    (string)(
                        $transaction["type"] ?? ""
                    )
                )
            );


        /*
        |--------------------------------------------------------------------------
        | TYPE FALLBACK
        |--------------------------------------------------------------------------
        |
        | Some older transactions may not have "type".
        |
        | We identify common transaction records using
        | available fields.
        |
        |--------------------------------------------------------------------------
        */

        if ($type === "") {

            $method =
                strtoupper(
                    trim(
                        (string)(
                            $transaction["method"] ?? ""
                        )
                    )
                );


            if (
                isset(
                    $transaction["payout_sent"]
                )
            ) {

                $type =
                    "withdrawal";

            } elseif (
                in_array(
                    $method,
                    [
                        "MTN",
                        "AIRTEL"
                    ],
                    true
                )
            ) {

                /*
                |--------------------------------------------------------------------------
                | Without an explicit type we cannot always
                | determine whether MTN/Airtel was a deposit
                | or withdrawal.
                |
                | Prefer the payout fields when available.
                |--------------------------------------------------------------------------
                */

                if (
                    isset(
                        $transaction["balance_reserved"]
                    )
                ) {

                    $type =
                        "withdrawal";

                } else {

                    $type =
                        "deposit";

                }

            } else {

                $type =
                    "other";

            }

        }


        /*
        |--------------------------------------------------------------------------
        | AMOUNT
        |--------------------------------------------------------------------------
        */

        $amount =
            (float)(
                $transaction["amount"] ?? 0
            );


        /*
        |--------------------------------------------------------------------------
        | CURRENCY
        |--------------------------------------------------------------------------
        */

        $currency =
            strtoupper(
                trim(
                    (string)(
                        $transaction["currency"]
                        ?? "UGX"
                    )
                )
            );


        /*
        |--------------------------------------------------------------------------
        | STATUS
        |--------------------------------------------------------------------------
        */

        $status =
            strtolower(
                trim(
                    (string)(
                        $transaction["status"]
                        ?? "unknown"
                    )
                )
            );


        /*
        |--------------------------------------------------------------------------
        | METHOD
        |--------------------------------------------------------------------------
        */

        $method =
            strtoupper(
                trim(
                    (string)(
                        $transaction["method"]
                        ?? ""
                    )
                )
            );


        /*
        |--------------------------------------------------------------------------
        | REFERENCE
        |--------------------------------------------------------------------------
        */

        $reference =
            (string)(
                $transaction["reference"]
                ?? ""
            );


        /*
        |--------------------------------------------------------------------------
        | DESCRIPTION
        |--------------------------------------------------------------------------
        */

        $description =
            (string)(
                $transaction["description"]
                ??
                $transaction["note"]
                ??
                $transaction["message"]
                ??
                ""
            );


        /*
        |--------------------------------------------------------------------------
        | CREATED DATE
        |--------------------------------------------------------------------------
        */

        $createdAt = null;


        if (
            isset(
                $transaction["created_at"]
            )
        ) {

            if (
                $transaction["created_at"]
                instanceof MongoDB\BSON\UTCDateTime
            ) {

                $createdAt =
                    $transaction["created_at"]
                        ->toDateTime()
                        ->format(DATE_ATOM);

            } else {

                $createdAt =
                    (string)(
                        $transaction["created_at"]
                    );

            }

        }


        /*
        |--------------------------------------------------------------------------
        | UPDATED DATE
        |--------------------------------------------------------------------------
        */

        $updatedAt = null;


        if (
            isset(
                $transaction["updated_at"]
            )
        ) {

            if (
                $transaction["updated_at"]
                instanceof MongoDB\BSON\UTCDateTime
            ) {

                $updatedAt =
                    $transaction["updated_at"]
                        ->toDateTime()
                        ->format(DATE_ATOM);

            } else {

                $updatedAt =
                    (string)(
                        $transaction["updated_at"]
                    );

            }

        }


        /*
        |--------------------------------------------------------------------------
        | ADMIN ACTION INFORMATION
        |--------------------------------------------------------------------------
        */

        $adminId = "";


        if (
            isset(
                $transaction["admin_id"]
            )
        ) {

            if (
                $transaction["admin_id"]
                instanceof MongoDB\BSON\ObjectId
            ) {

                $adminId =
                    (string)(
                        $transaction["admin_id"]
                    );

            } else {

                $adminId =
                    (string)(
                        $transaction["admin_id"]
                    );

            }

        }


        $adminEmail =
            (string)(
                $transaction["admin_email"]
                ?? ""
            );


        $adminActionAt = null;


        if (
            isset(
                $transaction["admin_action_at"]
            )
        ) {

            if (
                $transaction["admin_action_at"]
                instanceof MongoDB\BSON\UTCDateTime
            ) {

                $adminActionAt =
                    $transaction["admin_action_at"]
                        ->toDateTime()
                        ->format(DATE_ATOM);

            } else {

                $adminActionAt =
                    (string)(
                        $transaction["admin_action_at"]
                    );

            }

        }


        /*
        |--------------------------------------------------------------------------
        | EXTRA TRANSACTION FLAGS
        |--------------------------------------------------------------------------
        */

        $balanceReserved =
            (bool)(
                $transaction["balance_reserved"]
                ?? false
            );


        $balanceDeducted =
            (bool)(
                $transaction["balance_deducted"]
                ?? false
            );


        $balanceRestored =
            (bool)(
                $transaction["balance_restored"]
                ?? false
            );


        $payoutSent =
            (bool)(
                $transaction["payout_sent"]
                ?? false
            );


        $adminApproved =
            (bool)(
                $transaction["admin_approved"]
                ?? false
            );


        $adminRejected =
            (bool)(
                $transaction["admin_rejected"]
                ?? false
            );


        /*
        |--------------------------------------------------------------------------
        | ACCOUNT / PAYMENT DETAILS
        |--------------------------------------------------------------------------
        */

        $account =
            (string)(
                $transaction["account"]
                ??
                $transaction["phone"]
                ??
                ""
            );


        /*
        |--------------------------------------------------------------------------
        | BUILD RESPONSE
        |--------------------------------------------------------------------------
        */

        $transactionList[] = [

            "id" =>
                $transactionId,

            "reference" =>
                $reference,

            "user_id" =>
                $userId,

            "user_name" =>
                $userName,

            "user_email" =>
                $userEmail,

            "user_phone" =>
                $userPhone,

            "amount" =>
                $amount,

            "currency" =>
                $currency,

            "type" =>
                $type,

            "status" =>
                $status,

            "method" =>
                $method,

            "account" =>
                $account,

            "description" =>
                $description,

            "balance_reserved" =>
                $balanceReserved,

            "balance_deducted" =>
                $balanceDeducted,

            "balance_restored" =>
                $balanceRestored,

            "payout_sent" =>
                $payoutSent,

            "admin_approved" =>
                $adminApproved,

            "admin_rejected" =>
                $adminRejected,

            "admin_id" =>
                $adminId,

            "admin_email" =>
                $adminEmail,

            "admin_action_at" =>
                $adminActionAt,

            "created_at" =>
                $createdAt,

            "updated_at" =>
                $updatedAt

        ];

    }


    /*
    |--------------------------------------------------------------------------
    | RESPONSE
    |--------------------------------------------------------------------------
    */

    sendResponse(200, [

        "success" =>
            true,

        "message" =>
            "Transactions loaded successfully.",

        "transactions" =>
            $transactionList,

        "count" =>
            count($transactionList),

        "limit" =>
            $limit

    ]);

} catch (Throwable $e) {

    /*
    |--------------------------------------------------------------------------
    | LOG SERVER ERROR
    |--------------------------------------------------------------------------
    */

    error_log(
        "CROWN CASH ADMIN TRANSACTIONS GET ERROR: " .
        $e->getMessage()
    );


    /*
    |--------------------------------------------------------------------------
    | SAFE CLIENT RESPONSE
    |--------------------------------------------------------------------------
    */

    sendResponse(500, [

        "success" =>
            false,

        "message" =>
            "Unable to load transactions."

    ]);

}

?>