<?php
declare(strict_types=1);

/*
=========================================================
CROWN CASH - DASHBOARD API
=========================================================
Endpoint:
https://crown-cash1.onrender.com/dashboard.php

Purpose:
- Authenticate logged-in user
- Load user profile
- Load wallet balance
- Load investment statistics
- Load earnings
- Load referral team count
- Load transaction count
- Detect administrator
=========================================================
*/

require_once __DIR__ . '/config.php';

use MongoDB\BSON\ObjectId;


/* ======================================================
   RESPONSE / CACHE HEADERS
   CORS IS HANDLED BY config.php
====================================================== */

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Pragma: no-cache');


/* ======================================================
   BASIC HELPERS
====================================================== */

function dashboardResponse(array $data, int $status = 200): void
{
    http_response_code($status);

    echo json_encode(
        $data,
        JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE
    );

    exit;
}


function dashboardString(mixed $value): string
{
    if ($value instanceof ObjectId) {
        return (string)$value;
    }

    if (is_string($value)) {
        return trim($value);
    }

    if (is_numeric($value)) {
        return (string)$value;
    }

    return '';
}


function dashboardMoney(mixed $value): float
{
    if (is_numeric($value)) {
        return (float)$value;
    }

    if (is_string($value)) {
        $value = str_replace(
            [',', 'UGX', 'ugx', ' '],
            '',
            trim($value)
        );

        if (is_numeric($value)) {
            return (float)$value;
        }
    }

    return 0.0;
}


function dashboardObjectId(mixed $value): ?ObjectId
{
    if ($value instanceof ObjectId) {
        return $value;
    }

    if (
        is_string($value) &&
        preg_match('/^[a-f0-9]{24}$/i', trim($value))
    ) {
        try {
            return new ObjectId(trim($value));
        } catch (Throwable $e) {
            return null;
        }
    }

    return null;
}


function dashboardDate(mixed $value): ?DateTimeImmutable
{
    try {

        if ($value instanceof MongoDB\BSON\UTCDateTime) {

            return $value->toDateTime()->setTimezone(
                new DateTimeZone('UTC')
            );
        }

        if ($value instanceof DateTimeInterface) {

            return new DateTimeImmutable(
                $value->format('Y-m-d H:i:s'),
                new DateTimeZone('UTC')
            );
        }

        if (
            is_string($value) &&
            trim($value) !== ''
        ) {

            return new DateTimeImmutable(
                trim($value),
                new DateTimeZone('UTC')
            );
        }

    } catch (Throwable $e) {
        return null;
    }

    return null;
}


/* ======================================================
   HANDLE CORS PREFLIGHT
   config.php provides the CORS headers.
====================================================== */

if (
    isset($_SERVER['REQUEST_METHOD']) &&
    $_SERVER['REQUEST_METHOD'] === 'OPTIONS'
) {
    http_response_code(204);
    exit;
}


/* ======================================================
   START SESSION
====================================================== */

try {

    startSecureSession();

} catch (Throwable $e) {

    /*
     * Do not blindly call session_start() if a session
     * has already been started.
     */
    if (session_status() !== PHP_SESSION_ACTIVE) {
        session_start();
    }
}


/* ======================================================
   REQUIRE LOGIN
====================================================== */

try {

    requireLogin();

} catch (Throwable $e) {

    dashboardResponse([
        'success' => false,
        'authenticated' => false,
        'authorized' => false,
        'message' => 'Authentication required.'
    ], 401);
}


/* ======================================================
   CURRENT USER ID
====================================================== */

try {

    $sessionUserId = currentUserId();

} catch (Throwable $e) {

    $sessionUserId = null;
}


if (
    $sessionUserId === null ||
    $sessionUserId === ''
) {

    dashboardResponse([
        'success' => false,
        'authenticated' => false,
        'authorized' => false,
        'message' => 'User session not found.'
    ], 401);
}


/* ======================================================
   DATABASE COLLECTIONS
====================================================== */

