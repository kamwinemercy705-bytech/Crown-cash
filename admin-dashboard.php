<?php

/* =========================================================
   CROWN CASH — ADMIN DASHBOARD API
   File: admin-dashboard.php
   ========================================================= */

declare(strict_types=1);


/* =========================================================
   SESSION
   ========================================================= */

session_set_cookie_params([
    "lifetime" => 0,
    "path" => "/",
    "secure" => true,
    "httponly" => true,
    "samesite" => "None"
]);

session_start();


/* =========================================================
   CORS
   ========================================================= */

header("Content-Type: application/json; charset=UTF-8");

header(
    "Access-Control-Allow-Origin: https://crown-cash.vercel.app"
);

header("Access-Control-Allow-Credentials: true");

header(
    "Access-Control-Allow-Methods: GET, OPTIONS"
);

header(
    "Access-Control-Allow-Headers: Content-Type, Authorization"
);


if ($_SERVER["REQUEST_METHOD"] === "OPTIONS") {
    http_response_code(204);
    exit;
}


/* =========================================================
   ONLY GET REQUESTS
   ========================================================= */

if ($_SERVER["REQUEST_METHOD"] !== "GET") {

    http_response_code(405);

    echo json_encode([
        "success" => false,
        "message" => "Method not allowed."
    ]);

    exit;
}


/* =========================================================
   ADMIN AUTHENTICATION
   ========================================================= */

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


/* =========================================================
   ADMIN ROLE CHECK
   ========================================================= */

$role = strtolower(
    trim((string)($_SESSION["role"] ?? ""))
);

if (
    $role !== "admin" &&
    $role !== "administrator"
) {

    http_response_code(403);

    echo json_encode([
        "success" => false,
        "message" => "Administrator access required."
    ]);

    exit;
}


/* =========================================================
   DATABASE
   ========================================================= */

try {

    require_once __DIR__ . "/config.php";

} catch (Throwable $e) {

    http_response_code(500);

    echo json_encode([
        "success" => false,
        "message" => "Unable to load database configuration."
    ]);

    exit;
}


/* =========================================================
   COLLECTION HELPERS
   ========================================================= */

function getCollection(
    string $name
) {

    global $database;

    global $users;
    global $investments;
    global $transactions;
    global $deposits;
    global $withdrawals;

    /*
     * If config.php already provides the collection,
     * use it.
     */

    if ($name === "users" && isset($users)) {
        return $users;
    }

    if ($name === "investments" && isset($investments)) {
        return $investments;
    }

    if ($name === "transactions" && isset($transactions)) {
        return $transactions;
    }

    if ($name === "deposits" && isset($deposits)) {
        return $deposits;
    }

    if ($name === "withdrawals" && isset($withdrawals)) {
        return $withdrawals;
    }

    /*
     * Otherwise use the MongoDB database object.
     */

    if (isset($database)) {
        return $database->selectCollection($name);
    }

    return null;
}


/* =========================================================
   NUMBER HELPER
   ========================================================= */

function numberValue($value): float
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

    return 0;
}


/* =========================================================
   DATE HELPER
   ========================================================= */

function dateValue($value): string
{
    try {

        if (
            $value instanceof MongoDB\BSON\UTCDateTime
        ) {

            return $value
                ->toDateTime()
                ->format("Y-m-d H:i:s");
        }

        if ($value instanceof DateTimeInterface) {
            return $value->format("Y-m-d H:i:s");
        }

        if (is_string($value) && trim($value) !== "") {

            $timestamp = strtotime($value);

            if ($timestamp !== false) {
                return date(
                    "Y-m-d H:i:s",
                    $timestamp
                );
            }
        }

    } catch (Throwable $e) {
        // Ignore invalid dates.
    }

    return "";
}


/* =========================================================
   STATUS COUNTER
   ========================================================= */

function countStatus(
    $collection,
    string $status
): int {

    if (!$collection) {
        return 0;
    }

    try {

        return $collection
            ->countDocuments([
                "status" => $status
            ]);

    } catch (Throwable $e) {

        return 0;
    }
}


/* =========================================================
   COLLECTIONS
   ========================================================= */

$usersCollection =
    getCollection("users");

$investmentsCollection =
    getCollection("investments");

$transactionsCollection =
    getCollection("transactions");

$depositsCollection =
    getCollection("deposits");

