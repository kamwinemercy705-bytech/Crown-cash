<?php

/*
|--------------------------------------------------------------------------
| Crown Cash - Deposit API
|--------------------------------------------------------------------------
| Handles deposit requests from the Vercel frontend.
|
| IMPORTANT:
| - Deposits are created as "pending".
| - User balance is NOT increased automatically.
| - A deposit should only be credited after payment verification/admin approval.
|--------------------------------------------------------------------------
*/


/*
|--------------------------------------------------------------------------
| CORS
|--------------------------------------------------------------------------
*/

header("Access-Control-Allow-Origin: https://crown-cash.vercel.app");
header("Access-Control-Allow-Credentials: true");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");
header("Content-Type: application/json; charset=UTF-8");


/*
|--------------------------------------------------------------------------
| Handle CORS preflight
|--------------------------------------------------------------------------
*/

if ($_SERVER["REQUEST_METHOD"] === "OPTIONS") {
    http_response_code(204);
    exit;
}


/*
|--------------------------------------------------------------------------
| Only POST requests are allowed
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
| Session cookie configuration
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
| Check login
|--------------------------------------------------------------------------
*/

if (
    empty($_SESSION["logged_in"]) ||
    empty($_SESSION["user_id"])
) {
    http_response_code(401);

    echo json_encode([
        "success" => false,
        "message" => "Please login to make a deposit."
    ]);

    exit;
}


/*
|--------------------------------------------------------------------------
| Load MongoDB configuration
|--------------------------------------------------------------------------
*/

try {

    require_once __DIR__ . "/config.php";

} catch (Throwable $e) {

    error_log("CROWN CASH CONFIG ERROR: " . $e->getMessage());

    http_response_code(500);

    echo json_encode([
        "success" => false,
        "message" => "Database configuration could not be loaded."
    ]);

    exit;
}


/*
|--------------------------------------------------------------------------
| Make sure deposits collection exists
|--------------------------------------------------------------------------
*/

if (!isset($deposits)) {

    http_response_code(500);

    echo json_encode([
        "success" => false,
        "message" => "Deposits collection is not configured."
    ]);

    exit;
}


/*
|--------------------------------------------------------------------------
| Read request body
|--------------------------------------------------------------------------
*/

$rawInput = file_get_contents("php://input");

$data = json_decode($rawInput, true);

if (!is_array($data)) {
    $data = $_POST;
}


/*
|--------------------------------------------------------------------------
| Get submitted values
|--------------------------------------------------------------------------
*/

$amountInput = $data["amount"] ?? null;

$paymentMethod = strtolower(
    trim((string)($data["payment_method"] ?? ""))
);

$transactionReference = strtoupper(
    trim((string)($data["transaction_reference"] ?? ""))
);


/*
|--------------------------------------------------------------------------
| Validate amount
|--------------------------------------------------------------------------
*/

if (
    $amountInput === null ||
    $amountInput === "" ||
    !is_numeric($amountInput)
) {

    http_response_code(400);

    echo json_encode([
        "success" => false,
        "message" => "Please enter a valid deposit amount."
    ]);

    exit;
}


$amount = (float)$amountInput;


/*
|--------------------------------------------------------------------------
| Deposit minimum
|--------------------------------------------------------------------------
*/

if ($amount < 10000) {

    http_response_code(400);

    echo json_encode([
        "success" => false,
        "message" => "Minimum deposit is UGX 10,000."
    ]);

    exit;
}


/*
|--------------------------------------------------------------------------
| Whole-number validation
|--------------------------------------------------------------------------
*/

if (floor($amount) != $amount) {

    http_response_code(400);

    echo json_encode([
        "success" => false,
        "message" => "Deposit amount must be a whole Uganda Shilling amount."
    ]);

    exit;
}


$amount = (int)$amount;


/*
|--------------------------------------------------------------------------
| Deposit amount must be in multiples of 1,000
|--------------------------------------------------------------------------
*/

if ($amount % 1000 !== 0) {

    http_response_code(400);

    echo json_encode([
        "success" => false,
        "message" => "Deposit amount must be in multiples of UGX 1,000."
    ]);

    exit;
}


/*
|--------------------------------------------------------------------------
| Validate payment method
|--------------------------------------------------------------------------
*/

$allowedMethods = [
    "mtn",
    "airtel"
];

if (!in_array($paymentMethod, $allowedMethods, true)) {

    http_response_code(400);

    echo json_encode([
        "success" => false,
        "message" => "Please select MTN or Airtel Money."
    ]);

    exit;
}


/*
|--------------------------------------------------------------------------
| Validate transaction reference
|--------------------------------------------------------------------------
*/

if ($transactionReference === "") {

    http_response_code(400);

    echo json_encode([
        "success" => false,
        "message" => "Please enter your transaction reference."
    ]);

    exit;
}


/*
|--------------------------------------------------------------------------
| Clean transaction reference
|--------------------------------------------------------------------------
| Allows letters, numbers, hyphens and underscores.
|--------------------------------------------------------------------------
*/

$transactionReference = preg_replace(
    "/[^A-Z0-9_-]/",
    "",
    $transactionReference
);


if (
    strlen($transactionReference) < 4 ||
    strlen($transactionReference) > 100
) {

    http_response_code(400);

    echo json_encode([
        "success" => false,
        "message" => "Please enter a valid transaction reference."
    ]);

    exit;
}


/*
|--------------------------------------------------------------------------
| Convert session user ID to MongoDB ObjectId
|--------------------------------------------------------------------------
*/

