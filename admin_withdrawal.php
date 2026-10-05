<?php
declare(strict_types=1);

/*
|--------------------------------------------------------------------------
| CROWN CASH - ADMIN WITHDRAWAL MANAGEMENT
|--------------------------------------------------------------------------
|
| GET:
|   Returns withdrawal requests for the administrator.
|
| POST:
|   approve -> deducts wallet and approves withdrawal
|   reject  -> rejects withdrawal without deducting wallet
|
| IMPORTANT:
|   A user's wallet is NEVER deducted when the withdrawal is requested.
|   Wallet deduction happens ONLY inside the approve operation.
|
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
| ADMIN AUTHENTICATION
|--------------------------------------------------------------------------
*/

$adminId = requireAdmin();

if (!$adminId instanceof ObjectId) {

    jsonResponse([
        'success' => false,
        'authorized' => false,
        'message' => 'Administrator access required.'
    ], 403);
}


/*
|--------------------------------------------------------------------------
| HELPERS
|--------------------------------------------------------------------------
*/

function adminWithdrawalMoney(
    mixed $value
): int {

    return (int)round(
        (float)$value
    );
}


function adminWithdrawalString(
    mixed $value
): string {

    if (
        is_string($value)
    ) {
        return trim($value);
    }

    if (
        is_numeric($value)
    ) {
        return trim(
            (string)$value
        );
    }

    return '';
}


function adminWithdrawalObjectId(
    mixed $value
): ?ObjectId {

    if (
        $value instanceof ObjectId
    ) {
        return $value;
    }

    if (
        is_string($value) &&
        preg_match(
            '/^[a-f0-9]{24}$/i',
            $value
        )
    ) {
        return new ObjectId($value);
    }

    return null;
}


function adminWithdrawalDate(
    mixed $value
): ?string {

    if (
        $value instanceof UTCDateTime
    ) {

        return $value
            ->toDateTime()
            ->format(DATE_ATOM);
    }

    if (
        $value instanceof DateTimeInterface
    ) {

        return $value->format(
            DATE_ATOM
        );
    }

    if (
        is_string($value) &&
        trim($value) !== ''
    ) {

        return trim($value);
    }

    return null;
}


function adminWithdrawalUserIdFilter(
    ObjectId $userId
): array {

    return [
        '$or' => [
            [
                '_id' => $userId
            ],
            [
                'id' => (string)$userId
            ],
            [
                'user_id' => (string)$userId
            ],
            [
                'userId' => (string)$userId
            ]
        ]
    ];
}


/*
|--------------------------------------------------------------------------
| REQUEST METHOD
|--------------------------------------------------------------------------
*/

$method =
    strtoupper(
        $_SERVER['REQUEST_METHOD'] ?? 'GET'
    );


/*
|--------------------------------------------------------------------------
| GET - WITHDRAWAL MANAGEMENT
|--------------------------------------------------------------------------
*/

