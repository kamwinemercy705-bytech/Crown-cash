<?php

/* ==========================================================================
   CROWN CASH - ADMIN MAINTENANCE API
   Complete replacement
   Version: 2026-10-03
   ========================================================================== */

declare(strict_types=1);


/* ==========================================================================
   CONFIG
   ========================================================================== */

require_once __DIR__ . '/config.php';


/* ==========================================================================
   SESSION
   ========================================================================== */

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


/* ==========================================================================
   CORS
   ========================================================================== */

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
    'Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With'
);

header(
    'Access-Control-Allow-Methods: GET, POST, OPTIONS'
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


if (
    ($_SERVER['REQUEST_METHOD'] ?? '') ===
    'OPTIONS'
) {

    http_response_code(204);

    exit;
}


/* ==========================================================================
   RESPONSE HELPERS
   ========================================================================== */

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


/* ==========================================================================
   ADMIN AUTHENTICATION
   ========================================================================== */

function maintenanceRequireAdmin(): void {

    $loggedIn =
        !empty($_SESSION['logged_in']);

    if (!$loggedIn) {

        maintenanceResponse(
            [
                'success' => false,
                'message' =>
                    'Administrator authentication is required.'
            ],
            401
        );
    }


    $role =
        strtolower(
            trim(
                (string) (
                    $_SESSION['role'] ??
                    $_SESSION['account_type'] ??
                    $_SESSION['accountType'] ??
                    ''
                )
            )
        );


    $isAdmin =
        !empty($_SESSION['is_admin']) ||
        !empty($_SESSION['isAdmin']) ||
        in_array(
            $role,
            [
                'admin',
                'administrator',
                'super_admin',
                'superadmin'
            ],
            true
        );


    /*
     * If your config.php already provides requireAdmin(),
     * use that authoritative check.
     */

    if (function_exists('requireAdmin')) {

        try {

            requireAdmin();

            return;

        } catch (Throwable $error) {

            maintenanceResponse(
                [
                    'success' => false,
                    'message' =>
                        'Administrator access denied.'
                ],
                403
            );
        }
    }


    if (!$isAdmin) {

        maintenanceResponse(
            [
                'success' => false,
                'message' =>
                    'Administrator access denied.'
            ],
            403
        );
    }
}


/* ==========================================================================
   DATABASE
   ========================================================================== */

function maintenanceDatabase(): array {

    global $db;

    /*
     * Prefer the variables already supplied by config.php.
     */

    if (
        isset($db) &&
        is_object($db)
    ) {

        return [
            'db' => $db
        ];
    }


    /*
     * Common Crown Cash configuration:
     * $client and $database.
     */

    global $database;

    if (
        isset($database) &&
        is_object($database)
    ) {

        return [
            'db' => $database
        ];
    }


    /*
     * Fallback for configurations exposing $mongoDb.
     */

    global $mongoDb;

    if (
        isset($mongoDb) &&
        is_object($mongoDb)
    ) {

        return [
            'db' => $mongoDb
        ];
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


/* ==========================================================================
   SETTINGS COLLECTION
   ========================================================================== */

function maintenanceCollection() {

    $connection =
        maintenanceDatabase();

    $database =
        $connection['db'];


    /*
     * MongoDB database objects expose selectCollection().
     */

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


    /*
     * Some configurations expose a collections
     * property. This is only a fallback.
     */

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
                'Platform settings collection is unavailable.'
        ],
        500
    );
}


/* ==========================================================================
   DEFAULT SETTINGS
   ========================================================================== */

function defaultMaintenanceSettings(): array {

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


/* ==========================================================================
   NORMALIZE BOOLEAN
   ========================================================================== */

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
        is_int($value) ||
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


/* ==========================================================================
   GET SETTINGS
   ========================================================================== */

function getMaintenanceSettings(): array {

    $collection =
        maintenanceCollection();


    $document =
        $collection->findOne(
            [
                '_id' =>
                    'crown_cash_platform'
            ]
        );


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


    /*
     * Normalize all switches.
     */

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


/* ==========================================================================
   SAVE SETTINGS
   ========================================================================== */

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
                $input['maintenance_mode'] ??
                $current['maintenance_mode'],
                false
            ),

        'new_investments' =>
            maintenanceBoolean(
                $input['new_investments'] ??
                $current['new_investments'],
                true
            ),

        'deposits' =>
            maintenanceBoolean(
                $input['deposits'] ??
                $current['deposits'],
                true
            ),

        'withdrawals' =>
            maintenanceBoolean(
                $input['withdrawals'] ??
                $current['withdrawals'],
                true
            ),

        'daily_earnings' =>
            maintenanceBoolean(
                $input['daily_earnings'] ??
                $current['daily_earnings'],
                true
            ),

        'user_registration' =>
            maintenanceBoolean(
                $input['user_registration'] ??
                $current['user_registration'],
                true
            ),

        'maintenance_message' =>
            trim(
                (string) (
                    $input['maintenance_message'] ??
                    $current['maintenance_message']
                )
            ),

        'updated_at' =>
            new MongoDB\BSON\UTCDateTime()
    ];


    if (
        $settings['maintenance_message'] === ''
    ) {

        $settings['maintenance_message'] =
            'Crown Cash is temporarily under maintenance. Please check back shortly.';
    }


    /*
     * Limit message length.
     */

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
            'upsert' =>
                true
        ]
    );


    return getMaintenanceSettings();
}


