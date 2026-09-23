<?php

// ============================================================
// CROWN CASH - USER REGISTRATION API
// File: register.php
// Backend: PHP + MongoDB
//
// REGISTRATION RULES
// - Registration fee: UGX 0
// - Account created without payment
// - Registration bonus: UGX 5,000
// - Starting balance: UGX 5,000
// - Account status: active
// - funded: false until a deposit/investment is made
//
// REFERRAL SYSTEM
// - Level 1: 15%
// - Level 2: 5%
// - Level 3: 2%
// ============================================================

declare(strict_types=1);

// ------------------------------------------------------------
// Error handling
// ------------------------------------------------------------

ini_set("display_errors", "0");
ini_set("log_errors", "1");
error_reporting(E_ALL);

// ------------------------------------------------------------
// CORS
// ------------------------------------------------------------

header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Origin: https://crown-cash.vercel.app");
header("Access-Control-Allow-Credentials: true");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");

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
// Load MongoDB configuration
// ------------------------------------------------------------

require_once __DIR__ . "/config.php";

// ============================================================
// REGISTRATION BONUS
// ============================================================

const REGISTRATION_BONUS = 5000;

// ============================================================
// REFERRAL COMMISSION PERCENTAGES
//
// These remain separate from the registration bonus.
// ============================================================

const LEVEL_1_REFERRAL_PERCENTAGE = 15;
const LEVEL_2_REFERRAL_PERCENTAGE = 5;
const LEVEL_3_REFERRAL_PERCENTAGE = 2;

// ============================================================
// MAIN REGISTRATION PROCESS
// ============================================================

