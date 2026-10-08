<?php

declare(strict_types=1);

/**
 * ============================================================
 * CROWN CASH
 * daily_earnings.php
 * ============================================================
 *
 * AUTOMATIC DAILY INVESTMENT EARNINGS ENGINE
 *
 * CURRENT CROWN CASH STRUCTURE
 * ------------------------------------------------------------
 * - Minimum investment: UGX 10,000
 * - Investment is deducted immediately by investment.php
 * - Investment becomes ACTIVE immediately
 * - No administrator approval is required
 * - Daily rate is stored on the investment/server side
 * - Current configured rate: 10% daily
 * - Current configured duration: 30 days
 * - Daily earnings are credited to the user's wallet
 * - Investment principal is NOT returned by this file
 * - Referral commissions are NOT processed here
 *
 * IMPORTANT
 * ------------------------------------------------------------
 * This file must be called by a scheduler/cron job.
 *
 * Example:
 *
 * https://crown-cash1.onrender.com/daily_earnings.php
 *
 * The processor is safe to run repeatedly because every earning
 * has a deterministic ledger key:
 *
 * investment_earning:{investment_id}:{day_number}
 *
 * Example:
 *
 * investment_earning:68f123456789abcdef123456:1
 *
 * The same investment/day can therefore NOT be credited twice.
 *
 * EARNING TIMING
 * ------------------------------------------------------------
 * Earnings start after one complete 24-hour period from the
 * investment start/activation time.
 *
 * Example:
 *
 * Started:
 * 06 Oct 2026 10:00 UTC
 *
 * Day 1:
 * 07 Oct 2026 10:00 UTC
 *
 * Day 2:
 * 08 Oct 2026 10:00 UTC
 *
 * If the cron job misses a day, this file catches up the
 * unprocessed earning days automatically.
 *
 * TRANSACTION SAFETY
 * ------------------------------------------------------------
 * Each earning performs:
 *
 * 1. Create earning ledger
 * 2. Credit user wallet
 * 3. Create transaction history
 * 4. Update investment earnings
 *
 * These operations are performed inside one MongoDB transaction.
 *
 * ============================================================
 */

require_once __DIR__ . '/config.php';

use MongoDB\BSON\ObjectId;
use MongoDB\BSON\UTCDateTime;

/* ============================================================
   CONFIGURATION
   ============================================================ */

const CROWN_CASH_MIN_INVESTMENT = 10000.00;
const CROWN_CASH_DEFAULT_DAILY_RATE = 0.10;
const CROWN_CASH_DEFAULT_DURATION = 30;

/* ============================================================
   CORS
   ============================================================ */

$allowedOrigins = [
    'https://crown-cash.vercel.app',
    'https://www.crown-cash.vercel.app',
    'http://localhost:3000',
    'http://localhost:5173'
];

$origin = $_SERVER['HTTP_ORIGIN'] ?? '';

if (
    $origin !== ''
    && in_array($origin, $allowedOrigins, true)
) {
    header(
        "Access-Control-Allow-Origin: {$origin}"
    );

    header(
        'Access-Control-Allow-Credentials: true'
    );

    header(
        'Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With, X-Cron-Token'
    );

    header(
        'Access-Control-Allow-Methods: GET, POST, OPTIONS'
    );

    header('Vary: Origin');
}

header(
    'Content-Type: application/json; charset=utf-8'
);

/* ============================================================
   OPTIONS
   ============================================================ */

if (
    ($_SERVER['REQUEST_METHOD'] ?? 'GET')
    === 'OPTIONS'
) {
    http_response_code(204);
    exit;
}

/* ============================================================
   RESPONSE HELPER
   ============================================================ */

function ccEarningsResponse(
    bool $success,
    string $message,
    array $data = [],
    int $status = 200
): never {
    http_response_code($status);

    echo json_encode(
        [
            'success' => $success,
            'message' => $message,
            'data' => $data
        ],
        JSON_UNESCAPED_SLASHES
        | JSON_UNESCAPED_UNICODE
        | JSON_PARTIAL_OUTPUT_ON_ERROR
    );

    exit;
}

/* ============================================================
   SESSION
   ============================================================ */

try {
    if (
        function_exists(
            'startSecureSession'
        )
    ) {
        startSecureSession();
    } elseif (
        session_status()
        !== PHP_SESSION_ACTIVE
    ) {
        session_name(
            'CROWN_CASH_SESSION'
        );

        session_set_cookie_params([
            'httponly' => true,
            'secure' => true,
            'samesite' => 'None'
        ]);

        session_start();
    }
} catch (Throwable $e) {
    /*
     * Earnings processing is normally performed by cron,
     * so session failure should not stop processing.
     */
}

/* ============================================================
   BASIC HELPERS
   ============================================================ */

function ccString(
    $value,
    string $default = ''
): string {
    if ($value === null) {
        return $default;
    }

    if ($value instanceof ObjectId) {
        return (string) $value;
    }

    if ($value instanceof UTCDateTime) {
        return $value
            ->toDateTime()
            ->format('c');
    }

    if (is_scalar($value)) {
        return trim(
            (string) $value
        );
    }

    return $default;
}

function ccMoney(
    $value,
    float $default = 0.0
): float {
    if (
        $value === null
        || $value === ''
    ) {
        return $default;
    }

    if (!is_numeric($value)) {
        return $default;
    }

    return round(
        (float) $value,
        2
    );
}

