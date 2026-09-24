<?php

declare(strict_types=1);

/*
|--------------------------------------------------------------------------
| Crown Cash - Admin User Actions API
|--------------------------------------------------------------------------
|
| POST /admin-user-actions.php
|
| Supported actions:
|
|   activate
|   suspend
|   block
|   disable
|   reactivate
|
| Required JSON:
|
| {
|     "user_id": "USER_OBJECT_ID",
|     "action": "suspend"
| }
|
|--------------------------------------------------------------------------
*/


/* =========================================================
   CORS
========================================================= */

header(
    "Content-Type: application/json; charset=utf-8"
);

header(
    "Access-Control-Allow-Origin: https://crown-cash.vercel.app"
);

header(
    "Access-Control-Allow-Credentials: true"
);

header(
    "Access-Control-Allow-Methods: POST, OPTIONS"
);

header(
    "Access-Control-Allow-Headers: Content-Type"
);


/* =========================================================
   OPTIONS
========================================================= */

if (
    $_SERVER["REQUEST_METHOD"] === "OPTIONS"
) {

    http_response_code(204);

    exit;
}


/* =========================================================
   METHOD CHECK
========================================================= */

if (
    $_SERVER["REQUEST_METHOD"] !== "POST"
) {

    http_response_code(405);

    echo json_encode([
        "success" => false,
        "message" => "Method not allowed."
    ]);

    exit;
}


/* =========================================================
   SECURE SESSION
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
   RESPONSE HELPER
========================================================= */