if (
    $method === 'GET'
) {

    try {

        $cursor =
            $withdrawals->find(
                [],
                [
                    'sort' => [
                        'created_at' => -1
                    ],
                    'limit' => 100
                ]
            );


        $withdrawalList = [];

        $pendingCount = 0;
        $pendingAmount = 0;

        $approvedCount = 0;
        $approvedAmount = 0;

        $rejectedCount = 0;
        $rejectedAmount = 0;


        foreach (
            $cursor as $withdrawal
        ) {

            $withdrawalId =
                isset(
                    $withdrawal['_id']
                )
                ? (string)
                    $withdrawal['_id']
                : '';


            $userId =
                adminWithdrawalObjectId(
                    $withdrawal['user_id']
                    ?? $withdrawal['userId']
                    ?? null
                );


            /*
            |--------------------------------------------------------------------------
            | USER LOOKUP
            |--------------------------------------------------------------------------
            */

            $user = null;

            if (
                $userId instanceof ObjectId
            ) {

                $user =
                    $users->findOne([
                        '_id' =>
                            $userId
                    ]);
            }


            /*
            |--------------------------------------------------------------------------
            | FALLBACK USER LOOKUP
            |--------------------------------------------------------------------------
            */

            if (
                !$user &&
                isset(
                    $withdrawal['email']
                )
            ) {

                $email =
                    strtolower(
                        trim(
                            (string)
                                $withdrawal[
                                    'email'
                                ]
                        )
                    );

                if (
                    $email !== ''
                ) {

                    $user =
                        $users->findOne([
                            'email' =>
                                $email
                        ]);
                }
            }


            /*
            |--------------------------------------------------------------------------
            | NAME
            |--------------------------------------------------------------------------
            */

            $firstName =
                $user
                ? adminWithdrawalString(
                    $user['first_name']
                    ?? $user['firstName']
                    ?? ''
                )
                : '';


            $lastName =
                $user
                ? adminWithdrawalString(
                    $user['last_name']
                    ?? $user['lastName']
                    ?? ''
                )
                : '';


            $name =
                $user
                ? adminWithdrawalString(
                    $user['full_name']
                    ?? $user['fullName']
                    ?? $user['name']
                    ?? ''
                )
                : '';


            if (
                $name === ''
            ) {

                $name =
                    trim(
                        $firstName .
                        ' ' .
                        $lastName
                    );
            }


            if (
                $name === ''
            ) {

                $name =
                    adminWithdrawalString(
                        $withdrawal['name']
                        ?? 'Unknown user'
                    );
            }


            /*
            |--------------------------------------------------------------------------
            | EMAIL
            |--------------------------------------------------------------------------
            */

            $email =
                $user
                ? adminWithdrawalString(
                    $user['email']
                    ?? ''
                )
                : adminWithdrawalString(
                    $withdrawal['email']
                    ?? ''
                );


            /*
            |--------------------------------------------------------------------------
            | PHONE
            |--------------------------------------------------------------------------
            */

            $phone =
                $user
                ? adminWithdrawalString(
                    $user['phone']
                    ?? $user['phone_number']
                    ?? $user['phoneNumber']
                    ?? $user['mobile']
                    ?? ''
                )
                : adminWithdrawalString(
                    $withdrawal['phone']
                    ?? ''
                );


            /*
            |--------------------------------------------------------------------------
            | AMOUNTS
            |--------------------------------------------------------------------------
            */

            $amount =
                adminWithdrawalMoney(
                    $withdrawal['amount']
                    ?? $withdrawal[
                        'requested_amount'
                    ]
                    ?? 0
                );


            $fee =
                adminWithdrawalMoney(
                    $withdrawal['fee']
                    ?? round(
                        $amount * 0.20
                    )
                );


            $payout =
                adminWithdrawalMoney(
                    $withdrawal[
                        'payout_amount'
                    ]
                    ?? $withdrawal[
                        'net_amount'
                    ]
                    ?? (
                        $amount - $fee
                    )
                );


            /*
            |--------------------------------------------------------------------------
            | STATUS
            |--------------------------------------------------------------------------
            */

            $status =
                strtolower(
                    adminWithdrawalString(
                        $withdrawal['status']
                        ?? 'pending'
                    )
                );


            /*
            |--------------------------------------------------------------------------
            | DATE
            |--------------------------------------------------------------------------
            */

            $createdAt =
                adminWithdrawalDate(
                    $withdrawal['created_at']
                    ?? $withdrawal['createdAt']
                    ?? null
                );


            $updatedAt =
                adminWithdrawalDate(
                    $withdrawal['updated_at']
                    ?? $withdrawal['updatedAt']
                    ?? null
                );


            /*
            |--------------------------------------------------------------------------
            | COUNTERS
            |--------------------------------------------------------------------------
            */

            if (
                in_array(
                    $status,
                    [
                        'pending',
                        'approval_processing'
                    ],
                    true
                )
            ) {

                $pendingCount++;

                $pendingAmount +=
                    $amount;
            }

            elseif (
                $status === 'approved'
            ) {

                $approvedCount++;

                $approvedAmount +=
                    $amount;
            }

            elseif (
                $status === 'rejected'
            ) {

                $rejectedCount++;

                $rejectedAmount +=
                    $amount;
            }


            /*
            |--------------------------------------------------------------------------
            | RESPONSE RECORD
            |--------------------------------------------------------------------------
            */

            $withdrawalList[] = [

                'id' =>
                    $withdrawalId,

                '_id' =>
                    $withdrawalId,

                'user_id' =>
                    $userId
                    ? (string)$userId
                    : adminWithdrawalString(
                        $withdrawal['user_id']
                        ?? $withdrawal['userId']
                        ?? ''
                    ),

                'userId' =>
                    $userId
                    ? (string)$userId
                    : adminWithdrawalString(
                        $withdrawal['user_id']
                        ?? $withdrawal['userId']
                        ?? ''
                    ),

                'name' =>
                    $name,

                'user_name' =>
                    $name,

                'email' =>
                    $email,

                'phone' =>
                    $phone,

                'amount' =>
                    $amount,

                'requested_amount' =>
                    $amount,

                'fee' =>
                    $fee,

                'payout_amount' =>
                    $payout,

                'net_amount' =>
                    $payout,

                'method' =>
                    adminWithdrawalString(
                        $withdrawal['method']
                        ?? 'mobile_money'
                    ),

                'payment_method' =>
                    adminWithdrawalString(
                        $withdrawal[
                            'payment_method'
                        ]
                        ?? 'mobile_money'
                    ),

                'status' =>
                    $status,

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

                'admin_rejected' =>
                    (bool)(
                        $withdrawal[
                            'admin_rejected'
                        ]
                        ?? false
                    ),

                'payout_status' =>
                    adminWithdrawalString(
                        $withdrawal[
                            'payout_status'
                        ]
                        ?? 'not_paid'
                    ),

                'created_at' =>
                    $createdAt,

                'updated_at' =>
                    $updatedAt
            ];
        }


        /*
        |--------------------------------------------------------------------------
        | RESPONSE
        |--------------------------------------------------------------------------
        */

        jsonResponse([

            'success' =>
                true,

            'authorized' =>
                true,

            'withdrawals' =>
                $withdrawalList,

            'data' =>
                $withdrawalList,

            'total' =>
                count(
                    $withdrawalList
                ),

            'pending' => [

                'count' =>
                    $pendingCount,

                'amount' =>
                    $pendingAmount
            ],

            'approved' => [

                'count' =>
                    $approvedCount,

                'amount' =>
                    $approvedAmount
            ],

            'rejected' => [

                'count' =>
                    $rejectedCount,

                'amount' =>
                    $rejectedAmount
            ]

        ]);

    } catch (Throwable $e) {

        jsonResponse([

            'success' =>
                false,

            'authorized' =>
                true,

            'message' =>
                'Unable to load withdrawal requests.',

            'error' =>
                $e->getMessage()

        ], 500);
    }
}


