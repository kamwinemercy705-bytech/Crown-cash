<?php

/*
|--------------------------------------------------------------------------
| CROWN CASH - ADMIN DASHBOARD API
|--------------------------------------------------------------------------
*/

declare(strict_types=1);


/*
|--------------------------------------------------------------------------
| LOAD CONFIGURATION FIRST
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
| HEADERS
|--------------------------------------------------------------------------
*/

header('Content-Type: application/json; charset=utf-8');

$allowedOrigins = [
    'https://crown-cash.vercel.app',
    'https://www.crown-cash.vercel.app'
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

    header('Vary: Origin');
}


/*
|--------------------------------------------------------------------------
| OPTIONS
|--------------------------------------------------------------------------
*/

if (
    ($_SERVER['REQUEST_METHOD'] ?? '') ===
    'OPTIONS'
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
    ($_SERVER['REQUEST_METHOD'] ?? '') !==
    'GET'
) {

    http_response_code(405);

    echo json_encode([
        'success' => false,
        'message' => 'Method not allowed.'
    ]);

    exit;
}


/*
|--------------------------------------------------------------------------
| SESSION
|--------------------------------------------------------------------------
|
| IMPORTANT:
| Do NOT call session_start() with the default PHPSESSID.
|
| config.php is responsible for the Crown Cash session.
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

} catch (Throwable $e) {

    http_response_code(500);

    echo json_encode([
        'success' => false,
        'authenticated' => false,
        'authorized' => false,
        'message' => 'Unable to initialize session.'
    ]);

    exit;
}


/*
|--------------------------------------------------------------------------
| RESPONSE
|--------------------------------------------------------------------------
*/

