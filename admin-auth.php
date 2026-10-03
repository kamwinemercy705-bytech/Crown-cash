<?php

/*
|--------------------------------------------------------------------------
| CROWN CASH - ADMIN AUTHENTICATION API
|--------------------------------------------------------------------------
| Verifies the currently logged-in Crown Cash user and confirms that
| the account is authorized to access the administrator panel.
|
| IMPORTANT:
| This file deliberately uses config.php for the SAME session
| configuration used by login.php and the rest of the application.
|--------------------------------------------------------------------------
*/

declare(strict_types=1);


/*
|--------------------------------------------------------------------------
| Load application configuration FIRST
|--------------------------------------------------------------------------
|
| config.php contains the canonical Crown Cash session configuration,
| including:
|
|   CROWN_CASH_SESSION
|
| We must use the exact same session as login.php.
|--------------------------------------------------------------------------
*/

try {

    require_once __DIR__ . '/config.php';

} catch (Throwable $e) {

    header('Content-Type: application/json; charset=utf-8');

    http_response_code(500);

    echo json_encode([
        'success' => false,
        'authenticated' => false,
        'authorized' => false,
        'message' => 'Server configuration could not be loaded.'
    ]);

    exit;
}


/*
|--------------------------------------------------------------------------
| CORS
|--------------------------------------------------------------------------
*/

header('Content-Type: application/json; charset=utf-8');

$allowedOrigins = [
    'https://crown-cash.vercel.app',
    'https://www.crown-cash.vercel.app'
];

$requestOrigin = $_SERVER['HTTP_ORIGIN'] ?? '';

if (
    $requestOrigin !== '' &&
    in_array($requestOrigin, $allowedOrigins, true)
) {

    header(
        'Access-Control-Allow-Origin: ' .
        $requestOrigin
    );

    header(
        'Access-Control-Allow-Credentials: true'
    );

    header(
        'Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With'
    );

    header(
        'Access-Control-Allow-Methods: GET, OPTIONS'
    );

    header(
        'Vary: Origin'
    );
}


/*
|--------------------------------------------------------------------------
| OPTIONS
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
| GET ONLY
|--------------------------------------------------------------------------
*/

if (
    ($_SERVER['REQUEST_METHOD'] ?? '') !== 'GET'
) {

    http_response_code(405);

    echo json_encode([
        'success' => false,
        'authenticated' => false,
        'authorized' => false,
        'message' => 'Only GET requests are allowed.'
    ]);

    exit;
}


/*
|--------------------------------------------------------------------------
| START THE CANONICAL CROWN CASH SESSION
|--------------------------------------------------------------------------
|
| config.php owns the session configuration.
| If config.php has not already started the session, call the
| application's secure session function.
|--------------------------------------------------------------------------
*/