function ccBool(
    $value,
    bool $default = false
): bool {
    if ($value === null) {
        return $default;
    }

    if (is_bool($value)) {
        return $value;
    }

    if (is_numeric($value)) {
        return ((int) $value) === 1;
    }

    if (is_string($value)) {
        return in_array(
            strtolower(
                trim($value)
            ),
            [
                '1',
                'true',
                'yes',
                'on'
            ],
            true
        );
    }

    return $default;
}

function ccObjectId(
    $value
): ?ObjectId {
    if ($value instanceof ObjectId) {
        return $value;
    }

    $value =
        ccString(
            $value
        );

    if (
        $value === ''
        || !preg_match(
            '/^[a-f0-9]{24}$/i',
            $value
        )
    ) {
        return null;
    }

    try {
        return new ObjectId(
            $value
        );
    } catch (Throwable $e) {
        return null;
    }
}

function ccNow(): UTCDateTime
{
    return new UTCDateTime();
}

function ccUtcNow(): DateTimeImmutable
{
    return new DateTimeImmutable(
        'now',
        new DateTimeZone('UTC')
    );
}

/* ============================================================
   DATABASE COLLECTIONS
   ============================================================ */

function ccCollection(
    string $name
) {
    /*
     * First use collection variables exposed by config.php.
     */
    if (
        isset(
            $GLOBALS[$name]
        )
        && $GLOBALS[$name] !== null
    ) {
        return $GLOBALS[$name];
    }

    /*
     * Otherwise use a database object from config.php.
     */
    $database =
        $GLOBALS['db']
        ?? $GLOBALS['database']
        ?? null;

    if (
        $database !== null
        && method_exists(
            $database,
            'selectCollection'
        )
    ) {
        return $database->selectCollection(
            $name
        );
    }

    throw new RuntimeException(
        'MongoDB collection "' . $name . '" is not available.'
    );
}

/* ============================================================
   INVESTMENT ID
   ============================================================ */

function ccInvestmentId(
    $investment
): string {
    foreach (
        [
            $investment['_id'] ?? null,
            $investment['id'] ?? null,
            $investment['investment_id'] ?? null
        ] as $value
    ) {
        $id =
            ccString(
                $value
            );

        if ($id !== '') {
            return $id;
        }
    }

    return '';
}

/* ============================================================
   INVESTMENT USER ID
   ============================================================ */

function ccInvestmentUserId(
    $investment
): string {
    foreach (
        [
            $investment['user_id'] ?? null,
            $investment['userId'] ?? null,
            $investment['userid'] ?? null,
            $investment['owner_id'] ?? null,
            $investment['ownerId'] ?? null
        ] as $value
    ) {
        $id =
            ccString(
                $value
            );

        if ($id !== '') {
            return $id;
        }
    }

    return '';
}

/* ============================================================
   INVESTMENT AMOUNT
   ============================================================ */

function ccInvestmentAmount(
    $investment
): float {
    foreach (
        [
            'amount',
            'principal',
            'investment_amount',
            'investmentAmount',
            'capital'
        ] as $field
    ) {
        if (
            array_key_exists(
                $field,
                (array) $investment
            )
        ) {
            $amount =
                ccMoney(
                    $investment[$field]
                );

            if ($amount > 0) {
                return $amount;
            }
        }
    }

    return 0.0;
}

/* ============================================================
   DAILY EARNING
   ============================================================ */

function ccInvestmentDailyEarning(
    $investment
): float {
    foreach (
        [
            'daily_earning',
            'dailyEarning',
            'daily_income',
            'dailyIncome',
            'daily_profit',
            'dailyProfit'
        ] as $field
    ) {
        if (
            isset(
                $investment[$field]
            )
            && is_numeric(
                $investment[$field]
            )
        ) {
            $amount =
                ccMoney(
                    $investment[$field]
                );

            if ($amount > 0) {
                return $amount;
            }
        }
    }

    return 0.0;
}

/* ============================================================
   DAILY RATE
   ============================================================ */

function ccInvestmentDailyRate(
    $investment
): float {
    foreach (
        [
            'daily_rate',
            'dailyRate',
            'interest_rate',
            'interestRate',
            'rate'
        ] as $field
    ) {
        if (
            isset(
                $investment[$field]
            )
            && is_numeric(
                $investment[$field]
            )
        ) {
            $rate =
                (float) $investment[$field];

            if ($rate <= 0) {
                continue;
            }

            /*
             * 0.10 = 10%
             * 10 = 10%
             */
            if ($rate > 1) {
                $rate =
                    $rate / 100;
            }

            return $rate;
        }
    }

    /*
     * Current Crown Cash default.
     */
    return CROWN_CASH_DEFAULT_DAILY_RATE;
}

/* ============================================================
   INVESTMENT DURATION
   ============================================================ */

function ccInvestmentDuration(
    $investment
): int {
    foreach (
        [
            'duration_days',
            'durationDays',
            'duration',
            'days',
            'term_days'
        ] as $field
    ) {
        if (
            isset(
                $investment[$field]
            )
        ) {
            $days =
                (int) $investment[$field];

            if ($days > 0) {
                return $days;
            }
        }
    }

    /*
     * Current Crown Cash default.
     */
    return CROWN_CASH_DEFAULT_DURATION;
}

/* ============================================================
   INVESTMENT STATUS
   ============================================================ */

function ccInvestmentStatus(
    $investment
): string {
    return strtolower(
        ccString(
            $investment['status']
            ?? $investment['state']
            ?? ''
        )
    );
}

function ccInvestmentIsActive(
    $investment
): bool {
    return in_array(
        ccInvestmentStatus(
            $investment
        ),
        [
            'active',
            'running',
            'in_progress',
            'in-progress'
        ],
        true
    );
}

