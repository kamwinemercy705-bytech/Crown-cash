<?php

declare(strict_types=1);

/*
=========================================================
CROWN CASH - USER WITHDRAWAL API
=========================================================

WITHDRAWAL FLOW

1. User submits withdrawal request.
2. Registered account phone is verified.
3. Withdrawal becomes PENDING.
4. Wallet is NOT deducted.
5. Admin reviews the request.
6. ADMIN APPROVE:
      - Wallet is deducted exactly once.
      - Withdrawal becomes APPROVED.
7. ADMIN REJECT:
      - Wallet remains unchanged.
      - Withdrawal becomes REJECTED.

SECURITY

- Canonical Crown Cash session.
- Server-side authenticated user lookup.
- Registered account phone required.
- Submitted phone MUST match registered phone.
- Uganda phone validation.
- Suspended/blocked accounts cannot withdraw.
- Minimum withdrawal UGX 5,000.
- 20% withdrawal fee.
- MTN / Airtel.
- Prevents multiple pending withdrawals.
- Prevents withdrawal above available wallet balance.
- NO wallet deduction during request creation.
=========================================================
*/


/* =========================================================
   LOAD CONFIG FIRST
========================================================= */

require_once __DIR__ . '/config.php';


/* =========================================================
   CORS
========================================================= */

header(
    'Access-Control-Allow-Origin: https://crown-cash.vercel.app'
);

header(
    'Access-Control-Allow-Credentials: true'
);

header(
    'Access-Control-Allow-Methods: POST, OPTIONS'
);

header(
    'Access-Control-Allow-Headers: Content-Type, Accept, X-Requested-With'
);

header(
    'Content-Type: application/json; charset=utf-8'
);


/* =========================================================
   OPTIONS
========================================================= */

if (
    strtoupper(
        $_SERVER['REQUEST_METHOD'] ?? ''
    ) === 'OPTIONS'
) {

    http_response_code(204);

    exit;
}


/* =========================================================
   ONLY POST
========================================================= */

if (
    strtoupper(
        $_SERVER['REQUEST_METHOD'] ?? ''
    ) !== 'POST'
) {

    http_response_code(405);

    echo json_encode([
        'success' => false,
        'message' => 'Method not allowed.'
    ]);

    exit;
}


/* =========================================================
   SECURE SESSION
========================================================= */

try {

    if (
        function_exists('startSecureSession')
    ) {

        if (
            session_status() !== PHP_SESSION_ACTIVE
        ) {

            startSecureSession();
        }

    } else {

        if (
            session_status() !== PHP_SESSION_ACTIVE
        ) {

            ini_set(
                'session.use_only_cookies',
                '1'
            );

            ini_set(
                'session.use_strict_mode',
                '1'
            );

            ini_set(
                'session.cookie_httponly',
                '1'
            );

            ini_set(
                'session.cookie_secure',
                '1'
            );

            session_name(
                'CROWN_CASH_SESSION'
            );

            session_set_cookie_params([
                'lifetime' => 0,
                'path' => '/',
                'domain' => '',
                'secure' => true,
                'httponly' => true,
                'samesite' => 'None'
            ]);

            session_start();
        }
    }

} catch (Throwable $e) {

    error_log(
        'Crown Cash withdrawal session error: ' .
        $e->getMessage()
    );

    http_response_code(500);

    echo json_encode([
        'success' => false,
        'message' => 'Unable to initialize secure session.'
    ]);

    exit;
}


/* =========================================================
   AUTHENTICATION
========================================================= */

$loggedIn =
    (
        ($_SESSION['logged_in'] ?? false) === true
        ||
        ($_SESSION['logged_in'] ?? null) === 1
        ||
        ($_SESSION['logged_in'] ?? null) === '1'
        ||
        ($_SESSION['authenticated'] ?? false) === true
    );


$userIdSession =
    $_SESSION['user_id']
    ??
    $_SESSION['userId']
    ??
    $_SESSION['id']
    ??
    $_SESSION['_id']
    ??
    null;


if (
    !$loggedIn
    ||
    $userIdSession === null
    ||
    trim((string)$userIdSession) === ''
) {

    http_response_code(401);

    echo json_encode([
        'success' => false,
        'message' => 'Please login first.'
    ]);

    exit;
}


/* =========================================================
   SETTINGS
========================================================= */

$minimumWithdrawal = 5000;

$withdrawalFeeRate = 0.20;


/* =========================================================
   STRING HELPER
========================================================= */

