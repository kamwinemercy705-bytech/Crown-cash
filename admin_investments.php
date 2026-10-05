<?php

declare(strict_types=1);

/*
|--------------------------------------------------------------------------
| CROWN CASH - ADMIN INVESTMENTS API
|--------------------------------------------------------------------------
|
| Handles:
|   - Loading investments
|   - Approving investments
|   - Rejecting investments
|   - Deducting investment principal ON APPROVAL
|   - Refunding principal on rejection when applicable
|   - Investment/user enrichment
|   - Daily earnings initialization
|
| ACCOUNTING RULE
|--------------------------------------------------------------------------
|
| NEW FLOW:
|
| User creates investment
|       ↓
| status = pending
| balance_deducted = false
|       ↓
| Admin approves
|       ↓
| Wallet deducted ONCE
|       ↓
| Investment becomes approved
|       ↓
| Daily earnings can run
|
| Admin rejects
|       ↓
| If money was deducted/reserved → refund ONCE
|       ↓
| status = rejected
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

/*
|--------------------------------------------------------------------------
| HELPERS
|--------------------------------------------------------------------------
*/

function invString(mixed $value): string
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

function invObjectId(mixed $value): ?MongoDB\BSON\ObjectId
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

function invMoney(mixed $value): int
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

function invNormalizeStatus(mixed $status): string
{
    return strtolower(trim((string) $status));
}

/*
|--------------------------------------------------------------------------
| FIND USER
|--------------------------------------------------------------------------
*/

