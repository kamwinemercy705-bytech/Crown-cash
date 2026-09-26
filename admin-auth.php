<?php

declare(strict_types=1);

/*
|--------------------------------------------------------------------------
| CROWN CASH — ADMIN AUTHENTICATION
|--------------------------------------------------------------------------
|
| Supports:
| - ObjectId MongoDB user IDs
| - String user IDs
| - ADMIN_USER_ID
| - ADMIN_EMAIL
| - Direct browser/API verification
| - Inclusion by other admin PHP APIs
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
| SESSION
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
| JSON RESPONSE
|--------------------------------------------------------------------------
*/

function adminJson(
    bool $success,
    bool $authenticated,
    bool $authorized,
    string $message,
    int $status = 200,
    array $extra = []
): void {

    http_response_code($status);

    echo json_encode(
        array_merge(
            [
                "success" => $success,
                "authenticated" => $authenticated,
                "authorized" => $authorized,
                "message" => $message
            ],
            $extra
        )
    );

    exit;
}


/*
|--------------------------------------------------------------------------
| LOGIN CHECK
|--------------------------------------------------------------------------
*/

if (
    !isset($_SESSION["logged_in"]) ||
    $_SESSION["logged_in"] !== true
) {

    adminJson(
        false,
        false,
        false,
        "Administrator login required.",
        401
    );
}


if (
    !isset($_SESSION["user_id"]) ||
    trim((string)$_SESSION["user_id"]) === ""
) {

    adminJson(
        false,
        false,
        false,
        "Administrator session is invalid.",
        401
    );
}


/*
|--------------------------------------------------------------------------
| SESSION TIMEOUT
|--------------------------------------------------------------------------
*/

$adminSessionTimeout = 2 * 60 * 60;

if (
    isset($_SESSION["login_time"]) &&
    (time() - (int)$_SESSION["login_time"]) >
    $adminSessionTimeout
) {

    $_SESSION = [];

    session_destroy();

    adminJson(
        false,
        false,
        false,
        "Admin session expired. Please login again.",
        401
    );
}


/*
|--------------------------------------------------------------------------
| DATABASE
|--------------------------------------------------------------------------
*/

try {

    require_once __DIR__ . "/config.php";

} catch (Throwable $e) {

    error_log(
        "Crown Cash admin config error: " .
        $e->getMessage()
    );

    adminJson(
        false,
        true,
        false,
        "Unable to load database configuration.",
        500
    );
}


/*
|--------------------------------------------------------------------------
| ENVIRONMENT ADMIN SETTINGS
|--------------------------------------------------------------------------
*/

$adminUserId = trim(
    (string)getenv("ADMIN_USER_ID")
);

$adminEmail = strtolower(
    trim((string)getenv("ADMIN_EMAIL"))
);


if (
    $adminUserId === "" &&
    $adminEmail === ""
) {

    error_log(
        "Crown Cash security error: " .
        "ADMIN_USER_ID and ADMIN_EMAIL are missing."
    );

    adminJson(
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


/*
|--------------------------------------------------------------------------
| FIND ADMINISTRATOR
|--------------------------------------------------------------------------
|
| IMPORTANT:
|
| We try the session ID first.
|
| If that fails, we try ADMIN_USER_ID.
|
| This allows the admin login/session to continue working even if
| the session contains a string representation while MongoDB stores
| the actual ID as ObjectId.
|--------------------------------------------------------------------------
*/

$adminUser = null;


/*
|--------------------------------------------------------------------------
| 1. FIND USING SESSION USER ID AS OBJECTID
|--------------------------------------------------------------------------
*/

try {

    $sessionObjectId =
        new MongoDB\BSON\ObjectId(
            $sessionUserId
        );

    $adminUser =
        $users->findOne([
            "_id" => $sessionObjectId
        ]);

} catch (Throwable $e) {

    $adminUser = null;
}


/*
|--------------------------------------------------------------------------
| 2. FIND USING SESSION USER ID AS STRING
|--------------------------------------------------------------------------
*/

if (!$adminUser) {

    try {

        $adminUser =
            $users->findOne([
                "_id" => $sessionUserId
            ]);

    } catch (Throwable $e) {

        $adminUser = null;
    }
}


/*
|--------------------------------------------------------------------------
| 3. FIND USING ADMIN_USER_ID AS OBJECTID
|--------------------------------------------------------------------------
*/

if (
    !$adminUser &&
    $adminUserId !== ""
) {

    try {

        $configuredObjectId =
            new MongoDB\BSON\ObjectId(
                $adminUserId
            );

        $adminUser =
            $users->findOne([
                "_id" => $configuredObjectId
            ]);

    } catch (Throwable $e) {

        $adminUser = null;
    }
}


/*
|--------------------------------------------------------------------------
| 4. FIND USING ADMIN_USER_ID AS STRING
|--------------------------------------------------------------------------
*/

if (
    !$adminUser &&
    $adminUserId !== ""
) {

    try {

        $adminUser =
            $users->findOne([
                "_id" => $adminUserId
            ]);

    } catch (Throwable $e) {

        $adminUser = null;
    }
}


/*
|--------------------------------------------------------------------------
| 5. LAST FALLBACK — ADMIN EMAIL
|--------------------------------------------------------------------------
*/

if (
    !$adminUser &&
    $adminEmail !== ""
) {

    try {

        $adminUser =
            $users->findOne([
                "email" => $adminEmail
            ]);

    } catch (Throwable $e) {

        $adminUser = null;
    }
}


/*
|--------------------------------------------------------------------------
| USER STILL NOT FOUND
|--------------------------------------------------------------------------
*/

if (!$adminUser) {

    error_log(
        "Crown Cash admin user lookup failed. " .
        "Session ID: " . $sessionUserId .
        " | ADMIN_USER_ID: " . $adminUserId .
        " | ADMIN_EMAIL: " . $adminEmail
    );

    adminJson(
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
            (string)(
                $adminUser["_id"] ?? ""
            )
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

    adminJson(
        false,
        false,
        false,
        "Administrator account is not active.",
        403
    );
}


/*
|--------------------------------------------------------------------------
| ROLE
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
| ADMIN ROLE REQUIRED
|--------------------------------------------------------------------------
*/

if (
    $databaseRole !== "admin" &&
    $accountType !== "admin"
) {

    adminJson(
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
|
| If ADMIN_USER_ID is configured, the actual database user must
| match it.
|--------------------------------------------------------------------------
*/

if ($adminUserId !== "") {

    if (
        $databaseUserId !== $adminUserId
    ) {

        error_log(
            "Crown Cash admin ID mismatch. " .
            "Database ID: " .
            $databaseUserId .
            " | Configured ID: " .
            $adminUserId
        );

        adminJson(
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
| ADMIN EMAIL CHECK
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

        adminJson(
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
| REFRESH SESSION
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
| SUCCESS RESPONSE
|--------------------------------------------------------------------------
*/

adminJson(
    true,
    true,
    true,
    "Administrator access confirmed.",
    200,
    [
        "admin" => [
            "id" => $databaseUserId,

            "full_name" =>
                (string)(
                    $adminUser["full_name"] ??
                    $adminUser["name"] ??
                    ""
                ),

            "email" =>
                (string)(
                    $adminUser["email"] ??
                    ""
                ),

            "role" => "admin",

            "account_type" => "admin"
        ]
    ]
);

?>