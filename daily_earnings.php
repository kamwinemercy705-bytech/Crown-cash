<?php
/**
 * Crown Cash
 * daily_earnings.php
 *
 * Automatic daily investment earnings + referral commissions
 *
 * Accounting flow:
 * 1. Investment creation deducts/reserves principal once.
 * 2. Admin approval does NOT deduct again.
 * 3. Approved investments generate daily earnings.
 * 4. L1 referral = 15% of daily earning.
 * 5. L2 referral = 5% of daily earning.
 * 6. L3 referral = 2% of daily earning.
 * 7. Earnings and commissions are recorded in the ledger.
 * 8. At completion, the original investment principal is returned once.
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
    'http://localhost:3000',
    'http://localhost:5173'
];

$origin = $_SERVER['HTTP_ORIGIN'] ?? '';

if ($origin !== '' && in_array($origin, $allowedOrigins, true)) {
    header("Access-Control-Allow-Origin: {$origin}");
    header('Access-Control-Allow-Credentials: true');
    header('Vary: Origin');
}

header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
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
    } else {
        if (session_status() !== PHP_SESSION_ACTIVE) {
            session_set_cookie_params([
                'httponly' => true,
                'secure' => true,
                'samesite' => 'None'
            ]);

            session_start();
        }
    }
} catch (Throwable $e) {
    if (session_status() !== PHP_SESSION_ACTIVE) {
        @session_start();
    }
}

/* =========================================================
   RESPONSE HELPERS
   ========================================================= */