function userWithdrawalString(
    $value,
    string $default = ''
): string {

    if ($value === null) {
        return $default;
    }

    if (
        $value instanceof MongoDB\BSON\ObjectId
    ) {

        return (string)$value;
    }

    if (
        $value instanceof MongoDB\BSON\Decimal128
    ) {

        return $value->__toString();
    }

    if (
        $value instanceof MongoDB\BSON\Int64
    ) {

        return $value->__toString();
    }

    if (is_string($value)) {

        return trim($value);
    }

    if (is_scalar($value)) {

        return trim((string)$value);
    }

    return $default;
}


/* =========================================================
   MONEY HELPER
========================================================= */

function userWithdrawalMoney(
    $value
): float {

    if (
        $value instanceof MongoDB\BSON\Decimal128
    ) {

        return (float)$value->__toString();
    }

    if (
        $value instanceof MongoDB\BSON\Int64
    ) {

        return (float)$value->__toString();
    }

    if (
        is_int($value)
        ||
        is_float($value)
    ) {

        return (float)$value;
    }

    if (is_string($value)) {

        $value =
            str_replace(
                [
                    ',',
                    'UGX',
                    'ugx',
                    ' '
                ],
                '',
                $value
            );

        if (is_numeric($value)) {

            return (float)$value;
        }
    }

    return 0.0;
}


/* =========================================================
   OBJECT ID HELPER
========================================================= */

function userWithdrawalObjectId(
    $value
): ?MongoDB\BSON\ObjectId {

    if (
        $value instanceof MongoDB\BSON\ObjectId
    ) {

        return $value;
    }

    $value =
        userWithdrawalString(
            $value
        );

    if (
        $value === ''
        ||
        !preg_match(
            '/^[a-fA-F0-9]{24}$/',
            $value
        )
    ) {

        return null;
    }

    try {

        return new MongoDB\BSON\ObjectId(
            $value
        );

    } catch (Throwable $e) {

        return null;
    }
}


/* =========================================================
   UGANDA PHONE NORMALIZATION
========================================================= */

function normalizeUgandaWithdrawalPhone(
    string $phone
): string {

    $phone =
        preg_replace(
            '/[^0-9+]/',
            '',
            trim($phone)
        );


    if (!$phone) {

        return '';
    }


    /*
    +256XXXXXXXXX
    */

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


    /*
    256XXXXXXXXX
    */

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


    /*
    Uganda local format:
    07XXXXXXXX
    */

    if (
        preg_match(
            '/^07[0-9]{8}$/',
            $phone
        )
    ) {

        return $phone;
    }


    return '';
}


/* =========================================================
   FIND USER
========================================================= */

function findWithdrawalUserForRequest(
    $sessionUserId
) {

    global $users;


    /*
    First attempt:
    MongoDB ObjectId
    */

    $objectId =
        userWithdrawalObjectId(
            $sessionUserId
        );


    if (
        $objectId !== null
    ) {

        try {

            $user =
                $users->findOne([
                    '_id' => $objectId
                ]);

            if (
                $user !== null
            ) {

                return $user;
            }

        } catch (Throwable $e) {

            error_log(
                'Withdrawal user ObjectId lookup error: ' .
                $e->getMessage()
            );
        }
    }


    /*
    Second attempt:
    custom string ID
    */

    $id =
        userWithdrawalString(
            $sessionUserId
        );


    if (
        $id !== ''
    ) {

        try {

            $user =
                $users->findOne([
                    'id' => $id
                ]);

            if (
                $user !== null
            ) {

                return $user;
            }

        } catch (Throwable $e) {

            error_log(
                'Withdrawal user string lookup error: ' .
                $e->getMessage()
            );
        }
    }


    /*
    Third attempt:
    email from session, if available.
    */

    $sessionEmail =
        userWithdrawalString(
            $_SESSION['email']
            ??
            $_SESSION['user_email']
            ??
            ''
        );


    if (
        $sessionEmail !== ''
    ) {

        try {

            $user =
                $users->findOne([
                    'email' => $sessionEmail
                ]);

            if (
                $user !== null
            ) {

                return $user;
            }

        } catch (Throwable $e) {

            error_log(
                'Withdrawal user email lookup error: ' .
                $e->getMessage()
            );
        }
    }


    return null;
}


/* =========================================================
   USER WALLET BALANCE
========================================================= */

