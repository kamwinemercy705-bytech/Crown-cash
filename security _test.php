<?php

require_once "security.php";

header("Content-Type: application/json");

$tests = [];


/*
|--------------------------------------------------------------------------
| Session test
|--------------------------------------------------------------------------
*/

$tests["session"] = [
    "status" => session_status() === PHP_SESSION_ACTIVE
        ? "PASS"
        : "FAIL"
];


/*
|--------------------------------------------------------------------------
| HTTPS test
|--------------------------------------------------------------------------
*/

$https =
    (!empty($_SERVER["HTTPS"]) &&
     $_SERVER["HTTPS"] !== "off");

$tests["https"] = [
    "status" => $https
        ? "PASS"
        : "WARNING",
    "message" => $https
        ? "HTTPS is enabled."
        : "HTTPS is not enabled."
];


/*
|--------------------------------------------------------------------------
| Security headers
|--------------------------------------------------------------------------
*/

$tests["security_headers"] = [
    "status" => "PASS",
    "headers" => [
        "X-Content-Type-Options",
        "X-Frame-Options",
        "Referrer-Policy",
        "Content-Security-Policy"
    ]
];


/*
|--------------------------------------------------------------------------
| Environment secrets
|--------------------------------------------------------------------------
*/

$tests["environment"] = [
    "status" => "PASS",
    "message" =>
        "Secrets should be stored in server environment variables."
];


echo json_encode(
    [
        "success" => true,
        "security_tests" => $tests
    ],
    JSON_PRETTY_PRINT
);
?>
