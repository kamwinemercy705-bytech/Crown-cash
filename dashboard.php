<?php

declare(strict_types=1);

/* =========================================================
   CROWN CASH — USER DASHBOARD API
   =========================================================
   Returns:
   - User information
   - Current wallet balance
   - Total approved deposits
   - Total approved/active investments
   - Total accrued earnings
   - Current daily return
   - Referral team count
   - Transaction count

   IMPORTANT:
   Earnings are calculated from approved/active investments.
   Pending deposits/investments do NOT generate earnings.

   The 10% rate below is the application's configured
   calculation. It should not be represented as a guaranteed
   financial return.
========================================================= */


/* =========================================================
   ERROR HANDLING
========================================================= */

ini_set("display_errors", "0");
ini_set("log_errors", "1");

error_reporting(E_ALL);


/* =========================================================
   CORS
========================================================= */

$allowedOrigin =
    "https://crown-cash.vercel.app";

header(
    "Access-Control-Allow-Origin: {$allowedOrigin}"
);

header(
    "Access-Control-Allow-Methods: GET, OPTIONS"
);

header(
    "Access-Control-Allow-Headers: Content-Type, Accept"
);

header(
    "Access-Control-Allow-Credentials: true"
);

header(
    "Content-Type: application/json; charset=UTF-8"
);


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
   ONLY GET
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
   SESSION
========================================================= */

session_set_cookie_params([
    "lifetime" => 0,
    "path" => "/",
    "domain" => "",
    "secure" => true,
    "httponly" => true,
    "samesite" => "None"
]);


if (
    session_status() !== PHP_SESSION_ACTIVE
) {

    session_start();

}


/* =========================================================
   AUTHENTICATION
========================================================= */

if (
    empty($_SESSION["logged_in"]) ||
    empty($_SESSION["user_id"])
) {

    http_response_code(401);

    echo json_encode([
        "success" => false,
        "message" => "Not logged in."
    ]);

    exit;
}


/* =========================================================
   DATABASE
========================================================= */

try {

    require_once __DIR__ . "/config.php";

} catch (Throwable $e) {

    error_log(
        "Crown Cash dashboard config error: " .
        $e->getMessage()
    );

    http_response_code(500);

    echo json_encode([
        "success" => false,
        "message" => "Database configuration could not be loaded."
    ]);

    exit;
}


/* =========================================================
   CHECK COLLECTIONS
========================================================= */

if (
    !isset($users) ||
    !($users instanceof MongoDB\Collection)
) {

    http_response_code(500);

    echo json_encode([
        "success" => false,
        "message" => "Users database is not available."
    ]);

    exit;
}


/* =========================================================
   HELPERS
========================================================= */

function dashboardNumber($value): float
{
    if (
        $value === null ||
        $value === ""
    ) {
        return 0.0;
    }

    if (
        is_int($value) ||
        is_float($value)
    ) {
        return (float)$value;
    }

    if (
        is_numeric($value)
    ) {
        return (float)$value;
    }

    return 0.0;
}


/* =========================================================
   MONGODB DATE → TIMESTAMP
========================================================= */

function dashboardTimestamp($value): ?int
{
    try {

        if (
            $value instanceof MongoDB\BSON\UTCDateTime
        ) {

            return (int)(
                $value->toDateTime()
                    ->getTimestamp()
            );

        }


        if (
            $value instanceof DateTimeInterface
        ) {

            return $value->getTimestamp();

        }


        if (
            is_string($value) &&
            trim($value) !== ""
        ) {

            $timestamp =
                strtotime($value);

            if (
                $timestamp !== false
            ) {

                return $timestamp;

            }

        }

    } catch (Throwable $e) {

        return null;

    }

    return null;
}


/* =========================================================
   FIND USER
========================================================= */

$userIdString =
    (string)$_SESSION["user_id"];

$user = null;


/*
 * Try ObjectId first.
 */

if (
    preg_match(
        "/^[a-f0-9]{24}$/i",
        $userIdString
    )
) {

    try {

        $userObjectId =
            new MongoDB\BSON\ObjectId(
                $userIdString
            );


        $user =
            $users->findOne([
                "_id" =>
                    $userObjectId
            ]);

    } catch (Throwable $e) {

        $user = null;

    }

}


/*
 * Try string-based IDs if necessary.
 */

if (
    $user === null
) {

    $queries = [

        [
            "id" =>
                $userIdString
        ],

        [
            "user_id" =>
                $userIdString
        ],

        [
            "userId" =>
                $userIdString
        ]

    ];


    foreach (
        $queries as $query
    ) {

        try {

            $user =
                $users->findOne(
                    $query
                );


            if (
                $user !== null
            ) {

                break;

            }

        } catch (Throwable $e) {

            continue;

        }

    }

}


/* =========================================================
   USER NOT FOUND
========================================================= */

if (
    $user === null
) {

    session_destroy();

    http_response_code(401);

    echo json_encode([
        "success" => false,
        "message" => "User account not found."
    ]);

    exit;
}


/* =========================================================
   ACCOUNT STATUS
========================================================= */