/* ==========================================================================
   EARNINGS MONITOR
   ========================================================================== */

function getEarningsMonitor(
    array $settings
): array {

    $activeInvestments = 0;

    $pendingInvestments = 0;


    try {

        $connection =
            maintenanceDatabase();

        $database =
            $connection['db'];


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
                $investments->countDocuments(
                    [
                        'status' =>
                            [
                                '$in' =>
                                    [
                                        'approved',
                                        'active',
                                        'running'
                                    ]
                            ]
                    ]
                );


            $pendingInvestments =
                $investments->countDocuments(
                    [
                        'status' =>
                            'pending'
                    ]
                );
        }

    } catch (Throwable $error) {

        /*
         * Monitoring information must never
         * prevent the settings API from working.
         */

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
            (int) $pendingInvestments
    ];
}


/* ==========================================================================
   UPDATE EARNINGS RUN
   ==========================================================================
   This action is useful for daily_earnings.php later.
   ========================================================================== */

function recordEarningsRun(
    float $processedAmount = 0
): array {

    $collection =
        maintenanceCollection();


    $now =
        new MongoDB\BSON\UTCDateTime();


    $collection->updateOne(

        [
            '_id' =>
                'crown_cash_platform'
        ],

        [
            '$set' => [

                'last_earnings_run' =>
                    $now,

                'updated_at' =>
                    $now

            ],

            '$inc' => [

                'earnings_processed_today' =>
                    $processedAmount

            ]

        ],

        [
            'upsert' =>
                true
        ]
    );


    return getMaintenanceSettings();
}


/* ==========================================================================
   REQUEST METHOD
   ========================================================================== */

$method =
    strtoupper(
        $_SERVER['REQUEST_METHOD'] ?? 'GET'
    );


/* ==========================================================================
   PUBLIC STATUS ACTION
   ==========================================================================
   The user-facing website will later use this action.
   It does NOT require administrator authentication.
   ========================================================================== */

if (
    $method === 'GET' &&
    isset($_GET['public']) &&
    $_GET['public'] === '1'
) {

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
                $settings['maintenance_message']
        ]
    );
}


/* ==========================================================================
   ALL ADMIN ACTIONS BELOW REQUIRE ADMIN ACCESS
   ========================================================================== */

maintenanceRequireAdmin();


/* ==========================================================================
   GET
   ========================================================================== */

if (
    $method === 'GET'
) {

    $settings =
        getMaintenanceSettings();


    $monitor =
        getEarningsMonitor(
            $settings
        );


    maintenanceResponse(
        [
            'success' =>
                true,

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
}


/* ==========================================================================
   POST
   ========================================================================== */

if (
    $method === 'POST'
) {

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

            $input =
                $decoded;
        }
    }


    /*
     * Also support normal POST data.
     */

    if (
        empty($input) &&
        !empty($_POST)
    ) {

        $input =
            $_POST;
    }


    /*
     * Support the action used by the earnings engine.
     */

    $action =
        strtolower(
            trim(
                (string)
                ($input['action'] ?? '')
            )
        );


    if (
        $action ===
        'record_earnings_run'
    ) {

        $processedAmount =
            (float) (
                $input['processed_amount'] ??
                $input['amount'] ??
                0
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
                'success' =>
                    true,

                'message' =>
                    'Daily earnings run recorded.',

                'settings' =>
                    $settings
            ]
        );
    }


    /*
     * Normal maintenance settings save.
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
            'success' =>
                true,

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
}


/* ==========================================================================
   METHOD NOT ALLOWED
   ========================================================================== */

maintenanceResponse(
    [
        'success' => false,
        'message' =>
            'Method not allowed.'
    ],
    405
);