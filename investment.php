<?php

declare(strict_types=1);

/*
|--------------------------------------------------------------------------
| CROWN CASH - CREATE INVESTMENT API
| File: investment.php
|--------------------------------------------------------------------------
|
| NEW INVESTMENT STRUCTURE
|
| USER ENTERS AMOUNT
|        ↓
| Minimum UGX 10,000
|        ↓
| Check wallet balance
|        ↓
| Deduct investment immediately
|        ↓
| Create ACTIVE investment
|        ↓
| Earnings become eligible according to earning schedule
|
| NO ADMIN APPROVAL
| NO PENDING INVESTMENTS
|
|--------------------------------------------------------------------------
| IMPORTANT
|--------------------------------------------------------------------------
| The investment rate and duration are controlled by the SERVER.
| The frontend must NOT be trusted to supply these values.
|
*/


ini_set("display_errors", "0");
ini_set("log_errors", "1");

error_reporting(E_ALL);


/*
|--------------------------------------------------------------------------
| CONFIG
|--------------------------------------------------------------------------
*/

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


/*
|--------------------------------------------------------------------------
| CORS
|--------------------------------------------------------------------------
*/

$requestOrigin = $_SERVER["HTTP_ORIGIN"] ?? "";

$allowedOrigins = [
    "https://crown-cash.vercel.app",
    "https://www.crown-cash.vercel.app"
];

if (in_array($requestOrigin, $allowedOrigins, true)) {

    header(
        "Access-Control-Allow-Origin: " . $requestOrigin
    );

} elseif ($requestOrigin === "") {

    header(
        "Access-Control-Allow-Origin: https://crown-cash.vercel.app"
    );
}

header("Access-Control-Allow-Credentials: true");

header(
    "Access-Control-Allow-Headers: Content-Type, Accept, Authorization, X-Requested-With"
);

header(
    "Access-Control-Allow-Methods: POST, OPTIONS"
);

header(
    "Access-Control-Max-Age: 86400"
);

header("Vary: Origin");

header(
    "Content-Type: application/json; charset=UTF-8"
);


/*
|--------------------------------------------------------------------------
| PREFLIGHT
|--------------------------------------------------------------------------
*/

if (
    ($_SERVER["REQUEST_METHOD"] ?? "") === "OPTIONS"
) {

    http_response_code(204);

    exit;
}


/*
|--------------------------------------------------------------------------
| ONLY POST
|--------------------------------------------------------------------------
*/

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


/*
|--------------------------------------------------------------------------
| SESSION
|--------------------------------------------------------------------------
*/

try {

    if (
        function_exists("startSecureSession")
    ) {

        startSecureSession();

    } elseif (
        session_status() !== PHP_SESSION_ACTIVE
    ) {

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

} catch (Throwable $e) {

    http_response_code(500);

    echo json_encode([
        "success" => false,
        "message" => "Unable to start your session."
    ]);

    exit;
}


/*
|--------------------------------------------------------------------------
| AUTHENTICATION
|--------------------------------------------------------------------------
*/

if (empty($_SESSION["logged_in"])) {

    http_response_code(401);

    echo json_encode([
        "success" => false,
        "message" => "Please log in before making an investment."
    ]);

    exit;
}


/*
|--------------------------------------------------------------------------
| USER ID
|--------------------------------------------------------------------------
*/

$userId =
    $_SESSION["user_id"]
    ?? $_SESSION["userId"]
    ?? $_SESSION["id"]
    ?? $_SESSION["_id"]
    ?? null;

$userEmail = trim(
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
        "message" => "Your login session does not contain a valid user account."
    ]);

    exit;
}


/*
|--------------------------------------------------------------------------
| READ REQUEST
|--------------------------------------------------------------------------
*/

$rawInput = file_get_contents("php://input");

$data = json_decode(
    $rawInput,
    true
);

if (!is_array($data)) {
    $data = $_POST;
}


/*
|--------------------------------------------------------------------------
| GET INVESTMENT AMOUNT
|--------------------------------------------------------------------------
|
| Supported:
|
| amount
| investment_amount
| investmentAmount
|
*/