$status =
    strtolower(
        (string)(
            $user["status"] ??
            "active"
        )
    );


if (
    $status !== "active"
) {

    http_response_code(403);

    echo json_encode([
        "success" => false,
        "message" => "This account is not active."
    ]);

    exit;
}


/* =========================================================
   USER INFORMATION
========================================================= */

$firstName =
    (string)(
        $user["firstName"] ??
        $user["first_name"] ??
        ""
    );


$lastName =
    (string)(
        $user["lastName"] ??
        $user["last_name"] ??
        ""
    );


$fullName =
    trim(
        $firstName .
        " " .
        $lastName
    );


if (
    $fullName === ""
) {

    $fullName =
        (string)(
            $user["name"] ??
            $user["full_name"] ??
            $user["fullName"] ??
            "Member"
        );

}


$role =
    strtolower(
        (string)(
            $user["role"] ??
            $user["account_type"] ??
            $user["accountType"] ??
            "user"
        )
    );


/* =========================================================
   WALLET BALANCE
========================================================= */

$walletBalance =
    dashboardNumber(
        $user["balance"] ??
        $user["wallet_balance"] ??
        $user["walletBalance"] ??
        0
    );


/* =========================================================
   INVESTMENT RATE
========================================================= */

/*
 * Current application calculation.
 */

$dailyRate = 0.10;


/* =========================================================
   COLLECTION INITIALIZATION
========================================================= */

$approvedDeposits = 0.0;

$totalInvested = 0.0;

$totalEarnings = 0.0;

$currentDailyReturn = 0.0;

$activeInvestmentCount = 0;

$transactionCount = 0;


/* =========================================================
   USER ID QUERIES
========================================================= */

$userQueries = [];


if (
    isset($user["_id"])
) {

    $userQueries[] = [
        "user_id" =>
            $user["_id"]
    ];

}


$userQueries[] = [
    "user_id" =>
        $userIdString
];


/* =========================================================
   APPROVED DEPOSITS
========================================================= */

if (
    isset($deposits) &&
    $deposits instanceof MongoDB\Collection
) {

    try {

        foreach (
            $userQueries as $depositQuery
        ) {

            $cursor =
                $deposits->find(
                    $depositQuery
                );


            foreach (
                $cursor as $deposit
            ) {

                $depositStatus =
                    strtolower(
                        (string)(
                            $deposit["status"] ??
                            ""
                        )
                    );


                /*
                 * Only approved/verified deposits count.
                 */

                $approved =
                    $deposit["approved"] ??
                    false;

                $verified =
                    $deposit["verified"] ??
                    false;


                $isApproved =
                    in_array(
                        $depositStatus,
                        [
                            "approved",
                            "completed",
                            "success",
                            "successful",
                            "verified"
                        ],
                        true
                    );


                if (
                    $approved === true ||
                    $verified === true ||
                    $isApproved
                ) {

                    $approvedDeposits +=
                        dashboardNumber(
                            $deposit["amount"] ?? 0
                        );

                }

            }


            /*
             * We normally have one matching ID format.
             * Stop after ObjectId query finds records.
             */

            if (
                $approvedDeposits > 0
            ) {

                break;

            }

        }

    } catch (Throwable $e) {

        error_log(
            "Crown Cash dashboard deposit calculation: " .
            $e->getMessage()
        );

    }

}


/* =========================================================
   INVESTMENTS
========================================================= */

