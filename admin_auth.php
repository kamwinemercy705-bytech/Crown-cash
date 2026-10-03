<?php
/* =========================================================
   CROWN CASH — ADMIN AUTHENTICATION
   Production Secure Version

   SECURITY:
   - Uses the same CROWN_CASH_SESSION as login.php
   - Requires a logged-in user
   - Reads the user from the database
   - Requires role/account_type = admin
   - Normal users receive HTTP 403
   - Unauthenticated users receive HTTP 401
   - Never trusts frontend/admin.html
========================================================= */

declare(strict_types=1);


/* =========================================================
   LOAD CONFIG FIRST
========================================================= */

require_once __DIR__ . '/config.php';


/* =========================================================
   CORS
========================================================= */

$allowedOrigins = [
    'https://crown-cash.vercel.app',
    'https://www.crown-cash.vercel.app'
];

$requestOrigin = $_SERVER['HTTP_ORIGIN'] ?? '';

if (in_array($requestOrigin, $allowedOrigins, true)) {
    header(
        'Access-Control-Allow-Origin: ' .
        $requestOrigin
    );
}

header('Access-Control-Allow-Credentials: true');

header(
    'Access-Control-Allow-Headers: ' .
    'Content-Type, Authorization, X-Requested-With'
);

header(
    'Access-Control-Allow-Methods: GET, OPTIONS'
);

header('Access-Control-Max-Age: 86400');

header('Vary: Origin');

header(
    'Content-Type: application/json; charset=utf-8'
);


/* =========================================================
   OPTIONS
========================================================= */

