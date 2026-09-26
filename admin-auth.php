<?php

/*
|--------------------------------------------------------------------------
| Crown Cash - Administrator Authentication
|--------------------------------------------------------------------------
| This file can be called directly by JavaScript.
| It verifies the currently logged-in user against MongoDB
| and the configured ADMIN_USER_ID.
|--------------------------------------------------------------------------
*/


/*
|--------------------------------------------------------------------------
| CORS
|--------------------------------------------------------------------------
*/

header("Content-Type: application/json");

header(
    "Access-Control-Allow-Origin: https://crown-cash.vercel.app"
);

header("Access-Control-Allow-Credentials: true");

header(
    "Access-Control-Allow-Methods: GET, OPTIONS"
);

header(
    "Access-Control-Allow-Headers: Content-Type"
);


/*
|--------------------------------------------------------------------------
| Handle preflight
|--------------------------------------------------------------------------
*/

if ($_SERVER["REQUEST_METHOD"] === "OPTIONS") {

    http_response_code(204);

    exit;
}


/*
|--------------------------------------------------------------------------
| Session configuration
|--------------------------------------------------------------------------
*/

session_set_cookie_params([
    "lifetime" => 0,
    "path" => "/",
    "secure" => true,
    "httponly" => true,
    "samesite" => "None"
]);

session_start();


/*
|--------------------------------------------------------------------------
| JSON response helper
|--------------------------------------------------------------------------
*/

function adminResponse(
    bool $success,
    string $message,
    int $status = 200,
    array $extra = []
): void {

    http_response_code($status);

    echo json_encode(
        array_merge(
            [
                "success" => $success,
                "authenticated" => $success,
                "authorized" => $success,
                "message" => $message
            ],
            $extra
        )
    );

    exit;
}


/*
|--------------------------------------------------------------------------
| Request method
|--------------------------------------------------------------------------
*/

if ($_SERVER["REQUEST_METHOD"] !== "GET") {

    adminResponse(
        false,
        "Only GET requests are allowed.",
        405
    );
}


/*
|--------------------------------------------------------------------------
| Check login session
|--------------------------------------------------------------------------
*/

if (
    !isset($_SESSION["logged_in"]) ||
    $_SESSION["logged_in"] !== true ||
    !isset($_SESSION["user_id"]) ||
    trim((string)$_SESSION["user_id"]) === ""
) {

    adminResponse(
        false,
        "Administrator session has expired. Please login again.",
        401
    );
}


/*
|--------------------------------------------------------------------------
| Session timeout
|--------------------------------------------------------------------------
*/

$loginTime = isset($_SESSION["login_time"])
    ? (int)$_SESSION["login_time"]
    : 0;

$sessionLifetime = 7200; // 2 hours

if (
    $loginTime > 0 &&
    (time() - $loginTime) > $sessionLifetime
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

    adminResponse(
        false,
        "Administrator session has expired. Please login again.",
        401
    );
}


/*
|--------------------------------------------------------------------------
| Load database
|--------------------------------------------------------------------------
*/

try {

    require_once __DIR__ . "/config.php";

} catch (Throwable $e) {

    adminResponse(
        false,
        "Database configuration could not be loaded.",
        500
    );
}


/*
|--------------------------------------------------------------------------
| Verify required database collection
|--------------------------------------------------------------------------
*/

if (!isset($users)) {

    adminResponse(
        false,
        "Users collection is not available.",
        500
    );
}


/*
|--------------------------------------------------------------------------
| Get current session identity
|--------------------------------------------------------------------------
*/

$sessionUserId = trim(
    (string)$_SESSION["user_id"]
);

$sessionEmail = strtolower(
    trim((string)(
        $_SESSION["user_email"] ?? ""
    ))
);


/*
|--------------------------------------------------------------------------
| Find CURRENT logged-in user
|--------------------------------------------------------------------------
|
| IMPORTANT:
| We only authorize the user that is actually logged in.
| We do NOT substitute ADMIN_USER_ID for a missing session user.
|--------------------------------------------------------------------------
*/

$currentUser = null;


/*
|--------------------------------------------------------------------------
| Search by MongoDB ObjectId
|--------------------------------------------------------------------------
*/

try {

    $objectId = new MongoDB\BSON\ObjectId(
        $sessionUserId
    );

    $currentUser = $users->findOne([
        "_id" => $objectId
    ]);

} catch (Throwable $e) {

    // Continue with string lookup.
}


/*
|--------------------------------------------------------------------------
| Search by string ID
|--------------------------------------------------------------------------
*/

if (!$currentUser) {

    try {

        $currentUser = $users->findOne([
            "_id" => $sessionUserId
        ]);

    } catch (Throwable $e) {

        // Continue.
    }
}


