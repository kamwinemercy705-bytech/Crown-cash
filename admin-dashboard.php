<?php
declare(strict_types=1);

/*
|--------------------------------------------------------------------------
| Crown Cash - Admin Dashboard API
|--------------------------------------------------------------------------
| Endpoint:
|   GET /admin-dashboard.php
|
| Purpose:
|   Returns administrator dashboard statistics, pending activity,
|   recent transactions and recent users.
|--------------------------------------------------------------------------
*/

header('Content-Type: application/json; charset=utf-8');

$allowedOrigin = 'https://crown-cash.vercel.app';

if (isset($_SERVER['HTTP_ORIGIN']) && $_SERVER['HTTP_ORIGIN'] === $allowedOrigin) {
    header("Access-Control-Allow-Origin: {$allowedOrigin}");
    header('Access-Control-Allow-Credentials: true');
    header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');
    header('Access-Control-Allow-Methods: GET, OPTIONS');
}

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode([
        'success' => false,
        'message' => 'Method not allowed.'
    ]);
    exit;
}


/*
|--------------------------------------------------------------------------
| Session
|--------------------------------------------------------------------------
*/

$secure = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off');

session_set_cookie_params([
    'lifetime' => 0,
    'path' => '/',
    'domain' => '',
    'secure' => $secure,
    'httponly' => true,
    'samesite' => 'None'
]);

if (session_status() !== PHP_SESSION_ACTIVE) {
    session_start();
}


/*
|--------------------------------------------------------------------------
| Configuration
|--------------------------------------------------------------------------
*/

try {
    require_once __DIR__ . '/config.php';
} catch (Throwable $e) {
    http_response_code(500);

    echo json_encode([
        'success' => false,
        'message' => 'Server configuration could not be loaded.'
    ]);

    exit;
}


/*
|--------------------------------------------------------------------------
| Helpers
|--------------------------------------------------------------------------
*/

function adminDashboardResponse(
    bool $success,
    string $message,
    array $extra = [],
    int $status = 200
): void {
    http_response_code($status);

    echo json_encode(
        array_merge([
            'success' => $success,
            'message' => $message
        ], $extra),
        JSON_UNESCAPED_SLASHES
    );

    exit;
}


function adminDashboardString(mixed $value, string $default = ''): string
{
    if ($value === null) {
        return $default;
    }

    if (is_string($value)) {
        return trim($value);
    }

    if (is_numeric($value)) {
        return (string)$value;
    }

    return $default;
}


function adminDashboardNumber(mixed $value): float
{
    if ($value === null) {
        return 0.0;
    }

    if (is_int($value) || is_float($value)) {
        return (float)$value;
    }

    if (is_string($value)) {
        $value = trim($value);

        if ($value === '') {
            return 0.0;
        }

        $value = str_replace(',', '', $value);

        return is_numeric($value) ? (float)$value : 0.0;
    }

    /*
     * MongoDB Decimal128 / BSON numeric objects
     */
    if (is_object($value)) {
        try {
            if (method_exists($value, '__toString')) {
                $stringValue = (string)$value;

                return is_numeric($stringValue)
                    ? (float)$stringValue
                    : 0.0;
            }
        } catch (Throwable $e) {
            return 0.0;
        }
    }

    return 0.0;
}


function adminDashboardDate(mixed $value): ?DateTimeImmutable
{
    if ($value instanceof MongoDB\BSON\UTCDateTime) {
        try {
            return $value
                ->toDateTime()
                ->setTimezone(new DateTimeZone('UTC'));
        } catch (Throwable $e) {
            return null;
        }
    }

    if ($value instanceof DateTimeInterface) {
        try {
            return new DateTimeImmutable(
                $value->format('c')
            );
        } catch (Throwable $e) {
            return null;
        }
    }

    if (is_string($value) && trim($value) !== '') {
        try {
            return new DateTimeImmutable($value);
        } catch (Throwable $e) {
            return null;
        }
    }

    return null;
}


function adminDashboardDateFilter(
    mixed $value,
    DateTimeImmutable $start,
    DateTimeImmutable $end
): bool {
    $date = adminDashboardDate($value);

    if (!$date) {
        return false;
    }

    return $date >= $start && $date <= $end;
}


function adminDashboardId(mixed $id): string
{
    if ($id instanceof MongoDB\BSON\ObjectId) {
        return (string)$id;
    }

    if ($id === null) {
        return '';
    }

    return trim((string)$id);
}