function invFindUser(
    MongoDB\Collection $users,
    mixed $userId,
    mixed $email = null
): ?array {

    $id = invObjectId($userId);

    if ($id !== null) {

        $user = $users->findOne([
            '_id' => $id,
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

    $email = trim((string) $email);

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

/*
|--------------------------------------------------------------------------
| USER ID
|--------------------------------------------------------------------------
*/

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

/*
|--------------------------------------------------------------------------
| USER NAME
|--------------------------------------------------------------------------
*/

function invUserName(array $user): string
{
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

    $full = trim(
        (string) (
            $user['full_name']
            ?? $user['fullName']
            ?? $user['name']
            ?? $user['username']
            ?? ''
        )
    );

    if ($full !== '') {
        return $full;
    }

    $combined = trim($first . ' ' . $last);

    if ($combined !== '') {
        return $combined;
    }

    return 'Unknown user';
}

/*
|--------------------------------------------------------------------------
| WALLET FIELD
|--------------------------------------------------------------------------
*/

function invWalletField(array $user): string
{
    /*
     * Crown Cash normally uses balance.
     *
     * We detect the actual existing wallet field so that
     * approval does not accidentally create a second wallet field.
     */

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

/*
|--------------------------------------------------------------------------
| WALLET BALANCE
|--------------------------------------------------------------------------
*/

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

/*
|--------------------------------------------------------------------------
| USER DATABASE FILTER
|--------------------------------------------------------------------------
*/

function invGetUserFilter(array $user): array
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

    throw new RuntimeException(
        'Unable to identify investment owner.'
    );
}

/*
|--------------------------------------------------------------------------
| ADMIN CHECK
|--------------------------------------------------------------------------
*/

function invAdminAllowed(array $user): bool
{
    $role = strtolower(
        trim((string) ($user['role'] ?? ''))
    );

    $accountType = strtolower(
        trim((string) ($user['account_type'] ?? ''))
    );

    $isAdminFlag =
        isset($user['is_admin']) &&
        $user['is_admin'] === true;

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

/*
|--------------------------------------------------------------------------
| ADMIN AUTHENTICATION
|--------------------------------------------------------------------------
*/

function authenticateInvestmentAdmin(): array
{
    startSecureSession();

    $sessionUserId = currentUserId();

    if (!$sessionUserId) {
        investmentResponse(
            false,
            'Authentication required.',
            [],
            401
        );
    }

    global $users;

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

    $configuredAdminId = trim(
        (string) (getenv('ADMIN_USER_ID') ?: '')
    );

    $configuredAdminEmail = strtolower(
        trim((string) (getenv('ADMIN_EMAIL') ?: ''))
    );

    $actualAdminId = invString(
        invUserIdValue($currentAdmin)
    );

    $actualAdminEmail = strtolower(
        trim((string) ($currentAdmin['email'] ?? ''))
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

    return $currentAdmin;
}

/*
|--------------------------------------------------------------------------
| FIND INVESTMENT OWNER
|--------------------------------------------------------------------------
*/

function invResolveOwner(
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
| AUTHENTICATE ADMIN
|--------------------------------------------------------------------------
*/

$currentAdmin = authenticateInvestmentAdmin();

/*
|--------------------------------------------------------------------------
| GET - LOAD INVESTMENTS
|--------------------------------------------------------------------------
*/

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'GET') {

    $status = strtolower(
        trim((string) ($_GET['status'] ?? ''))
    );

    $search = trim(
        (string) ($_GET['search'] ?? '')
    );

    $filter = [];

    if (
        $status !== '' &&
        $status !== 'all'
    ) {
        $filter['status'] = $status;
    }

    /*
     * Search.
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
                '$regex' => preg_quote(
                    $search,
                    '/'
                ),
                '$options' => 'i',
            ],
        ];

        $searchConditions[] = [
            'name' => [
                '$regex' => preg_quote(
                    $search,
                    '/'
                ),
                '$options' => 'i',
            ],
        ];

        $searchConditions[] = [
            'full_name' => [
                '$regex' => preg_quote(
                    $search,
                    '/'
                ),
                '$options' => 'i',
            ],
        ];

        $searchConditions[] = [
            'user_name' => [
                '$regex' => preg_quote(
                    $search,
                    '/'
                ),
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

            $amount = invMoney(
                $investment['amount']
                ?? $investment['principal']
                ?? $investment['investment_amount']
                ?? 0
            );

            $plan = (string) (
                $investment['plan']
                ?? $investment['plan_name']
                ?? $investment['package']
                ?? ''
            );

            $investmentStatus = invNormalizeStatus(
                $investment['status'] ?? 'pending'
            );

            $dailyRate = (float) (
                $investment['daily_rate']
                ?? $investment['dailyRate']
                ?? $investment['rate']
                ?? 0.10
            );

            if ($dailyRate > 1) {
                $dailyRate /= 100;
            }

            $dailyEarning = $amount * $dailyRate;

            /*
             * Resolve actual user.
             */
            $investmentUser = invResolveOwner(
                $users,
                $investment
            );

            $userName = '';

            $userEmail = '';

            $userPhone = '';

            if ($investmentUser !== null) {

                $userName =
                    invUserName(
                        $investmentUser
                    );

                $userEmail =
                    (string) (
                        $investmentUser['email']
                        ?? ''
                    );

                $userPhone =
                    (string) (
                        $investmentUser['phone']
                        ?? $investmentUser['phone_number']
                        ?? $investmentUser['phoneNumber']
                        ?? ''
                    );
            }

            /*
             * Fall back to investment-stored information.
             */
            if ($userName === '' || $userName === 'Unknown user') {

                $storedName = trim(
                    (string) (
                        $investment['user_name']
                        ?? $investment['name']
                        ?? $investment['full_name']
                        ?? $investment['fullName']
                        ?? ''
                    )
                );

                if ($storedName !== '') {
                    $userName = $storedName;
                }
            }

            if ($userEmail === '') {
                $userEmail = (string) (
                    $investment['email'] ?? ''
                );
            }

            if ($userPhone === '') {
                $userPhone = (string) (
                    $investment['phone']
                    ?? $investment['phone_number']
                    ?? ''
                );
            }

            if ($userName === '') {
                $userName = 'Unknown user';
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
                ?? $approvedAt
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
                    (int) round($dailyEarning),

                'dailyIncome' =>
                    (int) round($dailyEarning),

                'duration' => (int) (
                    $investment['duration']
                    ?? $investment['duration_days']
                    ?? 30
                ),

                'status' => $investmentStatus,

                'balance_reserved' =>
                    (bool) (
                        $investment['balance_reserved']
                        ?? false
                    ),

                'balance_deducted' =>
                    (bool) (
                        $investment['balance_deducted']
                        ?? false
                    ),

                'principal_returned' =>
                    (bool) (
                        $investment['principal_returned']
                        ?? false
                    ),

                'earnings_processed' =>
                    invMoney(
                        $investment['earnings_processed']
                        ?? 0
                    ),

                'total_earnings_paid' =>
                    invMoney(
                        $investment['total_earnings_paid']
                        ?? 0
                    ),

                'earning_days' =>
                    (int) (
                        $investment['earning_days']
                        ?? 0
                    ),

                'last_earning_date' =>
                    $investment['last_earning_date']
                    ?? null,

                'next_earning_date' =>
                    $investment['next_earning_date']
                    ?? null,

                'earnings_paid' =>
                    (bool) (
                        $investment['earnings_paid']
                        ?? false
                    ),

                'created_at' =>
                    $createdAt,

                'approved_at' =>
                    $approvedAt,

                'activated_at' =>
                    $activatedAt,

                'admin_note' =>
                    (string) (
                        $investment['admin_note']
                        ?? ''
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

            'running' => 0,

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

            $stats['total_amount'] +=
                $rowAmount;

            if ($rowStatus === 'pending') {

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

            if ($rowStatus === 'completed') {

                $stats['completed_amount'] +=
                    $rowAmount;
            }
        }

        investmentResponse(
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
| ONLY POST REMAINS
|--------------------------------------------------------------------------
*/

if (
    ($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST'
) {
    investmentResponse(
        false,
        'Method not allowed.',
        [],
        405
    );
}

/*
|--------------------------------------------------------------------------
| READ POST BODY
|--------------------------------------------------------------------------
*/

$rawBody = file_get_contents(
    'php://input'
);

$body = json_decode(
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
        (string) (
            $body['action']
            ?? $_POST['action']
            ?? ''
        )
    )
);

$adminNote = trim(
    (string) (
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

    investmentResponse(
        false,
        'Invalid investment action.',
        [],
        400
    );
}

$objectId = invObjectId(
    $investmentId
);

if ($objectId === null) {

    investmentResponse(
        false,
        'Invalid investment ID.',
        [],
        400
    );
}

/*
|--------------------------------------------------------------------------
| PROCESS
|--------------------------------------------------------------------------
*/

try {

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

    $investment =
        $investmentDoc->getArrayCopy();

    $currentStatus =
        invNormalizeStatus(
            $investment['status']
            ?? 'pending'
        );

    /*
     * Already approved investments should never be
     * deducted again.
     *
     * This is important for old records.
     */
    if (
        $action === 'approve' ||
        $action === 'approved'
    ) {

        if (
            in_array(
                $currentStatus,
                [
                    'approved',
                    'active',
                    'running',
                    'completed',
                ],
                true
            )
        ) {

            investmentResponse(
                false,
                'This investment has already been approved or completed.',
                [
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
    }

    if (
        $action === 'reject' ||
        $action === 'rejected'
    ) {

        if (
            in_array(
                $currentStatus,
                [
                    'rejected',
                    'completed',
                ],
                true
            )
        ) {

            investmentResponse(
                false,
                'This investment has already been processed.',
                [
                    'status' =>
                        $currentStatus,
                ],
                409
            );
        }
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

    /*
     * Resolve owner.
     */
    $investmentUser =
        invResolveOwner(
            $users,
            $investment
        );

    if ($investmentUser === null) {

        investmentResponse(
            false,
            'Investment owner could not be found.',
            [],
            404
        );
    }

    $investmentUserId =
        invString(
            invUserIdValue(
                $investmentUser
            )
        );

    if ($investmentUserId === '') {

        investmentResponse(
            false,
            'Investment owner ID is missing.',
            [],
            500
        );
    }

    /*
     * Current wallet.
     */
    $walletField =
        invWalletField(
            $investmentUser
        );

    $walletBefore =
        invWalletBalance(
            $investmentUser
        );

    /*
     * Existing accounting flags.
     */
    $balanceWasReserved =
        (bool) (
            $investment[
                'balance_reserved'
            ] ?? false
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
         * IMPORTANT:
         *
         * If the investment was already deducted by an
         * older investment.php, DO NOT deduct again.
         */
        if ($balanceWasDeducted) {

            $walletAfter =
                $walletBefore;

            $now = nowUtc();

            $dailyRate = (float) (
                $investment['daily_rate']
                ?? $investment['dailyRate']
                ?? 0.10
            );

            if ($dailyRate > 1) {
                $dailyRate /= 100;
            }

            $duration = (int) (
                $investment['duration']
                ?? $investment['duration_days']
                ?? 30
            );

            $dailyEarning =
                (int) round(
                    $amount * $dailyRate
                );

            $nextEarningDate =
                new MongoDB\BSON\UTCDateTime(
                    (time() + 86400) * 1000
                );

            $set = [

                'status' =>
                    'approved',

                'approved_at' =>
                    $now,

                'activated_at' =>
                    $now,

                'start_date' =>
                    $now,

                'updated_at' =>
                    $now,

                'balance_reserved' =>
                    $balanceWasReserved,

                'balance_deducted' =>
                    true,

                'admin_approved' =>
                    true,

                'admin_id' =>
                    invString(
                        invUserIdValue(
                            $currentAdmin
                        )
                    ),

                'admin_email' =>
                    (string) (
                        $currentAdmin['email']
                        ?? ''
                    ),

                'daily_earning' =>
                    $dailyEarning,

                'daily_rate' =>
                    $dailyRate,

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
                    (int) (
                        $investment[
                            'earning_days'
                        ] ?? 0
                    ),

                'next_earning_date' =>
                    $investment[
                        'next_earning_date'
                    ] ?? $nextEarningDate,
            ];

            if ($adminNote !== '') {
                $set['admin_note'] =
                    $adminNote;
            }

            $result =
                $investments->updateOne(
                    [
                        '_id' =>
                            $objectId,

                        'status' =>
                            $currentStatus,
                    ],
                    [
                        '$set' =>
                            $set,
                    ]
                );

            if (
                $result->getModifiedCount() !== 1
            ) {

                investmentResponse(
                    false,
                    'Investment could not be approved. It may already have been processed.',
                    [],
                    409
                );
            }

            /*
             * Log approval.
             */
            try {

                $transactions->insertOne([

                    'user_id' =>
                        $investmentUserId,

                    'userId' =>
                        $investmentUserId,

                    'investment_id' =>
                        $investmentId,

                    'investmentId' =>
                        $investmentId,

                    'type' =>
                        'investment_approved',

                    'category' =>
                        'investment',

                    'direction' =>
                        'debit',

                    'amount' =>
                        $amount,

                    'balance_before' =>
                        $walletBefore,

                    'balance_after' =>
                        $walletAfter,

                    'balance_change' =>
                        0,

                    'status' =>
                        'approved',

                    'description' =>
                        'Investment approved. Principal had already been deducted.',

                    'admin_id' =>
                        invString(
                            invUserIdValue(
                                $currentAdmin
                            )
                        ),

                    'admin_email' =>
                        (string) (
                            $currentAdmin['email']
                            ?? ''
                        ),

                    'created_at' =>
                        $now,
                ]);

            } catch (Throwable $transactionError) {

                error_log(
                    'Investment legacy approval transaction error: ' .
                    $transactionError->getMessage()
                );
            }

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

                        'wallet_deducted' =>
                            false,

                        'already_deducted' =>
                            true,

                        'admin_id' =>
                            invString(
                                invUserIdValue(
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

            investmentResponse(
                true,
                'Investment approved. The principal had already been deducted.',
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

                    'wallet_balance' =>
                        $walletAfter,
                ]
            );
        }

        /*
        |--------------------------------------------------------------------------
        | NEW INVESTMENT:
        | DEDUCT WALLET NOW
        |--------------------------------------------------------------------------
        */

        if ($walletBefore < $amount) {

            investmentResponse(
                false,
                'Insufficient wallet balance to approve this investment.',
                [
                    'required' =>
                        $amount,

                    'wallet_balance' =>
                        $walletBefore,

                    'shortfall' =>
                        $amount - $walletBefore,
                ],
                400
            );
        }

        $now = nowUtc();

        /*
         * Atomic deduction.
         *
         * The balance must still be >= amount at the
         * exact moment of deduction.
         */
        $walletFilter =
            invGetUserFilter(
                $investmentUser
            );

        $walletFilter['$and'] = [
            [
                $walletField => [
                    '$gte' =>
                        $amount,
                ],
            ],
        ];

        $deductResult =
            $users->updateOne(
                $walletFilter,
                [
                    '$inc' => [
                        $walletField =>
                            -$amount,
                    ],

                    '$set' => [
                        'updated_at' =>
                            $now,
                    ],
                ]
            );

        if (
            $deductResult->getModifiedCount() !== 1
        ) {

            /*
             * Re-read wallet to provide accurate information.
             */
            $freshUser =
                invFindUser(
                    $users,
                    $investmentUserId,
                    $investmentUser['email'] ?? ''
                );

            $freshBalance =
                $freshUser !== null
                    ? invWalletBalance($freshUser)
                    : 0;

            investmentResponse(
                false,
                'Investment could not be approved because the wallet balance changed or is insufficient.',
                [
                    'wallet_balance' =>
                        $freshBalance,

                    'required' =>
                        $amount,
                ],
                409
            );
        }

        $walletAfter =
            $walletBefore - $amount;

        /*
         * Calculate earnings.
         */
        $dailyRate = (float) (
            $investment['daily_rate']
            ?? $investment['dailyRate']
            ?? $investment['rate']
            ?? 0.10
        );

        if ($dailyRate > 1) {
            $dailyRate /= 100;
        }

        if ($dailyRate <= 0) {
            $dailyRate = 0.10;
        }

        $duration = (int) (
            $investment['duration']
            ?? $investment['duration_days']
            ?? 30
        );

        if ($duration <= 0) {
            $duration = 30;
        }

        $dailyEarning =
            (int) round(
                $amount * $dailyRate
            );

        /*
         * The first earning is scheduled for the next day.
         */
        $nextEarningDate =
            new MongoDB\BSON\UTCDateTime(
                (time() + 86400) * 1000
            );

        /*
         * Calculate maturity date.
         */
        $maturityDate =
            new MongoDB\BSON\UTCDateTime(
                (time() + ($duration * 86400)) * 1000
            );

        /*
         * Update investment.
         */
        $set = [

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
                invString(
                    invUserIdValue(
                        $currentAdmin
                    )
                ),

            'admin_email' =>
                (string) (
                    $currentAdmin['email']
                    ?? ''
                ),

            /*
             * Earnings engine fields.
             */
            'daily_rate' =>
                $dailyRate,

            'daily_earning' =>
                $dailyEarning,

            'duration' =>
                $duration,

            'earnings_processed' =>
                0,

            'total_earnings_paid' =>
                0,

            'earning_days' =>
                0,

            'last_earning_date' =>
                null,

            'next_earning_date' =>
                $nextEarningDate,

            'earnings_paid' =>
                false,

            'principal_returned' =>
                false,
        ];

        if ($adminNote !== '') {
            $set['admin_note'] =
                $adminNote;
        }

        /*
         * Store resolved user information.
         */
        $resolvedName =
            invUserName(
                $investmentUser
            );

        if ($resolvedName !== 'Unknown user') {

            $set['user_name'] =
                $resolvedName;

            $set['name'] =
                $resolvedName;

            $set['full_name'] =
                $resolvedName;
        }

        if (
            !empty(
                $investmentUser['email']
            )
        ) {

            $set['email'] =
                (string) (
                    $investmentUser['email']
                );
        }

        /*
         * Update only pending investment.
         */
        $investmentUpdate =
            $investments->updateOne(
                [
                    '_id' =>
                        $objectId,

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
                        $set,
                ]
            );

        /*
         * If investment update failed after wallet deduction,
         * attempt to restore the wallet immediately.
         */
        if (
            $investmentUpdate->getModifiedCount() !== 1
        ) {

            try {

                $rollbackFilter =
                    invGetUserFilter(
                        $investmentUser
                    );

                $users->updateOne(
                    $rollbackFilter,
                    [
                        '$inc' => [
                            $walletField =>
                                $amount,
                        ],

                        '$set' => [
                            'updated_at' =>
                                $now,
                        ],
                    ]
                );

            } catch (Throwable $rollbackError) {

                error_log(
                    'CRITICAL investment approval rollback failed: ' .
                    $rollbackError->getMessage() .
                    ' | investment=' .
                    $investmentId .
                    ' | amount=' .
                    $amount
                );
            }

            investmentResponse(
                false,
                'Investment approval failed. The wallet deduction was rolled back.',
                [],
                409
            );
        }

        /*
        |--------------------------------------------------------------------------
        | CREATE WALLET TRANSACTION
        |--------------------------------------------------------------------------
        */

        try {

            $transactions->insertOne([

                'user_id' =>
                    $investmentUserId,

                'userId' =>
                    $investmentUserId,

                'investment_id' =>
                    $investmentId,

                'investmentId' =>
                    $investmentId,

                'type' =>
                    'investment_approved',

                'category' =>
                    'investment',

                'direction' =>
                    'debit',

                'amount' =>
                    $amount,

                'balance_before' =>
                    $walletBefore,

                'balance_after' =>
                    $walletAfter,

                'balance_change' =>
                    -$amount,

                'status' =>
                    'completed',

                'description' =>
                    'Investment approved. Investment principal deducted from wallet.',

                'admin_id' =>
                    invString(
                        invUserIdValue(
                            $currentAdmin
                        )
                    ),

                'admin_email' =>
                    (string) (
                        $currentAdmin['email']
                        ?? ''
                    ),

                'created_at' =>
                    $now,
            ]);

        } catch (Throwable $transactionError) {

            /*
             * The financial operation already succeeded.
             * Do not roll back the investment because the
             * transaction log failed.
             */
            error_log(
                'Investment approval transaction log error: ' .
                $transactionError->getMessage()
            );
        }

        /*
        |--------------------------------------------------------------------------
        | AUDIT
        |--------------------------------------------------------------------------
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

                    'admin_id' =>
                        invString(
                            invUserIdValue(
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

        /*
        |--------------------------------------------------------------------------
        | SUCCESS
        |--------------------------------------------------------------------------
        */

        investmentResponse(
            true,
            'Investment approved successfully. Wallet has been deducted.',
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

        $now = nowUtc();

        /*
         * If the wallet was deducted, rejection must refund it.
         *
         * For the new flow:
         * balance_deducted = false
         * therefore there is normally nothing to refund.
         *
         * For legacy records:
         * balance_deducted = true
         * therefore refund exactly once.
         */
        $refundRequired =
            $balanceWasDeducted &&
            !$principalReturned;

        $walletAfter =
            $walletBefore;

        /*
         * IMPORTANT:
         *
         * If the investment was never deducted,
         * the user's wallet stays unchanged.
         */
        if ($refundRequired) {

            $userFilter =
                invGetUserFilter(
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
                    ]
                );

            if (
                $refundResult->getModifiedCount() !== 1
            ) {

                investmentResponse(
                    false,
                    'Investment could not be rejected because the wallet refund failed.',
                    [],
                    500
                );
            }

            $walletAfter =
                $walletBefore + $amount;
        }

        /*
         * Investment rejection update.
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
                invString(
                    invUserIdValue(
                        $currentAdmin
                    )
                ),

            'admin_email' =>
                (string) (
                    $currentAdmin['email']
                    ?? ''
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
            ] = $adminNote;
        }

        /*
         * Only process the currently pending investment.
         */
        $result =
            $investments->updateOne(
                [
                    '_id' =>
                        $objectId,

                    'status' =>
                        $currentStatus,
                ],
                [
                    '$set' =>
                        $updateSet,
                ]
            );

        if (
            $result->getModifiedCount() !== 1
        ) {

            /*
             * If refund happened but status update failed,
             * log critical condition.
             */
            if ($refundRequired) {

                error_log(
                    'CRITICAL: Investment refund completed but status update failed. Investment ID: ' .
                    $investmentId
                );
            }

            investmentResponse(
                false,
                'Investment could not be rejected. It may already have been processed.',
                [],
                409
            );
        }

        /*
         |--------------------------------------------------------------------------
         | REFUND TRANSACTION
         |--------------------------------------------------------------------------
         */

        if ($refundRequired) {

            try {

                $transactions->insertOne([

                    'user_id' =>
                        $investmentUserId,

                    'userId' =>
                        $investmentUserId,

                    'investment_id' =>
                        $investmentId,

                    'investmentId' =>
                        $investmentId,

                    'type' =>
                        'investment_rejected_refund',

                    'category' =>
                        'investment',

                    'direction' =>
                        'credit',

                    'amount' =>
                        $amount,

                    'balance_before' =>
                        $walletBefore,

                    'balance_after' =>
                        $walletAfter,

                    'balance_change' =>
                        $amount,

                    'status' =>
                        'completed',

                    'description' =>
                        'Investment rejected. Previously deducted principal refunded to wallet.',

                    'admin_id' =>
                        invString(
                            invUserIdValue(
                                $currentAdmin
                            )
                        ),

                    'admin_email' =>
                        (string) (
                            $currentAdmin['email']
                            ?? ''
                        ),

                    'created_at' =>
                        $now,
                ]);

            } catch (Throwable $transactionError) {

                error_log(
                    'Investment refund transaction error: ' .
                    $transactionError->getMessage()
                );
            }
        } else {

            /*
             * Record rejection even when there was no refund.
             */
            try {

                $transactions->insertOne([

                    'user_id' =>
                        $investmentUserId,

                    'userId' =>
                        $investmentUserId,

                    'investment_id' =>
                        $investmentId,

                    'investmentId' =>
                        $investmentId,

                    'type' =>
                        'investment_rejected',

                    'category' =>
                        'investment',

                    'direction' =>
                        'none',

                    'amount' =>
                        $amount,

                    'balance_before' =>
                        $walletBefore,

                    'balance_after' =>
                        $walletBefore,

                    'balance_change' =>
                        0,

                    'status' =>
                        'completed',

                    'description' =>
                        'Investment rejected. No wallet deduction had occurred.',

                    'admin_id' =>
                        invString(
                            invUserIdValue(
                                $currentAdmin
                            )
                        ),

                    'admin_email' =>
                        (string) (
                            $currentAdmin['email']
                            ?? ''
                        ),

                    'created_at' =>
                        $now,
                ]);

            } catch (Throwable $transactionError) {

                error_log(
                    'Investment rejection transaction error: ' .
                    $transactionError->getMessage()
                );
            }
        }

        /*
         |--------------------------------------------------------------------------
         | AUDIT REJECTION
         |--------------------------------------------------------------------------
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
                        invString(
                            invUserIdValue(
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

        investmentResponse(
            true,
            $refundRequired
                ? 'Investment rejected and the deducted principal was refunded.'
                : 'Investment rejected successfully. No wallet deduction had occurred.',
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

    error_log(
        'admin_investments POST error: ' .
        $e->getMessage()
    );

    investmentResponse(
        false,
        'Unable to process investment request.',
        [],
        500
    );
}

/*
|--------------------------------------------------------------------------
| FALLBACK
|--------------------------------------------------------------------------
*/

investmentResponse(
    false,
    'Unable to process investment request.',
    [],
    500
);