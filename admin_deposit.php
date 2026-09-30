<?php
declare(strict_types=1);

require_once __DIR__ . '/config.php';

$adminId = requireAdmin();


/* =========================================================
   GET DEPOSITS
========================================================= */

if ($_SERVER['REQUEST_METHOD'] === 'GET') {

    try {

        $items = [];


        $cursor = $deposits->find(
            [],
            [
                'sort' => [
                    'created_at' => -1
                ],
                'limit' => 500
            ]
        );


        foreach ($cursor as $deposit) {

            /* -------------------------------------------------
               FIND USER
            ------------------------------------------------- */

            $userId =
                objectIdOrNull(
                    $deposit['user_id']
                    ?? $deposit['userId']
                    ?? null
                );


            $user = null;


            if ($userId) {

                $user =
                    $users->findOne([
                        '_id' =>
                            $userId
                    ]);
            }


            /*
             * Some older deposit records may contain only
             * the customer's email.
             */
            if (
                !$user
                &&
                !empty($deposit['email'])
            ) {

                $user =
                    $users->findOne([
                        'email' =>
                            $deposit['email']
                    ]);
            }


            /* -------------------------------------------------
               USER NAME
            ------------------------------------------------- */

            $userName =
                (string)(
                    $deposit['customer_name']
                    ?? ''
                );


            if ($userName === '' && $user) {

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
               RETURN DEPOSIT
            ------------------------------------------------- */

            $items[] = jsonSafe([

                'id' =>
                    $deposit['_id'],

                'user_id' =>
                    $deposit['user_id']
                    ?? $deposit['userId']
                    ?? null,

                'user_name' =>
                    $userName,

                'email' =>
                    $deposit['email']
                    ?? (
                        $user['email']
                        ?? ''
                    ),

                'phone' =>
                    $deposit['phone']
                    ?? (
                        $user['phone']
                        ?? ''
                    ),

                'amount' =>
                    moneyInt(
                        $deposit['amount']
                        ?? 0
                    ),

                'currency' =>
                    $deposit['currency']
                    ?? 'UGX',

                'payment_method' =>
                    $deposit['payment_method']
                    ?? $deposit['paymentMethod']
                    ?? '',

                'merchant_code' =>
                    $deposit['merchant_code']
                    ?? '',

                'transaction_reference' =>
                    $deposit['transaction_reference']
                    ?? $deposit['transactionReference']
                    ?? '',

                'status' =>
                    $deposit['status']
                    ?? 'pending',

                'verified' =>
                    (bool)(
                        $deposit['verified']
                        ?? false
                    ),

                'approved' =>
                    (bool)(
                        $deposit['approved']
                        ?? false
                    ),

                'balance_credited' =>
                    (bool)(
                        $deposit['balance_credited']
                        ?? false
                    ),

                'created_at' =>
                    $deposit['created_at']
                    ?? null,

                'updated_at' =>
                    $deposit['updated_at']
                    ?? null,

                'approved_at' =>
                    $deposit['approved_at']
                    ?? null,

                'rejection_reason' =>
                    $deposit['rejection_reason']
                    ?? ''

            ]);
        }


        jsonResponse([

            'success' =>
                true,

            'deposits' =>
                $items

        ]);

    } catch (Throwable $e) {

        error_log(
            'Admin deposit GET error: '
            . $e->getMessage()
        );


        jsonResponse([
            'success' => false,
            'message' =>
                'Unable to load deposits.'
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
        $input['depositId']
        ?? $input['deposit_id']
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
            'Invalid deposit ID or action.'
    ], 400);
}


$depositId =
    new MongoDB\BSON\ObjectId(
        $id
    );


/* =========================================================
   PROCESS DEPOSIT
========================================================= */

try {

    $session =
        $client->startSession();

    $session->startTransaction();


    /* -----------------------------------------------------
       FIND DEPOSIT
    ----------------------------------------------------- */

    $deposit =
        $deposits->findOne(
            [
                '_id' =>
                    $depositId
            ],
            [
                'session' =>
                    $session
            ]
        );


    if (!$deposit) {

        throw new RuntimeException(
            'Deposit not found.'
        );
    }


    /* -----------------------------------------------------
       CHECK STATUS
    ----------------------------------------------------- */

    $status =
        strtolower(
            (string)(
                $deposit['status']
                ?? 'pending'
            )
        );


    if (
        !in_array(
            $status,
            [
                'pending',
                'submitted',
                'processing'
            ],
            true
        )
    ) {

        throw new RuntimeException(
            'This deposit has already been processed.'
        );
    }


    /* -----------------------------------------------------
       AMOUNT
    ----------------------------------------------------- */

    $amount =
        moneyInt(
            $deposit['amount']
            ?? 0
        );


    if ($amount <= 0) {

        throw new RuntimeException(
            'Invalid deposit amount.'
        );
    }


    /* =====================================================
       FIND USER
    ===================================================== */

    $userId =
        objectIdOrNull(
            $deposit['user_id']
            ?? $deposit['userId']
            ?? null
        );


    /*
     * The original deposit.php can store user_id as a string,
     * so objectIdOrNull handles both ObjectId and string IDs.
     */

    if (!$userId && !empty($deposit['email'])) {

        $user =
            $users->findOne(
                [
                    'email' =>
                        $deposit['email']
                ],
                [
                    'session' =>
                        $session
                ]
            );


        if ($user) {
            $userId =
                $user['_id'];
        }
    }


    if (!$userId) {

        throw new RuntimeException(
            'Deposit owner could not be identified.'
        );
    }


    $now = nowUtc();


    /* =====================================================
       REJECT DEPOSIT
    ===================================================== */

    if ($action === 'reject') {

        $rejectionReason =
            $reason !== ''
                ? $reason
                : 'Deposit rejected by administrator.';


        $depositUpdate =
            $deposits->updateOne(

                [
                    '_id' =>
                        $depositId,

                    'status' =>
                        [
                            '$in' => [
                                'pending',
                                'submitted',
                                'processing'
                            ]
                        ]
                ],

                [
                    '$set' => [

                        'status' =>
                            'rejected',

                        'approved' =>
                            false,

                        'verified' =>
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


        if (
            $depositUpdate
                ->getModifiedCount()
            !== 1
        ) {

            throw new RuntimeException(
                'Deposit could not be rejected.'
            );
        }


        /* -------------------------------------------------
           UPDATE RELATED TRANSACTION
        ------------------------------------------------- */

        $transactions->updateMany(

            [
                'deposit_id' =>
                    $depositId,

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
            'deposit_rejected',
            $adminId,
            [
                'deposit_id' =>
                    $id,

                'reason' =>
                    $rejectionReason
            ]
        );


        jsonResponse([

            'success' =>
                true,

            'message' =>
                'Deposit rejected.'

        ]);
    }


    /* =====================================================
       APPROVE DEPOSIT
    ===================================================== */

    /*
     * Never credit the wallet twice.
     */
    if (
        ($deposit['balance_credited']
        ?? false)
        === true
    ) {

        throw new RuntimeException(
            'This deposit has already credited the wallet.'
        );
    }


    /* -----------------------------------------------------
       CREDIT WALLET
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
            'User wallet could not be credited.'
        );
    }


    /* -----------------------------------------------------
       APPROVE DEPOSIT
    ----------------------------------------------------- */

    $depositUpdate =
        $deposits->updateOne(

            [
                '_id' =>
                    $depositId,

                'balance_credited' =>
                    [
                        '$ne' =>
                            true
                    ]
            ],

            [
                '$set' => [

                    'status' =>
                        'approved',

                    'approved' =>
                        true,

                    'verified' =>
                        true,

                    'balance_credited' =>
                        true,

                    'approved_by' =>
                        $adminId,

                    'approved_at' =>
                        $now,

                    'processed_at' =>
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


    if (
        $depositUpdate
            ->getModifiedCount()
        !== 1
    ) {

        throw new RuntimeException(
            'Deposit could not be approved.'
        );
    }


    /* =====================================================
       FIND EXISTING TRANSACTION
    ===================================================== */

    $existingTransaction =
        $transactions->findOne(

            [
                'deposit_id' =>
                    $depositId
            ],

            [
                'session' =>
                    $session
            ]

        );


    /* =====================================================
       UPDATE EXISTING TRANSACTION
    ===================================================== */

    if ($existingTransaction) {

        $transactions->updateOne(

            [
                '_id' =>
                    $existingTransaction['_id']
            ],

            [
                '$set' => [

                    'user_id' =>
                        $userId,

                    'type' =>
                        'deposit',

                    'transaction_type' =>
                        'deposit',

                    'status' =>
                        'approved',

                    'payment_status' =>
                        'approved',

                    'balance_credited' =>
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

    } else {

        /* =================================================
           CREATE TRANSACTION
        ================================================= */

        $reference =
            $deposit['transaction_reference']
            ?? $deposit['transactionReference']
            ?? (
                'DEP-'
                .
                strtoupper(
                    bin2hex(
                        random_bytes(6)
                    )
                )
            );


        $transactions->insertOne(

            [

                'user_id' =>
                    $userId,

                'deposit_id' =>
                    $depositId,

                'type' =>
                    'deposit',

                'transaction_type' =>
                    'deposit',

                'title' =>
                    'Deposit approved',

                'description' =>
                    'Deposit approved and wallet credited.',

                'amount' =>
                    $amount,

                'currency' =>
                    $deposit['currency']
                    ?? 'UGX',

                'status' =>
                    'approved',

                'payment_status' =>
                    'approved',

                'balance_credited' =>
                    true,

                'reference' =>
                    $reference,

                'transaction_reference' =>
                    $reference,

                'approved_by' =>
                    $adminId,

                'approved_at' =>
                    $now,

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
    }


    /* =====================================================
       COMMIT
    ===================================================== */

    $session->commitTransaction();


    /* =====================================================
       AUDIT
    ===================================================== */

    audit(
        'deposit_approved',
        $adminId,
        [

            'deposit_id' =>
                $id,

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
            'Deposit approved and wallet credited.',

        'amount' =>
            $amount,

        'deposit_id' =>
            $id

    ]);


} catch (Throwable $e) {

    if (isset($session)) {

        try {
            $session->abortTransaction();
        } catch (Throwable $ignored) {
        }
    }


    error_log(
        'Admin deposit processing error: '
        . $e->getMessage()
    );


    jsonResponse([

        'success' =>
            false,

        'message' =>
            $e->getMessage()

    ], 400);
}