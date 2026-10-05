<?php

declare(strict_types=1);

/*
|--------------------------------------------------------------------------
| CROWN CASH - MY INVESTMENTS
|--------------------------------------------------------------------------
| READ-ONLY investment history endpoint.
|
| IMPORTANT:
| - This file NEVER deducts wallet money.
| - This file NEVER credits earnings.
| - This file NEVER approves/rejects investments.
| - Approval is handled by the admin investment endpoint.
| - Earnings are handled by the earnings engine.
|--------------------------------------------------------------------------
*/

ob_start();

/* =========================================================================
   LOAD CONFIG
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

$requestOrigin = $_SERVER['HTTP_ORIGIN'] ?? '';

$allowedOrigins = [
    'https://crown-cash.vercel.app',
    'https://www.crown-cash.vercel.app'
];

if (in_array($requestOrigin, $allowedOrigins, true)) {

    header(
        'Access-Control-Allow-Origin: ' .
        $requestOrigin
    );

} elseif ($requestOrigin === '') {

    header(
        'Access-Control-Allow-Origin: https://crown-cash.vercel.app'
    );
}

header('Access-Control-Allow-Credentials: true');

header(
    'Access-Control-Allow-Headers: ' .
    'Content-Type, Accept, Authorization, X-Requested-With'
);

header(
    'Access-Control-Allow-Methods: GET, OPTIONS'
);

header('Access-Control-Max-Age: 86400');

header('Vary: Origin');

header(
    'Content-Type: application/json; charset=UTF-8'
);

/* =========================================================================
   OPTIONS
========================================================================= */

