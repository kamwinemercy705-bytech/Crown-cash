<?php

declare(strict_types=1);

/*
|--------------------------------------------------------------------------
| CROWN CASH - TRANSACTIONS API
|--------------------------------------------------------------------------
| Frontend:
| https://crown-cash.vercel.app
|
| Backend:
| https://crown-cash1.onrender.com
|--------------------------------------------------------------------------
*/

require_once __DIR__ . '/config.php';


/*
|--------------------------------------------------------------------------
| SESSION
|--------------------------------------------------------------------------
| IMPORTANT:
| Use the exact same session configuration as login.php.
| config.php provides startSecureSession().
|--------------------------------------------------------------------------
*/

startSecureSession();


/*
|--------------------------------------------------------------------------
| CORS
|--------------------------------------------------------------------------
*/

$allowedOrigins = [
    'https://crown-cash.vercel.app',
    'https://www.crown-cash.vercel.app'
];

$requestOrigin =
    $_SERVER['HTTP_ORIGIN'] ?? '';

if (
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
}

header(
    'Access-Control-Allow-Credentials: true'
);

header(
    'Access-Control-Allow-Methods: GET, OPTIONS'
);

header(
    'Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With'
);

header(
    'Vary: Origin'
);

header(
    'Content-Type: application/json; charset=utf-8'
);


/*
|--------------------------------------------------------------------------
| PREFLIGHT
|--------------------------------------------------------------------------
*/

