<?php
declare(strict_types=1);

/*
|--------------------------------------------------------------------------
| CROWN CASH - WITHDRAWAL API
|--------------------------------------------------------------------------
| User withdrawal request:
|
| - Uses authenticated Crown Cash account
| - Uses the registered mobile-money number automatically
| - No MTN/Airtel selection required
| - Does NOT deduct wallet balance when request is submitted
| - Creates withdrawal as PENDING
| - Admin approval is responsible for wallet deduction
| - Admin rejection does not affect wallet
|--------------------------------------------------------------------------
*/

require_once __DIR__ . '/config.php';

use MongoDB\BSON\ObjectId;
use MongoDB\BSON\UTCDateTime;


/*
|--------------------------------------------------------------------------
| SESSION
|--------------------------------------------------------------------------
*/

startSecureSession();


/*
|--------------------------------------------------------------------------
| AUTHENTICATION
|--------------------------------------------------------------------------
*/

$userId = requireLogin();

if (!$userId instanceof ObjectId) {
    jsonResponse([
        'success' => false,
        'authenticated' => false,
        'message' => 'Authentication required.'
    ], 401);
}


/*
|--------------------------------------------------------------------------
| FIND CURRENT USER
|--------------------------------------------------------------------------
*/

$user = $users->findOne([
    '_id' => $userId
]);

if (!$user) {
    jsonResponse([
        'success' => false,
        'authenticated' => false,
        'message' => 'Your Crown Cash account could not be found.'
    ], 401);
}


/*
|--------------------------------------------------------------------------
| ACCOUNT STATUS
|--------------------------------------------------------------------------
*/

$userStatus = strtolower(
    trim(
        (string)(
            $user['status']
            ?? $user['account_status']
            ?? 'active'
        )
    )
);

$blockedStatuses = [
    'blocked',
    'suspended',
    'disabled',
    'banned',
    'inactive'
];

if (
    in_array(
        $userStatus,
        $blockedStatuses,
        true
    )
) {
    jsonResponse([
        'success' => false,
        'message' =>
            'Your account is not allowed to make withdrawals.'
    ], 403);
}


/*
|--------------------------------------------------------------------------
| USER PHONE
|--------------------------------------------------------------------------
|
| The registered phone in the Crown Cash account is authoritative.
| The user does not select MTN or Airtel.
|
*/

$registeredPhone =
    trim(
        (string)(
            $user['phone']
            ?? $user['phone_number']
            ?? $user['phoneNumber']
            ?? $user['mobile']
            ?? $user['mobile_number']
            ?? $user['mobileNumber']
            ?? ''
        )
    );


/*
|--------------------------------------------------------------------------
| NORMALIZE PHONE
|--------------------------------------------------------------------------
*/

function normalizeUgandaPhone(
    string $phone
): string {

    $phone = preg_replace(
        '/[^0-9+]/',
        '',
        trim($phone)
    );

    if (
        str_starts_with(
            $phone,
            '+256'
        )
    ) {
        $phone =
            '0' .
            substr(
                $phone,
                4
            );
    }

    elseif (
        str_starts_with(
            $phone,
            '256'
        )
    ) {
        $phone =
            '0' .
            substr(
                $phone,
                3
            );
    }

    return $phone;
}


$registeredPhone =
    normalizeUgandaPhone(
        $registeredPhone
    );


/*
|--------------------------------------------------------------------------
| PHONE VALIDATION
|--------------------------------------------------------------------------
*/

if (
    !preg_match(
        '/^07[0-9]{8}$/',
        $registeredPhone
    )
) {

    jsonResponse([
        'success' => false,
        'message' =>
            'Your registered Mobile Money number is missing or invalid.',
        'registered_phone' =>
            $registeredPhone
    ], 400);
}


/*
|--------------------------------------------------------------------------
| USER NAME
|--------------------------------------------------------------------------
*/

$firstName =
    trim(
        (string)(
            $user['first_name']
            ?? $user['firstName']
            ?? ''
        )
    );

$lastName =
    trim(
        (string)(
            $user['last_name']
            ?? $user['lastName']
            ?? ''
        )
    );

$accountName =
    trim(
        (string)(
            $user['full_name']
            ?? $user['fullName']
            ?? $user['name']
            ?? ''
        )
    );

if ($accountName === '') {
    $accountName =
        trim(
            $firstName .
            ' ' .
            $lastName
        );
}

if ($accountName === '') {
    $accountName = 'Crown Cash User';
}


