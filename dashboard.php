<?php

header("Access-Control-Allow-Origin: https://crown-cash.vercel.app");
header("Access-Control-Allow-Methods: GET, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");
header("Access-Control-Allow-Credentials: true");
header("Content-Type: application/json; charset=UTF-8");

if ($_SERVER["REQUEST_METHOD"] === "OPTIONS") {
    http_response_code(204);
    exit;
}

session_set_cookie_params([
    "lifetime" => 0,
    "path" => "/",
    "domain" => "",
    "secure" => true,
    "httponly" => true,
    "samesite" => "None"
]);

session_start();

require_once __DIR__ . "/config.php";

if (
    empty($_SESSION["logged_in"]) ||
    empty($_SESSION["user_id"])
) {
    http_response_code(401);

    echo json_encode([
        "success" => false,
        "message" => "Not logged in."
    ]);

    exit;
}

try {

    $userId = new MongoDB\BSON\ObjectId(
        $_SESSION["user_id"]
    );

    $user = $users->findOne([
        "_id" => $userId
    ]);

    if (!$user) {

        session_destroy();

        http_response_code(401);

        echo json_encode([
            "success" => false,
            "message" => "User account not found."
        ]);

        exit;
    }

    if (($user["status"] ?? "active") !== "active") {

        http_response_code(403);

        echo json_encode([
            "success" => false,
            "message" => "This account is not active."
        ]);

        exit;
    }

    $firstName = $user["firstName"] ?? "";
    $lastName = $user["lastName"] ?? "";

    echo json_encode([

        "success" => true,

        "user" => [

            "id" => (string) $user["_id"],

            "firstName" => $firstName,

            "lastName" => $lastName,

            "full_name" =>
                trim($firstName . " " . $lastName),

            "email" =>
                $user["email"] ?? "",

            "phone" =>
                $user["phone"] ?? "",

            "referralCode" =>
                $user["referralCode"] ?? "",

            "balance" =>
                $user["balance"] ?? 0,

            "status" =>
                $user["status"] ?? "active"
        ]
    ]);

} catch (Throwable $e) {

    error_log(
        "CROWN CASH DASHBOARD ERROR: " .
        $e->getMessage()
    );

    http_response_code(500);

    echo json_encode([
        "success" => false,
        "message" => "Unable to load dashboard."
    ]);
}