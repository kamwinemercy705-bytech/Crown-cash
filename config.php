<?php

/*
|--------------------------------------------------------------------------
| Crown Cash — MongoDB Configuration
|--------------------------------------------------------------------------
*/

require_once __DIR__ . "/vendor/autoload.php";

try {

    /*
    |--------------------------------------------------------------------------
    | Get MongoDB URI from Render environment variables
    |--------------------------------------------------------------------------
    */

    $uri = getenv("MONGODB_URI");

    if (!$uri) {

        throw new Exception(
            "MONGODB_URI environment variable is not configured."
        );
    }


    /*
    |--------------------------------------------------------------------------
    | Connect to MongoDB Atlas
    |--------------------------------------------------------------------------
    */

    $client = new MongoDB\Client($uri);


    /*
    |--------------------------------------------------------------------------
    | Select Crown Cash database
    |--------------------------------------------------------------------------
    */

    $database = $client->selectDatabase("crowncash");


    /*
    |--------------------------------------------------------------------------
    | Users collection
    |--------------------------------------------------------------------------
    */

    $users = $database->users;


} catch (Throwable $e) {

    error_log(
        "CROWN CASH MONGODB ERROR: " .
        $e->getMessage()
    );

    http_response_code(500);

    header("Content-Type: application/json; charset=UTF-8");

    echo json_encode([
        "success" => false,
        "message" => "Database connection failed."
    ]);

    exit;
}