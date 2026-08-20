<?php

require_once "config.php";

session_start();


if ($_SERVER["REQUEST_METHOD"] !== "POST") {
    http_response_code(405);
    exit("Method not allowed.");
}


$email = strtolower(trim($_POST["email"] ?? ""));
$password = $_POST["password"] ?? "";


if ($email === "" || $password === "") {
    exit("Email and password are required.");
}


if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    exit("Invalid email address.");
}


try {

    /*
    |--------------------------------------------------------------------------
    | Find user
    |--------------------------------------------------------------------------
    */

    $user = $users->findOne([
        "email" => $email
    ]);


    if (!$user) {
        exit("Invalid email or password.");
    }


    /*
    |--------------------------------------------------------------------------
    | Check account status
    |--------------------------------------------------------------------------
    */

    if (($user["status"] ?? "active") !== "active") {
        exit("This account is not active.");
    }


    /*
    |--------------------------------------------------------------------------
    | Verify password
    |--------------------------------------------------------------------------
    */

    if (!password_verify($password, $user["password"])) {
        exit("Invalid email or password.");
    }


    /*
    |--------------------------------------------------------------------------
    | Create secure session
    |--------------------------------------------------------------------------
    */

    session_regenerate_id(true);

    $_SESSION["user_id"] =
        (string) $user["_id"];

    $_SESSION["user_email"] =
        $user["email"];

    $_SESSION["logged_in"] = true;


    /*
    |--------------------------------------------------------------------------
    | Update last login
    |--------------------------------------------------------------------------
    */

    $users->updateOne(
        [
            "_id" => $user["_id"]
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
    | Successful login
    |--------------------------------------------------------------------------
    */

    echo "LOGIN_SUCCESS";


} catch (Exception $e) {

    http_response_code(500);

    echo "Login failed.";

}

?>
