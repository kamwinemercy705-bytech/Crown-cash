<?php

/*
|--------------------------------------------------------------------------
| Crown Cash — Admin Session Diagnostic
|--------------------------------------------------------------------------
*/

header("Access-Control-Allow-Origin: https://crown-cash.vercel.app");
header("Access-Control-Allow-Credentials: true");
header("Content-Type: application/json; charset=UTF-8");


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
| CHECK LOGIN SESSION
|--------------------------------------------------------------------------
*/

if (
    empty($_SESSION["logged_in"]) ||
    empty($_SESSION["user_id"])
) {

    echo json_encode([
        "success" => false,
        "message" => "No active login session.",

        "session" => [
            "logged_in" =>
                $_SESSION["logged_in"] ?? false,

            "user_id" =>
                $_SESSION["user_id"] ?? null,

            "user_email" =>
                $_SESSION["user_email"] ?? null,

            "role" =>
                $_SESSION["role"] ?? null
        ]
    ]);

    exit;
}


/*
|--------------------------------------------------------------------------
| CONVERT SESSION USER ID
|--------------------------------------------------------------------------
*/

try {

    $userId = new MongoDB\BSON\ObjectId(
        (string) $_SESSION["user_id"]
    );

} catch (Throwable $e) {

    echo json_encode([
        "success" => false,
        "message" => "Session contains an invalid user ID."
    ]);

    exit;
}


/*
|--------------------------------------------------------------------------
| FIND USER IN CROWNCASH USERS
|--------------------------------------------------------------------------
*/

$user = $users->findOne([
    "_id" => $userId
]);


if (!$user) {

    echo json_encode([
        "success" => false,
        "message" =>
            "The session user was not found in Crown Cash users."
    ]);

    exit;
}


/*
|--------------------------------------------------------------------------
| RETURN SAFE DIAGNOSTIC INFORMATION
|--------------------------------------------------------------------------
*/

echo json_encode([

    "success" => true,

    "message" =>
        "Admin session diagnostic completed.",

    "session" => [

        "logged_in" =>
            $_SESSION["logged_in"] ?? false,

        "user_id" =>
            $_SESSION["user_id"] ?? null,

        "user_email" =>
            $_SESSION["user_email"] ?? null,

        "session_role" =>
            $_SESSION["role"] ?? null

    ],

    "database_user" => [

        "id" =>
            (string) $user["_id"],

        "email" =>
            $user["email"] ?? "",

        "firstName" =>
            $user["firstName"] ?? "",

        "lastName" =>
            $user["lastName"] ?? "",

        "role" =>
            $user["role"] ?? "NOT SET",

        "status" =>
            $user["status"] ?? "NOT SET"

    ]

]);

exit;

?>