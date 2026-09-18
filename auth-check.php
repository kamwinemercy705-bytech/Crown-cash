<?php

// ============================================
// CROWN CASH - AUTHENTICATION CHECK API
// File: auth-check.php
// ============================================

// -------------------------------
// CORS SETTINGS
// -------------------------------
header("Access-Control-Allow-Origin: https://crown-cash.vercel.app");
header("Access-Control-Allow-Credentials: true");
header("Access-Control-Allow-Headers: Content-Type");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Content-Type: application/json; charset=UTF-8");

// -------------------------------
// HANDLE PREFLIGHT REQUEST
// -------------------------------
if ($_SERVER["REQUEST_METHOD"] === "OPTIONS") {
    http_response_code(204);
    exit;
}

// -------------------------------
// START CROSS-SITE SESSION
// -------------------------------
session_set_cookie_params([
    "lifetime" => 0,
    "path" => "/",
    "secure" => true,
    "httponly" => true,
    "samesite" => "None"
]);

session_start();

// -------------------------------
// CHECK LOGIN STATUS
// -------------------------------
if (
    empty($_SESSION["logged_in"]) ||
    $_SESSION["logged_in"] !== true ||
    empty($_SESSION["user_id"])
) {
    http_response_code(401);

    echo json_encode([
        "success" => false,
        "authenticated" => false,
        "message" => "You are not logged in."
    ]);

    exit;
}

// -------------------------------
// RETURN SESSION INFORMATION
// -------------------------------
echo json_encode([
    "success" => true,
    "authenticated" => true,
    "user" => [
        "id" => (string) $_SESSION["user_id"],
        "email" => $_SESSION["user_email"] ?? "",
        "role" => $_SESSION["role"] ?? "user",
        "login_time" => $_SESSION["login_time"] ?? null
    ]
]);

exit;
?>