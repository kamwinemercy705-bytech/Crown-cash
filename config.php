<?php

/*
|--------------------------------------------------------------------------
| Crown Cash - MongoDB Configuration
|--------------------------------------------------------------------------
| Do NOT put your real MongoDB password or connection string directly
| in this file. We will use an environment variable on the server.
|--------------------------------------------------------------------------
*/

require_once __DIR__ . '/../vendor/autoload.php';

use MongoDB\Client;


/*
|--------------------------------------------------------------------------
| Get MongoDB connection URI
|--------------------------------------------------------------------------
*/

$mongoUri = getenv('MONGODB_URI');

if (!$mongoUri) {
    die("MongoDB connection is not configured.");
}


/*
|--------------------------------------------------------------------------
| Connect to MongoDB
|--------------------------------------------------------------------------
*/

try {

    $client = new Client($mongoUri);

    /*
    | Crown Cash database
    */

    $db = $client->selectDatabase('crown_cash');


    /*
    | Collections
    */

    $users = $db->users;

    $transactions = $db->transactions;

    $deposits = $db->deposits;

    $withdrawals = $db->withdrawals;

    $investments = $db->investments;

    $referrals = $db->referrals;

    $auditLogs = $db->audit_logs;


} catch (Exception $e) {

    die("Database connection failed.");

}

?>
