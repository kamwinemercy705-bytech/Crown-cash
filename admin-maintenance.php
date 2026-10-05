<?php

declare(strict_types=1);

/*
|--------------------------------------------------------------------------
| CROWN CASH - ADMIN MAINTENANCE API
|--------------------------------------------------------------------------
| Version: 2026-10-05
|
| FUNCTIONS:
| - Public platform status
| - Admin maintenance settings
| - Earnings engine monitoring
| - Secure earnings engine execution
| - Earnings run recording
|
| SECURITY:
| - Public status is available through ?public=1.
| - Administrative operations require database-backed admin auth.
| - Normal users cannot execute the earnings engine.
| - ADMIN_USER_ID / ADMIN_EMAIL only restrict an existing admin.
|--------------------------------------------------------------------------
*/

require_once __DIR__ . '/config.php';

/*
|--------------------------------------------------------------------------
| LOAD EARNINGS ENGINE
|--------------------------------------------------------------------------
|
| We load daily_earnings.php as a library.
|
| IMPORTANT:
| daily_earnings.php must NOT execute its request handler when included.
| Therefore this maintenance API calls its processing functions directly.
|--------------------------------------------------------------------------
*/

$earningsEnginePath =
    __DIR__ . '/daily_earnings.php';

/*
|--------------------------------------------------------------------------
| SESSION
|--------------------------------------------------------------------------
*/

if (function_exists('startSecureSession')) {
    startSecureSession();
} else {
    if (session_status() !== PHP_SESSION_ACTIVE) {

        session_name(
            'CROWN_CASH_SESSION'
        );

        session_set_cookie_params([
            'httponly' => true,
            'secure' => true,
            'samesite' => 'None'
        ]);

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
        'Access-Control-Allow-Origin: '
        . $requestOrigin
    );

    header('Vary: Origin');
}

header(
    'Access-Control-Allow-Credentials: true'
);

header(
    'Access-Control-Allow-Headers: '
    . 'Content-Type, Authorization, X-Requested-With, X-Cron-Token'
);

header(
    'Access-Control-Allow-Methods: '
    . 'GET, POST, OPTIONS'
);

header(
    'Access-Control-Max-Age: 86400'
);

header(
    'Content-Type: application/json; charset=utf-8'
);

