<?php
/**
 * Crown Cash
 * dashboard.php
 *
 * Dashboard data endpoint.
 *
 * Accounting:
 * - Deposits increase wallet balance.
 * - Investment creation deducts wallet once.
 * - Admin approval does NOT deduct again.
 * - Daily earnings increase wallet.
 * - Referral commissions increase wallet.
 * - Completed investments return principal once.
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
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');

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

function dashboardResponse(
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
            ...$data
        ],
        JSON_UNESCAPED_UNICODE
        | JSON_UNESCAPED_SLASHES
        | JSON_PARTIAL_OUTPUT_ON_ERROR
    );

    exit;
}

/* =========================================================
   HELPERS
   ========================================================= */

function dashString($value, string $default = ''): string
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

function dashMoney($value, float $default = 0.0): float
{
    if ($value === null || $value === '') {
        return $default;
    }

    return is_numeric($value)
        ? round((float) $value, 2)
        : $default;
}

function dashObjectId($value): ?ObjectId
{
    if ($value instanceof ObjectId) {
        return $value;
    }

    $value = dashString($value);

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

function dashUserId($user): string
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
        $id = dashString($value);

        if ($id !== '') {
            return $id;
        }
    }

    return '';
}

/* =========================================================
   SESSION USER
   ========================================================= */

function dashSessionUserId(): string
{
    foreach (
        [
            $_SESSION['user_id'] ?? null,
            $_SESSION['userId'] ?? null,
            $_SESSION['uid'] ?? null,
            $_SESSION['user']['id'] ?? null,
            $_SESSION['user']['_id'] ?? null
        ] as $value
    ) {
        $id = dashString($value);

        if ($id !== '') {
            return $id;
        }
    }

    return '';
}

function dashSessionEmail(): string
{
    foreach (
        [
            $_SESSION['email'] ?? null,
            $_SESSION['user_email'] ?? null,
            $_SESSION['user']['email'] ?? null
        ] as $value
    ) {
        $email = dashString($value);

        if ($email !== '') {
            return strtolower($email);
        }
    }

    return '';
}

/* =========================================================
   FIND USER
   ========================================================= */

