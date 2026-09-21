<?php

declare(strict_types=1);

/*
|--------------------------------------------------------------------------
| Crown Cash - Admin Dashboard API
|--------------------------------------------------------------------------
| This endpoint is ADMIN ONLY.
|
| Security:
| - Requires authenticated PHP session
| - Requires role = admin
| - Session timeout handled by admin-auth.php
| - Read-only dashboard statistics
| - Never returns passwords
|--------------------------------------------------------------------------
*/

require_once __DIR__ . "/admin-auth.php";
require_once __DIR__ . "/config.php";


/* =========================
   HELPERS
========================= */

function mongoNumberToFloat($value): float
{
    if ($value instanceof MongoDB\BSON\Decimal128) {
        return (float)$value->__toString();
    }

    if ($value instanceof MongoDB\BSON\Int64) {
        return (float)$value->__toString();
    }

    if ($value instanceof MongoDB\BSON\Int32) {
        return (float)$value->__toString();
    }

    if (is_numeric($value)) {
        return (float)$value;
    }

    return 0.0;
}


function valueToString($value): string
{
    if ($value === null) {
        return "";
    }

    if ($value instanceof MongoDB\BSON\ObjectId) {
        return (string)$value;
    }

    if ($value instanceof MongoDB\BSON\Decimal128) {
        return $value->__toString();
    }

    if ($value instanceof MongoDB\BSON\Int64) {
        return $value->__toString();
    }

    if ($value instanceof MongoDB\BSON\Int32) {
        return (string)$value;
    }

    return (string)$value;
}


function formatDate($value): string
{
    if (
        $value instanceof MongoDB\BSON\UTCDateTime
    ) {
        return $value
            ->toDateTime()
            ->format(DATE_ATOM);
    }

    if ($value instanceof DateTimeInterface) {
        return $value->format(DATE_ATOM);
    }

    if (is_string($value) && trim($value) !== "") {
        return $value;
    }

    return "";
}


function getUserName($user): string
{
    if (!$user) {
        return "Unknown User";
    }

    $fullName =
        trim(
            valueToString(
                $user["full_name"] ?? ""
            )
        );

    if ($fullName !== "") {
        return $fullName;
    }

    $firstName =
        trim(
            valueToString(
                $user["first_name"] ?? ""
            )
        );

    $lastName =
        trim(
            valueToString(
                $user["last_name"] ?? ""
            )
        );

    $name =
        trim(
            $firstName . " " . $lastName
        );

    return $name !== ""
        ? $name
        : "Unknown User";
}


/* =========================
   FIND USER
========================= */

function findUserById(
    $users,
    $userId
) {

    if (
        $userId instanceof MongoDB\BSON\ObjectId
    ) {

        return $users->findOne([
            "_id" => $userId
        ]);
    }

    $id = valueToString($userId);

    if ($id === "") {
        return null;
    }

    try {

        $objectId =
            new MongoDB\BSON\ObjectId($id);

        return $users->findOne([
            "_id" => $objectId
        ]);

    } catch (Throwable $e) {

        return $users->findOne([
            "user_id" => $id
        ]);
    }
}


/* =========================
   GET STATUS TOTAL
========================= */

function getAmountByStatus(
    $collection,
    string $status
): float {

    $pipeline = [

        [
            '$match' => [
                "status" => $status
            ]
        ],

        [
            '$group' => [
                "_id" => null,
                "total" => [
                    '$sum' => '$amount'
                ]
            ]
        ]
    ];

    $result =
        $collection
            ->aggregate($pipeline)
            ->toArray();

    if (empty($result)) {
        return 0.0;
    }

    return mongoNumberToFloat(
        $result[0]["total"] ?? 0
    );
}


/* =========================
   GET COUNT BY STATUS
========================= */

function getCountByStatus(
    $collection,
    string $status
): int {

    return $collection->countDocuments([
        "status" => $status
    ]);
}


/* =========================
   USER COUNTS
========================= */

$totalUsers =
    $users->countDocuments();


$activeUsers =
    $users->countDocuments([
        "status" => "active"
    ]);


$pendingUsers =
    $users->countDocuments([
        "status" => "pending"
    ]);


$blockedUsers =
    $users->countDocuments([
        "status" => [
            '$in' => [
                "blocked",
                "suspended",
                "disabled"
            ]
        ]
    ]);


/* =========================
   PLATFORM BALANCE
========================= */

$balancePipeline = [

    [
        '$group' => [
            "_id" => null,
            "total" => [
                '$sum' => '$balance'
            ]
        ]
    ]
];


$balanceResult =
    $users
        ->aggregate($balancePipeline)
        ->toArray();


$platformBalance = 0.0;


if (!empty($balanceResult)) {

    $platformBalance =
        mongoNumberToFloat(
            $balanceResult[0]["total"] ?? 0
        );
}


/* =========================
   DEPOSIT TOTALS
========================= */

$depositApproved =
    getAmountByStatus(
        $deposits,
        "approved"
    );


$depositPending =
    getAmountByStatus(
        $deposits,
        "pending"
    );


$depositRejected =
    getAmountByStatus(
        $deposits,
        "rejected"
    );


$depositTotal =
    $depositApproved +
    $depositPending +
    $depositRejected;


/* =========================
   DEPOSIT COUNTS
========================= */

$depositApprovedCount =
    getCountByStatus(
        $deposits,
        "approved"
    );


$depositPendingCount =
    getCountByStatus(
        $deposits,
        "pending"
    );


$depositRejectedCount =
    getCountByStatus(
        $deposits,
        "rejected"
    );


/* =========================
   WITHDRAWAL TOTALS
========================= */

