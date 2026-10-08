<?php

declare(strict_types=1);

/*
|--------------------------------------------------------------------------
| CROWN CASH - DAILY EARNINGS PROCESSOR
|--------------------------------------------------------------------------
|
| Purpose:
|   Processes eligible investment earnings automatically.
|
| Intended scheduler:
|   GitHub Actions
|
| Flow:
|
|   GitHub Actions
|        |
|        | POST + X-Cron-Token
|        v
|   daily_earnings.php
|        |
|        v
|   MongoDB
|        |
|        +--> credit wallet
|        +--> create earnings ledger
|        +--> create transaction
|        +--> update investment
|
|--------------------------------------------------------------------------
| IMPORTANT
|--------------------------------------------------------------------------
|
| This script:
|
| - Does NOT require an admin approval.
| - Does NOT return investment principal.
| - Pays earnings only after complete 24-hour periods.
| - Prevents the same investment/day from being paid twice.
| - Uses MongoDB transactions where supported.
| - Uses a deterministic earnings ledger key.
| - Requires a cron secret when called through HTTP.
|
|--------------------------------------------------------------------------
*/

require_once __DIR__ . '/config.php';

use MongoDB\BSON\ObjectId;
use MongoDB\BSON\UTCDateTime;
use MongoDB\Driver\Exception\BulkWriteException;
use MongoDB\Driver\Exception\Exception as MongoDriverException;

/*
|--------------------------------------------------------------------------
| Configuration
|--------------------------------------------------------------------------
*/

const CROWN_CASH_MIN_INVESTMENT = 10000.00;
const CROWN_CASH_DEFAULT_DAILY_RATE = 0.10;
const CROWN_CASH_DEFAULT_DURATION = 30;
const CROWN_CASH_MAX_INVESTMENTS_PER_RUN = 5000;

/*
|--------------------------------------------------------------------------
| CORS
|--------------------------------------------------------------------------
*/

$allowedOrigins = [
    'https://crown-cash.vercel.app',
    'https://www.crown-cash.vercel.app',
    'http://localhost:3000',
    'http://localhost:5173',
];

$origin = $_SERVER['HTTP_ORIGIN'] ?? '';

if ($origin !== '' && in_array($origin, $allowedOrigins, true)) {
    header('Access-Control-Allow-Origin: ' . $origin);
}

header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Cron-Token');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Content-Type: application/json; charset=utf-8');

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'OPTIONS') {
    http_response_code(204);
    exit;
}

/*
|--------------------------------------------------------------------------
| Response helper
|--------------------------------------------------------------------------
*/

function ccEarningsResponse(
    bool $success,
    string $message,
    array $data = [],
    int $statusCode = 200
): never {
    http_response_code($statusCode);

    echo json_encode(
        [
            'success' => $success,
            'message' => $message,
            'data' => $data,
        ],
        JSON_UNESCAPED_SLASHES
        | JSON_UNESCAPED_UNICODE
        | JSON_PRESERVE_ZERO_FRACTION
    );

    exit;
}

/*
|--------------------------------------------------------------------------
| Basic helpers
|--------------------------------------------------------------------------
*/

function ccString(mixed $value, string $default = ''): string
{
    if ($value === null) {
        return $default;
    }

    if (is_string($value)) {
        return trim($value);
    }

    if (is_scalar($value)) {
        return trim((string) $value);
    }

    return $default;
}

function ccMoney(mixed $value, float $default = 0.0): float
{
    if ($value === null || $value === '') {
        return $default;
    }

    if (!is_numeric($value)) {
        return $default;
    }

    $number = (float) $value;

    if (!is_finite($number)) {
        return $default;
    }

    return round($number, 2);
}

function ccBool(mixed $value, bool $default = false): bool
{
    if (is_bool($value)) {
        return $value;
    }

    if ($value === null) {
        return $default;
    }

    if (is_string($value)) {
        $value = strtolower(trim($value));

        if (in_array($value, ['true', '1', 'yes', 'on'], true)) {
            return true;
        }

        if (in_array($value, ['false', '0', 'no', 'off'], true)) {
            return false;
        }
    }

    if (is_numeric($value)) {
        return ((int) $value) === 1;
    }

    return $default;
}

function ccObjectId(mixed $value): ?ObjectId
{
    if ($value instanceof ObjectId) {
        return $value;
    }

    $value = ccString($value);

    if ($value === '' || !preg_match('/^[a-f0-9]{24}$/i', $value)) {
        return null;
    }

    try {
        return new ObjectId($value);
    } catch (Throwable) {
        return null;
    }
}

