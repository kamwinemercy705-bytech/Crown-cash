<?php

declare(strict_types=1);

/* =========================================================
   CROWN CASH — DEPOSIT API
   =========================================================
   Creates deposit requests as PENDING.

   MTN Merchant Code:   80257065
   Airtel Merchant Code: 7229487

   IMPORTANT:
   - Does NOT automatically credit wallet balance.
   - Admin must verify and approve the deposit.
   ========================================================= */


/* =========================================================
   ERROR HANDLING
   ========================================================= */

ini_set('display_errors', '0');
ini_set('log_errors', '1');

error_reporting(E_ALL);


/* =========================================================
   JSON RESPONSE
   ========================================================= */

function sendJson(
    bool $success,
    string $message,
    array $extra = [],
    int $statusCode = 200
): never {

    http_response_code($statusCode);

    header(
        'Content-Type: application/json; charset=utf-8'
    );

    $response = array_merge(
        [
            'success' => $success,
            'message' => $message
        ],
        $extra
    );

    echo json_encode(
        $response,
        JSON_UNESCAPED_SLASHES
    );

    exit;
}


/* =========================================================
   FATAL ERROR HANDLER
   ========================================================= */

register_shutdown_function(
    function (): void {

        $error =
            error_get_last();

        if ($error === null) {
            return;
        }

        $fatalTypes = [
            E_ERROR,
            E_PARSE,
            E_CORE_ERROR,
            E_COMPILE_ERROR
        ];

        if (
            in_array(
                $error['type'],
                $fatalTypes,
                true
            )
        ) {

            error_log(
                'Crown Cash deposit fatal error: ' .
                ($error['message'] ?? 'Unknown error') .
                ' in ' .
                ($error['file'] ?? 'unknown file') .
                ' on line ' .
                ($error['line'] ?? 'unknown')
            );

            if (!headers_sent()) {

                http_response_code(500);

                header(
                    'Content-Type: application/json; charset=utf-8'
                );

                echo json_encode([
                    'success' => false,
                    'message' =>
                        'A server error occurred while processing your deposit.'
                ]);

            }

        }

    }
);


/* =========================================================
   SESSION
   ========================================================= */

$secureCookie =
    isset($_SERVER['HTTPS']) &&
    $_SERVER['HTTPS'] !== 'off';


session_set_cookie_params([
    'lifetime' => 0,
    'path' => '/',
    'domain' => '',
    'secure' => $secureCookie,
    'httponly' => true,
    'samesite' => 'None'
]);


if (
    session_status() !== PHP_SESSION_ACTIVE
) {

    session_start();

}


/* =========================================================
   CORS
   ========================================================= */

$allowedOrigin =
    'https://crown-cash.vercel.app';


$origin =
    $_SERVER['HTTP_ORIGIN'] ?? '';


if (
    $origin === $allowedOrigin
) {

    header(
        "Access-Control-Allow-Origin: {$allowedOrigin}"
    );

    header(
        'Access-Control-Allow-Credentials: true'
    );

    header(
        'Access-Control-Allow-Headers: Content-Type, Accept'
    );

    header(
        'Access-Control-Allow-Methods: GET, POST, OPTIONS'
    );

}


header(
    'Content-Type: application/json; charset=utf-8'
);


/* =========================================================
   OPTIONS
   ========================================================= */

if (
    $_SERVER['REQUEST_METHOD'] === 'OPTIONS'
) {

    http_response_code(204);

    exit;

}


/* =========================================================
   REQUEST METHOD
   ========================================================= */

if (
    !in_array(
        $_SERVER['REQUEST_METHOD'],
        ['GET', 'POST'],
        true
    )
) {

    sendJson(
        false,
        'Method not allowed.',
        [],
        405
    );

}


/* =========================================================
   LOAD CONFIG
   ========================================================= */

try {

    require_once __DIR__ . '/config.php';

} catch (Throwable $e) {

    error_log(
        'Crown Cash deposit config error: ' .
        $e->getMessage()
    );

    sendJson(
        false,
        'Server configuration error.',
        [],
        500
    );

}


/* =========================================================
   CHECK DATABASE
   ========================================================= */

