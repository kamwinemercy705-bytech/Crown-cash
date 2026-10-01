<?php
declare(strict_types=1);

/*
|--------------------------------------------------------------------------
| Crown Cash - User Dashboard API
|--------------------------------------------------------------------------
*/

require_once __DIR__ . '/config.php';

header('Content-Type: application/json; charset=utf-8');

$origin = $_SERVER['HTTP_ORIGIN'] ?? '';

if ($origin === 'https://crown-cash.vercel.app') {
    header('Access-Control-Allow-Origin: https://crown-cash.vercel.app');
    header('Access-Control-Allow-Credentials: true');
}

header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Access-Control-Allow-Methods: GET, OPTIONS');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

startSecureSession();

/*
|--------------------------------------------------------------------------
| Small helpers
|--------------------------------------------------------------------------
*/

function dashboardValue(object $document, array $fields, mixed $default = null): mixed
{
    foreach ($fields as $field) {
        try {
            if (isset($document->{$field})) {
                return $document->{$field};
            }
        } catch (Throwable $e) {
            // Continue checking other fields.
        }
    }

    return $default;
}

function dashboardMoney(object $document, array $fields): int
{
    foreach ($fields as $field) {
        try {
            if (isset($document->{$field})) {
                return moneyInt($document->{$field});
            }
        } catch (Throwable $e) {
            // Continue checking.
        }
    }

    return 0;
}

/*
|--------------------------------------------------------------------------
| Main
|--------------------------------------------------------------------------
*/

