<?php
declare(strict_types=1);

require_once __DIR__ . '/config.php';

$adminId = requireAdmin();


/* =========================================================
   GET WITHDRAWALS
========================================================= */

if ($_SERVER['REQUEST_METHOD'] === 'GET') {

    try {

        $items = [];


        $cursor = $transactions->find(
            [
                'type' =>
                    'withdrawal'
            ],
            [
                'sort' => [
                    'created_at' => -1
                ],
                'limit' => 500
            ]
        );


        foreach ($cursor as $transaction) {

            /* -------------------------------------------------
               FIND USER
            ------------------------------------------------- */

            $userId =
                objectIdOrNull(
                    $transaction['user_id']
                    ?? null
                );


            $user =
                $userId
                    ? $users->findOne([
                        '_id' =>
                            $userId
                    ])
                    : null;


            $userName = '';

            if ($user) {

                $firstName =
                    (string)(
                        $user['firstName']
                        ?? $user['first_name']
                        ?? ''
                    );

                $lastName =
                    (string)(
                        $user['lastName']
                        ?? $user['last_name']
                        ?? ''
                    );

                $userName =
                    trim(
                        $firstName
                        . ' '
                        . $lastName
                    );


                if ($userName === '') {

                    $userName =
                        (string)(
                            $user['full_name']
                            ?? $user['name']
                            ?? ''
                        );
                }
            }


            /* -------------------------------------------------
               RETURN WITHDRAWAL
            ------------------------------------------------- */

            $items[] = jsonSafe([

                'id' =>
                    $transaction['_id'],

                'withdrawal_id' =>
                    $transaction['withdrawal_id']
                    ?? null,

                'user_id' =>
                    $transaction['user_id']
                    ?? null,

                'user_name' =>
                    $userName,

                'email' =>
                    $user['email']
                    ?? '',

                'phone' =>
                    $transaction['phone']
                    ?? $transaction['account']
                    ?? (
                        $user['phone']
                        ?? ''
                    ),

                'amount' =>
                    moneyInt(
                        $transaction['amount']
                        ?? 0
                    ),

                'fee' =>
                    moneyInt(
                        $transaction['fee']
                        ?? 0
                    ),

                'net_amount' =>
                    moneyInt(
                        $transaction['net_amount']
                        ?? 0
                    ),

                'currency' =>
                    $transaction['currency']
                    ?? 'UGX',

                'status' =>
                    $transaction['status']
                    ?? 'pending',

                'reference' =>
                    $transaction['reference']
                    ?? $transaction['transaction_reference']
                    ?? '',

                'balance_reserved' =>
                    (bool)(
                        $transaction['balance_reserved']
                        ?? false
                    ),

                'balance_deducted' =>
                    (bool)(
                        $transaction['balance_deducted']
                        ?? false
                    ),

                'balance_restored' =>
                    (bool)(
                        $transaction['balance_restored']
                        ?? false
                    ),

                'admin_approved' =>
                    (bool)(
                        $transaction['admin_approved']
                        ?? false
                    ),

                'payout_sent' =>
                    (bool)(
                        $transaction['payout_sent']
                        ?? false
                    ),

                'created_at' =>
                    $transaction['created_at']
                    ?? null,

                'updated_at' =>
                    $transaction['updated_at']
                    ?? null

            ]);
        }


        jsonResponse([

            'success' =>
                true,

            'withdrawals' =>
                $items

        ]);

    } catch (Throwable $e) {

        error_log(
            'Admin withdrawal GET error: '
            . $e->getMessage()
        );


        jsonResponse([
            'success' => false,
            'message' =>
                'Unable to load withdrawals.'
        ], 500);
    }
}


/* =========================================================
   ONLY POST BELOW
========================================================= */

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {

    jsonResponse([
        'success' => false,
        'message' => 'Method not allowed.'
    ], 405);
}


/* =========================================================
   READ REQUEST
========================================================= */

