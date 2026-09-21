<?php

declare(strict_types=1);

/*
|--------------------------------------------------------------------------
| Crown Cash - Database Diagnostic
|--------------------------------------------------------------------------
| This file only READS database information.
| It does not create, update, or delete anything.
|--------------------------------------------------------------------------
*/

ini_set("display_errors", "0");
ini_set("log_errors", "1");
error_reporting(E_ALL);

header("Content-Type: application/json; charset=utf-8");

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

if ($_SERVER["REQUEST_METHOD"] === "OPTIONS") {
    http_response_code(204);
    exit;
}


/*
|--------------------------------------------------------------------------
| Only allow GET
|--------------------------------------------------------------------------
*/

if ($_SERVER["REQUEST_METHOD"] !== "GET") {

    http_response_code(405);

    echo json_encode([
        "success" => false,
        "message" => "Method not allowed."
    ]);

    exit;
}


/*
|--------------------------------------------------------------------------
| Start session
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
| Admin authentication
|--------------------------------------------------------------------------
*/

if (
    !isset($_SESSION["logged_in"]) ||
    $_SESSION["logged_in"] !== true
) {

    http_response_code(401);

    echo json_encode([
        "success" => false,
        "message" => "Please login first."
    ]);

    exit;
}


$role = strtolower(
    trim(
        (string)(
            $_SESSION["role"]
            ?? $_SESSION["account_type"]
            ?? ""
        )
    )
);


if (
    $role !== "admin" &&
    $role !== "administrator"
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
| Load database configuration
|--------------------------------------------------------------------------
*/

try {

    require_once __DIR__ . "/config.php";

} catch (Throwable $e) {

    error_log(
        "Database test config error: " .
        $e->getMessage()
    );

    http_response_code(500);

    echo json_encode([
        "success" => false,
        "message" => "Unable to load database configuration."
    ]);

    exit;
}


/*
|--------------------------------------------------------------------------
| Test database
|--------------------------------------------------------------------------
*/

try {

    /*
    |--------------------------------------------------------------------------
    | Ping MongoDB
    |--------------------------------------------------------------------------
    */

    $mongoClient
        ->selectDatabase("crowncash")
        ->command([
            "ping" => 1
        ])
        ->toArray();


    /*
    |--------------------------------------------------------------------------
    | Get collection names
    |--------------------------------------------------------------------------
    */

    $collections = $db
        ->listCollections();


    $collectionNames = [];

    foreach ($collections as $collection) {

        $collectionNames[] =
            $collection->getName();
    }


    sort($collectionNames);


    /*
    |--------------------------------------------------------------------------
    | Count documents
    |--------------------------------------------------------------------------
    */

    $counts = [];

    $collectionsToCheck = [
        "users",
        "deposits",
        "withdrawals",
        "investments",
        "transactions",
        "referrals",
        "audit_logs"
    ];


    foreach ($collectionsToCheck as $collectionName) {

        try {

            $collection =
                $db->selectCollection($collectionName);

            $counts[$collectionName] =
                $collection->countDocuments();

        } catch (Throwable $e) {

            $counts[$collectionName] = null;
        }
    }


    /*
    |--------------------------------------------------------------------------
    | Return safe diagnostic information
    |--------------------------------------------------------------------------
    */

    echo json_encode([
        "success" => true,

        "message" =>
            "MongoDB connection successful.",

        "database" =>
            "crowncash",

        "collections" =>
            $collectionNames,

        "document_counts" =>
            $counts,

        "checks" => [

            "mongodb_connection" =>
                "OK",

            "database_selected" =>
                "crowncash",

            "users_collection" =>
                isset($counts["users"])
                    ? "OK"
                    : "ERROR",

            "deposits_collection" =>
                isset($counts["deposits"])
                    ? "OK"
                    : "ERROR",

            "withdrawals_collection" =>
                isset($counts["withdrawals"])
                    ? "OK"
                    : "ERROR",

            "investments_collection" =>
                isset($counts["investments"])
                    ? "OK"
                    : "ERROR",

            "transactions_collection" =>
                isset($counts["transactions"])
                    ? "OK"
                    : "ERROR",

            "referrals_collection" =>
                isset($counts["referrals"])
                    ? "OK"
                    : "ERROR",

            "audit_logs_collection" =>
                isset($counts["audit_logs"])
                    ? "OK"
                    : "ERROR"
        ]
    ], JSON_PRETTY_PRINT);

} catch (MongoDB\Driver\Exception\Exception $e) {

    error_log(
        "MongoDB diagnostic error: " .
        $e->getMessage()
    );

    http_response_code(500);

    echo json_encode([
        "success" => false,
        "message" =>
            "MongoDB connection or permission test failed."
    ]);

} catch (Throwable $e) {

    error_log(
        "Database diagnostic error: " .
        $e->getMessage()
    );

    http_response_code(500);

    echo json_encode([
        "success" => false,
        "message" =>
            "Database diagnostic failed."
    ]);
}
?>