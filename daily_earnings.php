<?php
/**
 * Crown Cash
 * daily_earnings.php
 *
 * Daily investment earnings accounting engine.
 *
 * IMPORTANT:
 * - This file only processes earnings already configured on an
 *   approved investment.
 * - It does NOT invent a default return rate.
 * - It does NOT deduct investment principal.
 * - It does NOT return investment principal.
 * - It does NOT automatically pay referral commissions.
 *
 * The investment must already contain either:
 *   daily_earning
 * or:
 *   daily_rate
 *
 * The engine is idempotent using:
 *   investment_earning:{investment_id}:{day_number}
 *
 * All wallet, ledger, transaction and investment updates belonging
 * to one earning are performed inside the SAME MongoDB transaction.
 */

declare(strict_types=1);

require_once __DIR__ . '/config.php';

use MongoDB\BSON\ObjectId;
use MongoDB\BSON\UTCDateTime;
use MongoDB\Driver\Exception\Exception as MongoException;

/* =========================================================
   CORS
   ========================================================= */

$allowedOrigins = [
    'https://crown-cash.vercel.app',
    'https://www.crown-cash.vercel.app',
    'http://localhost:3000',
    'http://localhost:5173'
];

$origin = $_SERVER['HTTP_ORIGIN'] ?? '';

if ($origin !== '' && in_array($origin, $allowedOrigins, true)) {
    header("Access-Control-Allow-Origin: {$origin}");
    header('Access-Control-Allow-Credentials: true');
    header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With, X-Cron-Token');
    header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
    header('Vary: Origin');
}

header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

/* =========================================================
   SESSION
   ========================================================= */

try {
    if (function_exists('startSecureSession')) {
        startSecureSession();
    } elseif (session_status() !== PHP_SESSION_ACTIVE) {
        session_name('CROWN_CASH_SESSION');

        session_set_cookie_params([
            'httponly' => true,
            'secure' => true,
            'samesite' => 'None'
        ]);

        session_start();
    }
} catch (Throwable $e) {
    if (session_status() !== PHP_SESSION_ACTIVE) {
        @session_start();
    }
}

/* =========================================================
   RESPONSE
   ========================================================= */

