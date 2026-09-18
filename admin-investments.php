<?php

// ======================================================
// CROWN CASH - ADMIN INVESTMENTS API
// File: admin-investments.php
// GET  -> View investment requests
// POST -> Approve or reject an investment
// ======================================================

header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Origin: https://crown-cash.vercel.app");
header("Access-Control-Allow-Credentials: true");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");

if ($_SERVER["REQUEST_METHOD"] === "OPTIONS") {
    http_response_code(204);
    exit;
}

// ------------------------------------------------------
// Session configuration for Vercel + Render
// ------------------------------------------------------

session_set_cookie_params([
    "lifetime" => 0,
    "path" => "/",
    "secure" => true,
    "httponly" => true,
    "samesite" => "None"
]);

session_start();


// ------------------------------------------------------
// Helper function
// ------------------------------------------------------

function sendResponse($statusCode, $data)
{
    http_response_code($statusCode);
    echo json_encode($data);
    exit;
}


// ------------------------------------------------------
// Check admin login
// ------------------------------------------------------

if (
    empty($_SESSION["logged_in"]) ||
    $_SESSION["logged_in"] !== true
) {
    sendResponse(401, [
        "success" => false,
        "message" => "You must be logged in."
    ]);
}


// ------------------------------------------------------
// Check admin role
// ------------------------------------------------------

$sessionRole = strtolower(
    trim(
        (string) (
            $_SESSION["role"]
            ?? $_SESSION["account_type"]
            ?? ""
        )
    )
);

if ($sessionRole !== "admin") {
    sendResponse(403, [
        "success" => false,
        "message" => "Administrator access required."
    ]);
}


// ------------------------------------------------------
// Load MongoDB configuration
// ------------------------------------------------------

try {

    require_once __DIR__ . "/config.php";

} catch (Throwable $e) {

    sendResponse(500, [
        "success" => false,
        "message" => "Database configuration could not be loaded."
    ]);
}


// ------------------------------------------------------
// Check required collections
// ------------------------------------------------------

if (!isset($investments) || !isset($users)) {

    sendResponse(500, [
        "success" => false,
        "message" => "Required database collections are not available."
    ]);
}


// ------------------------------------------------------
// MongoDB ObjectId helper
// ------------------------------------------------------

function makeObjectId($value)
{
    if (!$value) {
        return null;
    }

    try {

        if ($value instanceof MongoDB\BSON\ObjectId) {
            return $value;
        }

        return new MongoDB\BSON\ObjectId((string) $value);

    } catch (Throwable $e) {

        return null;
    }
}


// ------------------------------------------------------
// Convert MongoDB numbers to normal PHP numbers
// ------------------------------------------------------

function normalNumber($value)
{
    if ($value === null) {
        return 0;
    }

    if ($value instanceof MongoDB\BSON\Decimal128) {
        return (float) $value->__toString();
    }

    if ($value instanceof MongoDB\BSON\Int64) {
        return (int) $value->__toString();
    }

    if (is_numeric($value)) {
        return (float) $value;
    }

    return 0;
}


// ------------------------------------------------------
// Convert MongoDB date to ISO string
// ------------------------------------------------------

function normalDate($value)
{
    if (!$value) {
        return null;
    }

    if ($value instanceof MongoDB\BSON\UTCDateTime) {

        try {
            return $value
                ->toDateTime()
                ->format(DATE_ATOM);

        } catch (Throwable $e) {
            return null;
        }
    }

    if ($value instanceof DateTimeInterface) {
        return $value->format(DATE_ATOM);
    }

    if (is_string($value)) {
        return $value;
    }

    return null;
}


// ------------------------------------------------------
// Convert any value to string
// ------------------------------------------------------

function normalString($value)
{
    if ($value === null) {
        return "";
    }

    if (
        $value instanceof MongoDB\BSON\ObjectId
        || $value instanceof MongoDB\BSON\Decimal128
        || $value instanceof MongoDB\BSON\Int64
    ) {
        return (string) $value;
    }

    return trim((string) $value);
}


// ------------------------------------------------------
// Find user ID from an investment
// ------------------------------------------------------