if (
    ($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS'
) {

    http_response_code(204);

    exit;
}


/*
|--------------------------------------------------------------------------
| ONLY GET
|--------------------------------------------------------------------------
*/

if (
    ($_SERVER['REQUEST_METHOD'] ?? '') !== 'GET'
) {

    jsonResponse([
        'success' => false,
        'message' => 'Method not allowed.'
    ], 405);
}


/*
|--------------------------------------------------------------------------
| AUTHENTICATION
|--------------------------------------------------------------------------
*/

try {

    /*
    |--------------------------------------------------------------------------
    | Use the SAME session created by login.php
    |--------------------------------------------------------------------------
    */

    if (
        empty($_SESSION['logged_in']) ||
        empty($_SESSION['user_id'])
    ) {

        jsonResponse([
            'success' => false,
            'authenticated' => false,
            'authorized' => false,
            'message' => 'You are not logged in.'
        ], 401);
    }


    /*
    |--------------------------------------------------------------------------
    | SESSION USER ID
    |--------------------------------------------------------------------------
    */

    $sessionUserId =
        trim(
            (string)$_SESSION['user_id']
        );


    if ($sessionUserId === '') {

        jsonResponse([
            'success' => false,
            'authenticated' => false,
            'authorized' => false,
            'message' => 'User session is invalid.'
        ], 401);
    }


    /*
    |--------------------------------------------------------------------------
    | FIND USER
    |--------------------------------------------------------------------------
    */

    $user = null;


    /*
    |--------------------------------------------------------------------------
    | OBJECT ID LOOKUP
    |--------------------------------------------------------------------------
    */

    if (
        isValidObjectId($sessionUserId)
    ) {

        $objectId =
            new MongoDB\BSON\ObjectId(
                $sessionUserId
            );


        $user =
            $users->findOne([
                '_id' => $objectId
            ]);
    }


    /*
    |--------------------------------------------------------------------------
    | STRING ID FALLBACK
    |--------------------------------------------------------------------------
    */

    if (!$user) {

        $user =
            $users->findOne([
                '_id' => $sessionUserId
            ]);
    }


    /*
    |--------------------------------------------------------------------------
    | EMAIL FALLBACK
    |--------------------------------------------------------------------------
    */

    if (
        !$user &&
        !empty($_SESSION['user_email'])
    ) {

        $sessionEmail =
            strtolower(
                trim(
                    (string)$_SESSION['user_email']
                )
            );


        if ($sessionEmail !== '') {

            $user =
                $users->findOne([
                    'email' => $sessionEmail
                ]);
        }
    }


    /*
    |--------------------------------------------------------------------------
    | USER NOT FOUND
    |--------------------------------------------------------------------------
    */

    if (!$user) {

        jsonResponse([
            'success' => false,
            'authenticated' => false,
            'authorized' => false,
            'message' =>
                'Your user account could not be found.'
        ], 401);
    }


    /*
    |--------------------------------------------------------------------------
    | REAL DATABASE USER ID
    |--------------------------------------------------------------------------
    */

    $realUserId =
        isset($user['_id'])
            ? (string)$user['_id']
            : $sessionUserId;


    /*
    |--------------------------------------------------------------------------
    | USER ID VARIANTS
    |--------------------------------------------------------------------------
    */

    $userIdVariants = [];


    if ($realUserId !== '') {

        $userIdVariants[] =
            $realUserId;
    }


    if ($sessionUserId !== '') {

        $userIdVariants[] =
            $sessionUserId;
    }


    if (
        isset($user['_id']) &&
        $user['_id'] instanceof MongoDB\BSON\ObjectId
    ) {

        $userIdVariants[] =
            $user['_id'];
    }


    $userIdVariants = array_values(
        array_unique(
            array_map(
                static function ($value) {

                    if (
                        $value instanceof MongoDB\BSON\ObjectId
                    ) {
                        return (string)$value;
                    }

                    return (string)$value;
                },
                $userIdVariants
            )
        )
    );


    /*
    |--------------------------------------------------------------------------
    | TRANSACTION QUERY
    |--------------------------------------------------------------------------
    */

    $transactionQueries = [];


    foreach (
        $userIdVariants as $variant
    ) {

        $transactionQueries[] = [
            'user_id' => $variant
        ];

        $transactionQueries[] = [
            'userId' => $variant
        ];

        $transactionQueries[] = [
            'user' => $variant
        ];

        $transactionQueries[] = [
            'account_id' => $variant
        ];
    }


    /*
    |--------------------------------------------------------------------------
    | OBJECT ID QUERIES
    |--------------------------------------------------------------------------
    */

    if (
        isset($user['_id']) &&
        $user['_id'] instanceof MongoDB\BSON\ObjectId
    ) {

        $objectId =
            $user['_id'];


        $transactionQueries[] = [
            'user_id' => $objectId
        ];

        $transactionQueries[] = [
            'userId' => $objectId
        ];

        $transactionQueries[] = [
            'user' => $objectId
        ];

        $transactionQueries[] = [
            'account_id' => $objectId
        ];
    }


    /*
    |--------------------------------------------------------------------------
    | EMAIL QUERY
    |--------------------------------------------------------------------------
    */

    $userEmail =
        strtolower(
            trim(
                (string)(
                    $user['email'] ??
                    $_SESSION['user_email'] ??
                    ''
                )
            )
        );


    if ($userEmail !== '') {

        $transactionQueries[] = [
            'email' => $userEmail
        ];

        $transactionQueries[] = [
            'user_email' => $userEmail
        ];
    }


    /*
    |--------------------------------------------------------------------------
    | FETCH TRANSACTIONS
    |--------------------------------------------------------------------------
    */

    $documents = [];


    if (!empty($transactionQueries)) {

        $cursor =
            $transactions->find(
                [
                    '$or' =>
                        $transactionQueries
                ],
                [
                    'sort' => [
                        'created_at' => -1
                    ]
                ]
            );


        foreach ($cursor as $document) {

            $documents[] =
                $document;
        }
    }


    /*
    |--------------------------------------------------------------------------
    | DEDUPLICATE TRANSACTIONS
    |--------------------------------------------------------------------------
    */

    $uniqueTransactions = [];


    foreach (
        $documents as $document
    ) {

        $transactionId =
            isset($document['_id'])
                ? (string)$document['_id']
                : sha1(
                    json_encode(
                        jsonSafe($document)
                    )
                );


        if (
            isset(
                $uniqueTransactions[
                    $transactionId
                ]
            )
        ) {
            continue;
        }


        $uniqueTransactions[
            $transactionId
        ] =
            $document;
    }


    /*
    |--------------------------------------------------------------------------
    | FORMAT TRANSACTIONS
    |--------------------------------------------------------------------------
    */

    $formattedTransactions = [];


    foreach (
        $uniqueTransactions as $document
    ) {

        /*
        |--------------------------------------------------------------------------
        | TYPE
        |--------------------------------------------------------------------------
        */

        $rawType =
            strtolower(
                trim(
                    (string)(
                        $document['type'] ??
                        $document['transaction_type'] ??
                        $document['transactionType'] ??
                        ''
                    )
                )
            );


        $type =
            $rawType;


        if (
            in_array(
                $rawType,
                [
                    'deposit',
                    'credit',
                    'funding',
                    'topup',
                    'top_up'
                ],
                true
            )
        ) {

            $type = 'deposit';

        } elseif (
            in_array(
                $rawType,
                [
                    'withdrawal',
                    'withdraw',
                    'debit'
                ],
                true
            )
        ) {

            $type = 'withdrawal';

        } elseif (
            in_array(
                $rawType,
                [
                    'investment',
                    'invest'
                ],
                true
            )
        ) {

            $type = 'investment';

        } elseif (
            in_array(
                $rawType,
                [
                    'income',
                    'earning',
                    'earnings',
                    'profit',
                    'return',
                    'commission',
                    'referral'
                ],
                true
            )
        ) {

            $type = 'income';

        } elseif ($type === '') {

            $type = 'other';
        }


        /*
        |--------------------------------------------------------------------------
        | STATUS
        |--------------------------------------------------------------------------
        */

        $rawStatus =
            strtolower(
                trim(
                    (string)(
                        $document['status'] ??
                        ''
                    )
                )
            );


        if (
            in_array(
                $rawStatus,
                [
                    'complete',
                    'completed',
                    'success',
                    'successful',
                    'approved'
                ],
                true
            )
        ) {

            $status = 'completed';

        } elseif (
            in_array(
                $rawStatus,
                [
                    'failed',
                    'failure',
                    'error'
                ],
                true
            )
        ) {

            $status = 'failed';

        } elseif (
            in_array(
                $rawStatus,
                [
                    'rejected',
                    'declined',
                    'denied'
                ],
                true
            )
        ) {

            $status = 'rejected';

        } else {

            $status =
                $rawStatus !== ''
                    ? $rawStatus
                    : 'pending';
        }


        /*
        |--------------------------------------------------------------------------
        | AMOUNT
        |--------------------------------------------------------------------------
        */

        $amount =
            (float)(
                $document['amount'] ??
                $document['value'] ??
                0
            );


        /*
        |--------------------------------------------------------------------------
        | TITLE
        |--------------------------------------------------------------------------
        */

        if ($type === 'investment') {

            /*
            |--------------------------------------------------------------------------
            | Do not expose old Starter / Standard / Advanced plan names.
            |--------------------------------------------------------------------------
            */

            $title =
                'Crown Cash Investment';

        } elseif ($type === 'deposit') {

            $title =
                'Wallet Deposit';

        } elseif ($type === 'withdrawal') {

            $title =
                'Wallet Withdrawal';

        } elseif ($type === 'income') {

            $title =
                'Crown Cash Earnings';

        } else {

            $title =
                ucfirst(
                    str_replace(
                        '_',
                        ' ',
                        $type
                    )
                );
        }


        /*
        |--------------------------------------------------------------------------
        | DESCRIPTION
        |--------------------------------------------------------------------------
        */

        $description =
            (string)(
                $document['description'] ??
                $document['note'] ??
                $document['message'] ??
                ''
            );


        /*
        |--------------------------------------------------------------------------
        | REFERENCE
        |--------------------------------------------------------------------------
        */

        $reference =
            (string)(
                $document['reference'] ??
                $document['transaction_reference'] ??
                $document['transactionReference'] ??
                $document['ref'] ??
                ''
            );


        /*
        |--------------------------------------------------------------------------
        | PAYMENT METHOD
        |--------------------------------------------------------------------------
        */

        $paymentMethod =
            (string)(
                $document['payment_method'] ??
                $document['paymentMethod'] ??
                $document['method'] ??
                ''
            );


        /*
        |--------------------------------------------------------------------------
        | INVESTMENT ID
        |--------------------------------------------------------------------------
        */

        $investmentId =
            $document['investment_id'] ??
            $document['investmentId'] ??
            null;


        if (
            $investmentId instanceof MongoDB\BSON\ObjectId
        ) {

            $investmentId =
                (string)$investmentId;
        }


        /*
        |--------------------------------------------------------------------------
        | CREATED DATE
        |--------------------------------------------------------------------------
        */

        $createdAt =
            $document['created_at'] ??
            $document['createdAt'] ??
            $document['date'] ??
            $document['timestamp'] ??
            null;


        $createdAt =
            toIsoDate(
                $createdAt
            );


        /*
        |--------------------------------------------------------------------------
        | SIGN
        |--------------------------------------------------------------------------
        */

        $displayAmount =
            abs($amount);


        if ($type === 'withdrawal') {

            $displayAmount =
                -$displayAmount;
        }


        /*
        |--------------------------------------------------------------------------
        | OUTPUT
        |--------------------------------------------------------------------------
        */

        $formattedTransactions[] = [

            'id' =>
                isset($document['_id'])
                    ? (string)$document['_id']
                    : '',

            'type' =>
                $type,

            'title' =>
                $title,

            'description' =>
                $description,

            'amount' =>
                $displayAmount,

            'currency' =>
                (string)(
                    $document['currency'] ??
                    'UGX'
                ),

            'status' =>
                $status,

            'reference' =>
                $reference,

            'payment_method' =>
                $paymentMethod,

            'method' =>
                $paymentMethod,

            'investment_id' =>
                $investmentId,

            'created_at' =>
                $createdAt
        ];
    }


    /*
    |--------------------------------------------------------------------------
    | SORT NEWEST FIRST
    |--------------------------------------------------------------------------
    */

    usort(
        $formattedTransactions,
        static function (
            array $a,
            array $b
        ): int {

            return strcmp(
                (string)(
                    $b['created_at'] ?? ''
                ),
                (string)(
                    $a['created_at'] ?? ''
                )
            );
        }
    );


    /*
    |--------------------------------------------------------------------------
    | SUMMARY
    |--------------------------------------------------------------------------
    */

    $totalDeposits = 0.0;
    $totalWithdrawals = 0.0;
    $totalInvestments = 0.0;
    $totalIncome = 0.0;


    foreach (
        $formattedTransactions as $transaction
    ) {

        /*
        |--------------------------------------------------------------------------
        | Only completed transactions affect summary.
        |--------------------------------------------------------------------------
        */

        if (
            $transaction['status'] !== 'completed'
        ) {
            continue;
        }


        $amount =
            abs(
                (float)$transaction['amount']
            );


        switch (
            $transaction['type']
        ) {

            case 'deposit':

                $totalDeposits +=
                    $amount;

                break;


            case 'withdrawal':

                $totalWithdrawals +=
                    $amount;

                break;


            case 'investment':

                $totalInvestments +=
                    $amount;

                break;


            case 'income':

                $totalIncome +=
                    $amount;

                break;
        }
    }


    /*
    |--------------------------------------------------------------------------
    | USER WALLET BALANCE
    |--------------------------------------------------------------------------
    */

    $walletBalance =
        (float)(
            $user['balance'] ??
            $user['wallet_balance'] ??
            $user['walletBalance'] ??
            0
        );


    /*
    |--------------------------------------------------------------------------
    | RESPONSE
    |--------------------------------------------------------------------------
    */

    jsonResponse([

        'success' =>
            true,

        'authenticated' =>
            true,

        'authorized' =>
            true,

        'message' =>
            'Transactions loaded successfully.',

        'user' => [

            'id' =>
                $realUserId,

            'email' =>
                $userEmail,

            'name' =>
                (string)(
                    $user['full_name'] ??
                    $user['fullName'] ??
                    $user['name'] ??
                    $user['username'] ??
                    'Member'
                )
        ],

        'balance' =>
            $walletBalance,

        'available_balance' =>
            $walletBalance,

        'wallet_balance' =>
            $walletBalance,

        'summary' => [

            'total_deposits' =>
                $totalDeposits,

            'total_withdrawals' =>
                $totalWithdrawals,

            'total_investments' =>
                $totalInvestments,

            'total_income' =>
                $totalIncome
        ],

        'transactions' =>
            array_values(
                $formattedTransactions
            ),

        'count' =>
            count(
                $formattedTransactions
            )

    ], 200);


} catch (Throwable $e) {

    error_log(
        'Crown Cash transactions error: ' .
        $e->getMessage()
    );


    jsonResponse([

        'success' =>
            false,

        'authenticated' =>
            true,

        'authorized' =>
            false,

        'message' =>
            'Unable to load transactions right now.'

    ], 500);
}