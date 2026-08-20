<?php

require_once "auth.php";
require_once "config.php";

header("Content-Type: application/json");

try {

    $userId = new MongoDB\BSON\ObjectId(
        $_SESSION["user_id"]
    );

    $cursor = $investments->find(
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

    $investmentList = [];

    foreach ($cursor as $investment) {

        $investmentList[] = [

            "id" => (string) $investment["_id"],

            "amount" =>
                (float) ($investment["amount"] ?? 0),

            "status" =>
                $investment["status"] ?? "unknown",

            "created_at" =>
                isset($investment["created_at"])
                    ? $investment["created_at"]
                        ->toDateTime()
                        ->format("Y-m-d H:i:s")
                    : null
        ];
    }

    echo json_encode([
        "success" => true,
        "investments" => $investmentList
    ]);

} catch (Exception $e) {

    http_response_code(500);

    echo json_encode([
        "success" => false,
        "message" => "Unable to load investments."
    ]);
}
?>
