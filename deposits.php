<?php

/*
|--------------------------------------------------------------------------
| Crown Cash - Deposits History API
|--------------------------------------------------------------------------
| Returns the logged-in user's recent deposit requests.
|--------------------------------------------------------------------------
*/


/*
|--------------------------------------------------------------------------
| CORS
|--------------------------------------------------------------------------
*/

header("Access-Control-Allow-Origin: https://crown-cash.vercel.app");
header("Access-Control-Allow-Credentials: true");
header("Access-Control-Allow-Methods: GET, OPTIONS");
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
| Only GET requests are allowed
|--------------------------------------------------------------------------
*/

if ($_SERVER["REQUEST_METHOD"] !== "GET") {

    http_response_code(405);

    echo json_encode([
        "success" => false,
        "message" => "Method not allowed."
    ]);

    exit;
}


/*
|--------------------------------------------------------------------------
| Session configuration
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
        "message" => "Please login to view your deposits."
    ]);

    exit;
}


/*
|--------------------------------------------------------------------------
| Load database configuration
|--------------------------------------------------------------------------
*/

try {

    require_once __DIR__ . "/config.php";

} catch (Throwable $e) {

    error_log(
        "CROWN CASH DEPOSITS CONFIG ERROR: "
        . $e->getMessage()
    );

    http_response_code(500);

    echo json_encode([
        "success" => false,
        "message" => "Database configuration could not be loaded."
    ]);

    exit;
}


/*
|--------------------------------------------------------------------------
| Check deposits collection
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
| Convert session ID to MongoDB ObjectId
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
| Get deposits
|--------------------------------------------------------------------------
*/

try {

    $cursor = $deposits->find(

        [
            "user_id" => $userId
        ],

        [
            "sort" => [
                "created_at" => -1
            ],

            "limit" => 20
        ]

    );

} catch (Throwable $e) {

    error_log(
        "CROWN CASH DEPOSITS QUERY ERROR: "
        . $e->getMessage()
    );

    http_response_code(500);

    echo json_encode([
        "success" => false,
        "message" => "Unable to load deposits."
    ]);

    exit;
}


/*
|--------------------------------------------------------------------------
| Prepare results
|--------------------------------------------------------------------------
*/

$depositList = [];


foreach ($cursor as $deposit) {

    /*
    |--------------------------------------------------------------------------
    | Amount
    |--------------------------------------------------------------------------
    */

    $amount = 0;

    if (
        isset($deposit["amount"]) &&
        $deposit["amount"] instanceof MongoDB\BSON\Decimal128
    ) {

        $amount = (float)$deposit["amount"]->__toString();

    } elseif (isset($deposit["amount"])) {

        $amount = (float)$deposit["amount"];
    }


    /*
    |--------------------------------------------------------------------------
    | Payment method
    |--------------------------------------------------------------------------
    */

    $paymentMethod =
        $deposit["payment_method"]
        ?? $deposit["method"]
        ?? "";


    $paymentMethod = strtolower(
        (string)$paymentMethod
    );


    /*
    |--------------------------------------------------------------------------
    | Transaction reference
    |--------------------------------------------------------------------------
    */

    $reference =
        $deposit["transaction_reference"]
        ?? $deposit["reference"]
        ?? "";


    /*
    |--------------------------------------------------------------------------
    | Status
    |--------------------------------------------------------------------------
    */

    $status =
        $deposit["status"]
        ?? "pending";


    $status = strtolower(
        (string)$status
    );


    /*
    |--------------------------------------------------------------------------
    | Created date
    |--------------------------------------------------------------------------
    */

    $createdAt = null;

    if (
        isset($deposit["created_at"]) &&
        $deposit["created_at"] instanceof MongoDB\BSON\UTCDateTime
    ) {

        $createdAt = $deposit["created_at"]
            ->toDateTime()
            ->format(DATE_ATOM);

    } elseif (isset($deposit["created_at"])) {

        $createdAt = (string)$deposit["created_at"];
    }


    /*
    |--------------------------------------------------------------------------
    | Add deposit
    |--------------------------------------------------------------------------
    */

    $depositList[] = [

        "id" => isset($deposit["_id"])
            ? (string)$deposit["_id"]
            : "",

        "amount" => $amount,

        "payment_method" => $paymentMethod,

        "transaction_reference" => $reference,

        "status" => $status,

        "created_at" => $createdAt

    ];
}


/*
|--------------------------------------------------------------------------
| Success response
|--------------------------------------------------------------------------
*/

http_response_code(200);

echo json_encode([

    "success" => true,

    "deposits" => $depositList

]);

exit;
?>