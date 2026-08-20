<?php

require_once "auth.php";
require_once "config.php";

header("Content-Type: application/json");

if ($_SERVER["REQUEST_METHOD"] !== "POST") {
    http_response_code(405);

    echo json_encode([
        "success" => false,
        "message" => "Method not allowed."
    ]);

    exit;
}

$amount = filter_input(
    INPUT_POST,
    "amount",
    FILTER_VALIDATE_FLOAT
);

$method = trim($_POST["method"] ?? "");

$reference = trim($_POST["reference"] ?? "");


/*
|--------------------------------------------------------------------------
| Validate deposit request
|--------------------------------------------------------------------------
*/

if (!$amount || $amount <= 0) {

    echo json_encode([
        "success" => false,
        "message" => "Enter a valid deposit amount."
    ]);

    exit;
}


$allowedMethods = [
    "MTN",
    "Airtel"
];

if (!in_array($method, $allowedMethods, true)) {

    echo json_encode([
        "success" => false,
        "message" => "Invalid payment method."
    ]);

    exit;
}


if ($reference === "") {

    echo json_encode([
        "success" => false,
        "message" => "Payment reference is required."
    ]);

    exit;
}


/*
|--------------------------------------------------------------------------
| Get logged-in user
|--------------------------------------------------------------------------
*/

try {

    $userId = new MongoDB\BSON\ObjectId(
        $_SESSION["user_id"]
    );


    /*
    |--------------------------------------------------------------------------
    | Create pending deposit
    |--------------------------------------------------------------------------
    */

    $deposit = [

        "user_id" => $userId,

        "amount" => $amount,

        "method" => $method,

        "payment_reference" => $reference,

        "status" => "pending",

        "created_at" =>
            new MongoDB\BSON\UTCDateTime()

    ];


    $result = $deposits->insertOne($deposit);


    /*
    |--------------------------------------------------------------------------
    | Create transaction record
    |--------------------------------------------------------------------------
    */

    $transactions->insertOne([

        "user_id" => $userId,

        "type" => "deposit",

        "amount" => $amount,

        "method" => $method,

        "reference" => $reference,

        "status" => "pending",

        "deposit_id" => $result->getInsertedId(),

        "created_at" =>
            new MongoDB\BSON\UTCDateTime()

    ]);


    echo json_encode([

        "success" => true,

        "message" =>
            "Deposit request submitted for verification."

    ]);


} catch (Exception $e) {

    http_response_code(500);

    echo json_encode([

        "success" => false,

        "message" =>
            "Unable to submit deposit request."

    ]);

}

?>