try {

    // --------------------------------------------------------
    // Read JSON request
    // --------------------------------------------------------

    $rawInput = file_get_contents("php://input");

    $input = json_decode(
        $rawInput,
        true
    );

    if (!is_array($input)) {
        $input = $_POST;
    }

    // --------------------------------------------------------
    // Get form values
    // --------------------------------------------------------

    $firstName = trim(
        (string)($input["first_name"] ?? "")
    );

    $lastName = trim(
        (string)($input["last_name"] ?? "")
    );

    $fullName = trim(
        (string)($input["full_name"] ?? "")
    );

    $email = strtolower(
        trim(
            (string)($input["email"] ?? "")
        )
    );

    $phone = trim(
        (string)($input["phone"] ?? "")
    );

    $password = (string)(
        $input["password"] ?? ""
    );

    $confirmPassword = (string)(
        $input["confirm_password"] ?? ""
    );

    // --------------------------------------------------------
    // Referral code entered by new user
    // --------------------------------------------------------

    $referralCode = strtoupper(
        trim(
            (string)(
                $input["referral_code"] ??
                $input["referralCode"] ??
                $input["referrer_code"] ??
                ""
            )
        )
    );

    // --------------------------------------------------------
    // Build full name if necessary
    // --------------------------------------------------------

    if ($fullName === "") {

        $fullName = trim(
            $firstName . " " . $lastName
        );
    }

    // ========================================================
    // VALIDATION
    // ========================================================

    if (
        $firstName === "" &&
        $fullName === ""
    ) {

        http_response_code(400);

        echo json_encode([
            "success" => false,
            "message" => "Please enter your first name."
        ]);

        exit;
    }

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
            "message" =>
                "Please enter a valid email address."
        ]);

        exit;
    }

    if ($phone === "") {

        http_response_code(400);

        echo json_encode([
            "success" => false,
            "message" =>
                "Please enter your phone number."
        ]);

        exit;
    }

    if (strlen($password) < 8) {

        http_response_code(400);

        echo json_encode([
            "success" => false,
            "message" =>
                "Password must contain at least 8 characters."
        ]);

        exit;
    }

    if ($password !== $confirmPassword) {

        http_response_code(400);

        echo json_encode([
            "success" => false,
            "message" =>
                "Passwords do not match."
        ]);

        exit;
    }

    // ========================================================
    // CHECK DATABASE COLLECTIONS
    // ========================================================

    if (!isset($users)) {

        http_response_code(500);

        echo json_encode([
            "success" => false,
            "message" =>
                "Users database collection is not configured."
        ]);

        exit;
    }

    if (!isset($transactions)) {

        http_response_code(500);

        echo json_encode([
            "success" => false,
            "message" =>
                "Transactions database collection is not configured."
        ]);

        exit;
    }

    // ========================================================
    // CHECK DUPLICATE EMAIL
    // ========================================================

    $existingEmail = $users->findOne([
        "email" => $email
    ]);

    if ($existingEmail !== null) {

        http_response_code(409);

        echo json_encode([
            "success" => false,
            "message" =>
                "An account with this email already exists."
        ]);

        exit;
    }

    // ========================================================
    // CHECK DUPLICATE PHONE
    // ========================================================

    $existingPhone = $users->findOne([
        "phone" => $phone
    ]);

    if ($existingPhone !== null) {

        http_response_code(409);

        echo json_encode([
            "success" => false,
            "message" =>
                "An account with this phone number already exists."
        ]);

        exit;
    }

    // ========================================================
    // GENERATE UNIQUE REFERRAL CODE
    // ========================================================

    function generateReferralCode($users): string
    {
        do {

            $code =
                "CC" .
                strtoupper(
                    substr(
                        bin2hex(
                            random_bytes(5)
                        ),
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

    $newReferralCode =
        generateReferralCode($users);

    // ========================================================
    // FIND REFERRER
    // ========================================================

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
                "message" =>
                    "The referral code you entered is invalid."
            ]);

            exit;
        }

        $referrerId =
            $referrer["_id"];

        $referrerCodeUsed =
            $referralCode;

        $referrerName =
            trim(
                (string)(
                    $referrer["full_name"] ?? ""
                )
            );

        if ($referrerName === "") {

            $referrerName =
                trim(
                    (string)(
                        $referrer["first_name"] ?? ""
                    ) .
                    " " .
                    (string)(
                        $referrer["last_name"] ?? ""
                    )
                );
        }
    }

    // ========================================================
    // HASH PASSWORD
    // ========================================================

    $passwordHash = password_hash(
        $password,
        PASSWORD_DEFAULT
    );

    if ($passwordHash === false) {

        throw new Exception(
            "Password could not be secured."
        );
    }

    // ========================================================
    // REGISTRATION BONUS
    // ========================================================

    $registrationBonus =
        REGISTRATION_BONUS;

    $startingBalance =
        REGISTRATION_BONUS;

    $now =
        new MongoDB\BSON\UTCDateTime();

    // ========================================================
    // CREATE USER DOCUMENT
    // ========================================================

    $userDocument = [

        // ----------------------------------------------------
        // Identity
        // ----------------------------------------------------

        "first_name" =>
            $firstName,

        "last_name" =>
            $lastName,

        "full_name" =>
            $fullName,

        "email" =>
            $email,

        "phone" =>
            $phone,

        // ----------------------------------------------------
        // Password
        // ----------------------------------------------------

        "password" =>
            $passwordHash,

        // ----------------------------------------------------
        // Wallet
        //
        // New user receives UGX 5,000 immediately.
        // ----------------------------------------------------

        "balance" =>
            $startingBalance,

        "wallet_balance" =>
            $startingBalance,

        // ----------------------------------------------------
        // Registration
        //
        // NO registration fee.
        // ----------------------------------------------------

        "registration_fee" =>
            0,

        "registration_paid" =>
            true,

        "registration_fee_required" =>
            false,

        // ----------------------------------------------------
        // Registration bonus
        // ----------------------------------------------------

        "registration_bonus" =>
            $registrationBonus,

        "registration_bonus_received" =>
            true,

        "registration_bonus_received_at" =>
            $now,

        // ----------------------------------------------------
        // Account
        // ----------------------------------------------------

        "account_type" =>
            "user",

        "role" =>
            "user",

        "status" =>
            "active",

        // ----------------------------------------------------
        // Funding status
        //
        // Account is active immediately.
        // funded becomes true after qualifying
        // deposit/investment logic is completed.
        // ----------------------------------------------------

        "funded" =>
            false,

        "funded_at" =>
            null,

        // ----------------------------------------------------
        // Referral code belonging to this user
        // ----------------------------------------------------

        "referral_code" =>
            $newReferralCode,

        // ----------------------------------------------------
        // Referral information
        // ----------------------------------------------------

        "referred_by" =>
            $referrerCodeUsed,

        "referral_code_used" =>
            $referrerCodeUsed,

        "referrer_code" =>
            $referrerCodeUsed,

        // ----------------------------------------------------
        // Sponsor references
        // ----------------------------------------------------

        "referrer_id" =>
            $referrerId,

        "referred_by_id" =>
            $referrerId,

        "referrer_name" =>
            $referrerName,

        // ----------------------------------------------------
        // Referral earnings
        //
        // These remain separate from the UGX 5,000 bonus.
        // ----------------------------------------------------

        "referral_earnings" =>
            0,

        "level_1_earnings" =>
            0,

        "level_2_earnings" =>
            0,

        "level_3_earnings" =>
            0,

        // ----------------------------------------------------
        // Referral percentages
        // ----------------------------------------------------

        "level_1_percentage" =>
            LEVEL_1_REFERRAL_PERCENTAGE,

        "level_2_percentage" =>
            LEVEL_2_REFERRAL_PERCENTAGE,

        "level_3_percentage" =>
            LEVEL_3_REFERRAL_PERCENTAGE,

        // ----------------------------------------------------
        // Timestamps
        // ----------------------------------------------------

        "created_at" =>
            $now,

        "updated_at" =>
            $now
    ];

    // ========================================================
    // START MONGODB TRANSACTION
    //
    // User creation + bonus transaction are committed together.
    // ========================================================

    $mongoSession =
        $mongoClient->startSession();

    try {

        $mongoSession->startTransaction();

        // ====================================================
        // INSERT USER
        // ====================================================

        $insertResult =
            $users->insertOne(
                $userDocument,
                [
                    "session" =>
                        $mongoSession
                ]
            );

        if (!$insertResult->isAcknowledged()) {

            throw new Exception(
                "The user account could not be created."
            );
        }

        $newUserId =
            $insertResult->getInsertedId();

        // ====================================================
        // CREATE REGISTRATION BONUS TRANSACTION
        // ====================================================

        $bonusReference =
            "REG-BONUS-" .
            strtoupper(
                bin2hex(
                    random_bytes(6)
                )
            );

        $transactions->insertOne(
            [

                "user_id" =>
                    $newUserId,

                "type" =>
                    "registration_bonus",

                "transaction_type" =>
                    "registration_bonus",

                "category" =>
                    "bonus",

                "description" =>
                    "Crown Cash registration bonus",

                "amount" =>
                    $registrationBonus,

                "balance_before" =>
                    0,

                "balance_after" =>
                    $registrationBonus,

                "status" =>
                    "completed",

                "payment_method" =>
                    "system",

                "reference" =>
                    $bonusReference,

                "created_at" =>
                    $now,

                "updated_at" =>
                    $now
            ],
            [
                "session" =>
                    $mongoSession
            ]
        );

        // ====================================================
        // CREATE REFERRAL RECORD
        //
        // This does NOT pay referral commission on registration.
        // The referral structure remains:
        // L1 = 15%
        // L2 = 5%
        // L3 = 2%
        // ====================================================

        if (
            $referrerId !== null &&
            isset($referrals)
        ) {

            $referrals->insertOne(
                [

                    "user_id" =>
                        $newUserId,

                    "referrer_id" =>
                        $referrerId,

                    "referral_code" =>
                        $referrerCodeUsed,

                    "level" =>
                        1,

                    "status" =>
                        "active",

                    "commission_earned" =>
                        0,

                    "level_1_percentage" =>
                        LEVEL_1_REFERRAL_PERCENTAGE,

                    "level_2_percentage" =>
                        LEVEL_2_REFERRAL_PERCENTAGE,

                    "level_3_percentage" =>
                        LEVEL_3_REFERRAL_PERCENTAGE,

                    "created_at" =>
                        $now,

                    "updated_at" =>
                        $now
                ],
                [
                    "session" =>
                        $mongoSession
                ]
            );
        }

        // ====================================================
        // CREATE AUDIT RECORD
        // ====================================================

        if (isset($auditLogs)) {

            $auditLogs->insertOne(
                [

                    "user_id" =>
                        $newUserId,

                    "action" =>
                        "user_registration",

                    "description" =>
                        "New Crown Cash account registered with a UGX 5,000 registration bonus.",

                    "registration_bonus" =>
                        $registrationBonus,

                    "registration_fee" =>
                        0,

                    "referral_code_used" =>
                        $referrerCodeUsed,

                    "created_at" =>
                        $now
                ],
                [
                    "session" =>
                        $mongoSession
                ]
            );
        }

        // ====================================================
        // COMMIT TRANSACTION
        // ====================================================

        $mongoSession->commitTransaction();

    } catch (Throwable $transactionError) {

        try {

            $mongoSession->abortTransaction();

        } catch (Throwable $abortError) {

            // Ignore abort error.
        }

        throw $transactionError;

    } finally {

        $mongoSession->endSession();
    }

    // ========================================================
    // AUTOMATIC LOGIN SESSION
    // ========================================================

    if (
        session_status() ===
        PHP_SESSION_NONE
    ) {

        session_set_cookie_params([
            "lifetime" =>
                0,

            "path" =>
                "/",

            "secure" =>
                true,

            "httponly" =>
                true,

            "samesite" =>
                "None"
        ]);

        session_start();
    }

    session_regenerate_id(true);

    $_SESSION["logged_in"] =
        true;

    $_SESSION["user_id"] =
        (string)$newUserId;

    $_SESSION["user_email"] =
        $email;

    $_SESSION["login_time"] =
        time();

    $_SESSION["role"] =
        "user";

    $_SESSION["account_type"] =
        "user";

    // ========================================================
    // SUCCESS RESPONSE
    // ========================================================

    http_response_code(201);

    echo json_encode([

        "success" =>
            true,

        "message" =>
            "Account created successfully. You have received a UGX 5,000 registration bonus.",

        // ----------------------------------------------------
        // Bonus information
        // ----------------------------------------------------

        "bonus" => [

            "amount" =>
                $registrationBonus,

            "currency" =>
                "UGX",

            "type" =>
                "registration_bonus",

            "status" =>
                "completed"
        ],

        // ----------------------------------------------------
        // Account information
        // ----------------------------------------------------

        "account" => [

            "status" =>
                "active",

            "funded" =>
                false,

            "registration_fee" =>
                0,

            "registration_fee_required" =>
                false,

            "balance" =>
                $startingBalance
        ],

        // ----------------------------------------------------
        // Referral information
        // ----------------------------------------------------

        "referral" => [

            "level_1_percentage" =>
                LEVEL_1_REFERRAL_PERCENTAGE,

            "level_2_percentage" =>
                LEVEL_2_REFERRAL_PERCENTAGE,

            "level_3_percentage" =>
                LEVEL_3_REFERRAL_PERCENTAGE,

            "referral_code" =>
                $newReferralCode,

            "referred_by" =>
                $referrerCodeUsed
        ],

        // ----------------------------------------------------
        // User
        // ----------------------------------------------------

        "user" => [

            "id" =>
                (string)$newUserId,

            "first_name" =>
                $firstName,

            "last_name" =>
                $lastName,

            "full_name" =>
                $fullName,

            "email" =>
                $email,

            "phone" =>
                $phone,

            "referral_code" =>
                $newReferralCode,

            "referred_by" =>
                $referrerCodeUsed,

            "status" =>
                "active",

            "balance" =>
                $startingBalance
        ]

    ]);

} catch (
    MongoDB\Driver\Exception\Exception $e
) {

    error_log(
        "MongoDB registration error: " .
        $e->getMessage()
    );

    http_response_code(500);

    echo json_encode([

        "success" =>
            false,

        "message" =>
            "Registration could not be completed because of a database error."
    ]);

} catch (Throwable $e) {

    error_log(
        "Registration error: " .
        $e->getMessage()
    );

    http_response_code(500);

    echo json_encode([

        "success" =>
            false,

        "message" =>
            "Registration could not be completed."
    ]);
}

?>