function investmentUserId($investment)
{
    $possibleFields = [
        "user_id",
        "userId",
        "user",
        "account_id"
    ];

    foreach ($possibleFields as $field) {

        if (!isset($investment[$field])) {
            continue;
        }

        $id = makeObjectId($investment[$field]);

        if ($id !== null) {
            return $id;
        }
    }

    return null;
}


// ------------------------------------------------------
// Get plan name
// ------------------------------------------------------

function getPlanName($investment)
{
    $plan = strtolower(
        normalString(
            $investment["plan"]
            ?? $investment["plan_name"]
            ?? ""
        )
    );

    if ($plan === "starter") {
        return "Starter";
    }

    if ($plan === "standard") {
        return "Standard";
    }

    if ($plan === "advanced") {
        return "Advanced";
    }

    return ucfirst($plan ?: "Investment");
}


// ------------------------------------------------------
// GET REQUEST
// ------------------------------------------------------

if ($_SERVER["REQUEST_METHOD"] === "GET") {

    try {

        // ----------------------------------------------
        // Optional status filter
        // ----------------------------------------------

        $status = strtolower(
            trim($_GET["status"] ?? "")
        );

        $filter = [];

        if ($status !== "") {

            $filter["status"] = $status;

        } else {

            // Admin page normally needs pending first.
            // All investments are returned when no filter
            // is supplied.

            $filter = [];
        }


        // ----------------------------------------------
        // Fetch investments
        // ----------------------------------------------

        $cursor = $investments->find(
            $filter,
            [
                "sort" => [
                    "created_at" => -1,
                    "_id" => -1
                ],
                "limit" => 500
            ]
        );


        $investmentList = [];

        foreach ($cursor as $investment) {

            $userId = investmentUserId($investment);

            $user = null;

            if ($userId !== null) {

                $user = $users->findOne([
                    "_id" => $userId
                ]);
            }


            // ------------------------------------------
            // User information
            // ------------------------------------------

            $firstName = normalString(
                $user["first_name"] ?? ""
            );

            $lastName = normalString(
                $user["last_name"] ?? ""
            );

            $fullName = normalString(
                $user["full_name"] ?? ""
            );

            if ($fullName === "") {

                $fullName = trim(
                    $firstName . " " . $lastName
                );
            }

            if ($fullName === "") {
                $fullName = "Unknown User";
            }


            $email = normalString(
                $user["email"] ?? ""
            );

            $phone = normalString(
                $user["phone"] ?? ""
            );


            // ------------------------------------------
            // Investment fields
            // ------------------------------------------

            $investmentId = normalString(
                $investment["_id"] ?? ""
            );

            $reference = normalString(
                $investment["reference"]
                ?? $investment["investment_reference"]
                ?? ""
            );

            $plan = getPlanName($investment);

            $amount = normalNumber(
                $investment["amount"]
                ?? $investment["investment_amount"]
                ?? 0
            );

            $duration = (int) normalNumber(
                $investment["duration_days"]
                ?? $investment["duration"]
                ?? 30
            );

            if ($duration <= 0) {
                $duration = 30;
            }


            $investmentStatus = strtolower(
                normalString(
                    $investment["status"] ?? "pending"
                )
            );

            $createdAt = normalDate(
                $investment["created_at"]
                ?? $investment["createdAt"]
                ?? null
            );

            $startDate = normalDate(
                $investment["start_date"]
                ?? $investment["startDate"]
                ?? null
            );

            $endDate = normalDate(
                $investment["end_date"]
                ?? $investment["endDate"]
                ?? null
            );


            $investmentList[] = [

                "id" => $investmentId,

                "user_id" => $userId
                    ? (string) $userId
                    : "",

                "user" => [

                    "name" => $fullName,

                    "first_name" => $firstName,

                    "last_name" => $lastName,

                    "email" => $email,

                    "phone" => $phone
                ],

                "plan" => $plan,

                "plan_key" => strtolower($plan),

                "amount" => $amount,

                "duration_days" => $duration,

                "status" => $investmentStatus,

                "reference" => $reference,

                "created_at" => $createdAt,

                "start_date" => $startDate,

                "end_date" => $endDate
            ];
        }


        // ----------------------------------------------
        // Count statuses
        // ----------------------------------------------

        $pendingCount = $investments->countDocuments([
            "status" => "pending"
        ]);

        $activeCount = $investments->countDocuments([
            "status" => "active"
        ]);

        $completedCount = $investments->countDocuments([
            "status" => "completed"
        ]);

        $rejectedCount = $investments->countDocuments([
            "status" => "rejected"
        ]);


        sendResponse(200, [

            "success" => true,

            "counts" => [

                "pending" => $pendingCount,

                "active" => $activeCount,

                "completed" => $completedCount,

                "rejected" => $rejectedCount,

                "total" => count($investmentList)
            ],

            "investments" => $investmentList
        ]);


    } catch (Throwable $e) {

        sendResponse(500, [

            "success" => false,

            "message" => "Unable to load investments.",

            "error" => $e->getMessage()
        ]);
    }
}


