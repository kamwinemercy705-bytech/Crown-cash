<?php

declare(strict_types=1);

/*
=========================================================
CROWN CASH - USER WITHDRAWAL API
=========================================================

CORRECT WITHDRAWAL FLOW

USER:
    Submit withdrawal
        ↓
    Registered phone verified
        ↓
    PENDING
        ↓
    WALLET UNCHANGED

ADMIN:
    APPROVE
        ↓
    Atomic wallet deduction
        ↓
    APPROVED

ADMIN:
    REJECT
        ↓
    REJECTED
        ↓
    WALLET UNCHANGED

IMPORTANT:

- Wallet is NEVER deducted here.
- Wallet is deducted ONLY by admin_withdrawal.php
  after admin approval.
- Registered phone must match the account phone.
- Only one active withdrawal is allowed.
- approval_processing is treated as active.
=========================================================
*/


/* =========================================================
   LOAD CONFIG FIRST
========================================================= */

require_once __DIR__ . '/config.php';


/* =========================================================
   CORS
========================================================= */

$allowedOrigins = [
    'https://crown-cash.vercel.app',
    'https://www.crown-cash.vercel.app'
];

$requestOrigin =
    $_SERVER['HTTP_ORIGIN'] ?? '';

if (
    $requestOrigin !== ''
    &&
    in_array(
        $requestOrigin,
        $allowedOrigins,
        true
    )
) {

    header(
        'Access-Control-Allow-Origin: ' .
        $requestOrigin
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
        'Vary: Origin'
    );
}

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
        'message' =>
            'Unable to initialize secure session.'
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

    if (
        is_array($value)
        &&
        isset($value['$oid'])
    ) {

        $value =
            $value['$oid'];
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

    } elseif (
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
    ObjectId.
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
    Custom string ID.
    */

    $id =
        userWithdrawalString(
            $sessionUserId
        );


    if (
        $id !== ''
    ) {

        foreach (
            [
                'id',
                'user_id',
                'userId'
            ] as $field
        ) {

            try {

                $user =
                    $users->findOne([
                        $field => $id
                    ]);

                if (
                    $user !== null
                ) {

                    return $user;
                }

            } catch (Throwable $e) {

                error_log(
                    'Withdrawal user ID lookup error: ' .
                    $e->getMessage()
                );
            }
        }
    }


    /*
    Session email fallback.
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
                    'email' =>
                        strtolower(
                            $sessionEmail
                        )
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
   WALLET BALANCE
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
    ) {

        return userWithdrawalMoney(
            $user['wallet']['balance']
            ??
            0
        );
    }


    return 0.0;
}


/* =========================================================
   FIND ACTIVE WITHDRAWALS
========================================================= */

function getActiveWithdrawalAmount(
    $userId
): float {

    global $withdrawals;


    if (
        !isset($withdrawals)
    ) {

        return 0.0;
    }


    $queries = [];


    $objectId =
        userWithdrawalObjectId(
            $userId
        );


    $stringId =
        userWithdrawalString(
            $userId
        );


    /*
    ObjectId queries.
    */

    if (
        $objectId !== null
    ) {

        $queries[] = [

            'user_id' =>
                $objectId,

            'status' =>
                [
                    '$in' => [
                        'pending',
                        'approval_processing'
                    ]
                ]
        ];

        $queries[] = [

            'userId' =>
                $objectId,

            'status' =>
                [
                    '$in' => [
                        'pending',
                        'approval_processing'
                    ]
                ]
        ];
    }


    /*
    String ID queries.
    */

    if (
        $stringId !== ''
    ) {

        $queries[] = [

            'user_id' =>
                $stringId,

            'status' =>
                [
                    '$in' => [
                        'pending',
                        'approval_processing'
                    ]
                ]
        ];

        $queries[] = [

            'userId' =>
                $stringId,

            'status' =>
                [
                    '$in' => [
                        'pending',
                        'approval_processing'
                    ]
                ]
        ];
    }


    $total = 0.0;

    $seen = [];


    try {

        foreach (
            $queries as $query
        ) {

            $cursor =
                $withdrawals->find(
                    $query
                );


            foreach (
                $cursor as $item
            ) {

                $id =
                    isset($item['_id'])
                        ? (string)$item['_id']
                        : '';


                /*
                Prevent double-counting if the same
                withdrawal was found through both
                user_id and userId.
                */

                if (
                    $id !== ''
                ) {

                    if (
                        isset($seen[$id])
                    ) {

                        continue;
                    }

                    $seen[$id] = true;
                }


                $itemAmount =
                    userWithdrawalMoney(
                        $item['amount']
                        ??
                        $item['requested_amount']
                        ??
                        0
                    );


                if (
                    $itemAmount > 0
                ) {

                    $total +=
                        $itemAmount;
                }
            }
        }

    } catch (Throwable $e) {

        error_log(
            'Active withdrawal lookup error: ' .
            $e->getMessage()
        );
    }


    return $total;
}


/* =========================================================
   READ REQUEST
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
   AMOUNT
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
   MINIMUM
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
       FIND USER
    ===================================================== */

    $user =
        findWithdrawalUserForRequest(
            $userIdSession
        );


    if (!$user) {

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
       CONFIRM REGISTERED PHONE
    ===================================================== */

    if (
        $submittedPhone === ''
    ) {

        http_response_code(400);

        echo json_encode([
            'success' => false,
            'message' =>
                'Please enter your registered account phone number to confirm the withdrawal.'
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
       ACTIVE WITHDRAWALS
    ===================================================== */

    $activeAmount =
        getActiveWithdrawalAmount(
            $userObjectId
        );


    /*
    Important:

    A withdrawal in approval_processing is still active.
    */

    if (
        $activeAmount > 0
    ) {

        http_response_code(409);

        echo json_encode([
            'success' => false,
            'message' =>
                'You already have a withdrawal request awaiting processing. Please wait for the current withdrawal to be approved or rejected before creating another one.',
            'active_withdrawals' =>
                $activeAmount
        ]);

        exit;
    }


    /* =====================================================
       BALANCE CHECK
    ===================================================== */

    if (
        $amount > $walletBalance
    ) {

        http_response_code(400);

        echo json_encode([
            'success' => false,
            'message' =>
                'Insufficient wallet balance.',
            'balance' =>
                $walletBalance,
            'available_balance' =>
                $walletBalance
        ]);

        exit;
    }


    /* =====================================================
       FEE
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
       IDs / TIME
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
       REFERENCE
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
        ================================================
        CRITICAL ACCOUNTING FLAGS
        ================================================
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
       INSERT WITHDRAWAL
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
       TRANSACTION
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
        CRITICAL:
        No wallet deduction.
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
        Do not leave a withdrawal without its
        corresponding transaction.
        */

        try {

            $withdrawals->deleteOne([
                '_id' =>
                    $withdrawalId
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
       AUDIT
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

                'balance_reserved' =>
                    false,

                'balance_deducted' =>
                    false,

                'admin_approved' =>
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
       SUCCESS
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

            'registered_phone' =>
                $normalizedRegisteredPhone,

            'phone' =>
                $normalizedRegisteredPhone,

            'phone_verified' =>
                true,

            'status' =>
                'pending',

            'balance_reserved' =>
                false,

            'balance_deducted' =>
                false,

            'admin_approved' =>
                false,

            'payout_status' =>
                'not_paid'
        ],

        'wallet' => [

            /*
            THIS IS THE REAL WALLET BALANCE.
            IT HAS NOT BEEN DEDUCTED.
            */

            'balance' =>
                $walletBalance,

            'pending_withdrawals' =>
                $amount,

            'available_balance' =>
                $walletBalance
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