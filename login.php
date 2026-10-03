<?php

declare(strict_types=1);

/*
|--------------------------------------------------------------------------
| CROWN CASH - LOGIN API
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
| LOAD CONFIG FIRST
|--------------------------------------------------------------------------
*/

require_once __DIR__ . '/config.php';


/*
|--------------------------------------------------------------------------
| CORS
|--------------------------------------------------------------------------
*/

header(
    'Access-Control-Allow-Origin: https://crown-cash.vercel.app'
);

header(
    'Access-Control-Allow-Credentials: true'
);

header(
    'Access-Control-Allow-Methods: POST, OPTIONS'
);

header(
    'Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With'
);

header(
    'Content-Type: application/json; charset=utf-8'
);


/*
|--------------------------------------------------------------------------
| PREFLIGHT
|--------------------------------------------------------------------------
*/

if (
    ($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS'
) {
    http_response_code(204);
    exit;
}


/*
|--------------------------------------------------------------------------
| ONLY POST
|--------------------------------------------------------------------------
*/

if (
    ($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST'
) {

    jsonResponse([
        'success' => false,
        'message' => 'Method not allowed.'
    ], 405);
}


/*
|--------------------------------------------------------------------------
| START THE SAME SESSION USED BY DASHBOARD.PHP
|--------------------------------------------------------------------------
*/

startSecureSession();


/*
|--------------------------------------------------------------------------
| READ REQUEST
|--------------------------------------------------------------------------
*/

try {

    $rawInput =
        file_get_contents('php://input');


    $input =
        json_decode(
            $rawInput,
            true
        );


    if (!is_array($input)) {
        $input = $_POST;
    }


    /*
    |--------------------------------------------------------------------------
    | LOGIN EMAIL
    |--------------------------------------------------------------------------
    */

    $email =
        strtolower(
            trim(
                (string)(
                    $input['email'] ?? ''
                )
            )
        );


    /*
    |--------------------------------------------------------------------------
    | PASSWORD
    |--------------------------------------------------------------------------
    */

    $password =
        (string)(
            $input['password'] ?? ''
        );


    /*
    |--------------------------------------------------------------------------
    | VALIDATE EMAIL
    |--------------------------------------------------------------------------
    */

    if (
        $email === '' ||
        !filter_var(
            $email,
            FILTER_VALIDATE_EMAIL
        )
    ) {

        jsonResponse([
            'success' => false,
            'message' =>
                'Please enter a valid email address.'
        ], 400);
    }


    /*
    |--------------------------------------------------------------------------
    | VALIDATE PASSWORD
    |--------------------------------------------------------------------------
    */

    if ($password === '') {

        jsonResponse([
            'success' => false,
            'message' =>
                'Please enter your password.'
        ], 400);
    }


    /*
    |--------------------------------------------------------------------------
    | FIND USER
    |--------------------------------------------------------------------------
    */

    $user =
        $users->findOne([
            'email' => $email
        ]);


    /*
    |--------------------------------------------------------------------------
    | USER NOT FOUND
    |--------------------------------------------------------------------------
    */

    if (!$user) {

        jsonResponse([
            'success' => false,
            'message' =>
                'Invalid email or password.'
        ], 401);
    }


    /*
    |--------------------------------------------------------------------------
    | PASSWORD
    |--------------------------------------------------------------------------
    */

    $storedPassword =
        (string)(
            $user['password'] ??
            $user['password_hash'] ??
            ''
        );


    if (
        $storedPassword === '' ||
        !password_verify(
            $password,
            $storedPassword
        )
    ) {

        jsonResponse([
            'success' => false,
            'message' =>
                'Invalid email or password.'
        ], 401);
    }


    /*
    |--------------------------------------------------------------------------
    | ACCOUNT STATUS
    |--------------------------------------------------------------------------
    */

    $status =
        strtolower(
            trim(
                (string)(
                    $user['status'] ??
                    'active'
                )
            )
        );


    $blockedStatuses = [
        'blocked',
        'suspended',
        'disabled',
        'banned',
        'inactive'
    ];


    if (
        in_array(
            $status,
            $blockedStatuses,
            true
        )
    ) {

        jsonResponse([
            'success' => false,
            'message' =>
                'Your account is currently ' .
                $status .
                '. Please contact support.'
        ], 403);
    }


    /*
    |--------------------------------------------------------------------------
    | ROLE
    |--------------------------------------------------------------------------
    */

    $accountType =
        strtolower(
            trim(
                (string)(
                    $user['account_type'] ??
                    $user['accountType'] ??
                    ''
                )
            )
        );


    $storedRole =
        strtolower(
            trim(
                (string)(
                    $user['role'] ??
                    ''
                )
            )
        );


    if ($storedRole !== '') {

        $role =
            $storedRole;

    } elseif ($accountType !== '') {

        $role =
            $accountType;

    } else {

        $role =
            'user';
    }


    if ($accountType === '') {
        $accountType = $role;
    }


    /*
    |--------------------------------------------------------------------------
    | USER ID
    |--------------------------------------------------------------------------
    */

    $userId =
        isset($user['_id'])
            ? (string)$user['_id']
            : '';


    if ($userId === '') {

        jsonResponse([
            'success' => false,
            'message' =>
                'User account has an invalid ID.'
        ], 500);
    }


    /*
    |--------------------------------------------------------------------------
    | REGENERATE SESSION
    |--------------------------------------------------------------------------
    */

    session_regenerate_id(true);


    /*
    |--------------------------------------------------------------------------
    | CREATE LOGIN SESSION
    |--------------------------------------------------------------------------
    */

    $_SESSION['logged_in'] =
        true;

    $_SESSION['authenticated'] =
        true;

    $_SESSION['user_id'] =
        $userId;

    $_SESSION['userId'] =
        $userId;

    $_SESSION['id'] =
        $userId;

    $_SESSION['_id'] =
        $userId;

    $_SESSION['user_email'] =
        (string)(
            $user['email'] ??
            $email
        );

    $_SESSION['role'] =
        $role;

    $_SESSION['account_type'] =
        $accountType;

    $_SESSION['login_time'] =
        time();


    /*
    |--------------------------------------------------------------------------
    | SAVE SESSION
    |--------------------------------------------------------------------------
    */

    session_write_close();


    /*
    |--------------------------------------------------------------------------
    | GET USER NAME
    |--------------------------------------------------------------------------
    */

    $firstName =
        (string)(
            $user['first_name'] ??
            $user['firstName'] ??
            ''
        );


    $lastName =
        (string)(
            $user['last_name'] ??
            $user['lastName'] ??
            ''
        );


    $fullName =
        trim(
            (string)(
                $user['full_name'] ??
                $user['fullName'] ??
                ''
            )
        );


    if ($fullName === '') {

        $fullName =
            trim(
                $firstName .
                ' ' .
                $lastName
            );
    }


    if ($fullName === '') {

        $fullName =
            (string)(
                $user['name'] ??
                $user['username'] ??
                'Member'
            );
    }


    /*
    |--------------------------------------------------------------------------
    | REFERRAL CODE
    |--------------------------------------------------------------------------
    */

    $referralCode =
        (string)(
            $user['referral_code'] ??
            $user['referralCode'] ??
            ''
        );


    /*
    |--------------------------------------------------------------------------
    | LOGIN RESPONSE
    |--------------------------------------------------------------------------
    */

    jsonResponse([

        'success' =>
            true,

        'authenticated' =>
            true,

        'authorized' =>
            true,

        'message' =>
            'Login successful.',

        'user' => [

            'id' =>
                $userId,

            '_id' =>
                $userId,

            'first_name' =>
                $firstName,

            'last_name' =>
                $lastName,

            'full_name' =>
                $fullName,

            'name' =>
                $fullName,

            'email' =>
                (string)(
                    $user['email'] ??
                    $email
                ),

            'phone' =>
                (string)(
                    $user['phone'] ??
                    ''
                ),

            'referral_code' =>
                $referralCode,

            'role' =>
                $role,

            'account_type' =>
                $accountType,

            'status' =>
                $status
        ]

    ], 200);


} catch (Throwable $e) {

    error_log(
        'Crown Cash login error: ' .
        $e->getMessage()
    );


    jsonResponse([
        'success' => false,
        'message' =>
            'Unable to process login right now.'
    ], 500);
}