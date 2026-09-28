<?php

declare(strict_types=1);

/* =========================================================
   CROWN CASH — DEPOSIT API
   ========================================================= */

/*
 * IMPORTANT:
 * This API records deposit requests as PENDING.
 *
 * It does NOT automatically add money to the user's balance.
 * An administrator should verify the Mobile Money payment
 * before approving the deposit.
 */


/* =========================================================
   ERROR HANDLING
   ========================================================= */

ini_set('display_errors', '0');
error_reporting(E_ALL);


/* =========================================================
   SESSION CONFIGURATION
   ========================================================= */

$secureCookie = (
    isset($_SERVER['HTTPS']) &&
    $_SERVER['HTTPS'] !== 'off'
);

session_set_cookie_params([
    'lifetime' => 0,
    'path' => '/',
    'domain' => '',
    'secure' => $secureCookie,
    'httponly' => true,
    'samesite' => 'None'
]);

if (session_status() !== PHP_SESSION_ACTIVE) {
    session_start();
}


/* =========================================================
   CORS
   ========================================================= */

$allowedOrigin = 'https://crown-cash.vercel.app';

$origin = $_SERVER['HTTP_ORIGIN'] ?? '';

if ($origin === $allowedOrigin) {

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
        'Access-Control-Allow-Methods: POST, GET, OPTIONS'
    );
}


header('Content-Type: application/json; charset=utf-8');


/* =========================================================
   OPTIONS / PREFLIGHT
   ========================================================= */

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {

    http_response_code(204);

    exit;
}


/* =========================================================
   RESPONSE HELPER
   ========================================================= */

function sendJson(
    bool $success,
    string $message,
    array $extra = [],
    int $statusCode = 200
): never {

    http_response_code($statusCode);

    echo json_encode(
        array_merge(
            [
                'success' => $success,
                'message' => $message
            ],
            $extra
        ),
        JSON_UNESCAPED_SLASHES
    );

    exit;
}


/* =========================================================
   REQUEST METHOD
   ========================================================= */

if (
    $_SERVER['REQUEST_METHOD'] !== 'POST' &&
    $_SERVER['REQUEST_METHOD'] !== 'GET'
) {

    sendJson(
        false,
        'Method not allowed.',
        [],
        405
    );

}


/* =========================================================
   DATABASE
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
        'Database configuration error.',
        [],
        500
    );

}


/* =========================================================
   FIND MONGODB COLLECTIONS
   ========================================================= */

try {

    /*
     * The existing Crown Cash config.php is expected to expose
     * the MongoDB database connection.
     *
     * The code below supports the common variable names used
     * in the project.
     */

    $database = null;


    if (
        isset($db) &&
        $db instanceof MongoDB\Database
    ) {

        $database = $db;

    } elseif (
        isset($database) &&
        $database instanceof MongoDB\Database
    ) {

        /*
         * Keep existing database variable.
         */

    } elseif (
        isset($mongoDatabase) &&
        $mongoDatabase instanceof MongoDB\Database
    ) {

        $database = $mongoDatabase;

    }


    /*
     * If config.php exposes $database, use it.
     */

    if (
        $database === null &&
        isset($database) &&
        $database instanceof MongoDB\Database
    ) {

        $database = $database;

    }


    /*
     * Crown Cash's config.php normally uses $db.
     */

    if (
        $database === null &&
        isset($db) &&
        $db instanceof MongoDB\Database
    ) {

        $database = $db;

    }


    /*
     * If no database variable was exposed, attempt to use
     * the configured MongoDB URI directly.
     */

    if ($database === null) {

        $mongodbUri =
            getenv('MONGODB_URI');

        if (
            !$mongodbUri &&
            isset($_ENV['MONGODB_URI'])
        ) {

            $mongodbUri =
                $_ENV['MONGODB_URI'];

        }


        if (!$mongodbUri) {

            throw new RuntimeException(
                'MONGODB_URI is not configured.'
            );

        }


        $mongoClient =
            new MongoDB\Client(
                $mongodbUri
            );


        $database =
            $mongoClient->selectDatabase(
                'crowncash'
            );

    }


    $depositsCollection =
        $database->selectCollection(
            'deposits'
        );


    $usersCollection =
        $database->selectCollection(
            'users'
        );


} catch (Throwable $e) {

    error_log(
        'Crown Cash deposit database error: ' .
        $e->getMessage()
    );

    sendJson(
        false,
        'Unable to connect to the database.',
        [],
        500
    );

}


/* =========================================================
   GET — DEPOSIT HISTORY
   ========================================================= */

