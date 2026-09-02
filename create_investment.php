<?php

/*
|--------------------------------------------------------------------------
| Crown Cash — Create Investment API
| TEST VERSION
|--------------------------------------------------------------------------
| This endpoint is currently for testing only.
| Test investment amount: UGX 10,000
|--------------------------------------------------------------------------
*/


/*
|--------------------------------------------------------------------------
| CORS
|--------------------------------------------------------------------------
*/

header("Access-Control-Allow-Origin: https://crown-cash.vercel.app");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");
header("Access-Control-Allow-Credentials: true");
header("Content-Type: application/json; charset=UTF-8");


/*
|--------------------------------------------------------------------------
| Handle browser preflight request
|--------------------------------------------------------------------------
*/

if ($_SERVER["REQUEST_METHOD"] === "OPTIONS") {

    http_response_code(204);

    exit;
}


/*
|--------------------------------------------------------------------------
| Session configuration
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
| Database connection
|--------------------------------------------------------------------------
*/

require_once __DIR__ . "/config.php";


/*
|--------------------------------------------------------------------------
| Only POST requests are allowed
|--------------------------------------------------------------------------
*/

if ($_SERVER["REQUEST_METHOD"] !== "POST") {

    http_response_code(405);

    echo json_encode([
        "success" => false,
        "message" => "Method not allowed."
    ]);

    exit;
}


/*
|--------------------------------------------------------------------------
| Check whether the user is logged in
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
    | Read JSON sent by investments.js
    |--------------------------------------------------------------------------
    */

    $rawData = file_get_contents("php://input");

    $data = json_decode($rawData, true);


    /*
    |--------------------------------------------------------------------------
    | Check received data
    |--------------------------------------------------------------------------
    */

    if (!is_array($data)) {

        http_response_code(400);

        echo json_encode([
            "success" => false,
            "message" => "Invalid investment data."
        ]);

        exit;
    }


    /*
    |--------------------------------------------------------------------------
    | Get investment plan
    |--------------------------------------------------------------------------
    */

    $plan = trim($data["plan"] ?? "");


    /*
    |--------------------------------------------------------------------------
    | Get investment amount
    |--------------------------------------------------------------------------
    */

    $amount = (float)($data["amount"] ?? 0);


    /*
    |--------------------------------------------------------------------------
    | Allowed investment plans
    |--------------------------------------------------------------------------
    */

    $allowedPlans = [
        "Starter Plan",
        "Standard Plan",
        "Advanced Plan"
    ];


    /*
    |--------------------------------------------------------------------------
    | Validate investment plan
    |--------------------------------------------------------------------------
    */

    if (!in_array($plan, $allowedPlans, true)) {

        http_response_code(400);

        echo json_encode([
            "success" => false,
            "message" => "Invalid investment plan."
        ]);

        exit;
    }


    /*
    |--------------------------------------------------------------------------
    | Validate investment amount
    |--------------------------------------------------------------------------
    |
    | For now we are using UGX 10,000 only for testing.
    |
    */

    if ($amount !== 10000.0) {

        http_response_code(400);

        echo json_encode([
            "success" => false,
            "message" => "For testing, use exactly UGX 10,000."
        ]);

        exit;
    }


    /*
    |--------------------------------------------------------------------------
    | Convert logged-in user's ID to MongoDB ObjectId
    |--------------------------------------------------------------------------
    */

    try {

        $userId = new MongoDB\BSON\ObjectId(
            $_SESSION["user_id"]
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
    | Find logged-in user
    |--------------------------------------------------------------------------
    */

    $user = $users->findOne([
        "_id" => $userId
    ]);


    /*
    |--------------------------------------------------------------------------
    | Check user exists
    |--------------------------------------------------------------------------
    */

    if (!$user) {

        http_response_code(404);

        echo json_encode([
            "success" => false,
            "message" => "User not found."
        ]);

        exit;
    }


    /*
    |--------------------------------------------------------------------------
    | Create TEST investment
    |--------------------------------------------------------------------------
    */

    $investment = [

        "user_id" => $userId,

        "plan" => $plan,

        "amount" => $amount,

        "currency" => "UGX",

        "status" => "active",

        "type" => "test",

        "duration_days" => 30,

        "created_at" =>
            new MongoDB\BSON\UTCDateTime(),

        "updated_at" =>
            new MongoDB\BSON\UTCDateTime()

    ];


    /*
    |--------------------------------------------------------------------------
    | Save investment in MongoDB
    |--------------------------------------------------------------------------
    */

    $result = $investments->insertOne(
        $investment
    );


    /*
    |--------------------------------------------------------------------------
    | Return successful response
    |--------------------------------------------------------------------------
    */

    echo json_encode([

        "success" => true,

        "message" =>
            "Test investment created successfully.",

        "investment" => [

            "id" =>
                (string)$result->getInsertedId(),

            "plan" =>
                $plan,

            "amount" =>
                $amount,

            "currency" =>
                "UGX",

            "status" =>
                "active",

            "duration_days" =>
                30

        ]

    ]);

} catch (Throwable $e) {

    /*
    |--------------------------------------------------------------------------
    | Log server error
    |--------------------------------------------------------------------------
    */

    error_log(
        "CROWN CASH CREATE INVESTMENT ERROR: " .
        $e->getMessage()
    );


    /*
    |--------------------------------------------------------------------------
    | Return error
    |--------------------------------------------------------------------------
    */

    http_response_code(500);

    echo json_encode([

        "success" => false,

        "message" =>
            "Unable to create investment."

    ]);
}

?>