<?php

declare(strict_types=1);

/*
|--------------------------------------------------------------------------
| Crown Cash - Admin Authentication
|--------------------------------------------------------------------------
| Central authentication file for ALL administrator APIs.
|
| Requirements:
| 1. User must be logged in
| 2. User must exist in MongoDB
| 3. Account must be active
| 4. role OR account_type must be admin
| 5. User must match ADMIN_USER_ID or ADMIN_EMAIL
|
| This version supports MongoDB _id stored as either:
| - ObjectId
| - String
|--------------------------------------------------------------------------
*/

header("Content-Type: application/json; charset=utf-8");

header(
    "Access-Control-Allow-Origin: https://crown-cash.vercel.app"
);

header("Access-Control-Allow-Credentials: true");

header(
    "Access-Control-Allow-Methods: GET, POST, OPTIONS"
);

header(
    "Access-Control-Allow-Headers: Content-Type"
);


/*
|--------------------------------------------------------------------------
| CORS PREFLIGHT
|--------------------------------------------------------------------------
*/

if ($_SERVER["REQUEST_METHOD"] === "OPTIONS") {
    http_response_code(204);
    exit;
}


/*
|--------------------------------------------------------------------------
| SECURE CROSS-SITE SESSION
|--------------------------------------------------------------------------
*/

session_set_cookie_params([
    "lifetime" => 0,
    "path" => "/",
    "secure" => true,
    "httponly" => true,
    "samesite" => "None"
]);

if (session_status() !== PHP_SESSION_ACTIVE) {
    session_start();
}


/*
|--------------------------------------------------------------------------
| LOGIN CHECK
|--------------------------------------------------------------------------
*/

