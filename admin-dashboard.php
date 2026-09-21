<?php

/* =========================================================
   CROWN CASH
   ADMIN DASHBOARD API
   ========================================================= */

header("Content-Type: application/json");

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
   SESSION COOKIE
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
   OPTIONS
========================================================= */

if (
    $_SERVER["REQUEST_METHOD"] === "OPTIONS"
) {

    http_response_code(204);

    exit;
}


/* =========================================================
   GET ONLY
========================================================= */

if (
    $_SERVER["REQUEST_METHOD"] !== "GET"
) {

    http_response_code(405);

    echo json_encode([
        "success" => false,
        "message" => "Method not allowed."
    ]);

    exit;
}


/* =========================================================
   LOGIN CHECK
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
   ADMIN CHECK
========================================================= */

$role =
    strtolower(
        trim(
            (string)(
                $_SESSION["role"] ?? ""
            )
        )
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

require_once __DIR__ . "/config.php";


/* =========================================================
   HELPERS
========================================================= */

function adminRespond(
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


function numberValue($value): float
{

    if (
        $value instanceof MongoDB\BSON\Decimal128
    ) {

        return (float)
            $value->__toString();

    }


    if (
        $value instanceof MongoDB\BSON\Int64
    ) {

        return (float)
            $value->__toString();

    }


    if (
        $value instanceof MongoDB\BSON\Int32
    ) {

        return (float)
            $value->__toString();

    }


    return (float)$value;
}


function dateValue($value): ?string
{

    if (
        $value instanceof MongoDB\BSON\UTCDateTime
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
        trim($value) !== ""
    ) {

        return $value;

    }


    return null;
}


/* =========================================================
   COLLECTIONS
========================================================= */

try {

    if (!isset($users)) {

        if (
            isset($database) &&
            $database
        ) {

            $users =
                $database->users;

        } else {

            adminRespond(
                [
                    "success" => false,
                    "message" =>
                        "Users collection is not configured."
                ],
                500
            );

        }

    }


    if (!isset($investments)) {

        if (
            isset($database) &&
            $database
        ) {

            $investments =
                $database->investments;

        }

    }


    if (!isset($transactions)) {

        if (
            isset($database) &&
            $database
        ) {

            $transactions =
                $database->transactions;

        }

    }


    if (!isset($deposits)) {

        if (
            isset($database) &&
            $database
        ) {

            $deposits =
                $database->deposits;

        }

    }


    if (!isset($withdrawals)) {

        if (
            isset($database) &&
            $database
        ) {

            $withdrawals =
                $database->withdrawals;

        }

    }


    /* =====================================================
       USER COUNTS
    ====================================================== */

    $totalUsers =
        $users->countDocuments([]);


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
            "status" => "blocked"
        ]);


    /* =====================================================
       TOTAL BALANCE
    ====================================================== */

    $totalBalance = 0;


    $balanceCursor =
        $users->find(
            [],
            [
                "projection" => [
                    "balance" => 1
                ]
            ]
        );


    foreach (
        $balanceCursor as $balanceUser
    ) {

        $totalBalance +=
            numberValue(
                $balanceUser["balance"] ?? 0
            );

    }


    /* =====================================================
       DEPOSITS
    ====================================================== */

    $totalDeposits = 0;


    if (isset($deposits)) {

        $totalDeposits =
            $deposits->countDocuments([]);

    } elseif (
        isset($transactions)
    ) {

        $totalDeposits =
            $transactions->countDocuments([
                "type" => "deposit"
            ]);

    }


    /* =====================================================
       WITHDRAWALS
    ====================================================== */

    $totalWithdrawals = 0;


    if (isset($withdrawals)) {

        $totalWithdrawals =
            $withdrawals->countDocuments([]);

    } elseif (
        isset($transactions)
    ) {

        $totalWithdrawals =
            $transactions->countDocuments([
                "type" => "withdrawal"
            ]);

    }


    /* =====================================================
       INVESTMENTS
    ====================================================== */

    $totalInvestments = 0;


    if (isset($investments)) {

        $totalInvestments =
            $investments->countDocuments([]);

    } elseif (
        isset($transactions)
    ) {

        $totalInvestments =
            $transactions->countDocuments([
                "type" => "investment"
            ]);

    }


    /* =====================================================
       RECENT TRANSACTIONS
    ====================================================== */

    $recentTransactions = [];


    if (isset($transactions)) {

        $cursor =
            $transactions->find(
                [],
                [
                    "sort" => [
                        "created_at" => -1
                    ],
                    "limit" => 5
                ]
            );


        foreach (
            $cursor as $transaction
        ) {

            $type =
                (string)(
                    $transaction["type"] ??
                    $transaction["transaction_type"] ??
                    "transaction"
                );


            $amount =
                numberValue(
                    $transaction["amount"] ?? 0
                );


            $status =
                (string)(
                    $transaction["status"] ??
                    "pending"
                );


            $createdAt =
                dateValue(
                    $transaction["created_at"] ??
                    null
                );


            $userName =
                (string)(
                    $transaction["user_name"] ??
                    $transaction["full_name"] ??
                    $transaction["name"] ??
                    ""
                );


            $email =
                (string)(
                    $transaction["email"] ??
                    ""
                );


            $recentTransactions[] = [

                "id" =>
                    isset($transaction["_id"])
                        ? (string)$transaction["_id"]
                        : "",

                "type" =>
                    $type,

                "user_name" =>
                    $userName !== ""
                        ? $userName
                        : (
                            $email !== ""
                                ? $email
                                : "Unknown User"
                        ),

                "email" =>
                    $email,

                "amount" =>
                    $amount,

                "status" =>
                    $status,

                "created_at" =>
                    $createdAt

            ];

        }

    }


    /* =====================================================
       CURRENT ADMIN
    ====================================================== */

    $admin = [

        "full_name" =>
            (string)(
                $_SESSION["user_name"] ??
                $_SESSION["full_name"] ??
                "Administrator"
            ),

        "email" =>
            (string)(
                $_SESSION["user_email"] ??
                "Admin Account"
            ),

        "role" =>
            $role

    ];


    /* =====================================================
       RESPONSE
    ====================================================== */

    adminRespond([

        "success" => true,

        "admin" => $admin,

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

            "total_withdrawals" =>
                $totalWithdrawals,

            "total_investments" =>
                $totalInvestments

        ],

        "recent_transactions" =>
            $recentTransactions

    ]);


} catch (
    MongoDB\Driver\Exception\Exception $e
) {

    error_log(
        "Admin dashboard MongoDB error: " .
        $e->getMessage()
    );


    adminRespond(
        [
            "success" => false,
            "message" =>
                "Database error while loading admin dashboard."
        ],
        500
    );


} catch (
    Throwable $e
) {

    error_log(
        "Admin dashboard error: " .
        $e->getMessage()
    );


    adminRespond(
        [
            "success" => false,
            "message" =>
                "Unable to load admin dashboard."
        ],
        500
    );

}
?>