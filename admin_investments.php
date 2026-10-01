<?php
declare(strict_types=1);

/*
|--------------------------------------------------------------------------
| Crown Cash - Admin Investment Management
|--------------------------------------------------------------------------
*/

require_once __DIR__ . '/config.php';

header('Content-Type: application/json; charset=utf-8');

$origin = $_SERVER['HTTP_ORIGIN'] ?? '';

if ($origin === 'https://crown-cash.vercel.app') {
    header('Access-Control-Allow-Origin: https://crown-cash.vercel.app');
    header('Access-Control-Allow-Credentials: true');
}

header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

startSecureSession();

try {

    /*
    |--------------------------------------------------------------------------
    | Admin authentication
    |--------------------------------------------------------------------------
    */

    $adminId = currentUserId();

    if (!$adminId) {
        jsonResponse([
            'success' => false,
            'message' => 'Authentication required.'
        ], 401);
    }

    $adminUser = null;

    if (isValidObjectId($adminId)) {
        $adminUser = $users->findOne([
            '_id' => objectIdOrNull($adminId)
        ]);
    }

    if (!$adminUser) {
        $adminUser = $users->findOne([
            'id' => (string)$adminId
        ]);
    }

    if (!$adminUser) {
        jsonResponse([
            'success' => false,
            'message' => 'Administrator account not found.'
        ], 403);
    }

    $role = strtolower(trim((string)($adminUser->role ?? '')));
    $accountType = strtolower(trim((string)($adminUser->account_type ?? '')));

    $isAdmin =
        in_array($role, ['admin', 'administrator'], true) ||
        in_array($accountType, ['admin', 'administrator'], true);

    if (!$isAdmin) {
        jsonResponse([
            'success' => false,
            'message' => 'Administrator access required.'
        ], 403);
    }

    /*
    |--------------------------------------------------------------------------
    | GET - List investment requests
    |--------------------------------------------------------------------------
    */

    if ($_SERVER['REQUEST_METHOD'] === 'GET') {

        $cursor = $investments->find(
            [
                'status' => [
                    '$in' => [
                        'pending',
                        'active',
                        'approved',
                        'rejected',
                        'completed'
                    ]
                ]
            ],
            [
                'sort' => [
                    'created_at' => -1
                ],
                'limit' => 200
            ]
        );

        $items = [];

        foreach ($cursor as $investment) {

            $item = jsonSafe($investment);

            $item['id'] = isset($investment->_id)
                ? (string)$investment->_id
                : (string)($investment->id ?? '');

            $item['user_id'] = (string)($investment->user_id ?? '');

            $item['amount'] = moneyInt(
                $investment->amount
                ?? $investment->principal
                ?? 0
            );

            $item['principal'] = moneyInt(
                $investment->principal
                ?? $investment->amount
                ?? 0
            );

            $item['status'] = strtolower(
                trim((string)($investment->status ?? 'pending'))
            );

            $items[] = $item;
        }

        $pendingCount = $investments->countDocuments([
            'status' => 'pending'
        ]);

        $activeCount = $investments->countDocuments([
            '$or' => [
                ['status' => 'active'],
                ['status' => 'approved'],
                ['status' => 'running']
            ]
        ]);

        $completedCount = $investments->countDocuments([
            'status' => 'completed'
        ]);

        jsonResponse([
            'success' => true,
            'investments' => $items,
            'data' => $items,
            'stats' => [
                'pending' => $pendingCount,
                'active' => $activeCount,
                'completed' => $completedCount
            ]
        ]);
    }

    /*
    |--------------------------------------------------------------------------
    | POST - Approve / Reject
    |--------------------------------------------------------------------------
    */

    $rawBody = file_get_contents('php://input');

    $input = json_decode(
        $rawBody ?: '{}',
        true
    );

    if (!is_array($input)) {
        $input = $_POST;
    }

    $action = strtolower(
        trim((string)($input['action'] ?? ''))
    );

    $investmentId = trim(
        (string)(
            $input['investmentId']
            ?? $input['investment_id']
            ?? $input['id']
            ?? ''
        )
    );

    $reason = trim(
        (string)($input['reason'] ?? '')
    );

    if (!in_array($action, ['approve', 'reject'], true)) {
        jsonResponse([
            'success' => false,
            'message' => 'Invalid investment action.'
        ], 422);
    }

    if (!isValidObjectId($investmentId)) {
        jsonResponse([
            'success' => false,
            'message' => 'Invalid investment ID.'
        ], 422);
    }

    $investmentObjectId = objectIdOrNull($investmentId);

    $investment = $investments->findOne([
        '_id' => $investmentObjectId
    ]);

    if (!$investment) {
        jsonResponse([
            'success' => false,
            'message' => 'Investment not found.'
        ], 404);
    }

    $status = strtolower(
        trim((string)($investment->status ?? ''))
    );

    if ($status !== 'pending') {
        jsonResponse([
            'success' => false,
            'message' => 'Only pending investments can be processed.'
        ], 409);
    }

    $userId = (string)($investment->user_id ?? '');

    $amount = moneyInt(
        $investment->amount
        ?? $investment->principal
        ?? $investment->reserved_amount
        ?? 0
    );

    if ($amount <= 0) {
        jsonResponse([
            'success' => false,
            'message' => 'Invalid investment amount.'
        ], 422);
    }

    $session = null;

    try {

        $session = $mongoClient->startSession();

        $session->startTransaction();

        $now = nowUtc();

        /*
        |--------------------------------------------------------------------------
        | APPROVE
        |--------------------------------------------------------------------------
        |
        | The money was already deducted/reserved when the user created
        | the investment.
        |
        | Therefore DO NOT deduct the wallet again.
        |--------------------------------------------------------------------------
        */

        if ($action === 'approve') {

            $startDate = $now;

            $endDate = (clone $now);

            $durationDays = (int)(
                $investment->duration_days
                ?? 30
            );

            $endDate->modify(
                '+' . $durationDays . ' days'
            );

            $investments->updateOne(
                [
                    '_id' => $investmentObjectId,
                    'status' => 'pending'
                ],
                [
                    '$set' => [
                        'status' => 'active',
                        'approved_at' => $now,
                        'activation_date' => $startDate,
                        'start_date' => $startDate,
                        'end_date' => $endDate,
                        'updated_at' => $now,
                        'balance_reserved' => true,
                        'reserved_amount' => $amount
                    ]
                ],
                [
                    'session' => $session
                ]
            );

            /*
            |--------------------------------------------------------------------------
            | Update pending transaction
            |--------------------------------------------------------------------------
            */

            $transactions->updateMany(
                [
                    'investment_id' => $investmentId,
                    'status' => 'pending'
                ],
                [
                    '$set' => [
                        'status' => 'approved',
                        'approved_at' => $now,
                        'updated_at' => $now,
                        'description' => 'Investment approved - ' .
                            (string)($investment->plan_name ?? 'Investment')
                    ]
                ],
                [
                    'session' => $session
                ]
            );

            /*
            |--------------------------------------------------------------------------
            | Audit
            |--------------------------------------------------------------------------
            */

            if (function_exists('audit')) {
                audit(
                    'investment_approved',
                    (string)$adminId,
                    [
                        'investment_id' => $investmentId,
                        'user_id' => $userId,
                        'amount' => $amount
                    ]
                );
            }

            $session->commitTransaction();

            jsonResponse([
                'success' => true,
                'message' => 'Investment approved successfully.',
                'investment_id' => $investmentId,
                'amount' => $amount,
                'balance_action' => 'already_reserved'
            ]);
        }

        /*
        |--------------------------------------------------------------------------
        | REJECT
        |--------------------------------------------------------------------------
        |
        | Because the money was reserved when the investment was created,
        | rejection MUST return it to the wallet.
        |--------------------------------------------------------------------------
        */

        if ($action === 'reject') {

            $user = null;

            if (isValidObjectId($userId)) {
                $user = $users->findOne([
                    '_id' => objectIdOrNull($userId)
                ]);
            }

            if (!$user) {
                $user = $users->findOne([
                    'id' => $userId
                ]);
            }

            if (!$user) {
                throw new RuntimeException(
                    'Investment owner could not be found.'
                );
            }

            $currentBalance = moneyInt(
                $user->balance
                ?? $user->wallet_balance
                ?? 0
            );

            $restoredBalance = $currentBalance + $amount;

            $users->updateOne(
                [
                    '_id' => $user->_id
                ],
                [
                    '$set' => [
                        'balance' => $restoredBalance,
                        'wallet_balance' => $restoredBalance,
                        'updated_at' => $now
                    ]
                ],
                [
                    'session' => $session
                ]
            );

            $investments->updateOne(
                [
                    '_id' => $investmentObjectId,
                    'status' => 'pending'
                ],
                [
                    '$set' => [
                        'status' => 'rejected',
                        'rejected_at' => $now,
                        'rejection_reason' => $reason !== ''
                            ? $reason
                            : 'Investment rejected by administrator.',
                        'updated_at' => $now,
                        'balance_reserved' => false,
                        'reserved_amount' => 0
                    ]
                ],
                [
                    'session' => $session
                ]
            );

            /*
            |--------------------------------------------------------------------------
            | Mark original transaction rejected
            |--------------------------------------------------------------------------
            */

            $transactions->updateMany(
                [
                    'investment_id' => $investmentId,
                    'status' => 'pending'
                ],
                [
                    '$set' => [
                        'status' => 'rejected',
                        'rejected_at' => $now,
                        'rejection_reason' => $reason !== ''
                            ? $reason
                            : 'Investment rejected by administrator.',
                        'updated_at' => $now
                    ]
                ],
                [
                    'session' => $session
                ]
            );

            /*
            |--------------------------------------------------------------------------
            | Record refund
            |--------------------------------------------------------------------------
            */

            $transactions->insertOne(
                [
                    'user_id' => $userId,
                    'investment_id' => $investmentId,
                    'type' => 'investment_refund',
                    'transaction_type' => 'investment_refund',
                    'category' => 'investment',
                    'amount' => $amount,
                    'direction' => 'credit',
                    'status' => 'completed',
                    'description' => 'Investment amount refunded after rejection.',
                    'created_at' => $now,
                    'updated_at' => $now
                ],
                [
                    'session' => $session
                ]
            );

            if (function_exists('audit')) {
                audit(
                    'investment_rejected',
                    (string)$adminId,
                    [
                        'investment_id' => $investmentId,
                        'user_id' => $userId,
                        'amount' => $amount,
                        'reason' => $reason
                    ]
                );
            }

            $session->commitTransaction();

            jsonResponse([
                'success' => true,
                'message' => 'Investment rejected and the reserved amount has been returned to the user.',
                'investment_id' => $investmentId,
                'amount_refunded' => $amount,
                'new_balance' => $restoredBalance
            ]);
        }

    } catch (Throwable $e) {

        if ($session) {
            try {
                $session->abortTransaction();
            } catch (Throwable $ignore) {
            }
        }

        error_log(
            'Crown Cash admin_investments.php error: ' .
            $e->getMessage()
        );

        jsonResponse([
            'success' => false,
            'message' => 'Investment processing failed.'
        ], 500);

    } finally {

        if ($session) {
            $session->endSession();
        }
    }

} catch (Throwable $e) {

    error_log(
        'Crown Cash admin_investments.php fatal error: ' .
        $e->getMessage()
    );

    jsonResponse([
        'success' => false,
        'message' => 'Unable to process investment request.'
    ], 500);
}