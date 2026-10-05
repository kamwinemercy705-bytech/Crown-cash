<?php

declare(strict_types=1);

/*
=========================================================
CROWN CASH - ADMIN WITHDRAWAL API
=========================================================

CANONICAL WITHDRAWAL FLOW

USER:
    Request withdrawal
        ↓
    PENDING
        ↓
    NO WALLET DEDUCTION

ADMIN:
    APPROVE
        ↓
    Atomic wallet deduction
        ↓
    APPROVED

OR

ADMIN:
    REJECT
        ↓
    REJECTED
        ↓
    Wallet unchanged

RECOVERY:

If a withdrawal was previously left in:

    approval_processing

the API checks:

    balance_deducted = true
        → NEVER deduct again
        → safely finalize as approved

    balance_deducted = false
        → continue approval safely

IMPORTANT:

- withdrawals is the canonical collection.
- transactions is only synchronized.
- No duplicate withdrawal rows.
- Wallet cannot go below zero.
- Wallet deduction happens only once.
- Existing approval_processing records can be recovered.
- Already approved records cannot be deducted again.
- Normal users receive 403.
- Admin role is verified from the database.
=========================================================
*/


/* =========================================================
   CONFIG
========================================================= */

require_once __DIR__ . '/config.php';

use MongoDB\BSON\ObjectId;
use MongoDB\BSON\UTCDateTime;
use MongoDB\BSON\Decimal128;


/* =========================================================
   CORS
========================================================= */

header(
    'Content-Type: application/json; charset=utf-8'
);

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
        'Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With'
    );

    header(
        'Access-Control-Allow-Methods: GET, POST, OPTIONS'
    );

    header(
        'Vary: Origin'
    );
}


/* =========================================================
   RESPONSE HELPER
========================================================= */

function adminWithdrawalResponse(
    bool $success,
    string $message = '',
    array $data = [],
    int $status = 200
): void {

    http_response_code($status);

    echo json_encode(
        array_merge(
            [
                'success' => $success,
                'message' => $message
            ],
            $data
        ),
        JSON_UNESCAPED_SLASHES
    );

    exit;
}


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
   METHOD
========================================================= */

$requestMethod =
    strtoupper(
        $_SERVER['REQUEST_METHOD'] ?? ''
    );

if (
    !in_array(
        $requestMethod,
        [
            'GET',
            'POST'
        ],
        true
    )
) {

    adminWithdrawalResponse(
        false,
        'Method not allowed.',
        [],
        405
    );
}


/* =========================================================
   SECURE SESSION
========================================================= */

