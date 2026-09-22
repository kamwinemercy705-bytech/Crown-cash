<?php

/*
|--------------------------------------------------------------------------
| CROWN CASH — WITHDRAWAL REQUEST API
|--------------------------------------------------------------------------
| Creates a pending withdrawal request for the logged-in user.
|
| Withdrawal rules:
| - Minimum withdrawal: UGX 5,000
| - Withdrawal fee: 10%
| - Option A: fee is deducted from requested withdrawal amount
|
| Example:
| Requested: UGX 20,000
| Fee 10%:   UGX  2,000
| Payout:    UGX 18,000
|
| Admin approval is required before the withdrawal is processed.
|--------------------------------------------------------------------------
*/


/*
|--------------------------------------------------------------------------
| CROSS-SITE SESSION
|--------------------------------------------------------------------------
*/

session_set_cookie_params([
    "lifetime" => 0,
    "path" => "/",
    "secure" => true,
    "httponly" => true,
    "samesite" => "None"
]);

session_start();


/*
|--------------------------------------------------------------------------
| CORS
|--------------------------------------------------------------------------
*/

header(
    "Access-Control-Allow-Origin: https://crown-cash.vercel.app"
);

header(
    "Access-Control-Allow-Credentials: true"
);

header(
    "Access-Control-Allow-Methods: POST, OPTIONS"
);

header(
    "Access-Control-Allow-Headers: Content-Type"
);

header(
    "Content-Type: application/json; charset=UTF-8"
);


/*
|--------------------------------------------------------------------------
| HANDLE OPTIONS REQUEST
|--------------------------------------------------------------------------
*/

if ($_SERVER["REQUEST_METHOD"] === "OPTIONS") {

    http_response_code(204);

    exit;
}


/*
|--------------------------------------------------------------------------
| ONLY POST ALLOWED
|--------------------------------------------------------------------------
*/

if ($_SERVER["REQUEST_METHOD"] !== "POST") {

    http_response_code(405);

    echo json_encode([
        "success" => false,
        "message" => "Method not allowed."
    ]);

    exit;
}


/*
|--------------------------------------------------------------------------
| CHECK LOGIN
|--------------------------------------------------------------------------
*/

if (
    empty($_SESSION["logged_in"]) ||
    empty($_SESSION["user_id"])
) {

    http_response_code(401);

    echo json_encode([
        "success" => false,
        "message" =>
            "You must be logged in to make a withdrawal."
    ]);

    exit;
}


/*
|--------------------------------------------------------------------------
| LOAD DATABASE
|--------------------------------------------------------------------------
*/

require_once __DIR__ . "/config.php";


/*
|--------------------------------------------------------------------------
| READ JSON REQUEST
|--------------------------------------------------------------------------
*/

$input = json_decode(
    file_get_contents("php://input"),
    true
);


/*
|--------------------------------------------------------------------------
| ALSO SUPPORT NORMAL POST REQUESTS
|--------------------------------------------------------------------------
*/

if (!is_array($input)) {

    $input = $_POST;

}


/*
|--------------------------------------------------------------------------
| GET AMOUNT
|--------------------------------------------------------------------------
*/

$amount = $input["amount"] ?? null;


/*
|--------------------------------------------------------------------------
| GET PAYMENT METHOD
|--------------------------------------------------------------------------
*/

$method =
    strtolower(
        trim(
            (string)(
                $input["payment_method"]
                ?? $input["method"]
                ?? ""
            )
        )
    );


/*
|--------------------------------------------------------------------------
| GET MOBILE MONEY ACCOUNT
|--------------------------------------------------------------------------
*/

$account =
    trim(
        (string)(
            $input["phone"]
            ?? $input["account"]
            ?? ""
        )
    );


/*
|--------------------------------------------------------------------------
| VALIDATE AMOUNT
|--------------------------------------------------------------------------
*/

if (
    $amount === null ||
    $amount === "" ||
    !is_numeric($amount)
) {

    http_response_code(400);

    echo json_encode([
        "success" => false,
        "message" =>
            "Enter a valid withdrawal amount."
    ]);

    exit;
}


