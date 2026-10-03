<?php

/* =========================================================
   CROWN CASH - CREATE INVESTMENT API
   File: investment.php

   PURPOSE:
   - Create a new investment
   - Deduct investment amount from user's wallet
   - Save investment as pending
   - Record transaction
   - Do NOT deduct again during admin approval

   PLANS:
   Starter  = UGX 10,000
   Standard = UGX 15,000
   Advanced = UGX 25,000

   Daily Return = 10%
   Duration     = 30 days
========================================================= */


/* =========================================================
   ERROR HANDLING
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

} else {

    /*
     * Keep production origin available when
     * the browser does not send an Origin header.
     */

    if ($requestOrigin === "") {

        header(
            "Access-Control-Allow-Origin: https://crown-cash.vercel.app"
        );
    }
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
    ($_SERVER["REQUEST_METHOD"] ?? "") ===
    "OPTIONS"
) {

    http_response_code(204);

    exit;
}


/* =========================================================
   ONLY POST
========================================================= */

if (
    ($_SERVER["REQUEST_METHOD"] ?? "") !==
    "POST"
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

try {

    /*
     * IMPORTANT:
     * Crown Cash uses CROWN_CASH_SESSION.
     */

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

$loggedIn =
    !empty(
        $_SESSION["logged_in"]
    );


if (!$loggedIn) {

    http_response_code(401);

    echo json_encode([
        "success" => false,
        "message" => "Please log in before making an investment."
    ]);

    exit;
}


/* =========================================================
   GET SESSION USER ID
========================================================= */

$userId =
    $_SESSION["user_id"]
    ?? $_SESSION["userId"]
    ?? $_SESSION["id"]
    ?? $_SESSION["_id"]
    ?? null;


$userEmail =
    $_SESSION["email"]
    ?? $_SESSION["user_email"]
    ?? "";


if (
    $userId === null &&
    trim((string)$userEmail) === ""
) {

    http_response_code(401);

    echo json_encode([
        "success" => false,
        "message" => "Your login session does not contain a valid user account."
    ]);

    exit;
}


/* =========================================================
   READ REQUEST
========================================================= */

$rawInput =
    file_get_contents("php://input");


$data = json_decode(
    $rawInput,
    true
);


if (
    !is_array($data)
) {

    $data = $_POST;
}


/* =========================================================
   REQUEST VALUES
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
        "message" => "Please select a valid investment plan."
    ]);

    exit;
}


/* =========================================================
   FIXED PLAN DETAILS
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
   DATABASE COLLECTION CHECK
========================================================= */

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


/* =========================================================
   HELPER: NUMBER
========================================================= */

function investmentNumber(
    $value
): float {

    if (
        $value === null
    ) {
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
   HELPER: OBJECT ID
========================================================= */

function investmentObjectId(
    $value
) {

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
   HELPER: CURRENT USER FILTER
========================================================= */

function buildInvestmentUserFilter(
    $userId,
    $userEmail = ""
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
            "_id" => $userIdString
        ];

        $or[] = [
            "id" => $userIdString
        ];

        $or[] = [
            "user_id" => $userIdString
        ];
    }


    $email =
        trim(
            (string)$userEmail
        );


    if (
        $email !== ""
    ) {

        $or[] = [
            "email" => $email
        ];

        $or[] = [
            "email" => strtolower($email)
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
   MAIN INVESTMENT PROCESS
========================================================= */

try {

    /* =====================================================
       FIND USER
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
            "message" => "Your Crown Cash account could not be found."
        ]);

        exit;
    }


    /* =====================================================
       DETERMINE WALLET FIELD
    ===================================================== */

    $balanceField = null;


    $possibleBalanceFields = [

        "balance",

        "wallet_balance",

        "walletBalance"

    ];


    foreach (
        $possibleBalanceFields
        as $field
    ) {

        if (
            array_key_exists(
                $field,
                $user
            )
        ) {

            $balanceField =
                $field;

            break;
        }
    }


    /*
     * If no wallet field exists yet,
     * use the normal Crown Cash balance field.
     */

    if (
        $balanceField === null
    ) {

        $balanceField =
            "balance";
    }


    $walletBalance =
        array_key_exists(
            $balanceField,
            $user
        )
            ? investmentNumber(
                $user[$balanceField]
            )
            : 0;


    /* =====================================================
       CHECK BALANCE
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
       CHECK DUPLICATE INVESTMENT
    ===================================================== */

    $investmentUserOr = [];


    $userObjectId =
        investmentObjectId(
            $userId
        );


    if (
        $userObjectId !== null
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


    $userIdString =
        trim(
            (string)$userId
        );


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


    /* =====================================================
       CALCULATIONS
    ===================================================== */

    $dailyIncome =
        $amount *
        $plan["daily_rate"];


    $totalIncome =
        $dailyIncome *
        $plan["duration_days"];


    $maturityAmount =
        $amount +
        $totalIncome;


    $now =
        new MongoDB\BSON\UTCDateTime();


    /* =====================================================
       INVESTMENT REFERENCE
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
       ATOMIC WALLET DEDUCTION
    =====================================================

       The balance condition is included in the filter.
       This prevents the balance from going below the
       required amount if two requests happen together.

       MongoDB updateOne/findOneAndUpdate operations are
       supported by the PHP library. 
    ===================================================== */

    $balanceFilter = [

        '$and' => [

            $userFilter,

            [
                $balanceField => [
                    '$gte' =>
                        $amount
                ]
            ]

        ]

    ];


    $newBalance =
        $walletBalance -
        $amount;


    /*
     * Use $set rather than $inc so the resulting
     * balance is exactly calculated from the balance
     * we verified.
     */

    $walletUpdate = [

        '$set' => [

            $balanceField =>
                $newBalance

        ]

    ];


    $walletResult =
        $users->updateOne(
            $balanceFilter,
            $walletUpdate
        );


    if (
        $walletResult->getMatchedCount() !== 1
    ) {

        /*
         * The balance may have changed between the
         * initial read and this update.
         */

        http_response_code(400);

        echo json_encode([
            "success" => false,
            "message" =>
                "Your wallet balance changed before the investment could be created. Please refresh your wallet and try again."
        ]);

        exit;
    }


    /* =====================================================
       CREATE INVESTMENT DOCUMENT
    ===================================================== */

    $investmentDocument = [

        "user_id" =>
            $userObjectId !== null
                ? $userObjectId
                : $userIdString,

        "userId" =>
            $userIdString,

        "user_email" =>
            trim(
                (string)(
                    $user["email"]
                    ?? $userEmail
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
            $amount,

        "currency" =>
            "UGX",

        "duration" =>
            $plan["duration_days"],

        "duration_days" =>
            $plan["duration_days"],

        "daily_rate" =>
            $plan["daily_rate"],

        "daily_return" =>
            $plan["daily_return"],

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

        /*
         * The money has already been deducted
         * from the wallet.
         */

        "balance_reserved" =>
            true,

        "balance_deducted" =>
            true,

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

        "created_at" =>
            $now,

        "updated_at" =>
            $now
    ];


    /* =====================================================
       INSERT INVESTMENT
    ===================================================== */

    try {

        $investmentResult =
            $investments->insertOne(
                $investmentDocument
            );

    } catch (Throwable $investmentError) {

        /*
         * IMPORTANT:
         * If investment creation fails after the wallet
         * has been deducted, restore the deducted amount.
         */

        try {

            $users->updateOne(
                [
                    '$and' => [

                        $userFilter,

                        [
                            $balanceField =>
                                $newBalance
                        ]

                    ]
                ],
                [
                    '$set' => [

                        $balanceField =>
                            $walletBalance

                    ]
                ]
            );

        } catch (Throwable $restoreError) {

            error_log(
                "Crown Cash wallet restoration failed: " .
                $restoreError->getMessage()
            );
        }


        http_response_code(500);

        echo json_encode([
            "success" => false,
            "message" =>
                "The investment could not be created, so your wallet deduction was cancelled.",

            "error" =>
                $investmentError->getMessage()
        ]);

        exit;
    }


    /* =====================================================
       INVESTMENT ID
    ===================================================== */

    $investmentId =
        (string)
        $investmentResult
            ->getInsertedId();


    /* =====================================================
       TRANSACTION RECORD
    ===================================================== */

    /*
     * Transaction logging should not make a successful
     * investment fail.
     */

    if (
        isset($transactions)
    ) {

        try {

            $transactions->insertOne([

                "user_id" =>
                    $userObjectId !== null
                        ? $userObjectId
                        : $userIdString,

                "userId" =>
                    $userIdString,

                "type" =>
                    "investment",

                "transaction_type" =>
                    "investment",

                "category" =>
                    "investment",

                "direction" =>
                    "debit",

                "amount" =>
                    $amount,

                "currency" =>
                    "UGX",

                "balance_before" =>
                    $walletBalance,

                "balance_after" =>
                    $newBalance,

                "reference" =>
                    $reference,

                "investment_id" =>
                    $investmentId,

                "description" =>
                    "Investment created - " .
                    $plan["name"],

                "status" =>
                    "completed",

                "created_at" =>
                    $now

            ]);

        } catch (Throwable $transactionError) {

            /*
             * Keep the investment successful.
             * Log transaction failure for debugging.
             */

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

                    "balance_before" =>
                        $walletBalance,

                    "balance_after" =>
                        $newBalance
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
       SUCCESS RESPONSE
    ===================================================== */

    http_response_code(201);

    echo json_encode([

        "success" =>
            true,

        "message" =>
            "Investment created successfully. Your investment is now pending admin approval.",

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
                $plan["duration_days"],

            "daily_rate" =>
                $plan["daily_rate"],

            "daily_income" =>
                $dailyIncome,

            "total_income" =>
                $totalIncome,

            "status" =>
                "pending"

        ],

        "wallet" => [

            "previous_balance" =>
                $walletBalance,

            "amount_deducted" =>
                $amount,

            "new_balance" =>
                $newBalance

        ],

        "previous_balance" =>
            $walletBalance,

        "amount_deducted" =>
            $amount,

        "new_balance" =>
            $newBalance

    ], JSON_UNESCAPED_SLASHES);

    exit;


} catch (Throwable $e) {

    /*
     * Catch unexpected backend errors.
     */

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