try {

    if (
        function_exists(
            'startSecureSession'
        )
    ) {

        if (
            session_status()
            !==
            PHP_SESSION_ACTIVE
        ) {

            startSecureSession();
        }

    } else {

        if (
            session_status()
            !==
            PHP_SESSION_ACTIVE
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
        'Crown Cash admin withdrawal session error: ' .
        $e->getMessage()
    );

    adminWithdrawalResponse(
        false,
        'Unable to initialize secure session.',
        [],
        500
    );
}


/* =========================================================
   STRING HELPER
========================================================= */

function adminWithdrawalString(
    $value,
    string $default = ''
): string {

    if ($value === null) {

        return $default;
    }

    if (
        $value instanceof ObjectId
    ) {

        return (string)$value;
    }

    if (
        $value instanceof Decimal128
    ) {

        return $value->__toString();
    }

    if (
        $value instanceof MongoDB\BSON\Int64
    ) {

        return $value->__toString();
    }

    if (
        is_string($value)
    ) {

        return trim($value);
    }

    if (
        is_scalar($value)
    ) {

        return trim(
            (string)$value
        );
    }

    return $default;
}


/* =========================================================
   MONEY HELPER
========================================================= */

function adminWithdrawalMoney(
    $value
): float {

    if (
        $value instanceof Decimal128
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

    if (
        is_string($value)
    ) {

        $clean =
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

        if (
            is_numeric($clean)
        ) {

            return (float)$clean;
        }
    }

    return 0.0;
}


/* =========================================================
   BOOLEAN HELPER
========================================================= */

function adminWithdrawalBool(
    $value,
    bool $default = false
): bool {

    if (
        $value === null
    ) {

        return $default;
    }

    if (
        is_bool($value)
    ) {

        return $value;
    }

    if (
        is_numeric($value)
    ) {

        return ((int)$value) === 1;
    }

    if (
        is_string($value)
    ) {

        return in_array(
            strtolower(
                trim($value)
            ),
            [
                '1',
                'true',
                'yes',
                'on'
            ],
            true
        );
    }

    return $default;
}


/* =========================================================
   DATE HELPER
========================================================= */

function adminWithdrawalDate(
    $value
): ?string {

    try {

        if (
            $value instanceof UTCDateTime
        ) {

            return $value
                ->toDateTime()
                ->setTimezone(
                    new DateTimeZone('UTC')
                )
                ->format('c');
        }

        if (
            $value instanceof DateTimeInterface
        ) {

            return $value
                ->setTimezone(
                    new DateTimeZone('UTC')
                )
                ->format('c');
        }

        if (
            is_array($value)
            &&
            isset($value['$date'])
        ) {

            return adminWithdrawalDate(
                $value['$date']
            );
        }

        if (
            is_array($value)
            &&
            isset($value['date'])
        ) {

            return adminWithdrawalDate(
                $value['date']
            );
        }

        if (
            is_string($value)
            &&
            trim($value) !== ''
        ) {

            $date =
                new DateTime(
                    trim($value)
                );

            $date->setTimezone(
                new DateTimeZone('UTC')
            );

            return $date->format('c');
        }

    } catch (Throwable $e) {

        error_log(
            'Admin withdrawal date error: ' .
            $e->getMessage()
        );
    }

    return null;
}


/* =========================================================
   OBJECT ID HELPER
========================================================= */

function adminWithdrawalObjectId(
    $value
): ?ObjectId {

    if (
        $value instanceof ObjectId
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
        adminWithdrawalString(
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

        return new ObjectId(
            $value
        );

    } catch (Throwable $e) {

        return null;
    }
}


/* =========================================================
   GET WITHDRAWAL USER ID
========================================================= */

function getAdminWithdrawalUserId(
    $record
) {

    $fields = [

        'user_id',
        'userId',
        'userid',
        'userID',

        'account_id',
        'accountId',

        'customer_id',
        'customerId'
    ];


    foreach (
        $fields as $field
    ) {

        if (
            isset($record[$field])
        ) {

            return $record[$field];
        }
    }


    if (
        isset($record['user'])
    ) {

        if (
            $record['user']
            instanceof ObjectId
        ) {

            return $record['user'];
        }


        if (
            is_array(
                $record['user']
            )
        ) {

            return
                $record['user']['_id']
                ??
                $record['user']['id']
                ??
                $record['user']['user_id']
                ??
                $record['user']['userId']
                ??
                null;
        }
    }


    return null;
}


/* =========================================================
   FIND USER
========================================================= */

function findAdminWithdrawalUser(
    $userId
) {

    global $users;


    if (
        $userId === null
    ) {

        return null;
    }


    /*
    ObjectId lookup.
    */

    $objectId =
        adminWithdrawalObjectId(
            $userId
        );


    if (
        $objectId !== null
    ) {

        try {

            $user =
                $users->findOne([
                    '_id' =>
                        $objectId
                ]);

            if (
                $user !== null
            ) {

                return $user;
            }

        } catch (Throwable $e) {

            error_log(
                'Admin withdrawal ObjectId lookup error: ' .
                $e->getMessage()
            );
        }
    }


    /*
    String ID lookup.
    */

    $stringId =
        adminWithdrawalString(
            $userId
        );


    if (
        $stringId !== ''
    ) {

        $lookupFields = [

            'id',
            'user_id',
            'userId'
        ];


        foreach (
            $lookupFields as $field
        ) {

            try {

                $user =
                    $users->findOne([
                        $field =>
                            $stringId
                    ]);


                if (
                    $user !== null
                ) {

                    return $user;
                }

            } catch (Throwable $e) {

                error_log(
                    'Admin withdrawal string lookup error: ' .
                    $e->getMessage()
                );
            }
        }
    }


    return null;
}


/* =========================================================
   WALLET FIELD
========================================================= */

function getAdminWithdrawalWalletField(
    $user
): string {

    if (
        array_key_exists(
            'balance',
            $user
        )
    ) {

        return 'balance';
    }


    if (
        array_key_exists(
            'wallet_balance',
            $user
        )
    ) {

        return 'wallet_balance';
    }


    if (
        array_key_exists(
            'walletBalance',
            $user
        )
    ) {

        return 'walletBalance';
    }


    if (
        isset($user['wallet'])
        &&
        (
            is_array(
                $user['wallet']
            )
            ||
            $user['wallet']
                instanceof MongoDB\Model\BSONDocument
        )
    ) {

        return 'wallet.balance';
    }


    return 'balance';
}


/* =========================================================
   GET WALLET BALANCE
========================================================= */

function getAdminWithdrawalWalletBalance(
    $user
): float {

    if (
        !$user
    ) {

        return 0.0;
    }


    $field =
        getAdminWithdrawalWalletField(
            $user
        );


    if (
        $field === 'wallet.balance'
    ) {

        return adminWithdrawalMoney(
            $user['wallet']['balance']
            ??
            0
        );
    }


    return adminWithdrawalMoney(
        $user[$field]
        ??
        0
    );
}


/* =========================================================
   BUILD USER FILTER
========================================================= */

function buildAdminWithdrawalUserFilter(
    $user
): array {

    if (
        isset($user['_id'])
    ) {

        return [
            '_id' =>
                $user['_id']
        ];
    }


    if (
        isset($user['id'])
    ) {

        return [
            'id' =>
                $user['id']
        ];
    }


    if (
        isset($user['user_id'])
    ) {

        return [
            'user_id' =>
                $user['user_id']
        ];
    }


    if (
        isset($user['userId'])
    ) {

        return [
            'userId' =>
                $user['userId']
        ];
    }


    return [];
}


/* =========================================================
   ADMIN AUTHENTICATION
========================================================= */

function authenticateAdminWithdrawal(): array
{
    global $users;


    $loggedIn =
        (
            ($_SESSION['logged_in'] ?? false)
            === true

            ||

            ($_SESSION['logged_in'] ?? null)
            === 1

            ||

            ($_SESSION['logged_in'] ?? null)
            === '1'

            ||

            ($_SESSION['authenticated'] ?? false)
            === true
        );


    if (
        !$loggedIn
    ) {

        adminWithdrawalResponse(
            false,
            'Authentication required.',
            [
                'authenticated' => false,
                'authorized' => false
            ],
            401
        );
    }


    $sessionUserId =
        $_SESSION['user_id']
        ??
        $_SESSION['userId']
        ??
        $_SESSION['id']
        ??
        $_SESSION['_id']
        ??
        null;


    $sessionEmail =
        $_SESSION['email']
        ??
        $_SESSION['user_email']
        ??
        null;


    if (
        $sessionUserId === null
        &&
        $sessionEmail === null
    ) {

        adminWithdrawalResponse(
            false,
            'Authenticated session does not contain a valid user identity.',
            [
                'authenticated' => false,
                'authorized' => false
            ],
            401
        );
    }


    $user = null;


    /*
    USER ID.
    */

    if (
        $sessionUserId !== null
    ) {

        $objectId =
            adminWithdrawalObjectId(
                $sessionUserId
            );


        if (
            $objectId !== null
        ) {

            try {

                $user =
                    $users->findOne([
                        '_id' =>
                            $objectId
                    ]);

            } catch (Throwable $e) {

                $user = null;
            }
        }


        if (
            $user === null
        ) {

            try {

                $sessionIdString =
                    adminWithdrawalString(
                        $sessionUserId
                    );


                if (
                    $sessionIdString !== ''
                ) {

                    $user =
                        $users->findOne([
                            'id' =>
                                $sessionIdString
                        ]);
                }

            } catch (Throwable $e) {

                $user = null;
            }
        }
    }


    /*
    EMAIL FALLBACK.
    */

    if (
        $user === null
        &&
        $sessionEmail !== null
    ) {

        try {

            $user =
                $users->findOne([
                    'email' =>
                        strtolower(
                            trim(
                                (string)$sessionEmail
                            )
                        )
                ]);

        } catch (Throwable $e) {

            $user = null;
        }
    }


    if (
        $user === null
    ) {

        adminWithdrawalResponse(
            false,
            'Authenticated user could not be found.',
            [
                'authenticated' => true,
                'authorized' => false
            ],
            401
        );
    }


    /*
    ACCOUNT STATUS.
    */

    $status =
        strtolower(
            adminWithdrawalString(
                $user['status']
                ??
                'active'
            )
        );


    if (
        in_array(
            $status,
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

        adminWithdrawalResponse(
            false,
            'Administrator account is not active.',
            [
                'authenticated' => true,
                'authorized' => false
            ],
            403
        );
    }


    /*
    ADMIN ROLE.
    */

    $role =
        strtolower(
            adminWithdrawalString(
                $user['role']
                ??
                $user['user_role']
                ??
                ''
            )
        );


    $accountType =
        strtolower(
            adminWithdrawalString(
                $user['account_type']
                ??
                $user['accountType']
                ??
                ''
            )
        );


    $explicitAdmin =
        (
            ($user['is_admin'] ?? false)
            === true

            ||

            ($user['is_admin'] ?? null)
            === 1

            ||

            ($user['is_admin'] ?? null)
            === '1'
        );


    $adminRoles = [

        'admin',
        'administrator',
        'super_admin',
        'superadmin'
    ];


    $isAdmin =
        $explicitAdmin
        ||
        in_array(
            $role,
            $adminRoles,
            true
        )
        ||
        in_array(
            $accountType,
            $adminRoles,
            true
        );


    if (
        !$isAdmin
    ) {

        adminWithdrawalResponse(
            false,
            'Administrator access required.',
            [
                'authenticated' => true,
                'authorized' => false
            ],
            403
        );
    }


    /*
    OPTIONAL ENVIRONMENT RESTRICTION.
    */

    $currentId =
        isset($user['_id'])
            ? (string)$user['_id']
            : adminWithdrawalString(
                $user['id'] ?? ''
            );


    $currentEmail =
        strtolower(
            adminWithdrawalString(
                $user['email'] ?? ''
            )
        );


    $configuredAdminEmail =
        strtolower(
            trim(
                (string)(
                    getenv('ADMIN_EMAIL')
                    ?: ''
                )
            )
        );


    $configuredAdminId =
        trim(
            (string)(
                getenv('ADMIN_USER_ID')
                ?: ''
            )
        );


    if (
        $configuredAdminEmail !== ''
        ||
        $configuredAdminId !== ''
    ) {

        $idMatches =
            $configuredAdminId !== ''
            &&
            strtolower(
                $configuredAdminId
            )
            ===
            strtolower(
                $currentId
            );


        $emailMatches =
            $configuredAdminEmail !== ''
            &&
            $configuredAdminEmail
            ===
            $currentEmail;


        if (
            !$idMatches
            &&
            !$emailMatches
        ) {

            adminWithdrawalResponse(
                false,
                'This administrator account is not authorized for withdrawal management.',
                [
                    'authenticated' => true,
                    'authorized' => false
                ],
                403
            );
        }
    }


    /*
    Refresh session.
    */

    $_SESSION['logged_in'] =
        true;

    $_SESSION['authenticated'] =
        true;

    $_SESSION['user_id'] =
        $user['_id']
        ??
        $sessionUserId;

    $_SESSION['userId'] =
        $user['_id']
        ??
        $sessionUserId;

    $_SESSION['is_admin'] =
        true;


    return [

        'user' =>
            $user,

        'id' =>
            $currentId,

        'email' =>
            $currentEmail
    ];
}


/* =========================================================
   AUTHENTICATE ADMIN
========================================================= */

$admin =
    authenticateAdminWithdrawal();


/* =========================================================
   REQUIRED COLLECTIONS
========================================================= */

if (
    !isset($users)
    ||
    !isset($withdrawals)
    ||
    !isset($transactions)
) {

    adminWithdrawalResponse(
        false,
        'Required database collections are unavailable.',
        [],
        500
    );
}


/* =========================================================
   FIND CANONICAL WITHDRAWAL
========================================================= */

function findCanonicalWithdrawal(
    string $withdrawalId
): ?array {

    global $withdrawals;


    /*
    ObjectId.
    */

    $objectId =
        adminWithdrawalObjectId(
            $withdrawalId
        );


    if (
        $objectId !== null
    ) {

        try {

            $record =
                $withdrawals->findOne([
                    '_id' =>
                        $objectId
                ]);


            if (
                $record !== null
            ) {

                return [

                    'record' =>
                        $record,

                    'source' =>
                        'withdrawals'
                ];
            }

        } catch (Throwable $e) {

            error_log(
                'Canonical withdrawal lookup error: ' .
                $e->getMessage()
            );
        }
    }


    /*
    withdrawal_id.
    */

    try {

        $record =
            $withdrawals->findOne([
                'withdrawal_id' =>
                    $withdrawalId
            ]);


        if (
            $record !== null
        ) {

            return [

                'record' =>
                    $record,

                'source' =>
                    'withdrawals'
            ];
        }

    } catch (Throwable $e) {

        error_log(
            'Canonical withdrawal ID lookup error: ' .
            $e->getMessage()
        );
    }


    /*
    Reference.
    */

    try {

        $record =
            $withdrawals->findOne([
                'reference' =>
                    $withdrawalId
            ]);


        if (
            $record !== null
        ) {

            return [

                'record' =>
                    $record,

                'source' =>
                    'withdrawals'
            ];
        }

    } catch (Throwable $e) {

        error_log(
            'Canonical withdrawal reference lookup error: ' .
            $e->getMessage()
        );
    }


    return null;
}


/* =========================================================
   SYNCHRONIZE RELATED TRANSACTIONS
========================================================= */

function syncWithdrawalTransactions(
    $withdrawalRecordId,
    string $status,
    UTCDateTime $now,
    array $adminDetails
): void {

    global $transactions;


    if (
        $withdrawalRecordId === null
    ) {

        return;
    }


    try {

        $or = [

            [
                'withdrawal_id' =>
                    $withdrawalRecordId
            ],

            [
                'withdrawal_record_id' =>
                    $withdrawalRecordId
            ]
        ];


        $stringId =
            adminWithdrawalString(
                $withdrawalRecordId
            );


        if (
            $stringId !== ''
        ) {

            $or[] = [

                'withdrawal_id' =>
                    $stringId
            ];

            $or[] = [

                'withdrawal_record_id' =>
                    $stringId
            ];
        }


        $transactions->updateMany(
            [
                '$or' =>
                    $or
            ],
            [
                '$set' => [

                    'status' =>
                        $status,

                    'updated_at' =>
                        $now,

                    'processed_at' =>
                        $now,

                    'admin_id' =>
                        $adminDetails['admin_id'],

                    'admin_email' =>
                        $adminDetails['admin_email'],

                    'admin_name' =>
                        $adminDetails['admin_name'],

                    'admin_approved' =>
                        $status === 'approved',

                    'balance_deducted' =>
                        $status === 'approved'
                ]
            ]
        );

    } catch (Throwable $e) {

        error_log(
            'Withdrawal transaction synchronization error: ' .
            $e->getMessage()
        );
    }
}


/* =========================================================
   GET WITHDRAWALS
========================================================= */

if (
    $requestMethod === 'GET'
) {

    try {

        /*
        CANONICAL SOURCE ONLY.
        */

        $cursor =
            $withdrawals->find(
                [],
                [
                    'sort' => [
                        'created_at' => -1,
                        '_id' => -1
                    ],
                    'limit' => 500
                ]
            );


        $withdrawalList = [];

        $total = 0.0;
        $pending = 0.0;
        $processing = 0.0;
        $approved = 0.0;
        $rejected = 0.0;


        foreach (
            $cursor as $record
        ) {

            $mongoId =
                isset($record['_id'])
                    ? (string)$record['_id']
                    : '';


            $withdrawalId =
                adminWithdrawalString(
                    $record['withdrawal_id']
                    ??
                    ''
                );


            $reference =
                adminWithdrawalString(
                    $record['reference']
                    ??
                    ''
                );


            $displayId =
                $mongoId !== ''
                    ? $mongoId
                    : (
                        $withdrawalId !== ''
                            ? $withdrawalId
                            : $reference
                    );


            /* USER */

            $userId =
                getAdminWithdrawalUserId(
                    $record
                );


            $user =
                findAdminWithdrawalUser(
                    $userId
                );


            $name = '';
            $email = '';
            $phone = '';


            if (
                $user !== null
            ) {

                $name =
                    adminWithdrawalString(
                        $user['full_name']
                        ??
                        $user['fullName']
                        ??
                        $user['name']
                        ??
                        ''
                    );


                if (
                    $name === ''
                ) {

                    $name =
                        trim(
                            adminWithdrawalString(
                                $user['firstName']
                                ??
                                $user['first_name']
                                ??
                                ''
                            )
                            .
                            ' '
                            .
                            adminWithdrawalString(
                                $user['lastName']
                                ??
                                $user['last_name']
                                ??
                                ''
                            )
                        );
                }


                $email =
                    adminWithdrawalString(
                        $user['email']
                        ??
                        ''
                    );


                $phone =
                    adminWithdrawalString(
                        $user['phone']
                        ??
                        $user['phone_number']
                        ??
                        $user['mobile']
                        ??
                        ''
                    );
            }


            if (
                $name === ''
            ) {

                $name =
                    adminWithdrawalString(
                        $record['full_name']
                        ??
                        $record['fullName']
                        ??
                        $record['name']
                        ??
                        ''
                    );
            }


            if (
                $email === ''
            ) {

                $email =
                    adminWithdrawalString(
                        $record['email']
                        ??
                        ''
                    );
            }


            if (
                $phone === ''
            ) {

                $phone =
                    adminWithdrawalString(
                        $record['registered_phone']
                        ??
                        $record['phone']
                        ??
                        $record['phone_number']
                        ??
                        $record['mobile']
                        ??
                        ''
                    );
            }


            if (
                $name === ''
            ) {

                $name =
                    'Unknown user';
            }


            /* AMOUNT */

            $amount =
                adminWithdrawalMoney(
                    $record['amount']
                    ??
                    $record['requested_amount']
                    ??
                    $record['withdrawal_amount']
                    ??
                    0
                );


            /* STATUS */

            $status =
                strtolower(
                    adminWithdrawalString(
                        $record['status']
                        ??
                        'pending'
                    )
                );


            if (
                $status === ''
            ) {

                $status =
                    'pending';
            }


            /* METHOD */

            $method =
                adminWithdrawalString(
                    $record['payment_method']
                    ??
                    $record['method']
                    ??
                    $record['withdrawal_method']
                    ??
                    ''
                );


            /* ACCOUNT */

            $accountNumber =
                adminWithdrawalString(
                    $record['account_number']
                    ??
                    $record['accountNumber']
                    ??
                    $record['registered_phone']
                    ??
                    $record['phone']
                    ??
                    $phone
                );


            /* FEE */

            $fee =
                adminWithdrawalMoney(
                    $record['fee']
                    ??
                    0
                );


            /* PAYOUT */

            $payout =
                adminWithdrawalMoney(
                    $record['payout_amount']
                    ??
                    $record['net_amount']
                    ??
                    (
                        $amount -
                        $fee
                    )
                );


            /* DATES */

            $createdAt =
                adminWithdrawalDate(
                    $record['created_at']
                    ??
                    $record['createdAt']
                    ??
                    $record['created']
                    ??
                    $record['created_on']
                    ??
                    $record['date']
                    ??
                    $record['timestamp']
                    ??
                    null
                );


            $processedAt =
                adminWithdrawalDate(
                    $record['processed_at']
                    ??
                    $record['updated_at']
                    ??
                    null
                );


            /* FLAGS */

            $balanceReserved =
                adminWithdrawalBool(
                    $record['balance_reserved']
                    ??
                    false
                );


            $balanceDeducted =
                adminWithdrawalBool(
                    $record['balance_deducted']
                    ??
                    false
                );


            $adminApproved =
                adminWithdrawalBool(
                    $record['admin_approved']
                    ??
                    false
                );


            $payoutSent =
                adminWithdrawalBool(
                    $record['payout_sent']
                    ??
                    false
                );


            $phoneVerified =
                adminWithdrawalBool(
                    $record['phone_verified']
                    ??
                    false
                );


            /* TOTALS */

            $total +=
                $amount;


            if (
                $status === 'pending'
            ) {

                $pending +=
                    $amount;

            } elseif (
                $status === 'approval_processing'
            ) {

                $processing +=
                    $amount;

            } elseif (
                $status === 'approved'
                ||
                $status === 'completed'
            ) {

                $approved +=
                    $amount;

            } elseif (
                $status === 'rejected'
            ) {

                $rejected +=
                    $amount;
            }


            /* RESPONSE */

            $withdrawalList[] = [

                'id' =>
                    $displayId,

                '_id' =>
                    $displayId,

                'withdrawal_id' =>
                    $withdrawalId,

                'reference' =>
                    $reference,

                'user_id' =>
                    adminWithdrawalString(
                        $userId
                    ),

                'userId' =>
                    adminWithdrawalString(
                        $userId
                    ),

                'name' =>
                    $name,

                'full_name' =>
                    $name,

                'email' =>
                    $email,

                'phone' =>
                    $phone,

                'registered_phone' =>
                    adminWithdrawalString(
                        $record['registered_phone']
                        ??
                        $phone
                    ),

                'phone_verified' =>
                    $phoneVerified,

                'amount' =>
                    $amount,

                'requested_amount' =>
                    $amount,

                'fee' =>
                    $fee,

                'payout_amount' =>
                    $payout,

                'method' =>
                    $method,

                'payment_method' =>
                    $method,

                'account_number' =>
                    $accountNumber,

                'status' =>
                    $status,

                'balance_reserved' =>
                    $balanceReserved,

                'balance_deducted' =>
                    $balanceDeducted,

                'admin_approved' =>
                    $adminApproved,

                'payout_sent' =>
                    $payoutSent,

                'created_at' =>
                    $createdAt,

                'processed_at' =>
                    $processedAt,

                'admin_note' =>
                    adminWithdrawalString(
                        $record['admin_note']
                        ??
                        $record['rejection_reason']
                        ??
                        ''
                    ),

                'source' =>
                    'withdrawals'
            ];
        }


        adminWithdrawalResponse(
            true,
            'Withdrawals loaded successfully.',
            [

                'authenticated' =>
                    true,

                'authorized' =>
                    true,

                'admin' =>
                    true,

                'withdrawals' =>
                    $withdrawalList,

                'data' =>
                    $withdrawalList,

                'total' =>
                    count(
                        $withdrawalList
                    ),

                'count' =>
                    count(
                        $withdrawalList
                    ),

                'totals' => [

                    'withdrawals' =>
                        $total,

                    'total_withdrawals' =>
                        $total,

                    'pending' =>
                        $pending,

                    'pending_withdrawals' =>
                        $pending,

                    'processing' =>
                        $processing,

                    'approval_processing' =>
                        $processing,

                    'approved' =>
                        $approved,

                    'approved_withdrawals' =>
                        $approved,

                    'rejected' =>
                        $rejected,

                    'rejected_withdrawals' =>
                        $rejected
                ]
            ]
        );

    } catch (Throwable $e) {

        error_log(
            'Crown Cash admin withdrawal GET error: ' .
            $e->getMessage()
        );

        adminWithdrawalResponse(
            false,
            'Unable to load withdrawals.',
            [],
            500
        );
    }
}


/* =========================================================
   POST
========================================================= */

if (
    $requestMethod === 'POST'
) {

    try {

        $rawBody =
            file_get_contents(
                'php://input'
            );


        $input =
            json_decode(
                $rawBody ?: '{}',
                true
            );


        if (
            !is_array($input)
        ) {

            $input = [];
        }


        /* =================================================
           ID
        ================================================= */

        $withdrawalId =
            $input['withdrawalId']
            ??
            $input['withdrawal_id']
            ??
            $input['id']
            ??
            '';


        $withdrawalId =
            adminWithdrawalString(
                $withdrawalId
            );


        if (
            $withdrawalId === ''
        ) {

            adminWithdrawalResponse(
                false,
                'Withdrawal ID is required.',
                [],
                400
            );
        }


        /* =================================================
           ACTION
        ================================================= */

        $action =
            strtolower(
                adminWithdrawalString(
                    $input['action']
                    ??
                    $input['status']
                    ??
                    ''
                )
            );


        if (
            $action === 'approved'
        ) {

            $action =
                'approve';
        }


        if (
            $action === 'rejected'
        ) {

            $action =
                'reject';
        }


        if (
            !in_array(
                $action,
                [
                    'approve',
                    'reject'
                ],
                true
            )
        ) {

            adminWithdrawalResponse(
                false,
                'Invalid withdrawal action.',
                [],
                400
            );
        }


        /* =================================================
           FIND WITHDRAWAL
        ================================================= */

        $found =
            findCanonicalWithdrawal(
                $withdrawalId
            );


        if (
            $found === null
        ) {

            adminWithdrawalResponse(
                false,
                'Withdrawal request not found.',
                [],
                404
            );
        }


        $withdrawal =
            $found['record'];


        $withdrawalRecordId =
            $withdrawal['_id']
            ??
            null;


        if (
            $withdrawalRecordId === null
        ) {

            adminWithdrawalResponse(
                false,
                'Withdrawal record has no valid database ID.',
                [],
                500
            );
        }


        /* =================================================
           STATUS
        ================================================= */

        $currentStatus =
            strtolower(
                adminWithdrawalString(
                    $withdrawal['status']
                    ??
                    'pending'
                )
            );


        if (
            $currentStatus === ''
        ) {

            $currentStatus =
                'pending';
        }


        /* =================================================
           ALREADY APPROVED
        ================================================= */

        if (
            $currentStatus === 'approved'
            ||
            $currentStatus === 'completed'
        ) {

            /*
            IMPORTANT:

            Never deduct again.

            If the request is already approved and
            balance_deducted is true, return success.
            */

            if (
                $action === 'approve'
            ) {

                adminWithdrawalResponse(
                    true,
                    'Withdrawal is already approved. No additional wallet deduction was made.',
                    [

                        'already_processed' =>
                            true,

                        'withdrawal' => [

                            'id' =>
                                (string)$withdrawalRecordId,

                            'status' =>
                                $currentStatus,

                            'amount' =>
                                adminWithdrawalMoney(
                                    $withdrawal['amount']
                                    ??
                                    $withdrawal['requested_amount']
                                    ??
                                    0
                                ),

                            'balance_deducted' =>
                                adminWithdrawalBool(
                                    $withdrawal['balance_deducted']
                                    ??
                                    false
                                )
                        ]
                    ]
                );
            }


            adminWithdrawalResponse(
                false,
                'Approved withdrawals cannot be rejected.',
                [
                    'status' =>
                        $currentStatus
                ],
                409
            );
        }


        /* =================================================
           ALREADY REJECTED
        ================================================= */

        if (
            $currentStatus === 'rejected'
        ) {

            if (
                $action === 'reject'
            ) {

                adminWithdrawalResponse(
                    true,
                    'Withdrawal is already rejected. No wallet deduction was made.',
                    [
                        'already_processed' =>
                            true,

                        'withdrawal' => [

                            'id' =>
                                (string)$withdrawalRecordId,

                            'status' =>
                                'rejected',

                            'balance_deducted' =>
                                false
                        ]
                    ]
                );
            }


            adminWithdrawalResponse(
                false,
                'Rejected withdrawals cannot be approved.',
                [
                    'status' =>
                        'rejected'
                ],
                409
            );
        }


        /* =================================================
           USER
        ================================================= */

        $userId =
            getAdminWithdrawalUserId(
                $withdrawal
            );


        if (
            $userId === null
        ) {

            adminWithdrawalResponse(
                false,
                'Withdrawal is missing its user ID.',
                [],
                400
            );
        }


        $user =
            findAdminWithdrawalUser(
                $userId
            );


        if (
            $user === null
        ) {

            adminWithdrawalResponse(
                false,
                'The user associated with this withdrawal could not be found.',
                [],
                404
            );
        }


        /* =================================================
           AMOUNT
        ================================================= */

        $amount =
            adminWithdrawalMoney(
                $withdrawal['amount']
                ??
                $withdrawal['requested_amount']
                ??
                $withdrawal['withdrawal_amount']
                ??
                0
            );


        if (
            $amount <= 0
        ) {

            adminWithdrawalResponse(
                false,
                'Withdrawal amount is invalid.',
                [],
                400
            );
        }


        /* =================================================
           ADMIN DETAILS
        ================================================= */

        $adminUser =
            $admin['user'];


        $adminId =
            $admin['id']
            ??
            '';


        $adminEmail =
            adminWithdrawalString(
                $adminUser['email']
                ??
                ''
            );


        $adminName =
            adminWithdrawalString(
                $adminUser['full_name']
                ??
                $adminUser['fullName']
                ??
                $adminUser['name']
                ??
                ''
            );


        $now =
            new UTCDateTime();


        $adminDetails = [

            'admin_id' =>
                $adminId,

            'admin_email' =>
                $adminEmail,

            'admin_name' =>
                $adminName
        ];


        /* =================================================
           APPROVE
        ================================================= */

        if (
            $action === 'approve'
        ) {

            /*
            =================================================
            STEP 1 - CLAIM PENDING REQUEST
            =================================================

            A pending request is atomically moved to
            approval_processing.

            If it is already approval_processing, we
            recover it instead of rejecting it.
            */

            if (
                $currentStatus === 'pending'
            ) {

                $claimResult =
                    $withdrawals->updateOne(
                        [
                            '_id' =>
                                $withdrawalRecordId,

                            'status' =>
                                'pending'
                        ],
                        [
                            '$set' => [

                                'status' =>
                                    'approval_processing',

                                'updated_at' =>
                                    $now,

                                'processing_admin_id' =>
                                    $adminId,

                                'processing_admin_email' =>
                                    $adminEmail,

                                'processing_admin_name' =>
                                    $adminName
                            ]
                        ]
                    );


                if (
                    $claimResult->getMatchedCount()
                    !== 1
                ) {

                    /*
                    Reload because another admin may
                    have changed it.
                    */

                    $found =
                        findCanonicalWithdrawal(
                            $withdrawalId
                        );


                    if (
                        $found === null
                    ) {

                        adminWithdrawalResponse(
                            false,
                            'Withdrawal request could not be found.',
                            [],
                            404
                        );
                    }


                    $withdrawal =
                        $found['record'];


                    $currentStatus =
                        strtolower(
                            adminWithdrawalString(
                                $withdrawal['status']
                                ??
                                ''
                            )
                        );


                    if (
                        $currentStatus !==
                        'approval_processing'
                    ) {

                        adminWithdrawalResponse(
                            false,
                            'Withdrawal has already been processed.',
                            [
                                'status' =>
                                    $currentStatus
                            ],
                            409
                        );
                    }
                }

            } elseif (
                $currentStatus !==
                'approval_processing'
            ) {

                adminWithdrawalResponse(
                    false,
                    'Withdrawal cannot be approved from its current status.',
                    [
                        'status' =>
                            $currentStatus
                    ],
                    409
                );
            }


            /*
            =================================================
            STEP 2 - RELOAD CANONICAL RECORD
            =================================================
            */

            $found =
                findCanonicalWithdrawal(
                    $withdrawalId
                );


            if (
                $found === null
            ) {

                adminWithdrawalResponse(
                    false,
                    'Withdrawal could not be reloaded.',
                    [],
                    404
                );
            }


            $withdrawal =
                $found['record'];


            $withdrawalRecordId =
                $withdrawal['_id'];


            $currentStatus =
                strtolower(
                    adminWithdrawalString(
                        $withdrawal['status']
                        ??
                        ''
                    )
                );


            /*
            Must now be approval_processing.
            */

            if (
                $currentStatus !==
                'approval_processing'
            ) {

                adminWithdrawalResponse(
                    false,
                    'Withdrawal is no longer available for approval.',
                    [
                        'status' =>
                            $currentStatus
                    ],
                    409
                );
            }


            /*
            =================================================
            STEP 3 - CHECK WHETHER WALLET WAS ALREADY DEDUCTED
            =================================================
            */

            $balanceAlreadyDeducted =
                adminWithdrawalBool(
                    $withdrawal['balance_deducted']
                    ??
                    false
                );


            /*
            =================================================
            CASE A:
            WALLET ALREADY DEDUCTED
            =================================================
            */

            if (
                $balanceAlreadyDeducted
            ) {

                /*
                DO NOT DEDUCT AGAIN.

                This is specifically for requests that
                were interrupted after the wallet was
                deducted but before the withdrawal was
                finalized.
                */

                $finalizeResult =
                    $withdrawals->updateOne(
                        [
                            '_id' =>
                                $withdrawalRecordId,

                            'status' =>
                                'approval_processing',

                            'balance_deducted' =>
                                true
                        ],
                        [
                            '$set' => [

                                'status' =>
                                    'approved',

                                'admin_approved' =>
                                    true,

                                'balance_reserved' =>
                                    false,

                                'payout_status' =>
                                    'pending_payout',

                                'processed_at' =>
                                    $now,

                                'updated_at' =>
                                    $now,

                                'admin_id' =>
                                    $adminId,

                                'admin_email' =>
                                    $adminEmail,

                                'admin_name' =>
                                    $adminName,

                                'admin_action' =>
                                    'approved',

                                'recovered_from_processing' =>
                                    true
                            ]
                        ]
                    );


                if (
                    $finalizeResult->getMatchedCount()
                    !== 1
                ) {

                    adminWithdrawalResponse(
                        false,
                        'The withdrawal could not be finalized safely.',
                        [],
                        409
                    );
                }


                syncWithdrawalTransactions(
                    $withdrawalRecordId,
                    'approved',
                    $now,
                    $adminDetails
                );


                if (
                    isset($auditLogs)
                ) {

                    try {

                        $auditLogs->insertOne([

                            'user_id' =>
                                $user['_id']
                                ??
                                $user['id']
                                ??
                                null,

                            'action' =>
                                'withdrawal_approved_recovered',

                            'type' =>
                                'withdrawal',

                            'withdrawal_id' =>
                                $withdrawalRecordId,

                            'amount' =>
                                $amount,

                            'admin_id' =>
                                $adminId,

                            'admin_email' =>
                                $adminEmail,

                            'created_at' =>
                                $now
                        ]);

                    } catch (Throwable $auditError) {

                        error_log(
                            'Withdrawal recovery audit error: ' .
                            $auditError->getMessage()
                        );
                    }
                }


                $updatedUser =
                    findAdminWithdrawalUser(
                        $user['_id']
                        ??
                        $user['id']
                        ??
                        $userId
                    );


                $newBalance =
                    getAdminWithdrawalWalletBalance(
                        $updatedUser
                    );


                adminWithdrawalResponse(
                    true,
                    'Withdrawal recovered and approved. The wallet had already been deducted, so no second deduction was made.',
                    [

                        'recovered' =>
                            true,

                        'already_deducted' =>
                            true,

                        'withdrawal' => [

                            'id' =>
                                (string)$withdrawalRecordId,

                            'status' =>
                                'approved',

                            'amount' =>
                                $amount,

                            'balance_deducted' =>
                                true,

                            'new_balance' =>
                                $newBalance
                        ]
                    ]
                );
            }


            /*
            =================================================
            CASE B:
            WALLET HAS NOT BEEN DEDUCTED
            =================================================
            */

            $walletField =
                getAdminWithdrawalWalletField(
                    $user
                );


            $currentBalance =
                getAdminWithdrawalWalletBalance(
                    $user
                );


            /*
            Check current balance.
            */

            if (
                $currentBalance < $amount
            ) {

                /*
                Return to pending.

                Nothing was deducted.
                */

                $withdrawals->updateOne(
                    [
                        '_id' =>
                            $withdrawalRecordId,

                        'status' =>
                            'approval_processing',

                        'balance_deducted' =>
                            false
                    ],
                    [
                        '$set' => [

                            'status' =>
                                'pending',

                            'updated_at' =>
                                new UTCDateTime(),

                            'processing_admin_id' =>
                                null,

                            'processing_admin_email' =>
                                null,

                            'processing_admin_name' =>
                                null
                        ]
                    ]
                );


                adminWithdrawalResponse(
                    false,
                    'Withdrawal cannot be approved because the user wallet does not have sufficient funds. The withdrawal remains pending.',
                    [

                        'wallet_balance' =>
                            $currentBalance,

                        'withdrawal_amount' =>
                            $amount
                    ],
                    400
                );
            }


            /*
            =================================================
            STEP 4 - USER FILTER
            =================================================
            */

            $userFilter =
                buildAdminWithdrawalUserFilter(
                    $user
                );


            if (
                empty($userFilter)
            ) {

                $withdrawals->updateOne(
                    [
                        '_id' =>
                            $withdrawalRecordId,

                        'status' =>
                            'approval_processing'
                    ],
                    [
                        '$set' => [

                            'status' =>
                                'pending',

                            'updated_at' =>
                                new UTCDateTime(),

                            'processing_admin_id' =>
                                null,

                            'processing_admin_email' =>
                                null
                        ]
                    ]
                );


                adminWithdrawalResponse(
                    false,
                    'User account has no usable ID. The withdrawal remains pending.',
                    [],
                    400
                );
            }


            /*
            =================================================
            STEP 5 - ATOMIC WALLET DEDUCTION
            =================================================

            The query requires the wallet to still contain
            the full amount.

            Therefore the wallet cannot become negative.
            */

            $deductFilter =
                array_merge(
                    $userFilter,
                    [
                        $walletField =>
                            [
                                '$gte' =>
                                    $amount
                            ]
                    ]
                );


            $deductResult =
                $users->updateOne(
                    $deductFilter,
                    [
                        '$inc' => [

                            $walletField =>
                                -$amount
                        ]
                    ]
                );


            if (
                $deductResult->getMatchedCount()
                !== 1
                ||
                $deductResult->getModifiedCount()
                !== 1
            ) {

                /*
                Deduction failed.
                Return withdrawal to pending.
                */

                $withdrawals->updateOne(
                    [
                        '_id' =>
                            $withdrawalRecordId,

                        'status' =>
                            'approval_processing',

                        'balance_deducted' =>
                            false
                    ],
                    [
                        '$set' => [

                            'status' =>
                                'pending',

                            'updated_at' =>
                                new UTCDateTime(),

                            'processing_admin_id' =>
                                null,

                            'processing_admin_email' =>
                                null,

                            'processing_admin_name' =>
                                null
                        ]
                    ]
                );


                adminWithdrawalResponse(
                    false,
                    'Wallet deduction failed. The withdrawal remains pending.',
                    [],
                    409
                );
            }


            /*
            =================================================
            STEP 6 - RECORD DEDUCTION IMMEDIATELY
            =================================================

            This flag is critical for recovery.

            If PHP stops after this point, a later approval
            request sees balance_deducted=true and will NOT
            deduct again.
            */

            $deductionMarked =
                $withdrawals->updateOne(
                    [
                        '_id' =>
                            $withdrawalRecordId,

                        'status' =>
                            'approval_processing',

                        'balance_deducted' =>
                            false
                    ],
                    [
                        '$set' => [

                            'balance_deducted' =>
                                true,

                            'balance_reserved' =>
                                false,

                            'deducted_amount' =>
                                $amount,

                            'deducted_at' =>
                                $now,

                            'updated_at' =>
                                $now,

                            'deduction_admin_id' =>
                                $adminId,

                            'deduction_admin_email' =>
                                $adminEmail
                        ]
                    ]
                );


            /*
            If another process somehow changed the record
            before the flag was written, immediately inspect
            the record before doing anything else.
            */

            if (
                $deductionMarked->getMatchedCount()
                !== 1
            ) {

                $check =
                    findCanonicalWithdrawal(
                        $withdrawalId
                    );


                $checkRecord =
                    $check['record']
                    ??
                    null;


                $checkDeducted =
                    $checkRecord !== null
                    &&
                    adminWithdrawalBool(
                        $checkRecord['balance_deducted']
                        ??
                        false
                    );


                if (
                    !$checkDeducted
                ) {

                    /*
                    We cannot safely prove the deduction
                    state. Do not continue automatically.
                    */

                    try {

                        $users->updateOne(
                            $userFilter,
                            [
                                '$inc' => [

                                    $walletField =>
                                        $amount
                                ]
                            ]
                        );

                    } catch (Throwable $rollbackError) {

                        error_log(
                            'Withdrawal safety rollback error: ' .
                            $rollbackError->getMessage()
                        );
                    }


                    adminWithdrawalResponse(
                        false,
                        'Withdrawal approval stopped for safety because the wallet deduction state could not be confirmed.',
                        [],
                        409
                    );
                }
            }


            /*
            =================================================
            STEP 7 - FINALIZE APPROVAL
            =================================================
            */

            $finalResult =
                $withdrawals->updateOne(
                    [
                        '_id' =>
                            $withdrawalRecordId,

                        'status' =>
                            'approval_processing',

                        'balance_deducted' =>
                            true
                    ],
                    [
                        '$set' => [

                            'status' =>
                                'approved',

                            'admin_approved' =>
                                true,

                            'balance_reserved' =>
                                false,

                            'balance_deducted' =>
                                true,

                            'payout_status' =>
                                'pending_payout',

                            'processed_at' =>
                                $now,

                            'updated_at' =>
                                $now,

                            'admin_id' =>
                                $adminId,

                            'admin_email' =>
                                $adminEmail,

                            'admin_name' =>
                                $adminName,

                            'admin_action' =>
                                'approved'
                        ]
                    ]
                );


            /*
            =================================================
            STEP 8 - FINALIZATION FAILURE
            =================================================

            The wallet was already deducted.

            If finalization failed, restore the wallet and
            put the withdrawal back to pending.

            This prevents the user from losing money.
            */

            if (
                $finalResult->getMatchedCount()
                !== 1
            ) {

                try {

                    $users->updateOne(
                        $userFilter,
                        [
                            '$inc' => [

                                $walletField =>
                                    $amount
                            ]
                        ]
                    );

                } catch (Throwable $rollbackError) {

                    error_log(
                        'Withdrawal wallet rollback error: ' .
                        $rollbackError->getMessage()
                    );

                    /*
                    Do not hide this situation.
                    */

                    adminWithdrawalResponse(
                        false,
                        'Critical withdrawal recovery error. The wallet deduction could not be automatically reversed. Please do not process this withdrawal again until it is reviewed.',
                        [],
                        500
                    );
                }


                $withdrawals->updateOne(
                    [
                        '_id' =>
                            $withdrawalRecordId
                    ],
                    [
                        '$set' => [

                            'status' =>
                                'pending',

                            'balance_deducted' =>
                                false,

                            'admin_approved' =>
                                false,

                            'payout_status' =>
                                'not_paid',

                            'updated_at' =>
                                new UTCDateTime(),

                            'recovery_required' =>
                                false
                        ]
                    ]
                );


                adminWithdrawalResponse(
                    false,
                    'Withdrawal approval failed. The wallet deduction was reversed and the withdrawal remains pending.',
                    [],
                    500
                );
            }


            /*
            =================================================
            STEP 9 - TRANSACTION SYNC
            =================================================
            */

            syncWithdrawalTransactions(
                $withdrawalRecordId,
                'approved',
                $now,
                $adminDetails
            );


            /*
            =================================================
            STEP 10 - AUDIT
            =================================================
            */

            if (
                isset($auditLogs)
            ) {

                try {

                    $auditLogs->insertOne([

                        'user_id' =>
                            $user['_id']
                            ??
                            $user['id']
                            ??
                            null,

                        'action' =>
                            'withdrawal_approved',

                        'type' =>
                            'withdrawal',

                        'withdrawal_id' =>
                            $withdrawalRecordId,

                        'amount' =>
                            $amount,

                        'admin_id' =>
                            $adminId,

                        'admin_email' =>
                            $adminEmail,

                        'created_at' =>
                            $now
                    ]);

                } catch (Throwable $auditError) {

                    error_log(
                        'Withdrawal approval audit error: ' .
                        $auditError->getMessage()
                    );
                }
            }


            /*
            =================================================
            STEP 11 - NEW BALANCE
            =================================================
            */

            $updatedUser =
                findAdminWithdrawalUser(
                    $user['_id']
                    ??
                    $user['id']
                    ??
                    $userId
                );


            $newBalance =
                getAdminWithdrawalWalletBalance(
                    $updatedUser
                );


            adminWithdrawalResponse(
                true,
                'Withdrawal approved successfully. The wallet has been deducted once.',
                [

                    'authenticated' =>
                        true,

                    'authorized' =>
                        true,

                    'admin' =>
                        true,

                    'withdrawal' => [

                        'id' =>
                            (string)$withdrawalRecordId,

                        'withdrawal_id' =>
                            (string)$withdrawalRecordId,

                        'user_id' =>
                            adminWithdrawalString(
                                $userId
                            ),

                        'status' =>
                            'approved',

                        'amount' =>
                            $amount,

                        'balance_deducted' =>
                            true,

                        'new_balance' =>
                            $newBalance
                    ]
                ]
            );
        }


        /* =================================================
           REJECT
        ================================================= */

        if (
            $action === 'reject'
        ) {

            /*
            =================================================
            PENDING REJECTION
            =================================================
            */

            if (
                $currentStatus === 'pending'
            ) {

                $rejectResult =
                    $withdrawals->updateOne(
                        [
                            '_id' =>
                                $withdrawalRecordId,

                            'status' =>
                                'pending',

                            'balance_deducted' =>
                                false
                        ],
                        [
                            '$set' => [

                                'status' =>
                                    'rejected',

                                'admin_approved' =>
                                    false,

                                'balance_reserved' =>
                                    false,

                                'balance_deducted' =>
                                    false,

                                'payout_status' =>
                                    'not_paid',

                                'processed_at' =>
                                    $now,

                                'updated_at' =>
                                    $now,

                                'admin_id' =>
                                    $adminId,

                                'admin_email' =>
                                    $adminEmail,

                                'admin_name' =>
                                    $adminName,

                                'admin_action' =>
                                    'rejected'
                            ]
                        ]
                    );


                if (
                    $rejectResult->getMatchedCount()
                    !== 1
                ) {

                    adminWithdrawalResponse(
                        false,
                        'Withdrawal has already been processed.',
                        [],
                        409
                    );
                }


                syncWithdrawalTransactions(
                    $withdrawalRecordId,
                    'rejected',
                    $now,
                    $adminDetails
                );


                if (
                    isset($auditLogs)
                ) {

                    try {

                        $auditLogs->insertOne([

                            'user_id' =>
                                $user['_id']
                                ??
                                $user['id']
                                ??
                                null,

                            'action' =>
                                'withdrawal_rejected',

                            'type' =>
                                'withdrawal',

                            'withdrawal_id' =>
                                $withdrawalRecordId,

                            'amount' =>
                                $amount,

                            'admin_id' =>
                                $adminId,

                            'admin_email' =>
                                $adminEmail,

                            'created_at' =>
                                $now
                        ]);

                    } catch (Throwable $auditError) {

                        error_log(
                            'Withdrawal rejection audit error: ' .
                            $auditError->getMessage()
                        );
                    }
                }


                adminWithdrawalResponse(
                    true,
                    'Withdrawal rejected successfully. No wallet deduction was made.',
                    [

                        'withdrawal' => [

                            'id' =>
                                (string)$withdrawalRecordId,

                            'withdrawal_id' =>
                                (string)$withdrawalRecordId,

                            'user_id' =>
                                adminWithdrawalString(
                                    $userId
                                ),

                            'status' =>
                                'rejected',

                            'amount' =>
                                $amount,

                            'balance_deducted' =>
                                false
                        ]
                    ]
                );
            }


            /*
            =================================================
            APPROVAL_PROCESSING REJECTION
            =================================================

            We only reject it if the wallet has NOT been
            deducted.

            If balance_deducted=true, automatically rejecting
            would create a dangerous situation because the
            user's money has already been removed.

            Therefore it must be recovered through APPROVE
            instead, which finalizes it without another
            deduction.
            */

            if (
                $currentStatus ===
                'approval_processing'
            ) {

                $alreadyDeducted =
                    adminWithdrawalBool(
                        $withdrawal['balance_deducted']
                        ??
                        false
                    );


                if (
                    $alreadyDeducted
                ) {

                    adminWithdrawalResponse(
                        false,
                        'This withdrawal is currently processing and the wallet has already been deducted. Use APPROVE to safely finalize it. The wallet will not be deducted again.',
                        [

                            'status' =>
                                'approval_processing',

                            'balance_deducted' =>
                                true
                        ],
                        409
                    );
                }


                /*
                Safe rejection because no wallet deduction
                has happened.
                */

                $rejectProcessing =
                    $withdrawals->updateOne(
                        [
                            '_id' =>
                                $withdrawalRecordId,

                            'status' =>
                                'approval_processing',

                            'balance_deducted' =>
                                false
                        ],
                        [
                            '$set' => [

                                'status' =>
                                    'rejected',

                                'admin_approved' =>
                                    false,

                                'balance_reserved' =>
                                    false,

                                'balance_deducted' =>
                                    false,

                                'payout_status' =>
                                    'not_paid',

                                'processed_at' =>
                                    $now,

                                'updated_at' =>
                                    $now,

                                'admin_id' =>
                                    $adminId,

                                'admin_email' =>
                                    $adminEmail,

                                'admin_name' =>
                                    $adminName,

                                'admin_action' =>
                                    'rejected',

                                'rejected_from_processing' =>
                                    true
                            ]
                        ]
                    );


                if (
                    $rejectProcessing->getMatchedCount()
                    !== 1
                ) {

                    adminWithdrawalResponse(
                        false,
                        'Withdrawal has already been processed.',
                        [],
                        409
                    );
                }


                syncWithdrawalTransactions(
                    $withdrawalRecordId,
                    'rejected',
                    $now,
                    $adminDetails
                );


                if (
                    isset($auditLogs)
                ) {

                    try {

                        $auditLogs->insertOne([

                            'user_id' =>
                                $user['_id']
                                ??
                                $user['id']
                                ??
                                null,

                            'action' =>
                                'withdrawal_rejected_from_processing',

                            'type' =>
                                'withdrawal',

                            'withdrawal_id' =>
                                $withdrawalRecordId,

                            'amount' =>
                                $amount,

                            'admin_id' =>
                                $adminId,

                            'admin_email' =>
                                $adminEmail,

                            'created_at' =>
                                $now
                        ]);

                    } catch (Throwable $auditError) {

                        error_log(
                            'Withdrawal processing rejection audit error: ' .
                            $auditError->getMessage()
                        );
                    }
                }


                adminWithdrawalResponse(
                    true,
                    'Withdrawal rejected successfully. The wallet was not deducted.',
                    [

                        'withdrawal' => [

                            'id' =>
                                (string)$withdrawalRecordId,

                            'withdrawal_id' =>
                                (string)$withdrawalRecordId,

                            'user_id' =>
                                adminWithdrawalString(
                                    $userId
                                ),

                            'status' =>
                                'rejected',

                            'amount' =>
                                $amount,

                            'balance_deducted' =>
                                false
                        ]
                    ]
                );
            }


            adminWithdrawalResponse(
                false,
                'This withdrawal cannot be rejected from its current status.',
                [
                    'status' =>
                        $currentStatus
                ],
                409
            );
        }


        adminWithdrawalResponse(
            false,
            'Unsupported withdrawal action.',
            [],
            400
        );

    } catch (Throwable $e) {

        error_log(
            'Crown Cash admin_withdrawal.php POST error: ' .
            $e->getMessage()
        );

        adminWithdrawalResponse(
            false,
            'Unable to process withdrawal.',
            [],
            500
        );
    }
}