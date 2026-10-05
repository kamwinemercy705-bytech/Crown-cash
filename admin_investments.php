<?php

declare(strict_types=1);

/*
|--------------------------------------------------------------------------
| CROWN CASH - ADMIN INVESTMENTS API
|--------------------------------------------------------------------------
|
| GET
|   Loads investment requests for the admin panel.
|
| POST
|   approve -> deduct principal once and activate investment
|   reject  -> reject without deduction
|
| ACCOUNTING RULE
|
| New investment:
|   pending
|   balance_deducted = false
|
| Admin approval:
|   wallet -= investment amount
|   balance_deducted = true
|   status = approved
|
| Rejection:
|   wallet unchanged
|
| Legacy investment:
|   If balance_deducted=true, approval does NOT deduct again.
|
|--------------------------------------------------------------------------
*/

require_once __DIR__ . '/config.php';

header('Content-Type: application/json; charset=utf-8');

$origin = $_SERVER['HTTP_ORIGIN'] ?? '';

$allowedOrigins = [
    'https://crown-cash.vercel.app',
    'https://www.crown-cash.vercel.app',
];

if ($origin !== '' && in_array($origin, $allowedOrigins, true)) {
    header("Access-Control-Allow-Origin: {$origin}");
    header('Vary: Origin');
}

header('Access-Control-Allow-Credentials: true');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'OPTIONS') {
    http_response_code(204);
    exit;
}

/*
|--------------------------------------------------------------------------
| RESPONSE
|--------------------------------------------------------------------------
*/

function investmentApiResponse(
    bool $success,
    string $message,
    array $data = [],
    int $status = 200
): never {

    http_response_code($status);

    echo json_encode(
        array_merge(
            [
                'success' => $success,
                'message' => $message,
            ],
            $data
        ),
        JSON_UNESCAPED_UNICODE |
        JSON_UNESCAPED_SLASHES
    );

    exit;
}

/*
|--------------------------------------------------------------------------
| BASIC HELPERS
|--------------------------------------------------------------------------
*/

function invString(mixed $value): string
{
    if ($value instanceof MongoDB\BSON\ObjectId) {
        return (string)$value;
    }

    if ($value instanceof MongoDB\BSON\UTCDateTime) {
        return $value->toDateTime()->format('c');
    }

    if (is_string($value) || is_numeric($value)) {
        return trim((string)$value);
    }

    return '';
}

function invObjectId(mixed $value): ?MongoDB\BSON\ObjectId
{
    if ($value instanceof MongoDB\BSON\ObjectId) {
        return $value;
    }

    $value = trim((string)$value);

    if ($value === '' || !preg_match('/^[a-f0-9]{24}$/i', $value)) {
        return null;
    }

    try {
        return new MongoDB\BSON\ObjectId($value);
    } catch (Throwable $e) {
        return null;
    }
}

function invMoney(mixed $value): int
{
    if (is_int($value)) {
        return $value;
    }

    if (is_float($value)) {
        return (int)round($value);
    }

    if (is_numeric($value)) {
        return (int)round((float)$value);
    }

    return 0;
}

function invStatus(mixed $value): string
{
    return strtolower(trim((string)$value));
}

function invNow(): MongoDB\BSON\UTCDateTime
{
    return new MongoDB\BSON\UTCDateTime(
        (int)round(microtime(true) * 1000)
    );
}

/*
|--------------------------------------------------------------------------
| USER LOOKUP
|--------------------------------------------------------------------------
*/

function invFindUser(
    MongoDB\Collection $users,
    mixed $userId = null,
    mixed $email = null
): ?array {

    $objectId = invObjectId($userId);

    if ($objectId !== null) {

        $user = $users->findOne([
            '_id' => $objectId,
        ]);

        if ($user !== null) {
            return $user->getArrayCopy();
        }
    }

    $stringId = trim((string)$userId);

    if ($stringId !== '') {

        $user = $users->findOne([
            '$or' => [
                ['id' => $stringId],
                ['user_id' => $stringId],
                ['userId' => $stringId],
            ],
        ]);

        if ($user !== null) {
            return $user->getArrayCopy();
        }
    }

    $emailValue = strtolower(trim((string)$email));

    if ($emailValue !== '') {

        $user = $users->findOne([
            'email' => $emailValue,
        ]);

        if ($user !== null) {
            return $user->getArrayCopy();
        }
    }

    return null;
}

function invUserId(array $user): mixed
{
    return
        $user['_id']
        ?? $user['id']
        ?? $user['user_id']
        ?? $user['userId']
        ?? null;
}

function invUserName(array $user): string
{
    $full = trim(
        (string)(
            $user['full_name']
            ?? $user['fullName']
            ?? $user['name']
            ?? ''
        )
    );

    if ($full !== '') {
        return $full;
    }

    $first = trim(
        (string)(
            $user['first_name']
            ?? $user['firstName']
            ?? $user['firstname']
            ?? ''
        )
    );

    $last = trim(
        (string)(
            $user['last_name']
            ?? $user['lastName']
            ?? $user['lastname']
            ?? ''
        )
    );

    $name = trim($first . ' ' . $last);

    if ($name !== '') {
        return $name;
    }

    if (!empty($user['username'])) {
        return trim((string)$user['username']);
    }

    return 'Unknown user';
}

