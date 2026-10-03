<?php
declare(strict_types=1);

/*
|--------------------------------------------------------------------------
| Crown Cash - Admin Investments API
|--------------------------------------------------------------------------
| Handles:
|   - Loading investments
|   - Approving pending investments
|   - Rejecting pending investments
|   - Restoring reserved principal on rejection
|
| IMPORTANT ACCOUNTING RULE:
|   Investment creation deducts/reserves the principal ONCE.
|   Approval does NOT deduct the wallet again.
|   Rejection restores the principal only when it was actually reserved.
|   Daily earnings are handled separately by daily_earnings.php.
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
| Helpers
|--------------------------------------------------------------------------
*/

function investmentResponse(
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
        JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE
    );

    exit;
}

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

function invNormalizeStatus(mixed $status): string
{
    return strtolower(trim((string)$status));
}

function invFindUser(
    MongoDB\Collection $users,
    mixed $userId,
    mixed $email = null
): ?array {
    $id = invObjectId($userId);

    if ($id !== null) {
        $user = $users->findOne(['_id' => $id]);

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

    $email = trim((string)$email);

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

function invUserIdValue(array $user): mixed
{
    if (isset($user['_id'])) {
        return $user['_id'];
    }

    if (!empty($user['id'])) {
        return $user['id'];
    }

    if (!empty($user['user_id'])) {
        return $user['user_id'];
    }

    if (!empty($user['userId'])) {
        return $user['userId'];
    }

    return null;
}

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

    if (isset($user['wallet']) && is_array($user['wallet'])) {
        return 'wallet.balance';
    }

    return 'balance';
}

function invWalletBalance(array $user): int
{
    if (isset($user['balance'])) {
        return invMoney($user['balance']);
    }

    if (isset($user['wallet_balance'])) {
        return invMoney($user['wallet_balance']);
    }

    if (isset($user['walletBalance'])) {
        return invMoney($user['walletBalance']);
    }

    if (isset($user['wallet']) && is_array($user['wallet'])) {
        return invMoney($user['wallet']['balance'] ?? 0);
    }

    return 0;
}

function invSetWalletBalance(
    MongoDB\Collection $users,
    array $user,
    int $newBalance
): void {
    $newBalance = max(0, $newBalance);

    $userId = invUserIdValue($user);

    if ($userId === null) {
        throw new RuntimeException('Unable to determine user ID.');
    }

    $field = invWalletField($user);

    $users->updateOne(
        ['_id' => $user['_id'] ?? $userId],
        ['$set' => [
            $field => $newBalance,
            'updated_at' => nowUtc(),
        ]]
    );
}

function invGetUserFilter(array $user): array
{
    if (isset($user['_id'])) {
        return ['_id' => $user['_id']];
    }

    if (!empty($user['id'])) {
        return ['id' => $user['id']];
    }

    if (!empty($user['user_id'])) {
        return ['user_id' => $user['user_id']];
    }

    if (!empty($user['userId'])) {
        return ['userId' => $user['userId']];
    }

    throw new RuntimeException('Unable to build user filter.');
}

function invAdminAllowed(array $user): bool
{
    $role = strtolower(trim((string)($user['role'] ?? '')));
    $accountType = strtolower(trim((string)($user['account_type'] ?? '')));

    return
        ($user['is_admin'] ?? false) === true ||
        in_array($role, ['admin', 'administrator'], true) ||
        in_array($accountType, ['admin', 'administrator'], true);
}

/*
|--------------------------------------------------------------------------
| Authentication
|--------------------------------------------------------------------------
*/

startSecureSession();

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'GET' ||
    ($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'POST') {

    $sessionUserId = currentUserId();

    if (!$sessionUserId) {
        investmentResponse(
            false,
            'Authentication required.',
            [],
            401
        );
    }

    $currentAdmin = invFindUser(
        $users,
        $sessionUserId
    );

    if ($currentAdmin === null) {
        investmentResponse(
            false,
            'Administrator account was not found.',
            [],
            401
        );
    }

    if (!invAdminAllowed($currentAdmin)) {
        investmentResponse(
            false,
            'Administrator access required.',
            [],
            403
        );
    }

    /*
     * Optional environment restrictions.
     */
    $configuredAdminId = trim((string)(getenv('ADMIN_USER_ID') ?: ''));
    $configuredAdminEmail = strtolower(
        trim((string)(getenv('ADMIN_EMAIL') ?: ''))
    );

    $actualAdminId = invString(invUserIdValue($currentAdmin));
    $actualAdminEmail = strtolower(
        trim((string)($currentAdmin['email'] ?? ''))
    );

    if (
        $configuredAdminId !== '' &&
        $actualAdminId !== $configuredAdminId
    ) {
        investmentResponse(
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
        investmentResponse(
            false,
            'Administrator authorization failed.',
            [],
            403
        );
    }
}

/*
|--------------------------------------------------------------------------
| GET - Load Investments
|--------------------------------------------------------------------------
*/

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'GET') {

    $status = strtolower(
        trim((string)($_GET['status'] ?? ''))
    );

    $search = trim(
        (string)($_GET['search'] ?? '')
    );

    $filter = [];

    if ($status !== '' && $status !== 'all') {
        $filter['status'] = $status;
    }

    /*
     * Search by investment ID, user ID, email or name.
     */
    if ($search !== '') {

        $searchConditions = [];

        $objectId = invObjectId($search);

        if ($objectId !== null) {
            $searchConditions[] = [
                '_id' => $objectId,
            ];

            $searchConditions[] = [
                'user_id' => $objectId,
            ];
        }

        $searchConditions[] = [
            'user_id' => $search,
        ];

        $searchConditions[] = [
            'email' => [
                '$regex' => preg_quote($search, '/'),
                '$options' => 'i',
            ],
        ];

        $searchConditions[] = [
            'name' => [
                '$regex' => preg_quote($search, '/'),
                '$options' => 'i',
            ],
        ];

        $searchConditions[] = [
            'full_name' => [
                '$regex' => preg_quote($search, '/'),
                '$options' => 'i',
            ],
        ];

        $filter['$or'] = $searchConditions;
    }

    try {
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

        foreach ($cursor as $doc) {
            $investment = $doc->getArrayCopy();

            $id = invString($investment['_id'] ?? '');

            $userId = invString(
                $investment['user_id']
                ?? $investment['userId']
                ?? ''
            );

            $amount = invMoney(
                $investment['amount']
                ?? $investment['principal']
                ?? $investment['investment_amount']
                ?? 0
            );

            $plan = (string)(
                $investment['plan']
                ?? $investment['plan_name']
                ?? $investment['package']
                ?? ''
            );

            $investmentStatus = invNormalizeStatus(
                $investment['status'] ?? 'pending'
            );

            $dailyRate = (float)(
                $investment['daily_rate']
                ?? $investment['dailyRate']
                ?? $investment['rate']
                ?? 0.10
            );

            /*
             * Some databases store 10 rather than 0.10.
             */
            if ($dailyRate > 1) {
                $dailyRate = $dailyRate / 100;
            }

            $dailyEarning = $amount * $dailyRate;

            $createdAt = $investment['created_at']
                ?? $investment['createdAt']
                ?? null;

            $approvedAt = $investment['approved_at']
                ?? $investment['approvedAt']
                ?? null;

            $activatedAt = $investment['activated_at']
                ?? $investment['activatedAt']
                ?? $approvedAt
                ?? $createdAt;

            $items[] = [
                'id' => $id,
                '_id' => $id,

                'user_id' => $userId,
                'userId' => $userId,

                'name' => (string)(
                    $investment['name']
                    ?? $investment['full_name']
                    ?? ''
                ),

                'email' => (string)(
                    $investment['email']
                    ?? ''
                ),

                'plan' => $plan,
                'plan_name' => $plan,

                'amount' => $amount,
                'principal' => $amount,
                'investment_amount' => $amount,

                'daily_rate' => $dailyRate,
                'dailyRate' => $dailyRate,
                'daily_earning' => (int)round($dailyEarning),

                'duration' => (int)(
                    $investment['duration']
                    ?? $investment['duration_days']
                    ?? 30
                ),

                'status' => $investmentStatus,

                'balance_reserved' =>
                    (bool)($investment['balance_reserved'] ?? false),

                'balance_deducted' =>
                    (bool)($investment['balance_deducted'] ?? false),

                'principal_returned' =>
                    (bool)($investment['principal_returned'] ?? false),

                'earnings_paid' =>
                    (bool)($investment['earnings_paid'] ?? false),

                'created_at' => $createdAt,
                'approved_at' => $approvedAt,
                'activated_at' => $activatedAt,

                'admin_note' => (string)(
                    $investment['admin_note'] ?? ''
                ),
            ];
        }

        /*
         * Statistics.
         */
        $allDocs = $investments->find([]);

        $stats = [
            'total' => 0,
            'pending' => 0,
            'approved' => 0,
            'active' => 0,
            'completed' => 0,
            'rejected' => 0,
            'cancelled' => 0,
            'total_amount' => 0,
            'pending_amount' => 0,
            'active_amount' => 0,
            'completed_amount' => 0,
        ];

        foreach ($allDocs as $doc) {
            $row = $doc->getArrayCopy();

            $rowStatus = invNormalizeStatus(
                $row['status'] ?? 'pending'
            );

            $rowAmount = invMoney(
                $row['amount']
                ?? $row['principal']
                ?? $row['investment_amount']
                ?? 0
            );

            $stats['total']++;

            if (isset($stats[$rowStatus])) {
                $stats[$rowStatus]++;
            }

            $stats['total_amount'] += $rowAmount;

            if ($rowStatus === 'pending') {
                $stats['pending_amount'] += $rowAmount;
            }

            if (in_array(
                $rowStatus,
                ['approved', 'active', 'running'],
                true
            )) {
                $stats['active_amount'] += $rowAmount;
            }

            if ($rowStatus === 'completed') {
                $stats['completed_amount'] += $rowAmount;
            }
        }

        investmentResponse(
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

        investmentResponse(
            false,
            'Failed to load investments.',
            [],
            500
        );
    }
}

/*
|--------------------------------------------------------------------------
| POST - Approve / Reject Investment
|--------------------------------------------------------------------------
*/

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') {
    investmentResponse(
        false,
        'Method not allowed.',
        [],
        405
    );
}

$rawBody = file_get_contents('php://input');

$body = json_decode(
    $rawBody ?: '{}',
    true
);

if (!is_array($body)) {
    $body = [];
}

$investmentId = trim(
    (string)(
        $body['investmentId']
        ?? $body['investment_id']
        ?? $body['id']
        ?? $_POST['investmentId']
        ?? $_POST['investment_id']
        ?? $_POST['id']
        ?? ''
    )
);

$action = strtolower(
    trim(
        (string)(
            $body['action']
            ?? $_POST['action']
            ?? ''
        )
    )
);

$adminNote = trim(
    (string)(
        $body['admin_note']
        ?? $body['adminNote']
        ?? $body['note']
        ?? $_POST['admin_note']
        ?? $_POST['note']
        ?? ''
    )
);

if ($investmentId === '') {
    investmentResponse(
        false,
        'Investment ID is required.',
        [],
        400
    );
}

if (!in_array(
    $action,
    ['approve', 'approved', 'reject', 'rejected'],
    true
)) {
    investmentResponse(
        false,
        'Invalid investment action.',
        [],
        400
    );
}

$objectId = invObjectId($investmentId);

if ($objectId === null) {
    investmentResponse(
        false,
        'Invalid investment ID.',
        [],
        400
    );
}

try {

    /*
     * Find investment.
     */
    $investmentDoc = $investments->findOne([
        '_id' => $objectId,
    ]);

    if ($investmentDoc === null) {
        investmentResponse(
            false,
            'Investment not found.',
            [],
            404
        );
    }

    $investment = $investmentDoc->getArrayCopy();

    $currentStatus = invNormalizeStatus(
        $investment['status'] ?? 'pending'
    );

    /*
     * Only pending investments should be approved/rejected.
     */
    if ($currentStatus !== 'pending') {
        investmentResponse(
            false,
            'This investment has already been processed.',
            [
                'status' => $currentStatus,
            ],
            409
        );
    }

    $amount = invMoney(
        $investment['amount']
        ?? $investment['principal']
        ?? $investment['investment_amount']
        ?? 0
    );

    if ($amount <= 0) {
        investmentResponse(
            false,
            'Investment amount is invalid.',
            [],
            400
        );
    }

    $userId = $investment['user_id']
        ?? $investment['userId']
        ?? $investment['owner_id']
        ?? $investment['ownerId']
        ?? null;

    $userEmail = $investment['email'] ?? '';

    $investmentUser = invFindUser(
        $users,
        $userId,
        $userEmail
    );

    if ($investmentUser === null) {
        investmentResponse(
            false,
            'Investment owner could not be found.',
            [],
            404
        );
    }

    $investmentUserId = invString(
        invUserIdValue($investmentUser)
    );

    if ($action === 'approve' || $action === 'approved') {

        /*
         * --------------------------------------------------------------
         * APPROVE
         * --------------------------------------------------------------
         *
         * DO NOT deduct wallet here.
         *
         * The principal was already reserved/deducted when the
         * investment was created.
         */

        $now = nowUtc();

        $update = [
            '$set' => [
                'status' => 'approved',
                'approved_at' => $now,
                'activated_at' => $now,
                'start_date' => $now,
                'updated_at' => $now,

                /*
                 * The money remains reserved.
                 */
                'balance_reserved' =>
                    (bool)($investment['balance_reserved'] ?? true),

                'balance_deducted' =>
                    (bool)(
                        $investment['balance_deducted']
                        ?? $investment['balance_reserved']
                        ?? true
                    ),

                'admin_approved' => true,
                'admin_id' => invString(
                    invUserIdValue($currentAdmin)
                ),
                'admin_email' => (string)(
                    $currentAdmin['email'] ?? ''
                ),
            ],
        ];

        if ($adminNote !== '') {
            $update['$set']['admin_note'] = $adminNote;
        }

        $result = $investments->updateOne(
            [
                '_id' => $objectId,
                'status' => 'pending',
            ],
            $update
        );

        if ($result->getModifiedCount() !== 1) {
            investmentResponse(
                false,
                'Investment could not be approved. It may have already been processed.',
                [],
                409
            );
        }

        /*
         * Record approval transaction.
         *
         * This transaction is informational only.
         * It does NOT change wallet balance.
         */
        try {
            $transactions->insertOne([
                'user_id' => $investmentUserId,
                'userId' => $investmentUserId,

                'investment_id' => $investmentId,
                'investmentId' => $investmentId,

                'type' => 'investment_approved',
                'category' => 'investment',

                'amount' => $amount,

                'balance_change' => 0,

                'status' => 'approved',

                'description' =>
                    'Investment approved. Principal was already reserved.',

                'admin_id' => invString(
                    invUserIdValue($currentAdmin)
                ),

                'admin_email' => (string)(
                    $currentAdmin['email'] ?? ''
                ),

                'created_at' => $now,
            ]);
        } catch (Throwable $transactionError) {
            error_log(
                'Investment approval transaction log error: ' .
                $transactionError->getMessage()
            );
        }

        /*
         * Audit.
         */
        try {
            audit(
                'investment_approved',
                [
                    'investment_id' => $investmentId,
                    'user_id' => $investmentUserId,
                    'amount' => $amount,
                    'admin_id' => invString(
                        invUserIdValue($currentAdmin)
                    ),
                ]
            );
        } catch (Throwable $auditError) {
            error_log(
                'Investment approval audit error: ' .
                $auditError->getMessage()
            );
        }

        investmentResponse(
            true,
            'Investment approved successfully.',
            [
                'investment_id' => $investmentId,
                'user_id' => $investmentUserId,
                'amount' => $amount,
                'status' => 'approved',

                /*
                 * Explicitly tell frontend that no second deduction
                 * occurred.
                 */
                'wallet_deducted' => false,
                'already_reserved' =>
                    (bool)($investment['balance_reserved'] ?? true),
            ]
        );
    }

    /*
     * --------------------------------------------------------------
     * REJECT
     * --------------------------------------------------------------
     */

    if ($action === 'reject' || $action === 'rejected') {

        $now = nowUtc();

        /*
         * Critical:
         *
         * Only restore the principal if it was actually reserved
         * when the investment was created.
         *
         * This prevents historical/unreserved investments from
         * receiving an incorrect wallet refund.
         */
        $balanceWasReserved =
            (bool)($investment['balance_reserved'] ?? false);

        $principalAlreadyReturned =
            (bool)($investment['principal_returned'] ?? false);

        $walletBefore = invWalletBalance(
            $investmentUser
        );

        $walletAfter = $walletBefore;

        /*
         * We use the stored investment status in the filter so two
         * simultaneous admin requests cannot both process it.
         */
        $updateSet = [
            'status' => 'rejected',
            'rejected_at' => $now,
            'updated_at' => $now,

            'admin_approved' => false,

            'admin_id' => invString(
                invUserIdValue($currentAdmin)
            ),

            'admin_email' => (string)(
                $currentAdmin['email'] ?? ''
            ),

            /*
             * Once rejection is processed, reservation no longer
             * exists.
             */
            'balance_reserved' => false,
        ];

        if ($adminNote !== '') {
            $updateSet['admin_note'] = $adminNote;
        }

        /*
         * If money was reserved and has not already been returned,
         * refund it exactly once.
         */
        if ($balanceWasReserved && !$principalAlreadyReturned) {

            $walletAfter = $walletBefore + $amount;

            /*
             * Atomic user update:
             *
             * This prevents the balance from being overwritten by a
             * stale value if another wallet operation happens.
             */
            $userFilter = invGetUserFilter($investmentUser);

            $walletField = invWalletField($investmentUser);

            $users->updateOne(
                $userFilter,
                [
                    '$inc' => [
                        $walletField => $amount,
                    ],
                    '$set' => [
                        'updated_at' => $now,
                    ],
                ]
            );

            $updateSet['principal_returned'] = true;
            $updateSet['balance_refunded'] = true;
            $updateSet['refunded_at'] = $now;

            /*
             * Wallet transaction for refund.
             */
            try {
                $transactions->insertOne([
                    'user_id' => $investmentUserId,
                    'userId' => $investmentUserId,

                    'investment_id' => $investmentId,
                    'investmentId' => $investmentId,

                    'type' => 'investment_rejected_refund',
                    'category' => 'investment',

                    'amount' => $amount,

                    'balance_change' => $amount,

                    'status' => 'completed',

                    'description' =>
                        'Investment rejected. Reserved principal refunded to wallet.',

                    'admin_id' => invString(
                        invUserIdValue($currentAdmin)
                    ),

                    'admin_email' => (string)(
                        $currentAdmin['email'] ?? ''
                    ),

                    'created_at' => $now,
                ]);
            } catch (Throwable $transactionError) {
                error_log(
                    'Investment rejection refund transaction log error: ' .
                    $transactionError->getMessage()
                );
            }

        } else {

            /*
             * No wallet refund.
             */
            $updateSet['principal_returned'] =
                $principalAlreadyReturned;

            $updateSet['balance_refunded'] = false;
        }

        /*
         * Update investment status.
         */
        $result = $investments->updateOne(
            [
                '_id' => $objectId,
                'status' => 'pending',
            ],
            [
                '$set' => $updateSet,
            ]
        );

        /*
         * If the investment was processed by another request after
         * the wallet update, we need to avoid silently claiming success.
         *
         * The normal single-admin path will modify exactly one record.
         */
        if ($result->getModifiedCount() !== 1) {

            /*
             * If we already refunded the wallet but the investment
             * status update failed, this is an exceptional consistency
             * case. Log it for investigation rather than performing a
             * second automatic refund.
             */
            if ($balanceWasReserved && !$principalAlreadyReturned) {
                error_log(
                    'CRITICAL: Investment wallet refunded but investment status update failed. ' .
                    'Investment ID: ' . $investmentId
                );
            }

            investmentResponse(
                false,
                'Investment could not be rejected. It may have already been processed.',
                [],
                409
            );
        }

        /*
         * Audit.
         */
        try {
            audit(
                'investment_rejected',
                [
                    'investment_id' => $investmentId,
                    'user_id' => $investmentUserId,
                    'amount' => $amount,
                    'wallet_refunded' =>
                        ($balanceWasReserved && !$principalAlreadyReturned),
                    'admin_id' => invString(
                        invUserIdValue($currentAdmin)
                    ),
                ]
            );
        } catch (Throwable $auditError) {
            error_log(
                'Investment rejection audit error: ' .
                $auditError->getMessage()
            );
        }

        investmentResponse(
            true,
            'Investment rejected successfully.',
            [
                'investment_id' => $investmentId,
                'user_id' => $investmentUserId,
                'amount' => $amount,
                'status' => 'rejected',

                'wallet_refunded' =>
                    ($balanceWasReserved && !$principalAlreadyReturned),

                'refund_amount' =>
                    ($balanceWasReserved && !$principalAlreadyReturned)
                        ? $amount
                        : 0,

                'wallet_before' => $walletBefore,
                'wallet_after' => $walletAfter,
            ]
        );
    }
}

investmentResponse(
    false,
    'Unable to process investment request.',
    [],
    500
);