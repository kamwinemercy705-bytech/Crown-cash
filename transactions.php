<?php

require_once "auth.php";
require_once "config.php";

header("Content-Type: application/json");

try {

    $userId = new MongoDB\BSON\ObjectId(
        $_SESSION["user_id"]
    );

    $cursor = $transactions->find(
        [
            "user_id" => $userId
        ],
        [
            "sort" => [
                "created_at" => -1
            ],
            "limit" => 100
        ]
    );

    $transactionList = [];

    foreach ($cursor as $transaction) {

        $transactionList[] = [

            "id" => (string) $transaction["_id"],

            "type" =>
                $transaction["type"] ?? "",

            "amount" =>
                (float) ($transaction["amount"] ?? 0),

            "method" =>
                $transaction["method"] ?? "",

            "reference" =>
                $transaction["reference"] ?? "",

            "status" =>
                $transaction["status"] ?? "",

            "created_at" =>
                isset($transaction["created_at"])
                    ? $transaction["created_at"]
                        ->toDateTime()
                        ->format("Y-m-d H:i:s")
                    : null
        ];
    }

    echo json_encode([
        "success" => true,
        "transactions" => $transactionList
    ]);

} catch (Exception $e) {

    http_response_code(500);

    echo json_encode([
        "success" => false,
        "message" => "Unable to load transactions."
    ]);
}
?>