function ccNow(): DateTimeImmutable
{
    return new DateTimeImmutable('now', new DateTimeZone('UTC'));
}

function ccUtcNow(): UTCDateTime
{
    return new UTCDateTime(
        (int) round(microtime(true) * 1000)
    );
}

function ccCollection(string $name): object
{
    global $db;

    $globalName = $name;

    if (isset($GLOBALS[$globalName]) && is_object($GLOBALS[$globalName])) {
        return $GLOBALS[$globalName];
    }

    if (!isset($db)) {
        throw new RuntimeException('MongoDB database connection is not available.');
    }

    return $db->selectCollection($name);
}

/*
|--------------------------------------------------------------------------
| Investment helpers
|--------------------------------------------------------------------------
*/

function ccInvestmentId(array|object $investment): ?ObjectId
{
    $value = is_array($investment)
        ? ($investment['_id'] ?? null)
        : ($investment->_id ?? null);

    return ccObjectId($value);
}

function ccInvestmentUserId(array|object $investment): mixed
{
    $fields = [
        'user_id',
        'userId',
        'userid',
        'owner_id',
        'ownerId',
        'account_id',
        'accountId',
    ];

    foreach ($fields as $field) {
        $value = is_array($investment)
            ? ($investment[$field] ?? null)
            : ($investment->$field ?? null);

        if ($value !== null && $value !== '') {
            return $value;
        }
    }

    return null;
}

function ccInvestmentAmount(array|object $investment): float
{
    $fields = [
        'amount',
        'investment_amount',
        'investmentAmount',
        'principal',
        'capital',
    ];

    foreach ($fields as $field) {
        $value = is_array($investment)
            ? ($investment[$field] ?? null)
            : ($investment->$field ?? null);

        if ($value !== null && $value !== '') {
            return ccMoney($value);
        }
    }

    return 0.0;
}

function ccInvestmentDailyEarning(array|object $investment): float
{
    $fields = [
        'daily_income',
        'daily_earning',
        'dailyEarning',
        'daily_return',
        'dailyReturn',
    ];

    foreach ($fields as $field) {
        $value = is_array($investment)
            ? ($investment[$field] ?? null)
            : ($investment->$field ?? null);

        if ($value !== null && $value !== '') {
            $amount = ccMoney($value);

            if ($amount > 0) {
                return $amount;
            }
        }
    }

    $amount = ccInvestmentAmount($investment);

    $rate = ccInvestmentDailyRate($investment);

    return round($amount * $rate, 2);
}

function ccInvestmentDailyRate(array|object $investment): float
{
    $fields = [
        'daily_rate',
        'dailyRate',
        'return_rate',
        'returnRate',
        'percentage',
        'rate',
    ];

    foreach ($fields as $field) {
        $value = is_array($investment)
            ? ($investment[$field] ?? null)
            : ($investment->$field ?? null);

        if ($value !== null && $value !== '') {
            $rate = (float) $value;

            /*
             * Support both:
             * 0.10 = 10%
             * 10   = 10%
             */
            if ($rate > 1) {
                $rate = $rate / 100;
            }

            if ($rate > 0) {
                return $rate;
            }
        }
    }

    return CROWN_CASH_DEFAULT_DAILY_RATE;
}

function ccInvestmentDuration(array|object $investment): int
{
    $fields = [
        'duration_days',
        'durationDays',
        'duration',
        'term_days',
        'termDays',
    ];

    foreach ($fields as $field) {
        $value = is_array($investment)
            ? ($investment[$field] ?? null)
            : ($investment->$field ?? null);

        if ($value !== null && $value !== '') {
            $days = (int) $value;

            if ($days > 0) {
                return $days;
            }
        }
    }

    return CROWN_CASH_DEFAULT_DURATION;
}

function ccInvestmentStatus(array|object $investment): string
{
    $fields = [
        'status',
        'investment_status',
        'investmentStatus',
    ];

    foreach ($fields as $field) {
        $value = is_array($investment)
            ? ($investment[$field] ?? null)
            : ($investment->$field ?? null);

        $status = strtolower(ccString($value));

        if ($status !== '') {
            return $status;
        }
    }

    return '';
}

function ccIsActiveInvestment(array|object $investment): bool
{
    return in_array(
        ccInvestmentStatus($investment),
        [
            'active',
            'running',
            'in_progress',
            'in-progress',
        ],
        true
    );
}

