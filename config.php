<?php
declare(strict_types=1);

require_once __DIR__ . '/vendor/autoload.php';

use MongoDB\Client;
use MongoDB\BSON\ObjectId;
use MongoDB\BSON\UTCDateTime;


/*
|--------------------------------------------------------------------------
| CROWN CASH GLOBAL CONFIG
|--------------------------------------------------------------------------
*/

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
}

header(
    'Access-Control-Allow-Credentials: true'
);

header(
    'Access-Control-Allow-Headers: ' .
    'Content-Type, Authorization, X-Cron-Secret, X-Requested-With'
);

header(
    'Access-Control-Allow-Methods: ' .
    'GET, POST, PUT, PATCH, DELETE, OPTIONS'
);

header(
    'Access-Control-Max-Age: 86400'
);

header(
    'Vary: Origin'
);

header(
    'Content-Type: application/json; charset=utf-8'
);


/*
|--------------------------------------------------------------------------
| CORS PREFLIGHT
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
| MONGODB
|--------------------------------------------------------------------------
*/

$mongoUri =
    getenv('MONGODB_URI');

if (
    !$mongoUri ||
    trim($mongoUri) === ''
) {

    http_response_code(500);

    echo json_encode([
        'success' => false,
        'message' =>
            'MONGODB_URI is not configured.'
    ]);

    exit;
}


try {

    $mongoClient =
        new Client($mongoUri);

    $databaseName =
        getenv('MONGODB_DATABASE')
        ?: 'crowncash';

    $db =
        $mongoClient->selectDatabase(
            $databaseName
        );


    $users =
        $db->selectCollection(
            'users'
        );

    $deposits =
        $db->selectCollection(
            'deposits'
        );

    $withdrawals =
        $db->selectCollection(
            'withdrawals'
        );

    $investments =
        $db->selectCollection(
            'investments'
        );

    $transactions =
        $db->selectCollection(
            'transactions'
        );

    $referrals =
        $db->selectCollection(
            'referrals'
        );

    $auditLogs =
        $db->selectCollection(
            'audit_logs'
        );

    $earnings =
        $db->selectCollection(
            'earnings'
        );


} catch (Throwable $e) {

    http_response_code(500);

    echo json_encode([
        'success' => false,
        'message' =>
            'Database connection failed.'
    ]);

    exit;
}


/*
|--------------------------------------------------------------------------
| COMPATIBILITY ALIAS
|--------------------------------------------------------------------------
*/

$client =
    $mongoClient;


/*
|--------------------------------------------------------------------------
| JSON RESPONSE
|--------------------------------------------------------------------------
*/

function jsonResponse(
    array $data,
    int $status = 200
): never {

    http_response_code($status);

    echo json_encode(
        $data,
        JSON_UNESCAPED_SLASHES |
        JSON_UNESCAPED_UNICODE
    );

    exit;
}


/*
|--------------------------------------------------------------------------
| SECURE CROSS-SITE SESSION
|--------------------------------------------------------------------------
*/