function getWithdrawalUserBalance(
    $user
): float {

    if (!$user) {

        return 0.0;
    }


    if (
        array_key_exists(
            'balance',
            $user
        )
    ) {

        return userWithdrawalMoney(
            $user['balance']
        );
    }


    if (
        array_key_exists(
            'wallet_balance',
            $user
        )
    ) {

        return userWithdrawalMoney(
            $user['wallet_balance']
        );
    }


    if (
        array_key_exists(
            'walletBalance',
            $user
        )
    ) {

        return userWithdrawalMoney(
            $user['walletBalance']
        );
    }


    if (
        isset($user['wallet'])
        &&
        (
            is_array($user['wallet'])
            ||
            $user['wallet']
                instanceof MongoDB\Model\BSONDocument
        )
    ) {

        return userWithdrawalMoney(
            $user['wallet']['balance'] ?? 0
        );
    }


    return 0.0;
}


/* =========================================================
   GET PENDING WITHDRAWAL AMOUNT
========================================================= */

function getPendingWithdrawalAmount(
    $userId
): float {

    global $withdrawals;


    if (
        !isset($withdrawals)
    ) {

        return 0.0;
    }


    $total = 0.0;


    /*
    Support ObjectId user IDs.
    */

    $objectId =
        userWithdrawalObjectId(
            $userId
        );


    $queries = [];


    if (
        $objectId !== null
    ) {

        $queries[] = [
            'user_id' => $objectId,
            'status' => 'pending'
        ];

        $queries[] = [
            'userId' => $objectId,
            'status' => 'pending'
        ];
    }


    /*
    Support string IDs too.
    */

    $stringId =
        userWithdrawalString(
            $userId
        );


    if (
        $stringId !== ''
    ) {

        $queries[] = [
            'user_id' => $stringId,
            'status' => 'pending'
        ];

        $queries[] = [
            'userId' => $stringId,
            'status' => 'pending'
        ];
    }


    try {

        foreach (
            $queries
            as $query
        ) {

            $cursor =
                $withdrawals->find(
                    $query
                );


            foreach (
                $cursor
                as $item
            ) {

                $amount =
                    userWithdrawalMoney(
                        $item['amount']
                        ??
                        $item['requested_amount']
                        ??
                        0
                    );


                if (
                    $amount > 0
                ) {

                    $total += $amount;
                }
            }
        }

    } catch (Throwable $e) {

        error_log(
            'Pending withdrawal lookup error: ' .
            $e->getMessage()
        );
    }


    return $total;
}


/* =========================================================
   READ REQUEST BODY
========================================================= */

$rawInput =
    file_get_contents(
        'php://input'
    );


$data =
    json_decode(
        $rawInput ?: '',
        true
    );


if (
    !is_array($data)
) {

    $data = $_POST;
}


/* =========================================================
   INPUT
========================================================= */

$amountInput =
    $data['amount']
    ??
    $data['requested_amount']
    ??
    null;


$paymentMethod =
    trim(
        (string)(
            $data['payment_method']
            ??
            $data['method']
            ??
            ''
        )
    );


$submittedPhone =
    trim(
        (string)(
            $data['phone']
            ??
            $data['phone_number']
            ??
            $data['mobile']
            ??
            ''
        )
    );


/* =========================================================
   AMOUNT REQUIRED
========================================================= */

if (
    $amountInput === null
    ||
    $amountInput === ''
) {

    http_response_code(400);

    echo json_encode([
        'success' => false,
        'message' =>
            'Please enter a withdrawal amount.'
    ]);

    exit;
}


/* =========================================================
   AMOUNT NUMERIC
========================================================= */

if (
    !is_numeric($amountInput)
) {

    http_response_code(400);

    echo json_encode([
        'success' => false,
        'message' =>
            'Withdrawal amount must be a valid number.'
    ]);

    exit;
}


/* =========================================================
   WHOLE UGX AMOUNT
========================================================= */

$amount =
    (int)$amountInput;


if (
    $amount <= 0
) {

    http_response_code(400);

    echo json_encode([
        'success' => false,
        'message' =>
            'Withdrawal amount must be greater than zero.'
    ]);

    exit;
}


if (
    (float)$amountInput !==
    (float)$amount
) {

    http_response_code(400);

    echo json_encode([
        'success' => false,
        'message' =>
            'Withdrawal amount must be a whole UGX amount.'
    ]);

    exit;
}


/* =========================================================
   MINIMUM WITHDRAWAL
========================================================= */

if (
    $amount < $minimumWithdrawal
) {

    http_response_code(400);

    echo json_encode([
        'success' => false,
        'message' =>
            'Minimum withdrawal is UGX ' .
            number_format(
                $minimumWithdrawal
            ) .
            '.'
    ]);

    exit;
}


