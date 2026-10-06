<?php

declare(strict_types=1);

/*
|--------------------------------------------------------------------------
| CROWN CASH - MY INVESTMENTS
|--------------------------------------------------------------------------
| READ-ONLY investment history endpoint.
|
| New investment structure:
| - Custom investment amounts
| - Minimum amount handled by investment.php
| - Investments become active immediately
| - No admin approval workflow
| - No wallet deductions here
| - No earnings credits here
| - Earnings are handled by the earnings processor
|--------------------------------------------------------------------------
*/

ob_start();

/* =========================================================================
   CONFIG
========================================================================= */

try {

    require_once __DIR__ . '/config.php';

} catch (Throwable $e) {

    while (ob_get_level() > 0) {
        ob_end_clean();
    }

    header('Content-Type: application/json; charset=UTF-8');
    http_response_code(500);

    echo json_encode([
        'success' => false,
        'message' => 'Server configuration could not be loaded.'
    ]);

    exit;
}


/* =========================================================================
   CORS
========================================================================= */

$requestOrigin =
    $_SERVER['HTTP_ORIGIN'] ?? '';

$allowedOrigins = [
    'https://crown-cash.vercel.app',
    'https://www.crown-cash.vercel.app'
];

if (
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

} elseif ($requestOrigin === '') {

    header(
        'Access-Control-Allow-Origin: https://crown-cash.vercel.app'
    );
}

header(
    'Access-Control-Allow-Credentials: true'
);

header(
    'Access-Control-Allow-Headers: ' .
    'Content-Type, Accept, Authorization, X-Requested-With'
);

header(
    'Access-Control-Allow-Methods: GET, OPTIONS'
);

header(
    'Access-Control-Max-Age: 86400'
);

header(
    'Vary: Origin'
);

header(
    'Content-Type: application/json; charset=UTF-8'
);


/* =========================================================================
   OPTIONS
========================================================================= */

if (
    ($_SERVER['REQUEST_METHOD'] ?? '') ===
    'OPTIONS'
) {

    http_response_code(204);

    exit;
}


/* =========================================================================
   GET ONLY
========================================================================= */

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


/* =========================================================================
   SESSION
========================================================================= */