$amount = (float)$amount;


/*
|--------------------------------------------------------------------------
| MINIMUM WITHDRAWAL
|--------------------------------------------------------------------------
|
| Crown Cash minimum withdrawal is UGX 5,000.
|--------------------------------------------------------------------------
*/

$minimumWithdrawal = 5000;


if ($amount < $minimumWithdrawal) {

    http_response_code(400);

    echo json_encode([
        "success" => false,
        "message" =>
            "Minimum withdrawal amount is UGX 5,000."
    ]);

    exit;
}


/*
|--------------------------------------------------------------------------
| ENSURE WHOLE UGX
|--------------------------------------------------------------------------
*/

if (floor($amount) != $amount) {

    http_response_code(400);

    echo json_encode([
        "success" => false,
        "message" =>
            "Withdrawal amount must be a whole UGX amount."
    ]);

    exit;
}


$amount = (int)$amount;


/*
|--------------------------------------------------------------------------
| WITHDRAWAL FEE
|--------------------------------------------------------------------------
|
| Option A:
|
| The fee comes out of the requested withdrawal amount.
|
| Example:
|
| UGX 20,000 requested
| 10% fee = UGX 2,000
| User receives = UGX 18,000
|--------------------------------------------------------------------------
*/

$withdrawalFeeRate = 0.10;


/*
|--------------------------------------------------------------------------
| CALCULATE FEE
|--------------------------------------------------------------------------
*/

$withdrawalFee =
    (int)round(
        $amount * $withdrawalFeeRate
    );


/*
|--------------------------------------------------------------------------
| CALCULATE PAYOUT
|--------------------------------------------------------------------------
*/

$payoutAmount =
    $amount - $withdrawalFee;


/*
|--------------------------------------------------------------------------
| SAFETY CHECK
|--------------------------------------------------------------------------
*/

if ($payoutAmount <= 0) {

    http_response_code(400);

    echo json_encode([
        "success" => false,
        "message" =>
            "Invalid withdrawal amount."
    ]);

    exit;
}


/*
|--------------------------------------------------------------------------
| NORMALIZE PAYMENT METHOD
|--------------------------------------------------------------------------
*/

if ($method === "mtn") {

    $method = "MTN";

}

elseif ($method === "airtel") {

    $method = "Airtel";

}

else {

    http_response_code(400);

    echo json_encode([
        "success" => false,
        "message" =>
            "Please select MTN or Airtel Mobile Money."
    ]);

    exit;
}


/*
|--------------------------------------------------------------------------
| VALIDATE MOBILE MONEY NUMBER
|--------------------------------------------------------------------------
*/

if ($account === "") {

    http_response_code(400);

    echo json_encode([
        "success" => false,
        "message" =>
            "Enter the Mobile Money account number."
    ]);

    exit;
}


/*
|--------------------------------------------------------------------------
| CLEAN PHONE NUMBER
|--------------------------------------------------------------------------
*/

$account = preg_replace(
    "/[\s\-]/",
    "",
    $account
);


/*
|--------------------------------------------------------------------------
| CONVERT +256 TO 0XXXXXXXXX
|--------------------------------------------------------------------------
*/

if (strpos($account, "+256") === 0) {

    $account =
        "0" . substr($account, 4);

}


/*
|--------------------------------------------------------------------------
| VALIDATE UGANDAN NUMBER
|--------------------------------------------------------------------------
*/

if (!preg_match(
    "/^07[0-9]{8}$/",
    $account
)) {

    http_response_code(400);

    echo json_encode([
        "success" => false,
        "message" =>
            "Enter a valid Ugandan Mobile Money number."
    ]);

    exit;
}


/*
|--------------------------------------------------------------------------
| VERIFY NETWORK PREFIX
|--------------------------------------------------------------------------
*/

$prefix =
    substr($account, 0, 3);


/*
|--------------------------------------------------------------------------
| MTN PREFIXES
|--------------------------------------------------------------------------
*/