function dashFindUser(
    $users,
    string $userId = '',
    string $email = ''
) {
    $or = [];

    if ($userId !== '') {
        $oid = dashObjectId($userId);

        if ($oid !== null) {
            $or[] = ['_id' => $oid];
        }

        $or[] = ['id' => $userId];
        $or[] = ['user_id' => $userId];
    }

    if ($email !== '') {
        $or[] = ['email' => $email];
        $or[] = ['email' => strtolower($email)];
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
   WALLET
   ========================================================= */

function dashWalletBalance($user): float
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
            array_key_exists($field, $user)
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

/* =========================================================
   USER NAME
   ========================================================= */

function dashUserName($user): string
{
    if (!$user) {
        return 'Crown Cash User';
    }

    $fullName = dashString(
        $user['full_name']
        ?? $user['fullName']
        ?? $user['name']
        ?? ''
    );

    if ($fullName !== '') {
        return $fullName;
    }

    $first = dashString(
        $user['first_name']
        ?? $user['firstName']
        ?? ''
    );

    $last = dashString(
        $user['last_name']
        ?? $user['lastName']
        ?? ''
    );

    $name = trim(
        $first . ' ' . $last
    );

    return $name !== ''
        ? $name
        : 'Crown Cash User';
}

/* =========================================================
   ADMIN DETECTION
   ========================================================= */

function dashboardIsAdmin($user): bool
{
    if (!$user) {
        return false;
    }

    if (
        isset($user['is_admin'])
        && filter_var(
            $user['is_admin'],
            FILTER_VALIDATE_BOOLEAN
        )
    ) {
        return true;
    }

    $roles = [
        strtolower(
            dashString($user['role'] ?? '')
        ),
        strtolower(
            dashString($user['account_type'] ?? '')
        ),
        strtolower(
            dashString($user['accountType'] ?? '')
        ),
        strtolower(
            dashString($user['user_type'] ?? '')
        ),
        strtolower(
            dashString($user['userType'] ?? '')
        )
    ];

    foreach ($roles as $role) {
        if (
            in_array(
                $role,
                [
                    'admin',
                    'administrator',
                    'super_admin',
                    'superadmin'
                ],
                true
            )
        ) {
            return true;
        }
    }

    $configuredAdminId =
        dashString(
            getenv('ADMIN_USER_ID') ?: ''
        );

    $configuredAdminEmail =
        strtolower(
            dashString(
                getenv('ADMIN_EMAIL') ?: ''
            )
        );

    $currentId =
        dashUserId($user);

    $currentEmail =
        strtolower(
            dashString(
                $user['email'] ?? ''
            )
        );

    if (
        $configuredAdminId !== ''
        && $currentId !== ''
        && strtolower($configuredAdminId)
            === strtolower($currentId)
    ) {
        return true;
    }

    if (
        $configuredAdminEmail !== ''
        && $currentEmail !== ''
        && $configuredAdminEmail
            === $currentEmail
    ) {
        return true;
    }

    return false;
}

/* =========================================================
   INVESTMENT USER FILTER
   ========================================================= */

function dashUserInvestmentFilter(
    string $userId
): array {
    $or = [];

    $oid = dashObjectId($userId);

    if ($oid !== null) {
        $or[] = ['user_id' => $oid];
        $or[] = ['userId' => $oid];
        $or[] = ['owner_id' => $oid];
    }

    $or[] = ['user_id' => $userId];
    $or[] = ['userId' => $userId];
    $or[] = ['owner_id' => $userId];

    return [
        '$or' => $or
    ];
}

/* =========================================================
   INVESTMENT AMOUNT
   ========================================================= */

function dashInvestmentAmount($investment): float
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
            $amount =
                dashMoney(
                    $investment[$field]
                );

            if ($amount > 0) {
                return $amount;
            }
        }
    }

    return 0.0;
}

/* =========================================================
   TOTAL INVESTMENTS
   ========================================================= */

function dashboardInvestmentStats(
    $investments,
    string $userId
): array {
    $stats = [
        'total_invested' => 0.0,
        'active_invested' => 0.0,
        'pending_invested' => 0.0,
        'completed_invested' => 0.0,
        'investment_count' => 0,
        'active_count' => 0,
        'pending_count' => 0,
        'completed_count' => 0
    ];

    try {
        $cursor = $investments->find(
            dashUserInvestmentFilter($userId),
            [
                'limit' => 5000,
                'sort' => [
                    'created_at' => -1
                ]
            ]
        );

        foreach ($cursor as $investment) {
            $amount =
                dashInvestmentAmount(
                    $investment
                );

            if ($amount <= 0) {
                continue;
            }

            $status =
                strtolower(
                    dashString(
                        $investment['status']
                        ?? $investment['state']
                        ?? ''
                    )
                );

            /*
             * Total investment value includes investments that
             * are currently active, approved, running or completed.
             *
             * Pending investments are kept separate so the
             * dashboard can show the user's actual active capital.
             */
            if (
                in_array(
                    $status,
                    [
                        'approved',
                        'active',
                        'running',
                        'in_progress',
                        'in-progress',
                        'completed'
                    ],
                    true
                )
            ) {
                $stats['total_invested'] +=
                    $amount;

                $stats['investment_count']++;

                if ($status === 'completed') {
                    $stats['completed_invested'] +=
                        $amount;

                    $stats['completed_count']++;
                } else {
                    $stats['active_invested'] +=
                        $amount;

                    $stats['active_count']++;
                }
            } elseif (
                in_array(
                    $status,
                    [
                        'pending',
                        'awaiting_approval',
                        'awaiting approval'
                    ],
                    true
                )
            ) {
                $stats['pending_invested'] +=
                    $amount;

                $stats['pending_count']++;
            }
        }
    } catch (Throwable $e) {
        /*
         * Keep dashboard available even if investment statistics
         * cannot be read.
         */
    }

    foreach ($stats as $key => $value) {
        if (is_float($value)) {
            $stats[$key] =
                round($value, 2);
        }
    }

    return $stats;
}

