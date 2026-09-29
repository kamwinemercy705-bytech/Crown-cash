<?php
/**
 * Crown Cash
 * Admin Withdrawals Backend
 *
 * File:
 * admin-withdrawals.php
 *
 * Purpose:
 * - Load withdrawal requests for the admin withdrawals page
 * - Provide withdrawal statistics
 * - Filter withdrawals
 * - Approve withdrawal requests
 * - Reject withdrawal requests
 * - Update related transaction records
 *
 * IMPORTANT:
 * Approval does NOT mean Mobile Money has already been paid.
 * Approved withdrawals are placed into "awaiting_payout".
 */

declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');

header(
    'Access-Control-Allow-Origin: https://crown-cash.vercel.app'
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


/*
|--------------------------------------------------------------------------
| OPTIONS / CORS
|--------------------------------------------------------------------------
*/

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}


/*
|--------------------------------------------------------------------------
| ERROR HANDLING
|--------------------------------------------------------------------------
*/

ini_set('display_errors', '0');
ini_set('log_errors', '1');

error_reporting(E_ALL);

set_exception_handler(function (Throwable $e) {

    error_log(
        'CROWN CASH ADMIN WITHDRAWALS ERROR: ' .
        $e->getMessage()
    );

    http_response_code(500);

    echo json_encode(
        [
            'success' => false,
            'message' => 'An internal server error occurred.'
        ],
        JSON_UNESCAPED_SLASHES
    );

    exit;
});


/*
|--------------------------------------------------------------------------
| CONFIG
|--------------------------------------------------------------------------
*/

require_once __DIR__ . '/config.php';


/*
|--------------------------------------------------------------------------
| SESSION
|--------------------------------------------------------------------------
*/

if (session_status() !== PHP_SESSION_ACTIVE) {
    session_start();
}


/*
|--------------------------------------------------------------------------
| HELPER FUNCTIONS
|--------------------------------------------------------------------------
*/

/**
 * Send JSON response and stop execution.
 */
function response(
    bool $success,
    string $message = '',
    array $data = [],
    int $statusCode = 200
): never {

    http_response_code($statusCode);

    echo json_encode(
        array_merge(
            [
                'success' => $success,
                'message' => $message
            ],
            $data
        ),
        JSON_UNESCAPED_SLASHES |
        JSON_UNESCAPED_UNICODE |
        JSON_INVALID_UTF8_SUBSTITUTE
    );

    exit;
}


/**
 * Get JSON request body.
 */
function getRequestBody(): array
{
    $raw = file_get_contents('php://input');

    if (!$raw) {
        return [];
    }

    $decoded = json_decode($raw, true);

    if (!is_array($decoded)) {
        return [];
    }

    return $decoded;
}


/**
 * Convert MongoDB values to ordinary PHP values.
 */
function normalizeMongoValue(mixed $value): mixed
{
    if ($value === null) {
        return null;
    }

    if ($value instanceof MongoDB\BSON\ObjectId) {
        return (string) $value;
    }

    if ($value instanceof MongoDB\BSON\UTCDateTime) {

        try {
            return $value
                ->toDateTime()
                ->format('c');

        } catch (Throwable) {

            return null;
        }
    }

    if ($value instanceof MongoDB\Model\BSONDocument) {

        $result = [];

        foreach ($value as $key => $item) {
            $result[$key] = normalizeMongoValue($item);
        }

        return $result;
    }

    if ($value instanceof MongoDB\Model\BSONArray) {

        $result = [];

        foreach ($value as $item) {
            $result[] = normalizeMongoValue($item);
        }

        return $result;
    }

    if (is_array($value)) {

        $result = [];

        foreach ($value as $key => $item) {
            $result[$key] = normalizeMongoValue($item);
        }

        return $result;
    }

    return $value;
}


/**
 * Convert MongoDB document into a normal PHP array.
 */
function mongoDocumentToArray(mixed $document): array
{
    $normalized = normalizeMongoValue($document);

    return is_array($normalized)
        ? $normalized
        : [];
}


/**
 * Get a value from an array using several possible field names.
 */
