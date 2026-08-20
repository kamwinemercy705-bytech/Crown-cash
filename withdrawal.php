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

$method = trim(
    $_POST["method"] ?? ""
);

$account = trim(
    $_POST["account"] ?? ""
);


if ($amount === false || $amount <= 0) {

    echo json_encode([
        "success" => false,
        "message" => "Enter a valid withdrawal amount."
    ]);

    exit;
}


if (!in_array(
    $method,
    ["MTN", "Airtel"],
    true
)) {

    echo json_encode([
        "success" => false,
        "message" => "Invalid withdrawal method."
    ]);

    exit;
}


if ($account === "") {

    echo json_encode([
        "success" => false,
        "message" => "Enter the mobile money account."
    ]);

    exit;
}


try {

    $userId = new MongoDB\BSON\ObjectId(
        $_SESSION["user_id"]
    );


    /*
    |--------------------------------------------------------------------------
    | Find user
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


    $balance =
        (float)($user["balance"] ?? 0);


    /*
    |--------------------------------------------------------------------------
    | Check balance
    |--------------------------------------------------------------------------
    */

    if ($amount > $balance) {

        echo json_encode([
            "success" => false,
            "message" => "Insufficient balance."
        ]);

        exit;
    }


    /*
    |--------------------------------------------------------------------------
    | Create pending withdrawal
    |--------------------------------------------------------------------------
    */

    $withdrawal = [

        "user_id" => $userId,

        "amount" => $amount,

        "method" => $method,

        "account" => $account,

        "status" => "pending",

        "created_at" =>
            new MongoDB\BSON\UTCDateTime()

    ];


    $withdrawalResult =
        $withdrawals->insertOne(
            $withdrawal
        );


    /*
    |--------------------------------------------------------------------------
    | Create transaction record
    |--------------------------------------------------------------------------
    */

    $transactions->insertOne([

        "user_id" => $userId,

        "type" => "withdrawal",

        "amount" => $amount,

        "method" => $method,

        "status" => "pending",

        "withdrawal_id" =>
            $withdrawalResult->getInsertedId(),

        "created_at" =>
            new MongoDB\BSON\UTCDateTime()

    ]);


    echo json_encode([

        "success" => true,

        "message" =>
            "Withdrawal request submitted for admin approval.",

        "withdrawal_id" =>
            (string)
            $withdrawalResult->getInsertedId()

    ]);


} catch (Exception $e) {

    http_response_code(500);

    echo json_encode([

        "success" => false,

        "message" =>
            "Unable to submit withdrawal."

    ]);

}

?>
