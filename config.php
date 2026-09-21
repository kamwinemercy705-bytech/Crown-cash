<?php

/* =========================================================
   CROWN CASH — MONGODB CONFIGURATION
========================================================= */

declare(strict_types=1);


/* =========================================================
   ERROR SETTINGS
========================================================= */

ini_set("display_errors", "0");
ini_set("log_errors", "1");

error_reporting(E_ALL);


/* =========================================================
   LOAD COMPOSER
========================================================= */

$autoload = __DIR__ . "/vendor/autoload.php";

if (!file_exists($autoload)) {

    http_response_code(500);

    header("Content-Type: application/json; charset=utf-8");

    echo json_encode([
        "success" => false,
        "message" => "Server configuration error: Composer autoload file is missing."
    ]);

    exit;
}

require_once $autoload;


/* =========================================================
   MONGODB URI
========================================================= */

$mongoUri = getenv("MONGODB_URI");

if (
    !$mongoUri ||
    trim($mongoUri) === ""
) {

    http_response_code(500);

    header("Content-Type: application/json; charset=utf-8");

    echo json_encode([
        "success" => false,
        "message" => "MongoDB connection is not configured."
    ]);

    exit;
}


/* =========================================================
   DATABASE NAME
========================================================= */

$databaseName = "crowncash";


/* =========================================================
   CREATE MONGODB CLIENT
========================================================= */

try {

    $mongoClient =
        new MongoDB\Client(
            $mongoUri,
            [],
            [
                "serverSelectionTimeoutMS" => 10000,
                "connectTimeoutMS" => 10000
            ]
        );


    /* =====================================================
       SELECT DATABASE
    ====================================================== */

    $db =
        $mongoClient->selectDatabase(
            $databaseName
        );


    /* =====================================================
       COLLECTIONS
    ====================================================== */

    $users =
        $db->selectCollection(
            "users"
        );


    $deposits =
        $db->selectCollection(
            "deposits"
        );


    $withdrawals =
        $db->selectCollection(
            "withdrawals"
        );


    $investments =
        $db->selectCollection(
            "investments"
        );


    $transactions =
        $db->selectCollection(
            "transactions"
        );


    $referrals =
        $db->selectCollection(
            "referrals"
        );


    $auditLogs =
        $db->selectCollection(
            "audit_logs"
        );


} catch (
    MongoDB\Driver\Exception\Exception $e
) {

    error_log(
        "MongoDB connection error: " .
        $e->getMessage()
    );

    http_response_code(500);

    header("Content-Type: application/json; charset=utf-8");

    echo json_encode([
        "success" => false,
        "message" => "Database connection failed."
    ]);

    exit;

} catch (Throwable $e) {

    error_log(
        "Configuration error: " .
        $e->getMessage()
    );

    http_response_code(500);

    header("Content-Type: application/json; charset=utf-8");

    echo json_encode([
        "success" => false,
        "message" => "Server configuration error."
    ]);

    exit;
}