/*
|--------------------------------------------------------------------------
| WALLET
|--------------------------------------------------------------------------
*/

function invWalletField(array $user): string
{
    if (array_key_exists('balance', $user)) {
        return 'balance';
    }

    if (array_key_exists('wallet_balance', $user)) {
        return 'wallet_balance';
    }

    if (array_key_exists('walletBalance', $user)) {
        return 'walletBalance';
    }

    if (
        isset($user['wallet']) &&
        (
            is_array($user['wallet']) ||
            $user['wallet'] instanceof MongoDB\Model\BSONDocument
        )
    ) {
        return 'wallet.balance';
    }

    return 'balance';
}

function invWalletBalance(array $user): int
{
    if (array_key_exists('balance', $user)) {
        return invMoney($user['balance']);
    }

    if (array_key_exists('wallet_balance', $user)) {
        return invMoney($user['wallet_balance']);
    }

    if (array_key_exists('walletBalance', $user)) {
        return invMoney($user['walletBalance']);
    }

    if (
        isset($user['wallet']) &&
        (
            is_array($user['wallet']) ||
            $user['wallet'] instanceof MongoDB\Model\BSONDocument
        )
    ) {
        return invMoney(
            $user['wallet']['balance'] ?? 0
        );
    }

    return 0;
}

function invUserFilter(array $user): array
{
    if (isset($user['_id'])) {
        return [
            '_id' => $user['_id'],
        ];
    }

    if (!empty($user['id'])) {
        return [
            'id' => $user['id'],
        ];
    }

    if (!empty($user['user_id'])) {
        return [
            'user_id' => $user['user_id'],
        ];
    }

    if (!empty($user['userId'])) {
        return [
            'userId' => $user['userId'],
        ];
    }

    if (!empty($user['email'])) {
        return [
            'email' => $user['email'],
        ];
    }

    throw new RuntimeException(
        'Unable to identify investment owner.'
    );
}

/*
|--------------------------------------------------------------------------
| ADMIN AUTH
|--------------------------------------------------------------------------
*/

function invIsAdmin(array $user): bool
{
    $role = strtolower(
        trim((string)($user['role'] ?? ''))
    );

    $accountType = strtolower(
        trim((string)($user['account_type'] ?? ''))
    );

    $isAdmin = $user['is_admin'] ?? false;

    return
        $isAdmin === true ||
        $isAdmin === 1 ||
        $isAdmin === '1' ||
        in_array(
            $role,
            [
                'admin',
                'administrator',
                'superadmin',
                'super_admin',
            ],
            true
        ) ||
        in_array(
            $accountType,
            [
                'admin',
                'administrator',
                'superadmin',
                'super_admin',
            ],
            true
        );
}

function invAuthenticateAdmin(): array
{
    startSecureSession();

    $sessionUserId = currentUserId();

    if (!$sessionUserId) {
        investmentApiResponse(
            false,
            'Authentication required.',
            [],
            401
        );
    }

    global $users;

    $admin = invFindUser(
        $users,
        $sessionUserId,
        $_SESSION['email'] ?? ''
    );

    if ($admin === null) {
        investmentApiResponse(
            false,
            'Administrator account was not found.',
            [],
            401
        );
    }

    if (!invIsAdmin($admin)) {
        investmentApiResponse(
            false,
            'Administrator access required.',
            [],
            403
        );
    }

    $configuredId = trim(
        (string)(getenv('ADMIN_USER_ID') ?: '')
    );

    $configuredEmail = strtolower(
        trim(
            (string)(getenv('ADMIN_EMAIL') ?: '')
        )
    );

    if ($configuredId !== '') {

        $actualId = invString(
            invUserId($admin)
        );

        if ($actualId !== $configuredId) {
            investmentApiResponse(
                false,
                'Administrator authorization failed.',
                [],
                403
            );
        }
    }

    if ($configuredEmail !== '') {

        $actualEmail = strtolower(
            trim(
                (string)($admin['email'] ?? '')
            )
        );

        if ($actualEmail !== $configuredEmail) {
            investmentApiResponse(
                false,
                'Administrator authorization failed.',
                [],
                403
            );
        }
    }

    return $admin;
}

/*
|--------------------------------------------------------------------------
| INVESTMENT HELPERS
|--------------------------------------------------------------------------
*/

function invAmount(array $investment): int
{
    return invMoney(
        $investment['amount']
        ?? $investment['principal']
        ?? $investment['investment_amount']
        ?? 0
    );
}

function invPlan(array $investment): string
{
    return trim(
        (string)(
            $investment['plan']
            ?? $investment['plan_name']
            ?? $investment['package']
            ?? ''
        )
    );
}

function invDuration(array $investment): int
{
    $value = $investment['duration']
        ?? $investment['duration_days']
        ?? 30;

    $duration = (int)$value;

    return $duration > 0 ? $duration : 30;
}

function invRate(array $investment): float
{
    $rate = (float)(
        $investment['daily_rate']
        ?? $investment['dailyRate']
        ?? $investment['rate']
        ?? 0
    );

    if ($rate > 1) {
        $rate /= 100;
    }

    return max(0, $rate);
}

