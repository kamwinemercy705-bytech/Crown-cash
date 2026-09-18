<?php
declare(strict_types=1);

/*
|--------------------------------------------------------------------------
| Crown Cash - Admin Deposits API
|--------------------------------------------------------------------------
| GET:
|   Lists deposits for the admin panel.
|
| POST:
|   Approves or rejects a pending deposit.
|
| IMPORTANT:
|   A user-entered transaction reference is NOT proof of payment.
|   Approve a deposit only after independently verifying the payment
|   through the authorized Mobile Money records/API.
|--------------------------------------------------------------------------
*/

header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Origin: https://crown-cash.vercel.app");
header("Access-Control-Allow-Credentials: true");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");

if ($_SERVER["REQUEST_METHOD"] === "OPTIONS") {
    http_response_code(204);
    exit;
}

/*
|--------------------------------------------------------------------------
| Cross-site session
|--------------------------------------------------------------------------
*/
session_set_cookie_params([
    "lifetime" => 0,
    "path" => "/",
    "secure" => true,
    "httponly" => true,
    "samesite" => "None"
]);

session_start();

/*
|--------------------------------------------------------------------------
| Helper functions
|--------------------------------------------------------------------------
*/

function jsonResponse(array $data, int $status = 200): void
{
    http_response_code($status);
    echo json_encode(
        $data,
        JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE
    );
    exit;
}

function getPostData(): array
{
    $raw = file_get_contents("php://input");

    if (!$raw) {
        return $_POST ?? [];
    }

    $data = json_decode($raw, true);

    if (is_array($data)) {
        return $data;
    }

    return $_POST ?? [];
}

function isAdmin(): bool
{
    if (empty($_SESSION["logged_in"]) || $_SESSION["logged_in"] !== true) {
        return false;
    }

    $role = strtolower(trim((string)($_SESSION["role"] ?? "")));
    $accountType = strtolower(trim((string)($_SESSION["account_type"] ?? "")));

    return $role === "admin" || $accountType === "admin";
}

function toFloatValue($value): float
{
    if ($value === null) {
        return 0.0;
    }

    if ($value instanceof \MongoDB\BSON\Decimal128) {
        return (float)$value->__toString();
    }

    if ($value instanceof \MongoDB\BSON\Int64) {
        return (float)$value->__toString();
    }

    if (is_numeric($value)) {
        return (float)$value;
    }

    return 0.0;
}

function formatMongoValue($value)
{
    if ($value instanceof \MongoDB\BSON\ObjectId) {
        return (string)$value;
    }

    if ($value instanceof \MongoDB\BSON\UTCDateTime) {
        return $value->toDateTime()->format("c");
    }

    if ($value instanceof \MongoDB\BSON\Decimal128) {
        return (float)$value->__toString();
    }

    if ($value instanceof \MongoDB\BSON\Int64) {
        return (int)$value->__toString();
    }

    return $value;
}

function safeString($value): string
{
    if ($value === null) {
        return "";
    }

    if ($value instanceof \MongoDB\BSON\ObjectId) {
        return (string)$value;
    }

    return trim((string)$value);
}

function userIdFilter($userId): array
{
    $filters = [];

    if ($userId instanceof \MongoDB\BSON\ObjectId) {
        $filters[] = ["user_id" => $userId];
        $filters[] = ["user" => $userId];
        $filters[] = ["userId" => $userId];
        $filters[] = ["account_id" => $userId];
    }

    $stringId = safeString($userId);

    if ($stringId !== "") {
        $filters[] = ["user_id" => $stringId];
        $filters[] = ["user" => $stringId];
        $filters[] = ["userId" => $stringId];
        $filters[] = ["account_id" => $stringId];
    }

    return $filters;
}

/*
|--------------------------------------------------------------------------
| Authentication
|--------------------------------------------------------------------------
*/

if (!isAdmin()) {
    jsonResponse([
        "success" => false,
        "message" => "Admin access required."
    ], 403);
}

/*
|--------------------------------------------------------------------------
| Load database configuration
|--------------------------------------------------------------------------
*/