/* ============================================================
   BALANCE DEDUCTED
   ============================================================ */

function ccInvestmentBalanceDeducted(
    $investment
): bool {
    /*
     * New investment.php should set this to true.
     *
     * Also support investments where the field does not
     * exist but the investment was created under the new
     * active structure.
     */
    if (
        array_key_exists(
            'balance_deducted',
            (array) $investment
        )
    ) {
        return ccBool(
            $investment['balance_deducted']
        );
    }

    if (
        array_key_exists(
            'balanceDeducted',
            (array) $investment
        )
    ) {
        return ccBool(
            $investment['balanceDeducted']
        );
    }

    /*
     * For the new Crown Cash structure, an ACTIVE investment
     * is expected to have already deducted its principal.
     */
    return ccInvestmentIsActive(
        $investment
    );
}

/* ============================================================
   PRINCIPAL RETURNED
   ============================================================ */

function ccPrincipalReturned(
    $investment
): bool {
    return ccBool(
        $investment['principal_returned']
        ?? $investment['principalReturned']
        ?? false
    );
}

/* ============================================================
   INVESTMENT START DATE
   ============================================================ */

function ccInvestmentStartDate(
    $investment
): ?DateTimeImmutable {
    $fields = [
        'started_at',
        'activated_at',
        'activation_date',
        'start_date',
        'created_at'
    ];

    foreach ($fields as $field) {
        if (
            !isset(
                $investment[$field]
            )
        ) {
            continue;
        }

        $value =
            $investment[$field];

        try {
            if (
                $value instanceof UTCDateTime
            ) {
                return new DateTimeImmutable(
                    $value
                        ->toDateTime()
                        ->format('c'),
                    new DateTimeZone('UTC')
                );
            }

            if (
                $value instanceof DateTimeInterface
            ) {
                return new DateTimeImmutable(
                    $value->format('c'),
                    new DateTimeZone('UTC')
                );
            }

            if (
                is_numeric($value)
                && (int) $value > 0
            ) {
                /*
                 * Support Unix timestamps.
                 */
                return (new DateTimeImmutable(
                    '@' . (int) $value
                ))->setTimezone(
                    new DateTimeZone('UTC')
                );
            }

            if (
                is_string($value)
                && trim($value) !== ''
            ) {
                return new DateTimeImmutable(
                    trim($value),
                    new DateTimeZone('UTC')
                );
            }
        } catch (Throwable $e) {
            continue;
        }
    }

    return null;
}

/* ============================================================
   ELAPSED FULL DAYS
   ============================================================ */

function ccElapsedFullDays(
    $investment,
    DateTimeImmutable $now
): int {
    $start =
        ccInvestmentStartDate(
            $investment
        );

    if (!$start) {
        return 0;
    }

    $start =
        $start->setTimezone(
            new DateTimeZone('UTC')
        );

    $seconds =
        $now->getTimestamp()
        - $start->getTimestamp();

    if ($seconds <= 0) {
        return 0;
    }

    return (int) floor(
        $seconds / 86400
    );
}

/* ============================================================
   USER ID
   ============================================================ */

function ccUserId(
    $user
): string {
    foreach (
        [
            $user['_id'] ?? null,
            $user['id'] ?? null,
            $user['user_id'] ?? null
        ] as $value
    ) {
        $id =
            ccString(
                $value
            );

        if ($id !== '') {
            return $id;
        }
    }

    return '';
}

/* ============================================================
   FIND USER
   ============================================================ */

function ccFindUser(
    $users,
    string $userId
) {
    $userId =
        trim(
            $userId
        );

    if ($userId === '') {
        return null;
    }

    $or = [];

    $oid =
        ccObjectId(
            $userId
        );

    if ($oid !== null) {
        $or[] = [
            '_id' => $oid
        ];
    }

    $or[] = [
        'id' => $userId
    ];

    $or[] = [
        'user_id' => $userId
    ];

    if (
        filter_var(
            $userId,
            FILTER_VALIDATE_EMAIL
        )
    ) {
        $or[] = [
            'email' =>
                strtolower(
                    $userId
                )
        ];
    }

    try {
        return $users->findOne([
            '$or' => $or
        ]);
    } catch (Throwable $e) {
        return null;
    }
}

/* ============================================================
   USER WALLET FILTER
   ============================================================ */

function ccUserWalletFilter(
    $user
): array {
    $id =
        ccUserId(
            $user
        );

    if ($id === '') {
        throw new RuntimeException(
            'User ID is missing.'
        );
    }

    $oid =
        ccObjectId(
            $id
        );

    if ($oid !== null) {
        return [
            '_id' => $oid
        ];
    }

    return [
        '$or' => [
            [
                'id' => $id
            ],
            [
                'user_id' => $id
            ]
        ]
    ];
}

/* ============================================================
   WALLET BALANCE
   ============================================================ */

/**
 * Gets the user's wallet balance.
 *
 * Crown Cash may have historically used:
 *
 * balance
 * wallet_balance
 * walletBalance
 * wallet.balance
 *
 * This function selects the highest recognized numeric
 * wallet value and treats it as the current available
 * wallet balance.
 *
 * This is useful when older records contain duplicated wallet
 * fields that became out of sync.
 */