function invDailyEarning(array $investment): int
{
    if (isset($investment['daily_earning'])) {
        $stored = invMoney($investment['daily_earning']);

        if ($stored > 0) {
            return $stored;
        }
    }

    if (isset($investment['dailyIncome'])) {
        $stored = invMoney($investment['dailyIncome']);

        if ($stored > 0) {
            return $stored;
        }
    }

    $amount = invAmount($investment);
    $rate = invRate($investment);

    return (int)round($amount * $rate);
}

function invOwner(
    MongoDB\Collection $users,
    array $investment
): ?array {

    $userId =
        $investment['user_id']
        ?? $investment['userId']
        ?? $investment['owner_id']
        ?? $investment['ownerId']
        ?? '';

    $email =
        $investment['email']
        ?? $investment['user_email']
        ?? '';

    return invFindUser(
        $users,
        $userId,
        $email
    );
}

/*
|--------------------------------------------------------------------------
| DATE SERIALIZATION
|--------------------------------------------------------------------------
*/

function invDateOutput(mixed $value): mixed
{
    if ($value instanceof MongoDB\BSON\UTCDateTime) {
        return $value->toDateTime()->format(DATE_ATOM);
    }

    if ($value instanceof DateTimeInterface) {
        return $value->format(DATE_ATOM);
    }

    if ($value === null || $value === '') {
        return null;
    }

    return $value;
}

/*
|--------------------------------------------------------------------------
| TRANSACTION RECORD
|--------------------------------------------------------------------------
*/

function invCreateApprovalTransaction(
    MongoDB\Collection $transactions,
    string $investmentId,
    string $userId,
    int $amount,
    int $before,
    int $after,
    array $admin,
    MongoDB\BSON\UTCDateTime $now,
    ?MongoDB\Driver\Session $session = null
): void {

    $document = [
        'user_id' => $userId,
        'userId' => $userId,

        'investment_id' => $investmentId,
        'investmentId' => $investmentId,

        'type' => 'investment_approved',
        'category' => 'investment',
        'direction' => 'debit',

        'amount' => $amount,

        'balance_before' => $before,
        'balance_after' => $after,
        'balance_change' => $after - $before,

        'status' => 'completed',

        'description' =>
            'Investment approved by administrator.',

        'admin_id' =>
            invString(invUserId($admin)),

        'admin_email' =>
            (string)($admin['email'] ?? ''),

        'reference' =>
            'INVESTMENT_APPROVAL_' . $investmentId,

        'created_at' => $now,
    ];

    $options = [
        'upsert' => true,
    ];

    if ($session !== null) {
        $options['session'] = $session;
    }

    $transactions->updateOne(
        [
            'investment_id' => $investmentId,
            'type' => 'investment_approved',
        ],
        [
            '$setOnInsert' => $document,
        ],
        $options
    );
}

function invCreateRejectionTransaction(
    MongoDB\Collection $transactions,
    string $investmentId,
    string $userId,
    int $amount,
    int $before,
    int $after,
    bool $refunded,
    array $admin,
    MongoDB\BSON\UTCDateTime $now,
    ?MongoDB\Driver\Session $session = null
): void {

    $type = $refunded
        ? 'investment_rejected_refund'
        : 'investment_rejected';

    $document = [
        'user_id' => $userId,
        'userId' => $userId,

        'investment_id' => $investmentId,
        'investmentId' => $investmentId,

        'type' => $type,
        'category' => 'investment',

        'direction' =>
            $refunded ? 'credit' : 'none',

        'amount' => $amount,

        'balance_before' => $before,
        'balance_after' => $after,
        'balance_change' => $after - $before,

        'status' => 'completed',

        'description' =>
            $refunded
                ? 'Investment rejected and principal refunded.'
                : 'Investment rejected without wallet deduction.',

        'admin_id' =>
            invString(invUserId($admin)),

        'admin_email' =>
            (string)($admin['email'] ?? ''),

        'reference' =>
            strtoupper($type) . '_' . $investmentId,

        'created_at' => $now,
    ];

    $options = [
        'upsert' => true,
    ];

    if ($session !== null) {
        $options['session'] = $session;
    }

    $transactions->updateOne(
        [
            'investment_id' => $investmentId,
            'type' => $type,
        ],
        [
            '$setOnInsert' => $document,
        ],
        $options
    );
}

/*
|--------------------------------------------------------------------------
| ADMIN AUTHENTICATION
|--------------------------------------------------------------------------
*/

$currentAdmin = invAuthenticateAdmin();

