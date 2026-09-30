<?php
declare(strict_types=1);

require_once __DIR__ . '/config.php';

$adminId = requireAdmin();


/* =========================================================
   GET INVESTMENTS
========================================================= */

if ($_SERVER['REQUEST_METHOD'] === 'GET') {

    try {

        $items = [];

        $cursor = $investments->find(
            [],
            [
                'sort' => [
                    'created_at' => -1
                ],
                'limit' => 500
            ]
        );


        $stats = [
            'total_investments' => 0,
            'total_amount' => 0,
            'active' => 0,
            'pending' => 0,
            'completed' => 0,
            'rejected' => 0
        ];


        foreach ($cursor as $investment) {

            $stats['total_investments']++;

            $amount = moneyInt(
                $investment['amount'] ?? 0
            );

            $stats['total_amount'] += $amount;


            $status = strtolower(
                (string)(
                    $investment['status']
                    ?? 'pending'
                )
            );


            if (isset($stats[$status])) {
                $stats[$status]++;
            }


            /* -------------------------------------------------
               FIND INVESTMENT OWNER
            ------------------------------------------------- */

            $userIdValue =
                $investment['user_id']
                ?? null;

            $user = null;

            if (
                $userIdValue
                instanceof MongoDB\BSON\ObjectId
            ) {

                $user = $users->findOne([
                    '_id' => $userIdValue
                ]);

            } elseif (
                is_string($userIdValue)
                && isValidObjectId($userIdValue)
            ) {

                $user = $users->findOne([
                    '_id' =>
                        new MongoDB\BSON\ObjectId(
                            $userIdValue
                        )
                ]);
            }


            /* -------------------------------------------------
               USER NAME
            ------------------------------------------------- */

            $userName = '';

            if ($user) {

                $firstName = (string)(
                    $user['firstName']
                    ?? $user['first_name']
                    ?? ''
                );

                $lastName = (string)(
                    $user['lastName']
                    ?? $user['last_name']
                    ?? ''
                );

                $userName = trim(
                    $firstName .
                    ' ' .
                    $lastName
                );

                if ($userName === '') {

                    $userName = (string)(
                        $user['full_name']
                        ?? $user['name']
                        ?? ''
                    );
                }
            }


            /* -------------------------------------------------
               RETURN INVESTMENT DATA
            ------------------------------------------------- */

            $items[] = jsonSafe([

                'id' =>
                    $investment['_id'],

                'user_id' =>
                    $userIdValue,

                'user_name' =>
                    $userName,

                'email' =>
                    $user['email']
                    ?? $investment['email']
                    ?? '',

                'phone' =>
                    $user['phone']
                    ?? $investment['phone']
                    ?? '',

                'plan' =>
                    $investment['plan']
                    ?? '',

                'plan_key' =>
                    $investment['plan_key']
                    ?? '',

                'amount' =>
                    $amount,

                'currency' =>
                    $investment['currency']
                    ?? 'UGX',

                'status' =>
                    $status,

                'type' =>
                    $investment['type']
                    ?? 'investment',

                'duration_days' =>
                    (int)(
                        $investment['duration_days']
                        ?? 30
                    ),

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

                'updated_at' =>
                    $investment['updated_at']
                    ?? null,

                'rejection_reason' =>
                    $investment['rejection_reason']
                    ?? ''

            ]);
        }


        /* =====================================================
           RESPONSE
        ===================================================== */

        jsonResponse([

            'success' => true,

            'stats' => $stats,

            'investments' => $items

        ]);

    } catch (Throwable $e) {

        error_log(
            'Admin investments GET error: ' .
            $e->getMessage()
        );

        jsonResponse([

            'success' => false,

            'message' =>
                'Unable to load investments.'

        ], 500);
    }
}


/* =========================================================
   ONLY POST IS ALLOWED BELOW
========================================================= */

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {

    jsonResponse([

        'success' => false,

        'message' =>
            'Method not allowed.'

    ], 405);
}


/* =========================================================
   READ POST DATA
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
   GET REQUEST PARAMETERS
========================================================= */

$investmentId = trim(
    (string)(
        $input['investmentId']
        ?? $input['investment_id']
        ?? $input['id']
        ?? ''
    )
);

$action = strtolower(
    trim(
        (string)(
            $input['action']
            ?? ''
        )
    )
);

