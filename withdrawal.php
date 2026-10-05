<?php
/**
 * Crown Cash - Withdrawal API
 * File: withdrawal.php
 *
 * IMPORTANT BUSINESS RULES
 * -------------------------
 * 1. User requests withdrawal.
 * 2. Registered mobile-money number is used automatically.
 * 3. Wallet is NOT deducted at request time.
 * 4. Withdrawal remains pending until admin approval.
 * 5. Admin approval is responsible for wallet deduction.
 * 6. Rejection does not affect wallet balance.
 */

declare(strict_types=1);

/* =========================================================
   CONFIG
========================================================= */

require_once __DIR__ . '/config.php';

/* =========================================================
   CORS
========================================================= */

$allowedOrigins = [
    'https://crown-cash.vercel.app',
];

$origin = $_SERVER['HTTP_ORIGIN'] ?? '';

if ($origin !== '' && in_array($origin, $allowedOrigins, true)) {
    header("Access-Control-Allow-Origin: {$origin}");
    header('Vary: Origin');
}

header('Access-Control-Allow-Credentials: true');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

/* =========================================================
   HELPERS
========================================================= */

function cc_json_response(
    bool $success,
    string $message = '',
    array $data = [],
    int $statusCode = 200
): void {
    http_response_code($statusCode);

    echo json_encode(
        array_merge(
            [
                'success' => $success,
                'message' => $message,
            ],
            $data
        ),
        JSON_UNESCAPED_SLASHES
    );

    exit;
}

function cc_string(mixed $value): string
{
    if (is_string($value)) {
        return trim($value);
    }

    if (is_numeric($value)) {
        return trim((string)$value);
    }

    return '';
}

function cc_money(mixed $value): float
{
    if ($value === null || $value === '') {
        return 0.0;
    }

    if (is_numeric($value)) {
        return round((float)$value, 2);
    }

    $clean = preg_replace('/[^0-9.\-]/', '', (string)$value);

    return round((float)$clean, 2);
}

function cc_normalize_phone(string $phone): string
{
    $phone = trim($phone);

    if ($phone === '') {
        return '';
    }

    // Remove spaces, brackets, hyphens, etc.
    $phone = preg_replace('/[^0-9+]/', '', $phone);

    // +256XXXXXXXXX -> 0XXXXXXXXX
    if (str_starts_with($phone, '+256')) {
        $phone = '0' . substr($phone, 4);
    }

    // 256XXXXXXXXX -> 0XXXXXXXXX
    if (str_starts_with($phone, '256')) {
        $phone = '0' . substr($phone, 3);
    }

    return $phone;
}

function cc_valid_uganda_phone(string $phone): bool
{
    return (bool)preg_match('/^07[0-9]{8}$/', $phone);
}

function cc_object_id_to_string(mixed $id): string
{
    if ($id === null) {
        return '';
    }

    if (is_string($id)) {
        return trim($id);
    }

    if (is_object($id) && method_exists($id, '__toString')) {
        return trim((string)$id);
    }

    return '';
}

function cc_request_json(): array
{
    $raw = file_get_contents('php://input');

    if ($raw === false || trim($raw) === '') {
        return [];
    }

    $decoded = json_decode($raw, true);

    return is_array($decoded) ? $decoded : [];
}

/* =========================================================
   SESSION
========================================================= */

if (function_exists('startSecureSession')) {
    startSecureSession();
} else {
    if (session_status() !== PHP_SESSION_ACTIVE) {
        session_name('CROWN_CASH_SESSION');
        session_start();
    }
}

/* =========================================================
   AUTHENTICATION
========================================================= */

$loggedIn = (
    isset($_SESSION['logged_in']) &&
    $_SESSION['logged_in'] === true
);

if (!$loggedIn) {
    cc_json_response(
        false,
        'Please log in before making a withdrawal.',
        [],
        401
    );
}

$sessionUserId = cc_string(
    $_SESSION['user_id']
    ?? $_SESSION['userId']
    ?? $_SESSION['id']
    ?? ''
);

$sessionEmail = strtolower(
    cc_string($_SESSION['email'] ?? '')
);

if ($sessionUserId === '' && $sessionEmail === '') {
    cc_json_response(
        false,
        'Your login session is incomplete. Please log in again.',
        [],
        401
    );
}

/* =========================================================
   DATABASE COLLECTIONS
========================================================= */

