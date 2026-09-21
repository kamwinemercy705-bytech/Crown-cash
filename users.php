<?php

// ============================================================
// CROWN CASH - ADMIN USERS API
// File: users.php
// Backend: PHP + MongoDB
// Purpose: View and manage Crown Cash users
// ============================================================

declare(strict_types=1);

// ------------------------------------------------------------
// Error handling
// ------------------------------------------------------------

ini_set("display_errors", "0");
ini_set("log_errors", "1");
error_reporting(E_ALL);

// ------------------------------------------------------------
// CORS
// ------------------------------------------------------------

header("Content-Type: application/json; charset=utf-8");

header(
    "Access-Control-Allow-Origin: https://crown-cash.vercel.app"
);

header("Access-Control-Allow-Credentials: true");

header(
    "Access-Control-Allow-Methods: GET, POST, OPTIONS"
);

header(
    "Access-Control-Allow-Headers: Content-Type"
);

// ------------------------------------------------------------
// OPTIONS
// ------------------------------------------------------------

if ($_SERVER["REQUEST_METHOD"] === "OPTIONS") {

    http_response_code(204);

    exit;
}

// ------------------------------------------------------------
// Session
// ------------------------------------------------------------

if (session_status() === PHP_SESSION_NONE) {

    session_set_cookie_params([
        "lifetime" => 0,
        "path" => "/",
        "secure" => true,
        "httponly" => true,
        "samesite" => "None"
    ]);

    session_start();
}

// ------------------------------------------------------------
// Authentication
// ------------------------------------------------------------

if (
    !isset($_SESSION["logged_in"]) ||
    $_SESSION["logged_in"] !== true ||
    !isset($_SESSION["user_id"])
) {

    http_response_code(401);

    echo json_encode([
        "success" => false,
        "message" => "Please login first."
    ]);

    exit;
}

// ------------------------------------------------------------
// Admin authorization
// ------------------------------------------------------------

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

// ------------------------------------------------------------
// Load database
// ------------------------------------------------------------

try {

    require_once __DIR__ . "/config.php";

} catch (Throwable $e) {

    error_log(
        "Users API config error: " .
        $e->getMessage()
    );

    http_response_code(500);

    echo json_encode([
        "success" => false,
        "message" => "Database configuration error."
    ]);

    exit;
}


// ============================================================
// HELPERS
// ============================================================

function usersNumber($value): float
{
    if ($value instanceof MongoDB\BSON\Decimal128) {
        return (float)$value->__toString();
    }

    if ($value instanceof MongoDB\BSON\Int64) {
        return (float)$value->__toString();
    }

    if (is_numeric($value)) {
        return (float)$value;
    }

    return 0.0;
}


function usersDate($value): string
{
    if ($value instanceof MongoDB\BSON\UTCDateTime) {

        return $value
            ->toDateTime()
            ->format("Y-m-d H:i:s");
    }

    if ($value instanceof DateTimeInterface) {

        return $value->format("Y-m-d H:i:s");
    }

    if (is_string($value)) {

        return $value;
    }

    return "";
}


function usersId($value): string
{
    if ($value instanceof MongoDB\BSON\ObjectId) {

        return (string)$value;
    }

    return (string)$value;
}


function getUserName($user): string
{
    $fullName = trim(
        (string)($user["full_name"] ?? "")
    );

    if ($fullName !== "") {
        return $fullName;
    }

    $firstName = trim(
        (string)($user["first_name"] ?? "")
    );

    $lastName = trim(
        (string)($user["last_name"] ?? "")
    );

    return trim(
        $firstName . " " . $lastName
    );
}


function getUserRole($user): string
{
    $role = strtolower(
        trim(
            (string)(
                $user["role"] ??
                $user["account_type"] ??
                "user"
            )
        )
    );

    return $role !== ""
        ? $role
        : "user";
}


function getUserStatus($user): string
{
    $status = strtolower(
        trim(
            (string)(
                $user["status"] ?? "active"
            )
        )
    );

    return $status !== ""
        ? $status
        : "active";
}