/*
|--------------------------------------------------------------------------
| POST - APPROVE / REJECT
|--------------------------------------------------------------------------
*/

if (
    $method !== 'POST'
) {

    jsonResponse([

        'success' =>
            false,

        'message' =>
            'Invalid request method.'

    ], 405);
}


/*
|--------------------------------------------------------------------------
| READ REQUEST
|--------------------------------------------------------------------------
*/

$raw =
    file_get_contents(
        'php://input'
    );

$input = [];

if (
    $raw !== false &&
    trim($raw) !== ''
) {

    $decoded =
        json_decode(
            $raw,
            true
        );

    if (
        is_array($decoded)
    ) {

        $input =
            $decoded;
    }
}


/*
|--------------------------------------------------------------------------
| WITHDRAWAL ID
|--------------------------------------------------------------------------
*/

$withdrawalIdRaw =
    adminWithdrawalString(
        $input['withdrawal_id']
        ?? $input['withdrawalId']
        ?? $input['id']
        ?? $input['_id']
        ?? ''
    );


$withdrawalId =
    adminWithdrawalObjectId(
        $withdrawalIdRaw
    );


if (
    !$withdrawalId
) {

    jsonResponse([

        'success' =>
            false,

        'message' =>
            'A valid withdrawal ID is required.'

    ], 400);
}


/*
|--------------------------------------------------------------------------
| ACTION
|--------------------------------------------------------------------------
*/

$action =
    strtolower(
        adminWithdrawalString(
            $input['action']
            ?? $input['status']
            ?? ''
        )
    );


/*
|--------------------------------------------------------------------------
| ACTION ALIASES
|--------------------------------------------------------------------------
*/

if (
    in_array(
        $action,
        [
            'approve',
            'approved',
            'accept',
            'confirm'
        ],
        true
    )
) {

    $action =
        'approve';

}

elseif (
    in_array(
        $action,
        [
            'reject',
            'rejected',
            'decline',
            'deny'
        ],
        true
    )
) {

    $action =
        'reject';
}

else {

    jsonResponse([

        'success' =>
            false,

        'message' =>
            'Invalid withdrawal action. Use approve or reject.'

    ], 400);
}


/*
|--------------------------------------------------------------------------
| FIND WITHDRAWAL
|--------------------------------------------------------------------------
*/

$withdrawal =
    $withdrawals->findOne([
        '_id' =>
            $withdrawalId
    ]);


if (
    !$withdrawal
) {

    jsonResponse([

        'success' =>
            false,

        'message' =>
            'Withdrawal request not found.'

    ], 404);
}


/*
|--------------------------------------------------------------------------
| CURRENT STATUS
|--------------------------------------------------------------------------
*/

$currentStatus =
    strtolower(
        adminWithdrawalString(
            $withdrawal['status']
            ?? 'pending'
        )
    );


$balanceDeducted =
    (bool)(
        $withdrawal[
            'balance_deducted'
        ]
        ?? false
    );


/*
|--------------------------------------------------------------------------
| ALREADY APPROVED
|--------------------------------------------------------------------------
*/

if (
    $currentStatus === 'approved'
) {

    jsonResponse([

        'success' =>
            true,

        'message' =>
            'This withdrawal has already been approved.',

        'withdrawal' => [

            'id' =>
                (string)$withdrawalId,

            'status' =>
                'approved',

            'balance_deducted' =>
                $balanceDeducted

        ]

    ]);
}


/*
|--------------------------------------------------------------------------
| ALREADY REJECTED
|--------------------------------------------------------------------------
*/

if (
    $currentStatus === 'rejected'
) {

    jsonResponse([

        'success' =>
            true,

        'message' =>
            'This withdrawal has already been rejected.',

        'withdrawal' => [

            'id' =>
                (string)$withdrawalId,

            'status' =>
                'rejected',

            'balance_deducted' =>
                $balanceDeducted

        ]

    ]);
}


/*
|--------------------------------------------------------------------------
| USER ID FROM WITHDRAWAL
|--------------------------------------------------------------------------
*/

$withdrawalUserId =
    adminWithdrawalObjectId(
        $withdrawal['user_id']
        ?? $withdrawal['userId']
        ?? null
    );


