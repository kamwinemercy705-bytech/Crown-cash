<?php

declare(strict_types=1);

/*
|--------------------------------------------------------------------------
| Crown Cash - Admin Authentication
|--------------------------------------------------------------------------
| This file protects ALL admin API endpoints.
|
| The administrator must be:
| 1. Logged in
| 2. An active account
| 3. Have role = admin
| 4. Match ADMIN_USER_ID or ADMIN_EMAIL configured in Render
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
| CORS preflight
|--------------------------------------------------------------------------
*/

if ($_SERVER["REQUEST_METHOD"] === "OPTIONS") {
    http_response_code(204);
    exit;
}


/*
|--------------------------------------------------------------------------
| Secure cross-site session
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
| Login check
|--------------------------------------------------------------------------
*/

if (
    !isset($_SESSION["logged_in"]) ||
    $_SESSION["logged_in"] !== true ||
    !isset($_SESSION["user_id"])
) {
    http_response_code(401);

    echo json_encode([
        "success" => false,
        "message" => "Administrator login required."
    ]);

    exit;
}


/*
|--------------------------------------------------------------------------
| Admin session timeout
|--------------------------------------------------------------------------
*/

$adminSessionTimeout = 2 * 60 * 60; // 2 hours

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
        "message" => "Admin session expired. Please login again."
    ]);

    exit;
}


/*
|--------------------------------------------------------------------------
| Load MongoDB configuration
|--------------------------------------------------------------------------
*/

require_once __DIR__ . "/config.php";


/*
|--------------------------------------------------------------------------
| Read administrator identity from Render environment variables
|--------------------------------------------------------------------------
|
| Recommended:
|
| ADMIN_USER_ID = your MongoDB user _id
|
| Optional fallback:
|
| ADMIN_EMAIL = your administrator email
|
| ADMIN_USER_ID is preferred because it is tied to the actual
| database account rather than an email address.
|--------------------------------------------------------------------------
*/

$adminUserId = trim((string)getenv("ADMIN_USER_ID"));

$adminEmail = strtolower(
    trim((string)getenv("ADMIN_EMAIL"))
);


/*
|--------------------------------------------------------------------------
| Fail closed if administrator identity has not been configured
|--------------------------------------------------------------------------
*/

if ($adminUserId === "" && $adminEmail === "") {

    error_log(
        "Crown Cash security error: ADMIN_USER_ID and ADMIN_EMAIL are not configured."
    );

    http_response_code(500);

    echo json_encode([
        "success" => false,
        "message" => "Administrator identity is not configured."
    ]);

    exit;
}


/*
|--------------------------------------------------------------------------
| Validate session user ID
|--------------------------------------------------------------------------
*/

$sessionUserId = (string)$_SESSION["user_id"];

try {

    $sessionObjectId = new MongoDB\BSON\ObjectId(
        $sessionUserId
    );

} catch (Throwable $e) {

    error_log(
        "Invalid admin session user ID: " . $sessionUserId
    );

    http_response_code(403);

    echo json_encode([
        "success" => false,
        "message" => "Administrator authorization failed."
    ]);

    exit;
}


/*
|--------------------------------------------------------------------------
| Find the CURRENT user in MongoDB
|--------------------------------------------------------------------------
|
| We do not rely only on the session role.
|
| This means that if an administrator is changed to a normal user
| in MongoDB, the admin panel immediately becomes inaccessible.
|--------------------------------------------------------------------------
*/

try {

    $adminUser = $users->findOne([
        "_id" => $sessionObjectId
    ]);

} catch (Throwable $e) {

    error_log(
        "Admin authentication database error: " .
        $e->getMessage()
    );

    http_response_code(500);

    echo json_encode([
        "success" => false,
        "message" => "Unable to verify administrator account."
    ]);

    exit;
}


/*
|--------------------------------------------------------------------------
| User must exist
|--------------------------------------------------------------------------
*/

if (!$adminUser) {

    http_response_code(403);

    echo json_encode([
        "success" => false,
        "message" => "Administrator account was not found."
    ]);

    exit;
}


/*
|--------------------------------------------------------------------------
| Account status check
|--------------------------------------------------------------------------
*/

$status = strtolower(
    trim((string)($adminUser["status"] ?? ""))
);

$blockedStatuses = [
    "blocked",
    "suspended",
    "disabled",
    "banned",
    "inactive"
];

if (in_array($status, $blockedStatuses, true)) {

    $_SESSION = [];

    session_destroy();

    http_response_code(403);

    echo json_encode([
        "success" => false,
        "message" => "Administrator account is not active."
    ]);

    exit;
}


/*
|--------------------------------------------------------------------------
| Check database role
|--------------------------------------------------------------------------
*/

$databaseRole = strtolower(
    trim((string)($adminUser["role"] ?? ""))
);

$accountType = strtolower(
    trim((string)($adminUser["account_type"] ?? ""))
);

if (
    $databaseRole !== "admin" &&
    $accountType !== "admin"
) {

    http_response_code(403);

    echo json_encode([
        "success" => false,
        "message" => "Administrator access required."
    ]);

    exit;
}


/*
|--------------------------------------------------------------------------
| EXACT ADMINISTRATOR IDENTITY CHECK
|--------------------------------------------------------------------------
|
| If ADMIN_USER_ID is configured, it takes priority.
|--------------------------------------------------------------------------
*/

if ($adminUserId !== "") {

    if ($sessionUserId !== $adminUserId) {

        error_log(
            "Unauthorized admin access attempt. User ID: " .
            $sessionUserId
        );

        http_response_code(403);

        echo json_encode([
            "success" => false,
            "message" => "This account is not authorized to access the admin panel."
        ]);

        exit;
    }
}


/*
|--------------------------------------------------------------------------
| ADMIN EMAIL CHECK
|--------------------------------------------------------------------------
|
| This is used when ADMIN_USER_ID is not configured.
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
            "Unauthorized admin email attempt: " .
            $databaseEmail
        );

        http_response_code(403);

        echo json_encode([
            "success" => false,
            "message" => "This account is not authorized to access the admin panel."
        ]);

        exit;
    }
}


/*
|--------------------------------------------------------------------------
| Refresh admin session information
|--------------------------------------------------------------------------
*/

$_SESSION["logged_in"] = true;

$_SESSION["user_id"] = (string)$adminUser["_id"];

$_SESSION["user_email"] =
    (string)($adminUser["email"] ?? "");

$_SESSION["role"] = "admin";

$_SESSION["account_type"] = "admin";


/*
|--------------------------------------------------------------------------
| Admin authentication successful
|--------------------------------------------------------------------------
|
| IMPORTANT:
| This file does not echo success here because it is included by
| other protected PHP files.
|
| The protected file continues executing.
|--------------------------------------------------------------------------
*/

?>