$rawAmount =
    $data["amount"]
    ?? $data["investment_amount"]
    ?? $data["investmentAmount"]
    ?? null;


/*
|--------------------------------------------------------------------------
| VALIDATE AMOUNT
|--------------------------------------------------------------------------
*/

if (
    $rawAmount === null ||
    $rawAmount === "" ||
    !is_numeric($rawAmount)
) {

    http_response_code(400);

    echo json_encode([
        "success" => false,
        "message" => "Please enter a valid investment amount."
    ]);

    exit;
}


$amount = (float)$rawAmount;


/*
|--------------------------------------------------------------------------
| MINIMUM INVESTMENT
|--------------------------------------------------------------------------
*/

$minimumInvestment = 10000;


/*
|--------------------------------------------------------------------------
| NO ZERO / NEGATIVE INVESTMENTS
|--------------------------------------------------------------------------
*/

if ($amount <= 0) {

    http_response_code(400);

    echo json_encode([
        "success" => false,
        "message" => "Investment amount must be greater than zero."
    ]);

    exit;
}


/*
|--------------------------------------------------------------------------
| MINIMUM UGX 10,000
|--------------------------------------------------------------------------
*/

if ($amount < $minimumInvestment) {

    http_response_code(400);

    echo json_encode([

        "success" => false,

        "message" =>
            "The minimum investment amount is UGX " .
            number_format($minimumInvestment, 0) .
            ".",

        "minimum_amount" =>
            $minimumInvestment

    ]);

    exit;
}


/*
|--------------------------------------------------------------------------
| NORMALIZE UGX
|--------------------------------------------------------------------------
|
| Crown Cash investments are stored as whole UGX amounts.
|
*/

$amount = round($amount, 0);


/*
|--------------------------------------------------------------------------
| SERVER-SIDE INVESTMENT SETTINGS
|--------------------------------------------------------------------------
|
| These values MUST NOT come from the frontend.
|
| Change these values here when your approved business rules change.
|
*/

$dailyRate = 0.10;       // 10%
$dailyReturn = 10;       // 10%
$durationDays = 30;


/*
|--------------------------------------------------------------------------
| DAILY EARNINGS
|--------------------------------------------------------------------------
*/

$dailyIncome =
    $amount * $dailyRate;


/*
|--------------------------------------------------------------------------
| TOTAL PROJECTED EARNINGS
|--------------------------------------------------------------------------
*/

$totalIncome =
    $dailyIncome * $durationDays;


/*
|--------------------------------------------------------------------------
| PROJECTED MATURITY VALUE
|--------------------------------------------------------------------------
*/

$maturityAmount =
    $amount + $totalIncome;


/*
|--------------------------------------------------------------------------
| NUMBER HELPER
|--------------------------------------------------------------------------
*/

function investmentNumber($value): float
{
    if ($value === null) {
        return 0.0;
    }

    if (
        $value instanceof MongoDB\BSON\Decimal128
    ) {

        return (float)$value->toString();
    }

    if (
        $value instanceof MongoDB\BSON\Int64
    ) {

        return (float)$value->__toString();
    }

    if (
        $value instanceof MongoDB\BSON\Double
    ) {

        return (float)$value->__toString();
    }

    if (is_numeric($value)) {
        return (float)$value;
    }

    if (is_array($value)) {

        if (
            isset($value["\$numberDecimal"])
        ) {

            return (float)$value["\$numberDecimal"];
        }

        if (
            isset($value["\$numberLong"])
        ) {

            return (float)$value["\$numberLong"];
        }

        if (
            isset($value["value"])
        ) {

            return investmentNumber(
                $value["value"]
            );
        }
    }

    return 0.0;
}


/*
|--------------------------------------------------------------------------
| OBJECT ID HELPER
|--------------------------------------------------------------------------
*/