function ccWalletBalance(
    $user
): float {
    if (!$user) {
        return 0.0;
    }

    $values = [];

    foreach (
        [
            'balance',
            'wallet_balance',
            'walletBalance'
        ] as $field
    ) {
        if (
            array_key_exists(
                $field,
                (array) $user
            )
            && is_numeric(
                $user[$field]
            )
        ) {
            $values[] =
                (float) $user[$field];
        }
    }

    if (
        isset(
            $user['wallet']
        )
        && is_array(
            $user['wallet']
        )
        && isset(
            $user['wallet']['balance']
        )
        && is_numeric(
            $user['wallet']['balance']
        )
    ) {
        $values[] =
            (float) $user['wallet']['balance'];
    }

    if (!$values) {
        return 0.0;
    }

    /*
     * Use the highest recognized balance as the current
     * wallet value, then synchronize recognized fields.
     */
    return round(
        max($values),
        2
    );
}

/* ============================================================
   CREDIT WALLET
   ============================================================ */

/**
 * Credits the user's wallet and synchronizes all recognized
 * Crown Cash wallet fields.
 *
 * IMPORTANT:
 *
 * Instead of incrementing several potentially inconsistent
 * wallet fields independently, this function first determines
 * the current wallet balance and then SETS all recognized
 * wallet fields to the new balance.
 *
 * Example:
 *
 * Before:
 * balance       = 10,000
 * wallet_balance = 10,000
 *
 * Earning:
 * 1,000
 *
 * After:
 * balance       = 11,000
 * wallet_balance = 11,000
 *
 * This prevents dashboard/API mismatch.
 */
function ccCreditWallet(
    $users,
    $user,
    float $amount,
    $session
): array {
    if ($amount <= 0) {
        throw new RuntimeException(
            'Wallet credit amount must be greater than zero.'
        );
    }

    $filter =
        ccUserWalletFilter(
            $user
        );

    $freshUser =
        $users->findOne(
            $filter,
            [
                'session' =>
                    $session
            ]
        );

    if (!$freshUser) {
        throw new RuntimeException(
            'User account could not be found.'
        );
    }

    $before =
        ccWalletBalance(
            $freshUser
        );

    $after =
        round(
            $before + $amount,
            2
        );

    $set = [
        'updated_at' =>
            ccNow()
    ];

    /*
     * Keep the main Crown Cash balance field synchronized.
     */
    $set['balance'] =
        $after;

    /*
     * Synchronize legacy wallet fields if they exist.
     */
    if (
        array_key_exists(
            'wallet_balance',
            (array) $freshUser
        )
    ) {
        $set['wallet_balance'] =
            $after;
    }

    if (
        array_key_exists(
            'walletBalance',
            (array) $freshUser
        )
    ) {
        $set['walletBalance'] =
            $after;
    }

    /*
     * Synchronize nested wallet balance if it exists.
     */
    if (
        isset(
            $freshUser['wallet']
        )
        && is_array(
            $freshUser['wallet']
        )
        && array_key_exists(
            'balance',
            $freshUser['wallet']
        )
    ) {
        $set['wallet.balance'] =
            $after;
    }

    $result =
        $users->updateOne(
            $filter,
            [
                '$set' => $set
            ],
            [
                'session' =>
                    $session
            ]
        );

    if (
        $result->getMatchedCount()
        !== 1
    ) {
        throw new RuntimeException(
            'Wallet update failed.'
        );
    }

    return [
        'before' =>
            $before,

        'after' =>
            $after
    ];
}

/* ============================================================
   INVESTMENT FILTER
   ============================================================ */

function ccInvestmentFilter(
    string $investmentId
): array {
    $oid =
        ccObjectId(
            $investmentId
        );

    if ($oid !== null) {
        return [
            '_id' => $oid
        ];
    }

    return [
        '$or' => [
            [
                'id' =>
                    $investmentId
            ],
            [
                'investment_id' =>
                    $investmentId
            ]
        ]
    ];
}

/* ============================================================
   LEDGER INDEX
   ============================================================ */

function ccEnsureLedgerIndex(
    $earnings
): void {
    try {
        $earnings->createIndex(
            [
                'ledger_key' => 1
            ],
            [
                'unique' => true,
                'name' =>
                    'crown_cash_unique_earning_ledger'
            ]
        );
    } catch (Throwable $e) {
        /*
         * Index may already exist.
         *
         * Do not stop processing because of that.
         */
    }
}

/* ============================================================
   CHECK LEDGER
   ============================================================ */

function ccLedgerExists(
    $earnings,
    string $ledgerKey,
    $session
): bool {
    $existing =
        $earnings->findOne(
            [
                'ledger_key' =>
                    $ledgerKey
            ],
            [
                'projection' => [
                    '_id' => 1
                ],
                'session' =>
                    $session
            ]
        );

    return $existing !== null;
}

/* ============================================================
   INSERT LEDGER
   ============================================================ */

function ccInsertLedger(
    $earnings,
    array $document,
    $session
): void {
    try {
        $earnings->insertOne(
            $document,
            [
                'session' =>
                    $session
            ]
        );
    } catch (Throwable $e) {
        /*
         * Duplicate ledger key means the earning has already
         * been processed.
         */
        if (
            ccIsDuplicateKeyError(
                $e
            )
        ) {
            throw new RuntimeException(
                'DUPLICATE_EARNING'
            );
        }

        throw $e;
    }
}

/* ============================================================
   DUPLICATE KEY DETECTION
   ============================================================ */

function ccIsDuplicateKeyError(
    Throwable $e
): bool {
    $message =
        strtolower(
            $e->getMessage()
        );

    return (
        str_contains(
            $message,
            'e11000'
        )
        || str_contains(
            $message,
            'duplicate key'
        )
    );
}

