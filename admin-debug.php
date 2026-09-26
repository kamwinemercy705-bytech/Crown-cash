<?php

session_set_cookie_params([
    "lifetime" => 0,
    "path" => "/",
    "secure" => true,
    "httponly" => true,
    "samesite" => "None"
]);

session_start();

header("Content-Type: application/json");
header("Access-Control-Allow-Origin: https://crown-cash.vercel.app");
header("Access-Control-Allow-Credentials: true");
header("Access-Control-Allow-Methods: GET, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");

if ($_SERVER["REQUEST_METHOD"] === "OPTIONS") {
    http_response_code(204);
    exit;
}

function respond($data, $status = 200)
{
    http_response_code($status);

    echo json_encode(
        $data,
        JSON_PRETTY_PRINT
    );

    exit;
}


/*
|--------------------------------------------------------------------------
| Check login session
|--------------------------------------------------------------------------
*/

if (
    !isset($_SESSION["logged_in"]) ||
    $_SESSION["logged_in"] !== true
) {
    respond([
        "success" => false,
        "step" => "session",
        "message" => "No valid login session found.",
        "session" => [
            "logged_in" => $_SESSION["logged_in"] ?? null,
            "user_id" => $_SESSION["user_id"] ?? null,
            "user_email" => $_SESSION["user_email"] ?? null
        ]
    ], 401);
}


/*
|--------------------------------------------------------------------------
| Load database
|--------------------------------------------------------------------------
*/

try {

    require_once __DIR__ . "/config.php";

} catch (Throwable $e) {

    respond([
        "success" => false,
        "step" => "config",
        "message" => "Could not load config.php."
    ], 500);
}


/*
|--------------------------------------------------------------------------
| Session information
|--------------------------------------------------------------------------
*/

$sessionUserId = isset($_SESSION["user_id"])
    ? trim((string)$_SESSION["user_id"])
    : "";

$sessionEmail = isset($_SESSION["user_email"])
    ? strtolower(trim((string)$_SESSION["user_email"]))
    : "";

$adminUserId = trim((string)(getenv("ADMIN_USER_ID") ?: ""));

$adminEmail = strtolower(
    trim((string)(getenv("ADMIN_EMAIL") ?: ""))
);


/*
|--------------------------------------------------------------------------
| Find current user by ID
|--------------------------------------------------------------------------
*/

$userById = null;

if ($sessionUserId !== "") {

    try {

        $objectId = new MongoDB\BSON\ObjectId(
            $sessionUserId
        );

        $userById = $users->findOne([
            "_id" => $objectId
        ]);

    } catch (Throwable $e) {

        // Try string ID below.
    }

    if (!$userById) {

        try {

            $userById = $users->findOne([
                "_id" => $sessionUserId
            ]);

        } catch (Throwable $e) {

            // Ignore.
        }
    }
}


/*
|--------------------------------------------------------------------------
| Find current user by email
|--------------------------------------------------------------------------
*/

$userByEmail = null;

if ($sessionEmail !== "") {

    $userByEmail = $users->findOne([
        "email" => $sessionEmail
    ]);

}


/*
|--------------------------------------------------------------------------
| Select whichever user was found
|--------------------------------------------------------------------------
*/

$currentUser = $userById ?: $userByEmail;


/*
|--------------------------------------------------------------------------
| Extract safe user information
|--------------------------------------------------------------------------
*/

$currentUserInfo = null;

if ($currentUser) {

    $currentUserInfo = [
        "_id" => isset($currentUser["_id"])
            ? (string)$currentUser["_id"]
            : "",

        "email" => (string)(
            $currentUser["email"] ?? ""
        ),

        "full_name" => (string)(
            $currentUser["full_name"] ?? ""
        ),

        "role" => (string)(
            $currentUser["role"] ?? ""
        ),

        "account_type" => (string)(
            $currentUser["account_type"] ?? ""
        ),

        "status" => (string)(
            $currentUser["status"] ?? ""
        )
    ];
}


/*
|--------------------------------------------------------------------------
| Compare IDs
|--------------------------------------------------------------------------
*/

$currentDatabaseId = $currentUser
    ? (string)($currentUser["_id"] ?? "")
    : "";

$idMatches = (
    $adminUserId !== "" &&
    $currentDatabaseId !== "" &&
    $adminUserId === $currentDatabaseId
);


/*
|--------------------------------------------------------------------------
| Compare email
|--------------------------------------------------------------------------
*/

$currentDatabaseEmail = $currentUser
    ? strtolower(
        trim((string)($currentUser["email"] ?? ""))
    )
    : "";

$emailMatches = (
    $adminEmail !== "" &&
    $currentDatabaseEmail !== "" &&
    $adminEmail === $currentDatabaseEmail
);


/*
|--------------------------------------------------------------------------
| Return diagnostic information
|--------------------------------------------------------------------------
*/

respond([
    "success" => true,

    "message" => "Administrator diagnostic information.",

    "session" => [
        "logged_in" => $_SESSION["logged_in"] ?? null,
        "session_user_id" => $sessionUserId,
        "session_user_email" => $sessionEmail
    ],

    "environment" => [
        "ADMIN_USER_ID" => $adminUserId,
        "ADMIN_EMAIL" => $adminEmail
    ],

    "database_lookup" => [
        "found_by_session_id" => $userById !== null,
        "found_by_session_email" => $userByEmail !== null,
        "current_user_found" => $currentUser !== null
    ],

    "current_user" => $currentUserInfo,

    "authorization_comparison" => [
        "id_matches" => $idMatches,
        "email_matches" => $emailMatches
    ]
]);

?>