<?php

/*
|--------------------------------------------------------------------------
| Crown Cash — MongoDB Configuration
|--------------------------------------------------------------------------
*/

require_once __DIR__ . "/vendor/autoload.php";

try {

    $uri = getenv("DB_URI");

    if (!$uri) {
        throw new Exception("DB_URI environment variable is not configured.");
    }

    $client = new MongoDB\Client($uri);

    /*
     * Change "crowncash" only if you want a different database name.
     */
    $database = $client->selectDatabase("crowncash");

    /*
     * Users collection
     */
    $users = $database->users;

} catch (Throwable $e) {

    http_response_code(500);

    header("Content-Type: application/json; charset=UTF-8");

    echo json_encode([
        "success" => false,
        "message" => "Database connection failed."
    ]);

    exit;
}