try {

    if (
        function_exists(
            'startSecureSession'
        )
    ) {

        startSecureSession();

    } else {

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

    http_response_code(500);

    echo json_encode([
        'success' => false,
        'message' => 'Unable to start your session.'
    ]);

    exit;
}


/* =========================================================================
   AUTHENTICATION
========================================================================= */

if (
    empty($_SESSION['logged_in']) ||
    $_SESSION['logged_in'] !== true
) {

    http_response_code(401);

    echo json_encode([
        'success' => false,
        'message' =>
            'Please log in before viewing your investments.'
    ]);

    exit;
}


/* =========================================================================
   SESSION USER
========================================================================= */

$sessionUserId =
    $_SESSION['user_id']
    ?? $_SESSION['userId']
    ?? $_SESSION['id']
    ?? $_SESSION['_id']
    ?? null;

$sessionEmail =
    $_SESSION['email']
    ?? $_SESSION['user_email']
    ?? '';

$sessionEmail =
    trim(
        (string)$sessionEmail
    );


if (
    $sessionUserId === null &&
    $sessionEmail === ''
) {

    http_response_code(401);

    echo json_encode([
        'success' => false,
        'message' =>
            'Your login session does not contain a valid user account.'
    ]);

    exit;
}


/* =========================================================================
   OBJECT ID HELPER
========================================================================= */

function crownCashObjectId(
    $value
): ?MongoDB\BSON\ObjectId {

    if (
        $value instanceof
        MongoDB\BSON\ObjectId
    ) {

        return $value;
    }

    $value =
        trim(
            (string)$value
        );

    if ($value === '') {
        return null;
    }

    try {

        return new MongoDB\BSON\ObjectId(
            $value
        );

    } catch (Throwable $e) {

        return null;
    }
}


/* =========================================================================
   NUMBER HELPER
========================================================================= */

function crownCashNumber(
    $value
): float {

    if ($value === null) {
        return 0.0;
    }

    if (
        $value instanceof
        MongoDB\BSON\Decimal128
    ) {

        return (float)$value->toString();
    }

    if (
        $value instanceof
        MongoDB\BSON\Int64
    ) {

        return (float)$value->__toString();
    }

    if (
        $value instanceof
        MongoDB\BSON\Double
    ) {

        return (float)$value->__toString();
    }

    if (
        is_numeric($value)
    ) {

        return (float)$value;
    }

    return 0.0;
}


/* =========================================================================
   BSON NORMALIZER
========================================================================= */

function crownCashNormalize(
    $value
) {

    if (
        $value instanceof
        MongoDB\Model\BSONDocument
    ) {

        $result = [];

        foreach (
            $value as $key => $item
        ) {

            $result[$key] =
                crownCashNormalize(
                    $item
                );
        }

        return $result;
    }


    if (
        $value instanceof
        MongoDB\Model\BSONArray
    ) {

        $result = [];

        foreach (
            $value as $item
        ) {

            $result[] =
                crownCashNormalize(
                    $item
                );
        }

        return $result;
    }


    if (
        $value instanceof
        MongoDB\BSON\ObjectId
    ) {

        return (string)$value;
    }


    if (
        $value instanceof
        MongoDB\BSON\UTCDateTime
    ) {

        try {

            return $value
                ->toDateTime()
                ->format(
                    'Y-m-d H:i:s'
                );

        } catch (Throwable $e) {

            return null;
        }
    }


    if (
        $value instanceof
        MongoDB\BSON\Decimal128
    ) {

        return (float)$value->toString();
    }


    if (
        $value instanceof
        MongoDB\BSON\Int64
    ) {

        return (int)$value->__toString();
    }


    if (
        $value instanceof
        MongoDB\BSON\Double
    ) {

        return (float)$value->__toString();
    }


    if (
        is_array($value)
    ) {

        $result = [];

        foreach (
            $value as $key => $item
        ) {

            $result[$key] =
                crownCashNormalize(
                    $item
                );
        }

        return $result;
    }


    return $value;
}


/* =========================================================================
   USER FILTER
========================================================================= */

function crownCashInvestmentUserFilter(
    $userId,
    string $email
): array {

    $or = [];


    $objectId =
        crownCashObjectId(
            $userId
        );


    if (
        $objectId !== null
    ) {

        $or[] = [
            'user_id' => $objectId
        ];

        $or[] = [
            'userId' => $objectId
        ];

        $or[] = [
            'account_id' => $objectId
        ];
    }


    $idString =
        trim(
            (string)$userId
        );


    if (
        $idString !== ''
    ) {

        $or[] = [
            'user_id' => $idString
        ];

        $or[] = [
            'userId' => $idString
        ];

        $or[] = [
            'account_id' => $idString
        ];
    }


    if (
        $email !== ''
    ) {

        $or[] = [
            'user_email' => $email
        ];

        $or[] = [
            'email' => $email
        ];
    }


    if (
        count($or) === 0
    ) {

        return [
            '_id' => null
        ];
    }


    return [
        '$or' => $or
    ];
}


/* =========================================================================
   STATUS
========================================================================= */

function crownCashStatus(
    $value
): string {

    $status =
        strtolower(
            trim(
                (string)$value
            )
        );


    /*
     * New investments are active immediately.
     */

    if (
        $status === ''
    ) {

        return 'active';
    }


    /*
     * Legacy active equivalents.
     */

    if (
        in_array(
            $status,
            [
                'approved',
                'active',
                'running',
                'in_progress'
            ],
            true
        )
    ) {

        return 'active';
    }


    /*
     * Completed equivalents.
     */

    if (
        in_array(
            $status,
            [
                'complete',
                'completed',
                'matured',
                'finished'
            ],
            true
        )
    ) {

        return 'completed';
    }


    /*
     * Failed/rejected records are retained
     * for historical accuracy.
     */

    if (
        in_array(
            $status,
            [
                'declined',
                'rejected'
            ],
            true
        )
    ) {

        return 'rejected';
    }


    if (
        in_array(
            $status,
            [
                'failed'
            ],
            true
        )
    ) {

        return 'failed';
    }


    if (
        in_array(
            $status,
            [
                'cancelled',
                'canceled'
            ],
            true
        )
    ) {

        return 'cancelled';
    }


    /*
     * IMPORTANT:
     *
     * The new investment system does not
     * create pending investments.
     *
     * Unknown/legacy investment statuses
     * are therefore exposed as active only
     * when they represent a usable investment.
     */

    return $status;
}


/* =========================================================================
   TIMESTAMP
========================================================================= */

function crownCashTimestamp(
    $value
): ?int {

    if (!$value) {
        return null;
    }


    if (
        is_array($value)
    ) {

        if (
            isset(
                $value['$date']
            )
        ) {

            $value =
                $value['$date'];

        } elseif (
            isset(
                $value['date']
            )
        ) {

            $value =
                $value['date'];
        }
    }


    $timestamp =
        strtotime(
            (string)$value
        );


    if (
        $timestamp === false
    ) {

        return null;
    }


    return $timestamp;
}


/* =========================================================================
   FORMAT DATE
========================================================================= */

function crownCashDate(
    $value
): ?string {

    $timestamp =
        crownCashTimestamp(
            $value
        );


    if (
        $timestamp === null
    ) {

        return null;
    }


    return date(
        'Y-m-d H:i:s',
        $timestamp
    );
}


/* =========================================================================
   MAIN
========================================================================= */

try {

    /* ---------------------------------------------------------------------
       VERIFY COLLECTIONS
    --------------------------------------------------------------------- */

    if (
        !isset($users) ||
        !isset($investments)
    ) {

        http_response_code(500);

        echo json_encode([
            'success' => false,
            'message' =>
                'Investment database collections are not configured.'
        ]);

        exit;
    }


    /* ---------------------------------------------------------------------
       FIND USER
    --------------------------------------------------------------------- */

    $userFilter =
        [];

    $userOr = [];


    $objectId =
        crownCashObjectId(
            $sessionUserId
        );


    if (
        $objectId !== null
    ) {

        $userOr[] = [
            '_id' => $objectId
        ];

        $userOr[] = [
            'id' => $objectId
        ];
    }


    $idString =
        trim(
            (string)$sessionUserId
        );


    if (
        $idString !== ''
    ) {

        $userOr[] = [
            '_id' => $idString
        ];

        $userOr[] = [
            'id' => $idString
        ];

        $userOr[] = [
            'user_id' => $idString
        ];
    }


    if (
        $sessionEmail !== ''
    ) {

        $userOr[] = [
            'email' => $sessionEmail
        ];

        $userOr[] = [
            'user_email' => $sessionEmail
        ];
    }


    if (
        count($userOr) > 0
    ) {

        $userFilter = [
            '$or' => $userOr
        ];

    } else {

        $userFilter = [
            '_id' => null
        ];
    }


    $userDocument =
        $users->findOne(
            $userFilter
        );


    if (
        $userDocument === null
    ) {

        http_response_code(404);

        echo json_encode([
            'success' => false,
            'message' =>
                'Your Crown Cash account could not be found.'
        ]);

        exit;
    }


    $user =
        crownCashNormalize(
            $userDocument
        );


    if (
        !is_array($user)
    ) {

        $user = [];
    }


    /* ---------------------------------------------------------------------
       WALLET BALANCE
    --------------------------------------------------------------------- */

    $balance = 0.0;


    if (
        array_key_exists(
            'balance',
            $user
        )
    ) {

        $balance =
            crownCashNumber(
                $user['balance']
            );

    } elseif (
        array_key_exists(
            'wallet_balance',
            $user
        )
    ) {

        $balance =
            crownCashNumber(
                $user['wallet_balance']
            );

    } elseif (
        array_key_exists(
            'walletBalance',
            $user
        )
    ) {

        $balance =
            crownCashNumber(
                $user['walletBalance']
            );

    } elseif (
        isset($user['wallet']) &&
        is_array($user['wallet']) &&
        array_key_exists(
            'balance',
            $user['wallet']
        )
    ) {

        $balance =
            crownCashNumber(
                $user['wallet']['balance']
            );
    }


    /* ---------------------------------------------------------------------
       INVESTMENT FILTER
    --------------------------------------------------------------------- */

    $investmentFilter =
        crownCashInvestmentUserFilter(
            $sessionUserId,
            $sessionEmail
        );


    /* ---------------------------------------------------------------------
       FETCH INVESTMENTS
    --------------------------------------------------------------------- */

    $investmentDocuments = [];


    $cursor =
        $investments->find(
            $investmentFilter,
            [
                'sort' => [
                    'created_at' => -1
                ]
            ]
        );


    foreach (
        $cursor as $document
    ) {

        $normalized =
            crownCashNormalize(
                $document
            );


        if (
            is_array($normalized)
        ) {

            $investmentDocuments[] =
                $normalized;
        }
    }


    /* ---------------------------------------------------------------------
       NORMALIZE INVESTMENTS
    --------------------------------------------------------------------- */

    $investmentList = [];


    foreach (
        $investmentDocuments
        as $investment
    ) {

        /* ---------------------------------------------------------------
           ID
        --------------------------------------------------------------- */

        $id =
            $investment['_id']
            ?? $investment['id']
            ?? '';

        $id =
            (string)$id;


        /* ---------------------------------------------------------------
           AMOUNT
        --------------------------------------------------------------- */

        $amount =
            crownCashNumber(
                $investment['amount']
                ?? $investment['investment_amount']
                ?? $investment['investmentAmount']
                ?? $investment['principal']
                ?? $investment['reserved_amount']
                ?? 0
            );


        $principal =
            crownCashNumber(
                $investment['principal']
                ?? $amount
            );


        /* ---------------------------------------------------------------
           SERVER DAILY RATE
        --------------------------------------------------------------- */

        $dailyRate =
            crownCashNumber(
                $investment['daily_rate']
                ?? $investment['dailyRate']
                ?? 0.10
            );


        /*
         * Stored rate should normally be:
         *
         * 0.10 = 10%
         *
         * If a legacy record has:
         *
         * 10 = 10%
         *
         * normalize it.
         */

        if (
            $dailyRate > 1
        ) {

            $dailyRate /=
                100;
        }


        /* ---------------------------------------------------------------
           DAILY INCOME
        --------------------------------------------------------------- */

        $dailyIncome =
            crownCashNumber(
                $investment['daily_income']
                ?? $investment['dailyIncome']
                ?? $investment['daily_earning']
                ?? $investment['dailyEarning']
                ?? ($amount * $dailyRate)
            );


        /* ---------------------------------------------------------------
           DURATION
        --------------------------------------------------------------- */

        $duration =
            (int)(
                $investment['duration_days']
                ?? $investment['durationDays']
                ?? $investment['duration']
                ?? 30
            );


        if (
            $duration <= 0
        ) {

            $duration = 30;
        }


        /* ---------------------------------------------------------------
           TOTAL EARNINGS
        --------------------------------------------------------------- */

        $totalEarnings =
            crownCashNumber(
                $investment['total_earnings']
                ?? $investment['totalEarnings']
                ?? $investment['earnings']
                ?? $investment['total_income']
                ?? $investment['totalIncome']
                ?? $investment['earnings_processed']
                ?? 0
            );


        /* ---------------------------------------------------------------
           MATURITY AMOUNT
        --------------------------------------------------------------- */

        $maturityAmount =
            crownCashNumber(
                $investment['maturity_amount']
                ?? $investment['maturityAmount']
                ?? (
                    $principal +
                    (
                        $dailyIncome *
                        $duration
                    )
                )
            );


        /* ---------------------------------------------------------------
           STATUS
        --------------------------------------------------------------- */

        $rawStatus =
            $investment['status']
            ?? 'active';


        $status =
            crownCashStatus(
                $rawStatus
            );


        /* ---------------------------------------------------------------
           DATES
        --------------------------------------------------------------- */

        $createdAt =
            $investment['created_at']
            ?? $investment['createdAt']
            ?? null;


        $activatedAt =
            $investment['activated_at']
            ?? $investment['activatedAt']
            ?? null;


        $startedAt =
            $investment['started_at']
            ?? $investment['startedAt']
            ?? null;


        $completedAt =
            $investment['completed_at']
            ?? $investment['completedAt']
            ?? null;


        /*
         * New investments start immediately.
         *
         * Therefore activated_at / started_at
         * are preferred over admin approval dates.
         */

        $startDate =
            $activatedAt
            ?? $startedAt
            ?? $createdAt;


        /* ---------------------------------------------------------------
           END DATE
        --------------------------------------------------------------- */

        $endDate =
            $investment['end_date']
            ?? $investment['endDate']
            ?? $investment['matures_at']
            ?? $investment['maturesAt']
            ?? $completedAt
            ?? null;


        /*
         * Calculate maturity date when the backend
         * has not explicitly stored one.
         */

        if (
            $endDate === null &&
            $startDate !== null
        ) {

            $startTimestamp =
                crownCashTimestamp(
                    $startDate
                );


            if (
                $startTimestamp !== null
            ) {

                $endTimestamp =
                    $startTimestamp +
                    (
                        $duration *
                        86400
                    );


                $endDate =
                    date(
                        'Y-m-d H:i:s',
                        $endTimestamp
                    );
            }
        }


        /* ---------------------------------------------------------------
           PROGRESS
        --------------------------------------------------------------- */

        $progress = 0;


        if (
            $status === 'completed'
        ) {

            $progress = 100;

        } elseif (
            $status === 'active'
        ) {

            $startTimestamp =
                crownCashTimestamp(
                    $startDate
                );


            $endTimestamp =
                crownCashTimestamp(
                    $endDate
                );


            if (
                $startTimestamp !== null &&
                $endTimestamp !== null &&
                $endTimestamp >
                $startTimestamp
            ) {

                $now =
                    time();


                if (
                    $now <=
                    $startTimestamp
                ) {

                    $progress = 0;

                } elseif (
                    $now >=
                    $endTimestamp
                ) {

                    $progress = 100;

                } else {

                    $elapsed =
                        $now -
                        $startTimestamp;


                    $totalPeriod =
                        $endTimestamp -
                        $startTimestamp;


                    $progress =
                        (
                            $elapsed /
                            $totalPeriod
                        ) *
                        100;


                    $progress =
                        max(
                            0,
                            min(
                                100,
                                $progress
                            )
                        );
                }
            }
        }


        /* ---------------------------------------------------------------
           REFERENCE
        --------------------------------------------------------------- */

        $reference =
            $investment['reference']
            ?? $investment['investment_reference']
            ?? $investment['investmentReference']
            ?? $investment['transaction_reference']
            ?? $investment['transactionReference']
            ?? '';


        /*
         * If there is no stored reference, create a
         * readable fallback from the MongoDB ID.
         */

        if (
            trim(
                (string)$reference
            ) === ''
        ) {

            $reference =
                'INV-' .
                strtoupper(
                    substr(
                        $id,
                        -12
                    )
                );
        }


        /* ---------------------------------------------------------------
           NEXT EARNING
        --------------------------------------------------------------- */

        $nextEarningDate =
            $investment['next_earning_date']
            ?? $investment['nextEarningDate']
            ?? null;


        $lastEarningDate =
            $investment['last_earning_date']
            ?? $investment['lastEarningDate']
            ?? null;


        /* ---------------------------------------------------------------
           EARNINGS COUNTERS
        --------------------------------------------------------------- */

        $earningsProcessed =
            crownCashNumber(
                $investment['earnings_processed']
                ?? 0
            );


        $totalEarningsPaid =
            crownCashNumber(
                $investment['total_earnings_paid']
                ?? 0
            );


        /* ---------------------------------------------------------------
           RESPONSE OBJECT
        --------------------------------------------------------------- */

        $investmentList[] = [

            'id' =>
                $id,

            '_id' =>
                $id,

            'reference' =>
                $reference,

            'investment_reference' =>
                $reference,

            /*
             * New system does not use fixed plans.
             */

            'plan' =>
                'custom',

            'plan_name' =>
                'Crown Cash Investment',

            'package' =>
                'Crown Cash Investment',

            'investment_type' =>
                'custom',

            'amount' =>
                $amount,

            'investment_amount' =>
                $amount,

            'principal' =>
                $principal,

            'reserved_amount' =>
                crownCashNumber(
                    $investment['reserved_amount']
                    ?? $principal
                ),

            'currency' =>
                $investment['currency']
                ?? 'UGX',

            'duration' =>
                $duration,

            'duration_days' =>
                $duration,

            'daily_rate' =>
                $dailyRate,

            'daily_return' =>
                $dailyRate * 100,

            'daily_income' =>
                $dailyIncome,

            'daily_earning' =>
                $dailyIncome,

            'total_earnings' =>
                $totalEarnings,

            'total_income' =>
                $totalEarnings,

            'maturity_amount' =>
                $maturityAmount,

            'status' =>
                $status,

            'raw_status' =>
                strtolower(
                    trim(
                        (string)$rawStatus
                    )
                ),

            'created_at' =>
                $createdAt,

            'activated_at' =>
                $activatedAt,

            'started_at' =>
                $startedAt,

            'start_date' =>
                crownCashDate(
                    $startDate
                ),

            'end_date' =>
                crownCashDate(
                    $endDate
                ),

            'completed_at' =>
                $completedAt,

            'next_earning_date' =>
                $nextEarningDate,

            'last_earning_date' =>
                $lastEarningDate,

            'earnings_processed' =>
                $earningsProcessed,

            'total_earnings_paid' =>
                $totalEarningsPaid,

            'progress' =>
                round(
                    $progress,
                    1
                )
        ];
    }


    /* =========================================================================
       SUMMARY
    ========================================================================= */

    $totalInvestments =
        count(
            $investmentList
        );


    $activeCount = 0;

    $completedCount = 0;

    $rejectedCount = 0;

    $failedCount = 0;

    $cancelledCount = 0;

    $totalInvested = 0.0;

    $totalEarnings = 0.0;


    foreach (
        $investmentList
        as $investment
    ) {

        $status =
            $investment['status']
            ?? 'active';


        $totalInvested +=
            crownCashNumber(
                $investment['amount']
                ?? 0
            );


        $totalEarnings +=
            crownCashNumber(
                $investment['total_earnings']
                ?? 0
            );


        if (
            $status === 'active'
        ) {

            $activeCount++;

        } elseif (
            $status === 'completed'
        ) {

            $completedCount++;

        } elseif (
            $status === 'rejected'
        ) {

            $rejectedCount++;

        } elseif (
            $status === 'failed'
        ) {

            $failedCount++;

        } elseif (
            $status === 'cancelled'
        ) {

            $cancelledCount++;
        }
    }


    /* =========================================================================
       RESPONSE
    ========================================================================= */

    http_response_code(200);


    echo json_encode(
        [

            'success' =>
                true,

            'message' =>
                'Investments loaded successfully.',


            /* -------------------------------------------------------------
               WALLET
            ------------------------------------------------------------- */

            'balance' =>
                $balance,

            'available_balance' =>
                $balance,

            'wallet_balance' =>
                $balance,

            'walletBalance' =>
                $balance,


            /* -------------------------------------------------------------
               COUNTS
            ------------------------------------------------------------- */

            'total_investments' =>
                $totalInvestments,

            'totalInvestments' =>
                $totalInvestments,

            'active_investments' =>
                $activeCount,

            'activeInvestments' =>
                $activeCount,

            'completed_investments' =>
                $completedCount,

            'completedInvestments' =>
                $completedCount,

            /*
             * Kept only as a compatibility field.
             *
             * New investments are not created as pending.
             */

            'pending_investments' =>
                0,

            'pendingInvestments' =>
                0,


            'rejected_investments' =>
                $rejectedCount,

            'failed_investments' =>
                $failedCount,

            'cancelled_investments' =>
                $cancelledCount,


            /* -------------------------------------------------------------
               TOTALS
            ------------------------------------------------------------- */

            'total_invested' =>
                $totalInvested,

            'totalInvested' =>
                $totalInvested,

            'total_earnings' =>
                $totalEarnings,

            'totalEarnings' =>
                $totalEarnings,


            /* -------------------------------------------------------------
               COUNTS OBJECT
            ------------------------------------------------------------- */

            'counts' => [

                'total' =>
                    $totalInvestments,

                'active' =>
                    $activeCount,

                'completed' =>
                    $completedCount,

                'pending' =>
                    0,

                'rejected' =>
                    $rejectedCount,

                'failed' =>
                    $failedCount,

                'cancelled' =>
                    $cancelledCount
            ],


            /* -------------------------------------------------------------
               INVESTMENTS
            ------------------------------------------------------------- */

            'investments' =>
                $investmentList,


            /* -------------------------------------------------------------
               DATA COMPATIBILITY
            ------------------------------------------------------------- */

            'data' => [

                'balance' =>
                    $balance,

                'available_balance' =>
                    $balance,

                'wallet_balance' =>
                    $balance,

                'total_investments' =>
                    $totalInvestments,

                'active' =>
                    $activeCount,

                'completed' =>
                    $completedCount,

                'pending' =>
                    0,

                'total_invested' =>
                    $totalInvested,

                'total_earnings' =>
                    $totalEarnings,

                'investments' =>
                    $investmentList
            ]

        ],
        JSON_UNESCAPED_SLASHES
    );


    exit;


} catch (Throwable $e) {

    error_log(
        'Crown Cash my-investments error: ' .
        $e->getMessage()
    );


    http_response_code(500);


    echo json_encode([
        'success' => false,
        'message' =>
            'Unable to load your investments.'
    ]);


    exit;
}
?>