/* ============================================================
   TRANSACTION HISTORY
   ============================================================ */

function ccInsertTransaction(
    $transactions,
    string $reference,
    array $document,
    $session
): void {
    $transactions->updateOne(
        [
            'reference' =>
                $reference
        ],
        [
            '$setOnInsert' =>
                $document
        ],
        [
            'upsert' => true,
            'session' =>
                $session
        ]
    );
}

/* ============================================================
   PROCESS ONE DAY
   ============================================================ */

function ccProcessOneDay(
    $investment,
    $users,
    $earnings,
    $transactions,
    $investments,
    $client,
    int $dayNumber
): array {
    $investmentId =
        ccInvestmentId(
            $investment
        );

    if ($investmentId === '') {
        return [
            'success' => false,
            'processed' => false,
            'message' =>
                'Investment ID is missing.'
        ];
    }

    $userId =
        ccInvestmentUserId(
            $investment
        );

    if ($userId === '') {
        return [
            'success' => false,
            'processed' => false,
            'message' =>
                'Investment owner is missing.'
        ];
    }

    if (
        !ccInvestmentIsActive(
            $investment
        )
    ) {
        return [
            'success' => true,
            'processed' => false,
            'message' =>
                'Investment is not active.'
        ];
    }

    if (
        !ccInvestmentBalanceDeducted(
            $investment
        )
    ) {
        return [
            'success' => true,
            'processed' => false,
            'message' =>
                'Investment principal has not been deducted.'
        ];
    }

    if (
        ccPrincipalReturned(
            $investment
        )
    ) {
        return [
            'success' => true,
            'processed' => false,
            'message' =>
                'Investment principal has already been returned.'
        ];
    }

    $principal =
        ccInvestmentAmount(
            $investment
        );

    if (
        $principal < CROWN_CASH_MIN_INVESTMENT
    ) {
        return [
            'success' => false,
            'processed' => false,
            'message' =>
                'Investment amount is below the Crown Cash minimum.'
        ];
    }

    $duration =
        ccInvestmentDuration(
            $investment
        );

    if (
        $dayNumber < 1
        || $dayNumber > $duration
    ) {
        return [
            'success' => true,
            'processed' => false,
            'message' =>
                'No earning is due for this day.'
        ];
    }

    /*
     * Prefer the amount stored on the investment.
     */
    $dailyEarning =
        ccInvestmentDailyEarning(
            $investment
        );

    /*
     * If daily income is missing, calculate it from the
     * server-side investment rate.
     */
    if ($dailyEarning <= 0) {
        $rate =
            ccInvestmentDailyRate(
                $investment
            );

        $dailyEarning =
            round(
                $principal * $rate,
                2
            );
    }

    if ($dailyEarning <= 0) {
        return [
            'success' => false,
            'processed' => false,
            'message' =>
                'Daily earning is invalid.'
        ];
    }

    /*
     * Find the owner.
     */
    $user =
        ccFindUser(
            $users,
            $userId
        );

    if (!$user) {
        return [
            'success' => false,
            'processed' => false,
            'message' =>
                'Investment owner was not found.'
        ];
    }

    $session = null;

    try {
        $session =
            $client->startSession();

        $result = [
            'success' => false,
            'processed' => false
        ];

        $session->withTransaction(
            function () use (
                &$result,
                $investmentId,
                $userId,
                $users,
                $earnings,
                $transactions,
                $investments,
                $dailyEarning,
                $dayNumber,
                $duration,
                $session
            ): void {

                /*
                 * =================================================
                 * 1. RE-READ INVESTMENT
                 * =================================================
                 */
                $freshInvestment =
                    $investments->findOne(
                        ccInvestmentFilter(
                            $investmentId
                        ),
                        [
                            'session' =>
                                $session
                        ]
                    );

                if (!$freshInvestment) {
                    throw new RuntimeException(
                        'Investment no longer exists.'
                    );
                }

                /*
                 * Investment must remain active.
                 */
                if (
                    !ccInvestmentIsActive(
                        $freshInvestment
                    )
                ) {
                    $result = [
                        'success' => true,
                        'processed' => false,
                        'message' =>
                            'Investment is no longer active.'
                    ];

                    return;
                }

                /*
                 * Principal must have been deducted.
                 */
                if (
                    !ccInvestmentBalanceDeducted(
                        $freshInvestment
                    )
                ) {
                    $result = [
                        'success' => true,
                        'processed' => false,
                        'message' =>
                            'Investment principal has not been deducted.'
                    ];

                    return;
                }

                /*
                 * Never process after principal return.
                 */
                if (
                    ccPrincipalReturned(
                        $freshInvestment
                    )
                ) {
                    $result = [
                        'success' => true,
                        'processed' => false,
                        'message' =>
                            'Investment principal has already been returned.'
                    ];

                    return;
                }

                /*
                 * =================================================
                 * 2. DETERMINISTIC LEDGER KEY
                 * =================================================
                 */
                $ledgerKey =
                    'investment_earning:'
                    . $investmentId
                    . ':'
                    . $dayNumber;

                /*
                 * Already paid?
                 */
                if (
                    ccLedgerExists(
                        $earnings,
                        $ledgerKey,
                        $session
                    )
                ) {
                    $result = [
                        'success' => true,
                        'processed' => false,
                        'duplicate' => true,
                        'investment_id' =>
                            $investmentId,
                        'day_number' =>
                            $dayNumber,
                        'daily_earning' =>
                            0,
                        'message' =>
                            'This earning has already been credited.'
                    ];

                    return;
                }

                /*
                 * =================================================
                 * 3. RE-READ USER
                 * =================================================
                 */
                $freshUser =
                    $users->findOne(
                        ccUserWalletFilter(
                            ccFindUser(
                                $users,
                                $userId
                            )
                        ),
                        [
                            'session' =>
                                $session
                        ]
                    );

                if (!$freshUser) {
                    throw new RuntimeException(
                        'User account could not be found.'
                    );
                }

                $balanceBefore =
                    ccWalletBalance(
                        $freshUser
                    );

                /*
                 * =================================================
                 * 4. CREDIT WALLET
                 * =================================================
                 *
                 * This is the important part.
                 */
                $walletResult =
                    ccCreditWallet(
                        $users,
                        $freshUser,
                        $dailyEarning,
                        $session
                    );

                /*
                 * =================================================
                 * 5. LEDGER
                 * =================================================
                 */
                try {
                    ccInsertLedger(
                        $earnings,
                        [
                            'ledger_key' =>
                                $ledgerKey,

                            'type' =>
                                'investment_earning',

                            'earning_type' =>
                                'daily_investment_earning',

                            'user_id' =>
                                $freshUser['_id']
                                ?? ccObjectId(
                                    $userId
                                )
                                ?? $userId,

                            'userId' =>
                                $userId,

                            'investment_id' =>
                                ccObjectId(
                                    $investmentId
                                )
                                ?? $investmentId,

                            'investmentId' =>
                                $investmentId,

                            'day_number' =>
                                $dayNumber,

                            'amount' =>
                                $dailyEarning,

                            'status' =>
                                'credited',

                            'currency' =>
                                'UGX',

                            'balance_before' =>
                                $balanceBefore,

                            'balance_after' =>
                                $walletResult['after'],

                            'created_at' =>
                                ccNow()
                        ],
                        $session
                    );
                } catch (Throwable $e) {
                    /*
                     * If another processor won the race,
                     * abort this transaction without keeping
                     * the wallet credit.
                     */
                    if (
                        $e->getMessage()
                        === 'DUPLICATE_EARNING'
                    ) {
                        throw $e;
                    }

                    throw $e;
                }

                /*
                 * =================================================
                 * 6. TRANSACTION HISTORY
                 * =================================================
                 */
                $reference =
                    'EARN-'
                    . strtoupper(
                        substr(
                            hash(
                                'sha256',
                                $ledgerKey
                            ),
                            0,
                            20
                        )
                    );

                ccInsertTransaction(
                    $transactions,
                    $reference,
                    [
                        'type' =>
                            'investment_earning',

                        'transaction_type' =>
                            'investment_earning',

                        'category' =>
                            'daily_earning',

                        'direction' =>
                            'credit',

                        'user_id' =>
                            $freshUser['_id']
                            ?? ccObjectId(
                                $userId
                            )
                            ?? $userId,

                        'userId' =>
                            $userId,

                        'investment_id' =>
                            ccObjectId(
                                $investmentId
                            )
                            ?? $investmentId,

                        'investmentId' =>
                            $investmentId,

                        'day_number' =>
                            $dayNumber,

                        'amount' =>
                            $dailyEarning,

                        'credit' =>
                            $dailyEarning,

                        'debit' =>
                            0,

                        'currency' =>
                            'UGX',

                        'balance_before' =>
                            $balanceBefore,

                        'balance_after' =>
                            $walletResult['after'],

                        'status' =>
                            'completed',

                        'reference' =>
                            $reference,

                        'ledger_key' =>
                            $ledgerKey,

                        'description' =>
                            'Crown Cash daily investment earning - Day '
                            . $dayNumber,

                        'created_at' =>
                            ccNow()
                    ],
                    $session
                );

                /*
                 * =================================================
                 * 7. UPDATE INVESTMENT
                 * =================================================
                 */

                $oldProcessed =
                    ccMoney(
                        $freshInvestment[
                            'earnings_processed'
                        ] ?? 0
                    );

                $oldTotalPaid =
                    ccMoney(
                        $freshInvestment[
                            'total_earnings_paid'
                        ] ?? 0
                    );

                $oldDays =
                    (int) (
                        $freshInvestment[
                            'earning_days'
                        ] ?? 0
                    );

                $newDays =
                    max(
                        $oldDays,
                        $dayNumber
                    );

                $newProcessed =
                    round(
                        $oldProcessed
                        + $dailyEarning,
                        2
                    );

                $newTotalPaid =
                    round(
                        $oldTotalPaid
                        + $dailyEarning,
                        2
                    );

                $now =
                    ccNow();

                $update = [
                    '$set' => [
                        'earnings_processed' =>
                            $newProcessed,

                        'total_earnings_paid' =>
                            $newTotalPaid,

                        'total_earnings' =>
                            $newTotalPaid,

                        'earning_days' =>
                            $newDays,

                        'last_earning_date' =>
                            $now,

                        'updated_at' =>
                            $now
                    ]
                ];

                /*
                 * Final day.
                 */
                if (
                    $newDays >= $duration
                ) {
                    $update['$set']['status'] =
                        'completed';

                    $update['$set']['completed_at'] =
                        $now;

                    $update['$set']['next_earning_date'] =
                        null;
                } else {
                    /*
                     * Calculate next earning date from the
                     * investment start date instead of from
                     * the cron execution time.
                     */
                    $start =
                        ccInvestmentStartDate(
                            $freshInvestment
                        );

                    if ($start) {
                        $nextTimestamp =
                            $start->getTimestamp()
                            + (
                                ($newDays + 1)
                                * 86400
                            );

                        $update['$set']['next_earning_date'] =
                            new UTCDateTime(
                                $nextTimestamp * 1000
                            );
                    }
                }

                $investmentUpdate =
                    $investments->updateOne(
                        ccInvestmentFilter(
                            $investmentId
                        ),
                        $update,
                        [
                            'session' =>
                                $session
                        ]
                    );

                if (
                    $investmentUpdate
                        ->getMatchedCount()
                    !== 1
                ) {
                    throw new RuntimeException(
                        'Investment earnings update failed.'
                    );
                }

                /*
                 * =================================================
                 * SUCCESS
                 * =================================================
                 */
                $result = [
                    'success' =>
                        true,

                    'processed' =>
                        true,

                    'duplicate' =>
                        false,

                    'investment_id' =>
                        $investmentId,

                    'user_id' =>
                        $userId,

                    'day_number' =>
                        $dayNumber,

                    'daily_earning' =>
                        $dailyEarning,

                    'balance_before' =>
                        $balanceBefore,

                    'balance_after' =>
                        $walletResult[
                            'after'
                        ],

                    'investment_status' =>
                        (
                            $newDays >= $duration
                            ? 'completed'
                            : 'active'
                        )
                ];
            }
        );

        return $result;

    } catch (Throwable $e) {

        /*
         * Duplicate means another execution already processed
         * this exact investment/day.
         */
        if (
            $e->getMessage()
            === 'DUPLICATE_EARNING'
        ) {
            return [
                'success' =>
                    true,

                'processed' =>
                    false,

                'duplicate' =>
                    true,

                'investment_id' =>
                    $investmentId,

                'day_number' =>
                    $dayNumber,

                'daily_earning' =>
                    0,

                'message' =>
                    'This daily earning was already processed.'
            ];
        }

        error_log(
            'Crown Cash daily earning error: '
            . $e->getMessage()
        );

        return [
            'success' =>
                false,

            'processed' =>
                false,

            'duplicate' =>
                false,

            'investment_id' =>
                $investmentId,

            'day_number' =>
                $dayNumber,

            'message' =>
                'The daily earning could not be processed.'
        ];

    } finally {

        if ($session !== null) {
            try {
                $session->endSession();
            } catch (Throwable $e) {
                /*
                 * Ignore cleanup errors.
                 */
            }
        }
    }
}

