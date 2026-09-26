<?php

declare(strict_types=1);

/*
|--------------------------------------------------------------------------
| CROWN CASH — ADMIN AUTHENTICATION
| admin-auth.php
|--------------------------------------------------------------------------
|
| This file has TWO purposes:
|
| 1. Direct request from frontend:
|    /admin-auth.php
|
|    Returns JSON:
|    {
|        "success": true,
|        "authenticated": true,
|        "authorized": true
|    }
|
| 2. Included by protected admin PHP APIs:
|    require_once __DIR__ . "/admin-auth.php";
|
|    In that case, successful authentication simply allows the
|    protected PHP file to continue executing.
|
|--------------------------------------------------------------------------
*/


/* =========================================================
   ERROR CONFIGURATION
   ========================================================= */

error_reporting(E_ALL);

ini_set(
    "display_errors",
    "0"
);


/* =========================================================
   RESPONSE HEADERS
   ========================================================= */

header(
    "Content-Type: application/json; charset=UTF-8"
);

header(
    "Access-Control-Allow-Origin: https://crown-cash.vercel.app"
);

header(
    "Access-Control-Allow-Credentials: true"
);

header(
    "Access-Control-Allow-Methods: GET, POST, OPTIONS"
);

header(
    "Access-Control-Allow-Headers: Content-Type, Accept"
);

header(
    "Cache-Control: no-store, no-cache, must-revalidate, max-age=0"
);

header(
    "Pragma: no-cache"
);


/* =========================================================
   DETECT DIRECT REQUEST
   =========================================================
   
   When JavaScript opens:
   
   /admin-auth.php
   
   we return JSON.

   When another PHP file includes this file:
   
   require_once __DIR__ . "/admin-auth.php";
   
   we do NOT output the success JSON because the parent
   PHP file needs to continue running.
   
========================================================= */

$requestPath = parse_url(
    $_SERVER["REQUEST_URI"] ?? "",
    PHP_URL_PATH
);

$requestFile = basename(
    (string)$requestPath
);

$isDirectRequest = (
    strtolower($requestFile) === "admin-auth.php"
);


/* =========================================================
   JSON RESPONSE FUNCTION
   ========================================================= */

function adminAuthJson(
    bool $success,
    bool $authenticated,
    bool $authorized,
    string $message,
    int $statusCode = 200
): void {

    http_response_code(
        $statusCode
    );

    echo json_encode([
        "success" => $success,
        "authenticated" => $authenticated,
        "authorized" => $authorized,
        "message" => $message
    ]);

    exit;
}


/* =========================================================
   CORS PREFLIGHT
   ========================================================= */

if (
    ($_SERVER["REQUEST_METHOD"] ?? "GET") === "OPTIONS"
) {

    http_response_code(204);

    exit;
}


/* =========================================================
   ALLOWED REQUEST METHOD
   ========================================================= */

$requestMethod =
    strtoupper(
        $_SERVER["REQUEST_METHOD"] ?? "GET"
    );


if (
    $isDirectRequest &&
    $requestMethod !== "GET"
) {

    adminAuthJson(
        false,
        false,
        false,
        "Method not allowed.",
        405
    );
}


/* =========================================================
   SECURE CROSS-SITE SESSION
   ========================================================= */

session_set_cookie_params([
    "lifetime" => 0,
    "path" => "/",
    "secure" => true,
    "httponly" => true,
    "samesite" => "None"
]);


if (
    session_status() !== PHP_SESSION_ACTIVE
) {

    session_start();
}


/* =========================================================
   LOGIN CHECK
   ========================================================= */

if (
    !isset($_SESSION["logged_in"]) ||
    $_SESSION["logged_in"] !== true
) {

    if ($isDirectRequest) {

        adminAuthJson(
            false,
            false,
            false,
            "Administrator login required.",
            401
        );
    }

    http_response_code(401);

    echo json_encode([
        "success" => false,
        "message" => "Administrator login required."
    ]);

    exit;
}


if (
    !isset($_SESSION["user_id"]) ||
    trim(
        (string)$_SESSION["user_id"]
    ) === ""
) {

    if ($isDirectRequest) {

        adminAuthJson(
            false,
            false,
            false,
            "Administrator session is missing the user ID.",
            401
        );
    }

    http_response_code(401);

    echo json_encode([
        "success" => false,
        "message" => "Administrator session is invalid."
    ]);

    exit;
}


/* =========================================================
   ADMIN SESSION TIMEOUT
   ========================================================= */

$adminSessionTimeout =
    2 * 60 * 60;


/*
|--------------------------------------------------------------------------
| If login_time exists, enforce two-hour timeout.
|--------------------------------------------------------------------------
*/

