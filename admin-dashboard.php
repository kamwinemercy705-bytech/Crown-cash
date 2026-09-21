<?php

// ============================================================
// CROWN CASH - ADMIN DASHBOARD API
// File: admin-dashboard.php
// Backend: PHP + MongoDB
// Purpose: Read-only admin dashboard statistics
// ============================================================

declare(strict_types=1);

// ------------------------------------------------------------
// Error handling
// ------------------------------------------------------------

ini_set("display_errors", "0");
ini_set("log_errors", "1");
error_reporting(E_ALL);

// ------------------------------------------------------------
// CORS
// ------------------------------------------------------------

header("Content-Type: application/json; charset=utf-8");

header(
    "Access-Control-Allow-Origin: https://crown-cash.vercel.app"
);

header("Access-Control-Allow-Credentials: true");

header(
    "Access-Control-Allow-Methods: GET, OPTIONS"
);

header(
    "Access-Control-Allow-Headers: Content-Type"
);

// ------------------------------------------------------------
// OPTIONS
// ------------------------------------------------------------

if ($_SERVER["REQUEST_METHOD"] === "OPTIONS") {

    http_response_code(204);

    exit;
}

// ------------------------------------------------------------
// Only GET allowed
// ------------------------------------------------------------

if ($_SERVER["REQUEST_METHOD"] !== "GET") {

    http_response_code(405);

    echo json_encode([
        "success" => false,
        "message" => "Method not allowed."
    ]);

    exit;
}

// ------------------------------------------------------------
// Cross-site session
// ------------------------------------------------------------

if (session_status() === PHP_SESSION_NONE) {

    session_set_cookie_params([
        "lifetime" => 0,
        "path" => "/",
        "secure" => true,
        "httponly" => true,
        "samesite" => "None"
    ]);

    session_start();
}

// ------------------------------------------------------------
// Authentication
// ------------------------------------------------------------

if (
    !isset($_SESSION["logged_in"]) ||
    $_SESSION["logged_in"] !== true ||
    !isset($_SESSION["user_id"])
) {

    http_response_code(401);

    echo json_encode([
        "success" => false,
        "message" => "Please login first."
    ]);

    exit;
}

// ------------------------------------------------------------
// Admin role
// ------------------------------------------------------------

$sessionRole = strtolower(
    trim(
        (string)(
            $_SESSION["role"]
            ?? $_SESSION["account_type"]
            ?? ""
        )
    )
);

$allowedRoles = [
    "admin",
    "administrator"
];

if (!in_array($sessionRole, $allowedRoles, true)) {

    http_response_code(403);

    echo json_encode([
        "success" => false,
        "message" => "Administrator access required."
    ]);

    exit;
}

// ------------------------------------------------------------
// Load MongoDB configuration
// ------------------------------------------------------------

try {

    require_once __DIR__ . "/config.php";

} catch (Throwable $e) {

    error_log(
        "Admin dashboard config error: " .
        $e->getMessage()
    );

    http_response_code(500);

    echo json_encode([
        "success" => false,
        "message" => "Unable to load database configuration."
    ]);

    exit;
}


// ============================================================
// HELPER FUNCTIONS
// ============================================================

function ccNumber($value): float
{
    if ($value instanceof MongoDB\BSON\Decimal128) {
        return (float)$value->__toString();
    }

    if ($value instanceof MongoDB\BSON\Int64) {
        return (float)$value->__toString();
    }

    if (is_numeric($value)) {
        return (float)$value;
    }

    return 0.0;
}


function ccString($value): string
{
    if ($value === null) {
        return "";
    }

    if ($value instanceof MongoDB\BSON\ObjectId) {
        return (string)$value;
    }

    if ($value instanceof MongoDB\BSON\UTCDateTime) {
        return $value
            ->toDateTime()
            ->format("Y-m-d H:i:s");
    }

    if ($value instanceof MongoDB\BSON\Decimal128) {
        return $value->__toString();
    }

    return (string)$value;
}


function ccDate($value): string
{
    if ($value instanceof MongoDB\BSON\UTCDateTime) {

        return $value
            ->toDateTime()
            ->format("Y-m-d H:i:s");
    }

    if ($value instanceof DateTimeInterface) {

        return $value->format("Y-m-d H:i:s");
    }

    if (is_string($value) && trim($value) !== "") {

        return $value;
    }

    return "";
}


