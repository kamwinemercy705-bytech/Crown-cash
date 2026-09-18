<?php

/* =========================================================
   CROWN CASH - INVESTMENT API
   Creates a pending investment record and transaction record.

   IMPORTANT:
   This endpoint does NOT automatically credit profits or
   guarantee investment returns. Investment approval/payment
   should be handled by the appropriate verified process.
========================================================= */

ini_set("display_errors", "0");
error_reporting(E_ALL);

header("Content-Type: application/json; charset=UTF-8");

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
    "Access-Control-Allow-Headers: Content-Type, Accept"
);


/* =========================================================
   PREFLIGHT
========================================================= */

if ($_SERVER["REQUEST_METHOD"] === "OPTIONS") {

    http_response_code(204);

    exit;
}


/* =========================================================
   ONLY POST
========================================================= */

if ($_SERVER["REQUEST_METHOD"] !== "POST") {

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
    "secure" => true,
    "httponly" => true,
    "samesite" => "None"
]);

session_start();


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


if (
    !isset($investments) ||
    !isset($transactions)
) {

    http_response_code(500);

    echo json_encode([
        "success" => false,
        "message" => "Investment collections are not configured."
    ]);

    exit;
}


use MongoDB\BSON\ObjectId;


/* =========================================================
   HELPERS
========================================================= */

function investmentNumber($value)
{
    if ($value === null) {
        return 0;
    }

    if (is_int($value) || is_float($value)) {
        return $value;
    }

    if (is_string($value)) {
        return is_numeric($value)
            ? (float)$value
            : 0;
    }

    if (
        is_object($value) &&
        method_exists($value, "toString")
    ) {

        return (float)$value->toString();
    }

    return 0;
}


function investmentId($value)
{
    if ($value === null) {
        return "";
    }

    if (is_string($value)) {
        return $value;
    }

    if (
        is_object($value) &&
        method_exists($value, "toString")
    ) {

        return $value->toString();
    }

    return (string)$value;
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

if (!is_array($data)) {
    $data = $_POST;
}


/* =========================================================
   INPUT
========================================================= */

$plan =
    trim(
        (string)(
            $data["plan"] ??
            $data["plan_name"] ??
            ""
        )
    );

$amount =
    investmentNumber(
        $data["amount"] ??
        $data["investment_amount"] ??
        0
    );


/* =========================================================
   PLAN NORMALIZATION
========================================================= */

$planKey =
    strtolower(
        preg_replace(
            "/[^a-z0-9]/i",
            "",
            $plan
        )
    );


/*
 * Crown Cash plans currently displayed by the frontend.
 *
 * The return rate is intentionally NOT calculated here.
 * Do not treat a frontend percentage as a guaranteed
 * financial return.
 */

$plans = [

    "starter" => [
        "name" => "Starter",
        "minimum" => 10000,
        "maximum" => 10000,
        "duration_days" => 30
    ],

    "standard" => [
        "name" => "Standard",
        "minimum" => 15000,
        "maximum" => 15000,
        "duration_days" => 30
    ],

    "advanced" => [
        "name" => "Advanced",
        "minimum" => 25000,
        "maximum" => 25000,
        "duration_days" => 30
    ]

];


if (!isset($plans[$planKey])) {

    http_response_code(400);

    echo json_encode([
        "success" => false,
        "message" => "Please select a valid investment plan."
    ]);

    exit;
}


$selectedPlan =
    $plans[$planKey];


/* =========================================================
   VALIDATE AMOUNT
========================================================= */

if ($amount <= 0) {

    http_response_code(400);

    echo json_encode([
        "success" => false,
        "message" => "Please enter a valid investment amount."
    ]);

    exit;
}


if (
    $amount < $selectedPlan["minimum"] ||
    $amount > $selectedPlan["maximum"]
) {

    http_response_code(400);

    echo json_encode([
        "success" => false,
        "message" =>
            "The selected plan requires " .
            number_format(
                $selectedPlan["minimum"]
            ) .
            " UGX."
    ]);

    exit;
}


if (
    floor($amount) != $amount
) {

    http_response_code(400);

    echo json_encode([
        "success" => false,
        "message" => "Investment amount must be a whole UGX amount."
    ]);

    exit;
}


/* =========================================================
   USER ID
========================================================= */

$userIdString =
    (string)$_SESSION["user_id"];

$userObjectId = null;


try {

    if (
        preg_match(
            "/^[a-f0-9]{24}$/i",
            $userIdString
        )
    ) {

        $userObjectId =
            new ObjectId(
                $userIdString
            );
    }

} catch (Throwable $e) {

    $userObjectId = null;
}


if (!$userObjectId) {

    http_response_code(400);

    echo json_encode([
        "success" => false,
        "message" => "Invalid user account."
    ]);

    exit;
}


/* =========================================================
   FIND USER
========================================================= */

try {

    $user =
        $users->findOne([
            "_id" => $userObjectId
        ]);

} catch (Throwable $e) {

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
        "message" => "User account was not found."
    ]);

    exit;
}