if (
    isset($_SESSION["login_time"])
) {

    $loginTime =
        (int)$_SESSION["login_time"];


    if (
        $loginTime > 0 &&
        (
            time() -
            $loginTime
        ) > $adminSessionTimeout
    ) {

        $_SESSION = [];


        if (
            ini_get("session.use_cookies")
        ) {

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


        if ($isDirectRequest) {

            adminAuthJson(
                false,
                false,
                false,
                "Admin session expired. Please login again.",
                401
            );
        }


        http_response_code(401);

        echo json_encode([
            "success" => false,
            "message" => "Admin session expired."
        ]);

        exit;
    }
}


/* =========================================================
   LOAD MONGODB CONFIGURATION
   ========================================================= */

try {

    require_once __DIR__ . "/config.php";

} catch (Throwable $e) {

    error_log(
        "Crown Cash admin authentication config error: " .
        $e->getMessage()
    );


    if ($isDirectRequest) {

        adminAuthJson(
            false,
            true,
            false,
            "Unable to connect to the administrator verification service.",
            500
        );
    }


    http_response_code(500);

    echo json_encode([
        "success" => false,
        "message" => "Administrator verification service error."
    ]);

    exit;
}


/* =========================================================
   VERIFY USERS COLLECTION
   ========================================================= */

if (
    !isset($users)
) {

    error_log(
        "Crown Cash admin authentication error: users collection unavailable."
    );


    if ($isDirectRequest) {

        adminAuthJson(
            false,
            true,
            false,
            "Administrator verification service is not configured correctly.",
            500
        );
    }


    http_response_code(500);

    echo json_encode([
        "success" => false,
        "message" => "Administrator verification service error."
    ]);

    exit;
}


/* =========================================================
   ADMIN ID FROM RENDER
   ========================================================= */

$adminUserId =
    trim(
        (string)(
            getenv("ADMIN_USER_ID") ?: ""
        )
    );


/* =========================================================
   ADMIN EMAIL FROM RENDER
   ========================================================= */

$adminEmail =
    strtolower(
        trim(
            (string)(
                getenv("ADMIN_EMAIL") ?: ""
            )
        )
    );


/* =========================================================
   FAIL CLOSED
   ========================================================= */

if (
    $adminUserId === "" &&
    $adminEmail === ""
) {

    error_log(
        "Crown Cash security error: " .
        "ADMIN_USER_ID and ADMIN_EMAIL are not configured."
    );


    if ($isDirectRequest) {

        adminAuthJson(
            false,
            true,
            false,
            "Administrator identity is not configured.",
            500
        );
    }


    http_response_code(500);

    echo json_encode([
        "success" => false,
        "message" => "Administrator identity is not configured."
    ]);

    exit;
}


/* =========================================================
   SESSION USER ID
   ========================================================= */

$sessionUserId =
    trim(
        (string)$_SESSION["user_id"]
    );


if (
    $sessionUserId === ""
) {

    if ($isDirectRequest) {

        adminAuthJson(
            false,
            false,
            false,
            "Invalid administrator session.",
            401
        );
    }


    http_response_code(401);

    echo json_encode([
        "success" => false,
        "message" => "Invalid administrator session."
    ]);

    exit;
}


/* =========================================================
   FIND CURRENT USER
   ========================================================= */

$adminUser = null;


/*
|--------------------------------------------------------------------------
| First try ObjectId.
|--------------------------------------------------------------------------
*/

try {

    if (
        preg_match(
            '/^[a-fA-F0-9]{24}$/',
            $sessionUserId
        )
    ) {

        $sessionObjectId =
            new MongoDB\BSON\ObjectId(
                $sessionUserId
            );


        $adminUser =
            $users->findOne([
                "_id" => $sessionObjectId
            ]);
    }

} catch (Throwable $e) {

    error_log(
        "Crown Cash admin ObjectId lookup error: " .
        $e->getMessage()
    );
}


/*
|--------------------------------------------------------------------------
| Fallback to string _id.
|--------------------------------------------------------------------------
*/

if (
    !$adminUser
) {

    try {

        $adminUser =
            $users->findOne([
                "_id" => $sessionUserId
            ]);

    } catch (Throwable $e) {

        error_log(
            "Crown Cash admin string ID lookup error: " .
            $e->getMessage()
        );
    }
}


/*
|--------------------------------------------------------------------------
| Fallback to user_id field.
|--------------------------------------------------------------------------
*/

if (
    !$adminUser
) {

    try {

        $adminUser =
            $users->findOne([
                "user_id" => $sessionUserId
            ]);

    } catch (Throwable $e) {

        error_log(
            "Crown Cash admin user_id lookup error: " .
            $e->getMessage()
        );
    }
}


/* =========================================================
   USER MUST EXIST
   ========================================================= */

if (
    !$adminUser
) {

    if ($isDirectRequest) {

        adminAuthJson(
            false,
            true,
            false,
            "Administrator account was not found.",
            403
        );
    }


    http_response_code(403);

    echo json_encode([
        "success" => false,
        "message" => "Administrator account was not found."
    ]);

    exit;
}


/* =========================================================
   ACCOUNT STATUS
   ========================================================= */

$status =
    strtolower(
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
    "inactive",
    "deactivated"
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


    if ($isDirectRequest) {

        adminAuthJson(
            false,
            true,
            false,
            "Administrator account is not active.",
            403
        );
    }


    http_response_code(403);

    echo json_encode([
        "success" => false,
        "message" => "Administrator account is not active."
    ]);

    exit;
}


/* =========================================================
   DATABASE ROLE
   ========================================================= */

$databaseRole =
    strtolower(
        trim(
            (string)(
                $adminUser["role"] ??
                ""
            )
        )
    );


/* =========================================================
   ACCOUNT TYPE
   ========================================================= */

$accountType =
    strtolower(
        trim(
            (string)(
                $adminUser["account_type"] ??
                $adminUser["accountType"] ??
                ""
            )
        )
    );


/* =========================================================
   ADMIN ROLE CHECK
   ========================================================= */

$isAdmin =
    (
        $databaseRole === "admin" ||
        $databaseRole === "administrator" ||
        $accountType === "admin" ||
        $accountType === "administrator"
    );


if (
    !$isAdmin
) {

    if ($isDirectRequest) {

        adminAuthJson(
            false,
            true,
            false,
            "Administrator access required.",
            403
        );
    }


    http_response_code(403);

    echo json_encode([
        "success" => false,
        "message" => "Administrator access required."
    ]);

    exit;
}


/* =========================================================
   EXACT ADMIN USER ID CHECK
   ========================================================= */

if (
    $adminUserId !== ""
) {

    $databaseUserId =
        isset($adminUser["_id"])
            ? (string)$adminUser["_id"]
            : "";


    if (
        strcasecmp(
            $databaseUserId,
            $adminUserId
        ) !== 0
    ) {

        error_log(
            "Crown Cash unauthorized admin access attempt. " .
            "Session user ID: " .
            $sessionUserId
        );


        if ($isDirectRequest) {

            adminAuthJson(
                false,
                true,
                false,
                "This account is not authorized to access the admin panel.",
                403
            );
        }


        http_response_code(403);

        echo json_encode([
            "success" => false,
            "message" => "This account is not authorized to access the admin panel."
        ]);

        exit;
    }
}


/* =========================================================
   ADMIN EMAIL CHECK
   ========================================================= */

if (
    $adminUserId === "" &&
    $adminEmail !== ""
) {

    $databaseEmail =
        strtolower(
            trim(
                (string)(
                    $adminUser["email"] ??
                    ""
                )
            )
        );


    if (
        $databaseEmail === "" ||
        $databaseEmail !== $adminEmail
    ) {

        error_log(
            "Crown Cash unauthorized administrator email attempt."
        );


        if ($isDirectRequest) {

            adminAuthJson(
                false,
                true,
                false,
                "This account is not authorized to access the admin panel.",
                403
            );
        }


        http_response_code(403);

        echo json_encode([
            "success" => false,
            "message" => "This account is not authorized to access the admin panel."
        ]);

        exit;
    }
}


/* =========================================================
   REFRESH ADMIN SESSION
   ========================================================= */

$_SESSION["logged_in"] =
    true;

$_SESSION["user_id"] =
    (string)(
        $adminUser["_id"] ??
        $sessionUserId
    );

$_SESSION["user_email"] =
    (string)(
        $adminUser["email"] ??
        ""
    );

$_SESSION["role"] =
    "admin";

$_SESSION["account_type"] =
    "admin";

$_SESSION["admin_verified"] =
    true;

$_SESSION["admin_verified_at"] =
    time();


/*
|--------------------------------------------------------------------------
| Preserve login time if it already exists.
|--------------------------------------------------------------------------
*/

if (
    !isset($_SESSION["login_time"])
) {

    $_SESSION["login_time"] =
        time();
}


/* =========================================================
   DIRECT REQUEST SUCCESS RESPONSE
   ========================================================= */

if (
    $isDirectRequest
) {

    adminAuthJson(
        true,
        true,
        true,
        "Administrator access confirmed.",
        200
    );
}


/* =========================================================
   INCLUDED REQUEST SUCCESS
   =========================================================
   
   If another PHP file included this file, execution simply
   continues into that protected PHP file.
|--------------------------------------------------------------------------
*/

return;

?>