/* ============================================================
   PROCESS ALL ACTIVE INVESTMENTS
   ============================================================ */

function ccProcessDailyEarnings(
    $investments,
    $users,
    $earnings,
    $transactions,
    $client
): array {

    /*
     * Ensure duplicate protection.
     */
    ccEnsureLedgerIndex(
        $earnings
    );

    $now =
        ccUtcNow();

    /*
     * Only ACTIVE investments.
     *
     * No admin approval is required.
     */
    $filter = [
        'status' =>
            'active',

        '$or' => [
            [
                'balance_deducted' =>
                    true
            ],
            [
                'balance_deducted' =>
                    [
                        '$exists' =>
                            false
                    ]
            ]
        ],

        'principal_returned' =>
            [
                '$ne' =>
                    true
            ]
    ];

    $cursor =
        $investments->find(
            $filter,
            [
                'sort' => [
                    'created_at' =>
                        1
                ],

                'limit' =>
                    5000
            ]
        );

    $processedInvestments =
        0;

    $skippedInvestments =
        0;

    $failedInvestments =
        0;

    $duplicateInvestments =
        0;

    $completedInvestments =
        0;

    $totalDaysProcessed =
        0;

    $totalEarnings =
        0.0;

    foreach ($cursor as $investment) {

        try {

            /*
             * Must be active.
             */
            if (
                !ccInvestmentIsActive(
                    $investment
                )
            ) {
                $skippedInvestments++;
                continue;
            }

            /*
             * Must have investment principal deducted.
             */
            if (
                !ccInvestmentBalanceDeducted(
                    $investment
                )
            ) {
                $skippedInvestments++;
                continue;
            }

            /*
             * Principal returned means no more daily earnings.
             */
            if (
                ccPrincipalReturned(
                    $investment
                )
            ) {
                $skippedInvestments++;
                continue;
            }

            $duration =
                ccInvestmentDuration(
                    $investment
                );

            if (
                $duration <= 0
            ) {
                $skippedInvestments++;
                continue;
            }

            /*
             * Determine completed 24-hour periods.
             */
            $elapsedDays =
                ccElapsedFullDays(
                    $investment,
                    $now
                );

            /*
             * Investment has not reached Day 1 yet.
             */
            if (
                $elapsedDays < 1
            ) {
                $skippedInvestments++;
                continue;
            }

            /*
             * Never exceed configured duration.
             */
            $targetDay =
                min(
                    $elapsedDays,
                    $duration
                );

            /*
             * How many days already credited?
             */
            $alreadyProcessedDays =
                max(
                    0,
                    (int) (
                        $investment[
                            'earning_days'
                        ] ?? 0
                    )
                );

            /*
             * Nothing new to pay.
             */
            if (
                $alreadyProcessedDays
                >= $targetDay
            ) {
                $duplicateInvestments++;
                continue;
            }

            /*
             * Process every missed day.
             *
             * Example:
             *
             * Already paid = 1
             * Target day   = 3
             *
             * Pay:
             * Day 2
             * Day 3
             */
            $startDay =
                $alreadyProcessedDays + 1;

            for (
                $dayNumber = $startDay;
                $dayNumber <= $targetDay;
                $dayNumber++
            ) {

                /*
                 * Re-read investment after every successful
                 * day so that processing remains consistent.
                 */
                $currentInvestment =
                    $investments->findOne(
                        ccInvestmentFilter(
                            ccInvestmentId(
                                $investment
                            )
                        )
                    );

                if (
                    !$currentInvestment
                ) {
                    $failedInvestments++;
                    break;
                }

                $earningResult =
                    ccProcessOneDay(
                        $currentInvestment,
                        $users,
                        $earnings,
                        $transactions,
                        $investments,
                        $client,
                        $dayNumber
                    );

                if (
                    !(
                        $earningResult[
                            'success'
                        ] ?? false
                    )
                ) {
                    $failedInvestments++;
                    continue;
                }

                /*
                 * Duplicate.
                 */
                if (
                    (
                        $earningResult[
                            'duplicate'
                        ] ?? false
                    )
                ) {
                    $duplicateInvestments++;
                    continue;
                }

                /*
                 * Successfully credited.
                 */
                if (
                    (
                        $earningResult[
                            'processed'
                        ] ?? false
                    )
                ) {

                    $processedInvestments++;

                    $totalDaysProcessed++;

                    $earningAmount =
                        ccMoney(
                            $earningResult[
                                'daily_earning'
                            ] ?? 0
                        );

                    $totalEarnings +=
                        $earningAmount;

                    /*
                     * Final day.
                     */
                    if (
                        (
                            $earningResult[
                                'investment_status'
                            ] ?? ''
                        )
                        === 'completed'
                    ) {
                        $completedInvestments++;
                        break;
                    }
                }
            }

        } catch (Throwable $e) {

            $failedInvestments++;

            error_log(
                'Crown Cash investment earnings loop error: '
                . $e->getMessage()
            );
        }
    }

    return [
        'success' =>
            true,

        'message' =>
            'Crown Cash daily earnings processing completed.',

        'data' => [

            'processed_investments' =>
                $processedInvestments,

            'skipped_investments' =>
                $skippedInvestments,

            'failed_investments' =>
                $failedInvestments,

            'duplicate_investments' =>
                $duplicateInvestments,

            'completed_investments' =>
                $completedInvestments,

            'total_days_processed' =>
                $totalDaysProcessed,

            'total_earnings' =>
                round(
                    $totalEarnings,
                    2
                ),

            'currency' =>
                'UGX',

            'processed_at' =>
                $now->format(
                    'c'
                )
        ]
    ];
}