if ($_SERVER['REQUEST_METHOD'] === 'GET') {

    /*
     * Require a logged-in user.
     */

    if (
        empty($_SESSION['logged_in'])
    ) {

        sendJson(
            false,
            'You must be logged in to view deposits.',
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


        /*
         * Prefer user ID.
         */

        if ($sessionUserId) {

            $query['user_id'] =
                (string) $sessionUserId;

        } elseif ($sessionEmail) {

            $query['email'] =
                strtolower(
                    trim(
                        (string) $sessionEmail
                    )
                );

        }


        $cursor =
            $depositsCollection->find(
                $query,
                [
                    'sort' => [
                        'created_at' => -1
                    ],
                    'limit' => 20
                ]
            );


        $deposits = [];


        foreach ($cursor as $deposit) {

            $deposits[] =
                convertMongoDocument(
                    $deposit
                );

        }


        sendJson(
            true,
            'Deposit history loaded.',
            [
                'deposits' => $deposits
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
   CHECK LOGIN
   ========================================================= */

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


/* =========================================================
   IDENTIFY USER
   ========================================================= */

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


/* =========================================================
   READ REQUEST BODY
   ========================================================= */

$rawInput =
    file_get_contents('php://input');


if (!$rawInput) {

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


/* =========================================================
   READ AMOUNT
   ========================================================= */

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


if (!is_finite($amount)) {

    sendJson(
        false,
        'Invalid deposit amount.',
        [],
        400
    );

}


/* =========================================================
   MINIMUM DEPOSIT
   ========================================================= */

$minimumDeposit =
    10000;


if ($amount < $minimumDeposit) {

    sendJson(
        false,
        'The minimum deposit amount is UGX 10,000.',
        [],
        400
    );

}


/* =========================================================
   WHOLE THOUSAND VALIDATION
   ========================================================= */

if (
    fmod($amount, 1000) !== 0.0
) {

    sendJson(
        false,
        'Deposit amounts must be in multiples of UGX 1,000.',
        [],
        400
    );

}


/* =========================================================
   PAYMENT METHOD
   ========================================================= */

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


/* =========================================================
   MERCHANT CODES
   ========================================================= */

$merchantCodes = [

    'mtn' => '80257065',

    'airtel' => '7229487'

];


$expectedMerchantCode =
    $merchantCodes[
        $paymentMethod
    ];


/* =========================================================
   TRANSACTION REFERENCE
   ========================================================= */

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


if (!$transactionReference) {

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


/* =========================================================
   OPTIONAL CLIENT MERCHANT CODE
   ========================================================= */

$clientMerchantCode =
    $data['merchant_code'] ??
    $data['merchantCode'] ??
    null;


if ($clientMerchantCode !== null) {

    $clientMerchantCode =
        trim(
            (string) $clientMerchantCode
        );


    /*
     * Do not trust the frontend.
     *
     * Compare the submitted value with the server-side
     * merchant code.
     */

    if (
        $clientMerchantCode !==
        $expectedMerchantCode
    ) {

        sendJson(
            false,
            'Invalid merchant payment information.',
            [],
            400
        );

    }

}


/* =========================================================
   FIND USER
   ========================================================= */

try {

    $user = null;


    if ($sessionUserId) {

        $userIdString =
            (string) $sessionUserId;


        $user = findUserByPossibleId(
            $usersCollection,
            $userIdString
        );

    }


    /*
     * Fall back to email if user ID did not find a user.
     */

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
            $usersCollection->findOne(
                [
                    'email' => $email
                ]
            );

    }


    if ($user === null) {

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
        'Unable to identify your account.',
        [],
        500
    );

}


/* =========================================================
   USER INFORMATION
   ========================================================= */

$userArray =
    convertMongoDocument(
        $user
    );


$userId =
    extractUserId(
        $userArray
    );


if (!$userId) {

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


if (!$userName) {

    $userName =
        $userArray['name'] ??
        $userArray['full_name'] ??
        $userArray['fullName'] ??
        'Crown Cash User';

}


/* =========================================================
   CHECK DUPLICATE TRANSACTION REFERENCE
   ========================================================= */

try {

    $existingDeposit =
        $depositsCollection->findOne(
            [
                'transaction_reference' =>
                    $transactionReference
            ]
        );


    if ($existingDeposit !== null) {

        sendJson(
            false,
            'This transaction reference has already been submitted.',
            [],
            409
        );

    }

} catch (Throwable $e) {

    error_log(
        'Crown Cash duplicate reference check error: ' .
        $e->getMessage()
    );

    sendJson(
        false,
        'Unable to verify the transaction reference.',
        [],
        500
    );

}


/* =========================================================
   CREATE DEPOSIT DOCUMENT
   ========================================================= */

try {

    $now =
        new MongoDB\BSON\UTCDateTime();


    $depositDocument = [

        /*
         * User
         */

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


        /*
         * Deposit amount
         */

        'amount' =>
            $amount,

        'currency' =>
            'UGX',


        /*
         * Payment information
         */

        'payment_method' =>
            $paymentMethod,

        'paymentMethod' =>
            $paymentMethod,

        'merchant_code' =>
            $expectedMerchantCode,

        'transaction_reference' =>
            $transactionReference,

        'transactionReference' =>
            $transactionReference,


        /*
         * Deposit status
         *
         * ALWAYS pending when first created.
         */

        'status' =>
            'pending',


        /*
         * Verification
         */

        'verified' =>
            false,

        'approved' =>
            false,


        /*
         * Admin approval information
         */

        'approved_by' =>
            null,

        'approved_at' =>
            null,

        'rejection_reason' =>
            null,


        /*
         * Timestamps
         */

        'created_at' =>
            $now,

        'updated_at' =>
            $now

    ];


    $insertResult =
        $depositsCollection->insertOne(
            $depositDocument
        );


    if (
        !$insertResult->isAcknowledged()
    ) {

        throw new RuntimeException(
            'MongoDB did not acknowledge the deposit.'
        );

    }


    $depositId =
        (string)
        $insertResult->getInsertedId();


} catch (Throwable $e) {

    error_log(
        'Crown Cash deposit insert error: ' .
        $e->getMessage()
    );

    sendJson(
        false,
        'Unable to save your deposit request. Please try again.',
        [],
        500
    );

}


/* =========================================================
   SUCCESS RESPONSE
   ========================================================= */

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
                $expectedMerchantCode,

            'transaction_reference' =>
                $transactionReference,

            'status' =>
                'pending',

            'created_at' =>
                gmdate(
                    'c'
                )
        ]
    ]
);


/* =========================================================
   HELPER FUNCTIONS
   ========================================================= */


/**
 * Convert MongoDB values into JSON-safe PHP values.
 */
function jsonSafeValue(
    mixed $value
): mixed {

    if (
        $value instanceof MongoDB\BSON\ObjectId
    ) {

        return (string) $value;

    }


    if (
        $value instanceof MongoDB\BSON\UTCDateTime
    ) {

        return $value
            ->toDateTime()
            ->format('c');

    }


    if (
        $value instanceof MongoDB\Model\BSONDocument ||
        $value instanceof MongoDB\Model\BSONArray
    ) {

        return json_decode(
            $value->toJSON(),
            true
        );

    }


    if (is_array($value)) {

        $result = [];

        foreach ($value as $key => $item) {

            $result[$key] =
                jsonSafeValue(
                    $item
                );

        }

        return $result;

    }


    return $value;

}


/**
 * Convert a MongoDB document to a normal PHP array.
 */
function convertMongoDocument(
    mixed $document
): array {

    $safe =
        jsonSafeValue(
            $document
        );


    if (is_array($safe)) {
        return $safe;
    }


    return [];

}


/**
 * Extract a user ID from possible user ID fields.
 */
function extractUserId(
    array $user
): ?string {

    $possibleFields = [

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
        $possibleFields as $field
    ) {

        if (
            isset($user[$field]) &&
            $user[$field] !== ''
        ) {

            return (string)
                $user[$field];

        }

    }


    return null;

}


/**
 * Find a user using common Crown Cash ID formats.
 */
function findUserByPossibleId(
    MongoDB\Collection $collection,
    string $userId
): ?MongoDB\Model\BSONDocument {

    /*
     * First try ObjectId when appropriate.
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
                $collection->findOne(
                    [
                        '_id' => $objectId
                    ]
                );


            if ($user !== null) {
                return $user;
            }

        } catch (Throwable $e) {

            /*
             * Continue with string lookup.
             */

        }

    }


    /*
     * Try common string ID fields.
     */

    $possibleQueries = [

        [
            'id' => $userId
        ],

        [
            'user_id' => $userId
        ],

        [
            'userId' => $userId
        ],

        [
            'customer_id' => $userId
        ],

        [
            'customerId' => $userId
        ],

        [
            'member_id' => $userId
        ],

        [
            'memberId' => $userId
        ],

        [
            'account_id' => $userId
        ],

        [
            'accountId' => $userId
        ]

    ];


    foreach (
        $possibleQueries as $query
    ) {

        $user =
            $collection->findOne(
                $query
            );


        if ($user !== null) {
            return $user;
        }

    }


    return null;

}