$mtnPrefixes = [
    "077",
    "078",
    "076"
];


/*
|--------------------------------------------------------------------------
| AIRTEL PREFIXES
|--------------------------------------------------------------------------
*/

$airtelPrefixes = [
    "070",
    "075",
    "074"
];


/*
|--------------------------------------------------------------------------
| CHECK SELECTED NETWORK
|--------------------------------------------------------------------------
*/

if (
    $method === "MTN" &&
    !in_array(
        $prefix,
        $mtnPrefixes,
        true
    )
) {

    http_response_code(400);

    echo json_encode([
        "success" => false,
        "message" =>
            "The number does not appear to be an MTN number."
    ]);

    exit;
}


if (
    $method === "Airtel" &&
    !in_array(
        $prefix,
        $airtelPrefixes,
        true
    )
) {

    http_response_code(400);

    echo json_encode([
        "success" => false,
        "message" =>
            "The number does not appear to be an Airtel number."
    ]);

    exit;
}


/*
|--------------------------------------------------------------------------
| CONVERT SESSION USER ID
|--------------------------------------------------------------------------
*/

try {

    $userId =
        new MongoDB\BSON\ObjectId(
            $_SESSION["user_id"]
        );

} catch (Throwable $e) {

    http_response_code(400);

    echo json_encode([
        "success" => false,
        "message" =>
            "Invalid user session."
    ]);

    exit;
}


/*
|--------------------------------------------------------------------------
| FIND USER
|--------------------------------------------------------------------------
*/

try {

    $user =
        $users->findOne([
            "_id" => $userId
        ]);

} catch (Throwable $e) {

    error_log(
        "CROWN CASH USER LOOKUP ERROR: " .
        $e->getMessage()
    );

    http_response_code(500);

    echo json_encode([
        "success" => false,
        "message" =>
            "Unable to access your account."
    ]);

    exit;
}


if (!$user) {

    http_response_code(404);

    echo json_encode([
        "success" => false,
        "message" =>
            "User account not found."
    ]);

    exit;
}


/*
|--------------------------------------------------------------------------
| CHECK ACCOUNT STATUS
|--------------------------------------------------------------------------
*/

$userStatus =
    strtolower(
        (string)(
            $user["status"]
            ?? "active"
        )
    );


if (
    in_array(
        $userStatus,
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
        "message" =>
            "Your account cannot make withdrawals at this time."
    ]);

    exit;
}


/*
|--------------------------------------------------------------------------
| GET USER BALANCE
|--------------------------------------------------------------------------
*/

$balance = 0;


if (isset($user["balance"])) {

    if (
        $user["balance"]
        instanceof MongoDB\BSON\Decimal128
    ) {

        $balance =
            (float)$user["balance"]
                ->toString();

    } else {

        $balance =
            (float)$user["balance"];

    }

}

elseif (isset($user["wallet_balance"])) {

    if (
        $user["wallet_balance"]
        instanceof MongoDB\BSON\Decimal128
    ) {

        $balance =
            (float)$user["wallet_balance"]
                ->toString();

    } else {

        $balance =
            (float)$user["wallet_balance"];

    }

}


/*
|--------------------------------------------------------------------------
| USER MUST HAVE AT LEAST UGX 5,000
|--------------------------------------------------------------------------
*/

if ($balance < $minimumWithdrawal) {

    http_response_code(400);

    echo json_encode([

        "success" => false,

        "message" =>
            "You need at least UGX 5,000 available balance to make a withdrawal.",

        "available_balance" =>
            $balance,

        "minimum_withdrawal" =>
            $minimumWithdrawal

    ]);

    exit;
}


/*
|--------------------------------------------------------------------------
| CHECK REQUESTED AMOUNT AGAINST BALANCE
|--------------------------------------------------------------------------
*/

if ($amount > $balance) {

    http_response_code(400);

    echo json_encode([

        "success" => false,

        "message" =>
            "Insufficient available balance.",

        "available_balance" =>
            $balance,

        "requested_amount" =>
            $amount

    ]);

    exit;
}