try {

    if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
        jsonResponse([
            'success' => false,
            'message' => 'Only GET requests are allowed.'
        ], 405);
    }

    /*
    |--------------------------------------------------------------------------
    | Authentication
    |--------------------------------------------------------------------------
    */

    $userId = currentUserId();

    if (!$userId) {
        jsonResponse([
            'success' => false,
            'message' => 'Please log in.'
        ], 401);
    }

    /*
    |--------------------------------------------------------------------------
    | Find user
    |--------------------------------------------------------------------------
    */

    $user = null;

    /*
    | First: Mongo ObjectId
    */

    if (isValidObjectId((string)$userId)) {

        $objectId = objectIdOrNull((string)$userId);

        if ($objectId !== null) {
            $user = $users->findOne([
                '_id' => $objectId
            ]);
        }
    }

    /*
    | Second: string id
    */

    if (!$user) {
        $user = $users->findOne([
            'id' => (string)$userId
        ]);
    }

    /*
    | Third: email from session, if available.
    */

    if (!$user) {

        $sessionEmail =
            $_SESSION['email']
            ?? $_SESSION['user_email']
            ?? null;

        if ($sessionEmail) {

            $user = $users->findOne([
                'email' => (string)$sessionEmail
            ]);
        }
    }

    if (!$user) {

        jsonResponse([
            'success' => false,
            'message' => 'User account not found.'
        ], 404);
    }

    /*
    |--------------------------------------------------------------------------
    | Resolved user ID
    |--------------------------------------------------------------------------
    */

    $resolvedUserId = '';

    if (isset($user->_id)) {
        $resolvedUserId = (string)$user->_id;
    } elseif (isset($user->id)) {
        $resolvedUserId = (string)$user->id;
    } else {
        $resolvedUserId = (string)$userId;
    }

    /*
    |--------------------------------------------------------------------------
    | User information
    |--------------------------------------------------------------------------
    */

    $firstName = (string)(
        dashboardValue(
            $user,
            ['first_name', 'firstname', 'firstName'],
            ''
        )
    );

    $lastName = (string)(
        dashboardValue(
            $user,
            ['last_name', 'lastname', 'lastName'],
            ''
        )
    );

    $nameFromDatabase = dashboardValue(
        $user,
        ['name', 'full_name', 'fullName', 'username'],
        ''
    );

    $fullName = trim((string)$nameFromDatabase);

    if ($fullName === '') {
        $fullName = trim(
            $firstName . ' ' . $lastName
        );
    }

    if ($fullName === '') {
        $fullName = 'Crown Cash User';
    }

    $email = (string)(
        dashboardValue(
            $user,
            ['email', 'user_email'],
            ''
        )
    );

    $role = strtolower(
        trim(
            (string)(
                dashboardValue(
                    $user,
                    ['role'],
                    ''
                )
            )
        )
    );

    $accountType = strtolower(
        trim(
            (string)(
                dashboardValue(
                    $user,
                    ['account_type', 'accountType'],
                    ''
                )
            )
        )
    );

    /*
    |--------------------------------------------------------------------------
    | Admin detection
    |--------------------------------------------------------------------------
    |
    | We check BOTH the database role and the admin configuration.
    | This fixes the situation where admin-auth.php recognizes an admin
    | through ADMIN_EMAIL or ADMIN_USER_ID but the user document still
    | contains account_type=user.
    |--------------------------------------------------------------------------
    */

    $isAdmin = (
        $role === 'admin' ||
        $role === 'administrator' ||
        $accountType === 'admin' ||
        $accountType === 'administrator'
    );

    $configuredAdminEmail = trim(
        (string)(getenv('ADMIN_EMAIL') ?: '')
    );

    $configuredAdminUserId = trim(
        (string)(getenv('ADMIN_USER_ID') ?: '')
    );

    if (
        $configuredAdminEmail !== '' &&
        $email !== '' &&
        strcasecmp(
            $configuredAdminEmail,
            $email
        ) === 0
    ) {
        $isAdmin = true;
    }

    if (
        $configuredAdminUserId !== '' &&
        $resolvedUserId !== '' &&
        $configuredAdminUserId === $resolvedUserId
    ) {
        $isAdmin = true;
    }

    /*
    |--------------------------------------------------------------------------
    | Wallet balance
    |--------------------------------------------------------------------------
    |
    | Support all wallet field names currently used by Crown Cash.
    |--------------------------------------------------------------------------
    */

    $walletBalance = 0;

    foreach (
        [
            'balance',
            'wallet_balance',
            'walletBalance',
            'available_balance',
            'availableBalance'
        ] as $walletField
    ) {

        try {

            if (isset($user->{$walletField})) {

                $walletBalance =
                    moneyInt($user->{$walletField});

                break;
            }

        } catch (Throwable $e) {
            // Continue checking.
        }
    }

    /*
    | Some installations may store:
    |
    | wallet: {
    |     balance: 55000
    | }
    |
    */

    if (
        $walletBalance === 0 &&
        isset($user->wallet)
    ) {

        try {

            $wallet = $user->wallet;

            if (
                is_object($wallet) &&
                isset($wallet->balance)
            ) {
                $walletBalance =
                    moneyInt($wallet->balance);
            }

        } catch (Throwable $e) {
            // Keep zero if unavailable.
        }
    }

    /*
    |--------------------------------------------------------------------------
    | Deposits
    |--------------------------------------------------------------------------
    */

    $totalDeposited = 0;

    try {

        $approvedDepositStatuses = [
            'approved',
            'verified',
            'completed',
            'success',
            'successful'
        ];

        $depositCursor = $deposits->find([
            '$or' => [
                ['user_id' => $resolvedUserId],
                ['userId' => $resolvedUserId]
            ],
            'status' => [
                '$in' => $approvedDepositStatuses
            ]
        ]);

        foreach ($depositCursor as $deposit) {

            $totalDeposited += dashboardMoney(
                $deposit,
                [
                    'amount',
                    'deposit_amount',
                    'depositAmount'
                ]
            );
        }

    } catch (Throwable $e) {

        error_log(
            'Dashboard deposit query: ' .
            $e->getMessage()
        );
    }

    /*
    |--------------------------------------------------------------------------
    | Investments
    |--------------------------------------------------------------------------
    */

    $totalInvested = 0;
    $activeInvestmentCount = 0;
    $completedInvestmentCount = 0;
    $pendingInvestmentCount = 0;

    try {

        $investmentCursor = $investments->find([
            '$or' => [
                ['user_id' => $resolvedUserId],
                ['userId' => $resolvedUserId]
            ]
        ]);

        foreach ($investmentCursor as $investment) {

            $status = strtolower(
                trim(
                    (string)(
                        dashboardValue(
                            $investment,
                            ['status'],
                            ''
                        )
                    )
                )
            );

            $amount = dashboardMoney(
                $investment,
                [
                    'principal',
                    'amount',
                    'investment_amount',
                    'investmentAmount'
                ]
            );

            /*
            | Approved/active investments are included in total invested.
            */

            if (
                in_array(
                    $status,
                    [
                        'active',
                        'approved',
                        'running',
                        'completed'
                    ],
                    true
                )
            ) {
                $totalInvested += $amount;
            }

            if (
                in_array(
                    $status,
                    [
                        'active',
                        'approved',
                        'running'
                    ],
                    true
                )
            ) {
                $activeInvestmentCount++;
            }

            if ($status === 'completed') {
                $completedInvestmentCount++;
            }

            if ($status === 'pending') {
                $pendingInvestmentCount++;
            }
        }

    } catch (Throwable $e) {

        error_log(
            'Dashboard investment query: ' .
            $e->getMessage()
        );
    }

    /*
    |--------------------------------------------------------------------------
    | Investment earnings
    |--------------------------------------------------------------------------
    */

    $investmentEarnings = 0;

    try {

        $earningCursor = $earnings->find([
            '$or' => [
                ['user_id' => $resolvedUserId],
                ['userId' => $resolvedUserId]
            ],
            'type' => [
                '$in' => [
                    'daily_earning',
                    'investment_earning',
                    'investment_daily_earning'
                ]
            ]
        ]);

        foreach ($earningCursor as $earning) {

            $investmentEarnings += dashboardMoney(
                $earning,
                ['amount', 'earning', 'value']
            );
        }

    } catch (Throwable $e) {

        error_log(
            'Dashboard earnings query: ' .
            $e->getMessage()
        );
    }

    /*
    |--------------------------------------------------------------------------
    | Referral team and earnings
    |--------------------------------------------------------------------------
    */

    $referralTeam = 0;
    $referralEarnings = 0;

    try {

        /*
        | Count direct referrals using the possible field names.
        */

        $referralIds = [];

        $referralQueries = [
            ['referrer_id' => $resolvedUserId],
            ['referrer' => $resolvedUserId],
            ['sponsor_id' => $resolvedUserId],
            ['sponsor' => $resolvedUserId]
        ];

        foreach ($referralQueries as $query) {

            try {

                $cursor = $referrals->find($query);

                foreach ($cursor as $referral) {

                    if (isset($referral->_id)) {
                        $referralIds[
                            (string)$referral->_id
                        ] = true;
                    } else {
                        $referralIds[
                            md5(serialize($referral))
                        ] = true;
                    }
                }

            } catch (Throwable $e) {
                // Try next referral structure.
            }
        }

        $referralTeam = count($referralIds);

        /*
        | Calculate referral earnings.
        */

        $processedReferralIds = [];

        foreach ($referralQueries as $query) {

            try {

                $cursor = $referrals->find($query);

                foreach ($cursor as $referral) {

                    $referralId = isset($referral->_id)
                        ? (string)$referral->_id
                        : md5(serialize($referral));

                    if (
                        isset(
                            $processedReferralIds[$referralId]
                        )
                    ) {
                        continue;
                    }

                    $processedReferralIds[
                        $referralId
                    ] = true;

                    /*
                    | We only count explicit reward/commission fields.
                    |
                    | "amount" is deliberately NOT used here because
                    | some referral records use amount for the deposit
                    | made by the referred user.
                    */

                    foreach (
                        [
                            'commission',
                            'referral_earning',
                            'referral_commission',
                            'referral_bonus',
                            'bonus',
                            'reward',
                            'commission_amount'
                        ] as $field
                    ) {

                        try {

                            if (
                                isset($referral->{$field}) &&
                                is_numeric(
                                    (string)$referral->{$field}
                                )
                            ) {

                                $amount = moneyInt(
                                    $referral->{$field}
                                );

                                if ($amount > 0) {
                                    $referralEarnings += $amount;
                                }

                                break;
                            }

                        } catch (Throwable $e) {
                            continue;
                        }
                    }
                }

            } catch (Throwable $e) {
                // Continue.
            }
        }

    } catch (Throwable $e) {

        error_log(
            'Dashboard referral query: ' .
            $e->getMessage()
        );
    }

    /*
    |--------------------------------------------------------------------------
    | Total earnings
    |--------------------------------------------------------------------------
    */

    $totalEarnings =
        $investmentEarnings +
        $referralEarnings;

    /*
    |--------------------------------------------------------------------------
    | Transactions
    |--------------------------------------------------------------------------
    */

    $transactionCount = 0;

    try {

        $transactionCount =
            $transactions->countDocuments([
                '$or' => [
                    ['user_id' => $resolvedUserId],
                    ['userId' => $resolvedUserId]
                ]
            ]);

    } catch (Throwable $e) {

        error_log(
            'Dashboard transaction query: ' .
            $e->getMessage()
        );
    }

    /*
    |--------------------------------------------------------------------------
    | Pending withdrawals
    |--------------------------------------------------------------------------
    */

    $pendingWithdrawalCount = 0;

    try {

        $pendingWithdrawalCount =
            $withdrawals->countDocuments([
                '$or' => [
                    ['user_id' => $resolvedUserId],
                    ['userId' => $resolvedUserId]
                ],
                'status' => 'pending'
            ]);

    } catch (Throwable $e) {

        error_log(
            'Dashboard withdrawal query: ' .
            $e->getMessage()
        );
    }

    /*
    |--------------------------------------------------------------------------
    | Final response
    |--------------------------------------------------------------------------
    */

    jsonResponse([

        'success' => true,

        'message' =>
            'Dashboard loaded successfully.',

        'user' => [

            'id' =>
                $resolvedUserId,

            'name' =>
                $fullName,

            'first_name' =>
                $firstName,

            'last_name' =>
                $lastName,

            'email' =>
                $email,

            'role' =>
                $role,

            'account_type' =>
                $accountType !== ''
                    ? $accountType
                    : 'user',

            'is_admin' =>
                $isAdmin,

            'status' =>
                (string)(
                    dashboardValue(
                        $user,
                        ['status'],
                        'active'
                    )
                )
        ],

        'stats' => [

            'available_balance' =>
                $walletBalance,

            'wallet_balance' =>
                $walletBalance,

            'total_deposited' =>
                $totalDeposited,

            'total_invested' =>
                $totalInvested,

            'active_investments' =>
                $activeInvestmentCount,

            'completed_investments' =>
                $completedInvestmentCount,

            'pending_investments' =>
                $pendingInvestmentCount,

            'investment_earnings' =>
                $investmentEarnings,

            'referral_earnings' =>
                $referralEarnings,

            'total_earnings' =>
                $totalEarnings,

            'referral_team' =>
                $referralTeam,

            'transaction_count' =>
                $transactionCount,

            'pending_withdrawals' =>
                $pendingWithdrawalCount
        ],

        'earnings' => [

            'investment' =>
                $investmentEarnings,

            'referral' =>
                $referralEarnings,

            'total' =>
                $totalEarnings
        ],

        'referrals' => [

            'team' =>
                $referralTeam,

            'earnings' =>
                $referralEarnings
        ],

        'investment' => [

            'total_invested' =>
                $totalInvested,

            'active' =>
                $activeInvestmentCount,

            'completed' =>
                $completedInvestmentCount,

            'pending' =>
                $pendingInvestmentCount
        ],

        'admin' => [

            'is_admin' =>
                $isAdmin
        ],

        'daily_rate' => 0.10,

        'currency' => 'UGX'

    ]);

} catch (Throwable $e) {

    error_log(
        'Crown Cash dashboard.php fatal error: ' .
        $e->getMessage()
    );

    jsonResponse([

        'success' => false,

        'message' =>
            'Unable to load dashboard data.',

        /*
        | This makes debugging easier from the browser console
        | without exposing the actual PHP error to users.
        */

        'error_code' =>
            'DASHBOARD_SERVER_ERROR'

    ], 500);
}