<?php

/* =========================================================
   CROWN CASH - MY INVESTMENTS API
   File: my-investments.php

   PURPOSE:
   - Return the logged-in user's investments
   - Return current wallet balance
   - Return investment statistics
   - Support ObjectId and string user IDs
   - Safely handle MongoDB BSONDocument objects
========================================================= */

ini_set("display_errors", "0");
ini_set("log_errors", "1");

error_reporting(E_ALL);


/* =========================================================
   LOAD CONFIG FIRST
========================================================= */

try {

    require_once __DIR__ . "/config.php";

} catch (Throwable $e) {

    header("Content-Type: application/json; charset=UTF-8");

    http_response_code(500);

    echo json_encode([
        "success" => false,
        "message" => "Server configuration could not be loaded.",
        "error" => $e->getMessage()
    ]);

    exit;
}


/* =========================================================
   CORS
========================================================= */

$requestOrigin =
    $_SERVER["HTTP_ORIGIN"] ?? "";

$allowedOrigins = [
    "https://crown-cash.vercel.app",
    "https://www.crown-cash.vercel.app"
];


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

} elseif (
    $requestOrigin === ""
) {

    header(
        "Access-Control-Allow-Origin: https://crown-cash.vercel.app"
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
    "Content-Type: application/json; charset=UTF-8"
);


/* =========================================================
   OPTIONS
========================================================= */

if (
    ($_SERVER["REQUEST_METHOD"] ?? "") ===
    "OPTIONS"
) {

    http_response_code(204);

    exit;
}


/* =========================================================
   ONLY GET
========================================================= */

if (
    ($_SERVER["REQUEST_METHOD"] ?? "") !==
    "GET"
) {

    http_response_code(405);

    echo json_encode([
        "success" => false,
        "message" => "Method not allowed."
    ]);

    exit;
}


/* =========================================================
   START CROWN CASH SESSION
========================================================= */

try {

    if (
        function_exists("startSecureSession")
    ) {

        startSecureSession();

    } else {

        if (
            session_status() !==
            PHP_SESSION_ACTIVE
        ) {

            session_name(
                "CROWN_CASH_SESSION"
            );

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

} catch (Throwable $e) {

    http_response_code(500);

    echo json_encode([
        "success" => false,
        "message" => "Unable to start your session.",
        "error" => $e->getMessage()
    ]);

    exit;
}


/* =========================================================
   AUTHENTICATION
========================================================= */

if (
    empty(
        $_SESSION["logged_in"]
    )
) {

    http_response_code(401);

    echo json_encode([
        "success" => false,
        "message" => "Please log in before viewing your investments."
    ]);

    exit;
}


/* =========================================================
   SESSION USER
========================================================= */

$sessionUserId =
    $_SESSION["user_id"]
    ?? $_SESSION["userId"]
    ?? $_SESSION["id"]
    ?? $_SESSION["_id"]
    ?? null;


$sessionEmail =
    $_SESSION["email"]
    ?? $_SESSION["user_email"]
    ?? "";


if (
    $sessionUserId === null &&
    trim((string)$sessionEmail) === ""
) {

    http_response_code(401);

    echo json_encode([
        "success" => false,
        "message" => "Your login session does not contain a valid user account."
    ]);

    exit;
}


/* =========================================================
   HELPER - OBJECT ID
========================================================= */

function myInvestmentObjectId(
    $value
) {

    if (
        $value instanceof
        MongoDB\BSON\ObjectId
    ) {

        return $value;
    }


    $value =
        trim(
            (string)$value
        );


    if (
        $value === ""
    ) {

        return null;
    }


    try {

        return new MongoDB\BSON\ObjectId(
            $value
        );

    } catch (Throwable $e) {

        return null;
    }
}


/* =========================================================
   HELPER - NUMBER
========================================================= */

function myInvestmentNumber(
    $value
): float {

    if (
        $value === null
    ) {

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


    if (
        is_numeric($value)
    ) {

        return (float)$value;
    }


    return 0;
}


/* =========================================================
   HELPER - BSON TO PHP
========================================================= */

function myInvestmentToArray(
    $value
) {

    if (
        $value instanceof
        MongoDB\Model\BSONDocument
    ) {

        $array = [];

        foreach (
            $value as $key => $item
        ) {

            $array[$key] =
                myInvestmentToArray(
                    $item
                );
        }

        return $array;
    }


    if (
        $value instanceof
        MongoDB\Model\BSONArray
    ) {

        $array = [];

        foreach (
            $value as $item
        ) {

            $array[] =
                myInvestmentToArray(
                    $item
                );
        }

        return $array;
    }


    if (
        $value instanceof
        MongoDB\BSON\ObjectId
    ) {

        return (string)$value;
    }


    if (
        $value instanceof
        MongoDB\BSON\UTCDateTime
    ) {

        try {

            return $value
                ->toDateTime()
                ->format(
                    "Y-m-d H:i:s"
                );

        } catch (Throwable $e) {

            return null;
        }
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

        return (int)
            $value->__toString();
    }


    if (
        $value instanceof
        MongoDB\BSON\Double
    ) {

        return (float)
            $value->__toString();
    }


    if (
        is_array($value)
    ) {

        $result = [];

        foreach (
            $value as $key => $item
        ) {

            $result[$key] =
                myInvestmentToArray(
                    $item
                );
        }

        return $result;
    }


    return $value;
}


/* =========================================================
   HELPER - USER FILTER
========================================================= */

function buildMyInvestmentUserFilter(
    $userId,
    $email
): array {

    $or = [];


    $objectId =
        myInvestmentObjectId(
            $userId
        );


    if (
        $objectId !== null
    ) {

        $or[] = [
            "_id" =>
                $objectId
        ];

        $or[] = [
            "user_id" =>
                $objectId
        ];

        $or[] = [
            "userId" =>
                $objectId
        ];
    }


    $idString =
        trim(
            (string)$userId
        );


    if (
        $idString !== ""
    ) {

        $or[] = [
            "_id" =>
                $idString
        ];

        $or[] = [
            "id" =>
                $idString
        ];

        $or[] = [
            "user_id" =>
                $idString
        ];

        $or[] = [
            "userId" =>
                $idString
        ];

        $or[] = [
            "account_id" =>
                $idString
        ];
    }


    $email =
        trim(
            (string)$email
        );


    if (
        $email !== ""
    ) {

        $or[] = [
            "email" =>
                $email
        ];

        $or[] = [
            "user_email" =>
                $email
        ];
    }


    if (
        count($or) === 0
    ) {

        return [
            "_id" => null
        ];
    }


    return [
        '$or' => $or
    ];
}


/* =========================================================
   MAIN
========================================================= */

try {

    /* =====================================================
       CHECK COLLECTIONS
    ===================================================== */

    if (
        !isset($users) ||
        !isset($investments)
    ) {

        http_response_code(500);

        echo json_encode([
            "success" => false,
            "message" => "Investment database collections are not configured."
        ]);

        exit;
    }


    /* =====================================================
       FIND USER
    ===================================================== */

    $userFilter =
        buildMyInvestmentUserFilter(
            $sessionUserId,
            $sessionEmail
        );


    $userDocument =
        $users->findOne(
            $userFilter
        );


    if (
        $userDocument === null
    ) {

        http_response_code(404);

        echo json_encode([
            "success" => false,
            "message" => "Your Crown Cash account could not be found."
        ]);

        exit;
    }


    /*
     * Convert BSONDocument into a normal PHP array.
     *
     * This is important because PHP functions such as
     * array_key_exists() require an actual array.
     */

    $user =
        myInvestmentToArray(
            $userDocument
        );


    if (
        !is_array($user)
    ) {

        $user = [];
    }


    /* =====================================================
       WALLET BALANCE
    ===================================================== */

    $balance = 0;


    if (
        isset($user["balance"])
    ) {

        $balance =
            myInvestmentNumber(
                $user["balance"]
            );

    } elseif (
        isset($user["wallet_balance"])
    ) {

        $balance =
            myInvestmentNumber(
                $user["wallet_balance"]
            );

    } elseif (
        isset($user["walletBalance"])
    ) {

        $balance =
            myInvestmentNumber(
                $user["walletBalance"]
            );

    } elseif (
        isset($user["wallet"]) &&
        is_array($user["wallet"]) &&
        isset($user["wallet"]["balance"])
    ) {

        $balance =
            myInvestmentNumber(
                $user["wallet"]["balance"]
            );
    }


    /* =====================================================
       BUILD INVESTMENT USER FILTER
    ===================================================== */

    $investmentUserOr = [];


    $sessionObjectId =
        myInvestmentObjectId(
            $sessionUserId
        );


    if (
        $sessionObjectId !== null
    ) {

        $investmentUserOr[] = [
            "user_id" =>
                $sessionObjectId
        ];

        $investmentUserOr[] = [
            "userId" =>
                $sessionObjectId
        ];

        $investmentUserOr[] = [
            "account_id" =>
                $sessionObjectId
        ];
    }


    $sessionIdString =
        trim(
            (string)$sessionUserId
        );


    if (
        $sessionIdString !== ""
    ) {

        $investmentUserOr[] = [
            "user_id" =>
                $sessionIdString
        ];

        $investmentUserOr[] = [
            "userId" =>
                $sessionIdString
        ];

        $investmentUserOr[] = [
            "account_id" =>
                $sessionIdString
        ];
    }


    $email =
        trim(
            (string)$sessionEmail
        );


    if (
        $email !== ""
    ) {

        $investmentUserOr[] = [
            "user_email" =>
                $email
        ];

        $investmentUserOr[] = [
            "email" =>
                $email
        ];
    }


    /* =====================================================
       FETCH INVESTMENTS
    ===================================================== */

    $investmentDocuments = [];


    if (
        count($investmentUserOr) > 0
    ) {

        $cursor =
            $investments->find(
                [
                    '$or' =>
                        $investmentUserOr
                ],
                [
                    "sort" => [
                        "created_at" =>
                            -1
                    ]
                ]
            );


        foreach (
            $cursor as $document
        ) {

            $investmentDocuments[] =
                myInvestmentToArray(
                    $document
                );
        }
    }


    /* =====================================================
       NORMALIZE INVESTMENTS
    ===================================================== */

    $investmentList = [];


    foreach (
        $investmentDocuments
        as $investment
    ) {

        if (
            !is_array($investment)
        ) {

            continue;
        }


        /* ---------------------------------------------
           ID
        --------------------------------------------- */

        $id =
            $investment["_id"]
            ?? $investment["id"]
            ?? "";


        $id =
            (string)$id;


        /* ---------------------------------------------
           PLAN
        --------------------------------------------- */

        $plan =
            $investment["plan"]
            ?? $investment["plan_name"]
            ?? $investment["package"]
            ?? "Investment Plan";


        $planName =
            $investment["plan_name"]
            ?? $investment["package"]
            ?? $plan;


        /* ---------------------------------------------
           AMOUNT
        --------------------------------------------- */

        $amount =
            myInvestmentNumber(
                $investment["amount"]
                ?? $investment["principal"]
                ?? $investment["reserved_amount"]
                ?? 0
            );


        $principal =
            myInvestmentNumber(
                $investment["principal"]
                ?? $amount
            );


        /* ---------------------------------------------
           DAILY RATE
        --------------------------------------------- */

        $dailyRate =
            myInvestmentNumber(
                $investment["daily_rate"]
                ?? 0
            );


        /*
         * Older records may contain 10 instead of 0.10.
         */

        if (
            $dailyRate > 1
        ) {

            $dailyRate =
                $dailyRate / 100;
        }


        $dailyReturn =
            $dailyRate * 100;


        /* ---------------------------------------------
           DAILY INCOME
        --------------------------------------------- */

        $dailyIncome =
            myInvestmentNumber(
                $investment["daily_income"]
                ?? (
                    $amount *
                    $dailyRate
                )
            );


        /* ---------------------------------------------
           TOTAL INCOME
        --------------------------------------------- */

        $duration =
            (int)(
                $investment["duration_days"]
                ?? $investment["duration"]
                ?? 30
            );


        if (
            $duration <= 0
        ) {

            $duration = 30;
        }


        $totalIncome =
            myInvestmentNumber(
                $investment["total_income"]
                ?? (
                    $dailyIncome *
                    $duration
                )
            );


        /* ---------------------------------------------
           MATURITY
        --------------------------------------------- */

        $maturityAmount =
            myInvestmentNumber(
                $investment["maturity_amount"]
                ?? (
                    $principal +
                    $totalIncome
                )
            );


        /* ---------------------------------------------
           STATUS
        --------------------------------------------- */

        $status =
            strtolower(
                trim(
                    (string)(
                        $investment["status"]
                        ?? "pending"
                    )
                )
            );


        if (
            $status === ""
        ) {

            $status = "pending";
        }


        /* ---------------------------------------------
           DATES
        --------------------------------------------- */

        $createdAt =
            $investment["created_at"]
            ?? $investment["createdAt"]
            ?? null;


        $approvedAt =
            $investment["approved_at"]
            ?? $investment["approvedAt"]
            ?? null;


        $activatedAt =
            $investment["activated_at"]
            ?? $investment["activatedAt"]
            ?? null;


        $startedAt =
            $investment["started_at"]
            ?? $investment["startedAt"]
            ?? null;


        $completedAt =
            $investment["completed_at"]
            ?? $investment["completedAt"]
            ?? null;


        /* ---------------------------------------------
           REFERENCE
        --------------------------------------------- */

        $reference =
            $investment["reference"]
            ?? $investment["investment_reference"]
            ?? "";


        /* ---------------------------------------------
           PROGRESS
        --------------------------------------------- */

        $progress = 0;


        if (
            $status === "completed"
        ) {

            $progress = 100;

        } elseif (
            $status === "active" ||
            $status === "running"
        ) {

            $startDate =
                $activatedAt
                ?? $startedAt
                ?? $approvedAt
                ?? $createdAt;


            if (
                $startDate
            ) {

                try {

                    $startTimestamp =
                        strtotime(
                            (string)$startDate
                        );


                    if (
                        $startTimestamp !== false
                    ) {

                        $elapsedDays =
                            floor(
                                (
                                    time() -
                                    $startTimestamp
                                ) /
                                86400
                            );


                        $elapsedDays =
                            max(
                                0,
                                $elapsedDays
                            );


                        $progress =
                            min(
                                100,
                                (
                                    $elapsedDays /
                                    $duration
                                ) *
                                100
                            );
                    }

                } catch (Throwable $e) {

                    $progress = 0;
                }
            }
        }


        /* ---------------------------------------------
           NORMALIZED RECORD
        --------------------------------------------- */

        $investmentList[] = [

            "id" =>
                $id,

            "_id" =>
                $id,

            "reference" =>
                $reference,

            "investment_reference" =>
                $reference,

            "plan" =>
                $plan,

            "plan_name" =>
                $planName,

            "package" =>
                $planName,

            "amount" =>
                $amount,

            "principal" =>
                $principal,

            "reserved_amount" =>
                myInvestmentNumber(
                    $investment["reserved_amount"]
                    ?? $principal
                ),

            "currency" =>
                $investment["currency"]
                ?? "UGX",

            "duration" =>
                $duration,

            "duration_days" =>
                $duration,

            "daily_rate" =>
                $dailyRate,

            "daily_return" =>
                $dailyReturn,

            "daily_income" =>
                $dailyIncome,

            "total_income" =>
                $totalIncome,

            "maturity_amount" =>
                $maturityAmount,

            "status" =>
                $status,

            "balance_reserved" =>
                !empty(
                    $investment["balance_reserved"]
                ),

            "balance_deducted" =>
                !empty(
                    $investment["balance_deducted"]
                ),

            "principal_returned" =>
                !empty(
                    $investment["principal_returned"]
                ),

            "created_at" =>
                $createdAt,

            "approved_at" =>
                $approvedAt,

            "activated_at" =>
                $activatedAt,

            "started_at" =>
                $startedAt,

            "completed_at" =>
                $completedAt,

            "progress" =>
                round(
                    $progress,
                    1
                )
        ];
    }


    /* =====================================================
       STATISTICS
    ===================================================== */

    $totalInvestments =
        count(
            $investmentList
        );


    $activeCount = 0;

    $pendingCount = 0;

    $completedCount = 0;

    $totalInvested = 0;


    foreach (
        $investmentList
        as $investment
    ) {

        $status =
            strtolower(
                $investment["status"]
                ?? ""
            );


        $totalInvested +=
            myInvestmentNumber(
                $investment["amount"]
                ?? 0
            );


        if (
            $status === "pending"
        ) {

            $pendingCount++;

        } elseif (
            $status === "active" ||
            $status === "approved" ||
            $status === "running"
        ) {

            $activeCount++;

        } elseif (
            $status === "completed"
        ) {

            $completedCount++;
        }
    }


    /* =====================================================
       RESPONSE
    ===================================================== */

    http_response_code(200);


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

            "active_count" =>
                $activeCount,

            "pending_count" =>
                $pendingCount,

            "completed_count" =>
                $completedCount,

            "total_invested" =>
                $totalInvested,

            "counts" => [

                "total" =>
                    $totalInvestments,

                "active" =>
                    $activeCount,

                "pending" =>
                    $pendingCount,

                "completed" =>
                    $completedCount
            ],

            "investments" =>
                $investmentList,

            "data" => [

                "balance" =>
                    $balance,

                "available_balance" =>
                    $balance,

                "total_investments" =>
                    $totalInvestments,

                "active" =>
                    $activeCount,

                "pending" =>
                    $pendingCount,

                "completed" =>
                    $completedCount,

                "total_invested" =>
                    $totalInvested,

                "investments" =>
                    $investmentList
            ]
        ],
        JSON_UNESCAPED_SLASHES
    );

    exit;


} catch (Throwable $e) {

    error_log(
        "Crown Cash my-investments error: " .
        $e->getMessage()
    );


    http_response_code(500);


    echo json_encode([
        "success" => false,
        "message" => "Unable to load your investments.",
        "error" => $e->getMessage()
    ]);

    exit;
}

?>