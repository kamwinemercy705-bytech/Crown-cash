<?php

// ============================================
// CROWN CASH - LOGOUT API
// File: logout.php
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
// START SECURE CROSS-SITE SESSION
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
// CLEAR ALL SESSION VARIABLES
// -------------------------------
$_SESSION = [];

// -------------------------------
// DELETE SESSION COOKIE
// -------------------------------
if (ini_get("session.use_cookies")) {

    $params = session_get_cookie_params();

    setcookie(
        session_name(),
        "",
        time() - 42000,
        $params["path"],
        $params["domain"],
        $params["secure"],
        $params["httponly"]
    );
}

// -------------------------------
// DESTROY SESSION
// -------------------------------
session_destroy();

// -------------------------------
// RESPONSE
// -------------------------------
http_response_code(200);

echo json_encode([
    "success" => true,
    "message" => "You have been logged out successfully."
]);

exit;
?>