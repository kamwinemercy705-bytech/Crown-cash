<?php

/*
|--------------------------------------------------------------------------
| Crown Cash — Login API
|--------------------------------------------------------------------------
*/

header(
    "Access-Control-Allow-Origin: https://crown-cash.vercel.app"
);

header(
    "Access-Control-Allow-Methods: POST, OPTIONS"
);

header(
    "Access-Control-Allow-Headers: Content-Type"
);

header(
    "Access-Control-Allow-Credentials: true"
);

header(
    "Content-Type: application/json; charset=UTF-8"
);


/*
|--------------------------------------------------------------------------
| CORS PREFLIGHT
|--------------------------------------------------------------------------
*/

if (
    $_SERVER["REQUEST_METHOD"] === "OPTIONS"
) {

    http_response_code(204);

    exit;

}


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
| METHOD CHECK
|--------------------------------------------------------------------------
*/

if (
    $_SERVER["REQUEST_METHOD"] !== "POST"
) {

    http_response_code(405);

    echo json_encode([
        "success" => false,
        "message" => "Method not allowed."
    ]);

    exit;

}


/*
|--------------------------------------------------------------------------
| LOGIN
|--------------------------------------------------------------------------
*/

try {

    $rawData =
        file_get_contents(
            "php://input"
        );


    $data =
        json_decode(
            $rawData,
            true
        );


    if (!is_array($data)) {

        http_response_code(400);

        echo json_encode([
            "success" => false,
            "message" => "Invalid login data."
        ]);

        exit;

    }


    /*
    |--------------------------------------------------------------------------
    | GET DATA
    |--------------------------------------------------------------------------
    */

    $email =
        strtolower(
            trim(
                $data["email"] ?? ""
            )
        );

    $password =
        $data["password"] ?? "";


    /*
    |--------------------------------------------------------------------------
    | REQUIRED FIELDS
    |--------------------------------------------------------------------------
    */

    if (
        $email === "" ||
        $password === ""
    ) {

        http_response_code(400);

        echo json_encode([
            "success" => false,
            "message" =>
                "Email and password are required."
        ]);

        exit;

    }


    /*
    |--------------------------------------------------------------------------
    | EMAIL VALIDATION
    |--------------------------------------------------------------------------
    */

    if (
        !filter_var(
            $email,
            FILTER_VALIDATE_EMAIL
        )
    ) {

        http_response_code(400);

        echo json_encode([
            "success" => false,
            "message" =>
                "Invalid email address."
        ]);

        exit;

    }


    /*
    |--------------------------------------------------------------------------
    | FIND USER
    |--------------------------------------------------------------------------
    */

    $user =
        $users->findOne([
            "email" => $email
        ]);


    if (!$user) {

        http_response_code(401);

        echo json_encode([
            "success" => false,
            "message" =>
                "Invalid email or password."
        ]);

        exit;

    }


    /*
    |--------------------------------------------------------------------------
    | ACCOUNT STATUS
    |--------------------------------------------------------------------------
    */

    if (
        ($user["status"] ?? "active")
        !== "active"
    ) {

        http_response_code(403);

        echo json_encode([
            "success" => false,
            "message" =>
                "This account is not active."
        ]);

        exit;

    }


    /*
    |--------------------------------------------------------------------------
    | PASSWORD
    |--------------------------------------------------------------------------
    */

    if (
        !isset(
            $user["password"]
        ) ||
        !password_verify(
            $password,
            $user["password"]
        )
    ) {

        http_response_code(401);

        echo json_encode([
            "success" => false,
            "message" =>
                "Invalid email or password."
        ]);

        exit;

    }


    /*
    |--------------------------------------------------------------------------
    | REGENERATE SESSION
    |--------------------------------------------------------------------------
    */

    session_regenerate_id(true);


    $_SESSION["logged_in"] = true;

    $_SESSION["user_id"] =
        (string) $user["_id"];

    $_SESSION["user_email"] =
        $user["email"];


    /*
    |--------------------------------------------------------------------------
    | UPDATE LAST LOGIN
    |--------------------------------------------------------------------------
    */

    $users->updateOne(

        [
            "_id" =>
                $user["_id"]
        ],

        [
            '$set' => [
                "last_login" =>
                    new MongoDB\BSON\UTCDateTime()
            ]
        ]

    );


    /*
    |--------------------------------------------------------------------------
    | SUCCESS
    |--------------------------------------------------------------------------
    */

    echo json_encode([

        "success" => true,

        "message" =>
            "Login successful.",

        "user" => [

            "id" =>
                (string) $user["_id"],

            "firstName" =>
                $user["firstName"] ?? "",

            "lastName" =>
                $user["lastName"] ?? "",

            "email" =>
                $user["email"],

            "phone" =>
                $user["phone"] ?? "",

            "referralCode" =>
                $user["referralCode"] ?? "",

            "balance" =>
                $user["balance"] ?? 0

        ]

    ]);


} catch (Throwable $e) {


    /*
    |--------------------------------------------------------------------------
    | SERVER ERROR
    |--------------------------------------------------------------------------
    */

    error_log(
        "CROWN CASH LOGIN ERROR: " .
        $e->getMessage()
    );


    http_response_code(500);


    echo json_encode([

        "success" => false,

        "message" =>
            "Login failed. Please try again."

    ]);

}

?>