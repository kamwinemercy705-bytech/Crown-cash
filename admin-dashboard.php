<?php

/* =========================================================
   CROWN CASH — ADMIN DASHBOARD API
   File: admin-dashboard.php

   Purpose:
   - Verify administrator session
   - Load dashboard statistics
   - Load recent transactions
   - Load recent users
   - Return ONE clean JSON response

   IMPORTANT:
   This file does NOT require admin-auth.php because
   admin-auth.php is an API endpoint and outputs JSON.
   ========================================================= */

declare(strict_types=1);


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
    "Access-Control-Allow-Headers: Content-Type, Accept"
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
   SECURE CROSS-SITE SESSION
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
   SESSION CHECK
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
   LOAD DATABASE
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
   ADMIN AUTHORIZATION
   ========================================================= */

try {

    $sessionUserId =
        trim((string)$_SESSION["user_id"]);

    $sessionEmail =
        strtolower(
            trim(
                (string)(
                    $_SESSION["user_email"] ?? ""
                )
            )
        );

    if ($sessionUserId === "") {

        http_response_code(403);

        echo json_encode([
            "success" => false,
            "message" => "Administrator access denied."
        ]);

        exit;
    }


    /* ---------------------------------------------------------
       FIND CURRENT USER
       --------------------------------------------------------- */

    $currentUser = null;

    try {

        $currentUser =
            $users->findOne([
                "_id" =>
                    new MongoDB\BSON\ObjectId(
                        $sessionUserId
                    )
            ]);

    } catch (Throwable $e) {

        $currentUser = null;
    }


    /* ---------------------------------------------------------
       FALLBACK BY EMAIL
       --------------------------------------------------------- */

    if (
        !$currentUser &&
        $sessionEmail !== ""
    ) {

        $currentUser =
            $users->findOne([
                "email" => $sessionEmail
            ]);

    }


    /* ---------------------------------------------------------
       USER MUST EXIST
       --------------------------------------------------------- */

    if (!$currentUser) {

        http_response_code(403);

        echo json_encode([
            "success" => false,
            "message" => "Administrator account could not be verified."
        ]);

        exit;
    }


    /* ---------------------------------------------------------
       ACCOUNT STATUS
       --------------------------------------------------------- */

    $accountStatus =
        strtolower(
            trim(
                (string)(
                    $currentUser["status"] ?? "active"
                )
            )
        );

    if (
        in_array(
            $accountStatus,
            [
                "blocked",
                "suspended",
                "disabled",
                "banned",
                "inactive"
            ],
            true
        )
    ) {

        http_response_code(403);

        echo json_encode([
            "success" => false,
            "message" => "Administrator account is not active."
        ]);

        exit;
    }


    /* ---------------------------------------------------------
       ROLE
       --------------------------------------------------------- */

    $role =
        strtolower(
            trim(
                (string)(
                    $currentUser["role"] ?? ""
                )
            )
        );

    $accountType =
        strtolower(
            trim(
                (string)(
                    $currentUser["account_type"] ?? ""
                )
            )
        );

    if (
        $role !== "admin" &&
        $accountType !== "admin" &&
        $accountType !== "administrator"
    ) {

        http_response_code(403);

        echo json_encode([
            "success" => false,
            "message" => "Administrator access is required."
        ]);

        exit;
    }


    /* ---------------------------------------------------------
       ADMIN ID / EMAIL CONFIGURATION
       --------------------------------------------------------- */

    $configuredAdminId =
        trim(
            (string)(
                getenv("ADMIN_USER_ID") ?: ""
            )
        );

    $configuredAdminEmail =
        strtolower(
            trim(
                (string)(
                    getenv("ADMIN_EMAIL") ?: ""
                )
            )
        );


    /* ---------------------------------------------------------
       FAIL CLOSED
       --------------------------------------------------------- */

    if (
        $configuredAdminId === "" &&
        $configuredAdminEmail === ""
    ) {

        http_response_code(403);

        echo json_encode([
            "success" => false,
            "message" => "Administrator identity is not configured."
        ]);

        exit;
    }


    /* ---------------------------------------------------------
       CHECK ADMIN ID
       --------------------------------------------------------- */

    $actualUserId =
        "";

    if (
        isset($currentUser["_id"])
    ) {

        $actualUserId =
            (string)$currentUser["_id"];
    }

    $idMatches =
        (
            $configuredAdminId !== "" &&
            $actualUserId !== "" &&
            hash_equals(
                strtolower($configuredAdminId),
                strtolower($actualUserId)
            )
        );


    /* ---------------------------------------------------------
       CHECK ADMIN EMAIL
       --------------------------------------------------------- */

    $actualEmail =
        strtolower(
            trim(
                (string)(
                    $currentUser["email"] ?? ""
                )
            )
        );

    $emailMatches =
        (
            $configuredAdminEmail !== "" &&
            $actualEmail !== "" &&
            hash_equals(
                $configuredAdminEmail,
                $actualEmail
            )
        );


    /* ---------------------------------------------------------
       ADMIN MUST MATCH CONFIGURED ID OR EMAIL
       --------------------------------------------------------- */

    if (
        !$idMatches &&
        !$emailMatches
    ) {

        http_response_code(403);

        echo json_encode([
            "success" => false,
            "message" => "Administrator access denied."
        ]);

        exit;
    }


} catch (Throwable $e) {

    http_response_code(403);

    echo json_encode([
        "success" => false,
        "message" => "Administrator authorization failed."
    ]);

    exit;
}


