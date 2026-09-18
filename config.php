<?php

// ============================================================
// CROWN CASH - MONGODB CONFIGURATION
// File: config.php
// ============================================================

declare(strict_types=1);

// ------------------------------------------------------------
// MongoDB library
// ------------------------------------------------------------

require_once __DIR__ . "/vendor/autoload.php";

use MongoDB\Client;

// ------------------------------------------------------------
// Get MongoDB connection string
// ------------------------------------------------------------

// Render environment variable
$mongoUri = getenv("MONGODB_URI");

// Fallback for systems using DB_URI
if (!$mongoUri) {
    $mongoUri = getenv("DB_URI");
}

// Stop if no connection string exists
if (!$mongoUri) {

    http_response_code(500);

    header("Content-Type: application/json; charset=UTF-8");

    echo json_encode([
        "success" => false,
        "message" => "MongoDB connection is not configured."
    ]);

    exit;
}

// ------------------------------------------------------------
// Database name
// ------------------------------------------------------------

$databaseName = "crowncash";

// ------------------------------------------------------------
// Connect to MongoDB
// ------------------------------------------------------------

try {

    $mongoClient = new Client($mongoUri);

    // Select Crown Cash database
    $database = $mongoClient->selectDatabase($databaseName);

} catch (Throwable $e) {

    http_response_code(500);

    header("Content-Type: application/json; charset=UTF-8");

    echo json_encode([
        "success" => false,
        "message" => "Database connection failed."
    ]);

    exit;
}

// ------------------------------------------------------------
// Collections
// ------------------------------------------------------------

$users = $database->users;

$transactions = $database->transactions;

$deposits = $database->deposits;

$withdrawals = $database->withdrawals;

$investments = $database->investments;

$referrals = $database->referrals;

$audit_logs = $database->audit_logs;


// ============================================================
// OPTIONAL: Create useful indexes
// ============================================================

try {

    // Email should be unique
    $users->createIndex(
        ["email" => 1],
        ["unique" => true]
    );

} catch (Throwable $e) {

    // Ignore index errors so the API can continue.
}


// Phone should be unique
try {

    $users->createIndex(
        ["phone" => 1],
        ["unique" => true]
    );

} catch (Throwable $e) {

    // Ignore index errors.
}


// Referral codes should be unique
try {

    $users->createIndex(
        ["referral_code" => 1],
        ["unique" => true]
    );

} catch (Throwable $e) {

    // Ignore index errors.
}


// Deposit references should be searchable
try {

    $deposits->createIndex(
        ["transaction_reference" => 1]
    );

} catch (Throwable $e) {

    // Ignore index errors.
}


// Withdrawal history
try {

    $withdrawals->createIndex(
        [
            "user_id" => 1,
            "created_at" => -1
        ]
    );

} catch (Throwable $e) {

    // Ignore index errors.
}


// Investment history
try {

    $investments->createIndex(
        [
            "user_id" => 1,
            "created_at" => -1
        ]
    );

} catch (Throwable $e) {

    // Ignore index errors.
}


// Referral relationships
try {

    $referrals->createIndex(
        [
            "referrer_id" => 1,
            "created_at" => -1
        ]
    );

} catch (Throwable $e) {

    // Ignore index errors.
}


// ============================================================
// IMPORTANT
// ============================================================
//
// Do NOT put the MongoDB username or password directly
// into this file.
//
// Keep the complete MongoDB URI inside Render:
//
// Render
// → Crown-cash1
// → Environment
// → MONGODB_URI
//
// Example format:
//
// mongodb+srv://USERNAME:PASSWORD@crowncash.xxxxx.mongodb.net/
//
// Do not expose the real password in GitHub.
//
// ============================================================
?>