/* =========================================================
   EARNINGS
   ========================================================= */

function dashboardEarnings(
    $earnings,
    $user
): array {
    $userId =
        dashUserId($user);

    $stats = [
        'investment_earnings' => 0.0,
        'referral_earnings' => 0.0,
        'total_earnings' => 0.0,
        'daily_earnings' => 0.0,
        'earning_count' => 0
    ];

    if ($userId === '') {
        return $stats;
    }

    $or = [];

    $oid =
        dashObjectId($userId);

    if ($oid !== null) {
        $or[] = [
            'user_id' => $oid
        ];
    }

    $or[] = [
        'user_id' => $userId
    ];

    $or[] = [
        'userId' => $userId
    ];

    try {
        $cursor = $earnings->find(
            [
                '$and' => [
                    [
                        '$or' => $or
                    ],
                    [
                        'status' => [
                            '$in' => [
                                'credited',
                                'completed',
                                'success'
                            ]
                        ]
                    ]
                ],
            ],
            [
                'limit' => 10000,
                'sort' => [
                    'created_at' => -1
                ]
            ]
        );

        foreach ($cursor as $entry) {
            $amount =
                dashMoney(
                    $entry['amount']
                    ?? $entry['earning']
                    ?? $entry['credit']
                    ?? 0
                );

            if ($amount <= 0) {
                continue;
            }

            $type =
                strtolower(
                    dashString(
                        $entry['type']
                        ?? $entry['earning_type']
                        ?? $entry['category']
                        ?? ''
                    )
                );

            if (
                str_contains(
                    $type,
                    'referral'
                )
                || str_contains(
                    $type,
                    'commission'
                )
            ) {
                $stats['referral_earnings'] +=
                    $amount;
            } elseif (
                str_contains(
                    $type,
                    'principal'
                )
            ) {
                /*
                 * Principal return is NOT earnings.
                 */
                continue;
            } else {
                $stats['investment_earnings'] +=
                    $amount;
            }

            $stats['earning_count']++;
        }

        /*
         * Daily earnings means investment earnings only.
         */
        $stats['daily_earnings'] =
            $stats['investment_earnings'];
    } catch (Throwable $e) {
        /*
         * Fall back to user totals below.
         */
    }

    /*
     * Fallback for accounts where the earnings ledger is not
     * populated but the user document already contains totals.
     */
    if (
        $stats['investment_earnings'] <= 0
        && $stats['referral_earnings'] <= 0
    ) {
        $stats['investment_earnings'] =
            dashMoney(
                $user['investment_earnings']
                ?? $user['investmentEarnings']
                ?? $user['daily_earnings']
                ?? $user['dailyEarnings']
                ?? 0
            );

        $stats['referral_earnings'] =
            dashMoney(
                $user['referral_earnings']
                ?? $user['referralEarnings']
                ?? $user['total_referral_earnings']
                ?? $user['totalReferralEarnings']
                ?? 0
            );
    }

    $stats['total_earnings'] =
        round(
            $stats['investment_earnings']
            + $stats['referral_earnings'],
            2
        );

    $stats['investment_earnings'] =
        round(
            $stats['investment_earnings'],
            2
        );

    $stats['referral_earnings'] =
        round(
            $stats['referral_earnings'],
            2
        );

    $stats['daily_earnings'] =
        round(
            $stats['daily_earnings'],
            2
        );

    return $stats;
}

/* =========================================================
   REFERRAL TEAM
   ========================================================= */