function ccInvestmentBalanceDeducted(array|object $investment): bool
{
    $fields = [
        'balance_deducted',
        'balanceDeducted',
    ];

    foreach ($fields as $field) {
        $value = is_array($investment)
            ? ($investment[$field] ?? null)
            : ($investment->$field ?? null);

        if ($value !== null) {
            return ccBool($value);
        }
    }

    /*
     * New Crown Cash investments should always contain
     * balance_deducted=true.
     *
     * For older active investments where this field does
     * not exist, retain compatibility by treating them as
     * deducted.
     */
    return ccIsActiveInvestment($investment);
}

function ccPrincipalReturned(array|object $investment): bool
{
    $fields = [
        'principal_returned',
        'principalReturned',
        'balance_returned',
        'balanceReturned',
    ];

    foreach ($fields as $field) {
        $value = is_array($investment)
            ? ($investment[$field] ?? null)
            : ($investment->$field ?? null);

        if ($value !== null && ccBool($value)) {
            return true;
        }
    }

    return false;
}

function ccInvestmentStartDate(array|object $investment): ?DateTimeImmutable
{
    $fields = [
        'started_at',
        'startedAt',
        'activated_at',
        'activatedAt',
        'activation_date',
        'activationDate',
        'start_date',
        'startDate',
        'created_at',
        'createdAt',
    ];

    foreach ($fields as $field) {
        $value = is_array($investment)
            ? ($investment[$field] ?? null)
            : ($investment->$field ?? null);

        if ($value === null || $value === '') {
            continue;
        }

        try {
            if ($value instanceof UTCDateTime) {
                return $value->toDateTime()
                    ->setTimezone(new DateTimeZone('UTC'));
            }

            if ($value instanceof DateTimeInterface) {
                return new DateTimeImmutable(
                    $value->format('Y-m-d H:i:s.uP')
                );
            }

            if (is_numeric($value)) {
                $seconds = ((int) $value) > 100000000000
                    ? ((int) $value / 1000)
                    : (int) $value;

                return (new DateTimeImmutable('@' . $seconds))
                    ->setTimezone(new DateTimeZone('UTC'));
            }

            return new DateTimeImmutable(
                (string) $value,
                new DateTimeZone('UTC')
            );
        } catch (Throwable) {
            continue;
        }
    }

    return null;
}

function ccElapsedFullDays(DateTimeImmutable $start): int
{
    $now = ccNow();

    $seconds = $now->getTimestamp() - $start->getTimestamp();

    if ($seconds < 86400) {
        return 0;
    }

    return (int) floor($seconds / 86400);
}

function ccInvestmentEarningDays(array|object $investment): int
{
    $fields = [
        'earning_days',
        'earningDays',
        'earnings_processed',
        'earningsProcessed',
    ];

    foreach ($fields as $field) {
        $value = is_array($investment)
            ? ($investment[$field] ?? null)
            : ($investment->$field ?? null);

        if ($value !== null && $value !== '') {
            return max(0, (int) $value);
        }
    }

    return 0;
}

/*
|--------------------------------------------------------------------------
| User helpers
|--------------------------------------------------------------------------
*/

function ccFindUser(object $users, mixed $userId): ?object
{
    $objectId = ccObjectId($userId);

    $filters = [];

    if ($objectId !== null) {
        $filters[] = ['_id' => $objectId];
        $filters[] = ['user_id' => $objectId];
        $filters[] = ['userId' => $objectId];
    }

    $stringId = ccString($userId);

    if ($stringId !== '') {
        $filters[] = ['id' => $stringId];
        $filters[] = ['user_id' => $stringId];
        $filters[] = ['userId' => $stringId];
    }

    if ($filters === []) {
        return null;
    }

    return $users->findOne(
        count($filters) === 1
            ? $filters[0]
            : ['$or' => $filters]
    );
}

function ccUserId(object|array $user): mixed
{
    if (is_array($user)) {
        if (isset($user['_id'])) {
            return $user['_id'];
        }

        if (isset($user['id'])) {
            return $user['id'];
        }

        if (isset($user['user_id'])) {
            return $user['user_id'];
        }

        if (isset($user['userId'])) {
            return $user['userId'];
        }

        return null;
    }

    if (isset($user->_id)) {
        return $user->_id;
    }

    if (isset($user->id)) {
        return $user->id;
    }

    if (isset($user->user_id)) {
        return $user->user_id;
    }

    if (isset($user->userId)) {
        return $user->userId;
    }

    return null;
}