/* =========================================================
   ACCOUNT STATUS
========================================================= */

$userStatus =
    strtolower(
        (string)(
            $user["status"] ??
            "active"
        )
    );


if (
    in_array(
        $userStatus,
        [
            "blocked",
            "suspended",
            "disabled",
            "banned"
        ],
        true
    )
) {

    http_response_code(403);

    echo json_encode([
        "success" => false,
        "message" => "Your account cannot make investments."
    ]);

    exit;
}


/* =========================================================
   BALANCE
========================================================= */

$balance =
    investmentNumber(
        $user["balance"] ??
        $user["wallet_balance"] ??
        $user["walletBalance"] ??
        0
    );


/*
 * Do not deduct the balance at this stage unless your
 * payment/approval workflow has verified the funding.
 *
 * This endpoint creates the investment as pending.
 */


/* =========================================================
   DUPLICATE PENDING CHECK
========================================================= */

$existingPending =
    $investments->findOne([
        "user_id" => $userObjectId,
        "status" => "pending"
    ]);


if ($existingPending) {

    http_response_code(409);

    echo json_encode([
        "success" => false,
        "message" =>
            "You already have a pending investment request."
    ]);

    exit;
}


/* =========================================================
   INVESTMENT ID
========================================================= */

$investmentReference =
    "INV-" .
    strtoupper(
        bin2hex(
            random_bytes(5)
        )
    );


/* =========================================================
   CREATE INVESTMENT
========================================================= */

$now =
    new MongoDB\BSON\UTCDateTime();


$investmentDocument = [

    "user_id" =>
        $userObjectId,

    "plan" =>
        $selectedPlan["name"],

    "plan_key" =>
        $planKey,

    "amount" =>
        $amount,

    "duration_days" =>
        $selectedPlan["duration_days"],

    "status" =>
        "pending",

    "reference" =>
        $investmentReference,

    "created_at" =>
        $now,

    "updated_at" =>
        $now

];


try {

    $investmentResult =
        $investments->insertOne(
            $investmentDocument
        );

} catch (Throwable $e) {

    error_log(
        "Crown Cash investment insert error: " .
        $e->getMessage()
    );

    http_response_code(500);

    echo json_encode([
        "success" => false,
        "message" =>
            "Investment request could not be created."
    ]);

    exit;
}


$investmentId =
    (string)$investmentResult->getInsertedId();


/* =========================================================
   CREATE TRANSACTION RECORD
========================================================= */

$transactionDocument = [

    "user_id" =>
        $userObjectId,

    "type" =>
        "investment",

    "transaction_type" =>
        "investment",

    "title" =>
        "Investment - " .
        $selectedPlan["name"],

    "description" =>
        "Investment request for " .
        $selectedPlan["name"] .
        " plan",

    "amount" =>
        $amount,

    "status" =>
        "pending",

    "reference" =>
        $investmentReference,

    "transaction_reference" =>
        $investmentReference,

    "investment_id" =>
        $investmentId,

    "created_at" =>
        $now,

    "updated_at" =>
        $now

];


try {

    $transactions->insertOne(
        $transactionDocument
    );

} catch (Throwable $e) {

    /*
     * The investment itself was created.
     * Log the transaction failure for investigation.
     */

    error_log(
        "Crown Cash transaction insert error: " .
        $e->getMessage()
    );

}


/* =========================================================
   AUDIT LOG
========================================================= */

if (isset($audit_logs)) {

    try {

        $audit_logs->insertOne([

            "user_id" =>
                $userObjectId,

            "action" =>
                "investment_created",

            "reference" =>
                $investmentReference,

            "amount" =>
                $amount,

            "plan" =>
                $selectedPlan["name"],

            "status" =>
                "pending",

            "created_at" =>
                $now

        ]);

    } catch (Throwable $e) {

        error_log(
            "Crown Cash investment audit error: " .
            $e->getMessage()
        );

    }

}


/* =========================================================
   RESPONSE
========================================================= */

http_response_code(201);

echo json_encode([

    "success" =>
        true,

    "message" =>
        "Investment request submitted successfully.",

    "investment" => [

        "id" =>
            $investmentId,

        "reference" =>
            $investmentReference,

        "plan" =>
            $selectedPlan["name"],

        "amount" =>
            $amount,

        "duration_days" =>
            $selectedPlan["duration_days"],

        "status" =>
            "pending"

    ]

], JSON_UNESCAPED_SLASHES);

exit;

?>