try {

    /*
     * config.php normally provides these collections.
     * If one is missing, create the reference here.
     */

    if (!isset($users)) {
        $users = $db->selectCollection('users');
    }

    if (!isset($investments)) {
        $investments = $db->selectCollection('investments');
    }

    if (!isset($transactions)) {
        $transactions = $db->selectCollection('transactions');
    }

    if (!isset($earnings)) {
        $earnings = $db->selectCollection('earnings');
    }

    if (!isset($referrals)) {
        $referrals = $db->selectCollection('referrals');
    }

    if (!isset($withdrawals)) {
        $withdrawals = $db->selectCollection('withdrawals');
    }

} catch (Throwable $e) {

    dashboardResponse([
        'success' => false,
        'message' => 'Database configuration error.'
    ], 500);
}


/* ======================================================
   FIND CURRENT USER
====================================================== */

$user = null;

try {

    $userIdString = dashboardString($sessionUserId);

    $userObjectId = dashboardObjectId(
        $sessionUserId
    );

    $queries = [];


    /*
     * MongoDB ObjectId lookup.
     */

    if ($userObjectId !== null) {

        $queries[] = [
            '_id' => $userObjectId
        ];
    }


    /*
     * String ID lookups.
     */

    if ($userIdString !== '') {

        $queries[] = [
            'user_id' => $userIdString
        ];

        $queries[] = [
            'id' => $userIdString
        ];

        $queries[] = [
            'userId' => $userIdString
        ];
    }


    /*
     * Some sessions store the user's email instead
     * of the MongoDB ID.
     */

    $sessionEmail = '';

    if (isset($_SESSION['email'])) {

        $sessionEmail = trim(
            (string)$_SESSION['email']
        );
    }


    if ($sessionEmail !== '') {

        $queries[] = [
            'email' => $sessionEmail
        ];

        $queries[] = [
            'email_address' => $sessionEmail
        ];
    }


    /*
     * Search through all possible user identifiers.
     */

    foreach ($queries as $query) {

        try {

            $found = $users->findOne($query);

            if ($found !== null) {

                $user = $found;

                break;
            }

        } catch (Throwable $e) {

            continue;
        }
    }


    /*
     * Last fallback:
     * if session stores an email directly as the user ID.
     */

    if (
        $user === null &&
        filter_var(
            $userIdString,
            FILTER_VALIDATE_EMAIL
        )
    ) {

        try {

            $user = $users->findOne([
                'email' => $userIdString
            ]);

        } catch (Throwable $e) {

            $user = null;
        }
    }

} catch (Throwable $e) {

    dashboardResponse([
        'success' => false,
        'message' => 'Unable to resolve user account.'
    ], 500);
}


if ($user === null) {

    dashboardResponse([
        'success' => false,
        'authenticated' => true,
        'authorized' => false,
        'message' => 'User account was not found.'
    ], 404);
}


/* ======================================================
   USER ID
====================================================== */

$dbUserId = '';

if (isset($user['_id'])) {

    $dbUserId = dashboardString(
        $user['_id']
    );
}


if ($dbUserId === '') {

    $dbUserId = dashboardString(
        $sessionUserId
    );
}


$userObjectId = dashboardObjectId(
    $user['_id'] ?? null
);


/* ======================================================
   USER NAME
====================================================== */

$firstName = trim(
    (string)(
        $user['first_name'] ??
        $user['firstName'] ??
        ''
    )
);


$lastName = trim(
    (string)(
        $user['last_name'] ??
        $user['lastName'] ??
        ''
    )
);


$fullName = trim(
    (string)(
        $user['name'] ??
        $user['full_name'] ??
        $user['fullName'] ??
        $user['username'] ??
        ''
    )
);


if ($fullName === '') {

    $fullName = trim(
        $firstName . ' ' . $lastName
    );
}


if ($fullName === '') {

    $fullName =
        (string)(
            $user['email'] ??
            $user['phone'] ??
            'Member'
        );
}


/* ======================================================
   ACCOUNT TYPE / ROLE
====================================================== */

