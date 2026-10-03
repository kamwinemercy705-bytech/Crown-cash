<?php

/*
|--------------------------------------------------------------------------
| CROWN CASH - ADMIN WITHDRAWAL API
|--------------------------------------------------------------------------
| File: admin_withdrawal.php
|
| SECURITY:
| - Requires Crown Cash authenticated session.
| - Requires database user to have admin role/account type.
| - ADMIN_EMAIL / ADMIN_USER_ID can restrict which admin is allowed.
| - They NEVER grant admin privileges to normal users.
|
| ACCOUNTING:
| - Withdrawal amount is reserved/deducted when created.
| - Approval does NOT deduct again.
| - Rejection restores funds only when balance_reserved=true.
| - A withdrawal cannot be processed twice.
|--------------------------------------------------------------------------
*/

declare(strict_types=1);


/*
|--------------------------------------------------------------------------
| CONFIG
|--------------------------------------------------------------------------
*/

try {

    require_once __DIR__ . '/config.php';

} catch (Throwable $e) {

    header('Content-Type: application/json; charset=utf-8');

    http_response_code(500);

    echo json_encode([
        'success' => false,
        'message' => 'Server configuration could not be loaded.'
    ]);

    exit;
}


/*
|--------------------------------------------------------------------------
| HEADERS
|--------------------------------------------------------------------------
*/

header('Content-Type: application/json; charset=utf-8');

$allowedOrigins = [
    'https://crown-cash.vercel.app',
    'https://www.crown-cash.vercel.app'
];

$requestOrigin = $_SERVER['HTTP_ORIGIN'] ?? '';

if (
    $requestOrigin !== '' &&
    in_array($requestOrigin, $allowedOrigins, true)
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

    header('Vary: Origin');
}


/*
|--------------------------------------------------------------------------
| OPTIONS
|--------------------------------------------------------------------------
*/