$rawInput =
    file_get_contents(
        'php://input'
    );

$input =
    json_decode(
        $rawInput,
        true
    );

if (!is_array($input)) {
    $input = $_POST;
}


/* =========================================================
   REQUEST VALUES
========================================================= */

$id = trim(
    (string)(
        $input['withdrawalId']
        ?? $input['withdrawal_id']
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
   VALIDATE
========================================================= */

if (
    !isValidObjectId($id)
    ||
    !in_array(
        $action,
        [
            'approve',
            'reject'
        ],
        true
    )
) {

    jsonResponse([
        'success' => false,
        'message' =>
            'Invalid withdrawal ID or action.'
    ], 400);
}


$transactionId =
    new MongoDB\BSON\ObjectId(
        $id
    );


/* =========================================================
   PROCESS
========================================================= */

try {

    $session =
        $client->startSession();

    $session->startTransaction();


    /* -----------------------------------------------------
       FIND TRANSACTION
    ----------------------------------------------------- */

    $transaction =
        $transactions->findOne(
            [
                '_id' =>
                    $transactionId
            ],
            [
                'session' =>
                    $session
            ]
        );


    if (
        !$transaction
        ||
        ($transaction['type'] ?? '')
            !== 'withdrawal'
    ) {

        throw new RuntimeException(
            'Withdrawal transaction not found.'
        );
    }


    /* -----------------------------------------------------
       ONLY PENDING WITHDRAWALS
    ----------------------------------------------------- */

    if (
        strtolower(
            (string)(
                $transaction['status']
                ?? ''
            )
        )
        !== 'pending'
    ) {

        throw new RuntimeException(
            'Only pending withdrawals can be processed.'
        );
    }


    /* -----------------------------------------------------
       FUNDS MUST BE RESERVED
    ----------------------------------------------------- */

    if (
        ($transaction['balance_reserved']
        ?? false)
        !== true
    ) {

        throw new RuntimeException(
            'Withdrawal funds are not reserved.'
        );
    }


    /* -----------------------------------------------------
       USER
    ----------------------------------------------------- */

    $userId =
        objectIdOrNull(
            $transaction['user_id']
            ?? null
        );


    if (!$userId) {

        throw new RuntimeException(
            'Withdrawal owner is invalid.'
        );
    }


    /* -----------------------------------------------------
       WITHDRAWAL RECORD
    ----------------------------------------------------- */

    $withdrawalId =
        objectIdOrNull(
            $transaction['withdrawal_id']
            ?? null
        );


    $now = nowUtc();


    /* =====================================================
       APPROVE
    ===================================================== */

    if ($action === 'approve') {

        /*
         * Approval means the requested amount remains deducted
         * from the user's wallet.
         *
         * The actual mobile-money payment can be sent separately
         * by the administrator/payment process.
         */

        $transactionUpdate =
            $transactions->updateOne(

                [
                    '_id' =>
                        $transactionId,

                    'status' =>
                        'pending',

                    'balance_reserved' =>
                        true
                ],

                [
                    '$set' => [

                        'status' =>
                            'approved',

                        'admin_approved' =>
                            true,

                        'approved_by' =>
                            $adminId,

                        'approved_at' =>
                            $now,

                        'balance_reserved' =>
                            false,

                        'balance_deducted' =>
                            true,

                        'payout_sent' =>
                            false,

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
            $transactionUpdate
                ->getModifiedCount()
            !== 1
        ) {

            throw new RuntimeException(
                'Withdrawal could not be approved.'
            );
        }


        /* -------------------------------------------------
           UPDATE WITHDRAWAL RECORD
        ------------------------------------------------- */

        if ($withdrawalId) {

            $withdrawalUpdate =
                $withdrawals->updateOne(

                    [
                        '_id' =>
                            $withdrawalId,

                        'status' =>
                            'pending'
                    ],

                    [
                        '$set' => [

                            'status' =>
                                'approved',

                            'approved' =>
                                true,

                            'approved_by' =>
                                $adminId,

                            'approved_at' =>
                                $now,

                            'balance_reserved' =>
                                false,

                            'balance_deducted' =>
                                true,

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
                $withdrawalUpdate
                    ->getModifiedCount()
                !== 1
            ) {

                throw new RuntimeException(
                    'Withdrawal record could not be updated.'
                );
            }
        }


        $session->commitTransaction();


        audit(
            'withdrawal_approved',
            $adminId,
            [
                'transaction_id' =>
                    $id,

                'withdrawal_id' =>
                    $withdrawalId
                        ? (string)$withdrawalId
                        : null
            ]
        );


        jsonResponse([

            'success' =>
                true,

            'message' =>
                'Withdrawal approved.'

        ]);
    }


    /* =====================================================
       REJECT
    ===================================================== */

    $amount =
        moneyInt(
            $transaction['amount']
            ?? 0
        );


    if ($amount <= 0) {

        throw new RuntimeException(
            'Invalid withdrawal amount.'
        );
    }


    $rejectionReason =
        $reason !== ''
            ? $reason
            : 'Withdrawal rejected by administrator.';


    /* -----------------------------------------------------
       RESTORE USER BALANCE
    ----------------------------------------------------- */

    $balanceUpdate =
        $users->updateOne(

            [
                '_id' =>
                    $userId
            ],

            [
                '$inc' => [

                    'balance' =>
                        $amount

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
        $balanceUpdate->getMatchedCount()
        !== 1
    ) {

        throw new RuntimeException(
            'Unable to restore the withdrawal amount.'
        );
    }


    /* -----------------------------------------------------
       UPDATE TRANSACTION
    ----------------------------------------------------- */

    $transactionUpdate =
        $transactions->updateOne(

            [
                '_id' =>
                    $transactionId,

                'status' =>
                    'pending',

                'balance_reserved' =>
                    true
            ],

            [
                '$set' => [

                    'status' =>
                        'rejected',

                    'admin_approved' =>
                        false,

                    'rejected_by' =>
                        $adminId,

                    'rejection_reason' =>
                        $rejectionReason,

                    'balance_reserved' =>
                        false,

                    'balance_deducted' =>
                        false,

                    'balance_restored' =>
                        true,

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
        $transactionUpdate
            ->getModifiedCount()
        !== 1
    ) {

        throw new RuntimeException(
            'Withdrawal transaction could not be rejected.'
        );
    }


    /* -----------------------------------------------------
       UPDATE WITHDRAWAL RECORD
    ----------------------------------------------------- */

    if ($withdrawalId) {

        $withdrawalUpdate =
            $withdrawals->updateOne(

                [
                    '_id' =>
                        $withdrawalId,

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

                        'balance_reserved' =>
                            false,

                        'balance_deducted' =>
                            false,

                        'balance_restored' =>
                            true,

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
            $withdrawalUpdate
                ->getModifiedCount()
            !== 1
        ) {

            throw new RuntimeException(
                'Withdrawal record could not be rejected.'
            );
        }
    }


    /* =====================================================
       COMMIT
    ===================================================== */

    $session->commitTransaction();


    audit(
        'withdrawal_rejected',
        $adminId,
        [
            'transaction_id' =>
                $id,

            'amount_restored' =>
                $amount,

            'reason' =>
                $rejectionReason
        ]
    );


    jsonResponse([

        'success' =>
            true,

        'message' =>
            'Withdrawal rejected and funds restored.',

        'amount_restored' =>
            $amount

    ]);


} catch (Throwable $e) {

    if (isset($session)) {

        try {
            $session->abortTransaction();
        } catch (Throwable $ignored) {
        }
    }


    error_log(
        'Admin withdrawal processing error: '
        . $e->getMessage()
    );


    jsonResponse([

        'success' =>
            false,

        'message' =>
            $e->getMessage()

    ], 400);
}