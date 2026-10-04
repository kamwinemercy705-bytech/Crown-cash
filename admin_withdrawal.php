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
    Pending
        ↓
    NO WALLET DEDUCTION

ADMIN:
    Approve
        ↓
    Atomic wallet deduction
        ↓
    Withdrawal approved
        ↓
    Related transaction synchronized

OR

ADMIN:
    Reject
        ↓
    Withdrawal rejected
        ↓
    Wallet unchanged

IMPORTANT:
- The withdrawals collection is the CANONICAL source.
- The transactions collection is NOT used to create duplicate
  withdrawal rows.
- Related transactions are updated only after the canonical
  withdrawal is processed.
- Approval can only happen once.
- Rejection can only happen once.
- Wallet can never become negative.
- Normal users receive 403.
- Admin authorization is verified from the database.
=========================================================
*/

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
   RESPONSE
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
    ($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS'
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
   SESSION
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
        'Unable to initialize session.',
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

    if (is_string($value)) {

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

    if ($value === null) {
        return $default;
    }

    if (is_bool($value)) {
        return $value;
    }

    if (is_numeric($value)) {
        return ((int)$value) === 1;
    }

    if (is_string($value)) {

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
   GET USER ID
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
                'Admin withdrawal user lookup error: ' .
                $e->getMessage()
            );
        }
    }

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
                    'Admin withdrawal user lookup error: ' .
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
   WALLET BALANCE
========================================================= */

