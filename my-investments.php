<?php

/* ==========================================================================
   CROWN CASH - MY INVESTMENTS API
   Complete production backend
   ========================================================================== */


/* ==========================================================================
   LOAD CONFIG FIRST
   IMPORTANT:
   config.php contains the Crown Cash session configuration.
   ========================================================================== */

require_once __DIR__ . "/config.php";


/* ==========================================================================
   SESSION
   ========================================================================== */

if (function_exists("startSecureSession")) {

    startSecureSession();

} else {

    /*
     * Fallback for safety.
     * This must use the same session name as Crown Cash login.php.
     */

    if (session_status() !== PHP_SESSION_ACTIVE) {

        session_name("CROWN_CASH_SESSION");

        session_set_cookie_params([
            "lifetime" => 0,
            "path" => "/",
            "domain" => "",
            "secure" => true,
            "httponly" => true,
            "samesite" => "None"
        ]);

        session_start();

    }

}


/* ==========================================================================
   CORS
   ========================================================================== */

$allowedOrigins = [

    "https://crown-cash.vercel.app",

    "https://www.crown-cash.vercel.app"

];


$requestOrigin =
    $_SERVER["HTTP_ORIGIN"] ?? "";


if (
    in_array(
        $requestOrigin,
        $allowedOrigins,
        true
    )
) {

    header(
        "Access-Control-Allow-Origin: " .
        $requestOrigin
    );

}


header(
    "Access-Control-Allow-Credentials: true"
);


header(
    "Access-Control-Allow-Headers: Content-Type, Accept, Authorization, X-Requested-With"
);


header(
    "Access-Control-Allow-Methods: GET, OPTIONS"
);


header(
    "Access-Control-Max-Age: 86400"
);


header(
    "Vary: Origin"
);


header(
    "Content-Type: application/json; charset=utf-8"
);


/* ==========================================================================
   PREFLIGHT
   ========================================================================== */

if (
    ($_SERVER["REQUEST_METHOD"] ?? "") ===
    "OPTIONS"
) {

    http_response_code(204);

    exit;

}


/* ==========================================================================
   METHOD
   ========================================================================== */

if (
    ($_SERVER["REQUEST_METHOD"] ?? "") !==
    "GET"
) {

    http_response_code(405);

    echo json_encode([

        "success" => false,

        "message" =>
            "Method not allowed."

    ]);

    exit;

}


/* ==========================================================================
   USER ID
   ========================================================================== */

$userId = null;


/*
 * Use the common Crown Cash helper when available.
 */

if (function_exists("currentUserId")) {

    $userId =
        currentUserId();

}


/*
 * Fallback session fields.
 */

if (
    $userId === null ||
    $userId === ""
) {

    $userId =
        $_SESSION["user_id"]
        ?? $_SESSION["userId"]
        ?? $_SESSION["id"]
        ?? $_SESSION["_id"]
        ?? null;

}


/* ==========================================================================
   AUTHENTICATION
   ========================================================================== */

$loggedIn =
    !empty(
        $_SESSION["logged_in"]
    );


if (
    !$loggedIn ||
    $userId === null ||
    $userId === ""
) {

    http_response_code(401);

    echo json_encode([

        "success" => false,

        "message" =>
            "You are not logged in."

    ]);

    exit;

}


/* ==========================================================================
   HELPERS
   ========================================================================== */

function ccMyInvestmentNumber($value): float
{

    if ($value === null) {
        return 0;
    }


    if (
        $value instanceof
        MongoDB\BSON\Decimal128
    ) {

        return (float)
            $value->toString();

    }


    if (
        $value instanceof
        MongoDB\BSON\Int64
    ) {

        return (float)
            $value->__toString();

    }


    if (
        $value instanceof
        MongoDB\BSON\Double
    ) {

        return (float)
            $value->__toString();

    }


    if (is_numeric($value)) {

        return (float) $value;

    }


    if (is_array($value)) {

        if (
            isset(
                $value["\$numberDecimal"]
            )
        ) {

            return (float)
                $value["\$numberDecimal"];

        }


        if (
            isset(
                $value["\$numberLong"]
            )
        ) {

            return (float)
                $value["\$numberLong"];

        }


        if (
            isset(
                $value["value"]
            )
        ) {

            return ccMyInvestmentNumber(
                $value["value"]
            );

        }

    }


    return 0;

}