function investmentObjectId($value)
{
    if (
        $value instanceof MongoDB\BSON\ObjectId
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


/*
|--------------------------------------------------------------------------
| DOCUMENT FIELD HELPER
|--------------------------------------------------------------------------
*/

function investmentDocumentHasField(
    $document,
    string $field
): bool {

    if (is_array($document)) {

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


/*
|--------------------------------------------------------------------------
| USER FILTER
|--------------------------------------------------------------------------
*/

function buildInvestmentUserFilter(
    $userId,
    string $userEmail = ""
): array {

    $or = [];

    $objectId =
        investmentObjectId($userId);

    if ($objectId !== null) {

        $or[] = [
            "_id" => $objectId
        ];
    }

    $userIdString =
        trim((string)$userId);

    if ($userIdString !== "") {

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

    if ($userEmail !== "") {

        $or[] = [
            "email" => $userEmail
        ];

        $or[] = [
            "email" => strtolower($userEmail)
        ];
    }

    if (count($or) === 0) {

        return [
            "_id" => null
        ];
    }

    return [
        '$or' => $or
    ];
}


/*
|--------------------------------------------------------------------------
| MAIN INVESTMENT PROCESS
|--------------------------------------------------------------------------
*/

try {

    /*
    |--------------------------------------------------------------------------
    | CHECK DATABASE COLLECTIONS
    |--------------------------------------------------------------------------
    */

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


    /*
    |--------------------------------------------------------------------------
    | FIND USER
    |--------------------------------------------------------------------------
    */

    $userFilter =
        buildInvestmentUserFilter(
            $userId,
            $userEmail
        );

    $user =
        $users->findOne(
            $userFilter
        );


    if ($user === null) {

        http_response_code(404);

        echo json_encode([
            "success" => false,
            "message" => "Your Crown Cash account could not be found."
        ]);

        exit;
    }


    /*
    |--------------------------------------------------------------------------
    | USER OBJECT ID
    |--------------------------------------------------------------------------
    */

    $userObjectId =
        $user["_id"]
        ?? investmentObjectId($userId);

    $userIdString =
        trim((string)$userId);


    /*
    |--------------------------------------------------------------------------
    | ACCOUNT EMAIL
    |--------------------------------------------------------------------------
    */

    $accountEmail =
        trim(
            (string)(
                $user["email"]
                ?? $userEmail
            )
        );


    /*
    |--------------------------------------------------------------------------
    | DETERMINE WALLET FIELD
    |--------------------------------------------------------------------------
    */

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


    /*
    |--------------------------------------------------------------------------
    | CURRENT WALLET
    |--------------------------------------------------------------------------
    */

    $walletBalance = 0.0;

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


    /*
    |--------------------------------------------------------------------------
    | CHECK BALANCE
    |--------------------------------------------------------------------------
    */

    if ($walletBalance < $amount) {

        http_response_code(400);

        echo json_encode([

            "success" => false,

            "message" =>
                "Insufficient wallet balance. You need UGX " .
                number_format($amount, 0) .
                " but your available balance is UGX " .
                number_format($walletBalance, 0) .
                ".",

            "required_amount" =>
                $amount,

            "available_balance" =>
                $walletBalance

        ]);

        exit;
    }


    /*
    |--------------------------------------------------------------------------
    | BALANCE AFTER INVESTMENT
    |--------------------------------------------------------------------------
    */

    $newBalance =
        $walletBalance - $amount;


    /*
    |--------------------------------------------------------------------------
    | CURRENT TIME
    |--------------------------------------------------------------------------
    */

    $now =
        new MongoDB\BSON\UTCDateTime();


    /*
    |--------------------------------------------------------------------------
    | NEXT EARNING DATE
    |--------------------------------------------------------------------------
    |
    | Investment becomes active immediately.
    | First daily earning is scheduled for the next earning day.
    |
    */

    $nextEarningTimestamp =
        (time() + 86400) * 1000;

    $nextEarningDate =
        new MongoDB\BSON\UTCDateTime(
            $nextEarningTimestamp
        );


    /*
    |--------------------------------------------------------------------------
    | INVESTMENT REFERENCE
    |--------------------------------------------------------------------------
    */

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
                        uniqid("", true)
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


    /*
    |--------------------------------------------------------------------------
    | USER NAME
    |--------------------------------------------------------------------------
    */

    $firstName =
        trim(
            (string)(
                $user["first_name"]
                ?? $user["firstName"]
                ?? ""
            )
        );

    $lastName =
        trim(
            (string)(
                $user["last_name"]
                ?? $user["lastName"]
                ?? ""
            )
        );

    $userName =
        trim(
            (string)(
                $user["name"]
                ?? $user["full_name"]
                ?? $user["fullName"]
                ?? trim(
                    $firstName .
                    " " .
                    $lastName
                )
            )
        );


    /*
    |--------------------------------------------------------------------------
    | BUILD ACTIVE INVESTMENT
    |--------------------------------------------------------------------------
    */

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
            $userName,

        /*
        |--------------------------------------------------------------------------
        | NEW STRUCTURE HAS NO PLAN
        |--------------------------------------------------------------------------
        */

        "plan" =>
            "custom",

        "plan_name" =>
            "Crown Cash Investment",

        "package" =>
            "Crown Cash Investment",

        /*
        |--------------------------------------------------------------------------
        | PRINCIPAL
        |--------------------------------------------------------------------------
        */

        "amount" =>
            $amount,

        "principal" =>
            $amount,

        "reserved_amount" =>
            $amount,

        "currency" =>
            "UGX",

        /*
        |--------------------------------------------------------------------------
        | EARNING SETTINGS
        |--------------------------------------------------------------------------
        */

        "daily_rate" =>
            $dailyRate,

        "daily_return" =>
            $dailyReturn,

        "daily_income" =>
            $dailyIncome,

        "duration" =>
            $durationDays,

        "duration_days" =>
            $durationDays,

        "total_income" =>
            $totalIncome,

        "maturity_amount" =>
            $maturityAmount,

        /*
        |--------------------------------------------------------------------------
        | REFERENCE
        |--------------------------------------------------------------------------
        */

        "reference" =>
            $reference,

        "investment_reference" =>
            $reference,

        /*
        |--------------------------------------------------------------------------
        | ACTIVE IMMEDIATELY
        |--------------------------------------------------------------------------
        */

        "status" =>
            "active",

        "admin_approved" =>
            true,

        "balance_reserved" =>
            true,

        "balance_deducted" =>
            true,

        /*
        |--------------------------------------------------------------------------
        | TIMESTAMPS
        |--------------------------------------------------------------------------
        */

        "created_at" =>
            $now,

        "updated_at" =>
            $now,

        "activated_at" =>
            $now,

        "started_at" =>
            $now,

        "approved_at" =>
            $now,

        "next_earning_date" =>
            $nextEarningDate,

        "last_earning_date" =>
            null,

        "completed_at" =>
            null,

        /*
        |--------------------------------------------------------------------------
        | EARNINGS TRACKING
        |--------------------------------------------------------------------------
        */

        "earnings_processed" =>
            0,

        "total_earnings_paid" =>
            0,

        "earning_days" =>
            0,

        /*
        |--------------------------------------------------------------------------
        | PRINCIPAL TRACKING
        |--------------------------------------------------------------------------
        */

        "principal_returned" =>
            false,

        "principal_returned_at" =>
            null
    ];


    /*
    |--------------------------------------------------------------------------
    | IMPORTANT:
    | ATOMIC WALLET DEDUCTION
    |--------------------------------------------------------------------------
    |
    | We use an atomic update with:
    |
    | balance >= amount
    |
    | This prevents two simultaneous requests from both spending
    | the same wallet balance.
    |
    */

    $updatedUser =
        $users->findOneAndUpdate(

            [
                "_id" =>
                    $user["_id"],

                $balanceField =>
                    [
                        '$gte' =>
                            $amount
                    ]
            ],

            [
                '$inc' =>
                    [
                        $balanceField =>
                            -$amount
                    ],

                '$set' =>
                    [
                        "updated_at" =>
                            $now
                    ]
            ],

            [
                "returnDocument" =>
                    MongoDB\Operation\FindOneAndUpdate::RETURN_DOCUMENT_AFTER
            ]

        );


    /*
    |--------------------------------------------------------------------------
    | DEDUCTION FAILED
    |--------------------------------------------------------------------------
    */

    if ($updatedUser === null) {

        http_response_code(400);

        echo json_encode([

            "success" => false,

            "message" =>
                "The investment could not be processed because your wallet balance is insufficient or changed. Please refresh your balance and try again."

        ]);

        exit;
    }


    /*
    |--------------------------------------------------------------------------
    | INSERT ACTIVE INVESTMENT
    |--------------------------------------------------------------------------
    */

    try {

        $investmentResult =
            $investments->insertOne(
                $investmentDocument
            );

    } catch (Throwable $investmentError) {

        /*
        |--------------------------------------------------------------------------
        | COMPENSATE WALLET IF INVESTMENT INSERT FAILS
        |--------------------------------------------------------------------------
        |
        | This restores the amount if the investment record could not
        | be created.
        |
        */

        try {

            $users->updateOne(

                [
                    "_id" =>
                        $user["_id"]
                ],

                [
                    '$inc' =>
                        [
                            $balanceField =>
                                $amount
                        ],

                    '$set' =>
                        [
                            "updated_at" =>
                                new MongoDB\BSON\UTCDateTime()
                        ]
                ]

            );

        } catch (Throwable $refundError) {

            error_log(
                "CRITICAL Crown Cash wallet compensation failed: " .
                $refundError->getMessage()
            );
        }

        throw $investmentError;
    }


    /*
    |--------------------------------------------------------------------------
    | INVESTMENT ID
    |--------------------------------------------------------------------------
    */

    $investmentId =
        (string)
        $investmentResult->getInsertedId();


    /*
    |--------------------------------------------------------------------------
    | TRANSACTION RECORD
    |--------------------------------------------------------------------------
    */

    if (isset($transactions)) {

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
                    "Investment created and wallet debited.",

                "status" =>
                    "completed",

                "balance_deducted" =>
                    true,

                "created_at" =>
                    $now,

                "updated_at" =>
                    $now

            ]);

        } catch (Throwable $transactionError) {

            /*
            |--------------------------------------------------------------------------
            | Transaction logging failure should NOT undo the investment.
            |
            | The actual wallet deduction and investment already exist.
            |--------------------------------------------------------------------------
            */

            error_log(
                "Crown Cash investment transaction log failed: " .
                $transactionError->getMessage()
            );
        }
    }


    /*
    |--------------------------------------------------------------------------
    | AUDIT LOG
    |--------------------------------------------------------------------------
    */

    if (function_exists("audit")) {

        try {

            audit(
                "investment_created",
                [
                    "investment_id" =>
                        $investmentId,

                    "reference" =>
                        $reference,

                    "amount" =>
                        $amount,

                    "status" =>
                        "active",

                    "wallet_deducted" =>
                        true,

                    "wallet_balance_before" =>
                        $walletBalance,

                    "wallet_balance_after" =>
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


    /*
    |--------------------------------------------------------------------------
    | SUCCESS RESPONSE
    |--------------------------------------------------------------------------
    */

    http_response_code(201);

    echo json_encode([

        "success" =>
            true,

        "message" =>
            "Investment created successfully. The investment is now active.",

        "investment" => [

            "id" =>
                $investmentId,

            "reference" =>
                $reference,

            "amount" =>
                $amount,

            "currency" =>
                "UGX",

            "status" =>
                "active",

            "daily_rate" =>
                $dailyRate,

            "daily_return" =>
                $dailyReturn,

            "daily_income" =>
                $dailyIncome,

            "duration_days" =>
                $durationDays,

            "total_income" =>
                $totalIncome,

            "maturity_amount" =>
                $maturityAmount,

            "activated_at" =>
                $now,

            "started_at" =>
                $now,

            "next_earning_date" =>
                $nextEarningDate

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

        /*
         * Do not expose internal database errors to users
         * in production.
         */
        "error" =>
            "Investment processing failed."

    ]);

    exit;
}

?>