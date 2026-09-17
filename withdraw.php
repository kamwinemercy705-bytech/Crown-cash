<?php

/*
|--------------------------------------------------------------------------
| CROWN CASH - WITHDRAWAL REQUEST API
|--------------------------------------------------------------------------
| Creates a withdrawal request for the logged-in user.
| The request remains "pending" until approved by an admin.
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

header("Access-Control-Allow-Origin: https://crown-cash.vercel.app");
header("Access-Control-Allow-Credentials: true");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");
header("Content-Type: application/json");


/*
|--------------------------------------------------------------------------
| HANDLE PREFLIGHT REQUEST
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
        "message" => "You must be logged in to make a withdrawal."
    ]);

    exit;
}


/*
|--------------------------------------------------------------------------
| LOAD DATABASE CONFIG
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


if (!is_array($input)) {

    http_response_code(400);

    echo json_encode([
        "success" => false,
        "message" => "Invalid request data."
    ]);

    exit;
}


/*
|--------------------------------------------------------------------------
| GET FORM VALUES
|--------------------------------------------------------------------------
*/

$amount = $input["amount"] ?? null;

$paymentMethod =
    strtolower(
        trim(
            (string)($input["payment_method"] ?? "")
        )
    );

$phone =
    trim(
        (string)($input["phone"] ?? "")
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
        "message" => "Please enter a valid withdrawal amount."
    ]);

    exit;
}


$amount = (float)$amount;


/*
|--------------------------------------------------------------------------
| MINIMUM WITHDRAWAL
|--------------------------------------------------------------------------
*/

$minimumWithdrawal = 10000;


if ($amount < $minimumWithdrawal) {

    http_response_code(400);

    echo json_encode([
        "success" => false,
        "message" => "Minimum withdrawal amount is UGX 10,000."
    ]);

    exit;
}


/*
|--------------------------------------------------------------------------
| ENSURE WHOLE UGX AMOUNT
|--------------------------------------------------------------------------
*/

if (floor($amount) != $amount) {

    http_response_code(400);

    echo json_encode([
        "success" => false,
        "message" => "Withdrawal amount must be a whole UGX amount."
    ]);

    exit;
}


$amount = (int)$amount;


/*
|--------------------------------------------------------------------------
| VALIDATE PAYMENT METHOD
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
        "message" => "Please select MTN or Airtel Mobile Money."
    ]);

    exit;
}


/*
|--------------------------------------------------------------------------
| VALIDATE PHONE NUMBER
|--------------------------------------------------------------------------
*/

if ($phone === "") {

    http_response_code(400);

    echo json_encode([
        "success" => false,
        "message" => "Please enter your Mobile Money number."
    ]);

    exit;
}


/*
|--------------------------------------------------------------------------
| CLEAN PHONE NUMBER
|--------------------------------------------------------------------------
*/

$phone = preg_replace(
    "/[\s\-]/",
    "",
    $phone
);


/*
|--------------------------------------------------------------------------
| CONVERT +256 FORMAT
|--------------------------------------------------------------------------
*/

if (strpos($phone, "+256") === 0) {

    $phone = "0" . substr($phone, 4);

}


/*
|--------------------------------------------------------------------------
| VALID UGANDAN MOBILE NUMBER
|--------------------------------------------------------------------------
*/

if (!preg_match(
    "/^07[0-9]{8}$/",
    $phone
)) {

    http_response_code(400);

    echo json_encode([
        "success" => false,
        "message" => "Please enter a valid Ugandan Mobile Money number."
    ]);

    exit;
}


/*
|--------------------------------------------------------------------------
| CHECK NETWORK PREFIX
|--------------------------------------------------------------------------
*/

$prefix = substr($phone, 0, 3);


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
| VERIFY NETWORK
|--------------------------------------------------------------------------
*/

if (
    $paymentMethod === "mtn" &&
    !in_array($prefix, $mtnPrefixes, true)
) {

    http_response_code(400);

    echo json_encode([
        "success" => false,
        "message" => "The phone number does not appear to be an MTN number."
    ]);

    exit;
}


if (
    $paymentMethod === "airtel" &&
    !in_array($prefix, $airtelPrefixes, true)
) {

    http_response_code(400);

    echo json_encode([
        "success" => false,
        "message" => "The phone number does not appear to be an Airtel number."
    ]);

    exit;
}


/*
|--------------------------------------------------------------------------
| CONVERT USER ID TO OBJECTID
|--------------------------------------------------------------------------
*/