function ccUserWalletFilter(object|array $user): array
{
    $userId = ccUserId($user);

    if ($userId instanceof ObjectId) {
        return ['_id' => $userId];
    }

    if ($userId !== null && $userId !== '') {
        return [
            '$or' => [
                ['id' => $userId],
                ['user_id' => $userId],
                ['userId' => $userId],
            ],
        ];
    }

    throw new RuntimeException('Unable to determine user identifier.');
}

/*
|--------------------------------------------------------------------------
| Wallet helpers
|--------------------------------------------------------------------------
*/

function ccWalletBalance(object|array $user): float
{
    /*
     * IMPORTANT:
     *
     * "balance" is the authoritative Crown Cash wallet field.
     *
     * Older wallet fields are synchronized from it when they
     * exist. We do NOT use max(balance, wallet_balance, ...),
     * because doing that can accidentally create money when
     * legacy fields are out of sync.
     */

    if (is_array($user)) {
        if (isset($user['balance']) && is_numeric($user['balance'])) {
            return ccMoney($user['balance']);
        }

        if (isset($user['wallet_balance']) && is_numeric($user['wallet_balance'])) {
            return ccMoney($user['wallet_balance']);
        }

        if (isset($user['walletBalance']) && is_numeric($user['walletBalance'])) {
            return ccMoney($user['walletBalance']);
        }

        if (
            isset($user['wallet'])
            && is_array($user['wallet'])
            && isset($user['wallet']['balance'])
            && is_numeric($user['wallet']['balance'])
        ) {
            return ccMoney($user['wallet']['balance']);
        }

        return 0.0;
    }

    if (isset($user->balance) && is_numeric($user->balance)) {
        return ccMoney($user->balance);
    }

    if (isset($user->wallet_balance) && is_numeric($user->wallet_balance)) {
        return ccMoney($user->wallet_balance);
    }

    if (isset($user->walletBalance) && is_numeric($user->walletBalance)) {
        return ccMoney($user->walletBalance);
    }

    if (
        isset($user->wallet)
        && is_object($user->wallet)
        && isset($user->wallet->balance)
        && is_numeric($user->wallet->balance)
    ) {
        return ccMoney($user->wallet->balance);
    }

    return 0.0;
}

function ccCreditWallet(
    object $users,
    object|array $user,
    float $amount,
    ?object $session = null
): array {
    if ($amount <= 0) {
        throw new RuntimeException('Wallet credit amount must be greater than zero.');
    }

    $freshUser = ccFindUser(
        $users,
        ccUserId($user)
    );

    if ($freshUser === null) {
        throw new RuntimeException('User account could not be found.');
    }

    $before = ccWalletBalance($freshUser);
    $after = round($before + $amount, 2);

    $set = [
        'balance' => $after,
        'updated_at' => ccUtcNow(),
    ];

    /*
     * Synchronize legacy fields only when they already exist.
     */
    if (
        isset($freshUser->wallet_balance)
        || isset($freshUser->walletBalance)
    ) {
        $set['wallet_balance'] = $after;
        $set['walletBalance'] = $after;
    }

    if (
        isset($freshUser->wallet)
        && is_object($freshUser->wallet)
        && isset($freshUser->wallet->balance)
    ) {
        $set['wallet.balance'] = $after;
    }

    $options = [];

    if ($session !== null) {
        $options['session'] = $session;
    }

    $result = $users->updateOne(
        ccUserWalletFilter($freshUser),
        ['$set' => $set],
        $options
    );

    if ($result->getMatchedCount() < 1) {
        throw new RuntimeException('Wallet update failed.');
    }

    return [
        'before' => $before,
        'after' => $after,
    ];
}

/*
|--------------------------------------------------------------------------
| Earnings ledger helpers
|--------------------------------------------------------------------------
*/

function ccEnsureLedgerIndex(object $earnings): void
{
    /*
     * This index is essential for preventing the same investment/day
     * from being paid twice.
     */
    try {
        $earnings->createIndex(
            ['ledger_key' => 1],
            ['unique' => true, 'name' => 'crown_cash_earning_ledger_key_unique']
        );
    } catch (Throwable $e) {
        /*
         * If the index already exists, MongoDB may return an
         * "already exists" error. Verify that it is harmless.
         *
         * For financial processing, failure to create the index
         * should not silently disable duplicate protection.
         */
        $message = strtolower($e->getMessage());

        if (
            strpos($message, 'already exists') === false
            && strpos($message, 'index already exists') === false
        ) {
            throw new RuntimeException(
                'Unable to create the earnings ledger unique index: '
                . $e->getMessage()
            );
        }
    }
}