/* ============================================================
   CRON TOKEN
   ============================================================ */

function ccValidateCronToken(): void {

    /*
     * If no token is configured, remain compatible with
     * the current Crown Cash setup.
     */
    if (
        !defined(
            'CROWN_CASH_CRON_TOKEN'
        )
    ) {
        return;
    }

    $expected =
        trim(
            (string) constant(
                'CROWN_CASH_CRON_TOKEN'
            )
        );

    if (
        $expected === ''
    ) {
        return;
    }

    /*
     * X-Cron-Token.
     */
    $provided =
        trim(
            (string) (
                $_SERVER[
                    'HTTP_X_CRON_TOKEN'
                ] ?? ''
            )
        );

    /*
     * Authorization: Bearer TOKEN
     */
    if (
        $provided === ''
    ) {

        $authorization =
            trim(
                (string) (
                    $_SERVER[
                        'HTTP_AUTHORIZATION'
                    ] ?? ''
                )
            );

        if (
            preg_match(
                '/^Bearer\s+(.+)$/i',
                $authorization,
                $matches
            )
        ) {
            $provided =
                trim(
                    $matches[1]
                );
        }
    }

    if (
        $provided === ''
        || !hash_equals(
            $expected,
            $provided
        )
    ) {

        ccEarningsResponse(
            false,
            'Unauthorized earnings processor request.',
            [],
            401
        );
    }
}