function earningsResponse(
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

/* =========================================================
   GENERAL HELPERS
   ========================================================= */

function earningString($value, string $default = ''): string
{
    if ($value === null) {
        return $default;
    }

    if ($value instanceof ObjectId) {
        return (string) $value;
    }

    if ($value instanceof UTCDateTime) {
        return $value->toDateTime()->format('c');
    }

    if (is_scalar($value)) {
        return trim((string) $value);
    }

    return $default;
}

function earningMoney($value, float $default = 0.0): float
{
    if ($value === null || $value === '') {
        return $default;
    }

    if (is_numeric($value)) {
        return round((float) $value, 2);
    }

    return $default;
}

function earningBool($value, bool $default = false): bool
{
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
            strtolower(trim($value)),
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

function earningObjectId($value): ?ObjectId
{
    if ($value instanceof ObjectId) {
        return $value;
    }

    $value = earningString($value);

    if (
        $value !== ''
        && preg_match('/^[a-f0-9]{24}$/i', $value)
    ) {
        try {
            return new ObjectId($value);
        } catch (Throwable $e) {
            return null;
        }
    }

    return null;
}

function earningNow(): UTCDateTime
{
    return new UTCDateTime();
}

/* =========================================================
   SESSION HELPERS
   ========================================================= */

function earningsSessionUserId(): string
{
    $values = [
        $_SESSION['user_id'] ?? null,
        $_SESSION['userId'] ?? null,
        $_SESSION['uid'] ?? null,
        $_SESSION['id'] ?? null,
        $_SESSION['user']['id'] ?? null,
        $_SESSION['user']['_id'] ?? null
    ];

    foreach ($values as $value) {
        $id = earningString($value);

        if ($id !== '') {
            return $id;
        }
    }

    return '';
}

function earningsSessionEmail(): string
{
    $values = [
        $_SESSION['email'] ?? null,
        $_SESSION['user_email'] ?? null,
        $_SESSION['user']['email'] ?? null
    ];

    foreach ($values as $value) {
        $email = earningString($value);

        if ($email !== '') {
            return strtolower($email);
        }
    }

    return '';
}

/* =========================================================
   USER HELPERS
   ========================================================= */

function getUserIdValue($user): string
{
    if (!$user) {
        return '';
    }

    foreach (
        [
            $user['_id'] ?? null,
            $user['id'] ?? null,
            $user['user_id'] ?? null
        ] as $value
    ) {
        $id = earningString($value);

        if ($id !== '') {
            return $id;
        }
    }

    return '';
}

function findUserByFlexibleId($users, string $id)
{
    $id = trim($id);

    if ($id === '') {
        return null;
    }

    $or = [];

    $oid = earningObjectId($id);

    if ($oid !== null) {
        $or[] = [
            '_id' => $oid
        ];
    }

    $or[] = [
        'id' => $id
    ];

    $or[] = [
        'user_id' => $id
    ];

    if (filter_var($id, FILTER_VALIDATE_EMAIL)) {
        $or[] = [
            'email' => strtolower($id)
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

function findSessionUser($users)
{
    $userId = earningsSessionUserId();
    $email = earningsSessionEmail();

    $or = [];

    if ($userId !== '') {
        $oid = earningObjectId($userId);

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
    }

    if ($email !== '') {
        $or[] = [
            'email' => $email
        ];
    }

    if (!$or) {
        return null;
    }

    try {
        return $users->findOne([
            '$or' => $or
        ]);
    } catch (Throwable $e) {
        return null;
    }
}

/* =========================================================
   INVESTMENT HELPERS
   ========================================================= */

function investmentId($investment): string
{
    foreach (
        [
            $investment['_id'] ?? null,
            $investment['id'] ?? null,
            $investment['investment_id'] ?? null
        ] as $value
    ) {
        $id = earningString($value);

        if ($id !== '') {
            return $id;
        }
    }

    return '';
}

function investmentUserId($investment): string
{
    foreach (
        [
            $investment['user_id'] ?? null,
            $investment['userId'] ?? null,
            $investment['userid'] ?? null,
            $investment['owner_id'] ?? null,
            $investment['ownerId'] ?? null
        ] as $value
    ) {
        $id = earningString($value);

        if ($id !== '') {
            return $id;
        }
    }

    return '';
}

function investmentPrincipal($investment): float
{
    foreach (
        [
            'amount',
            'principal',
            'investment_amount',
            'investmentAmount',
            'capital'
        ] as $field
    ) {
        if (isset($investment[$field])) {
            $amount = earningMoney(
                $investment[$field]
            );

            if ($amount > 0) {
                return $amount;
            }
        }
    }

    return 0.0;
}

function investmentDailyEarning($investment): float
{
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
            isset($investment[$field])
            && is_numeric($investment[$field])
        ) {
            $amount = round(
                (float) $investment[$field],
                2
            );

            if ($amount > 0) {
                return $amount;
            }
        }
    }

    return 0.0;
}

function investmentDailyRate($investment): float
{
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
            isset($investment[$field])
            && is_numeric($investment[$field])
        ) {
            $rate = (float) $investment[$field];

            if ($rate <= 0) {
                continue;
            }

            /*
             * Support both:
             * 0.10 = 10%
             * 10    = 10%
             */
            if ($rate > 1) {
                $rate = $rate / 100;
            }

            return $rate;
        }
    }

    return 0.0;
}

function investmentDuration($investment): int
{
    foreach (
        [
            'duration_days',
            'durationDays',
            'duration',
            'days',
            'term_days'
        ] as $field
    ) {
        if (isset($investment[$field])) {
            $days = (int) $investment[$field];

            if ($days > 0) {
                return $days;
            }
        }
    }

    return 0;
}

function investmentStatus($investment): string
{
    return strtolower(
        earningString(
            $investment['status']
            ?? $investment['state']
            ?? ''
        )
    );
}

function investmentIsApproved($investment): bool
{
    $status = investmentStatus($investment);

    if (
        in_array(
            $status,
            [
                'approved',
                'active',
                'running',
                'in_progress',
                'in-progress'
            ],
            true
        )
    ) {
        return true;
    }

    return earningBool(
        $investment['admin_approved']
        ?? $investment['approved']
        ?? $investment['is_approved']
        ?? false
    );
}

function investmentBalanceDeducted($investment): bool
{
    return earningBool(
        $investment['balance_deducted']
        ?? false
    );
}

function investmentPrincipalReturned($investment): bool
{
    return earningBool(
        $investment['principal_returned']
        ?? false
    );
}

/* =========================================================
   INVESTMENT START DATE
   ========================================================= */

function investmentActivationDate($investment): ?DateTimeImmutable
{
    $fields = [
        'activated_at',
        'activation_date',
        'approved_at',
        'approval_date',
        'started_at',
        'start_date'
    ];

    foreach ($fields as $field) {
        if (!isset($investment[$field])) {
            continue;
        }

        $value = $investment[$field];

        try {
            if ($value instanceof UTCDateTime) {
                return new DateTimeImmutable(
                    $value->toDateTime()->format('c'),
                    new DateTimeZone('UTC')
                );
            }

            if ($value instanceof DateTimeInterface) {
                return new DateTimeImmutable(
                    $value->format('c'),
                    new DateTimeZone('UTC')
                );
            }

            if (
                is_string($value)
                && trim($value) !== ''
            ) {
                return new DateTimeImmutable(
                    $value,
                    new DateTimeZone('UTC')
                );
            }
        } catch (Throwable $e) {
            continue;
        }
    }

    return null;
}

/* =========================================================
   WALLET HELPERS
   ========================================================= */

function userWalletBalance($user): float
{
    if (!$user) {
        return 0.0;
    }

    foreach (
        [
            'balance',
            'wallet_balance',
            'walletBalance'
        ] as $field
    ) {
        if (
            isset($user[$field])
            && is_numeric($user[$field])
        ) {
            return round(
                (float) $user[$field],
                2
            );
        }
    }

    if (
        isset($user['wallet'])
        && is_array($user['wallet'])
        && isset($user['wallet']['balance'])
        && is_numeric($user['wallet']['balance'])
    ) {
        return round(
            (float) $user['wallet']['balance'],
            2
        );
    }

    return 0.0;
}

function userWalletFilter($user): array
{
    $id = getUserIdValue($user);

    if ($id === '') {
        throw new RuntimeException(
            'User ID is missing.'
        );
    }

    $oid = earningObjectId($id);

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

/**
 * Credit wallet inside the supplied MongoDB transaction.
 *
 * The user's current balance is read again using the SAME
 * transaction session.
 */
function creditWalletInsideTransaction(
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

    $filter = userWalletFilter($user);

    $currentUser = $users->findOne(
        $filter,
        [
            'session' => $session
        ]
    );

    if (!$currentUser) {
        throw new RuntimeException(
            'User account could not be found.'
        );
    }

    $before = userWalletBalance(
        $currentUser
    );

    $inc = [];

    if (array_key_exists(
        'balance',
        (array) $currentUser
    )) {
        $inc['balance'] = $amount;
    }

    if (array_key_exists(
        'wallet_balance',
        (array) $currentUser
    )) {
        $inc['wallet_balance'] = $amount;
    }

    if (array_key_exists(
        'walletBalance',
        (array) $currentUser
    )) {
        $inc['walletBalance'] = $amount;
    }

    if (
        isset($currentUser['wallet'])
        && is_array($currentUser['wallet'])
        && array_key_exists(
            'balance',
            $currentUser['wallet']
        )
    ) {
        $inc['wallet.balance'] = $amount;
    }

    if (!$inc) {
        $inc['balance'] = $amount;
    }

    $result = $users->updateOne(
        $filter,
        [
            '$inc' => $inc,
            '$set' => [
                'updated_at' => earningNow()
            ]
        ],
        [
            'session' => $session
        ]
    );

    if ($result->getMatchedCount() !== 1) {
        throw new RuntimeException(
            'Wallet update failed.'
        );
    }

    return [
        'before' => $before,
        'after' => round(
            $before + $amount,
            2
        )
    ];
}

/* =========================================================
   INVESTMENT FILTER
   ========================================================= */

function investmentMongoFilter(
    string $investmentId
): array {
    $oid = earningObjectId($investmentId);

    if ($oid !== null) {
        return [
            '_id' => $oid
        ];
    }

    return [
        '$or' => [
            [
                'id' => $investmentId
            ],
            [
                'investment_id' => $investmentId
            ]
        ]
    ];
}

/* =========================================================
   LEDGER
   ========================================================= */

function ensureEarningsLedgerIndex($earnings): void
{
    try {
        $earnings->createIndex(
            [
                'ledger_key' => 1
            ],
            [
                'unique' => true,
                'name' => 'unique_ledger_key'
            ]
        );
    } catch (Throwable $e) {
        /*
         * Index may already exist.
         * Do not stop earnings processing.
         */
    }
}

/**
 * Checks whether a deterministic ledger key already exists.
 */
function ledgerExists(
    $earnings,
    string $ledgerKey,
    $session
): bool {
    $existing = $earnings->findOne(
        [
            'ledger_key' => $ledgerKey
        ],
        [
            'projection' => [
                '_id' => 1
            ],
            'session' => $session
        ]
    );

    return $existing !== null;
}

/**
 * Inserts a ledger entry using the SAME transaction session.
 */
function insertLedgerInsideTransaction(
    $earnings,
    array $document,
    $session
): void {
    $earnings->insertOne(
        $document,
        [
            'session' => $session
        ]
    );
}

/* =========================================================
   TRANSACTION RECORD
   ========================================================= */

function upsertEarningTransaction(
    $transactions,
    string $reference,
    array $document,
    $session
): void {
    /*
     * The reference is deterministic.
     * This prevents duplicate transaction history entries
     * if the engine is called repeatedly.
     */
    $transactions->updateOne(
        [
            'reference' => $reference
        ],
        [
            '$setOnInsert' => $document
        ],
        [
            'upsert' => true,
            'session' => $session
        ]
    );
}

/* =========================================================
   PROCESS ONE EARNING
   ========================================================= */

function processOneInvestmentEarning(
    $investment,
    $users,
    $earnings,
    $transactions,
    $investments,
    $client,
    int $dayNumber
): array {
    $investmentId = investmentId(
        $investment
    );

    if ($investmentId === '') {
        return [
            'success' => false,
            'processed' => false,
            'message' => 'Investment ID is missing.'
        ];
    }

    $userId = investmentUserId(
        $investment
    );

    if ($userId === '') {
        return [
            'success' => false,
            'processed' => false,
            'message' => 'Investment owner is missing.'
        ];
    }

    if (!investmentIsApproved($investment)) {
        return [
            'success' => true,
            'processed' => false,
            'message' => 'Investment is not approved.'
        ];
    }

    /*
     * Earnings should only be processed after the investment
     * principal has actually been deducted by admin approval.
     */
    if (!investmentBalanceDeducted($investment)) {
        return [
            'success' => true,
            'processed' => false,
            'message' =>
                'Investment principal has not been deducted yet.'
        ];
    }

    if (investmentPrincipalReturned($investment)) {
        return [
            'success' => true,
            'processed' => false,
            'message' =>
                'Investment principal has already been returned.'
        ];
    }

    $principal = investmentPrincipal(
        $investment
    );

    if ($principal <= 0) {
        return [
            'success' => false,
            'processed' => false,
            'message' =>
                'Investment principal is invalid.'
        ];
    }

    $duration = investmentDuration(
        $investment
    );

    if ($duration <= 0) {
        return [
            'success' => false,
            'processed' => false,
            'message' =>
                'Investment duration is not configured.'
        ];
    }

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
     * First preference:
     * explicitly stored daily earning.
     */
    $dailyEarning = investmentDailyEarning(
        $investment
    );

    /*
     * Second preference:
     * calculate from the investment's stored rate.
     */
    if ($dailyEarning <= 0) {
        $dailyRate = investmentDailyRate(
            $investment
        );

        if ($dailyRate <= 0) {
            return [
                'success' => false,
                'processed' => false,
                'message' =>
                    'No daily earning or daily rate is configured.'
            ];
        }

        $dailyEarning = round(
            $principal * $dailyRate,
            2
        );
    }

    if ($dailyEarning <= 0) {
        return [
            'success' => false,
            'processed' => false,
            'message' =>
                'Calculated daily earning is invalid.'
        ];
    }

    $user = findUserByFlexibleId(
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
        $session = $client->startSession();

        $result = [
            'success' => false,
            'processed' => false
        ];

        $session->withTransaction(
            function () use (
                &$result,
                $investment,
                $investmentId,
                $userId,
                $user,
                $users,
                $earnings,
                $transactions,
                $investments,
                $dailyEarning,
                $dayNumber,
                $session
            ): void {
                /*
                 * Re-read the investment using the SAME session.
                 * This prevents processing a stale investment record.
                 */
                $freshInvestment = $investments->findOne(
                    investmentMongoFilter(
                        $investmentId
                    ),
                    [
                        'session' => $session
                    ]
                );

                if (!$freshInvestment) {
                    throw new RuntimeException(
                        'Investment no longer exists.'
                    );
                }

                if (
                    !investmentIsApproved(
                        $freshInvestment
                    )
                ) {
                    $result = [
                        'success' => true,
                        'processed' => false,
                        'message' =>
                            'Investment is no longer approved.'
                    ];

                    return;
                }

                if (
                    !investmentBalanceDeducted(
                        $freshInvestment
                    )
                ) {
                    $result = [
                        'success' => true,
                        'processed' => false,
                        'message' =>
                            'Investment principal is not deducted.'
                    ];

                    return;
                }

                /*
                 * Deterministic idempotency key.
                 */
                $ledgerKey =
                    'investment_earning:'
                    . $investmentId
                    . ':'
                    . $dayNumber;

                /*
                 * If already credited, DO NOT credit wallet again.
                 */
                if (
                    ledgerExists(
                        $earnings,
                        $ledgerKey,
                        $session
                    )
                ) {
                    $result = [
                        'success' => true,
                        'processed' => false,
                        'duplicate' => true,
                        'daily_earning' => 0,
                        'day_number' => $dayNumber,
                        'message' =>
                            'This daily earning was already processed.'
                    ];

                    return;
                }

                /*
                 * Re-read user inside the SAME transaction.
                 */
                $freshUser = $users->findOne(
                    userWalletFilter($user),
                    [
                        'session' => $session
                    ]
                );

                if (!$freshUser) {
                    throw new RuntimeException(
                        'User account could not be found.'
                    );
                }

                $balanceBefore =
                    userWalletBalance(
                        $freshUser
                    );

                /*
                 * -------------------------------------------------
                 * 1. LEDGER
                 * -------------------------------------------------
                 */
                insertLedgerInsideTransaction(
                    $earnings,
                    [
                        'ledger_key' => $ledgerKey,
                        'type' => 'investment_earning',
                        'earning_type' =>
                            'daily_investment_earning',
                        'user_id' =>
                            $freshUser['_id']
                            ?? earningObjectId($userId)
                            ?? $userId,
                        'userId' => $userId,
                        'investment_id' =>
                            earningObjectId($investmentId)
                            ?? $investmentId,
                        'investmentId' => $investmentId,
                        'day_number' => $dayNumber,
                        'amount' => $dailyEarning,
                        'status' => 'credited',
                        'created_at' => earningNow()
                    ],
                    $session
                );

                /*
                 * -------------------------------------------------
                 * 2. WALLET CREDIT
                 * -------------------------------------------------
                 */
                $walletResult =
                    creditWalletInsideTransaction(
                        $users,
                        $freshUser,
                        $dailyEarning,
                        $session
                    );

                /*
                 * -------------------------------------------------
                 * 3. TRANSACTION HISTORY
                 * -------------------------------------------------
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

                upsertEarningTransaction(
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
                            ?? earningObjectId($userId)
                            ?? $userId,
                        'userId' => $userId,
                        'investment_id' =>
                            earningObjectId($investmentId)
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
                        'balance_before' =>
                            $balanceBefore,
                        'balance_after' =>
                            $walletResult['after'],
                        'status' =>
                            'completed',
                        'reference' =>
                            $reference,
                        'description' =>
                            'Investment daily earning - Day '
                            . $dayNumber,
                        'created_at' =>
                            earningNow()
                    ],
                    $session
                );

                /*
                 * -------------------------------------------------
                 * 4. INVESTMENT EARNING TRACKING
                 * -------------------------------------------------
                 */
                $existingProcessed =
                    earningMoney(
                        $freshInvestment[
                            'earnings_processed'
                        ] ?? 0
                    );

                $existingTotalPaid =
                    earningMoney(
                        $freshInvestment[
                            'total_earnings_paid'
                        ] ?? 0
                    );

                $existingDays =
                    (int) (
                        $freshInvestment[
                            'earning_days'
                        ] ?? 0
                    );

                /*
                 * Never allow tracking counters to move
                 * backwards.
                 */
                $newDays =
                    max(
                        $existingDays,
                        $dayNumber
                    );

                $newProcessed =
                    round(
                        $existingProcessed
                        + $dailyEarning,
                        2
                    );

                $newTotalPaid =
                    round(
                        $existingTotalPaid
                        + $dailyEarning,
                        2
                    );

                $now = earningNow();

                $nextDate =
                    new DateTimeImmutable(
                        'now',
                        new DateTimeZone('UTC')
                    );

                $nextDate =
                    $nextDate->modify('+1 day');

                $nextEarningDate =
                    new UTCDateTime(
                        $nextDate->getTimestamp()
                        * 1000
                    );

                $investmentUpdate = [
                    '$set' => [
                        'earnings_processed' =>
                            $newProcessed,
                        'total_earnings_paid' =>
                            $newTotalPaid,
                        'earning_days' =>
                            $newDays,
                        'last_earning_date' =>
                            $now,
                        'next_earning_date' =>
                            $nextEarningDate,
                        'updated_at' =>
                            $now
                    ]
                ];

                $updateResult =
                    $investments->updateOne(
                        investmentMongoFilter(
                            $investmentId
                        ),
                        $investmentUpdate,
                        [
                            'session' => $session
                        ]
                    );

                if (
                    $updateResult->getMatchedCount()
                    !== 1
                ) {
                    throw new RuntimeException(
                        'Investment earnings tracking could not be updated.'
                    );
                }

                $result = [
                    'success' => true,
                    'processed' => true,
                    'duplicate' => false,
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
                        $walletResult['after']
                ];
            }
        );

        return $result;
    } catch (Throwable $e) {
        error_log(
            'Crown Cash daily earnings error: '
            . $e->getMessage()
        );

        return [
            'success' => false,
            'processed' => false,
            'message' =>
                'The daily earning could not be processed.'
        ];
    } finally {
        if ($session !== null) {
            try {
                $session->endSession();
            } catch (Throwable $e) {
                // Ignore cleanup errors.
            }
        }
    }
}

/* =========================================================
   DETERMINE DUE DAY
   ========================================================= */

function investmentElapsedFullDays(
    $investment,
    DateTimeImmutable $now
): int {
    $activation =
        investmentActivationDate(
            $investment
        );

    if (!$activation) {
        return 0;
    }

    $activation =
        $activation->setTimezone(
            new DateTimeZone('UTC')
        );

    $seconds =
        $now->getTimestamp()
        - $activation->getTimestamp();

    if ($seconds <= 0) {
        return 0;
    }

    return (int) floor(
        $seconds / 86400
    );
}

/* =========================================================
   PROCESS ALL
   ========================================================= */

function processDailyEarnings(
    $investments,
    $users,
    $earnings,
    $transactions,
    $client
): array {
    ensureEarningsLedgerIndex(
        $earnings
    );

    $now =
        new DateTimeImmutable(
            'now',
            new DateTimeZone('UTC')
        );

    /*
     * Only approved/active investments.
     */
    $filter = [
        'status' => [
            '$in' => [
                'approved',
                'active',
                'running',
                'in_progress',
                'in-progress'
            ]
        ],
        'balance_deducted' => true,
        'principal_returned' => [
            '$ne' => true
        ]
    ];

    $cursor =
        $investments->find(
            $filter,
            [
                'sort' => [
                    'created_at' => 1
                ],
                'limit' => 5000
            ]
        );

    $processedInvestments = 0;
    $skippedInvestments = 0;
    $failedInvestments = 0;
    $duplicateInvestments = 0;

    $totalEarnings = 0.0;

    foreach ($cursor as $investment) {
        try {
            if (
                !investmentIsApproved(
                    $investment
                )
            ) {
                $skippedInvestments++;
                continue;
            }

            if (
                !investmentBalanceDeducted(
                    $investment
                )
            ) {
                $skippedInvestments++;
                continue;
            }

            $duration =
                investmentDuration(
                    $investment
                );

            if ($duration <= 0) {
                $skippedInvestments++;
                continue;
            }

            $elapsedDays =
                investmentElapsedFullDays(
                    $investment,
                    $now
                );

            if ($elapsedDays < 1) {
                $skippedInvestments++;
                continue;
            }

            /*
             * Do not process future days.
             */
            $targetDay =
                min(
                    $elapsedDays,
                    $duration
                );

            /*
             * Resume from the investment's tracked earning
             * day. This allows catch-up if the scheduler was
             * offline for several days.
             */
            $alreadyProcessedDays =
                max(
                    0,
                    (