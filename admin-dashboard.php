<?php

/* =========================================================
   CROWN CASH — ADMIN DASHBOARD API
   File: admin-dashboard.php
   ========================================================= */

declare(strict_types=1);


/* =========================================================
   HEADERS
   ========================================================= */

header("Content-Type: application/json; charset=UTF-8");

header(
    "Access-Control-Allow-Origin: https://crown-cash.vercel.app"
);

header(
    "Access-Control-Allow-Credentials: true"
);

header(
    "Access-Control-Allow-Methods: GET, OPTIONS"
);

header(
    "Access-Control-Allow-Headers: Content-Type, Accept"
);


/* =========================================================
   CORS PREFLIGHT
   ========================================================= */

if ($_SERVER["REQUEST_METHOD"] === "OPTIONS") {

    http_response_code(204);

    exit;
}


/* =========================================================
   ONLY GET ALLOWED
   ========================================================= */

if ($_SERVER["REQUEST_METHOD"] !== "GET") {

    http_response_code(405);

    echo json_encode([
        "success" => false,
        "message" => "Method not allowed."
    ]);

    exit;
}


/* =========================================================
   SECURE CROSS-SITE SESSION
   ========================================================= */

session_set_cookie_params([
    "lifetime" => 0,
    "path" => "/",
    "secure" => true,
    "httponly" => true,
    "samesite" => "None"
]);

session_start();


/* =========================================================
   ADMIN SESSION CHECK
   ========================================================= */

if (
    !isset($_SESSION["logged_in"]) ||
    $_SESSION["logged_in"] !== true ||
    !isset($_SESSION["user_id"])
) {

    http_response_code(401);

    echo json_encode([
        "success" => false,
        "message" => "Please login first."
    ]);

    exit;
}


/* =========================================================
   LOAD ADMIN AUTHENTICATION
   ========================================================= */

require_once __DIR__ . "/admin-auth.php";