/* ==========================================================================
   DATE HELPER
   ========================================================================== */

function ccMyInvestmentDate($value)
{

    if ($value === null) {
        return null;
    }


    if (
        $value instanceof
        MongoDB\BSON\UTCDateTime
    ) {

        return $value
            ->toDateTime()
            ->format("c");

    }


    if (
        $value instanceof
        DateTimeInterface
    ) {

        return $value->format("c");

    }


    if (
        is_array($value) &&
        isset(
            $value["\$date"]
        )
    ) {

        return ccMyInvestmentDate(
            $value["\$date"]
        );

    }


    if (
        is_string($value) &&
        trim($value) !== ""
    ) {

        $timestamp =
            strtotime($value);


        if ($timestamp !== false) {

            return date(
                "c",
                $timestamp
            );

        }

    }


    return null;

}


/* ==========================================================================
   STRING HELPER
   ========================================================================== */

function ccMyInvestmentString(
    $value,
    string $default = ""
): string
{

    if ($value === null) {
        return $default;
    }


    if (
        $value instanceof
        MongoDB\BSON\ObjectId
    ) {

        return (string) $value;

    }


    if (
        $value instanceof
        MongoDB\BSON\Decimal128
    ) {

        return $value->toString();

    }


    if (
        $value instanceof
        MongoDB\BSON\Int64
    ) {

        return $value->__toString();

    }


    if (is_scalar($value)) {

        $result =
            trim(
                (string) $value
            );


        return $result !== ""
            ? $result
            : $default;

    }


    return $default;

}


/* ==========================================================================
   PLAN
   ========================================================================== */

function ccMyInvestmentPlan(
    array $investment
): string
{

    $value =
        $investment["plan"]
        ?? $investment["plan_name"]
        ?? $investment["planName"]
        ?? $investment["package"]
        ?? "starter";


    $plan =
        strtolower(
            trim(
                (string) $value
            )
        );


    if (
        strpos(
            $plan,
            "standard"
        ) !== false
    ) {

        return "standard";

    }


    if (
        strpos(
            $plan,
            "advanced"
        ) !== false
    ) {

        return "advanced";

    }


    return "starter";

}


/* ==========================================================================
   STATUS
   ========================================================================== */

function ccMyInvestmentStatus(
    array $investment
): string
{

    $status =
        strtolower(
            trim(
                (string) (
                    $investment["status"]
                    ?? "pending"
                )
            )
        );


    if (
        in_array(
            $status,
            [
                "approved",
                "running",
                "active",
                "in_progress"
            ],
            true
        )
    ) {

        return "active";

    }


    if (
        in_array(
            $status,
            [
                "complete",
                "completed",
                "matured",
                "finished"
            ],
            true
        )
    ) {

        return "completed";

    }


    if (
        $status === "declined"
    ) {

        return "rejected";

    }


    return $status;

}


/* ==========================================================================
   MONGODB
   ========================================================================== */