function ccId($value): string
{
    if ($value instanceof MongoDB\BSON\ObjectId) {
        return (string)$value;
    }

    return (string)$value;
}


function ccStatus($value): string
{
    $status = strtolower(
        trim(
            (string)$value
        )
    );

    return $status !== ""
        ? $status
        : "pending";
}


function ccUserName($user): string
{
    if (!$user) {
        return "Unknown User";
    }

    $fullName = trim(
        (string)($user["full_name"] ?? "")
    );

    if ($fullName !== "") {
        return $fullName;
    }

    $firstName = trim(
        (string)($user["first_name"] ?? "")
    );

    $lastName = trim(
        (string)($user["last_name"] ?? "")
    );

    $name = trim(
        $firstName . " " . $lastName
    );

    if ($name !== "") {
        return $name;
    }

    return "Unknown User";
}


function ccUserIdFromRecord($record): ?string
{
    $possibleFields = [
        "user_id",
        "userId",
        "userid",
        "account_id",
        "accountId"
    ];

    foreach ($possibleFields as $field) {

        if (!isset($record[$field])) {
            continue;
        }

        $value = $record[$field];

        if ($value instanceof MongoDB\BSON\ObjectId) {
            return (string)$value;
        }

        if (is_string($value) && trim($value) !== "") {
            return trim($value);
        }
    }

    return null;
}


function ccFindUser($users, $record)
{
    $userId = ccUserIdFromRecord($record);

    if ($userId === null) {
        return null;
    }

    try {

        if (
            preg_match(
                '/^[a-f0-9]{24}$/i',
                $userId
            )
        ) {

            $user = $users->findOne([
                "_id" =>
                    new MongoDB\BSON\ObjectId($userId)
            ]);

            if ($user) {
                return $user;
            }
        }

    } catch (Throwable $e) {
        // Continue to string lookup.
    }

    $possibleFields = [
        "user_id",
        "userId",
        "userid",
        "account_id",
        "accountId"
    ];

    foreach ($possibleFields as $field) {

        try {

            $user = $users->findOne([
                $field => $userId
            ]);

            if ($user) {
                return $user;
            }

        } catch (Throwable $e) {
            // Continue.
        }
    }

    return null;
}


// ============================================================
// MAIN DASHBOARD
// ============================================================