/*
|--------------------------------------------------------------------------
| CHECK EXISTING PENDING WITHDRAWAL
|--------------------------------------------------------------------------
*/

try {

    $pending =
        $withdrawals->findOne([

            "user_id" =>
                $userId,

            "status" =>
                "pending"

        ]);

} catch (Throwable $e) {

    error_log(
        "CROWN CASH PENDING WITHDRAWAL CHECK ERROR: " .
        $e->getMessage()
    );

    http_response_code(500);

    echo json_encode([
        "success" => false,
        "message" =>
            "Unable to check existing withdrawals."
    ]);

    exit;
}


if ($pending) {

    http_response_code(400);

    echo json_encode([
        "success" => false,
        "message" =>
            "You already have a pending withdrawal request. Please wait for it to be processed."
    ]);

    exit;
}


/*
|--------------------------------------------------------------------------
| CREATE WITHDRAWAL
|--------------------------------------------------------------------------
*/

$now =
    new MongoDB\BSON\UTCDateTime();


$withdrawal = [

    "user_id" =>
        $userId,

    /*
     * Original amount requested by user.
     */
    "amount" =>
        $amount,

    "requested_amount" =>
        $amount,

    /*
     * 10% Crown Cash withdrawal fee.
     */
    "fee_rate" =>
        $withdrawalFeeRate,

    "fee" =>
        $withdrawalFee,

    /*
     * Amount the user should receive.
     */
    "payout_amount" =>
        $payoutAmount,

    "method" =>
        $method,

    "account" =>
        $account,

    "payment_method" =>
        strtolower($method),

    "phone" =>
        $account,

    "status" =>
        "pending",

    "created_at" =>
        $now,

    "updated_at" =>
        $now

];


/*
|--------------------------------------------------------------------------
| SAVE WITHDRAWAL
|--------------------------------------------------------------------------
*/

try {

    $withdrawalResult =
        $withdrawals->insertOne(
            $withdrawal
        );

} catch (Throwable $e) {

    error_log(
        "CROWN CASH WITHDRAWAL ERROR: " .
        $e->getMessage()
    );

    http_response_code(500);

    echo json_encode([
        "success" => false,
        "message" =>
            "Unable to submit withdrawal."
    ]);

    exit;
}


/*
|--------------------------------------------------------------------------
| CREATE TRANSACTION RECORD
|--------------------------------------------------------------------------
*/

try {

    $transactions->insertOne([

        "user_id" =>
            $userId,

        "type" =>
            "withdrawal",

        /*
         * Requested amount.
         */
        "amount" =>
            $amount,

        "requested_amount" =>
            $amount,

        /*
         * Withdrawal fee.
         */
        "fee_rate" =>
            $withdrawalFeeRate,

        "fee" =>
            $withdrawalFee,

        /*
         * Actual amount to be paid.
         */
        "payout_amount" =>
            $payoutAmount,

        "method" =>
            $method,

        "account" =>
            $account,

        "status" =>
            "pending",

        "withdrawal_id" =>
            $withdrawalResult
                ->getInsertedId(),

        "created_at" =>
            $now

    ]);

} catch (Throwable $e) {

    /*
    |--------------------------------------------------------------------------
    | Withdrawal was already created.
    | Transaction logging failed.
    |--------------------------------------------------------------------------
    */

    error_log(
        "CROWN CASH TRANSACTION LOG ERROR: " .
        $e->getMessage()
    );
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
        "Withdrawal request submitted successfully and is pending admin approval.",

    "withdrawal_id" =>
        (string)
        $withdrawalResult
            ->getInsertedId(),

    "requested_amount" =>
        $amount,

    "fee_rate" =>
        $withdrawalFeeRate,

    "fee" =>
        $withdrawalFee,

    "payout_amount" =>
        $payoutAmount,

    "method" =>
        $method,

    "account" =>
        $account,

    "status" =>
        "pending"

]);

exit;

?>