function getAdminWithdrawalWalletBalance(
    $user
): float {

    if (!$user) {
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
            ?? 0
        );
    }

    return adminWithdrawalMoney(
        $user[$field]
        ?? 0
    );
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

    if (!$loggedIn) {

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

    /* -----------------------------------------------------
       USER ID
    ----------------------------------------------------- */

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


    /* -----------------------------------------------------
       EMAIL
    ----------------------------------------------------- */

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


    /* -----------------------------------------------------
       ACCOUNT STATUS
    ----------------------------------------------------- */

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


    /* -----------------------------------------------------
       ADMIN ROLE
    ----------------------------------------------------- */

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

    if (!$isAdmin) {

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


    /* -----------------------------------------------------
       OPTIONAL ENVIRONMENT RESTRICTION
    ----------------------------------------------------- */

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


    /* -----------------------------------------------------
       REFRESH SESSION
    ----------------------------------------------------- */

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
   AUTHENTICATE
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

    $objectId =
        adminWithdrawalObjectId(
            $withdrawalId
        );


    /* -----------------------------------------------------
       BY OBJECT ID
    ----------------------------------------------------- */

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


    /* -----------------------------------------------------
       BY WITHDRAWAL ID
    ----------------------------------------------------- */

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


    /* -----------------------------------------------------
       BY REFERENCE
    ----------------------------------------------------- */

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
   FIND RELATED TRANSACTIONS
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


        /*
        Also support string form of ObjectId.
        */

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
        CRITICAL FIX:

        Only read from the canonical withdrawals collection.

        We deliberately DO NOT merge transaction records here.
        This prevents duplicate withdrawal rows.
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
        $approved = 0.0;
        $rejected = 0.0;


        foreach (
            $cursor as $record
        ) {

            /* -------------------------------------------------
               ID
            ------------------------------------------------- */

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


            /* -------------------------------------------------
               USER
            ------------------------------------------------- */

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


            /* -------------------------------------------------
               AMOUNT
            ------------------------------------------------- */

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


            /* -------------------------------------------------
               STATUS
            ------------------------------------------------- */

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


            /* -------------------------------------------------
               METHOD
            ------------------------------------------------- */

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


            /* -------------------------------------------------
               ACCOUNT NUMBER
            ------------------------------------------------- */

            $accountNumber =
                adminWithdrawalString(
                    $record['account_number']
                    ??
                    $record['accountNumber']
                    ??
                    $record['phone']
                    ??
                    $phone
                );


            /* -------------------------------------------------
               FEE
            ------------------------------------------------- */

            $fee =
                adminWithdrawalMoney(
                    $record['fee']
                    ??
                    0
                );


            /* -------------------------------------------------
               PAYOUT
            ------------------------------------------------- */

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


            /* -------------------------------------------------
               DATES
            ------------------------------------------------- */

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


            /* -------------------------------------------------
               FLAGS
            ------------------------------------------------- */

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


            /* -------------------------------------------------
               TOTALS
            ------------------------------------------------- */

            $total +=
                $amount;


            if (
                $status === 'pending'
            ) {

                $pending +=
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


            /* -------------------------------------------------
               RESPONSE
            ------------------------------------------------- */

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


        /* =================================================
           RESPONSE
        ================================================= */

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
           WITHDRAWAL ID
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
           FIND CANONICAL WITHDRAWAL
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


        /* =================================================
           REAL WITHDRAWAL ID
        ================================================= */

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


        /*
        Only pending withdrawals may be processed.
        */

        if (
            $currentStatus !== 'pending'
        ) {

            adminWithdrawalResponse(
                false,
                'Withdrawal has already been processed.',
                [
                    'status' =>
                        $currentStatus,

                    'withdrawal_id' =>
                        (string)$withdrawalRecordId
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
            STEP 1:
            Atomically claim the withdrawal.

            Only one administrator can change pending
            to approval_processing.
            */

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
                                $adminEmail
                        ]
                    ]
                );


            if (
                $claimResult->getMatchedCount()
                !== 1
            ) {

                adminWithdrawalResponse(
                    false,
                    'Withdrawal has already been processed or is being processed by another administrator.',
                    [],
                    409
                );
            }


            /*
            STEP 2:
            Find wallet field.
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
            STEP 3:
            Check available balance.
            */

            if (
                $currentBalance < $amount
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
                    'Withdrawal cannot be approved because the user wallet does not have sufficient funds.',
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
            STEP 4:
            Build user identity filter.
            */

            $userFilter = [];

            if (
                isset($user['_id'])
            ) {

                $userFilter['_id'] =
                    $user['_id'];

            } elseif (
                isset($user['id'])
            ) {

                $userFilter['id'] =
                    $user['id'];

            } else {

                /*
                Restore withdrawal to pending.
                */

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
                                new UTCDateTime()
                        ]
                    ]
                );

                throw new RuntimeException(
                    'User account has no usable ID.'
                );
            }


            /*
            STEP 5:
            Atomic wallet deduction.

            The wallet must still have at least the
            withdrawal amount at the exact moment of update.
            */

            $deductResult =
                $users->updateOne(
                    array_merge(
                        $userFilter,
                        [
                            $walletField =>
                                [
                                    '$gte' =>
                                        $amount
                                ]
                        ]
                    ),
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
                Wallet deduction failed.
                Restore withdrawal to pending.
                */

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
                                new UTCDateTime()
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
            STEP 6:
            Finalize canonical withdrawal.

            Only approval_processing can become approved.
            */

            $finalResult =
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
            STEP 7:
            If finalization fails, restore wallet.
            */

            if (
                $finalResult->getMatchedCount()
                !== 1
            ) {

                $users->updateOne(
                    $userFilter,
                    [
                        '$inc' => [

                            $walletField =>
                                $amount
                        ]
                    ]
                );


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

                            'updated_at' =>
                                new UTCDateTime()
                        ]
                    ]
                );


                adminWithdrawalResponse(
                    false,
                    'Withdrawal approval failed. The wallet deduction was reversed.',
                    [],
                    500
                );
            }


            /*
            STEP 8:
            Synchronize related transaction history.

            This does NOT create another withdrawal.
            */

            syncWithdrawalTransactions(
                $withdrawalRecordId,
                'approved',
                $now,
                $adminDetails
            );


            /*
            STEP 9:
            Audit.
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
            STEP 10:
            Get new wallet balance.
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
            Atomically change pending → rejected.

            If another admin has already processed it,
            this update will affect zero documents.
            */

            $rejectResult =
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


            /*
            Synchronize related transaction history.
            */

            syncWithdrawalTransactions(
                $withdrawalRecordId,
                'rejected',
                $now,
                $adminDetails
            );


            /*
            Audit.
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