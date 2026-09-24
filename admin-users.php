<?php

declare(strict_types=1);

/*
|--------------------------------------------------------------------------
| Crown Cash - Admin Users API
|--------------------------------------------------------------------------
| GET /admin-users.php
|
| Returns registered users for the administrator panel.
|
| Security:
| - CORS restricted to Crown Cash frontend
| - Secure cross-site session
| - Administrator authorization
| - Optional ADMIN_USER_ID enforcement
| - Blocked/suspended admin accounts denied
|--------------------------------------------------------------------------
*/


/* =========================================================
   CORS
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
    "Access-Control-Allow-Headers: Content-Type"
);


if (
    $_SERVER["REQUEST_METHOD"] === "OPTIONS"
) {

    http_response_code(204);

    exit;
}


if (
    $_SERVER["REQUEST_METHOD"] !== "GET"
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
    string $message = "",
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
   LOGIN CHECK
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
   LOAD DATABASE
========================================================= */

try {

    require_once __DIR__ . "/config.php";

} catch (Throwable $e) {

    error_log(
        "admin-users.php config error: " .
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

    $users = $db->selectCollection("users");


    /*
    |--------------------------------------------------------------------------
    | Current Session User
    |--------------------------------------------------------------------------
    */

    $sessionUserId =
        (string)$_SESSION["user_id"];


    $adminUser = null;


    /*
    |--------------------------------------------------------------------------
    | Convert Session ID to ObjectId
    |--------------------------------------------------------------------------
    */

    try {

        $adminObjectId =
            new MongoDB\BSON\ObjectId(
                $sessionUserId
            );

        $adminUser =
            $users->findOne([
                "_id" => $adminObjectId
            ]);

    } catch (Throwable $e) {

        $adminUser = null;
    }


    /*
    |--------------------------------------------------------------------------
    | Fallback: String ID
    |--------------------------------------------------------------------------
    */

    if (!$adminUser) {

        $adminUser =
            $users->findOne([
                "_id" => $sessionUserId
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


    /* =====================================================
       CHECK ACCOUNT STATUS
    ===================================================== */

    $accountStatus =
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
            $accountStatus,
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


    /* =====================================================
       CHECK ROLE / ACCOUNT TYPE
    ===================================================== */

    $role =
        strtolower(
            trim(
                (string)(
                    $adminUser["role"]
                    ?? ""
                )
            )
        );


    $accountType =
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
            $role === "admin" ||
            $role === "administrator" ||
            $accountType === "admin" ||
            $accountType === "administrator"
        );


    if (!$isAdmin) {

        jsonResponse(
            false,
            "Administrator access required.",
            [],
            403
        );
    }


    /* =====================================================
       OPTIONAL ADMIN USER ID LOCK
    ===================================================== */

    $configuredAdminId =
        trim(
            (string)(
                getenv("ADMIN_USER_ID")
                ?: ""
            )
        );


    if (
        $configuredAdminId !== "" &&
        $configuredAdminId !== $sessionUserId
    ) {

        jsonResponse(
            false,
            "Administrator access denied.",
            [],
            403
        );
    }


    /* =====================================================
       LOAD USERS
    ===================================================== */

    $cursor =
        $users->find(
            [],
            [
                "sort" => [
                    "created_at" => -1,
                    "_id" => -1
                ]
            ]
        );


    $userList = [];


    /* =====================================================
       STATISTICS
    ===================================================== */

    $totalUsers = 0;
    $activeUsers = 0;
    $blockedUsers = 0;
    $adminUsers = 0;


    foreach ($cursor as $user) {

        $totalUsers++;


        /* -----------------------------------------------
           Status
        ------------------------------------------------ */

        $status =
            strtolower(
                trim(
                    (string)(
                        $user["status"]
                        ?? "active"
                    )
                )
            );


        if (
            $status === "active"
        ) {

            $activeUsers++;
        }


        if (
            in_array(
                $status,
                [
                    "blocked",
                    "suspended",
                    "disabled",
                    "banned"
                ],
                true
            )
        ) {

            $blockedUsers++;
        }


        /* -----------------------------------------------
           Role / Account Type
        ------------------------------------------------ */

        $userRole =
            strtolower(
                trim(
                    (string)(
                        $user["role"]
                        ?? ""
                    )
                )
            );


        $userAccountType =
            strtolower(
                trim(
                    (string)(
                        $user["account_type"]
                        ?? ""
                    )
                )
            );


        if (
            $userRole === "admin" ||
            $userRole === "administrator" ||
            $userAccountType === "admin" ||
            $userAccountType === "administrator"
        ) {

            $adminUsers++;
        }


        /* -----------------------------------------------
           User ID
        ------------------------------------------------ */

        $userId = "";


        if (
            isset($user["_id"]) &&
            $user["_id"] instanceof MongoDB\BSON\ObjectId
        ) {

            $userId =
                (string)$user["_id"];

        } elseif (
            isset($user["_id"])
        ) {

            $userId =
                (string)$user["_id"];
        }


        /* -----------------------------------------------
           Full Name
        ------------------------------------------------ */

        $fullName =
            trim(
                (string)(
                    $user["full_name"]
                    ?? ""
                )
            );


        if ($fullName === "") {

            $firstName =
                trim(
                    (string)(
                        $user["first_name"]
                        ?? ""
                    )
                );


            $lastName =
                trim(
                    (string)(
                        $user["last_name"]
                        ?? ""
                    )
                );


            $fullName =
                trim(
                    $firstName .
                    " " .
                    $lastName
                );
        }


        if ($fullName === "") {

            $fullName =
                "Unknown User";
        }


        /* -----------------------------------------------
           Email
        ------------------------------------------------ */

        $email =
            trim(
                (string)(
                    $user["email"]
                    ?? ""
                )
            );


        /* -----------------------------------------------
           Phone
        ------------------------------------------------ */

        $phone = "";


        if (
            isset($user["phone"])
        ) {

            $phone =
                trim(
                    (string)$user["phone"]
                );

        } elseif (
            isset($user["phone_number"])
        ) {

            $phone =
                trim(
                    (string)$user["phone_number"]
                );

        } elseif (
            isset($user["mobile"])
        ) {

            $phone =
                trim(
                    (string)$user["mobile"]
                );
        }


        /* -----------------------------------------------
           Referral Code
        ------------------------------------------------ */

        $referralCode =
            trim(
                (string)(
                    $user["referral_code"]
                    ?? $user["referralCode"]
                    ?? ""
                )
            );


        /* -----------------------------------------------
           Balance
        ------------------------------------------------ */

        $balance = 0;


        if (
            isset($user["balance"])
        ) {

            $balance =
                mongoNumberToFloat(
                    $user["balance"]
                );

        } elseif (
            isset($user["wallet_balance"])
        ) {

            $balance =
                mongoNumberToFloat(
                    $user["wallet_balance"]
                );
        }


        /* -----------------------------------------------
           Created At
        ------------------------------------------------ */

        $createdAt =
            formatDateValue(
                $user["created_at"]
                ?? null
            );


        /* -----------------------------------------------
           Account Type
        ------------------------------------------------ */

        $displayAccountType =
            "user";


        if (
            $userRole === "admin" ||
            $userRole === "administrator" ||
            $userAccountType === "admin" ||
            $userAccountType === "administrator"
        ) {

            $displayAccountType =
                "admin";
        }


        /* -----------------------------------------------
           First / Last Names
        ------------------------------------------------ */

        $firstName =
            trim(
                (string)(
                    $user["first_name"]
                    ?? ""
                )
            );


        $lastName =
            trim(
                (string)(
                    $user["last_name"]
                    ?? ""
                )
            );


        /* -----------------------------------------------
           Add User
        ------------------------------------------------ */

        $userList[] = [

            "id" => $userId,

            "_id" => $userId,

            "first_name" =>
                $firstName,

            "last_name" =>
                $lastName,

            "full_name" =>
                $fullName,

            "email" =>
                $email,

            "phone" =>
                $phone,

            "referral_code" =>
                $referralCode,

            "balance" =>
                $balance,

            "wallet_balance" =>
                $balance,

            "status" =>
                $status,

            "role" =>
                $userRole,

            "account_type" =>
                $displayAccountType,

            "created_at" =>
                $createdAt
        ];
    }


    /* =====================================================
       RESPONSE
    ===================================================== */

    jsonResponse(
        true,
        "Users loaded successfully.",
        [

            "users" =>
                $userList,

            "stats" => [

                "total_users" =>
                    $totalUsers,

                "active_users" =>
                    $activeUsers,

                "blocked_users" =>
                    $blockedUsers,

                "admin_users" =>
                    $adminUsers
            ],

            "count" =>
                count($userList)
        ]
    );


} catch (
    MongoDB\Driver\Exception\Exception $e
) {

    error_log(
        "admin-users.php MongoDB error: " .
        $e->getMessage()
    );


    jsonResponse(
        false,
        "Database error while loading users.",
        [],
        500
    );

} catch (
    Throwable $e
) {

    error_log(
        "admin-users.php error: " .
        $e->getMessage()
    );


    jsonResponse(
        false,
        "Unable to load users.",
        [],
        500
    );
}


/* =========================================================
   HELPERS
========================================================= */

function mongoNumberToFloat(
    mixed $value
): float {

    if (
        $value === null
    ) {
        return 0.0;
    }


    if (
        is_int($value) ||
        is_float($value)
    ) {

        return (float)$value;
    }


    if (
        $value instanceof MongoDB\BSON\Decimal128
    ) {

        return (float)(
            string)$value;
    }


    if (
        $value instanceof MongoDB\BSON\Int64
    ) {

        return (float)(
            string)$value;
    }


    if (
        is_string($value)
    ) {

        return is_numeric($value)
            ? (float)$value
            : 0.0;
    }


    return 0.0;
}


function formatDateValue(
    mixed $value
): string {

    if (
        $value instanceof MongoDB\BSON\UTCDateTime
    ) {

        return $value
            ->toDateTime()
            ->format(
                "c"
            );
    }


    if (
        $value instanceof DateTimeInterface
    ) {

        return $value
            ->format(
                "c"
            );
    }


    if (
        is_string($value) &&
        trim($value) !== ""
    ) {

        try {

            return (
                new DateTime(
                    $value
                )
            )->format(
                "c"
            );

        } catch (
            Throwable $e
        ) {

            return $value;
        }
    }


    return "";
}

?>