$role = strtolower(
    trim(
        (string)(
            $user['role'] ??
            $user['account_type'] ??
            $user['accountType'] ??
            $user['user_role'] ??
            ''
        )
    )
);


$email = strtolower(
    trim(
        (string)(
            $user['email'] ?? ''
        )
    )
);


$isAdmin = false;


/*
 * Explicit admin flags.
 */

$adminFlags = [

    $user['is_admin'] ??
    false,

    $user['isAdmin'] ??
    false,

    $user['admin'] ??
    false,

    $user['administrator'] ??
    false

];


foreach ($adminFlags as $flag) {

    if (
        $flag === true ||
        $flag === 1 ||
        $flag === '1' ||
        strtolower((string)$flag) === 'true'
    ) {

        $isAdmin = true;

        break;
    }
}


/*
 * Role-based admin.
 */

if (
    in_array(
        $role,
        [
            'admin',
            'administrator',
            'superadmin',
            'super_admin',
            'super-admin'
        ],
        true
    )
) {

    $isAdmin = true;
}


/*
 * Environment-configured admin.
 */

$adminEmail = strtolower(
    trim(
        (string)(
            getenv('ADMIN_EMAIL') ?: ''
        )
    )
);


$adminUserId = trim(
    (string)(
        getenv('ADMIN_USER_ID') ?: ''
    )
);


if (
    $adminEmail !== '' &&
    $email !== '' &&
    $email === $adminEmail
) {

    $isAdmin = true;
}


if (
    $adminUserId !== '' &&
    $dbUserId !== '' &&
    $dbUserId === $adminUserId
) {

    $isAdmin = true;
}


/* ======================================================
   WALLET BALANCE
====================================================== */

$balance = 0.0;


/*
 * Direct wallet fields.
 */

$walletFields = [

    'balance',

    'wallet_balance',

    'walletBalance',

    'available_balance',

    'availableBalance'

];


foreach ($walletFields as $field) {

    if (
        isset($user[$field]) &&
        is_numeric($user[$field])
    ) {

        $balance = dashboardMoney(
            $user[$field]
        );

        break;
    }
}


/*
 * Nested wallet object.
 */

if (
    $balance == 0.0 &&
    isset($user['wallet']) &&
    is_array($user['wallet'])
) {

    foreach (
        [
            'balance',
            'available_balance',
            'availableBalance',
            'wallet_balance'
        ] as $field
    ) {

        if (
            isset($user['wallet'][$field]) &&
            is_numeric(
                $user['wallet'][$field]
            )
        ) {

            $balance = dashboardMoney(
                $user['wallet'][$field]
            );

            break;
        }
    }
}


/* ======================================================
   INVESTMENT STATISTICS
====================================================== */

$totalInvested = 0.0;

$totalEarnings = 0.0;

$investmentCount = 0;


/*
 * Investment statuses that represent actual investments.
 */

$validInvestmentStatuses = [

    'pending',

    'approved',

    'active',

    'running',

    'completed'

];


try {

    $investmentQuery = [];


    if ($userObjectId !== null) {

        $investmentQuery = [

            '$or' => [

                [
                    'user_id' =>
                    $userObjectId
                ],

                [
                    'userId' =>
                    $userObjectId
                ],

                [
                    'user' =>
                    $userObjectId
                ]

            ]

        ];

    } else {

        $investmentQuery = [

            '$or' => [

                [
                    'user_id' =>
                    $dbUserId
                ],

                [
                    'userId' =>
                    $dbUserId
                ],

                [
                    'user' =>
                    $dbUserId
                ]

            ]

        ];
    }


    $cursor = $investments->find(
        $investmentQuery,
        [
            'sort' => [
                'created_at' => -1,
                '_id' => -1
            ]
        ]
    );


    foreach ($cursor as $investment) {

        $status = strtolower(
            trim(
                (string)(
                    $investment['status'] ?? ''
                )
            )
        );


        if (
            $status !== '' &&
            !in_array(
                $status,
                $validInvestmentStatuses,
                true
            )
        ) {

            continue;
        }


        $principal = dashboardMoney(

            $investment['amount'] ??

            $investment['principal'] ??

            $investment['investment_amount'] ??

            $investment['investmentAmount'] ??

            0

        );


        if ($principal > 0) {

            /*
             * Total invested represents the principal
             * put into investments.
             */

            $totalInvested += $principal;

            $investmentCount++;
        }
    }

} catch (Throwable $e) {

    /*
     * Do not break the entire dashboard if investment
     * statistics fail.
     */
}


