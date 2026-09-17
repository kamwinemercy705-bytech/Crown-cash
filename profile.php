<?php

session_start();

header("Content-Type: application/json");
header("Access-Control-Allow-Origin: https://crown-cash.vercel.app");
header("Access-Control-Allow-Credentials: true");
header("Access-Control-Allow-Methods: GET, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");

if ($_SERVER["REQUEST_METHOD"] === "OPTIONS") {
    http_response_code(204);
    exit;
}


/*
|--------------------------------------------------------------------------
| CHECK LOGIN
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
        "message" => "Please login first."
    ]);

    exit;
}


/*
|--------------------------------------------------------------------------
| LOAD MONGODB CONFIGURATION
|--------------------------------------------------------------------------
*/

require_once __DIR__ . "/config.php";

try {

    /*
    |--------------------------------------------------------------------------
    | FIND USER
    |--------------------------------------------------------------------------
    */

    $userId = new MongoDB\BSON\ObjectId($_SESSION["user_id"]);

    $user = $users->findOne([
        "_id" => $userId
    ]);


    if (!$user) {

        http_response_code(404);

        echo json_encode([
            "success" => false,
            "message" => "User account was not found."
        ]);

        exit;
    }


    /*
    |--------------------------------------------------------------------------
    | SPLIT FULL NAME
    |--------------------------------------------------------------------------
    */

    $fullName = trim((string)($user["full_name"] ?? ""));

    $nameParts = preg_split(
        "/\s+/",
        $fullName,
        -1,
        PREG_SPLIT_NO_EMPTY
    );

    $firstName = $nameParts[0] ?? "";
    $lastName = "";

    if (count($nameParts) > 1) {
        $lastName = implode(
            " ",
            array_slice($nameParts, 1)
        );
    }


    /*
    |--------------------------------------------------------------------------
    | ACCOUNT DATA
    |--------------------------------------------------------------------------
    */

    $balance = $user["balance"] ?? 0;

    if ($balance instanceof MongoDB\BSON\Decimal128) {
        $balance = (float)$balance->__toString();
    } else {
        $balance = (float)$balance;
    }


    /*
    |--------------------------------------------------------------------------
    | CREATED DATE
    |--------------------------------------------------------------------------
    */

    $createdAt = "";

    if (
        isset($user["created_at"]) &&
        $user["created_at"] instanceof MongoDB\BSON\UTCDateTime
    ) {

        $createdAt = $user["created_at"]
            ->toDateTime()
            ->format("Y-m-d");

    }


    /*
    |--------------------------------------------------------------------------
    | RETURN USER PROFILE
    |--------------------------------------------------------------------------
    */

    echo json_encode([

        "success" => true,

        "user" => [

            "first_name" =>
                $firstName,

            "last_name" =>
                $lastName,

            "full_name" =>
                $fullName,

            "email" =>
                (string)($user["email"] ?? ""),

            "phone" =>
                (string)($user["phone"] ?? ""),

            "referral_code" =>
                (string)($user["referral_code"] ?? ""),

            "balance" =>
                $balance,

            "status" =>
                (string)($user["status"] ?? "active"),

            "account_type" =>
                (string)($user["account_type"] ?? "user"),

            "created_at" =>
                $createdAt
        ]

    ]);

} catch (MongoDB\Driver\Exception\Exception $e) {

    http_response_code(500);

    echo json_encode([
        "success" => false,
        "message" => "Database error."
    ]);

} catch (Exception $e) {

    http_response_code(500);

    echo json_encode([
        "success" => false,
        "message" => "Unable to load profile."
    ]);
}
?>



            

        