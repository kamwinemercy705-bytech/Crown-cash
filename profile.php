<?php

/*
|--------------------------------------------------------------------------
| CROWN CASH - PROFILE API
|--------------------------------------------------------------------------
*/

declare(strict_types=1);


/*
|--------------------------------------------------------------------------
| LOAD CONFIGURATION FIRST
|--------------------------------------------------------------------------
*/

try {

    require_once __DIR__ . '/config.php';

} catch (Throwable $e) {

    header('Content-Type: application/json; charset=utf-8');

    http_response_code(500);

    echo json_encode([
        'success' => false,
        'message' => 'Server configuration could not be loaded.'
    ]);

    exit;
}


/*
|--------------------------------------------------------------------------
| HEADERS
|--------------------------------------------------------------------------
*/

header(
    'Content-Type: application/json; charset=utf-8'
);

$allowedOrigins = [
    'https://crown-cash.vercel.app',
    'https://www.crown-cash.vercel.app'
];

$requestOrigin =
    $_SERVER['HTTP_ORIGIN'] ?? '';

if (
    $requestOrigin !== '' &&
    in_array(
        $requestOrigin,
        $allowedOrigins,
        true
    )
) {

    header(
        'Access-Control-Allow-Origin: ' .
        $requestOrigin
    );

    header(
        'Access-Control-Allow-Credentials: true'
    );

    header(
        'Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With'
    );

    header(
        'Access-Control-Allow-Methods: GET, OPTIONS'
    );

    header(
        'Vary: Origin'
    );
}


/*
|--------------------------------------------------------------------------
| OPTIONS
|--------------------------------------------------------------------------
*/

if (
    ($_SERVER['REQUEST_METHOD'] ?? '') ===
    'OPTIONS'
) {

    http_response_code(204);

    exit;
}


/*
|--------------------------------------------------------------------------
| GET ONLY
|--------------------------------------------------------------------------
*/

if (
    ($_SERVER['REQUEST_METHOD'] ?? '') !==
    'GET'
) {

    http_response_code(405);

    echo json_encode([
        'success' => false,
        'message' => 'Method not allowed.'
    ]);

    exit;
}


/*
|--------------------------------------------------------------------------
| USE THE SAME CROWN CASH SESSION
|--------------------------------------------------------------------------
*/

try {

    if (
        function_exists('startSecureSession') &&
        session_status() !== PHP_SESSION_ACTIVE
    ) {

        startSecureSession();

    } elseif (
        session_status() !== PHP_SESSION_ACTIVE
    ) {

        session_name(
            'CROWN_CASH_SESSION'
        );

        session_set_cookie_params([
            'lifetime' => 0,
            'path' => '/',
            'domain' => '',
            'secure' => true,
            'httponly' => true,
            'samesite' => 'None'
        ]);

        session_start();
    }

} catch (Throwable $e) {

    http_response_code(500);

    echo json_encode([
        'success' => false,
        'message' => 'Unable to initialize session.'
    ]);

    exit;
}


/*
|--------------------------------------------------------------------------
| CHECK LOGIN
|--------------------------------------------------------------------------
*/

$loggedIn =
    isset($_SESSION['logged_in']) &&
    $_SESSION['logged_in'] === true;

$userId =
    trim(
        (string)(
            $_SESSION['user_id']
            ?? ''
        )
    );


if (
    !$loggedIn ||
    $userId === ''
) {

    http_response_code(401);

    echo json_encode([
        'success' => false,
        'authenticated' => false,
        'message' => 'Please login first.'
    ]);

    exit;
}


/*
|--------------------------------------------------------------------------
| DATABASE
|--------------------------------------------------------------------------
*/

if (!isset($users)) {

    http_response_code(500);

    echo json_encode([
        'success' => false,
        'message' => 'Users collection is unavailable.'
    ]);

    exit;
}


/*
|--------------------------------------------------------------------------
| FIND USER
|--------------------------------------------------------------------------
*/

