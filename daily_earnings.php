<?php
declare(strict_types=1);

/*
|--------------------------------------------------------------------------
| Crown Cash - Daily Investment Earnings
|--------------------------------------------------------------------------
|
| Daily configured rate:
| 10% per day
|
| IMPORTANT:
| This is a configured/illustrative rate and should not be treated as
| a guaranteed financial return.
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
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');

if ($origin === 'https://crown-cash.vercel.app') {
    header('Access-Control-Allow-Origin: https://crown-cash.vercel.app');
}

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

/*
|--------------------------------------------------------------------------
| Security
|--------------------------------------------------------------------------
*/

$cronSecret = trim(
    (string)(getenv('CRON_SECRET') ?: '')
);

$isCli = PHP_SAPI === 'cli';

if (!$isCli) {

    $providedSecret = trim(
        (string)(
            $_SERVER['HTTP_X_CRON_SECRET']
            ?? $_GET['secret']
            ?? ''
        )
    );

    if (
        $cronSecret === '' ||
        $providedSecret === '' ||
        !hash_equals($cronSecret, $providedSecret)
    ) {
        jsonResponse([
            'success' => false,
            'message' => 'Unauthorized.'
        ], 401);
    }
}

/*
|--------------------------------------------------------------------------
| Rate
|--------------------------------------------------------------------------
*/

$DAILY_RATE = 0.10;

date_default_timezone_set('Africa/Kampala');