// ------------------------------------------------------
// POST REQUEST
// ------------------------------------------------------

if ($_SERVER["REQUEST_METHOD"] === "POST") {

    try {

        // ----------------------------------------------
        // Read JSON request
        // ----------------------------------------------

        $rawInput = file_get_contents("php://input");

        $data = json_decode(
            $rawInput,
            true
        );

        if (!is_array($data)) {
            $data = $_POST;
        }


        $investmentId = trim(
            (string) (
                $data["investment_id"]
                ?? $data["id"]
                ?? ""
            )
        );

        $action = strtolower(
            trim(
                (string) (
                    $data["action"]
                    ?? ""
                )
            )
        );


        // ----------------------------------------------
        // Validate action
        // ----------------------------------------------

        if (!in_array(
            $action,
            ["approve", "reject"],
            true
        )) {

            sendResponse(400, [

                "success" => false,

                "message" =>
                    "Invalid action. Use approve or reject."
            ]);
        }


        // ----------------------------------------------
        // Validate investment ID
        // ----------------------------------------------

        $objectId = makeObjectId($investmentId);

        if ($objectId === null) {

            sendResponse(400, [

                "success" => false,

                "message" => "Invalid investment ID."
            ]);
        }


        // ----------------------------------------------
        // Find investment
        // ----------------------------------------------

        $investment = $investments->findOne([
            "_id" => $objectId
        ]);

        if (!$investment) {

            sendResponse(404, [

                "success" => false,

                "message" => "Investment was not found."
            ]);
        }


        // ----------------------------------------------
        // Only pending investments can be processed
        // ----------------------------------------------

        $currentStatus = strtolower(
            normalString(
                $investment["status"] ?? "pending"
            )
        );

        if ($currentStatus !== "pending") {

            sendResponse(409, [

                "success" => false,

                "message" =>
                    "This investment has already been processed.",

                "current_status" => $currentStatus
            ]);
        }


        $now = new MongoDB\BSON\UTCDateTime(
            (int) (microtime(true) * 1000)
        );


        // ==================================================
        // APPROVE INVESTMENT
        // ==================================================

        if ($action === "approve") {

            $duration = (int) normalNumber(
                $investment["duration_days"]
                ?? $investment["duration"]
                ?? 30
            );

            if ($duration <= 0) {
                $duration = 30;
            }


            $startDate = new DateTimeImmutable(
                "now",
                new DateTimeZone("UTC")
            );

            $endDate = $startDate->modify(
                "+" . $duration . " days"
            );


            $startMongoDate =
                new MongoDB\BSON\UTCDateTime(
                    $startDate->getTimestamp() * 1000
                );

            $endMongoDate =
                new MongoDB\BSON\UTCDateTime(
                    $endDate->getTimestamp() * 1000
                );


            // ------------------------------------------
            // Change pending -> active
            // ------------------------------------------

            $updateResult = $investments->updateOne(

                [
                    "_id" => $objectId,

                    "status" => "pending"
                ],

                [
                    '$set' => [

                        "status" => "active",

                        "start_date" =>
                            $startMongoDate,

                        "end_date" =>
                            $endMongoDate,

                        "approved_at" =>
                            $now,

                        "approved_by" =>
                            $_SESSION["user_id"]
                            ?? $_SESSION["admin_id"]
                            ?? null,

                        "updated_at" =>
                            $now
                    ]
                ]
            );


            if ($updateResult->getModifiedCount() !== 1) {

                sendResponse(409, [

                    "success" => false,

                    "message" =>
                        "Investment could not be approved. It may have already been processed."
                ]);
            }


            // ------------------------------------------
            // Optional transaction update
            // ------------------------------------------

            if (isset($transactions)) {

                try {

                    $transactions->updateMany(

                        [
                            '$or' => [

                                [
                                    "investment_id" =>
                                        $objectId
                                ],

                                [
                                    "investment_id" =>
                                        $investmentId
                                ],

                                [
                                    "reference" =>
                                        normalString(
                                            $investment["reference"]
                                            ?? ""
                                        )
                                ]
                            ]
                        ],

                        [
                            '$set' => [

                                "status" =>
                                    "completed",

                                "updated_at" =>
                                    $now
                            ]
                        ]
                    );

                } catch (Throwable $e) {

                    // Do not fail the approval if the
                    // optional transaction update fails.
                }
            }


            // ------------------------------------------
            // Optional audit log
            // ------------------------------------------

            if (isset($audit_logs)) {

                try {

                    $audit_logs->insertOne([

                        "action" =>
                            "investment_approved",

                        "investment_id" =>
                            $objectId,

                        "admin_id" =>
                            $_SESSION["user_id"]
                            ?? $_SESSION["admin_id"]
                            ?? null,

                        "created_at" =>
                            $now,

                        "details" => [

                            "previous_status" =>
                                "pending",

                            "new_status" =>
                                "active",

                            "duration_days" =>
                                $duration
                        ]
                    ]);

                } catch (Throwable $e) {

                    // Audit failure does not cancel approval.
                }
            }


            sendResponse(200, [

                "success" => true,

                "message" =>
                    "Investment approved successfully.",

                "status" => "active",

                "start_date" =>
                    $startDate->format(DATE_ATOM),

                "end_date" =>
                    $endDate->format(DATE_ATOM)
            ]);
        }


        // ==================================================
        // REJECT INVESTMENT
        // ==================================================

        if ($action === "reject") {

            $updateResult = $investments->updateOne(

                [
                    "_id" => $objectId,

                    "status" => "pending"
                ],

                [
                    '$set' => [

                        "status" => "rejected",

                        "rejected_at" => $now,

                        "rejected_by" =>
                            $_SESSION["user_id"]
                            ?? $_SESSION["admin_id"]
                            ?? null,

                        "updated_at" => $now
                    ]
                ]
            );


            if ($updateResult->getModifiedCount() !== 1) {

                sendResponse(409, [

                    "success" => false,

                    "message" =>
                        "Investment could not be rejected. It may have already been processed."
                ]);
            }


            // ------------------------------------------
            // Optional transaction update
            // ------------------------------------------

            if (isset($transactions)) {

                try {

                    $transactions->updateMany(

                        [
                            '$or' => [

                                [
                                    "investment_id" =>
                                        $objectId
                                ],

                                [
                                    "investment_id" =>
                                        $investmentId
                                ],

                                [
                                    "reference" =>
                                        normalString(
                                            $investment["reference"]
                                            ?? ""
                                        )
                                ]
                            ]
                        ],

                        [
                            '$set' => [

                                "status" =>
                                    "rejected",

                                "updated_at" =>
                                    $now
                            ]
                        ]
                    );

                } catch (Throwable $e) {

                    // Optional update.
                }
            }


            // ------------------------------------------
            // Optional audit log
            // ------------------------------------------

            if (isset($audit_logs)) {

                try {

                    $audit_logs->insertOne([

                        "action" =>
                            "investment_rejected",

                        "investment_id" =>
                            $objectId,

                        "admin_id" =>
                            $_SESSION["user_id"]
                            ?? $_SESSION["admin_id"]
                            ?? null,

                        "created_at" =>
                            $now,

                        "details" => [

                            "previous_status" =>
                                "pending",

                            "new_status" =>
                                "rejected"
                        ]
                    ]);

                } catch (Throwable $e) {

                    // Audit failure does not cancel rejection.
                }
            }


            sendResponse(200, [

                "success" => true,

                "message" =>
                    "Investment rejected successfully.",

                "status" => "rejected"
            ]);
        }


    } catch (Throwable $e) {

        sendResponse(500, [

            "success" => false,

            "message" =>
                "Unable to process investment.",

            "error" =>
                $e->getMessage()
        ]);
    }
}


// ------------------------------------------------------
// Unsupported request
// ------------------------------------------------------

sendResponse(405, [

    "success" => false,

    "message" => "Method not allowed."
]);

?>