try {

    $user = null;


    /*
     * Mongo ObjectId
     */
    if (
        preg_match(
            '/^[a-f0-9]{24}$/i',
            $userId
        )
    ) {

        try {

            $user =
                $users->findOne([
                    '_id' =>
                        new MongoDB\BSON\ObjectId(
                            $userId
                        )
                ]);

        } catch (Throwable $e) {

            $user = null;
        }
    }


    /*
     * String ID
     */
    if (!$user) {

        try {

            $user =
                $users->findOne([
                    'id' =>
                        $userId
                ]);

        } catch (Throwable $e) {

            $user = null;
        }
    }


    /*
     * Email fallback
     */
    if (!$user) {

        $email =
            strtolower(
                trim(
                    (string)(
                        $_SESSION['user_email']
                        ?? $_SESSION['email']
                        ?? ''
                    )
                )
            );

        if ($email !== '') {

            $user =
                $users->findOne([
                    'email' =>
                        $email
                ]);
        }
    }


    /*
     * USER NOT FOUND
     */
    if (!$user) {

        http_response_code(404);

        echo json_encode([
            'success' => false,
            'message' => 'User account was not found.'
        ]);

        exit;
    }


    /*
     * Convert Mongo document.
     */
    $user =
        is_array($user)
            ? $user
            : (array)$user;


    /*
     |--------------------------------------------------------------------------
     | FIRST NAME
     |--------------------------------------------------------------------------
     */

    $firstName = '';

    if (
        !empty(
            $user['first_name']
        )
    ) {

        $firstName =
            (string)$user['first_name'];

    } elseif (
        !empty(
            $user['firstname']
        )
    ) {

        $firstName =
            (string)$user['firstname'];

    } elseif (
        !empty(
            $user['firstName']
        )
    ) {

        $firstName =
            (string)$user['firstName'];
    }


    /*
     |--------------------------------------------------------------------------
     | LAST NAME
     |--------------------------------------------------------------------------
     */

    $lastName = '';

    if (
        !empty(
            $user['last_name']
        )
    ) {

        $lastName =
            (string)$user['last_name'];

    } elseif (
        !empty(
            $user['lastname']
        )
    ) {

        $lastName =
            (string)$user['lastname'];

    } elseif (
        !empty(
            $user['lastName']
        )
    ) {

        $lastName =
            (string)$user['lastName'];
    }


    /*
     |--------------------------------------------------------------------------
     | FULL NAME
     |--------------------------------------------------------------------------
     */

    $fullName = '';

    if (
        !empty(
            $user['full_name']
        )
    ) {

        $fullName =
            trim(
                (string)$user['full_name']
            );

    } elseif (
        !empty(
            $user['fullName']
        )
    ) {

        $fullName =
            trim(
                (string)$user['fullName']
            );

    } elseif (
        !empty(
            $user['name']
        )
    ) {

        $fullName =
            trim(
                (string)$user['name']
            );

    } elseif (
        $firstName !== '' ||
        $lastName !== ''
    ) {

        $fullName =
            trim(
                $firstName .
                ' ' .
                $lastName
            );
    }


    /*
     |--------------------------------------------------------------------------
     | SPLIT FULL NAME IF NECESSARY
     |--------------------------------------------------------------------------
     */

    if (
        $fullName !== '' &&
        $firstName === '' &&
        $lastName === ''
    ) {

        $nameParts =
            preg_split(
                '/\s+/',
                $fullName,
                -1,
                PREG_SPLIT_NO_EMPTY
            );

        $firstName =
            $nameParts[0] ?? '';

        if (
            count($nameParts) > 1
        ) {

            $lastName =
                implode(
                    ' ',
                    array_slice(
                        $nameParts,
                        1
                    )
                );
        }
    }


    /*
     |--------------------------------------------------------------------------
     | EMAIL
     |--------------------------------------------------------------------------
     */

    $email =
        (string)(
            $user['email']
            ?? ''
        );


    /*
     |--------------------------------------------------------------------------
     | PHONE
     |--------------------------------------------------------------------------
     */

    $phone = '';

    if (
        !empty(
            $user['phone']
        )
    ) {

        $phone =
            (string)$user['phone'];

    } elseif (
        !empty(
            $user['phone_number']
        )
    ) {

        $phone =
            (string)$user['phone_number'];

    } elseif (
        !empty(
            $user['phoneNumber']
        )
    ) {

        $phone =
            (string)$user['phoneNumber'];
    }


    /*
     |--------------------------------------------------------------------------
     | REFERRAL CODE
     |--------------------------------------------------------------------------
     */

    $referralCode = '';

    if (
        !empty(
            $user['referral_code']
        )
    ) {

        $referralCode =
            (string)$user['referral_code'];

    } elseif (
        !empty(
            $user['referralCode']
        )
    ) {

        $referralCode =
            (string)$user['referralCode'];
    }


    /*
     |--------------------------------------------------------------------------
     | BALANCE
     |--------------------------------------------------------------------------
     */

    $balance = 0.0;


    if (
        isset(
            $user['balance']
        )
    ) {

        $value =
            $user['balance'];

        if (
            $value instanceof
            MongoDB\BSON\Decimal128
        ) {

            $balance =
                (float)$value->__toString();

        } elseif (
            is_numeric($value)
        ) {

            $balance =
                (float)$value;
        }

    } elseif (
        isset(
            $user['wallet_balance']
        )
    ) {

        $value =
            $user['wallet_balance'];

        if (
            $value instanceof
            MongoDB\BSON\Decimal128
        ) {

            $balance =
                (float)$value->__toString();

        } elseif (
            is_numeric($value)
        ) {

            $balance =
                (float)$value;
        }
    }


    /*
     |--------------------------------------------------------------------------
     | STATUS
     |--------------------------------------------------------------------------
     */

    $status =
        strtolower(
            (string)(
                $user['status']
                ?? 'active'
            )
        );


    /*
     |--------------------------------------------------------------------------
     | ACCOUNT TYPE
     |--------------------------------------------------------------------------
     */

    $accountType =
        strtolower(
            (string)(
                $user['account_type']
                ?? 'user'
            )
        );


    /*
     |--------------------------------------------------------------------------
     | CREATED DATE
     |--------------------------------------------------------------------------
     */

    $createdAt = '';

    if (
        isset(
            $user['created_at']
        )
    ) {

        if (
            $user['created_at']
            instanceof
            MongoDB\BSON\UTCDateTime
        ) {

            $createdAt =
                $user['created_at']
                    ->toDateTime()
                    ->format('Y-m-d');

        } else {

            $createdAt =
                (string)$user['created_at'];
        }
    }


    /*
     |--------------------------------------------------------------------------
     | RESPONSE
     |--------------------------------------------------------------------------
     */

    echo json_encode(
        [
            'success' => true,

            'authenticated' => true,

            'user' => [

                'id' =>
                    $userId,

                'first_name' =>
                    $firstName,

                'last_name' =>
                    $lastName,

                'full_name' =>
                    $fullName,

                'email' =>
                    $email,

                'phone' =>
                    $phone,

                'referral_code' =>
                    $referralCode,

                'balance' =>
                    $balance,

                'status' =>
                    $status,

                'account_type' =>
                    $accountType,

                'role' =>
                    (string)(
                        $user['role']
                        ?? ''
                    ),

                'created_at' =>
                    $createdAt
            ]
        ],
        JSON_UNESCAPED_SLASHES
    );

} catch (
    MongoDB\Driver\Exception\Exception $e
) {

    error_log(
        'Crown Cash profile MongoDB error: ' .
        $e->getMessage()
    );

    http_response_code(500);

    echo json_encode([
        'success' => false,
        'message' => 'Database error.'
    ]);

} catch (Throwable $e) {

    error_log(
        'Crown Cash profile error: ' .
        $e->getMessage()
    );

    http_response_code(500);

    echo json_encode([
        'success' => false,
        'message' => 'Unable to load profile.'
    ]);
}

?>