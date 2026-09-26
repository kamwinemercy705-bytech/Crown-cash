<?php

declare(strict_types=1);

/*
|--------------------------------------------------------------------------
| Crown Cash - Administrator Authentication
|--------------------------------------------------------------------------
|
| This file works in TWO ways:
|
| 1. Direct request:
|      /admin-auth.php
|
|    Returns JSON for JavaScript administrator verification.
|
| 2. Included by another protected PHP API:
|      require_once __DIR__ . "/admin-auth.php";
|
|    Performs authentication and allows the parent API to continue.
|
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
| HELPER: JSON RESPONSE
|--------------------------------------------------------------------------
*/

function adminAuthResponse(
    bool $success,
    bool $authenticated,
    bool $authorized,
    string $message,
    int $statusCode = 200
): void {

    http_response_code($statusCode);

    echo json_encode([
        "success" => $success,
        "authenticated" => $authenticated,
        "authorized" => $authorized,
        "message" => $message
    ]);

    exit;
}


/*
|--------------------------------------------------------------------------
| DETERMINE WHETHER THIS FILE WAS CALLED DIRECTLY
|--------------------------------------------------------------------------
*/

$isDirectRequest = false;

try {

    $currentScript = basename(
        (string)($_SERVER["SCRIPT_FILENAME"] ?? "")
    );

    $thisScript = basename(__FILE__);

    $isDirectRequest =
        $currentScript === $thisScript;

} catch (Throwable $e) {

    $isDirectRequest = false;
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

    adminAuthResponse(
        false,
        false,
        false,
        "Administrator login required.",
        401
    );
}


/*
|--------------------------------------------------------------------------
| ADMIN SESSION TIMEOUT
|--------------------------------------------------------------------------
*/

$adminSessionTimeout = 2 * 60 * 60;

if (
    isset($_SESSION["login_time"]) &&
    (time() - (int)$_SESSION["login_time"]) >
    $adminSessionTimeout
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

    adminAuthResponse(
        false,
        false,
        false,
        "Admin session expired. Please login again.",
        401
    );
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
        "Crown Cash admin config error: " .
        $e->getMessage()
    );

    adminAuthResponse(
        false,
        true,
        false,
        "Unable to load database configuration.",
        500
    );
}


/*
|--------------------------------------------------------------------------
| ADMIN IDENTITY CONFIGURATION
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
*/

if (
    $adminUserId === "" &&
    $adminEmail === ""
) {

    error_log(
        "Crown Cash security error: " .
        "ADMIN_USER_ID and ADMIN_EMAIL are not configured."
    );

    adminAuthResponse(
        false,
        true,
        false,
        "Administrator identity is not configured.",
        500
    );
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

    adminAuthResponse(
        false,
        false,
        false,
        "Administrator session is invalid.",
        401
    );
}


/*
|--------------------------------------------------------------------------
| FIND CURRENT USER
|--------------------------------------------------------------------------
|
| Supports both:
|
| MongoDB ObjectId
| AND
| String _id
|
|--------------------------------------------------------------------------
*/

try {

    $adminUser = null;


    /*
    |--------------------------------------------------------------------------
    | TRY OBJECTID
    |--------------------------------------------------------------------------
    */

    try {

        $sessionObjectId =
            new MongoDB\BSON\ObjectId(
                $sessionUserId
            );

        $adminUser = $users->findOne([
            "_id" => $sessionObjectId
        ]);

    } catch (Throwable $e) {

        $adminUser = null;
    }


    /*
    |--------------------------------------------------------------------------
    | TRY STRING ID
    |--------------------------------------------------------------------------
    */

    if (!$adminUser) {

        $adminUser = $users->findOne([
            "_id" => $sessionUserId
        ]);
    }


} catch (Throwable $e) {

    error_log(
        "Crown Cash admin user lookup error: " .
        $e->getMessage()
    );

    adminAuthResponse(
        false,
        true,
        false,
        "Unable to verify administrator account.",
        500
    );
}