function serializeUser($user): array
{
    return [

        "id" =>
            usersId($user["_id"] ?? ""),

        "first_name" =>
            (string)($user["first_name"] ?? ""),

        "last_name" =>
            (string)($user["last_name"] ?? ""),

        "full_name" =>
            getUserName($user),

        "email" =>
            (string)($user["email"] ?? ""),

        "phone" =>
            (string)($user["phone"] ?? ""),

        "referral_code" =>
            (string)(
                $user["referral_code"] ?? ""
            ),

        "balance" =>
            usersNumber(
                $user["balance"] ?? 0
            ),

        "status" =>
            getUserStatus($user),

        "role" =>
            getUserRole($user),

        "account_type" =>
            (string)(
                $user["account_type"] ??
                getUserRole($user)
            ),

        "created_at" =>
            usersDate(
                $user["created_at"] ?? ""
            ),

        "updated_at" =>
            usersDate(
                $user["updated_at"] ?? ""
            )
    ];
}


// ============================================================
// GET USERS
// ============================================================

if ($_SERVER["REQUEST_METHOD"] === "GET") {

    try {

        // ----------------------------------------------------
        // Search
        // ----------------------------------------------------

        $search = trim(
            (string)(
                $_GET["search"] ?? ""
            )
        );

        // ----------------------------------------------------
        // Status filter
        // ----------------------------------------------------

        $status = strtolower(
            trim(
                (string)(
                    $_GET["status"] ?? ""
                )
            )
        );

        // ----------------------------------------------------
        // Role filter
        // ----------------------------------------------------

        $roleFilter = strtolower(
            trim(
                (string)(
                    $_GET["role"] ?? ""
                )
            )
        );

        // ----------------------------------------------------
        // Limit
        // ----------------------------------------------------

        $limit = (int)(
            $_GET["limit"] ?? 100
        );

        if ($limit < 1) {
            $limit = 100;
        }

        if ($limit > 500) {
            $limit = 500;
        }


        // ----------------------------------------------------
        // Build query
        // ----------------------------------------------------

        $query = [];


        // ----------------------------------------------------
        // Search by name/email/phone/referral
        // ----------------------------------------------------

        if ($search !== "") {

            $safeSearch =
                preg_quote(
                    $search,
                    "/"
                );

            $query["\$or"] = [

                [
                    "full_name" => [
                        "\$regex" =>
                            $safeSearch,
                        "\$options" =>
                            "i"
                    ]
                ],

                [
                    "first_name" => [
                        "\$regex" =>
                            $safeSearch,
                        "\$options" =>
                            "i"
                    ]
                ],

                [
                    "last_name" => [
                        "\$regex" =>
                            $safeSearch,
                        "\$options" =>
                            "i"
                    ]
                ],

                [
                    "email" => [
                        "\$regex" =>
                            $safeSearch,
                        "\$options" =>
                            "i"
                    ]
                ],

                [
                    "phone" => [
                        "\$regex" =>
                            $safeSearch,
                        "\$options" =>
                            "i"
                    ]
                ],

                [
                    "referral_code" => [
                        "\$regex" =>
                            $safeSearch,
                        "\$options" =>
                            "i"
                    ]
                ]
            ];
        }


        // ----------------------------------------------------
        // Status filter
        // ----------------------------------------------------

        if ($status !== "") {

            $statusValues = [
                $status,
                ucfirst($status)
            ];

            $query["status"] = [
                "\$in" =>
                    array_values(
                        array_unique(
                            $statusValues
                        )
                    )
            ];
        }


        // ----------------------------------------------------
        // Role filter
        // ----------------------------------------------------

        if ($roleFilter !== "") {

            $roleValues = [
                $roleFilter,
                ucfirst($roleFilter)
            ];

            $query["\$or"] = $query["\$or"] ?? [];

            $roleConditions = [

                [
                    "role" => [
                        "\$in" =>
                            array_values(
                                array_unique(
                                    $roleValues
                                )
                            )
                    ]
                ],

                [
                    "account_type" => [
                        "\$in" =>
                            array_values(
                                array_unique(
                                    $roleValues
                                )
                            )
                    ]
                ]
            ];

            /*
            |--------------------------------------------------------------------------
            | If search already exists, combine search + role.
            |--------------------------------------------------------------------------
            */

            if ($search !== "") {

                $searchConditions =
                    $query["\$or"];

                unset(
                    $query["\$or"]
                );

                $query["\$and"] = [

                    [
                        "\$or" =>
                            $searchConditions
                    ],

                    [
                        "\$or" =>
                            $roleConditions
                    ]
                ];

            } else {

                $query["\$or"] =
                    $roleConditions;
            }
        }


        // ----------------------------------------------------
        // Get users
        // ----------------------------------------------------

        $cursor = $users->find(
            $query,
            [
                "sort" => [
                    "created_at" => -1
                ],
                "limit" => $limit,
                "projection" => [
                    "password" => 0,
                    "password_hash" => 0
                ]
            ]
        );


        $userList = [];

        foreach ($cursor as $user) {

            $userList[] =
                serializeUser($user);
        }


        // ----------------------------------------------------
        // Counts
        // ----------------------------------------------------

        $totalUsers =
            $users->countDocuments([]);

        $activeUsers =
            $users->countDocuments([
                "status" => [
                    "\$in" => [
                        "active",
                        "Active"
                    ]
                ]
            ]);

        $pendingUsers =
            $users->countDocuments([
                "status" => [
                    "\$in" => [
                        "pending",
                        "Pending"
                    ]
                ]
            ]);

        $blockedUsers =
            $users->countDocuments([
                "status" => [
                    "\$in" => [
                        "blocked",
                        "Blocked",
                        "suspended",
                        "Suspended",
                        "disabled",
                        "Disabled",
                        "banned",
                        "Banned"
                    ]
                ]
            ]);


        echo json_encode([

            "success" => true,

            "message" =>
                "Users loaded successfully.",

            "stats" => [

                "total" =>
                    $totalUsers,

                "active" =>
                    $activeUsers,

                "pending" =>
                    $pendingUsers,

                "blocked" =>
                    $blockedUsers
            ],

            "users" =>
                $userList,

            "count" =>
                count($userList)
        ]);

        exit;

    } catch (Throwable $e) {

        error_log(
            "Users GET error: " .
            $e->getMessage()
        );

        http_response_code(500);

        echo json_encode([
            "success" => false,
            "message" =>
                "Unable to load users."
        ]);

        exit;
    }
}


