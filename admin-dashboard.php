<?php

/* =========================================================
   CROWN CASH
   ADMIN DASHBOARD API
   admin-dashboard.php
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
   HEADERS
   ========================================================= */

header("Content-Type: application/json; charset=UTF-8");

header(
    "Access-Control-Allow-Origin: https://crown-cash.vercel.app"
);

header(
    "Access-Control-Allow-Credentials: true"
);

header(
    "Access-Control-Allow-Methods: GET, OPTIONS"
);

header(
    "Access-Control-Allow-Headers: Content-Type"
);


/* =========================================================
   CORS PREFLIGHT
   ========================================================= */

if ($_SERVER["REQUEST_METHOD"] === "OPTIONS") {

    http_response_code(204);

    exit;
}


/* =========================================================
   ONLY GET ALLOWED
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
   RESPONSE HELPER
   ========================================================= */

function respond(
    array $data,
    int $status = 200
) {

    http_response_code($status);

    echo json_encode(
        $data,
        JSON_UNESCAPED_SLASHES
    );

    exit;
}


/* =========================================================
   ADMIN SESSION CHECK
   ========================================================= */

if (
    !isset($_SESSION["logged_in"]) ||
    $_SESSION["logged_in"] !== true ||
    !isset($_SESSION["user_id"])
) {

    respond([
        "success" => false,
        "message" => "Please login first."
    ], 401);
}


/* =========================================================
   ADMIN ROLE CHECK
   ========================================================= */

$sessionRole =
    strtolower(
        trim(
            (string)(
                $_SESSION["role"] ??
                ""
            )
        )
    );


$allowedRoles = [
    "admin",
    "administrator"
];


if (
    !in_array(
        $sessionRole,
        $allowedRoles,
        true
    )
) {

    respond([
        "success" => false,
        "message" => "Administrator access required."
    ], 403);
}


/* =========================================================
   DATABASE
   ========================================================= */

require_once __DIR__ . "/config.php";


/* =========================================================
   GET COLLECTIONS
   ========================================================= */