function firstValue(
    array $data,
    array $fields,
    mixed $default = null
): mixed {

    foreach ($fields as $field) {

        if (
            array_key_exists($field, $data) &&
            $data[$field] !== null &&
            $data[$field] !== ''
        ) {
            return $data[$field];
        }
    }

    return $default;
}


/**
 * Convert amount safely to float.
 */
function amountValue(mixed $value): float
{
    if ($value === null || $value === '') {
        return 0.0;
    }

    if (is_numeric($value)) {
        return (float) $value;
    }

    $clean = preg_replace(
        '/[^0-9.\-]/',
        '',
        (string) $value
    );

    return is_numeric($clean)
        ? (float) $clean
        : 0.0;
}


/**
 * Format money.
 */
function money(float $amount): string
{
    return number_format(
        $amount,
        0,
        '.',
        ','
    );
}


/**
 * Normalize status.
 */
function normalizeStatus(mixed $status): string
{
    $status = strtolower(
        trim((string) $status)
    );

    return match ($status) {

        'awaiting_approval',
        'awaiting approval',
        'processing',
        'review'
            => 'pending',

        'complete',
        'completed'
            => 'approved',

        'cancel'
            => 'cancelled',

        default
            => $status ?: 'pending'
    };
}


/**
 * Normalize network/method.
 */
function normalizeMethod(mixed $method): string
{
    $method = strtolower(
        trim((string) $method)
    );

    if (
        str_contains($method, 'airtel')
    ) {
        return 'airtel';
    }

    if (
        str_contains($method, 'mtn')
    ) {
        return 'mtn';
    }

    return $method ?: 'unknown';
}


/**
 * Human readable network.
 */
function methodLabel(string $method): string
{
    return match ($method) {

        'mtn'
            => 'MTN Mobile Money',

        'airtel'
            => 'Airtel Money',

        default
            => 'Not set'
    };
}


/**
 * Format a MongoDB date / date string.
 */
function formatDateValue(mixed $value): ?string
{
    if ($value instanceof MongoDB\BSON\UTCDateTime) {

        try {
            return $value
                ->toDateTime()
                ->format('Y-m-d H:i:s');

        } catch (Throwable) {

            return null;
        }
    }

    if ($value instanceof DateTimeInterface) {

        return $value->format(
            'Y-m-d H:i:s'
        );
    }

    if (
        is_string($value) &&
        trim($value) !== ''
    ) {

        $timestamp = strtotime($value);

        if ($timestamp !== false) {

            return date(
                'Y-m-d H:i:s',
                $timestamp
            );
        }
    }

    return null;
}


/**
 * Get current admin information from common session keys.
 *
 * This intentionally supports several session naming conventions
 * used by Crown Cash files.
 */
function getAdminSession(): array
{
    $session = $_SESSION ?? [];

    $adminId = firstValue(
        $session,
        [
            'admin_id',
            'adminId',
            'administrator_id',
            'administratorId',
            'admin_user_id',
            'adminUserId',
            'user_id',
            'userId'
        ]
    );

    $adminName = firstValue(
        $session,
        [
            'admin_name',
            'adminName',
            'administrator_name',
            'administratorName',
            'user_name',
            'userName',
            'name',
            'full_name'
        ],
        'Administrator'
    );

    $adminEmail = firstValue(
        $session,
        [
            'admin_email',
            'adminEmail',
            'administrator_email',
            'administratorEmail',
            'email'
        ],
        ''
    );

    /*
     * Detect administrator status.
     */
    $adminFlag = firstValue(
        $session,
        [
            'is_admin',
            'isAdmin',
            'admin',
            'administrator',
            'is_administrator'
        ]
    );

    $role = strtolower(
        trim(
            (string) firstValue(
                $session,
                [
                    'role',
                    'user_role',
                    'userRole',
                    'account_role',
                    'accountRole'
                ],
                ''
            )
        )
    );

    $roleIsAdmin = in_array(
        $role,
        [
            'admin',
            'administrator',
            'superadmin',
            'super_admin'
        ],
        true
    );

    $flagIsAdmin = (
        $adminFlag === true ||
        $adminFlag === 1 ||
        $adminFlag === '1' ||
        strtolower((string) $adminFlag) === 'true'
    );

    return [
        'id' => $adminId,
        'name' => (string) $adminName,
        'email' => (string) $adminEmail,
        'is_admin' => (
            $flagIsAdmin ||
            $roleIsAdmin
        ),
        'role' => $role
    ];
}


