<?php

// ============================================================
// CROWN CASH - LOGIN API
// File: login.php
// Backend: PHP + MongoDB
// ============================================================

declare(strict_types=1);

// ------------------------------------------------------------
// CORS
// ------------------------------------------------------------

header("Content-Type: application/json; charset=UTF-8");

header(
    "Access-Control-Allow-Origin: https://crown-cash.vercel.app"
);

header("Access-Control-Allow-Credentials: true");

header(
    "Access-Control-Allow-Methods: POST, OPTIONS"
);

header(
    "Access-Control-Allow-Headers: Content-Type"
);

// ------------------------------------------------------------
// Handle CORS preflight
// ------------------------------------------------------------

if ($_SERVER["REQUEST_METHOD"] === "OPTIONS") {

    http_response_code(204);

    exit;
}

// ------------------------------------------------------------
// Only POST is allowed
// ------------------------------------------------------------

if ($_SERVER["REQUEST_METHOD"] !== "POST") {

    http_response_code(405);

    echo json_encode([
        "success" => false,
        "message" => "Method not allowed."
    ]);

    exit;
}

// ------------------------------------------------------------
// Start cross-site session
// ------------------------------------------------------------

if (session_status() === PHP_SESSION_NONE) {

    session_set_cookie_params([
        "lifetime" => 0,
        "path" => "/",
        "secure" => true,
        "httponly" => true,
        "samesite" => "None"
    ]);

    session_start();
}

// ------------------------------------------------------------
// Load MongoDB configuration
// ------------------------------------------------------------

require_once __DIR__ . "/config.php";

try {

    // --------------------------------------------------------
    // Read JSON request
    // --------------------------------------------------------

    $input = json_decode(
        file_get_contents("php://input"),
        true
    );

    if (!is_array($input)) {

        $input = $_POST;
    }

    // --------------------------------------------------------
    // Get login information
    // --------------------------------------------------------

    $email = strtolower(
        trim(
            (string)($input["email"] ?? "")
        )
    );

    $password = (string)(
        $input["password"] ?? ""
    );

    // --------------------------------------------------------
    // Validate email
    // --------------------------------------------------------

    if (
        $email === "" ||
        !filter_var(
            $email,
            FILTER_VALIDATE_EMAIL
        )
    ) {

        http_response_code(400);

        echo json_encode([
            "success" => false,
            "message" => "Please enter a valid email address."
        ]);

        exit;
    }

    // --------------------------------------------------------
    // Validate password
    // --------------------------------------------------------

    if ($password === "") {

        http_response_code(400);

        echo json_encode([
            "success" => false,
            "message" => "Please enter your password."
        ]);

        exit;
    }

    // --------------------------------------------------------
    // Make sure users collection exists
    // --------------------------------------------------------

    if (!isset($users)) {

        throw new Exception(
            "Users collection is not configured."
        );
    }

    // --------------------------------------------------------
    // Find user
    // --------------------------------------------------------

    $user = $users->findOne([
        "email" => $email
    ]);

    // --------------------------------------------------------
    // User does not exist
    // --------------------------------------------------------

    if ($user === null) {

        http_response_code(401);

        echo json_encode([
            "success" => false,
            "message" => "Invalid email or password."
        ]);

        exit;
    }

    // --------------------------------------------------------
    // Get stored password hash
    // --------------------------------------------------------

    $storedPassword = (string)(
        $user["password"] ??
        $user["password_hash"] ??
        ""
    );

    // --------------------------------------------------------
    // Verify password
    // --------------------------------------------------------

    if (
        $storedPassword === "" ||
        !password_verify(
            $password,
            $storedPassword
        )
    ) {

        http_response_code(401);

        echo json_encode([
            "success" => false,
            "message" => "Invalid email or password."
        ]);

        exit;
    }

    // --------------------------------------------------------
    // Check account status
    // --------------------------------------------------------

    $status = strtolower(
        trim(
            (string)($user["status"] ?? "active")
        )
    );

    $blockedStatuses = [
        "blocked",
        "suspended",
        "disabled",
        "banned"
    ];

    if (
        in_array(
            $status,
            $blockedStatuses,
            true
        )
    ) {

        http_response_code(403);

        echo json_encode([
            "success" => false,
            "message" =>
                "Your account is currently " .
                $status .
                ". Please contact support."
        ]);

        exit;
    }

    // --------------------------------------------------------
    // Regenerate session ID
    // --------------------------------------------------------

    session_regenerate_id(true);

    // --------------------------------------------------------
    // Store login session
    // --------------------------------------------------------

    $_SESSION["logged_in"] = true;

    $_SESSION["user_id"] =
        (string)$user["_id"];

    $_SESSION["user_email"] =
        (string)($user["email"] ?? $email);

    $_SESSION["login_time"] =
        time();

    // --------------------------------------------------------
    // Determine account type / role
    // --------------------------------------------------------

    $role = strtolower(
        trim(
            (string)(
                $user["role"] ??
                $user["account_type"] ??
                "user"
            )
        )
    );

    // --------------------------------------------------------
    // Get user's name
    // --------------------------------------------------------

    $firstName = (string)(
        $user["first_name"] ?? ""
    );

    $lastName = (string)(
        $user["last_name"] ?? ""
    );

    $fullName = trim(
        (string)(
            $user["full_name"] ?? ""
        )
    );

    if ($fullName === "") {

        $fullName = trim(
            $firstName .
            " " .
            $lastName
        );
    }

    // --------------------------------------------------------
    // Get referral code
    // --------------------------------------------------------

    $referralCode = (string)(
        $user["referral_code"] ?? ""
    );

    // --------------------------------------------------------
    // Login success
    // --------------------------------------------------------

    http_response_code(200);

    echo json_encode([

        "success" => true,

        "message" =>
            "Login successful.",

        "user" => [

            "id" =>
                (string)$user["_id"],

            "first_name" =>
                $firstName,

            "last_name" =>
                $lastName,

            "full_name" =>
                $fullName,

            "email" =>
                (string)(
                    $user["email"] ?? $email
                ),

            "phone" =>
                (string)(
                    $user["phone"] ?? ""
                ),

            "referral_code" =>
                $referralCode,

            "role" =>
                $role,

            "status" =>
                $status
        ]

    ]);

} catch (Throwable $e) {

    // --------------------------------------------------------
    // Server/database error
    // --------------------------------------------------------

    http_response_code(500);

    echo json_encode([

        "success" => false,

        "message" =>
            "Unable to process login right now.",

        // Development information.
        // Remove this field before public launch.
        "error" =>
            $e->getMessage()
    ]);
}
?>