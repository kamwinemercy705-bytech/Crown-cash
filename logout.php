<?php

/* =========================================================
   CROWN CASH - LOGOUT
   ========================================================= */

header("Access-Control-Allow-Origin: https://crown-cash.vercel.app");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");
header("Access-Control-Allow-Credentials: true");
header("Content-Type: application/json; charset=UTF-8");

/* Handle browser CORS preflight */
if ($_SERVER["REQUEST_METHOD"] === "OPTIONS") {
    http_response_code(204);
    exit;
}

/*
 * Use the same cookie configuration as login.php
 * and the other authenticated API files.
 */
session_set_cookie_params([
    "lifetime" => 0,
    "path" => "/",
    "domain" => "",
    "secure" => true,
    "httponly" => true,
    "samesite" => "None"
]);

session_start();

/* Remove all session variables */
$_SESSION = [];

/*
 * Remove the session cookie from the browser.
 */
if (ini_get("session.use_cookies")) {

    $params = session_get_cookie_params();

    setcookie(
        session_name(),
        "",
        [
            "expires" => time() - 42000,
            "path" => $params["path"],
            "domain" => $params["domain"],
            "secure" => $params["secure"],
            "httponly" => $params["httponly"],
            "samesite" => "None"
        ]
    );
}

/* Destroy the PHP session */
session_destroy();

/* Return JSON to the Vercel frontend */
echo json_encode([
    "success" => true,
    "message" => "Logout successful."
]);

exit;
?>