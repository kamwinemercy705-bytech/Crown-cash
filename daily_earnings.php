<?php
/**
 * Crown Cash
 * daily_earnings.php
 *
 * ============================================================
 * AUTOMATIC DAILY INVESTMENT EARNINGS ENGINE
 * ============================================================
 *
 * NEW CROWN CASH INVESTMENT STRUCTURE
 *
 * 1. User can invest any amount >= UGX 10,000.
 * 2. investment.php validates the amount.
 * 3. investment.php deducts the investment amount from wallet.
 * 4. investment.php creates the investment as ACTIVE.
 * 5. No administrator approval is required.
 * 6. This file processes earnings only for ACTIVE investments.
 * 7. The server-side investment record determines the daily rate.
 * 8. The frontend is never trusted for the daily rate.
 * 9. Investment principal is NOT deducted here.
 * 10. Investment principal is NOT returned here.
 * 11. Referral commissions are NOT processed here.
 * 12. Every daily earning has a deterministic ledger key.
 * 13. Wallet, ledger, transaction and investment tracking are
 *     updated inside the SAME MongoDB transaction.
 *
 * IDEMPOTENCY KEY:
 *
 * investment_earning:{investment_id}:{day_number}
 *
 * Example:
 *
 * investment_earning:68f123456789abcdef123456:1
 *
 * This prevents the same investment/day from being credited twice.
 *
 * TIMING:
 *
 * Earnings begin after one complete 24-hour period from the
 * investment's started_at/activated_at timestamp.
 *
 * Example:
 *
 * Investment:
 * 5 Oct 2026 10:00 UTC
 *
 * Day 1:
 * 6 Oct 2026 10:00 UTC
 *
 * Day 2:
 * 7 Oct 2026 10:00 UTC
 *
 * etc.
 */

declare(strict_types=1);

require_once __DIR__ . '/config.php';

use MongoDB\BSON\ObjectId;
use MongoDB\BSON\UTCDateTime;

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

if (
    ($_SERVER['REQUEST_METHOD'] ?? 'GET')
    === 'OPTIONS'
) {
    http_response_code(204);
    exit;
}

