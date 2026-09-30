<?php
declare(strict_types=1);

require_once __DIR__ . '/config.php';

$userId = requireLogin();


/* =========================================================
   UGANDA PHONE NUMBER NORMALIZATION
========================================================= */

function normalizeUgandaPhone(string $phone): string
{
    $digits = preg_replace('/\D+/', '', $phone);

    if (!$digits) {
        return '';
    }

    /*
     * 2567XXXXXXXX -> 07XXXXXXXX
     */
    if (str_starts_with($digits, '256')) {
        $digits = '0' . substr($digits, 3);
    }

    /*
     * 7XXXXXXXX -> 07XXXXXXXX
     */
    if (
        str_starts_with($digits, '7')
        && strlen($digits) === 9
    ) {
        $digits = '0' . $digits;
    }

    return $digits;
}


/* =========================================================
   FIND REGISTERED WITHDRAWAL PHONE
========================================================= */

function findWithdrawalPhone(array|object $user): string
{
    $possibleFields = [
        'withdrawal_phone',
        'withdrawalPhone',
        'phone',
        'mobile',
        'telephone'
    ];

    foreach ($possibleFields as $field) {

        $value = '';

        if (is_array($user)) {
            $value = $user[$field] ?? '';
        } else {
            $value = $user[$field] ?? '';
        }

        if ($value !== '') {
            return normalizeUgandaPhone(
                (string)$value
            );
        }
    }

    return '';
}


/* =========================================================
   GET WITHDRAWAL HISTORY
========================================================= */