function dashboardReferralParentValue($user): string
{
    if (!$user) {
        return '';
    }

    foreach (
        [
            'referrer_id',
            'referrerId',
            'referrer',
            'referred_by_id',
            'referredById',
            'referred_by',
            'parent_id',
            'parentId',
            'sponsor_id',
            'sponsorId',
            'sponsor'
        ] as $field
    ) {
        if (!array_key_exists($field, $user)) {
            continue;
        }

        $value =
            dashString(
                $user[$field]
            );

        if ($value !== '') {
            return $value;
        }
    }

    return '';
}

function dashboardFindReferrals(
    $users,
    string $parentId,
    string $parentEmail = ''
): array {
    $conditions = [];

    if ($parentId !== '') {
        $oid =
            dashObjectId($parentId);

        if ($oid !== null) {
            foreach (
                [
                    'referrer_id',
                    'referrerId',
                    'referred_by_id',
                    'referredById',
                    'parent_id',
                    'parentId',
                    'sponsor_id',
                    'sponsorId'
                ] as $field
            ) {
                $conditions[] = [
                    $field => $oid
                ];
            }
        }

        foreach (
            [
                'referrer_id',
                'referrerId',
                'referrer',
                'referred_by_id',
                'referredById',
                'referred_by',
                'parent_id',
                'parentId',
                'sponsor_id',
                'sponsorId',
                'sponsor'
            ] as $field
        ) {
            $conditions[] = [
                $field => $parentId
            ];
        }
    }

    if ($parentEmail !== '') {
        foreach (
            [
                'referrer',
                'referrer_email',
                'referrerEmail',
                'referred_by',
                'sponsor'
            ] as $field
        ) {
            $conditions[] = [
                $field => $parentEmail
            ];
        }
    }

    if (!$conditions) {
        return [];
    }

    try {
        $cursor =
            $users->find(
                [
                    '$or' => $conditions
                ],
                [
                    'limit' => 5000
                ]
            );

        $result = [];
        $seen = [];

        foreach ($cursor as $member) {
            $id =
                dashUserId($member);

            if ($id === '') {
                continue;
            }

            $key =
                strtolower($id);

            if (isset($seen[$key])) {
                continue;
            }

            $seen[$key] = true;
            $result[] = $member;
        }

        return $result;
    } catch (Throwable $e) {
        return [];
    }
}

function dashboardReferralStats(
    $users,
    $user
): array {
    $empty = [
        'level1' => 0,
        'level2' => 0,
        'level3' => 0,
        'total' => 0
    ];

    if (!$user) {
        return $empty;
    }

    $userId =
        dashUserId($user);

    if ($userId === '') {
        return $empty;
    }

    $email =
        strtolower(
            dashString(
                $user['email'] ?? ''
            )
        );

    $level1 =
        dashboardFindReferrals(
            $users,
            $userId,
            $email
        );

    $level2 = [];
    $level3 = [];

    $seen2 = [];
    $seen3 = [];

    foreach ($level1 as $member) {
        $id =
            dashUserId($member);

        if ($id === '') {
            continue;
        }

        $children =
            dashboardFindReferrals(
                $users,
                $id,
                strtolower(
                    dashString(
                        $member['email'] ?? ''
                    )
                )
            );

        foreach ($children as $child) {
            $childId =
                dashUserId($child);

            if ($childId === '') {
                continue;
            }

            if (
                strtolower($childId)
                === strtolower($userId)
            ) {
                continue;
            }

            $key =
                strtolower($childId);

            if (isset($seen2[$key])) {
                continue;
            }

            $seen2[$key] = true;
            $level2[] = $child;
        }
    }

    foreach ($level2 as $member) {
        $id =
            dashUserId($member);

        if ($id === '') {
            continue;
        }

        $children =
            dashboardFindReferrals(
                $users,
                $id,
                strtolower(
                    dashString(
                        $member['email'] ?? ''
                    )
                )
            );

        foreach ($children as $child) {
            $childId =
                dashUserId($child);

            if ($childId === '') {
                continue;
            }

            if (
                strtolower($childId)
                === strtolower($userId)
            ) {
                continue;
            }

            $key =
                strtolower($childId);

            if (isset($seen3[$key])) {
                continue;
            }

            $seen3[$key] = true;
            $level3[] = $child;
        }
    }

    return [
        'level1' => count($level1),
        'level2' => count($level2),
        'level3' => count($level3),
        'total' =>
            count($level1)
            + count($level2)
            + count($level3)
    ];
}

