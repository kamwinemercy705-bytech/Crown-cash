<?php

header("Access-Control-Allow-Origin: https://crown-cash.vercel.app");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");
header("Access-Control-Allow-Credentials: true");
header("Content-Type: application/json; charset=UTF-8");

if ($_SERVER["REQUEST_METHOD"] === "OPTIONS") {
    http_response_code(204);
    exit;
}

session_set_cookie_params([
    "lifetime" => 0,
    "path" => "/",
    "domain" => "",
    "secure" => true,
    "httponly" => true,
    "samesite" => "None"
]);

session_start();

require_once __DIR__ . "/config.php";


/*
|--------------------------------------------------------------------------
| Only POST is allowed
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


/*
|--------------------------------------------------------------------------
| Read request
|--------------------------------------------------------------------------
*/

try {

    $rawData = file_get_contents("php://input");

    $data = json_decode($rawData, true);

    if (!is_array($data)) {

        http_response_code(400);

        echo json_encode([
            "success" => false,
            "message" => "Invalid investment data."
        ]);

        exit;
    }


    $plan = trim($data["plan"] ?? "");

    $amount = (float)($data["amount"] ?? 0);


    /*
    |--------------------------------------------------------------------------
    | Investment plan minimums
    |--------------------------------------------------------------------------
    */

    $planMinimums = [

        "Starter Plan" => 10000,

        "Standard Plan" => 15000,

        "Advanced Plan" => 25000

    ];


    /*
    |--------------------------------------------------------------------------
    | Check plan
    |--------------------------------------------------------------------------
    */

    if (!array_key_exists($plan, $planMinimums)) {

        http_response_code(400);

        echo json_encode([
            "success" => false,
            "message" => "Invalid investment plan."
        ]);

        exit;
    }


    $minimumAmount = $planMinimums[$plan];


    /*
    |--------------------------------------------------------------------------
    | Amount must be a whole UGX amount
    |--------------------------------------------------------------------------
    */

    if ($amount <= 0 || floor($amount) != $amount) {

        http_response_code(400);

        echo json_encode([
            "success" => false,
            "message" => "Investment amount must be a valid whole UGX amount."
        ]);

        exit;
    }


    /*
    |--------------------------------------------------------------------------
    | Check minimum amount for selected plan
    |--------------------------------------------------------------------------
    */

    if ($amount < $minimumAmount) {

        http_response_code(400);

        echo json_encode([
            "success" => false,
            "message" =>
                $plan .
                " requires a minimum investment of UGX " .
                number_format($minimumAmount)
        ]);

        exit;
    }


    /*
    |--------------------------------------------------------------------------
    | Convert session user ID to MongoDB ObjectId
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
    | Find user
    |--------------------------------------------------------------------------
    */

    $user = $users->findOne([
        "_id" => $userId
    ]);


    if (!$user) {

        http_response_code(404);

        echo json_encode([
            "success" => false,
            "message" => "User account not found."
        ]);

        exit;
    }


    /*
    |--------------------------------------------------------------------------
    | Check account status
    |--------------------------------------------------------------------------
    */

    if (($user["status"] ?? "active") !== "active") {

        http_response_code(403);

        echo json_encode([
            "success" => false,
            "message" => "Your account is not active."
        ]);

        exit;
    }


    /*
    |--------------------------------------------------------------------------
    | Current balance
    |--------------------------------------------------------------------------
    */

    $currentBalance = (float)($user["balance"] ?? 0);


    /*
    |--------------------------------------------------------------------------
    | TEST MODE
    |
    | The current Crown Cash investment flow is still a test/demo flow.
    | Therefore this version DOES NOT deduct the user's balance.
    |--------------------------------------------------------------------------
    */

    $investment = [

        "user_id" => $userId,

        "plan" => $plan,

        "amount" => $amount,

        "minimum_amount" => $minimumAmount,

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
    | Save investment
    |--------------------------------------------------------------------------
    */

    $result = $investments->insertOne(
        $investment
    );


    /*
    |--------------------------------------------------------------------------
    | Return success
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

            "minimum_amount" =>
                $minimumAmount,

            "currency" =>
                "UGX",

            "status" =>
                "active",

            "duration_days" =>
                30

        ],

        "user" => [

            "balance" =>
                $currentBalance

        ]

    ]);

    exit;


} catch (Throwable $e) {

    error_log(
        "CROWN CASH CREATE INVESTMENT ERROR: " .
        $e->getMessage()
    );

    http_response_code(500);

    echo json_encode([

        "success" => false,

        "message" =>
            "Unable to create investment."

    ]);

    exit;
}

?>