/*
|--------------------------------------------------------------------------
| Search by session email only if necessary
|--------------------------------------------------------------------------
*/

if (
    !$currentUser &&
    $sessionEmail !== ""
) {

    $currentUser = $users->findOne([
        "email" => $sessionEmail
    ]);
}


/*
|--------------------------------------------------------------------------
| User not found
|--------------------------------------------------------------------------
*/

if (!$currentUser) {

    adminResponse(
        false,
        "The logged-in account could not be found.",
        403
    );
}


/*
|--------------------------------------------------------------------------
| Current user database ID
|--------------------------------------------------------------------------
*/

$currentUserId = isset($currentUser["_id"])
    ? (string)$currentUser["_id"]
    : "";


/*
|--------------------------------------------------------------------------
| Current user email
|--------------------------------------------------------------------------
*/

$currentUserEmail = strtolower(
    trim((string)(
        $currentUser["email"] ?? ""
    ))
);


/*
|--------------------------------------------------------------------------
| Account status
|--------------------------------------------------------------------------
*/

$status = strtolower(
    trim((string)(
        $currentUser["status"] ?? "active"
    ))
);

$blockedStatuses = [
    "blocked",
    "suspended",
    "disabled",
    "banned",
    "inactive"
];

if (in_array($status, $blockedStatuses, true)) {

    adminResponse(
        false,
        "Administrator account is not active.",
        403
    );
}


/*
|--------------------------------------------------------------------------
| Role
|--------------------------------------------------------------------------
*/

$role = strtolower(
    trim((string)(
        $currentUser["role"] ?? ""
    ))
);


/*
|--------------------------------------------------------------------------
| Account type
|--------------------------------------------------------------------------
*/

$accountType = strtolower(
    trim((string)(
        $currentUser["account_type"] ?? ""
    ))
);


$isAdmin = (
    $role === "admin" ||
    $role === "administrator" ||
    $accountType === "admin" ||
    $accountType === "administrator"
);


if (!$isAdmin) {

    adminResponse(
        false,
        "This account does not have administrator privileges.",
        403
    );
}


/*
|--------------------------------------------------------------------------
| Verify configured administrator identity
|--------------------------------------------------------------------------
*/

$configuredAdminId = trim(
    (string)(getenv("ADMIN_USER_ID") ?: "")
);

$configuredAdminEmail = strtolower(
    trim((string)(getenv("ADMIN_EMAIL") ?: ""))
);


/*
|--------------------------------------------------------------------------
| Require at least one administrator identity
|--------------------------------------------------------------------------
*/

if (
    $configuredAdminId === "" &&
    $configuredAdminEmail === ""
) {

    adminResponse(
        false,
        "Administrator identity is not configured on the server.",
        500
    );
}


/*
|--------------------------------------------------------------------------
| Identity authorization
|--------------------------------------------------------------------------
*/

$identityAuthorized = false;


/*
|--------------------------------------------------------------------------
| Match ADMIN_USER_ID
|--------------------------------------------------------------------------
*/

if (
    $configuredAdminId !== "" &&
    $currentUserId !== "" &&
    hash_equals(
        $configuredAdminId,
        $currentUserId
    )
) {

    $identityAuthorized = true;
}


/*
|--------------------------------------------------------------------------
| Match ADMIN_EMAIL
|--------------------------------------------------------------------------
*/

if (
    !$identityAuthorized &&
    $configuredAdminEmail !== "" &&
    $currentUserEmail !== "" &&
    hash_equals(
        $configuredAdminEmail,
        $currentUserEmail
    )
) {

    $identityAuthorized = true;
}


/*
|--------------------------------------------------------------------------
| Reject unauthorized administrator
|--------------------------------------------------------------------------
*/

if (!$identityAuthorized) {

    adminResponse(
        false,
        "This administrator account is not authorized.",
        403
    );
}


/*
|--------------------------------------------------------------------------
| Refresh trusted session information
|--------------------------------------------------------------------------
*/

$_SESSION["logged_in"] = true;

$_SESSION["user_id"] = $currentUserId;

$_SESSION["user_email"] = $currentUserEmail;

$_SESSION["role"] = $role;

$_SESSION["account_type"] = $accountType;

$_SESSION["login_time"] = time();


/*
|--------------------------------------------------------------------------
| Success
|--------------------------------------------------------------------------
*/

adminResponse(
    true,
    "Administrator access confirmed.",
    200,
    [
        "admin" => [
            "id" => $currentUserId,
            "email" => $currentUserEmail,
            "name" => (string)(
                $currentUser["full_name"] ?? ""
            ),
            "role" => $role,
            "account_type" => $accountType,
            "status" => $status
        ]
    ]
);

?>