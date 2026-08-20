<?php

require_once "admin_auth.php";

header("Content-Type: application/json");

if ($_SERVER["REQUEST_METHOD"] !== "POST") {

    http_response_code(405);

    echo json_encode([
        "success" => false,
        "message" => "Method not allowed."
    ]);

    exit;
}

$withdrawalId =
    trim($_POST["withdrawal_id"] ?? "");

$action =
    trim($_POST["action"] ?? "");


if ($withdrawalId === "") {

    echo json_encode([
        "success" => false,
        "message" => "Withdrawal ID is required."
    ]);

    exit;
}


if (!in_array(
    $action,
    ["approve", "reject"],
    true
)) {

    echo json_encode([
        "success" => false,
        "message" => "Invalid action."
    ]);

    exit;
}


try {

    $id = new MongoDB\BSON\ObjectId(
        $withdrawalId
    );


    $withdrawal =
        $withdrawals->findOne([
            "_id" => $id
        ]);


    if (!$withdrawal) {

        echo json_encode([
            "success" => false,
            "message" => "Withdrawal not found."
        ]);

        exit;
    }


    if (($withdrawal["status"] ?? "")
        !== "pending") {

        echo json_encode([
            "success" => false,
            "message" =>
                "Withdrawal has already been processed."
        ]);

        exit;
    }


    $userId =
        $withdrawal["user_id"];

    $amount =
        (float)$withdrawal["amount"];


    /*
    |--------------------------------------------------------------------------
    | REJECT
    |--------------------------------------------------------------------------
    */

    if ($action === "reject") {

        $withdrawals->updateOne(
            [
                "_id" => $id,
                "status" => "pending"
            ],
            [
                '$set' => [
                    "status" => "rejected",
                    "processed_at" =>
                        new MongoDB\BSON\UTCDateTime()
                ]
            ]
        );


        $transactions->updateOne(
            [
                "withdrawal_id" => $id,
                "status" => "pending"
            ],
            [
                '$set' => [
                    "status" => "rejected",
                    "updated_at" =>
                        new MongoDB\BSON\UTCDateTime()
                ]
            ]
        );


        echo json_encode([
            "success" => true,
            "message" =>
                "Withdrawal rejected."
        ]);

        exit;
    }


    /*
    |--------------------------------------------------------------------------
    | APPROVE
    |--------------------------------------------------------------------------
    |
    | In production, this step must be connected to the
    | authorized MTN/Airtel payout API before marking
    | the withdrawal as successfully paid.
    |
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


    if ($balance < $amount) {

        echo json_encode([
            "success" => false,
            "message" =>
                "User no longer has sufficient balance."
        ]);

        exit;
    }


    /*
    |--------------------------------------------------------------------------
    | Deduct balance
    |--------------------------------------------------------------------------
    */

    $update =
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


    if ($update->getModifiedCount() !== 1) {

        echo json_encode([
            "success" => false,
            "message" =>
                "Unable to update balance."
        ]);

        exit;
    }


    /*
    |--------------------------------------------------------------------------
    | Mark withdrawal approved
    |--------------------------------------------------------------------------
    */

    $withdrawals->updateOne(
        [
            "_id" => $id,
            "status" => "pending"
        ],
        [
            '$set' => [
                "status" => "approved",
                "processed_at" =>
                    new MongoDB\BSON\UTCDateTime()
            ]
        ]
    );


    /*
    |--------------------------------------------------------------------------
    | Update transaction
    |--------------------------------------------------------------------------
    */

    $transactions->updateOne(
        [
            "withdrawal_id" => $id,
            "status" => "pending"
        ],
        [
            '$set' => [
                "status" => "approved",
                "updated_at" =>
                    new MongoDB\BSON\UTCDateTime()
            ]
        ]
    );


    echo json_encode([
        "success" => true,
        "message" =>
            "Withdrawal approved."
    ]);


} catch (Exception $e) {

    http_response_code(500);

    echo json_encode([
        "success" => false,
        "message" =>
            "Unable to process withdrawal."
    ]);
}

?>