/**
 * Require administrator session.
 */
function requireAdmin(): array
{
    $admin = getAdminSession();

    if (!$admin['is_admin']) {

        response(
            false,
            'Administrator authentication is required.',
            [
                'error' => 'ADMIN_AUTH_REQUIRED'
            ],
            403
        );
    }

    return $admin;
}


/**
 * Create MongoDB ObjectId when possible.
 */
function makeObjectId(string $id): mixed
{
    if (
        class_exists('MongoDB\\BSON\\ObjectId') &&
        preg_match('/^[a-f0-9]{24}$/i', $id)
    ) {
        try {
            return new MongoDB\BSON\ObjectId($id);
        } catch (Throwable) {
            return $id;
        }
    }

    return $id;
}


/**
 * Find withdrawal by either ObjectId or string id.
 */
function findWithdrawalById(
    mixed $withdrawals,
    string $withdrawalId
): ?array {

    $possibleIds = [];

    try {
        $possibleIds[] = new MongoDB\BSON\ObjectId(
            $withdrawalId
        );
    } catch (Throwable) {
        // Ignore invalid ObjectId.
    }

    $possibleIds[] = $withdrawalId;

    foreach ($possibleIds as $possibleId) {

        try {

            $document = $withdrawals->findOne(
                [
                    '_id' => $possibleId
                ]
            );

            if ($document !== null) {
                return mongoDocumentToArray($document);
            }

        } catch (Throwable) {
            // Continue to next possible identifier.
        }
    }

    return null;
}


/**
 * Update transaction documents associated with withdrawal.
 */
function updateWithdrawalTransactions(
    mixed $transactions,
    string $withdrawalId,
    string $newStatus,
    array $extra = []
): void {

    $filters = [
        [
            'withdrawal_id' => $withdrawalId
        ],
        [
            'withdrawalId' => $withdrawalId
        ],
        [
            'reference_type' => 'withdrawal',
            'reference_id' => $withdrawalId
        ],
        [
            'type' => 'withdrawal',
            'withdrawal_id' => $withdrawalId
        ]
    ];

    foreach ($filters as $filter) {

        try {

            $transactions->updateMany(
                $filter,
                [
                    '$set' => array_merge(
                        [
                            'status' => $newStatus,
                            'updated_at' => new MongoDB\BSON\UTCDateTime()
                        ],
                        $extra
                    )
                ]
            );

        } catch (Throwable $e) {

            error_log(
                'CROWN CASH TRANSACTION UPDATE WARNING: ' .
                $e->getMessage()
            );
        }
    }
}


/**
 * Build a clean withdrawal response record.
 */