try {
    require_once __DIR__ . "/config.php";
} catch (Throwable $e) {
    jsonResponse([
        "success" => false,
        "message" => "Database configuration could not be loaded."
    ], 500);
}

if (!isset($deposits) || !isset($users)) {
    jsonResponse([
        "success" => false,
        "message" => "Required database collections are not configured."
    ], 500);
}

/*
|--------------------------------------------------------------------------
| GET - List deposits
|--------------------------------------------------------------------------
*/

if ($_SERVER["REQUEST_METHOD"] === "GET") {

    try {

        $status = strtolower(trim((string)($_GET["status"] ?? "all")));

        $filter = [];

        if ($status !== "" && $status !== "all") {
            $filter["status"] = $status;
        }

        $cursor = $deposits->find(
            $filter,
            [
                "sort" => [
                    "created_at" => -1,
                    "_id" => -1
                ],
                "limit" => 500
            ]
        );

        $items = [];

        foreach ($cursor as $deposit) {

            $depositId = isset($deposit->_id)
                ? (string)$deposit->_id
                : "";

            /*
             * Find the user associated with this deposit.
             */
            $user = null;

            $possibleUserIds = [];

            foreach ([
                $deposit->user_id ?? null,
                $deposit->user ?? null,
                $deposit->userId ?? null,
                $deposit->account_id ?? null
            ] as $possibleId) {

                if ($possibleId !== null && $possibleId !== "") {
                    $possibleUserIds[] = $possibleId;

                    if (
                        $possibleId instanceof \MongoDB\BSON\ObjectId
                    ) {
                        $possibleUserIds[] = (string)$possibleId;
                    }
                }
            }

            $userFilter = [];

            if (!empty($possibleUserIds)) {

                $or = [];

                foreach ($possibleUserIds as $possibleId) {

                    $or[] = ["_id" => $possibleId];
                    $or[] = ["user_id" => $possibleId];
                }

                /*
                 * Try ObjectId conversion where possible.
                 */
                foreach ($possibleUserIds as $possibleId) {

                    if (
                        is_string($possibleId) &&
                        preg_match('/^[a-f0-9]{24}$/i', $possibleId)
                    ) {
                        try {
                            $objectId = new \MongoDB\BSON\ObjectId($possibleId);

                            $or[] = ["_id" => $objectId];
                            $or[] = ["user_id" => $objectId];

                        } catch (Throwable $ignored) {
                        }
                    }
                }

                $userFilter = [
                    '$or' => $or
                ];
            }

            if (!empty($userFilter)) {
                $user = $users->findOne($userFilter);
            }

            /*
             * User information.
             */
            $fullName = "";
            $email = "";
            $phone = "";

            if ($user) {

                $firstName = safeString(
                    $user->first_name ?? ""
                );

                $lastName = safeString(
                    $user->last_name ?? ""
                );

                $fullName = safeString(
                    $user->full_name ?? ""
                );

                if ($fullName === "") {
                    $fullName = trim(
                        $firstName . " " . $lastName
                    );
                }

                if ($fullName === "") {
                    $fullName = safeString(
                        $user->name ?? ""
                    );
                }

                $email = safeString(
                    $user->email ?? ""
                );

                $phone = safeString(
                    $user->phone ?? ""
                );
            }

            /*
             * Deposit fields.
             */
            $amount = toFloatValue(
                $deposit->amount ?? 0
            );

            $paymentMethod = strtolower(
                safeString(
                    $deposit->payment_method
                    ?? $deposit->method
                    ?? ""
                )
            );

            if ($paymentMethod === "mtn_momo") {
                $paymentMethod = "mtn";
            }

            if ($paymentMethod === "airtel_money") {
                $paymentMethod = "airtel";
            }

            $reference = safeString(
                $deposit->transaction_reference
                ?? $deposit->reference
                ?? $deposit->payment_reference
                ?? ""
            );

            $depositStatus = strtolower(
                safeString(
                    $deposit->status ?? "pending"
                )
            );

            $createdAt = formatMongoValue(
                $deposit->created_at ?? null
            );

            $updatedAt = formatMongoValue(
                $deposit->updated_at ?? null
            );

            $approvedAt = formatMongoValue(
                $deposit->approved_at ?? null
            );

            $rejectedAt = formatMongoValue(
                $deposit->rejected_at ?? null
            );

            $items[] = [
                "id" => $depositId,
                "deposit_id" => $depositId,

                "user_id" => safeString(
                    $deposit->user_id
                    ?? $deposit->user
                    ?? $deposit->userId
                    ?? $deposit->account_id
                    ?? ""
                ),

                "user" => [
                    "name" => $fullName,
                    "email" => $email,
                    "phone" => $phone
                ],

                "name" => $fullName,
                "email" => $email,
                "phone" => $phone,

                "amount" => $amount,
                "payment_method" => $paymentMethod,
                "method" => $paymentMethod,

                "reference" => $reference,
                "transaction_reference" => $reference,

                "status" => $depositStatus,

                "created_at" => $createdAt,
                "updated_at" => $updatedAt,
                "approved_at" => $approvedAt,
                "rejected_at" => $rejectedAt,

                "approved_by" => safeString(
                    $deposit->approved_by ?? ""
                ),

                "rejected_by" => safeString(
                    $deposit->rejected_by ?? ""
                )
            ];
        }

        /*
         * Counts.
         */
        $pendingCount = (int)$deposits->countDocuments([
            "status" => "pending"
        ]);

        $approvedCount = (int)$deposits->countDocuments([
            "status" => "approved"
        ]);

        $rejectedCount = (int)$deposits->countDocuments([
            "status" => "rejected"
        ]);

        $totalAmount = 0.0;

        foreach ($items as $item) {
            $totalAmount += (float)$item["amount"];
        }

        jsonResponse([
            "success" => true,
            "counts" => [
                "pending" => $pendingCount,
                "approved" => $approvedCount,
                "rejected" => $rejectedCount,
                "total" => count($items)
            ],
            "total_amount" => $totalAmount,
            "deposits" => $items
        ]);

    } catch (Throwable $e) {

        error_log(
            "Admin deposits GET error: " . $e->getMessage()
        );

        jsonResponse([
            "success" => false,
            "message" => "Unable to load deposits.",
            "error" => $e->getMessage()
        ], 500);
    }
}