function ccLedgerExists(
    object $earnings,
    string $ledgerKey,
    ?object $session = null
): bool {
    $options = [
        'projection' => ['_id' => 1],
        'limit' => 1,
    ];

    if ($session !== null) {
        $options['session'] = $session;
    }

    return $earnings->findOne(
        ['ledger_key' => $ledgerKey],
        $options
    ) !== null;
}

/*
|--------------------------------------------------------------------------
| Transaction history
|--------------------------------------------------------------------------
*/

function ccCreateTransaction(
    object $transactions,
    array $transaction,
    ?object $session = null
): void {
    $options = [];

    if ($session !== null) {
        $options['session'] = $session;
    }

    $reference = ccString($transaction['reference'] ?? '');

    if ($reference === '') {
        throw new RuntimeException(
            'Transaction reference is required.'
        );
    }

    /*
     * Use upsert so a retry cannot create the same transaction
     * history entry twice.
     */
    $transactions->updateOne(
        ['reference' => $reference],
        [
            '$setOnInsert' => $transaction,
        ],
        array_merge(
            ['upsert' => true],
            $options
        )
    );
}

/*
|--------------------------------------------------------------------------
| Process one earning day
|--------------------------------------------------------------------------
*/

function ccProcessOneDay(
    object $investments,
    object $users,
    object $earnings,
    object $transactions,
    ObjectId $investmentId,
    int $dayNumber
): array {
    if ($dayNumber < 1) {
        throw new RuntimeException('Invalid earning day.');
    }

    $investment = $investments->findOne([
        '_id' => $investmentId,
    ]);

    if ($investment === null) {
        throw new RuntimeException('Investment not found.');
    }

    if (!ccIsActiveInvestment($investment)) {
        return [
            'processed' => false,
            'reason' => 'investment_not_active',
        ];
    }

    if (!ccInvestmentBalanceDeducted($investment)) {
        return [
            'processed' => false,
            'reason' => 'investment_balance_not_deducted',
        ];
    }

    if (ccPrincipalReturned($investment)) {
        return [
            'processed' => false,
            'reason' => 'principal_already_returned',
        ];
    }

    $amount = ccInvestmentAmount($investment);

    if ($amount < CROWN_CASH_MIN_INVESTMENT) {
        return [
            'processed' => false,
            'reason' => 'investment_below_minimum',
        ];
    }

    $duration = ccInvestmentDuration($investment);

    if ($dayNumber > $duration) {
        return [
            'processed' => false,
            'reason' => 'investment_duration_completed',
        ];
    }

    $dailyEarning = ccInvestmentDailyEarning($investment);

    if ($dailyEarning <= 0) {
        return [
            'processed' => false,
            'reason' => 'invalid_daily_earning',
        ];
    }

    $userId = ccInvestmentUserId($investment);

    if ($userId === null || $userId === '') {
        throw new RuntimeException(
            'Investment does not contain a valid user ID.'
        );
    }

    $user = ccFindUser($users, $userId);

    if ($user === null) {
        throw new RuntimeException(
            'Investment owner could not be found.'
        );
    }

    $ledgerKey = sprintf(
        'investment_earning:%s:%d',
        (string) $investmentId,
        $dayNumber
    );

    /*
     * Use a MongoDB transaction when available.
     */
    $client = $GLOBALS['client']
        ?? $GLOBALS['mongoClient']
        ?? null;

    if ($client === null || !method_exists($client, 'startSession')) {
        throw new RuntimeException(
            'MongoDB client with transaction support is not available.'
        );
    }

    $session = $client->startSession();

    try {
        $result = $session->withTransaction(
            function () use (
                $investments,
                $users,
                $earnings,
                $transactions,
                $investmentId,
                $dayNumber,
                $ledgerKey,
                $dailyEarning,
                $duration,
                $session
            ): array {
                /*
                 * Re-read investment inside transaction.
                 */
                $currentInvestment = $investments->findOne(
                    ['_id' => $investmentId],
                    ['session' => $session]
                );

                if ($currentInvestment === null) {
                    throw new RuntimeException(
                        'Investment disappeared during processing.'
                    );
                }

                if (!ccIsActiveInvestment($currentInvestment)) {
                    return [
                        'processed' => false,
                        'reason' => 'investment_not_active',
                    ];
                }

                if (!ccInvestmentBalanceDeducted($currentInvestment)) {
                    return [
                        'processed' => false,
                        'reason' => 'investment_balance_not_deducted',
                    ];
                }

                if (ccPrincipalReturned($currentInvestment)) {
                    return [
                        'processed' => false,
                        'reason' => 'principal_already_returned',
                    ];
                }

                /*
                 * Deterministic ledger check.
                 */
                if (
                    ccLedgerExists(
                        $earnings,
                        $ledgerKey,
                        $session
                    )
                ) {
                    return [
                        'processed' => false,
                        'reason' => 'already_paid',
                    ];
                }

                /*
                 * Re-read user inside transaction.
                 */
                $currentUser = ccFindUser(
                    $users,
                    ccInvestmentUserId($currentInvestment)
                );

                if ($currentUser === null) {
                    throw new RuntimeException(
                        'Investment owner could not be found during transaction.'
                    );
                }

                /*
                 * Credit wallet.
                 */
                $wallet = ccCreditWallet(
                    $users,
                    $currentUser,
                    $dailyEarning,
                    $session
                );

                $now = ccUtcNow();

                /*
                 * Create earnings ledger.
                 */
                try {
                    $earnings->insertOne(
                        [
                            'ledger_key' => $ledgerKey,
                            'type' => 'investment_earning',
                            'investment_id' => $investmentId,
                            'user_id' => ccInvestmentUserId($currentInvestment),
                            'day_number' => $dayNumber,
                            'amount' => $dailyEarning,
                            'status' => 'paid',
                            'created_at' => $now,
                            'updated_at' => $now,
                        ],
                        ['session' => $session]
                    );
                } catch (BulkWriteException $e) {
                    /*
                     * Duplicate ledger means another concurrent
                     * worker already processed this day.
                     */
                    $message = strtolower($e->getMessage());

                    if (
                        strpos($message, 'duplicate') !== false
                        || strpos($message, 'e11000') !== false
                    ) {
                        return [
                            'processed' => false,
                            'reason' => 'already_paid',
                        ];
                    }

                    throw $e;
                }

                /*
                 * Existing total earnings.
                 */
                $previousTotal = ccMoney(
                    $currentInvestment->total_earnings
                    ?? $currentInvestment->totalEarnings
                    ?? $currentInvestment->total_earnings_paid
                    ?? 0
                );

                $previousProcessed = ccInvestmentEarningDays(
                    $currentInvestment
                );

                $newTotal = round(
                    $previousTotal + $dailyEarning,
                    2
                );

                $newProcessed = max(
                    $previousProcessed,
                    $dayNumber
                );

                /*
                 * Investment update.
                 */
                $investmentUpdate = [
                    'earnings_processed' => $newProcessed,
                    'earning_days' => $newProcessed,
                    'total_earnings' => $newTotal,
                    'total_earnings_paid' => $newTotal,
                    'daily_income' => $dailyEarning,
                    'updated_at' => $now,
                    'last_earning_date' => $now,
                ];

                if ($newProcessed >= $duration) {
                    $investmentUpdate['status'] = 'completed';
                    $investmentUpdate['completed_at'] = $now;
                    $investmentUpdate['next_earning_date'] = null;
                } else {
                    /*
                     * Next earning is based on the investment start
                     * date plus the next full 24-hour period.
                     */
                    $startDate = ccInvestmentStartDate(
                        $currentInvestment
                    );

                    if ($startDate !== null) {
                        $nextDay = $newProcessed + 1;

                        $nextDate = $startDate->modify(
                            '+' . $nextDay . ' days'
                        );

                        $investmentUpdate['next_earning_date'] =
                            new UTCDateTime(
                                $nextDate->getTimestamp() * 1000
                            );
                    }
                }

                $investments->updateOne(
                    ['_id' => $investmentId],
                    ['$set' => $investmentUpdate],
                    ['session' => $session]
                );

                /*
                 * Transaction history.
                 */
                $reference = 'EARN-' . strtoupper(
                    substr(
                        hash(
                            'sha256',
                            $ledgerKey
                        ),
                        0,
                        24
                    )
                );

                ccCreateTransaction(
                    $transactions,
                    [
                        'user_id' => ccInvestmentUserId(
                            $currentInvestment
                        ),
                        'type' => 'investment_earning',
                        'category' => 'investment',
                        'amount' => $dailyEarning,
                        'direction' => 'credit',
                        'reference' => $reference,
                        'description' =>
                            'Investment daily earning - Day '
                            . $dayNumber,
                        'investment_id' => $investmentId,
                        'day_number' => $dayNumber,
                        'balance_before' => $wallet['before'],
                        'balance_after' => $wallet['after'],
                        'status' => 'completed',
                        'created_at' => $now,
                        'updated_at' => $now,
                    ],
                    $session
                );

                return [
                    'processed' => true,
                    'amount' => $dailyEarning,
                    'day_number' => $dayNumber,
                    'wallet_before' => $wallet['before'],
                    'wallet_after' => $wallet['after'],
                    'investment_total_earnings' => $newTotal,
                    'investment_completed' => (
                        $newProcessed >= $duration
                    ),
                ];
            },
            [
                /*
                 * Reasonable transaction settings for financial
                 * consistency.
                 */
                'maxCommitTimeMS' => 10000,
            ]
        );

        return is_array($result)
            ? $result
            : [
                'processed' => false,
                'reason' => 'transaction_returned_no_result',
            ];
    } catch (Throwable $e) {
        throw new RuntimeException(
            'Investment '
            . (string) $investmentId
            . ' day '
            . $dayNumber
            . ' failed: '
            . $e->getMessage(),
            0,
            $e
        );
    } finally {
        $session->endSession();
    }
}

