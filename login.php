<?php

/*
|--------------------------------------------------------------------------
| Crown Cash Login API
|--------------------------------------------------------------------------
| Frontend:
| https://crown-cash.vercel.app
|
| Backend:
| https://crown-cash1.onrender.com
|--------------------------------------------------------------------------
*/


/*
|--------------------------------------------------------------------------
| CROSS-SITE SESSION COOKIE
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
| HEADERS
|--------------------------------------------------------------------------
*/

header("Content-Type: application/json");

header(
    "Access-Control-Allow-Origin: https://crown-cash.vercel.app"
);

header(
    "Access-Control-Allow-Credentials: true"
);

header(
    "Access-Control-Allow-Methods: POST, OPTIONS"
);

header(
    "Access-Control-Allow-Headers: Content-Type"
);


/*
|--------------------------------------------------------------------------
| HANDLE PREFLIGHT REQUEST
|--------------------------------------------------------------------------
*/

if ($_SERVER["REQUEST_METHOD"] === "OPTIONS") {

    http_response_code(204);

    exit;
}


/*
|--------------------------------------------------------------------------
| ONLY POST ALLOWED
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
| DATABASE
|--------------------------------------------------------------------------
*/

require_once __DIR__ . "/config.php";


/*
|--------------------------------------------------------------------------
| READ JSON REQUEST
|--------------------------------------------------------------------------
*/

$input = json_decode(
    file_get_contents("php://input"),
    true
);


if (!is_array($input)) {

    http_response_code(400);

    echo json_encode([
        "success" => false,
        "message" => "Invalid request."
    ]);

    exit;
}


/*
|--------------------------------------------------------------------------
| GET LOGIN DETAILS
|--------------------------------------------------------------------------
*/

$email = trim(
    strtolower(
        $input["email"] ?? ""
    )
);

$password = $input["password"] ?? "";


/*
|--------------------------------------------------------------------------
| VALIDATE INPUT
|--------------------------------------------------------------------------
*/

if ($email === "" || $password === "") {

    http_response_code(400);

    echo json_encode([
        "success" => false,
        "message" => "Email and password are required."
    ]);

    exit;
}


/*
|--------------------------------------------------------------------------
| FIND USER
|--------------------------------------------------------------------------
*/

try {

    $user = $users->findOne([
        "email" => $email
    ]);


    /*
    |--------------------------------------------------------------------------
    | USER NOT FOUND
    |--------------------------------------------------------------------------
    */

    if (!$user) {

        http_response_code(401);

        echo json_encode([
            "success" => false,
            "message" => "Invalid email or password."
        ]);

        exit;
    }


    /*
    |--------------------------------------------------------------------------
    | CHECK PASSWORD
    |--------------------------------------------------------------------------
    */

    $storedPassword =
        (string)($user["password"] ?? "");


    if (
        $storedPassword === "" ||
        !password_verify(
            $password,
            $storedPassword
        )
    ) {

        http_response_code(401);

        echo json_encode([
            "success" => false,
            "message" => "Invalid email or password."
        ]);

        exit;
    }


    /*
    |--------------------------------------------------------------------------
    | CHECK ACCOUNT STATUS
    |--------------------------------------------------------------------------
    */

    $status =
        strtolower(
            (string)($user["status"] ?? "active")
        );


    if (
        $status === "blocked" ||
        $status === "suspended" ||
        $status === "disabled"
    ) {

        http_response_code(403);

        echo json_encode([
            "success" => false,
            "message" => "Your account is currently unavailable."
        ]);

        exit;
    }


    /*
    |--------------------------------------------------------------------------
    | REGENERATE SESSION ID
    |--------------------------------------------------------------------------
    */

    session_regenerate_id(true);


    /*
    |--------------------------------------------------------------------------
    | CREATE LOGIN SESSION
    |--------------------------------------------------------------------------
    */

    $_SESSION["logged_in"] = true;

    $_SESSION["user_id"] =
        (string)$user["_id"];

    $_SESSION["user_email"] =
        (string)($user["email"] ?? "");


    /*
    |--------------------------------------------------------------------------
    | RETURN SUCCESS
    |--------------------------------------------------------------------------
    */

    echo json_encode([

        "success" => true,

        "message" => "Login successful.",

        "user" => [

            "id" =>
                (string)$user["_id"],

            "email" =>
                (string)($user["email"] ?? ""),

            "full_name" =>
                (string)($user["full_name"] ?? "")

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
        "message" => "Unable to login."
    ]);
}

?>