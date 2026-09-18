<?php

/* =========================================================
   CROWN CASH — ADMIN USERS API
   admin-users.php
   ========================================================= */

declare(strict_types=1);


/* =========================================================
   CORS
   ========================================================= */

header("Access-Control-Allow-Origin: https://crown-cash.vercel.app");
header("Access-Control-Allow-Credentials: true");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Accept");

header("Content-Type: application/json; charset=UTF-8");


/* =========================================================
   PREFLIGHT REQUEST
   ========================================================= */

if ($_SERVER["REQUEST_METHOD"] === "OPTIONS") {

    http_response_code(204);
    exit;

}


/* =========================================================
   SESSION
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
   LOAD DATABASE CONFIG
   ========================================================= */

try {

    require_once __DIR__ . "/config.php";

} catch (Throwable $e) {

    http_response_code(500);

    echo json_encode([
        "success" => false,
        "message" => "Server configuration error."
    ]);

    exit;

}


/* =========================================================
   HELPER RESPONSE
   ========================================================= */

function respond(
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


/* =========================================================
   ADMIN AUTHENTICATION
   ========================================================= */

/*
 * Never rely only on the fact that the page is called
 * "admin.html".
 *
 * The backend must verify the logged-in session.
 */

if (
    empty($_SESSION["logged_in"]) ||
    empty($_SESSION["user_id"])
) {

    respond(
        false,
        "Authentication required.",
        [],
        401
    );

}


/* =========================================================
   CHECK ADMIN ROLE
   ========================================================= */

$sessionRole =
    strtolower(
        trim(
            (string)(
                $_SESSION["role"] ??
                ""
            )
        )
    );


if (
    $sessionRole !== "admin" &&
    $sessionRole !== "administrator"
) {

    respond(
        false,
        "Administrator access required.",
        [],
        403
    );

}


/* =========================================================
   CHECK DATABASE OBJECTS
   ========================================================= */

if (
    !isset($database) ||
    !isset($users)
) {

    respond(
        false,
        "Database configuration is incomplete.",
        [],
        500
    );

}


/* =========================================================
   REQUEST METHOD
   ========================================================= */

$method =
    strtoupper(
        $_SERVER["REQUEST_METHOD"] ?? "GET"
    );


/* =========================================================
   GET USERS
   ========================================================= */

if ($method === "GET") {

    try {

        /*
         * Retrieve users.
         *
         * We do not expose password fields.
         */

        $cursor =
            $users->find(
                [],
                [
                    "projection" => [
                        "password" => 0,
                        "password_hash" => 0
                    ],

                    "sort" => [
                        "created_at" => -1
                    ]
                ]
            );


        $result = [];


        foreach ($cursor as $user) {

            $result[] =
                formatUser($user);

        }


        respond(
            true,
            "Users loaded successfully.",
            [
                "users" => $result,
                "count" => count($result)
            ]
        );


    } catch (Throwable $e) {

        error_log(
            "Admin users GET error: " .
            $e->getMessage()
        );


        respond(
            false,
            "Unable to load users.",
            [],
            500
        );

    }

}


/* =========================================================
   POST REQUEST
   ========================================================= */

if ($method === "POST") {

    $rawInput =
        file_get_contents("php://input");


    if (!$rawInput) {

        respond(
            false,
            "Request body is empty.",
            [],
            400
        );

    }


    $input =
        json_decode(
            $rawInput,
            true
        );


    if (
        !is_array($input)
    ) {

        respond(
            false,
            "Invalid JSON request.",
            [],
            400
        );

    }


    $action =
        strtolower(
            trim(
                (string)(
                    $input["action"] ?? ""
                )
            )
        );


    /* =====================================================
       UPDATE USER STATUS
       ===================================================== */

    if ($action === "update_status") {

        updateUserStatus(
            $users,
            $input
        );

    }


    respond(
        false,
        "Unknown admin action.",
        [],
        400
    );

}


/* =========================================================
   UNSUPPORTED METHOD
   ========================================================= */

respond(
    false,
    "Method not allowed.",
    [],
    405
);


/* =========================================================
   FORMAT USER
   ========================================================= */

function formatUser(
    $user
): array {

    /*
     * MongoDB ObjectId
     */

    $id = "";

    if (
        isset($user["_id"])
    ) {

        $id =
            (string)$user["_id"];

    }


    /* -----------------------------------------------------
       NAME
       ----------------------------------------------------- */

    $firstName =
        (string)(
            $user["first_name"] ??
            $user["firstName"] ??
            ""
        );


    $lastName =
        (string)(
            $user["last_name"] ??
            $user["lastName"] ??
            ""
        );


    $name =
        trim(
            (string)(
                $user["name"] ??
                $user["full_name"] ??
                $user["fullName"] ??
                ""
            )
        );


    if ($name === "") {

        $name =
            trim(
                $firstName .
                " " .
                $lastName
            );

    }


    if ($name === "") {

        $name = "Unknown User";

    }


    /* -----------------------------------------------------
       EMAIL
       ----------------------------------------------------- */

    $email =
        (string)(
            $user["email"] ??
            ""
        );


    /* -----------------------------------------------------
       PHONE
       ----------------------------------------------------- */

    $phone =
        (string)(
            $user["phone"] ??
            $user["phone_number"] ??
            ""
        );


    /* -----------------------------------------------------
       REFERRAL CODE
       ----------------------------------------------------- */

    $referralCode =
        (string)(
            $user["referral_code"] ??
            $user["referralCode"] ??
            ""
        );


    /* -----------------------------------------------------
       BALANCE
       ----------------------------------------------------- */

    $balance = 0;


    if (
        isset($user["balance"])
    ) {

        $balance =
            numericValue(
                $user["balance"]
            );

    } elseif (
        isset($user["wallet_balance"])
    ) {

        $balance =
            numericValue(
                $user["wallet_balance"]
            );

    } elseif (
        isset($user["walletBalance"])
    ) {

        $balance =
            numericValue(
                $user["walletBalance"]
            );

    }


    /* -----------------------------------------------------
       ROLE
       ----------------------------------------------------- */

    $role =
        strtolower(
            trim(
                (string)(
                    $user["role"] ??
                    $user["account_type"] ??
                    $user["accountType"] ??
                    "user"
                )
            )
        );


    if (
        $role !== "admin" &&
        $role !== "administrator"
    ) {

        $role = "user";

    }


    /* -----------------------------------------------------
       STATUS
       ----------------------------------------------------- */

    $status =
        strtolower(
            trim(
                (string)(
                    $user["status"] ??
                    $user["account_status"] ??
                    $user["accountStatus"] ??
                    "active"
                )
            )
        );


    if (
        !in_array(
            $status,
            [
                "active",
                "pending",
                "blocked"
            ],
            true
        )
    ) {

        $status = "active";

    }


    /* -----------------------------------------------------
       CREATED DATE
       ----------------------------------------------------- */

    $createdAt = null;


    if (
        isset($user["created_at"])
    ) {

        $createdAt =
            formatDateValue(
                $user["created_at"]
            );

    } elseif (
        isset($user["createdAt"])
    ) {

        $createdAt =
            formatDateValue(
                $user["createdAt"]
            );

    }


    return [

        "id" => $id,

        "name" => $name,

        "first_name" => $firstName,

        "last_name" => $lastName,

        "email" => $email,

        "phone" => $phone,

        "referral_code" => $referralCode,

        "balance" => $balance,

        "role" => $role,

        "status" => $status,

        "created_at" => $createdAt

    ];

}


/* =========================================================
   UPDATE USER STATUS
   ========================================================= */

function updateUserStatus(
    $users,
    array $input
): void {

    $userId =
        trim(
            (string)(
                $input["user_id"] ?? ""
            )
        );


    $newStatus =
        strtolower(
            trim(
                (string)(
                    $input["status"] ?? ""
                )
            )
        );


    if ($userId === "") {

        respond(
            false,
            "User ID is required.",
            [],
            400
        );

    }


    if (
        !in_array(
            $newStatus,
            [
                "active",
                "blocked"
            ],
            true
        )
    ) {

        respond(
            false,
            "Invalid user status.",
            [],
            400
        );

    }


    try {

        /*
         * Convert the supplied ID to MongoDB ObjectId.
         */

        $objectId =
            new \MongoDB\BSON\ObjectId(
                $userId
            );


        /*
         * Prevent an administrator from accidentally
         * changing another admin through this basic
         * user-management action.
         */

        $targetUser =
            $users->findOne(
                [
                    "_id" => $objectId
                ],
                [
                    "projection" => [
                        "role" => 1,
                        "account_type" => 1
                    ]
                ]
            );


        if (!$targetUser) {

            respond(
                false,
                "User not found.",
                [],
                404
            );

        }


        $targetRole =
            strtolower(
                trim(
                    (string)(
                        $targetUser["role"] ??
                        $targetUser["account_type"] ??
                        "user"
                    )
                )
            );


        if (
            $targetRole === "admin" ||
            $targetRole === "administrator"
        ) {

            respond(
                false,
                "Administrator accounts cannot be changed from this page.",
                [],
                403
            );

        }


        /*
         * Update only the account status.
         */

        $update =
            $users->updateOne(
                [
                    "_id" => $objectId
                ],
                [
                    '$set' => [
                        "status" => $newStatus,
                        "updated_at" =>
                            new \MongoDB\BSON\UTCDateTime()
                    ]
                ]
            );


        if (
            $update->getMatchedCount() === 0
        ) {

            respond(
                false,
                "User was not found.",
                [],
                404
            );

        }


        respond(
            true,
            "User status updated successfully.",
            [
                "user_id" => $userId,
                "status" => $newStatus
            ]
        );


    } catch (
        \MongoDB\Driver\Exception\Exception $e
    ) {

        error_log(
            "MongoDB admin status error: " .
            $e->getMessage()
        );


        respond(
            false,
            "Database operation failed.",
            [],
            500
        );


    } catch (Throwable $e) {

        error_log(
            "Admin status error: " .
            $e->getMessage()
        );


        respond(
            false,
            "Unable to update user.",
            [],
            500
        );

    }

}


/* =========================================================
   NUMERIC VALUE HELPER
   ========================================================= */

function numericValue(
    $value
): float {

    if (
        is_int($value) ||
        is_float($value)
    ) {

        return (float)$value;

    }


    if (
        is_numeric($value)
    ) {

        return (float)$value;

    }


    /*
     * MongoDB Decimal128
     */

    if (
        $value instanceof
        \MongoDB\BSON\Decimal128
    ) {

        return (float)(
            (string)$value
        );

    }


    return 0;

}


/* =========================================================
   DATE HELPER
   ========================================================= */

function formatDateValue(
    $value
): ?string {

    if (
        $value instanceof
        \MongoDB\BSON\UTCDateTime
    ) {

        return $value
            ->toDateTime()
            ->format(
                DATE_ATOM
            );

    }


    if (
        is_string($value) ||
        is_int($value) ||
        is_float($value)
    ) {

        try {

            $date =
                new DateTime(
                    (string)$value
                );


            return $date->format(
                DATE_ATOM
            );

        } catch (Throwable $e) {

            return null;

        }

    }


    return null;

}