/*
|--------------------------------------------------------------------------
| GET
|--------------------------------------------------------------------------
*/

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'GET') {

    try {

        $status = strtolower(
            trim((string)($_GET['status'] ?? ''))
        );

        $search = trim(
            (string)($_GET['search'] ?? '')
        );

        $filter = [];

        if (
            $status !== '' &&
            $status !== 'all'
        ) {
            $filter['status'] = $status;
        }

        if ($search !== '') {

            $or = [];

            $searchObjectId = invObjectId($search);

            if ($searchObjectId !== null) {
                $or[] = [
                    '_id' => $searchObjectId,
                ];

                $or[] = [
                    'user_id' => $searchObjectId,
                ];
            }

            $or[] = [
                'user_id' => $search,
            ];

            $or[] = [
                'userId' => $search,
            ];

            $safeSearch = preg_quote(
                $search,
                '/'
            );

            $or[] = [
                'email' => [
                    '$regex' => $safeSearch,
                    '$options' => 'i',
                ],
            ];

            $or[] = [
                'user_name' => [
                    '$regex' => $safeSearch,
                    '$options' => 'i',
                ],
            ];

            $or[] = [
                'name' => [
                    '$regex' => $safeSearch,
                    '$options' => 'i',
                ],
            ];

            $filter['$or'] = $or;
        }

        $cursor = $investments->find(
            $filter,
            [
                'sort' => [
                    'created_at' => -1,
                    '_id' => -1,
                ],
                'limit' => 500,
            ]
        );

        $items = [];

        foreach ($cursor as $document) {

            $investment = $document->getArrayCopy();

            $id = invString(
                $investment['_id'] ?? ''
            );

            $userId = invString(
                $investment['user_id']
                ?? $investment['userId']
                ?? $investment['owner_id']
                ?? $investment['ownerId']
                ?? ''
            );

            $owner = invOwner(
                $users,
                $investment
            );

            $userName = '';
            $userEmail = '';
            $userPhone = '';

            if ($owner !== null) {

                $userName = invUserName($owner);

                $userEmail = (string)(
                    $owner['email'] ?? ''
                );

                $userPhone = (string)(
                    $owner['phone']
                    ?? $owner['phone_number']
                    ?? $owner['phoneNumber']
                    ?? ''
                );
            }

            if (
                $userName === '' ||
                $userName === 'Unknown user'
            ) {
                $userName = trim(
                    (string)(
                        $investment['user_name']
                        ?? $investment['userName']
                        ?? $investment['name']
                        ?? $investment['full_name']
                        ?? ''
                    )
                );
            }

            if ($userName === '') {
                $userName = 'Unknown user';
            }

            if ($userEmail === '') {
                $userEmail = (string)(
                    $investment['email']
                    ?? $investment['user_email']
                    ?? ''
                );
            }

            if ($userPhone === '') {
                $userPhone = (string)(
                    $investment['phone']
                    ?? $investment['phone_number']
                    ?? ''
                );
            }

            $amount = invAmount($investment);
            $rate = invRate($investment);
            $dailyEarning = invDailyEarning($investment);
            $duration = invDuration($investment);

            $row = [

                'id' => $id,
                '_id' => $id,

                'investment_id' => $id,
                'investmentId' => $id,

                'user_id' => $userId,
                'userId' => $userId,

                'user_name' => $userName,
                'userName' => $userName,

                'name' => $userName,
                'full_name' => $userName,

                'email' => $userEmail,
                'phone' => $userPhone,

                'plan' => invPlan($investment),
                'plan_name' => invPlan($investment),

                'amount' => $amount,
                'principal' => $amount,
                'investment_amount' => $amount,

                'daily_rate' => $rate,
                'dailyRate' => $rate,

                'daily_earning' => $dailyEarning,
                'dailyIncome' => $dailyEarning,

                'duration' => $duration,

                'status' => invStatus(
                    $investment['status']
                    ?? 'pending'
                ),

                'balance_reserved' => (bool)(
                    $investment['balance_reserved']
                    ?? false
                ),

                'balance_deducted' => (bool)(
                    $investment['balance_deducted']
                    ?? false
                ),

                'principal_returned' => (bool)(
                    $investment['principal_returned']
                    ?? false
                ),

                'earnings_processed' => invMoney(
                    $investment['earnings_processed']
                    ?? 0
                ),

                'total_earnings_paid' => invMoney(
                    $investment['total_earnings_paid']
                    ?? 0
                ),

                'earning_days' => (int)(
                    $investment['earning_days']
                    ?? 0
                ),

                'last_earning_date' =>
                    invDateOutput(
                        $investment['last_earning_date']
                        ?? null
                    ),

                'next_earning_date' =>
                    invDateOutput(
                        $investment['next_earning_date']
                        ?? null
                    ),

                'created_at' =>
                    invDateOutput(
                        $investment['created_at']
                        ?? $investment['createdAt']
                        ?? null
                    ),

                'approved_at' =>
                    invDateOutput(
                        $investment['approved_at']
                        ?? $investment['approvedAt']
                        ?? null
                    ),

                'activated_at' =>
                    invDateOutput(
                        $investment['activated_at']
                        ?? $investment['activatedAt']
                        ?? null
                    ),

                'maturity_date' =>
                    invDateOutput(
                        $investment['maturity_date']
                        ?? $investment['maturityDate']
                        ?? null
                    ),

                'admin_note' =>
                    (string)(
                        $investment['admin_note']
                        ?? ''
                    ),
            ];

            $items[] = $row;
        }

        /*
         * Statistics.
         */
        $stats = [
            'total' => 0,

            'pending' => 0,
            'approval_processing' => 0,
            'processing' => 0,

            'approved' => 0,
            'active' => 0,
            'running' => 0,

            'completed' => 0,
            'rejected' => 0,
            'cancelled' => 0,

            'total_amount' => 0,
            'pending_amount' => 0,
            'active_amount' => 0,
            'completed_amount' => 0,
        ];

        /*
         * Use the same cursor approach but only calculate
         * statistics from MongoDB records.
         */
        $allCursor = $investments->find(
            [],
            [
                'projection' => [
                    'status' => 1,
                    'amount' => 1,
                    'principal' => 1,
                    'investment_amount' => 1,
                ],
            ]
        );

        foreach ($allCursor as $document) {

            $row = $document->getArrayCopy();

            $rowStatus = invStatus(
                $row['status'] ?? 'pending'
            );

            $rowAmount = invAmount($row);

            $stats['total']++;

            if (isset($stats[$rowStatus])) {
                $stats[$rowStatus]++;
            }

            $stats['total_amount'] += $rowAmount;

            if (
                in_array(
                    $rowStatus,
                    [
                        'pending',
                        'approval_processing',
                        'processing',
                    ],
                    true
                )
            ) {
                $stats['pending_amount'] += $rowAmount;
            }

            if (
                in_array(
                    $rowStatus,
                    [
                        'approved',
                        'active',
                        'running',
                    ],
                    true
                )
            ) {
                $stats['active_amount'] += $rowAmount;
            }

            if ($rowStatus === 'completed') {
                $stats['completed_amount'] += $rowAmount;
            }
        }

        investmentApiResponse(
            true,
            'Investments loaded successfully.',
            [
                'investments' => $items,
                'data' => $items,
                'total' => count($items),
                'stats' => $stats,
            ]
        );

    } catch (Throwable $e) {

        error_log(
            'admin_investments GET error: ' .
            $e->getMessage()
        );

        investmentApiResponse(
            false,
            'Failed to load investments.',
            [],
            500
        );
    }
}