/*
|--------------------------------------------------------------------------
| Main earnings processor
|--------------------------------------------------------------------------
*/

function ccProcessDailyEarnings(): array
{
    $users = ccCollection('users');
    $investments = ccCollection('investments');
    $earnings = ccCollection('earnings');
    $transactions = ccCollection('transactions');

    /*
     * Ensure duplicate protection exists.
     */
    ccEnsureLedgerIndex($earnings);

    /*
     * Find active investments.
     */
    $filter = [
        '$and' => [
            [
                '$or' => [
                    ['status' => 'active'],
                    ['status' => 'running'],
                    ['status' => 'in_progress'],
                    ['status' => 'in-progress'],
                ],
            ],
            [
                '$or' => [
                    ['balance_deducted' => true],
                    ['balanceDeducted' => true],

                    /*
                     * Compatibility with old records.
                     */
                    [
                        'balance_deducted' => [
                            '$exists' => false,
                        ],
                    ],
                    [
                        'balanceDeducted' => [
                            '$exists' => false,
                        ],
                    ],
                ],
            ],
            [
                '$or' => [
                    [
                        'principal_returned' => [
                            '$ne' => true,
                        ],
                    ],
                    [
                        'principalReturned' => [
                            '$ne' => true,
                        ],
                    ],
                ],
            ],
        ],
    ];

    $cursor = $investments->find(
        $filter,
        [
            'limit' => CROWN_CASH_MAX_INVESTMENTS_PER_RUN,
            'sort' => [
                'created_at' => 1,
            ],
        ]
    );

    $stats = [
        'investments_checked' => 0,
        'investments_processed' => 0,
        'earnings_days_processed' => 0,
        'already_paid' => 0,
        'not_due' => 0,
        'completed' => 0,
        'skipped' => 0,
        'failed' => 0,
        'total_earnings_paid' => 0.0,
        'errors' => [],
    ];

    foreach ($cursor as $investment) {
        $stats['investments_checked']++;

        $investmentId = ccInvestmentId($investment);

        if ($investmentId === null) {
            $stats['skipped']++;

            $stats['errors'][] = [
                'investment_id' => null,
                'error' => 'Invalid investment ID.',
            ];

            continue;
        }

        try {
            $startDate = ccInvestmentStartDate($investment);

            if ($startDate === null) {
                $stats['skipped']++;

                continue;
            }

            $elapsedDays = ccElapsedFullDays($startDate);
            $processedDays = ccInvestmentEarningDays($investment);
            $duration = ccInvestmentDuration($investment);

            /*
             * No earning before a complete 24-hour period.
             */
            if ($elapsedDays <= $processedDays) {
                $stats['not_due']++;
                continue;
            }

            /*
             * Never process beyond the configured duration.
             */
            $targetDay = min(
                $elapsedDays,
                $duration
            );

            /*
             * Catch up missed days.
             */
            for (
                $dayNumber = $processedDays + 1;
                $dayNumber <= $targetDay;
                $dayNumber++
            ) {
                /*
                 * Re-read investment before every day so that
                 * status/duration changes are respected.
                 */
                $currentInvestment = $investments->findOne([
                    '_id' => $investmentId,
                ]);

                if ($currentInvestment === null) {
                    break;
                }

                if (!ccIsActiveInvestment($currentInvestment)) {
                    break;
                }

                $currentProcessed = ccInvestmentEarningDays(
                    $currentInvestment
                );

                if ($dayNumber <= $currentProcessed) {
                    continue;
                }

                $result = ccProcessOneDay(
                    $investments,
                    $users,
                    $earnings,
                    $transactions,
                    $investmentId,
                    $dayNumber
                );

                if (($result['processed'] ?? false) === true) {
                    $stats['investments_processed']++;
                    $stats['earnings_days_processed']++;

                    $amount = ccMoney(
                        $result['amount'] ?? 0
                    );

                    $stats['total_earnings_paid'] = round(
                        $stats['total_earnings_paid'] + $amount,
                        2
                    );

                    if (
                        ($result['investment_completed'] ?? false)
                        === true
                    ) {
                        $stats['completed']++;
                    }
                } elseif (
                    ($result['reason'] ?? '') === 'already_paid'
                ) {
                    $stats['already_paid']++;
                } else {
                    $stats['skipped']++;
                }
            }
        } catch (Throwable $e) {
            $stats['failed']++;

            $stats['errors'][] = [
                'investment_id' => (string) $investmentId,
                'error' => $e->getMessage(),
            ];
        }
    }

    return $stats;
}

