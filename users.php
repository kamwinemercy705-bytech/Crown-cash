<?php

declare(strict_types=1);

/*
|--------------------------------------------------------------------------
| Crown Cash - Admin Users API
|--------------------------------------------------------------------------
| Protected by admin-auth.php
|
| Features:
| - List users
| - Search users
| - Filter by status
| - Filter by role
| - Block / activate users
| - Suspend users
| - Disable users
| - Change normal user role
|
| Security:
| - Only the designated administrator can access this API
| - The designated administrator cannot be modified
| - Existing administrators cannot be modified
| - New administrators cannot be created from this page
|--------------------------------------------------------------------------
*/

require_once __DIR__ . "/admin-auth.php";

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


/*
|--------------------------------------------------------------------------
| OPTIONS
|--------------------------------------------------------------------------
*/

if ($_SERVER["REQUEST_METHOD"] === "OPTIONS") {
    http_response_code(204);
    exit;
}


/*
|--------------------------------------------------------------------------
| Helper: JSON response
|--------------------------------------------------------------------------
*/

function usersResponse(
    bool $success,
    string $message = "",
    array $data = [],
    int $statusCode = 200
): void {

    http_response_code($statusCode);

    echo json_encode(
        array_merge(
            [
                "success" => $success,
                "message" => $message
            ],
            $data
        ),
        JSON_UNESCAPED_SLASHES
    );

    exit;
}


/*
|--------------------------------------------------------------------------
| Get current administrator ID
|--------------------------------------------------------------------------
*/

$currentAdminId = (string)($_SESSION["user_id"] ?? "");


/*
|--------------------------------------------------------------------------
| GET - List users
|--------------------------------------------------------------------------
*/

