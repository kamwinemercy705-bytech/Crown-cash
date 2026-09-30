<?php
declare(strict_types=1);

require_once __DIR__ . '/config.php';

$userId = requireLogin();


/* =========================================================
   INVESTMENT PLANS
========================================================= */

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


/* =========================================================
   GET INVESTMENT PLANS AND USER INVESTMENTS
========================================================= */

if ($_SERVER['REQUEST_METHOD'] === 'GET') {

    try {

        $items = [];

        $cursor = $investments->find(
            [
                '$or' => [
                    ['user_id' => $userId],
                    ['user_id' => (string)$userId]
                ]
            ],
            [
                'sort' => [
                    'created_at' => -1
                ],
                'limit' => 100
            ]
        );


        foreach ($cursor as $investment) {

            $items[] = jsonSafe([

                'id' =>
                    $investment['_id'],

                'plan' =>
                    $investment['plan']
                    ?? '',

                'plan_key' =>
                    $investment['plan_key']
                    ?? '',

                'amount' =>
                    moneyInt(
                        $investment['amount']
                        ?? 0
                    ),

                'currency' =>
                    $investment['currency']
                    ?? 'UGX',

                'duration_days' =>
                    (int)(
                        $investment['duration_days']
                        ?? 30
                    ),

                'status' =>
                    $investment['status']
                    ?? 'pending',

                'reference' =>
                    $investment['reference']
                    ?? '',

                'created_at' =>
                    $investment['created_at']
                    ?? null,

                'approved_at' =>
                    $investment['approved_at']
                    ?? null,

                'activated_at' =>
                    $investment['activated_at']
                    ?? null,

                'completed_at' =>
                    $investment['completed_at']
                    ?? null,

                'rejection_reason' =>
                    $investment['rejection_reason']
                    ?? ''

            ]);
        }


        jsonResponse([

            'success' => true,

            'plans' => $plans,

            'investments' => $items

        ]);

    } catch (Throwable $e) {

        jsonResponse([

            'success' => false,

            'message' =>
                'Unable to load investments.'

        ], 500);
    }
}


/* =========================================================
   ONLY POST IS ALLOWED AFTER THIS POINT
========================================================= */

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {

    jsonResponse([

        'success' => false,

        'message' =>
            'Method not allowed.'

    ], 405);
}


/* =========================================================
   READ REQUEST
========================================================= */

$rawInput = file_get_contents(
    'php://input'
);

$input = json_decode(
    $rawInput,
    true
);

if (!is_array($input)) {
    $input = $_POST;
}


/* =========================================================
   GET SELECTED PLAN
========================================================= */

$planKey = strtolower(
    trim(
        (string)(
            $input['plan']
            ?? $input['plan_key']
            ?? ''
        )
    )
);


if (!isset($plans[$planKey])) {

    jsonResponse([

        'success' => false,

        'message' =>
            'Invalid investment plan.'

    ], 400);
}


$plan = $plans[$planKey];


/* =========================================================
   CREATE INVESTMENT REQUEST
========================================================= */

