<?php
declare(strict_types=1);

/*
|--------------------------------------------------------------------------
| Crown Cash - User Dashboard
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

try {

    if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
        jsonResponse([
            'success' => false,
            'message' => 'Only GET requests are allowed.'
        ], 405);
    }

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

    if (isValidObjectId($userId)) {
        $user = $users->findOne([
            '_id' => objectIdOrNull($userId)
        ]);
    }

    if (!$user) {
        $user = $users->findOne([
            'id' => (string)$userId
        ]);
    }

    if (!$user) {
        jsonResponse([
            'success' => false,
            'message' => 'User account not found.'
        ], 404);
    }

    $resolvedUserId = isset($user->_id)
        ? (string)$user->_id
        : (string)($user->id ?? $userId);

    /*
    |--------------------------------------------------------------------------
    | Wallet
    |--------------------------------------------------------------------------
    */

    $walletBalance = moneyInt(
        $user->balance
        ?? $user->wallet_balance
        ?? $user->walletBalance
        ?? 0
    );

    /*
    |--------------------------------------------------------------------------
    | Deposits
    |--------------------------------------------------------------------------
    */

    $approvedDepositStatuses = [
        'approved',
        'verified',
        'completed',
        'success',
        'successful'
    ];

    $totalDeposited = 0;

    $depositCursor = $deposits->find([
        'user_id' => $resolvedUserId,
        'status' => [
            '$in' => $approvedDepositStatuses
        ]
    ]);

    foreach ($depositCursor as $deposit) {

        $totalDeposited += moneyInt(
            $deposit->amount
            ?? $deposit->deposit_amount
            ?? 0
        );
    }

    /*
    |--------------------------------------------------------------------------
    | Investments
    |--------------------------------------------------------------------------
    */

    $investmentStatuses = [
        'active',
        'approved',
        'running',
        'completed'
    ];

    $totalInvested = 0;
    $activeInvestmentCount = 0;
    $completedInvestmentCount = 0;

    $investmentCursor = $investments->find([
        'user_id' => $resolvedUserId,
        'status' => [
            '$in' => $investmentStatuses
        ]
    ]);

    foreach ($investmentCursor as $investment) {

        $amount = moneyInt(
            $investment->principal
            ?? $investment->amount
            ?? 0
        );

        $totalInvested += $amount;

        $status = strtolower(
            trim((string)($investment->status ?? ''))
        );

        if (
            in_array(
                $status,
                ['active', 'approved', 'running'],
                true
            )
        ) {
            $activeInvestmentCount++;
        }

        if ($status === 'completed') {
            $completedInvestmentCount++;
        }
    }

    /*
    |--------------------------------------------------------------------------
    | Investment earnings
    |--------------------------------------------------------------------------
    |
    | Only daily_earning records are counted here.
    | Principal returns are NOT earnings.
    |--------------------------------------------------------------------------
    */

    $investmentEarnings = 0;

    $earningCursor = $earnings->find([
        'user_id' => $resolvedUserId,
        'type' => 'daily_earning'
    ]);

    foreach ($earningCursor as $earning) {

        $investmentEarnings += moneyInt(
            $earning->amount ?? 0
        );
    }

    /*
    |--------------------------------------------------------------------------
    | Referral earnings
    |--------------------------------------------------------------------------
    |
    | Different referral implementations sometimes use:
    | amount, commission, bonus, reward, referral_earning.
    |
    | We support those common fields while preventing the same document
    | from being counted more than once.
    |--------------------------------------------------------------------------
    */

    $referralEarnings = 0;
    $referralTeam = 0;

    /*
    | Count direct referrals.
    */

    $referralTeam = $referrals->countDocuments([
        'referrer_id' => $resolvedUserId
    ]);

    /*
    | If your referral documents use user_id/referrer instead,
    | include those records too without double-counting where possible.
    */

    if ($referralTeam === 0) {

        $referralTeam = $referrals->countDocuments([
            'referrer' => $resolvedUserId
        ]);
    }

    /*
    | Referral earnings.
    */

    $referralCursor = $referrals->find([
        '$or' => [
            ['referrer_id' => $resolvedUserId],
            ['referrer' => $resolvedUserId],
            ['sponsor_id' => $resolvedUserId]
        ]
    ]);

    $processedReferralIds = [];

    foreach ($referralCursor as $referral) {

        $referralId = isset($referral->_id)
            ? (string)$referral->_id
            : '';

        if (
            $referralId !== '' &&
            isset($processedReferralIds[$referralId])
        ) {
            continue;
        }

        if ($referralId !== '') {
            $processedReferralIds[$referralId] = true;
        }

        $amount = 0;

        foreach (
            [
                'commission',
                'referral_earning',
                'referral_commission',
                'bonus',
                'reward',
                'amount'
            ] as $field
        ) {

            if (
                isset($referral->{$field}) &&
                is_numeric((string)$referral->{$field})
            ) {
                $amount = moneyInt(
                    $referral->{$field}
                );

                break;
            }
        }

        /*
        | Only count positive referral rewards.
        */

        if ($amount > 0) {
            $referralEarnings += $amount;
        }
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

    $transactionCount = $transactions->countDocuments([
        'user_id' => $resolvedUserId
    ]);

    /*
    |--------------------------------------------------------------------------
    | Pending investment count
    |--------------------------------------------------------------------------
    */

    $pendingInvestmentCount = $investments->countDocuments([
        'user_id' => $resolvedUserId,
        'status' => 'pending'
    ]);

    /*
    |--------------------------------------------------------------------------
    | Pending withdrawal
    |--------------------------------------------------------------------------
    */

    $pendingWithdrawalCount = $withdrawals->countDocuments([
        'user_id' => $resolvedUserId,
        'status' => 'pending'
    ]);

    /*
    |--------------------------------------------------------------------------
    | User information
    |--------------------------------------------------------------------------
    */

    $firstName = (string)(
        $user->first_name
        ?? $user->firstname
        ?? ''
    );

    $lastName = (string)(
        $user->last_name
        ?? $user->lastname
        ?? ''
    );

    $fullName = trim(
        (string)(
            $user->name
            ?? $user->full_name
            ?? trim($firstName . ' ' . $lastName)
        )
    );

    if ($fullName === '') {
        $fullName = 'Crown Cash User';
    }

    $email = (string)(
        $user->email ?? ''
    );

    $role = (string)(
        $user->role
        ?? $user->account_type
        ?? 'user'
    );

    /*
    |--------------------------------------------------------------------------
    | Response
    |--------------------------------------------------------------------------
    */

    jsonResponse([
        'success' => true,

        'message' => 'Dashboard loaded successfully.',

        'user' => [
            'id' => $resolvedUserId,
            'name' => $fullName,
            'first_name' => $firstName,
            'last_name' => $lastName,
            'email' => $email,
            'role' => $role,
            'account_type' => (string)(
                $user->account_type ?? 'user'
            ),
            'status' => (string)(
                $user->status ?? 'active'
            )
        ],

        'stats' => [

            /*
            | Wallet
            */

            'available_balance' => $walletBalance,

            'wallet_balance' => $walletBalance,

            /*
            | Investments
            */

            'total_invested' => $totalInvested,

            'active_investments' => $activeInvestmentCount,

            'completed_investments' =>
                $completedInvestmentCount,

            'pending_investments' =>
                $pendingInvestmentCount,

            /*
            | Earnings
            */

            'investment_earnings' =>
                $investmentEarnings,

            'referral_earnings' =>
                $referralEarnings,

            'total_earnings' =>
                $totalEarnings,

            /*
            | Referrals
            */

            'referral_team' =>
                $referralTeam,

            /*
            | Activity
            */

            'transaction_count' =>
                $transactionCount,

            'pending_withdrawals' =>
                $pendingWithdrawalCount,

            /*
            | Deposits
            */

            'total_deposited' =>
                $totalDeposited
        ],

        'earnings' => [

            'investment' =>
                $investmentEarnings,

            'referral' =>
                $referralEarnings,

            'total' =>
                $totalEarnings
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

        'referrals' => [

            'team' =>
                $referralTeam,

            'earnings' =>
                $referralEarnings
        ],

        'daily_rate' => 0.10,

        'currency' => 'UGX'
    ]);

} catch (Throwable $e) {

    error_log(
        'Crown Cash dashboard.php error: ' .
        $e->getMessage()
    );

    jsonResponse([
        'success' => false,
        'message' => 'Unable to load dashboard data.'
    ], 500);
}