if ($_SERVER["REQUEST_METHOD"] === "GET") {

    try {

        $search = trim(
            (string)($_GET["search"] ?? "")
        );

        $status = strtolower(
            trim((string)($_GET["status"] ?? ""))
        );

        $role = strtolower(
            trim((string)($_GET["role"] ?? ""))
        );

        $limit = (int)($_GET["limit"] ?? 100);

        if ($limit < 1) {
            $limit = 100;
        }

        if ($limit > 500) {
            $limit = 500;
        }


        /*
        |--------------------------------------------------------------------------
        | Build query
        |--------------------------------------------------------------------------
        */

        $query = [];


        /*
        |--------------------------------------------------------------------------
        | Search
        |--------------------------------------------------------------------------
        */

        if ($search !== "") {

            $query["\$or"] = [
                [
                    "full_name" => [
                        "\$regex" => preg_quote($search),
                        "\$options" => "i"
                    ]
                ],
                [
                    "email" => [
                        "\$regex" => preg_quote($search),
                        "\$options" => "i"
                    ]
                ],
                [
                    "phone" => [
                        "\$regex" => preg_quote($search),
                        "\$options" => "i"
                    ]
                ],
                [
                    "referral_code" => [
                        "\$regex" => preg_quote($search),
                        "\$options" => "i"
                    ]
                ]
            ];
        }


        /*
        |--------------------------------------------------------------------------
        | Status filter
        |--------------------------------------------------------------------------
        */

        if ($status !== "") {
            $query["status"] = $status;
        }


        /*
        |--------------------------------------------------------------------------
        | Role filter
        |--------------------------------------------------------------------------
        */

        if ($role !== "") {

            if ($role === "admin") {

                $query["\$or"] = [
                    [
                        "role" => "admin"
                    ],
                    [
                        "account_type" => "admin"
                    ]
                ];

            } else {

                $query["role"] = $role;
            }
        }


        /*
        |--------------------------------------------------------------------------
        | Get users
        |--------------------------------------------------------------------------
        */

        $cursor = $users->find(
            $query,
            [
                "limit" => $limit,
                "sort" => [
                    "_id" => -1
                ],
                "projection" => [
                    "password" => 0,
                    "password_hash" => 0
                ]
            ]
        );


        $userList = [];


        foreach ($cursor as $user) {

            $id = isset($user["_id"])
                ? (string)$user["_id"]
                : "";

            $fullName = trim(
                (string)($user["full_name"] ?? "")
            );

            $email = trim(
                (string)($user["email"] ?? "")
            );

            $phone = trim(
                (string)($user["phone"] ?? "")
            );

            $userStatus = strtolower(
                trim((string)($user["status"] ?? "active"))
            );

            $userRole = strtolower(
                trim((string)(
                    $user["role"]
                    ?? $user["account_type"]
                    ?? "user"
                ))
            );


            /*
            |--------------------------------------------------------------------------
            | Created date
            |--------------------------------------------------------------------------
            */

            $createdAt = "";

            if (
                isset($user["created_at"]) &&
                $user["created_at"]
                    instanceof MongoDB\BSON\UTCDateTime
            ) {

                $createdAt =
                    $user["created_at"]
                        ->toDateTime()
                        ->format("Y-m-d H:i:s");
            }


            /*
            |--------------------------------------------------------------------------
            | Balance
            |--------------------------------------------------------------------------
            */

            $balance = $user["balance"] ?? 0;

            if (
                $balance
                    instanceof MongoDB\BSON\Decimal128
            ) {

                $balance = (float)$balance->__toString();

            } elseif (
                $balance
                    instanceof MongoDB\BSON\Int64
            ) {

                $balance = (float)$balance->__toString();

            } else {

                $balance = (float)$balance;
            }


            /*
            |--------------------------------------------------------------------------
            | Protect sensitive fields
            |--------------------------------------------------------------------------
            */

            $userList[] = [
                "id" => $id,
                "full_name" => $fullName,
                "email" => $email,
                "phone" => $phone,
                "status" => $userStatus,
                "role" => $userRole,
                "account_type" =>
                    (string)($user["account_type"] ?? "user"),
                "balance" => $balance,
                "referral_code" =>
                    (string)($user["referral_code"] ?? ""),
                "created_at" => $createdAt,
                "is_current_admin" =>
                    $id !== "" &&
                    $id === $currentAdminId
            ];
        }


        /*
        |--------------------------------------------------------------------------
        | Statistics
        |--------------------------------------------------------------------------
        */

        $totalUsers = $users->countDocuments([]);

        $activeUsers = $users->countDocuments([
            "status" => "active"
        ]);

        $blockedUsers = $users->countDocuments([
            "status" => [
                "\$in" => [
                    "blocked",
                    "suspended",
                    "disabled",
                    "banned"
                ]
            ]
        ]);

        $adminUsers = $users->countDocuments([
            "\$or" => [
                [
                    "role" => "admin"
                ],
                [
                    "account_type" => "admin"
                ]
            ]
        ]);


        usersResponse(
            true,
            "Users loaded successfully.",
            [
                "users" => $userList,
                "stats" => [
                    "total" => $totalUsers,
                    "active" => $activeUsers,
                    "blocked" => $blockedUsers,
                    "admins" => $adminUsers
                ]
            ]
        );

    } catch (MongoDB\Driver\Exception\Exception $e) {

        error_log(
            "Users GET MongoDB error: " .
            $e->getMessage()
        );

        usersResponse(
            false,
            "Unable to load users.",
            [],
            500
        );

    } catch (Throwable $e) {

        error_log(
            "Users GET error: " .
            $e->getMessage()
        );

        usersResponse(
            false,
            "Unable to load users.",
            [],
            500
        );
    }
}


/*
|--------------------------------------------------------------------------
| POST - User management
|--------------------------------------------------------------------------
*/

