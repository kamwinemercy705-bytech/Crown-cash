<?php

/*
|--------------------------------------------------------------------------
| Crown Cash — User Investments API
| Lists investments belonging to the logged-in user
|--------------------------------------------------------------------------
*/

header("Access-Control-Allow-Origin: https://crown-cash.vercel.app");
header("Access-Control-Allow-Methods: GET, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");
header("Access-Control-Allow-Credentials: true");
header("Content-Type: application/json; charset=UTF-8");


/*
|--------------------------------------------------------------------------
| CORS preflight
|--------------------------------------------------------------------------
*/

if ($_SERVER["REQUEST_METHOD"] === "OPTIONS") {
    http_response_code(204);
    exit;
}


/*
|--------------------------------------------------------------------------
| Session
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
| Load MongoDB configuration
|--------------------------------------------------------------------------
*/

require_once __DIR__ . "/config.php";


/*
|--------------------------------------------------------------------------
| Only GET
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
        "message" => "Please login first."
    ]);

    exit;
}


try {

    /*
    |--------------------------------------------------------------------------
    | Convert session user ID
    |--------------------------------------------------------------------------
    */

    $userId = new MongoDB\BSON\ObjectId(
        $_SESSION["user_id"]
    );


    /*
    |--------------------------------------------------------------------------
    | Find user's investments
    |--------------------------------------------------------------------------
    */

    $cursor = $investments->find(
        [
            "user_id" => $userId
        ],
        [
            "sort" => [
                "created_at" => -1
            ],
            "limit" => 100
        ]
    );


    $investmentList = [];


    /*
    |--------------------------------------------------------------------------
    | Build response
    |--------------------------------------------------------------------------
    */

    foreach ($cursor as $investment) {

        $investmentList[] = [

            "id" =>
                (string) $investment["_id"],

            "plan" =>
                $investment["plan"] ?? "Unknown Plan",

            "amount" =>
                (float) ($investment["amount"] ?? 0),

            "currency" =>
                $investment["currency"] ?? "UGX",

            "duration_days" =>
                (int) (
                    $investment["duration_days"]
                    ?? $investment["duration"]
                    ?? 30
                ),

            "status" =>
                $investment["status"] ?? "unknown",

            "type" =>
                $investment["type"] ?? "test",

            "created_at" =>
                isset($investment["created_at"])
                    ? $investment["created_at"]
                        ->toDateTime()
                        ->format("Y-m-d H:i:s")
                    : null
        ];
    }


    /*
    |--------------------------------------------------------------------------
    | Return investments
    |--------------------------------------------------------------------------
    */

    echo json_encode([

        "success" => true,

        "investments" =>
            $investmentList

    ]);

} catch (Throwable $e) {

    error_log(
        "CROWN CASH INVESTMENTS ERROR: " .
        $e->getMessage()
    );

    http_response_code(500);

    echo json_encode([

        "success" => false,

        "message" =>
            "Unable to load investments."

    ]);
}

?>