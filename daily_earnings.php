<?php
declare(strict_types=1);

require_once __DIR__ . '/config.php';

/*
|--------------------------------------------------------------------------
| DAILY EARNINGS PROCESSOR
|--------------------------------------------------------------------------
|
| This file should be executed ONCE PER DAY by a trusted scheduler.
|
| HTTP:
|   POST /daily_earnings.php
|   Header: X-Cron-Secret: YOUR_CRON_SECRET
|
| CLI:
|   php daily_earnings.php
|
| The job:
|   1. Finds active investments.
|   2. Calculates eligible daily earnings.
|   3. Uses a unique ledger key to prevent duplicate credits.
|   4. Credits the user's wallet.
|   5. Creates an earnings transaction.
|   6. Returns the principal when the investment reaches its
|      configured duration.
|   7. Marks the investment completed.
|
|--------------------------------------------------------------------------
*/


/* =========================================================
   AUTHENTICATE CRON REQUEST
========================================================= */

$cronSecret = getenv('CRON_SECRET') ?: '';

$isCli = PHP_SAPI === 'cli';


if (!$isCli) {

    $providedSecret =
        $_SERVER['HTTP_X_CRON_SECRET']
        ?? '';

    if (
        $cronSecret === ''
        ||
        !hash_equals(
            $cronSecret,
            $providedSecret
        )
    ) {

        jsonResponse([
            'success' => false,
            'message' => 'Unauthorized cron request.'
        ], 401);
    }
}


/* =========================================================
   CONFIGURATION
========================================================= */

/*
 * Application daily return rate.
 *
 * 0.10 = 10% of the investment principal per eligible day.
 *
 * This is an application-configured rate, not a guaranteed
 * financial return.
 */
$DAILY_RATE = 0.10;


/*
 * Uganda/Kampala timezone is used for determining the
 * investment earning date.
 */
$timezone =
    new DateTimeZone(
        'Africa/Kampala'
    );


$nowLocal =
    new DateTimeImmutable(
        'now',
        $timezone
    );


$nowUtc =
    new MongoDB\BSON\UTCDateTime();


/* =========================================================
   ENSURE UNIQUE EARNINGS LEDGER
========================================================= */

try {

    /*
     * One investment can only have one daily earning
     * record for a particular earning date.
     *
     * Example:
     *
     * investmentID|DAILY|2026-10-01
     *
     * This prevents the scheduler from paying the same
     * day's earning twice.
     */
    $earnings->createIndex(
        [
            'ledger_key' => 1
        ],
        [
            'unique' => true,
            'name' =>
                'unique_earnings_ledger_key'
        ]
    );

} catch (Throwable $e) {

    /*
     * The index may already exist.
     * Processing can continue.
     */
}


/* =========================================================
   PROCESSING COUNTERS
========================================================= */

$processedInvestments = 0;

$creditedDays = 0;

$principalReturns = 0;

$errors = [];


/* =========================================================
   FIND ACTIVE INVESTMENTS
========================================================= */