try {

    /*
     * The existing config.php normally provides:
     *
     * $database
     * $users
     * $investments
     * $transactions
     *
     * We also safely obtain collections directly from
     * $database when available.
     */

    if (
        !isset($database) &&
        !isset($users)
    ) {

        respond([
            "success" => false,
            "message" => "Database configuration is unavailable."
        ], 500);
    }


    /* -----------------------------------------------------
       USERS
       ----------------------------------------------------- */

    if (!isset($users)) {

        if (
            isset($database)
        ) {

            $users =
                $database->users;

        } else {

            respond([
                "success" => false,
                "message" => "Users collection is unavailable."
            ], 500);
        }
    }


    /* -----------------------------------------------------
       INVESTMENTS
       ----------------------------------------------------- */

    if (!isset($investments)) {

        if (isset($database)) {

            $investments =
                $database->investments;

        } else {

            $investments = null;
        }
    }


    /* -----------------------------------------------------
       TRANSACTIONS
       ----------------------------------------------------- */

    if (!isset($transactions)) {

        if (isset($database)) {

            $transactions =
                $database->transactions;

        } else {

            $transactions = null;
        }
    }


    /* -----------------------------------------------------
       DEPOSITS
       ----------------------------------------------------- */

    if (isset($database)) {

        $deposits =
            $database->deposits;

    } else {

        $deposits = null;
    }


    /* -----------------------------------------------------
       WITHDRAWALS
       ----------------------------------------------------- */

    if (isset($database)) {

        $withdrawals =
            $database->withdrawals;

    } else {

        $withdrawals = null;
    }


    /* =====================================================
       USER COUNTS
       ===================================================== */

    $totalUsers =
        $users->countDocuments([]);


    $activeUsers =
        $users->countDocuments([
            "status" => [
                '$in' => [
                    "active",
                    "approved",
                    "enabled"
                ]
            ]
        ]);


    $pendingUsers =
        $users->countDocuments([
            "status" => [
                '$in' => [
                    "pending",
                    "pending_approval"
                ]
            ]
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


    /* =====================================================
       TOTAL BALANCE
       ===================================================== */

    $totalBalance = 0;


    try {

        $balanceResult =
            $users->aggregate([
                [
                    '$group' => [
                        "_id" => null,
                        "total" => [
                            '$sum' => [
                                '$convert' => [
                                    "input" => [
                                        '$ifNull' => [
                                            '$balance',
                                            0
                                        ]
                                    ],
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
            $balanceResult as $row
        ) {

            $totalBalance =
                (float)(
                    $row["total"] ?? 0
                );

            break;
        }

    } catch (Exception $e) {

        $totalBalance = 0;
    }


    /* =====================================================
       DEPOSIT STATISTICS
       ===================================================== */

    $totalDeposits = 0;

    $approvedDeposits = 0;

    $pendingDeposits = 0;

    $rejectedDeposits = 0;


    if ($deposits !== null) {

        try {

            $totalDeposits =
                $deposits->countDocuments([]);

            $approvedDeposits =
                $deposits->countDocuments([
                    "status" => [
                        '$in' => [
                            "approved",
                            "completed"
                        ]
                    ]
                ]);

            $pendingDeposits =
                $deposits->countDocuments([
                    "status" => "pending"
                ]);

            $rejectedDeposits =
                $deposits->countDocuments([
                    "status" => [
                        '$in' => [
                            "rejected",
                            "failed"
                        ]
                    ]
                ]);

        } catch (Exception $e) {

            $totalDeposits = 0;
            $approvedDeposits = 0;
            $pendingDeposits = 0;
            $rejectedDeposits = 0;
        }
    }


    /* =====================================================
       WITHDRAWAL STATISTICS
       ===================================================== */

    $totalWithdrawals = 0;

    $approvedWithdrawals = 0;

    $pendingWithdrawals = 0;

    $rejectedWithdrawals = 0;


    if ($withdrawals !== null) {

        try {

            $totalWithdrawals =
                $withdrawals->countDocuments([]);

            $approvedWithdrawals =
                $withdrawals->countDocuments([
                    "status" => [
                        '$in' => [
                            "approved",
                            "completed"
                        ]
                    ]
                ]);

            $pendingWithdrawals =
                $withdrawals->countDocuments([
                    "status" => "pending"
                ]);

            $rejectedWithdrawals =
                $withdrawals->countDocuments([
                    "status" => [
                        '$in' => [
                            "rejected",
                            "failed"
                        ]
                    ]
                ]);

        } catch (Exception $e) {

            $totalWithdrawals = 0;
            $approvedWithdrawals = 0;
            $pendingWithdrawals = 0;
            $rejectedWithdrawals = 0;
        }
    }


    /* =====================================================
       INVESTMENT STATISTICS
       ===================================================== */

    $totalInvestments = 0;

    $activeInvestments = 0;

    $pendingInvestments = 0;

    $completedInvestments = 0;


    if ($investments !== null) {

        try {

            $totalInvestments =
                $investments->countDocuments([]);

            $activeInvestments =
                $investments->countDocuments([
                    "status" => [
                        '$in' => [
                            "active",
                            "running"
                        ]
                    ]
                ]);

            $pendingInvestments =
                $investments->countDocuments([
                    "status" => "pending"
                ]);

            $completedInvestments =
                $investments->countDocuments([
                    "status" => [
                        '$in' => [
                            "completed",
                            "complete"
                        ]
                    ]
                ]);

        } catch (Exception $e) {

            $totalInvestments = 0;
            $activeInvestments = 0;
            $pendingInvestments = 0;
            $completedInvestments = 0;
        }
    }


    /* =====================================================
       TRANSACTION COUNT
       ===================================================== */

    $totalTransactions = 0;


    if ($transactions !== null) {

        try {

            $totalTransactions =
                $transactions->countDocuments([]);

        } catch (Exception $e) {

            $totalTransactions = 0;
        }
    }


    /* =====================================================
       RECENT TRANSACTIONS
       ===================================================== */

    $recentTransactions = [];


    if ($transactions !== null) {

        try {

            $cursor =
                $transactions->find(
                    [],
                    [
                        "sort" => [
                            "created_at" => -1
                        ],
                        "limit" => 10
                    ]
                );


            foreach (
                $cursor as $transaction
            ) {

                $recentTransactions[] =
                    formatTransaction(
                        $transaction,
                        $users
                    );
            }

        } catch (Exception $e) {

            $recentTransactions = [];
        }
    }


    /* =====================================================
       RECENT USERS
       ===================================================== */

    $recentUsers = [];


    try {

        $cursor =
            $users->find(
                [],
                [
                    "projection" => [
                        "password" => 0,
                        "password_hash" => 0
                    ],
                    "sort" => [
                        "created_at" => -1
                    ],
                    "limit" => 5
                ]
            );


        foreach (
            $cursor as $user
        ) {

            $recentUsers[] =
                formatUser(
                    $user
                );
        }

    } catch (Exception $e) {

        $recentUsers = [];
    }


    /* =====================================================
       ADMIN INFORMATION
       ===================================================== */

    $adminInformation = [];


    try {

        $adminId =
            new MongoDB\BSON\ObjectId(
                $_SESSION["user_id"]
            );


        $adminUser =
            $users->findOne(
                [
                    "_id" => $adminId
                ],
                [
                    "projection" => [
                        "password" => 0,
                        "password_hash" => 0
                    ]
                ]
            );


        if ($adminUser) {

            $adminInformation =
                formatUser(
                    $adminUser
                );
        }

    } catch (Exception $e) {

        $adminInformation = [
            "name" =>
                $_SESSION["user_email"] ??
                "Administrator",

            "email" =>
                $_SESSION["user_email"] ??
                ""
        ];
    }


    /* =====================================================
       FINAL RESPONSE
       ===================================================== */

    respond([
        "success" => true,

        "admin" => $adminInformation,

        "stats" => [

            "total_users" =>
                $totalUsers,

            "active_users" =>
                $activeUsers,

            "pending_users" =>
                $pendingUsers,

            "blocked_users" =>
                $blockedUsers,

            "total_balance" =>
                $totalBalance,

            "total_deposits" =>
                $totalDeposits,

            "approved_deposits" =>
                $approvedDeposits,

            "pending_deposits" =>
                $pendingDeposits,

            "rejected_deposits" =>
                $rejectedDeposits,

            "total_withdrawals" =>
                $totalWithdrawals,

            "approved_withdrawals" =>
                $approvedWithdrawals,

            "pending_withdrawals" =>
                $pendingWithdrawals,

            "rejected_withdrawals" =>
                $rejectedWithdrawals,

            "total_investments" =>
                $totalInvestments,

            "active_investments" =>
                $activeInvestments,

            "pending_investments" =>
                $pendingInvestments,

            "completed_investments" =>
                $completedInvestments,

            "total_transactions" =>
                $totalTransactions
        ],

        "users" => [
            "total" =>
                $totalUsers,

            "active" =>
                $activeUsers,

            "pending" =>
                $pendingUsers,

            "blocked" =>
                $blockedUsers,

            "recent" =>
                $recentUsers
        ],

        "transactions" =>
            $recentTransactions,

        "recent_transactions" =>
            $recentTransactions,

        "message" =>
            "Admin dashboard loaded successfully."

    ]);

} catch (
    MongoDB\Driver\Exception\Exception $e
) {

    error_log(
        "Crown Cash admin dashboard MongoDB error: " .
        $e->getMessage()
    );


    respond([
        "success" => false,
        "message" => "Database error."
    ], 500);

} catch (Throwable $e) {

    error_log(
        "Crown Cash admin dashboard error: " .
        $e->getMessage()
    );


    respond([
        "success" => false,
        "message" =>
            "Unable to load admin dashboard."
    ], 500);
}


/* =========================================================
   FORMAT USER
   ========================================================= */

function formatUser(
    $user
) {

    $id = "";

    if (
        isset($user["_id"])
    ) {

        $id =
            (string)$user["_id"];
    }


    $fullName =
        trim(
            (string)(
                $user["full_name"] ??
                ""
            )
        );


    if (
        $fullName === ""
    ) {

        $first =
            trim(
                (string)(
                    $user["first_name"] ??
                    ""
                )
            );

        $last =
            trim(
                (string)(
                    $user["last_name"] ??
                    ""
                )
            );

        $fullName =
            trim(
                $first . " " . $last
            );
    }


    if (
        $fullName === ""
    ) {

        $fullName =
            "User";
    }


    $balance =
        numericValue(
            $user["balance"] ?? 0
        );


    return [

        "id" =>
            $id,

        "_id" =>
            $id,

        "name" =>
            $fullName,

        "full_name" =>
            $fullName,

        "first_name" =>
            (string)(
                $user["first_name"] ??
                ""
            ),

        "last_name" =>
            (string)(
                $user["last_name"] ??
                ""
            ),

        "email" =>
            (string)(
                $user["email"] ??
                ""
            ),

        "phone" =>
            (string)(
                $user["phone"] ??
                ""
            ),

        "balance" =>
            $balance,

        "status" =>
            (string)(
                $user["status"] ??
                "active"
            ),

        "account_type" =>
            (string)(
                $user["account_type"] ??
                $user["role"] ??
                "user"
            ),

        "role" =>
            (string)(
                $user["role"] ??
                $user["account_type"] ??
                "user"
            ),

        "referral_code" =>
            (string)(
                $user["referral_code"] ??
                ""
            ),

        "created_at" =>
            formatDateValue(
                $user["created_at"] ??
                null
            )
    ];
}


/* =========================================================
   FORMAT TRANSACTION
   ========================================================= */

function formatTransaction(
    $transaction,
    $users
) {

    $id = "";

    if (
        isset($transaction["_id"])
    ) {

        $id =
            (string)$transaction["_id"];
    }


    $userName =
        (string)(
            $transaction["user_name"] ??
            $transaction["full_name"] ??
            ""
        );


    $email =
        (string)(
            $transaction["email"] ??
            ""
        );


    /* -----------------------------------------------------
       FIND USER IF TRANSACTION HAS USER ID
       ----------------------------------------------------- */

    if (
        (
            $userName === "" ||
            $email === ""
        ) &&
        isset(
            $transaction["user_id"]
        )
    ) {

        try {

            $userId =
                $transaction["user_id"];


            if (
                $userId instanceof
                MongoDB\BSON\ObjectId
            ) {

                $targetId =
                    $userId;

            } else {

                $targetId =
                    new MongoDB\BSON\ObjectId(
                        (string)$userId
                    );
            }


            $user =
                $users->findOne([
                    "_id" =>
                        $targetId
                ]);


            if ($user) {

                $userName =
                    trim(
                        (string)(
                            $user["full_name"] ??
                            ""
                        )
                    );


                if (
                    $userName === ""
                ) {

                    $userName =
                        trim(
                            (
                                string
                                (
                                    $user["first_name"] ??
                                    ""
                                )
                            ) .
                            " " .
                            (
                                string
                                (
                                    $user["last_name"] ??
                                    ""
                                )
                            )
                        );
                }


                $email =
                    (string)(
                        $user["email"] ??
                        ""
                    );
            }

        } catch (Exception $e) {
            /* Ignore invalid user ID */
        }
    }


    if (
        $userName === ""
    ) {

        $userName =
            "User";
    }


    return [

        "id" =>
            $id,

        "_id" =>
            $id,

        "type" =>
            (string)(
                $transaction["type"] ??
                $transaction["transaction_type"] ??
                "transaction"
            ),

        "transaction_type" =>
            (string)(
                $transaction["transaction_type"] ??
                $transaction["type"] ??
                "transaction"
            ),

        "amount" =>
            numericValue(
                $transaction["amount"] ??
                0
            ),

        "status" =>
            (string)(
                $transaction["status"] ??
                "pending"
            ),

        "reference" =>
            (string)(
                $transaction["reference"] ??
                $transaction["transaction_reference"] ??
                ""
            ),

        "transaction_reference" =>
            (string)(
                $transaction["transaction_reference"] ??
                $transaction["reference"] ??
                ""
            ),

        "user_id" =>
            isset(
                $transaction["user_id"]
            )
                ? (string)(
                    $transaction["user_id"]
                )
                : "",

        "user_name" =>
            $userName,

        "full_name" =>
            $userName,

        "email" =>
            $email,

        "method" =>
            (string)(
                $transaction["method"] ??
                ""
            ),

        "created_at" =>
            formatDateValue(
                $transaction["created_at"] ??
                $transaction["date"] ??
                null
            )
    ];
}


/* =========================================================
   NUMERIC VALUE
   ========================================================= */

function numericValue(
    $value
) {

    if (
        $value instanceof
        MongoDB\BSON\Decimal128
    ) {

        return (float)(
            $value->__toString()
        );
    }


    if (
        $value instanceof
        MongoDB\BSON\Int64
    ) {

        return (float)(
            $value->__toString()
        );
    }


    if (
        $value instanceof
        MongoDB\BSON\Int32
    ) {

        return (float)(
            $value->value
        );
    }


    if (
        $value instanceof
        MongoDB\BSON\Double
    ) {

        return (float)$value;
    }


    if (
        is_numeric($value)
    ) {

        return (float)$value;
    }


    return 0;
}


/* =========================================================
   DATE FORMAT
   ========================================================= */

function formatDateValue(
    $value
) {

    if (!$value) {
        return "";
    }


    try {

        if (
            $value instanceof
            MongoDB\BSON\UTCDateTime
        ) {

            return $value
                ->toDateTime()
                ->format(
                    "c"
                );
        }


        if (
            $value instanceof
            DateTimeInterface
        ) {

            return $value
                ->format(
                    "c"
                );
        }


        return (string)$value;

    } catch (Exception $e) {

        return "";
    }
}
?>