<?php
declare(strict_types=1);

require_once __DIR__ . '/vendor/autoload.php';

use MongoDB\Client;
use MongoDB\BSON\ObjectId;
use MongoDB\BSON\UTCDateTime;

/*
|--------------------------------------------------------------------------
| CROWN CASH - GLOBAL CONFIGURATION
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
| CORS
|--------------------------------------------------------------------------
*/

$allowedOrigin = 'https://crown-cash.vercel.app';

if (
    isset($_SERVER['HTTP_ORIGIN']) &&
    $_SERVER['HTTP_ORIGIN'] === $allowedOrigin
) {
    header(
        'Access-Control-Allow-Origin: ' . $allowedOrigin
    );
}

header('Access-Control-Allow-Credentials: true');

header(
    'Access-Control-Allow-Headers: ' .
    'Content-Type, Authorization, X-Cron-Secret, X-Requested-With'
);

header(
    'Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS'
);

header('Access-Control-Max-Age: 86400');

header(
    'Content-Type: application/json; charset=utf-8'
);


/*
|--------------------------------------------------------------------------
| OPTIONS / PREFLIGHT REQUEST
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
| MONGODB CONNECTION
|--------------------------------------------------------------------------
*/

$mongoUri = getenv('MONGODB_URI');

if (
    !$mongoUri ||
    trim($mongoUri) === ''
) {
    http_response_code(500);

    echo json_encode([
        'success' => false,
        'message' => 'MONGODB_URI is not configured.'
    ]);

    exit;
}


try {

    $mongoClient = new Client(
        $mongoUri
    );

    $databaseName =
        getenv('MONGODB_DATABASE')
        ?: 'crowncash';

    $db = $mongoClient->selectDatabase(
        $databaseName
    );


    /*
    |--------------------------------------------------------------------------
    | COLLECTIONS
    |--------------------------------------------------------------------------
    */

    $users =
        $db->selectCollection('users');

    $deposits =
        $db->selectCollection('deposits');

    $withdrawals =
        $db->selectCollection('withdrawals');

    $investments =
        $db->selectCollection('investments');

    $transactions =
        $db->selectCollection('transactions');

    $referrals =
        $db->selectCollection('referrals');

    $auditLogs =
        $db->selectCollection('audit_logs');

    $earnings =
        $db->selectCollection('earnings');


} catch (Throwable $e) {

    http_response_code(500);

    echo json_encode([
        'success' => false,
        'message' => 'Database connection failed.'
    ]);

    exit;
}


/*
|--------------------------------------------------------------------------
| COMPATIBILITY ALIAS
|--------------------------------------------------------------------------
|
| Some existing Crown Cash files use $client.
|
*/

$client = $mongoClient;


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
|
| The frontend is on Vercel and the API is on Render.
|
| Therefore the browser must be allowed to send the PHP
| session cookie cross-site.
|
| Required:
|
| SameSite=None
| Secure=true
| HttpOnly=true
|
|--------------------------------------------------------------------------
*/

function startSecureSession(): void
{
    if (
        session_status() === PHP_SESSION_ACTIVE
    ) {
        return;
    }


    /*
    |--------------------------------------------------------------------------
    | Prevent PHP from changing the session ID unnecessarily
    |--------------------------------------------------------------------------
    */

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


    /*
    |--------------------------------------------------------------------------
    | Explicit session cookie configuration
    |--------------------------------------------------------------------------
    */

    session_name('CROWN_CASH_SESSION');

    session_set_cookie_params([
        'lifetime' => 0,
        'path' => '/',
        'domain' => '',
        'secure' => true,
        'httponly' => true,
        'samesite' => 'None'
    ]);


    /*
    |--------------------------------------------------------------------------
    | Start session
    |--------------------------------------------------------------------------
    */

    session_start();
}


/*
|--------------------------------------------------------------------------
| OBJECT ID VALIDATION
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


/*
|--------------------------------------------------------------------------
| OBJECT ID CONVERSION
|--------------------------------------------------------------------------
*/

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
| MONGODB DATE → ISO DATE
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
| MONGODB → JSON SAFE
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
| CURRENT LOGGED-IN USER ID
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

            $id = objectIdOrNull(
                (string)$_SESSION[$key]
            );


            if ($id instanceof ObjectId) {
                return $id;
            }
        }
    }


    return null;
}


/*
|--------------------------------------------------------------------------
| CHECK LOGIN STATUS
|--------------------------------------------------------------------------
*/

function isLoggedIn(): bool
{
    startSecureSession();


    if (
        empty($_SESSION['logged_in'])
    ) {
        return false;
    }


    return currentUserId() !== null;
}


/*
|--------------------------------------------------------------------------
| REQUIRE LOGIN
|--------------------------------------------------------------------------
*/

function requireLogin(): ObjectId
{
    startSecureSession();


    $userId = currentUserId();


    if (
        !$userId ||
        empty($_SESSION['logged_in'])
    ) {

        jsonResponse([
            'success' => false,
            'authenticated' => false,
            'authorized' => false,
            'message' => 'Authentication required.'
        ], 401);
    }


    return $userId;
}


/*
|--------------------------------------------------------------------------
| REQUIRE ADMINISTRATOR
|--------------------------------------------------------------------------
*/

function requireAdmin(): ObjectId
{
    $userId = requireLogin();

    global $users;


    $user = $users->findOne([
        '_id' => $userId
    ]);


    if (!$user) {

        jsonResponse([
            'success' => false,
            'message' => 'Administrator account not found.'
        ], 403);
    }


    $role =
        strtolower(
            trim(
                (string)(
                    $user['role']
                    ?? $user['account_type']
                    ?? ''
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
            'message' => 'Administrator access required.'
        ], 403);
    }


    return $userId;
}


/*
|--------------------------------------------------------------------------
| CURRENT UTC TIME
|--------------------------------------------------------------------------
*/

function nowUtc(): UTCDateTime
{
    return new UTCDateTime();
}


/*
|--------------------------------------------------------------------------
| MONEY TO WHOLE UGX
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
| ADMIN AUDIT LOG
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
        | Audit failure must not stop the main operation.
        |--------------------------------------------------------------------------
        */
    }
}