if (
    !isset($_SESSION["logged_in"]) ||
    $_SESSION["logged_in"] !== true ||
    !isset($_SESSION["user_id"]) ||
    trim((string)$_SESSION["user_id"]) === ""
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


/*
|--------------------------------------------------------------------------
| ADMIN SESSION TIMEOUT
|--------------------------------------------------------------------------
*/

$adminSessionTimeout = 2 * 60 * 60;

if (
    isset($_SESSION["login_time"]) &&
    (time() - (int)$_SESSION["login_time"]) > $adminSessionTimeout
) {

    $_SESSION = [];

    if (ini_get("session.use_cookies")) {

        $params = session_get_cookie_params();

        setcookie(
            session_name(),
            "",
            time() - 42000,
            $params["path"],
            $params["domain"] ?? "",
            $params["secure"],
            $params["httponly"]
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


/*
|--------------------------------------------------------------------------
| LOAD DATABASE CONFIGURATION
|--------------------------------------------------------------------------
*/

try {

    require_once __DIR__ . "/config.php";

} catch (Throwable $e) {

    error_log(
        "Crown Cash admin authentication config error: " .
        $e->getMessage()
    );

    http_response_code(500);

    echo json_encode([
        "success" => false,
        "authenticated" => false,
        "authorized" => false,
        "message" => "Unable to load database configuration."
    ]);

    exit;
}


/*
|--------------------------------------------------------------------------
| ADMIN IDENTITY SETTINGS
|--------------------------------------------------------------------------
*/

$adminUserId = trim(
    (string)getenv("ADMIN_USER_ID")
);

$adminEmail = strtolower(
    trim((string)getenv("ADMIN_EMAIL"))
);


/*
|--------------------------------------------------------------------------
| FAIL CLOSED
|--------------------------------------------------------------------------
|
| At least one administrator identity must be configured.
|--------------------------------------------------------------------------
*/

if (
    $adminUserId === "" &&
    $adminEmail === ""
) {

    error_log(
        "Crown Cash security error: " .
        "ADMIN_USER_ID and ADMIN_EMAIL are not configured."
    );

    http_response_code(500);

    echo json_encode([
        "success" => false,
        "authenticated" => false,
        "authorized" => false,
        "message" => "Administrator identity is not configured."
    ]);

    exit;
}


/*
|--------------------------------------------------------------------------
| SESSION USER ID
|--------------------------------------------------------------------------
*/

$sessionUserId = trim(
    (string)$_SESSION["user_id"]
);

if ($sessionUserId === "") {

    http_response_code(401);

    echo json_encode([
        "success" => false,
        "authenticated" => false,
        "authorized" => false,
        "message" => "Administrator session is invalid."
    ]);

    exit;
}


/*
|--------------------------------------------------------------------------
| FIND USER
|--------------------------------------------------------------------------
|
| IMPORTANT:
|
| We support BOTH:
|
| MongoDB ObjectId:
|     ObjectId("...")
|
| and string:
|     "..."
|
| This prevents admin authentication from failing when the
| session stores the ID as a string.
|--------------------------------------------------------------------------
*/

try {

    $adminUser = null;

    /*
    |--------------------------------------------------------------------------
    | First attempt: MongoDB ObjectId
    |--------------------------------------------------------------------------
    */

    try {

        $sessionObjectId = new MongoDB\BSON\ObjectId(
            $sessionUserId
        );

        $adminUser = $users->findOne([
            "_id" => $sessionObjectId
        ]);

    } catch (Throwable $e) {

        /*
        | Invalid ObjectId.
        | We will try string ID below.
        */

        $adminUser = null;
    }


    /*
    |--------------------------------------------------------------------------
    | Second attempt: string ID
    |--------------------------------------------------------------------------
    */

    if (!$adminUser) {

        $adminUser = $users->findOne([
            "_id" => $sessionUserId
        ]);
    }


} catch (Throwable $e) {

    error_log(
        "Crown Cash admin user lookup failed: " .
        $e->getMessage()
    );

    http_response_code(500);

    echo json_encode([
        "success" => false,
        "authenticated" => true,
        "authorized" => false,
        "message" => "Unable to verify administrator account."
    ]);

    exit;
}


/*
|--------------------------------------------------------------------------
| ADMIN USER NOT FOUND
|--------------------------------------------------------------------------
*/

if (!$adminUser) {

    error_log(
        "Crown Cash admin account not found for session user ID: " .
        $sessionUserId
    );

    http_response_code(403);

    echo json_encode([
        "success" => false,
        "authenticated" => true,
        "authorized" => false,
        "message" => "Administrator account was not found."
    ]);

    exit;
}


/*
|--------------------------------------------------------------------------
| GET DATABASE USER ID AS STRING
|--------------------------------------------------------------------------
*/

$databaseUserId = "";

if (
    isset($adminUser["_id"]) &&
    $adminUser["_id"] instanceof MongoDB\BSON\ObjectId
) {

    $databaseUserId =
        (string)$adminUser["_id"];

} else {

    $databaseUserId =
        trim((string)($adminUser["_id"] ?? ""));
}


/*
|--------------------------------------------------------------------------
| ACCOUNT STATUS
|--------------------------------------------------------------------------
*/

$status = strtolower(
    trim((string)($adminUser["status"] ?? "active"))
);

$blockedStatuses = [
    "blocked",
    "suspended",
    "disabled",
    "banned",
    "inactive"
];

if (
    in_array(
        $status,
        $blockedStatuses,
        true
    )
) {

    $_SESSION = [];

    session_destroy();

    http_response_code(403);

    echo json_encode([
        "success" => false,
        "authenticated" => false,
        "authorized" => false,
        "message" => "Administrator account is not active."
    ]);

    exit;
}


/*
|--------------------------------------------------------------------------
| DATABASE ROLE
|--------------------------------------------------------------------------
*/

$databaseRole = strtolower(
    trim((string)($adminUser["role"] ?? ""))
);

$accountType = strtolower(
    trim((string)($adminUser["account_type"] ?? ""))
);


/*
|--------------------------------------------------------------------------
| REQUIRE ADMIN ROLE
|--------------------------------------------------------------------------
*/

if (
    $databaseRole !== "admin" &&
    $accountType !== "admin"
) {

    http_response_code(403);

    echo json_encode([
        "success" => false,
        "authenticated" => true,
        "authorized" => false,
        "message" => "Administrator access required."
    ]);

    exit;
}


/*
|--------------------------------------------------------------------------
| ADMIN USER ID AUTHORIZATION
|--------------------------------------------------------------------------
|
| If ADMIN_USER_ID exists, it is the strongest identity check.
|
| We compare the normalized database ID with the configured ID.
|--------------------------------------------------------------------------
*/

if ($adminUserId !== "") {

    if (
        $databaseUserId === "" ||
        $databaseUserId !== $adminUserId
    ) {

        error_log(
            "Crown Cash unauthorized admin ID attempt. " .
            "Session ID: " . $sessionUserId .
            " Database ID: " . $databaseUserId
        );

        http_response_code(403);

        echo json_encode([
            "success" => false,
            "authenticated" => true,
            "authorized" => false,
            "message" => "This account is not authorized to access the admin panel."
        ]);

        exit;
    }
}


/*
|--------------------------------------------------------------------------
| ADMIN EMAIL FALLBACK
|--------------------------------------------------------------------------
|
| Only used when ADMIN_USER_ID is not configured.
|--------------------------------------------------------------------------
*/

if (
    $adminUserId === "" &&
    $adminEmail !== ""
) {

    $databaseEmail = strtolower(
        trim((string)($adminUser["email"] ?? ""))
    );

    if (
        $databaseEmail === "" ||
        $databaseEmail !== $adminEmail
    ) {

        error_log(
            "Crown Cash unauthorized admin email attempt: " .
            $databaseEmail
        );

        http_response_code(403);

        echo json_encode([
            "success" => false,
            "authenticated" => true,
            "authorized" => false,
            "message" => "This account is not authorized to access the admin panel."
        ]);

        exit;
    }
}


/*
|--------------------------------------------------------------------------
| REFRESH ADMIN SESSION
|--------------------------------------------------------------------------
*/

$_SESSION["logged_in"] = true;

$_SESSION["user_id"] =
    $databaseUserId !== ""
        ? $databaseUserId
        : $sessionUserId;

$_SESSION["user_email"] =
    (string)($adminUser["email"] ?? "");

$_SESSION["role"] = "admin";

$_SESSION["account_type"] = "admin";


/*
|--------------------------------------------------------------------------
| SUCCESS
|--------------------------------------------------------------------------
|
| IMPORTANT:
| This file is designed to be INCLUDED by protected admin APIs.
|
| Therefore we do NOT output JSON success here.
|
| The protected PHP file continues executing.
|--------------------------------------------------------------------------
*/

return true;

?>