if ($_SERVER["REQUEST_METHOD"] === "POST") {

    try {

        $rawInput = file_get_contents("php://input");

        $data = json_decode(
            $rawInput,
            true
        );

        if (!is_array($data)) {

            usersResponse(
                false,
                "Invalid request data.",
                [],
                400
            );
        }


        $action = strtolower(
            trim((string)($data["action"] ?? ""))
        );

        $targetId = trim(
            (string)($data["user_id"] ?? "")
        );


        /*
        |--------------------------------------------------------------------------
        | Validate action
        |--------------------------------------------------------------------------
        */

        $allowedActions = [
            "block",
            "activate",
            "unblock",
            "suspend",
            "disable",
            "change_role"
        ];

        if (!in_array($action, $allowedActions, true)) {

            usersResponse(
                false,
                "Invalid user management action.",
                [],
                400
            );
        }


        /*
        |--------------------------------------------------------------------------
        | Validate target ID
        |--------------------------------------------------------------------------
        */

        if ($targetId === "") {

            usersResponse(
                false,
                "User ID is required.",
                [],
                400
            );
        }

        try {

            $targetObjectId =
                new MongoDB\BSON\ObjectId($targetId);

        } catch (Throwable $e) {

            usersResponse(
                false,
                "Invalid user ID.",
                [],
                400
            );
        }


        /*
        |--------------------------------------------------------------------------
        | Find target user
        |--------------------------------------------------------------------------
        */

        $targetUser = $users->findOne([
            "_id" => $targetObjectId
        ]);

        if (!$targetUser) {

            usersResponse(
                false,
                "User account was not found.",
                [],
                404
            );
        }


        $targetRole = strtolower(
            trim((string)(
                $targetUser["role"]
                ?? $targetUser["account_type"]
                ?? "user"
            ))
        );


        /*
        |--------------------------------------------------------------------------
        | NEVER modify the currently logged-in administrator
        |--------------------------------------------------------------------------
        */

        if ($targetId === $currentAdminId) {

            usersResponse(
                false,
                "Your administrator account cannot be modified from the Users page.",
                [],
                403
            );
        }


        /*
        |--------------------------------------------------------------------------
        | NEVER modify another administrator
        |--------------------------------------------------------------------------
        */

        if ($targetRole === "admin") {

            usersResponse(
                false,
                "Administrator accounts cannot be modified from this page.",
                [],
                403
            );
        }


        /*
        |--------------------------------------------------------------------------
        | NEVER create another administrator
        |--------------------------------------------------------------------------
        */

        if ($action === "change_role") {

            $newRole = strtolower(
                trim((string)(
                    $data["role"] ?? ""
                ))
            );

            if ($newRole === "") {

                usersResponse(
                    false,
                    "New role is required.",
                    [],
                    400
                );
            }


            /*
            | Only normal user role is allowed here.
            */

            if ($newRole !== "user") {

                usersResponse(
                    false,
                    "New administrator accounts must be configured by the system owner.",
                    [],
                    403
                );
            }


            $result = $users->updateOne(
                [
                    "_id" => $targetObjectId,
                    "role" => [
                        "\$ne" => "admin"
                    ]
                ],
                [
                    "\$set" => [
                        "role" => "user",
                        "account_type" => "user",
                        "updated_at" =>
                            new MongoDB\BSON\UTCDateTime()
                    ]
                ]
            );


            if ($result->getModifiedCount() !== 1) {

                usersResponse(
                    false,
                    "User role was not changed.",
                    [],
                    400
                );
            }


            usersResponse(
                true,
                "User role updated successfully."
            );
        }


        /*
        |--------------------------------------------------------------------------
        | Determine new status
        |--------------------------------------------------------------------------
        */

        $newStatus = null;

        switch ($action) {

            case "block":
                $newStatus = "blocked";
                break;

            case "suspend":
                $newStatus = "suspended";
                break;

            case "disable":
                $newStatus = "disabled";
                break;

            case "activate":
            case "unblock":
                $newStatus = "active";
                break;
        }


        /*
        |--------------------------------------------------------------------------
        | Update user
        |--------------------------------------------------------------------------
        */

        $result = $users->updateOne(
            [
                "_id" => $targetObjectId,
                "role" => [
                    "\$ne" => "admin"
                ]
            ],
            [
                "\$set" => [
                    "status" => $newStatus,
                    "updated_at" =>
                        new MongoDB\BSON\UTCDateTime()
                ]
            ]
        );


        /*
        |--------------------------------------------------------------------------
        | Check result
        |--------------------------------------------------------------------------
        */

        if ($result->getMatchedCount() !== 1) {

            usersResponse(
                false,
                "User could not be modified.",
                [],
                400
            );
        }


        if ($result->getModifiedCount() !== 1) {

            usersResponse(
                true,
                "User already has this status."
            );
        }


        /*
        |--------------------------------------------------------------------------
        | Success
        |--------------------------------------------------------------------------
        */

        usersResponse(
            true,
            "User status updated successfully."
        );

    } catch (MongoDB\Driver\Exception\Exception $e) {

        error_log(
            "Users POST MongoDB error: " .
            $e->getMessage()
        );

        usersResponse(
            false,
            "Database error while updating user.",
            [],
            500
        );

    } catch (Throwable $e) {

        error_log(
            "Users POST error: " .
            $e->getMessage()
        );

        usersResponse(
            false,
            "Unable to update user.",
            [],
            500
        );
    }
}


/*
|--------------------------------------------------------------------------
| Unsupported method
|--------------------------------------------------------------------------
*/

usersResponse(
    false,
    "Method not allowed.",
    [],
    405
);

?>