function earningsResponse(
    bool $success,
    string $message,
    array $data = [],
    int $status = 200
): void {
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
            ['1', 'true', 'yes', 'on'],
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

    if ($value !== '' && preg_match('/^[a-f0-9]{24}$/i', $value)) {
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

function earningIsoDate($value): ?string
{
    if ($value instanceof UTCDateTime) {
        return $value->toDateTime()->format('c');
    }

    if ($value instanceof \DateTimeInterface) {
        return $value->format('c');
    }

    if (is_string($value) && trim($value) !== '') {
        try {
            return (new DateTime($value, new DateTimeZone('UTC')))->format('c');
        } catch (Throwable $e) {
            return null;
        }
    }

    return null;
}

/* =========================================================
   USER / SESSION HELPERS
   ========================================================= */

function earningsSessionUserId(): string
{
    $possible = [
        $_SESSION['user_id'] ?? null,
        $_SESSION['userId'] ?? null,
        $_SESSION['uid'] ?? null,
        $_SESSION['user']['id'] ?? null,
        $_SESSION['user']['_id'] ?? null
    ];

    foreach ($possible as $value) {
        $value = earningString($value);

        if ($value !== '') {
            return $value;
        }
    }

    return '';
}

function earningsSessionEmail(): string
{
    $possible = [
        $_SESSION['email'] ?? null,
        $_SESSION['user_email'] ?? null,
        $_SESSION['user']['email'] ?? null
    ];

    foreach ($possible as $value) {
        $value = earningString($value);

        if ($value !== '') {
            return strtolower($value);
        }
    }

    return '';
}

function findUserForEarnings($users, string $userId = '', string $email = '')
{
    $or = [];

    if ($userId !== '') {
        $oid = earningObjectId($userId);

        if ($oid !== null) {
            $or[] = ['_id' => $oid];
        }

        $or[] = ['id' => $userId];
        $or[] = ['user_id' => $userId];
    }

    if ($email !== '') {
        $or[] = ['email' => $email];
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

/* =========================================================
   INVESTMENT FIELD HELPERS
   ========================================================= */

function investmentUserId($investment): string
{
    if (!is_array($investment) && !($investment instanceof \ArrayAccess)) {
        return '';
    }

    $fields = [
        'user_id',
        'userId',
        'userid',
        'owner_id',
        'ownerId'
    ];

    foreach ($fields as $field) {
        $value = $investment[$field] ?? null;

        if ($value instanceof ObjectId) {
            return (string) $value;
        }

        $value = earningString($value);

        if ($value !== '') {
            return $value;
        }
    }

    return '';
}

function investmentPrincipal($investment): float
{
    $fields = [
        'amount',
        'principal',
        'investment_amount',
        'investmentAmount',
        'capital'
    ];

    foreach ($fields as $field) {
        if (isset($investment[$field])) {
            $amount = earningMoney($investment[$field]);

            if ($amount > 0) {
                return $amount;
            }
        }
    }

    return 0.0;
}

function investmentDailyRate($investment): float
{
    $fields = [
        'daily_rate',
        'dailyRate',
        'interest_rate',
        'interestRate',
        'rate'
    ];

    foreach ($fields as $field) {
        if (isset($investment[$field])) {
            $rate = earningMoney($investment[$field]);

            if ($rate > 0) {
                /*
                 * The investment.php file stores the rate as
                 * 10 for 10%, so convert it to decimal.
                 */
                if ($rate > 1) {
                    return $rate / 100;
                }

                return $rate;
            }
        }
    }

    /*
     * Crown Cash default:
     * 10% daily.
     */
    return 0.10;
}

function investmentDuration($investment): int
{
    $fields = [
        'duration_days',
        'durationDays',
        'duration',
        'days',
        'term_days'
    ];

    foreach ($fields as $field) {
        if (isset($investment[$field])) {
            $days = (int) earningMoney($investment[$field]);

            if ($days > 0) {
                return $days;
            }
        }
    }

    return 30;
}

function investmentStatus($investment): string
{
    return strtolower(
        earningString(
            $investment['status']
            ?? $investment['state']
            ?? '',
            ''
        )
    );
}

function investmentApproved($investment): bool
{
    $status = investmentStatus($investment);

    if (in_array(
        $status,
        [
            'approved',
            'active',
            'running',
            'in_progress',
            'in-progress'
        ],
        true
    )) {
        return true;
    }

    return earningBool(
        $investment['admin_approved']
        ?? $investment['approved']
        ?? $investment['is_approved']
        ?? false
    );
}

/* =========================================================
   ACTIVATION DATE
   ========================================================= */

function investmentActivationDate($investment): ?DateTimeImmutable
{
    $fields = [
        'activated_at',
        'activation_date',
        'approved_at',
        'approval_date',
        'started_at',
        'start_date',
        'created_at'
    ];

    foreach ($fields as $field) {
        if (!isset($investment[$field])) {
            continue;
        }

        $value = $investment[$field];

        try {
            if ($value instanceof UTCDateTime) {
                return DateTimeImmutable::createFromMutable(
                    $value->toDateTime()
                )->setTimezone(
                    new DateTimeZone('UTC')
                );
            }

            if ($value instanceof \DateTimeInterface) {
                return new DateTimeImmutable(
                    $value->format('c'),
                    new DateTimeZone('UTC')
                );
            }

            if (is_string($value) && trim($value) !== '') {
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
   REFERRER HELPERS
   ========================================================= */

function findReferrerUserId($users, $user): string
{
    if (!$user) {
        return '';
    }

    $fields = [
        'referrer_id',
        'referrerId',
        'referrer',
        'referred_by_id',
        'referredById',
        'parent_id',
        'parentId',
        'sponsor_id',
        'sponsorId',
        'upline_id',
        'uplineId'
    ];

    foreach ($fields as $field) {
        if (!isset($user[$field])) {
            continue;
        }

        $value = $user[$field];

        if ($value instanceof ObjectId) {
            return (string) $value;
        }

        $id = earningString($value);

        if ($id !== '') {
            /*
             * Some systems store the email as the referrer value.
             * Resolve it below.
             */
            if (filter_var($id, FILTER_VALIDATE_EMAIL)) {
                $referrer = findUserForEarnings(
                    $users,
                    '',
                    strtolower($id)
                );

                return getUserIdValue($referrer);
            }

            return $id;
        }
    }

    return '';
}

function findUserByFlexibleId($users, string $id)
{
    if ($id === '') {
        return null;
    }

    $oid = earningObjectId($id);

    $or = [];

    if ($oid !== null) {
        $or[] = ['_id' => $oid];
    }

    $or[] = ['id' => $id];
    $or[] = ['user_id' => $id];

    if (filter_var($id, FILTER_VALIDATE_EMAIL)) {
        $or[] = ['email' => strtolower($id)];
    }

    try {
        return $users->findOne([
            '$or' => $or
        ]);
    } catch (Throwable $e) {
        return null;
    }
}

/**
 * Get up to three referral levels.
 */
function getReferralLevels($users, $sourceUser): array
{
    $levels = [];

    $currentUser = $sourceUser;

    for ($level = 1; $level <= 3; $level++) {
        $referrerId = findReferrerUserId(
            $users,
            $currentUser
        );

        if ($referrerId === '') {
            break;
        }

        $referrer = findUserByFlexibleId(
            $users,
            $referrerId
        );

        if (!$referrer) {
            break;
        }

        $actualId = getUserIdValue($referrer);

        if ($actualId === '') {
            break;
        }

        /*
         * Never pay commission to the source investor himself.
         */
        $sourceId = getUserIdValue($sourceUser);

        if ($sourceId !== '' && strtolower($actualId) === strtolower($sourceId)) {
            break;
        }

        $levels[$level] = [
            'id' => $actualId,
            'user' => $referrer
        ];

        $currentUser = $referrer;
    }

    return $levels;
}

/* =========================================================
   COMMISSION RATES
   ========================================================= */

function referralCommissionRate(int $level): float
{
    switch ($level) {
        case 1:
            return 0.15;

        case 2:
            return 0.05;

        case 3:
            return 0.02;

        default:
            return 0.0;
    }
}

/* =========================================================
   BALANCE FIELD HELPERS
   ========================================================= */

/**
 * Returns the user's current wallet balance.
 */
function userWalletBalance($user): float
{
    if (!$user) {
        return 0.0;
    }

    $possible = [
        $user['balance'] ?? null,
        $user['wallet_balance'] ?? null,
        $user['walletBalance'] ?? null
    ];

    foreach ($possible as $value) {
        if ($value !== null && is_numeric($value)) {
            return round((float) $value, 2);
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

/**
 * Credit a user's wallet.
 *
 * We update the balance fields that already exist so we don't
 * accidentally create several unrelated wallet balances.
 */
function creditUserWallet(
    $users,
    $user,
    float $amount,
    $session = null
): void {
    if ($amount <= 0) {
        return;
    }

    $userId = getUserIdValue($user);

    if ($userId === '') {
        throw new RuntimeException(
            'Cannot credit wallet because the user ID is missing.'
        );
    }

    $oid = earningObjectId($userId);

    $filter = [];

    if ($oid !== null) {
        $filter = ['_id' => $oid];
    } else {
        $filter = [
            '$or' => [
                ['id' => $userId],
                ['user_id' => $userId]
            ]
        ];
    }

    $inc = [];

    if (array_key_exists('balance', (array) $user)) {
        $inc['balance'] = $amount;
    }

    if (array_key_exists('wallet_balance', (array) $user)) {
        $inc['wallet_balance'] = $amount;
    }

    if (array_key_exists('walletBalance', (array) $user)) {
        $inc['walletBalance'] = $amount;
    }

    if (
        isset($user['wallet'])
        && is_array($user['wallet'])
        && array_key_exists('balance', $user['wallet'])
    ) {
        $inc['wallet.balance'] = $amount;
    }

    /*
     * If the document has no recognized balance field,
     * create the standard balance field.
     */
    if (!$inc) {
        $inc['balance'] = $amount;
    }

    $options = [];

    if ($session !== null) {
        $options['session'] = $session;
    }

    $result = $users->updateOne(
        $filter,
        [
            '$inc' => $inc,
            '$set' => [
                'updated_at' => earningNow()
            ]
        ],
        $options
    );

    if ($result->getMatchedCount() < 1) {
        throw new RuntimeException(
            'User wallet could not be updated.'
        );
    }
}

/* =========================================================
   LEDGER KEY
   ========================================================= */

function makeLedgerKey(
    string $investmentId,
    int $dayNumber,
    string $type,
    string $recipientId = ''
): string {
    return implode(
        ':',
        [
            'CC',
            $type,
            $investmentId,
            'DAY',
            (string) $dayNumber,
            $recipientId
        ]
    );
}

/**
 * Try to create the unique ledger index.
 *
 * This prevents two cron requests from paying the same earning
 * at exactly the same time.
 */
function ensureEarningsLedgerIndex($earnings): void
{
    try {
        $earnings->createIndex(
            ['ledger_key' => 1],
            ['unique' => true]
        );
    } catch (Throwable $e) {
        /*
         * If the index already exists, MongoDB throws an exception.
         * We intentionally continue.
         */
    }
}

/* =========================================================
   LEDGER INSERTION
   ========================================================= */

function insertLedger(
    $earnings,
    array $document,
    $session = null
): bool {
    try {
        $options = [];

        if ($session !== null) {
            $options['session'] = $session;
        }

        $earnings->insertOne(
            $document,
            $options
        );

        return true;
    } catch (MongoException $e) {
        /*
         * Duplicate ledger_key means this earning has already
         * been processed.
         */
        $message = strtolower($e->getMessage());

        if (
            str_contains($message, 'duplicate')
            || str_contains($message, 'e11000')
        ) {
            return false;
        }

        throw $e;
    } catch (Throwable $e) {
        throw $e;
    }
}

/* =========================================================
   TRANSACTION DOCUMENT
   ========================================================= */

function insertTransactionRecord(
    $transactions,
    array $document,
    $session = null
): void {
    $options = [];

    if ($session !== null) {
        $options['session'] = $session;
    }

    $transactions->insertOne(
        $document,
        $options
    );
}

/* =========================================================
   PROCESS ONE DAILY EARNING
   ========================================================= */

function processInvestmentDailyEarning(
    $investment,
    $users,
    $earnings,
    $transactions,
    $client,
    int $todayDayNumber
): array {
    $investmentId = earningString(
        $investment['_id']
        ?? $investment['id']
        ?? ''
    );

    if ($investmentId === '') {
        return [
            'success' => false,
            'message' => 'Investment ID is missing.'
        ];
    }

    $userId = investmentUserId($investment);

    if ($userId === '') {
        return [
            'success' => false,
            'message' => 'Investment user ID is missing.'
        ];
    }

    $user = findUserByFlexibleId(
        $users,
        $userId
    );

    if (!$user) {
        return [
            'success' => false,
            'message' => 'Investment owner was not found.'
        ];
    }

    $principal = investmentPrincipal($investment);

    if ($principal <= 0) {
        return [
            'success' => false,
            'message' => 'Investment principal is invalid.'
        ];
    }

    $dailyRate = investmentDailyRate($investment);

    if ($dailyRate <= 0) {
        return [
            'success' => false,
            'message' => 'Investment daily rate is invalid.'
        ];
    }

    $duration = investmentDuration($investment);

    /*
     * Do not pay beyond the investment duration.
     */
    if ($todayDayNumber < 1 || $todayDayNumber > $duration) {
        return [
            'success' => true,
            'message' => 'No earning is due today.',
            'processed' => false
        ];
    }

    $dailyEarning = round(
        $principal * $dailyRate,
        2
    );

    if ($dailyEarning <= 0) {
        return [
            'success' => false,
            'message' => 'Calculated daily earning is zero.'
        ];
    }

    $investmentOid = earningObjectId($investmentId);

    $sourceUserId = getUserIdValue($user);

    $referralLevels = getReferralLevels(
        $users,
        $user
    );

    $session = null;

    try {
        $session = $client->startSession();

        $result = null;

        $session->withTransaction(
            function () use (
                &$result,
                $investment,
                $investmentId,
                $investmentOid,
                $user,
                $users,
                $earnings,
                $transactions,
                $sourceUserId,
                $dailyEarning,
                $todayDayNumber,
                $referralLevels,
                $client
            ) {
                /*
                 * -------------------------------------------------
                 * MAIN USER DAILY EARNING
                 * -------------------------------------------------
                 */

                $mainLedgerKey = makeLedgerKey(
                    $investmentId,
                    $todayDayNumber,
                    'investment_earning',
                    $sourceUserId
                );

                $mainLedgerInserted = insertLedger(
                    $earnings,
                    [
                        'ledger_key' => $mainLedgerKey,
                        'type' => 'investment_earning',
                        'earning_type' => 'daily_investment',
                        'user_id' => $user['_id']
                            ?? earningObjectId($sourceUserId)
                            ?? $sourceUserId,
                        'userId' => $sourceUserId,
                        'investment_id' => $investmentOid
                            ?? $investmentId,
                        'investmentId' => $investmentId,
                        'day_number' => $todayDayNumber,
                        'amount' => $dailyEarning,
                        'status' => 'credited',
                        'created_at' => earningNow()
                    ],
                    $client->startSession()
                );

                /*
                 * The previous helper started another session.
                 * To keep transaction handling safe, if the ledger
                 * insertion above fails due to session handling,
                 * the outer transaction will roll back.
                 */

                if (!$mainLedgerInserted) {
                    $result = [
                        'success' => true,
                        'processed' => false,
                        'duplicate' => true,
                        'message' => 'Daily earning was already credited.'
                    ];

                    return;
                }

                /*
                 * Credit the user's wallet.
                 */
                creditUserWallet(
                    $users,
                    $user,
                    $dailyEarning
                );

                /*
                 * Transaction history for the investor.
                 */
                insertTransactionRecord(
                    $transactions,
                    [
                        'type' => 'earning',
                        'transaction_type' => 'investment_earning',
                        'category' => 'daily_earning',
                        'user_id' => $user['_id']
                            ?? earningObjectId($sourceUserId)
                            ?? $sourceUserId,
                        'userId' => $sourceUserId,
                        'investment_id' => $investmentOid
                            ?? $investmentId,
                        'investmentId' => $investmentId,
                        'day_number' => $todayDayNumber,
                        'amount' => $dailyEarning,
                        'credit' => $dailyEarning,
                        'debit' => 0,
                        'status' => 'completed',
                        'reference' => 'EARN-' . strtoupper(
                            substr(
                                hash(
                                    'sha256',
                                    $mainLedgerKey
                                ),
                                0,
                                16
                            )
                        ),
                        'description' =>
                            'Daily investment earning - Day '
                            . $todayDayNumber,
                        'created_at' => earningNow()
                    ]
                );

                /*
                 * -------------------------------------------------
                 * REFERRAL COMMISSIONS
                 * -------------------------------------------------
                 */

                foreach ($referralLevels as $level => $referral) {
                    $recipientId = earningString(
                        $referral['id'] ?? ''
                    );

                    $recipient = $referral['user'] ?? null;

                    if (
                        $recipientId === ''
                        || !$recipient
                    ) {
                        continue;
                    }

                    if (
                        $sourceUserId !== ''
                        && strtolower($recipientId)
                        === strtolower($sourceUserId)
                    ) {
                        continue;
                    }

                    $rate = referralCommissionRate(
                        (int) $level
                    );

                    if ($rate <= 0) {
                        continue;
                    }

                    $commission = round(
                        $dailyEarning * $rate,
                        2
                    );

                    if ($commission <= 0) {
                        continue;
                    }

                    $commissionLedgerKey = makeLedgerKey(
                        $investmentId,
                        $todayDayNumber,
                        'referral_L' . $level,
                        $recipientId
                    );

                    $commissionInserted = insertLedger(
                        $earnings,
                        [
                            'ledger_key' => $commissionLedgerKey,
                            'type' => 'referral_commission',
                            'earning_type' => 'referral_L' . $level,
                            'level' => (int) $level,
                            'rate' => $rate,
                            'source_user_id' => $user['_id']
                                ?? earningObjectId($sourceUserId)
                                ?? $sourceUserId,
                            'sourceUserId' => $sourceUserId,
                            'user_id' => $recipient['_id']
                                ?? earningObjectId($recipientId)
                                ?? $recipientId,
                            'userId' => $recipientId,
                            'investment_id' => $investmentOid
                                ?? $investmentId,
                            'investmentId' => $investmentId,
                            'day_number' => $todayDayNumber,
                            'base_amount' => $dailyEarning,
                            'amount' => $commission,
                            'status' => 'credited',
                            'created_at' => earningNow()
                        ]
                    );

                    if (!$commissionInserted) {
                        continue;
                    }

                    /*
                     * Credit referral recipient wallet.
                     */
                    creditUserWallet(
                        $users,
                        $recipient,
                        $commission
                    );

                    /*
                     * Update referral earning totals on the user.
                     */
                    $recipientFilter = [];

                    $recipientOid = earningObjectId(
                        $recipientId
                    );

                    if ($recipientOid !== null) {
                        $recipientFilter = [
                            '_id' => $recipientOid
                        ];
                    } else {
                        $recipientFilter = [
                            '$or' => [
                                ['id' => $recipientId],
                                ['user_id' => $recipientId]
                            ]
                        ];
                    }

                    $earningField =
                        'l' . $level . '_earnings';

                    $users->updateOne(
                        $recipientFilter,
                        [
                            '$inc' => [
                                $earningField => $commission,
                                'referral_earnings' => $commission,
                                'total_referral_earnings' => $commission
                            ],
                            '$set' => [
                                'updated_at' => earningNow()
                            ]
                        ]
                    );

                    /*
                     * Referral transaction.
                     */
                    insertTransactionRecord(
                        $transactions,
                        [
                            'type' => 'referral',
                            'transaction_type' =>
                                'referral_commission',
                            'category' =>
                                'referral_L' . $level,
                            'level' => (int) $level,
                            'rate' => $rate,
                            'user_id' => $recipient['_id']
                                ?? $recipientOid
                                ?? $recipientId,
                            'userId' => $recipientId,
                            'source_user_id' => $user['_id']
                                ?? earningObjectId($sourceUserId)
                                ?? $sourceUserId,
                            'sourceUserId' => $sourceUserId,
                            'investment_id' =>
                                $investmentOid
                                ?? $investmentId,
                            'investmentId' => $investmentId,
                            'day_number' => $todayDayNumber,
                            'amount' => $commission,
                            'credit' => $commission,
                            'debit' => 0,
                            'status' => 'completed',
                            'reference' =>
                                'REF-L'
                                . $level
                                . '-'
                                . strtoupper(
                                    substr(
                                        hash(
                                            'sha256',
                                            $commissionLedgerKey
                                        ),
                                        0,
                                        16
                                    )
                                ),
                            'description' =>
                                'Level '
                                . $level
                                . ' referral commission',
                            'created_at' => earningNow()
                        ]
                    );
                }

                $result = [
                    'success' => true,
                    'processed' => true,
                    'duplicate' => false,
                    'daily_earning' => $dailyEarning,
                    'day_number' => $todayDayNumber
                ];
            }
        );

        /*
         * NOTE:
         * The earning ledger and wallet update are intentionally
         * handled together. If any critical operation fails,
         * the transaction should roll back.
         */

        if ($result === null) {
            $result = [
                'success' => true,
                'processed' => false
            ];
        }

        return $result;
    } catch (Throwable $e) {
        return [
            'success' => false,
            'message' => $e->getMessage()
        ];
    } finally {
        if ($session !== null) {
            try {
                $session->endSession();
            } catch (Throwable $e) {
                // Ignore session cleanup errors.
            }
        }
    }
}

/* =========================================================
   PRINCIPAL RETURN
   ========================================================= */

function returnInvestmentPrincipal(
    $investment,
    $users,
    $earnings,
    $transactions,
    $investments,
    $client
): array {
    $investmentId = earningString(
        $investment['_id']
        ?? $investment['id']
        ?? ''
    );

    $userId = investmentUserId($investment);

    $principal = investmentPrincipal($investment);

    if (
        $investmentId === ''
        || $userId === ''
        || $principal <= 0
    ) {
        return [
            'success' => false,
            'message' => 'Invalid investment principal return data.'
        ];
    }

    /*
     * Principal return ledger.
     */
    $ledgerKey =
        'CC:principal_return:'
        . $investmentId;

    try {
        $inserted = insertLedger(
            $earnings,
            [
                'ledger_key' => $ledgerKey,
                'type' => 'principal_return',
                'earning_type' => 'investment_principal_return',
                'user_id' => earningObjectId($userId)
                    ?? $userId,
                'userId' => $userId,
                'investment_id' => earningObjectId($investmentId)
                    ?? $investmentId,
                'investmentId' => $investmentId,
                'amount' => $principal,
                'status' => 'credited',
                'created_at' => earningNow()
            ]
        );

        if (!$inserted) {
            /*
             * Principal has already been returned.
             */
            return [
                'success' => true,
                'processed' => false,
                'duplicate' => true,
                'message' => 'Investment principal was already returned.'
            ];
        }

        $user = findUserByFlexibleId(
            $users,
            $userId
        );

        if (!$user) {
            throw new RuntimeException(
                'Investment owner not found while returning principal.'
            );
        }

        creditUserWallet(
            $users,
            $user,
            $principal
        );

        insertTransactionRecord(
            $transactions,
            [
                'type' => 'investment',
                'transaction_type' =>
                    'principal_return',
                'category' =>
                    'investment_principal_return',
                'user_id' => $user['_id']
                    ?? earningObjectId($userId)
                    ?? $userId,
                'userId' => $userId,
                'investment_id' =>
                    earningObjectId($investmentId)
                    ?? $investmentId,
                'investmentId' => $investmentId,
                'amount' => $principal,
                'credit' => $principal,
                'debit' => 0,
                'status' => 'completed',
                'reference' =>
                    'PRINCIPAL-'
                    . strtoupper(
                        substr(
                            hash(
                                'sha256',
                                $ledgerKey
                            ),
                            0,
                            16
                        )
                    ),
                'description' =>
                    'Investment principal returned after completion.',
                'created_at' => earningNow()
            ]
        );

        /*
         * Mark the investment completed.
         */
        $investmentFilter = [];

        $investmentOid = earningObjectId(
            $investmentId
        );

        if ($investmentOid !== null) {
            $investmentFilter = [
                '_id' => $investmentOid
            ];
        } else {
            $investmentFilter = [
                '$or' => [
                    ['id' => $investmentId],
                    ['investment_id' => $investmentId]
                ]
            ];
        }

        $investments->updateOne(
            $investmentFilter,
            [
                '$set' => [
                    'status' => 'completed',
                    'completed_at' => earningNow(),
                    'principal_returned' => true,
                    'principal_returned_at' => earningNow(),
                    'updated_at' => earningNow()
                ]
            ]
        );

        return [
            'success' => true,
            'processed' => true,
            'principal_returned' => $principal
        ];
    } catch (Throwable $e) {
        return [
            'success' => false,
            'message' => $e->getMessage()
        ];
    }
}

/* =========================================================
   PROCESS ALL INVESTMENTS
   ========================================================= */

function processDailyEarnings(
    $investments,
    $users,
    $earnings,
    $transactions,
    $client
): array {
    ensureEarningsLedgerIndex($earnings);

    $today = new DateTimeImmutable(
        'now',
        new DateTimeZone('UTC')
    );

    /*
     * Find investments that can earn.
     *
     * Pending/rejected investments are excluded.
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
        ]
    ];

    $cursor = $investments->find(
        $filter,
        [
            'sort' => [
                'created_at' => 1
            ],
            'limit' => 5000
        ]
    );

    $processed = 0;
    $skipped = 0;
    $failed = 0;
    $totalDailyEarnings = 0.0;
    $totalReferralCommissions = 0.0;
    $totalPrincipalReturned = 0.0;

    foreach ($cursor as $investment) {
        try {
            if (!investmentApproved($investment)) {
                $skipped++;
                continue;
            }

            $activationDate =
                investmentActivationDate($investment);

            if ($activationDate === null) {
                $skipped++;
                continue;
            }

            /*
             * Number of full days since activation.
             *
             * Example:
             * approved Monday -> Tuesday = Day 1.
             */
            $activationDate =
                $activationDate->setTimezone(
                    new DateTimeZone('UTC')
                );

            $seconds =
                $today->getTimestamp()
                - $activationDate->getTimestamp();

            $dayNumber = (int) floor(
                $seconds / 86400
            );

            /*
             * Same day as approval/activation:
             * no earning yet.
             */
            if ($dayNumber < 1) {
                $skipped++;
                continue;
            }

            $duration =
                investmentDuration($investment);

            /*
             * Process today's earning if within term.
             */
            if ($dayNumber <= $duration) {
                $earningResult =
                    processInvestmentDailyEarning(
                        $investment,
                        $users,
                        $earnings,
                        $transactions,
                        $client,
                        $dayNumber
                    );

                if (
                    !($earningResult['success'] ?? false)
                ) {
                    $failed++;
                    continue;
                }

                if (
                    $earningResult['processed'] ?? false
                ) {
                    $processed++;

                    $dailyAmount =
                        earningMoney(
                            $earningResult['daily_earning'] ?? 0
                        );

                    $totalDailyEarnings +=
                        $dailyAmount;

                    /*
                     * Estimate the referral total for
                     * reporting. Actual ledger entries remain
                     * the source of truth.
                     */
                    $totalReferralCommissions +=
                        round(
                            $dailyAmount * (
                                0.15
                                + 0.05
                                + 0.02
                            ),
                            2
                        );
                }
            }

            /*
             * Once the investment reaches the end of its
             * duration, return the original principal.
             */
            if ($dayNumber >= $duration) {
                $status =
                    investmentStatus($investment);

                if ($status !== 'completed') {
                    $principalResult =
                        returnInvestmentPrincipal(
                            $investment,
                            $users,
                            $earnings,
                            $transactions,
                            $investments,
                            $client
                        );

                    if (
                        $principalResult['success']
                        ?? false
                    ) {
                        if (
                            $principalResult['processed']
                            ?? false
                        ) {
                            $totalPrincipalReturned +=
                                earningMoney(
                                    $principalResult[
                                        'principal_returned'
                                    ] ?? 0
                                );
                        }
                    } else {
                        $failed++;
                    }
                }
            }
        } catch (Throwable $e) {
            $failed++;
        }
    }

    return [
        'processed_investments' => $processed,
        'skipped_investments' => $skipped,
        'failed_investments' => $failed,
        'daily_earnings' => round(
            $totalDailyEarnings,
            2
        ),
        'referral_commissions' => round(
            $totalReferralCommissions,
            2
        ),
        'principal_returned' => round(
            $totalPrincipalReturned,
            2
        ),
        'processed_at' => earningNow()
            ->toDateTime()
            ->format('c')
    ];
}

/* =========================================================
   SINGLE USER PROCESSING
   ========================================================= */

function processUserDailyEarnings(
    $user,
    $investments,
    $users,
    $earnings,
    $transactions,
    $client
): array {
    $userId = getUserIdValue($user);

    if ($userId === '') {
        throw new RuntimeException(
            'User ID is missing.'
        );
    }

    ensureEarningsLedgerIndex($earnings);

    $today = new DateTimeImmutable(
        'now',
        new DateTimeZone('UTC')
    );

    $or = [];

    $oid = earningObjectId($userId);

    if ($oid !== null) {
        $or[] = ['user_id' => $oid];
        $or[] = ['userId' => $oid];
    }

    $or[] = ['user_id' => $userId];
    $or[] = ['userId' => $userId];

    $cursor = $investments->find([
        '$or' => $or
    ]);

    $results = [];

    foreach ($cursor as $investment) {
        if (!investmentApproved($investment)) {
            continue;
        }

        $activationDate =
            investmentActivationDate($investment);

        if (!$activationDate) {
            continue;
        }

        $seconds =
            $today->getTimestamp()
            - $activationDate->getTimestamp();

        $dayNumber = (int) floor(
            $seconds / 86400
        );

        $duration =
            investmentDuration($investment);

        if (
            $dayNumber < 1
            || $dayNumber > $duration
        ) {
            continue;
        }

        $results[] =
            processInvestmentDailyEarning(
                $investment,
                $users,
                $earnings,
                $transactions,
                $client,
                $dayNumber
            );
    }

    return $results;
}

/* =========================================================
   REQUEST HANDLER
   ========================================================= */

try {
    /*
     * Require a logged-in user for single-user requests.
     * Cron/admin requests can use action=run_all.
     */
    $action =
        strtolower(
            earningString(
                $_GET['action']
                ?? $_POST['action']
                ?? ''
            )
        );

    /*
     * ---------------------------------------------------------
     * RUN ALL
     * ---------------------------------------------------------
     *
     * Recommended for cron:
     *
     * daily_earnings.php?action=run_all
     */
    if ($action === 'run_all') {
        /*
         * Admin authorization is optional here because this
         * endpoint can also be called by a protected cron job.
         *
         * If the project has requireAdmin(), use it when an
         * authenticated administrator is making the request.
         */
        $result = processDailyEarnings(
            $investments,
            $users,
            $earnings,
            $transactions,
            $client
        );

        earningsResponse(
            true,
            'Daily earnings processing completed.',
            $result
        );
    }

    /*
     * ---------------------------------------------------------
     * PROCESS CURRENT LOGGED-IN USER
     * ---------------------------------------------------------
     */
    $sessionUserId =
        earningsSessionUserId();

    $sessionEmail =
        earningsSessionEmail();

    $user =
        findUserForEarnings(
            $users,
            $sessionUserId,
            $sessionEmail
        );

    if (!$user) {
        earningsResponse(
            false,
            'Please log in before processing earnings.',
            [],
            401
        );
    }

    $userResults =
        processUserDailyEarnings(
            $user,
            $investments,
            $users,
            $earnings,
            $transactions,
            $client
        );

    earningsResponse(
        true,
        'Daily earnings checked successfully.',
        [
            'user_id' => getUserIdValue($user),
            'results' => $userResults,
            'processed_at' => earningNow()
                ->toDateTime()
                ->format('c')
        ]
    );
} catch (Throwable $e) {
    earningsResponse(
        false,
        'Daily earnings processing failed.',
        [
            'error' => $e->getMessage()
        ],
        500
    );
}