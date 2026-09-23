<?php

declare(strict_types=1);


// ======================================================
// CORS
// ======================================================

header("Content-Type: application/json");

header(
    "Access-Control-Allow-Origin: https://crown-cash.vercel.app"
);

header(
    "Access-Control-Allow-Credentials: true"
);

header(
    "Access-Control-Allow-Methods: POST, OPTIONS"
);

header(
    "Access-Control-Allow-Headers: Content-Type"
);


if ($_SERVER["REQUEST_METHOD"] === "OPTIONS") {

    http_response_code(204);

    exit;
}


// ======================================================
// SESSION
// ======================================================

session_set_cookie_params([
    "lifetime" => 0,
    "path" => "/",
    "secure" => true,
    "httponly" => true,
    "samesite" => "None"
]);

session_start();


// ======================================================
// METHOD
// ======================================================

if ($_SERVER["REQUEST_METHOD"] !== "POST") {

    http_response_code(405);

    echo json_encode([
        "success" => false,
        "message" => "Method not allowed."
    ]);

    exit;
}


// ======================================================
// AUTHENTICATION
// ======================================================

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


// ======================================================
// DATABASE
// ======================================================

require_once __DIR__ . "/config.php";


// ======================================================
// READ JSON
// ======================================================

$rawInput =
    file_get_contents("php://input");


$data =
    json_decode(
        $rawInput,
        true
    );


if (
    !is_array($data)
) {

    http_response_code(400);

    echo json_encode([
        "success" => false,
        "message" => "Invalid request."
    ]);

    exit;
}


// ======================================================
// INPUTS
// ======================================================

$currentPassword =
    (string)(
        $data["current_password"]
        ?? ""
    );


$newPassword =
    (string)(
        $data["new_password"]
        ?? ""
    );


$confirmPassword =
    (string)(
        $data["confirm_password"]
        ?? ""
    );


// ======================================================
// BASIC VALIDATION
// ======================================================

if (
    $currentPassword === "" ||
    $newPassword === "" ||
    $confirmPassword === ""
) {

    http_response_code(400);

    echo json_encode([
        "success" => false,
        "message" => "All password fields are required."
    ]);

    exit;
}


// ======================================================
// PASSWORD LENGTH
// ======================================================

if (
    strlen($newPassword) < 8
) {

    http_response_code(400);

    echo json_encode([
        "success" => false,
        "message" => "New password must contain at least 8 characters."
    ]);

    exit;
}


// ======================================================
// UPPERCASE
// ======================================================

if (
    !preg_match(
        "/[A-Z]/",
        $newPassword
    )
) {

    http_response_code(400);

    echo json_encode([
        "success" => false,
        "message" => "New password must contain at least one uppercase letter."
    ]);

    exit;
}


// ======================================================
// NUMBER
// ======================================================

if (
    !preg_match(
        "/[0-9]/",
        $newPassword
    )
) {

    http_response_code(400);

    echo json_encode([
        "success" => false,
        "message" => "New password must contain at least one number."
    ]);

    exit;
}


// ======================================================
// CONFIRM PASSWORD
// ======================================================

if (
    $newPassword !== $confirmPassword
) {

    http_response_code(400);

    echo json_encode([
        "success" => false,
        "message" => "New passwords do not match."
    ]);

    exit;
}


// ======================================================
// SAME PASSWORD
// ======================================================

if (
    $currentPassword === $newPassword
) {

    http_response_code(400);

    echo json_encode([
        "success" => false,
        "message" => "New password must be different from your current password."
    ]);

    exit;
}


// ======================================================
// DATABASE OPERATION
// ======================================================

try {

    $userId =
        new MongoDB\BSON\ObjectId(
            (string)$_SESSION["user_id"]
        );


    // ==============================================
    // FIND USER
    // ==============================================

    $user =
        $users->findOne([
            "_id" => $userId
        ]);


    if (!$user) {

        http_response_code(404);

        echo json_encode([
            "success" => false,
            "message" => "User account was not found."
        ]);

        exit;
    }


    // ==============================================
    // ACCOUNT STATUS
    // ==============================================

    $status =
        strtolower(
            trim(
                (string)(
                    $user["status"]
                    ?? "active"
                )
            )
        );


    if (
        in_array(
            $status,
            [
                "blocked",
                "suspended",
                "disabled",
                "banned",
                "inactive"
            ],
            true
        )
    ) {

        http_response_code(403);

        echo json_encode([
            "success" => false,
            "message" => "Your account is not permitted to change its password."
        ]);

        exit;
    }


    // ==============================================
    // GET EXISTING PASSWORD
    // ==============================================

    $storedPassword =
        (string)(
            $user["password"]
            ?? ""
        );


    if (
        $storedPassword === ""
    ) {

        http_response_code(500);

        echo json_encode([
            "success" => false,
            "message" => "Your account password could not be verified."
        ]);

        exit;
    }


    // ==============================================
    // VERIFY CURRENT PASSWORD
    // ==============================================

    if (
        !password_verify(
            $currentPassword,
            $storedPassword
        )
    ) {

        http_response_code(400);

        echo json_encode([
            "success" => false,
            "message" => "Your current password is incorrect."
        ]);

        exit;
    }


    // ==============================================
    // HASH NEW PASSWORD
    // ==============================================

    $hashedPassword =
        password_hash(
            $newPassword,
            PASSWORD_DEFAULT
        );


    if (
        !$hashedPassword
    ) {

        throw new Exception(
            "Unable to secure new password."
        );
    }


    // ==============================================
    // UPDATE USER
    // ==============================================

    $result =
        $users->updateOne(
            [
                "_id" => $userId
            ],
            [
                '$set' => [
                    "password" =>
                        $hashedPassword,

                    "password_updated_at" =>
                        new MongoDB\BSON\UTCDateTime()
                ]
            ]
        );


    if (
        $result->getModifiedCount() < 1
    ) {

        http_response_code(500);

        echo json_encode([
            "success" => false,
            "message" => "The password could not be updated."
        ]);

        exit;
    }


    // ==============================================
    // AUDIT LOG
    // ==============================================

    try {

        $auditLogs =
            $db->selectCollection(
                "audit_logs"
            );


        $auditLogs->insertOne([
            "user_id" => $userId,

            "action" =>
                "password_changed",

            "description" =>
                "User changed account password.",

            "created_at" =>
                new MongoDB\BSON\UTCDateTime(),

            "ip_address" =>
                $_SERVER["REMOTE_ADDR"]
                ?? "",

            "user_agent" =>
                $_SERVER["HTTP_USER_AGENT"]
                ?? ""
        ]);

    } catch (Exception $auditError) {

        /*
         * Do not undo a successful password
         * change if audit logging fails.
         */

        error_log(
            "Password change audit error: " .
            $auditError->getMessage()
        );
    }


    // ==============================================
    // SUCCESS
    // ==============================================

    echo json_encode([
        "success" => true,
        "message" => "Password changed successfully."
    ]);

    exit;


} catch (
    MongoDB\Driver\Exception\Exception $e
) {

    error_log(
        "MongoDB password change error: " .
        $e->getMessage()
    );


    http_response_code(500);

    echo json_encode([
        "success" => false,
        "message" => "Database error while changing password."
    ]);

    exit;


} catch (Exception $e) {

    error_log(
        "Password change error: " .
        $e->getMessage()
    );


    http_response_code(500);

    echo json_encode([
        "success" => false,
        "message" => "Unable to change password."
    ]);

    exit;
}
?>