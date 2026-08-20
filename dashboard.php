<?php

require_once "auth.php";
require_once "config.php";

header("Content-Type: application/json");

try {

    $userId = new MongoDB\BSON\ObjectId(
        $_SESSION["user_id"]
    );

    $user = $users->findOne(
        [
            "_id" => $userId
        ],
        [
            "projection" => [
                "password" => 0
            ]
        ]
    );

    if (!$user) {

        http_response_code(404);

        echo json_encode([
            "success" => false,
            "message" => "User not found."
        ]);

        exit;
    }

    echo json_encode([
        "success" => true,
        "user" => [
            "id" => (string) $user["_id"],
            "full_name" => $user["full_name"] ?? "",
            "email" => $user["email"] ?? "",
            "phone" => $user["phone"] ?? "",
            "balance" => $user["balance"] ?? 0,
            "referral_code" => $user["referral_code"] ?? "",
            "status" => $user["status"] ?? "active"
        ]
    ]);

} catch (Exception $e) {

    http_response_code(500);

    echo json_encode([
        "success" => false,
        "message" => "Unable to load dashboard."
    ]);
}
