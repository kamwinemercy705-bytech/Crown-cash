<?php

declare(strict_types=1);

/*
|--------------------------------------------------------------------------
| Crown Cash - Admin Users API
|--------------------------------------------------------------------------
| ADMIN ONLY
|
| This endpoint allows an authorized administrator to:
| - View users
| - Search users
| - Filter users
| - Activate users
| - Block users
| - Suspend users
| - Soft-disable users
| - Change user/admin role
|
| It does NOT permanently delete financial history.
|--------------------------------------------------------------------------
*/

require_once __DIR__ . "/admin-auth.php";
require_once __DIR__ . "/config.php";


/* =========================
   HELPERS
========================= */

function usersValueToString($value): string
{
    if ($value === null) {
        return "";
    }

    if ($value instanceof MongoDB\BSON\ObjectId) {
        return (string)$value;
    }

    if ($value instanceof MongoDB\BSON\Decimal128) {
        return $value->__toString();
    }

    if ($value instanceof MongoDB\BSON\Int64) {
        return $value->__toString();
    }

    if ($value instanceof MongoDB\BSON\Int32) {
        return (string)$value;
    }

    return (string)$value;
}


function usersNumber($value): float
{
    if ($value instanceof MongoDB\BSON\Decimal128) {
        return (float)$value->__toString();
    }

    if ($value instanceof MongoDB\BSON\Int64) {
        return (float)$value->__toString();
    }

    if ($value instanceof MongoDB\BSON\Int32) {
        return (float)$value->__toString();
    }

    if (is_numeric($value)) {
        return (float)$value;
    }

    return 0.0;
}


function usersDate($value): string
{
    if (
        $value instanceof MongoDB\BSON\UTCDateTime
    ) {
        return $value
            ->toDateTime()
            ->format(DATE_ATOM);
    }

    if ($value instanceof DateTimeInterface) {
        return $value->format(DATE_ATOM);
    }

    if (is_string($value)) {
        return $value;
    }

    return "";
}


function getUserFullName($user): string
{
    $fullName =
        trim(
            usersValueToString(
                $user["full_name"] ?? ""
            )
        );

    if ($fullName !== "") {
        return $fullName;
    }

    $firstName =
        trim(
            usersValueToString(
                $user["first_name"] ?? ""
            )
        );

    $lastName =
        trim(
            usersValueToString(
                $user["last_name"] ?? ""
            )
        );

    return trim(
        $firstName . " " . $lastName
    );
}


function serializeUser($user): array
{
    $role =
        strtolower(
            trim(
                usersValueToString(
                    $user["role"] ??
                    $user["account_type"] ??
                    "user"
                )
            )
        );

    $status =
        strtolower(
            trim(
                usersValueToString(
                    $user["status"] ??
                    "active"
                )
            )
        );

    return [

        "id" =>
            isset($user["_id"])
                ? usersValueToString(
                    $user["_id"]
                )
                : "",

        "full_name" =>
            getUserFullName($user),

        "first_name" =>
            usersValueToString(
                $user["first_name"] ?? ""
            ),

        "last_name" =>
            usersValueToString(
                $user["last_name"] ?? ""
            ),

        "email" =>
            usersValueToString(
                $user["email"] ?? ""
            ),

        "phone" =>
            usersValueToString(
                $user["phone"] ?? ""
            ),

        "referral_code" =>
            usersValueToString(
                $user["referral_code"] ?? ""
            ),

        "balance" =>
            usersNumber(
                $user["balance"] ?? 0
            ),

        "status" =>
            $status,

        "role" =>
            $role,

        "account_type" =>
            usersValueToString(
                $user["account_type"] ?? "user"
            ),

        "created_at" =>
            usersDate(
                $user["created_at"] ?? null
            ),

        "updated_at" =>
            usersDate(
                $user["updated_at"] ?? null
            )
    ];
}


/* =========================
   GET USERS
========================= */