function adminDashboardDocumentToArray(mixed $document): array
{
    if (is_array($document)) {
        return $document;
    }

    if (is_object($document)) {
        return (array)$document;
    }

    return [];
}


function adminDashboardGetField(
    array $document,
    string $field,
    mixed $default = null
): mixed {
    if (array_key_exists($field, $document)) {
        return $document[$field];
    }

    return $default;
}


/*
|--------------------------------------------------------------------------
| Authentication
|--------------------------------------------------------------------------
*/

if (empty($_SESSION['logged_in']) || empty($_SESSION['user_id'])) {
    adminDashboardResponse(
        false,
        'Authentication required.',
        [
            'authenticated' => false,
            'authorized' => false
        ],
        401
    );
}


/*
|--------------------------------------------------------------------------
| Collections
|--------------------------------------------------------------------------
*/

try {
    if (!isset($users)) {
        adminDashboardResponse(
            false,
            'Users collection is unavailable.',
            [],
            500
        );
    }

    if (!isset($deposits)) {
        $deposits = $db->selectCollection('deposits');
    }

    if (!isset($withdrawals)) {
        $withdrawals = $db->selectCollection('withdrawals');
    }

    if (!isset($investments)) {
        $investments = $db->selectCollection('investments');
    }

    if (!isset($referrals)) {
        $referrals = $db->selectCollection('referrals');
    }

    if (!isset($transactions)) {
        $transactions = $db->selectCollection('transactions');
    }

    try {
        $supportTickets = $db->selectCollection('support_tickets');
    } catch (Throwable $e) {
        $supportTickets = null;
    }
} catch (Throwable $e) {
    adminDashboardResponse(
        false,
        'Database collections could not be loaded.',
        [],
        500
    );
}


/*
|--------------------------------------------------------------------------
| Find current administrator
|--------------------------------------------------------------------------
*/

$currentUser = null;

try {
    $sessionUserId = trim((string)$_SESSION['user_id']);

    /*
     * First try Mongo ObjectId.
     */
    if (
        $sessionUserId !== '' &&
        preg_match('/^[a-f0-9]{24}$/i', $sessionUserId)
    ) {
        try {
            $currentUser = $users->findOne([
                '_id' => new MongoDB\BSON\ObjectId($sessionUserId)
            ]);
        } catch (Throwable $e) {
            $currentUser = null;
        }
    }

    /*
     * Try string ID.
     */
    if (!$currentUser && $sessionUserId !== '') {
        try {
            $currentUser = $users->findOne([
                'id' => $sessionUserId
            ]);
        } catch (Throwable $e) {
            $currentUser = null;
        }
    }

    /*
     * Fall back to session email.
     */
    if (!$currentUser && !empty($_SESSION['email'])) {
        try {
            $currentUser = $users->findOne([
                'email' => strtolower(trim((string)$_SESSION['email']))
            ]);
        } catch (Throwable $e) {
            $currentUser = null;
        }
    }
} catch (Throwable $e) {
    $currentUser = null;
}


if (!$currentUser) {
    adminDashboardResponse(
        false,
        'Administrator account could not be found.',
        [
            'authenticated' => false,
            'authorized' => false
        ],
        401
    );
}


/*
|--------------------------------------------------------------------------
| Convert user
|--------------------------------------------------------------------------
*/

$currentUserArray = adminDashboardDocumentToArray($currentUser);

$currentUserId = adminDashboardId(
    adminDashboardGetField($currentUserArray, '_id')
);

if ($currentUserId === '') {
    $currentUserId = adminDashboardString(
        adminDashboardGetField($currentUserArray, 'id')
    );
}

$currentUserEmail = strtolower(
    adminDashboardString(
        adminDashboardGetField($currentUserArray, 'email')
    )
);

$currentUserRole = strtolower(
    adminDashboardString(
        adminDashboardGetField($currentUserArray, 'role')
    )
);

$currentUserAccountType = strtolower(
    adminDashboardString(
        adminDashboardGetField($currentUserArray, 'account_type')
    )
);

$currentUserStatus = strtolower(
    adminDashboardString(
        adminDashboardGetField($currentUserArray, 'status'),
        'active'
    )
);


/*
|--------------------------------------------------------------------------
| Account status
|--------------------------------------------------------------------------
*/

$blockedStatuses = [
    'blocked',
    'suspended',
    'disabled',
    'banned',
    'inactive'
];

