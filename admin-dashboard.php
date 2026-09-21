<?php

/* =========================================================
   CROWN CASH — ADMIN DASHBOARD API
   admin-dashboard.php
========================================================= */

declare(strict_types=1);


/* =========================================================
   SESSION COOKIE
========================================================= */

session_set_cookie_params([
    "lifetime" => 0,
    "path" => "/",
    "secure" => true,
    "httponly" => true,
    "samesite" => "None"
]);

session_start();


/* =========================================================
   HEADERS
========================================================= */

header("Content-Type: application/json; charset=utf-8");

header(
    "Access-Control-Allow-Origin: https://crown-cash.vercel.app"
);

header(
    "Access-Control-Allow-Credentials: true"
);

header(
    "Access-Control-Allow-Methods: GET, OPTIONS"
);

header(
    "Access-Control-Allow-Headers: Content-Type, Accept"
);


/* =========================================================
   CORS PREFLIGHT
========================================================= */

if ($_SERVER["REQUEST_METHOD"] === "OPTIONS") {

    http_response_code(204);

    exit;
}


/* =========================================================
   ONLY GET ALLOWED
========================================================= */

if ($_SERVER["REQUEST_METHOD"] !== "GET") {

    http_response_code(405);

    echo json_encode([
        "success" => false,
        "message" => "Method not allowed."
    ]);

    exit;
}


/* =========================================================
   LOGIN CHECK
========================================================= */

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


/* =========================================================
   ADMIN SESSION CHECK
========================================================= */

$sessionRole =
    strtolower(
        trim(
            (string)(
                $_SESSION["role"] ??
                $_SESSION["account_type"] ??
                ""
            )
        )
    );


if (
    $sessionRole !== "admin" &&
    $sessionRole !== "administrator"
) {

    http_response_code(403);

    echo json_encode([
        "success" => false,
        "message" => "Administrator access required."
    ]);

    exit;
}


/* =========================================================
   DATABASE
========================================================= */

require_once __DIR__ . "/config.php";


/* =========================================================
   HELPER — BSON TO JSON SAFE VALUE
========================================================= */

function bsonSafeValue($value)
{
    if (
        $value instanceof MongoDB\BSON\ObjectId
    ) {
        return (string)$value;
    }


    if (
        $value instanceof MongoDB\BSON\UTCDateTime
    ) {
        return $value
            ->toDateTime()
            ->format(DATE_ATOM);
    }


    if (
        $value instanceof MongoDB\BSON\Decimal128
    ) {
        return (float)$value->__toString();
    }


    if (
        $value instanceof MongoDB\BSON\Int64
    ) {
        return (int)$value->__toString();
    }


    if (is_array($value)) {

        $result = [];

        foreach ($value as $key => $item) {

            $result[$key] =
                bsonSafeValue($item);
        }

        return $result;
    }


    if ($value instanceof Traversable) {

        $result = [];

        foreach ($value as $key