/* =========================================================
   PAYMENT METHOD
========================================================= */

$normalizedMethod =
    strtolower(
        preg_replace(
            '/[^a-z]/',
            '',
            $paymentMethod
        )
    );


if (
    in_array(
        $normalizedMethod,
        [
            'mtn',
            'mtnmobilemoney'
        ],
        true
    )
) {

    $paymentMethod = 'MTN';

} elseif (
    in_array(
        $normalizedMethod,
        [
            'airtel',
            'airtelmoney'
        ],
        true
    )
) {

    $paymentMethod = 'Airtel';

} else {

    http_response_code(400);

    echo json_encode([
        'success' => false,
        'message' =>
            'Please select MTN Mobile Money or Airtel Money.'
    ]);

    exit;
}


/* =========================================================
   MAIN PROCESS
========================================================= */

try {

    /* =====================================================
       FIND AUTHENTICATED USER
    ===================================================== */

    $user =
        findWithdrawalUserForRequest(
            $userIdSession
        );


    if (
        !$user
    ) {

        http_response_code(404);

        echo json_encode([
            'success' => false,
            'message' =>
                'User account was not found.'
        ]);

        exit;
    }


    /* =====================================================
       ACCOUNT STATUS
    ===================================================== */

    $accountStatus =
        strtolower(
            userWithdrawalString(
                $user['status']
                ??
                'active'
            )
        );


    if (
        in_array(
            $accountStatus,
            [
                'blocked',
                'suspended',
                'disabled',
                'banned',
                'inactive'
            ],
            true
        )
    ) {

        http_response_code(403);

        echo json_encode([
            'success' => false,
            'message' =>
                'Your account is not allowed to make withdrawals.'
        ]);

        exit;
    }


    /* =====================================================
       REGISTERED PHONE
    ===================================================== */

    $registeredPhone =
        userWithdrawalString(
            $user['phone']
            ??
            $user['phone_number']
            ??
            $user['mobile']
            ??
            ''
        );


    $normalizedRegisteredPhone =
        normalizeUgandaWithdrawalPhone(
            $registeredPhone
        );


    /*
    A withdrawal cannot proceed without
    a valid registered number.
    */

    if (
        $normalizedRegisteredPhone === ''
    ) {

        http_response_code(400);

        echo json_encode([
            'success' => false,
            'message' =>
                'Your registered account phone number is missing or invalid. Please update your account phone number before withdrawing.'
        ]);

        exit;
    }


    /* =====================================================
       USER MUST CONFIRM REGISTERED NUMBER
    ===================================================== */

    if (
        $submittedPhone === ''
    ) {

        http_response_code(400);

        echo json_encode([
            'success' => false,
            'message' =>
                'Please enter your registered account phone number to confirm the withdrawal.',
            'registered_phone' =>
                $normalizedRegisteredPhone
        ]);

        exit;
    }


    $normalizedSubmittedPhone =
        normalizeUgandaWithdrawalPhone(
            $submittedPhone
        );


    if (
        $normalizedSubmittedPhone === ''
    ) {

        http_response_code(400);

        echo json_encode([
            'success' => false,
            'message' =>
                'Please enter a valid Ugandan mobile number.'
        ]);

        exit;
    }


    /*
    IMPORTANT SECURITY CHECK.

    The number supplied by the browser MUST
    match the number stored on the user's account.
    */

    if (
        $normalizedSubmittedPhone !==
        $normalizedRegisteredPhone
    ) {

        http_response_code(403);

        echo json_encode([
            'success' => false,
            'message' =>
                'The withdrawal phone number does not match the phone number registered on your Crown Cash account.'
        ]);

        exit;
    }


    /* =====================================================
       WALLET BALANCE
    ===================================================== */

    $walletBalance =
        getWithdrawalUserBalance(
            $user
        );


    /* =====================================================
       USER ID
    ===================================================== */

    $userObjectId =
        $user['_id']
        ??
        userWithdrawalObjectId(
            $userIdSession
        );


    if (
        $userObjectId === null
    ) {

        http_response_code(400);

        echo json_encode([
            'success' => false,
            'message' =>
                'Invalid user account ID.'
        ]);

        exit;
    }


    /* =====================================================
       PENDING WITHDRAWALS
    ===================================================== */

    $pendingAmount =
        getPendingWithdrawalAmount(
            $userObjectId
        );


    $availableForWithdrawal =
        $walletBalance -
        $pendingAmount;


    if (
        $availableForWithdrawal < 0
    ) {

        $availableForWithdrawal = 0;
    }


    /* =====================================================
       BALANCE CHECK
    ===================================================== */

    if (
        $amount >
        $availableForWithdrawal
    ) {

        http_response_code(400);

        echo json_encode([
            'success' => false,
            'message' =>
                'Insufficient available wallet balance. Pending withdrawal requests are temporarily unavailable for another withdrawal.',
            'balance' =>
                $walletBalance,
            'pending_withdrawals' =>
                $pendingAmount,
            'available_balance' =>
                $availableForWithdrawal
        ]);

        exit;
    }


    /* =====================================================
       ONLY ONE PENDING WITHDRAWAL
    ===================================================== */

    if (
        $pendingAmount > 0
    ) {

        http_response_code(409);

        echo json_encode([
            'success' => false,
            'message' =>
                'You already have a pending withdrawal. Please wait for admin approval before creating another withdrawal.',
            'pending_withdrawals' =>
                $pendingAmount
        ]);

        exit;
    }


    /* =====================================================
       WITHDRAWAL FEE
    ===================================================== */

    $withdrawalFee =
        (int)round(
            $amount *
            $withdrawalFeeRate
        );


    $payoutAmount =
        $amount -
        $withdrawalFee;


    if (
        $payoutAmount <= 0
    ) {

        http_response_code(400);

        echo json_encode([
            'success' => false,
            'message' =>
                'The withdrawal amount is too small after applying the withdrawal fee.'
        ]);

        exit;
    }


    /* =====================================================
       IDS
    ===================================================== */

    $withdrawalId =
        new MongoDB\BSON\ObjectId();


    $now =
        new MongoDB\BSON\UTCDateTime();


    /* =====================================================
       USER DETAILS
    ===================================================== */

    $userEmail =
        userWithdrawalString(
            $user['email']
            ??
            $_SESSION['email']
            ??
            $_SESSION['user_email']
            ??
            ''
        );


    $fullName =
        userWithdrawalString(
            $user['full_name']
            ??
            $user['fullName']
            ??
            $user['name']
            ??
            ''
        );


    /* =====================================================
       WITHDRAWAL REFERENCE
    ===================================================== */

    $reference =
        'WD-' .
        strtoupper(
            substr(
                (string)$withdrawalId,
                -10
            )
        );


    /* =====================================================
       WITHDRAWAL DOCUMENT
    ===================================================== */

    $withdrawalDocument = [

        '_id' =>
            $withdrawalId,

        'user_id' =>
            $userObjectId,

        'userId' =>
            $userObjectId,

        'user_email' =>
            $userEmail,

        'full_name' =>
            $fullName,

        /*
        IMPORTANT:
        This is the verified registered phone.
        */

        'registered_phone' =>
            $normalizedRegisteredPhone,

        'phone' =>
            $normalizedRegisteredPhone,

        'account_number' =>
            $normalizedRegisteredPhone,

        'confirmed_phone' =>
            $normalizedSubmittedPhone,

        'phone_verified' =>
            true,

        'payment_method' =>
            $paymentMethod,

        'method' =>
            $paymentMethod,

        'requested_amount' =>
            $amount,

        'amount' =>
            $amount,

        'fee_rate' =>
            $withdrawalFeeRate,

        'fee' =>
            $withdrawalFee,

        'payout_amount' =>
            $payoutAmount,

        'reference' =>
            $reference,

        'status' =>
            'pending',

        /*
        NO MONEY IS DEDUCTED HERE.
        */

        'balance_reserved' =>
            false,

        'balance_deducted' =>
            false,

        'admin_approved' =>
            false,

        'payout_status' =>
            'not_paid',

        'created_at' =>
            $now,

        'updated_at' =>
            $now
    ];


    /* =====================================================
       CREATE WITHDRAWAL
    ===================================================== */

    $withdrawalInsert =
        $withdrawals->insertOne(
            $withdrawalDocument
        );


    if (
        $withdrawalInsert->getInsertedCount()
        !== 1
    ) {

        throw new RuntimeException(
            'Withdrawal request could not be created.'
        );
    }


    /* =====================================================
       TRANSACTION RECORD
    ===================================================== */

    $transactionDocument = [

        '_id' =>
            new MongoDB\BSON\ObjectId(),

        'user_id' =>
            $userObjectId,

        'type' =>
            'withdrawal',

        'transaction_type' =>
            'withdrawal',

        'reference' =>
            $reference,

        'withdrawal_id' =>
            $withdrawalId,

        'withdrawal_record_id' =>
            $withdrawalId,

        'amount' =>
            $amount,

        'requested_amount' =>
            $amount,

        'fee_rate' =>
            $withdrawalFeeRate,

        'fee' =>
            $withdrawalFee,

        'payout_amount' =>
            $payoutAmount,

        'payment_method' =>
            $paymentMethod,

        /*
        Store the verified registered number.
        */

        'registered_phone' =>
            $normalizedRegisteredPhone,

        'phone' =>
            $normalizedRegisteredPhone,

        'confirmed_phone' =>
            $normalizedSubmittedPhone,

        'phone_verified' =>
            true,

        'status' =>
            'pending',

        /*
        NO WALLET DEDUCTION.
        */

        'balance_reserved' =>
            false,

        'balance_deducted' =>
            false,

        'admin_approved' =>
            false,

        'description' =>
            'Withdrawal request awaiting admin approval.',

        'created_at' =>
            $now,

        'updated_at' =>
            $now
    ];


    try {

        $transactions->insertOne(
            $transactionDocument
        );

    } catch (Throwable $transactionError) {

        /*
        If the transaction record cannot be created,
        remove the withdrawal request so we don't
        leave an incomplete withdrawal.
        */

        try {

            $withdrawals->deleteOne([
                '_id' => $withdrawalId
            ]);

        } catch (Throwable $cleanupError) {

            error_log(
                'Withdrawal cleanup error: ' .
                $cleanupError->getMessage()
            );
        }

        throw $transactionError;
    }


    /* =====================================================
       AUDIT LOG
    ===================================================== */

    if (
        isset($auditLogs)
    ) {

        try {

            $auditLogs->insertOne([

                'user_id' =>
                    $userObjectId,

                'action' =>
                    'withdrawal_requested',

                'type' =>
                    'withdrawal',

                'withdrawal_id' =>
                    $withdrawalId,

                'reference' =>
                    $reference,

                'amount' =>
                    $amount,

                'fee' =>
                    $withdrawalFee,

                'payout_amount' =>
                    $payoutAmount,

                'payment_method' =>
                    $paymentMethod,

                'registered_phone' =>
                    $normalizedRegisteredPhone,

                'phone_verified' =>
                    true,

                'status' =>
                    'pending',

                'balance_deducted' =>
                    false,

                'created_at' =>
                    $now
            ]);

        } catch (Throwable $auditError) {

            error_log(
                'Withdrawal audit error: ' .
                $auditError->getMessage()
            );
        }
    }


    /* =====================================================
       SUCCESS RESPONSE
    ===================================================== */

    echo json_encode([

        'success' =>
            true,

        'message' =>
            'Withdrawal request submitted successfully. Your registered phone number has been confirmed. Your wallet will only be deducted after admin approval.',

        'withdrawal' => [

            'id' =>
                (string)$withdrawalId,

            'reference' =>
                $reference,

            'requested_amount' =>
                $amount,

            'amount' =>
                $amount,

            'fee_rate' =>
                $withdrawalFeeRate,

            'fee' =>
                $withdrawalFee,

            'payout_amount' =>
                $payoutAmount,

            'payment_method' =>
                $paymentMethod,

            /*
            Verified number returned to frontend.
            */

            'registered_phone' =>
                $normalizedRegisteredPhone,

            'phone' =>
                $normalizedRegisteredPhone,

            'phone_verified' =>
                true,

            'status' =>
                'pending',

            'balance_deducted' =>
                false,

            'payout_status' =>
                'not_paid'
        ],

        'wallet' => [

            /*
            This is the actual wallet balance.
            It has NOT been deducted.
            */

            'balance' =>
                $walletBalance,

            'pending_withdrawals' =>
                $pendingAmount + $amount,

            'available_balance' =>
                max(
                    0,
                    $availableForWithdrawal - $amount
                )
        ]

    ]);

} catch (
    MongoDB\Driver\Exception\Exception $e
) {

    error_log(
        'Crown Cash withdrawal MongoDB error: ' .
        $e->getMessage()
    );

    http_response_code(500);

    echo json_encode([
        'success' => false,
        'message' =>
            'Database error while processing withdrawal.'
    ]);

} catch (Throwable $e) {

    error_log(
        'Crown Cash withdrawal error: ' .
        $e->getMessage()
    );

    http_response_code(500);

    echo json_encode([
        'success' => false,
        'message' =>
            'Unable to process withdrawal.'
    ]);
}