if (
    ($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS'
) {

    http_response_code(204);
    exit;
}

/* =========================================================================
   ONLY GET
========================================================================= */

if (
    ($_SERVER['REQUEST_METHOD'] ?? '') !== 'GET'
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

    if (function_exists('startSecureSession')) {

        startSecureSession();

    } else {

        if (session_status() !== PHP_SESSION_ACTIVE) {

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
        'message' => 'Please log in before viewing your investments.'
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

$sessionEmail = trim((string)$sessionEmail);

if (
    $sessionUserId === null &&
    $sessionEmail === ''
) {

    http_response_code(401);

    echo json_encode([
        'success' => false,
        'message' => 'Your login session does not contain a valid user account.'
    ]);

    exit;
}

/* =========================================================================
   OBJECT ID
========================================================================= */

function crownInvestmentObjectId($value): ?MongoDB\BSON\ObjectId
{
    if (
        $value instanceof MongoDB\BSON\ObjectId
    ) {
        return $value;
    }

    $value = trim((string)$value);

    if ($value === '') {
        return null;
    }

    try {

        return new MongoDB\BSON\ObjectId($value);

    } catch (Throwable $e) {

        return null;
    }
}

/* =========================================================================
   NUMBER
========================================================================= */

function crownInvestmentNumber($value): float
{
    if ($value === null) {
        return 0.0;
    }

    if (
        $value instanceof MongoDB\BSON\Decimal128
    ) {
        return (float)$value->toString();
    }

    if (
        $value instanceof MongoDB\BSON\Int64
    ) {
        return (float)$value->__toString();
    }

    if (
        $value instanceof MongoDB\BSON\Double
    ) {
        return (float)$value->__toString();
    }

    if (is_numeric($value)) {
        return (float)$value;
    }

    return 0.0;
}

/* =========================================================================
   BSON NORMALIZER
========================================================================= */

function crownInvestmentNormalize($value)
{
    if (
        $value instanceof MongoDB\Model\BSONDocument
    ) {

        $result = [];

        foreach ($value as $key => $item) {
            $result[$key] =
                crownInvestmentNormalize($item);
        }

        return $result;
    }

    if (
        $value instanceof MongoDB\Model\BSONArray
    ) {

        $result = [];

        foreach ($value as $item) {
            $result[] =
                crownInvestmentNormalize($item);
        }

        return $result;
    }

    if (
        $value instanceof MongoDB\BSON\ObjectId
    ) {
        return (string)$value;
    }

    if (
        $value instanceof MongoDB\BSON\UTCDateTime
    ) {

        try {

            return $value
                ->toDateTime()
                ->format('Y-m-d H:i:s');

        } catch (Throwable $e) {

            return null;
        }
    }

    if (
        $value instanceof MongoDB\BSON\Decimal128
    ) {
        return (float)$value->toString();
    }

    if (
        $value instanceof MongoDB\BSON\Int64
    ) {
        return (int)$value->__toString();
    }

    if (
        $value instanceof MongoDB\BSON\Double
    ) {
        return (float)$value->__toString();
    }

    if (is_array($value)) {

        $result = [];

        foreach ($value as $key => $item) {
            $result[$key] =
                crownInvestmentNormalize($item);
        }

        return $result;
    }

    return $value;
}

/* =========================================================================
   USER FILTER
========================================================================= */

function crownInvestmentUserFilter(
    $userId,
    string $email
): array {

    $or = [];

    $objectId =
        crownInvestmentObjectId($userId);

    if ($objectId !== null) {

        $or[] = [
            '_id' => $objectId
        ];

        $or[] = [
            'user_id' => $objectId
        ];

        $or[] = [
            'userId' => $objectId
        ];
    }

    $idString =
        trim((string)$userId);

    if ($idString !== '') {

        $or[] = [
            '_id' => $idString
        ];

        $or[] = [
            'id' => $idString
        ];

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

    if ($email !== '') {

        $or[] = [
            'email' => $email
        ];

        $or[] = [
            'user_email' => $email
        ];
    }

    if (count($or) === 0) {

        return [
            '_id' => null
        ];
    }

    return [
        '$or' => $or
    ];
}

/* =========================================================================
   INVESTMENT USER FILTER
========================================================================= */

function crownInvestmentInvestmentFilter(
    $userId,
    string $email
): array {

    $or = [];

    $objectId =
        crownInvestmentObjectId($userId);

    if ($objectId !== null) {

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
        trim((string)$userId);

    if ($idString !== '') {

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

    if ($email !== '') {

        $or[] = [
            'user_email' => $email
        ];

        $or[] = [
            'email' => $email
        ];
    }

    if (count($or) === 0) {

        return [
            '_id' => null
        ];
    }

    return [
        '$or' => $or
    ];
}

/* =========================================================================
   NORMALIZE STATUS
========================================================================= */

function crownInvestmentStatus($value): string
{
    $status =
        strtolower(
            trim(
                (string)$value
            )
        );

    if ($status === '') {
        return 'pending';
    }

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

    return $status;
}

/* =========================================================================
   DATE TO TIMESTAMP
========================================================================= */

function crownInvestmentTimestamp($value): ?int
{
    if (!$value) {
        return null;
    }

    if (
        is_array($value)
    ) {

        if (
            isset($value['$date'])
        ) {
            $value =
                $value['$date'];
        } elseif (
            isset($value['date'])
        ) {
            $value =
                $value['date'];
        }
    }

    $timestamp =
        strtotime((string)$value);

    if ($timestamp === false) {
        return null;
    }

    return $timestamp;
}

/* =========================================================================
   MAIN
========================================================================= */

try {

    if (
        !isset($users) ||
        !isset($investments)
    ) {

        http_response_code(500);

        echo json_encode([
            'success' => false,
            'message' => 'Investment database collections are not configured.'
        ]);

        exit;
    }

    /* ---------------------------------------------------------------------
       FIND USER
    --------------------------------------------------------------------- */

    $userFilter =
        crownInvestmentUserFilter(
            $sessionUserId,
            $sessionEmail
        );

    $userDocument =
        $users->findOne(
            $userFilter
        );

    if ($userDocument === null) {

        http_response_code(404);

        echo json_encode([
            'success' => false,
            'message' => 'Your Crown Cash account could not be found.'
        ]);

        exit;
    }

    $user =
        crownInvestmentNormalize(
            $userDocument
        );

    if (!is_array($user)) {
        $user = [];
    }

    /* ---------------------------------------------------------------------
       BALANCE
    --------------------------------------------------------------------- */

    $balance = 0.0;

    if (isset($user['balance'])) {

        $balance =
            crownInvestmentNumber(
                $user['balance']
            );

    } elseif (
        isset($user['wallet_balance'])
    ) {

        $balance =
            crownInvestmentNumber(
                $user['wallet_balance']
            );

    } elseif (
        isset($user['walletBalance'])
    ) {

        $balance =
            crownInvestmentNumber(
                $user['walletBalance']
            );

    } elseif (
        isset($user['wallet']) &&
        is_array($user['wallet']) &&
        isset($user['wallet']['balance'])
    ) {

        $balance =
            crownInvestmentNumber(
                $user['wallet']['balance']
            );
    }

    /* ---------------------------------------------------------------------
       FETCH INVESTMENTS
    --------------------------------------------------------------------- */

    $investmentFilter =
        crownInvestmentInvestmentFilter(
            $sessionUserId,
            $sessionEmail
        );

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

    foreach ($cursor as $document) {

        $normalized =
            crownInvestmentNormalize(
                $document
            );

        if (is_array($normalized)) {
            $investmentDocuments[] =
                $normalized;
        }
    }

    /* ---------------------------------------------------------------------
       BUILD NORMALIZED LIST
    --------------------------------------------------------------------- */

    $investmentList = [];

    foreach (
        $investmentDocuments
        as $investment
    ) {

        $id =
            $investment['_id']
            ?? $investment['id']
            ?? '';

        $id =
            (string)$id;

        $plan =
            $investment['plan']
            ?? $investment['plan_name']
            ?? $investment['package']
            ?? 'Investment Plan';

        $planName =
            $investment['plan_name']
            ?? $investment['package']
            ?? $plan;

        $amount =
            crownInvestmentNumber(
                $investment['amount']
                ?? $investment['principal']
                ?? $investment['reserved_amount']
                ?? 0
            );

        $principal =
            crownInvestmentNumber(
                $investment['principal']
                ?? $amount
            );

        $dailyRate =
            crownInvestmentNumber(
                $investment['daily_rate']
                ?? 0
            );

        /*
         * Older records may store 10 rather than 0.10.
         */
        if ($dailyRate > 1) {
            $dailyRate /= 100;
        }

        $dailyIncome =
            crownInvestmentNumber(
                $investment['daily_income']
                ?? ($amount * $dailyRate)
            );

        $duration =
            (int)(
                $investment['duration_days']
                ?? $investment['duration']
                ?? 30
            );

        if ($duration <= 0) {
            $duration = 30;
        }

        $totalIncome =
            crownInvestmentNumber(
                $investment['total_income']
                ?? ($dailyIncome * $duration)
            );

        $maturityAmount =
            crownInvestmentNumber(
                $investment['maturity_amount']
                ?? ($principal + $totalIncome)
            );

        /* -----------------------------------------------------------------
           STATUS
        ----------------------------------------------------------------- */

        $rawStatus =
            $investment['status']
            ?? 'pending';

        $status =
            crownInvestmentStatus(
                $rawStatus
            );

        /* -----------------------------------------------------------------
           DATES
        ----------------------------------------------------------------- */

        $createdAt =
            $investment['created_at']
            ?? $investment['createdAt']
            ?? null;

        $approvedAt =
            $investment['approved_at']
            ?? $investment['approvedAt']
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
         * For an approved/active investment, activation should be preferred.
         */
        $startDate =
            $activatedAt
            ?? $startedAt
            ?? $approvedAt
            ?? null;

        $endDate =
            $investment['end_date']
            ?? $investment['endDate']
            ?? $investment['matures_at']
            ?? $completedAt
            ?? null;

        /*
         * If active and no explicit end date exists,
         * calculate a display-only maturity date.
         */
        if (
            $endDate === null &&
            $startDate !== null &&
            in_array(
                $status,
                ['active'],
                true
            )
        ) {

            $startTimestamp =
                crownInvestmentTimestamp(
                    $startDate
                );

            if ($startTimestamp !== null) {

                $endTimestamp =
                    $startTimestamp +
                    ($duration * 86400);

                $endDate =
                    date(
                        'Y-m-d H:i:s',
                        $endTimestamp
                    );
            }
        }

        /* -----------------------------------------------------------------
           PROGRESS
        ----------------------------------------------------------------- */

        $progress = 0;

        if ($status === 'completed') {

            $progress = 100;

        } elseif ($status === 'active') {

            $startTimestamp =
                crownInvestmentTimestamp(
                    $startDate
                );

            $endTimestamp =
                crownInvestmentTimestamp(
                    $endDate
                );

            if (
                $startTimestamp !== null &&
                $endTimestamp !== null &&
                $endTimestamp > $startTimestamp
            ) {

                $now =
                    time();

                if ($now <= $startTimestamp) {

                    $progress = 0;

                } elseif ($now >= $endTimestamp) {

                    $progress = 100;

                } else {

                    $elapsed =
                        $now -
                        $startTimestamp;

                    $total =
                        $endTimestamp -
                        $startTimestamp;

                    $progress =
                        ($elapsed / $total) *
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

        /* -----------------------------------------------------------------
           REFERENCE
        ----------------------------------------------------------------- */

        $reference =
            $investment['reference']
            ?? $investment['investment_reference']
            ?? $investment['transaction_reference']
            ?? '';

        /* -----------------------------------------------------------------
           EARNINGS TRACKING
        ----------------------------------------------------------------- */

        $earningsProcessed =
            crownInvestmentNumber(
                $investment['earnings_processed']
                ?? 0
            );

        $totalEarningsPaid =
            crownInvestmentNumber(
                $investment['total_earnings_paid']
                ?? 0
            );

        $lastEarningDate =
            $investment['last_earning_date']
            ?? null;

        /* -----------------------------------------------------------------
           NORMALIZED RESPONSE
        ----------------------------------------------------------------- */

        $investmentList[] = [

            'id' =>
                $id,

            '_id' =>
                $id,

            'reference' =>
                $reference,

            'investment_reference' =>
                $reference,

            'plan' =>
                $plan,

            'plan_name' =>
                $planName,

            'package' =>
                $planName,

            'amount' =>
                $amount,

            'principal' =>
                $principal,

            'reserved_amount' =>
                crownInvestmentNumber(
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

            'total_income' =>
                $totalIncome,

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

            'balance_reserved' =>
                !empty(
                    $investment['balance_reserved']
                ),

            'balance_deducted' =>
                !empty(
                    $investment['balance_deducted']
                ),

            'admin_approved' =>
                !empty(
                    $investment['admin_approved']
                ),

            'principal_returned' =>
                !empty(
                    $investment['principal_returned']
                ),

            'earnings_processed' =>
                $earningsProcessed,

            'total_earnings_paid' =>
                $totalEarningsPaid,

            'last_earning_date' =>
                $lastEarningDate,

            'created_at' =>
                $createdAt,

            'approved_at' =>
                $approvedAt,

            'activated_at' =>
                $activatedAt,

            'started_at' =>
                $startedAt,

            'end_date' =>
                $endDate,

            'completed_at' =>
                $completedAt,

            'progress' =>
                round(
                    $progress,
                    1
                )
        ];
    }

    /* ---------------------------------------------------------------------
       STATISTICS
    --------------------------------------------------------------------- */

    $totalInvestments =
        count($investmentList);

    $activeCount = 0;
    $pendingCount = 0;
    $completedCount = 0;
    $rejectedCount = 0;
    $totalInvested = 0.0;

    foreach (
        $investmentList
        as $investment
    ) {

        $status =
            $investment['status']
            ?? 'pending';

        $totalInvested +=
            crownInvestmentNumber(
                $investment['amount']
                ?? 0
            );

        if ($status === 'active') {

            $activeCount++;

        } elseif ($status === 'pending') {

            $pendingCount++;

        } elseif ($status === 'completed') {

            $completedCount++;

        } elseif ($status === 'rejected') {

            $rejectedCount++;
        }
    }

    /* ---------------------------------------------------------------------
       RESPONSE
    --------------------------------------------------------------------- */

    http_response_code(200);

    echo json_encode(
        [
            'success' =>
                true,

            'message' =>
                'Investments loaded successfully.',

            'balance' =>
                $balance,

            'available_balance' =>
                $balance,

            'wallet_balance' =>
                $balance,

            'total_investments' =>
                $totalInvestments,

            'active_count' =>
                $activeCount,

            'active_investments' =>
                $activeCount,

            'pending_count' =>
                $pendingCount,

            'pending_investments' =>
                $pendingCount,

            'completed_count' =>
                $completedCount,

            'completed_investments' =>
                $completedCount,

            'rejected_count' =>
                $rejectedCount,

            'total_invested' =>
                $totalInvested,

            'counts' => [

                'total' =>
                    $totalInvestments,

                'active' =>
                    $activeCount,

                'pending' =>
                    $pendingCount,

                'completed' =>
                    $completedCount,

                'rejected' =>
                    $rejectedCount
            ],

            'investments' =>
                $investmentList,

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

                'pending' =>
                    $pendingCount,

                'completed' =>
                    $completedCount,

                'rejected' =>
                    $rejectedCount,

                'total_invested' =>
                    $totalInvested,

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
        'message' => 'Unable to load your investments.'
    ]);

    exit;
}
?>