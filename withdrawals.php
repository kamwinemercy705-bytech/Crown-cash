<?php

/*
|--------------------------------------------------------------------------
| Crown Cash — Withdrawal History API
|--------------------------------------------------------------------------
*/

require_once __DIR__ . "/config.php";

/*
|--------------------------------------------------------------------------
| Session configuration
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
| CORS
|--------------------------------------------------------------------------
*/

header("Access-Control-Allow-Origin: https://crown-cash.vercel.app");
header("Access-Control-Allow-Credentials: true");
header("Access-Control-Allow-Methods: GET, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");
header("Content-Type: application/json; charset=UTF-8");

/*
|--------------------------------------------------------------------------
| Handle OPTIONS request
|--------------------------------------------------------------------------
*/

if ($_SERVER["REQUEST_METHOD"] === "OPTIONS") {

    http_response_code(204);

    exit;
}

/*
|--------------------------------------------------------------------------
| Only GET is allowed
|--------------------------------------------------------------------------
*/

if ($_SERVER["REQUEST_METHOD"] !== "GET") {

    http_response_code(405);

    echo json_encode([
        "success" => false,
        "message" => "Method not allowed."
    ]);

    exit;
}

/*
|--------------------------------------------------------------------------
| Check login
|--------------------------------------------------------------------------
*/

if (
    empty($_SESSION["logged_in"]) ||
    empty($_SESSION["user_id"])
) {

    http_response_code(401);

    echo json_encode([
        "success" => false,
        "message" => "You must be logged in."
    ]);

    exit;
}

/*
|--------------------------------------------------------------------------
| Get user ID
|--------------------------------------------------------------------------
*/

try {

    $userId = new MongoDB\BSON\ObjectId(
        (string) $_SESSION["user_id"]
    );

} catch (Throwable $e) {

    http_response_code(400);

    echo json_encode([
        "success" => false,
        "message" => "Invalid user session."
    ]);

    exit;
}

/*
|--------------------------------------------------------------------------
| Get withdrawal history
|--------------------------------------------------------------------------
*/

try {

    /*
    |--------------------------------------------------------------------------
    | Find withdrawals belonging only to this user
    |--------------------------------------------------------------------------
    */

    $cursor = $withdrawals->find(
        [
            "user_id" => $userId
        ],
        [
            "sort" => [
                "created_at" => -1
            ],
            "limit" => 20
        ]
    );

    $withdrawalList = [];

    foreach ($cursor as $withdrawal) {

        /*
        |--------------------------------------------------------------------------
        | Withdrawal ID
        |--------------------------------------------------------------------------
        */

        $id = isset($withdrawal["_id"])
            ? (string) $withdrawal["_id"]
            : "";


        /*
        |--------------------------------------------------------------------------
        | Amount
        |--------------------------------------------------------------------------
        */

        $amount = $withdrawal["amount"] ?? 0;

        if ($amount instanceof MongoDB\BSON\Decimal128) {

            $amount = (float) $amount->toString();

        } else {

            $amount = (float) $amount;

        }


        /*
        |--------------------------------------------------------------------------
        | Payment method
        |--------------------------------------------------------------------------
        */

        $method =
            $withdrawal["payment_method"]
            ?? $withdrawal["method"]
            ?? "";


        $method = strtolower(
            trim((string) $method)
        );


        /*
        |--------------------------------------------------------------------------
        | Phone/account
        |--------------------------------------------------------------------------
        */

        $phone =
            $withdrawal["phone"]
            ?? $withdrawal["account"]
            ?? "";


        $phone = (string) $phone;


        /*
        |--------------------------------------------------------------------------
        | Status
        |--------------------------------------------------------------------------
        */

        $status =
            $withdrawal["status"]
            ?? "pending";


        $status = strtolower(
            trim((string) $status)
        );


        /*
        |--------------------------------------------------------------------------
        | Created date
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
                    ->format(
                        DateTimeInterface::ATOM
                    );
        }


        /*
        |--------------------------------------------------------------------------
        | Add withdrawal to response
        |--------------------------------------------------------------------------
        */

        $withdrawalList[] = [

            "id" => $id,

            "amount" => $amount,

            "payment_method" => $method,

            "phone" => $phone,

            "status" => $status,

            "created_at" => $createdAt

        ];
    }


    /*
    |--------------------------------------------------------------------------
    | Send response
    |--------------------------------------------------------------------------
    */

    echo json_encode([

        "success" => true,

        "withdrawals" => $withdrawalList

    ]);

} catch (Throwable $e) {

    error_log(
        "CROWN CASH WITHDRAWAL HISTORY ERROR: "
        . $e->getMessage()
    );

    http_response_code(500);

    echo json_encode([

        "success" => false,

        "message" =>
            "Unable to load withdrawal history."

    ]);
}

?>