/* =========================================================
   SESSION
   ========================================================= */

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
    if (
        session_status()
        !== PHP_SESSION_ACTIVE
    ) {
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

function earningString(
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

function earningMoney(
    $value,
    float $default = 0.0
): float {
    if (
        $value === null
        || $value === ''
    ) {
        return $default;
    }

    if (is_numeric($value)) {
        return round(
            (float) $value,
            2
        );
    }

    return $default;
}

function earningBool(
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

function earningObjectId(
    $value
): ?ObjectId {
    if ($value instanceof ObjectId) {
        return $value;
    }

    $value = earningString(
        $value
    );

    if (
        $value !== ''
        && preg_match(
            '/^[a-f0-9]{24}$/i',
            $value
        )
    ) {
        try {
            return new ObjectId(
                $value
            );
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

function earningUtcNow(): DateTimeImmutable
{
    return new DateTimeImmutable(
        'now',
        new DateTimeZone('UTC')
    );
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
        $id = earningString(
            $value
        );

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
        $email = earningString(
            $value
        );

        if ($email !== '') {
            return strtolower(
                $email
            );
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
        $id = earningString(
            $value
        );

        if ($id !== '') {
            return $id;
        }
    }

    return '';
}

function findUserByFlexibleId(
    $users,
    string $id
) {
    $id = trim($id);

    if ($id === '') {
        return null;
    }

    $or = [];

    $oid = earningObjectId(
        $id
    );

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

    if (
        filter_var(
            $id,
            FILTER_VALIDATE_EMAIL
        )
    ) {
        $or[] = [
            'email' => strtolower(
                $id
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

function findSessionUser(
    $users
) {
    $userId =
        earningsSessionUserId();

    $email =
        earningsSessionEmail();

    $or = [];

    if ($userId !== '') {
        $oid =
            earningObjectId(
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

function investmentId(
    $investment
): string {
    foreach (
        [
            $investment['_id'] ?? null,
            $investment['id'] ?? null,
            $investment['investment_id'] ?? null
        ] as $value
    ) {
        $id = earningString(
            $value
        );

        if ($id !== '') {
            return $id;
        }
    }

    return '';
}

function investmentUserId(
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
        $id = earningString(
            $value
        );

        if ($id !== '') {
            return $id;
        }
    }

    return '';
}

function investmentPrincipal(
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
            isset(
                $investment[$field]
            )
        ) {
            $amount =
                earningMoney(
                    $investment[$field]
                );

            if ($amount > 0) {
                return $amount;
            }
        }
    }

    return 0.0;
}

function investmentDailyEarning(
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
                round(
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

function investmentDailyRate(
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
             * Support:
             *
             * 0.10 = 10%
             * 10    = 10%
             */
            if ($rate > 1) {
                $rate =
                    $rate / 100;
            }

            return $rate;
        }
    }

    return 0.0;
}

function investmentDuration(
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

    return 0;
}

function investmentStatus(
    $investment
): string {
    return strtolower(
        earningString(
            $investment['status']
            ?? $investment['state']
            ?? ''
        )
    );
}

/**
 * NEW STRUCTURE:
 *
 * Only active/running investments are eligible.
 *
 * There is NO admin approval requirement.
 */
function investmentIsActive(
    $investment
): bool {
    $status =
        investmentStatus(
            $investment
        );

    return in_array(
        $status,
        [
            'active',
            'running',
            'in_progress',
            'in-progress'
        ],
        true
    );
}

function investmentBalanceDeducted(
    $investment
): bool {
    return earningBool(
        $investment['balance_deducted']
        ?? false
    );
}

function investmentPrincipalReturned(
    $investment
): bool {
    return earningBool(
        $investment['principal_returned']
        ?? false
    );
}

/* =========================================================
   INVESTMENT START DATE
   ========================================================= */

function investmentActivationDate(
    $investment
): ?DateTimeImmutable {
    /*
     * NEW STRUCTURE:
     *
     * started_at is preferred.
     * activated_at is supported for compatibility.
     *
     * No approved_at / approval_date is used.
     */
    $fields = [
        'started_at',
        'activated_at',
        'activation_date',
        'start_date'
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

function userWalletBalance(
    $user
): float {
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
            isset(
                $user[$field]
            )
            && is_numeric(
                $user[$field]
            )
        ) {
            return round(
                (float) $user[$field],
                2
            );
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
        return round(
            (float) $user['wallet']['balance'],
            2
        );
    }

    return 0.0;
}

function userWalletFilter(
    $user
): array {
    $id =
        getUserIdValue(
            $user
        );

    if ($id === '') {
        throw new RuntimeException(
            'User ID is missing.'
        );
    }

    $oid =
        earningObjectId(
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

/**
 * Credit wallet inside MongoDB transaction.
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

    $filter =
        userWalletFilter(
            $user
        );

    $currentUser =
        $users->findOne(
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

    $before =
        userWalletBalance(
            $currentUser
        );

    $inc = [];

    if (
        array_key_exists(
            'balance',
            (array) $currentUser
        )
    ) {
        $inc['balance'] =
            $amount;
    }

    if (
        array_key_exists(
            'wallet_balance',
            (array) $currentUser
        )
    ) {
        $inc['wallet_balance'] =
            $amount;
    }

    if (
        array_key_exists(
            'walletBalance',
            (array) $currentUser
        )
    ) {
        $inc['walletBalance'] =
            $amount;
    }

    if (
        isset(
            $currentUser['wallet']
        )
        && is_array(
            $currentUser['wallet']
        )
        && array_key_exists(
            'balance',
            $currentUser['wallet']
        )
    ) {
        $inc['wallet.balance'] =
            $amount;
    }

    /*
     * If the account does not yet contain a recognized
     * wallet field, create the standard balance field.
     */
    if (!$inc) {
        $inc['balance'] =
            $amount;
    }

    $result =
        $users->updateOne(
            $filter,
            [
                '$inc' => $inc,
                '$set' => [
                    'updated_at' =>
                        earningNow()
                ]
            ],
            [
                'session' => $session
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
    $oid =
        earningObjectId(
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
                'id' => $investmentId
            ],
            [
                'investment_id' =>
                    $investmentId
            ]
        ]
    ];
}

/* =========================================================
   LEDGER
   ========================================================= */

function ensureEarningsLedgerIndex(
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
                    'unique_ledger_key'
            ]
        );
    } catch (Throwable $e) {
        /*
         * Index may already exist.
         *
         * Do not stop the processor because of an
         * already-existing index.
         */
    }
}

function ledgerExists(
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
   TRANSACTION HISTORY
   ========================================================= */

function upsertEarningTransaction(
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
    $investmentId =
        investmentId(
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
        investmentUserId(
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

    /*
     * NEW STRUCTURE:
     *
     * No admin approval is checked.
     */
    if (
        !investmentIsActive(
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

    /*
     * The investment amount must already have been
     * deducted from the user's wallet.
     */
    if (
        !investmentBalanceDeducted(
            $investment
        )
    ) {
        return [
            'success' => true,
            'processed' => false,
            'message' =>
                'Investment principal has not been deducted yet.'
        ];
    }

    /*
     * Do not continue processing after principal return.
     */
    if (
        investmentPrincipalReturned(
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
        investmentPrincipal(
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

    $duration =
        investmentDuration(
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
     * Prefer the server-stored daily earning.
     */
    $dailyEarning =
        investmentDailyEarning(
            $investment
        );

    /*
     * Otherwise calculate from the stored server-side rate.
     */
    if ($dailyEarning <= 0) {
        $dailyRate =
            investmentDailyRate(
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

        $dailyEarning =
            round(
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

    $user =
        findUserByFlexibleId(
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
                $user,
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
                 * Re-read the investment using the same
                 * transaction session.
                 */
                $freshInvestment =
                    $investments->findOne(
                        investmentMongoFilter(
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
                 * Investment must still be active.
                 */
                if (
                    !investmentIsActive(
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
                 * Do not process after principal return.
                 */
                if (
                    investmentPrincipalReturned(
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
                 * Deterministic idempotency key.
                 */
                $ledgerKey =
                    'investment_earning:'
                    . $investmentId
                    . ':'
                    . $dayNumber;

                /*
                 * If already credited, stop immediately.
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
                        'investment_id' =>
                            $investmentId,
                        'day_number' =>
                            $dayNumber,
                        'daily_earning' => 0,
                        'message' =>
                            'This daily earning was already processed.'
                    ];

                    return;
                }

                /*
                 * Re-read the user inside the transaction.
                 */
                $freshUser =
                    $users->findOne(
                        userWalletFilter(
                            $user
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
                    userWalletBalance(
                        $freshUser
                    );

                /*
                 * =================================================
                 * 1. LEDGER ENTRY
                 * =================================================
                 */
                insertLedgerInsideTransaction(
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
                            ?? earningObjectId(
                                $userId
                            )
                            ?? $userId,

                        'userId' =>
                            $userId,

                        'investment_id' =>
                            earningObjectId(
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

                        'created_at' =>
                            earningNow()
                    ],
                    $session
                );

                /*
                 * =================================================
                 * 2. CREDIT USER WALLET
                 * =================================================
                 */
                $walletResult =
                    creditWalletInsideTransaction(
                        $users,
                        $freshUser,
                        $dailyEarning,
                        $session
                    );

                /*
                 * =================================================
                 * 3. TRANSACTION HISTORY
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
                            ?? earningObjectId(
                                $userId
                            )
                            ?? $userId,

                        'userId' =>
                            $userId,

                        'investment_id' =>
                            earningObjectId(
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
                            'Investment daily earning - Day '
                            . $dayNumber,

                        'created_at' =>
                            earningNow()
                    ],
                    $session
                );

                /*
                 * =================================================
                 * 4. UPDATE INVESTMENT EARNINGS
                 * =================================================
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
                 * Never move the earning day backwards.
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

                $now =
                    earningNow();

                /*
                 * Determine whether the investment has
                 * reached its configured duration.
                 */
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

                        'updated_at' =>
                            $now
                    ]
                ];

                /*
                 * If this was the final earning day,
                 * mark the investment completed.
                 *
                 * Principal is NOT returned here.
                 */
                if (
                    $newDays >= $duration
                ) {
                    $investmentUpdate[
                        '$set'
                    ]['status'] =
                        'completed';

                    $investmentUpdate[
                        '$set'
                    ]['completed_at'] =
                        $now;

                    $investmentUpdate[
                        '$set'
                    ]['next_earning_date'] =
                        null;
                } else {
                    /*
                     * Next earning is one day after the
                     * current processing time.
                     */
                    $nextDate =
                        new DateTimeImmutable(
                            'now',
                            new DateTimeZone(
                                'UTC'
                            )
                        );

                    $nextDate =
                        $nextDate->modify(
                            '+1 day'
                        );

                    $nextEarningDate =
                        new UTCDateTime(
                            $nextDate
                                ->getTimestamp()
                            * 1000
                        );

                    $investmentUpdate[
                        '$set'
                    ]['next_earning_date'] =
                        $nextEarningDate;
                }

                $updateResult =
                    $investments->updateOne(
                        investmentMongoFilter(
                            $investmentId
                        ),
                        $investmentUpdate,
                        [
                            'session' =>
                                $session
                        ]
                    );

                if (
                    $updateResult
                        ->getMatchedCount()
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
                /*
                 * Ignore cleanup errors.
                 */
            }
        }
    }
}

/* =========================================================
   DETERMINE ELAPSED DAYS
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
   PROCESS ALL ACTIVE INVESTMENTS
   ========================================================= */

function processDailyEarnings(
    $investments,
    $users,
    $earnings,
    $transactions,
    $client
): array {
    /*
     * Make sure the deterministic ledger key is unique.
     */
    ensureEarningsLedgerIndex(
        $earnings
    );

    $now =
        earningUtcNow();

    /*
     * =========================================================
     * NEW STRUCTURE
     * =========================================================
     *
     * Only ACTIVE investments are selected.
     *
     * There is NO:
     *
     * admin_approved
     * approved
     * approval_date
     * approved_at
     *
     * requirement.
     */
    $filter = [
        'status' => 'active',

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

    $completedInvestments = 0;

    $totalEarnings = 0.0;

    $totalDaysProcessed = 0;

    foreach ($cursor as $investment) {
        try {
            /*
             * Safety check.
             */
            if (
                !investmentIsActive(
                    $investment
                )
            ) {
                $skippedInvestments++;
                continue;
            }

            /*
             * Principal must already have been
             * deducted from the wallet.
             */
            if (
                !investmentBalanceDeducted(
                    $investment
                )
            ) {
                $skippedInvestments++;
                continue;
            }

            /*
             * Do not process after principal return.
             */
            if (
                investmentPrincipalReturned(
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

            /*
             * Determine how many complete 24-hour periods
             * have passed since the investment started.
             */
            $elapsedDays =
                investmentElapsedFullDays(
                    $investment,
                    $now
                );

            /*
             * No full day has passed yet.
             */
            if ($elapsedDays < 1) {
                $skippedInvestments++;
                continue;
            }

            /*
             * Never process beyond the investment duration.
             */
            $targetDay =
                min(
                    $elapsedDays,
                    $duration
                );

            /*
             * Find how many days have already been credited.
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
             * Nothing new is due.
             */
            if (
                $alreadyProcessedDays
                >= $targetDay
            ) {
                $duplicateInvestments++;
                continue;
            }

            /*
             * Resume from the next unprocessed day.
             *
             * Example:
             *
             * earning_days = 2
             * target_day   = 5
             *
             * Process:
             * 3
             * 4
             * 5
             */
            $startDay =
                $alreadyProcessedDays + 1;

            for (
                $dayNumber = $startDay;
                $dayNumber <= $targetDay;
                $dayNumber++
            ) {
                $earningResult =
                    processOneInvestmentEarning(
                        $investment,
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

                if (
                    (
                        $earningResult[
                            'processed'
                        ] ?? false
                    )
                ) {
                    $processedInvestments++;

                    $totalDaysProcessed++;

                    $totalEarnings +=
                        earningMoney(
                            $earningResult[
                                'daily_earning'
                            ] ?? 0
                        );

                    /*
                     * Keep our local investment copy synchronized
                     * for catch-up processing.
                     */
                    $investment[
                        'earning_days'
                    ] = $dayNumber;

                    $investment[
                        'earnings_processed'
                    ] =
                        earningMoney(
                            $investment[
                                'earnings_processed'
                            ] ?? 0
                        )
                        + earningMoney(
                            $earningResult[
                                'daily_earning'
                            ] ?? 0
                        );

                    $investment[
                        'total_earnings_paid'
                    ] =
                        earningMoney(
                            $investment[
                                'total_earnings_paid'
                            ] ?? 0
                        )
                        + earningMoney(
                            $earningResult[
                                'daily_earning'
                            ] ?? 0
                        );

                    /*
                     * If final day was reached, stop processing
                     * this investment.
                     */
                    if (
                        $dayNumber >= $duration
                    ) {
                        $completedInvestments++;
                        break;
                    }
                }
            }
        } catch (Throwable $e) {
            $failedInvestments++;

            error_log(
                'Crown Cash daily investment loop error: '
                . $e->getMessage()
            );
        }
    }

    return [
        'success' => true,

        'message' =>
            'Daily investment earnings processing completed.',

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

/* =========================================================
   DATABASE COLLECTION RESOLUTION
   ========================================================= */

function crownCashCollection(
    string $name
) {
    /*
     * Prefer collections already created by config.php.
     *
     * Supported common variable names:
     *
     * $users
     * $investments
     * $earnings
     * $transactions
     */

    $variableCandidates = [
        $name
    ];

    foreach (
        $variableCandidates as $variable
    ) {
        if (
            isset(
                $GLOBALS[$variable]
            )
        ) {
            return $GLOBALS[
                $variable
            ];
        }
    }

    /*
     * If config.php exposes a MongoDB database object,
     * create the collection from it.
     */
    if (
        isset(
            $GLOBALS['db']
        )
        && $GLOBALS['db'] !== null
    ) {
        $db =
            $GLOBALS['db'];

        $collectionMap = [
            'users' =>
                'users',

            'investments' =>
                'investments',

            'earnings' =>
                'earnings',

            'transactions' =>
                'transactions'
        ];

        return $db->selectCollection(
            $collectionMap[$name]
            ?? $name
        );
    }

    if (
        isset(
            $GLOBALS['database']
        )
        && $GLOBALS['database'] !== null
    ) {
        $database =
            $GLOBALS['database'];

        $collectionMap = [
            'users' =>
                'users',

            'investments' =>
                'investments',

            'earnings' =>
                'earnings',

            'transactions' =>
                'transactions'
        ];

        return $database->selectCollection(
            $collectionMap[$name]
            ?? $name
        );
    }

    throw new RuntimeException(
        'MongoDB collection "' . $name . '" is not available.'
    );
}

/* =========================================================
   REQUEST / CRON SECURITY
   ========================================================= */

/**
 * Optional cron token.
 *
 * If your config.php defines:
 *
 * CROWN_CASH_CRON_TOKEN
 *
 * then this endpoint requires the same token in:
 *
 * X-Cron-Token
 *
 * or:
 *
 * Authorization: Bearer TOKEN
 *
 * If the constant is not defined, the endpoint remains
 * compatible with your existing setup.
 */
function validateCronTokenIfConfigured(): void
{
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

    if ($expected === '') {
        return;
    }

    $provided =
        trim(
            (string) (
                $_SERVER[
                    'HTTP_X_CRON_TOKEN'
                ] ?? ''
            )
        );

    if ($provided === '') {
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
        earningsResponse(
            false,
            'Unauthorized earnings processor request.',
            [],
            401
        );
    }
}

/* =========================================================
   MAIN EXECUTION
   ========================================================= */

try {
    /*
     * Protect scheduled/background execution when a cron
     * token has been configured.
     */
    validateCronTokenIfConfigured();

    /*
     * Locate MongoDB client.
     */
    $client =
        $GLOBALS['client']
        ?? $GLOBALS['mongoClient']
        ?? $GLOBALS['mongodb']
        ?? null;

    if (!$client) {
        throw new RuntimeException(
            'MongoDB client is not available. Check config.php.'
        );
    }

    /*
     * Locate collections.
     *
     * If config.php already creates these collections,
     * those objects are used directly.
     */
    $users =
        crownCashCollection(
            'users'
        );

    $investments =
        crownCashCollection(
            'investments'
        );

    $earnings =
        crownCashCollection(
            'earnings'
        );

    $transactions =
        crownCashCollection(
            'transactions'
        );

    /*
     * Run the automatic earnings processor.
     */
    $processing =
        processDailyEarnings(
            $investments,
            $users,
            $earnings,
            $transactions,
            $client
        );

    /*
     * processDailyEarnings returns the complete response
     * structure.
     */
    earningsResponse(
        (bool) (
            $processing['success']
            ?? false
        ),
        earningString(
            $processing['message']
            ?? 'Daily earnings processing completed.'
        ),
        is_array(
            $processing['data']
            ?? null
        )
            ? $processing['data']
            : [],
        (
            (
                $processing['success']
                ?? false
            )
                ? 200
                : 500
        )
    );
} catch (Throwable $e) {
    /*
     * Never expose internal MongoDB/server errors to clients.
     */
    error_log(
        'Crown Cash daily_earnings.php fatal error: '
        . $e->getMessage()
    );

    earningsResponse(
        false,
        'Daily earnings processing could not be completed.',
        [],
        500
    );
}