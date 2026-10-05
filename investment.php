<?php

/* =========================================================
   CROWN CASH - CREATE INVESTMENT API
   File: investment.php

   IMPORTANT ACCOUNTING RULE

   USER CREATES INVESTMENT
        ↓
   Investment = PENDING
        ↓
   Wallet is NOT deducted
        ↓
   ADMIN APPROVES
        ↓
   Investment = ACTIVE
        ↓
   Admin approval endpoint deducts principal ONCE
        ↓
   Daily earnings engine starts processing

   PLANS:
   Starter  = UGX 10,000
   Standard = UGX 15,000
   Advanced = UGX 25,000

   DAILY RETURN:
   10%

   DURATION:
   30 days
========================================================= */

ini_set("display_errors", "0");
ini_set("log_errors", "1");

error_reporting(E_ALL);


/* =========================================================
   LOAD CONFIG
========================================================= */

try {

    require_once __DIR__ . "/config.php";

} catch (Throwable $e) {

    header("Content-Type: application/json; charset=UTF-8");

    http_response_code(500);

    echo json_encode([
        "success" => false,
        "message" => "Server configuration could not be loaded."
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
    "Access-Control-Allow-Methods: POST, OPTIONS"
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
   PREFLIGHT
========================================================= */

if (
    ($_SERVER["REQUEST_METHOD"] ?? "") === "OPTIONS"
) {

    http_response_code(204);

    exit;
}


/* =========================================================
   ONLY POST
========================================================= */

if (
    ($_SERVER["REQUEST_METHOD"] ?? "") !== "POST"
) {

    http_response_code(405);

    echo json_encode([
        "success" => false,
        "message" => "Method not allowed."
    ]);

    exit;
}


/* =========================================================
   START CANONICAL SESSION
========================================================= */

try {

    if (
        function_exists("startSecureSession")
    ) {

        startSecureSession();

    } elseif (
        session_status() !== PHP_SESSION_ACTIVE
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

} catch (Throwable $e) {

    http_response_code(500);

    echo json_encode([
        "success" => false,
        "message" => "Unable to start your session."
    ]);

    exit;
}


/* =========================================================
   AUTHENTICATION
========================================================= */

$loggedIn =
    !empty(
        $_SESSION["logged_in"]
    );

if (!$loggedIn) {

    http_response_code(401);

    echo json_encode([
        "success" => false,
        "message" =>
            "Please log in before making an investment."
    ]);

    exit;
}


/* =========================================================
   SESSION USER
========================================================= */

$userId =
    $_SESSION["user_id"]
    ?? $_SESSION["userId"]
    ?? $_SESSION["id"]
    ?? $_SESSION["_id"]
    ?? null;

$userEmail =
    trim(
        (string)(
            $_SESSION["email"]
            ?? $_SESSION["user_email"]
            ?? ""
        )
    );


if (
    $userId === null &&
    $userEmail === ""
) {

    http_response_code(401);

    echo json_encode([
        "success" => false,
        "message" =>
            "Your login session does not contain a valid user account."
    ]);

    exit;
}


/* =========================================================
   READ REQUEST
========================================================= */

$rawInput =
    file_get_contents("php://input");

$data =
    json_decode(
        $rawInput,
        true
    );

if (
    !is_array($data)
) {

    $data = $_POST;
}


/* =========================================================
   REQUEST PLAN
========================================================= */

$requestedPlan =
    $data["plan"]
    ?? $data["plan_name"]
    ?? $data["planName"]
    ?? $data["package"]
    ?? "";

$requestedPlan =
    strtolower(
        trim(
            (string)$requestedPlan
        )
    );


/* =========================================================
   NORMALIZE PLAN
========================================================= */

if (
    str_contains(
        $requestedPlan,
        "starter"
    )
) {

    $planKey = "starter";

} elseif (
    str_contains(
        $requestedPlan,
        "standard"
    )
) {

    $planKey = "standard";

} elseif (
    str_contains(
        $requestedPlan,
        "advanced"
    )
) {

    $planKey = "advanced";

} else {

    http_response_code(400);

    echo json_encode([
        "success" => false,
        "message" =>
            "Please select a valid investment plan."
    ]);

    exit;
}


/* =========================================================
   INVESTMENT PLANS
========================================================= */

$plans = [

    "starter" => [
        "name" => "Starter Plan",
        "amount" => 10000,
        "daily_rate" => 0.10,
        "daily_return" => 10,
        "duration_days" => 30
    ],

    "standard" => [
        "name" => "Standard Plan",
        "amount" => 15000,
        "daily_rate" => 0.10,
        "daily_return" => 10,
        "duration_days" => 30
    ],

    "advanced" => [
        "name" => "Advanced Plan",
        "amount" => 25000,
        "daily_rate" => 0.10,
        "daily_return" => 10,
        "duration_days" => 30
    ]

];

$plan =
    $plans[$planKey];

$amount =
    (float)$plan["amount"];


/* =========================================================
   CHECK DATABASE COLLECTIONS
========================================================= */

if (
    !isset($users) ||
    !isset($investments)
) {

    http_response_code(500);

    echo json_encode([
        "success" => false,
        "message" =>
            "Investment database collections are not configured."
    ]);

    exit;
}


/* =========================================================
   NUMBER HELPER
========================================================= */

function investmentNumber($value): float
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

    if (
        is_numeric($value)
    ) {

        return (float)$value;
    }

    if (
        is_array($value)
    ) {

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

            return investmentNumber(
                $value["value"]
            );
        }
    }

    return 0;
}


/* =========================================================
   OBJECT ID HELPER
========================================================= */

function investmentObjectId($value)
{
    if (
        $value instanceof
        MongoDB\BSON\ObjectId
    ) {

        return $value;
    }

    try {

        return new MongoDB\BSON\ObjectId(
            (string)$value
        );

    } catch (Throwable $e) {

        return null;
    }
}


/* =========================================================
   DOCUMENT FIELD HELPER
========================================================= */

function investmentDocumentHasField(
    $document,
    string $field
): bool {

    if (
        is_array($document)
    ) {

        return array_key_exists(
            $field,
            $document
        );
    }

    if (
        $document instanceof ArrayAccess
    ) {

        return $document->offsetExists(
            $field
        );
    }

    return false;
}


/* =========================================================
   BUILD USER FILTER
========================================================= */

function buildInvestmentUserFilter(
    $userId,
    string $userEmail = ""
): array {

    $or = [];

    $objectId =
        investmentObjectId(
            $userId
        );

    if (
        $objectId !== null
    ) {

        $or[] = [
            "_id" => $objectId
        ];
    }

    $userIdString =
        trim(
            (string)$userId
        );

    if (
        $userIdString !== ""
    ) {

        $or[] = [
            "id" => $userIdString
        ];

        $or[] = [
            "user_id" => $userIdString
        ];

        $or[] = [
            "userId" => $userIdString
        ];
    }

    if (
        $userEmail !== ""
    ) {

        $or[] = [
            "email" => $userEmail
        ];

        $or[] = [
            "email" => strtolower($userEmail)
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
   MAIN PROCESS
========================================================= */

try {

    /* =====================================================
       FIND AUTHENTICATED USER
    ===================================================== */

    $userFilter =
        buildInvestmentUserFilter(
            $userId,
            $userEmail
        );

    $user =
        $users->findOne(
            $userFilter
        );

    if (
        $user === null
    ) {

        http_response_code(404);

        echo json_encode([
            "success" => false,
            "message" =>
                "Your Crown Cash account could not be found."
        ]);

        exit;
    }


    /* =====================================================
       USER OBJECT ID
    ===================================================== */

    $userObjectId =
        $user["_id"]
        ?? investmentObjectId($userId);

    $userIdString =
        trim(
            (string)$userId
        );


    /* =====================================================
       DETERMINE WALLET FIELD
    ===================================================== */

    $balanceField = "balance";

    if (
        investmentDocumentHasField(
            $user,
            "balance"
        )
    ) {

        $balanceField = "balance";

    } elseif (
        investmentDocumentHasField(
            $user,
            "wallet_balance"
        )
    ) {

        $balanceField = "wallet_balance";

    } elseif (
        investmentDocumentHasField(
            $user,
            "walletBalance"
        )
    ) {

        $balanceField = "walletBalance";
    }


    /* =====================================================
       CURRENT WALLET BALANCE

       IMPORTANT:
       This is ONLY a balance check.

       NO MONEY IS DEDUCTED HERE.
    ===================================================== */

    $walletBalance = 0;

    if (
        investmentDocumentHasField(
            $user,
            $balanceField
        )
    ) {

        $walletBalance =
            investmentNumber(
                $user[$balanceField]
            );
    }


    /* =====================================================
       CHECK SUFFICIENT BALANCE
    ===================================================== */

    if (
        $walletBalance < $amount
    ) {

        http_response_code(400);

        echo json_encode([

            "success" => false,

            "message" =>
                "Insufficient wallet balance. You need UGX " .
                number_format(
                    $amount,
                    0
                ) .
                " but your available balance is UGX " .
                number_format(
                    $walletBalance,
                    0
                ) .
                ".",

            "required_amount" =>
                $amount,

            "available_balance" =>
                $walletBalance

        ]);

        exit;
    }


    /* =====================================================
       BUILD INVESTMENT USER FILTER
    ===================================================== */

    $investmentUserOr = [];

    if (
        $userObjectId instanceof
        MongoDB\BSON\ObjectId
    ) {

        $investmentUserOr[] = [
            "user_id" =>
                $userObjectId
        ];

        $investmentUserOr[] = [
            "userId" =>
                $userObjectId
        ];
    }

    if (
        $userIdString !== ""
    ) {

        $investmentUserOr[] = [
            "user_id" =>
                $userIdString
        ];

        $investmentUserOr[] = [
            "userId" =>
                $userIdString
        ];
    }

    $accountEmail =
        trim(
            (string)(
                $user["email"]
                ?? $userEmail
            )
        );

    if (
        $accountEmail !== ""
    ) {

        $investmentUserOr[] = [
            "user_email" =>
                $accountEmail
        ];

        $investmentUserOr[] = [
            "email" =>
                $accountEmail
        ];
    }


    /* =====================================================
       PREVENT MULTIPLE ACTIVE/PENDING INVESTMENTS
    ===================================================== */

    if (
        count($investmentUserOr) > 0
    ) {

        $duplicateFilter = [

            '$and' => [

                [
                    '$or' =>
                        $investmentUserOr
                ],

                [
                    '$or' => [

                        [
                            "status" =>
                                "pending"
                        ],

                        [
                            "status" =>
                                "approved"
                        ],

                        [
                            "status" =>
                                "active"
                        ],

                        [
                            "status" =>
                                "running"
                        ]

                    ]
                ]

            ]

        ];

        $existingInvestment =
            $investments->findOne(
                $duplicateFilter
            );

        if (
            $existingInvestment !== null
        ) {

            http_response_code(400);

            echo json_encode([

                "success" => false,

                "message" =>
                    "You already have a pending or active investment. Please wait for the current investment to be completed before creating another one."

            ]);

            exit;
        }
    }


    /* =====================================================
       CALCULATE EARNINGS
    ===================================================== */

    $dailyIncome =
        $amount *
        (float)$plan["daily_rate"];

    $totalIncome =
        $dailyIncome *
        (int)$plan["duration_days"];

    $maturityAmount =
        $amount +
        $totalIncome;


    /* =====================================================
       CURRENT TIME
    ===================================================== */

    $now =
        new MongoDB\BSON\UTCDateTime();


    /* =====================================================
       REFERENCE
    ===================================================== */

    try {

        $randomPart =
            strtoupper(
                bin2hex(
                    random_bytes(4)
                )
            );

    } catch (Throwable $e) {

        $randomPart =
            strtoupper(
                substr(
                    md5(
                        uniqid(
                            "",
                            true
                        )
                    ),
                    0,
                    8
                )
            );
    }

    $reference =
        "INV-" .
        date("YmdHis") .
        "-" .
        $randomPart;


    /* =====================================================
       CREATE PENDING INVESTMENT

       CRITICAL:

       DO NOT DEDUCT WALLET HERE.

       The wallet remains exactly the same until
       the administrator approves this investment.
    ===================================================== */

    $investmentDocument = [

        "user_id" =>
            $userObjectId instanceof MongoDB\BSON\ObjectId
                ? $userObjectId
                : $userIdString,

        "userId" =>
            $userIdString,

        "user_email" =>
            $accountEmail,

        "user_name" =>
            trim(
                (string)(
                    $user["name"]
                    ?? $user["full_name"]
                    ?? $user["fullName"]
                    ?? (
                        trim(
                            (string)(
                                $user["first_name"]
                                ?? $user["firstName"]
                                ?? ""
                            )
                        ) .
                        (
                            trim(
                                (string)(
                                    $user["last_name"]
                                    ?? $user["lastName"]
                                    ?? ""
                                )
                            ) !== ""
                                ? " " .
                                    trim(
                                        (string)(
                                            $user["last_name"]
                                            ?? $user["lastName"]
                                            ?? ""
                                        )
                                    )
                                : ""
                        )
                    )
                )
            ),

        "plan" =>
            $planKey,

        "plan_name" =>
            $plan["name"],

        "package" =>
            $plan["name"],

        "amount" =>
            $amount,

        "principal" =>
            $amount,

        "reserved_amount" =>
            0,

        "currency" =>
            "UGX",

        "duration" =>
            (int)$plan["duration_days"],

        "duration_days" =>
            (int)$plan["duration_days"],

        "daily_rate" =>
            (float)$plan["daily_rate"],

        "daily_return" =>
            (float)$plan["daily_return"],

        "daily_income" =>
            $dailyIncome,

        "total_income" =>
            $totalIncome,

        "maturity_amount" =>
            $maturityAmount,

        "reference" =>
            $reference,

        "investment_reference" =>
            $reference,

        "status" =>
            "pending",

        /* Wallet has NOT been deducted. */

        "balance_reserved" =>
            false,

        "balance_deducted" =>
            false,

        "admin_approved" =>
            false,

        "principal_returned" =>
            false,

        "principal_returned_at" =>
            null,

        "approved_at" =>
            null,

        "activated_at" =>
            null,

        "started_at" =>
            null,

        "completed_at" =>
            null,

        /*
         * Earnings tracking fields.
         * These allow the daily earnings processor to
         * determine which days have already been paid.
         */

        "earnings_processed" =>
            0,

        "total_earnings_paid" =>
            0,

        "last_earning_date" =>
            null,

        "next_earning_date" =>
            null,

        "earning_days" =>
            0,

        "created_at" =>
            $now,

        "updated_at" =>
            $now
    ];


    /* =====================================================
       INSERT INVESTMENT
    ===================================================== */

    $investmentResult =
        $investments->insertOne(
            $investmentDocument
        );


    $investmentId =
        (string)
        $investmentResult
            ->getInsertedId();


    /* =====================================================
       CREATE TRANSACTION RECORD

       IMPORTANT:
       This is NOT a wallet debit.

       It records the investment request only.
    ===================================================== */

    if (
        isset($transactions)
    ) {

        try {

            $transactions->insertOne([

                "user_id" =>
                    $userObjectId instanceof MongoDB\BSON\ObjectId
                        ? $userObjectId
                        : $userIdString,

                "userId" =>
                    $userIdString,

                "user_email" =>
                    $accountEmail,

                "type" =>
                    "investment",

                "transaction_type" =>
                    "investment",

                "category" =>
                    "investment",

                "direction" =>
                    "pending",

                "amount" =>
                    $amount,

                "currency" =>
                    "UGX",

                "balance_before" =>
                    $walletBalance,

                "balance_after" =>
                    $walletBalance,

                "reference" =>
                    $reference,

                "investment_id" =>
                    $investmentId,

                "description" =>
                    "Investment request created - " .
                    $plan["name"] .
                    " - awaiting admin approval",

                "status" =>
                    "pending",

                "balance_deducted" =>
                    false,

                "created_at" =>
                    $now,

                "updated_at" =>
                    $now

            ]);

        } catch (Throwable $transactionError) {

            error_log(
                "Crown Cash investment transaction log failed: " .
                $transactionError->getMessage()
            );
        }
    }


    /* =====================================================
       AUDIT LOG
    ===================================================== */

    if (
        function_exists("audit")
    ) {

        try {

            audit(

                "investment_created",

                [

                    "investment_id" =>
                        $investmentId,

                    "reference" =>
                        $reference,

                    "plan" =>
                        $planKey,

                    "amount" =>
                        $amount,

                    "status" =>
                        "pending",

                    "wallet_deducted" =>
                        false,

                    "wallet_balance" =>
                        $walletBalance

                ]

            );

        } catch (Throwable $auditError) {

            error_log(
                "Crown Cash investment audit failed: " .
                $auditError->getMessage()
            );
        }
    }


    /* =====================================================
       SUCCESS

       Wallet is intentionally unchanged.
    ===================================================== */

    http_response_code(201);

    echo json_encode([

        "success" =>
            true,

        "message" =>
            "Investment request created successfully. Your wallet will only be deducted after admin approval.",

        "investment" => [

            "id" =>
                $investmentId,

            "reference" =>
                $reference,

            "plan" =>
                $planKey,

            "plan_name" =>
                $plan["name"],

            "amount" =>
                $amount,

            "currency" =>
                "UGX",

            "duration_days" =>
                (int)$plan["duration_days"],

            "daily_rate" =>
                (float)$plan["daily_rate"],

            "daily_income" =>
                $dailyIncome,

            "total_income" =>
                $totalIncome,

            "maturity_amount" =>
                $maturityAmount,

            "status" =>
                "pending",

            "balance_deducted" =>
                false

        ],

        "wallet" => [

            "previous_balance" =>
                $walletBalance,

            "amount_deducted" =>
                0,

            "new_balance" =>
                $walletBalance,

            "balance_unchanged" =>
                true

        ],

        "previous_balance" =>
            $walletBalance,

        "amount_deducted" =>
            0,

        "new_balance" =>
            $walletBalance

    ], JSON_UNESCAPED_SLASHES);

    exit;


} catch (Throwable $e) {

    error_log(
        "Crown Cash investment error: " .
        $e->getMessage()
    );

    http_response_code(500);

    echo json_encode([

        "success" =>
            false,

        "message" =>
            "Unable to create investment.",

        "error" =>
            $e->getMessage()

    ]);

    exit;
}

?>