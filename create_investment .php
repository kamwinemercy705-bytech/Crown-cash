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

if ($amount === false || $amount <= 0) {

    echo json_encode([
        "success" => false,
        "message" => "Enter a valid investment amount."
    ]);

    exit;
}

try {

    $userId = new MongoDB\BSON\ObjectId(
        $_SESSION["user_id"]
    );

    /*
    |--------------------------------------------------------------------------
    | Find the logged-in user
    |--------------------------------------------------------------------------
    */

    $user = $users->findOne([
        "_id" => $userId
    ]);

    if (!$user) {

        echo json_encode([
            "success" => false,
            "message" => "User not found."
        ]);

        exit;
    }

    $balance = (float)($user["balance"] ?? 0);


    /*
    |--------------------------------------------------------------------------
    | Check available balance
    |--------------------------------------------------------------------------
    */

    if ($balance < $amount) {

        echo json_encode([
            "success" => false,
            "message" => "Insufficient available balance."
        ]);

        exit;
    }


    /*
    |--------------------------------------------------------------------------
    | Create investment
    |--------------------------------------------------------------------------
    */

    $investment = [

        "user_id" => $userId,

        "amount" => $amount,

        "status" => "active",

        "created_at" =>
            new MongoDB\BSON\UTCDateTime()

    ];

    $investmentResult =
        $investments->insertOne($investment);


    /*
    |--------------------------------------------------------------------------
    | Deduct investment amount
    |--------------------------------------------------------------------------
    */

    $users->updateOne(
        [
            "_id" => $userId,

            "balance" => [
                '$gte' => $amount
            ]
        ],
        [
            '$inc' => [
                "balance" => -$amount
            ]
        ]
    );


    /*
    |--------------------------------------------------------------------------
    | Create transaction record
    |--------------------------------------------------------------------------
    */

    $transactions->insertOne([

        "user_id" => $userId,

        "type" => "investment",

        "amount" => $amount,

        "investment_id" =>
            $investmentResult->getInsertedId(),

        "status" => "completed",

        "created_at" =>
            new MongoDB\BSON\UTCDateTime()

    ]);


    echo json_encode([

        "success" => true,

        "message" =>
            "Investment created successfully.",

        "investment_id" =>
            (string)$investmentResult->getInsertedId()

    ]);

} catch (Exception $e) {

    http_response_code(500);

    echo json_encode([

        "success" => false,

        "message" =>
            "Unable to create investment."

    ]);

}

?>
