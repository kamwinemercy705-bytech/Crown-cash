<?php
declare(strict_types=1);

/*
|--------------------------------------------------------------------------
| CROWN CASH - ADMIN DEPOSIT MANAGEMENT
|--------------------------------------------------------------------------
| GET  = Load deposits for administrators
| POST = Approve / Reject deposits
|
| SECURITY:
| - Uses CROWN_CASH_SESSION
| - Requires authenticated user
| - Requires server-side admin role
| - is_admin === true is accepted
| - Environment admin IDs/emails NEVER elevate a normal user
| - Environment admin IDs/emails may only restrict an already-authorized
|   administrator
|--------------------------------------------------------------------------
*/

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
    header('Access-Control-Allow-Origin: ' . $requestOrigin);
}

header('Access-Control-Allow-Credentials: true');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Max-Age: 86400');
header('Vary: Origin');
header('Content-Type: application/json; charset=utf-8');


/* =========================================================
   PREFLIGHT
========================================================= */

if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
    http_response_code(204);
    exit;
}


/* =========================================================
   CANONICAL SESSION
========================================================= */

try {

    if (function_exists('startSecureSession')) {

        startSecureSession();

    } else {

        if (session_status() !== PHP_SESSION_ACTIVE) {

            ini_set('session.use_only_cookies', '1');
            ini_set('session.use_strict_mode', '1');
            ini_set('session.cookie_httponly', '1');

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
    }

} catch (Throwable $e) {

    error_log(
        'Admin deposit session error: ' . $e->getMessage()
    );

    jsonResponse([
        'success' => false,
        'authenticated' => false,
        'authorized' => false,
        'message' => 'Unable to start administrator session.'
    ], 500);
}


/* =========================================================
   AUTHENTICATION + ADMIN AUTHORIZATION
========================================================= */

$adminUser = null;

try {

    $loggedIn =
        (
            ($_SESSION['logged_in'] ?? false) === true
            ||
            ($_SESSION['authenticated'] ?? false) === true
        );

    $sessionUserId =
        $_SESSION['user_id']
        ?? $_SESSION['userId']
        ?? $_SESSION['id']
        ?? $_SESSION['_id']
        ?? null;


    /* -----------------------------------------------------
       NOT AUTHENTICATED
    ----------------------------------------------------- */

    if (!$loggedIn || empty($sessionUserId)) {

        jsonResponse([
            'success' => false,
            'authenticated' => false,
            'authorized' => false,
            'message' => 'Please login first.'
        ], 401);
    }


    /* -----------------------------------------------------
       FIND USER BY OBJECT ID
    ----------------------------------------------------- */

    $adminObjectId = objectIdOrNull($sessionUserId);

    if ($adminObjectId) {

        $adminUser = $users->findOne([
            '_id' => $adminObjectId
        ]);
    }


    /* -----------------------------------------------------
       FIND USER BY STRING ID
    ----------------------------------------------------- */

    if (!$adminUser) {

        $sessionIdString = trim((string)$sessionUserId);

        if ($sessionIdString !== '') {

            try {

                $adminUser = $users->findOne([
                    'id' => $sessionIdString
                ]);

            } catch (Throwable $ignored) {
            }
        }
    }


    /* -----------------------------------------------------
       FIND USER BY EMAIL
    ----------------------------------------------------- */

    if (!$adminUser) {

        $sessionEmail = strtolower(
            trim(
                (string)(
                    $_SESSION['user_email']
                    ?? $_SESSION['email']
                    ?? ''
                )
            )
        );

        if ($sessionEmail !== '') {

            $adminUser = $users->findOne([
                'email' => $sessionEmail
            ]);
        }
    }


    /* -----------------------------------------------------
       USER NOT FOUND
    ----------------------------------------------------- */

    if (!$adminUser) {

        jsonResponse([
            'success' => false,
            'authenticated' => false,
            'authorized' => false,
            'message' => 'Administrator account could not be found.'
        ], 401);
    }


    /* =====================================================
       ACCOUNT STATUS
    ===================================================== */

    $accountStatus = strtolower(
        trim(
            (string)(
                $adminUser['status'] ?? 'active'
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

        jsonResponse([
            'success' => false,
            'authenticated' => false,
            'authorized' => false,
            'message' => 'Administrator account is not active.'
        ], 403);
    }


    /* =====================================================
       DATABASE ADMIN ROLE
    ===================================================== */

    $role = strtolower(
        trim(
            (string)(
                $adminUser['role'] ?? ''
            )
        )
    );

    $accountType = strtolower(
        trim(
            (string)(
                $adminUser['account_type']
                ?? $adminUser['accountType']
                ?? ''
            )
        )
    );


    /* -----------------------------------------------------
       EXPLICIT ADMIN FLAG
    ----------------------------------------------------- */

    $isAdminFlag =
        isset($adminUser['is_admin'])
        &&
        $adminUser['is_admin'] === true;


    /* -----------------------------------------------------
       ADMIN ROLES
    ----------------------------------------------------- */

    $isAdminRole = in_array(
        $role,
        [
            'admin',
            'administrator',
            'super_admin',
            'superadmin'
        ],
        true
    );


    /* -----------------------------------------------------
       ADMIN ACCOUNT TYPES
    ----------------------------------------------------- */

    $isAdminAccountType = in_array(
        $accountType,
        [
            'admin',
            'administrator',
            'super_admin',
            'superadmin'
        ],
        true
    );


    /*
     * IMPORTANT:
     *
     * The database record is the source of truth.
     *
     * ADMIN_EMAIL and ADMIN_USER_ID are NEVER used to
     * promote an ordinary user into an administrator.
     */
    $isAdmin =
        $isAdminFlag
        ||
        $isAdminRole
        ||
        $isAdminAccountType;


    /* =====================================================
       DENY NORMAL USER
    ===================================================== */

    if (!$isAdmin) {

        error_log(
            'Unauthorized admin deposit access attempt. User ID: '
            .
            (string)(
                $adminUser['_id']
                ?? $sessionUserId
            )
        );

        jsonResponse([
            'success' => false,
            'authenticated' => true,
            'authorized' => false,
            'message' => 'Administrator access required.'
        ], 403);
    }


    /* =====================================================
       OPTIONAL ENVIRONMENT RESTRICTION
    ===================================================== */

    /*
     * Environment values may restrict WHICH authorized
     * administrators can use this endpoint.
     *
     * They can NEVER grant administrator privileges.
     */

    $configuredAdminUserId =
        trim(
            (string)(
                getenv('ADMIN_USER_ID')
                ?: ($_ENV['ADMIN_USER_ID'] ?? '')
            )
        );

    $configuredAdminEmail =
        strtolower(
            trim(
                (string)(
                    getenv('ADMIN_EMAIL')
                    ?: ($_ENV['ADMIN_EMAIL'] ?? '')
                )
            )
        );


    if ($configuredAdminUserId !== '') {

        $databaseAdminId =
            (string)(
                $adminUser['_id']
                ?? $adminUser['id']
                ?? ''
            );

        if (
            $databaseAdminId !== ''
            &&
            $databaseAdminId !== $configuredAdminUserId
        ) {

            jsonResponse([
                'success' => false,
                'authenticated' => true,
                'authorized' => false,
                'message' => 'Administrator access is restricted.'
            ], 403);
        }
    }


    if ($configuredAdminEmail !== '') {

        $databaseAdminEmail = strtolower(
            trim(
                (string)(
                    $adminUser['email'] ?? ''
                )
            )
        );

        if (
            $databaseAdminEmail !== ''
            &&
            $databaseAdminEmail !== $configuredAdminEmail
        ) {

            jsonResponse([
                'success' => false,
                'authenticated' => true,
                'authorized' => false,
                'message' => 'Administrator access is restricted.'
            ], 403);
        }
    }


    /* =====================================================
       SYNCHRONIZE SESSION
    ===================================================== */

    $_SESSION['logged_in'] = true;
    $_SESSION['authenticated'] = true;

    $_SESSION['user_id'] =
        $adminUser['_id']
        ?? $sessionUserId;

    $_SESSION['userId'] =
        $adminUser['_id']
        ?? $sessionUserId;

    $_SESSION['id'] =
        $adminUser['_id']
        ?? $sessionUserId;

    $_SESSION['role'] =
        $role !== ''
            ? $role
            : 'admin';

    $_SESSION['account_type'] =
        $accountType !== ''
            ? $accountType
            : 'admin';

    $_SESSION['is_admin'] = true;

    if (!isset($_SESSION['login_time'])) {
        $_SESSION['login_time'] = time();
    }


} catch (Throwable $e) {

    error_log(
        'Admin deposit authentication error: '
        . $e->getMessage()
    );

    jsonResponse([
        'success' => false,
        'authenticated' => false,
        'authorized' => false,
        'message' => 'Administrator authentication failed.'
    ], 401);
}


/* =========================================================
   ADMIN ID
========================================================= */

$adminId =
    $adminUser['_id']
    ?? $sessionUserId;


/* =========================================================
   GET DEPOSITS
========================================================= */

if ($_SERVER['REQUEST_METHOD'] === 'GET') {

    try {

        $items = [];

        $cursor = $deposits->find(
            [],
            [
                'sort' => [
                    'created_at' => -1
                ],
                'limit' => 500
            ]
        );


        foreach ($cursor as $deposit) {

            /* -------------------------------------------------
               FIND USER
            ------------------------------------------------- */

            $rawUserId =
                $deposit['user_id']
                ?? $deposit['userId']
                ?? null;

            $userId =
                objectIdOrNull($rawUserId);

            $user = null;


            if ($userId) {

                $user = $users->findOne([
                    '_id' => $userId
                ]);
            }


            /* -------------------------------------------------
               STRING USER ID FALLBACK
            ------------------------------------------------- */

            if (
                !$user
                &&
                $rawUserId !== null
                &&
                trim((string)$rawUserId) !== ''
            ) {

                try {

                    $user = $users->findOne([
                        'id' => (string)$rawUserId
                    ]);

                } catch (Throwable $ignored) {
                }
            }


            /* -------------------------------------------------
               EMAIL FALLBACK
            ------------------------------------------------- */

            if (
                !$user
                &&
                !empty($deposit['email'])
            ) {

                $user = $users->findOne([
                    'email' => $deposit['email']
                ]);
            }


            /* -------------------------------------------------
               USER NAME
            ------------------------------------------------- */

            $userName = trim(
                (string)(
                    $deposit['customer_name'] ?? ''
                )
            );


            if ($userName === '' && $user) {

                $firstName = (string)(
                    $user['firstName']
                    ?? $user['first_name']
                    ?? ''
                );

                $lastName = (string)(
                    $user['lastName']
                    ?? $user['last_name']
                    ?? ''
                );

                $userName = trim(
                    $firstName . ' ' . $lastName
                );


                if ($userName === '') {

                    $userName = (string)(
                        $user['full_name']
                        ?? $user['name']
                        ?? ''
                    );
                }
            }


            if ($userName === '') {
                $userName = 'Unknown Customer';
            }


            /* -------------------------------------------------
               SAFE RETURN DATA
            ------------------------------------------------- */

            $items[] = jsonSafe([

                'id' =>
                    $deposit['_id'],

                'user_id' =>
                    $rawUserId,

                'userId' =>
                    $rawUserId,

                'user_name' =>
                    $userName,

                'customer_name' =>
                    $userName,

                'email' =>
                    $deposit['email']
                    ?? (
                        $user['email']
                        ?? ''
                    ),

                'phone' =>
                    $deposit['phone']
                    ?? (
                        $user['phone']
                        ?? ''
                    ),

                'amount' =>
                    moneyInt(
                        $deposit['amount'] ?? 0
                    ),

                'currency' =>
                    $deposit['currency'] ?? 'UGX',

                'payment_method' =>
                    $deposit['payment_method']
                    ?? $deposit['paymentMethod']
                    ?? '',

                'paymentMethod' =>
                    $deposit['payment_method']
                    ?? $deposit['paymentMethod']
                    ?? '',

                'merchant_code' =>
                    $deposit['merchant_code'] ?? '',

                'transaction_reference' =>
                    $deposit['transaction_reference']
                    ?? $deposit['transactionReference']
                    ?? '',

                'transactionReference' =>
                    $deposit['transaction_reference']
                    ?? $deposit['transactionReference']
                    ?? '',

                'status' =>
                    $deposit['status'] ?? 'pending',

                'verified' =>
                    (bool)(
                        $deposit['verified'] ?? false
                    ),

                'approved' =>
                    (bool)(
                        $deposit['approved'] ?? false
                    ),

                'balance_credited' =>
                    (bool)(
                        $deposit['balance_credited'] ?? false
                    ),

                'created_at' =>
                    $deposit['created_at'] ?? null,

                'updated_at' =>
                    $deposit['updated_at'] ?? null,

                'approved_at' =>
                    $deposit['approved_at'] ?? null,

                'rejection_reason' =>
                    $deposit['rejection_reason'] ?? ''

            ]);
        }


        jsonResponse([

            'success' => true,
            'authenticated' => true,
            'authorized' => true,
            'admin' => true,

            'deposits' => $items,
            'data' => $items,
            'total' => count($items)

        ]);

    } catch (Throwable $e) {

        error_log(
            'Admin deposit GET error: '
            . $e->getMessage()
        );

        jsonResponse([
            'success' => false,
            'message' => 'Unable to load deposits.'
        ], 500);
    }
}


/* =========================================================
   ONLY POST BELOW
========================================================= */

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {

    jsonResponse([
        'success' => false,
        'message' => 'Method not allowed.'
    ], 405);
}


/* =========================================================
   READ REQUEST
========================================================= */

$rawInput =
    file_get_contents('php://input');

$input =
    json_decode(
        $rawInput,
        true
    );

if (!is_array($input)) {
    $input = $_POST;
}


/* =========================================================
   REQUEST VALUES
========================================================= */

$id = trim(
    (string)(
        $input['depositId']
        ?? $input['deposit_id']
        ?? $input['id']
        ?? ''
    )
);

$action = strtolower(
    trim(
        (string)(
            $input['action'] ?? ''
        )
    )
);

$reason = trim(
    (string)(
        $input['reason']
        ?? $input['rejection_reason']
        ?? ''
    )
);


/* =========================================================
   VALIDATE REQUEST
========================================================= */

if (
    !isValidObjectId($id)
    ||
    !in_array(
        $action,
        [
            'approve',
            'reject'
        ],
        true
    )
) {

    jsonResponse([
        'success' => false,
        'message' => 'Invalid deposit ID or action.'
    ], 400);
}


$depositId =
    new MongoDB\BSON\ObjectId($id);


/* =========================================================
   PROCESS DEPOSIT
========================================================= */

$session = null;
$transactionCommitted = false;

try {

    $session =
        $client->startSession();

    $session->startTransaction();


    /* =====================================================
       FIND DEPOSIT
    ===================================================== */

    $deposit =
        $deposits->findOne(
            [
                '_id' => $depositId
            ],
            [
                'session' => $session
            ]
        );


    if (!$deposit) {

        throw new RuntimeException(
            'Deposit not found.'
        );
    }


    /* =====================================================
       CHECK STATUS
    ===================================================== */

    $status = strtolower(
        (string)(
            $deposit['status'] ?? 'pending'
        )
    );


    if (
        !in_array(
            $status,
            [
                'pending',
                'submitted',
                'processing'
            ],
            true
        )
    ) {

        throw new RuntimeException(
            'This deposit has already been processed.'
        );
    }


    /* =====================================================
       AMOUNT
    ===================================================== */

    $amount =
        moneyInt(
            $deposit['amount'] ?? 0
        );


    if ($amount <= 0) {

        throw new RuntimeException(
            'Invalid deposit amount.'
        );
    }


    /* =====================================================
       FIND USER
    ===================================================== */

    $rawUserId =
        $deposit['user_id']
        ?? $deposit['userId']
        ?? null;

    $userId =
        objectIdOrNull($rawUserId);


    /* -----------------------------------------------------
       STRING ID FALLBACK
    ----------------------------------------------------- */

    if (!$userId && $rawUserId !== null) {

        $rawUserIdString =
            trim((string)$rawUserId);

        if ($rawUserIdString !== '') {

            $user =
                $users->findOne(
                    [
                        'id' => $rawUserIdString
                    ],
                    [
                        'session' => $session
                    ]
                );

            if ($user) {
                $userId = $user['_id'];
            }
        }
    }


    /* -----------------------------------------------------
       EMAIL FALLBACK
    ----------------------------------------------------- */

    if (
        !$userId
        &&
        !empty($deposit['email'])
    ) {

        $user =
            $users->findOne(
                [
                    'email' => $deposit['email']
                ],
                [
                    'session' => $session
                ]
            );

        if ($user) {
            $userId = $user['_id'];
        }
    }


    if (!$userId) {

        throw new RuntimeException(
            'Deposit owner could not be identified.'
        );
    }


    $now = nowUtc();


    /* =====================================================
       REJECT
    ===================================================== */

    if ($action === 'reject') {

        $rejectionReason =
            $reason !== ''
                ? $reason
                : 'Deposit rejected by administrator.';


        $depositUpdate =
            $deposits->updateOne(
                [
                    '_id' => $depositId,
                    'status' => [
                        '$in' => [
                            'pending',
                            'submitted',
                            'processing'
                        ]
                    ]
                ],
                [
                    '$set' => [

                        'status' =>
                            'rejected',

                        'approved' =>
                            false,

                        'verified' =>
                            false,

                        'rejected_by' =>
                            $adminId,

                        'rejection_reason' =>
                            $rejectionReason,

                        'updated_at' =>
                            $now

                    ]
                ],
                [
                    'session' => $session
                ]
            );


        if (
            $depositUpdate->getModifiedCount()
            !== 1
        ) {

            throw new RuntimeException(
                'Deposit could not be rejected.'
            );
        }


        /* -------------------------------------------------
           RELATED TRANSACTION
        ------------------------------------------------- */

        $transactions->updateMany(
            [
                'deposit_id' => $depositId,
                'status' => 'pending'
            ],
            [
                '$set' => [

                    'status' =>
                        'rejected',

                    'rejected_by' =>
                        $adminId,

                    'rejection_reason' =>
                        $rejectionReason,

                    'updated_at' =>
                        $now

                ]
            ],
            [
                'session' => $session
            ]
        );


        $session->commitTransaction();

        $transactionCommitted = true;


        /* -------------------------------------------------
           AUDIT
        ------------------------------------------------- */

        try {

            audit(
                'deposit_rejected',
                $adminId,
                [
                    'deposit_id' =>
                        $id,

                    'reason' =>
                        $rejectionReason
                ]
            );

        } catch (Throwable $auditError) {

            error_log(
                'Deposit rejection audit error: '
                . $auditError->getMessage()
            );
        }


        jsonResponse([
            'success' => true,
            'message' => 'Deposit rejected.',
            'deposit_id' => $id
        ]);
    }


    /* =====================================================
       APPROVE
    ===================================================== */

    if (
        ($deposit['balance_credited'] ?? false)
        === true
    ) {

        throw new RuntimeException(
            'This deposit has already credited the wallet.'
        );
    }


    /* =====================================================
       CREDIT USER WALLET
    ===================================================== */

    $balanceUpdate =
        $users->updateOne(
            [
                '_id' => $userId
            ],
            [
                '$inc' => [
                    'balance' => $amount
                ],
                '$set' => [
                    'updated_at' => $now
                ]
            ],
            [
                'session' => $session
            ]
        );


    if (
        $balanceUpdate->getMatchedCount()
        !== 1
    ) {

        throw new RuntimeException(
            'User wallet could not be credited.'
        );
    }


    /* =====================================================
       APPROVE DEPOSIT
    ===================================================== */

    $depositUpdate =
        $deposits->updateOne(
            [
                '_id' => $depositId,

                'balance_credited' => [
                    '$ne' => true
                ],

                'status' => [
                    '$in' => [
                        'pending',
                        'submitted',
                        'processing'
                    ]
                ]
            ],
            [
                '$set' => [

                    'status' =>
                        'approved',

                    'approved' =>
                        true,

                    'verified' =>
                        true,

                    'balance_credited' =>
                        true,

                    'approved_by' =>
                        $adminId,

                    'approved_at' =>
                        $now,

                    'processed_at' =>
                        $now,

                    'updated_at' =>
                        $now

                ]
            ],
            [
                'session' => $session
            ]
        );


    if (
        $depositUpdate->getModifiedCount()
        !== 1
    ) {

        throw new RuntimeException(
            'Deposit could not be approved.'
        );
    }


    /* =====================================================
       FIND EXISTING TRANSACTION
    ===================================================== */

    $existingTransaction =
        $transactions->findOne(
            [
                'deposit_id' =>
                    $depositId
            ],
            [
                'session' =>
                    $session
            ]
        );


    /* =====================================================
       UPDATE / CREATE TRANSACTION
    ===================================================== */

    if ($existingTransaction) {

        $transactions->updateOne(
            [
                '_id' =>
                    $existingTransaction['_id']
            ],
            [
                '$set' => [

                    'user_id' =>
                        $userId,

                    'type' =>
                        'deposit',

                    'transaction_type' =>
                        'deposit',

                    'status' =>
                        'approved',

                    'payment_status' =>
                        'approved',

                    'balance_credited' =>
                        true,

                    'approved_by' =>
                        $adminId,

                    'approved_at' =>
                        $now,

                    'updated_at' =>
                        $now

                ]
            ],
            [
                'session' =>
                    $session
            ]
        );

    } else {

        $reference =
            $deposit['transaction_reference']
            ?? $deposit['transactionReference']
            ?? (
                'DEP-'
                .
                strtoupper(
                    bin2hex(
                        random_bytes(6)
                    )
                )
            );


        $transactions->insertOne(
            [

                'user_id' =>
                    $userId,

                'deposit_id' =>
                    $depositId,

                'type' =>
                    'deposit',

                'transaction_type' =>
                    'deposit',

                'title' =>
                    'Deposit approved',

                'description' =>
                    'Deposit approved and wallet credited.',

                'amount' =>
                    $amount,

                'currency' =>
                    $deposit['currency']
                    ?? 'UGX',

                'status' =>
                    'approved',

                'payment_status' =>
                    'approved',

                'balance_credited' =>
                    true,

                'reference' =>
                    $reference,

                'transaction_reference' =>
                    $reference,

                'approved_by' =>
                    $adminId,

                'approved_at' =>
                    $now,

                'created_at' =>
                    $now,

                'updated_at' =>
                    $now

            ],
            [
                'session' =>
                    $session
            ]
        );
    }


    /* =====================================================
       COMMIT
    ===================================================== */

    $session->commitTransaction();

    $transactionCommitted = true;


    /* =====================================================
       AUDIT
    ===================================================== */

    try {

        audit(
            'deposit_approved',
            $adminId,
            [
                'deposit_id' =>
                    $id,

                'amount' =>
                    $amount,

                'user_id' =>
                    (string)$userId
            ]
        );

    } catch (Throwable $auditError) {

        error_log(
            'Deposit approval audit error: '
            . $auditError->getMessage()
        );
    }


    /* =====================================================
       SUCCESS
    ===================================================== */

    jsonResponse([

        'success' =>
            true,

        'authenticated' =>
            true,

        'authorized' =>
            true,

        'admin' =>
            true,

        'message' =>
            'Deposit approved and wallet credited.',

        'amount' =>
            $amount,

        'deposit_id' =>
            $id

    ]);


} catch (Throwable $e) {

    if (
        $session !== null
        &&
        !$transactionCommitted
    ) {

        try {
            $session->abortTransaction();
        } catch (Throwable $ignored) {
        }
    }


    error_log(
        'Admin deposit processing error: '
        . $e->getMessage()
    );


    $message =
        'Unable to process deposit request.';


    if (
        $e instanceof RuntimeException
        &&
        in_array(
            $e->getMessage(),
            [
                'Deposit not found.',
                'This deposit has already been processed.',
                'Invalid deposit amount.',
                'Deposit owner could not be identified.',
                'Deposit could not be rejected.',
                'This deposit has already credited the wallet.',
                'User wallet could not be credited.',
                'Deposit could not be approved.'
            ],
            true
        )
    ) {

        $message =
            $e->getMessage();
    }


    jsonResponse([

        'success' =>
            false,

        'authenticated' =>
            true,

        'authorized' =>
            true,

        'message' =>
            $message

    ], 400);
}