if (
    ($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS'
) {
    http_response_code(204);
    exit;
}


/* =========================================================
   JSON RESPONSE
========================================================= */

function adminAuthResponse(
    bool $success,
    string $message,
    int $status,
    array $extra = []
): never {

    http_response_code($status);

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
    ($_SERVER['REQUEST_METHOD'] ?? '') !== 'GET'
) {

    header(
        'Allow: GET, OPTIONS'
    );

    adminAuthResponse(
        false,
        'Method not allowed.',
        405
    );
}


/* =========================================================
   SECURE SESSION
========================================================= */

try {

    if (
        function_exists('startSecureSession')
    ) {

        startSecureSession();

    } else {

        /*
         * Fallback only if config.php does not expose
         * startSecureSession().
         */

        if (
            session_status() !==
            PHP_SESSION_ACTIVE
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
    }

} catch (Throwable $e) {

    error_log(
        'Crown Cash admin session error: ' .
        $e->getMessage()
    );

    adminAuthResponse(
        false,
        'Unable to establish secure session.',
        500
    );
}


/* =========================================================
   AUTHENTICATION CHECK
========================================================= */

$loggedIn =
    !empty($_SESSION['logged_in']);

if (!$loggedIn) {

    adminAuthResponse(
        false,
        'Administrator authentication required.',
        401,
        [
            'authenticated' => false,
            'authorized' => false
        ]
    );
}


/* =========================================================
   GET SESSION USER ID
========================================================= */

$sessionUserId = null;

$possibleSessionIds = [
    $_SESSION['user_id'] ?? null,
    $_SESSION['userId'] ?? null,
    $_SESSION['id'] ?? null,
    $_SESSION['_id'] ?? null
];

foreach (
    $possibleSessionIds
    as $candidate
) {

    if (
        $candidate !== null &&
        $candidate !== ''
    ) {

        $sessionUserId =
            $candidate;

        break;
    }
}


if (
    $sessionUserId === null ||
    $sessionUserId === ''
) {

    adminAuthResponse(
        false,
        'Authenticated session does not contain a valid user.',
        401,
        [
            'authenticated' => false,
            'authorized' => false
        ]
    );
}


/* =========================================================
   DATABASE
========================================================= */

try {

    /*
     * config.php normally exposes $users.
     * Support the common variable names used by the
     * Crown Cash backend without trusting frontend data.
     */

    $usersCollection = null;

    if (
        isset($users) &&
        $users instanceof
        MongoDB\Collection
    ) {

        $usersCollection = $users;

    } elseif (
        isset($usersCollection) &&
        $usersCollection instanceof
        MongoDB\Collection
    ) {

        /*
         * Already available.
         */

    } elseif (
        isset($userCollection) &&
        $userCollection instanceof
        MongoDB\Collection
    ) {

        $usersCollection =
            $userCollection;

    } elseif (
        isset($db) &&
        $db instanceof
        MongoDB\Database
    ) {

        $usersCollection =
            $db->selectCollection(
                'users'
            );

    } elseif (
        isset($database) &&
        $database instanceof
        MongoDB\Database
    ) {

        $usersCollection =
            $database->selectCollection(
                'users'
            );

    } elseif (
        isset($mongoDb) &&
        $mongoDb instanceof
        MongoDB\Database
    ) {

        $usersCollection =
            $mongoDb->selectCollection(
                'users'
            );
    }


    if (
        !$usersCollection
    ) {

        throw new RuntimeException(
            'Users collection is unavailable.'
        );
    }


    /* =====================================================
       BUILD USER FILTER
    ===================================================== */

    $userFilter = [];


    /*
     * MongoDB ObjectId session ID
     */
    if (
        $sessionUserId instanceof
        MongoDB\BSON\ObjectId
    ) {

        $userFilter = [
            '_id' =>
                $sessionUserId
        ];

    } else {

        $sessionIdString =
            trim(
                (string)$sessionUserId
            );


        /*
         * If the session contains a valid
         * MongoDB ObjectId string, search by _id.
         */
        if (
            preg_match(
                '/^[a-f0-9]{24}$/i',
                $sessionIdString
            )
        ) {

            try {

                $objectId =
                    new MongoDB\BSON\ObjectId(
                        $sessionIdString
                    );

                $userFilter = [
                    '$or' => [
                        [
                            '_id' =>
                                $objectId
                        ],
                        [
                            'user_id' =>
                                $sessionIdString
                        ],
                        [
                            'id' =>
                                $sessionIdString
                        ]
                    ]
                ];

            } catch (Throwable $e) {

                $userFilter = [
                    '$or' => [
                        [
                            'user_id' =>
                                $sessionIdString
                        ],
                        [
                            'id' =>
                                $sessionIdString
                        ]
                    ]
                ];
            }

        } else {

            $userFilter = [
                '$or' => [
                    [
                        'user_id' =>
                            $sessionIdString
                    ],
                    [
                        'id' =>
                            $sessionIdString
                    ]
                ]
            ];
        }
    }


    /* =====================================================
       LOAD CURRENT USER
    ===================================================== */

    $user =
        $usersCollection
            ->findOne(
                $userFilter
            );


    if (!$user) {

        /*
         * The session may contain an ID that no longer
         * exists. Do not trust the session alone.
         */

        adminAuthResponse(
            false,
            'User account could not be verified.',
            401,
            [
                'authenticated' => false,
                'authorized' => false
            ]
        );
    }


    /* =====================================================
       SERVER-SIDE ADMIN ROLE CHECK
    ===================================================== */

    $role =
        strtolower(
            trim(
                (string)(
                    $user->role ??
                    ''
                )
            )
        );

    $accountType =
        strtolower(
            trim(
                (string)(
                    $user->account_type ??
                    $user->accountType ??
                    ''
                )
            )
        );


    /*
     * IMPORTANT:
     *
     * Do NOT use:
     *
     *     if ($user->is_admin)
     *
     * alone.
     *
     * The administrator must have an explicit admin role
     * or admin account type.
     */

    $isAdmin =
        ($role === 'admin') ||
        ($accountType === 'admin');


    /* =====================================================
       OPTIONAL LEGACY ADMIN FLAG
    ===================================================== */

    /*
     * Only accept a legacy is_admin flag when it is
     * explicitly boolean true.
     *
     * Strings such as "admin", "yes", "1abc", etc.
     * are NOT accepted.
     */

    if (
        property_exists(
            $user,
            'is_admin'
        ) &&
        $user->is_admin === true
    ) {

        $isAdmin = true;
    }


    /* =====================================================
       DENY NORMAL USERS
    ===================================================== */

    if (!$isAdmin) {

        error_log(
            'Crown Cash admin access denied. ' .
            'User ID: ' .
            (string)$sessionUserId
        );

        adminAuthResponse(
            false,
            'Administrator privileges are required.',
            403,
            [
                'authenticated' => true,
                'authorized' => false,
                'admin' => false
            ]
        );
    }


    /* =====================================================
       ADMIN VERIFIED
    ===================================================== */

    $name =
        $user->name ??
        $user->full_name ??
        $user->username ??
        $user->email ??
        'Administrator';

    $email =
        $user->email ??
        '';

    $resolvedRole =
        $role !== ''
            ? $role
            : 'admin';


    /* =====================================================
       SUCCESS RESPONSE
    ===================================================== */

    adminAuthResponse(
        true,
        'Administrator authenticated.',
        200,
        [
            'authenticated' => true,

            'authorized' => true,

            'admin' => true,

            'is_admin' => true,

            'role' =>
                $resolvedRole,

            'user' => [
                'id' =>
                    (string)$sessionUserId,

                'name' =>
                    (string)$name,

                'email' =>
                    (string)$email,

                'role' =>
                    $resolvedRole
            ]
        ]
    );


} catch (Throwable $e) {

    error_log(
        'Crown Cash admin-auth.php error: ' .
        $e->getMessage()
    );

    adminAuthResponse(
        false,
        'Unable to verify administrator account.',
        500,
        [
            'authenticated' => true,
            'authorized' => false
        ]
    );
}