/*
|--------------------------------------------------------------------------
| WALLET BALANCE
|--------------------------------------------------------------------------
*/

$currentBalance =
    moneyInt(
        $user['balance']
        ?? $user['wallet_balance']
        ?? $user['walletBalance']
        ?? 0
    );

if ($currentBalance < 0) {
    $currentBalance = 0;
}


/*
|--------------------------------------------------------------------------
| CONSTANTS
|--------------------------------------------------------------------------
*/

$minimumWithdrawal = 5000;

$feeRate = 0.20;


/*
|--------------------------------------------------------------------------
| GET WITHDRAWAL HISTORY
|--------------------------------------------------------------------------
*/

if (
    ($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'GET'
) {

    try {

        $cursor =
            $withdrawals->find(
                [
                    'user_id' =>
                        $userId
                ],
                [
                    'sort' => [
                        'created_at' => -1
                    ],
                    'limit' => 50
                ]
            );

        $history = [];

        foreach ($cursor as $withdrawal) {

            $withdrawalId =
                isset($withdrawal['_id'])
                ? (string)$withdrawal['_id']
                : '';

            $amount =
                moneyInt(
                    $withdrawal['amount']
                    ?? 0
                );

            $fee =
                moneyInt(
                    $withdrawal['fee']
                    ?? round(
                        $amount *
                        $feeRate
                    )
                );

            $payout =
                moneyInt(
                    $withdrawal['payout_amount']
                    ?? $withdrawal['net_amount']
                    ?? ($amount - $fee)
                );

            $createdAt = null;

            if (
                isset(
                    $withdrawal['created_at']
                )
            ) {

                $createdAt =
                    toIsoDate(
                        $withdrawal['created_at']
                    );
            }

            $history[] = [

                'id' =>
                    $withdrawalId,

                '_id' =>
                    $withdrawalId,

                'amount' =>
                    $amount,

                'fee' =>
                    $fee,

                'payout_amount' =>
                    $payout,

                'net_amount' =>
                    $payout,

                'status' =>
                    (string)(
                        $withdrawal['status']
                        ?? 'pending'
                    ),

                'method' =>
                    'mobile_money',

                'payment_method' =>
                    'mobile_money',

                'phone' =>
                    $registeredPhone,

                'balance_reserved' =>
                    (bool)(
                        $withdrawal[
                            'balance_reserved'
                        ]
                        ?? false
                    ),

                'balance_deducted' =>
                    (bool)(
                        $withdrawal[
                            'balance_deducted'
                        ]
                        ?? false
                    ),

                'admin_approved' =>
                    (bool)(
                        $withdrawal[
                            'admin_approved'
                        ]
                        ?? false
                    ),

                'payout_status' =>
                    (string)(
                        $withdrawal[
                            'payout_status'
                        ]
                        ?? 'not_paid'
                    ),

                'created_at' =>
                    $createdAt
            ];
        }


        jsonResponse([

            'success' =>
                true,

            'message' =>
                'Withdrawal history loaded.',

            'withdrawals' =>
                $history,

            'data' =>
                $history,

            'wallet' => [

                'balance' =>
                    $currentBalance
            ],

            'balance' =>
                $currentBalance,

            'available_balance' =>
                $currentBalance,

            'registered_phone' =>
                $registeredPhone,

            'account_name' =>
                $accountName
        ]);

    } catch (Throwable $e) {

        jsonResponse([

            'success' =>
                false,

            'message' =>
                'Unable to load withdrawal history.',

            'withdrawals' =>
                [],

            'data' =>
                [],

            'balance' =>
                $currentBalance

        ], 500);
    }
}


/*
|--------------------------------------------------------------------------
| ONLY POST BELOW THIS POINT
|--------------------------------------------------------------------------
*/

if (
    ($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST'
) {

    jsonResponse([
        'success' => false,
        'message' =>
            'Invalid request method.'
    ], 405);
}


/*
|--------------------------------------------------------------------------
| READ JSON BODY
|--------------------------------------------------------------------------
*/

$rawBody =
    file_get_contents(
        'php://input'
    );

$input = [];

if (
    $rawBody !== false &&
    trim($rawBody) !== ''
) {

    $decoded =
        json_decode(
            $rawBody,
            true
        );

    if (
        is_array($decoded)
    ) {
        $input = $decoded;
    }
}


/*
|--------------------------------------------------------------------------
| AMOUNT
|--------------------------------------------------------------------------
*/

$amount =
    moneyInt(
        $input['amount']
        ?? 0
    );


/*
|--------------------------------------------------------------------------
| PHONE FROM FRONTEND
|--------------------------------------------------------------------------
|
| We accept the value only for verification.
| We NEVER use it as the authoritative destination.
|
*/

$submittedPhone =
    normalizeUgandaPhone(
        trim(
            (string)(
                $input['phone']
                ?? ''
            )
        )
    );


/*
|--------------------------------------------------------------------------
| AMOUNT VALIDATION
|--------------------------------------------------------------------------
*/

if ($amount <= 0) {

    jsonResponse([
        'success' => false,
        'message' =>
            'Please enter a valid withdrawal amount.'
    ], 400);
}


if (
    $amount <
    $minimumWithdrawal
) {

    jsonResponse([
        'success' => false,
        'message' =>
            'Minimum withdrawal amount is UGX 5,000.',
        'minimum_withdrawal' =>
            $minimumWithdrawal
    ], 400);
}


/*
|--------------------------------------------------------------------------
| WHOLE NUMBER VALIDATION
|--------------------------------------------------------------------------
*/

if ($amount % 1 !== 0) {

    jsonResponse([
        'success' => false,
        'message' =>
            'Withdrawal amount must be a whole number.'
    ], 400);
}


/*
|--------------------------------------------------------------------------
| PHONE MATCH
|--------------------------------------------------------------------------
|
| If the frontend sends a phone number, it MUST match
| the registered Crown Cash phone.
|
*/

if (
    $submittedPhone !== '' &&
    $submittedPhone !==
    $registeredPhone
) {

    jsonResponse([
        'success' => false,
        'message' =>
            'The withdrawal number does not match your registered Mobile Money number.',
        'registered_phone' =>
            $registeredPhone
    ], 400);
}


/*
|--------------------------------------------------------------------------
| BALANCE CHECK
|--------------------------------------------------------------------------
|
| IMPORTANT:
|
| We only CHECK the balance here.
| We DO NOT deduct anything.
|
*/

if (
    $amount >
    $currentBalance
) {

    jsonResponse([
        'success' => false,
        'message' =>
            'Insufficient wallet balance.',
        'balance' =>
            $currentBalance,
        'requested_amount' =>
            $amount
    ], 400);
}


/*
|--------------------------------------------------------------------------
| CHECK EXISTING PENDING WITHDRAWAL
|--------------------------------------------------------------------------
*/

try {

    $existingPending =
        $withdrawals->findOne([

            'user_id' =>
                $userId,

            'status' => [
                '$in' => [
                    'pending',
                    'approval_processing'
                ]
            ]

        ]);

    if (
        $existingPending !== null
    ) {

        $existingAmount =
            moneyInt(
                $existingPending[
                    'amount'
                ] ?? 0
            );

        $existingId =
            isset(
                $existingPending['_id']
            )
            ? (string)
                $existingPending['_id']
            : '';

        jsonResponse([

            'success' =>
                false,

            'message' =>
                'You already have a pending withdrawal. Please wait for administrator approval before making another withdrawal.',

            'existing_withdrawal' => [

                'id' =>
                    $existingId,

                'amount' =>
                    $existingAmount,

                'status' =>
                    (string)(
                        $existingPending[
                            'status'
                        ]
                        ?? 'pending'
                    )
            ]

        ], 409);
    }

} catch (Throwable $e) {

    jsonResponse([

        'success' =>
            false,

        'message' =>
            'Unable to check your existing withdrawal requests.'

    ], 500);
}


/*
|--------------------------------------------------------------------------
| CALCULATE FEE
|--------------------------------------------------------------------------
*/

$fee =
    moneyInt(
        round(
            $amount *
            $feeRate
        )
    );

$payoutAmount =
    $amount -
    $fee;


/*
|--------------------------------------------------------------------------
| TIMESTAMP
|--------------------------------------------------------------------------
*/

$now =
    nowUtc();


/*
|--------------------------------------------------------------------------
| CREATE WITHDRAWAL DOCUMENT
|--------------------------------------------------------------------------
|
| NO BALANCE DEDUCTION HERE.
|
*/

$withdrawalDocument = [

    'user_id' =>
        $userId,

    'userId' =>
        $userId,

    'email' =>
        (string)(
            $user['email']
            ?? ''
        ),

    'name' =>
        $accountName,

    'phone' =>
        $registeredPhone,

    /*
     * Internal method.
     *
     * The user does NOT select this.
     */
    'method' =>
        'mobile_money',

    'payment_method' =>
        'mobile_money',

    'amount' =>
        $amount,

    'requested_amount' =>
        $amount,

    'fee' =>
        $fee,

    'fee_rate' =>
        $feeRate,

    'payout_amount' =>
        $payoutAmount,

    'net_amount' =>
        $payoutAmount,

    /*
     * CRITICAL:
     */
    'status' =>
        'pending',

    'balance_reserved' =>
        false,

    'balance_deducted' =>
        false,

    'admin_approved' =>
        false,

    'admin_rejected' =>
        false,

    'payout_status' =>
        'not_paid',

    'created_at' =>
        $now,

    'updated_at' =>
        $now,

    'requested_from' =>
        'member_withdrawal_page',

    'registered_phone_used' =>
        true
];


/*
|--------------------------------------------------------------------------
| INSERT WITHDRAWAL
|--------------------------------------------------------------------------
*/

try {

    $result =
        $withdrawals->insertOne(
            $withdrawalDocument
        );

} catch (Throwable $e) {

    jsonResponse([

        'success' =>
            false,

        'message' =>
            'Unable to create the withdrawal request. Please try again.'

    ], 500);
}


$withdrawalId =
    (string)(
        $result->getInsertedId()
    );


if (
    $withdrawalId === ''
) {

    jsonResponse([

        'success' =>
            false,

        'message' =>
            'Withdrawal request could not be created.'

    ], 500);
}


/*
|--------------------------------------------------------------------------
| TRANSACTION RECORD
|--------------------------------------------------------------------------
|
| This is only a record of the request.
| It does NOT deduct the wallet.
|
*/

try {

    $transactions->insertOne([

        'user_id' =>
            $userId,

        'userId' =>
            $userId,

        'email' =>
            (string)(
                $user['email']
                ?? ''
            ),

        'name' =>
            $accountName,

        'type' =>
            'withdrawal',

        'transaction_type' =>
            'withdrawal',

        'amount' =>
            $amount,

        'fee' =>
            $fee,

        'payout_amount' =>
            $payoutAmount,

        'method' =>
            'mobile_money',

        'payment_method' =>
            'mobile_money',

        'phone' =>
            $registeredPhone,

        'status' =>
            'pending',

        'withdrawal_id' =>
            new ObjectId(
                $withdrawalId
            ),

        /*
         * CRITICAL:
         */
        'balance_reserved' =>
            false,

        'balance_deducted' =>
            false,

        'created_at' =>
            $now,

        'updated_at' =>
            $now

    ]);

} catch (Throwable $e) {

    /*
     * Withdrawal itself already exists.
     * Do not delete it because transaction logging failed.
     */
}


/*
|--------------------------------------------------------------------------
| AUDIT LOG
|--------------------------------------------------------------------------
*/

audit(

    'withdrawal_requested',

    $userId,

    [

        'withdrawal_id' =>
            $withdrawalId,

        'amount' =>
            $amount,

        'fee' =>
            $fee,

        'payout_amount' =>
            $payoutAmount,

        'phone' =>
            $registeredPhone,

        'status' =>
            'pending',

        /*
         * Explicitly record that no deduction occurred.
         */
        'balance_deducted' =>
            false

    ]

);


/*
|--------------------------------------------------------------------------
| SUCCESS
|--------------------------------------------------------------------------
*/

jsonResponse([

    'success' =>
        true,

    'message' =>
        'Withdrawal request submitted successfully. Your wallet will only be deducted after administrator approval.',

    'withdrawal' => [

        'id' =>
            $withdrawalId,

        'amount' =>
            $amount,

        'fee' =>
            $fee,

        'payout_amount' =>
            $payoutAmount,

        'net_amount' =>
            $payoutAmount,

        'status' =>
            'pending',

        'method' =>
            'mobile_money',

        'payment_method' =>
            'mobile_money',

        'phone' =>
            $registeredPhone,

        'balance_reserved' =>
            false,

        'balance_deducted' =>
            false,

        'admin_approved' =>
            false,

        'payout_status' =>
            'not_paid'

    ],

    /*
     * VERY IMPORTANT:
     *
     * This is the unchanged wallet balance.
     */
    'wallet' => [

        'balance' =>
            $currentBalance

    ],

    'balance' =>
        $currentBalance,

    'available_balance' =>
        $currentBalance,

    'registered_phone' =>
        $registeredPhone,

    'account_name' =>
        $accountName

]);