try {

    // --------------------------------------------------------
    // Get admin account
    // --------------------------------------------------------

    $admin = null;

    try {

        $adminId = new MongoDB\BSON\ObjectId(
            (string)$_SESSION["user_id"]
        );

        $admin = $users->findOne([
            "_id" => $adminId
        ]);

    } catch (Throwable $e) {

        $admin = null;
    }


    // ========================================================
    // USER STATISTICS
    // ========================================================

    $totalUsers =
        $users->countDocuments([]);

    $activeUsers =
        $users->countDocuments([
            "status" => [
                '$in' => [
                    "active",
                    "Active"
                ]
            ]
        ]);

    $pendingUsers =
        $users->countDocuments([
            "status" => [
                '$in' => [
                    "pending",
                    "Pending"
                ]
            ]
        ]);

    $blockedUsers =
        $users->countDocuments([
            "status" => [
                '$in' => [
                    "blocked",
                    "Blocked",
                    "suspended",
                    "Suspended",
                    "disabled",
                    "Disabled",
                    "banned",
                    "Banned"
                ]
            ]
        ]);


    // ========================================================
    // PLATFORM BALANCE
    // ========================================================

    /*
    |--------------------------------------------------------------------------
    | Platform balance is the sum of user balances.
    |--------------------------------------------------------------------------
    */

    $platformBalance = 0.0;

    $userBalanceCursor = $users->find(
        [],
        [
            "projection" => [
                "balance" => 1
            ]
        ]
    );

    foreach ($userBalanceCursor as $user) {

        $platformBalance += ccNumber(
            $user["balance"] ?? 0
        );
    }


    // ========================================================
    // DEPOSITS
    // ========================================================

    $approvedDepositTotal = 0.0;

    $pendingDepositTotal = 0.0;

    $rejectedDepositTotal = 0.0;

    $approvedDepositCount = 0;

    $pendingDepositCount = 0;

    $rejectedDepositCount = 0;


    $depositCursor = $deposits->find([]);

    foreach ($depositCursor as $deposit) {

        $amount = ccNumber(
            $deposit["amount"] ?? 0
        );

        $status = ccStatus(
            $deposit["status"] ?? "pending"
        );

        if (
            in_array(
                $status,
                [
                    "approved",
                    "completed",
                    "success",
                    "successful"
                ],
                true
            )
        ) {

            $approvedDepositTotal += $amount;

            $approvedDepositCount++;

        } elseif (
            in_array(
                $status,
                [
                    "rejected",
                    "failed",
                    "cancelled",
                    "canceled"
                ],
                true
            )
        ) {

            $rejectedDepositTotal += $amount;

            $rejectedDepositCount++;

        } else {

            $pendingDepositTotal += $amount;

            $pendingDepositCount++;
        }
    }


    // ========================================================
    // WITHDRAWALS
    // ========================================================

    $approvedWithdrawalTotal = 0.0;

    $pendingWithdrawalTotal = 0.0;

    $rejectedWithdrawalTotal = 0.0;

    $approvedWithdrawalCount = 0;

    $pendingWithdrawalCount = 0;

    $rejectedWithdrawalCount = 0;


    $withdrawalCursor = $withdrawals->find([]);

    foreach ($withdrawalCursor as $withdrawal) {

        $amount = ccNumber(
            $withdrawal["amount"] ?? 0
        );

        $status = ccStatus(
            $withdrawal["status"] ?? "pending"
        );

        if (
            in_array(
                $status,
                [
                    "approved",
                    "completed",
                    "success",
                    "successful"
                ],
                true
            )
        ) {

            $approvedWithdrawalTotal += $amount;

            $approvedWithdrawalCount++;

        } elseif (
            in_array(
                $status,
                [
                    "rejected",
                    "failed",
                    "cancelled",
                    "canceled"
                ],
                true
            )
        ) {

            $rejectedWithdrawalTotal += $amount;

            $rejectedWithdrawalCount++;

        } else {

            $pendingWithdrawalTotal += $amount;

            $pendingWithdrawalCount++;
        }
    }


    // ========================================================
    // INVESTMENTS
    // ========================================================

    $approvedInvestmentTotal = 0.0;

    $pendingInvestmentTotal = 0.0;

    $completedInvestmentTotal = 0.0;

    $approvedInvestmentCount = 0;

    $pendingInvestmentCount = 0;

    $completedInvestmentCount = 0;


    $investmentCursor = $investments->find([]);

    foreach ($investmentCursor as $investment) {

        $amount = ccNumber(
            $investment["amount"] ??
            $investment["investment_amount"] ??
            $investment["principal"] ??
            0
        );

        $status = ccStatus(
            $investment["status"] ?? "pending"
        );

        if (
            in_array(
                $status,
                [
                    "approved",
                    "active",
                    "running"
                ],
                true
            )
        ) {

            $approvedInvestmentTotal += $amount;

            $approvedInvestmentCount++;

        } elseif (
            in_array(
                $status,
                [
                    "completed",
                    "complete",
                    "matured"
                ],
                true
            )
        ) {

            $completedInvestmentTotal += $amount;

            $completedInvestmentCount++;

        } else {

            $pendingInvestmentTotal += $amount;

            $pendingInvestmentCount++;
        }
    }


    // ========================================================
    // RECENT USERS
    // ========================================================

    $recentUsers = [];

    $recentUserCursor = $users->find(
        [],
        [
            "sort" => [
                "created_at" => -1
            ],
            "limit" => 10,
            "projection" => [
                "password" => 0,
                "password_hash" => 0
            ]
        ]
    );

    foreach ($recentUserCursor as $user) {

        $recentUsers[] = [

            "id" =>
                ccId($user["_id"] ?? ""),

            "name" =>
                ccUserName($user),

            "full_name" =>
                ccUserName($user),

            "email" =>
                (string)($user["email"] ?? ""),

            "phone" =>
                (string)($user["phone"] ?? ""),

            "status" =>
                ccStatus($user["status"] ?? "active"),

            "role" =>
                (string)(
                    $user["role"] ??
                    $user["account_type"] ??
                    "user"
                ),

            "balance" =>
                ccNumber($user["balance"] ?? 0),

            "created_at" =>
                ccDate($user["created_at"] ?? "")
        ];
    }


    // ========================================================
    // RECENT TRANSACTIONS
    // ========================================================

    $recentTransactions = [];

    $transactionCursor = $transactions->find(
        [],
        [
            "sort" => [
                "created_at" => -1
            ],
            "limit" => 15
        ]
    );


    foreach ($transactionCursor as $transaction) {

        $user = ccFindUser(
            $users,
            $transaction
        );

        $amount = ccNumber(
            $transaction["amount"] ?? 0
        );

        $transactionType = strtolower(
            trim(
                (string)(
                    $transaction["type"] ??
                    $transaction["transaction_type"] ??
                    "transaction"
                )
            )
        );

        $status = ccStatus(
            $transaction["status"] ?? "pending"
        );

        $recentTransactions[] = [

            "id" =>
                ccId($transaction["_id"] ?? ""),

            "transaction_id" =>
                (string)(
                    $transaction["transaction_id"] ??
                    $transaction["reference"] ??
                    $transaction["ref"] ??
                    ccId($transaction["_id"] ?? "")
                ),

            "user_id" =>
                ccUserIdFromRecord($transaction),

            "user_name" =>
                ccUserName($user),

            "name" =>
                ccUserName($user),

            "type" =>
                $transactionType,

            "transaction_type" =>
                $transactionType,

            "amount" =>
                $amount,

            "status" =>
                $status,

            "method" =>
                (string)(
                    $transaction["method"] ??
                    $transaction["payment_method"] ??
                    ""
                ),

            "created_at" =>
                ccDate(
                    $transaction["created_at"] ??
                    $transaction["date"] ??
                    ""
                )
        ];
    }


    // ========================================================
    // FALLBACK TRANSACTIONS
    // ========================================================

    /*
    |--------------------------------------------------------------------------
    | If the transactions collection has no records,
    | show recent deposits and withdrawals.
    |--------------------------------------------------------------------------
    */

    if (count($recentTransactions) === 0) {

        $fallbackRecords = [];

        $recentDeposits = $deposits->find(
            [],
            [
                "sort" => [
                    "created_at" => -1
                ],
                "limit" => 10
            ]
        );

        foreach ($recentDeposits as $deposit) {

            $user = ccFindUser(
                $users,
                $deposit
            );

            $fallbackRecords[] = [

                "id" =>
                    ccId($deposit["_id"] ?? ""),

                "transaction_id" =>
                    (string)(
                        $deposit["reference"] ??
                        $deposit["transaction_reference"] ??
                        ccId($deposit["_id"] ?? "")
                    ),

                "user_id" =>
                    ccUserIdFromRecord($deposit),

                "user_name" =>
                    ccUserName($user),

                "name" =>
                    ccUserName($user),

                "type" =>
                    "deposit",

                "transaction_type" =>
                    "deposit",

                "amount" =>
                    ccNumber(
                        $deposit["amount"] ?? 0
                    ),

                "status" =>
                    ccStatus(
                        $deposit["status"] ?? "pending"
                    ),

                "method" =>
                    (string)(
                        $deposit["method"] ??
                        $deposit["payment_method"] ??
                        ""
                    ),

                "created_at" =>
                    ccDate(
                        $deposit["created_at"] ??
                        ""
                    )
            ];
        }


        $recentWithdrawals = $withdrawals->find(
            [],
            [
                "sort" => [
                    "created_at" => -1
                ],
                "limit" => 10
            ]
        );

        foreach ($recentWithdrawals as $withdrawal) {

            $user = ccFindUser(
                $users,
                $withdrawal
            );

            $fallbackRecords[] = [

                "id" =>
                    ccId($withdrawal["_id"] ?? ""),

                "transaction_id" =>
                    (string)(
                        $withdrawal["reference"] ??
                        $withdrawal["transaction_reference"] ??
                        ccId($withdrawal["_id"] ?? "")
                    ),

                "user_id" =>
                    ccUserIdFromRecord($withdrawal),

                "user_name" =>
                    ccUserName($user),

                "name" =>
                    ccUserName($user),

                "type" =>
                    "withdrawal",

                "transaction_type" =>
                    "withdrawal",

                "amount" =>
                    ccNumber(
                        $withdrawal["amount"] ?? 0
                    ),

                "status" =>
                    ccStatus(
                        $withdrawal["status"] ?? "pending"
                    ),

                "method" =>
                    (string)(
                        $withdrawal["method"] ??
                        $withdrawal["payment_method"] ??
                        ""
                    ),

                "created_at" =>
                    ccDate(
                        $withdrawal["created_at"] ??
                        ""
                    )
            ];
        }


        usort(
            $fallbackRecords,
            function ($a, $b) {

                return strcmp(
                    (string)$b["created_at"],
                    (string)$a["created_at"]
                );
            }
        );


        $recentTransactions =
            array_slice(
                $fallbackRecords,
                0,
                15
            );
    }


    // ========================================================
    // ADMIN INFORMATION
    // ========================================================

    $adminName = "Administrator";

    $adminEmail =
        (string)(
            $_SESSION["user_email"] ?? ""
        );

    if ($admin) {

        $adminName =
            ccUserName($admin);

        if ($adminEmail === "") {

            $adminEmail =
                (string)(
                    $admin["email"] ?? ""
                );
        }
    }


    // ========================================================
    // FINAL RESPONSE
    // ========================================================

    echo json_encode([

        "success" => true,

        "message" =>
            "Admin dashboard loaded successfully.",

        "admin" => [

            "id" =>
                (string)(
                    $_SESSION["user_id"] ?? ""
                ),

            "name" =>
                $adminName,

            "email" =>
                $adminEmail,

            "role" =>
                $sessionRole
        ],

        "stats" => [

            "total_users" =>
                $totalUsers,

            "active_users" =>
                $activeUsers,

            "pending_users" =>
                $pendingUsers,

            "blocked_users" =>
                $blockedUsers,

            "platform_balance" =>
                $platformBalance,

            "total_deposits" =>
                $approvedDepositTotal,

            "deposit_count" =>
                $approvedDepositCount,

            "pending_deposits" =>
                $pendingDepositTotal,

            "pending_deposit_count" =>
                $pendingDepositCount,

            "rejected_deposits" =>
                $rejectedDepositTotal,

            "rejected_deposit_count" =>
                $rejectedDepositCount,

            "total_withdrawals" =>
                $approvedWithdrawalTotal,

            "withdrawal_count" =>
                $approvedWithdrawalCount,

            "pending_withdrawals" =>
                $pendingWithdrawalTotal,

            "pending_withdrawal_count" =>
                $pendingWithdrawalCount,

            "rejected_withdrawals" =>
                $rejectedWithdrawalTotal,

            "rejected_withdrawal_count" =>
                $rejectedWithdrawalCount,

            "total_investments" =>
                $approvedInvestmentTotal +
                $completedInvestmentTotal,

            "investment_count" =>
                $approvedInvestmentCount +
                $completedInvestmentCount,

            "active_investments" =>
                $approvedInvestmentTotal,

            "active_investment_count" =>
                $approvedInvestmentCount,

            "pending_investments" =>
                $pendingInvestmentTotal,

            "pending_investment_count" =>
                $pendingInvestmentCount,

            "completed_investments" =>
                $completedInvestmentTotal,

            "completed_investment_count" =>
                $completedInvestmentCount
        ],

        "users" =>
            $recentUsers,

        "recent_users" =>
            $recentUsers,

        "transactions" =>
            $recentTransactions,

        "recent_transactions" =>
            $recentTransactions
    ]);


// ============================================================
// ERRORS
// ============================================================

} catch (MongoDB\Driver\Exception\Exception $e) {

    error_log(
        "Admin dashboard MongoDB error: " .
        $e->getMessage()
    );

    http_response_code(500);

    echo json_encode([
        "success" => false,
        "message" =>
            "Unable to load admin dashboard data."
    ]);

} catch (Throwable $e) {

    error_log(
        "Admin dashboard error: " .
        $e->getMessage()
    );

    http_response_code(500);

    echo json_encode([
        "success" => false,
        "message" =>
            "Unable to load admin dashboard."
    ]);
}

?>