/*
|--------------------------------------------------------------------------
| POST
|--------------------------------------------------------------------------
*/

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') {

    investmentApiResponse(
        false,
        'Method not allowed.',
        [],
        405
    );
}

/*
|--------------------------------------------------------------------------
| READ REQUEST
|--------------------------------------------------------------------------
*/

$raw = file_get_contents('php://input');

$body = json_decode(
    $raw ?: '{}',
    true
);

if (!is_array($body)) {
    $body = [];
}

$investmentId = trim(
    (string)(
        $body['investment_id']
        ?? $body['investmentId']
        ?? $body['id']
        ?? $_POST['investment_id']
        ?? $_POST['investmentId']
        ?? $_POST['id']
        ?? ''
    )
);

$action = strtolower(
    trim(
        (string)(
            $body['action']
            ?? $body['status']
            ?? $_POST['action']
            ?? $_POST['status']
            ?? ''
        )
    )
);

$adminNote = trim(
    (string)(
        $body['admin_note']
        ?? $body['adminNote']
        ?? $body['note']
        ?? $body['reason']
        ?? $body['rejection_reason']
        ?? ''
    )
);

if ($investmentId === '') {

    investmentApiResponse(
        false,
        'Investment ID is required.',
        [],
        400
    );
}

$approve =
    $action === 'approve' ||
    $action === 'approved';

$reject =
    $action === 'reject' ||
    $action === 'rejected';

if (!$approve && !$reject) {

    investmentApiResponse(
        false,
        'Invalid investment action.',
        [],
        400
    );
}

$investmentObjectId =
    invObjectId($investmentId);

if ($investmentObjectId === null) {

    investmentApiResponse(
        false,
        'Invalid investment ID.',
        [],
        400
    );
}

/*
|--------------------------------------------------------------------------
| LOAD INVESTMENT
|--------------------------------------------------------------------------
*/