/* ======================================================
   EARNINGS
====================================================== */

try {

    $earningQuery = [];


    if ($userObjectId !== null) {

        $earningQuery = [

            '$or' => [

                [
                    'user_id' =>
                    $userObjectId
                ],

                [
                    'userId' =>
                    $userObjectId
                ],

                [
                    'user' =>
                    $userObjectId
                ]

            ]

        ];

    } else {

        $earningQuery = [

            '$or' => [

                [
                    'user_id' =>
                    $dbUserId
                ],

                [
                    'userId' =>
                    $dbUserId
                ],

                [
                    'user' =>
                    $dbUserId
                ]

            ]

        ];
    }


    $earningCursor = $earnings->find(
        $earningQuery
    );


    foreach ($earningCursor as $earning) {

        $category = strtolower(
            trim(
                (string)(
                    $earning['category'] ??
                    $earning['type'] ??
                    $earning['earning_type'] ??
                    ''
                )
            )
        );


        /*
         * Principal returned is NOT earnings.
         */

        if (
            $category === 'principal' ||
            $category === 'principal_return' ||
            $category === 'investment_principal'
        ) {

            continue;
        }


        $amount = dashboardMoney(

            $earning['amount'] ??

            $earning['earning'] ??

            $earning['value'] ??

            0

        );


        if ($amount <= 0) {

            continue;
        }


        /*
         * Include investment/daily earnings and
         * referral/commission earnings.
         */

        $investmentCategories = [

            'investment',

            'investment_earning',

            'daily',

            'daily_earning',

            'profit',

            'return'

        ];


        $referralCategories = [

            'referral',

            'referral_earning',

            'commission',

            'referral_commission'

        ];


        if (
            in_array(
                $category,
                $investmentCategories,
                true
            ) ||
            in_array(
                $category,
                $referralCategories,
                true
            )
        ) {

            $totalEarnings += $amount;
        }
    }


    /*
     * If the earnings ledger has no entries yet,
     * use stored user-level totals as a fallback.
     */

    if ($totalEarnings <= 0) {

        $storedInvestmentEarnings =
            dashboardMoney(
                $user['investment_earnings'] ??
                $user['investmentEarnings'] ??
                0
            );


        $storedReferralEarnings =
            dashboardMoney(
                $user['referral_earnings'] ??
                $user['referralEarnings'] ??
                0
            );


        $totalEarnings =
            $storedInvestmentEarnings +
            $storedReferralEarnings;
    }

} catch (Throwable $e) {

    $totalEarnings = dashboardMoney(

        $user['total_earnings'] ??

        $user['totalEarnings'] ??

        0

    );
}


/* ======================================================
   REFERRAL TEAM
====================================================== */

$referralTeam = 0;


/*
 * Parent/referrer fields used by different versions
 * of the Crown Cash database.
 */

$parentFields = [

    'referrer_id',

    'referrerId',

    'referrer',

    'referred_by_id',

    'referredById',

    'referred_by',

    'parent_id',

    'parentId',

    'sponsor_id',

    'sponsorId',

    'sponsor',

    'upline_id',

    'uplineId'

];


