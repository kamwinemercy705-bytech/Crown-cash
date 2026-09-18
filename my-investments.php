<?php

/* =========================================================
   CROWN CASH - MY INVESTMENTS API
   File: my-investments.php
   ========================================================= */


/* =========================================================
   CORS
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
   OPTIONS / PREFLIGHT
========================================================= */

if ($_SERVER["REQUEST_METHOD"] === "OPTIONS") {

    http_response_code(204);

    exit;
}


/* =========================================================
   ONLY GET
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
   AUTHENTICATION
========================================================= */

if (
    empty($_SESSION["logged_in"]) ||
    empty($_SESSION["user_id"])
) {

    http_response_code(401);

    echo json_encode([
        "success" => false,
        "message" => "You are not logged in."
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
        "message" => "Database configuration could not be loaded."
    ]);

    exit;
}


/* =========================================================
   CHECK COLLECTION
========================================================= */

if (!isset($investments)) {

    http_response_code(500);

    echo json_encode([
        "success" => false,
        "message" => "Investments collection is not configured."
    ]);

    exit;
}


/* =========================================================
   MONGODB
========================================================= */

try {

    $userIdString =
        (string) $_SESSION["user_id"];

    $userObjectId = null;


    /*
     * Convert session user ID into MongoDB ObjectId
     * when possible.
     */

    try {

        $userObjectId =
            new MongoDB\BSON\ObjectId(
                $userIdString
            );

    } catch (Throwable $e) {

        $userObjectId = null;
    }


    /* =====================================================
       FIND USER INVESTMENTS
    ===================================================== */

    $or = [];


    /*
     * Most Crown Cash records should use user_id.
     */

    if ($userObjectId !== null) {

        $or[] = [
            "user_id" => $userObjectId
        ];

        $or[] = [
            "user" => $userObjectId
        ];

        $or[] = [
            "userId" => $userObjectId
        ];

        $or[] = [
            "account_id" => $userObjectId
        ];
    }


    /*
     * Also support records where the ID was stored
     * as a string.
     */

    $or[] = [
        "user_id" => $userIdString
    ];

    $or[] = [
        "user" => $userIdString
    ];

    $or[] = [
        "userId" => $userIdString
    ];

    $or[] = [
        "account_id" => $userIdString
    ];


    $cursor =
        $investments->find(
            [
                '$or' => $or
            ],
            [
                "sort" => [
                    "created_at" => -1,
                    "_id" => -1
                ]
            ]
        );


    /* =====================================================
       HELPERS
    ===================================================== */

    function ccNumber($value)
    {

        if ($value === null) {
            return 0;
        }


        if (
            $value instanceof MongoDB\BSON\Decimal128
        ) {

            return (float)
                $value->toString();
        }


        if (
            $value instanceof MongoDB\BSON\Int64
        ) {

            return (float)
                $value->__toString();
        }


        if (
            $value instanceof MongoDB\BSON\Double
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
                    $value["$numberDecimal"]
                )
            ) {

                return (float)
                    $value["$numberDecimal"];
            }


            if (
                isset(
                    $value["$numberLong"]
                )
            ) {

                return (float)
                    $value["$numberLong"];
            }


            if (
                isset(
                    $value["value"]
                )
            ) {

                return ccNumber(
                    $value["value"]
                );
            }
        }


        return 0;
    }


    function ccDate($value)
    {

        if ($value === null) {
            return null;
        }


        if (
            $value instanceof MongoDB\BSON\UTCDateTime
        ) {

            return $value
                ->toDateTime()
                ->format(
                    "c"
                );
        }


        if (
            $value instanceof DateTimeInterface
        ) {

            return $value->format("c");
        }


        if (
            is_array($value) &&
            isset($value["$date"])
        ) {

            return ccDate(
                $value["$date"]
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


    function ccString(
        $value,
        $default = ""
    ) {

        if ($value === null) {
            return $default;
        }


        if (
            $value instanceof MongoDB\BSON\ObjectId
        ) {

            return (string) $value;
        }


        if (
            $value instanceof MongoDB\BSON\Decimal128
        ) {

            return $value->toString();
        }


        if (
            $value instanceof MongoDB\BSON\Int64
        ) {

            return $value->__toString();
        }


        if (
            is_scalar($value)
        ) {

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


    function ccPlan($investment)
    {

        $value =
            $investment["plan"]
            ?? $investment["plan_name"]
            ?? $investment["planName"]
            ?? $investment["package"]
            ?? "starter";


        return strtolower(
            trim(
                (string) $value
            )
        );
    }


    function ccStatus($investment)
    {

        return strtolower(
            trim(
                (string) (
                    $investment["status"]
                    ?? "pending"
                )
            )
        );
    }


    function ccPlanAmount($plan)
    {

        switch ($plan) {

            case "standard":
                return 15000;

            case "advanced":
                return 25000;

            case "starter":
            default:
                return 10000;
        }
    }


    /* =====================================================
       BUILD INVESTMENT LIST
    ===================================================== */

    $investmentList = [];


    foreach ($cursor as $investment) {

        $id =
            isset($investment["_id"])
                ? (string) $investment["_id"]
                : "";


        $plan =
            ccPlan(
                $investment
            );


        /*
         * Normalize plan names.
         */

        if (
            str_contains(
                $plan,
                "standard"
            )
        ) {

            $plan = "standard";

        } elseif (
            str_contains(
                $plan,
                "advanced"
            )
        ) {

            $plan = "advanced";

        } elseif (
            str_contains(
                $plan,
                "starter"
            )
        ) {

            $plan = "starter";
        }


        $amount =
            ccNumber(
                $investment["amount"]
                ?? ccPlanAmount($plan)
            );


        $duration =
            (int) ccNumber(
                $investment["duration_days"]
                ?? $investment["durationDays"]
                ?? $investment["days"]
                ?? 30
            );


        if ($duration <= 0) {
            $duration = 30;
        }


        $status =
            ccStatus(
                $investment
            );


        /*
         * Normalize common status names.
         */

        if (
            in_array(
                $status,
                [
                    "approved",
                    "running",
                    "in_progress"
                ],
                true
            )
        ) {

            $status = "active";
        }


        if (
            in_array(
                $status,
                [
                    "complete",
                    "matured",
                    "finished"
                ],
                true
            )
        ) {

            $status = "completed";
        }


        if ($status === "declined") {
            $status = "rejected";
        }


        $createdAt =
            ccDate(
                $investment["created_at"]
                ?? $investment["createdAt"]
                ?? null
            );


        $startDate =
            ccDate(
                $investment["start_date"]
                ?? $investment["startDate"]
                ?? $investment["started_at"]
                ?? null
            );


        $endDate =
            ccDate(
                $investment["end_date"]
                ?? $investment["endDate"]
                ?? $investment["matures_at"]
                ?? null
            );


        /*
         * If there is no start date and the investment
         * is active, use created_at.
         */

        if (
            $startDate === null &&
            $status === "active"
        ) {

            $startDate =
                $createdAt;
        }


        /*
         * If the investment has started but no end date
         * exists, calculate a 30-day maturity date.
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


            if ($startTimestamp !== false) {

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


        $reference =
            ccString(
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

            "id" => $id,

            "plan" => $plan,

            "plan_name" =>
                ucfirst($plan) .
                " Plan",

            "amount" => $amount,

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


    /* =====================================================
       SUMMARY
    ===================================================== */

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


        if ($status === "active") {
            $activeInvestments++;
        }


        if ($status === "pending") {
            $pendingInvestments++;
        }


        if ($status === "completed") {
            $completedInvestments++;
        }


        /*
         * Total invested is the sum of submitted
         * investment amounts.
         */

        $totalInvested +=
            (float)
            $investment["amount"];
    }


    /* =====================================================
       GET USER BALANCE
    ===================================================== */

    $balance = 0;


    if (isset($users)) {

        try {

            $user = null;


            if ($userObjectId !== null) {

                $user =
                    $users->findOne([
                        "_id" =>
                            $userObjectId
                    ]);
            }


            if ($user === null) {

                $user =
                    $users->findOne([
                        "_id" =>
                            $userIdString
                    ]);
            }


            if ($user !== null) {

                $balance =
                    ccNumber(
                        $user["balance"]
                        ?? $user["wallet_balance"]
                        ?? $user["walletBalance"]
                        ?? 0
                    );
            }

        } catch (Throwable $e) {

            /*
             * Balance failure should not prevent
             * investment history from loading.
             */

            $balance = 0;
        }
    }


    /* =====================================================
       RESPONSE
    ===================================================== */

    echo json_encode(
        [
            "success" => true,

            "balance" =>
                $balance,

            "available_balance" =>
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

    http_response_code(500);

    echo json_encode([
        "success" => false,

        "message" =>
            "Unable to load your investments.",

        "error" =>
            $e->getMessage()
    ]);

    exit;
}
?>