if (
    ($_SERVER['REQUEST_METHOD'] ?? 'GET')
    === 'OPTIONS'
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

    http_response_code(
        $status
    );

    echo json_encode(
        $data,
        JSON_UNESCAPED_SLASHES |
        JSON_UNESCAPED_UNICODE |
        JSON_PARTIAL_OUTPUT_ON_ERROR
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

    if (
        isset($user['_id'])
    ) {
        return $user['_id'];
    }

    if (
        !empty($user['id'])
    ) {
        return $user['id'];
    }

    if (
        !empty($user['user_id'])
    ) {
        return $user['user_id'];
    }

    if (
        !empty($user['userId'])
    ) {
        return $user['userId'];
    }

    return null;
}

function maintenanceString(
    mixed $value
): string {

    if (
        $value instanceof
        MongoDB\BSON\ObjectId
    ) {
        return (string) $value;
    }

    if (
        $value instanceof
        MongoDB\BSON\UTCDateTime
    ) {
        return $value
            ->toDateTime()
            ->format('c');
    }

    if (
        is_string($value) ||
        is_numeric($value)
    ) {
        return trim(
            (string) $value
        );
    }

    return '';
}

function maintenanceObjectId(
    mixed $value
): ?MongoDB\BSON\ObjectId {

    if (
        $value instanceof
        MongoDB\BSON\ObjectId
    ) {
        return $value;
    }

    $value =
        trim(
            (string) $value
        );

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

    $objectId =
        maintenanceObjectId(
            $userId
        );

    if (
        $objectId !== null
    ) {

        $user =
            $users->findOne([
                '_id' => $objectId
            ]);

        if (
            $user !== null
        ) {

            return $user->getArrayCopy();
        }
    }

    $stringId =
        trim(
            (string) $userId
        );

    if (
        $stringId !== ''
    ) {

        $user =
            $users->findOne([
                '$or' => [
                    [
                        'id' =>
                            $stringId
                    ],
                    [
                        'user_id' =>
                            $stringId
                    ],
                    [
                        'userId' =>
                            $stringId
                    ]
                ]
            ]);

        if (
            $user !== null
        ) {

            return $user->getArrayCopy();
        }
    }

    return null;
}

/*
|--------------------------------------------------------------------------
| DATABASE ADMIN CHECK
|--------------------------------------------------------------------------
*/

function maintenanceUserIsAdmin(
    array $user
): bool {

    $role =
        strtolower(
            trim(
                (string) (
                    $user['role']
                    ?? ''
                )
            )
        );

    $accountType =
        strtolower(
            trim(
                (string) (
                    $user['account_type']
                    ?? ''
                )
            )
        );

    $isAdmin =
        isset(
            $user['is_admin']
        ) &&
        (
            $user['is_admin'] === true
            ||
            $user['is_admin'] === 1
            ||
            $user['is_admin'] === '1'
        );

    return
        $isAdmin
        ||
        in_array(
            $role,
            [
                'admin',
                'administrator',
                'superadmin',
                'super_admin'
            ],
            true
        )
        ||
        in_array(
            $accountType,
            [
                'admin',
                'administrator',
                'superadmin',
                'super_admin'
            ],
            true
        );
}

/*
|--------------------------------------------------------------------------
| ADMIN AUTHENTICATION
|--------------------------------------------------------------------------
*/

function maintenanceRequireAdmin(): array
{
    $loggedIn =
        !empty(
            $_SESSION['logged_in']
        )
        ||
        !empty(
            $_SESSION['authenticated']
        );

    if (
        !$loggedIn
    ) {

        maintenanceResponse(
            [
                'success' => false,
                'message' =>
                    'Administrator authentication is required.'
            ],
            401
        );
    }

    $sessionUserId =
        $_SESSION['user_id']
        ??
        $_SESSION['userId']
        ??
        $_SESSION['id']
        ??
        $_SESSION['_id']
        ??
        null;

    if (
        $sessionUserId === null
        ||
        trim(
            (string) $sessionUserId
        ) === ''
    ) {

        maintenanceResponse(
            [
                'success' => false,
                'message' =>
                    'Administrator authentication is required.'
            ],
            401
        );
    }

    $currentUser =
        maintenanceFindUser(
            $sessionUserId
        );

    if (
        $currentUser === null
    ) {

        maintenanceResponse(
            [
                'success' => false,
                'message' =>
                    'Administrator account was not found.'
            ],
            401
        );
    }

    $accountStatus =
        strtolower(
            trim(
                (string) (
                    $currentUser['status']
                    ??
                    $currentUser[
                        'account_status'
                    ]
                    ??
                    'active'
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
                'inactive'
            ],
            true
        )
    ) {

        maintenanceResponse(
            [
                'success' => false,
                'message' =>
                    'Administrator account is not active.'
            ],
            403
        );
    }

    if (
        !maintenanceUserIsAdmin(
            $currentUser
        )
    ) {

        maintenanceResponse(
            [
                'success' => false,
                'message' =>
                    'Administrator access denied.'
            ],
            403
        );
    }

    /*
     * Optional admin restrictions.
     */
    $configuredAdminId =
        trim(
            (string) (
                getenv(
                    'ADMIN_USER_ID'
                ) ?: ''
            )
        );

    $configuredAdminEmail =
        strtolower(
            trim(
                (string) (
                    getenv(
                        'ADMIN_EMAIL'
                    ) ?: ''
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
                    $currentUser['email']
                    ?? ''
                )
            )
        );

    if (
        $configuredAdminId !== ''
        &&
        $actualAdminId !==
            $configuredAdminId
    ) {

        maintenanceResponse(
            [
                'success' => false,
                'message' =>
                    'Administrator authorization failed.'
            ],
            403
        );
    }

    if (
        $configuredAdminEmail !== ''
        &&
        $actualAdminEmail !==
            $configuredAdminEmail
    ) {

        maintenanceResponse(
            [
                'success' => false,
                'message' =>
                    'Administrator authorization failed.'
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

    /*
     * config.php normally exposes the database
     * through the MongoDB collection globals.
     *
     * If none of the aliases exist, use the database
     * from the configured MongoDB client.
     */
    global $mongoClient;

    if (
        isset($mongoClient) &&
        $mongoClient instanceof MongoDB\Client
    ) {

        $databaseName =
            getenv(
                'MONGODB_DATABASE'
            )
            ?: 'crowncash';

        return $mongoClient->selectDatabase(
            $databaseName
        );
    }

    maintenanceResponse(
        [
            'success' => false,
            'message' =>
                'Database connection is not available.'
        ],
        500
    );
}

/*
|--------------------------------------------------------------------------
| COLLECTION
|--------------------------------------------------------------------------
*/

function maintenanceCollection()
{
    $database =
        maintenanceDatabase();

    return $database->selectCollection(
        'platform_settings'
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
            null
    ];
}

/*
|--------------------------------------------------------------------------
| BOOLEAN
|--------------------------------------------------------------------------
*/

function maintenanceBoolean(
    mixed $value,
    bool $default = false
): bool {

    if (
        is_bool($value)
    ) {
        return $value;
    }

    if (
        is_int($value)
        ||
        is_float($value)
    ) {
        return (bool) $value;
    }

    if (
        is_string($value)
    ) {

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
                    'enabled'
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
                    'disabled'
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
                'crown_cash_platform'
        ]);

    $settings =
        defaultMaintenanceSettings();

    if (
        $document !== null
    ) {

        $array =
            method_exists(
                $document,
                'getArrayCopy'
            )
            ?
            $document->getArrayCopy()
            :
            (array) $document;

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

    $settings[
        'maintenance_mode'
    ] =
        maintenanceBoolean(
            $settings[
                'maintenance_mode'
            ],
            false
        );

    $settings[
        'new_investments'
    ] =
        maintenanceBoolean(
            $settings[
                'new_investments'
            ],
            true
        );

    $settings[
        'deposits'
    ] =
        maintenanceBoolean(
            $settings[
                'deposits'
            ],
            true
        );

    $settings[
        'withdrawals'
    ] =
        maintenanceBoolean(
            $settings[
                'withdrawals'
            ],
            true
        );

    $settings[
        'daily_earnings'
    ] =
        maintenanceBoolean(
            $settings[
                'daily_earnings'
            ],
            true
        );

    $settings[
        'user_registration'
    ] =
        maintenanceBoolean(
            $settings[
                'user_registration'
            ],
            true
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

    $message =
        trim(
            (string) (
                $input[
                    'maintenance_message'
                ]
                ??
                $current[
                    'maintenance_message'
                ]
            )
        );

    if (
        $message === ''
    ) {

        $message =
            'Crown Cash is temporarily under maintenance. Please check back shortly.';
    }

    if (
        strlen($message) > 500
    ) {

        $message =
            substr(
                $message,
                0,
                500
            );
    }

    $settings = [

        'maintenance_mode' =>
            maintenanceBoolean(
                $input[
                    'maintenance_mode'
                ]
                ??
                $current[
                    'maintenance_mode'
                ],
                false
            ),

        'new_investments' =>
            maintenanceBoolean(
                $input[
                    'new_investments'
                ]
                ??
                $current[
                    'new_investments'
                ],
                true
            ),

        'deposits' =>
            maintenanceBoolean(
                $input[
                    'deposits'
                ]
                ??
                $current[
                    'deposits'
                ],
                true
            ),

        'withdrawals' =>
            maintenanceBoolean(
                $input[
                    'withdrawals'
                ]
                ??
                $current[
                    'withdrawals'
                ],
                true
            ),

        'daily_earnings' =>
            maintenanceBoolean(
                $input[
                    'daily_earnings'
                ]
                ??
                $current[
                    'daily_earnings'
                ],
                true
            ),

        'user_registration' =>
            maintenanceBoolean(
                $input[
                    'user_registration'
                ]
                ??
                $current[
                    'user_registration'
                ],
                true
            ),

        'maintenance_message' =>
            $message,

        'updated_at' =>
            new MongoDB\BSON\UTCDateTime()
    ];

    $collection->updateOne(

        [
            '_id' =>
                'crown_cash_platform'
        ],

        [
            '$set' =>
                $settings,

            '$setOnInsert' => [
                'created_at' =>
                    new MongoDB\BSON\UTCDateTime()
            ]
        ],

        [
            'upsert' => true
        ]
    );

    return getMaintenanceSettings();
}

/*
|--------------------------------------------------------------------------
| ACTIVE/PENDING INVESTMENT MONITOR
|--------------------------------------------------------------------------
*/

function getEarningsMonitor(
    array $settings
): array {

    global $investments;

    $activeInvestments = 0;
    $pendingInvestments = 0;

    try {

        if (
            isset($investments)
            &&
            $investments instanceof
                MongoDB\Collection
        ) {

            $activeInvestments =
                $investments->countDocuments([
                    'status' => [
                        '$in' => [
                            'approved',
                            'active',
                            'running',
                            'in_progress',
                            'in-progress'
                        ]
                    ],
                    'balance_deducted' =>
                        true,
                    'principal_returned' => [
                        '$ne' => true
                    ]
                ]);

            $pendingInvestments =
                $investments->countDocuments([
                    'status' => [
                        '$in' => [
                            'pending',
                            'approval_processing',
                            'processing'
                        ]
                    ]
                ]);
        }

    } catch (Throwable $error) {

        error_log(
            'Maintenance monitor error: '
            . $error->getMessage()
        );
    }

    return [

        'last_run' =>
            $settings[
                'last_earnings_run'
            ],

        'processed_today' =>
            (float) (
                $settings[
                    'earnings_processed_today'
                ] ?? 0
            ),

        'active_investments' =>
            (int) $activeInvestments,

        'pending_investments' =>
            (int) $pendingInvestments,

        'engine_enabled' =>
            (bool) (
                $settings[
                    'daily_earnings'
                ] ?? true
            )
    ];
}

/*
|--------------------------------------------------------------------------
| RECORD EARNINGS RUN
|--------------------------------------------------------------------------
*/

function recordEarningsRun(
    float $processedAmount
): array {

    $collection =
        maintenanceCollection();

    $now =
        new MongoDB\BSON\UTCDateTime();

    $current =
        $collection->findOne([
            '_id' =>
                'crown_cash_platform'
        ]);

    $previousAmount = 0.0;

    if (
        $current !== null
    ) {

        $currentArray =
            method_exists(
                $current,
                'getArrayCopy'
            )
            ?
            $current->getArrayCopy()
            :
            (array) $current;

        $previousRun =
            $currentArray[
                'last_earnings_run'
            ] ?? null;

        if (
            $previousRun instanceof
                MongoDB\BSON\UTCDateTime
        ) {

            $previousDate =
                $previousRun
                    ->toDateTime()
                    ->format('Y-m-d');

            $currentDate =
                gmdate('Y-m-d');

            if (
                $previousDate ===
                $currentDate
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
        $previousAmount
        +
        max(
            0,
            $processedAmount
        );

    $collection->updateOne(

        [
            '_id' =>
                'crown_cash_platform'
        ],

        [
            '$set' => [

                'last_earnings_run' =>
                    $now,

                'earnings_processed_today' =>
                    $newDailyTotal,

                'updated_at' =>
                    $now
            ],

            '$setOnInsert' => [

                'created_at' =>
                    $now
            ]
        ],

        [
            'upsert' => true
        ]
    );

    return getMaintenanceSettings();
}

/*
|--------------------------------------------------------------------------
| EXECUTE EARNINGS ENGINE
|--------------------------------------------------------------------------
*/

function executeEarningsEngine(): array
{
    global $earningsEnginePath;
    global $investments;
    global $users;
    global $earnings;
    global $transactions;
    global $client;

    /*
     * Earnings engine must be enabled.
     */
    $settings =
        getMaintenanceSettings();

    if (
        !maintenanceBoolean(
            $settings[
                'daily_earnings'
            ] ?? true,
            true
        )
    ) {

        return [
            'success' => false,
            'enabled' => false,
            'message' =>
                'Daily earnings engine is disabled.',
            'processed_amount' => 0,
            'result' => []
        ];
    }

    /*
     * Verify the earnings engine file exists.
     */
    if (
        !is_file(
            $earningsEnginePath
        )
    ) {

        throw new RuntimeException(
            'daily_earnings.php was not found.'
        );
    }

    /*
     * The processing functions must be available.
     */
    if (
        !function_exists(
            'processDailyEarnings'
        )
    ) {

        /*
         * Include the earnings engine as a library.
         *
         * The current daily_earnings.php should contain
         * its processing functions before its request handler.
         */
        require_once $earningsEnginePath;
    }

    if (
        !function_exists(
            'processDailyEarnings'
        )
    ) {

        throw new RuntimeException(
            'Daily earnings engine could not be loaded.'
        );
    }

    /*
     * Execute the actual engine.
     */
    $result =
        processDailyEarnings(
            $investments,
            $users,
            $earnings,
            $transactions,
            $client
        );

    $processedAmount =
        (float) (
            $result[
                'total_earnings_credited'
            ]
            ??
            $result[
                'daily_earnings'
            ]
            ??
            0
        );

    /*
     * Record monitor information only after the
     * processing function returns.
     */
    $settings =
        recordEarningsRun(
            $processedAmount
        );

    $monitor =
        getEarningsMonitor(
            $settings
        );

    return [
        'success' => true,
        'enabled' => true,
        'processed_amount' =>
            round(
                $processedAmount,
                2
            ),
        'result' =>
            $result,
        'settings' =>
            $settings,
        'monitor' =>
            $monitor
    ];
}

/*
|--------------------------------------------------------------------------
| METHOD
|--------------------------------------------------------------------------
*/

$method =
    strtoupper(
        $_SERVER[
            'REQUEST_METHOD'
        ] ?? 'GET'
    );

/*
|--------------------------------------------------------------------------
| PUBLIC STATUS
|--------------------------------------------------------------------------
*/

if (
    $method === 'GET'
    &&
    isset(
        $_GET['public']
    )
    &&
    $_GET['public'] === '1'
) {

    try {

        $settings =
            getMaintenanceSettings();

        maintenanceResponse(
            [
                'success' => true,

                'maintenance_mode' =>
                    $settings[
                        'maintenance_mode'
                    ],

                'new_investments' =>
                    $settings[
                        'new_investments'
                    ],

                'deposits' =>
                    $settings[
                        'deposits'
                    ],

                'withdrawals' =>
                    $settings[
                        'withdrawals'
                    ],

                'daily_earnings' =>
                    $settings[
                        'daily_earnings'
                    ],

                'user_registration' =>
                    $settings[
                        'user_registration'
                    ],

                'maintenance_message' =>
                    $settings[
                        'maintenance_message'
                    ]
            ]
        );

    } catch (Throwable $error) {

        error_log(
            'Public maintenance status error: '
            . $error->getMessage()
        );

        maintenanceResponse(
            [
                'success' => false,
                'message' =>
                    'Maintenance status unavailable.'
            ],
            500
        );
    }
}

/*
|--------------------------------------------------------------------------
| ADMIN AUTH
|--------------------------------------------------------------------------
*/

$currentAdmin =
    maintenanceRequireAdmin();

/*
|--------------------------------------------------------------------------
| ADMIN GET
|--------------------------------------------------------------------------
*/

if (
    $method === 'GET'
) {

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
                    $monitor
            ]
        );

    } catch (Throwable $error) {

        error_log(
            'Admin maintenance GET error: '
            . $error->getMessage()
        );

        maintenanceResponse(
            [
                'success' => false,
                'message' =>
                    'Failed to load maintenance settings.'
            ],
            500
        );
    }
}

/*
|--------------------------------------------------------------------------
| ADMIN POST
|--------------------------------------------------------------------------
*/

if (
    $method === 'POST'
) {

    try {

        $raw =
            file_get_contents(
                'php://input'
            );

        $input = [];

        if (
            $raw !== false
            &&
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

                $input =
                    $decoded;
            }
        }

        if (
            empty($input)
            &&
            !empty($_POST)
        ) {

            $input =
                $_POST;
        }

        $action =
            strtolower(
                trim(
                    (string) (
                        $input[
                            'action'
                        ] ?? ''
                    )
                )
            );

        /*
         * ------------------------------------------------------
         * RUN EARNINGS
         * ------------------------------------------------------
         *
         * This is the important new action.
         *
         * Only an authenticated administrator reaches this point.
         */
        if (
            in_array(
                $action,
                [
                    'run_earnings',
                    'run_daily_earnings',
                    'process_earnings'
                ],
                true
            )
        ) {

            $result =
                executeEarningsEngine();

            maintenanceResponse(
                [
                    'success' =>
                        $result[
                            'success'
                        ],

                    'message' =>
                        $result[
                            'success'
                        ]
                        ?
                        'Daily earnings engine completed successfully.'
                        :
                        (
                            $result[
                                'message'
                            ]
                            ??
                            'Daily earnings engine did not run.'
                        ),

                    'earnings' =>
                        $result,

                    'admin_id' =>
                        maintenanceString(
                            maintenanceUserIdValue(
                                $currentAdmin
                            )
                        )
                ]
            );
        }

        /*
         * ------------------------------------------------------
         * LEGACY RECORD EARNINGS RUN
         * ------------------------------------------------------
         */
        if (
            $action ===
            'record_earnings_run'
        ) {

            $processedAmount =
                (float) (
                    $input[
                        'processed_amount'
                    ]
                    ??
                    $input[
                        'amount'
                    ]
                    ??
                    0
                );

            if (
                !is_finite(
                    $processedAmount
                )
                ||
                $processedAmount < 0
            ) {

                $processedAmount = 0;
            }

            $settings =
                recordEarningsRun(
                    $processedAmount
                );

            $monitor =
                getEarningsMonitor(
                    $settings
                );

            maintenanceResponse(
                [
                    'success' => true,

                    'message' =>
                        'Daily earnings run recorded.',

                    'settings' =>
                        $settings,

                    'monitor' =>
                        $monitor,

                    'admin_id' =>
                        maintenanceString(
                            maintenanceUserIdValue(
                                $currentAdmin
                            )
                        )
                ]
            );
        }

        /*
         * ------------------------------------------------------
         * SAVE PLATFORM SETTINGS
         * ------------------------------------------------------
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
                    $monitor
            ]
        );

    } catch (Throwable $error) {

        error_log(
            'Admin maintenance POST error: '
            . $error->getMessage()
        );

        maintenanceResponse(
            [
                'success' => false,
                'message' =>
                    'Unable to update maintenance settings.'
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
            'Method not allowed.'
    ],
    405
);