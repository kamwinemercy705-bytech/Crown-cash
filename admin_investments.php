<?php

declare(strict_types=1);

/*
|--------------------------------------------------------------------------
| CROWN CASH - ADMIN INVESTMENTS API
|--------------------------------------------------------------------------
|
| GET:
|   Load investments for the admin panel.
|
| POST:
|   approve  -> deduct investment principal exactly once
|   reject   -> reject without deduction
|
| IMPORTANT ACCOUNTING RULE
|--------------------------------------------------------------------------
|
| New investment:
|
|   User creates investment
|          ↓
|   status = pending
|   balance_deducted = false
|          ↓
|   Admin approves
|          ↓
|   wallet -= principal
|          ↓
|   investment = approved
|
| Rejection:
|
|   balance_deducted = false
|          ↓
|   reject
|          ↓
|   wallet unchanged
|
| Legacy investment:
|
|   balance_deducted = true
|          ↓
|   reject
|          ↓
|   refund exactly once
|
| This file does NOT generate daily earnings.
| Daily earnings should be handled by daily_earnings.php.
|
|--------------------------------------------------------------------------
*/

require_once __DIR__ . '/config.php';

header('Content-Type: application/json; charset=utf-8');

/*
|--------------------------------------------------------------------------
| CORS
|--------------------------------------------------------------------------
*/

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

function adminInvestmentResponse(
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
        JSON_UNESCAPED_SLASHES |
        JSON_UNESCAPED_UNICODE
    );

    exit;
}

/*
|--------------------------------------------------------------------------
| HELPERS
|--------------------------------------------------------------------------
*/

function aiString(mixed $value): string
{
    if ($value instanceof MongoDB\BSON\ObjectId) {
        return (string) $value;
    }

    if ($value instanceof MongoDB\BSON\UTCDateTime) {
        return $value->toDateTime()->format('c');
    }

    if (is_string($value) || is_numeric($value)) {
        return trim((string) $value);
    }

    return '';
}

function aiObjectId(mixed $value): ?MongoDB\BSON\ObjectId
{
    if ($value instanceof MongoDB\BSON\ObjectId) {
        return $value;
    }

    $value = trim((string) $value);

    if (
        $value === '' ||
        !preg_match('/^[a-f0-9]{24}$/i', $value)
    ) {
        return null;
    }

    try {
        return new MongoDB\BSON\ObjectId($value);
    } catch (Throwable $e) {
        return null;
    }
}

function aiMoney(mixed $value): int
{
    if (is_int($value)) {
        return $value;
    }

    if (is_float($value)) {
        return (int) round($value);
    }

    if (is_numeric($value)) {
        return (int) round((float) $value);
    }

    return 0;
}

function aiStatus(mixed $value): string
{
    return strtolower(trim((string) $value));
}

function aiNow(): MongoDB\BSON\UTCDateTime
{
    return new MongoDB\BSON\UTCDateTime(
        (int) round(microtime(true) * 1000)
    );
}

/*
|--------------------------------------------------------------------------
| USER HELPERS
|--------------------------------------------------------------------------
*/

function aiFindUser(
    MongoDB\Collection $users,
    mixed $userId = null,
    mixed $email = null
): ?array {

    $objectId = aiObjectId($userId);

    if ($objectId !== null) {

        $user = $users->findOne([
            '_id' => $objectId,
        ]);

        if ($user !== null) {
            return $user->getArrayCopy();
        }
    }

    $stringId = trim((string) $userId);

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

    $email = strtolower(trim((string) $email));

    if ($email !== '') {

        $user = $users->findOne([
            'email' => $email,
        ]);

        if ($user !== null) {
            return $user->getArrayCopy();
        }
    }

    return null;
}

function aiUserId(array $user): mixed
{
    return
        $user['_id']
        ?? $user['id']
        ?? $user['user_id']
        ?? $user['userId']
        ?? null;
}

function aiUserName(array $user): string
{
    $full = trim(
        (string) (
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
        (string) (
            $user['first_name']
            ?? $user['firstName']
            ?? $user['firstname']
            ?? ''
        )
    );

    $last = trim(
        (string) (
            $user['last_name']
            ?? $user['lastName']
            ?? $user['lastname']
            ?? ''
        )
    );

    $combined = trim($first . ' ' . $last);

    if ($combined !== '') {
        return $combined;
    }

    if (!empty($user['username'])) {
        return trim((string) $user['username']);
    }

    return 'Unknown user';
}

function aiWalletField(array $user): string
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

function aiWalletBalance(array $user): int
{
    if (array_key_exists('balance', $user)) {
        return aiMoney($user['balance']);
    }

    if (array_key_exists('wallet_balance', $user)) {
        return aiMoney($user['wallet_balance']);
    }

    if (array_key_exists('walletBalance', $user)) {
        return aiMoney($user['walletBalance']);
    }

    if (
        isset($user['wallet']) &&
        (
            is_array($user['wallet']) ||
            $user['wallet'] instanceof MongoDB\Model\BSONDocument
        )
    ) {
        return aiMoney(
            $user['wallet']['balance'] ?? 0
        );
    }

    return 0;
}

function aiUserFilter(array $user): array
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
        'Investment owner cannot be identified.'
    );
}