function crownCashDashboardResponse(
    bool $success,
    string $message,
    array $extra = [],
    int $status = 200
): void {

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


/*
|--------------------------------------------------------------------------
| AUTHENTICATION
|--------------------------------------------------------------------------
*/

$loggedIn =
    isset($_SESSION['logged_in']) &&
    $_SESSION['logged_in'] === true;

$sessionUserId =
    trim(
        (string)(
            $_SESSION['user_id']
            ?? ''
        )
    );


if (
    !$loggedIn ||
    $sessionUserId === ''
) {

    crownCashDashboardResponse(
        false,
        'Authentication required.',
        [
            'authenticated' => false,
            'authorized' => false
        ],
        401
    );
}


/*
|--------------------------------------------------------------------------
| DATABASE COLLECTIONS
|--------------------------------------------------------------------------
*/

try {

    if (!isset($users)) {

        crownCashDashboardResponse(
            false,
            'Users collection is unavailable.',
            [],
            500
        );
    }

    if (!isset($deposits)) {
        $deposits =
            $db->selectCollection(
                'deposits'
            );
    }

    if (!isset($withdrawals)) {
        $withdrawals =
            $db->selectCollection(
                'withdrawals'
            );
    }

    if (!isset($investments)) {
        $investments =
            $db->selectCollection(
                'investments'
            );
    }

    if (!isset($referrals)) {
        $referrals =
            $db->selectCollection(
                'referrals'
            );
    }

    if (!isset($transactions)) {
        $transactions =
            $db->selectCollection(
                'transactions'
            );
    }

    try {

        $supportTickets =
            $db->selectCollection(
                'support_tickets'
            );

    } catch (Throwable $e) {

        $supportTickets = null;
    }

} catch (Throwable $e) {

    crownCashDashboardResponse(
        false,
        'Database collections could not be loaded.',
        [],
        500
    );
}


/*
|--------------------------------------------------------------------------
| FIND CURRENT ADMIN
|--------------------------------------------------------------------------
*/

$currentUser = null;


/*
|--------------------------------------------------------------------------
| BY OBJECT ID
|--------------------------------------------------------------------------
*/

try {

    if (
        preg_match(
            '/^[a-f0-9]{24}$/i',
            $sessionUserId
        )
    ) {

        $currentUser =
            $users->findOne([
                '_id' =>
                    new MongoDB\BSON\ObjectId(
                        $sessionUserId
                    )
            ]);
    }

} catch (Throwable $e) {

    $currentUser = null;
}


/*
|--------------------------------------------------------------------------
| BY STRING ID
|--------------------------------------------------------------------------
*/

if (!$currentUser) {

    try {

        $currentUser =
            $users->findOne([
                'id' =>
                    $sessionUserId
            ]);

    } catch (Throwable $e) {

        $currentUser = null;
    }
}


/*
|--------------------------------------------------------------------------
| BY EMAIL
|--------------------------------------------------------------------------
*/

if (!$currentUser) {

    $sessionEmail =
        strtolower(
            trim(
                (string)(
                    $_SESSION['user_email']
                    ?? $_SESSION['email']
                    ?? ''
                )
            )
        );

    if ($sessionEmail !== '') {

        try {

            $currentUser =
                $users->findOne([
                    'email' =>
                        $sessionEmail
                ]);

        } catch (Throwable $e) {

            $currentUser = null;
        }
    }
}


/*
|--------------------------------------------------------------------------
| USER NOT FOUND
|--------------------------------------------------------------------------
*/

if (!$currentUser) {

    crownCashDashboardResponse(
        false,
        'Administrator account could not be found.',
        [
            'authenticated' => false,
            'authorized' => false
        ],
        401
    );
}


/*
|--------------------------------------------------------------------------
| USER ARRAY
|--------------------------------------------------------------------------
*/

$user =
    is_array($currentUser)
        ? $currentUser
        : (array)$currentUser;


/*
|--------------------------------------------------------------------------
| ADMIN ID
|--------------------------------------------------------------------------
*/

$currentUserId = '';

if (
    isset($user['_id'])
) {

    if (
        $user['_id']
        instanceof MongoDB\BSON\ObjectId
    ) {

        $currentUserId =
            (string)$user['_id'];

    } else {

        $currentUserId =
            trim(
                (string)$user['_id']
            );
    }
}

if ($currentUserId === '') {

    $currentUserId =
        trim(
            (string)(
                $user['id']
                ?? $sessionUserId
            )
        );
}


/*
|--------------------------------------------------------------------------
| USER DETAILS
|--------------------------------------------------------------------------
*/

$email =
    strtolower(
        trim(
            (string)(
                $user['email']
                ?? ''
            )
        )
    );

$role =
    strtolower(
        trim(
            (string)(
                $user['role']
                ?? ''
            )
        )
    );

$accountType =
    strtolower(
        trim(
            (string)(
                $user['account_type']
                ?? ''
            )
        )
    );

$status =
    strtolower(
        trim(
            (string)(
                $user['status']
                ?? 'active'
            )
        )
    );


/*
|--------------------------------------------------------------------------
| STATUS CHECK
|--------------------------------------------------------------------------
*/

if (
    in_array(
        $status,
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

    crownCashDashboardResponse(
        false,
        'Administrator account is not active.',
        [
            'authenticated' => true,
            'authorized' => false
        ],
        403
    );
}


/*
|--------------------------------------------------------------------------
| ADMIN CHECK
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

    crownCashDashboardResponse(
        false,
        'Administrator privileges are required.',
        [
            'authenticated' => true,
            'authorized' => false
        ],
        403
    );
}


/*
|--------------------------------------------------------------------------
| ENVIRONMENT ADMIN CHECK
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


if (
    $configuredAdminId !== '' ||
    $configuredAdminEmail !== ''
) {

    $idMatches =
        $configuredAdminId !== '' &&
        strtolower(
            $configuredAdminId
        ) === strtolower(
            $currentUserId
        );

    $emailMatches =
        $configuredAdminEmail !== '' &&
        strtolower(
            $configuredAdminEmail
        ) === strtolower(
            $email
        );

    if (
        !$idMatches &&
        !$emailMatches
    ) {

        crownCashDashboardResponse(
            false,
            'This administrator account is not authorized for the dashboard.',
            [
                'authenticated' => true,
                'authorized' => false
            ],
            403
        );
    }
}


/*
|--------------------------------------------------------------------------
| NUMBER HELPER
|--------------------------------------------------------------------------
*/

function crownCashNumber(
    mixed $value
): float {

    if (
        $value === null
    ) {
        return 0.0;
    }

    if (
        is_int($value) ||
        is_float($value)
    ) {
        return (float)$value;
    }

    if (
        is_string($value)
    ) {

        $value =
            str_replace(
                ',',
                '',
                trim($value)
            );

        return is_numeric($value)
            ? (float)$value
            : 0.0;
    }

    if (
        is_object($value) &&
        method_exists(
            $value,
            '__toString'
        )
    ) {

        try {

            $value =
                (string)$value;

            return is_numeric($value)
                ? (float)$value
                : 0.0;

        } catch (Throwable $e) {

            return 0.0;
        }
    }

    return 0.0;
}


/*
|--------------------------------------------------------------------------
| DATE HELPER
|--------------------------------------------------------------------------
*/

function crownCashDate(
    mixed $value
): ?DateTimeImmutable {

    if (
        $value instanceof
        MongoDB\BSON\UTCDateTime
    ) {

        try {

            return $value
                ->toDateTime()
                ->setTimezone(
                    new DateTimeZone('UTC')
                );

        } catch (Throwable $e) {

            return null;
        }
    }

    if (
        $value instanceof
        DateTimeInterface
    ) {

        try {

            return new DateTimeImmutable(
                $value->format('c')
            );

        } catch (Throwable $e) {

            return null;
        }
    }

    if (
        is_string($value) &&
        trim($value) !== ''
    ) {

        try {

            return new DateTimeImmutable(
                $value
            );

        } catch (Throwable $e) {

            return null;
        }
    }

    return null;
}


/*
|--------------------------------------------------------------------------
| USER NAME
|--------------------------------------------------------------------------
*/

$firstName =
    trim(
        (string)(
            $user['first_name']
            ?? $user['firstname']
            ?? $user['firstName']
            ?? ''
        )
    );

$lastName =
    trim(
        (string)(
            $user['last_name']
            ?? $user['lastname']
            ?? $user['lastName']
            ?? ''
        )
    );

$adminName =
    trim(
        (string)(
            $user['full_name']
            ?? $user['fullName']
            ?? $user['name']
            ?? ''
        )
    );

if ($adminName === '') {

    $adminName =
        trim(
            $firstName .
            ' ' .
            $lastName
        );
}

if ($adminName === '') {

    $adminName =
        'Administrator';
}


/*
|--------------------------------------------------------------------------
| USER STATISTICS
|--------------------------------------------------------------------------
*/

$totalUsers = 0;
$activeUsers = 0;
$newAccounts = 0;

try {

    $totalUsers =
        $users->countDocuments([]);

} catch (Throwable $e) {}


try {

    $activeUsers =
        $users->countDocuments([
            'status' => 'active'
        ]);

} catch (Throwable $e) {}


/*
|--------------------------------------------------------------------------
| NEW ACCOUNTS - LAST 24 HOURS
|--------------------------------------------------------------------------
*/

try {

    $now =
        new DateTimeImmutable(
            'now',
            new DateTimeZone('UTC')
        );

    $last24Hours =
        $now->sub(
            new DateInterval('PT24H')
        );

    $newAccounts =
        $users->countDocuments([
            'created_at' => [
                '$gte' =>
                    new MongoDB\BSON\UTCDateTime(
                        $last24Hours
                            ->getTimestamp()
                        * 1000
                    ),

                '$lte' =>
                    new MongoDB\BSON\UTCDateTime(
                        $now
                            ->getTimestamp()
                        * 1000
                    )
            ]
        ]);

} catch (Throwable $e) {

    $newAccounts = 0;
}


/*
|--------------------------------------------------------------------------
| DEPOSITS
|--------------------------------------------------------------------------
*/

$totalDeposits = 0.0;
$pendingDeposits = 0.0;
$rejectedDeposits = 0.0;
$pendingDepositCount = 0;


try {

    foreach (
        $deposits->find([])
        as $document
    ) {

        $doc =
            is_array($document)
                ? $document
                : (array)$document;

        $amount =
            crownCashNumber(
                $doc['amount'] ?? 0
            );

        $depositStatus =
            strtolower(
                trim(
                    (string)(
                        $doc['status']
                        ?? ''
                    )
                )
            );

        $verified =
            !empty(
                $doc['verified']
            );

        if (
            $verified ||
            in_array(
                $depositStatus,
                [
                    'approved',
                    'verified',
                    'credited',
                    'completed'
                ],
                true
            )
        ) {

            $totalDeposits +=
                $amount;

        } elseif (
            in_array(
                $depositStatus,
                [
                    'pending',
                    'submitted',
                    'processing'
                ],
                true
            )
        ) {

            $pendingDeposits +=
                $amount;

        } elseif (
            in_array(
                $depositStatus,
                [
                    'rejected',
                    'declined',
                    'cancelled',
                    'canceled'
                ],
                true
            )
        ) {

            $rejectedDeposits +=
                $amount;
        }
    }

} catch (Throwable $e) {}


try {

    $pendingDepositCount =
        $deposits->countDocuments([
            'status' => [
                '$in' => [
                    'pending',
                    'submitted',
                    'processing'
                ]
            ]
        ]);

} catch (Throwable $e) {}


/*
|--------------------------------------------------------------------------
| WITHDRAWALS
|--------------------------------------------------------------------------
*/

$totalWithdrawals = 0.0;
$pendingWithdrawals = 0.0;
$pendingWithdrawalCount = 0;


try {

    foreach (
        $withdrawals->find([])
        as $document
    ) {

        $doc =
            is_array($document)
                ? $document
                : (array)$document;

        $amount =
            crownCashNumber(
                $doc['amount'] ?? 0
            );

        $withdrawalStatus =
            strtolower(
                trim(
                    (string)(
                        $doc['status']
                        ?? ''
                    )
                )
            );

        if (
            in_array(
                $withdrawalStatus,
                [
                    'approved',
                    'completed',
                    'paid',
                    'processed'
                ],
                true
            )
        ) {

            $totalWithdrawals +=
                $amount;

        } elseif (
            in_array(
                $withdrawalStatus,
                [
                    'pending',
                    'processing',
                    'submitted'
                ],
                true
            )
        ) {

            $pendingWithdrawals +=
                $amount;
        }
    }

} catch (Throwable $e) {}


try {

    $pendingWithdrawalCount =
        $withdrawals->countDocuments([
            'status' => [
                '$in' => [
                    'pending',
                    'processing',
                    'submitted'
                ]
            ]
        ]);

} catch (Throwable $e) {}


/*
|--------------------------------------------------------------------------
| INVESTMENTS
|--------------------------------------------------------------------------
*/

$totalInvestments = 0.0;
$activeInvestmentCount = 0;
$pendingInvestmentCount = 0;
$pendingInvestments = 0.0;


try {

    foreach (
        $investments->find([])
        as $document
    ) {

        $doc =
            is_array($document)
                ? $document
                : (array)$document;

        $amount =
            crownCashNumber(
                $doc['amount']
                ??
                $doc['principal']
                ??
                0
            );

        $investmentStatus =
            strtolower(
                trim(
                    (string)(
                        $doc['status']
                        ?? ''
                    )
                )
            );

        if (
            in_array(
                $investmentStatus,
                [
                    'active',
                    'approved',
                    'running',
                    'completed'
                ],
                true
            )
        ) {

            $totalInvestments +=
                $amount;
        }

        if (
            $investmentStatus ===
            'active'
        ) {

            $activeInvestmentCount++;
        }

        if (
            in_array(
                $investmentStatus,
                [
                    'pending',
                    'submitted',
                    'processing'
                ],
                true
            )
        ) {

            $pendingInvestmentCount++;

            $pendingInvestments +=
                $amount;
        }
    }

} catch (Throwable $e) {}


/*
|--------------------------------------------------------------------------
| REFERRALS
|--------------------------------------------------------------------------
*/

$totalReferrals = 0;

try {

    $totalReferrals =
        $referrals->countDocuments([]);

} catch (Throwable $e) {}


/*
|--------------------------------------------------------------------------
| TRANSACTIONS
|--------------------------------------------------------------------------
*/

$totalTransactions = 0;

try {

    $totalTransactions =
        $transactions->countDocuments([]);

} catch (Throwable $e) {}


/*
|--------------------------------------------------------------------------
| SUPPORT TICKETS
|--------------------------------------------------------------------------
*/

$openTickets = 0;

if (
    $supportTickets !== null
) {

    try {

        $openTickets =
            $supportTickets->countDocuments([
                'status' => [
                    '$in' => [
                        'open',
                        'pending',
                        'processing'
                    ]
                ]
            ]);

    } catch (Throwable $e) {}
}


/*
|--------------------------------------------------------------------------
| RECENT TRANSACTIONS
|--------------------------------------------------------------------------
*/

$recentTransactions = [];


try {

    $cursor =
        $transactions->find(
            [],
            [
                'sort' => [
                    'created_at' => -1
                ],
                'limit' => 8
            ]
        );


    foreach ($cursor as $document) {

        $doc =
            is_array($document)
                ? $document
                : (array)$document;

        $id = '';

        if (
            isset($doc['_id'])
        ) {

            if (
                $doc['_id']
                instanceof MongoDB\BSON\ObjectId
            ) {

                $id =
                    (string)$doc['_id'];

            } else {

                $id =
                    (string)$doc['_id'];
            }
        }

        if ($id === '') {

            $id =
                (string)(
                    $doc['id']
                    ?? ''
                );
        }

        $userId = '';

        if (
            isset($doc['user_id'])
        ) {

            if (
                $doc['user_id']
                instanceof MongoDB\BSON\ObjectId
            ) {

                $userId =
                    (string)$doc['user_id'];

            } else {

                $userId =
                    trim(
                        (string)$doc['user_id']
                    );
            }
        }

        $userName =
            trim(
                (string)(
                    $doc['user_name']
                    ??
                    $doc['name']
                    ??
                    ''
                )
            );


        /*
         * Resolve user name.
         */
        if (
            $userName === '' &&
            $userId !== ''
        ) {

            try {

                $transactionUser = null;

                if (
                    preg_match(
                        '/^[a-f0-9]{24}$/i',
                        $userId
                    )
                ) {

                    $transactionUser =
                        $users->findOne([
                            '_id' =>
                                new MongoDB\BSON\ObjectId(
                                    $userId
                                )
                        ]);
                }

                if (!$transactionUser) {

                    $transactionUser =
                        $users->findOne([
                            'id' =>
                                $userId
                        ]);
                }

                if ($transactionUser) {

                    $transactionUser =
                        is_array($transactionUser)
                            ? $transactionUser
                            : (array)$transactionUser;

                    $userName =
                        trim(
                            (string)(
                                $transactionUser['full_name']
                                ??
                                $transactionUser['fullName']
                                ??
                                $transactionUser['name']
                                ??
                                ''
                            )
                        );

                    if (
                        $userName === ''
                    ) {

                        $userName =
                            trim(
                                (string)(
                                    $transactionUser['first_name']
                                    ?? ''
                                )
                                .
                                ' '
                                .
                                (string)(
                                    $transactionUser['last_name']
                                    ?? ''
                                )
                            );
                    }
                }

            } catch (Throwable $e) {}
        }

        if (
            $userName === ''
        ) {

            $userName =
                'Crown Cash User';
        }


        $created =
            crownCashDate(
                $doc['created_at']
                ?? null
            );


        $recentTransactions[] = [

            'id' => $id,

            '_id' => $id,

            'user_id' =>
                $userId,

            'user_name' =>
                $userName,

            'name' =>
                $userName,

            'amount' =>
                crownCashNumber(
                    $doc['amount']
                    ?? 0
                ),

            'type' =>
                (string)(
                    $doc['type']
                    ?? 'transaction'
                ),

            'status' =>
                (string)(
                    $doc['status']
                    ?? ''
                ),

            'created_at' =>
                $created
                    ? $created->format('c')
                    : null
        ];
    }

} catch (Throwable $e) {

    $recentTransactions = [];
}


/*
|--------------------------------------------------------------------------
| RECENT USERS
|--------------------------------------------------------------------------
*/

$recentUsers = [];


try {

    $cursor =
        $users->find(
            [],
            [
                'sort' => [
                    'created_at' => -1
                ],
                'limit' => 8
            ]
        );


    foreach ($cursor as $document) {

        $doc =
            is_array($document)
                ? $document
                : (array)$document;

        $id = '';

        if (
            isset($doc['_id'])
        ) {

            if (
                $doc['_id']
                instanceof MongoDB\BSON\ObjectId
            ) {

                $id =
                    (string)$doc['_id'];

            } else {

                $id =
                    (string)$doc['_id'];
            }
        }

        if (
            $id === ''
        ) {

            $id =
                (string)(
                    $doc['id']
                    ?? ''
                );
        }


        $first =
            trim(
                (string)(
                    $doc['first_name']
                    ?? ''
                )
            );

        $last =
            trim(
                (string)(
                    $doc['last_name']
                    ?? ''
                )
            );

        $name =
            trim(
                (string)(
                    $doc['full_name']
                    ??
                    $doc['fullName']
                    ??
                    $doc['name']
                    ??
                    ''
                )
            );

        if (
            $name === ''
        ) {

            $name =
                trim(
                    $first .
                    ' ' .
                    $last
                );
        }

        if (
            $name === ''
        ) {

            $name =
                'Crown Cash User';
        }


        $created =
            crownCashDate(
                $doc['created_at']
                ?? null
            );


        $recentUsers[] = [

            'id' =>
                $id,

            '_id' =>
                $id,

            'name' =>
                $name,

            'first_name' =>
                $first,

            'last_name' =>
                $last,

            'email' =>
                (string)(
                    $doc['email']
                    ?? ''
                ),

            'status' =>
                (string)(
                    $doc['status']
                    ?? 'active'
                ),

            'created_at' =>
                $created
                    ? $created->format('c')
                    : null
        ];
    }

} catch (Throwable $e) {

    $recentUsers = [];
}


/*
|--------------------------------------------------------------------------
| FINAL RESPONSE
|--------------------------------------------------------------------------
*/

crownCashDashboardResponse(
    true,
    'Administrator dashboard data loaded successfully.',
    [

        'authenticated' =>
            true,

        'authorized' =>
            true,


        'admin' => [

            'id' =>
                $currentUserId,

            'email' =>
                $email,

            'name' =>
                $adminName,

            'first_name' =>
                $firstName,

            'last_name' =>
                $lastName,

            'role' =>
                $role,

            'account_type' =>
                $accountType,

            'status' =>
                $status
        ],


        'stats' => [

            'total_users' =>
                $totalUsers,

            'active_users' =>
                $activeUsers,

            'new_accounts' =>
                $newAccounts,

            'total_deposits' =>
                $totalDeposits,

            'pending_deposits' =>
                $pendingDeposits,

            'approved_deposits' =>
                $totalDeposits,

            'rejected_deposits' =>
                $rejectedDeposits,

            'pending_deposit_count' =>
                $pendingDepositCount,

            'total_withdrawals' =>
                $totalWithdrawals,

            'pending_withdrawals' =>
                $pendingWithdrawals,

            'pending_withdrawal_count' =>
                $pendingWithdrawalCount,

            'total_investments' =>
                $totalInvestments,

            'active_investments' =>
                $activeInvestmentCount,

            'pending_investments' =>
                $pendingInvestments,

            'pending_investment_count' =>
                $pendingInvestmentCount,

            'total_referrals' =>
                $totalReferrals,

            'total_transactions' =>
                $totalTransactions,

            'open_tickets' =>
                $openTickets
        ],


        'summary' => [

            'users' =>
                $totalUsers,

            'active_users' =>
                $activeUsers,

            'new_accounts' =>
                $newAccounts,

            'deposits' =>
                $totalDeposits,

            'pending_deposits' =>
                $pendingDeposits,

            'withdrawals' =>
                $totalWithdrawals,

            'pending_withdrawals' =>
                $pendingWithdrawals,

            'investments' =>
                $totalInvestments,

            'active_investments' =>
                $activeInvestmentCount,

            'pending_investments' =>
                $pendingInvestments,

            'referrals' =>
                $totalReferrals,

            'transactions' =>
                $totalTransactions,

            'open_tickets' =>
                $openTickets
        ],


        'pending_activity' => [

            'deposits' =>
                $pendingDeposits,

            'deposit_count' =>
                $pendingDepositCount,

            'withdrawals' =>
                $pendingWithdrawals,

            'withdrawal_count' =>
                $pendingWithdrawalCount,

            'investments' =>
                $pendingInvestments,

            'investment_count' =>
                $pendingInvestmentCount,

            'new_accounts' =>
                $newAccounts
        ],


        'recent_transactions' =>
            $recentTransactions,

        'recent_users' =>
            $recentUsers,


        'generated_at' =>
            (new DateTimeImmutable(
                'now',
                new DateTimeZone('UTC')
            ))->format('c')
    ]
);

?>