/*
|--------------------------------------------------------------------------
| GitHub Actions / Cron security
|--------------------------------------------------------------------------
*/

function ccGetCronToken(): string
{
    $header = '';

    /*
     * Apache/FastCGI may expose custom headers differently.
     */
    if (isset($_SERVER['HTTP_X_CRON_TOKEN'])) {
        $header = ccString($_SERVER['HTTP_X_CRON_TOKEN']);
    }

    /*
     * Fallback for environments that provide getallheaders().
     */
    if ($header === function_exists('getallheaders')) {
        $headers = getallheaders();

        foreach ($headers as $name => $value) {
            if (strtolower($name) === 'x-cron-token') {
                $header = ccString($value);
                break;
            }
        }
    }

    return $header;
}

function ccValidateCronSecret(): void
{
    $expected = getenv('CROWN_CASH_CRON_SECRET');

    if ($expected === false || trim($expected) === '') {
        ccEarningsResponse(
            false,
            'Crown Cash cron secret is not configured on the server.',
            [],
            500
        );
    }

    $expected = trim($expected);
    $provided = ccGetCronToken();

    if ($provided === '') {
        ccEarningsResponse(
            false,
            'Cron authorization token is required.',
            [],
            401
        );
    }

    if (!hash_equals($expected, $provided)) {
        ccEarningsResponse(
            false,
            'Invalid cron authorization token.',
            [],
            403
        );
    }
}