if (
    !isset($db) ||
    !($db instanceof MongoDB\Database)
) {

    error_log(
        'Crown Cash deposit error: MongoDB $db unavailable.'
    );

    sendJson(
        false,
        'Database connection is not available.',
        [],
        500
    );

}


if (
    !isset($users) ||
    !($users instanceof MongoDB\Collection)
) {

    error_log(
        'Crown Cash deposit error: users collection unavailable.'
    );

    sendJson(
        false,
        'Users database is not available.',
        [],
        500
    );

}


if (
    !isset($deposits) ||
    !($deposits instanceof MongoDB\Collection)
) {

    error_log(
        'Crown Cash deposit error: deposits collection unavailable.'
    );

    sendJson(
        false,
        'Deposits database is not available.',
        [],
        500
    );

}


/* =========================================================
   GET — DEPOSIT HISTORY
   ========================================================= */

if (
    $_SERVER['REQUEST_METHOD'] === 'GET'
) {

    if (
        empty($_SESSION['logged_in'])
    ) {

        sendJson(
            false,
            'You must be logged in to view your deposits.',
            [],
            401
        );

    }


    $sessionUserId =
        $_SESSION['user_id'] ??
        $_SESSION['userId'] ??
        $_SESSION['id'] ??
        null;


    $sessionEmail =
        $_SESSION['email'] ??
        null;


    if (
        !$sessionUserId &&
        !$sessionEmail
    ) {

        sendJson(
            false,
            'Your login session could not be identified.',
            [],
            401
        );

    }


    try {

        $query = [];


        if (
            $sessionUserId
        ) {

            $query['user_id'] =
                (string) $sessionUserId;

        } elseif (
            $sessionEmail
        ) {

            $query['email'] =
                strtolower(
                    trim(
                        (string) $sessionEmail
                    )
                );

        }


        $cursor =
            $deposits->find(
                $query,
                [
                    'sort' => [
                        'created_at' => -1
                    ],
                    'limit' => 20
                ]
            );


        $depositList = [];


        foreach (
            $cursor as $deposit
        ) {

            $depositList[] =
                convertMongoDocument(
                    $deposit
                );

        }


        sendJson(
            true,
            'Deposit history loaded.',
            [
                'deposits' =>
                    $depositList
            ]
        );


    } catch (Throwable $e) {

        error_log(
            'Crown Cash deposit history error: ' .
            $e->getMessage()
        );

        sendJson(
            false,
            'Unable to load deposit history.',
            [],
            500
        );

    }

}


/* =========================================================
   POST — CREATE DEPOSIT
   ========================================================= */

