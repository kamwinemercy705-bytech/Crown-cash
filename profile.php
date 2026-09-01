<?php

/*
|--------------------------------------------------------------------------
| Crown Cash — Profile API
|--------------------------------------------------------------------------
*/

header("Access-Control-Allow-Origin: https://crown-cash.vercel.app");
header("Access-Control-Allow-Methods: GET, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");
header("Access-Control-Allow-Credentials: true");
header("Content-Type: application/json; charset=UTF-8");


/*
|--------------------------------------------------------------------------
| Handle CORS preflight
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
| Load MongoDB configuration
|--------------------------------------------------------------------------
*/

require_once __DIR__ . "/config.php";


/*
|--------------------------------------------------------------------------
| Only allow GET
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


try {

    /*
    |--------------------------------------------------------------------------
    | Check login session
    |--------------------------------------------------------------------------
    */

    if (
        empty($_SESSION["logged_in"]) ||
        empty($_SESSION["user_id"])
    ) {

        http_response_code(401);

        echo json_encode([
            "success" => false,
            "message" => "You are not logged in."
        ]);

        exit;
    }


    /*
    |--------------------------------------------------------------------------
    | Get user ID from session
    |--------------------------------------------------------------------------
    */

    $userId = new MongoDB\BSON\ObjectId(
        $_SESSION["user_id"]
    );


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
            "message" => "This account is not active."
        ]);

        exit;
    }


    /*
    |--------------------------------------------------------------------------
    | Prepare full name
    |--------------------------------------------------------------------------
    */

    $firstName = $user["firstName"] ?? "";
    $lastName  = $user["lastName"] ?? "";

    $fullName = trim(
        $firstName . " " . $lastName
    );


    /*
    |--------------------------------------------------------------------------
    | Return profile information
    |--------------------------------------------------------------------------
    */

    echo json_encode([

        "success" => true,

        "user" => [

            "id" =>
                (string) $user["_id"],

            "fullName" =>
                $fullName,

            "firstName" =>
                $firstName,

            "lastName" =>
                $lastName,

            "email" =>
                $user["email"] ?? "",

            "phone" =>
                $user["phone"] ?? "",

            "referralCode" =>
                $user["referralCode"] ?? "",

            "balance" =>
                $user["balance"] ?? 0,

            "status" =>
                $user["status"] ?? "active"
        ]

    ]);

} catch (Throwable $e) {

    error_log(
        "CROWN CASH PROFILE ERROR: " .
        $e->getMessage()
    );

    http_response_code(500);

    echo json_encode([
        "success" => false,
        "message" => "Unable to load profile."
    ]);
}

?>