try {

    /* -----------------------------------------------------
       CHECK USER
    ----------------------------------------------------- */

    $user = $users->findOne([
        '_id' => $userId
    ]);

    if (!$user) {

        jsonResponse([

            'success' => false,

            'message' =>
                'User not found.'

        ], 404);
    }


    /* -----------------------------------------------------
       CHECK FOR EXISTING PENDING INVESTMENT
    ----------------------------------------------------- */

    $pendingInvestment =
        $investments->findOne([

            '$or' => [
                ['user_id' => $userId],
                ['user_id' => (string)$userId]
            ],

            'status' => 'pending'

        ]);


    if ($pendingInvestment) {

        jsonResponse([

            'success' => false,

            'message' =>
                'You already have a pending investment awaiting admin approval.'

        ], 409);
    }


    /* -----------------------------------------------------
       CHECK FOR DUPLICATE ACTIVE INVESTMENT
       WITH SAME PLAN AND AMOUNT
    ----------------------------------------------------- */

    /*
     * We allow multiple investments in general, but prevent
     * accidental duplicate submissions occurring at almost
     * the same time.
     */

    $recentInvestment =
        $investments->findOne([

            '$or' => [
                ['user_id' => $userId],
                ['user_id' => (string)$userId]
            ],

            'plan_key' => $planKey,

            'amount' => $plan['amount'],

            'status' => [
                '$in' => [
                    'pending',
                    'active',
                    'approved',
                    'running'
                ]
            ],

            'created_at' => [
                '$gte' => new MongoDB\BSON\UTCDateTime(
                    (time() - 60) * 1000
                )
            ]

        ]);


    if ($recentInvestment) {

        jsonResponse([

            'success' => false,

            'message' =>
                'A similar investment request was recently submitted. Please wait before trying again.'

        ], 409);
    }


    /* -----------------------------------------------------
       GENERATE REFERENCE
    ----------------------------------------------------- */

    $reference =
        'INV-' .
        strtoupper(
            bin2hex(
                random_bytes(7)
            )
        );


    $now = nowUtc();


    /* -----------------------------------------------------
       CREATE INVESTMENT
    ----------------------------------------------------- */

    $investmentResult =
        $investments->insertOne([

            'user_id' =>
                $userId,

            'plan' =>
                $plan['name'],

            'plan_key' =>
                $planKey,

            'amount' =>
                $plan['amount'],

            'currency' =>
                'UGX',

            'duration_days' =>
                $plan['duration_days'],

            /*
             * The investment remains pending until an
             * administrator approves it.
             */
            'status' =>
                'pending',

            'approved' =>
                false,

            'reference' =>
                $reference,

            'created_at' =>
                $now,

            'updated_at' =>
                $now

        ]);


    $investmentId =
        $investmentResult->getInsertedId();


    /* -----------------------------------------------------
       CREATE PENDING TRANSACTION
    ----------------------------------------------------- */

    $transactions->insertOne([

        'user_id' =>
            $userId,

        'investment_id' =>
            $investmentId,

        'type' =>
            'investment',

        'transaction_type' =>
            'investment',

        'title' =>
            'Investment request',

        'description' =>
            $plan['name'] .
            ' investment awaiting admin approval.',

        'amount' =>
            $plan['amount'],

        'currency' =>
            'UGX',

        'status' =>
            'pending',

        'reference' =>
            $reference,

        'transaction_reference' =>
            $reference,

        'created_at' =>
            $now,

        'updated_at' =>
            $now

    ]);


    /* =====================================================
       AUDIT LOG
    ===================================================== */

    try {

        $auditLogs->insertOne([

            'action' =>
                'investment_created',

            'user_id' =>
                $userId,

            'investment_id' =>
                $investmentId,

            'amount' =>
                $plan['amount'],

            'plan' =>
                $plan['name'],

            'created_at' =>
                $now

        ]);

    } catch (Throwable $ignored) {

        /*
         * Audit logging should not prevent a valid
         * investment request from being created.
         */
    }


    /* =====================================================
       RESPONSE
    ===================================================== */

    jsonResponse([

        'success' =>
            true,

        'message' =>
            'Investment request submitted and is awaiting admin approval.',

        'investment' => [

            'id' =>
                (string)$investmentId,

            'plan' =>
                $plan['name'],

            'plan_key' =>
                $planKey,

            'amount' =>
                $plan['amount'],

            'currency' =>
                'UGX',

            'duration_days' =>
                $plan['duration_days'],

            'status' =>
                'pending',

            'reference' =>
                $reference

        ]

    ], 201);


} catch (Throwable $e) {

    error_log(
        'Investment creation error: ' .
        $e->getMessage()
    );

    jsonResponse([

        'success' => false,

        'message' =>
            'Unable to create investment.'

    ], 500);
}