if (
    $_SERVER['REQUEST_METHOD'] === 'POST'
) {


    /* =====================================================
       LOGIN
       ===================================================== */

    if (
        empty($_SESSION['logged_in'])
    ) {

        sendJson(
            false,
            'Please log in before making a deposit.',
            [],
            401
        );

    }


    /* =====================================================
       SESSION USER
       ===================================================== */

    $sessionUserId =
        $_SESSION['user_id'] ??
        $_SESSION['userId'] ??
        $_SESSION['id'] ??
        null;


    $sessionEmail =
        $_SESSION['email'] ??
        null;


    if (
        !$sessionUserId &&
        !$sessionEmail
    ) {

        sendJson(
            false,
            'Your login session could not be identified.',
            [],
            401
        );

    }


    /* =====================================================
       READ JSON
       ===================================================== */

    $rawInput =
        file_get_contents(
            'php://input'
        );


    if (
        $rawInput === false ||
        trim($rawInput) === ''
    ) {

        sendJson(
            false,
            'No deposit information was received.',
            [],
            400
        );

    }


    $data =
        json_decode(
            $rawInput,
            true
        );


    if (
        !is_array($data)
    ) {

        sendJson(
            false,
            'Invalid deposit request.',
            [],
            400
        );

    }


    /* =====================================================
       AMOUNT
       ===================================================== */

    $amountValue =
        $data['amount'] ??
        $data['deposit_amount'] ??
        $data['depositAmount'] ??
        null;


    if (
        $amountValue === null ||
        $amountValue === ''
    ) {

        sendJson(
            false,
            'Please enter a deposit amount.',
            [],
            400
        );

    }


    if (
        !is_numeric($amountValue)
    ) {

        sendJson(
            false,
            'Deposit amount must be a valid number.',
            [],
            400
        );

    }


    $amount =
        (float) $amountValue;


    if (
        !is_finite($amount) ||
        $amount <= 0
    ) {

        sendJson(
            false,
            'Invalid deposit amount.',
            [],
            400
        );

    }


    /* =====================================================
       MINIMUM
       ===================================================== */

    $minimumDeposit =
        10000;


    if (
        $amount < $minimumDeposit
    ) {

        sendJson(
            false,
            'The minimum deposit amount is UGX 10,000.',
            [],
            400
        );

    }


    /* =====================================================
       AMOUNT MUST BE THOUSANDS
       ===================================================== */

    if (
        fmod(
            $amount,
            1000
        ) !== 0.0
    ) {

        sendJson(
            false,
            'Deposit amounts must be in multiples of UGX 1,000.',
            [],
            400
        );

    }


    /* =====================================================
       PAYMENT METHOD
       ===================================================== */

    $paymentMethod =
        $data['payment_method'] ??
        $data['paymentMethod'] ??
        null;


    $paymentMethod =
        strtolower(
            trim(
                (string) $paymentMethod
            )
        );


    if (
        !in_array(
            $paymentMethod,
            ['mtn', 'airtel'],
            true
        )
    ) {

        sendJson(
            false,
            'Please select MTN Mobile Money or Airtel Money.',
            [],
            400
        );

    }


    /* =====================================================
       MERCHANT CODES
       ===================================================== */

    $merchantCodes = [

        'mtn' =>
            '80257065',

        'airtel' =>
            '7229487'

    ];


    $merchantCode =
        $merchantCodes[
            $paymentMethod
        ];


    /* =====================================================
       TRANSACTION REFERENCE
       ===================================================== */

    $transactionReference =
        $data['transaction_reference'] ??
        $data['transactionReference'] ??
        $data['reference'] ??
        $data['transaction_id'] ??
        $data['transactionId'] ??
        null;


    $transactionReference =
        trim(
            (string) $transactionReference
        );


    if (
        $transactionReference === ''
    ) {

        sendJson(
            false,
            'Please enter your Mobile Money transaction reference.',
            [],
            400
        );

    }


    if (
        strlen($transactionReference) < 3
    ) {

        sendJson(
            false,
            'Please enter a valid transaction reference.',
            [],
            400
        );

    }


    if (
        strlen($transactionReference) > 100
    ) {

        sendJson(
            false,
            'Transaction reference is too long.',
            [],
            400
        );

    }


    /* =====================================================
       OPTIONAL CLIENT MERCHANT CODE
       ===================================================== */

    $clientMerchantCode =
        $data['merchant_code'] ??
        $data['merchantCode'] ??
        null;


    if (
        $clientMerchantCode !== null
    ) {

        $clientMerchantCode =
            trim(
                (string) $clientMerchantCode
            );


        if (
            $clientMerchantCode !==
            $merchantCode
        ) {

            sendJson(
                false,
                'Invalid merchant payment information.',
                [],
                400
            );

        }

    }


    /* =====================================================
       FIND USER
       ===================================================== */

    try {

        $user = null;


        if (
            $sessionUserId
        ) {

            $user =
                findUserById(
                    $users,
                    (string) $sessionUserId
                );

        }


        if (
            $user === null &&
            $sessionEmail
        ) {

            $email =
                strtolower(
                    trim(
                        (string) $sessionEmail
                    )
                );


            $user =
                $users->findOne([
                    'email' =>
                        $email
                ]);

        }


        if (
            $user === null
        ) {

            sendJson(
                false,
                'Your Crown Cash account could not be found.',
                [],
                404
            );

        }


    } catch (Throwable $e) {

        error_log(
            'Crown Cash user lookup error: ' .
            $e->getMessage()
        );

        sendJson(
            false,
            'Unable to identify your Crown Cash account.',
            [],
            500
        );

    }


    /* =====================================================
       USER DATA
       ===================================================== */

    $userArray =
        convertMongoDocument(
            $user
        );


    $userId =
        extractUserId(
            $userArray
        );


    if (
        !$userId
    ) {

        sendJson(
            false,
            'Your account ID could not be determined.',
            [],
            500
        );

    }


    $userEmail =
        $userArray['email'] ??
        $sessionEmail ??
        '';


    $firstName =
        $userArray['first_name'] ??
        $userArray['firstName'] ??
        $userArray['firstname'] ??
        '';


    $lastName =
        $userArray['last_name'] ??
        $userArray['lastName'] ??
        $userArray['lastname'] ??
        '';


    $userName =
        trim(
            $firstName .
            ' ' .
            $lastName
        );


    if (
        $userName === ''
    ) {

        $userName =
            $userArray['name'] ??
            $userArray['full_name'] ??
            $userArray['fullName'] ??
            'Crown Cash User';

    }


    /* =====================================================
       DUPLICATE REFERENCE CHECK
       ===================================================== */

    try {

        $existingDeposit =
            $deposits->findOne([
                'transaction_reference' =>
                    $transactionReference
            ]);


        if (
            $existingDeposit !== null
        ) {

            sendJson(
                false,
                'This transaction reference has already been submitted.',
                [],
                409
            );

        }


        $existingDeposit =
            $deposits->findOne([
                'transactionReference' =>
                    $transactionReference
            ]);


        if (
            $existingDeposit !== null
        ) {

            sendJson(
                false,
                'This transaction reference has already been submitted.',
                [],
                409
            );

        }


    } catch (Throwable $e) {

        error_log(
            'Crown Cash duplicate reference error: ' .
            $e->getMessage()
        );

        sendJson(
            false,
            'Unable to verify the transaction reference.',
            [],
            500
        );

    }


    /* =====================================================
       CREATE DEPOSIT
       ===================================================== */

    try {

        $now =
            new MongoDB\BSON\UTCDateTime(
                (int) round(
                    microtime(true) * 1000
                )
            );


        $depositDocument = [

            /* USER */

            'user_id' =>
                $userId,

            'userId' =>
                $userId,

            'email' =>
                strtolower(
                    trim(
                        (string) $userEmail
                    )
                ),

            'customer_name' =>
                $userName,


            /* MONEY */

            'amount' =>
                $amount,

            'currency' =>
                'UGX',


            /* PAYMENT */

            'payment_method' =>
                $paymentMethod,

            'paymentMethod' =>
                $paymentMethod,

            'merchant_code' =>
                $merchantCode,

            'transaction_reference' =>
                $transactionReference,

            'transactionReference' =>
                $transactionReference,


            /* STATUS */

            'status' =>
                'pending',

            'verified' =>
                false,

            'approved' =>
                false,


            /* ADMIN */

            'approved_by' =>
                null,

            'approved_at' =>
                null,

            'rejection_reason' =>
                null,


            /* DATES */

            'created_at' =>
                $now,

            'updated_at' =>
                $now

        ];


        $insertResult =
            $deposits->insertOne(
                $depositDocument
            );


        if (
            !$insertResult->isAcknowledged()
        ) {

            throw new RuntimeException(
                'MongoDB did not acknowledge the deposit insertion.'
            );

        }


        $depositId =
            (string)
            $insertResult->getInsertedId();


    } catch (Throwable $e) {

        error_log(
            'Crown Cash deposit INSERT FAILED: ' .
            $e->getMessage()
        );


        sendJson(
            false,
            'Unable to save your deposit request. Please try again.',
            [
                'error_code' =>
                    'DEPOSIT_INSERT_FAILED'
            ],
            500
        );

    }


    /* =====================================================
       SUCCESS RESPONSE
       ===================================================== */

    sendJson(
        true,
        'Deposit submitted successfully. Your payment will be verified before your balance is updated.',
        [
            'deposit' => [

                'id' =>
                    $depositId,

                'amount' =>
                    $amount,

                'currency' =>
                    'UGX',

                'payment_method' =>
                    $paymentMethod,

                'merchant_code' =>
                    $merchantCode,

                'transaction_reference' =>
                    $transactionReference,

                'status' =>
                    'pending',

                'created_at' =>
                    gmdate('c')

            ]
        ],
        201
    );

}