/* =========================================================
   HELPER FUNCTIONS
   ========================================================= */

/**
 * Convert MongoDB numeric values to float.
 */
function ccNumericValue($value): float
{
    if ($value === null) {
        return 0.0;
    }

    if ($value instanceof MongoDB\BSON\Decimal128) {
        return (float)$value->__toString();
    }

    if ($value instanceof MongoDB\BSON\Int64) {
        return (float)$value->__toString();
    }

    if (is_int($value) || is_float($value)) {
        return (float)$value;
    }

    if (is_string($value)) {

        $clean =
            str_replace(
                ",",
                "",
                trim($value)
            );

        return is_numeric($clean)
            ? (float)$clean
            : 0.0;
    }

    return 0.0;
}


/**
 * Safely convert MongoDB dates.
 */
function ccDateValue($value): ?string
{
    try {

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

    } catch (Throwable $e) {
        return null;
    }

    return null;
}


/**
 * Convert MongoDB document to a frontend-safe array.
 */
function ccDocumentToArray($document): array
{
    if (!$document) {
        return [];
    }

    $array =
        json_decode(
            json_encode(
                $document,
                JSON_UNESCAPED_UNICODE
            ),
            true
        );

    return is_array($array)
        ? $array
        : [];
}


/**
 * Convert ObjectId to string.
 */
function ccIdString($value): string
{
    if (
        $value instanceof MongoDB\BSON\ObjectId
    ) {
        return (string)$value;
    }

    return trim((string)$value);
}


/**
 * Sum a collection by amount.
 */