try {

    $userId = new MongoDB\BSON\ObjectId(
        $_SESSION["user_id"]
    );

} catch (Throwable $e) {

    http_response_code(400);

    echo json_encode([
        "success" => false,
        "message" => "Invalid user session."
    ]);

    exit;
}


/*
|--------------------------------------------------------------------------
| FIND USER
|--------------------------------------------------------------------------
*/

try {

    $user = $users->findOne([
        "_id" => $userId
    ]);

} catch (Throwable $e) {

    http_response_code(500);

    echo json_encode([
        "success" => false,
        "message" => "Unable to access user account."
    ]);

    exit;
}


if (!$user) {

    http_response_code(404);

    echo json_encode([
        "success" => false,
        "message" => "User account was not found."
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
        (string)($user["status"] ?? "active")
    );


if (
    in_array(
        $userStatus,
        ["blocked", "suspended", "disabled"],
        true
    )
) {

    http_response_code(403);

    echo json_encode([
        "success" => false,
        "message" => "Your account cannot make withdrawals at this time."
    ]);

    exit;
}


/*
|--------------------------------------------------------------------------
| GET CURRENT BALANCE
|--------------------------------------------------------------------------
*/

$currentBalance = 0;


if (isset($user["balance"])) {

    $balanceValue = $user["balance"];

    if ($balanceValue instanceof MongoDB\BSON\Decimal128) {

        $currentBalance =
            (float)$balanceValue
                ->toString();

    } else {

        $currentBalance =
            (float)$balanceValue;

    }

} elseif (isset($user["wallet_balance"])) {

    $balanceValue =
        $user["wallet_balance"];

    if ($balanceValue instanceof MongoDB\BSON\Decimal128) {

        $currentBalance =
            (float)$balanceValue
                ->toString();

    } else {

        $currentBalance =
            (float)$balanceValue;

    }
}


/*
|--------------------------------------------------------------------------
| CHECK AVAILABLE BALANCE
|--------------------------------------------------------------------------
*/

if ($amount > $currentBalance) {

    http_response_code(400);

    echo json_encode([
        "success" => false,
        "message" => "Insufficient available balance.",
        "available_balance" => $currentBalance
    ]);

    exit;
}


/*
|--------------------------------------------------------------------------
| CHECK FOR EXISTING PENDING WITHDRAWAL
|--------------------------------------------------------------------------
|
| This prevents a user from creating many pending requests.
|
*/

try {

    $existingPending =
        $withdrawals->findOne([
            "user_id" => $userId,
            "status" => "pending"
        ]);

} catch (Throwable $e) {

    http_response_code(500);

    echo json_encode([
        "success" => false,
        "message" => "Unable to check existing withdrawal requests."
    ]);

    exit;
}


if ($existingPending) {

    http_response_code(400);

    echo json_encode([
        "success" => false,
        "message" => "You already have a pending withdrawal request. Please wait for it to be processed."
    ]);

    exit;
}


/*
|--------------------------------------------------------------------------
| CREATE WITHDRAWAL DOCUMENT
|--------------------------------------------------------------------------
*/

$now = new MongoDB\BSON\UTCDateTime();


$withdrawal = [
    "user_id" => $userId,

    "amount" => $amount,

    "payment_method" => $paymentMethod,

    "phone" => $phone,

    "status" => "pending",

    "created_at" => $now,

    "updated_at" => $now
];


/*
|--------------------------------------------------------------------------
| INSERT INTO MONGODB
|--------------------------------------------------------------------------
*/

try {

    $result =
        $withdrawals->insertOne(
            $withdrawal
        );

} catch (Throwable $e) {

    http_response_code(500);

    echo json_encode([
        "success" => false,
        "message" => "Unable to create withdrawal request."
    ]);

    exit;
}


/*
|--------------------------------------------------------------------------
| CHECK INSERT RESULT
|--------------------------------------------------------------------------
*/

if ($result->getInsertedCount() !== 1) {

    http_response_code(500);

    echo json_encode([
        "success" => false,
        "message" => "Withdrawal request could not be created."
    ]);

    exit;
}


/*
|--------------------------------------------------------------------------
| SUCCESS RESPONSE
|--------------------------------------------------------------------------
*/

http_response_code(201);

echo json_encode([

    "success" => true,

    "message" =>
        "Withdrawal request submitted successfully and is pending admin approval.",

    "withdrawal" => [

        "id" =>
            (string)$result->getInsertedId(),

        "amount" =>
            $amount,

        "payment_method" =>
            $paymentMethod,

        "phone" =>
            $phone,

        "status" =>
            "pending"

    ]

]);

exit;
?>