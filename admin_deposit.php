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

$depositId = trim($_POST["deposit_id"] ?? "");
$action = trim($_POST["action"] ?? "");

if ($depositId === "") {
    echo json_encode([
        "success" => false,
        "message" => "Deposit ID is required."
    ]);
    exit;
}

if (!in_array($action, ["approve", "reject"], true)) {
    echo json_encode([
        "success" => false,
        "message" => "Invalid action."
    ]);
    exit;
}

try {

    $id = new MongoDB\BSON\ObjectId($depositId);

    $deposit = $deposits->findOne([
        "_id" => $id
    ]);

    if (!$deposit) {
        echo json_encode([
            "success" => false,
            "message" => "Deposit not found."
        ]);
        exit;
    }

    if (($deposit["status"] ?? "") !== "pending") {
        echo json_encode([
            "success" => false,
            "message" => "This deposit has already been processed."
        ]);
        exit;
    }

    /*
     * IMPORTANT:
     * Real MTN/Airtel payment verification must happen
     * before approving the deposit.
     */

    if ($action === "reject") {

        $deposits->updateOne(
            ["_id" => $id],
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
                "deposit_id" => $id,
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
            "message" => "Deposit rejected."
        ]);

        exit;
    }

    /*
     * Approval should only happen after
     * payment verification.
     */

    $userId = $deposit["user_id"];
    $amount = (float) $deposit["amount"];

    $users->updateOne(
        ["_id" => $userId],
        [
            '$inc' => [
                "balance" => $amount
            ]
        ]
    );

    $deposits->updateOne(
        ["_id" => $id],
        [
            '$set' => [
                "status" => "approved",
                "processed_at" =>
                    new MongoDB\BSON\UTCDateTime()
            ]
        ]
    );

    $transactions->updateOne(
        [
            "deposit_id" => $id,
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
        "message" => "Deposit approved."
    ]);

} catch (Exception $e) {

    http_response_code(500);

    echo json_encode([
        "success" => false,
        "message" => "Unable to process deposit."
    ]);
}
?>