try {

    $document = $investments->findOne([
        '_id' => $investmentObjectId,
    ]);

    if ($document === null) {

        investmentApiResponse(
            false,
            'Investment not found.',
            [],
            404
        );
    }

    $investment =
        $document->getArrayCopy();

    $status = invStatus(
        $investment['status']
        ?? 'pending'
    );

    $amount =
        invAmount($investment);

    if ($amount <= 0) {

        investmentApiResponse(
            false,
            'Investment amount is invalid.',
            [],
            400
        );
    }

    /*
     * Resolve owner.
     */
    $owner = invOwner(
        $users,
        $investment
    );

    if ($owner === null) {

        investmentApiResponse(
            false,
            'Investment owner could not be found.',
            [],
            404
        );
    }

    $ownerId = invString(
        invUserId($owner)
    );

    if ($ownerId === '') {

        investmentApiResponse(
            false,
            'Investment owner ID is missing.',
            [],
            500
        );
    }

    $walletField =
        invWalletField($owner);

    $balanceDeducted =
        (bool)(
            $investment['balance_deducted']
            ?? false
        );

    $principalReturned =
        (bool)(
            $investment['principal_returned']
            ?? false
        );

    /*
     |--------------------------------------------------------------------------
     | APPROVE
     |--------------------------------------------------------------------------
     */

    if ($approve) {

        if (
            in_array(
                $status,
                [
                    'approved',
                    'active',
                    'running',
                    'completed',
                ],
                true
            )
        ) {

            investmentApiResponse(
                false,
                'This investment has already been approved.',
                [
                    'investment_id' => $investmentId,
                    'status' => $status,
                    'balance_deducted' =>
                        $balanceDeducted,
                ],
                409
            );
        }

        if ($status === 'rejected') {

            investmentApiResponse(
                false,
                'A rejected investment cannot be approved.',
                [],
                409
            );
        }

        if (
            !in_array(
                $status,
                [
                    'pending',
                    'approval_processing',
                    'processing',
                ],
                true
            )
        ) {

            investmentApiResponse(
                false,
                'This investment is not available for approval.',
                [
                    'status' => $status,
                ],
                409
            );
        }

        /*
         * Existing legacy investment.
         * Never deduct again.
         */
        if ($balanceDeducted) {

            $now = invNow();

            $rate = invRate($investment);

            $dailyEarning =
                invDailyEarning($investment);

            $duration =
                invDuration($investment);

            $activatedAt =
                $investment['activated_at']
                ?? $investment['approved_at']
                ?? $now;

            $maturity =
                $investment['maturity_date']
                ?? null;

            if ($maturity === null) {

                $timestamp =
                    $now->toDateTime()->getTimestamp()
                    + ($duration * 86400);

                $maturity =
                    new MongoDB\BSON\UTCDateTime(
                        $timestamp * 1000
                    );
            }

            $set = [

                'status' => 'approved',

                'admin_approved' => true,

                'approved_at' =>
                    $investment['approved_at']
                    ?? $now,

                'activated_at' =>
                    $activatedAt,

                'maturity_date' =>
                    $maturity,

                'daily_rate' =>
                    $rate,

                'daily_earning' =>
                    $dailyEarning,

                'duration' =>
                    $duration,

                'balance_deducted' =>
                    true,

                'updated_at' =>
                    $now,

                'admin_id' =>
                    invString(
                        invUserId(
                            $currentAdmin
                        )
                    ),

                'admin_email' =>
                    (string)(
                        $currentAdmin['email']
                        ?? ''
                    ),
            ];

            if ($adminNote !== '') {
                $set['admin_note'] =
                    $adminNote;
            }

            $result =
                $investments->updateOne(
                    [
                        '_id' =>
                            $investmentObjectId,

                        'status' =>
                            $status,

                        'balance_deducted' =>
                            true,
                    ],
                    [
                        '$set' => $set,
                    ]
                );

            /*
             * Use matched count, not modified count.
             */
            if ($result->getMatchedCount() !== 1) {

                investmentApiResponse(
                    false,
                    'Investment was already processed.',
                    [],
                    409
                );
            }

            investmentApiResponse(
                true,
                'Investment approved. Its principal had already been deducted.',
                [
                    'investment_id' =>
                        $investmentId,

                    'status' =>
                        'approved',

                    'wallet_deducted' =>
                        false,

                    'already_deducted' =>
                        true,

                    'amount' =>
                        $amount,
                ]
            );
        }

        /*
         * NEW INVESTMENT
         *
         * Check current wallet.
         */
        $owner = $users->findOne(
            invUserFilter($owner)
        );

        if ($owner === null) {

            investmentApiResponse(
                false,
                'Investment owner could not be loaded.',
                [],
                404
            );
        }

        $walletBefore =
            invWalletBalance(
                $owner->getArrayCopy()
            );

        if ($walletBefore < $amount) {

            investmentApiResponse(
                false,
                'Insufficient wallet balance to approve this investment.',
                [
                    'required' =>
                        $amount,

                    'wallet_balance' =>
                        $walletBefore,

                    'shortfall' =>
                        $amount -
                        $walletBefore,
                ],
                400
            );
        }

        /*
         * Do not invent a return rate.
         * The investment must contain its configured rate.
         */
        $rate =
            invRate($investment);

        if ($rate <= 0) {

            investmentApiResponse(
                false,
                'Investment daily return rate is missing.',
                [],
                400
            );
        }

        $dailyEarning =
            invDailyEarning($investment);

        $duration =
            invDuration($investment);

        $now =
            invNow();

        $maturityTimestamp =
            $now->toDateTime()->getTimestamp()
            + ($duration * 86400);

        $maturityDate =
            new MongoDB\BSON\UTCDateTime(
                $maturityTimestamp * 1000
            );

        $walletAfter =
            $walletBefore - $amount;

        $userFilter =
            invUserFilter(
                $owner->getArrayCopy()
            );

        /*
         * Critical atomic condition.
         */
        $userFilter[$walletField] = [
            '$gte' => $amount,
        ];

        /*
         * Use MongoDB transaction.
         */
        $session =
            $client->startSession();

        try {

            $session->withTransaction(
                function (
                    MongoDB\Driver\Session $session
                ) use (
                    $users,
                    $investments,
                    $transactions,
                    $investmentObjectId,
                    $investmentId,
                    $owner,
                    $ownerId,
                    $amount,
                    $walletField,
                    $walletBefore,
                    $walletAfter,
                    $status,
                    $currentAdmin,
                    $now,
                    $rate,
                    $dailyEarning,
                    $duration,
                    $maturityDate,
                    $adminNote,
                    $userFilter
                ): void {

                    /*
                     * 1. Deduct wallet.
                     */
                    $walletResult =
                        $users->updateOne(
                            $userFilter,
                            [
                                '$inc' => [
                                    $walletField =>
                                        -$amount,
                                ],

                                '$set' => [
                                    'updated_at' =>
                                        $now,
                                ],
                            ],
                            [
                                'session' =>
                                    $session,
                            ]
                        );

                    if (
                        $walletResult->getMatchedCount() !== 1
                    ) {

                        throw new RuntimeException(
                            'Wallet balance changed or is insufficient.'
                        );
                    }

                    /*
                     * 2. Prepare investment.
                     */
                    $ownerArray =
                        $owner instanceof
                        MongoDB\Model\BSONDocument
                            ? $owner->getArrayCopy()
                            : $owner;

                    $name =
                        invUserName(
                            $ownerArray
                        );

                    $set = [

                        'status' =>
                            'approved',

                        'admin_approved' =>
                            true,

                        'approved_at' =>
                            $now,

                        'activated_at' =>
                            $now,

                        'start_date' =>
                            $now,

                        'maturity_date' =>
                            $maturityDate,

                        'updated_at' =>
                            $now,

                        'balance_reserved' =>
                            false,

                        'balance_deducted' =>
                            true,

                        'principal_returned' =>
                            false,

                        'daily_rate' =>
                            $rate,

                        'daily_earning' =>
                            $dailyEarning,

                        'duration' =>
                            $duration,

                        'earnings_processed' =>
                            invMoney(
                                $investment[
                                    'earnings_processed'
                                ] ?? 0
                            ),

                        'total_earnings_paid' =>
                            invMoney(
                                $investment[
                                    'total_earnings_paid'
                                ] ?? 0
                            ),

                        'earning_days' =>
                            (int)(
                                $investment[
                                    'earning_days'
                                ] ?? 0
                            ),

                        'last_earning_date' =>
                            $investment[
                                'last_earning_date'
                            ] ?? null,

                        'next_earning_date' =>
                            new MongoDB\BSON\UTCDateTime(
                                (
                                    $now
                                    ->toDateTime()
                                    ->getTimestamp()
                                    + 86400
                                ) * 1000
                            ),

                        'admin_id' =>
                            invString(
                                invUserId(
                                    $currentAdmin
                                )
                            ),

                        'admin_email' =>
                            (string)(
                                $currentAdmin['email']
                                ?? ''
                            ),
                    ];

                    if (
                        $name !== '' &&
                        $name !== 'Unknown user'
                    ) {

                        $set['user_name'] =
                            $name;

                        $set['userName'] =
                            $name;

                        $set['name'] =
                            $name;

                        $set['full_name'] =
                            $name;
                    }

                    if (
                        !empty(
                            $ownerArray['email']
                        )
                    ) {

                        $set['email'] =
                            (string)(
                                $ownerArray['email']
                            );
                    }

                    if ($adminNote !== '') {
                        $set['admin_note'] =
                            $adminNote;
                    }

                    /*
                     * 3. Change only a request that has
                     * not already had its balance deducted.
                     */
                    $investmentResult =
                        $investments->updateOne(
                            [
                                '_id' =>
                                    $investmentObjectId,

                                'status' =>
                                    $status,

                                'balance_deducted' =>
                                    [
                                        '$ne' => true,
                                    ],
                            ],
                            [
                                '$set' =>
                                    $set,
                            ],
                            [
                                'session' =>
                                    $session,
                            ]
                        );

                    if (
                        $investmentResult
                            ->getMatchedCount() !== 1
                    ) {

                        throw new RuntimeException(
                            'Investment was already processed.'
                        );
                    }

                    /*
                     * 4. Accounting transaction.
                     */
                    invCreateApprovalTransaction(
                        $transactions,
                        $investmentId,
                        $ownerId,
                        $amount,
                        $walletBefore,
                        $walletAfter,
                        $currentAdmin,
                        $now,
                        $session
                    );
                }
            );

        } finally {
            $session->endSession();
        }

        /*
         * Audit after successful transaction.
         */
        try {

            audit(
                'investment_approved',
                [
                    'investment_id' =>
                        $investmentId,

                    'user_id' =>
                        $ownerId,

                    'amount' =>
                        $amount,

                    'wallet_before' =>
                        $walletBefore,

                    'wallet_after' =>
                        $walletAfter,

                    'admin_id' =>
                        invString(
                            invUserId(
                                $currentAdmin
                            )
                        ),
                ]
            );

        } catch (Throwable $e) {

            error_log(
                'Investment audit failed: ' .
                $e->getMessage()
            );
        }

        investmentApiResponse(
            true,
            'Investment approved successfully.',
            [
                'investment_id' =>
                    $investmentId,

                'user_id' =>
                    $ownerId,

                'amount' =>
                    $amount,

                'status' =>
                    'approved',

                'wallet_deducted' =>
                    true,

                'wallet_before' =>
                    $walletBefore,

                'wallet_after' =>
                    $walletAfter,

                'daily_rate' =>
                    $rate,

                'daily_earning' =>
                    $dailyEarning,

                'duration' =>
                    $duration,
            ]
        );
    }

    /*
     |--------------------------------------------------------------------------
     | REJECT
     |--------------------------------------------------------------------------
     */

    if ($reject) {

        if (
            in_array(
                $status,
                [
                    'approved',
                    'active',
                    'running',
                    'completed',
                ],
                true
            )
        ) {

            investmentApiResponse(
                false,
                'An approved investment cannot be rejected from this screen.',
                [],
                409
            );
        }

        if ($status === 'rejected') {

            investmentApiResponse(
                false,
                'This investment has already been rejected.',
                [],
                409
            );
        }

        if (
            !in_array(
                $status,
                [
                    'pending',
                    'approval_processing',
                    'processing',
                ],
                true
            )
        ) {

            investmentApiResponse(
                false,
                'This investment is not available for rejection.',
                [],
                409
            );
        }

        $ownerDocument =
            $users->findOne(
                invUserFilter($owner)
            );

        if ($ownerDocument === null) {

            investmentApiResponse(
                false,
                'Investment owner could not be loaded.',
                [],
                404
            );
        }

        $ownerArray =
            $ownerDocument->getArrayCopy();

        $walletBefore =
            invWalletBalance(
                $ownerArray
            );

        $walletAfter =
            $walletBefore;

        /*
         * Only legacy records that actually had their
         * principal deducted require a refund.
         */
        $refund =
            $balanceDeducted &&
            !$principalReturned;

        $now =
            invNow();

        $session =
            $client->startSession();

        try {

            $session->withTransaction(
                function (
                    MongoDB\Driver\Session $session
                ) use (
                    $users,
                    $investments,
                    $transactions,
                    $investmentObjectId,
                    $investmentId,
                    $ownerArray,
                    $ownerId,
                    $amount,
                    $walletField,
                    $walletBefore,
                    &$walletAfter,
                    $status,
                    $refund,
                    $principalReturned,
                    $currentAdmin,
                    $now,
                    $adminNote
                ): void {

                    /*
                     * Legacy refund.
                     */
                    if ($refund) {

                        $refundFilter =
                            invUserFilter(
                                $ownerArray
                            );

                        $refundResult =
                            $users->updateOne(
                                $refundFilter,
                                [
                                    '$inc' => [
                                        $walletField =>
                                            $amount,
                                    ],

                                    '$set' => [
                                        'updated_at' =>
                                            $now,
                                    ],
                                ],
                                [
                                    'session' =>
                                        $session,
                                ]
                            );

                        if (
                            $refundResult
                                ->getMatchedCount() !== 1
                        ) {

                            throw new RuntimeException(
                                'Wallet refund failed.'
                            );
                        }

                        $walletAfter =
                            $walletBefore +
                            $amount;
                    }

                    $set = [

                        'status' =>
                            'rejected',

                        'rejected_at' =>
                            $now,

                        'updated_at' =>
                            $now,

                        'admin_approved' =>
                            false,

                        'admin_id' =>
                            invString(
                                invUserId(
                                    $currentAdmin
                                )
                            ),

                        'admin_email' =>
                            (string)(
                                $currentAdmin['email']
                                ?? ''
                            ),

                        'balance_reserved' =>
                            false,

                        'balance_refunded' =>
                            $refund,

                    ];

                    if ($refund) {

                        $set['principal_returned'] =
                            true;

                        $set['refunded_at'] =
                            $now;

                    } else {

                        $set['principal_returned'] =
                            $principalReturned;
                    }

                    if ($adminNote !== '') {
                        $set['admin_note'] =
                            $adminNote;
                    }

                    /*
                     * Change only current request.
                     */
                    $result =
                        $investments->updateOne(
                            [
                                '_id' =>
                                    $investmentObjectId,

                                'status' =>
                                    $status,
                            ],
                            [
                                '$set' =>
                                    $set,
                            ],
                            [
                                'session' =>
                                    $session,
                            ]
                        );

                    if (
                        $result->getMatchedCount() !== 1
                    ) {

                        throw new RuntimeException(
                            'Investment was already processed.'
                        );
                    }

                    invCreateRejectionTransaction(
                        $transactions,
                        $investmentId,
                        $ownerId,
                        $amount,
                        $walletBefore,
                        $walletAfter,
                        $refund,
                        $currentAdmin,
                        $now,
                        $session
                    );
                }
            );

        } finally {
            $session->endSession();
        }

        try {

            audit(
                'investment_rejected',
                [
                    'investment_id' =>
                        $investmentId,

                    'user_id' =>
                        $ownerId,

                    'amount' =>
                        $amount,

                    'refund' =>
                        $refund,

                    'refund_amount' =>
                        $refund
                            ? $amount
                            : 0,

                    'admin_id' =>
                        invString(
                            invUserId(
                                $currentAdmin
                            )
                        ),
                ]
            );

        } catch (Throwable $e) {

            error_log(
                'Investment rejection audit failed: ' .
                $e->getMessage()
            );
        }

        investmentApiResponse(
            true,
            $refund
                ? 'Investment rejected and the previously deducted principal was refunded.'
                : 'Investment rejected successfully. No wallet deduction occurred.',
            [
                'investment_id' =>
                    $investmentId,

                'user_id' =>
                    $ownerId,

                'amount' =>
                    $amount,

                'status' =>
                    'rejected',

                'wallet_refunded' =>
                    $refund,

                'refund_amount' =>
                    $refund
                        ? $amount
                        : 0,

                'wallet_before' =>
                    $walletBefore,

                'wallet_after' =>
                    $walletAfter,
            ]
        );
    }

} catch (Throwable $e) {

    error_log(
        'admin_investments POST error: ' .
        $e->getMessage()
    );

    investmentApiResponse(
        false,
        'Unable to process the investment request. Please try again.',
        [],
        500
    );
}

investmentApiResponse(
    false,
    'Unable to process the investment request.',
    [],
    500
);