$withdrawalsCollection =
    getCollection("withdrawals");


/* =========================================================
   CHECK USERS COLLECTION
   ========================================================= */

if (!$usersCollection) {

    http_response_code(500);

    echo json_encode([
        "success" => false,
        "message" => "Users collection is not configured."
    ]);

    exit;
}


/* =========================================================
   MAIN DASHBOARD
   ========================================================= */

try {

    /* -----------------------------------------------------
       USER COUNTS
       ----------------------------------------------------- */

    $totalUsers =
        $usersCollection->countDocuments([]);

    $activeUsers =
        countStatus(
            $usersCollection,
            "active"
        );

    $pendingUsers =
        countStatus(
            $usersCollection,
            "pending"
        );

    $blockedUsers =
        countStatus(
            $usersCollection,
            "blocked"
        );


    /* -----------------------------------------------------
       BALANCE
       ----------------------------------------------------- */

    $totalBalance = 0;

    try {

        $balanceResult =
            $usersCollection->aggregate([
                [
                    '$group' => [
                        "_id" => null,
                        "total" => [
                            '$sum' => [
                                '$convert' => [
                                    "input" => '$balance',
                                    "to" => "double",
                                    "onError" => 0,
                                    "onNull" => 0
                                ]
                            ]
                        ]
                    ]
                ]
            ]);

        foreach ($balanceResult as $row) {

            $totalBalance =
                numberValue(
                    $row["total"] ?? 0
                );

            break;
        }

    } catch (Throwable $e) {

        $totalBalance = 0;
    }


    /* -----------------------------------------------------
       DEPOSITS
       ----------------------------------------------------- */

    $totalDeposits = 0;
    $pendingDeposits = 0;
    $approvedDeposits = 0;
    $rejectedDeposits = 0;
    $depositAmount = 0;

    if ($depositsCollection) {

        try {

            $totalDeposits =
                $depositsCollection->countDocuments([]);

            $pendingDeposits =
                countStatus(
                    $depositsCollection,
                    "pending"
                );

            $approvedDeposits =
                countStatus(
                    $depositsCollection,
                    "approved"
                );

            $rejectedDeposits =
                countStatus(
                    $depositsCollection,
                    "rejected"
                );


            $depositAggregation =
                $depositsCollection->aggregate([
                    [
                        '$match' => [
                            "status" => "approved"
                        ]
                    ],
                    [
                        '$group' => [
                            "_id" => null,
                            "total" => [
                                '$sum' => [
                                    '$convert' => [
                                        "input" => '$amount',
                                        "to" => "double",
                                        "onError" => 0,
                                        "onNull" => 0
                                    ]
                                ]
                            ]
                        ]
                    ]
                ]);

            foreach ($depositAggregation as $row) {

                $depositAmount =
                    numberValue(
                        $row["total"] ?? 0
                    );

                break;
            }

        } catch (Throwable $e) {

            $totalDeposits = 0;
        }
    }


    /* -----------------------------------------------------
       WITHDRAWALS
       ----------------------------------------------------- */

    $totalWithdrawals = 0;
    $pendingWithdrawals = 0;
    $approvedWithdrawals = 0;
    $rejectedWithdrawals = 0;
    $withdrawalAmount = 0;

    if ($withdrawalsCollection) {

        try {

            $totalWithdrawals =
                $withdrawalsCollection
                    ->countDocuments([]);

            $pendingWithdrawals =
                countStatus(
                    $withdrawalsCollection,
                    "pending"
                );

            $approvedWithdrawals =
                countStatus(
                    $withdrawalsCollection,
                    "approved"
                );

            $rejectedWithdrawals =
                countStatus(
                    $withdrawalsCollection,
                    "rejected"
                );


            $withdrawalAggregation =
                $withdrawalsCollection->aggregate([
                    [
                        '$match' => [
                            "status" => "approved"
                        ]
                    ],
                    [
                        '$group' => [
                            "_id" => null,
                            "total" => [
                                '$sum' => [
                                    '$convert' => [
                                        "input" => '$amount',
                                        "to" => "double",
                                        "onError" => 0,
                                        "onNull" => 0
                                    ]
                                ]
                            ]
                        ]
                    ]
                ]);

            foreach (
                $withdrawalAggregation
                as $row
            ) {

                $withdrawalAmount =
                    numberValue(
                        $row["total"] ?? 0
                    );

                break;
            }

        } catch (Throwable $e) {

            $totalWithdrawals = 0;
        }
    }


    /* -----------------------------------------------------
       INVESTMENTS
       ----------------------------------------------------- */

    $totalInvestments = 0;
    $pendingInvestments = 0;
    $activeInvestments = 0;
    $completedInvestments = 0;
    $investmentAmount = 0;

    if ($investmentsCollection) {

        try {

            $totalInvestments =
                $investmentsCollection
                    ->countDocuments([]);

            $pendingInvestments =
                countStatus(
                    $investmentsCollection,
                    "pending"
                );

            $activeInvestments =
                countStatus(
                    $investmentsCollection,
                    "active"
                );

            $completedInvestments =
                countStatus(
                    $investmentsCollection,
                    "completed"
                );


            $investmentAggregation =
                $investmentsCollection->aggregate([
                    [
                        '$group' => [
                            "_id" => null,
                            "total" => [
                                '$sum' => [
                                    '$convert' => [
                                        "input" => '$amount',
                                        "to" => "double",
                                        "onError" => 0,
                                        "onNull" => 0
                                    ]
                                ]
                            ]
                        ]
                    ]
                ]);

            foreach (
                $investmentAggregation
                as $row
            ) {

                $investmentAmount =
                    numberValue(
                        $row["total"] ?? 0
                    );

                break;
            }

        } catch (Throwable $e) {

            $totalInvestments = 0;
        }
    }


    /* -----------------------------------------------------
       TRANSACTIONS
       ----------------------------------------------------- */

    $totalTransactions = 0;

    if ($transactionsCollection) {

        try {

            $totalTransactions =
                $transactionsCollection
                    ->countDocuments([]);

        } catch (Throwable $e) {

            $totalTransactions = 0;
        }
    }


    /* =====================================================
       CURRENT ADMIN
       ===================================================== */

    $adminName = "Administrator";
    $adminEmail = "";

    try {

        $adminObjectId =
            new MongoDB\BSON\ObjectId(
                (string)$_SESSION["user_id"]
            );

        $admin =
            $usersCollection->findOne([
                "_id" => $adminObjectId
            ]);

        if ($admin) {

            $adminName =
                trim(
                    (string)(
                        $admin["full_name"]
                        ??
                        $admin["name"]
                        ??
                        "Administrator"
                    )
                );

            $adminEmail =
                (string)(
                    $admin["email"]
                    ?? ""
                );
        }

    } catch (Throwable $e) {
        // Keep default admin information.
    }


    /* =====================================================
       RECENT TRANSACTIONS
       ===================================================== */

    $recentTransactions = [];

    if ($transactionsCollection) {

        try {

            $cursor =
                $transactionsCollection->find(
                    [],
                    [
                        "sort" => [
                            "created_at" => -1,
                            "_id" => -1
                        ],
                        "limit" => 10
                    ]
                );

            foreach ($cursor as $transaction) {

                $transactionId = "";

                if (
                    isset($transaction["_id"])
                ) {

                    $transactionId =
                        (string)$transaction["_id"];
                }


                $transactionType =
                    strtolower(
                        (string)(
                            $transaction["type"]
                            ??
                            $transaction["transaction_type"]
                            ??
                            "transaction"
                        )
                    );


                $transactionStatus =
                    strtolower(
                        (string)(
                            $transaction["status"]
                            ??
                            "pending"
                        )
                    );


                $amount =
                    numberValue(
                        $transaction["amount"]
                        ?? 0
                    );


                $userId = "";

                if (
                    isset($transaction["user_id"])
                ) {

                    $userId =
                        (string)$transaction["user_id"];
                }


                $description =
                    (string)(
                        $transaction["description"]
                        ??
                        $transaction["reference"]
                        ??
                        ucfirst(
                            $transactionType
                        )
                    );


                $recentTransactions[] = [
                    "id" => $transactionId,
                    "_id" => $transactionId,
                    "user_id" => $userId,
                    "type" => $transactionType,
                    "transaction_type" =>
                        $transactionType,
                    "amount" => $amount,
                    "status" => $transactionStatus,
                    "description" => $description,
                    "reference" =>
                        (string)(
                            $transaction["reference"]
                            ?? ""
                        ),
                    "created_at" =>
                        dateValue(
                            $transaction["created_at"]
                            ?? null
                        )
                ];
            }

        } catch (Throwable $e) {

            $recentTransactions = [];
        }
    }


    /* =====================================================
       RECENT USERS
       ===================================================== */

    $recentUsers = [];

    try {

        $cursor =
            $usersCollection->find(
                [],
                [
                    "sort" => [
                        "created_at" => -1,
                        "_id" => -1
                    ],
                    "limit" => 5,

                    "projection" => [
                        "password" => 0,
                        "password_hash" => 0
                    ]
                ]
            );

        foreach ($cursor as $user) {

            $id = "";

            if (isset($user["_id"])) {
                $id = (string)$user["_id"];
            }


            $name =
                trim(
                    (string)(
                        $user["full_name"]
                        ??
                        $user["name"]
                        ??
                        ""
                    )
                );


            if ($name === "") {

                $first =
                    trim(
                        (string)(
                            $user["first_name"]
                            ?? ""
                        )
                    );

                $last =
                    trim(
                        (string)(
                            $user["last_name"]
                            ?? ""
                        )
                    );

                $name =
                    trim(
                        $first . " " . $last
                    );
            }


            if ($name === "") {
                $name = "Crown Cash User";
            }


            $recentUsers[] = [
                "id" => $id,
                "_id" => $id,
                "name" => $name,
                "full_name" => $name,
                "email" =>
                    (string)(
                        $user["email"]
                        ?? ""
                    ),
                "phone" =>
                    (string)(
                        $user["phone"]
                        ?? ""
                    ),
                "status" =>
                    strtolower(
                        (string)(
                            $user["status"]
                            ?? "active"
                        )
                    ),
                "account_type" =>
                    strtolower(
                        (string)(
                            $user["account_type"]
                            ??
                            $user["role"]
                            ??
                            "user"
                        )
                    ),
                "balance" =>
                    numberValue(
                        $user["balance"]
                        ?? 0
                    ),
                "created_at" =>
                    dateValue(
                        $user["created_at"]
                        ?? null
                    )
            ];
        }

    } catch (Throwable $e) {

        $recentUsers = [];
    }


    /* =====================================================
       RESPONSE
       ===================================================== */

    echo json_encode(
        [
            "success" => true,

            "admin" => [
                "id" =>
                    (string)(
                        $_SESSION["user_id"]
                        ?? ""
                    ),

                "name" =>
                    $adminName,

                "full_name" =>
                    $adminName,

                "email" =>
                    $adminEmail,

                "role" =>
                    $role
            ],

            "stats" => [

                "total_users" =>
                    (int)$totalUsers,

                "active_users" =>
                    (int)$activeUsers,

                "pending_users" =>
                    (int)$pendingUsers,

                "blocked_users" =>
                    (int)$blockedUsers,

                "total_balance" =>
                    $totalBalance,

                "total_deposits" =>
                    (int)$totalDeposits,

                "pending_deposits" =>
                    (int)$pendingDeposits,

                "approved_deposits" =>
                    (int)$approvedDeposits,

                "deposit_amount" =>
                    $depositAmount,

                "total_withdrawals" =>
                    (int)$totalWithdrawals,

                "pending_withdrawals" =>
                    (int)$pendingWithdrawals,

                "approved_withdrawals" =>
                    (int)$approvedWithdrawals,

                "withdrawal_amount" =>
                    $withdrawalAmount,

                "total_investments" =>
                    (int)$totalInvestments,

                "pending_investments" =>
                    (int)$pendingInvestments,

                "active_investments" =>
                    (int)$activeInvestments,

                "completed_investments" =>
                    (int)$completedInvestments,

                "investment_amount" =>
                    $investmentAmount,

                "total_transactions" =>
                    (int)$totalTransactions
            ],

            "users" =>
                $recentUsers,

            "recent_users" =>
                $recentUsers,

            "transactions" =>
                $recentTransactions,

            "recent_transactions" =>
                $recentTransactions
        ],

        JSON_UNESCAPED_SLASHES |
        JSON_UNESCAPED_UNICODE
    );

} catch (MongoDB\Driver\Exception\Exception $e) {

    http_response_code(500);

    echo json_encode([
        "success" => false,
        "message" => "Database error."
    ]);

} catch (Throwable $e) {

    http_response_code(500);

    echo json_encode([
        "success" => false,
        "message" => "Unable to load admin dashboard."
    ]);
}
?>