if (in_array($currentUserStatus, $blockedStatuses, true)) {
    adminDashboardResponse(
        false,
        'Administrator account is not active.',
        [
            'authenticated' => true,
            'authorized' => false
        ],
        403
    );
}


/*
|--------------------------------------------------------------------------
| Administrator role
|--------------------------------------------------------------------------
*/

$isAdministrator =
    in_array($currentUserRole, [
        'admin',
        'administrator'
    ], true)
    ||
    in_array($currentUserAccountType, [
        'admin',
        'administrator'
    ], true);

if (!$isAdministrator) {
    adminDashboardResponse(
        false,
        'Administrator privileges are required.',
        [
            'authenticated' => true,
            'authorized' => false
        ],
        403
    );
}


/*
|--------------------------------------------------------------------------
| Optional explicit administrator identity restriction
|--------------------------------------------------------------------------
*/

$configuredAdminId = trim(
    (string)(getenv('ADMIN_USER_ID') ?: '')
);

$configuredAdminEmail = strtolower(
    trim((string)(getenv('ADMIN_EMAIL') ?: ''))
);

if ($configuredAdminId !== '' || $configuredAdminEmail !== '') {

    $idMatches = false;
    $emailMatches = false;

    if ($configuredAdminId !== '' && $currentUserId !== '') {
        $idMatches = strtolower($configuredAdminId) ===
            strtolower($currentUserId);
    }

    if ($configuredAdminEmail !== '' && $currentUserEmail !== '') {
        $emailMatches = $configuredAdminEmail === $currentUserEmail;
    }

    if (!$idMatches && !$emailMatches) {
        adminDashboardResponse(
            false,
            'This administrator account is not authorized for the dashboard.',
            [
                'authenticated' => true,
                'authorized' => false
            ],
            403
        );
    }
}


/*
|--------------------------------------------------------------------------
| Collections
|--------------------------------------------------------------------------
*/