// ============================================================
// POST USER ACTION
// ============================================================

if ($_SERVER["REQUEST_METHOD"] === "POST") {

    try {

        // ----------------------------------------------------
        // Read JSON
        // ----------------------------------------------------

        $input = json_decode(
            file_get_contents("php://input"),
            true
        );

        if (!is_array($input)) {
            $input = $_POST;
        }


        // ----------------------------------------------------
        // Action
        // ----------------------------------------------------

        $action = strtolower(
            trim(
                (string)(
                    $input["action"] ?? ""
                )
            )
        );


        // ----------------------------------------------------
        // User ID
        // ----------------------------------------------------

        $userId = trim(
            (string)(
                $input["user_id"] ??
                $input["id"] ??
                ""
            )
        );


        if ($action === "") {

            http_response_code(400);

            echo json_encode([
                "success" => false,
                "message" =>
                    "User action is required."
            ]);

            exit;
        }


        if ($userId === "") {

            http_response_code(400);

            echo json_encode([
                "success" => false,
                "message" =>
                    "User ID is required."
            ]);

            exit;
        }


        // ----------------------------------------------------
        // Validate ObjectId
        // ----------------------------------------------------

        try {

            $objectId =
                new MongoDB\BSON\ObjectId(
                    $userId
                );

        } catch (Throwable $e) {

            http_response_code(400);

            echo json_encode([
                "success" => false,
                "message" =>
                    "Invalid user ID."
            ]);

            exit;
        }


        // ----------------------------------------------------
        // Never allow an admin to modify themselves
        // ----------------------------------------------------

        if (
            (string)$_SESSION["user_id"] ===
            $userId
        ) {

            if (
                in_array(
                    $action,
                    [
                        "block",
                        "suspend",
                        "disable",
                        "delete",
                        "demote"
                    ],
                    true
                )
            ) {

                http_response_code(403);

                echo json_encode([
                    "success" => false,
                    "message" =>
                        "You cannot perform this action on your own administrator account."
                ]);

                exit;
            }
        }


        // ----------------------------------------------------
        // Find user
        // ----------------------------------------------------

        $existingUser =
            $users->findOne([
                "_id" => $objectId
            ]);


        if (!$existingUser) {

            http_response_code(404);

            echo json_encode([
                "success" => false,
                "message" =>
                    "User account was not found."
            ]);

            exit;
        }


        // ----------------------------------------------------
        // BLOCK
        // ----------------------------------------------------

        if ($action === "block") {

            $users->updateOne(

                [
                    "_id" => $objectId
                ],

                [
                    "\$set" => [

                        "status" =>
                            "blocked",

                        "updated_at" =>
                            new MongoDB\BSON\UTCDateTime()
                    ]
                ]
            );


            echo json_encode([
                "success" => true,
                "message" =>
                    "User blocked successfully."
            ]);

            exit;
        }


        // ----------------------------------------------------
        // UNBLOCK / ACTIVATE
        // ----------------------------------------------------

        if (
            $action === "unblock" ||
            $action === "activate"
        ) {

            $users->updateOne(

                [
                    "_id" => $objectId
                ],

                [
                    "\$set" => [

                        "status" =>
                            "active",

                        "updated_at" =>
                            new MongoDB\BSON\UTCDateTime()
                    ]
                ]
            );


            echo json_encode([
                "success" => true,
                "message" =>
                    "User activated successfully."
            ]);

            exit;
        }


        // ----------------------------------------------------
        // SUSPEND
        // ----------------------------------------------------

        if ($action === "suspend") {

            $users->updateOne(

                [
                    "_id" => $objectId
                ],

                [
                    "\$set" => [

                        "status" =>
                            "suspended",

                        "updated_at" =>
                            new MongoDB\BSON\UTCDateTime()
                    ]
                ]
            );


            echo json_encode([
                "success" => true,
                "message" =>
                    "User suspended successfully."
            ]);

            exit;
        }


        // ----------------------------------------------------
        // DELETE
        // ----------------------------------------------------

        if ($action === "delete") {

            /*
            |--------------------------------------------------------------------------
            | We do NOT permanently delete the account.
            |
            | Instead we mark it disabled.
            | This protects financial/audit history.
            |--------------------------------------------------------------------------
            */

            $users->updateOne(

                [
                    "_id" => $objectId
                ],

                [
                    "\$set" => [

                        "status" =>
                            "disabled",

                        "deleted_at" =>
                            new MongoDB\BSON\UTCDateTime(),

                        "updated_at" =>
                            new MongoDB\BSON\UTCDateTime()
                    ]
                ]
            );


            echo json_encode([
                "success" => true,
                "message" =>
                    "User account disabled successfully."
            ]);

            exit;
        }


        // ----------------------------------------------------
        // CHANGE ROLE
        // ----------------------------------------------------

        if ($action === "change_role") {

            $newRole = strtolower(
                trim(
                    (string)(
                        $input["role"] ?? ""
                    )
                )
            );


            if (
                $newRole !== "user" &&
                $newRole !== "admin"
            ) {

                http_response_code(400);

                echo json_encode([
                    "success" => false,
                    "message" =>
                        "Invalid role."
                ]);

                exit;
            }


            $users->updateOne(

                [
                    "_id" => $objectId
                ],

                [
                    "\$set" => [

                        "role" =>
                            $newRole,

                        "account_type" =>
                            $newRole,

                        "updated_at" =>
                            new MongoDB\BSON\UTCDateTime()
                    ]
                ]
            );


            echo json_encode([
                "success" => true,
                "message" =>
                    "User role updated successfully."
            ]);

            exit;
        }


        // ----------------------------------------------------
        // Unknown action
        // ----------------------------------------------------

        http_response_code(400);

        echo json_encode([
            "success" => false,
            "message" =>
                "Unknown user action."
        ]);

        exit;


    } catch (Throwable $e) {

        error_log(
            "Users POST error: " .
            $e->getMessage()
        );

        http_response_code(500);

        echo json_encode([
            "success" => false,
            "message" =>
                "Unable to perform user action."
        ]);

        exit;
    }
}


// ============================================================
// END
// ============================================================

http_response_code(405);

echo json_encode([
    "success" => false,
    "message" => "Method not allowed."
]);

?>