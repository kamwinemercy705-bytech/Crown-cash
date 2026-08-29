<?php

/*
|--------------------------------------------------------------------------
| Crown Cash — Registration API
|--------------------------------------------------------------------------
| Receives registration data from register.js and saves the new user
| securely in MongoDB.
|--------------------------------------------------------------------------
*/

header("Content-Type: application/json; charset=UTF-8");

require_once __DIR__ . "/config.php";


/*
|--------------------------------------------------------------------------
| Only allow POST
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


try {

    /*
    |--------------------------------------------------------------------------
    | Read JSON request
    |--------------------------------------------------------------------------
    */

    $rawData =
        file_get_contents("php://input");

    $data =
        json_decode($rawData, true);


    if (!is_array($data)) {

        http_response_code(400);

        echo json_encode([
            "success" => false,
            "message" => "Invalid registration data."
        ]);

        exit;
    }


    /*
    |--------------------------------------------------------------------------
    | Get submitted values
    |--------------------------------------------------------------------------
    */

    $firstName =
        trim($data["firstName"] ?? "");

    $lastName =
        trim($data["lastName"] ?? "");

    $phone =
        trim($data["phone"] ?? "");

    $email =
        strtolower(
            trim($data["email"] ?? "")
        );

    $password =
        $data["password"] ?? "";

    $referralCode =
        trim($data["referralCode"] ?? "");


    /*
    |--------------------------------------------------------------------------
    | Server-side validation
    |--------------------------------------------------------------------------
    */

    if (strlen($firstName) < 2) {

        throw new Exception(
            "Please enter your first name."
        );
    }


    if (strlen($lastName) < 2) {

        throw new Exception(
            "Please enter your last name."
        );
    }


    /*
    |--------------------------------------------------------------------------
    | Uganda phone validation
    |--------------------------------------------------------------------------
    */

    if (!preg_match(
        '/^(?:\+256|0)\d{9}$/',
        $phone
    )) {

        throw new Exception(
            "Enter a valid Uganda phone number."
        );
    }


    /*
    |--------------------------------------------------------------------------
    | Email validation
    |--------------------------------------------------------------------------
    */

    if (!filter_var(
        $email,
        FILTER_VALIDATE_EMAIL
    )) {

        throw new Exception(
            "Enter a valid email address."
        );
    }


    /*
    |--------------------------------------------------------------------------
    | Password validation
    |--------------------------------------------------------------------------
    */

    if (strlen($password) < 8) {

        throw new Exception(
            "Password must contain at least 8 characters."
        );
    }


    /*
    |--------------------------------------------------------------------------
    | Check existing email
    |--------------------------------------------------------------------------
    */

    $existingEmail =
        $users->findOne([
            "email" => $email
        ]);


    if ($existingEmail) {

        throw new Exception(
            "An account with this email already exists."
        );
    }


    /*
    |--------------------------------------------------------------------------
    | Check existing phone
    |--------------------------------------------------------------------------
    */

    $existingPhone =
        $users->findOne([
            "phone" => $phone
        ]);


    if ($existingPhone) {

        throw new Exception(
            "An account with this phone number already exists."
        );
    }


    /*
    |--------------------------------------------------------------------------
    | Generate unique referral code
    |--------------------------------------------------------------------------
    */

    $userReferralCode =
        "CC" .
        strtoupper(
            bin2hex(
                random_bytes(4)
            )
        );


    /*
    |--------------------------------------------------------------------------
    | Hash password
    |--------------------------------------------------------------------------
    */

    $passwordHash =
        password_hash(
            $password,
            PASSWORD_DEFAULT
        );


    /*
    |--------------------------------------------------------------------------
    | Create MongoDB user document
    |--------------------------------------------------------------------------
    */

    $user = [

        "firstName" =>
            $firstName,

        "lastName" =>
            $lastName,

        "phone" =>
            $phone,

        "email" =>
            $email,

        "password" =>
            $passwordHash,

        "referralCode" =>
            $userReferralCode,

        "referredBy" =>
            $referralCode !== ""
                ? $referralCode
                : null,

        "balance" =>
            0,

        "status" =>
            "active",

        "createdAt" =>
            new MongoDB\BSON\UTCDateTime()

    ];


    /*
    |--------------------------------------------------------------------------
    | Insert user into MongoDB
    |--------------------------------------------------------------------------
    */

    $result =
        $users->insertOne($user);


    if ($result->getInsertedCount() !== 1) {

        throw new Exception(
            "Account could not be created."
        );
    }


    /*
    |--------------------------------------------------------------------------
    | Success response
    |--------------------------------------------------------------------------
    */

    echo json_encode([

        "success" =>
            true,

        "message" =>
            "Account created successfully.",

        "referralCode" =>
            $userReferralCode

    ]);

}


catch (Exception $e) {

    http_response_code(400);

    echo json_encode([

        "success" =>
            false,

        "message" =>
            $e->getMessage()

    ]);

}

?>