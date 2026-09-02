<?php

/*
|--------------------------------------------------------------------------
| Crown Cash — Create Investment API
| TEST VERSION
|--------------------------------------------------------------------------
*/

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

try {

    /*
    |--------------------------------------------------------------------------
    | Read JSON sent by investments.js
    |--------------------------------------------------------------------------
    */

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


    /*
    |--------------------------------------------------------------------------
    | Get plan and amount
    |--------------------------------------------------------------------------
    */

    $plan = trim($data["plan"] ?? "");

    $amount = (float)($data["amount"] ?? 0);


    /*
    |--------------------------------------------------------------------------
    | Validate plan
    |--------------------------------------------------------------------------
    */

    $allowedPlans = [
        "Starter Plan",
        "Standard Plan",
        "Advanced Plan"
    ];

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
    | TEST AMOUNT
    |--------------------------------------------------------------------------
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
    | Convert session user ID
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
            "message" => "User not found."
        ]);

        exit;
    }


    /*
    |--------------------------------------------------------------------------
    | TEST INVESTMENT
    |--------------------------------------------------------------------------
    |
    | We do NOT deduct the user's balance during this test.
    |
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
    | Save investment
    |--------------------------------------------------------------------------
    */

    $result = $investments->insertOne(
        $investment
    );


    /*
    |--------------------------------------------------------------------------
    | Response
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
}

?>