if (
    ($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS'
) {

    http_response_code(204);

    exit;
}


use MongoDB\BSON\ObjectId;
use MongoDB\BSON\UTCDateTime;
use MongoDB\BSON\Decimal128;


/*
|--------------------------------------------------------------------------
| RESPONSE
|--------------------------------------------------------------------------
*/

function withdrawalResponse(
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


/*
|--------------------------------------------------------------------------
| METHOD
|--------------------------------------------------------------------------
*/

$requestMethod =
    strtoupper(
        $_SERVER['REQUEST_METHOD'] ?? ''
    );

if (
    !in_array(
        $requestMethod,
        ['GET', 'POST'],
        true
    )
) {

    withdrawalResponse(
        false,
        'Method not allowed.',
        [],
        405
    );
}


/*
|--------------------------------------------------------------------------
| SESSION
|--------------------------------------------------------------------------
*/

try {

    if (
        function_exists('startSecureSession') &&
        session_status() !== PHP_SESSION_ACTIVE
    ) {

        startSecureSession();

    } elseif (
        session_status() !== PHP_SESSION_ACTIVE
    ) {

        session_name('CROWN_CASH_SESSION');

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

} catch (Throwable $e) {

    withdrawalResponse(
        false,
        'Unable to initialize session.',
        [],
        500
    );
}


/*
|--------------------------------------------------------------------------
| STRING
|--------------------------------------------------------------------------
*/

function withdrawalString(
    $value,
    string $default = ''
): string {

    if ($value === null) {
        return $default;
    }

    if ($value instanceof ObjectId) {
        return (string)$value;
    }

    if ($value instanceof Decimal128) {
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


/*
|--------------------------------------------------------------------------
| VALUE CHECK
|--------------------------------------------------------------------------
*/

function withdrawalHasValue($value): bool
{
    if ($value instanceof ObjectId) {
        return true;
    }

    return withdrawalString($value) !== '';
}


/*
|--------------------------------------------------------------------------
| MONEY
|--------------------------------------------------------------------------
*/

function withdrawalMoney($value): float
{
    if ($value instanceof Decimal128) {
        return (float)$value->__toString();
    }

    if (
        is_int($value) ||
        is_float($value)
    ) {

        return (float)$value;
    }

    if (is_numeric($value)) {
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

        if (is_numeric($clean)) {
            return (float)$clean;
        }
    }

    return 0.0;
}


/*
|--------------------------------------------------------------------------
| BOOLEAN
|--------------------------------------------------------------------------
*/

function withdrawalBool(
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
            strtolower(trim($value)),
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


/*
|--------------------------------------------------------------------------
| DATE
|--------------------------------------------------------------------------
*/

function withdrawalDate($value): ?string
{
    try {

        if ($value instanceof UTCDateTime) {

            return $value
                ->toDateTime()
                ->setTimezone(
                    new DateTimeZone('UTC')
                )
                ->format('c');
        }

        if ($value instanceof DateTimeInterface) {

            return $value
                ->setTimezone(
                    new DateTimeZone('UTC')
                )
                ->format('c');
        }

        if (
            is_string($value) &&
            trim($value) !== ''
        ) {

            $date =
                new DateTime($value);

            $date->setTimezone(
                new DateTimeZone('UTC')
            );

            return $date->format('c');
        }

    } catch (Throwable $e) {

        error_log(
            'Crown Cash withdrawal date error: ' .
            $e->getMessage()
        );
    }

    return null;
}


/*
|--------------------------------------------------------------------------
| OBJECT ID
|--------------------------------------------------------------------------
*/

function withdrawalObjectId($value): ?ObjectId
{
    if ($value instanceof ObjectId) {
        return $value;
    }

    $value =
        withdrawalString($value);

    if (
        $value !== '' &&
        preg_match(
            '/^[a-fA-F0-9]{24}$/',
            $value
        )
    ) {

        try {

            return new ObjectId($value);

        } catch (Throwable $e) {

            return null;
        }
    }

    return null;
}


/*
|--------------------------------------------------------------------------
| WITHDRAWAL USER ID
|--------------------------------------------------------------------------
*/

function getWithdrawalUserId($withdrawal)
{
    $fields = [
        'user_id',
        'userId',
        'userid',
        'userID',
        'user'
    ];

    foreach ($fields as $field) {

        if (
            array_key_exists(
                $field,
                $withdrawal
            ) &&
            $withdrawal[$field] !== null
        ) {

            $value =
                $withdrawal[$field];

            if ($value instanceof ObjectId) {
                return $value;
            }

            if (
                is_string($value) &&
                trim($value) !== ''
            ) {

                return trim($value);
            }

            if (is_scalar($value)) {
                return (string)$value;
            }
        }
    }

    return null;
}


/*
|--------------------------------------------------------------------------
| POST USER ID
|--------------------------------------------------------------------------
*/

function getPostedUserId(array $input)
{
    foreach (
        [
            'user_id',
            'userId',
            'userid',
            'userID'
        ] as $field
    ) {

        if (
            array_key_exists(
                $field,
                $input
            ) &&
            $input[$field] !== null
        ) {

            $value =
                $input[$field];

            if ($value instanceof ObjectId) {
                return $value;
            }

            if (
                is_string($value) &&
                trim($value) !== ''
            ) {

                return trim($value);
            }

            if (is_scalar($value)) {
                return (string)$value;
            }
        }
    }

    return null;
}


/*
|--------------------------------------------------------------------------
| WITHDRAWAL ID FILTER
|--------------------------------------------------------------------------
*/

function withdrawalIdFilter(
    $value
): ?array {

    $value =
        withdrawalString($value);

    if ($value === '') {
        return null;
    }

    $objectId =
        withdrawalObjectId($value);

    if ($objectId !== null) {

        return [
            '$or' => [
                [
                    '_id' => $objectId
                ],
                [
                    'reference' => $value
                ],
                [
                    'transaction_id' => $value
                ]
            ]
        ];
    }

    return [
        '$or' => [
            [
                'reference' => $value
            ],
            [
                'transaction_id' => $value
            ]
        ]
    ];
}


/*
|--------------------------------------------------------------------------
| FIND USER
|--------------------------------------------------------------------------
*/

function findWithdrawalUser($userId)
{
    global $users;

    if ($userId === null) {
        return null;
    }

    $userString =
        withdrawalString($userId);

    if ($userString === '') {
        return null;
    }

    $objectId =
        withdrawalObjectId($userId);

    if ($objectId !== null) {

        try {

            $user =
                $users->findOne([
                    '_id' => $objectId
                ]);

            if ($user !== null) {
                return $user;
            }

        } catch (Throwable $e) {}
    }

    try {

        $user =
            $users->findOne([
                'id' => $userString
            ]);

        if ($user !== null) {
            return $user;
        }

    } catch (Throwable $e) {}

    if (
        filter_var(
            $userString,
            FILTER_VALIDATE_EMAIL
        )
    ) {

        try {

            $user =
                $users->findOne([
                    'email' =>
                        strtolower(
                            $userString
                        )
                ]);

            if ($user !== null) {
                return $user;
            }

        } catch (Throwable $e) {}
    }

    return null;
}


/*
|--------------------------------------------------------------------------
| WALLET FIELD
|--------------------------------------------------------------------------
*/

function getWalletField($user): array
{
    if (
        array_key_exists(
            'balance',
            $user
        )
    ) {

        return [
            'type' => 'top_level',
            'field' => 'balance'
        ];
    }

    if (
        array_key_exists(
            'wallet_balance',
            $user
        )
    ) {

        return [
            'type' => 'top_level',
            'field' => 'wallet_balance'
        ];
    }

    if (
        array_key_exists(
            'walletBalance',
            $user
        )
    ) {

        return [
            'type' => 'top_level',
            'field' => 'walletBalance'
        ];
    }

    if (
        isset($user['wallet']) &&
        (
            is_array($user['wallet']) ||
            $user['wallet']
                instanceof \MongoDB\Model\BSONDocument
        )
    ) {

        return [
            'type' => 'nested',
            'field' => 'wallet.balance'
        ];
    }

    return [
        'type' => 'top_level',
        'field' => 'balance'
    ];
}


/*
|--------------------------------------------------------------------------
| WALLET BALANCE
|--------------------------------------------------------------------------
*/

function getUserWalletBalance($user): float
{
    if (!$user) {
        return 0.0;
    }

    $wallet =
        getWalletField($user);

    if (
        $wallet['type'] === 'nested'
    ) {

        return withdrawalMoney(
            $user['wallet']['balance'] ?? 0
        );
    }

    return withdrawalMoney(
        $user[$wallet['field']] ?? 0
    );
}


/*
|--------------------------------------------------------------------------
| INCREMENT WALLET
|--------------------------------------------------------------------------
*/

function incrementUserWalletBalance(
    $user,
    float $amount
): bool {

    global $users;

    if (!$user) {
        return false;
    }

    $wallet =
        getWalletField($user);

    if (isset($user['_id'])) {

        $userFilter = [
            '_id' => $user['_id']
        ];

    } elseif (isset($user['id'])) {

        $userFilter = [
            'id' => $user['id']
        ];

    } else {

        return false;
    }

    $field =
        $wallet['type'] === 'nested'
            ? 'wallet.balance'
            : $wallet['field'];

    try {

        $result =
            $users->updateOne(
                $userFilter,
                [
                    '$inc' => [
                        $field => $amount
                    ]
                ]
            );

        return
            $result->getMatchedCount() > 0;

    } catch (Throwable $e) {

        error_log(
            'Crown Cash wallet increment error: ' .
            $e->getMessage()
        );

        return false;
    }
}


/*
|--------------------------------------------------------------------------
| ADMIN AUTHENTICATION
|--------------------------------------------------------------------------
*/

function authenticateWithdrawalAdmin(): array
{
    global $users;

    /*
    |--------------------------------------------------------------------------
    | FIRST: REQUIRE LOGIN
    |--------------------------------------------------------------------------
    */

    $loggedIn =
        isset($_SESSION['logged_in']) &&
        (
            $_SESSION['logged_in'] === true ||
            $_SESSION['logged_in'] === 1 ||
            $_SESSION['logged_in'] === '1'
        );

    if (!$loggedIn) {

        withdrawalResponse(
            false,
            'Authentication required.',
            [
                'authenticated' => false,
                'authorized' => false
            ],
            401
        );
    }


    /*
    |--------------------------------------------------------------------------
    | SESSION IDENTITY
    |--------------------------------------------------------------------------
    */

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
        $sessionUserId === null &&
        $sessionEmail === null
    ) {

        withdrawalResponse(
            false,
            'Authenticated session does not contain a valid user identity.',
            [
                'authenticated' => false,
                'authorized' => false
            ],
            401
        );
    }


    /*
    |--------------------------------------------------------------------------
    | FIND USER
    |--------------------------------------------------------------------------
    */

    $user = null;

    if ($sessionUserId !== null) {

        $objectId =
            withdrawalObjectId(
                $sessionUserId
            );

        if ($objectId !== null) {

            try {

                $user =
                    $users->findOne([
                        '_id' => $objectId
                    ]);

            } catch (Throwable $e) {

                $user = null;
            }
        }

        if ($user === null) {

            try {

                $user =
                    $users->findOne([
                        'id' =>
                            withdrawalString(
                                $sessionUserId
                            )
                    ]);

            } catch (Throwable $e) {

                $user = null;
            }
        }
    }


    /*
    |--------------------------------------------------------------------------
    | EMAIL FALLBACK
    |--------------------------------------------------------------------------
    */

    if (
        $user === null &&
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


    /*
    |--------------------------------------------------------------------------
    | USER NOT FOUND
    |--------------------------------------------------------------------------
    */

    if ($user === null) {

        withdrawalResponse(
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
    |--------------------------------------------------------------------------
    | ACCOUNT STATUS
    |--------------------------------------------------------------------------
    */

    $status =
        strtolower(
            withdrawalString(
                $user['status'] ?? 'active'
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

        withdrawalResponse(
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
    |--------------------------------------------------------------------------
    | ADMIN ROLE
    |--------------------------------------------------------------------------
    |
    | This is the actual authorization gate.
    |
    | A normal user MUST NOT pass this check.
    |--------------------------------------------------------------------------
    */

    $role =
        strtolower(
            withdrawalString(
                $user['role']
                ??
                $user['user_role']
                ??
                ''
            )
        );

    $accountType =
        strtolower(
            withdrawalString(
                $user['account_type']
                ??
                $user['accountType']
                ??
                ''
            )
        );

    $explicitAdmin =
        isset($user['is_admin']) &&
        (
            $user['is_admin'] === true ||
            $user['is_admin'] === 1 ||
            $user['is_admin'] === '1'
        );

    $isAdmin =
        in_array(
            $role,
            [
                'admin',
                'administrator'
            ],
            true
        )
        ||
        in_array(
            $accountType,
            [
                'admin',
                'administrator'
            ],
            true
        )
        ||
        $explicitAdmin;


    if (!$isAdmin) {

        withdrawalResponse(
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
    |--------------------------------------------------------------------------
    | ADMIN ID / EMAIL
    |--------------------------------------------------------------------------
    */

    $currentId = '';

    if (isset($user['_id'])) {
        $currentId =
            (string)$user['_id'];
    } elseif (isset($user['id'])) {
        $currentId =
            withdrawalString(
                $user['id']
            );
    }

    $currentEmail =
        strtolower(
            withdrawalString(
                $user['email'] ?? ''
            )
        );


    /*
    |--------------------------------------------------------------------------
    | OPTIONAL ENVIRONMENT RESTRICTION
    |--------------------------------------------------------------------------
    |
    | These settings restrict an already-authorized admin.
    | They do NOT create admin privileges.
    |--------------------------------------------------------------------------
    */

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
        $configuredAdminEmail !== '' ||
        $configuredAdminId !== ''
    ) {

        $idMatches =
            $configuredAdminId !== '' &&
            strtolower(
                $configuredAdminId
            ) ===
            strtolower(
                $currentId
            );

        $emailMatches =
            $configuredAdminEmail !== '' &&
            $configuredAdminEmail ===
            $currentEmail;

        if (
            !$idMatches &&
            !$emailMatches
        ) {

            withdrawalResponse(
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
    |--------------------------------------------------------------------------
    | SUCCESS
    |--------------------------------------------------------------------------
    */

    return [
        'user' => $user,
        'id' => $currentId,
        'email' => $currentEmail
    ];
}


/*
|--------------------------------------------------------------------------
| ADMIN AUTHENTICATION
|--------------------------------------------------------------------------
*/

$admin =
    authenticateWithdrawalAdmin();


/*
|--------------------------------------------------------------------------
| DATABASE CHECK
|--------------------------------------------------------------------------
*/

if (!isset($transactions)) {

    withdrawalResponse(
        false,
        'Transactions collection is unavailable.',
        [],
        500
    );
}


/*
|--------------------------------------------------------------------------
| GET WITHDRAWALS
|--------------------------------------------------------------------------
*/

if ($requestMethod === 'GET') {

    try {

        $withdrawalFilter = [
            '$or' => [

                [
                    'type' => [
                        '$in' => [
                            'withdrawal',
                            'Withdrawal',
                            'WITHDRAWAL'
                        ]
                    ]
                ],

                [
                    'payout_sent' => [
                        '$exists' => true
                    ]
                ],

                [
                    'balance_reserved' => true
                ],

                [
                    'admin_approved' => true
                ],

                [
                    'withdrawal_amount' => [
                        '$exists' => true
                    ]
                ]
            ]
        ];

        $cursor =
            $transactions->find(
                $withdrawalFilter,
                [
                    'sort' => [
                        'created_at' => -1,
                        '_id' => -1
                    ],
                    'limit' => 500
                ]
            );

        $withdrawals = [];

        $totalWithdrawals = 0.0;
        $pendingWithdrawals = 0.0;
        $approvedWithdrawals = 0.0;
        $rejectedWithdrawals = 0.0;

        foreach ($cursor as $withdrawal) {

            try {

                $id =
                    isset($withdrawal['_id'])
                        ? (string)$withdrawal['_id']
                        : '';

                $reference =
                    withdrawalString(
                        $withdrawal['reference'] ?? ''
                    );

                if ($reference === '') {

                    $reference =
                        withdrawalString(
                            $withdrawal['transaction_id']
                            ?? ''
                        );
                }

                if ($reference === '') {
                    $reference = $id;
                }

                $amount =
                    withdrawalMoney(
                        $withdrawal['amount']
                        ??
                        $withdrawal['withdrawal_amount']
                        ??
                        $withdrawal['value']
                        ??
                        0
                    );

                $status =
                    strtolower(
                        withdrawalString(
                            $withdrawal['status']
                            ??
                            'pending'
                        )
                    );

                if ($status === '') {
                    $status = 'pending';
                }

                $userId =
                    getWithdrawalUserId(
                        $withdrawal
                    );

                $user =
                    findWithdrawalUser(
                        $userId
                    );

                $firstName = '';
                $lastName = '';
                $fullName = '';
                $phone = '';
                $email = '';

                if ($user !== null) {

                    $firstName =
                        withdrawalString(
                            $user['firstName']
                            ??
                            $user['first_name']
                            ??
                            ''
                        );

                    $lastName =
                        withdrawalString(
                            $user['lastName']
                            ??
                            $user['last_name']
                            ??
                            ''
                        );

                    $fullName =
                        withdrawalString(
                            $user['name']
                            ??
                            $user['full_name']
                            ??
                            $user['fullName']
                            ??
                            ''
                        );

                    if ($fullName === '') {

                        $fullName =
                            trim(
                                $firstName .
                                ' ' .
                                $lastName
                            );
                    }

                    $phone =
                        withdrawalString(
                            $user['phone']
                            ??
                            $user['phone_number']
                            ??
                            $user['mobile']
                            ??
                            ''
                        );

                    $email =
                        withdrawalString(
                            $user['email']
                            ?? ''
                        );
                }

                if ($fullName === '') {

                    $fullName =
                        withdrawalString(
                            $withdrawal['name']
                            ??
                            $withdrawal['full_name']
                            ??
                            ''
                        );
                }

                if ($phone === '') {

                    $phone =
                        withdrawalString(
                            $withdrawal['phone']
                            ??
                            $withdrawal['phone_number']
                            ??
                            ''
                        );
                }

                if ($email === '') {

                    $email =
                        withdrawalString(
                            $withdrawal['email']
                            ?? ''
                        );
                }

                $method =
                    withdrawalString(
                        $withdrawal['method']
                        ??
                        $withdrawal['payment_method']
                        ??
                        $withdrawal['withdrawal_method']
                        ??
                        ''
                    );

                $accountNumber =
                    withdrawalString(
                        $withdrawal['account_number']
                        ??
                        $withdrawal['accountNumber']
                        ??
                        $withdrawal['phone']
                        ??
                        $withdrawal['phone_number']
                        ??
                        $phone
                    );

                $accountName =
                    withdrawalString(
                        $withdrawal['account_name']
                        ??
                        $withdrawal['accountName']
                        ??
                        $withdrawal['recipient_name']
                        ??
                        $fullName
                    );

                $createdAt =
                    withdrawalDate(
                        $withdrawal['created_at']
                        ??
                        $withdrawal['createdAt']
                        ??
                        $withdrawal['date']
                        ??
                        null
                    );

                $processedAt =
                    withdrawalDate(
                        $withdrawal['processed_at']
                        ??
                        $withdrawal['updated_at']
                        ??
                        null
                    );

                $adminNote =
                    withdrawalString(
                        $withdrawal['admin_note']
                        ??
                        $withdrawal['adminNote']
                        ??
                        $withdrawal['rejection_reason']
                        ??
                        ''
                    );

                $totalWithdrawals += $amount;

                if ($status === 'pending') {

                    $pendingWithdrawals += $amount;

                } elseif (
                    $status === 'approved' ||
                    $status === 'completed'
                ) {

                    $approvedWithdrawals += $amount;

                } elseif ($status === 'rejected') {

                    $rejectedWithdrawals += $amount;
                }

                $normalizedUserId =
                    withdrawalString(
                        $userId
                    );

                $withdrawals[] = [

                    'id' => $id,

                    '_id' => $id,

                    'reference' => $reference,

                    'user_id' =>
                        $normalizedUserId,

                    'userId' =>
                        $normalizedUserId,

                    'name' => $fullName,

                    'full_name' => $fullName,

                    'firstName' => $firstName,

                    'lastName' => $lastName,

                    'email' => $email,

                    'phone' => $phone,

                    'amount' => $amount,

                    'status' => $status,

                    'method' => $method,

                    'payment_method' => $method,

                    'account_number' =>
                        $accountNumber,

                    'accountNumber' =>
                        $accountNumber,

                    'account_name' =>
                        $accountName,

                    'accountName' =>
                        $accountName,

                    'balance_reserved' =>
                        withdrawalBool(
                            $withdrawal[
                                'balance_reserved'
                            ] ?? false
                        ),

                    'balance_deducted' =>
                        withdrawalBool(
                            $withdrawal[
                                'balance_deducted'
                            ] ?? false
                        ),

                    'admin_approved' =>
                        withdrawalBool(
                            $withdrawal[
                                'admin_approved'
                            ] ?? false
                        ),

                    'payout_sent' =>
                        withdrawalBool(
                            $withdrawal[
                                'payout_sent'
                            ] ?? false
                        ),

                    'created_at' =>
                        $createdAt,

                    'processed_at' =>
                        $processedAt,

                    'admin_note' =>
                        $adminNote,

                    'admin_id' =>
                        withdrawalString(
                            $withdrawal[
                                'admin_id'
                            ] ?? ''
                        ),

                    'admin_email' =>
                        withdrawalString(
                            $withdrawal[
                                'admin_email'
                            ] ?? ''
                        )
                ];

            } catch (Throwable $rowError) {

                error_log(
                    'Crown Cash withdrawal row error: ' .
                    $rowError->getMessage()
                );

                continue;
            }
        }

        withdrawalResponse(
            true,
            'Withdrawals loaded successfully.',
            [

                'withdrawals' =>
                    $withdrawals,

                'data' =>
                    $withdrawals,

                'total' =>
                    count($withdrawals),

                'totals' => [

                    'withdrawals' =>
                        $totalWithdrawals,

                    'total_withdrawals' =>
                        $totalWithdrawals,

                    'pending' =>
                        $pendingWithdrawals,

                    'pending_withdrawals' =>
                        $pendingWithdrawals,

                    'approved' =>
                        $approvedWithdrawals,

                    'approved_withdrawals' =>
                        $approvedWithdrawals,

                    'rejected' =>
                        $rejectedWithdrawals,

                    'rejected_withdrawals' =>
                        $rejectedWithdrawals
                ]
            ]
        );

    } catch (Throwable $e) {

        error_log(
            'Crown Cash admin_withdrawal.php GET error: ' .
            $e->getMessage()
        );

        withdrawalResponse(
            false,
            'Unable to load withdrawals.',
            [],
            500
        );
    }
}


/*
|--------------------------------------------------------------------------
| POST
|--------------------------------------------------------------------------
*/

if ($requestMethod === 'POST') {

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

        if (!is_array($input)) {
            $input = [];
        }


        /*
        |--------------------------------------------------------------------------
        | REQUEST
        |--------------------------------------------------------------------------
        */

        $withdrawalId =
            $input['withdrawalId']
            ??
            $input['withdrawal_id']
            ??
            $input['id']
            ??
            '';

        $withdrawalId =
            withdrawalString(
                $withdrawalId
            );

        $action =
            strtolower(
                withdrawalString(
                    $input['action']
                    ??
                    $input['status']
                    ??
                    ''
                )
            );

        if ($withdrawalId === '') {

            withdrawalResponse(
                false,
                'Withdrawal ID is required.',
                [],
                400
            );
        }

        if (
            !in_array(
                $action,
                [
                    'approve',
                    'approved',
                    'reject',
                    'rejected'
                ],
                true
            )
        ) {

            withdrawalResponse(
                false,
                'Invalid withdrawal action.',
                [],
                400
            );
        }

        if ($action === 'approved') {
            $action = 'approve';
        }

        if ($action === 'rejected') {
            $action = 'reject';
        }


        /*
        |--------------------------------------------------------------------------
        | FIND WITHDRAWAL
        |--------------------------------------------------------------------------
        */

        $idFilter =
            withdrawalIdFilter(
                $withdrawalId
            );

        if ($idFilter === null) {

            withdrawalResponse(
                false,
                'Invalid withdrawal ID.',
                [],
                400
            );
        }

        $withdrawal =
            $transactions->findOne(
                $idFilter
            );

        if ($withdrawal === null) {

            withdrawalResponse(
                false,
                'Withdrawal request not found.',
                [],
                404
            );
        }


        /*
        |--------------------------------------------------------------------------
        | VERIFY TYPE
        |--------------------------------------------------------------------------
        */

        $type =
            strtolower(
                withdrawalString(
                    $withdrawal['type'] ?? ''
                )
            );

        $isWithdrawal =
            $type === 'withdrawal' ||
            isset($withdrawal['payout_sent']) ||
            isset($withdrawal['balance_reserved']) ||
            isset($withdrawal['withdrawal_amount']) ||
            isset($withdrawal['withdrawal_method']);

        if (!$isWithdrawal) {

            withdrawalResponse(
                false,
                'The selected transaction is not a withdrawal request.',
                [],
                400
            );
        }


        /*
        |--------------------------------------------------------------------------
        | CURRENT STATUS
        |--------------------------------------------------------------------------
        */

        $currentStatus =
            strtolower(
                withdrawalString(
                    $withdrawal['status']
                    ??
                    'pending'
                )
            );

        if ($currentStatus === '') {
            $currentStatus = 'pending';
        }

        if ($currentStatus !== 'pending') {

            withdrawalResponse(
                false,
                'This withdrawal has already been processed.',
                [
                    'status' =>
                        $currentStatus
                ],
                409
            );
        }


        /*
        |--------------------------------------------------------------------------
        | AMOUNT
        |--------------------------------------------------------------------------
        */

        $amount =
            withdrawalMoney(
                $withdrawal['amount']
                ??
                $withdrawal['withdrawal_amount']
                ??
                $withdrawal['value']
                ??
                0
            );

        if ($amount <= 0) {

            withdrawalResponse(
                false,
                'Withdrawal amount is invalid.',
                [
                    'amount' => $amount
                ],
                400
            );
        }


        /*
        |--------------------------------------------------------------------------
        | USER
        |--------------------------------------------------------------------------
        */

        $userId =
            getWithdrawalUserId(
                $withdrawal
            );

        if (!withdrawalHasValue($userId)) {

            $postedUserId =
                getPostedUserId(
                    $input
                );

            if (
                withdrawalHasValue(
                    $postedUserId
                )
            ) {

                $userId =
                    $postedUserId;
            }
        }

        if (!withdrawalHasValue($userId)) {

            withdrawalResponse(
                false,
                'Withdrawal is missing the user ID.',
                [],
                400
            );
        }


        /*
        |--------------------------------------------------------------------------
        | VERIFY POSTED USER ID
        |--------------------------------------------------------------------------
        */

        $databaseUserId =
            getWithdrawalUserId(
                $withdrawal
            );

        $postedUserId =
            getPostedUserId(
                $input
            );

        if (
            withdrawalHasValue(
                $databaseUserId
            ) &&
            withdrawalHasValue(
                $postedUserId
            )
        ) {

            $dbUserString =
                withdrawalString(
                    $databaseUserId
                );

            $postedUserString =
                withdrawalString(
                    $postedUserId
                );

            if (
                strtolower(
                    $dbUserString
                ) !==
                strtolower(
                    $postedUserString
                )
            ) {

                withdrawalResponse(
                    false,
                    'The supplied user ID does not match the withdrawal owner.',
                    [],
                    400
                );
            }
        }


        /*
        |--------------------------------------------------------------------------
        | ADMIN DETAILS
        |--------------------------------------------------------------------------
        */

        $adminUser =
            $admin['user'];

        $adminId =
            $admin['id'] ?? '';

        $adminEmail =
            withdrawalString(
                $adminUser['email'] ?? ''
            );

        $adminName =
            withdrawalString(
                $adminUser['name']
                ??
                $adminUser['full_name']
                ??
                $adminUser['fullName']
                ??
                ''
            );


        /*
        |--------------------------------------------------------------------------
        | TRANSACTION ID
        |--------------------------------------------------------------------------
        */

        $transactionId =
            $withdrawal['_id']
            ?? null;

        if ($transactionId === null) {

            withdrawalResponse(
                false,
                'Withdrawal record has no database ID.',
                [],
                400
            );
        }


        /*
        |--------------------------------------------------------------------------
        | APPROVE
        |--------------------------------------------------------------------------
        |
        | IMPORTANT:
        |
        | The wallet was already reserved/deducted when the withdrawal
        | request was created.
        |
        | Therefore approval does NOT deduct again.
        |--------------------------------------------------------------------------
        */

        if ($action === 'approve') {

            $updateResult =
                $transactions->updateOne(
                    [
                        '_id' => $transactionId,
                        'status' => 'pending'
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

                            'processed_at' =>
                                new UTCDateTime(),

                            'updated_at' =>
                                new UTCDateTime(),

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

            if (
                $updateResult->getMatchedCount() === 0
            ) {

                withdrawalResponse(
                    false,
                    'Withdrawal could not be approved because it was already processed.',
                    [],
                    409
                );
            }

            withdrawalResponse(
                true,
                'Withdrawal approved successfully.',
                [
                    'withdrawal' => [

                        'id' =>
                            (string)$transactionId,

                        'reference' =>
                            withdrawalString(
                                $withdrawal[
                                    'reference'
                                ] ?? ''
                            ),

                        'user_id' =>
                            withdrawalString(
                                $userId
                            ),

                        'status' =>
                            'approved',

                        'amount' =>
                            $amount
                    ]
                ]
            );
        }


        /*
        |--------------------------------------------------------------------------
        | REJECT
        |--------------------------------------------------------------------------
        */

        if ($action === 'reject') {

            $user =
                findWithdrawalUser(
                    $userId
                );

            if ($user === null) {

                withdrawalResponse(
                    false,
                    'The user associated with this withdrawal could not be found.',
                    [
                        'user_id' =>
                            withdrawalString(
                                $userId
                            )
                    ],
                    404
                );
            }


            /*
            |--------------------------------------------------------------------------
            | WAS MONEY RESERVED?
            |--------------------------------------------------------------------------
            */

            $wasReserved =
                withdrawalBool(
                    $withdrawal[
                        'balance_reserved'
                    ] ?? false,
                    false
                );


            /*
            |--------------------------------------------------------------------------
            | CLAIM REQUEST
            |--------------------------------------------------------------------------
            */

            $claimResult =
                $transactions->updateOne(
                    [
                        '_id' => $transactionId,
                        'status' => 'pending'
                    ],
                    [
                        '$set' => [

                            'status' =>
                                'rejection_processing',

                            'updated_at' =>
                                new UTCDateTime(),

                            'admin_id' =>
                                $adminId,

                            'admin_email' =>
                                $adminEmail,

                            'admin_name' =>
                                $adminName,

                            'admin_action' =>
                                'rejecting'
                        ]
                    ]
                );

            if (
                $claimResult->getMatchedCount() === 0
            ) {

                withdrawalResponse(
                    false,
                    'Withdrawal could not be rejected because it was already processed.',
                    [],
                    409
                );
            }


            /*
            |--------------------------------------------------------------------------
            | RESTORE FUNDS
            |--------------------------------------------------------------------------
            */

            $newBalance = null;
            $balanceRestored = false;

            if ($wasReserved) {

                $balanceRestored =
                    incrementUserWalletBalance(
                        $user,
                        $amount
                    );

                if (!$balanceRestored) {

                    try {

                        $transactions->updateOne(
                            [
                                '_id' => $transactionId,
                                'status' =>
                                    'rejection_processing'
                            ],
                            [
                                '$set' => [

                                    'status' =>
                                        'pending',

                                    'updated_at' =>
                                        new UTCDateTime(),

                                    'admin_action' =>
                                        'rejection_failed'
                                ]
                            ]
                        );

                    } catch (Throwable $rollbackError) {

                        error_log(
                            'Crown Cash withdrawal rejection rollback error: ' .
                            $rollbackError->getMessage()
                        );
                    }

                    withdrawalResponse(
                        false,
                        'Unable to restore the user wallet balance.',
                        [],
                        500
                    );
                }

                $updatedUser =
                    findWithdrawalUser(
                        $userId
                    );

                $newBalance =
                    getUserWalletBalance(
                        $updatedUser
                    );
            }


            /*
            |--------------------------------------------------------------------------
            | FINALIZE
            |--------------------------------------------------------------------------
            */

            $rejectResult =
                $transactions->updateOne(
                    [
                        '_id' => $transactionId,
                        'status' =>
                            'rejection_processing'
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

                            'processed_at' =>
                                new UTCDateTime(),

                            'updated_at' =>
                                new UTCDateTime(),

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
                $rejectResult->getMatchedCount() === 0
            ) {

                /*
                |--------------------------------------------------------------------------
                | REVERSE RESTORATION IF NECESSARY
                |--------------------------------------------------------------------------
                */

                if (
                    $wasReserved &&
                    $balanceRestored
                ) {

                    incrementUserWalletBalance(
                        $user,
                        -$amount
                    );
                }

                try {

                    $transactions->updateOne(
                        [
                            '_id' => $transactionId,
                            'status' =>
                                'rejection_processing'
                        ],
                        [
                            '$set' => [

                                'status' =>
                                    'pending',

                                'updated_at' =>
                                    new UTCDateTime(),

                                'admin_action' =>
                                    'rejection_rollback'
                            ]
                        ]
                    );

                } catch (Throwable $statusRollbackError) {

                    error_log(
                        'Crown Cash status rollback error: ' .
                        $statusRollbackError->getMessage()
                    );
                }

                withdrawalResponse(
                    false,
                    'Withdrawal rejection could not be completed.',
                    [],
                    500
                );
            }


            /*
            |--------------------------------------------------------------------------
            | SUCCESS
            |--------------------------------------------------------------------------
            */

            withdrawalResponse(
                true,
                $wasReserved
                    ? 'Withdrawal rejected and funds restored successfully.'
                    : 'Withdrawal rejected successfully.',
                [
                    'withdrawal' => [

                        'id' =>
                            (string)$transactionId,

                        'reference' =>
                            withdrawalString(
                                $withdrawal[
                                    'reference'
                                ] ?? ''
                            ),

                        'user_id' =>
                            withdrawalString(
                                $userId
                            ),

                        'status' =>
                            'rejected',

                        'amount' =>
                            $amount,

                        'funds_restored' =>
                            $wasReserved,

                        'restored_balance' =>
                            $newBalance
                    ]
                ]
            );
        }


        withdrawalResponse(
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

        withdrawalResponse(
            false,
            'Unable to process withdrawal.',
            [],
            500
        );
    }
}