if (
    ($_SERVER["REQUEST_METHOD"] ?? "GET") === "GET"
) {

    try {

        $search =
            trim(
                (string)(
                    $_GET["search"] ?? ""
                )
            );


        $status =
            strtolower(
                trim(
                    (string)(
                        $_GET["status"] ?? ""
                    )
                )
            );


        $role =
            strtolower(
                trim(
                    (string)(
                        $_GET["role"] ?? ""
                    )
                )
            );


        $limit =
            (int)(
                $_GET["limit"] ?? 100
            );


        if ($limit < 1) {
            $limit = 100;
        }


        if ($limit > 500) {
            $limit = 500;
        }


        $filter = [];


        /* =========================
           SEARCH
        ========================= */

        if ($search !== "") {

            $escapedSearch =
                preg_quote(
                    $search,
                    "/"
                );


            $filter["$or"] = [

                [
                    "full_name" => [
                        '$regex' =>
                            $escapedSearch,
                        '$options' =>
                            "i"
                    ]
                ],

                [
                    "first_name" => [
                        '$regex' =>
                            $escapedSearch,
                        '$options' =>
                            "i"
                    ]
                ],

                [
                    "last_name" => [
                        '$regex' =>
                            $escapedSearch,
                        '$options' =>
                            "i"
                    ]
                ],

                [
                    "email" => [
                        '$regex' =>
                            $escapedSearch,
                        '$options' =>
                            "i"
                    ]
                ],

                [
                    "phone" => [
                        '$regex' =>
                            $escapedSearch,
                        '$options' =>
                            "i"
                    ]
                ],

                [
                    "referral_code" => [
                        '$regex' =>
                            $escapedSearch,
                        '$options' =>
                            "i"
                    ]
                ]
            ];
        }


        /* =========================
           STATUS FILTER
        ========================= */

        if (
            $status !== "" &&
            $status !== "all"
        ) {

            $filter["status"] =
                $status;
        }


        /* =========================
           ROLE FILTER
        ========================= */

        if (
            $role !== "" &&
            $role !== "all"
        ) {

            $filter["role"] =
                $role;
        }


        /* =========================
           GET USERS
        ========================= */

        $cursor =
            $users->find(
                $filter,
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


        $result = [];


        foreach ($cursor as $user) {

            $result[] =
                serializeUser($user);
        }


        /* =========================
           STATISTICS
        ========================= */

        $total =
            $users->countDocuments();


        $active =
            $users->countDocuments([
                "status" => "active"
            ]);


        $pending =
            $users->countDocuments([
                "status" => "pending"
            ]);


        $blocked =
            $users->countDocuments([
                "status" => [
                    '$in' => [
                        "blocked",
                        "suspended",
                        "disabled"
                    ]
                ]
            ]);


        echo json_encode([

            "success" => true,

            "users" =>
                $result,

            "stats" => [

                "total" =>
                    $total,

                "active" =>
                    $active,

                "pending" =>
                    $pending,

                "blocked" =>
                    $blocked
            ]

        ]);

        exit;

    } catch (Throwable $e) {

        error_log(
            "Admin users GET error: " .
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


/* =========================
   POST ADMIN ACTION
========================= */

if (
    ($_SERVER["REQUEST_METHOD"] ?? "") === "POST"
) {

    try {

        $raw =
            file_get_contents(
                "php://input"
            );


        $data =
            json_decode(
                $raw,
                true
            );


        if (
            !is_array($data)
        ) {

            http_response_code(400);

            echo json_encode([

                "success" => false,

                "message" =>
                    "Invalid request data."

            ]);

            exit;
        }


        $action =
            strtolower(
                trim(
                    (string)(
                        $data["action"] ?? ""
                    )
                )
            );


        $userId =
            trim(
                (string)(
                    $data["user_id"] ?? ""
                )
            );


        if ($action === "") {

            http_response_code(400);

            echo json_encode([

                "success" => false,

                "message" =>
                    "Action is required."

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


        /* =========================
           VALIDATE OBJECT ID
        ========================= */

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


        /* =========================
           FIND TARGET USER
        ========================= */

        $targetUser =
            $users->findOne([
                "_id" => $objectId
            ]);


        if (!$targetUser) {

            http_response_code(404);

            echo json_encode([

                "success" => false,

                "message" =>
                    "User account was not found."

            ]);

            exit;
        }


        /* =========================
           CURRENT ADMIN
        ========================= */

        $currentAdminId =
            (string)(
                $_SESSION["user_id"] ?? ""
            );


        $targetUserId =
            (string)$targetUser["_id"];


        $targetRole =
            strtolower(
                trim(
                    usersValueToString(
                        $targetUser["role"] ??
                        $targetUser["account_type"] ??
                        "user"
                    )
                )
            );


        /* =========================
           PROTECT OWN ADMIN ACCOUNT
        ========================= */

        $protectedActions = [

            "block",

            "suspend",

            "disable",

            "delete",

            "change_role",

            "demote"
        ];


        if (
            $currentAdminId ===
            $targetUserId &&
            in_array(
                $action,
                $protectedActions,
                true
            )
        ) {

            http_response_code(403);

            echo json_encode([

                "success" => false,

                "message" =>
                    "You cannot modify your own administrator account."

            ]);

            exit;
        }


        /* =========================
           PROTECT ADMIN ACCOUNTS
        ========================= */

        if (
            $targetRole === "admin" &&
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
                    "Administrator accounts cannot be disabled from this endpoint."

            ]);

            exit;
        }


        /* =========================
           BLOCK
        ========================= */

        if ($action === "block") {

            $users->updateOne(

                [
                    "_id" => $objectId
                ],

                [
                    '$set' => [
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
                    "User account has been blocked."

            ]);

            exit;
        }


        /* =========================
           UNBLOCK / ACTIVATE
        ========================= */

        if (
            $action === "unblock" ||
            $action === "activate"
        ) {

            $users->updateOne(

                [
                    "_id" => $objectId
                ],

                [
                    '$set' => [

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
                    "User account has been activated."

            ]);

            exit;
        }


        /* =========================
           SUSPEND
        ========================= */

        if ($action === "suspend") {

            $users->updateOne(

                [
                    "_id" => $objectId
                ],

                [
                    '$set' => [

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
                    "User account has been suspended."

            ]);

            exit;
        }


        /* =========================
           DELETE
        ========================= */

        if ($action === "delete") {

            /*
             * We intentionally DO NOT permanently
             * delete financial accounts.
             *
             * Instead the account is disabled.
             */

            $users->updateOne(

                [
                    "_id" => $objectId
                ],

                [
                    '$set' => [

                        "status" =>
                            "disabled",

                        "account_deleted" =>
                            true,

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
                    "User account has been disabled."

            ]);

            exit;
        }


        /* =========================
           CHANGE ROLE
        ========================= */

        if ($action === "change_role") {

            $newRole =
                strtolower(
                    trim(
                        (string)(
                            $data["role"] ?? ""
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


            /*
             * IMPORTANT:
             *
             * We are not allowing an admin
             * to promote another user here.
             *
             * This protects your requirement:
             *
             * "Only me should access admin."
             */

            if ($newRole === "admin") {

                http_response_code(403);

                echo json_encode([

                    "success" => false,

                    "message" =>
                        "New administrator accounts must be configured by the system owner."

                ]);

                exit;
            }


            $users->updateOne(

                [
                    "_id" => $objectId
                ],

                [
                    '$set' => [

                        "role" =>
                            "user",

                        "account_type" =>
                            "user",

                        "updated_at" =>
                            new MongoDB\BSON\UTCDateTime()
                    ]
                ]
            );


            echo json_encode([

                "success" => true,

                "message" =>
                    "Administrator access removed."

            ]);

            exit;
        }


        /* =========================
           UNKNOWN ACTION
        ========================= */

        http_response_code(400);

        echo json_encode([

            "success" => false,

            "message" =>
                "Unknown administrator action."

        ]);

        exit;

    } catch (Throwable $e) {

        error_log(
            "Admin users POST error: " .
            $e->getMessage()
        );


        http_response_code(500);

        echo json_encode([

            "success" => false,

            "message" =>
                "Unable to process administrator action."

        ]);

        exit;
    }
}


/* =========================
   METHOD NOT ALLOWED
========================= */

http_response_code(405);

echo json_encode([

    "success" => false,

    "message" =>
        "Method not allowed."

]);

exit;
?>