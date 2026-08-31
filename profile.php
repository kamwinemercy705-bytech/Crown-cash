<?php

/*
|--------------------------------------------------------------------------
| Crown Cash — Profile API
|--------------------------------------------------------------------------
*/

header("Access-Control-Allow-Origin: https://crown-cash.vercel.app");
header("Access-Control-Allow-Credentials: true");
header("Access-Control-Allow-Methods: GET, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");
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


/*
|--------------------------------------------------------------------------
| Start session
|--------------------------------------------------------------------------
*/

session_start();


/*
|--------------------------------------------------------------------------
| Check login session
|--------------------------------------------------------------------------
*/

if (
    !isset($_SESSION["logged_in"]) ||
    $_SESSION["logged_in"] !== true ||
    !isset($_SESSION["user_id"])
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
| Load MongoDB configuration
|--------------------------------------------------------------------------
*/

require_once __DIR__ . "/config.php";


/*
|--------------------------------------------------------------------------
| Find logged-in user
|--------------------------------------------------------------------------
*/

try {

    $userId =
        $_SESSION["user_id"];


    /*
    |--------------------------------------------------------------------------
    | Convert session ID to MongoDB ObjectId
    |--------------------------------------------------------------------------
    */

    try {

        $objectId =
            new MongoDB\BSON\ObjectId($userId);

    } catch (Throwable $e) {

        http_response_code(400);

        echo json_encode([
            "success" => false,
            "message" => "Invalid user ID."
        ]);

        exit;
    }


    /*
    |--------------------------------------------------------------------------
    | Get user from MongoDB
    |--------------------------------------------------------------------------
    */

    $user =
        $users->findOne([
            "_id" => $objectId
        ]);


    /*
    |--------------------------------------------------------------------------
    | User not found
    |--------------------------------------------------------------------------
    */

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
    | Prepare profile data
    |--------------------------------------------------------------------------
    */

    $firstName =
        $user["firstName"] ?? "";

    $lastName =
        $user["lastName"] ?? "";

    $fullName =
        trim($firstName . " " . $lastName);


    /*
    |--------------------------------------------------------------------------
    | Successful response
    |--------------------------------------------------------------------------
    */

    echo json_encode([

        "success" => true,

        "user" => [

            "id" =>
                (string) $user["_id"],

            "firstName" =>
                $firstName,

            "lastName" =>
                $lastName,

            "fullName" =>
                $fullName,

            "email" =>
                $user["email"] ?? "",

            "phone" =>
                $user["phone"] ?? "",

            "referralCode" =>
                $user["referralCode"] ?? "",

            "balance" =>
                $user["balance"] ?? 0,

            "status" =>
                $user["status"] ?? "active",

            "accountType" =>
                $user["accountType"] ?? "Standard",

            "createdAt" =>
                isset($user["createdAt"])
                    ? $user["createdAt"]
                    : null

        ]

    ]);

} catch (Throwable $e) {

    /*
    |--------------------------------------------------------------------------
    | Log error privately
    |--------------------------------------------------------------------------
    */

    error_log(
        "CROWN CASH PROFILE ERROR: " .
        $e->getMessage()
    );


    /*
    |--------------------------------------------------------------------------
    | Return safe error
    |--------------------------------------------------------------------------
    */

    http_response_code(500);

    echo json_encode([
        "success" => false,
        "message" => "Unable to load profile."
    ]);

}

?>