$reason = trim(
    (string)(
        $input['reason']
        ?? $input['rejection_reason']
        ?? ''
    )
);


/* =========================================================
   VALIDATE REQUEST
========================================================= */

if (
    !isValidObjectId($investmentId)
    ||
    !in_array(
        $action,
        ['approve', 'reject'],
        true
    )
) {

    jsonResponse([

        'success' => false,

        'message' =>
            'Invalid investment ID or action.'

    ], 400);
}


$investmentObjectId =
    new MongoDB\BSON\ObjectId(
        $investmentId
    );


/* =========================================================
   PROCESS APPROVAL / REJECTION
========================================================= */

try {

    $session = $client->startSession();

    $session->startTransaction();


    /* -----------------------------------------------------
       FIND INVESTMENT
    ----------------------------------------------------- */

    $investment =
        $investments->findOne(
            [
                '_id' =>
                    $investmentObjectId
            ],
            [
                'session' =>
                    $session
            ]
        );


    if (!$investment) {

        throw new RuntimeException(
            'Investment not found.'
        );
    }


    /* -----------------------------------------------------
       ONLY PENDING INVESTMENTS CAN BE PROCESSED
    ----------------------------------------------------- */

    $currentStatus = strtolower(
        (string)(
            $investment['status']
            ?? 'pending'
        )
    );


    if ($currentStatus !== 'pending') {

        throw new RuntimeException(
            'Only pending investments can be processed.'
        );
    }


    /* -----------------------------------------------------
       GET USER
    ----------------------------------------------------- */

    $userId =
        objectIdOrNull(
            $investment['user_id']
            ?? null
        );


    if (!$userId) {

        throw new RuntimeException(
            'Investment has no valid user.'
        );
    }


    $amount = moneyInt(
        $investment['amount']
        ?? 0
    );


    if ($amount <= 0) {

        throw new RuntimeException(
            'Invalid investment amount.'
        );
    }


    $now = nowUtc();


    /* =====================================================
       REJECT INVESTMENT
    ===================================================== */

    if ($action === 'reject') {

        $rejectionReason =
            $reason !== ''
                ? $reason
                : 'Investment rejected by administrator.';


        $result =
            $investments->updateOne(
                [
                    '_id' =>
                        $investmentObjectId,

                    'status' =>
                        'pending'
                ],
                [
                    '$set' => [

                        'status' =>
                            'rejected',

                        'approved' =>
                            false,

                        'rejected_by' =>
                            $adminId,

                        'rejection_reason' =>
                            $rejectionReason,

                        'updated_at' =>
                            $now

                    ]
                ],
                [
                    'session' =>
                        $session
                ]
            );


        if ($result->getModifiedCount() !== 1) {

            throw new RuntimeException(
                'Investment could not be rejected.'
            );
        }


        /* -------------------------------------------------
           UPDATE RELATED TRANSACTION
        ------------------------------------------------- */

        $transactions->updateMany(
            [
                'investment_id' =>
                    $investmentObjectId,

                'status' =>
                    'pending'
            ],
            [
                '$set' => [

                    'status' =>
                        'rejected',

                    'rejected_by' =>
                        $adminId,

                    'rejection_reason' =>
                        $rejectionReason,

                    'updated_at' =>
                        $now

                ]
            ],
            [
                'session' =>
                    $session
            ]
        );


        $session->commitTransaction();


        audit(
            'investment_rejected',
            $adminId,
            [
                'investment_id' =>
                    $investmentId,

                'reason' =>
                    $rejectionReason
            ]
        );


        jsonResponse([

            'success' =>
                true,

            'message' =>
                'Investment rejected.'

        ]);
    }


    /* =====================================================
       APPROVE INVESTMENT
    ===================================================== */

    $user =
        $users->findOne(
            [
                '_id' =>
                    $userId
            ],
            [
                'session' =>
                    $session
            ]
        );


    if (!$user) {

        throw new RuntimeException(
            'Investment owner not found.'
        );
    }


    /* -----------------------------------------------------
       GET CURRENT BALANCE
    ----------------------------------------------------- */

    $balance = moneyInt(
        $user['balance']
        ?? $user['wallet_balance']
        ?? 0
    );


    /* -----------------------------------------------------
       CHECK AVAILABLE BALANCE
    ----------------------------------------------------- */

    if ($balance < $amount) {

        throw new RuntimeException(
            'User does not have enough available balance to activate this investment.'
        );
    }


    $newBalance =
        $balance - $amount;


    /* -----------------------------------------------------
       DEDUCT INVESTMENT PRINCIPAL
    ----------------------------------------------------- */

    $balanceUpdate =
        $users->updateOne(
            [
                '_id' =>
                    $userId,

                'balance' =>
                    [
                        '$gte' =>
                            $amount
                    ]
            ],
            [
                '$inc' => [

                    'balance' =>
                        -$amount

                ],

                '$set' => [

                    'updated_at' =>
                        $now

                ]
            ],
            [
                'session' =>
                    $session
            ]
        );


    if (
        $balanceUpdate->getMatchedCount() !== 1
        ||
        $balanceUpdate->getModifiedCount() !== 1
    ) {

        throw new RuntimeException(
            'Unable to deduct the investment amount from the wallet.'
        );
    }


    /* -----------------------------------------------------
       GET DURATION
    ----------------------------------------------------- */

    $duration =
        (int)(
            $investment['duration_days']
            ?? 30
        );


    if ($duration <= 0) {
        $duration = 30;
    }


    /* -----------------------------------------------------
       ACTIVATE INVESTMENT
    ----------------------------------------------------- */

    $investmentUpdate =
        $investments->updateOne(
            [
                '_id' =>
                    $investmentObjectId,

                'status' =>
                    'pending'
            ],
            [
                '$set' => [

                    'status' =>
                        'active',

                    'approved' =>
                        true,

                    'approved_by' =>
                        $adminId,

                    'approved_at' =>
                        $now,

                    'activated_at' =>
                        $now,

                    'duration_days' =>
                        $duration,

                    'updated_at' =>
                        $now

                ]
            ],
            [
                'session' =>
                    $session
            ]
        );


    if (
        $investmentUpdate->getModifiedCount() !== 1
    ) {

        throw new RuntimeException(
            'Investment could not be activated.'
        );
    }


    /* =====================================================
       UPDATE ORIGINAL PENDING TRANSACTION
    ===================================================== */

    $transactions->updateMany(
        [
            'investment_id' =>
                $investmentObjectId,

            'status' =>
                'pending'
        ],
        [
            '$set' => [

                'status' =>
                    'approved',

                'payment_status' =>
                    'approved',

                'principal_deducted' =>
                    true,

                'approved_by' =>
                    $adminId,

                'approved_at' =>
                    $now,

                'updated_at' =>
                    $now

            ]
        ],
        [
            'session' =>
                $session
        ]
    );


    /* =====================================================
       CREATE PRINCIPAL DEBIT TRANSACTION
    ===================================================== */

    $transactions->insertOne(

        [

            'user_id' =>
                $userId,

            'type' =>
                'investment_principal_debit',

            'transaction_type' =>
                'investment_principal_debit',

            'title' =>
                'Investment activated',

            'description' =>
                'Investment principal deducted from wallet.',

            'amount' =>
                $amount,

            'currency' =>
                'UGX',

            'status' =>
                'approved',

            'reference' =>
                'INV-DEBIT-' .
                strtoupper(
                    bin2hex(
                        random_bytes(5)
                    )
                ),

            'investment_id' =>
                $investmentObjectId,

            'created_at' =>
                $now,

            'updated_at' =>
                $now

        ],

        [
            'session' =>
                $session
        ]
    );


    /* =====================================================
       COMPLETE TRANSACTION
    ===================================================== */

    $session->commitTransaction();


    /* =====================================================
       AUDIT
    ===================================================== */

    audit(
        'investment_approved',
        $adminId,
        [

            'investment_id' =>
                $investmentId,

            'amount' =>
                $amount,

            'user_id' =>
                (string)$userId

        ]
    );


    /* =====================================================
       RESPONSE
    ===================================================== */

    jsonResponse([

        'success' =>
            true,

        'message' =>
            'Investment approved and activated.',

        'investment_id' =>
            $investmentId,

        'amount' =>
            $amount,

        'new_balance' =>
            $newBalance

    ]);


} catch (Throwable $e) {

    if (isset($session)) {

        try {

            $session->abortTransaction();

        } catch (Throwable $ignored) {
            // Transaction may already have ended.
        }
    }


    error_log(
        'Admin investment processing error: ' .
        $e->getMessage()
    );


    jsonResponse([

        'success' =>
            false,

        'message' =>
            $e->getMessage()

    ], 400);
}