function jsonResponse(
    bool $success,
    string $message,
    array $data = [],
    int $statusCode = 200
): never {

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


/* =========================================================
   AUTHENTICATION
========================================================= */

if (
    !isset($_SESSION["logged_in"]) ||
    $_SESSION["logged_in"] !== true ||
    empty($_SESSION["user_id"])
) {

    jsonResponse(
        false,
        "Please login first.",
        [],
        401
    );
}


/* =========================================================
   DATABASE
========================================================= */

try {

    require_once __DIR__ . "/config.php";

} catch (Throwable $e) {

    error_log(
        "admin-user-actions config error: " .
        $e->getMessage()
    );

    jsonResponse(
        false,
        "Database configuration error.",
        [],
        500
    );
}


/* =========================================================
   ADMIN AUTHORIZATION
========================================================= */

try {

    $users =
        $db->selectCollection("users");


    $adminId =
        (string)$_SESSION["user_id"];


    $adminUser = null;


    /* -----------------------------------------------
       Try ObjectId
    ------------------------------------------------ */

    try {

        $adminObjectId =
            new MongoDB\BSON\ObjectId(
                $adminId
            );

        $adminUser =
            $users->findOne([
                "_id" => $adminObjectId
            ]);

    } catch (Throwable $e) {

        $adminUser = null;
    }


    /* -----------------------------------------------
       Try string ID
    ------------------------------------------------ */

    if (!$adminUser) {

        $adminUser =
            $users->findOne([
                "_id" => $adminId
            ]);
    }


    if (!$adminUser) {

        jsonResponse(
            false,
            "Administrator account was not found.",
            [],
            403
        );
    }


    /* =================================================
       ADMIN STATUS
    ================================================= */

    $adminStatus =
        strtolower(
            trim(
                (string)(
                    $adminUser["status"]
                    ?? "active"
                )
            )
        );


    $blockedStatuses = [
        "blocked",
        "suspended",
        "disabled",
        "banned",
        "inactive"
    ];


    if (
        in_array(
            $adminStatus,
            $blockedStatuses,
            true
        )
    ) {

        jsonResponse(
            false,
            "Administrator account is not active.",
            [],
            403
        );
    }


    /* =================================================
       ADMIN ROLE
    ================================================= */

    $adminRole =
        strtolower(
            trim(
                (string)(
                    $adminUser["role"]
                    ?? ""
                )
            )
        );


    $adminAccountType =
        strtolower(
            trim(
                (string)(
                    $adminUser["account_type"]
                    ?? ""
                )
            )
        );


    $isAdmin =
        (
            $adminRole === "admin" ||
            $adminRole === "administrator" ||
            $adminAccountType === "admin" ||
            $adminAccountType === "administrator"
        );


    if (!$isAdmin) {

        jsonResponse(
            false,
            "Administrator access required.",
            [],
            403
        );
    }


    /* =================================================
       ADMIN USER ID LOCK
    ================================================= */

    $configuredAdminId =
        trim(
            (string)(
                getenv("ADMIN_USER_ID")
                ?: ""
            )
        );


    if (
        $configuredAdminId !== "" &&
        $configuredAdminId !== $adminId
    ) {

        jsonResponse(
            false,
            "Administrator access denied.",
            [],
            403
        );
    }


    /* =================================================
       READ REQUEST
    ================================================= */

    $rawInput =
        file_get_contents("php://input");


    $payload =
        json_decode(
            $rawInput ?: "",
            true
        );


    if (
        !is_array($payload)
    ) {

        jsonResponse(
            false,
            "Invalid request data.",
            [],
            400
        );
    }


    $targetUserId =
        trim(
            (string)(
                $payload["user_id"]
                ?? ""
            )
        );


    $action =
        strtolower(
            trim(
                (string)(
                    $payload["action"]
                    ?? ""
                )
            )
        );


    if (
        $targetUserId === ""
    ) {

        jsonResponse(
            false,
            "User ID is required.",
            [],
            400
        );
    }


    if (
        $action === ""
    ) {

        jsonResponse(
            false,
            "Action is required.",
            [],
            400
        );
    }


    /* =================================================
       ALLOWED ACTIONS
    ================================================= */

    $allowedActions = [
        "activate",
        "suspend",
        "block",
        "disable",
        "reactivate"
    ];


    if (
        !in_array(
            $action,
            $allowedActions,
            true
        )
    ) {

        jsonResponse(
            false,
            "Invalid user action.",
            [],
            400
        );
    }


    /* =================================================
       PREVENT ADMIN SELF-BLOCKING
    ================================================= */

    if (
        $targetUserId === $adminId
    ) {

        if (
            in_array(
                $action,
                [
                    "suspend",
                    "block",
                    "disable"
                ],
                true
            )
        ) {

            jsonResponse(
                false,
                "You cannot disable your own administrator account.",
                [],
                400
            );
        }
    }


    /* =================================================
       FIND TARGET USER
    ================================================= */

    $targetUser = null;


    try {

        $targetObjectId =
            new MongoDB\BSON\ObjectId(
                $targetUserId
            );

        $targetUser =
            $users->findOne([
                "_id" => $targetObjectId
            ]);

    } catch (Throwable $e) {

        $targetUser = null;
    }


    /* -----------------------------------------------
       String ID fallback
    ------------------------------------------------ */

    if (!$targetUser) {

        $targetUser =
            $users->findOne([
                "_id" => $targetUserId
            ]);
    }


    if (!$targetUser) {

        jsonResponse(
            false,
            "User account was not found.",
            [],
            404
        );
    }


    /* =================================================
       TARGET USER ID
    ================================================= */

    $targetId = "";


    if (
        isset($targetUser["_id"]) &&
        $targetUser["_id"] instanceof MongoDB\BSON\ObjectId
    ) {

        $targetId =
            (string)$targetUser["_id"];

    } else {

        $targetId =
            (string)(
                $targetUser["_id"]
                ?? $targetUserId
            );
    }


    /* =================================================
       PREVENT ADMIN ACCOUNT MODIFICATION
    ================================================= */

    $targetRole =
        strtolower(
            trim(
                (string)(
                    $targetUser["role"]
                    ?? ""
                )
            )
        );


    $targetAccountType =
        strtolower(
            trim(
                (string)(
                    $targetUser["account_type"]
                    ?? ""
                )
            )
        );


    $targetIsAdmin =
        (
            $targetRole === "admin" ||
            $targetRole === "administrator" ||
            $targetAccountType === "admin" ||
            $targetAccountType === "administrator"
        );


    if (
        $targetIsAdmin &&
        $targetId !== $adminId
    ) {

        jsonResponse(
            false,
            "Administrator accounts cannot be modified from this user-management action.",
            [],
            403
        );
    }


    /* =================================================
       OLD STATUS
    ================================================= */

    $oldStatus =
        strtolower(
            trim(
                (string)(
                    $targetUser["status"]
                    ?? "active"
                )
            )
        );


    /* =================================================
       NEW STATUS
    ================================================= */

    $newStatus = match ($action) {

        "activate" =>
            "active",

        "reactivate" =>
            "active",

        "suspend" =>
            "suspended",

        "block" =>
            "blocked",

        "disable" =>
            "disabled",

        default =>
            $oldStatus
    };


    /* =================================================
       NO-OP CHECK
    ================================================= */

    if (
        $oldStatus === $newStatus
    ) {

        jsonResponse(
            true,
            "User account is already " .
            $newStatus .
            ".",
            [
                "user" => [
                    "id" => $targetId,
                    "status" => $newStatus
                ]
            ]
        );
    }


    /* =================================================
       UPDATE USER
    ================================================= */

    $now =
        new MongoDB\BSON\UTCDateTime();


    $updateResult =
        $users->updateOne(
            [
                "_id" =>
                    $targetUser["_id"]
            ],
            [
                '$set' => [
                    "status" =>
                        $newStatus,

                    "updated_at" =>
                        $now,

                    "status_updated_at" =>
                        $now,

                    "status_updated_by" =>
                        $adminId
                ]
            ]
        );


    if (
        $updateResult->getMatchedCount() < 1
    ) {

        jsonResponse(
            false,
            "User account could not be updated.",
            [],
            500
        );
    }


    /* =================================================
       AUDIT LOG
    ================================================= */

    try {

        $auditLogs =
            $db->selectCollection(
                "audit_logs"
            );


        $auditLogs->insertOne([

            "action" =>
                "admin_user_status_change",

            "type" =>
                "user_account",

            "admin_user_id" =>
                $adminId,

            "target_user_id" =>
                $targetId,

            "old_status" =>
                $oldStatus,

            "new_status" =>
                $newStatus,

            "admin_action" =>
                $action,

            "created_at" =>
                $now,

            "timestamp" =>
                $now
        ]);

    } catch (Throwable $e) {

        /*
         * The user status has already been changed.
         * Do not reverse the successful action simply
         * because audit logging failed.
         */

        error_log(
            "admin-user-actions audit error: " .
            $e->getMessage()
        );
    }


    /* =================================================
       GET UPDATED USER
    ================================================= */

    $updatedUser =
        $users->findOne([
            "_id" =>
                $targetUser["_id"]
        ]);


    $fullName =
        trim(
            (string)(
                $updatedUser["full_name"]
                ?? ""
            )
        );


    if (
        $fullName === ""
    ) {

        $fullName =
            trim(
                (string)(
                    ($updatedUser["first_name"] ?? "") .
                    " " .
                    ($updatedUser["last_name"] ?? "")
                )
            );
    }


    if (
        $fullName === ""
    ) {

        $fullName =
            "User";
    }


    /* =================================================
       SUCCESS
    ================================================= */

    jsonResponse(
        true,
        "User account status updated successfully.",
        [

            "user" => [

                "id" =>
                    $targetId,

                "full_name" =>
                    $fullName,

                "email" =>
                    (string)(
                        $updatedUser["email"]
                        ?? ""
                    ),

                "status" =>
                    $newStatus
            ],

            "action" => $action,

            "old_status" =>
                $oldStatus,

            "new_status" =>
                $newStatus
        ]
    );


} catch (
    MongoDB\Driver\Exception\Exception $e
) {

    error_log(
        "admin-user-actions MongoDB error: " .
        $e->getMessage()
    );


    jsonResponse(
        false,
        "Database error while updating user account.",
        [],
        500
    );

} catch (
    Throwable $e
) {

    error_log(
        "admin-user-actions error: " .
        $e->getMessage()
    );


    jsonResponse(
        false,
        "Unable to update user account.",
        [],
        500
    );
}

?>