function ccSumCollection(
    $collection,
    array $match = []
): float {

    try {

        $pipeline = [
            [
                '$match' => $match
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
        ];

        $result =
            $collection
                ->aggregate($pipeline)
                ->toArray();

        if (
            isset($result[0]["total"])
        ) {

            return ccNumericValue(
                $result[0]["total"]
            );
        }

    } catch (Throwable $e) {

        /*
         * Some older documents may have numeric
         * fields stored differently. Return zero
         * rather than breaking the entire dashboard.
         */

        error_log(
            "Dashboard aggregation error: " .
            $e->getMessage()
        );
    }

    return 0.0;
}


/**
 * Count documents safely.
 */
function ccCount(
    $collection,
    array $filter = []
): int {

    try {

        return (int)$collection
            ->countDocuments($filter);

    } catch (Throwable $e) {

        error_log(
            "Dashboard count error: " .
            $e->getMessage()
        );

        return 0;
    }
}


/* =========================================================
   DASHBOARD DATA
   ========================================================= */

try {

    /* -------------------------------------------------------
       COLLECTIONS
       ------------------------------------------------------- */

    $usersCollection =
        $db->selectCollection("users");

    $depositsCollection =
        $db->selectCollection("deposits");

    $withdrawalsCollection =
        $db->selectCollection("withdrawals");

    $investmentsCollection =
        $db->selectCollection("investments");

    $referralsCollection =
        $db->selectCollection("referrals");

    $transactionsCollection =
        $db->selectCollection("transactions");

    $supportCollection =
        $db->selectCollection("support_tickets");


    /* =======================================================
       USER STATISTICS
       ======================================================= */

    $totalUsers =
        ccCount(
            $usersCollection
        );

    $activeUsers =
        ccCount(
            $usersCollection,
            [
                "status" => "active"
            ]
        );


    /* =======================================================
       DEPOSIT STATISTICS
       ======================================================= */

    $totalDeposits =
        ccSumCollection(
            $depositsCollection
        );

    $pendingDeposits =
        ccSumCollection(
            $depositsCollection,
            [
                "status" => "pending"
            ]
        );

    $approvedDeposits =
        ccSumCollection(
            $depositsCollection,
            [
                "status" => "approved"
            ]
        );

    $rejectedDeposits =
        ccSumCollection(
            $depositsCollection,
            [
                "status" => "rejected"
            ]
        );

    $pendingDepositCount =
        ccCount(
            $depositsCollection,
            [
                "status" => "pending"
            ]
        );


    /* =======================================================
       WITHDRAWAL STATISTICS
       ======================================================= */

    $totalWithdrawals =
        ccSumCollection(
            $withdrawalsCollection
        );

    $pendingWithdrawals =
        ccSumCollection(
            $withdrawalsCollection,
            [
                "status" => "pending"
            ]
        );

    $pendingWithdrawalCount =
        ccCount(
            $withdrawalsCollection,
            [
                "status" => "pending"
            ]
        );


    /* =======================================================
       INVESTMENT STATISTICS
       ======================================================= */

    $totalInvestments =
        ccSumCollection(
            $investmentsCollection
        );

    $activeInvestments =
        ccCount(
            $investmentsCollection,
            [
                "status" => "active"
            ]
        );


    /* =======================================================
       REFERRAL STATISTICS
       ======================================================= */

    $totalReferrals =
        ccCount(
            $referralsCollection
        );


    /* =======================================================
       TRANSACTION STATISTICS
       ======================================================= */

    $totalTransactions =
        ccCount(
            $transactionsCollection
        );


    /* =======================================================
       SUPPORT STATISTICS
       ======================================================= */

    $openTickets =
        ccCount(
            $supportCollection,
            [
                "status" => [
                    '$in' => [
                        "open",
                        "pending",
                        "processing"
                    ]
                ]
            ]
        );


    /* =======================================================
       RECENT TRANSACTIONS
       ======================================================= */

    $recentTransactions = [];

    try {

        $transactionDocuments =
            $transactionsCollection
                ->find(
                    [],
                    [
                        "sort" => [
                            "created_at" => -1
                        ],
                        "limit" => 8
                    ]
                )
                ->toArray();


        foreach (
            $transactionDocuments
            as $transaction
        ) {

            $item =
                ccDocumentToArray(
                    $transaction
                );


            /* -----------------------------------------------
               ID
               ----------------------------------------------- */

            if (
                isset($transaction["_id"])
            ) {

                $item["id"] =
                    ccIdString(
                        $transaction["_id"]
                    );
            }


            /* -----------------------------------------------
               AMOUNT
               ----------------------------------------------- */

            if (
                isset($transaction["amount"])
            ) {

                $item["amount"] =
                    ccNumericValue(
                        $transaction["amount"]
                    );

            } else {

                $item["amount"] = 0;
            }


            /* -----------------------------------------------
               DATE
               ----------------------------------------------- */

            if (
                isset($transaction["created_at"])
            ) {

                $item["created_at"] =
                    ccDateValue(
                        $transaction["created_at"]
                    );
            }


            /* -----------------------------------------------
               USER NAME
               ----------------------------------------------- */

            if (
                empty($item["full_name"]) &&
                empty($item["user_name"]) &&
                empty($item["name"])
            ) {

                $item["name"] =
                    "Crown Cash User";
            }


            /* -----------------------------------------------
               TYPE
               ----------------------------------------------- */

            if (
                empty($item["type"]) &&
                isset($item["transaction_type"])
            ) {

                $item["type"] =
                    $item["transaction_type"];
            }


            $recentTransactions[] =
                $item;
        }

    } catch (Throwable $e) {

        error_log(
            "Recent transactions error: " .
            $e->getMessage()
        );

        $recentTransactions = [];
    }


    /* =======================================================
       RECENT USERS
       ======================================================= */

    $recentUsers = [];

    try {

        $userDocuments =
            $usersCollection
                ->find(
                    [],
                    [
                        "sort" => [
                            "created_at" => -1
                        ],
                        "limit" => 8
                    ]
                )
                ->toArray();


        foreach (
            $userDocuments
            as $user
        ) {

            $item =
                ccDocumentToArray(
                    $user
                );


            /* -----------------------------------------------
               ID
               ----------------------------------------------- */

            if (
                isset($user["_id"])
            ) {

                $item["id"] =
                    ccIdString(
                        $user["_id"]
                    );
            }


            /* -----------------------------------------------
               NAME
               ----------------------------------------------- */

            $fullName =
                trim(
                    (string)(
                        $item["full_name"] ?? ""
                    )
                );

            if ($fullName === "") {

                $firstName =
                    trim(
                        (string)(
                            $item["first_name"] ?? ""
                        )
                    );

                $lastName =
                    trim(
                        (string)(
                            $item["last_name"] ?? ""
                        )
                    );

                $fullName =
                    trim(
                        $firstName .
                        " " .
                        $lastName
                    );
            }

            if ($fullName === "") {
                $fullName = "Crown Cash User";
            }

            $item["full_name"] =
                $fullName;


            /* -----------------------------------------------
               EMAIL
               ----------------------------------------------- */

            if (
                !isset($item["email"])
            ) {

                $item["email"] = "";
            }


            /* -----------------------------------------------
               STATUS
               ----------------------------------------------- */

            if (
                empty($item["status"])
            ) {

                $item["status"] =
                    "active";
            }


            /* -----------------------------------------------
               CREATED DATE
               ----------------------------------------------- */

            if (
                isset($user["created_at"])
            ) {

                $item["created_at"] =
                    ccDateValue(
                        $user["created_at"]
                    );
            }


            $recentUsers[] =
                $item;
        }

    } catch (Throwable $e) {

        error_log(
            "Recent users error: " .
            $e->getMessage()
        );

        $recentUsers = [];
    }


    /* =======================================================
       RETURN DASHBOARD RESPONSE
       ======================================================= */

    echo json_encode(
        [
            "success" => true,

            "message" =>
                "Administrator dashboard data loaded successfully.",

            "admin" => [
                "id" =>
                    $actualUserId,

                "email" =>
                    $actualEmail,

                "name" =>
                    (string)(
                        $currentUser["full_name"] ??
                        "Administrator"
                    ),

                "role" =>
                    $role,

                "account_type" =>
                    $accountType,

                "status" =>
                    $accountStatus
            ],

            "stats" => [

                "total_users" =>
                    $totalUsers,

                "active_users" =>
                    $activeUsers,

                "total_deposits" =>
                    $totalDeposits,

                "pending_deposits" =>
                    $pendingDeposits,

                "approved_deposits" =>
                    $approvedDeposits,

                "rejected_deposits" =>
                    $rejectedDeposits,

                "total_withdrawals" =>
                    $totalWithdrawals,

                "pending_withdrawals" =>
                    $pendingWithdrawals,

                "total_investments" =>
                    $totalInvestments,

                "active_investments" =>
                    $activeInvestments,

                "total_referrals" =>
                    $totalReferrals,

                "total_transactions" =>
                    $totalTransactions,

                "open_tickets" =>
                    $openTickets,

                "pending_deposit_count" =>
                    $pendingDepositCount,

                "pending_withdrawal_count" =>
                    $pendingWithdrawalCount
            ],

            "summary" => [

                "total_users" =>
                    $totalUsers,

                "active_users" =>
                    $activeUsers,

                "total_deposits" =>
                    $totalDeposits,

                "pending_deposits" =>
                    $pendingDeposits,

                "total_withdrawals" =>
                    $totalWithdrawals,

                "pending_withdrawals" =>
                    $pendingWithdrawals,

                "total_investments" =>
                    $totalInvestments,

                "active_investments" =>
                    $activeInvestments,

                "total_referrals" =>
                    $totalReferrals,

                "total_transactions" =>
                    $totalTransactions,

                "open_tickets" =>
                    $openTickets
            ],

            "pending_activity" => [

                "deposits" =>
                    $pendingDeposits,

                "withdrawals" =>
                    $pendingWithdrawals,

                "new_accounts" =>
                    $activeUsers
            ],

            "recent_transactions" =>
                $recentTransactions,

            "recent_users" =>
                $recentUsers
        ],
        JSON_UNESCAPED_UNICODE |
        JSON_UNESCAPED_SLASHES
    );


} catch (MongoDB\Driver\Exception\Exception $e) {

    error_log(
        "Crown Cash admin dashboard MongoDB error: " .
        $e->getMessage()
    );

    http_response_code(500);

    echo json_encode([
        "success" => false,
        "message" => "Database error while loading dashboard data."
    ]);

} catch (Throwable $e) {

    error_log(
        "Crown Cash admin dashboard error: " .
        $e->getMessage()
    );

    http_response_code(500);

    echo json_encode([
        "success" => false,
        "message" => "Unable to load dashboard data."
    ]);
}
?>