if (
    !$withdrawalUserId
) {

    /*
    |--------------------------------------------------------------------------
    | FALLBACK USING EMAIL
    |--------------------------------------------------------------------------
    */

    $withdrawalEmail =
        strtolower(
            adminWithdrawalString(
                $withdrawal['email']
                ?? ''
            )
        );


    if (
        $withdrawalEmail !== ''
    ) {

        $withdrawalUser =
            $users->findOne([
                'email' =>
                    $withdrawalEmail
            ]);

        if (
            $withdrawalUser &&
            isset(
                $withdrawalUser['_id']
            )
        ) {

            $withdrawalUserId =
                $withdrawalUser['_id'];
        }
    }
}


if (
    !$withdrawalUserId
) {

    jsonResponse([

        'success' =>
            false,

        'message' =>
            'The user associated with this withdrawal could not be found.'

    ], 400);
}


/*
|--------------------------------------------------------------------------
| FIND USER
|--------------------------------------------------------------------------
*/

$user =
    $users->findOne([
        '_id' =>
            $withdrawalUserId
    ]);


if (
    !$user
) {

    jsonResponse([

        'success' =>
            false,

        'message' =>
            'The withdrawal user account no longer exists.'

    ], 404);
}


/*
|--------------------------------------------------------------------------
| WITHDRAWAL AMOUNT
|--------------------------------------------------------------------------
*/

$amount =
    adminWithdrawalMoney(
        $withdrawal['amount']
        ?? $withdrawal[
            'requested_amount'
        ]
        ?? 0
    );


if (
    $amount <= 0
) {

    jsonResponse([

        'success' =>
            false,

        'message' =>
            'This withdrawal has an invalid amount.'

    ], 400);
}


/*
|--------------------------------------------------------------------------
| REJECT
|--------------------------------------------------------------------------
*/

if (
    $action === 'reject'
) {

    /*
    |--------------------------------------------------------------------------
    | SAFETY CHECK
    |--------------------------------------------------------------------------
    |
    | Never reject a withdrawal as a normal rejection if the wallet
    | has already been deducted.
    |
    */

    if (
        $balanceDeducted
    ) {

        jsonResponse([

            'success' =>
                false,

            'message' =>
                'This withdrawal cannot be rejected because the wallet has already been deducted. Please resolve it as an approved withdrawal.'

        ], 409);
    }


    try {

        $updateResult =
            $withdrawals->updateOne(

                [
                    '_id' =>
                        $withdrawalId,

                    'status' => [
                        '$in' => [
                            'pending',
                            'approval_processing'
                        ]
                    ],

                    'balance_deducted' =>
                        false
                ],

                [
                    '$set' => [

                        'status' =>
                            'rejected',

                        'admin_approved' =>
                            false,

                        'admin_rejected' =>
                            true,

                        'balance_reserved' =>
                            false,

                        'balance_deducted' =>
                            false,

                        'payout_status' =>
                            'not_paid',

                        'rejected_by' =>
                            $adminId,

                        'rejected_at' =>
                            nowUtc(),

                        'updated_at' =>
                            nowUtc()

                    ]
                ]
            );


        if (
            $updateResult->getMatchedCount()
            === 0
        ) {

            /*
            |--------------------------------------------------------------------------
            | Re-read to determine whether another admin processed it.
            |--------------------------------------------------------------------------
            */

            $latest =
                $withdrawals->findOne([
                    '_id' =>
                        $withdrawalId
                ]);


            if (
                $latest &&
                strtolower(
                    adminWithdrawalString(
                        $latest['status']
                        ?? ''
                    )
                ) === 'rejected'
            ) {

                jsonResponse([

                    'success' =>
                        true,

                    'message' =>
                        'Withdrawal has already been rejected.'

                ]);
            }


            jsonResponse([

                'success' =>
                    false,

                'message' =>
                    'This withdrawal could not be rejected because its status changed.'

            ], 409);
        }


        /*
        |--------------------------------------------------------------------------
        | TRANSACTION UPDATE
        |--------------------------------------------------------------------------
        */

        try {

            $transactions->updateMany(

                [
                    '$or' => [

                        [
                            'withdrawal_id' =>
                                $withdrawalId
                        ],

                        [
                            'withdrawal_id' =>
                                (string)
                                    $withdrawalId
                        ]

                    ]
                ],

                [
                    '$set' => [

                        'status' =>
                            'rejected',

                        'balance_deducted' =>
                            false,

                        'updated_at' =>
                            nowUtc()

                    ]
                ]
            );

        } catch (Throwable $e) {
            // Withdrawal remains authoritative.
        }


        /*
        |--------------------------------------------------------------------------
        | AUDIT
        |--------------------------------------------------------------------------
        */

        audit(

            'withdrawal_rejected',

            $adminId,

            [

                'withdrawal_id' =>
                    (string)
                        $withdrawalId,

                'user_id' =>
                    (string)
                        $withdrawalUserId,

                'amount' =>
                    $amount,

                'balance_deducted' =>
                    false

            ]

        );


        jsonResponse([

            'success' =>
                true,

            'message' =>
                'Withdrawal rejected successfully. The user wallet was not deducted.',

            'withdrawal' => [

                'id' =>
                    (string)
                        $withdrawalId,

                'status' =>
                    'rejected',

                'balance_deducted' =>
                    false

            ]

        ]);

    } catch (Throwable $e) {

        jsonResponse([

            'success' =>
                false,

            'message' =>
                'Unable to reject withdrawal.',

            'error' =>
                $e->getMessage()

        ], 500);
    }
}