try {

    $cursor = $investments->find([
        'status' => 'active'
    ]);


    foreach ($cursor as $investment) {

        $processedInvestments++;


        try {

            /* -------------------------------------------------
               INVESTMENT ID
            ------------------------------------------------- */

            $investmentId =
                $investment['_id'];


            /* -------------------------------------------------
               USER ID
            ------------------------------------------------- */

            $userId =
                objectIdOrNull(
                    $investment['user_id']
                    ?? null
                );


            if (!$userId) {

                throw new RuntimeException(
                    'Investment has an invalid user ID.'
                );
            }


            /* -------------------------------------------------
               PRINCIPAL
            ------------------------------------------------- */

            $principal =
                moneyInt(
                    $investment['amount']
                    ?? 0
                );


            if ($principal <= 0) {

                throw new RuntimeException(
                    'Investment has an invalid amount.'
                );
            }


            /* -------------------------------------------------
               DURATION
            ------------------------------------------------- */

            $duration =
                (int)(
                    $investment['duration_days']
                    ?? 30
                );


            if ($duration <= 0) {
                $duration = 30;
            }


            /* -------------------------------------------------
               ACTIVATION DATE
            ------------------------------------------------- */

            $activatedAt =
                $investment['activated_at']
                ?? $investment['approved_at']
                ?? null;


            if (
                !(
                    $activatedAt
                    instanceof MongoDB\BSON\UTCDateTime
                )
            ) {

                throw new RuntimeException(
                    'Investment has no valid activation date.'
                );
            }


            /* -------------------------------------------------
               CONVERT ACTIVATION TIME TO KAMPALA TIME
            ------------------------------------------------- */

            $activationLocal =
                $activatedAt
                    ->toDateTime()
                    ->setTimezone(
                        $timezone
                    );


            /* -------------------------------------------------
               CALCULATE ELIGIBLE DAYS
            ------------------------------------------------- */

            $elapsedSeconds =
                $nowLocal->getTimestamp()
                -
                $activationLocal->getTimestamp();


            $eligibleDays =
                (int)floor(
                    $elapsedSeconds / 86400
                );


            /*
             * No full 24-hour period has passed yet.
             */
            if ($eligibleDays <= 0) {
                continue;
            }


            /*
             * Never exceed the investment duration.
             */
            if ($eligibleDays > $duration) {
                $eligibleDays = $duration;
            }


            /* =================================================
               PROCESS EACH ELIGIBLE DAY
            ================================================= */

            for (
                $dayIndex = 1;
                $dayIndex <= $eligibleDays;
                $dayIndex++
            ) {

                /*
                 * Calculate the earning date.
                 *
                 * Example:
                 * Activation = 1 October
                 *
                 * Day 1 = 2 October
                 * Day 2 = 3 October
                 */
                $earningDate =
                    $activationLocal
                        ->modify(
                            "+{$dayIndex} days"
                        )
                        ->format(
                            'Y-m-d'
                        );


                /*
                 * Unique ledger identifier.
                 */
                $ledgerKey =
                    (string)$investmentId
                    . '|DAILY|'
                    . $earningDate;


                /*
                 * Each earning day is processed in its
                 * own MongoDB transaction.
                 */
                $session =
                    $client->startSession();


                try {

                    $session->startTransaction();


                    /* =========================================
                       CALCULATE DAILY EARNING
                    ========================================= */

                    $earningAmount =
                        moneyInt(
                            $principal
                            *
                            $DAILY_RATE
                        );


                    if ($earningAmount <= 0) {

                        $session->abortTransaction();

                        continue;
                    }


                    /* =========================================
                       CREATE EARNING LEDGER RECORD
                    ========================================= */

                    try {

                        $earnings->insertOne(

                            [

                                'ledger_key' =>
                                    $ledgerKey,

                                'investment_id' =>
                                    $investmentId,

                                'user_id' =>
                                    $userId,

                                'type' =>
                                    'daily_earning',

                                'earning_date' =>
                                    $earningDate,

                                'day_number' =>
                                    $dayIndex,

                                'rate' =>
                                    $DAILY_RATE,

                                'principal' =>
                                    $principal,

                                'amount' =>
                                    $earningAmount,

                                'currency' =>
                                    'UGX',

                                'created_at' =>
                                    $nowUtc

                            ],

                            [
                                'session' =>
                                    $session
                            ]

                        );

                    } catch (
                        MongoDB\Driver\Exception\BulkWriteException $duplicate
                    ) {

                        /*
                         * The unique ledger key means this earning
                         * has already been credited.
                         *
                         * Abort this transaction and move to the
                         * next day.
                         */
                        try {
                            $session->abortTransaction();
                        } catch (Throwable $ignored) {
                        }

                        continue;
                    }


                    /* =========================================
                       CREDIT DAILY EARNING TO WALLET
                    ========================================= */

                    $walletUpdate =
                        $users->updateOne(

                            [
                                '_id' =>
                                    $userId
                            ],

                            [
                                '$inc' => [

                                    'balance' =>
                                        $earningAmount

                                ],

                                '$set' => [

                                    'updated_at' =>
                                        $nowUtc

                                ]

                            ],

                            [
                                'session' =>
                                    $session
                            ]

                        );


                    if (
                        $walletUpdate->getMatchedCount()
                        !== 1
                    ) {

                        throw new RuntimeException(
                            'User wallet could not be updated.'
                        );
                    }


                    /* =========================================
                       CREATE EARNING TRANSACTION
                    ========================================= */

                    $transactions->insertOne(

                        [

                            'user_id' =>
                                $userId,

                            'type' =>
                                'earning',

                            'transaction_type' =>
                                'earning',

                            'title' =>
                                'Daily investment earning',

                            'description' =>
                                "Daily return for investment "
                                . (string)$investmentId
                                . ", day "
                                . $dayIndex
                                . " of "
                                . $duration
                                . ".",

                            'amount' =>
                                $earningAmount,

                            'currency' =>
                                'UGX',

                            'status' =>
                                'approved',

                            'reference' =>
                                'EARN-'
                                .
                                strtoupper(
                                    bin2hex(
                                        random_bytes(6)
                                    )
                                ),

                            'investment_id' =>
                                $investmentId,

                            'earning_date' =>
                                $earningDate,

                            'created_at' =>
                                $nowUtc,

                            'updated_at' =>
                                $nowUtc

                        ],

                        [
                            'session' =>
                                $session
                        ]

                    );


                    /* =========================================
                       INVESTMENT FINAL DAY
                    ========================================= */

                    if (
                        $dayIndex === $duration
                    ) {

                        /*
                         * Unique principal-return ledger key.
                         */
                        $principalLedgerKey =
                            (string)$investmentId
                            . '|PRINCIPAL_RETURN';


                        try {

                            /*
                             * Record the principal return first.
                             */
                            $earnings->insertOne(

                                [

                                    'ledger_key' =>
                                        $principalLedgerKey,

                                    'investment_id' =>
                                        $investmentId,

                                    'user_id' =>
                                        $userId,

                                    'type' =>
                                        'principal_return',

                                    'earning_date' =>
                                        $earningDate,

                                    'amount' =>
                                        $principal,

                                    'currency' =>
                                        'UGX',

                                    'created_at' =>
                                        $nowUtc

                                ],

                                [
                                    'session' =>
                                        $session
                                ]

                            );


                            /* ---------------------------------
                               RETURN PRINCIPAL TO WALLET
                            --------------------------------- */

                            $principalUpdate =
                                $users->updateOne(

                                    [
                                        '_id' =>
                                            $userId
                                    ],

                                    [
                                        '$inc' => [

                                            'balance' =>
                                                $principal

                                        ],

                                        '$set' => [

                                            'updated_at' =>
                                                $nowUtc

                                        ]

                                    ],

                                    [
                                        'session' =>
                                            $session
                                    ]

                                );


                            if (
                                $principalUpdate
                                    ->getMatchedCount()
                                !== 1
                            ) {

                                throw new RuntimeException(
                                    'Unable to return investment principal.'
                                );
                            }


                            /* ---------------------------------
                               PRINCIPAL RETURN TRANSACTION
                            --------------------------------- */

                            $transactions->insertOne(

                                [

                                    'user_id' =>
                                        $userId,

                                    'type' =>
                                        'principal_return',

                                    'transaction_type' =>
                                        'principal_return',

                                    'title' =>
                                        'Investment principal returned',

                                    'description' =>
                                        'Investment completed and principal returned to wallet.',

                                    'amount' =>
                                        $principal,

                                    'currency' =>
                                        'UGX',

                                    'status' =>
                                        'approved',

                                    'reference' =>
                                        'PRINCIPAL-'
                                        .
                                        strtoupper(
                                            bin2hex(
                                                random_bytes(6)
                                            )
                                        ),

                                    'investment_id' =>
                                        $investmentId,

                                    'earning_date' =>
                                        $earningDate,

                                    'created_at' =>
                                        $nowUtc,

                                    'updated_at' =>
                                        $nowUtc

                                ],

                                [
                                    'session' =>
                                        $session
                                ]

                            );


                            $principalReturns++;

                        } catch (
                            MongoDB\Driver\Exception\BulkWriteException $duplicate
                        ) {

                            /*
                             * Principal was already returned.
                             *
                             * Do not return it again.
                             */
                        }


                        /* ---------------------------------
                           MARK INVESTMENT COMPLETED
                        --------------------------------- */

                        $investments->updateOne(

                            [
                                '_id' =>
                                    $investmentId,

                                'status' =>
                                    'active'
                            ],

                            [
                                '$set' => [

                                    'status' =>
                                        'completed',

                                    'completed_at' =>
                                        $nowUtc,

                                    'updated_at' =>
                                        $nowUtc

                                ]

                            ],

                            [
                                'session' =>
                                    $session
                            ]

                        );
                    }


                    /* =========================================
                       COMMIT DAY
                    ========================================= */

                    $session->commitTransaction();

                    $creditedDays++;


                } catch (Throwable $e) {

                    try {
                        $session->abortTransaction();
                    } catch (Throwable $ignored) {
                    }

                    throw $e;
                }
            }


        } catch (Throwable $e) {

            $errors[] = [

                'investment_id' =>
                    (string)(
                        $investment['_id']
                        ?? ''
                    ),

                'message' =>
                    $e->getMessage()

            ];
        }
    }


    /* =========================================================
       FINAL RESPONSE
    ========================================================= */

    $result = [

        'success' =>
            true,

        'message' =>
            'Daily earnings processing completed.',

        'processed_investments' =>
            $processedInvestments,

        'daily_credits' =>
            $creditedDays,

        'principal_returns' =>
            $principalReturns,

        'errors' =>
            $errors,

        'processed_at' =>
            $nowLocal->format(
                DATE_ATOM
            )

    ];


    /* =========================================================
       CLI RESPONSE
    ========================================================= */

    if ($isCli) {

        echo json_encode(
            $result,
            JSON_PRETTY_PRINT |
            JSON_UNESCAPED_SLASHES
        );

        echo PHP_EOL;

        exit;
    }


    /* =========================================================
       HTTP RESPONSE
    ========================================================= */

    jsonResponse(
        $result
    );


} catch (Throwable $e) {

    error_log(
        'Daily earnings job error: '
        . $e->getMessage()
    );


    if ($isCli) {

        fwrite(
            STDERR,
            json_encode([
                'success' =>
                    false,

                'message' =>
                    $e->getMessage()
            ])
            . PHP_EOL
        );

        exit(1);
    }


    jsonResponse([

        'success' =>
            false,

        'message' =>
            'Daily earnings job failed.'

    ], 500);
}