try {

    /*
    |--------------------------------------------------------------------------
    | Active investments only
    |--------------------------------------------------------------------------
    */

    $cursor = $investments->find([
        '$or' => [
            ['status' => 'active'],
            ['status' => 'approved'],
            ['status' => 'running']
        ]
    ]);

    $processed = 0;
    $earningsCreated = 0;
    $principalReturned = 0;
    $totalEarnings = 0;

    foreach ($cursor as $investment) {

        try {

            $investmentId = isset($investment->_id)
                ? (string)$investment->_id
                : (string)($investment->id ?? '');

            if ($investmentId === '') {
                continue;
            }

            $userId = (string)($investment->user_id ?? '');

            if ($userId === '') {
                continue;
            }

            $principal = moneyInt(
                $investment->principal
                ?? $investment->amount
                ?? 0
            );

            if ($principal <= 0) {
                continue;
            }

            $durationDays = (int)(
                $investment->duration_days
                ?? 30
            );

            $activationDate =
                $investment->activation_date
                ?? $investment->approved_at
                ?? $investment->start_date
                ?? $investment->created_at;

            if (!$activationDate) {
                continue;
            }

            /*
            |--------------------------------------------------------------------------
            | Convert activation date to DateTime
            |--------------------------------------------------------------------------
            */

            if ($activationDate instanceof MongoDB\BSON\UTCDateTime) {
                $activationDateTime =
                    $activationDate->toDateTime();
            } elseif ($activationDate instanceof DateTimeInterface) {
                $activationDateTime =
                    new DateTime(
                        $activationDate->format('Y-m-d H:i:s'),
                        new DateTimeZone('Africa/Kampala')
                    );
            } else {
                $activationDateTime =
                    new DateTime(
                        (string)$activationDate,
                        new DateTimeZone('Africa/Kampala')
                    );
            }

            $activationDateTime->setTimezone(
                new DateTimeZone('Africa/Kampala')
            );

            $today = new DateTime(
                'today',
                new DateTimeZone('Africa/Kampala')
            );

            /*
            |--------------------------------------------------------------------------
            | Number of completed earning days
            |--------------------------------------------------------------------------
            */

            $activationDay = new DateTime(
                $activationDateTime->format('Y-m-d'),
                new DateTimeZone('Africa/Kampala')
            );

            $daysElapsed =
                (int)$activationDay->diff($today)->days;

            /*
            |--------------------------------------------------------------------------
            | Do not exceed investment duration
            |--------------------------------------------------------------------------
            */

            $completedDays = min(
                max($daysElapsed, 0),
                $durationDays
            );

            if ($completedDays <= 0) {
                continue;
            }

            /*
            |--------------------------------------------------------------------------
            | Process every missing earning day.
            |--------------------------------------------------------------------------
            */

            $session = null;

            try {

                $session = $mongoClient->startSession();
                $session->startTransaction();

                $investmentEarningsForThisInvestment = 0;

                for (
                    $dayNumber = 1;
                    $dayNumber <= $completedDays;
                    $dayNumber++
                ) {

                    /*
                    |--------------------------------------------------------------------------
                    | Unique ledger key
                    |--------------------------------------------------------------------------
                    */

                    $ledgerKey =
                        $investmentId .
                        ':day:' .
                        $dayNumber;

                    $existing = $earnings->findOne([
                        'ledger_key' => $ledgerKey
                    ]);

                    if ($existing) {
                        continue;
                    }

                    /*
                    |--------------------------------------------------------------------------
                    | Daily earning
                    |--------------------------------------------------------------------------
                    */

                    $dailyEarning = (int)round(
                        $principal * $DAILY_RATE
                    );

                    if ($dailyEarning <= 0) {
                        continue;
                    }

                    $earningDate = clone $activationDay;

                    $earningDate->modify(
                        '+' . ($dayNumber - 1) . ' days'
                    );

                    $earningDate->setTime(
                        23,
                        59,
                        59
                    );

                    $now = nowUtc();

                    /*
                    |--------------------------------------------------------------------------
                    | Earnings ledger
                    |--------------------------------------------------------------------------
                    */

                    $earnings->insertOne(
                        [
                            'user_id' => $userId,

                            'investment_id' => $investmentId,

                            'type' => 'daily_earning',

                            'category' => 'investment',

                            'amount' => $dailyEarning,

                            'rate' => $DAILY_RATE,

                            'day_number' => $dayNumber,

                            'earning_date' => new MongoDB\BSON\UTCDateTime(
                                $earningDate->getTimestamp() * 1000
                            ),

                            'ledger_key' => $ledgerKey,

                            'created_at' => $now
                        ],
                        [
                            'session' => $session
                        ]
                    );

                    /*
                    |--------------------------------------------------------------------------
                    | Add earning to wallet
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
                            'id' => $userId
                        ]);
                    }

                    if (!$user) {
                        throw new RuntimeException(
                            'User not found for investment earning.'
                        );
                    }

                    $currentBalance = moneyInt(
                        $user->balance
                        ?? $user->wallet_balance
                        ?? 0
                    );

                    $newBalance =
                        $currentBalance +
                        $dailyEarning;

                    $users->updateOne(
                        [
                            '_id' => $user->_id
                        ],
                        [
                            '$set' => [
                                'balance' => $newBalance,
                                'wallet_balance' => $newBalance,
                                'updated_at' => $now
                            ]
                        ],
                        [
                            'session' => $session
                        ]
                    );

                    /*
                    |--------------------------------------------------------------------------
                    | Transaction
                    |--------------------------------------------------------------------------
                    */

                    $transactions->insertOne(
                        [
                            'user_id' => $userId,

                            'investment_id' => $investmentId,

                            'type' => 'daily_earning',

                            'transaction_type' => 'daily_earning',

                            'category' => 'investment_earning',

                            'amount' => $dailyEarning,

                            'direction' => 'credit',

                            'status' => 'completed',

                            'day_number' => $dayNumber,

                            'description' =>
                                'Investment daily earning - Day ' .
                                $dayNumber,

                            'created_at' => $now,

                            'updated_at' => $now
                        ],
                        [
                            'session' => $session
                        ]
                    );

                    $investmentEarningsForThisInvestment +=
                        $dailyEarning;

                    $earningsCreated++;
                    $totalEarnings += $dailyEarning;
                }

                /*
                |--------------------------------------------------------------------------
                | Return principal when investment completes
                |--------------------------------------------------------------------------
                */

                if ($completedDays >= $durationDays) {

                    $alreadyCompleted =
                        strtolower(
                            trim(
                                (string)(
                                    $investment->status ?? ''
                                )
                            )
                        ) === 'completed';

                    if (!$alreadyCompleted) {

                        $user = null;

                        if (isValidObjectId($userId)) {
                            $user = $users->findOne([
                                '_id' => objectIdOrNull($userId)
                            ]);
                        }

                        if (!$user) {
                            $user = $users->findOne([
                                'id' => $userId
                            ]);
                        }

                        if (!$user) {
                            throw new RuntimeException(
                                'User not found for principal return.'
                            );
                        }

                        $currentBalance = moneyInt(
                            $user->balance
                            ?? $user->wallet_balance
                            ?? 0
                        );

                        $newBalance =
                            $currentBalance +
                            $principal;

                        $now = nowUtc();

                        $users->updateOne(
                            [
                                '_id' => $user->_id
                            ],
                            [
                                '$set' => [
                                    'balance' => $newBalance,
                                    'wallet_balance' => $newBalance,
                                    'updated_at' => $now
                                ]
                            ],
                            [
                                'session' => $session
                            ]
                        );

                        $transactions->insertOne(
                            [
                                'user_id' => $userId,

                                'investment_id' => $investmentId,

                                'type' => 'investment_principal_return',

                                'transaction_type' =>
                                    'investment_principal_return',

                                'category' => 'investment',

                                'amount' => $principal,

                                'direction' => 'credit',

                                'status' => 'completed',

                                'description' =>
                                    'Investment principal returned after completion.',

                                'created_at' => $now,

                                'updated_at' => $now
                            ],
                            [
                                'session' => $session
                            ]
                        );

                        $investments->updateOne(
                            [
                                '_id' => objectIdOrNull($investmentId)
                            ],
                            [
                                '$set' => [
                                    'status' => 'completed',
                                    'completed_at' => $now,
                                    'principal_returned' => true,
                                    'updated_at' => $now,
                                    'balance_reserved' => false,
                                    'reserved_amount' => 0
                                ]
                            ],
                            [
                                'session' => $session
                            ]
                        );

                        $principalReturned += $principal;
                    }
                }

                $session->commitTransaction();

                $processed++;

            } catch (Throwable $investmentError) {

                if ($session) {
                    try {
                        $session->abortTransaction();
                    } catch (Throwable $ignore) {
                    }
                }

                error_log(
                    'Crown Cash daily earnings investment ' .
                    $investmentId .
                    ': ' .
                    $investmentError->getMessage()
                );

            } finally {

                if ($session) {
                    $session->endSession();
                }
            }

        } catch (Throwable $individualError) {

            error_log(
                'Crown Cash daily earnings individual error: ' .
                $individualError->getMessage()
            );
        }
    }

    jsonResponse([
        'success' => true,

        'message' => 'Daily investment earnings processing completed.',

        'daily_rate' => $DAILY_RATE,

        'processed_investments' => $processed,

        'earnings_created' => $earningsCreated,

        'total_earnings_credited' => $totalEarnings,

        'principal_returned' => $principalReturned
    ]);

} catch (Throwable $e) {

    error_log(
        'Crown Cash daily_earnings.php error: ' .
        $e->getMessage()
    );

    jsonResponse([
        'success' => false,
        'message' => 'Daily earnings processing failed.'
    ], 500);
}