$withdrawApproved =
    getAmountByStatus(
        $withdrawals,
        "approved"
    );


$withdrawPending =
    getAmountByStatus(
        $withdrawals,
        "pending"
    );


$withdrawRejected =
    getAmountByStatus(
        $withdrawals,
        "rejected"
    );


$withdrawTotal =
    $withdrawApproved +
    $withdrawPending +
    $withdrawRejected;


/* =========================
   WITHDRAWAL COUNTS
========================= */

$withdrawApprovedCount =
    getCountByStatus(
        $withdrawals,
        "approved"
    );


$withdrawPendingCount =
    getCountByStatus(
        $withdrawals,
        "pending"
    );


$withdrawRejectedCount =
    getCountByStatus(
        $withdrawals,
        "rejected"
    );


/* =========================
   INVESTMENT TOTALS
========================= */

$investmentActive =
    getAmountByStatus(
        $investments,
        "active"
    );


$investmentPending =
    getAmountByStatus(
        $investments,
        "pending"
    );


$investmentCompleted =
    getAmountByStatus(
        $investments,
        "completed"
    );


$investmentTotal =
    $investmentActive +
    $investmentPending +
    $investmentCompleted;


/* =========================
   INVESTMENT COUNTS
========================= */

$investmentActiveCount =
    getCountByStatus(
        $investments,
        "active"
    );


$investmentPendingCount =
    getCountByStatus(
        $investments,
        "pending"
    );


$investmentCompletedCount =
    getCountByStatus(
        $investments,
        "completed"
    );


/* =========================
   RECENT USERS
========================= */

$recentUsers = [];


$userCursor =
    $users->find(
        [],
        [
            "sort" => [
                "created_at" => -1
            ],

            "limit" => 8,

            "projection" => [
                "password" => 0,
                "password_hash" => 0
            ]
        ]
    );


foreach ($userCursor as $user) {

    $recentUsers[] = [

        "id" =>
            isset($user["_id"])
                ? valueToString($user["_id"])
                : "",

        "full_name" =>
            getUserName($user),

        "email" =>
            valueToString(
                $user["email"] ?? ""
            ),

        "phone" =>
            valueToString(
                $user["phone"] ?? ""
            ),

        "status" =>
            valueToString(
                $user["status"] ?? "active"
            ),

        "role" =>
            valueToString(
                $user["role"] ??
                $user["account_type"] ??
                "user"
            ),

        "balance" =>
            mongoNumberToFloat(
                $user["balance"] ?? 0
            ),

        "created_at" =>
            formatDate(
                $user["created_at"] ?? null
            )
    ];
}


/* =========================
   RECENT TRANSACTIONS
========================= */

$recentTransactions = [];


$transactionCursor =
    $transactions->find(
        [],
        [
            "sort" => [
                "created_at" => -1
            ],

            "limit" => 10
        ]
    );


foreach ($transactionCursor as $transaction) {

    $user = null;


    if (isset($transaction["user_id"])) {

        $user =
            findUserById(
                $users,
                $transaction["user_id"]
            );
    }


    $recentTransactions[] = [

        "id" =>
            isset($transaction["_id"])
                ? valueToString(
                    $transaction["_id"]
                )
                : "",

        "user_id" =>
            isset($transaction["user_id"])
                ? valueToString(
                    $transaction["user_id"]
                )
                : "",

        "user_name" =>
            getUserName($user),

        "type" =>
            valueToString(
                $transaction["type"] ??
                $transaction["transaction_type"] ??
                "transaction"
            ),

        "amount" =>
            mongoNumberToFloat(
                $transaction["amount"] ?? 0
            ),

        "status" =>
            valueToString(
                $transaction["status"] ??
                "pending"
            ),

        "reference" =>
            valueToString(
                $transaction["reference"] ??
                $transaction["transaction_reference"] ??
                ""
            ),

        "created_at" =>
            formatDate(
                $transaction["created_at"] ?? null
            )
    ];
}


/* =========================
   RESPONSE
========================= */

echo json_encode([

    "success" => true,

    "authenticated" => true,

    "authorized" => true,

    "admin" => [

        "user_id" =>
            (string)($_SESSION["user_id"] ?? ""),

        "email" =>
            (string)($_SESSION["user_email"] ?? ""),

        "role" =>
            (string)($_SESSION["role"] ?? "admin")
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

        "deposits_total" =>
            $depositTotal,

        "deposits_approved" =>
            $depositApproved,

        "deposits_pending" =>
            $depositPending,

        "deposits_rejected" =>
            $depositRejected,

        "deposits_approved_count" =>
            $depositApprovedCount,

        "deposits_pending_count" =>
            $depositPendingCount,

        "deposits_rejected_count" =>
            $depositRejectedCount,

        "withdrawals_total" =>
            $withdrawTotal,

        "withdrawals_approved" =>
            $withdrawApproved,

        "withdrawals_pending" =>
            $withdrawPending,

        "withdrawals_rejected" =>
            $withdrawRejected,

        "withdrawals_approved_count" =>
            $withdrawApprovedCount,

        "withdrawals_pending_count" =>
            $withdrawPendingCount,

        "withdrawals_rejected_count" =>
            $withdrawRejectedCount,

        "investments_total" =>
            $investmentTotal,

        "investments_active" =>
            $investmentActive,

        "investments_pending" =>
            $investmentPending,

        "investments_completed" =>
            $investmentCompleted,

        "investments_active_count" =>
            $investmentActiveCount,

        "investments_pending_count" =>
            $investmentPendingCount,

        "investments_completed_count" =>
            $investmentCompletedCount
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

exit;
?>