if (
    isset($investments) &&
    $investments instanceof MongoDB\Collection
) {

    try {

        /*
         * Avoid duplicate records when both ObjectId and
         * string queries could potentially match.
         */

        $investmentIdsSeen = [];


        foreach (
            $userQueries as $investmentQuery
        ) {

            $cursor =
                $investments->find(
                    $investmentQuery
                );


            foreach (
                $cursor as $investment
            ) {

                $investmentId =
                    isset($investment["_id"])
                        ? (string)$investment["_id"]
                        : md5(
                            json_encode(
                                [
                                    $investment["amount"] ?? 0,
                                    $investment["created_at"] ?? "",
                                    $investment["reference"] ?? ""
                                ]
                            )
                        );


                if (
                    isset(
                        $investmentIdsSeen[
                            $investmentId
                        ]
                    )
                ) {

                    continue;

                }


                $investmentIdsSeen[
                    $investmentId
                ] = true;


                $investmentStatus =
                    strtolower(
                        (string)(
                            $investment["status"] ??
                            ""
                        )
                    );


                /*
                 * Pending/rejected/cancelled investments
                 * do not generate earnings.
                 */

                $isActive =
                    in_array(
                        $investmentStatus,
                        [
                            "active",
                            "approved",
                            "running",
                            "completed"
                        ],
                        true
                    );


                if (
                    !$isActive
                ) {

                    continue;

                }


                $amount =
                    dashboardNumber(
                        $investment["amount"] ??
                        $investment["investment_amount"] ??
                        0
                    );


                if (
                    $amount <= 0
                ) {

                    continue;

                }


                $totalInvested +=
                    $amount;


                $activeInvestmentCount++;


                /*
                 * Duration
                 */

                $durationDays =
                    (int)(
                        $investment["duration_days"] ??
                        $investment["duration"] ??
                        30
                    );


                if (
                    $durationDays <= 0
                ) {

                    $durationDays = 30;

                }


                /*
                 * Find the earning start date.
                 *
                 * Prefer approval/activation date.
                 * Fall back to created_at if the existing
                 * database does not contain an approval date.
                 */

                $startTimestamp = null;


                $possibleStartFields = [

                    "approved_at",

                    "activated_at",

                    "start_date",

                    "started_at",

                    "investment_start",

                    "created_at"

                ];


                foreach (
                    $possibleStartFields as $field
                ) {

                    if (
                        isset(
                            $investment[$field]
                        )
                    ) {

                        $timestamp =
                            dashboardTimestamp(
                                $investment[$field]
                            );


                        if (
                            $timestamp !== null
                        ) {

                            $startTimestamp =
                                $timestamp;

                            break;

                        }

                    }

                }


                if (
                    $startTimestamp === null
                ) {

                    continue;

                }


                /*
                 * Current time.
                 */

                $nowTimestamp =
                    time();


                /*
                 * Do not calculate future earnings.
                 */

                if (
                    $startTimestamp >
                    $nowTimestamp
                ) {

                    $completedDays = 0;

                }
                else {

                    $secondsElapsed =
                        $nowTimestamp -
                        $startTimestamp;


                    $completedDays =
                        (int)floor(
                            $secondsElapsed /
                            86400
                        );

                }


                /*
                 * Earnings cannot exceed the plan duration.
                 */

                $earningDays =
                    min(
                        $completedDays,
                        $durationDays
                    );


                /*
                 * Daily return.
                 */

                $dailyReturn =
                    $amount *
                    $dailyRate;


                $currentDailyReturn +=
                    $dailyReturn;


                /*
                 * Accrued earnings.
                 */

                $investmentEarnings =
                    $dailyReturn *
                    $earningDays;


                $totalEarnings +=
                    $investmentEarnings;

            }

        }

    } catch (Throwable $e) {

        error_log(
            "Crown Cash dashboard investment calculation: " .
            $e->getMessage()
        );

    }

}


/* =========================================================
   TRANSACTION COUNT
========================================================= */

if (
    isset($transactions) &&
    $transactions instanceof MongoDB\Collection
) {

    try {

        foreach (
            $userQueries as $transactionQuery
        ) {

            $transactionCount =
                $transactions->countDocuments(
                    $transactionQuery
                );


            if (
                $transactionCount > 0
            ) {

                break;

            }

        }

    } catch (Throwable $e) {

        error_log(
            "Crown Cash dashboard transaction count: " .
            $e->getMessage()
        );

    }

}


/* =========================================================
   REFERRAL TEAM
========================================================= */

$referralTeam = 0;


$referralCode =
    (string)(
        $user["referralCode"] ??
        $user["referral_code"] ??
        ""
    );


if (
    $referralCode !== "" &&
    isset($users)
) {

    try {

        $referralTeam =
            $users->countDocuments([
                "referredBy" =>
                    $referralCode
            ]);


        if (
            $referralTeam === 0
        ) {

            $referralTeam =
                $users->countDocuments([
                    "referred_by" =>
                        $referralCode
                ]);

        }

    } catch (Throwable $e) {

        $referralTeam = 0;

    }

}


/* =========================================================
   DISPLAY BALANCE
========================================================= */

/*
 * The stored wallet balance represents deposited/credited
 * wallet funds.
 *
 * Accrued investment earnings are added to the displayed
 * balance so the dashboard reflects the user's accumulated
 * earnings.
 *
 * This does NOT write earnings into MongoDB.
 */

$displayBalance =
    $walletBalance +
    $totalEarnings;


/* =========================================================
   RESPONSE
========================================================= */

echo json_encode([

    "success" =>
        true,

    "user" => [

        "id" =>
            isset($user["_id"])
                ? (string)$user["_id"]
                : $userIdString,

        "firstName" =>
            $firstName,

        "lastName" =>
            $lastName,

        "full_name" =>
            $fullName,

        "email" =>
            (string)(
                $user["email"] ?? ""
            ),

        "phone" =>
            (string)(
                $user["phone"] ?? ""
            ),

        "referralCode" =>
            $referralCode,

        "role" =>
            $role,

        "status" =>
            $status

    ],

    "balance" =>
        $displayBalance,

    "wallet_balance" =>
        $walletBalance,

    "total_deposits" =>
        $approvedDeposits,

    "total_invested" =>
        $totalInvested,

    "total_earnings" =>
        $totalEarnings,

    "daily_return" =>
        $currentDailyReturn,

    "active_investments" =>
        $activeInvestmentCount,

    "referral_team" =>
        $referralTeam,

    "transaction_count" =>
        $transactionCount,

    "currency" =>
        "UGX",

    "daily_rate" =>
        $dailyRate

], JSON_UNESCAPED_SLASHES);

exit;

?>