/*
|--------------------------------------------------------------------------
| APPROVE
|--------------------------------------------------------------------------
*/

if (
    $action === 'approve'
) {

    /*
    |--------------------------------------------------------------------------
    | ALREADY DEDUCTED
    |--------------------------------------------------------------------------
    |
    | This supports recovery of an approval_processing record where
    | the wallet was already deducted successfully.
    |
    */

    if (
        $balanceDeducted
    ) {

        try {

            $finalize =
                $withdrawals->updateOne(

                    [
                        '_id' =>
                            $withdrawalId,

                        'balance_deducted' =>
                            true,

                        'status' => [
                            '$in' => [
                                'pending',
                                'approval_processing'
                            ]
                        ]
                    ],

                    [
                        '$set' => [

                            'status' =>
                                'approved',

                            'admin_approved' =>
                                true,

                            'admin_rejected' =>
                                false,

                            'payout_status' =>
                                'not_paid',

                            'approved_by' =>
                                $adminId,

                            'approved_at' =>
                                nowUtc(),

                            'updated_at' =>
                                nowUtc()

                        ]
                    ]
                );


            if (
                $finalize->getMatchedCount()
                === 0
            ) {

                $latest =
                    $withdrawals->findOne([
                        '_id' =>
                            $withdrawalId
                    ]);

                $latestStatus =
                    strtolower(
                        adminWithdrawalString(
                            $latest['status']
                            ?? ''
                        )
                    );


                if (
                    $latestStatus ===
                    'approved'
                ) {

                    jsonResponse([

                        'success' =>
                            true,

                        'message' =>
                            'Withdrawal is already approved.'

                    ]);
                }


                jsonResponse([

                    'success' =>
                        false,

                    'message' =>
                        'Withdrawal could not be finalized.'

                ], 409);
            }


            /*
            |--------------------------------------------------------------------------
            | TRANSACTION
            |--------------------------------------------------------------------------
            */

            try {

                $transactions->updateMany(

                    [
                        '$or' => [

                            [
                                'withdrawal_id' =>
                                    $withdrawalId
                            ],

                            [
                                'withdrawal_id' =>
                                    (string)
                                        $withdrawalId
                            ]

                        ]
                    ],

                    [
                        '$set' => [

                            'status' =>
                                'approved',

                            'balance_deducted' =>
                                true,

                            'updated_at' =>
                                nowUtc()

                        ]
                    ]
                );

            } catch (Throwable $e) {
                // Continue.
            }


            audit(

                'withdrawal_approved_recovered',

                $adminId,

                [

                    'withdrawal_id' =>
                        (string)
                            $withdrawalId,

                    'user_id' =>
                        (string)
                            $withdrawalUserId,

                    'amount' =>
                        $amount,

                    'balance_deducted' =>
                        true,

                    'recovered_from' =>
                        $currentStatus

                ]

            );


            jsonResponse([

                'success' =>
                    true,

                'message' =>
                    'Withdrawal approved successfully. The wallet deduction had already been completed.',

                'withdrawal' => [

                    'id' =>
                        (string)
                            $withdrawalId,

                    'status' =>
                        'approved',

                    'balance_deducted' =>
                        true

                ]

            ]);
            
        } catch (Throwable $e) {

            jsonResponse([

                'success' =>
                    false,

                'message' =>
                    'Unable to finalize the previously deducted withdrawal.',

                'error' =>
                    $e->getMessage()

            ], 500);
        }
    }


    /*
    |--------------------------------------------------------------------------
    | CLAIM PENDING WITHDRAWAL
    |--------------------------------------------------------------------------
    |
    | Change pending -> approval_processing first.
    |
    | This prevents two administrator requests from both deducting
    | the wallet at the same time.
    |
    */

    try {

        $claim =
            $withdrawals->updateOne(

                [
                    '_id' =>
                        $withdrawalId,

                    'status' =>
                        'pending',

                    'balance_deducted' =>
                        false
                ],

                [
                    '$set' => [

                        'status' =>
                            'approval_processing',

                        'processing_by' =>
                            $adminId,

                        'processing_at' =>
                            nowUtc(),

                        'updated_at' =>
                            nowUtc()

                    ]
                ]
            );


        if (
            $claim->getMatchedCount()
            === 0
        ) {

            $latest =
                $withdrawals->findOne([
                    '_id' =>
                        $withdrawalId
                ]);


            if (
                $latest
            ) {

                $latestStatus =
                    strtolower(
                        adminWithdrawalString(
                            $latest['status']
                            ?? ''
                        )
                    );


                if (
                    $latestStatus ===
                    'approved'
                ) {

                    jsonResponse([

                        'success' =>
                            true,

                        'message' =>
                            'Withdrawal is already approved.'

                    ]);
                }


                if (
                    $latestStatus ===
                    'rejected'
                ) {

                    jsonResponse([

                        'success' =>
                            false,

                        'message' =>
                            'This withdrawal has already been rejected.'

                    ], 409);
                }


                if (
                    $latestStatus ===
                    'approval_processing'
                ) {

                    /*
                    |--------------------------------------------------------------------------
                    | Recovery:
                    | If the record is approval_processing but balance_deducted
                    | is false, allow the current administrator to safely claim
                    | it again.
                    |--------------------------------------------------------------------------
                    */

                    $reclaim =
                        $withdrawals->updateOne(

                            [
                                '_id' =>
                                    $withdrawalId,

                                'status' =>
                                    'approval_processing',

                                'balance_deducted' =>
                                    false
                            ],

                            [
                                '$set' => [

                                    'processing_by' =>
                                        $adminId,

                                    'processing_at' =>
                                        nowUtc(),

                                    'updated_at' =>
                                        nowUtc()

                                ]
                            ]
                        );


                    if (
                        $reclaim->getMatchedCount()
                        === 0
                    ) {

                        jsonResponse([

                            'success' =>
                                false,

                            'message' =>
                                'This withdrawal is currently being processed by another administrator.'

                        ], 409);
                    }

                } else {

                    jsonResponse([

                        'success' =>
                            false,

                        'message' =>
                            'This withdrawal is no longer pending.'

                    ], 409);
                }

            } else {

                jsonResponse([

                    'success' =>
                        false,

                    'message' =>
                        'Withdrawal request no longer exists.'

                ], 404);
            }
        }

    } catch (Throwable $e) {

        jsonResponse([

            'success' =>
                false,

            'message' =>
                'Unable to start withdrawal approval.',

            'error' =>
                $e->getMessage()

        ], 500);
    }


    /*
    |--------------------------------------------------------------------------
    | REFRESH USER
    |--------------------------------------------------------------------------
    */

    $user =
        $users->findOne([
            '_id' =>
                $withdrawalUserId
        ]);


    if (
        !$user
    ) {

        /*
        |--------------------------------------------------------------------------
        | Return withdrawal to pending because no deduction occurred.
        |--------------------------------------------------------------------------
        */

        $withdrawals->updateOne(

            [
                '_id' =>
                    $withdrawalId,

                'balance_deducted' =>
                    false

            ],

            [
                '$set' => [

                    'status' =>
                        'pending',

                    'updated_at' =>
                        nowUtc()

                ],

                '$unset' => [

                    'processing_by' =>
                        '',

                    'processing_at' =>
                        ''

                ]
            ]
        );


        jsonResponse([

            'success' =>
                false,

            'message' =>
                'User account could not be found. Wallet was not deducted.'

        ], 404);
    }


    /*
    |--------------------------------------------------------------------------
    | CURRENT USER BALANCE
    |--------------------------------------------------------------------------
    */

    $userBalance =
        adminWithdrawalMoney(
            $user['balance']
            ?? $user['wallet_balance']
            ?? $user['walletBalance']
            ?? 0
        );


    /*
    |--------------------------------------------------------------------------
    | ATOMIC WALLET DEDUCTION
    |--------------------------------------------------------------------------
    |
    | CRITICAL:
    |
    | The update requires:
    |
    | balance >= amount
    |
    | Therefore the wallet cannot go below zero.
    |
    */

    try {

        $balanceUpdate =
            $users->updateOne(

                [
                    '_id' =>
                        $withdrawalUserId,

                    '$or' => [

                        [
                            'balance' => [
                                '$gte' =>
                                    $amount
                            ]
                        ],

                        [
                            'wallet_balance' => [
                                '$gte' =>
                                    $amount
                            ]
                        ]

                    ]
                ],

                [
                    '$inc' => [

                        /*
                        |--------------------------------------------------------------------------
                        | Crown Cash wallet field.
                        |--------------------------------------------------------------------------
                        */
                        'balance' =>
                            -$amount

                    ],

                    '$set' => [

                        'updated_at' =>
                            nowUtc()

                    ]
                ]

            );


        /*
        |--------------------------------------------------------------------------
        | IF BALANCE FIELD WAS NOT UPDATED
        |--------------------------------------------------------------------------
        |
        | Some older accounts may use wallet_balance instead of balance.
        |
        */

        if (
            $balanceUpdate->getModifiedCount()
            === 0
        ) {

            $walletBalanceUpdate =
                $users->updateOne(

                    [
                        '_id' =>
                            $withdrawalUserId,

                        'wallet_balance' => [
                            '$gte' =>
                                $amount
                        ]
                    ],

                    [
                        '$inc' => [

                            'wallet_balance' =>
                                -$amount

                        ],

                        '$set' => [

                            'updated_at' =>
                                nowUtc()

                        ]
                    ]
                );


            if (
                $walletBalanceUpdate
                    ->getModifiedCount()
                === 0
            ) {

                /*
                |--------------------------------------------------------------------------
                | Wallet insufficient.
                |
                | Return withdrawal to pending because no deduction occurred.
                |--------------------------------------------------------------------------
                */

                $withdrawals->updateOne(

                    [
                        '_id' =>
                            $withdrawalId,

                        'balance_deducted' =>
                            false
                    ],

                    [
                        '$set' => [

                            'status' =>
                                'pending',

                            'updated_at' =>
                                nowUtc()

                        ],

                        '$unset' => [

                            'processing_by' =>
                                '',

                            'processing_at' =>
                                ''

                        ]
                    ]
                );


                jsonResponse([

                    'success' =>
                        false,

                    'message' =>
                        'Insufficient user wallet balance. The wallet was not deducted.',

                    'current_balance' =>
                        $userBalance,

                    'required_amount' =>
                        $amount

                ], 400);
            }
        }

    } catch (Throwable $e) {

        /*
        |--------------------------------------------------------------------------
        | Return withdrawal to pending.
        |
        | We do not claim a deduction happened if the database operation
        | failed.
        |--------------------------------------------------------------------------
        */

        try {

            $withdrawals->updateOne(

                [
                    '_id' =>
                        $withdrawalId,

                    'balance_deducted' =>
                        false

                ],

                [
                    '$set' => [

                        'status' =>
                            'pending',

                        'updated_at' =>
                            nowUtc()

                    ],

                    '$unset' => [

                        'processing_by' =>
                            '',

                        'processing_at' =>
                            ''

                    ]
                ]
            );

        } catch (Throwable $rollbackError) {
            // Do not hide original error.
        }


        jsonResponse([

            'success' =>
                false,

            'message' =>
                'Wallet deduction failed. The withdrawal was not approved.',

            'error' =>
                $e->getMessage()

        ], 500);
    }


    /*
    |--------------------------------------------------------------------------
    | MARK WITHDRAWAL DEDUCTED
    |--------------------------------------------------------------------------
    */

    try {

        $withdrawalUpdate =
            $withdrawals->updateOne(

                [
                    '_id' =>
                        $withdrawalId,

                    'status' => [
                        '$in' => [
                            'approval_processing',
                            'pending'
                        ]
                    ],

                    'balance_deducted' =>
                        false

                ],

                [
                    '$set' => [

                        'status' =>
                            'approved',

                        'admin_approved' =>
                            true,

                        'admin_rejected' =>
                            false,

                        'balance_reserved' =>
                            false,

                        'balance_deducted' =>
                            true,

                        'payout_status' =>
                            'not_paid',

                        'approved_by' =>
                            $adminId,

                        'approved_at' =>
                            nowUtc(),

                        'updated_at' =>
                            nowUtc()

                    ],

                    '$unset' => [

                        'processing_by' =>
                            '',

                        'processing_at' =>
                            ''

                    ]
                ]
            );


        /*
        |--------------------------------------------------------------------------
        | IMPORTANT FAILURE CASE
        |--------------------------------------------------------------------------
        |
        | Wallet was deducted but withdrawal could not be marked approved.
        |
        | We immediately attempt a wallet rollback.
        |
        */

        if (
            $withdrawalUpdate->getMatchedCount()
            === 0
        ) {

            /*
            |--------------------------------------------------------------------------
            | Check whether another operation finalized it.
            |--------------------------------------------------------------------------
            */

            $latest =
                $withdrawals->findOne([
                    '_id' =>
                        $withdrawalId
                ]);


            $latestDeducted =
                $latest
                ? (bool)(
                    $latest[
                        'balance_deducted'
                    ]
                    ?? false
                )
                : false;


            $latestStatus =
                $latest
                ? strtolower(
                    adminWithdrawalString(
                        $latest['status']
                        ?? ''
                    )
                )
                : '';


            if (
                $latestDeducted &&
                $latestStatus ===
                'approved'
            ) {

                /*
                |--------------------------------------------------------------------------
                | Another request finalized it.
                | Do NOT refund.
                |--------------------------------------------------------------------------
                */

                jsonResponse([

                    'success' =>
                        true,

                    'message' =>
                        'Withdrawal approved successfully.',

                    'withdrawal' => [

                        'id' =>
                            (string)
                                $withdrawalId,

                        'status' =>
                            'approved',

                        'balance_deducted' =>
                            true

                    ]

                ]);
            }


            /*
            |--------------------------------------------------------------------------
            | No successful finalization.
            |
            | Refund the wallet because the withdrawal itself did not become
            | approved.
            |--------------------------------------------------------------------------
            */

            try {

                $users->updateOne(

                    [
                        '_id' =>
                            $withdrawalUserId
                    ],

                    [
                        '$inc' => [

                            'balance' =>
                                $amount

                        ],

                        '$set' => [

                            'updated_at' =>
                                nowUtc()

                        ]
                    ]
                );

            } catch (Throwable $refundError) {

                /*
                |--------------------------------------------------------------------------
                | Extremely important:
                |
                | Do not silently claim the refund succeeded.
                |--------------------------------------------------------------------------
                */

                jsonResponse([

                    'success' =>
                        false,

                    'message' =>
                        'The withdrawal status could not be finalized after the wallet was deducted. Manual administrator reconciliation is required.',

                    'critical' =>
                        true,

                    'withdrawal_id' =>
                        (string)
                            $withdrawalId,

                    'error' =>
                        $refundError->getMessage()

                ], 500);
            }


            /*
            |--------------------------------------------------------------------------
            | Return withdrawal to pending.
            |--------------------------------------------------------------------------
            */

            $withdrawals->updateOne(

                [
                    '_id' =>
                        $withdrawalId
                ],

                [
                    '$set' => [

                        'status' =>
                            'pending',

                        'balance_deducted' =>
                            false,

                        'admin_approved' =>
                            false,

                        'updated_at' =>
                            nowUtc()

                    ],

                    '$unset' => [

                        'processing_by' =>
                            '',

                        'processing_at' =>
                            ''

                    ]
                ]
            );


            jsonResponse([

                'success' =>
                    false,

                'message' =>
                    'Withdrawal approval could not be completed. The wallet deduction was reversed and the withdrawal remains pending.'

            ], 500);
        }

    } catch (Throwable $e) {

        /*
        |--------------------------------------------------------------------------
        | Attempt wallet refund.
        |--------------------------------------------------------------------------
        */

        try {

            $users->updateOne(

                [
                    '_id' =>
                        $withdrawalUserId
                ],

                [
                    '$inc' => [

                        'balance' =>
                            $amount

                    ],

                    '$set' => [

                        'updated_at' =>
                            nowUtc()

                    ]
                ]
            );

        } catch (Throwable $refundError) {

            jsonResponse([

                'success' =>
                    false,

                'critical' =>
                    true,

                'message' =>
                    'Withdrawal processing encountered a critical reconciliation error. Manual administrator reconciliation is required.',

                'withdrawal_id' =>
                    (string)
                        $withdrawalId

            ], 500);
        }


        $withdrawals->updateOne(

            [
                '_id' =>
                    $withdrawalId
            ],

            [
                '$set' => [

                    'status' =>
                        'pending',

                    'balance_deducted' =>
                        false,

                    'admin_approved' =>
                        false,

                    'updated_at' =>
                        nowUtc()

                ],

                '$unset' => [

                    'processing_by' =>
                        '',

                    'processing_at' =>
                        ''

                ]
            ]
        );


        jsonResponse([

            'success' =>
                false,

            'message' =>
                'Withdrawal approval failed. The wallet deduction was reversed and the withdrawal remains pending.',

            'error' =>
                $e->getMessage()

        ], 500);
    }


    /*
    |--------------------------------------------------------------------------
    | UPDATE TRANSACTION
    |--------------------------------------------------------------------------
    */

    try {

        $transactions->updateMany(

            [
                '$or' => [

                    [
                        'withdrawal_id' =>
                            $withdrawalId
                    ],

                    [
                        'withdrawal_id' =>
                            (string)
                                $withdrawalId
                    ]

                ]
            ],

            [
                '$set' => [

                    'status' =>
                        'approved',

                    'balance_deducted' =>
                        true,

                    'admin_approved' =>
                        true,

                    'approved_by' =>
                        $adminId,

                    'approved_at' =>
                        nowUtc(),

                    'updated_at' =>
                        nowUtc()

                ]
            ]
        );

    } catch (Throwable $e) {

        /*
        |--------------------------------------------------------------------------
        | Withdrawal remains authoritative.
        |--------------------------------------------------------------------------
        */
    }


    /*
    |--------------------------------------------------------------------------
    | AUDIT
    |--------------------------------------------------------------------------
    */

    audit(

        'withdrawal_approved',

        $adminId,

        [

            'withdrawal_id' =>
                (string)
                    $withdrawalId,

            'user_id' =>
                (string)
                    $withdrawalUserId,

            'amount' =>
                $amount,

            'balance_deducted' =>
                true,

            'status' =>
                'approved'

        ]

    );


    /*
    |--------------------------------------------------------------------------
    | GET UPDATED BALANCE
    |--------------------------------------------------------------------------
    */

    $updatedUser =
        $users->findOne([
            '_id' =>
                $withdrawalUserId
        ]);


    $updatedBalance =
        $updatedUser
        ? adminWithdrawalMoney(
            $updatedUser['balance']
            ?? $updatedUser[
                'wallet_balance'
            ]
            ?? $updatedUser[
                'walletBalance'
            ]
            ?? 0
        )
        : null;


    /*
    |--------------------------------------------------------------------------
    | SUCCESS
    |--------------------------------------------------------------------------
    */

    jsonResponse([

        'success' =>
            true,

        'message' =>
            'Withdrawal approved successfully. The user wallet has been deducted.',

        'withdrawal' => [

            'id' =>
                (string)
                    $withdrawalId,

            'amount' =>
                $amount,

            'status' =>
                'approved',

            'balance_deducted' =>
                true,

            'admin_approved' =>
                true,

            'payout_status' =>
                'not_paid'

        ],

        'user' => [

            'id' =>
                (string)
                    $withdrawalUserId,

            'balance' =>
                $updatedBalance

        ]

    ]);
}


/*
|--------------------------------------------------------------------------
| END
|--------------------------------------------------------------------------
*/