try {

    /*
     * Confirm MongoDB collection exists.
     */

    if (!isset($investments)) {

        throw new RuntimeException(
            "Investments collection is not configured."
        );

    }


    /*
     * Convert session user ID to ObjectId where possible.
     */

    $userIdString =
        (string) $userId;


    $userObjectId = null;


    try {

        $userObjectId =
            new MongoDB\BSON\ObjectId(
                $userIdString
            );

    } catch (Throwable $e) {

        $userObjectId = null;

    }


    /* ======================================================================
       BUILD USER FILTER
       ====================================================================== */

    $or = [];


    /*
     * ObjectId versions.
     */

    if ($userObjectId !== null) {

        $or[] = [
            "user_id" =>
                $userObjectId
        ];


        $or[] = [
            "userId" =>
                $userObjectId
        ];


        $or[] = [
            "user" =>
                $userObjectId
        ];


        $or[] = [
            "account_id" =>
                $userObjectId
        ];

    }


    /*
     * String versions.
     */

    $or[] = [
        "user_id" =>
            $userIdString
    ];


    $or[] = [
        "userId" =>
            $userIdString
    ];


    $or[] = [
        "user" =>
            $userIdString
    ];


    $or[] = [
        "account_id" =>
            $userIdString
    ];


    /* ======================================================================
       FIND INVESTMENTS
       ====================================================================== */

    $cursor =
        $investments->find(
            [
                "\$or" => $or
            ],
            [
                "sort" => [
                    "created_at" => -1,
                    "_id" => -1
                ]
            ]
        );


    $investmentList = [];


    /* ======================================================================
       PROCESS INVESTMENTS
       ====================================================================== */

    foreach (
        $cursor as $investment
    ) {

        $id =
            isset(
                $investment["_id"]
            )
                ? (string)
                    $investment["_id"]
                : "";


        $plan =
            ccMyInvestmentPlan(
                $investment
            );


        $planNames = [

            "starter" =>
                "Starter Plan",

            "standard" =>
                "Standard Plan",

            "advanced" =>
                "Advanced Plan"

        ];


        $planName =
            $planNames[$plan]
            ?? "Investment Plan";


        /*
         * Investment amount.
         */

        $amount =
            ccMyInvestmentNumber(
                $investment["amount"]
                ?? $investment["principal"]
                ?? $investment["reserved_amount"]
                ?? 0
            );


        /*
         * Duration.
         */

        $duration =
            (int)
            ccMyInvestmentNumber(
                $investment["duration_days"]
                ?? $investment["duration"]
                ?? $investment["durationDays"]
                ?? $investment["days"]
                ?? 30
            );


        if ($duration <= 0) {

            $duration = 30;

        }


        /*
         * Status.
         */

        $status =
            ccMyInvestmentStatus(
                $investment
            );


        /*
         * Dates.
         */

        $createdAt =
            ccMyInvestmentDate(
                $investment["created_at"]
                ?? $investment["createdAt"]
                ?? null
            );


        $startDate =
            ccMyInvestmentDate(
                $investment["start_date"]
                ?? $investment["startDate"]
                ?? $investment["started_at"]
                ?? $investment["approved_at"]
                ?? null
            );


        $endDate =
            ccMyInvestmentDate(
                $investment["end_date"]
                ?? $investment["endDate"]
                ?? $investment["matures_at"]
                ?? $investment["completed_at"]
                ?? null
            );


        /*
         * Pending investments normally don't have an active start date.
         */

        if (
            $startDate === null &&
            $status === "active"
        ) {

            $startDate =
                $createdAt;

        }


        /*
         * Calculate maturity date when active investment
         * has a start date but no stored end date.
         */

        if (
            $startDate !== null &&
            $endDate === null &&
            $status === "active"
        ) {

            $startTimestamp =
                strtotime(
                    $startDate
                );


            if (
                $startTimestamp !== false
            ) {

                $endDate =
                    date(
                        "c",
                        strtotime(
                            "+" .
                            $duration .
                            " days",
                            $startTimestamp
                        )
                    );

            }

        }


        /*
         * Reference.
         */

        $reference =
            ccMyInvestmentString(
                $investment["reference"]
                ?? $investment["transaction_reference"]
                ?? $investment["transactionReference"]
                ?? $investment["investment_reference"]
                ?? "",
                $id !== ""
                    ? "INV-" . $id
                    : "INV-PENDING"
            );


        $investmentList[] = [

            "id" =>
                $id,

            "plan" =>
                $plan,

            "plan_name" =>
                $planName,

            "amount" =>
                $amount,

            "duration_days" =>
                $duration,

            "status" =>
                $status,

            "reference" =>
                $reference,

            "start_date" =>
                $startDate,

            "end_date" =>
                $endDate,

            "created_at" =>
                $createdAt

        ];

    }


    /* ======================================================================
       SUMMARY
       ====================================================================== */

    $totalInvestments =
        count(
            $investmentList
        );


    $activeInvestments = 0;

    $pendingInvestments = 0;

    $completedInvestments = 0;

    $totalInvested = 0;


    foreach (
        $investmentList
        as $investment
    ) {

        $status =
            $investment["status"];


        if (
            $status === "active"
        ) {

            $activeInvestments++;

        }


        if (
            $status === "pending"
        ) {

            $pendingInvestments++;

        }


        if (
            $status === "completed"
        ) {

            $completedInvestments++;

        }


        $totalInvested +=
            (float)
            $investment["amount"];

    }


    /* ======================================================================
       USER BALANCE
       ====================================================================== */

    $balance = 0;


    if (isset($users)) {

        $user = null;


        try {

            /*
             * Find by ObjectId first.
             */

            if (
                $userObjectId !== null
            ) {

                $user =
                    $users->findOne([
                        "_id" =>
                            $userObjectId
                    ]);

            }


            /*
             * Fallback to string ID.
             */

            if (
                $user === null
            ) {

                $user =
                    $users->findOne([
                        "_id" =>
                            $userIdString
                    ]);

            }


            /*
             * Some systems store a separate id field.
             */

            if (
                $user === null
            ) {

                $user =
                    $users->findOne([
                        "id" =>
                            $userIdString
                    ]);

            }


            if (
                $user !== null
            ) {

                /*
                 * Crown Cash supports several historical
                 * wallet field names.
                 */

                if (
                    isset(
                        $user["balance"]
                    )
                ) {

                    $balance =
                        ccMyInvestmentNumber(
                            $user["balance"]
                        );

                } elseif (
                    isset(
                        $user["wallet_balance"]
                    )
                ) {

                    $balance =
                        ccMyInvestmentNumber(
                            $user["wallet_balance"]
                        );

                } elseif (
                    isset(
                        $user["walletBalance"]
                    )
                ) {

                    $balance =
                        ccMyInvestmentNumber(
                            $user["walletBalance"]
                        );

                } elseif (
                    isset(
                        $user["wallet"]
                    ) &&
                    is_array(
                        $user["wallet"]
                    ) &&
                    isset(
                        $user["wallet"]["balance"]
                    )
                ) {

                    $balance =
                        ccMyInvestmentNumber(
                            $user["wallet"]["balance"]
                        );

                }

            }

        } catch (Throwable $e) {

            /*
             * Do not prevent investment history
             * from loading if balance lookup fails.
             */

            $balance = 0;

        }

    }


    /* ======================================================================
       RESPONSE
       ====================================================================== */

    echo json_encode(

        [

            "success" =>
                true,

            "message" =>
                "Investments loaded successfully.",

            "balance" =>
                $balance,

            "available_balance" =>
                $balance,

            "wallet_balance" =>
                $balance,

            "total_investments" =>
                $totalInvestments,

            "active_investments" =>
                $activeInvestments,

            "pending_investments" =>
                $pendingInvestments,

            "completed_investments" =>
                $completedInvestments,

            "total_invested" =>
                $totalInvested,

            "investments" =>
                $investmentList

        ],

        JSON_UNESCAPED_SLASHES

    );


} catch (Throwable $e) {

    error_log(
        "Crown Cash my-investments.php error: " .
        $e->getMessage()
    );


    http_response_code(500);


    echo json_encode([

        "success" =>
            false,

        "message" =>
            "Unable to load your investments.",

        "error" =>
            $e->getMessage()

    ]);


    exit;

}