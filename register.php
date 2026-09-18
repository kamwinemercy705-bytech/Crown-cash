<?php

// ============================================================
// CROWN CASH - USER REGISTRATION API
// File: register.php
// Backend: PHP + MongoDB
// ============================================================

header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Origin: https://crown-cash.vercel.app");
header("Access-Control-Allow-Credentials: true");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");

// Handle CORS preflight
if ($_SERVER["REQUEST_METHOD"] === "OPTIONS") {
    http_response_code(204);
    exit;
}

if ($_SERVER["REQUEST_METHOD"] !== "POST") {
    http_response_code(405);
    echo json_encode([
        "success" => false,
        "message" => "Method not allowed."
    ]);
    exit;
}

// ------------------------------------------------------------
// Load MongoDB configuration
// ------------------------------------------------------------

require_once __DIR__ . "/config.php";

try {

    // --------------------------------------------------------
    // Read JSON request
    // --------------------------------------------------------

    $input = json_decode(file_get_contents("php://input"), true);

    if (!is_array($input)) {
        $input = $_POST;
    }

    // --------------------------------------------------------
    // Get form values
    // --------------------------------------------------------

    $firstName = trim((string)($input["first_name"] ?? ""));
    $lastName = trim((string)($input["last_name"] ?? ""));
    $fullName = trim((string)($input["full_name"] ?? ""));

    $email = strtolower(trim((string)($input["email"] ?? "")));

    $phone = trim((string)($input["phone"] ?? ""));
    $password = (string)($input["password"] ?? "");
    $confirmPassword = (string)($input["confirm_password"] ?? "");

    // Referral code entered by the new user
    $referralCode = strtoupper(
        trim((string)(
            $input["referral_code"] ??
            $input["referralCode"] ??
            $input["referrer_code"] ??
            ""
        ))
    );

    // --------------------------------------------------------
    // If first/last name were supplied, build full name
    // --------------------------------------------------------

    if ($fullName === "") {
        $fullName = trim($firstName . " " . $lastName);
    }

    // --------------------------------------------------------
    // Validation
    // --------------------------------------------------------

    if ($firstName === "" && $fullName === "") {
        http_response_code(400);
        echo json_encode([
            "success" => false,
            "message" => "Please enter your first name."
        ]);
        exit;
    }

    if ($lastName === "" && $fullName !== "") {

        // If only full_name was supplied, keep it.
        // This allows compatibility with older frontend versions.
    }

    if ($email === "" || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
        http_response_code(400);
        echo json_encode([
            "success" => false,
            "message" => "Please enter a valid email address."
        ]);
        exit;
    }

    if ($phone === "") {
        http_response_code(400);
        echo json_encode([
            "success" => false,
            "message" => "Please enter your phone number."
        ]);
        exit;
    }

    if (strlen($password) < 8) {
        http_response_code(400);
        echo json_encode([
            "success" => false,
            "message" => "Password must contain at least 8 characters."
        ]);
        exit;
    }

    if ($password !== $confirmPassword) {
        http_response_code(400);
        echo json_encode([
            "success" => false,
            "message" => "Passwords do not match."
        ]);
        exit;
    }

    // --------------------------------------------------------
    // Make sure MongoDB users collection exists
    // --------------------------------------------------------

    if (!isset($users)) {
        http_response_code(500);
        echo json_encode([
            "success" => false,
            "message" => "Users database collection is not configured."
        ]);
        exit;
    }

    // --------------------------------------------------------
    // Check whether email already exists
    // --------------------------------------------------------

    $existingEmail = $users->findOne([
        "email" => $email
    ]);

    if ($existingEmail !== null) {
        http_response_code(409);
        echo json_encode([
            "success" => false,
            "message" => "An account with this email already exists."
        ]);
        exit;
    }

    // --------------------------------------------------------
    // Check whether phone already exists
    // --------------------------------------------------------

    $existingPhone = $users->findOne([
        "phone" => $phone
    ]);

    if ($existingPhone !== null) {
        http_response_code(409);
        echo json_encode([
            "success" => false,
            "message" => "An account with this phone number already exists."
        ]);
        exit;
    }

    // --------------------------------------------------------
    // Generate unique referral code for the new user
    // --------------------------------------------------------

    function generateReferralCode($users)
    {
        do {

            $code = "CC" . strtoupper(
                substr(
                    bin2hex(random_bytes(5)),
                    0,
                    8
                )
            );

            $existing = $users->findOne([
                "referral_code" => $code
            ]);

        } while ($existing !== null);

        return $code;
    }

    $newReferralCode = generateReferralCode($users);

    // --------------------------------------------------------
    // Find referrer if referral code was supplied
    // --------------------------------------------------------

    $referrerId = null;
    $referrerCodeUsed = null;
    $referrerName = null;

    if ($referralCode !== "") {

        $referrer = $users->findOne([
            "referral_code" => $referralCode
        ]);

        if ($referrer === null) {

            http_response_code(400);

            echo json_encode([
                "success" => false,
                "message" => "The referral code you entered is invalid."
            ]);

            exit;
        }

        $referrerId = $referrer["_id"];
        $referrerCodeUsed = $referralCode;

        $referrerName = trim(
            (string)($referrer["full_name"] ?? "")
        );

        if ($referrerName === "") {

            $referrerName = trim(
                (string)($referrer["first_name"] ?? "") .
                " " .
                (string)($referrer["last_name"] ?? "")
            );
        }
    }

    // --------------------------------------------------------
    // Hash password
    // --------------------------------------------------------

    $passwordHash = password_hash(
        $password,
        PASSWORD_DEFAULT
    );

    // --------------------------------------------------------
    // Create user document
    // --------------------------------------------------------

    $userDocument = [

        // MongoDB ID is automatically generated
        "first_name" => $firstName,
        "last_name" => $lastName,
        "full_name" => $fullName,

        "email" => $email,
        "phone" => $phone,

        "password" => $passwordHash,

        // Wallet
        "balance" => 0,
        "wallet_balance" => 0,

        // Registration
        "registration_fee" => 12000,
        "registration_paid" => false,

        // Account
        "account_type" => "user",
        "role" => "user",
        "status" => "active",

        // Referral code belonging to this user
        "referral_code" => $newReferralCode,

        // Referral information used to connect this
        // user to their sponsor.
        "referred_by" => $referrerCodeUsed,
        "referral_code_used" => $referrerCodeUsed,
        "referrer_code" => $referrerCodeUsed,

        // Direct MongoDB reference to sponsor
        "referrer_id" => $referrerId,
        "referred_by_id" => $referrerId,

        // Helpful display field
        "referrer_name" => $referrerName,

        // Referral earnings start at zero
        "referral_earnings" => 0,
        "level_1_earnings" => 0,
        "level_2_earnings" => 0,
        "level_3_earnings" => 0,

        // Timestamps
        "created_at" => new MongoDB\BSON\UTCDateTime(),
        "updated_at" => new MongoDB\BSON\UTCDateTime()
    ];

    // --------------------------------------------------------
    // Insert user
    // --------------------------------------------------------

    $insertResult = $users->insertOne($userDocument);

    if (!$insertResult->isAcknowledged()) {

        throw new Exception(
            "The user account could not be created."
        );
    }

    $newUserId = $insertResult->getInsertedId();

    // --------------------------------------------------------
    // Create referral record when there is a referrer
    // --------------------------------------------------------

    if (
        $referrerId !== null &&
        isset($referrals)
    ) {

        try {

            $referrals->insertOne([

                "user_id" => $newUserId,

                "referrer_id" => $referrerId,

                "referral_code" => $referrerCodeUsed,

                "level" => 1,

                "status" => "active",

                "commission_earned" => 0,

                "created_at" =>
                    new MongoDB\BSON\UTCDateTime(),

                "updated_at" =>
                    new MongoDB\BSON\UTCDateTime()
            ]);

        } catch (Throwable $referralError) {

            // Do not delete the user if referral-record
            // creation fails. The user is still registered.
        }
    }

    // --------------------------------------------------------
    // Create audit record
    // --------------------------------------------------------

    if (isset($audit_logs)) {

        try {

            $audit_logs->insertOne([

                "user_id" => $newUserId,

                "action" => "user_registration",

                "description" =>
                    "New Crown Cash account registered.",

                "referral_code_used" =>
                    $referrerCodeUsed,

                "created_at" =>
                    new MongoDB\BSON\UTCDateTime()
            ]);

        } catch (Throwable $auditError) {

            // Registration should not fail only because
            // audit logging failed.
        }
    }

    // --------------------------------------------------------
    // Optional automatic login session
    // --------------------------------------------------------

    // This allows the user to be logged in immediately
    // after successful registration if the frontend wants it.

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

    session_regenerate_id(true);

    $_SESSION["logged_in"] = true;
    $_SESSION["user_id"] = (string)$newUserId;
    $_SESSION["user_email"] = $email;

    // --------------------------------------------------------
    // Success response
    // --------------------------------------------------------

    http_response_code(201);

    echo json_encode([

        "success" => true,

        "message" =>
            "Account created successfully.",

        "user" => [

            "id" => (string)$newUserId,

            "first_name" => $firstName,

            "last_name" => $lastName,

            "full_name" => $fullName,

            "email" => $email,

            "phone" => $phone,

            "referral_code" => $newReferralCode,

            "referred_by" => $referrerCodeUsed,

            "status" => "active"
        ]

    ]);

} catch (Throwable $e) {

    // --------------------------------------------------------
    // Database / server error
    // --------------------------------------------------------

    http_response_code(500);

    echo json_encode([

        "success" => false,

        "message" =>
            "Registration could not be completed.",

        // Useful during development.
        // Remove or hide this in the production version.
        "error" => $e->getMessage()
    ]);
}
?>