try {

    if (
        function_exists('startSecureSession') &&
        session_status() !== PHP_SESSION_ACTIVE
    ) {

        startSecureSession();

    } elseif (
        session_status() !== PHP_SESSION_ACTIVE
    ) {

        /*
         * Safety fallback.
         *
         * This fallback still uses the SAME session name used by
         * Crown Cash.
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

        session_start();
    }

} catch (Throwable $e) {

    http_response_code(500);

    echo json_encode([
        'success' => false,
        'authenticated' => false,
        'authorized' => false,
        'message' => 'Unable to initialize administrator session.'
    ]);

    exit;
}


/*
|--------------------------------------------------------------------------
| RESPONSE HELPER
|--------------------------------------------------------------------------
*/

function crownCashAdminAuthResponse(
    bool $success,
    string $message,
    int $status = 200,
    array $extra = []
): void {

    http_response_code($status);

    echo json_encode(
        array_merge(
            [
                'success' => $success,
                'authenticated' => $success,
                'authorized' => $success,
                'message' => $message
            ],
            $extra
        ),
        JSON_UNESCAPED_SLASHES
    );

    exit;
}


/*
|--------------------------------------------------------------------------
| SESSION DEBUG VALUES
|--------------------------------------------------------------------------
*/

$sessionUserId = trim(
    (string)($_SESSION['user_id'] ?? '')
);

$sessionEmail = strtolower(
    trim(
        (string)(
            $_SESSION['user_email']
            ?? $_SESSION['email']
            ?? ''
        )
    )
);

$loggedIn = (
    isset($_SESSION['logged_in']) &&
    $_SESSION['logged_in'] === true
);


/*
|--------------------------------------------------------------------------
| CHECK LOGIN
|--------------------------------------------------------------------------
*/

if (
    !$loggedIn ||
    $sessionUserId === ''
) {

    crownCashAdminAuthResponse(
        false,
        'Administrator session is not active. Please login again.',
        401
    );
}


/*
|--------------------------------------------------------------------------
| SESSION TIMEOUT
|--------------------------------------------------------------------------
*/

$loginTime = isset($_SESSION['login_time'])
    ? (int)$_SESSION['login_time']
    : 0;

$sessionLifetime = 7200;


/*
 * Only enforce the timeout if a valid login timestamp exists.
 */
if (
    $loginTime > 0 &&
    (time() - $loginTime) > $sessionLifetime
) {

    $_SESSION = [];

    if (
        ini_get('session.use_cookies')
    ) {

        $params = session_get_cookie_params();

        setcookie(
            session_name(),
            '',
            time() - 42000,
            $params['path'] ?? '/',
            $params['domain'] ?? '',
            $params['secure'] ?? true,
            $params['httponly'] ?? true
        );
    }

    session_destroy();

    crownCashAdminAuthResponse(
        false,
        'Administrator session has expired. Please login again.',
        401
    );
}


/*
|--------------------------------------------------------------------------
| USERS COLLECTION
|--------------------------------------------------------------------------
*/

if (!isset($users)) {

    crownCashAdminAuthResponse(
        false,
        'Users collection is not available.',
        500
    );
}


/*
|--------------------------------------------------------------------------
| FIND CURRENT USER
|--------------------------------------------------------------------------
*/

$currentUser = null;


/*
|--------------------------------------------------------------------------
| SEARCH BY OBJECT ID
|--------------------------------------------------------------------------
*/

try {

    if (
        preg_match(
            '/^[a-f0-9]{24}$/i',
            $sessionUserId
        )
    ) {

        $objectId =
            new MongoDB\BSON\ObjectId(
                $sessionUserId
            );

        $currentUser =
            $users->findOne([
                '_id' => $objectId
            ]);
    }

} catch (Throwable $e) {

    $currentUser = null;
}


/*
|--------------------------------------------------------------------------
| SEARCH BY STRING ID
|--------------------------------------------------------------------------
*/

if (!$currentUser) {

    try {

        $currentUser =
            $users->findOne([
                'id' => $sessionUserId
            ]);

    } catch (Throwable $e) {

        $currentUser = null;
    }
}


/*
|--------------------------------------------------------------------------
| SEARCH BY EMAIL
|--------------------------------------------------------------------------
*/

if (
    !$currentUser &&
    $sessionEmail !== ''
) {

    try {

        $currentUser =
            $users->findOne([
                'email' => $sessionEmail
            ]);

    } catch (Throwable $e) {

        $currentUser = null;
    }
}


/*
|--------------------------------------------------------------------------
| USER NOT FOUND
|--------------------------------------------------------------------------
*/

if (!$currentUser) {

    crownCashAdminAuthResponse(
        false,
        'The logged-in account could not be found.',
        401
    );
}


/*
|--------------------------------------------------------------------------
| USER DATA
|--------------------------------------------------------------------------
*/

$currentUserArray =
    is_array($currentUser)
        ? $currentUser
        : (array)$currentUser;


/*
|--------------------------------------------------------------------------
| USER ID
|--------------------------------------------------------------------------
*/

$currentUserId = '';

if (
    isset($currentUserArray['_id'])
) {

    $id = $currentUserArray['_id'];

    if (
        $id instanceof MongoDB\BSON\ObjectId
    ) {

        $currentUserId =
            (string)$id;

    } else {

        $currentUserId =
            trim((string)$id);
    }
}

if ($currentUserId === '') {

    $currentUserId =
        trim(
            (string)(
                $currentUserArray['id']
                ?? $sessionUserId
            )
        );
}


/*
|--------------------------------------------------------------------------
| EMAIL
|--------------------------------------------------------------------------
*/

$currentUserEmail = strtolower(
    trim(
        (string)(
            $currentUserArray['email']
            ?? $sessionEmail
            ?? ''
        )
    )
);


/*
|--------------------------------------------------------------------------
| STATUS
|--------------------------------------------------------------------------
*/

$status = strtolower(
    trim(
        (string)(
            $currentUserArray['status']
            ?? 'active'
        )
    )
);


$blockedStatuses = [
    'blocked',
    'suspended',
    'disabled',
    'banned',
    'inactive'
];


if (
    in_array(
        $status,
        $blockedStatuses,
        true
    )
) {

    crownCashAdminAuthResponse(
        false,
        'Administrator account is not active.',
        403
    );
}


/*
|--------------------------------------------------------------------------
| ROLE
|--------------------------------------------------------------------------
*/

$role = strtolower(
    trim(
        (string)(
            $currentUserArray['role']
            ?? ''
        )
    )
);


/*
|--------------------------------------------------------------------------
| ACCOUNT TYPE
|--------------------------------------------------------------------------
*/

$accountType = strtolower(
    trim(
        (string)(
            $currentUserArray['account_type']
            ?? ''
        )
    )
);


/*
|--------------------------------------------------------------------------
| ADMIN ROLE CHECK
|--------------------------------------------------------------------------
*/

$isAdmin =
    in_array(
        $role,
        [
            'admin',
            'administrator'
        ],
        true
    )
    ||
    in_array(
        $accountType,
        [
            'admin',
            'administrator'
        ],
        true
    );


if (!$isAdmin) {

    crownCashAdminAuthResponse(
        false,
        'This account does not have administrator privileges.',
        403
    );
}


/*
|--------------------------------------------------------------------------
| ENVIRONMENT ADMIN RESTRICTIONS
|--------------------------------------------------------------------------
*/

$configuredAdminId =
    trim(
        (string)(
            getenv('ADMIN_USER_ID')
            ?: ''
        )
    );

$configuredAdminEmail =
    strtolower(
        trim(
            (string)(
                getenv('ADMIN_EMAIL')
                ?: ''
            )
        )
    );


/*
|--------------------------------------------------------------------------
| ADMIN IDENTITY CHECK
|--------------------------------------------------------------------------
*/

if (
    $configuredAdminId !== '' ||
    $configuredAdminEmail !== ''
) {

    $identityAuthorized = false;


    /*
     * ID match
     */
    if (
        $configuredAdminId !== '' &&
        $currentUserId !== '' &&
        hash_equals(
            strtolower($configuredAdminId),
            strtolower($currentUserId)
        )
    ) {

        $identityAuthorized = true;
    }


    /*
     * Email match
     */
    if (
        !$identityAuthorized &&
        $configuredAdminEmail !== '' &&
        $currentUserEmail !== '' &&
        hash_equals(
            $configuredAdminEmail,
            $currentUserEmail
        )
    ) {

        $identityAuthorized = true;
    }


    if (!$identityAuthorized) {

        crownCashAdminAuthResponse(
            false,
            'This administrator account is not authorized.',
            403
        );
    }
}


/*
|--------------------------------------------------------------------------
| REFRESH SESSION
|--------------------------------------------------------------------------
|
| Keep the SAME session and SAME session name.
| Do NOT regenerate the session on every admin API request.
|--------------------------------------------------------------------------
*/

$_SESSION['logged_in'] = true;

$_SESSION['authenticated'] = true;

$_SESSION['user_id'] =
    $currentUserId;

$_SESSION['userId'] =
    $currentUserId;

$_SESSION['id'] =
    $currentUserId;

$_SESSION['_id'] =
    $currentUserId;

$_SESSION['user_email'] =
    $currentUserEmail;

$_SESSION['email'] =
    $currentUserEmail;

$_SESSION['role'] =
    $role;

$_SESSION['account_type'] =
    $accountType;


/*
|--------------------------------------------------------------------------
| DO NOT RESET login_time ON EVERY REQUEST
|--------------------------------------------------------------------------
|
| This is important.
|
| login_time should represent the actual login time, not every API
| request. Therefore only create it if it doesn't already exist.
|--------------------------------------------------------------------------
*/

if (
    !isset($_SESSION['login_time']) ||
    (int)$_SESSION['login_time'] <= 0
) {

    $_SESSION['login_time'] =
        time();
}


/*
|--------------------------------------------------------------------------
| WRITE SESSION
|--------------------------------------------------------------------------
*/

if (
    function_exists('session_write_close') &&
    session_status() === PHP_SESSION_ACTIVE
) {

    session_write_close();
}


/*
|--------------------------------------------------------------------------
| ADMIN NAME
|--------------------------------------------------------------------------
*/

$firstName = trim(
    (string)(
        $currentUserArray['first_name']
        ?? $currentUserArray['firstname']
        ?? $currentUserArray['firstName']
        ?? ''
    )
);

$lastName = trim(
    (string)(
        $currentUserArray['last_name']
        ?? $currentUserArray['lastname']
        ?? $currentUserArray['lastName']
        ?? ''
    )
);

$fullName = trim(
    (string)(
        $currentUserArray['full_name']
        ?? $currentUserArray['fullName']
        ?? $currentUserArray['name']
        ?? ''
    )
);

if ($fullName === '') {

    $fullName =
        trim(
            $firstName .
            ' ' .
            $lastName
        );
}

if ($fullName === '') {

    $fullName =
        'Administrator';
}


/*
|--------------------------------------------------------------------------
| SUCCESS
|--------------------------------------------------------------------------
*/

crownCashAdminAuthResponse(
    true,
    'Administrator access confirmed.',
    200,
    [
        'admin' => [
            'id' => $currentUserId,
            'email' => $currentUserEmail,
            'name' => $fullName,
            'first_name' => $firstName,
            'last_name' => $lastName,
            'role' => $role,
            'account_type' => $accountType,
            'status' => $status
        ]
    ]
);

?>