/* =========================================================
   TRANSACTION COUNT
   ========================================================= */

function dashboardTransactionStats(
    $transactions,
    string $userId
): array {
    $stats = [
        'count' => 0,
        'deposits' => 0.0,
        'withdrawals' => 0.0,
        'credits' => 0.0,
        'debits' => 0.0
    ];

    if ($userId === '') {
        return $stats;
    }

    $or = [];

    $oid =
        dashObjectId($userId);

    if ($oid !== null) {
        $or[] = [
            'user_id' => $oid
        ];
        $or[] = [
            'userId' => $oid
        ];
    }

    $or[] = [
        'user_id' => $userId
    ];

    $or[] = [
        'userId' => $userId
    ];

    try {
        $cursor =
            $transactions->find(
                [
                    '$or' => $or
                ],
                [
                    'limit' => 10000
                ]
            );

        foreach ($cursor as $transaction) {
            $stats['count']++;

            $amount =
                dashMoney(
                    $transaction['amount']
                    ?? $transaction['value']
                    ?? 0
                );

            $type =
                strtolower(
                    dashString(
                        $transaction['type']
                        ?? $transaction['transaction_type']
                        ?? $transaction['category']
                        ?? ''
                    )
                );

            if (
                str_contains(
                    $type,
                    'deposit'
                )
            ) {
                $stats['deposits'] +=
                    $amount;
            }

            if (
                str_contains(
                    $type,
                    'withdraw'
                )
            ) {
                $stats['withdrawals'] +=
                    $amount;
            }

            if (
                isset($transaction['credit'])
                && is_numeric(
                    $transaction['credit']
                )
            ) {
                $stats['credits'] +=
                    dashMoney(
                        $transaction['credit']
                    );
            }

            if (
                isset($transaction['debit'])
                && is_numeric(
                    $transaction['debit']
                )
            ) {
                $stats['debits'] +=
                    dashMoney(
                        $transaction['debit']
                    );
            }
        }
    } catch (Throwable $e) {
        /*
         * Dashboard should still load if transaction history
         * has a temporary database issue.
         */
    }

    $stats['deposits'] =
        round($stats['deposits'], 2);

    $stats['withdrawals'] =
        round($stats['withdrawals'], 2);

    $stats['credits'] =
        round($stats['credits'], 2);

    $stats['debits'] =
        round($stats['debits'], 2);

    return $stats;
}

/* =========================================================
   PENDING WITHDRAWAL
   ========================================================= */

function dashboardPendingWithdrawal(
    $transactions,
    string $userId
): float {
    if ($userId === '') {
        return 0.0;
    }

    $or = [];

    $oid =
        dashObjectId($userId);

    if ($oid !== null) {
        $or[] = [
            'user_id' => $oid
        ];
    }

    $or[] = [
        'user_id' => $userId
    ];

    $or[] = [
        'userId' => $userId
    ];

    try {
        $cursor =
            $transactions->find(
                [
                    '$and' => [
                        [
                            '$or' => $or
                        ],
                        [
                            'status' => [
                                '$in' => [
                                    'pending',
                                    'Pending',
                                    'PENDING'
                                ]
                            ]
                        ],
                        [
                            '$or' => [
                                [
                                    'type' =>
                                        'withdrawal'
                                ],
                                [
                                    'transaction_type' =>
                                        'withdrawal'
                                ],
                                [
                                    'category' =>
                                        'withdrawal'
                                ]
                            ]
                        ]
                    ]
                ]
            );

        $total = 0.0;

        foreach ($cursor as $transaction) {
            $total +=
                dashMoney(
                    $transaction['amount']
                    ?? 0
                );
        }

        return round($total, 2);
    } catch (Throwable $e) {
        return 0.0;
    }
}