/*
|--------------------------------------------------------------------------
| ADMIN AUTHORIZATION
|--------------------------------------------------------------------------
*/

function aiAdminAllowed(array $user): bool
{
    $role = strtolower(
        trim((string) ($user['role'] ?? ''))
    );

    $accountType = strtolower(
        trim((string) ($user['account_type'] ?? ''))
    );

    $isAdmin =
        $user['is_admin'] ?? false;

    $isAdminFlag =
        $isAdmin === true ||
        $isAdmin === 1 ||
        $isAdmin === '1';

    return
        $isAdminFlag ||
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

function aiAuthenticateAdmin(): array
{
    startSecureSession();

    $sessionUserId =
        currentUserId();

    if (!$sessionUserId) {
        adminInvestmentResponse(
            false,
            'Authentication required.',
            [],
            401
        );
    }

    global $users;

    $admin = aiFindUser(
        $users,
        $sessionUserId,
        $_SESSION['email'] ?? ''
    );

    if ($admin === null) {
        adminInvestmentResponse(
            false,
            'Administrator account was not found.',
            [],
            401
        );
    }

    if (!aiAdminAllowed($admin)) {
        adminInvestmentResponse(
            false,
            'Administrator access required.',
            [],
            403
        );
    }

    $configuredAdminId = trim(
        (string) (
            getenv('ADMIN_USER_ID') ?: ''
        )
    );

    $configuredAdminEmail = strtolower(
        trim(
            (string) (
                getenv('ADMIN_EMAIL') ?: ''
            )
        )
    );

    $actualAdminId = aiString(
        aiUserId($admin)
    );

    $actualAdminEmail = strtolower(
        trim(
            (string) (
                $admin['email'] ?? ''
            )
        )
    );

    if (
        $configuredAdminId !== '' &&
        $actualAdminId !== $configuredAdminId
    ) {
        adminInvestmentResponse(
            false,
            'Administrator authorization failed.',
            [],
            403
        );
    }

    if (
        $configuredAdminEmail !== '' &&
        $actualAdminEmail !== $configuredAdminEmail
    ) {
        adminInvestmentResponse(
            false,
            'Administrator authorization failed.',
            [],
            403
        );
    }

    return $admin;
}

/*
|--------------------------------------------------------------------------
| INVESTMENT HELPERS
|--------------------------------------------------------------------------
*/

function aiInvestmentAmount(array $investment): int
{
    return aiMoney(
        $investment['amount']
        ?? $investment['principal']
        ?? $investment['investment_amount']
        ?? 0
    );
}

function aiInvestmentPlan(array $investment): string
{
    return trim(
        (string) (
            $investment['plan']
            ?? $investment['plan_name']
            ?? $investment['package']
            ?? ''
        )
    );
}

function aiInvestmentDuration(array $investment): int
{
    $duration = (int) (
        $investment['duration']
        ?? $investment['duration_days']
        ?? 30
    );

    return $duration > 0
        ? $duration
        : 30;
}

function aiInvestmentRate(array $investment): float
{
    $rate = (float) (
        $investment['daily_rate']
        ?? $investment['dailyRate']
        ?? $investment['rate']
        ?? 0
    );

    /*
     * Support both:
     * 0.10 = 10%
     * 10   = 10%
     */
    if ($rate > 1) {
        $rate /= 100;
    }

    if ($rate < 0) {
        $rate = 0;
    }

    return $rate;
}

function aiResolveInvestmentUser(
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

    return aiFindUser(
        $users,
        $userId,
        $email
    );
}

function aiDateValue(mixed $value): mixed
{
    if ($value instanceof MongoDB\BSON\UTCDateTime) {
        return $value;
    }

    if ($value instanceof DateTimeInterface) {
        return new MongoDB\BSON\UTCDateTime(
            $value->getTimestamp() * 1000
        );
    }

    if (is_numeric($value)) {
        $timestamp = (int) $value;

        if ($timestamp < 100000000000) {
            $timestamp *= 1000;
        }

        return new MongoDB\BSON\UTCDateTime(
            $timestamp
        );
    }

    if (is_string($value) && trim($value) !== '') {

        try {

            $date = new DateTimeImmutable(
                trim($value),
                new DateTimeZone('UTC')
            );

            return new MongoDB\BSON\UTCDateTime(
                $date->getTimestamp() * 1000
            );

        } catch (Throwable $e) {
            return null;
        }
    }

    return null;
}

function aiNextEarningDate(
    MongoDB\BSON\UTCDateTime $now
): MongoDB\BSON\UTCDateTime {

    return new MongoDB\BSON\UTCDateTime(
        $now->toDateTime()->getTimestamp() * 1000
        + (86400 * 1000)
    );
}

function aiMaturityDate(
    MongoDB\BSON\UTCDateTime $now,
    int $duration
): MongoDB\BSON\UTCDateTime {

    return new MongoDB\BSON\UTCDateTime(
        $now->toDateTime()->getTimestamp() * 1000
        + ($duration * 86400 * 1000)
    );
}

/*
|--------------------------------------------------------------------------
| FIND TRANSACTION
|--------------------------------------------------------------------------
*/

function aiRecordApprovalTransaction(
    MongoDB\Collection $transactions,
    string $investmentId,
    string $userId,
    int $amount,
    int $walletBefore,
    int $walletAfter,
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

        'balance_before' => $walletBefore,
        'balance_after' => $walletAfter,
        'balance_change' =>
            $walletAfter - $walletBefore,

        'status' => 'completed',

        'description' =>
            'Investment approved by administrator.',

        'admin_id' =>
            aiString(aiUserId($admin)),

        'admin_email' =>
            (string) (
                $admin['email'] ?? ''
            ),

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

function aiRecordRejectionTransaction(
    MongoDB\Collection $transactions,
    string $investmentId,
    string $userId,
    int $amount,
    int $walletBefore,
    int $walletAfter,
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
            $refunded
                ? 'credit'
                : 'none',

        'amount' => $amount,

        'balance_before' => $walletBefore,
        'balance_after' => $walletAfter,

        'balance_change' =>
            $walletAfter - $walletBefore,

        'status' => 'completed',

        'description' =>
            $refunded
                ? 'Investment rejected and legacy principal refunded.'
                : 'Investment rejected without wallet deduction.',

        'admin_id' =>
            aiString(aiUserId($admin)),

        'admin_email' =>
            (string) (
                $admin['email'] ?? ''
            ),

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
| AUTHENTICATE ADMIN
|--------------------------------------------------------------------------
*/

$currentAdmin =
    aiAuthenticateAdmin();

/*
|--------------------------------------------------------------------------
| GET INVESTMENTS
|--------------------------------------------------------------------------
*/

if (
    ($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'GET'
) {

    $statusFilter = strtolower(
        trim(
            (string) (
                $_GET['status'] ?? ''
            )
        )
    );

    $search = trim(
        (string) (
            $_GET['search'] ?? ''
        )
    );

    $filter = [];

    if (
        $statusFilter !== '' &&
        $statusFilter !== 'all'
    ) {
        $filter['status'] =
            $statusFilter;
    }

    if ($search !== '') {

        $conditions = [];

        $searchObjectId =
            aiObjectId($search);

        if ($searchObjectId !== null) {

            $conditions[] = [
                '_id' => $searchObjectId,
            ];

            $conditions[] = [
                'user_id' => $searchObjectId,
            ];
        }

        $conditions[] = [
            'user_id' => $search,
        ];

        $conditions[] = [
            'userId' => $search,
        ];

        $conditions[] = [
            'email' => [
                '$regex' =>
                    preg_quote(
                        $search,
                        '/'
                    ),
                '$options' => 'i',
            ],
        ];

        $conditions[] = [
            'user_name' => [
                '$regex' =>
                    preg_quote(
                        $search,
                        '/'
                    ),
                '$options' => 'i',
            ],
        ];

        $conditions[] = [
            'name' => [
                '$regex' =>
                    preg_quote(
                        $search,
                        '/'
                    ),
                '$options' => 'i',
            ],
        ];

        $conditions[] = [
            'full_name' => [
                '$regex' =>
                    preg_quote(
                        $search,
                        '/'
                    ),
                '$options' => 'i',
            ],
        ];

        $filter['$or'] =
            $conditions;
    }

    try {

        $cursor =
            $investments->find(
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

            $investment =
                $document->getArrayCopy();

            $id = aiString(
                $investment['_id'] ?? ''
            );

            $userId = aiString(
                $investment['user_id']
                ?? $investment['userId']
                ?? $investment['owner_id']
                ?? $investment['ownerId']
                ?? ''
            );

            $amount =
                aiInvestmentAmount(
                    $investment
                );

            $plan =
                aiInvestmentPlan(
                    $investment
                );

            $status =
                aiStatus(
                    $investment['status']
                    ?? 'pending'
                );

            $dailyRate =
                aiInvestmentRate(
                    $investment
                );

            $dailyEarning =
                (int) round(
                    $amount * $dailyRate
                );

            $duration =
                aiInvestmentDuration(
                    $investment
                );

            $owner =
                aiResolveInvestmentUser(
                    $users,
                    $investment
                );

            $userName = '';
            $userEmail = '';
            $userPhone = '';

            if ($owner !== null) {

                $userName =
                    aiUserName($owner);

                $userEmail =
                    (string) (
                        $owner['email'] ?? ''
                    );

                $userPhone =
                    (string) (
                        $owner['phone']
                        ?? $owner['phone_number']
                        ?? $owner['phoneNumber']
                        ?? ''
                    );
            }

            /*
             * Fallback to values stored on investment.
             */
            if (
                $userName === '' ||
                $userName === 'Unknown user'
            ) {

                $userName = trim(
                    (string) (
                        $investment['user_name']
                        ?? $investment['name']
                        ?? $investment['full_name']
                        ?? ''
                    )
                );
            }

            if ($userName === '') {
                $userName =
                    'Unknown user';
            }

            if ($userEmail === '') {
                $userEmail =
                    (string) (
                        $investment['email']
                        ?? $investment['user_email']
                        ?? ''
                    );
            }

            if ($userPhone === '') {
                $userPhone =
                    (string) (
                        $investment['phone']
                        ?? $investment['phone_number']
                        ?? ''
                    );
            }

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

            $maturityDate =
                $investment['maturity_date']
                ?? $investment['maturityDate']
                ?? null;

            $items[] = [

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

                'plan' => $plan,
                'plan_name' => $plan,

                'amount' => $amount,
                'principal' => $amount,
                'investment_amount' => $amount,

                'daily_rate' => $dailyRate,
                'dailyRate' => $dailyRate,

                'daily_earning' =>
                    $dailyEarning,

                'dailyIncome' =>
                    $dailyEarning,

                'duration' =>
                    $duration,

                'status' =>
                    $status,

                'balance_reserved' =>
                    (bool) (
                        $investment[
                            'balance_reserved'
                        ] ?? false
                    ),

                'balance_deducted' =>
                    (bool) (
                        $investment[
                            'balance_deducted'
                        ] ?? false
                    ),

                'principal_returned' =>
                    (bool) (
                        $investment[
                            'principal_returned'
                        ] ?? false
                    ),

                'earnings_processed' =>
                    aiMoney(
                        $investment[
                            'earnings_processed'
                        ] ?? 0
                    ),

                'total_earnings_paid' =>
                    aiMoney(
                        $investment[
                            'total_earnings_paid'
                        ] ?? 0
                    ),

                'earning_days' =>
                    (int) (
                        $investment[
                            'earning_days'
                        ] ?? 0
                    ),

                'last_earning_date' =>
                    $investment[
                        'last_earning_date'
                    ] ?? null,

                'next_earning_date' =>
                    $investment[
                        'next_earning_date'
                    ] ?? null,

                'earnings_paid' =>
                    (bool) (
                        $investment[
                            'earnings_paid'
                        ] ?? false
                    ),

                'created_at' =>
                    $createdAt,

                'approved_at' =>
                    $approvedAt,

                'activated_at' =>
                    $activatedAt,

                'maturity_date' =>
                    $maturityDate,

                'admin_note' =>
                    (string) (
                        $investment[
                            'admin_note'
                        ] ?? ''
                    ),
            ];
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

        $allInvestments =
            $investments->find([]);

        foreach (
            $allInvestments as $document
        ) {

            $row =
                $document->getArrayCopy();

            $rowStatus =
                aiStatus(
                    $row['status']
                    ?? 'pending'
                );

            $rowAmount =
                aiInvestmentAmount($row);

            $stats['total']++;

            if (
                array_key_exists(
                    $rowStatus,
                    $stats
                )
            ) {
                $stats[$rowStatus]++;
            }

            $stats['total_amount'] +=
                $rowAmount;

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
                $stats['pending_amount'] +=
                    $rowAmount;
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
                $stats['active_amount'] +=
                    $rowAmount;
            }

            if (
                $rowStatus ===
                'completed'
            ) {
                $stats['completed_amount'] +=
                    $rowAmount;
            }
        }

        adminInvestmentResponse(
            true,
            'Investments loaded successfully.',
            [
                'investments' =>
                    $items,

                'data' =>
                    $items,

                'total' =>
                    count($items),

                'stats' =>
                    $stats,
            ]
        );

    } catch (Throwable $e) {

        error_log(
            'admin_investments GET error: ' .
            $e->getMessage()
        );

        adminInvestmentResponse(
            false,
            'Failed to load investments.',
            [],
            500
        );
    }
}

/*
|--------------------------------------------------------------------------
| POST ONLY BELOW THIS POINT
|--------------------------------------------------------------------------
*/

if (
    ($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST'
) {
    adminInvestmentResponse(
        false,
        'Method not allowed.',
        [],
        405
    );
}

/*
|--------------------------------------------------------------------------
| READ JSON
|--------------------------------------------------------------------------
*/

$rawBody =
    file_get_contents(
        'php://input'
    );

$body =
    json_decode(
        $rawBody ?: '{}',
        true
    );

if (!is_array($body)) {
    $body = [];
}

/*
|--------------------------------------------------------------------------
| INPUT
|--------------------------------------------------------------------------
*/

$investmentId = trim(
    (string) (
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
        (string) (
            $body['action']
            ?? $body['status']
            ?? $_POST['action']
            ?? $_POST['status']
            ?? ''
        )
    )
);

$adminNote = trim(
    (string) (
        $body['admin_note']
        ?? $body['adminNote']
        ?? $body['note']
        ?? $body['reason']
        ?? $body['rejection_reason']
        ?? $_POST['admin_note']
        ?? $_POST['note']
        ?? ''
    )
);

if ($investmentId === '') {
    adminInvestmentResponse(
        false,
        'Investment ID is required.',
        [],
        400
    );
}

if (
    !in_array(
        $action,
        [
            'approve',
            'approved',
            'reject',
            'rejected',
        ],
        true
    )
) {
    adminInvestmentResponse(
        false,
        'Invalid investment action.',
        [],
        400
    );
}

$investmentObjectId =
    aiObjectId($investmentId);

if ($investmentObjectId === null) {
    adminInvestmentResponse(
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

    $investmentDocument =
        $investments->findOne([
            '_id' =>
                $investmentObjectId,
        ]);

    if ($investmentDocument === null) {
        adminInvestmentResponse(
            false,
            'Investment not found.',
            [],
            404
        );
    }

    $investment =
        $investmentDocument->getArrayCopy();

    $currentStatus =
        aiStatus(
            $investment['status']
            ?? 'pending'
        );

    $amount =
        aiInvestmentAmount(
            $investment
        );

    if ($amount <= 0) {
        adminInvestmentResponse(
            false,
            'Investment amount is invalid.',
            [],
            400
        );
    }

    /*
     * Final state protection.
     */
    if (
        in_array(
            $currentStatus,
            [
                'approved',
                'active',
                'running',
                'completed',
                'rejected',
                'cancelled',
            ],
            true
        )
    ) {

        adminInvestmentResponse(
            false,
            'This investment has already been processed.',
            [
                'investment_id' =>
                    $investmentId,

                'status' =>
                    $currentStatus,

                'balance_deducted' =>
                    (bool) (
                        $investment[
                            'balance_deducted'
                        ] ?? false
                    ),
            ],
            409
        );
    }

    /*
     * Only pending/processing investments
     * may be handled here.
     */
    if (
        !in_array(
            $currentStatus,
            [
                'pending',
                'approval_processing',
                'processing',
            ],
            true
        )
    ) {

        adminInvestmentResponse(
            false,
            'This investment is not available for administrative processing.',
            [
                'status' =>
                    $currentStatus,
            ],
            409
        );
    }

    /*
     * Resolve investment owner.
     */
    $investmentUser =
        aiResolveInvestmentUser(
            $users,
            $investment
        );

    if ($investmentUser === null) {
        adminInvestmentResponse(
            false,
            'Investment owner could not be found.',
            [],
            404
        );
    }

    $investmentUserId =
        aiString(
            aiUserId(
                $investmentUser
            )
        );

    if ($investmentUserId === '') {
        adminInvestmentResponse(
            false,
            'Investment owner ID is missing.',
            [],
            500
        );
    }

    $walletField =
        aiWalletField(
            $investmentUser
        );

    $walletBefore =
        aiWalletBalance(
            $investmentUser
        );

    $balanceWasDeducted =
        (bool) (
            $investment[
                'balance_deducted'
            ] ?? false
        );

    $principalReturned =
        (bool) (
            $investment[
                'principal_returned'
            ] ?? false
        );

    $now =
        aiNow();

    /*
    |--------------------------------------------------------------------------
    | APPROVE
    |--------------------------------------------------------------------------
    */

    if (
        $action === 'approve' ||
        $action === 'approved'
    ) {

        /*
         * LEGACY RECORD
         *
         * If this investment already had its principal
         * deducted, approval must NOT deduct again.
         */
        if ($balanceWasDeducted) {

            $dailyRate =
                aiInvestmentRate(
                    $investment
                );

            $duration =
                aiInvestmentDuration(
                    $investment
                );

            /*
             * Do not invent a rate here.
             * Preserve the investment's stored terms.
             */
            $dailyEarning =
                (int) round(
                    $amount * $dailyRate
                );

            $nextEarningDate =
                aiNextEarningDate(
                    $now
                );

            $maturityDate =
                aiMaturityDate(
                    $now,
                    $duration
                );

            $session =
                $client->startSession();

            try {

                $session->withTransaction(
                    function (
                        MongoDB\Driver\Session $session
                    ) use (
                        $investments,
                        $transactions,
                        $investmentObjectId,
                        $investmentId,
                        $investmentUserId,
                        $amount,
                        $walletBefore,
                        $currentStatus,
                        $currentAdmin,
                        $investment,
                        $now,
                        $dailyRate,
                        $dailyEarning,
                        $duration,
                        $nextEarningDate,
                        $maturityDate,
                        $adminNote,
                        $session
                    ): void {

                        $updateSet = [

                            'status' =>
                                'approved',

                            'approved_at' =>
                                $investment[
                                    'approved_at'
                                ]
                                ?? $now,

                            'activated_at' =>
                                $investment[
                                    'activated_at'
                                ]
                                ?? $now,

                            'start_date' =>
                                $investment[
                                    'start_date'
                                ]
                                ?? $now,

                            'maturity_date' =>
                                $investment[
                                    'maturity_date'
                                ]
                                ?? $maturityDate,

                            'updated_at' =>
                                $now,

                            'balance_deducted' =>
                                true,

                            'admin_approved' =>
                                true,

                            'admin_id' =>
                                aiString(
                                    aiUserId(
                                        $currentAdmin
                                    )
                                ),

                            'admin_email' =>
                                (string) (
                                    $currentAdmin[
                                        'email'
                                    ] ?? ''
                                ),

                            'daily_rate' =>
                                $dailyRate,

                            'daily_earning' =>
                                $dailyEarning,

                            'duration' =>
                                $duration,

                            'next_earning_date' =>
                                $investment[
                                    'next_earning_date'
                                ]
                                ?? $nextEarningDate,
                        ];

                        if ($adminNote !== '') {
                            $updateSet[
                                'admin_note'
                            ] = $adminNote;
                        }

                        $result =
                            $investments->updateOne(
                                [
                                    '_id' =>
                                        $investmentObjectId,

                                    'status' =>
                                        $currentStatus,

                                    'balance_deducted' =>
                                        true,
                                ],
                                [
                                    '$set' =>
                                        $updateSet,
                                ],
                                [
                                    'session' =>
                                        $session,
                                ]
                            );

                        if (
                            $result->getModifiedCount() !== 1
                        ) {
                            throw new RuntimeException(
                                'Investment was already processed.'
                            );
                        }

                        aiRecordApprovalTransaction(
                            $transactions,
                            $investmentId,
                            $investmentUserId,
                            $amount,
                            $walletBefore,
                            $walletBefore,
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
                    'investment_approved_legacy',
                    [
                        'investment_id' =>
                            $investmentId,

                        'user_id' =>
                            $investmentUserId,

                        'amount' =>
                            $amount,

                        'wallet_deducted' =>
                            false,

                        'already_deducted' =>
                            true,

                        'admin_id' =>
                            aiString(
                                aiUserId(
                                    $currentAdmin
                                )
                            ),
                    ]
                );

            } catch (Throwable $auditError) {

                error_log(
                    'Legacy investment audit error: ' .
                    $auditError->getMessage()
                );
            }

            adminInvestmentResponse(
                true,
                'Investment approved. Its principal had already been deducted.',
                [
                    'investment_id' =>
                        $investmentId,

                    'user_id' =>
                        $investmentUserId,

                    'amount' =>
                        $amount,

                    'status' =>
                        'approved',

                    'wallet_deducted' =>
                        false,

                    'already_deducted' =>
                        true,

                    'wallet_before' =>
                        $walletBefore,

                    'wallet_after' =>
                        $walletBefore,
                ]
            );
        }

        /*
         * NEW RECORD
         *
         * The investment was created without deduction.
         * Deduct principal now, during approval.
         */

        if ($walletBefore < $amount) {

            adminInvestmentResponse(
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

        $dailyRate =
            aiInvestmentRate(
                $investment
            );

        /*
         * The investment must already contain its
         * configured rate. Do not silently create one.
         */
        if ($dailyRate <= 0) {

            adminInvestmentResponse(
                false,
                'Investment daily return rate is missing. Please correct the investment plan before approving it.',
                [],
                400
            );
        }

        $duration =
            aiInvestmentDuration(
                $investment
            );

        $dailyEarning =
            (int) round(
                $amount * $dailyRate
            );

        $nextEarningDate =
            aiNextEarningDate(
                $now
            );

        $maturityDate =
            aiMaturityDate(
                $now,
                $duration
            );

        $walletAfter =
            $walletBefore -
            $amount;

        /*
         * Atomic wallet condition.
         */
        $userFilter =
            aiUserFilter(
                $investmentUser
            );

        $userFilter[$walletField] = [
            '$gte' => $amount,
        ];

        /*
         * MongoDB transaction.
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
                    $investmentUser,
                    $investmentUserId,
                    $amount,
                    $walletField,
                    $walletBefore,
                    $walletAfter,
                    $currentStatus,
                    $currentAdmin,
                    $now,
                    $dailyRate,
                    $dailyEarning,
                    $duration,
                    $nextEarningDate,
                    $maturityDate,
                    $adminNote,
                    $userFilter
                ): void {

                    /*
                     * 1. Deduct wallet exactly once.
                     */
                    $deductResult =
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
                        $deductResult->getModifiedCount() !== 1
                    ) {
                        throw new RuntimeException(
                            'Wallet balance changed or is insufficient.'
                        );
                    }

                    /*
                     * 2. Resolve user information.
                     */
                    $resolvedName =
                        aiUserName(
                            $investmentUser
                        );

                    $updateSet = [

                        'status' =>
                            'approved',

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

                        'admin_approved' =>
                            true,

                        'admin_id' =>
                            aiString(
                                aiUserId(
                                    $currentAdmin
                                )
                            ),

                        'admin_email' =>
                            (string) (
                                $currentAdmin[
                                    'email'
                                ] ?? ''
                            ),

                        'daily_rate' =>
                            $dailyRate,

                        'daily_earning' =>
                            $dailyEarning,

                        'duration' =>
                            $duration,

                        'earnings_processed' =>
                            aiMoney(
                                $investment[
                                    'earnings_processed'
                                ] ?? 0
                            ),

                        'total_earnings_paid' =>
                            aiMoney(
                                $investment[
                                    'total_earnings_paid'
                                ] ?? 0
                            ),

                        'earning_days' =>
                            (int) (
                                $investment[
                                    'earning_days'
                                ] ?? 0
                            ),

                        'last_earning_date' =>
                            $investment[
                                'last_earning_date'
                            ] ?? null,

                        'next_earning_date' =>
                            $nextEarningDate,

                        'earnings_paid' =>
                            (bool) (
                                $investment[
                                    'earnings_paid'
                                ] ?? false
                            ),

                        'principal_returned' =>
                            false,
                    ];

                    if (
                        $resolvedName !==
                        'Unknown user'
                    ) {

                        $updateSet[
                            'user_name'
                        ] =
                            $resolvedName;

                        $updateSet[
                            'name'
                        ] =
                            $resolvedName;

                        $updateSet[
                            'full_name'
                        ] =
                            $resolvedName;
                    }

                    if (
                        !empty(
                            $investmentUser[
                                'email'
                            ]
                        )
                    ) {

                        $updateSet[
                            'email'
                        ] =
                            (string) (
                                $investmentUser[
                                    'email'
                                ]
                            );
                    }

                    if ($adminNote !== '') {

                        $updateSet[
                            'admin_note'
                        ] =
                            $adminNote;
                    }

                    /*
                     * 3. Approve only if still pending.
                     *
                     * The balance_deducted condition prevents
                     * a second approval from deducting again.
                     */
                    $investmentResult =
                        $investments->updateOne(
                            [
                                '_id' =>
                                    $investmentObjectId,

                                'status' =>
                                    $currentStatus,

                                'balance_deducted' =>
                                    [
                                        '$ne' =>
                                            true,
                                    ],
                            ],
                            [
                                '$set' =>
                                    $updateSet,
                            ],
                            [
                                'session' =>
                                    $session,
                            ]
                        );

                    if (
                        $investmentResult
                            ->getModifiedCount() !== 1
                    ) {

                        throw new RuntimeException(
                            'Investment was already processed.'
                        );
                    }

                    /*
                     * 4. Accounting transaction.
                     */
                    aiRecordApprovalTransaction(
                        $transactions,
                        $investmentId,
                        $investmentUserId,
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
                        $investmentUserId,

                    'amount' =>
                        $amount,

                    'wallet_before' =>
                        $walletBefore,

                    'wallet_after' =>
                        $walletAfter,

                    'wallet_deducted' =>
                        true,

                    'daily_rate' =>
                        $dailyRate,

                    'daily_earning' =>
                        $dailyEarning,

                    'duration' =>
                        $duration,

                    'admin_id' =>
                        aiString(
                            aiUserId(
                                $currentAdmin
                            )
                        ),
                ]
            );

        } catch (Throwable $auditError) {

            error_log(
                'Investment approval audit error: ' .
                $auditError->getMessage()
            );
        }

        adminInvestmentResponse(
            true,
            'Investment approved successfully. The wallet principal was deducted once.',
            [
                'investment_id' =>
                    $investmentId,

                'user_id' =>
                    $investmentUserId,

                'amount' =>
                    $amount,

                'status' =>
                    'approved',

                'wallet_deducted' =>
                    true,

                'already_deducted' =>
                    false,

                'wallet_before' =>
                    $walletBefore,

                'wallet_after' =>
                    $walletAfter,

                'daily_rate' =>
                    $dailyRate,

                'daily_earning' =>
                    $dailyEarning,

                'duration' =>
                    $duration,

                'next_earning_date' =>
                    $nextEarningDate,
            ]
        );
    }

    /*
    |--------------------------------------------------------------------------
    | REJECT
    |--------------------------------------------------------------------------
    */

    if (
        $action === 'reject' ||
        $action === 'rejected'
    ) {

        /*
         * Refund only a legacy investment whose principal
         * was actually deducted and has not already been
         * returned.
         */
        $refundRequired =
            $balanceWasDeducted &&
            !$principalReturned;

        $walletAfter =
            $walletBefore;

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
                    $investmentUser,
                    $investmentUserId,
                    $amount,
                    $walletBefore,
                    &$walletAfter,
                    $walletField,
                    $refundRequired,
                    $principalReturned,
                    $currentStatus,
                    $currentAdmin,
                    $now,
                    $adminNote
                ): void {

                    /*
                     * Refund legacy deduction.
                     */
                    if ($refundRequired) {

                        $userFilter =
                            aiUserFilter(
                                $investmentUser
                            );

                        $refundResult =
                            $users->updateOne(
                                $userFilter,
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
                                ->getModifiedCount() !== 1
                        ) {

                            throw new RuntimeException(
                                'Wallet refund failed.'
                            );
                        }

                        $walletAfter =
                            $walletBefore +
                            $amount;
                    }

                    /*
                     * Mark rejected.
                     */
                    $updateSet = [

                        'status' =>
                            'rejected',

                        'rejected_at' =>
                            $now,

                        'updated_at' =>
                            $now,

                        'admin_approved' =>
                            false,

                        'admin_id' =>
                            aiString(
                                aiUserId(
                                    $currentAdmin
                                )
                            ),

                        'admin_email' =>
                            (string) (
                                $currentAdmin[
                                    'email'
                                ] ?? ''
                            ),

                        'balance_reserved' =>
                            false,
                    ];

                    if ($refundRequired) {

                        $updateSet[
                            'principal_returned'
                        ] = true;

                        $updateSet[
                            'balance_refunded'
                        ] = true;

                        $updateSet[
                            'refunded_at'
                        ] = $now;

                    } else {

                        $updateSet[
                            'principal_returned'
                        ] =
                            $principalReturned;

                        $updateSet[
                            'balance_refunded'
                        ] = false;
                    }

                    if ($adminNote !== '') {

                        $updateSet[
                            'admin_note'
                        ] =
                            $adminNote;
                    }

                    /*
                     * Only process the current state.
                     */
                    $result =
                        $investments->updateOne(
                            [
                                '_id' =>
                                    $investmentObjectId,

                                'status' =>
                                    $currentStatus,
                            ],
                            [
                                '$set' =>
                                    $updateSet,
                            ],
                            [
                                'session' =>
                                    $session,
                            ]
                        );

                    if (
                        $result->getModifiedCount() !== 1
                    ) {

                        throw new RuntimeException(
                            'Investment was already processed.'
                        );
                    }

                    /*
                     * Record rejection/refund.
                     */
                    aiRecordRejectionTransaction(
                        $transactions,
                        $investmentId,
                        $investmentUserId,
                        $amount,
                        $walletBefore,
                        $walletAfter,
                        $refundRequired,
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
         * Audit.
         */
        try {

            audit(
                'investment_rejected',
                [
                    'investment_id' =>
                        $investmentId,

                    'user_id' =>
                        $investmentUserId,

                    'amount' =>
                        $amount,

                    'wallet_refunded' =>
                        $refundRequired,

                    'refund_amount' =>
                        $refundRequired
                            ? $amount
                            : 0,

                    'wallet_before' =>
                        $walletBefore,

                    'wallet_after' =>
                        $walletAfter,

                    'admin_id' =>
                        aiString(
                            aiUserId(
                                $currentAdmin
                            )
                        ),
                ]
            );

        } catch (Throwable $auditError) {

            error_log(
                'Investment rejection audit error: ' .
                $auditError->getMessage()
            );
        }

        adminInvestmentResponse(
            true,
            $refundRequired
                ? 'Investment rejected and the previously deducted principal was refunded.'
                : 'Investment rejected successfully. No wallet deduction occurred.',
            [
                'investment_id' =>
                    $investmentId,

                'user_id' =>
                    $investmentUserId,

                'amount' =>
                    $amount,

                'status' =>
                    'rejected',

                'wallet_refunded' =>
                    $refundRequired,

                'refund_amount' =>
                    $refundRequired
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

    /*
     * Never expose raw database/server errors to users.
     */
    error_log(
        'admin_investments POST error: ' .
        $e->getMessage()
    );

    adminInvestmentResponse(
        false,
        'Unable to process the investment request. Please try again.',
        [],
        500
    );
}

/*
|--------------------------------------------------------------------------
| FALLBACK
|--------------------------------------------------------------------------
*/

adminInvestmentResponse(
    false,
    'Unable to process the investment request.',
    [],
    500
);