try {

    $allReferralIds = [];


    /*
     * First-level members.
     */

    foreach ($parentFields as $field) {

        if ($userObjectId !== null) {

            $query = [

                $field =>
                $userObjectId

            ];

        } else {

            $query = [

                $field =>
                $dbUserId

            ];
        }


        try {

            $cursor = $users->find(

                $query,

                [

                    'projection' => [

                        '_id' => 1

                    ]

                ]

            );


            foreach ($cursor as $member) {

                if (isset($member['_id'])) {

                    $allReferralIds[
                        dashboardString(
                            $member['_id']
                        )
                    ] = true;
                }
            }

        } catch (Throwable $e) {

            continue;
        }
    }


    /*
     * Also check the referrals collection.
     */

    try {

        $referralQuery = [];


        if ($userObjectId !== null) {

            $referralQuery = [

                '$or' => [

                    [
                        'referrer_id' =>
                        $userObjectId
                    ],

                    [
                        'referrerId' =>
                        $userObjectId
                    ],

                    [
                        'parent_id' =>
                        $userObjectId
                    ],

                    [
                        'parentId' =>
                        $userObjectId
                    ]

                ]

            ];

        } else {

            $referralQuery = [

                '$or' => [

                    [
                        'referrer_id' =>
                        $dbUserId
                    ],

                    [
                        'referrerId' =>
                        $dbUserId
                    ],

                    [
                        'parent_id' =>
                        $dbUserId
                    ],

                    [
                        'parentId' =>
                        $dbUserId
                    ]

                ]

            ];
        }


        $referralCursor =
            $referrals->find(

                $referralQuery,

                [

                    'projection' => [

                        'user_id' => 1,

                        'userId' => 1,

                        'referred_user_id' => 1,

                        'referredUserId' => 1

                    ]

                ]

            );


        foreach ($referralCursor as $ref) {

            foreach (

                [
                    'user_id',
                    'userId',
                    'referred_user_id',
                    'referredUserId'
                ]

                as $field

            ) {

                if (isset($ref[$field])) {

                    $id = dashboardString(
                        $ref[$field]
                    );

                    if ($id !== '') {

                        $allReferralIds[$id] = true;
                    }
                }
            }
        }

    } catch (Throwable $e) {

        /*
         * Ignore referral collection errors.
         */
    }


    $referralTeam =
        count($allReferralIds);


    /*
     * If user-level stored count exists and our query
     * found nothing, use it as fallback.
     */

    if ($referralTeam === 0) {

        $storedReferralTeam =
            dashboardMoney(

                $user['referral_team'] ??

                $user['referralTeam'] ??

                $user['team_count'] ??

                0

            );


        if ($storedReferralTeam > 0) {

            $referralTeam =
                (int)$storedReferralTeam;
        }
    }

} catch (Throwable $e) {

    $referralTeam =
        (int)dashboardMoney(

            $user['referral_team'] ??

            $user['referralTeam'] ??

            0

        );
}


/* ======================================================
   TRANSACTION COUNT
====================================================== */

$transactionCount = 0;


try {

    if ($userObjectId !== null) {

        $transactionQuery = [

            '$or' => [

                [
                    'user_id' =>
                    $userObjectId
                ],

                [
                    'userId' =>
                    $userObjectId
                ],

                [
                    'user' =>
                    $userObjectId
                ]

            ]

        ];

    } else {

        $transactionQuery = [

            '$or' => [

                [
                    'user_id' =>
                    $dbUserId
                ],

                [
                    'userId' =>
                    $dbUserId
                ],

                [
                    'user' =>
                    $dbUserId
                ]

            ]

        ];
    }


    $transactionCount =
        $transactions->countDocuments(
            $transactionQuery
        );

} catch (Throwable $e) {

    $transactionCount =
        (int)dashboardMoney(

            $user['transaction_count'] ??

            $user['transactionCount'] ??

            0

        );
}


/* ======================================================
   PENDING WITHDRAWALS
====================================================== */

$pendingWithdrawals = 0;


