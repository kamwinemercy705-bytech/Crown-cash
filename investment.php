<?php
declare(strict_types=1);

/*
|--------------------------------------------------------------------------
| Crown Cash - Investment API
|--------------------------------------------------------------------------
| Creates an investment request and RESERVES the investment amount
| immediately from the user's wallet.
|
| Flow:
| 1. User submits investment.
| 2. Wallet balance is reduced immediately.
| 3. Investment is created as pending.
| 4. Admin approves or rejects.
| 5. Approval does NOT deduct again.
| 6. Rejection restores the reserved amount.
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

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonResponse([
        'success' => false,
        'message' => 'Only POST requests are allowed.'
    ], 405);
}

try {

    $userId = currentUserId();

    if (!$userId) {
        jsonResponse([
            'success' => false,
            'message' => 'Please log in to continue.'
        ], 401);
    }

    /*
    |--------------------------------------------------------------------------
    | Investment plans
    |--------------------------------------------------------------------------
    */

    $plans = [
        'starter' => [
            'name' => 'Starter',
            'amount' => 10000,
            'duration_days' => 30
        ],

        'standard' => [
            'name' => 'Standard',
            'amount' => 15000,
            'duration_days' => 30
        ],

        'advanced' => [
            'name' => 'Advanced',
            'amount' => 25000,
            'duration_days' => 30
        ]
    ];

    $rawBody = file_get_contents('php://input');
    $input = json_decode($rawBody ?: '{}', true);

    if (!is_array($input)) {
        $input = $_POST;
    }

    $planKey = strtolower(trim((string)($input['plan'] ?? '')));
    $amountInput = $input['amount'] ?? null;

    /*
    |--------------------------------------------------------------------------
    | Determine amount
    |--------------------------------------------------------------------------
    */

    if ($planKey !== '' && isset($plans[$planKey])) {

        $plan = $plans[$planKey];

        $amount = $plan['amount'];
        $planName = $plan['name'];
        $durationDays = $plan['duration_days'];

    } else {

        if ($amountInput === null || !is_numeric($amountInput)) {
            jsonResponse([
                'success' => false,
                'message' => 'Please select a valid investment plan.'
            ], 422);
        }

        $amount = (int)round((float)$amountInput);

        $planName = 'Custom Investment';
        $durationDays = 30;

        $allowedAmounts = array_column($plans, 'amount');

        if (!in_array($amount, $allowedAmounts, true)) {
            jsonResponse([
                'success' => false,
                'message' => 'Invalid investment amount.'
            ], 422);
        }
    }

    if ($amount <= 0) {
        jsonResponse([
            'success' => false,
            'message' => 'Investment amount must be greater than zero.'
        ], 422);
    }

    /*
    |--------------------------------------------------------------------------
    | Resolve user
    |--------------------------------------------------------------------------
    */

    $user = null;

    if (isValidObjectId($userId)) {
        $user = $users->findOne([
            '_id' => objectIdOrNull($userId)
        ]);
    }

    if (!$user) {
        $user = $users->findOne([
            'id' => (string)$userId
        ]);
    }

    if (!$user) {
        jsonResponse([
            'success' => false,
            'message' => 'User account could not be found.'
        ], 404);
    }

    /*
    |--------------------------------------------------------------------------
    | Current wallet balance
    |--------------------------------------------------------------------------
    */

    $walletBalance = moneyInt(
        $user->balance
        ?? $user->wallet_balance
        ?? $user->walletBalance
        ?? 0
    );

    if ($walletBalance < $amount) {
        jsonResponse([
            'success' => false,
            'message' => 'Insufficient wallet balance.',
            'available_balance' => $walletBalance,
            'required_amount' => $amount
        ], 422);
    }

    /*
    |--------------------------------------------------------------------------
    | Prevent duplicate pending investment of same amount
    |--------------------------------------------------------------------------
    */

    $pendingExisting = $investments->findOne([
        'user_id' => (string)$userId,
        'status' => 'pending'
    ]);

    if ($pendingExisting) {
        jsonResponse([
            'success' => false,
            'message' => 'You already have a pending investment awaiting admin approval.'
        ], 409);
    }

    /*
    |--------------------------------------------------------------------------
    | Dates
    |--------------------------------------------------------------------------
    */

    $now = nowUtc();

    /*
    |--------------------------------------------------------------------------
    | Mongo transaction
    |--------------------------------------------------------------------------
    */

    $session = null;

    try {

        $session = $mongoClient->startSession();

        $session->startTransaction();

        /*
        |--------------------------------------------------------------------------
        | Deduct / reserve wallet amount NOW
        |--------------------------------------------------------------------------
        */

        $newBalance = $walletBalance - $amount;

        $users->updateOne(
            [
                '_id' => $user->_id,
                '$or' => [
                    ['balance' => ['$gte' => $amount]],
                    ['wallet_balance' => ['$gte' => $amount]]
                ]
            ],
            [
                '$set' => [
                    'balance' => $newBalance,
                    'wallet_balance' => $newBalance,
                    'updated_at' => $now
                ]
            ],
            [
                'session' => $session
            ]
        );

        /*
        |--------------------------------------------------------------------------
        | Create investment
        |--------------------------------------------------------------------------
        */

        $investmentDocument = [
            'user_id' => (string)$userId,

            'plan' => $planKey !== '' ? $planKey : 'custom',

            'plan_name' => $planName,

            'amount' => $amount,

            'principal' => $amount,

            'duration_days' => $durationDays,

            'daily_rate' => 0.10,

            'status' => 'pending',

            'balance_reserved' => true,

            'reserved_amount' => $amount,

            'created_at' => $now,

            'updated_at' => $now
        ];

        $investmentResult = $investments->insertOne(
            $investmentDocument,
            [
                'session' => $session
            ]
        );

        $investmentId = (string)$investmentResult->getInsertedId();

        /*
        |--------------------------------------------------------------------------
        | Create pending transaction
        |--------------------------------------------------------------------------
        */

        $transactions->insertOne(
            [
                'user_id' => (string)$userId,

                'investment_id' => $investmentId,

                'type' => 'investment',

                'transaction_type' => 'investment',

                'category' => 'investment_principal',

                'amount' => $amount,

                'direction' => 'debit',

                'status' => 'pending',

                'balance_reserved' => true,

                'description' => 'Investment amount reserved - ' . $planName,

                'created_at' => $now,

                'updated_at' => $now
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
                'investment_created',
                (string)$userId,
                [
                    'investment_id' => $investmentId,
                    'amount' => $amount,
                    'plan' => $planName
                ]
            );
        }

        $session->commitTransaction();

    } catch (Throwable $transactionError) {

        if ($session) {
            try {
                $session->abortTransaction();
            } catch (Throwable $ignore) {
            }
        }

        throw $transactionError;

    } finally {

        if ($session) {
            $session->endSession();
        }
    }

    jsonResponse([
        'success' => true,
        'message' => 'Investment created successfully. The investment amount has been reserved from your wallet and is awaiting admin approval.',

        'investment' => [
            'id' => $investmentId,
            'plan' => $planName,
            'amount' => $amount,
            'duration_days' => $durationDays,
            'status' => 'pending'
        ],

        'wallet' => [
            'previous_balance' => $walletBalance,
            'new_balance' => $newBalance
        ]
    ], 201);

} catch (Throwable $e) {

    error_log(
        'Crown Cash investment.php error: ' .
        $e->getMessage()
    );

    jsonResponse([
        'success' => false,
        'message' => 'Unable to create investment at this time.'
    ], 500);
}