/*
 * Your existing config.php should provide the MongoDB
 * connection/collection objects used by Crown Cash.
 */

$users = $usersCollection ?? null;
$withdrawals = $withdrawalsCollection ?? null;
$transactions = $transactionsCollection ?? null;
$auditLogs = $auditLogsCollection ?? null;

if ($users === null) {
    cc_json_response(
        false,
        'Users database is not available.',
        [],
        500
    );
}

if ($withdrawals === null) {
    cc_json_response(
        false,
        'Withdrawals database is not available.',
        [],
        500
    );
}

/* =========================================================
   FIND AUTHENTICATED USER
========================================================= */

$user = null;

/*
 * First attempt: MongoDB ObjectId session ID.
 */
if (
    $sessionUserId !== '' &&
    class_exists('\\MongoDB\\BSON\\ObjectId') &&
    preg_match('/^[a-f0-9]{24}$/i', $sessionUserId)
) {
    try {
        $objectId = new MongoDB\BSON\ObjectId($sessionUserId);

        $user = $users->findOne([
            '_id' => $objectId
        ]);
    } catch (Throwable $e) {
        $user = null;
    }
}

/*
 * Second attempt: string id fields.
 */
if ($user === null && $sessionUserId !== '') {
    try {
        $user = $users->findOne([
            '$or' => [
                ['id' => $sessionUserId],
                ['user_id' => $sessionUserId],
                ['userId' => $sessionUserId],
                ['_id' => $sessionUserId],
            ]
        ]);
    } catch (Throwable $e) {
        $user = null;
    }
}

/*
 * Third attempt: email.
 */
if ($user === null && $sessionEmail !== '') {
    try {
        $user = $users->findOne([
            '$or' => [
                ['email' => $sessionEmail],
                ['email' => strtolower($sessionEmail)]
            ]
        ]);
    } catch (Throwable $e) {
        $user = null;
    }
}

if ($user === null) {
    cc_json_response(
        false,
        'Your account could not be found. Please log in again.',
        [],
        401
    );
}

/* =========================================================
   USER IDENTITY
========================================================= */

$dbUserId = '';

if (isset($user->_id)) {
    $dbUserId = cc_object_id_to_string($user->_id);
}

if ($dbUserId === '') {
    $dbUserId = cc_string(
        $user->id
        ?? $user->user_id
        ?? $user->userId
        ?? $sessionUserId
    );
}

$dbEmail = strtolower(
    cc_string($user->email ?? $sessionEmail)
);

/* =========================================================
   USER STATUS
========================================================= */

$userStatus = strtolower(
    cc_string(
        $user->status
        ?? $user->account_status
        ?? 'active'
    )
);

$blockedStatuses = [
    'blocked',
    'suspended',
    'disabled',
    'banned',
    'inactive'
];

if (in_array($userStatus, $blockedStatuses, true)) {
    cc_json_response(
        false,
        'Your account is not allowed to make withdrawals.',
        [],
        403
    );
}

/* =========================================================
   REGISTERED PHONE
========================================================= */

$registeredPhoneRaw =
    $user->phone
    ?? $user->phone_number
    ?? $user->phoneNumber
    ?? $user->mobile
    ?? $user->mobile_number
    ?? $user->mobileNumber
    ?? '';

$registeredPhone = cc_normalize_phone(
    cc_string($registeredPhoneRaw)
);

if (!cc_valid_uganda_phone($registeredPhone)) {
    cc_json_response(
        false,
        'Your registered mobile-money number is missing or invalid. Please update your profile before making a withdrawal.',
        [
            'registered_phone' => $registeredPhone
        ],
        400
    );
}

/* =========================================================
   USER NAME
========================================================= */

$firstName = cc_string(
    $user->first_name
    ?? $user->firstName
    ?? ''
);

$lastName = cc_string(
    $user->last_name
    ?? $user->lastName
    ?? ''
);

$fullName = cc_string(
    $user->full_name
    ?? $user->fullName
    ?? $user->name
    ?? ''
);

if ($fullName === '') {
    $fullName = trim($firstName . ' ' . $lastName);
}

if ($fullName === '') {
    $fullName = 'Crown Cash User';
}

/* =========================================================
   WALLET BALANCE
========================================================= */

$currentBalance = cc_money(
    $user->balance
    ?? $user->wallet_balance
    ?? $user->walletBalance
    ?? 0
);

