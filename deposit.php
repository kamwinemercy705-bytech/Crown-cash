<?php

declare(strict_types=1);

/* =========================================================
   CROWN CASH — DEPOSIT API
   =========================================================
   Creates deposit requests as PENDING.

   MTN Merchant Code:
   80257065

   Airtel Merchant Code:
   7229487

   IMPORTANT:
   - Does NOT automatically credit wallet balance.
   - Admin must verify and approve the deposit.
   - Uses the same CROWN_CASH_SESSION as login/dashboard.
   ========================================================= */


/* =========================================================
   ERROR HANDLING
   ========================================================= */

ini_set('display_errors', '0');
ini_set('log_errors', '1');

error_reporting(E_ALL);


/* =========================================================
   LOAD CONFIG FIRST
   ========================================================= */

try {

    require_once __DIR__ . '/config.php';

} catch (Throwable $e) {

    error_log(
        'Crown Cash deposit config error: ' .
        $e->getMessage()
    );

    http_response_code(500);

    header(
        'Content-Type: application/json; charset=utf-8'
    );

    echo json_encode([
        'success' => false,
        'message' => 'Server configuration error.'
    ]);

    exit;
}


/* =========================================================
   CORS
   ========================================================= */

$allowedOrigins = [
    'https://crown-cash.vercel.app',
    'https://www.crown-cash.vercel.app'
];

$requestOrigin =
    $_SERVER['HTTP_ORIGIN'] ?? '';

if (
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
        'Access-Control-Allow-Headers: Content-Type, Accept, X-Requested-With'
    );

    header(
        'Access-Control-Allow-Methods: GET, POST, OPTIONS'
    );

    header(
        'Vary: Origin'
    );
}


/* =========================================================
   CONTENT TYPE
   ========================================================= */

header(
    'Content-Type: application/json; charset=utf-8'
);


/* =========================================================
   OPTIONS
   ========================================================= */

if (
    ($_SERVER['REQUEST_METHOD'] ?? '') ===
    'OPTIONS'
) {

    http_response_code(204);

    exit;
}


/* =========================================================
   START CANONICAL CROWN CASH SESSION
   =========================================================
   This is the critical fix.

   The entire Crown Cash system must use:

   CROWN_CASH_SESSION
   ========================================================= */