/* =========================================================
   MONGODB → JSON SAFE VALUE
   ========================================================= */

function jsonSafeValue(
    mixed $value
): mixed {

    /*
     * ObjectId
     */

    if (
        $value instanceof MongoDB\BSON\ObjectId
    ) {

        return (string) $value;

    }


    /*
     * UTCDateTime
     */

    if (
        $value instanceof MongoDB\BSON\UTCDateTime
    ) {

        return $value
            ->toDateTime()
            ->format('c');

    }


    /*
     * BSONDocument
     *
     * IMPORTANT:
     * Do NOT use toJSON().
     *
     * MongoDB PHP driver provides getArrayCopy().
     */

    if (
        $value instanceof MongoDB\Model\BSONDocument
    ) {

        $array =
            $value->getArrayCopy();


        $result = [];


        foreach (
            $array as $key => $item
        ) {

            $result[$key] =
                jsonSafeValue(
                    $item
                );

        }


        return $result;

    }


    /*
     * BSONArray
     */

    if (
        $value instanceof MongoDB\Model\BSONArray
    ) {

        $array =
            $value->getArrayCopy();


        $result = [];


        foreach (
            $array as $key => $item
        ) {

            $result[$key] =
                jsonSafeValue(
                    $item
                );

        }


        return $result;

    }


    /*
     * Normal PHP array
     */

    if (
        is_array($value)
    ) {

        $result = [];


        foreach (
            $value as $key => $item
        ) {

            $result[$key] =
                jsonSafeValue(
                    $item
                );

        }


        return $result;

    }


    return $value;

}