function formatWithdrawal(array $document): array
{
    $id = firstValue(
        $document,
        [
            '_id',
            'id',
            'withdrawal_id',
            'withdrawalId'
        ]
    );

    $withdrawalId = is_string($id)
        ? $id
        : (string) $id;


    /*
     * Customer information.
     */
    $firstName = (string) firstValue(
        $document,
        [
            'first_name',
            'firstName'
        ],
        ''
    );

    $lastName = (string) firstValue(
        $document,
        [
            'last_name',
            'lastName'
        ],
        ''
    );

    $fullName = trim(
        (string) firstValue(
            $document,
            [
                'user_name',
                'userName',
                'customer_name',
                'customerName',
                'full_name',
                'fullName',
                'name'
            ],
            trim($firstName . ' ' . $lastName)
        )
    );

    if ($fullName === '') {
        $fullName = 'Customer';
    }


    $phone = (string) firstValue(
        $document,
        [
            'withdrawal_number',
            'withdrawalNumber',
            'registered_withdrawal_number',
            'registeredWithdrawalNumber',
            'registered_phone',
            'registeredPhone',
            'phone',
            'phone_number',
            'phoneNumber',
            'mobile',
            'mobile_number',
            'mobileNumber',
            'account'
        ],
        'Not provided'
    );


    $accountName = (string) firstValue(
        $document,
        [
            'account_name',
            'accountName',
            'withdrawal_account_name',
            'withdrawalAccountName',
            'full_name',
            'fullName',
            'name'
        ],
        $fullName
    );


    $email = (string) firstValue(
        $document,
        [
            'email',
            'user_email',
            'userEmail',
            'customer_email',
            'customerEmail'
        ],
        ''
    );


    /*
     * Amounts.
     */
    $requestedAmount = amountValue(
        firstValue(
            $document,
            [
                'amount',
                'requested_amount',
                'requestedAmount',
                'gross_amount',
                'grossAmount'
            ],
            0
        )
    );

    $fee = amountValue(
        firstValue(
            $document,
            [
                'fee',
                'withdrawal_fee',
                'withdrawalFee'
            ],
            0
        )
    );

    $netAmount = amountValue(
        firstValue(
            $document,
            [
                'net_amount',
                'netAmount',
                'amount_received',
                'amountReceived',
                'payout_amount',
                'payoutAmount'
            ],
            0
        )
    );


    /*
     * If older records don't contain fee/net,
     * calculate them using Crown Cash's 20% withdrawal fee.
     */
    if ($requestedAmount > 0) {

        if ($fee <= 0) {
            $fee = round(
                $requestedAmount * 0.20,
                2
            );
        }

        if ($netAmount <= 0) {
            $netAmount = round(
                $requestedAmount - $fee,
                2
            );
        }
    }


    /*
     * Method / network.
     */
    $method = normalizeMethod(
        firstValue(
            $document,
            [
                'method',
                'network',
                'payment_method',
                'paymentMethod',
                'mobile_network',
                'mobileNetwork'
            ],
            ''
        )
    );


    /*
     * Status.
     */
    $status = normalizeStatus(
        firstValue(
            $document,
            [
                'status',
                'withdrawal_status',
                'withdrawalStatus'
            ],
            'pending'
        )
    );


    /*
     * Payout status.
     */
    $payoutStatus = strtolower(
        trim(
            (string) firstValue(
                $document,
                [
                    'payout_status',
                    'payoutStatus'
                ],
                ''
            )
        )
    );

    if ($payoutStatus === '') {

        if ($status === 'approved') {
            $payoutStatus = 'awaiting_payout';
        } else {
            $payoutStatus = 'not_required';
        }
    }


    /*
     * Dates.
     */
    $createdAt = firstValue(
        $document,
        [
            'created_at',
            'createdAt',
            'submitted_at',
            'submittedAt',
            'date'
        ]
    );

    $approvedAt = firstValue(
        $document,
        [
            'approved_at',
            'approvedAt'
        ]
    );

    $rejectedAt = firstValue(
        $document,
        [
            'rejected_at',
            'rejectedAt'
        ]
    );


    /*
     * References.
     */
    $reference = (string) firstValue(
        $document,
        [
            'reference',
            'withdrawal_reference',
            'withdrawalReference',
            'transaction_reference',
            'transactionReference'
        ],
        $withdrawalId
    );


    /*
     * Admin information.
     */
    $approvedBy = firstValue(
        $document,
        [
            'approved_by',
            'approvedBy',
            'admin_id',
            'adminId'
        ]
    );

    $rejectedBy = firstValue(
        $document,
        [
            'rejected_by',
            'rejectedBy'
        ]
    );


    return [
        'id' => $withdrawalId,

        'withdrawal_id' => $withdrawalId,

        'reference' => $reference,

        'customer' => [
            'name' => $fullName,
            'email' => $email,
            'phone' => $phone,
            'account_name' => $accountName
        ],

        'user_id' => (string) firstValue(
            $document,
            [
                'user_id',
                'userId',
                'customer_id',
                'customerId'
            ],
            ''
        ),

        'name' => $fullName,

        'email' => $email,

        'phone' => $phone,

        'account_name' => $accountName,

        'method' => $method,

        'method_label' => methodLabel($method),

        'network' => strtoupper($method),

        'amount' => $requestedAmount,

        'requested_amount' => $requestedAmount,

        'fee' => $fee,

        'fee_percent' => 20,

        'net_amount' => $netAmount,

        'amount_received' => $netAmount,

        'status' => $status,

        'payout_status' => $payoutStatus,

        'created_at' => formatDateValue($createdAt),

        'submitted_at' => formatDateValue($createdAt),

        'approved_at' => formatDateValue($approvedAt),

        'rejected_at' => formatDateValue($rejectedAt),

        'approved_by' => $approvedBy !== null
            ? (string) $approvedBy
            : null,

        'rejected_by' => $rejectedBy !== null
            ? (string) $rejectedBy
            : null,

        'rejection_reason' => (string) firstValue(
            $document,
            [
                'rejection_reason',
                'rejectionReason',
                'reason',
                'admin_reason',
                'adminReason'
            ],
            ''
        ),

        'admin_note' => (string) firstValue(
            $document,
            [
                'admin_note',
                'adminNote',
                'admin_notes',
                'adminNotes'
            ],
            ''
        )
    ];
}