if ($currentBalance < 0) {
    $currentBalance = 0;
}

/* =========================================================
   CONSTANTS
========================================================= */

$minimumWithdrawal = 5000.00;
$feeRate = 0.20;

/* =========================================================
   GET WITHDRAWAL HISTORY
========================================================= */

if ($_SERVER['REQUEST_METHOD'] === 'GET') {

    $withdrawalDocuments = [];

    try {

        $query = [];

        if ($dbUserId !== '') {

            $userOr = [
                ['user_id' => $dbUserId],
                ['userId' => $dbUserId],
                ['id' => $dbUserId],
            ];

            if (
                class_exists('\\MongoDB\\BSON\\ObjectId') &&
                preg_match('/^[a-f0-9]{24}$/i', $dbUserId)
            ) {
                try {
                    $objectId = new MongoDB\BSON\ObjectId($dbUserId);

                    $userOr[] = [
                        'user_id' => $objectId
                    ];

                    $userOr[] = [
                        'userId' => $objectId
                    ];
                } catch (Throwable $e) {
                    // Continue with string IDs.
                }
            }

            $query = [
                '$or' => $userOr
            ];
        } elseif ($dbEmail !== '') {
            $query = [
                'email' => $dbEmail
            ];
        }

        $cursor = $withdrawals->find(
            $query,
            [
                'sort' => [
                    'created_at' => -1,
                    'createdAt' => -1,
                    '_id' => -1
                ],
                'limit' => 50
            ]
        );

        foreach ($cursor as $doc) {

            $id = cc_object_id_to_string($doc->_id ?? '');

            $amount = cc_money(
                $doc->amount
                ?? $doc->requested_amount
                ?? 0
            );

            $fee = cc_money(
                $doc->fee
                ?? ($amount * $feeRate)
            );

            $payout = cc_money(
                $doc->payout_amount
                ?? $doc->net_amount
                ?? ($amount - $fee)
            );

            $status = strtolower(
                cc_string($doc->status ?? 'pending')
            );

            $createdAt =
                $doc->created_at
                ?? $doc->createdAt
                ?? null;

            $date = '';

            if ($createdAt instanceof MongoDB\BSON\UTCDateTime) {
                try {
                    $date = $createdAt
                        ->toDateTime()
                        ->format('Y-m-d H:i:s');
                } catch (Throwable $e) {
                    $date = '';
                }
            } elseif ($createdAt instanceof DateTimeInterface) {
                $date = $createdAt->format('Y-m-d H:i:s');
            } else {
                $date = cc_string($createdAt);
            }

            $withdrawalDocuments[] = [
                'id' => $id,
                '_id' => $id,
                'amount' => $amount,
                'fee' => $fee,
                'payout_amount' => $payout,
                'net_amount' => $payout,
                'status' => $status,
                'method' => 'mobile_money',
                'payment_method' => 'mobile_money',
                'phone' => $registeredPhone,
                'balance_reserved' => (bool)($doc->balance_reserved ?? false),
                'balance_deducted' => (bool)($doc->balance_deducted ?? false),
                'admin_approved' => (bool)($doc->admin_approved ?? false),
                'payout_status' => cc_string(
                    $doc->payout_status ?? 'not_paid'
                ),
                'created_at' => $date
            ];
        }

    } catch (Throwable $e) {

        cc_json_response(
            false,
            'Unable to load withdrawal history.',
            [
                'withdrawals' => [],
                'data' => [],
                'wallet' => [
                    'balance' => $currentBalance
                ]
            ],
            500
        );
    }

    cc_json_response(
        true,
        'Withdrawal history loaded.',
        [
            'withdrawals' => $withdrawalDocuments,
            'data' => $withdrawalDocuments,
            'wallet' => [
                'balance' => $currentBalance
            ],
            'balance' => $currentBalance,
            'available_balance' => $currentBalance,
            'registered_phone' => $registeredPhone
        ]
    );
}

/* =========================================================
   ONLY POST FROM HERE
========================================================= */

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    cc_json_response(
        false,
        'Invalid request method.',
        [],
        405
    );
}

/* =========================================================
   READ REQUEST
========================================================= */

$input = cc_request_json();

$amount = cc_money(
    $input['amount'] ?? 0
);

