<?php

declare(strict_types=1);

/*
|--------------------------------------------------------------------------
| Crown Cash - Admin Authentication
|--------------------------------------------------------------------------
| This file protects administrator-only PHP endpoints.
|
| IMPORTANT:
| Frontend JavaScript is NOT trusted for admin security.
| The server checks the PHP session on every request.
|--------------------------------------------------------------------------
*/


/* =========================
   CORS
========================= */

$allowedOrigin = "https://crown-cash.vercel.app";

if (
    isset($_SERVER["HTTP_ORIGIN"]) &&
    $_SERVER["HTTP_ORIGIN"] === $allowedOrigin
) {
    header(
        "Access-Control-Allow-Origin: " . $allowedOrigin
    );

    header(
        "Access-Control-Allow-Credentials: true"
    );

    header(
        "Access-Control-Allow-Headers: Content-Type"
    );

    header(
        "Access-Control-Allow-Methods: GET, POST, OPTIONS"
    );
}


/* =========================
   JSON RESPONSE
========================= */

header(
    "Content-Type: application/json; charset=utf-8"
);


/* =========================
   OPTIONS / PREFLIGHT
========================= */

if (
    ($_SERVER["REQUEST_METHOD"] ?? "GET") === "OPTIONS"
) {
    http_response_code(204);
    exit;
}


/* =========================
   SECURE SESSION
========================= */

if (session_status() !== PHP_SESSION_ACTIVE) {

    session_set_cookie_params([
        "lifetime" => 0,
        "path" => "/",
        "secure" => true,
        "httponly" => true,
        "samesite" => "None"
    ]);

    session_start();
}


/* =========================
   SESSION CHECK
========================= */

if (
    !isset($_SESSION["logged_in"]) ||
    $_SESSION["logged_in"] !== true ||
    empty($_SESSION["user_id"])
) {

    http_response_code(401);

    echo json_encode([
        "success" => false,
        "authenticated" => false,
        "authorized" => false,
        "message" => "Administrator login required."
    ]);

    exit;
}


/* =========================
   ADMIN ROLE CHECK
========================= */

$role = strtolower(
    trim(
        (string)(
            $_SESSION["role"] ??
            ""
        )
    )
);

$accountType = strtolower(
    trim(
        (string)(
            $_SESSION["account_type"] ??
            ""
        )
    )
);


/*
|--------------------------------------------------------------------------
| Only the admin role is accepted.
|
| We deliberately do NOT allow:
|
| account_type = "user"
| account_type = "member"
| account_type = "customer"
|
| to become admin automatically.
|--------------------------------------------------------------------------
*/

if ($role !== "admin") {

    http_response_code(403);

    echo json_encode([
        "success" => false,
        "authenticated" => true,
        "authorized" => false,
        "message" => "Administrator access required."
    ]);

    exit;
}


/* =========================
   SESSION TIMEOUT
========================= */

$sessionTimeout = 60 * 60 * 2; // 2 hours


if (
    isset($_SESSION["login_time"]) &&
    is_numeric($_SESSION["login_time"])
) {

    $elapsed =
        time() -
        (int)$_SESSION["login_time"];

    if ($elapsed > $sessionTimeout) {

        $_SESSION = [];

        if (ini_get("session.use_cookies")) {

            $params =
                session_get_cookie_params();

            setcookie(
                session_name(),
                "",
                time() - 42000,
                $params["path"],
                $params["domain"] ?? "",
                (bool)$params["secure"],
                (bool)$params["httponly"]
            );
        }

        session_destroy();

        http_response_code(401);

        echo json_encode([
            "success" => false,
            "authenticated" => false,
            "authorized" => false,
            "message" => "Admin session expired. Please login again."
        ]);

        exit;
    }
}


/* =========================
   OPTIONAL SESSION ID CHECK
========================= */

if (
    empty($_SESSION["admin_session_verified"])
) {
    $_SESSION["admin_session_verified"] = true;
}


/* =========================
   ADMIN AUTHENTICATED
========================= */

return true;