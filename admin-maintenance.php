<?php

declare(strict_types=1);

/*
|--------------------------------------------------------------------------
| CROWN CASH - ADMIN MAINTENANCE API
|--------------------------------------------------------------------------
| Version: 2026-10-03
|
| SECURITY:
| - Public status is available through ?public=1.
| - All administrative GET/POST operations require authentication.
| - Admin authorization is verified against the users collection.
| - A normal user cannot gain access by manipulating session role values.
| - ADMIN_USER_ID / ADMIN_EMAIL can restrict an already-authorized admin,
|   but can NEVER grant admin privileges.
|--------------------------------------------------------------------------
*/

require_once __DIR__ . '/config.php';

/*
|--------------------------------------------------------------------------
| SESSION
|--------------------------------------------------------------------------
*/

if (function_exists('startSecureSession')) {
    startSecureSession();
} else {
    if (session_status() !== PHP_SESSION_ACTIVE) {
        if (session_name() !== 'CROWN_CASH_SESSION') {
            session_name('CROWN_CASH_SESSION');
        }

        session_start();
    }
}

/*
|--------------------------------------------------------------------------
| CORS
|--------------------------------------------------------------------------
*/

$allowedOrigins = [
    'https://crown-cash.vercel.app',
    'https://www.crown-cash.vercel.app',
];

$requestOrigin = $_SERVER['HTTP_ORIGIN'] ?? '';

if (
    $requestOrigin !== '' &&
    in_array($requestOrigin, $allowedOrigins, true)
) {
    header(
        'Access-Control-Allow-Origin: ' . $requestOrigin
    );

    header('Vary: Origin');
}

header('Access-Control-Allow-Credentials: true');
header(
    'Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With'
);
header(
    'Access-Control-Allow-Methods: GET, POST, OPTIONS'
);
header('Access-Control-Max-Age: 86400');
header('Content-Type: application/json; charset=utf-8');