/*
 * The frontend may send the registered phone.
 * We do NOT trust it as the source of truth.
 *
 * The authenticated user's registered number above is
 * authoritative.
 */
$submittedPhone = cc_normalize_phone(
    cc_string($input['phone'] ?? '')
);

/* =========================================================
   AMOUNT VALIDATION
========================================================= */

if ($amount <= 0) {
    cc_json_response(
        false,
        'Please enter a valid withdrawal amount.',
        [],
        400
    );
}

if ($amount < $minimumWithdrawal) {
    cc_json_response(
        false,
        'Minimum withdrawal amount is UGX 5,000.',
        [
            'minimum_withdrawal' => $minimumWithdrawal
        ],
        400
    );
}

/*
 * Crown Cash withdrawals must be whole Uganda Shillings.
 */
if (floor($amount) !== $amount) {
    cc_json_response(
        false,
        'Withdrawal amount must be a whole number.',
        [],
        400
    );
}

/* =========================================================
   PHONE VALIDATION
========================================================= */

/*
 * If the frontend supplied a phone, make sure it matches
 * the authenticated user's registered number.
 *
 * The server still uses $registeredPhone as the actual
 * withdrawal destination.
 */
if (
    $submittedPhone !== '' &&
    $submittedPhone !== $registeredPhone
) {
    cc_json_response(
        false,
        'The withdrawal number does not match your registered mobile-money number.',
        [
            'registered_phone' => $registeredPhone
        ],
        400
    );
}

/* =========================================================
   BALANCE CHECK
========================================================= */

if ($amount > $currentBalance) {
    cc_json_response(
        false,
        'Insufficient wallet balance.',
        [
            'balance' => $currentBalance,
            'requested_amount' => $amount
        ],
        400
    );
}

/* =========================================================
   PREVENT MULTIPLE PENDING WITHDRAWALS
========================================================= */

try {

    $pendingStatuses = [
        'pending',
        'approval_processing'
    ];

    $pendingQuery = [];

    if ($dbUserId !== '') {

        $userOr = [
            ['user_id' => $dbUserId],
            ['userId' => $dbUserId],
            ['id' => $dbUserId],
        ];

        if (
            class_exists('\\MongoDB\\BSON\\ObjectId') &&
            preg_match('/^[a-f0-9]{24}$/i', $dbUserId)
        ) {
            try {
                $objectId = new MongoDB\BSON\ObjectId($dbUserId);

                $userOr[] = [
                    'user_id' => $objectId
                ];

                $userOr[] = [
                    'userId' => $objectId
                ];
            } catch (Throwable $e) {
                // Continue.
            }
        }

        $pendingQuery = [
            '$and' => [
                [
                    '$or' => $userOr
                ],
                [
                    'status' => [
                        '$in' => $pendingStatuses
                    ]
                ]
            ]
        ];

    } else {

        $pendingQuery = [
            'email' => $dbEmail,
            'status' => [
                '$in' => $pendingStatuses
            ]
        ];
    }

    $existingPending = $withdrawals->findOne(
        $pendingQuery
    );

    if ($existingPending !== null) {
        cc_json_response(
            false,
            'You already have a pending withdrawal. Please wait for admin approval before making another withdrawal.',
            [
                'existing_withdrawal' => [
                    'id' => cc_object_id_to_string(
                        $existingPending->_id ?? ''
                    ),
                    'status' => cc_string(
                        $existingPending->status ?? 'pending'
                    ),
                    'amount' => cc_money(
                        $existingPending->amount ?? 0
                    )
                ]
            ],
            409
        );
    }

} catch (Throwable $e) {

    cc_json_response(
        false,
        'Unable to verify your existing withdrawal requests.',
        [],
        500
    );
}

/* =========================================================
   CALCULATE FEE
========================================================= */

$fee = round(
    $amount * $feeRate,
    2
);

$payoutAmount = round(
    $amount - $fee,
    2
);

/* =========================================================
   TIMESTAMP
========================================================= */

$now = new MongoDB\BSON\UTCDateTime(
    (int)(microtime(true) * 1000)
);

/* =========================================================
   CREATE WITHDRAWAL
========================================================= */

/*
 * IMPORTANT:
 *
 * balance_reserved = false
 * balance_deducted = false
 *
 * The user's wallet remains unchanged.
 *
 * Admin approval will be responsible for deducting
 * the requested withdrawal amount.
 */