/* =========================================================
   MAIN
   ========================================================= */

try {
    $sessionUserId =
        dashSessionUserId();

    $sessionEmail =
        dashSessionEmail();

    if (
        $sessionUserId === ''
        && $sessionEmail === ''
    ) {
        dashboardResponse(
            false,
            'Your session has expired. Please log in again.',
            [],
            401
        );
    }

    $user =
        dashFindUser(
            $users,
            $sessionUserId,
            $sessionEmail
        );

    if (!$user) {
        dashboardResponse(
            false,
            'User account could not be found.',
            [],
            401
        );
    }

    $userId =
        dashUserId($user);

    if ($userId === '') {
        dashboardResponse(
            false,
            'User account ID is missing.',
            [],
            400
        );
    }

    /*
     * ---------------------------------------------------------
     * BASIC USER INFORMATION
     * ---------------------------------------------------------
     */

    $name =
        dashUserName($user);

    $email =
        dashString(
            $user['email'] ?? ''
        );

    $phone =
        dashString(
            $user['phone']
            ?? $user['phone_number']
            ?? $user['phoneNumber']
            ?? ''
        );

    /*
     * ---------------------------------------------------------
     * WALLET
     * ---------------------------------------------------------
     */

    $balance =
        dashWalletBalance($user);

    /*
     * ---------------------------------------------------------
     * INVESTMENTS
     * ---------------------------------------------------------
     */

    $investmentStats =
        dashboardInvestmentStats(
            $investments,
            $userId
        );

    /*
     * ---------------------------------------------------------
     * EARNINGS
     * ---------------------------------------------------------
     */

    $earningStats =
        dashboardEarnings(
            $earnings,
            $user
        );

    /*
     * ---------------------------------------------------------
     * REFERRALS
     * ---------------------------------------------------------
     */

    $referralStats =
        dashboardReferralStats(
            $users,
            $user
        );

    /*
     * ---------------------------------------------------------
     * TRANSACTIONS
     * ---------------------------------------------------------
     */

    $transactionStats =
        dashboardTransactionStats(
            $transactions,
            $userId
        );

    $pendingWithdrawal =
        dashboardPendingWithdrawal(
            $transactions,
            $userId
        );

    /*
     * ---------------------------------------------------------
     * ADMIN
     * ---------------------------------------------------------
     */

    $isAdmin =
        dashboardIsAdmin($user);

    /*
     * ---------------------------------------------------------
     * USER OBJECT
     * ---------------------------------------------------------
     */

    $userData = [
        'id' => $userId,
        '_id' => $userId,
        'user_id' => $userId,
        'name' => $name,
        'full_name' => $name,
        'firstName' =>
            dashString(
                $user['first_name']
                ?? $user['firstName']
                ?? ''
            ),
        'lastName' =>
            dashString(
                $user['last_name']
                ?? $user['lastName']
                ?? ''
            ),
        'email' => $email,
        'phone' => $phone,

        'balance' => $balance,
        'wallet_balance' => $balance,
        'walletBalance' => $balance,

        'role' =>
            dashString(
                $user['role'] ?? ''
            ),

        'account_type' =>
            dashString(
                $user['account_type']
                ?? $user['accountType']
                ?? ''
            ),

        'is_admin' => $isAdmin
    ];

    /*
     * ---------------------------------------------------------
     * COMPLETE DASHBOARD DATA
     * ---------------------------------------------------------
     */

    dashboardResponse(
        true,
        'Dashboard loaded successfully.',
        [
            'user' => $userData,

            'wallet' => [
                'balance' => $balance,
                'available_balance' => $balance,
                'availableBalance' => $balance
            ],

            'balance' => $balance,
            'available_balance' => $balance,
            'availableBalance' => $balance,

            'investments' => [
                'total' =>
                    $investmentStats[
                        'total_invested'
                    ],

                'total_invested' =>
                    $investmentStats[
                        'total_invested'
                    ],

                'active' =>
                    $investmentStats[
                        'active_invested'
                    ],

                'active_invested' =>
                    $investmentStats[
                        'active_invested'
                    ],

                'pending' =>
                    $investmentStats[
                        'pending_invested'
                    ],

                'pending_invested' =>
                    $investmentStats[
                        'pending_invested'
                    ],

                'completed' =>
                    $investmentStats[
                        'completed_invested'
                    ],

                'count' =>
                    $investmentStats[
                        'investment_count'
                    ],

                'active_count' =>
                    $investmentStats[
                        'active_count'
                    ],

                'pending_count' =>
                    $investmentStats[
                        'pending_count'
                    ],

                'completed_count' =>
                    $investmentStats[
                        'completed_count'
                    ]
            ],

            'total_invested' =>
                $investmentStats[
                    'total_invested'
                ],

            'totalInvested' =>
                $investmentStats[
                    'total_invested'
                ],

            'investment_count' =>
                $investmentStats[
                    'investment_count'
                ],

            'earnings' => [
                'investment' =>
                    $earningStats[
                        'investment_earnings'
                    ],

                'daily' =>
                    $earningStats[
                        'daily_earnings'
                    ],

                'referral' =>
                    $earningStats[
                        'referral_earnings'
                    ],

                'total' =>
                    $earningStats[
                        'total_earnings'
                    ]
            ],

            'investment_earnings' =>
                $earningStats[
                    'investment_earnings'
                ],

            'daily_earnings' =>
                $earningStats[
                    'daily_earnings'
                ],

            'referral_earnings' =>
                $earningStats[
                    'referral_earnings'
                ],

            'total_earnings' =>
                $earningStats[
                    'total_earnings'
                ],

            'totalEarnings' =>
                $earningStats[
                    'total_earnings'
                ],

            'referrals' => [
                'level1' =>
                    $referralStats['level1'],

                'level2' =>
                    $referralStats['level2'],

                'level3' =>
                    $referralStats['level3'],

                'team' =>
                    $referralStats['total'],

                'total' =>
                    $referralStats['total']
            ],

            'referral_team' =>
                $referralStats['total'],

            'referralTeam' =>
                $referralStats['total'],

            'transactions' => [
                'count' =>
                    $transactionStats['count'],

                'deposits' =>
                    $transactionStats['deposits'],

                'withdrawals' =>
                    $transactionStats['withdrawals'],

                'credits' =>
                    $transactionStats['credits'],

                'debits' =>
                    $transactionStats['debits']
            ],

            'transaction_count' =>
                $transactionStats['count'],

            'transactionCount' =>
                $transactionStats['count'],

            'pending_withdrawal' =>
                $pendingWithdrawal,

            'pendingWithdrawal' =>
                $pendingWithdrawal,

            /*
             * IMPORTANT:
             * These two flags are intentionally returned so
             * dashboard.js can continue showing:
             *
             * 1. Sidebar Admin Panel
             * 2. Admin Panel quick-action card
             */
            'admin' => [
                'is_admin' => $isAdmin,
                'authorized' => $isAdmin,
                'role' =>
                    dashString(
                        $user['role'] ?? ''
                    ),
                'account_type' =>
                    dashString(
                        $user['account_type']
                        ?? $user['accountType']
                        ?? ''
                    )
            ],

            'is_admin' => $isAdmin,
            'admin_user' => $isAdmin
        ]
    );
} catch (Throwable $e) {
    dashboardResponse(
        false,
        'Unable to load dashboard.',
        [
            'error' => $e->getMessage()
        ],
        500
    );
}