try {

    $userId = new MongoDB\BSON\ObjectId(
        (string)$_SESSION["user_id"]
    );

} catch (Throwable $e) {

    http_response_code(401);

    echo json_encode([
        "success" => false,
        "message" => "Your login session is invalid. Please login again."
    ]);

    exit;
}


/*
|--------------------------------------------------------------------------
| Find user
|--------------------------------------------------------------------------
*/

try {

    $user = $users->findOne([
        "_id" => $userId
    ]);

} catch (Throwable $e) {

    error_log("CROWN CASH USER LOOKUP ERROR: " . $e->getMessage());

    http_response_code(500);

    echo json_encode([
        "success" => false,
        "message" => "Unable to verify your account."
    ]);

    exit;
}


if (!$user) {

    http_response_code(404);

    echo json_encode([
        "success" => false,
        "message" => "User account could not be found."
    ]);

    exit;
}


/*
|--------------------------------------------------------------------------
| Check account status
|--------------------------------------------------------------------------
*/

$userStatus = strtolower(
    (string)($user["status"] ?? "active")
);

$blockedStatuses = [
    "blocked",
    "suspended",
    "disabled"
];

if (in_array($userStatus, $blockedStatuses, true)) {

    http_response_code(403);

    echo json_encode([
        "success" => false,
        "message" => "Your account is currently restricted. Please contact support."
    ]);

    exit;
}


/*
|--------------------------------------------------------------------------
| Check for duplicate transaction reference
|--------------------------------------------------------------------------
*/

try {

    $existingDeposit = $deposits->findOne([
        "transaction_reference" => $transactionReference
    ]);

    if ($existingDeposit) {

        http_response_code(409);

        echo json_encode([
            "success" => false,
            "message" => "This transaction reference has already been submitted."
        ]);

        exit;
    }

} catch (Throwable $e) {

    error_log(
        "CROWN CASH DUPLICATE REFERENCE CHECK ERROR: "
        . $e->getMessage()
    );

    http_response_code(500);

    echo json_encode([
        "success" => false,
        "message" => "Unable to verify transaction reference."
    ]);

    exit;
}


/*
|--------------------------------------------------------------------------
| Create deposit
|--------------------------------------------------------------------------
*/

$now = new MongoDB\BSON\UTCDateTime(
    (int)(microtime(true) * 1000)
);


$depositDocument = [

    "user_id" => $userId,

    "amount" => $amount,

    "payment_method" => $paymentMethod,

    "method" => $paymentMethod,

    "transaction_reference" => $transactionReference,

    "reference" => $transactionReference,

    "status" => "pending",

    "verification_status" => "pending",

    "created_at" => $now,

    "updated_at" => $now
];


/*
|--------------------------------------------------------------------------
| Insert deposit
|--------------------------------------------------------------------------
*/

try {

    $depositResult = $deposits->insertOne(
        $depositDocument
    );

} catch (MongoDB\Driver\Exception\BulkWriteException $e) {

    error_log(
        "CROWN CASH DEPOSIT INSERT ERROR: "
        . $e->getMessage()
    );

    http_response_code(500);

    echo json_encode([
        "success" => false,
        "message" => "Deposit could not be submitted. Please try again."
    ]);

    exit;

} catch (Throwable $e) {

    error_log(
        "CROWN CASH DEPOSIT ERROR: "
        . $e->getMessage()
    );

    http_response_code(500);

    echo json_encode([
        "success" => false,
        "message" => "Deposit could not be submitted."
    ]);

    exit;
}


/*
|--------------------------------------------------------------------------
| Create transaction record
|--------------------------------------------------------------------------
*/

if (isset($transactions)) {

    try {

        $transactions->insertOne([

            "user_id" => $userId,

            "type" => "deposit",

            "amount" => $amount,

            "method" => $paymentMethod,

            "payment_method" => $paymentMethod,

            "reference" => $transactionReference,

            "transaction_reference" => $transactionReference,

            "status" => "pending",

            "created_at" => $now,

            "updated_at" => $now

        ]);

    } catch (Throwable $e) {

        /*
        |--------------------------------------------------------------------------
        | The deposit itself was already created.
        | Log the transaction error instead of telling the user
        | that the entire deposit failed.
        |--------------------------------------------------------------------------
        */

        error_log(
            "CROWN CASH TRANSACTION INSERT ERROR: "
            . $e->getMessage()
        );
    }
}


/*
|--------------------------------------------------------------------------
| Optional audit log
|--------------------------------------------------------------------------
*/

if (isset($audit_logs)) {

    try {

        $audit_logs->insertOne([

            "user_id" => $userId,

            "action" => "deposit_submitted",

            "type" => "deposit",

            "amount" => $amount,

            "payment_method" => $paymentMethod,

            "reference" => $transactionReference,

            "status" => "pending",

            "created_at" => $now

        ]);

    } catch (Throwable $e) {

        error_log(
            "CROWN CASH AUDIT LOG ERROR: "
            . $e->getMessage()
        );
    }
}


/*
|--------------------------------------------------------------------------
| Success response
|--------------------------------------------------------------------------
*/

http_response_code(201);

echo json_encode([

    "success" => true,

    "message" =>
        "Deposit submitted successfully. Your request is pending verification.",

    "deposit" => [

        "id" => (string)$depositResult->getInsertedId(),

        "amount" => $amount,

        "payment_method" => $paymentMethod,

        "transaction_reference" => $transactionReference,

        "status" => "pending"

    ]

]);

exit;
?>