if ($_SERVER['REQUEST_METHOD'] === 'GET') {

    try {

        $user = $users->findOne([
            '_id' => $userId
        ]);

        if (!$user) {

            jsonResponse([
                'success' => false,
                'message' => 'User not found.'
            ], 404);
        }


        $balance = moneyInt(
            $user['balance']
            ?? $user['wallet_balance']
            ?? 0
        );


        $items = [];


        $cursor = $withdrawals->find(
            [
                '$or' => [
                    [
                        'user_id' =>
                            $userId
                    ],
                    [
                        'user_id' =>
                            (string)$userId
                    ]
                ]
            ],
            [
                'sort' => [
                    'created_at' => -1
                ],
                'limit' => 50
            ]
        );


        foreach ($cursor as $withdrawal) {

            $items[] = jsonSafe([

                'id' =>
                    $withdrawal['_id'],

                'amount' =>
                    moneyInt(
                        $withdrawal['amount']
                        ?? 0
                    ),

                'fee' =>
                    moneyInt(
                        $withdrawal['fee']
                        ?? 0
                    ),

                'net_amount' =>
                    moneyInt(
                        $withdrawal['net_amount']
                        ?? 0
                    ),

                'currency' =>
                    $withdrawal['currency']
                    ?? 'UGX',

                'method' =>
                    $withdrawal['method']
                    ?? $withdrawal['payment_method']
                    ?? 'mobile_money',

                'phone' =>
                    $withdrawal['phone']
                    ?? $withdrawal['account']
                    ?? '',

                'status' =>
                    $withdrawal['status']
                    ?? 'pending',

                'reference' =>
                    $withdrawal['reference']
                    ?? '',

                'balance_reserved' =>
                    (bool)(
                        $withdrawal['balance_reserved']
                        ?? false
                    ),

                'balance_deducted' =>
                    (bool)(
                        $withdrawal['balance_deducted']
                        ?? false
                    ),

                'balance_restored' =>
                    (bool)(
                        $withdrawal['balance_restored']
                        ?? false
                    ),

                'created_at' =>
                    $withdrawal['created_at']
                    ?? null,

                'updated_at' =>
                    $withdrawal['updated_at']
                    ?? null

            ]);
        }


        jsonResponse([

            'success' =>
                true,

            'balance' =>
                $balance,

            'available_balance' =>
                $balance,

            'withdrawal_phone' =>
                findWithdrawalPhone($user),

            'withdrawals' =>
                $items

        ]);

    } catch (Throwable $e) {

        error_log(
            'Withdrawal GET error: '
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
   ONLY POST IS ALLOWED BELOW
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
   VALIDATE AMOUNT
========================================================= */

$amount = moneyInt(
    $input['amount'] ?? 0
);


if ($amount < 5000) {

    jsonResponse([
        'success' => false,
        'message' =>
            'Minimum withdrawal is UGX 5,000.'
    ], 400);
}


if ($amount % 1000 !== 0) {

    jsonResponse([
        'success' => false,
        'message' =>
            'Withdrawal amount must be in multiples of UGX 1,000.'
    ], 400);
}


/* =========================================================
   CREATE WITHDRAWAL
========================================================= */

try {

    $user = $users->findOne([
        '_id' => $userId
    ]);

    if (!$user) {

        jsonResponse([
            'success' => false,
            'message' => 'User not found.'
        ], 404);
    }


    /* -----------------------------------------------------
       WITHDRAWAL PHONE
    ----------------------------------------------------- */

    $phone =
        findWithdrawalPhone($user);


    if ($phone === '') {

        jsonResponse([
            'success' => false,
            'message' =>
                'Please register a withdrawal phone number first.'
        ], 400);
    }


    /*
     * Validate that it is a normal Uganda mobile number.
     */
    if (!preg_match(
        '/^07[0-9]{8}$/',
        $phone
    )) {

        jsonResponse([
            'success' => false,
            'message' =>
                'The registered withdrawal phone number is invalid.'
        ], 400);
    }


    /* -----------------------------------------------------
       ONLY ONE PENDING WITHDRAWAL
    ----------------------------------------------------- */

    $pending =
        $withdrawals->findOne([
            '$or' => [
                [
                    'user_id' =>
                        $userId
                ],
                [
                    'user_id' =>
                        (string)$userId
                ]
            ],
            'status' =>
                'pending'
        ]);


    if ($pending) {

        jsonResponse([
            'success' => false,
            'message' =>
                'You already have a pending withdrawal.'
        ], 409);
    }


    /* =====================================================
       START TRANSACTION
    ===================================================== */

    $session =
        $client->startSession();

    $session->startTransaction();


    try {

        /* -------------------------------------------------
           GET FRESH USER BALANCE
        ------------------------------------------------- */

        $freshUser =
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


        if (!$freshUser) {

            throw new RuntimeException(
                'User not found.'
            );
        }


        $balance = moneyInt(
            $freshUser['balance']
            ?? $freshUser['wallet_balance']
            ?? 0
        );


        /* -------------------------------------------------
           CHECK BALANCE
        ------------------------------------------------- */

        if ($amount > $balance) {

            throw new RuntimeException(
                'Insufficient available balance.'
            );
        }


        /* -------------------------------------------------
           CALCULATE FEE
        ------------------------------------------------- */

        $fee =
            moneyInt(
                $amount * 0.20
            );


        $netAmount =
            $amount - $fee;


        if ($netAmount <= 0) {

            throw new RuntimeException(
                'Invalid withdrawal amount after fee.'
            );
        }


        /* -------------------------------------------------
           CREATE REFERENCE
        ------------------------------------------------- */

        $reference =
            'WD-'
            .
            strtoupper(
                bin2hex(
                    random_bytes(7)
                )
            );


        $now = nowUtc();


        /* =================================================
           RESERVE / DEDUCT MONEY
        ================================================= */

        /*
         * The requested withdrawal amount is removed from
         * the available wallet immediately.
         *
         * If the admin rejects the withdrawal, the amount
         * is restored.
         */

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
            $balanceUpdate->getMatchedCount()
            !== 1
            ||
            $balanceUpdate->getModifiedCount()
            !== 1
        ) {

            throw new RuntimeException(
                'Unable to reserve withdrawal funds.'
            );
        }


        /* =================================================
           CREATE WITHDRAWAL RECORD
        ================================================= */

        $withdrawalResult =
            $withdrawals->insertOne(

                [

                    'user_id' =>
                        $userId,

                    'amount' =>
                        $amount,

                    'fee' =>
                        $fee,

                    'net_amount' =>
                        $netAmount,

                    'currency' =>
                        'UGX',

                    'method' =>
                        'mobile_money',

                    'payment_method' =>
                        'mobile_money',

                    'phone' =>
                        $phone,

                    'account' =>
                        $phone,

                    'status' =>
                        'pending',

                    'approved' =>
                        false,

                    'paid' =>
                        false,

                    'balance_reserved' =>
                        true,

                    'balance_deducted' =>
                        false,

                    'balance_restored' =>
                        false,

                    'reference' =>
                        $reference,

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


        $withdrawalId =
            $withdrawalResult
                ->getInsertedId();


        /* =================================================
           CREATE TRANSACTION
        ================================================= */

        $transactions->insertOne(

            [

                'user_id' =>
                    $userId,

                'type' =>
                    'withdrawal',

                'transaction_type' =>
                    'withdrawal',

                'title' =>
                    'Withdrawal request',

                'description' =>
                    'Withdrawal amount reserved from wallet pending admin approval.',

                'amount' =>
                    $amount,

                'fee' =>
                    $fee,

                'net_amount' =>
                    $netAmount,

                'currency' =>
                    'UGX',

                'status' =>
                    'pending',

                'balance_reserved' =>
                    true,

                'balance_deducted' =>
                    false,

                'balance_restored' =>
                    false,

                'admin_approved' =>
                    false,

                'payout_sent' =>
                    false,

                'phone' =>
                    $phone,

                'reference' =>
                    $reference,

                'transaction_reference' =>
                    $reference,

                'withdrawal_id' =>
                    $withdrawalId,

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


        /* =================================================
           COMMIT
        ================================================= */

        $session->commitTransaction();


        /* =================================================
           RESPONSE
        ================================================= */

        jsonResponse([

            'success' =>
                true,

            'message' =>
                'Withdrawal request submitted. Funds have been reserved.',

            'amount' =>
                $amount,

            'fee' =>
                $fee,

            'net_amount' =>
                $netAmount,

            'new_balance' =>
                $balance - $amount,

            'reference' =>
                $reference

        ], 201);


    } catch (Throwable $e) {

        try {
            $session->abortTransaction();
        } catch (Throwable $ignored) {
        }


        error_log(
            'Withdrawal creation error: '
            . $e->getMessage()
        );


        jsonResponse([
            'success' => false,
            'message' =>
                $e->getMessage()
        ], 400);
    }


} catch (Throwable $e) {

    error_log(
        'Withdrawal outer error: '
        . $e->getMessage()
    );


    jsonResponse([
        'success' => false,
        'message' =>
            'Withdrawal failed.'
    ], 500);
}