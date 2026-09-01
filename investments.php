<?php

/*
|--------------------------------------------------------------------------
| Crown Cash — Investment API
| Test/demo investment creation and listing
|--------------------------------------------------------------------------
*/

header("Access-Control-Allow-Origin: https://crown-cash.vercel.app");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
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
| Load configuration
|--------------------------------------------------------------------------
*/

require_once __DIR__ . "/config.php";


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
    | Logged-in user
    |--------------------------------------------------------------------------
    */

    $userId = new MongoDB\BSON\ObjectId(
        $_SESSION["user_id"]
    );


    /*
    |--------------------------------------------------------------------------
    | GET — List user's investments
    |--------------------------------------------------------------------------
    */

    if ($_SERVER["REQUEST_METHOD"] === "GET") {

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


        foreach ($cursor as $investment) {

            $investmentList[] = [

                "id" =>
                    (string) $investment["_id"],

                "plan" =>
                    $investment["plan"] ?? "Test Plan",

                "amount" =>
                    (float) ($investment["amount"] ?? 0),

                "duration" =>
                    $investment["duration"] ?? 30,

                "status" =>
                    $investment["status"] ?? "pending",

                "created_at" =>
                    isset($investment["created_at"])
                        ? $investment["created_at"]
                            ->toDateTime()
                            ->format("Y-m-d H:i:s")
                        : null
            ];
        }


        echo json_encode([

            "success" => true,

            "investments" =>
                $investmentList

        ]);

        exit;
    }


    /*
    |--------------------------------------------------------------------------
    | POST — Create TEST investment
    |--------------------------------------------------------------------------
    */

    if ($_SERVER["REQUEST_METHOD"] === "POST") {

        $rawData =
            file_get_contents("php://input");

        $data =
            json_decode($rawData, true);


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
        | Get test investment details
        |--------------------------------------------------------------------------
        */

        $plan =
            trim($data["plan"] ?? "");

        $amount =
            (float) ($data["amount"] ?? 0);


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
        | Validate amount
        |--------------------------------------------------------------------------
        */

        if ($amount <= 0) {

            http_response_code(400);

            echo json_encode([
                "success" => false,
                "message" => "Enter a valid test amount."
            ]);

            exit;
        }


        /*
        |--------------------------------------------------------------------------
        | Create test investment
        |--------------------------------------------------------------------------
        */

        $investment = [

            "user_id" =>
                $userId,

            "plan" =>
                $plan,

            "amount" =>
                $amount,

            "duration" =>
                30,

            "status" =>
                "test",

            "type" =>
                "demo",

            "created_at" =>
                new MongoDB\BSON\UTCDateTime(),

            "updated_at" =>
                new MongoDB\BSON\UTCDateTime()

        ];


        $result =
            $investments->insertOne($investment);


        /*
        |--------------------------------------------------------------------------
        | Successful response
        |--------------------------------------------------------------------------
        */

        echo json_encode([

            "success" => true,

            "message" =>
                "Test investment created successfully.",

            "investment" => [

                "id" =>
                    (string) $result->getInsertedId(),

                "plan" =>
                    $plan,

                "amount" =>
                    $amount,

                "duration" =>
                    30,

                "status" =>
                    "test"

            ]

        ]);

        exit;
    }


    /*
    |--------------------------------------------------------------------------
    | Unsupported method
    |--------------------------------------------------------------------------
    */

    http_response_code(405);

    echo json_encode([
        "success" => false,
        "message" => "Method not allowed."
    ]);


} catch (Throwable $e) {

    error_log(
        "CROWN CASH INVESTMENT ERROR: " .
        $e->getMessage()
    );

    http_response_code(500);

    echo json_encode([
        "success" => false,
        "message" => "Investment request failed."
    ]);
}

?>