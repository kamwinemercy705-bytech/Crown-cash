<?php

require_once "admin_auth.php";

header("Content-Type: application/json");

try {

    $cursor = $withdrawals->find(
        [
            "status" => "pending"
        ],
        [
            "sort" => [
                "created_at" => -1
            ],
            "limit" => 100
        ]
    );

    $result = [];

    foreach ($cursor as $withdrawal) {

        $user = $users->findOne([
            "_id" => $withdrawal["user_id"]
        ]);

        $result[] = [

            "id" =>
                (string)$withdrawal["_id"],

            "user_id" =>
                (string)$withdrawal["user_id"],

            "full_name" =>
                $user["full_name"] ?? "Unknown",

            "phone" =>
                $user["phone"] ?? "",

            "amount" =>
                (float)($withdrawal["amount"] ?? 0),

            "method" =>
                $withdrawal["method"] ?? "",

            "account" =>
                $withdrawal["account"] ?? "",

            "status" =>
                $withdrawal["status"] ?? "pending",

            "created_at" =>
                isset($withdrawal["created_at"])
                    ? $withdrawal["created_at"]
                        ->toDateTime()
                        ->format("Y-m-d H:i:s")
                    : null
        ];
    }

    echo json_encode([
        "success" => true,
        "withdrawals" => $result
    ]);

} catch (Exception $e) {

    http_response_code(500);

    echo json_encode([
        "success" => false,
        "message" =>
            "Unable to load withdrawals."
    ]);
}

?>