/*
|--------------------------------------------------------------------------
| ADMIN AUTHENTICATION
|--------------------------------------------------------------------------
|
| The page must be protected by an administrator session.
|
*/

$admin = requireAdmin();


/*
|--------------------------------------------------------------------------
| DATABASE COLLECTION CHECK
|--------------------------------------------------------------------------
*/

if (!isset($withdrawals)) {

    response(
        false,
        'Withdrawals collection is not available in config.php.',
        [
            'error' => 'WITHDRAWALS_COLLECTION_MISSING'
        ],
        500
    );
}


if (!isset($transactions)) {

    /*
     * Transactions is useful but not absolutely required for displaying
     * withdrawals. We keep it null if the existing config does not expose it.
     */
    $transactions = null;
}


/*
|--------------------------------------------------------------------------
| REQUEST METHOD
|--------------------------------------------------------------------------
*/

$requestMethod = $_SERVER['REQUEST_METHOD'];


/*
|--------------------------------------------------------------------------
| GET
|--------------------------------------------------------------------------
|
| GET supports:
|
| ?status=pending
| ?status=approved
| ?status=rejected
| ?status=cancelled
| ?status=all
|
| ?method=mtn
| ?method=airtel
| ?method=all
|
| ?payout_status=awaiting_payout
| ?payout_status=paid
| ?payout_status=payout_failed
| ?payout_status=not_required
| ?payout_status=all
|
*/