try {

    /*
     * Users
     */
    $totalUsers = $users->countDocuments([]);

    $activeUsers = $users->countDocuments([
        'status' => 'active'
    ]);


    /*
     * New accounts
     *
     * Definition:
     * accounts created during the last 24 hours.
     */
    $now = new DateTimeImmutable(
        'now',
        new DateTimeZone('UTC')
    );

    $last24Hours = $now->sub(
        new DateInterval('PT24H')
    );

    $newAccounts = 0;

    try {
        $newAccounts = $users->countDocuments([
            'created_at' => [
                '$gte' => new MongoDB\BSON\UTCDateTime(
                    $last24Hours->getTimestamp() * 1000
                ),
                '$lte' => new MongoDB\BSON\UTCDateTime(
                    $now->getTimestamp() * 1000
                )
            ]
        ]);
    } catch (Throwable $e) {
        /*
         * Fallback for projects storing dates as strings.
         */
        try {
            $newAccounts = $users->countDocuments([
                'created_at' => [
                    '$gte' => $last24Hours->format('c'),
                    '$lte' => $now->format('c')
                ]
            ]);
        } catch (Throwable $ignored) {
            $newAccounts = 0;
        }
    }


    /*
     * Deposits
     *
     * Total deposits = approved/verified/credited deposits.
     * Pending and rejected amounts are kept separately.
     */
    $approvedDepositStatuses = [
        'approved',
        'verified',
        'credited',
        'completed'
    ];

    $pendingDepositStatuses = [
        'pending',
        'submitted',
        'processing'
    ];

    $rejectedDepositStatuses = [
        'rejected',
        'declined',
        'cancelled',
        'canceled'
    ];

    $totalDeposits = 0.0;
    $pendingDeposits = 0.0;
    $rejectedDeposits = 0.0;

    try {
        $cursor = $deposits->find([]);

        foreach ($cursor as $document) {
            $doc = adminDashboardDocumentToArray($document);

            $amount = adminDashboardNumber(
                adminDashboardGetField($doc, 'amount', 0)
            );

            $status = strtolower(
                adminDashboardString(
                    adminDashboardGetField($doc, 'status')
                )
            );

            $verified = (bool)adminDashboardGetField(
                $doc,
                'verified',
                false
            );

            if (
                in_array($status, $approvedDepositStatuses, true)
                ||
                $verified
            ) {
                $totalDeposits += $amount;
            } elseif (
                in_array($status, $pendingDepositStatuses, true)
            ) {
                $pendingDeposits += $amount;
            } elseif (
                in_array($status, $rejectedDepositStatuses, true)
            ) {
                $rejectedDeposits += $amount;
            }
        }
    } catch (Throwable $e) {
        $totalDeposits = 0.0;
        $pendingDeposits = 0.0;
        $rejectedDeposits = 0.0;
    }


    $pendingDepositCount = 0;

    try {
        $pendingDepositCount = $deposits->countDocuments([
            'status' => [
                '$in' => $pendingDepositStatuses
            ]
        ]);
    } catch (Throwable $e) {
        $pendingDepositCount = 0;
    }


    /*
     * Withdrawals
     *
     * Total withdrawals = approved/completed withdrawals.
     * Pending withdrawals are displayed separately.
     */
    $approvedWithdrawalStatuses = [
        'approved',
        'completed',
        'paid',
        'processed'
    ];

    $pendingWithdrawalStatuses = [
        'pending',
        'processing',
        'submitted'
    ];

    $rejectedWithdrawalStatuses = [
        'rejected',
        'declined',
        'cancelled',
        'canceled'
    ];

    $totalWithdrawals = 0.0;
    $pendingWithdrawals = 0.0;

    try {
        $cursor = $withdrawals->find([]);

        foreach ($cursor as $document) {
            $doc = adminDashboardDocumentToArray($document);

            $amount = adminDashboardNumber(
                adminDashboardGetField($doc, 'amount', 0)
            );

            $status = strtolower(
                adminDashboardString(
                    adminDashboardGetField($doc, 'status')
                )
            );

            if (
                in_array($status, $approvedWithdrawalStatuses, true)
            ) {
                $totalWithdrawals += $amount;
            } elseif (
                in_array($status, $pendingWithdrawalStatuses, true)
            ) {
                $pendingWithdrawals += $amount;
            }
        }
    } catch (Throwable $e) {
        $totalWithdrawals = 0.0;
        $pendingWithdrawals = 0.0;
    }


    $pendingWithdrawalCount = 0;

    try {
        $pendingWithdrawalCount = $withdrawals->countDocuments([
            'status' => [
                '$in' => $pendingWithdrawalStatuses
            ]
        ]);
    } catch (Throwable $e) {
        $pendingWithdrawalCount = 0;
    }


    /*
     * Investments
     */
    $approvedInvestmentStatuses = [
        'active',
        'approved',
        'running',
        'completed'
    ];

    $pendingInvestmentStatuses = [
        'pending',
        'submitted',
        'processing'
    ];

    $rejectedInvestmentStatuses = [
        'rejected',
        'declined',
        'cancelled',
        'canceled'
    ];

    $totalInvestments = 0.0;
    $activeInvestmentCount = 0;
    $pendingInvestmentCount = 0;
    $pendingInvestments = 0.0;

    try {
        $cursor = $investments->find([]);

        foreach ($cursor as $document) {
            $doc = adminDashboardDocumentToArray($document);

            $amount = adminDashboardNumber(
                adminDashboardGetField(
                    $doc,
                    'amount',
                    adminDashboardGetField(
                        $doc,
                        'principal',
                        0
                    )
                )
            );

            $status = strtolower(
                adminDashboardString(
                    adminDashboardGetField($doc, 'status')
                )
            );

            if (
                in_array($status, $approvedInvestmentStatuses, true)
            ) {
                $totalInvestments += $amount;
            }

            if ($status === 'active') {
                $activeInvestmentCount++;
            }

            if (
                in_array($status, $pendingInvestmentStatuses, true)
            ) {
                $pendingInvestmentCount++;
                $pendingInvestments += $amount;
            }
        }
    } catch (Throwable $e) {
        $totalInvestments = 0.0;
        $activeInvestmentCount = 0;
        $pendingInvestmentCount = 0;
        $pendingInvestments = 0.0;
    }


    /*
     * Referrals
     */
    $totalReferrals = 0;

    try {
        $totalReferrals = $referrals->countDocuments([]);
    } catch (Throwable $e) {
        $totalReferrals = 0;
    }


    /*
     * Transactions
     */
    $totalTransactions = 0;

    try {
        $totalTransactions = $transactions->countDocuments([]);
    } catch (Throwable $e) {
        $totalTransactions = 0;
    }


    /*
     * Support tickets
     */
    $openTickets = 0;

    if ($supportTickets !== null) {
        try {
            $openTickets = $supportTickets->countDocuments([
                'status' => [
                    '$in' => [
                        'open',
                        'pending',
                        'processing'
                    ]
                ]
            ]);
        } catch (Throwable $e) {
            $openTickets = 0;
        }
    }


    /*
     |--------------------------------------------------------------------------
     | Recent Transactions
     |--------------------------------------------------------------------------
     */

    $recentTransactions = [];

    try {
        $transactionCursor = $transactions->find(
            [],
            [
                'sort' => [
                    'created_at' => -1
                ],
                'limit' => 8
            ]
        );

        foreach ($transactionCursor as $document) {
            $doc = adminDashboardDocumentToArray($document);

            $transactionId = adminDashboardId(
                adminDashboardGetField($doc, '_id')
            );

            if ($transactionId === '') {
                $transactionId = adminDashboardString(
                    adminDashboardGetField($doc, 'id')
                );
            }

            $userId = adminDashboardId(
                adminDashboardGetField($doc, 'user_id')
            );

            if ($userId === '') {
                $userId = adminDashboardString(
                    adminDashboardGetField($doc, 'user_id')
                );
            }

            $userName =
                adminDashboardString(
                    adminDashboardGetField($doc, 'user_name')
                )
                ||
                adminDashboardString(
                    adminDashboardGetField($doc, 'name')
                )
                ||
                'Crown Cash User';

            /*
             * Resolve user name when transaction only contains user_id.
             */
            if (
                $userName === 'Crown Cash User'
                &&
                $userId !== ''
            ) {
                try {
                    $transactionUser = null;

                    if (
                        preg_match(
                            '/^[a-f0-9]{24}$/i',
                            $userId
                        )
                    ) {
                        $transactionUser = $users->findOne([
                            '_id' => new MongoDB\BSON\ObjectId($userId)
                        ]);
                    }

                    if (!$transactionUser) {
                        $transactionUser = $users->findOne([
                            'id' => $userId
                        ]);
                    }

                    if ($transactionUser) {
                        $transactionUserArray =
                            adminDashboardDocumentToArray(
                                $transactionUser
                            );

                        $firstName = adminDashboardString(
                            adminDashboardGetField(
                                $transactionUserArray,
                                'first_name'
                            )
                        );

                        $lastName = adminDashboardString(
                            adminDashboardGetField(
                                $transactionUserArray,
                                'last_name'
                            )
                        );

                        $fullName = adminDashboardString(
                            adminDashboardGetField(
                                $transactionUserArray,
                                'name'
                            )
                        );

                        if ($fullName === '') {
                            $fullName = trim(
                                $firstName . ' ' . $lastName
                            );
                        }

                        if ($fullName !== '') {
                            $userName = $fullName;
                        }
                    }
                } catch (Throwable $e) {
                    // Keep fallback name.
                }
            }

            $createdAt = adminDashboardDate(
                adminDashboardGetField(
                    $doc,
                    'created_at'
                )
            );

            $createdAtIso = $createdAt
                ? $createdAt->format('c')
                : null;

            $recentTransactions[] = [
                'id' => $transactionId,
                '_id' => $transactionId,
                'user_id' => $userId,
                'user_name' => $userName,
                'name' => $userName,
                'amount' => adminDashboardNumber(
                    adminDashboardGetField(
                        $doc,
                        'amount',
                        0
                    )
                ),
                'type' => adminDashboardString(
                    adminDashboardGetField(
                        $doc,
                        'type',
                        'transaction'
                    )
                ),
                'status' => adminDashboardString(
                    adminDashboardGetField(
                        $doc,
                        'status',
                        ''
                    )
                ),
                'created_at' => $createdAtIso
            ];
        }
    } catch (Throwable $e) {
        $recentTransactions = [];
    }


    /*
     |--------------------------------------------------------------------------
     | Recent Users
     |--------------------------------------------------------------------------
     */

    $recentUsers = [];

    try {
        $userCursor = $users->find(
            [],
            [
                'sort' => [
                    'created_at' => -1
                ],
                'limit' => 8
            ]
        );

        foreach ($userCursor as $document) {
            $doc = adminDashboardDocumentToArray($document);

            $userId = adminDashboardId(
                adminDashboardGetField($doc, '_id')
            );

            if ($userId === '') {
                $userId = adminDashboardString(
                    adminDashboardGetField($doc, 'id')
                );
            }

            $firstName = adminDashboardString(
                adminDashboardGetField(
                    $doc,
                    'first_name'
                )
            );

            $lastName = adminDashboardString(
                adminDashboardGetField(
                    $doc,
                    'last_name'
                )
            );

            $name = adminDashboardString(
                adminDashboardGetField(
                    $doc,
                    'name'
                )
            );

            if ($name === '') {
                $name = trim(
                    $firstName . ' ' . $lastName
                );
            }

            if ($name === '') {
                $name = 'Crown Cash User';
            }

            $createdAt = adminDashboardDate(
                adminDashboardGetField(
                    $doc,
                    'created_at'
                )
            );

            $recentUsers[] = [
                'id' => $userId,
                '_id' => $userId,
                'name' => $name,
                'first_name' => $firstName,
                'last_name' => $lastName,
                'email' => adminDashboardString(
                    adminDashboardGetField(
                        $doc,
                        'email'
                    )
                ),
                'status' => adminDashboardString(
                    adminDashboardGetField(
                        $doc,
                        'status',
                        'active'
                    )
                ),
                'created_at' => $createdAt
                    ? $createdAt->format('c')
                    : null
            ];
        }
    } catch (Throwable $e) {
        $recentUsers = [];
    }


    /*
     |--------------------------------------------------------------------------
     | Admin information
     |--------------------------------------------------------------------------
     */

    $adminFirstName = adminDashboardString(
        adminDashboardGetField(
            $currentUserArray,
            'first_name'
        )
    );

    $adminLastName = adminDashboardString(
        adminDashboardGetField(
            $currentUserArray,
            'last_name'
        )
    );

    $adminName = adminDashboardString(
        adminDashboardGetField(
            $currentUserArray,
            'name'
        )
    );

    if ($adminName === '') {
        $adminName = trim(
            $adminFirstName . ' ' . $adminLastName
        );
    }

    if ($adminName === '') {
        $adminName = 'Administrator';
    }


    /*
     |--------------------------------------------------------------------------
     | Final response
     |--------------------------------------------------------------------------
     */

    adminDashboardResponse(
        true,
        'Administrator dashboard data loaded successfully.',
        [
            'authenticated' => true,
            'authorized' => true,

            'admin' => [
                'id' => $currentUserId,
                'email' => $currentUserEmail,
                'name' => $adminName,
                'first_name' => $adminFirstName,
                'last_name' => $adminLastName,
                'role' => $currentUserRole,
                'account_type' => $currentUserAccountType,
                'status' => $currentUserStatus
            ],

            'stats' => [
                'total_users' => $totalUsers,
                'active_users' => $activeUsers,
                'new_accounts' => $newAccounts,

                'total_deposits' => $totalDeposits,
                'pending_deposits' => $pendingDeposits,
                'approved_deposits' => $totalDeposits,
                'rejected_deposits' => $rejectedDeposits,
                'pending_deposit_count' => $pendingDepositCount,

                'total_withdrawals' => $totalWithdrawals,
                'pending_withdrawals' => $pendingWithdrawals,
                'pending_withdrawal_count' => $pendingWithdrawalCount,

                'total_investments' => $totalInvestments,
                'active_investments' => $activeInvestmentCount,
                'pending_investments' => $pendingInvestments,
                'pending_investment_count' => $pendingInvestmentCount,

                'total_referrals' => $totalReferrals,
                'total_transactions' => $totalTransactions,
                'open_tickets' => $openTickets
            ],

            'summary' => [
                'users' => $totalUsers,
                'active_users' => $activeUsers,
                'new_accounts' => $newAccounts,

                'deposits' => $totalDeposits,
                'pending_deposits' => $pendingDeposits,

                'withdrawals' => $totalWithdrawals,
                'pending_withdrawals' => $pendingWithdrawals,

                'investments' => $totalInvestments,
                'active_investments' => $activeInvestmentCount,
                'pending_investments' => $pendingInvestments,

                'referrals' => $totalReferrals,
                'transactions' => $totalTransactions,
                'open_tickets' => $openTickets
            ],

            'pending_activity' => [
                'deposits' => $pendingDeposits,
                'deposit_count' => $pendingDepositCount,

                'withdrawals' => $pendingWithdrawals,
                'withdrawal_count' => $pendingWithdrawalCount,

                'investments' => $pendingInvestments,
                'investment_count' => $pendingInvestmentCount,

                'new_accounts' => $newAccounts
            ],

            'recent_transactions' => $recentTransactions,
            'recent_users' => $recentUsers,

            'generated_at' => $now->format('c')
        ]
    );

} catch (Throwable $e) {

    error_log(
        'Crown Cash admin dashboard error: ' .
        $e->getMessage()
    );

    adminDashboardResponse(
        false,
        'Unable to load administrator dashboard data.',
        [],
        500
    );
}