$withdrawalDocument = [
    'user_id' => $dbUserId,
    'userId' => $dbUserId,

    'email' => $dbEmail,
    'name' => $fullName,

    'phone' => $registeredPhone,

    /*
     * Internal method only.
     * User does not choose a payment method.
     */
    'method' => 'mobile_money',
    'payment_method' => 'mobile_money',

    'amount' => $amount,
    'requested_amount' => $amount,

    'fee' => $fee,
    'fee_rate' => $feeRate,

    'payout_amount' => $payoutAmount,
    'net_amount' => $payoutAmount,

    'status' => 'pending',

    'balance_reserved' => false,
    'balance_deducted' => false,

    'admin_approved' => false,
    'admin_rejected' => false,

    'payout_status' => 'not_paid',

    'created_at' => $now,
    'updated_at' => $now,

    /*
     * Useful audit information.
     */
    'requested_from' => 'member_withdrawal_page',
    'registered_phone_used' => true
];

/* =========================================================
   INSERT WITHDRAWAL
========================================================= */

try {

    $insertResult = $withdrawals->insertOne(
        $withdrawalDocument
    );

} catch (Throwable $e) {

    cc_json_response(
        false,
        'Unable to create the withdrawal request. Please try again.',
        [],
        500
    );
}

$withdrawalId = cc_object_id_to_string(
    $insertResult->getInsertedId() ?? ''
);

if ($withdrawalId === '') {

    cc_json_response(
        false,
        'Withdrawal request could not be created.',
        [],
        500
    );
}

/* =========================================================
   CREATE TRANSACTION RECORD
========================================================= */

if ($transactions !== null) {

    try {

        $transactionDocument = [
            'user_id' => $dbUserId,
            'userId' => $dbUserId,

            'email' => $dbEmail,
            'name' => $fullName,

            'type' => 'withdrawal',
            'transaction_type' => 'withdrawal',

            'amount' => $amount,

            'fee' => $fee,
            'payout_amount' => $payoutAmount,

            'status' => 'pending',

            'method' => 'mobile_money',
            'payment_method' => 'mobile_money',

            'phone' => $registeredPhone,

            'withdrawal_id' => $withdrawalId,

            /*
             * Transaction record MUST NOT represent
             * a wallet deduction yet.
             */
            'balance_reserved' => false,
            'balance_deducted' => false,

            'created_at' => $now,
            'updated_at' => $now
        ];

        $transactions->insertOne(
            $transactionDocument
        );

    } catch (Throwable $e) {

        /*
         * Do not fail the withdrawal request simply because
         * the secondary transaction log failed.
         *
         * The canonical withdrawal record already exists.
         */
    }
}

/* =========================================================
   AUDIT LOG
========================================================= */

if ($auditLogs !== null) {

    try {

        $auditLogs->insertOne([
            'user_id' => $dbUserId,
            'email' => $dbEmail,
            'action' => 'withdrawal_requested',
            'type' => 'withdrawal',
            'withdrawal_id' => $withdrawalId,
            'amount' => $amount,
            'fee' => $fee,
            'payout_amount' => $payoutAmount,
            'phone' => $registeredPhone,
            'status' => 'pending',

            /*
             * Explicit security/accounting record.
             */
            'balance_deducted' => false,

            'created_at' => $now
        ]);

    } catch (Throwable $e) {
        // Audit failure must not cancel a valid withdrawal request.
    }
}

/* =========================================================
   SUCCESS
========================================================= */

cc_json_response(
    true,
    'Withdrawal request submitted successfully. Your wallet will only be deducted after admin approval.',
    [
        'withdrawal' => [
            'id' => $withdrawalId,
            'amount' => $amount,
            'fee' => $fee,
            'payout_amount' => $payoutAmount,

            'status' => 'pending',

            'method' => 'mobile_money',
            'payment_method' => 'mobile_money',

            'phone' => $registeredPhone,

            'balance_reserved' => false,
            'balance_deducted' => false,

            'admin_approved' => false,
            'payout_status' => 'not_paid'
        ],

        /*
         * VERY IMPORTANT:
         * Wallet remains exactly as it was.
         */
        'wallet' => [
            'balance' => $currentBalance
        ],

        'balance' => $currentBalance,
        'available_balance' => $currentBalance,

        'registered_phone' => $registeredPhone
    ]
);
?>