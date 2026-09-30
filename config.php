<?php
declare(strict_types=1);

require_once __DIR__ . '/vendor/autoload.php';

use MongoDB\Client;
use MongoDB\BSON\ObjectId;
use MongoDB\BSON\UTCDateTime;

/*
|--------------------------------------------------------------------------
| CORS
|--------------------------------------------------------------------------
*/

header('Access-Control-Allow-Origin: https://crown-cash.vercel.app');
header('Access-Control-Allow-Credentials: true');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Cron-Secret');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

/*
|--------------------------------------------------------------------------
| MongoDB connection
|--------------------------------------------------------------------------
*/

$mongoUri = getenv('MONGODB_URI');

if (!$mongoUri) {
    http_response_code(500);

    echo json_encode([
        'success' => false,
        'message' => 'MONGODB_URI is not configured.'
    ]);

    exit;
}

try {

    $mongoClient = new Client($mongoUri);

    $databaseName = getenv('MONGODB_DATABASE') ?: 'crowncash';

    $db = $mongoClient->selectDatabase($databaseName);

    /*
    |--------------------------------------------------------------------------
    | Collections
    |--------------------------------------------------------------------------
    */

    $users = $db->selectCollection('users');

    $deposits = $db->selectCollection('deposits');

    $withdrawals = $db->selectCollection('withdrawals');

    $investments = $db->selectCollection('investments');

    $transactions = $db->selectCollection('transactions');

    $referrals = $db->selectCollection('referrals');

    $auditLogs = $db->selectCollection('audit_logs');

    /*
    |--------------------------------------------------------------------------
    | NEW
    | Daily investment earnings ledger
    |--------------------------------------------------------------------------
    */

    $earnings = $db->selectCollection('earnings');

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
| Compatibility alias
|--------------------------------------------------------------------------
|
| Some of the older admin files used $client while config.php created
| $mongoClient. We provide both so the transaction code works.
|
*/

$client = $mongoClient;


/*
|--------------------------------------------------------------------------
| JSON response helper
|--------------------------------------------------------------------------
*/

function jsonResponse(array $data, int $status = 200): never
{
    http_response_code($status);

    echo json_encode(
        $data,
        JSON_UNESCAPED_SLASHES
    );

    exit;
}


/*
|--------------------------------------------------------------------------
| Secure session
|--------------------------------------------------------------------------
*/

function startSecureSession(): void
{
    if (session_status() === PHP_SESSION_ACTIVE) {
        return;
    }

    session_set_cookie_params([
        'lifetime' => 0,
        'path' => '/',
        'secure' => true,
        'httponly' => true,
        'samesite' => 'None'
    ]);

    session_start();
}


/*
|--------------------------------------------------------------------------
| ObjectId validation
|--------------------------------------------------------------------------
*/

function isValidObjectId(string $id): bool
{
    return preg_match(
        '/^[a-f0-9]{24}$/i',
        $id
    ) === 1;
}


/*
|--------------------------------------------------------------------------
| Convert value to ObjectId
|--------------------------------------------------------------------------
*/

function objectIdOrNull(mixed $value): ?ObjectId
{
    if ($value instanceof ObjectId) {
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
| Convert MongoDB date to ISO string
|--------------------------------------------------------------------------
*/

function toIsoDate(mixed $value): ?string
{
    if ($value instanceof UTCDateTime) {

        return $value
            ->toDateTime()
            ->format(DATE_ATOM);
    }

    if ($value instanceof DateTimeInterface) {

        return $value->format(DATE_ATOM);
    }

    if (
        is_string($value) &&
        $value !== ''
    ) {
        return $value;
    }

    return null;
}


/*
|--------------------------------------------------------------------------
| Convert MongoDB values to JSON-safe values
|--------------------------------------------------------------------------
*/

function jsonSafe(mixed $value): mixed
{
    if ($value instanceof ObjectId) {
        return (string)$value;
    }

    if ($value instanceof UTCDateTime) {
        return $value
            ->toDateTime()
            ->format(DATE_ATOM);
    }

    if ($value instanceof DateTimeInterface) {
        return $value->format(DATE_ATOM);
    }

    if (is_array($value)) {

        $output = [];

        foreach ($value as $key => $item) {
            $output[$key] = jsonSafe($item);
        }

        return $output;
    }

    if (is_object($value)) {

        $output = [];

        foreach (get_object_vars($value) as $key => $item) {
            $output[$key] = jsonSafe($item);
        }

        return $output;
    }

    return $value;
}


/*
|--------------------------------------------------------------------------
| Current logged-in user
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

    foreach ($possibleKeys as $key) {

        if (!empty($_SESSION[$key])) {

            $id = objectIdOrNull(
                (string)$_SESSION[$key]
            );

            if ($id) {
                return $id;
            }
        }
    }

    return null;
}


/*
|--------------------------------------------------------------------------
| Require login
|--------------------------------------------------------------------------
*/

function requireLogin(): ObjectId
{
    $userId = currentUserId();

    if (
        !$userId ||
        empty($_SESSION['logged_in'])
    ) {

        jsonResponse([
            'success' => false,
            'message' => 'Authentication required.'
        ], 401);
    }

    return $userId;
}


/*
|--------------------------------------------------------------------------
| Require administrator
|--------------------------------------------------------------------------
*/

function requireAdmin(): ObjectId
{
    $userId = requireLogin();

    global $users;

    $user = $users->findOne([
        '_id' => $userId
    ]);

    if (
        !$user ||
        strtolower(
            (string)($user['role'] ?? '')
        ) !== 'admin'
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
| Current UTC MongoDB date
|--------------------------------------------------------------------------
*/

function nowUtc(): UTCDateTime
{
    return new UTCDateTime();
}


/*
|--------------------------------------------------------------------------
| Convert money to whole Uganda shillings
|--------------------------------------------------------------------------
*/

function moneyInt(mixed $value): int
{
    return (int)round(
        (float)$value
    );
}


/*
|--------------------------------------------------------------------------
| Admin audit logging
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
            'action' => $action,
            'admin_id' => $adminId,
            'data' => $data,
            'created_at' => nowUtc()
        ]);

    } catch (Throwable $e) {

        /*
        | Audit failure should not stop the main transaction.
        */
    }
}