/* =========================================================
   CONVERT MONGODB DOCUMENT
   ========================================================= */

function convertMongoDocument(
    mixed $document
): array {

    $safe =
        jsonSafeValue(
            $document
        );


    if (
        is_array($safe)
    ) {

        return $safe;

    }


    return [];

}


/* =========================================================
   EXTRACT USER ID
   ========================================================= */

function extractUserId(
    array $user
): ?string {

    $fields = [

        '_id',

        'id',

        'user_id',

        'userId',

        'customer_id',

        'customerId',

        'member_id',

        'memberId',

        'account_id',

        'accountId'

    ];


    foreach (
        $fields as $field
    ) {

        if (
            array_key_exists(
                $field,
                $user
            ) &&
            $user[$field] !== null &&
            $user[$field] !== ''
        ) {

            return (string)
                $user[$field];

        }

    }


    return null;

}


/* =========================================================
   FIND USER
   ========================================================= */

function findUserById(
    MongoDB\Collection $collection,
    string $userId
): ?object {

    /*
     * ObjectId search
     */

    if (
        preg_match(
            '/^[a-f0-9]{24}$/i',
            $userId
        )
    ) {

        try {

            $objectId =
                new MongoDB\BSON\ObjectId(
                    $userId
                );


            $user =
                $collection->findOne([
                    '_id' =>
                        $objectId
                ]);


            if (
                $user !== null
            ) {

                return $user;

            }

        } catch (Throwable $e) {

            error_log(
                'Crown Cash ObjectId lookup: ' .
                $e->getMessage()
            );

        }

    }


    /*
     * String ID fields
     */

    $queries = [

        [
            'id' =>
                $userId
        ],

        [
            'user_id' =>
                $userId
        ],

        [
            'userId' =>
                $userId
        ],

        [
            'customer_id' =>
                $userId
        ],

        [
            'customerId' =>
                $userId
        ],

        [
            'member_id' =>
                $userId
        ],

        [
            'memberId' =>
                $userId
        ],

        [
            'account_id' =>
                $userId
        ],

        [
            'accountId' =>
                $userId
        ]

    ];


    foreach (
        $queries as $query
    ) {

        try {

            $user =
                $collection->findOne(
                    $query
                );


            if (
                $user !== null
            ) {

                return $user;

            }

        } catch (Throwable $e) {

            error_log(
                'Crown Cash string ID lookup: ' .
                $e->getMessage()
            );

        }

    }


    return null;

}