/* ============================================================
   MAIN
   ============================================================ */

try {

    /*
     * Validate cron security if configured.
     */
    ccValidateCronToken();

    /*
     * Locate MongoDB client.
     */
    $client =
        $GLOBALS['client']
        ?? $GLOBALS['mongoClient']
        ?? $GLOBALS['mongodb']
        ?? null;

    if (
        !$client
        || !method_exists(
            $client,
            'startSession'
        )
    ) {
        throw new RuntimeException(
            'MongoDB client is not available. Check config.php.'
        );
    }

    /*
     * Collections.
     */
    $users =
        ccCollection(
            'users'
        );

    $investments =
        ccCollection(
            'investments'
        );

    $earnings =
        ccCollection(
            'earnings'
        );

    $transactions =
        ccCollection(
            'transactions'
        );

    /*
     * Process earnings.
     */
    $result =
        ccProcessDailyEarnings(
            $investments,
            $users,
            $earnings,
            $transactions,
            $client
        );

    ccEarningsResponse(
        (bool) (
            $result['success']
            ?? false
        ),

        ccString(
            $result['message']
            ?? 'Daily earnings processing completed.'
        ),

        is_array(
            $result['data']
            ?? null
        )
            ? $result['data']
            : [],

        (
            (
                $result['success']
                ?? false
            )
                ? 200
                : 500
        )
    );

} catch (Throwable $e) {

    /*
     * Log the real server error but do not expose MongoDB
     * internals to the user.
     */
    error_log(
        'Crown Cash daily_earnings.php fatal error: '
        . $e->getMessage()
    );

    ccEarningsResponse(
        false,
        'Daily earnings processing could not be completed.',
        [],
        500
    );
}