if ($requestMethod === 'GET') {

    $statusFilter = strtolower(
        trim(
            (string) ($_GET['status'] ?? 'all')
        )
    );

    $methodFilter = strtolower(
        trim(
            (string) ($_GET['method'] ?? 'all')
        )
    );

    $payoutFilter = strtolower(
        trim(
            (string) (
                $_GET['payout_status']
                ??
                $_GET['payoutStatus']
                ??
                'all'
            )
        )
    );


    /*
     * MongoDB filter.
     */
    $filter = [];


    /*
     * Status filter.
     */
    if (
        $statusFilter !== '' &&
        $statusFilter !== 'all'
    ) {

        if ($statusFilter === 'pending') {

            $filter['status'] = [
                '$in' => [
                    'pending',
                    'awaiting_approval',
                    'processing',
                    'review'
                ]
            ];

        } else {

            $filter['status'] = $statusFilter;
        }
    }


    /*
     * Method filter.
     */
    if (
        $methodFilter !== '' &&
        $methodFilter !== 'all'
    ) {

        $methodFilter = normalizeMethod(
            $methodFilter
        );

        $filter['$or'] = [
            [
                'method' => $methodFilter
            ],
            [
                'network' => $methodFilter
            ],
            [
                'payment_method' => $methodFilter
            ],
            [
                'mobile_network' => $methodFilter
            ]
        ];
    }


    /*
     * Payout filter.
     */
    if (
        $payoutFilter !== '' &&
        $payoutFilter !== 'all'
    ) {

        if ($payoutFilter === 'not required') {
            $payoutFilter = 'not_required';
        }

        if ($payoutFilter === 'awaiting payout') {
            $payoutFilter = 'awaiting_payout';
        }

        if ($payoutFilter === 'payout failed') {
            $payoutFilter = 'payout_failed';
        }

        /*
         * If method filter already created $or,
         * combine filters using $and.
         */
        if (isset($filter['$or'])) {

            $methodOr = $filter['$or'];

            unset($filter['$or']);

            $filter['$and'] = [
                [
                    '$or' => $methodOr
                ],
                [
                    '$or' => [
                        [
                            'payout_status' => $payoutFilter
                        ],
                        [
                            'payoutStatus' => $payoutFilter
                        ]
                    ]
                ]
            ];

        } else {

            $filter['$or'] = [
                [
                    'payout_status' => $payoutFilter
                ],
                [
                    'payoutStatus' => $payoutFilter
                ]
            ];
        }
    }


    /*
     * Query options.
     */
    $options = [
        'sort' => [
            'created_at' => -1,
            '_id' => -1
        ],
        'limit' => 500
    ];


    /*
     * Fetch withdrawals.
     */
    $cursor = $withdrawals->find(
        $filter,
        $options
    );


    $records = [];

    $totalAmount = 0.0;

    $pendingAmount = 0.0;

    $approvedAmount = 0.0;

    $rejectedAmount = 0.0;

    $cancelledAmount = 0.0;

    $pendingCount = 0;

    $approvedCount = 0;

    $rejectedCount = 0;

    $cancelledCount = 0;


    foreach ($cursor as $document) {

        $record = formatWithdrawal(
            mongoDocumentToArray($document)
        );

        $records[] = $record;

        $amount = (float) $record['amount'];

        /*
         * Statistics.
         */
        $totalAmount += $amount;


        switch ($record['status']) {

            case 'pending':

                $pendingAmount += $amount;

                $pendingCount++;

                break;


            case 'approved':

                $approvedAmount += $amount;

                $approvedCount++;

                break;


            case 'rejected':

                $rejectedAmount += $amount;

                $rejectedCount++;

                break;


            case 'cancelled':

                $cancelledAmount += $amount;

                $cancelledCount++;

                break;
        }
    }


    /*
     * Total count.
     */
    $totalCount = count($records);


    /*
     * Return response.
     */
    response(
        true,
        'Withdrawal requests loaded successfully.',
        [
            'withdrawals' => $records,

            /*
             * Compatibility aliases.
             */
            'requests' => $records,

            'data' => $records,

            'stats' => [

                'total' => $totalCount,

                'total_count' => $totalCount,

                'total_amount' => $totalAmount,

                'pending' => $pendingCount,

                'pending_count' => $pendingCount,

                'pending_amount' => $pendingAmount,

                'approved' => $approvedCount,

                'approved_count' => $approvedCount,

                'approved_amount' => $approvedAmount,

                'rejected' => $rejectedCount,

                'rejected_count' => $rejectedCount,

                'rejected_amount' => $rejectedAmount,

                'cancelled' => $cancelledCount,

                'cancelled_count' => $cancelledCount,

                'cancelled_amount' => $cancelledAmount
            ],

            'filters' => [
                'status' => $statusFilter,
                'method' => $methodFilter,
                'payout_status' => $payoutFilter
            ]
        ]
    );
}


/*
|--------------------------------------------------------------------------
| POST
|--------------------------------------------------------------------------
|
| POST actions:
|
| {
|   "action": "approve",
|   "withdrawal_id": "..."
| }
|
| OR
|
| {
|   "action": "reject",
|   "withdrawal_id": "...",
|   "reason": "..."
| }
|
*/