/*
|--------------------------------------------------------------------------
| POST - Approve / Reject
|--------------------------------------------------------------------------
*/

if ($_SERVER["REQUEST_METHOD"] === "POST") {

    $data = getPostData();

    $depositId = trim(
        (string)($data["deposit_id"] ?? "")
    );

    $action = strtolower(
        trim((string)($data["action"] ?? ""))
    );

    if ($depositId === "") {
        jsonResponse([
            "success" => false,
            "message" => "Deposit ID is required."
        ], 400);
    }

    if (!in_array($action, ["approve", "reject"], true)) {
        jsonResponse([
            "success" => false,
            "message" => "Invalid deposit action."
        ], 400);
    }

    try {

        /*
         * Convert ID.
         */
        try {
            $objectId = new \MongoDB\BSON\ObjectId($depositId);
        } catch (Throwable $e) {
            jsonResponse([
                "success" => false,
                "message" => "Invalid deposit ID."
            ], 400);
        }

        /*
         * Find the deposit.
         */
        $deposit = $deposits->findOne([
            "_id" => $objectId
        ]);

        if (!$deposit) {
            jsonResponse([
                "success" => false,
                "message" => "Deposit was not found."
            ], 404);
        }

        $currentStatus = strtolower(
            safeString($deposit->status ?? "pending")
        );

        /*
         * Only pending deposits can be processed.
         */
        if ($currentStatus !== "pending") {
            jsonResponse([
                "success" => false,
                "message" => "This deposit has already been processed.",
                "status" => $currentStatus
            ], 409);
        }

        $adminId = $_SESSION["user_id"] ?? null;

        /*
         * Get user ID from deposit.
         */
        $depositUserId =
            $deposit->user_id
            ?? $deposit->user
            ?? $deposit->userId
            ?? $deposit->account_id
            ?? null;

        if ($depositUserId === null || $depositUserId === "") {
            jsonResponse([
                "success" => false,
                "message" => "This deposit is not linked to a user."
            ], 400);
        }

        /*
         * Find user.
         */
        $userFilter = [
            '$or' => userIdFilter($depositUserId)
        ];

        $user = $users->findOne($userFilter);

        if (!$user) {
            jsonResponse([
                "success" => false,
                "message" => "Deposit user account was not found."
            ], 404);
        }

        /*
         * Reject.
         *
         * Rejection does not change the wallet balance.
         */
        if ($action === "reject") {

            $now = new \MongoDB\BSON\UTCDateTime();

            $update = [
                '$set' => [
                    "status" => "rejected",
                    "rejected_at" => $now,
                    "updated_at" => $now,
                    "rejected_by" => $adminId
                ]
            ];

            /*
             * Atomic status transition prevents two admins from
             * processing the same pending deposit simultaneously.
             */
            $result = $deposits->findOneAndUpdate(
                [
                    "_id" => $objectId,
                    "status" => "pending"
                ],
                $update,
                [
                    "returnDocument" =>
                        \MongoDB\Operation\FindOneAndUpdate::RETURN_DOCUMENT_AFTER
                ]
            );

            if (!$result) {
                jsonResponse([
                    "success" => false,
                    "message" => "Deposit was already processed."
                ], 409);
            }

            /*
             * Update matching transaction if available.
             */
            if (isset($transactions)) {

                try {

                    $transactions->updateMany(
                        [
                            '$or' => [
                                ["deposit_id" => $objectId],
                                ["deposit_id" => $depositId],
                                ["reference" => safeString(
                                    $deposit->reference
                                    ?? $deposit->transaction_reference
                                    ?? ""
                                )]
                            ]
                        ],
                        [
                            '$set' => [
                                "status" => "rejected",
                                "updated_at" => $now
                            ]
                        ]
                    );

                } catch (Throwable $ignored) {
                }
            }

            /*
             * Audit log.
             */
            if (isset($audit_logs)) {

                try {

                    $audit_logs->insertOne([
                        "action" => "deposit_rejected",
                        "admin_id" => $adminId,
                        "deposit_id" => $objectId,
                        "user_id" => $depositUserId,
                        "created_at" => $now
                    ]);

                } catch (Throwable $ignored) {
                }
            }

            jsonResponse([
                "success" => true,
                "message" => "Deposit rejected successfully.",
                "status" => "rejected"
            ]);
        }

        /*
         * APPROVE
         *
         * IMPORTANT:
         * The code intentionally requires an explicit verification
         * confirmation from the admin request.
         *
         * This prevents a normal "Approve" request from automatically
         * treating a user-entered reference as proof of payment.
         */
        $paymentVerified = $data["payment_verified"] ?? false;

        if (
            $paymentVerified !== true &&
            $paymentVerified !== 1 &&
            $paymentVerified !== "1" &&
            $paymentVerified !== "true"
        ) {
            jsonResponse([
                "success" => false,
                "message" =>
                    "Payment must be independently verified before approval."
            ], 400);
        }

        /*
         * Validate amount.
         */
        $amount = toFloatValue(
            $deposit->amount ?? 0
        );

        if ($amount < 10000) {
            jsonResponse([
                "success" => false,
                "message" => "Invalid deposit amount."
            ], 400);
        }

        /*
         * Read current user balance.
         */
        $balance = toFloatValue(
            $user->balance
            ?? $user->wallet_balance
            ?? $user->available_balance
            ?? 0
        );

        /*
         * We use Decimal128 for wallet balance where supported.
         * The actual wallet update is conditional on the deposit still
         * being pending, preventing double-crediting.
         */
        $now = new \MongoDB\BSON\UTCDateTime();

        /*
         * Atomic deposit transition.
         *
         * The deposit must still be pending.
         */
        $approvedDeposit = $deposits->findOneAndUpdate(
            [
                "_id" => $objectId,
                "status" => "pending"
            ],
            [
                '$set' => [
                    "status" => "approved",
                    "approved_at" => $now,
                    "updated_at" => $now,
                    "approved_by" => $adminId
                ]
            ],
            [
                "returnDocument" =>
                    \MongoDB\Operation\FindOneAndUpdate::RETURN_DOCUMENT_AFTER
            ]
        );

        if (!$approvedDeposit) {
            jsonResponse([
                "success" => false,
                "message" =>
                    "Deposit was already processed by another request."
            ], 409);
        }

        /*
         * Update wallet.
         *
         * Because the deposit status was atomically changed from pending
         * to approved first, a second approval cannot reach this point.
         */
        try {

            $userUpdate = $users->updateOne(
                $userFilter,
                [
                    '$inc' => [
                        "balance" => $amount
                    ],
                    '$set' => [
                        "updated_at" => $now
                    ]
                ]
            );

            if ($userUpdate->getMatchedCount() !== 1) {

                /*
                 * The deposit was approved but wallet update failed.
                 * Do NOT silently create money. Mark the deposit as an
                 * approval error so it can be reconciled by an admin.
                 */
                $deposits->updateOne(
                    [
                        "_id" => $objectId,
                        "status" => "approved"
                    ],
                    [
                        '$set' => [
                            "status" => "approval_error",
                            "updated_at" => $now,
                            "approval_error" =>
                                "Wallet account could not be updated."
                        ]
                    ]
                );

                jsonResponse([
                    "success" => false,
                    "message" =>
                        "Deposit approval could not be completed because the wallet was not updated."
                ], 500);
            }

        } catch (Throwable $walletError) {

            /*
             * Attempt to mark the deposit as requiring reconciliation.
             */
            try {

                $deposits->updateOne(
                    [
                        "_id" => $objectId,
                        "status" => "approved"
                    ],
                    [
                        '$set' => [
                            "status" => "approval_error",
                            "updated_at" => $now,
                            "approval_error" =>
                                $walletError->getMessage()
                        ]
                    ]
                );

            } catch (Throwable $ignored) {
            }

            error_log(
                "Admin deposit wallet update error: "
                . $walletError->getMessage()
            );

            jsonResponse([
                "success" => false,
                "message" =>
                    "Deposit approval failed while updating the wallet."
            ], 500);
        }

        /*
         * Update related transaction.
         */
        if (isset($transactions)) {

            try {

                $reference = safeString(
                    $deposit->reference
                    ?? $deposit->transaction_reference
                    ?? ""
                );

                $transactionFilter = [
                    '$or' => [
                        ["deposit_id" => $objectId],
                        ["deposit_id" => $depositId]
                    ]
                ];

                if ($reference !== "") {
                    $transactionFilter["$or"][] = [
                        "reference" => $reference
                    ];
                }

                $transactions->updateMany(
                    $transactionFilter,
                    [
                        '$set' => [
                            "status" => "completed",
                            "updated_at" => $now
                        ]
                    ]
                );

            } catch (Throwable $ignored) {
            }
        }

        /*
         * Audit log.
         */
        if (isset($audit_logs)) {

            try {

                $audit_logs->insertOne([
                    "action" => "deposit_approved",
                    "admin_id" => $adminId,
                    "deposit_id" => $objectId,
                    "user_id" => $depositUserId,
                    "amount" => new \MongoDB\BSON\Decimal128(
                        (string)$amount
                    ),
                    "created_at" => $now
                ]);

            } catch (Throwable $ignored) {
            }
        }

        /*
         * New balance.
         */
        $newBalance = $balance + $amount;

        jsonResponse([
            "success" => true,
            "message" =>
                "Deposit approved and wallet credited.",
            "status" => "approved",
            "amount" => $amount,
            "new_balance" => $newBalance
        ]);
    }

    catch (Throwable $e) {

        error_log(
            "Admin deposits POST error: " . $e->getMessage()
        );

        jsonResponse([
            "success" => false,
            "message" => "Unable to process deposit.",
            "error" => $e->getMessage()
        ], 500);
    }
}

/*
|--------------------------------------------------------------------------
| Unsupported method
|--------------------------------------------------------------------------
*/

jsonResponse([
    "success" => false,
    "message" => "Method not allowed."
], 405);
?>