/*
|--------------------------------------------------------------------------
| USER NOT FOUND
|--------------------------------------------------------------------------
*/

if (!$adminUser) {

    error_log(
        "Crown Cash administrator account not found. " .
        "Session user ID: " .
        $sessionUserId
    );

    adminAuthResponse(
        false,
        true,
        false,
        "Administrator account was not found.",
        403
    );
}


/*
|--------------------------------------------------------------------------
| DATABASE USER ID
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
        trim(
            (string)($adminUser["_id"] ?? "")
        );
}


/*
|--------------------------------------------------------------------------
| ACCOUNT STATUS
|--------------------------------------------------------------------------
*/

$status = strtolower(
    trim(
        (string)(
            $adminUser["status"] ??
            "active"
        )
    )
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

    adminAuthResponse(
        false,
        false,
        false,
        "Administrator account is not active.",
        403
    );
}


/*
|--------------------------------------------------------------------------
| DATABASE ROLE
|--------------------------------------------------------------------------
*/

$databaseRole = strtolower(
    trim(
        (string)(
            $adminUser["role"] ?? ""
        )
    )
);

$accountType = strtolower(
    trim(
        (string)(
            $adminUser["account_type"] ?? ""
        )
    )
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

    adminAuthResponse(
        false,
        true,
        false,
        "Administrator access required.",
        403
    );
}


/*
|--------------------------------------------------------------------------
| ADMIN USER ID CHECK
|--------------------------------------------------------------------------
*/

if ($adminUserId !== "") {

    if (
        $databaseUserId === "" ||
        $databaseUserId !== $adminUserId
    ) {

        error_log(
            "Crown Cash unauthorized admin ID attempt. " .
            "Session ID: " .
            $sessionUserId .
            " Database ID: " .
            $databaseUserId
        );

        adminAuthResponse(
            false,
            true,
            false,
            "This account is not authorized to access the admin panel.",
            403
        );
    }
}


/*
|--------------------------------------------------------------------------
| ADMIN EMAIL FALLBACK
|--------------------------------------------------------------------------
*/

if (
    $adminUserId === "" &&
    $adminEmail !== ""
) {

    $databaseEmail = strtolower(
        trim(
            (string)(
                $adminUser["email"] ?? ""
            )
        )
    );

    if (
        $databaseEmail === "" ||
        $databaseEmail !== $adminEmail
    ) {

        error_log(
            "Crown Cash unauthorized admin email attempt: " .
            $databaseEmail
        );

        adminAuthResponse(
            false,
            true,
            false,
            "This account is not authorized to access the admin panel.",
            403
        );
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
    (string)(
        $adminUser["email"] ?? ""
    );

$_SESSION["role"] = "admin";

$_SESSION["account_type"] = "admin";


/*
|--------------------------------------------------------------------------
| DIRECT ADMIN-AUTH REQUEST
|--------------------------------------------------------------------------
|
| The JavaScript admin pages call:
|
|     /admin-auth.php
|
| Therefore this direct request MUST return JSON.
|--------------------------------------------------------------------------
*/

if ($isDirectRequest) {

    echo json_encode([
        "success" => true,
        "authenticated" => true,
        "authorized" => true,
        "message" => "Administrator access confirmed.",
        "admin" => [
            "id" => $databaseUserId,
            "name" => (string)(
                $adminUser["full_name"] ??
                $adminUser["name"] ??
                ""
            ),
            "email" => (string)(
                $adminUser["email"] ??
                ""
            ),
            "role" => "admin",
            "account_type" => "admin"
        ]
    ]);

    exit;
}


/*
|--------------------------------------------------------------------------
| INCLUDED BY ANOTHER PHP FILE
|--------------------------------------------------------------------------
|
| Do not output anything here.
|
| The protected PHP file continues executing.
|--------------------------------------------------------------------------
*/

return true;

?>