if ($requestMethod === 'POST') {

    $body = getRequestBody();


    /*
     * Also support normal form POST.
     */
    if (!$body) {
        $body = $_POST;
    }


    $action = strtolower(
        trim(
            (string) (
                $body['action']
                ??
                $body['type']
                ??
                ''
            )
        )
    );


    $withdrawalId = trim(
        (string) (
            $body['withdrawal_id']
            ??
            $body['withdrawalId']
            ??
            $body['id']
            ??
            ''
        )
    );


    /*
     * Validate action.
     */
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

        response(
            false,
            'Invalid withdrawal action.',
            [
                'error' => 'INVALID_ACTION'
            ],
            400
        );
    }


    if ($withdrawalId === '') {

        response(
            false,
            'Withdrawal ID is required.',
            [
                'error' => 'WITHDRAWAL_ID_REQUIRED'
            ],
            400
        );
    }


    /*
     * Normalize action.
     */
    if ($action === 'approved') {
        $action = 'approve';
    }

    if ($action === 'rejected') {
        $action = 'reject';
    }


    /*
     * Find withdrawal.
     */
    $withdrawal = findWithdrawalById(
        $withdrawals,
        $withdrawalId
    );


    if ($withdrawal === null) {

        response(
            false,
            'Withdrawal request was not found.',
            [
                'error' => 'WITHDRAWAL_NOT_FOUND'
            ],
            404
        );
    }


    /*
     * Current status.
     */
    $currentStatus = normalizeStatus(
        firstValue(
            $withdrawal,
            [
                'status',
                'withdrawal_status',
                'withdrawalStatus'
            ],
            'pending'
        )
    );


    /*
     * Prevent duplicate processing.
     */
    if (
        $currentStatus === 'approved' &&
        $action === 'approve'
    ) {

        response(
            false,
            'This withdrawal has already been approved.',
            [
                'error' => 'ALREADY_APPROVED'
            ],
            409
        );
    }


    if (
        $currentStatus === 'rejected' &&
        $action === 'reject'
    ) {

        response(
            false,
            'This withdrawal has already been rejected.',
            [
                'error' => 'ALREADY_REJECTED'
            ],
            409
        );
    }


    /*
     * Do not allow approving a request that was already rejected.
     */
    if (
        $action === 'approve' &&
        in_array(
            $currentStatus,
            [
                'rejected',
                'cancelled'
            ],
            true
        )
    ) {

        response(
            false,
            'This withdrawal cannot be approved because it is already ' .
            $currentStatus . '.',
            [
                'error' => 'WITHDRAWAL_CLOSED'
            ],
            409
        );
    }


    /*
     * Do not allow rejecting an already approved request.
     */
    if (
        $action === 'reject' &&
        $currentStatus === 'approved'
    ) {

        response(
            false,
            'This withdrawal has already been approved and cannot be rejected.',
            [
                'error' => 'WITHDRAWAL_ALREADY_APPROVED'
            ],
            409
        );
    }


    /*
     * Admin details.
     */
    $adminId = $admin['id'];

    $adminName = $admin['name'];

    $adminEmail = $admin['email'];

    $now = new MongoDB\BSON\UTCDateTime();


    /*
     * ================================================================
     * APPROVE
     * ================================================================
     */

    if ($action === 'approve') {

        /*
         * Approved means approved for payout.
         * It does NOT mean money has already been sent.
         */
        $update = [

            '$set' => [

                'status' => 'approved',

                'withdrawal_status' => 'approved',

                'approved' => true,

                'admin_approved' => true,

                'verified' => true,

                'verified_by' => $adminId,

                'verified_at' => $now,

                'approved_by' => $adminId,

                'approved_by_name' => $adminName,

                'approved_by_email' => $adminEmail,

                'approved_at' => $now,

                /*
                 * Important:
                 * payment has NOT yet been made.
                 */
                'paid' => false,

                'payout_status' => 'awaiting_payout',

                'payoutStatus' => 'awaiting_payout',

                'updated_at' => $now,

                'last_admin_action' => 'approve',

                'last_admin_action_by' => $adminId,

                'last_admin_action_at' => $now
            ]
        ];


        /*
         * Update withdrawal.
         */
        $updateResult = null;

        try {

            $updateResult = $withdrawals->updateOne(
                [
                    '_id' => makeObjectId($withdrawalId),
                    'status' => [
                        '$nin' => [
                            'approved',
                            'rejected',
                            'cancelled'
                        ]
                    ]
                ],
                $update
            );

        } catch (Throwable) {

            /*
             * Try string ID if the stored ID isn't ObjectId.
             */
            $updateResult = $withdrawals->updateOne(
                [
                    '_id' => $withdrawalId,
                    'status' => [
                        '$nin' => [
                            'approved',
                            'rejected',
                            'cancelled'
                        ]
                    ]
                ],
                $update
            );
        }


        /*
         * Make sure something was actually updated.
         */
        if (
            !$updateResult ||
            $updateResult->getModifiedCount() < 1
        ) {

            response(
                false,
                'The withdrawal could not be approved. It may already have been processed.',
                [
                    'error' => 'UPDATE_FAILED'
                ],
                409
            );
        }


        /*
         * Update related transaction.
         */
        if ($transactions !== null) {

            updateWithdrawalTransactions(
                $transactions,
                $withdrawalId,
                'approved',
                [
                    'payout_status' => 'awaiting_payout',
                    'admin_approved' => true,
                    'approved_by' => $adminId,
                    'approved_at' => $now
                ]
            );
        }


        /*
         * Reload record.
         */
        $updatedWithdrawal = findWithdrawalById(
            $withdrawals,
            $withdrawalId
        );


        response(
            true,
            'Withdrawal approved successfully. It is now awaiting payout.',
            [
                'action' => 'approve',

                'withdrawal' => $updatedWithdrawal !== null
                    ? formatWithdrawal($updatedWithdrawal)
                    : null,

                'payout_status' => 'awaiting_payout'
            ]
        );
    }


    /*
     * ================================================================
     * REJECT
     * ================================================================
     */

    if ($action === 'reject') {

        $reason = trim(
            (string) (
                $body['reason']
                ??
                $body['rejection_reason']
                ??
                $body['rejectionReason']
                ??
                ''
            )
        );


        /*
         * Default reason if admin did not enter one.
         */
        if ($reason === '') {
            $reason = 'Withdrawal request rejected by administrator.';
        }


        /*
         * Limit excessively long rejection messages.
         */
        if (mb_strlen($reason) > 500) {

            $reason = mb_substr(
                $reason,
                0,
                500
            );
        }


        $update = [

            '$set' => [

                'status' => 'rejected',

                'withdrawal_status' => 'rejected',

                'approved' => false,

                'admin_approved' => false,

                'verified' => false,

                'admin_rejected' => true,

                'rejected_by' => $adminId,

                'rejected_by_name' => $adminName,

                'rejected_by_email' => $adminEmail,

                'rejected_at' => $now,

                'rejection_reason' => $reason,

                'admin_reason' => $reason,

                'paid' => false,

                'payout_status' => 'not_required',

                'payoutStatus' => 'not_required',

                'updated_at' => $now,

                'last_admin_action' => 'reject',

                'last_admin_action_by' => $adminId,

                'last_admin_action_at' => $now
            ]
        ];


        /*
         * Update withdrawal.
         */
        $updateResult = null;

        try {

            $updateResult = $withdrawals->updateOne(
                [
                    '_id' => makeObjectId($withdrawalId),
                    'status' => [
                        '$nin' => [
                            'approved',
                            'rejected',
                            'cancelled'
                        ]
                    ]
                ],
                $update
            );

        } catch (Throwable) {

            $updateResult = $withdrawals->updateOne(
                [
                    '_id' => $withdrawalId,
                    'status' => [
                        '$nin' => [
                            'approved',
                            'rejected',
                            'cancelled'
                        ]
                    ]
                ],
                $update
            );
        }


        /*
         * Confirm update.
         */
        if (
            !$updateResult ||
            $updateResult->getModifiedCount() < 1
        ) {

            response(
                false,
                'The withdrawal could not be rejected. It may already have been processed.',
                [
                    'error' => 'UPDATE_FAILED'
                ],
                409
            );
        }


        /*
         * Update related transaction.
         */
        if ($transactions !== null) {

            updateWithdrawalTransactions(
                $transactions,
                $withdrawalId,
                'rejected',
                [
                    'payout_status' => 'not_required',
                    'admin_rejected' => true,
                    'rejected_by' => $adminId,
                    'rejected_at' => $now,
                    'rejection_reason' => $reason
                ]
            );
        }


        /*
         * Reload record.
         */
        $updatedWithdrawal = findWithdrawalById(
            $withdrawals,
            $withdrawalId
        );


        response(
            true,
            'Withdrawal rejected successfully.',
            [
                'action' => 'reject',

                'withdrawal' => $updatedWithdrawal !== null
                    ? formatWithdrawal($updatedWithdrawal)
                    : null,

                'payout_status' => 'not_required',

                'rejection_reason' => $reason
            ]
        );
    }
}


/*
|--------------------------------------------------------------------------
| UNSUPPORTED METHOD
|--------------------------------------------------------------------------
*/

response(
    false,
    'Request method not supported.',
    [
        'error' => 'METHOD_NOT_ALLOWED'
    ],
    405
);