function startSecureSession(): void
{
    if (
        session_status() === PHP_SESSION_ACTIVE
    ) {
        return;
    }


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


/*
|--------------------------------------------------------------------------
| OBJECT ID
|--------------------------------------------------------------------------
*/

function isValidObjectId(
    string $id
): bool {

    return preg_match(
        '/^[a-f0-9]{24}$/i',
        $id
    ) === 1;
}


function objectIdOrNull(
    mixed $value
): ?ObjectId {

    if (
        $value instanceof ObjectId
    ) {
        return $value;
    }


    if (
        is_string($value) &&
        isValidObjectId($value)
    ) {

        return new ObjectId($value);
    }


    return null;
}


/*
|--------------------------------------------------------------------------
| DATE HELPERS
|--------------------------------------------------------------------------
*/

function toIsoDate(
    mixed $value
): ?string {

    if (
        $value instanceof UTCDateTime
    ) {

        return $value
            ->toDateTime()
            ->format(DATE_ATOM);
    }


    if (
        $value instanceof DateTimeInterface
    ) {

        return $value->format(
            DATE_ATOM
        );
    }


    if (
        is_string($value) &&
        trim($value) !== ''
    ) {

        return $value;
    }


    return null;
}


/*
|--------------------------------------------------------------------------
| JSON SAFE
|--------------------------------------------------------------------------
*/

function jsonSafe(
    mixed $value
): mixed {

    if (
        $value instanceof ObjectId
    ) {

        return (string)$value;
    }


    if (
        $value instanceof UTCDateTime
    ) {

        return $value
            ->toDateTime()
            ->format(DATE_ATOM);
    }


    if (
        $value instanceof DateTimeInterface
    ) {

        return $value->format(
            DATE_ATOM
        );
    }


    if (is_array($value)) {

        $output = [];

        foreach (
            $value as $key => $item
        ) {

            $output[$key] =
                jsonSafe($item);
        }

        return $output;
    }


    if (is_object($value)) {

        $output = [];

        foreach (
            get_object_vars($value)
            as $key => $item
        ) {

            $output[$key] =
                jsonSafe($item);
        }

        return $output;
    }


    return $value;
}


/*
|--------------------------------------------------------------------------
| CURRENT USER
|--------------------------------------------------------------------------
*/

function currentUserId(): ?ObjectId
{
    startSecureSession();


    $possibleKeys = [
        'user_id',
        'userId',
        'id',
        '_id'
    ];


    foreach (
        $possibleKeys as $key
    ) {

        if (
            isset($_SESSION[$key]) &&
            $_SESSION[$key] !== ''
        ) {

            $id =
                objectIdOrNull(
                    (string)$_SESSION[$key]
                );


            if (
                $id instanceof ObjectId
            ) {

                return $id;
            }
        }
    }


    return null;
}


/*
|--------------------------------------------------------------------------
| LOGIN REQUIRED
|--------------------------------------------------------------------------
*/

function requireLogin(): ObjectId
{
    startSecureSession();


    $userId =
        currentUserId();


    if (
        !$userId ||
        empty($_SESSION['logged_in'])
    ) {

        jsonResponse([
            'success' => false,
            'authenticated' => false,
            'authorized' => false,
            'message' =>
                'Authentication required.'
        ], 401);
    }


    return $userId;
}


/*
|--------------------------------------------------------------------------
| ADMIN REQUIRED
|--------------------------------------------------------------------------
*/

function requireAdmin(): ObjectId
{
    $userId =
        requireLogin();


    global $users;


    $user =
        $users->findOne([
            '_id' => $userId
        ]);


    if (!$user) {

        jsonResponse([
            'success' => false,
            'message' =>
                'Administrator account not found.'
        ], 403);
    }


    $role =
        strtolower(
            trim(
                (string)(
                    $user['role'] ??
                    $user['account_type'] ??
                    ''
                )
            )
        );


    $adminRoles = [
        'admin',
        'administrator',
        'superadmin',
        'super_admin'
    ];


    if (
        !in_array(
            $role,
            $adminRoles,
            true
        )
    ) {

        jsonResponse([
            'success' => false,
            'message' =>
                'Administrator access required.'
        ], 403);
    }


    return $userId;
}


/*
|--------------------------------------------------------------------------
| TIME
|--------------------------------------------------------------------------
*/

function nowUtc(): UTCDateTime
{
    return new UTCDateTime();
}


/*
|--------------------------------------------------------------------------
| MONEY
|--------------------------------------------------------------------------
*/

function moneyInt(
    mixed $value
): int {

    return (int)round(
        (float)$value
    );
}


/*
|--------------------------------------------------------------------------
| AUDIT
|--------------------------------------------------------------------------
*/

function audit(
    string $action,
    ?ObjectId $adminId,
    array $data = []
): void {

    global $auditLogs;


    try {

        $auditLogs->insertOne([

            'action' =>
                $action,

            'admin_id' =>
                $adminId,

            'data' =>
                jsonSafe($data),

            'created_at' =>
                nowUtc()

        ]);

    } catch (Throwable $e) {

        /*
        |--------------------------------------------------------------------------
        | Audit failure must never break the main operation.
        |--------------------------------------------------------------------------
        */
    }
}