try {

    if (isset($withdrawals)) {

        if ($userObjectId !== null) {

            $withdrawalQuery = [

                '$or' => [

                    [
                        'user_id' =>
                        $userObjectId
                    ],

                    [
                        'userId' =>
                        $userObjectId
                    ]

                ],

                'status' => [

                    '$in' => [

                        'pending',

                        'processing'

                    ]

                ]

            ];

        } else {

            $withdrawalQuery = [

                '$or' => [

                    [
                        'user_id' =>
                        $dbUserId
                    ],

                    [
                        'userId' =>
                        $dbUserId
                    ]

                ],

                'status' => [

                    '$in' => [

                        'pending',

                        'processing'

                    ]

                ]

            ];
        }


        $pendingWithdrawals =
            $withdrawals->countDocuments(
                $withdrawalQuery
            );
    }

} catch (Throwable $e) {

    $pendingWithdrawals = 0;
}


/* ======================================================
   ACCOUNT TYPE
====================================================== */

$accountType =

    $isAdmin

        ? 'Administrator'

        : (

            $role !== ''

                ? ucfirst(
                    str_replace(
                        '_',
                        ' ',
                        $role
                    )
                )

                : 'Personal Account'

        );


/* ======================================================
   USER RESPONSE
====================================================== */

$userResponse = [

    'id' =>
    $dbUserId,

    '_id' =>
    $dbUserId,

    'name' =>
    $fullName,

    'full_name' =>
    $fullName,

    'fullName' =>
    $fullName,

    'first_name' =>
    $firstName,

    'firstName' =>
    $firstName,

    'last_name' =>
    $lastName,

    'lastName' =>
    $lastName,

    'email' =>
    $email,

    'role' =>
    $role,

    'account_type' =>
    $accountType,

    'accountType' =>
    $accountType,

    'is_admin' =>
    $isAdmin,

    'isAdmin' =>
    $isAdmin,

    'balance' =>
    $balance,

    'wallet_balance' =>
    $balance,

    'walletBalance' =>
    $balance,

    'available_balance' =>
    $balance,

    'availableBalance' =>
    $balance

];


/* ======================================================
   ADMIN RESPONSE
====================================================== */

$adminResponse = [

    'is_admin' =>
    $isAdmin,

    'isAdmin' =>
    $isAdmin,

    'authorized' =>
    $isAdmin,

    'role' =>
    $role,

    'account_type' =>
    $accountType

];


/* ======================================================
   FINAL RESPONSE
====================================================== */

dashboardResponse([

    'success' =>
    true,

    'authenticated' =>
    true,

    'authorized' =>
    true,

    'message' =>
    'Dashboard loaded successfully.',


    /*
     * USER
     */

    'user' =>
    $userResponse,


    /*
     * ADMIN
     */

    'admin' =>
    $adminResponse,


    /*
     * WALLET
     */

    'balance' =>
    $balance,

    'available_balance' =>
    $balance,

    'availableBalance' =>
    $balance,


    /*
     * INVESTMENTS
     */

    'total_invested' =>
    $totalInvested,

    'totalInvested' =>
    $totalInvested,

    'investment_count' =>
    $investmentCount,

    'investmentCount' =>
    $investmentCount,


    /*
     * EARNINGS
     */

    'total_earnings' =>
    $totalEarnings,

    'totalEarnings' =>
    $totalEarnings,

    'daily_earnings' =>
    dashboardMoney(

        $user['daily_earnings'] ??

        $user['dailyEarnings'] ??

        0

    ),

    'referral_earnings' =>
    dashboardMoney(

        $user['referral_earnings'] ??

        $user['referralEarnings'] ??

        0

    ),


    /*
     * REFERRALS
     */

    'referral_team' =>
    $referralTeam,

    'referralTeam' =>
    $referralTeam,


    /*
     * TRANSACTIONS
     */

    'transaction_count' =>
    $transactionCount,

    'transactionCount' =>
    $transactionCount,


    /*
     * WITHDRAWALS
     */

    'pending_withdrawals' =>
    $pendingWithdrawals,

    'pendingWithdrawals' =>
    $pendingWithdrawals,


    /*
     * EXTRA
     */

    'server_time' =>
    gmdate('c'),

    'api' =>
    'dashboard'

]);