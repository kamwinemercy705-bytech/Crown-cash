<?php
declare(strict_types=1);

require_once __DIR__ . '/config.php';

$userId = requireLogin();

try {
    /* ---------------------------------------------------------
       1. GET USER
    --------------------------------------------------------- */
    $user = $users->findOne([
        '_id' => $userId
    ]);

    if (!$user) {
        jsonResponse([
            'success' => false,
            'message' => 'User not found.'
        ], 404);
    }

    /* ---------------------------------------------------------
       2. CURRENT WALLET BALANCE
    --------------------------------------------------------- */
    $walletBalance = moneyInt(
        $user['balance']
        ?? $user['wallet_balance']
        ?? 0
    );

    /* ---------------------------------------------------------
       3. TOTAL APPROVED DEPOSITS
    --------------------------------------------------------- */
    $approvedDeposits = 0;

    try {
        $depositCursor = $deposits->find([
            '$and' => [
                [
                    '$or' => [
                        ['user_id' => $userId],
                        ['user_id' => (string)$userId],
                        ['userId' => $userId],
                        ['userId' => (string)$userId]
                    ]
                ],
                [
                    '$or' => [
                        [
                            'status' => [
                                '$in' => [
                                    'approved',
                                    'completed',
                                    'verified'
                                ]
                            ]
                        ],
                        ['approved' => true],
                        ['verified' => true]
                    ]
                ]
            ]
        ]);

        foreach ($depositCursor as $deposit) {
            $approvedDeposits += moneyInt(
                $deposit['amount'] ?? 0
            );
        }
    } catch (Throwable $e) {
        $approvedDeposits = 0;
    }

    /* ---------------------------------------------------------
       4. TOTAL INVESTMENTS
    --------------------------------------------------------- */
    $totalInvested = 0;
    $activeInvestments = 0;

    try {
        $investmentCursor = $investments->find([
            '$or' => [
                ['user_id' => $userId],
                ['user_id' => (string)$userId]
            ],
            'status' => [
                '$in' => [
                    'active',
                    'approved',
                    'running',
                    'completed'
                ]
            ]
        ]);

        foreach ($investmentCursor as $investment) {
            $amount = moneyInt(
                $investment['amount'] ?? 0
            );

            $totalInvested += $amount;

            $status = strtolower(
                (string)($investment['status'] ?? '')
            );

            if (in_array(
                $status,
                ['active', 'approved', 'running'],
                true
            )) {
                $activeInvestments++;
            }
        }
    } catch (Throwable $e) {
        $totalInvested = 0;
        $activeInvestments = 0;
    }

    /* ---------------------------------------------------------
       5. TOTAL EARNINGS
    --------------------------------------------------------- */
    $totalEarnings = 0;
    $todayEarnings = 0;

    $today = (
        new DateTimeImmutable(
            'now',
            new DateTimeZone('Africa/Kampala')
        )
    )->format('Y-m-d');

    try {
        $earningCursor = $earnings->find([
            '$or' => [
                ['user_id' => $userId],
                ['user_id' => (string)$userId]
            ],
            'type' => 'daily_earning'
        ]);

        foreach ($earningCursor as $earning) {
            $amount = moneyInt(
                $earning['amount'] ?? 0
            );

            $totalEarnings += $amount;

            if (
                isset($earning['earning_date']) &&
                (string)$earning['earning_date'] === $today
            ) {
                $todayEarnings += $amount;
            }
        }
    } catch (Throwable $e) {
        $totalEarnings = 0;
        $todayEarnings = 0;
    }

    /* ---------------------------------------------------------
       6. REFERRAL TEAM
    --------------------------------------------------------- */
    $referralTeam = 0;

    try {
        $referralTeam = $referrals->countDocuments([
            '$or' => [
                ['referrer_id' => $userId],
                ['referrer_id' => (string)$userId],
                ['user_id' => $userId],
                ['user_id' => (string)$userId]
            ]
        ]);
    } catch (Throwable $e) {
        $referralTeam = 0;
    }

    /* ---------------------------------------------------------
       7. TRANSACTION COUNT
    --------------------------------------------------------- */
    $transactionCount = 0;

    try {
        $transactionCount = $transactions->countDocuments([
            '$or' => [
                ['user_id' => $userId],
                ['user_id' => (string)$userId]
            ]
        ]);
    } catch (Throwable $e) {
        $transactionCount = 0;
    }

    /* ---------------------------------------------------------
       8. USER DETAILS
    --------------------------------------------------------- */
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

    $fullName = trim(
        $firstName . ' ' . $lastName
    );

    if ($fullName === '') {
        $fullName = (string)(
            $user['full_name']
            ?? $user['name']
            ?? 'User'
        );
    }

    $email = (string)(
        $user['email']
        ?? ''
    );

    $phone = (string)(
        $user['phone']
        ?? $user['mobile']
        ?? ''
    );

    $referralCode = (string)(
        $user['referralCode']
        ?? $user['referral_code']
        ?? ''
    );

    $status = (string)(
        $user['status']
        ?? 'active'
    );

    $role = (string)(
        $user['role']
        ?? 'user'
    );

    /* ---------------------------------------------------------
       9. SEND DASHBOARD RESPONSE
    --------------------------------------------------------- */
    jsonResponse([
        'success' => true,

        'user' => [
            'id' => (string)$user['_id'],
            'firstName' => $firstName,
            'lastName' => $lastName,
            'full_name' => $fullName,
            'email' => $email,
            'phone' => $phone,
            'referralCode' => $referralCode,
            'status' => $status,
            'role' => $role
        ],

        /* Wallet */
        'balance' => $walletBalance,
        'wallet_balance' => $walletBalance,
        'available_balance' => $walletBalance,

        /* Deposits */
        'total_deposits' => $approvedDeposits,
        'totalDeposits' => $approvedDeposits,

        /* Investments */
        'total_invested' => $totalInvested,
        'totalInvested' => $totalInvested,

        /* Earnings */
        'total_earnings' => $totalEarnings,
        'totalEarnings' => $totalEarnings,

        /* Today's earnings */
        'daily_return' => $todayEarnings,
        'dailyReturnAmount' => $todayEarnings,

        /* Investment count */
        'active_investments' => $activeInvestments,
        'activeInvestments' => $activeInvestments,

        /* Referrals */
        'referral_team' => $referralTeam,
        'referralTeam' => $referralTeam,

        /* Transactions */
        'transaction_count' => $transactionCount,
        'transactionCount' => $transactionCount,

        /*
         * Application return rate.
         * This is configurable and illustrative,
         * not a guaranteed financial return.
         */
        'daily_rate' => 0.10
    ]);

} catch (Throwable $e) {

    jsonResponse([
        'success' => false,
        'message' => 'Unable to load dashboard.'
    ], 500);
}