if (
    ($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'OPTIONS'
) {
    http_response_code(204);
    exit;
}

/*
|--------------------------------------------------------------------------
| RESPONSE
|--------------------------------------------------------------------------
*/

function maintenanceResponse(
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
| BASIC HELPERS
|--------------------------------------------------------------------------
*/

function maintenanceUserIdValue(
    array $user
): mixed {
    if (isset($user['_id'])) {
        return $user['_id'];
    }

    if (!empty($user['id'])) {
        return $user['id'];
    }

    if (!empty($user['user_id'])) {
        return $user['user_id'];
    }

    if (!empty($user['userId'])) {
        return $user['userId'];
    }

    return null;
}

function maintenanceString(
    mixed $value
): string {
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
        is_string($value) ||
        is_numeric($value)
    ) {
        return trim((string) $value);
    }

    return '';
}

function maintenanceObjectId(
    mixed $value
): ?MongoDB\BSON\ObjectId {
    if (
        $value instanceof MongoDB\BSON\ObjectId
    ) {
        return $value;
    }

    $value = trim((string) $value);

    if (
        $value === '' ||
        !preg_match(
            '/^[a-f0-9]{24}$/i',
            $value
        )
    ) {
        return null;
    }

    try {
        return new MongoDB\BSON\ObjectId(
            $value
        );
    } catch (Throwable $e) {
        return null;
    }
}

/*
|--------------------------------------------------------------------------
| FIND USER
|--------------------------------------------------------------------------
*/

function maintenanceFindUser(
    mixed $userId
): ?array {
    global $users;

    if (
        !isset($users) ||
        !($users instanceof MongoDB\Collection)
    ) {
        return null;
    }

    /*
     * ObjectId lookup.
     */
    $objectId =
        maintenanceObjectId($userId);

    if ($objectId !== null) {

        $user =
            $users->findOne([
                '_id' => $objectId,
            ]);

        if ($user !== null) {
            return $user->getArrayCopy();
        }
    }

    /*
     * String ID lookup.
     */
    $stringId =
        trim((string) $userId);

    if ($stringId !== '') {

        $user =
            $users->findOne([
                '$or' => [
                    ['id' => $stringId],
                    ['user_id' => $stringId],
                    ['userId' => $stringId],
                ],
            ]);

        if ($user !== null) {
            return $user->getArrayCopy();
        }
    }

    return null;
}

/*
|--------------------------------------------------------------------------
| DATABASE ADMIN ROLE CHECK
|--------------------------------------------------------------------------
*/

function maintenanceUserIsAdmin(
    array $user
): bool {

    $role =
        strtolower(
            trim(
                (string) (
                    $user['role'] ?? ''
                )
            )
        );

    $accountType =
        strtolower(
            trim(
                (string) (
                    $user['account_type'] ?? ''
                )
            )
        );

    $isAdmin =
        isset($user['is_admin']) &&
        $user['is_admin'] === true;

    return
        $isAdmin ||
        in_array(
            $role,
            [
                'admin',
                'administrator',
            ],
            true
        ) ||
        in_array(
            $accountType,
            [
                'admin',
                'administrator',
            ],
            true
        );
}

/*
|--------------------------------------------------------------------------
| ADMIN AUTHENTICATION
|--------------------------------------------------------------------------
|
| This is the actual security boundary.
|
| Session role values are NOT trusted as the sole source of
| authorization. The user is loaded from the database and the
| database record is checked.
|--------------------------------------------------------------------------
*/

function maintenanceRequireAdmin(): array
{
    /*
     * Verify login session.
     */
    $loggedIn =
        !empty($_SESSION['logged_in']) ||
        !empty($_SESSION['authenticated']);

    if (!$loggedIn) {

        maintenanceResponse(
            [
                'success' => false,
                'message' =>
                    'Administrator authentication is required.',
            ],
            401
        );
    }

    /*
     * Get session user ID.
     */
    $sessionUserId =
        $_SESSION['user_id']
        ?? $_SESSION['userId']
        ?? $_SESSION['id']
        ?? $_SESSION['_id']
        ?? null;

    if (
        $sessionUserId === null ||
        trim((string) $sessionUserId) === ''
    ) {
        maintenanceResponse(
            [
                'success' => false,
                'message' =>
                    'Administrator authentication is required.',
            ],
            401
        );
    }

    /*
     * Load authoritative user record.
     */
    $currentUser =
        maintenanceFindUser(
            $sessionUserId
        );

    if ($currentUser === null) {

        maintenanceResponse(
            [
                'success' => false,
                'message' =>
                    'Administrator account was not found.',
            ],
            401
        );
    }

    /*
     * Check account status.
     */
    $accountStatus =
        strtolower(
            trim(
                (string) (
                    $currentUser['status']
                    ?? $currentUser['account_status']
                    ?? 'active'
                )
            )
        );

    if (
        in_array(
            $accountStatus,
            [
                'blocked',
                'suspended',
                'disabled',
                'banned',
                'inactive',
            ],
            true
        )
    ) {

        maintenanceResponse(
            [
                'success' => false,
                'message' =>
                    'Administrator account is not active.',
            ],
            403
        );
    }

    /*
     * ACTUAL DATABASE ADMIN CHECK.
     */
    if (
        !maintenanceUserIsAdmin(
            $currentUser
        )
    ) {

        maintenanceResponse(
            [
                'success' => false,
                'message' =>
                    'Administrator access denied.',
            ],
            403
        );
    }

    /*
     * Optional environment restriction.
     *
     * IMPORTANT:
     * These values only restrict an already-authorized admin.
     * They never grant administrator privileges.
     */
    $configuredAdminId =
        trim(
            (string) (
                getenv('ADMIN_USER_ID') ?: ''
            )
        );

    $configuredAdminEmail =
        strtolower(
            trim(
                (string) (
                    getenv('ADMIN_EMAIL') ?: ''
                )
            )
        );

    $actualAdminId =
        maintenanceString(
            maintenanceUserIdValue(
                $currentUser
            )
        );

    $actualAdminEmail =
        strtolower(
            trim(
                (string) (
                    $currentUser['email'] ?? ''
                )
            )
        );

    if (
        $configuredAdminId !== '' &&
        $actualAdminId !== $configuredAdminId
    ) {

        maintenanceResponse(
            [
                'success' => false,
                'message' =>
                    'Administrator authorization failed.',
            ],
            403
        );
    }

    if (
        $configuredAdminEmail !== '' &&
        $actualAdminEmail !== $configuredAdminEmail
    ) {

        maintenanceResponse(
            [
                'success' => false,
                'message' =>
                    'Administrator authorization failed.',
            ],
            403
        );
    }

    return $currentUser;
}

/*
|--------------------------------------------------------------------------
| DATABASE
|--------------------------------------------------------------------------
*/

function maintenanceDatabase(): object
{
    global $db;

    if (
        isset($db) &&
        is_object($db)
    ) {
        return $db;
    }

    global $database;

    if (
        isset($database) &&
        is_object($database)
    ) {
        return $database;
    }

    global $mongoDb;

    if (
        isset($mongoDb) &&
        is_object($mongoDb)
    ) {
        return $mongoDb;
    }

    maintenanceResponse(
        [
            'success' => false,
            'message' =>
                'Database connection is not available.',
        ],
        500
    );
}

/*
|--------------------------------------------------------------------------
| SETTINGS COLLECTION
|--------------------------------------------------------------------------
*/

function maintenanceCollection()
{
    $database =
        maintenanceDatabase();

    if (
        method_exists(
            $database,
            'selectCollection'
        )
    ) {

        return $database->selectCollection(
            'platform_settings'
        );
    }

    if (
        isset(
            $database->platform_settings
        )
    ) {

        return $database->platform_settings;
    }

    maintenanceResponse(
        [
            'success' => false,
            'message' =>
                'Platform settings collection is unavailable.',
        ],
        500
    );
}

/*
|--------------------------------------------------------------------------
| DEFAULT SETTINGS
|--------------------------------------------------------------------------
*/

function defaultMaintenanceSettings(): array
{
    return [

        'maintenance_mode' =>
            false,

        'new_investments' =>
            true,

        'deposits' =>
            true,

        'withdrawals' =>
            true,

        'daily_earnings' =>
            true,

        'user_registration' =>
            true,

        'maintenance_message' =>
            'Crown Cash is temporarily under maintenance. Please check back shortly.',

        'last_earnings_run' =>
            null,

        'earnings_processed_today' =>
            0,

        'updated_at' =>
            null,
    ];
}

/*
|--------------------------------------------------------------------------
| BOOLEAN NORMALIZATION
|--------------------------------------------------------------------------
*/

function maintenanceBoolean(
    mixed $value,
    bool $default = false
): bool {

    if (is_bool($value)) {
        return $value;
    }

    if (
        is_int($value) ||
        is_float($value)
    ) {
        return (bool) $value;
    }

    if (is_string($value)) {

        $value =
            strtolower(
                trim($value)
            );

        if (
            in_array(
                $value,
                [
                    'true',
                    '1',
                    'yes',
                    'on',
                    'enabled',
                ],
                true
            )
        ) {
            return true;
        }

        if (
            in_array(
                $value,
                [
                    'false',
                    '0',
                    'no',
                    'off',
                    'disabled',
                ],
                true
            )
        ) {
            return false;
        }
    }

    return $default;
}

/*
|--------------------------------------------------------------------------
| GET SETTINGS
|--------------------------------------------------------------------------
*/

function getMaintenanceSettings(): array
{
    $collection =
        maintenanceCollection();

    $document =
        $collection->findOne([
            '_id' =>
                'crown_cash_platform',
        ]);

    $settings =
        defaultMaintenanceSettings();

    if ($document !== null) {

        $array =
            method_exists(
                $document,
                'getArrayCopy'
            )
                ? $document->getArrayCopy()
                : (array) $document;

        foreach (
            $settings as $key => $default
        ) {

            if (
                array_key_exists(
                    $key,
                    $array
                )
            ) {

                $settings[$key] =
                    $array[$key];
            }
        }
    }

    $settings['maintenance_mode'] =
        maintenanceBoolean(
            $settings['maintenance_mode'],
            false
        );

    $settings['new_investments'] =
        maintenanceBoolean(
            $settings['new_investments'],
            true
        );

    $settings['deposits'] =
        maintenanceBoolean(
            $settings['deposits'],
            true
        );

    $settings['withdrawals'] =
        maintenanceBoolean(
            $settings['withdrawals'],
            true
        );

    $settings['daily_earnings'] =
        maintenanceBoolean(
            $settings['daily_earnings'],
            true
        );

    $settings['user_registration'] =
        maintenanceBoolean(
            $settings['user_registration'],
            true
        );

    $settings['maintenance_message'] =
        trim(
            (string)
            $settings['maintenance_message']
        );

    return $settings;
}

/*
|--------------------------------------------------------------------------
| SAVE SETTINGS
|--------------------------------------------------------------------------
*/

function saveMaintenanceSettings(
    array $input
): array {

    $collection =
        maintenanceCollection();

    $current =
        getMaintenanceSettings();

    $settings = [

        'maintenance_mode' =>
            maintenanceBoolean(
                $input['maintenance_mode']
                ?? $current['maintenance_mode'],
                false
            ),

        'new_investments' =>
            maintenanceBoolean(
                $input['new_investments']
                ?? $current['new_investments'],
                true
            ),

        'deposits' =>
            maintenanceBoolean(
                $input['deposits']
                ?? $current['deposits'],
                true
            ),

        'withdrawals' =>
            maintenanceBoolean(
                $input['withdrawals']
                ?? $current['withdrawals'],
                true
            ),

        'daily_earnings' =>
            maintenanceBoolean(
                $input['daily_earnings']
                ?? $current['daily_earnings'],
                true
            ),

        'user_registration' =>
            maintenanceBoolean(
                $input['user_registration']
                ?? $current['user_registration'],
                true
            ),

        'maintenance_message' =>
            trim(
                (string) (
                    $input['maintenance_message']
                    ?? $current['maintenance_message']
                )
            ),

        'updated_at' =>
            new MongoDB\BSON\UTCDateTime(),
    ];

    if (
        $settings['maintenance_message'] === ''
    ) {

        $settings['maintenance_message'] =
            'Crown Cash is temporarily under maintenance. Please check back shortly.';
    }

    if (
        strlen(
            $settings['maintenance_message']
        ) > 500
    ) {

        $settings['maintenance_message'] =
            substr(
                $settings['maintenance_message'],
                0,
                500
            );
    }

    $collection->updateOne(

        [
            '_id' =>
                'crown_cash_platform',
        ],

        [
            '$set' =>
                $settings,

            '$setOnInsert' => [
                'created_at' =>
                    new MongoDB\BSON\UTCDateTime(),
            ],
        ],

        [
            'upsert' => true,
        ]
    );

    return getMaintenanceSettings();
}

/*
|--------------------------------------------------------------------------
| EARNINGS MONITOR
|--------------------------------------------------------------------------
*/

function getEarningsMonitor(
    array $settings
): array {

    $activeInvestments = 0;
    $pendingInvestments = 0;

    try {

        $database =
            maintenanceDatabase();

        if (
            method_exists(
                $database,
                'selectCollection'
            )
        ) {

            $investments =
                $database->selectCollection(
                    'investments'
                );

            $activeInvestments =
                $investments->countDocuments([
                    'status' => [
                        '$in' => [
                            'approved',
                            'active',
                            'running',
                        ],
                    ],
                ]);

            $pendingInvestments =
                $investments->countDocuments([
                    'status' => 'pending',
                ]);
        }

    } catch (Throwable $error) {

        error_log(
            'Maintenance monitor error: ' .
            $error->getMessage()
        );
    }

    return [

        'last_run' =>
            $settings['last_earnings_run'],

        'processed_today' =>
            $settings['earnings_processed_today'],

        'active_investments' =>
            (int) $activeInvestments,

        'pending_investments' =>
            (int) $pendingInvestments,
    ];
}

/*
|--------------------------------------------------------------------------
| RECORD EARNINGS RUN
|--------------------------------------------------------------------------
*/

function recordEarningsRun(
    float $processedAmount = 0
): array {

    $collection =
        maintenanceCollection();

    $now =
        new MongoDB\BSON\UTCDateTime();

    /*
     * Reset daily total when the calendar day changes.
     */
    $current =
        $collection->findOne([
            '_id' =>
                'crown_cash_platform',
        ]);

    $previousAmount = 0;

    if ($current !== null) {

        $currentArray =
            method_exists(
                $current,
                'getArrayCopy'
            )
                ? $current->getArrayCopy()
                : (array) $current;

        $previousRun =
            $currentArray['last_earnings_run']
            ?? null;

        if (
            $previousRun instanceof MongoDB\BSON\UTCDateTime
        ) {

            $previousDate =
                $previousRun
                    ->toDateTime()
                    ->format('Y-m-d');

            $currentDate =
                gmdate('Y-m-d');

            if (
                $previousDate === $currentDate
            ) {

                $previousAmount =
                    (float) (
                        $currentArray[
                            'earnings_processed_today'
                        ] ?? 0
                    );
            }
        }
    }

    $newDailyTotal =
        $previousAmount +
        max(0, $processedAmount);

    $collection->updateOne(

        [
            '_id' =>
                'crown_cash_platform',
        ],

        [
            '$set' => [

                'last_earnings_run' =>
                    $now,

                'earnings_processed_today' =>
                    $newDailyTotal,

                'updated_at' =>
                    $now,
            ],

            '$setOnInsert' => [
                'created_at' =>
                    $now,
            ],
        ],

        [
            'upsert' => true,
        ]
    );

    return getMaintenanceSettings();
}

/*
|--------------------------------------------------------------------------
| REQUEST METHOD
|--------------------------------------------------------------------------
*/

$method =
    strtoupper(
        $_SERVER['REQUEST_METHOD'] ?? 'GET'
    );

/*
|--------------------------------------------------------------------------
| PUBLIC STATUS
|--------------------------------------------------------------------------
|
| This endpoint intentionally does not require admin access.
|
| It exposes only the settings necessary for the public application
| to determine whether a service is available.
|--------------------------------------------------------------------------
*/

if (
    $method === 'GET' &&
    isset($_GET['public']) &&
    $_GET['public'] === '1'
) {

    try {

        $settings =
            getMaintenanceSettings();

        maintenanceResponse(
            [
                'success' => true,

                'maintenance_mode' =>
                    $settings['maintenance_mode'],

                'new_investments' =>
                    $settings['new_investments'],

                'deposits' =>
                    $settings['deposits'],

                'withdrawals' =>
                    $settings['withdrawals'],

                'daily_earnings' =>
                    $settings['daily_earnings'],

                'user_registration' =>
                    $settings['user_registration'],

                'maintenance_message' =>
                    $settings['maintenance_message'],
            ]
        );

    } catch (Throwable $error) {

        error_log(
            'Public maintenance status error: ' .
            $error->getMessage()
        );

        maintenanceResponse(
            [
                'success' => false,
                'message' =>
                    'Maintenance status unavailable.',
            ],
            500
        );
    }
}

/*
|--------------------------------------------------------------------------
| ALL ADMIN OPERATIONS REQUIRE SERVER-SIDE ADMIN AUTH
|--------------------------------------------------------------------------
*/

$currentAdmin =
    maintenanceRequireAdmin();

/*
|--------------------------------------------------------------------------
| GET - ADMIN SETTINGS
|--------------------------------------------------------------------------
*/

if ($method === 'GET') {

    try {

        $settings =
            getMaintenanceSettings();

        $monitor =
            getEarningsMonitor(
                $settings
            );

        maintenanceResponse(
            [
                'success' => true,

                'message' =>
                    'Maintenance settings loaded successfully.',

                'settings' =>
                    $settings,

                'maintenance' =>
                    $settings,

                'monitor' =>
                    $monitor,
            ]
        );

    } catch (Throwable $error) {

        error_log(
            'Admin maintenance GET error: ' .
            $error->getMessage()
        );

        maintenanceResponse(
            [
                'success' => false,
                'message' =>
                    'Failed to load maintenance settings.',
            ],
            500
        );
    }
}

/*
|--------------------------------------------------------------------------
| POST
|--------------------------------------------------------------------------
*/

if ($method === 'POST') {

    try {

        $raw =
            file_get_contents(
                'php://input'
            );

        $input = [];

        if (
            $raw !== false &&
            trim($raw) !== ''
        ) {

            $decoded =
                json_decode(
                    $raw,
                    true
                );

            if (
                is_array($decoded)
            ) {
                $input = $decoded;
            }
        }

        /*
         * Support standard POST data too.
         */
        if (
            empty($input) &&
            !empty($_POST)
        ) {

            $input =
                $_POST;
        }

        $action =
            strtolower(
                trim(
                    (string) (
                        $input['action'] ?? ''
                    )
                )
            );

        /*
         * Record daily earnings run.
         */
        if (
            $action ===
            'record_earnings_run'
        ) {

            $processedAmount =
                (float) (
                    $input['processed_amount']
                    ?? $input['amount']
                    ?? 0
                );

            if (
                !is_finite(
                    $processedAmount
                ) ||
                $processedAmount < 0
            ) {

                $processedAmount = 0;
            }

            $settings =
                recordEarningsRun(
                    $processedAmount
                );

            maintenanceResponse(
                [
                    'success' => true,

                    'message' =>
                        'Daily earnings run recorded.',

                    'settings' =>
                        $settings,

                    'admin_id' =>
                        maintenanceString(
                            maintenanceUserIdValue(
                                $currentAdmin
                            )
                        ),
                ]
            );
        }

        /*
         * Normal settings save.
         */
        $settings =
            saveMaintenanceSettings(
                $input
            );

        $monitor =
            getEarningsMonitor(
                $settings
            );

        maintenanceResponse(
            [
                'success' => true,

                'message' =>
                    'Platform maintenance settings saved successfully.',

                'settings' =>
                    $settings,

                'maintenance' =>
                    $settings,

                'monitor' =>
                    $monitor,
            ]
        );

    } catch (Throwable $error) {

        error_log(
            'Admin maintenance POST error: ' .
            $error->getMessage()
        );

        maintenanceResponse(
            [
                'success' => false,
                'message' =>
                    'Unable to update maintenance settings.',
            ],
            500
        );
    }
}

/*
|--------------------------------------------------------------------------
| METHOD NOT ALLOWED
|--------------------------------------------------------------------------
*/

maintenanceResponse(
    [
        'success' => false,
        'message' =>
            'Method not allowed.',
    ],
    405
);