try {

    if (
        function_exists('startSecureSession')
    ) {

        startSecureSession();

    } else {

        if (
            session_status() !== PHP_SESSION_ACTIVE
        ) {

            ini_set(
                'session.use_only_cookies',
                '1'
            );

            ini_set(
                'session.use_strict_mode',
                '1'
            );

            ini_set(
                'session.cookie_httponly',
                '1'
            );

            ini_set(
                'session.cookie_secure',
                '1'
            );

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
    }

} catch (Throwable $e) {

    error_log(
        'Crown Cash deposit session error: ' .
        $e->getMessage()
    );

    http_response_code(500);

    echo json_encode([
        'success' => false,
        'message' =>
            'Unable to initialize your login session.'
    ]);

    exit;
}


/* =========================================================
   JSON RESPONSE
   ========================================================= */

function sendJson(
    bool $success,
    string $message,
    array $extra = [],
    int $statusCode = 200
): never {

    http_response_code(
        $statusCode
    );

    $response =
        array_merge(
            [
                'success' =>
                    $success,

                'message' =>
                    $message
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

        if (
            $error === null
        ) {

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


            if (
                !headers_sent()
            ) {

                http_response_code(
                    500
                );

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
   REQUEST METHOD
   ========================================================= */

$requestMethod =
    $_SERVER['REQUEST_METHOD'] ??
    'GET';


if (
    !in_array(
        $requestMethod,
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
   DATABASE CHECK
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
   CURRENT SESSION USER
   ========================================================= */

$sessionUserId =
    $_SESSION['user_id'] ??
    $_SESSION['userId'] ??
    $_SESSION['id'] ??
    $_SESSION['_id'] ??
    null;


$sessionEmail =
    $_SESSION['user_email'] ??
    $_SESSION['email'] ??
    null;


/* =========================================================
   LOGIN CHECK
   ========================================================= */

$isLoggedIn =
    (
        isset(
            $_SESSION['logged_in']
        ) &&
        $_SESSION['logged_in'] === true
    );


/* =========================================================
   GET — DEPOSIT HISTORY
   ========================================================= */

if (
    $requestMethod === 'GET'
) {

    if (
        !$isLoggedIn
    ) {

        sendJson(
            false,
            'You must be logged in to view your deposits.',
            [],
            401
        );
    }


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

        $user =
            null;


        /* -------------------------------------------------
           Find user
           ------------------------------------------------- */

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


        $userArray =
            convertMongoDocument(
                $user
            );


        $actualUserId =
            extractUserId(
                $userArray
            );


        if (
            !$actualUserId
        ) {

            sendJson(
                false,
                'Your account ID could not be determined.',
                [],
                500
            );
        }


        /* -------------------------------------------------
           Query deposits
           ------------------------------------------------- */

        $query = [

            'user_id' =>
                $actualUserId

        ];


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


        $depositList =
            [];


        foreach (
            $cursor as $deposit
        ) {

            $depositList[] =
                convertMongoDocument(
                    $deposit
                );
        }


        /* -------------------------------------------------
           Calculate current wallet balance
           ------------------------------------------------- */

        $balance =
            getUserBalance(
                $userArray
            );


        sendJson(
            true,
            'Deposit history loaded.',
            [

                'deposits' =>
                    $depositList,

                'data' =>
                    $depositList,

                'total' =>
                    count(
                        $depositList
                    ),

                'balance' =>
                    $balance

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
    $requestMethod === 'POST'
) {

    /* -----------------------------------------------------
       LOGIN
       ----------------------------------------------------- */

    if (
        !$isLoggedIn
    ) {

        sendJson(
            false,
            'Please log in before making a deposit.',
            [],
            401
        );
    }


    /* -----------------------------------------------------
       SESSION IDENTIFICATION
       ----------------------------------------------------- */

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


    /* -----------------------------------------------------
       READ REQUEST BODY
       ----------------------------------------------------- */

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
        !is_numeric(
            $amountValue
        )
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
        !is_finite(
            $amount
        ) ||
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
       MINIMUM DEPOSIT
       ===================================================== */

    if (
        $amount < 10000
    ) {

        sendJson(
            false,
            'The minimum deposit amount is UGX 10,000.',
            [],
            400
        );
    }


    /* =====================================================
       THOUSAND MULTIPLE
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
        '';


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
        '';


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
        strlen(
            $transactionReference
        ) < 3
    ) {

        sendJson(
            false,
            'Please enter a valid transaction reference.',
            [],
            400
        );
    }


    if (
        strlen(
            $transactionReference
        ) > 100
    ) {

        sendJson(
            false,
            'Transaction reference is too long.',
            [],
            400
        );
    }


    /* =====================================================
       CLIENT MERCHANT CODE VALIDATION
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

        $user =
            null;


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
            $userArray['full_name'] ??
            $userArray['fullName'] ??
            $userArray['name'] ??
            'Crown Cash User';
    }


    /* =====================================================
       DUPLICATE REFERENCE
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

            'amount' =>
                $amount,

            'currency' =>
                'UGX',

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

            'status' =>
                'pending',

            'verified' =>
                false,

            'approved' =>
                false,

            'approved_by' =>
                null,

            'approved_at' =>
                null,

            'rejection_reason' =>
                null,

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
       SUCCESS
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
   GET USER BALANCE
   ========================================================= */

function getUserBalance(
    array $user
): float {

    $fields = [

        'balance',

        'wallet_balance',

        'walletBalance',

        'account_balance',

        'accountBalance'

    ];


    foreach (
        $fields as $field
    ) {

        if (
            isset(
                $user[$field]
            ) &&
            is_numeric(
                $user[$field]
            )
        ) {

            return (float)
                $user[$field];
        }
    }


    return 0.0;
}


/* =========================================================
   MONGODB SAFE VALUE
   ========================================================= */

function jsonSafeValue(
    mixed $value
): mixed {

    if (
        $value instanceof MongoDB\BSON\ObjectId
    ) {

        return (string)
            $value;
    }


    if (
        $value instanceof MongoDB\BSON\UTCDateTime
    ) {

        return $value
            ->toDateTime()
            ->format('c');
    }


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


    return is_array(
        $safe
    )
        ? $safe
        : [];
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
   FIND USER BY ID
   ========================================================= */

function findUserById(
    MongoDB\Collection $collection,
    string $userId
): ?object {

    /*
     * MongoDB ObjectId
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
     * String IDs
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