/*
|--------------------------------------------------------------------------
| Main
|--------------------------------------------------------------------------
*/

try {
    /*
     * Only allow POST requests for the automated processor.
     */
    $method = strtoupper(
        $_SERVER['REQUEST_METHOD'] ?? 'GET'
    );

    if ($method !== 'POST') {
        ccEarningsResponse(
            false,
            'Use POST to run the Crown Cash earnings processor.',
            [
                'method_received' => $method,
            ],
            405
        );
    }

    /*
     * GitHub Actions must authenticate using the secret.
     */
    ccValidateCronSecret();

    /*
     * Ensure MongoDB client exists.
     */
    if (
        !isset($GLOBALS['client'])
        && !isset($GLOBALS['mongoClient'])
    ) {
        ccEarningsResponse(
            false,
            'MongoDB client is not available.',
            [],
            500
        );
    }

    /*
     * Process earnings.
     */
    $stats = ccProcessDailyEarnings();

    /*
     * If individual investments failed, return 207 so that
     * GitHub Actions can see that the processor encountered
     * partial failures.
     */
    $statusCode = ($stats['failed'] ?? 0) > 0
        ? 207
        : 200;

    ccEarningsResponse(
        true,
        'Crown Cash daily earnings processing completed.',
        $stats,
        $statusCode
    );
} catch (Throwable $e) {
    error_log(
        'CROWN CASH DAILY EARNINGS ERROR: '
        . $e->getMessage()
    );

    ccEarningsResponse(
        false,
        'Daily earnings processing failed.',
        [
            'error' => $e->getMessage(),
        ],
        500
    );
}