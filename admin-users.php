<?php

declare(strict_types=1);

/*
|--------------------------------------------------------------------------
| Crown Cash - Admin Users API
|--------------------------------------------------------------------------
| Handles:
| GET  -> Load all users
|
| Security:
| - Cross-site secure session
| - Admin authorization
| - Optional ADMIN_USER_ID verification
| - Supports MongoDB ObjectId and string IDs
|--------------------------------------------------------------------------
*/

header("Content-Type: application/json; charset=UTF-8");

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

if ($_SERVER["REQUEST_METHOD"] === "OPTIONS") {
    http_response_code(204);
    exit;
}

if ($_SERVER["REQUEST_METHOD"] !== "GET") {
    http_response_code(405);

    echo json_encode([
        "success" => false,
        "message" => "Method not allowed."
    ]);

    exit;
}


/*
|--------------------------------------------------------------------------
| Secure Cross-Site Session
|--------------------------------------------------------------------------
*/

session_set_cookie_params([
    "lifetime" => 0,
    "path" => "/",
    "secure" => true,
    "httponly" => true,
    "samesite" => "None"
]);

session_start();


/*
|--------------------------------------------------------------------------
| JSON Response Helper
|--------------------------------------------------------------------------
*/

function response(
    bool $success,
    string $message = "",
    array $data = [],
    int $status = 200
): void {

    http_response_code($status);

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
| Basic Authentication Check
|--------------------------------------------------------------------------
*/

if (
    !isset($_SESSION["logged_in"]) ||
    $_SESSION["logged_in"] !== true ||
    empty($_SESSION["user_id"])
) {

    response(
        false,
        "Your administrator session has expired. Please login again.",
        [],
        401
    );
}


/*
|--------------------------------------------------------------------------
| Database
|--------------------------------------------------------------------------
*/

require_once __DIR__ . "/config.php";


try {

    /*
    |--------------------------------------------------------------------------
    | Collections
    |--------------------------------------------------------------------------
    */

    $users = $db->selectCollection("users");


    /*
    |--------------------------------------------------------------------------
    | Current Session User
    |--------------------------------------------------------------------------
    */

    $sessionUserId = (string)$_SESSION["user_id"];

    $currentAdmin = null;


    /*
    |--------------------------------------------------------------------------
    | Find Current User
    |--------------------------------------------------------------------------
    */

    if (
        preg_match(
            "/^[a-fA-F0-9]{24}$/",
            $sessionUserId
        )
    ) {

        try {

            $currentAdmin = $users->findOne([
                "_id" => new MongoDB\BSON\ObjectId($sessionUserId)
            ]);

        } catch (Throwable $e) {

            $currentAdmin = null;
        }
    }


    /*
    |--------------------------------------------------------------------------
    | Fallback: String ID
    |--------------------------------------------------------------------------
    */

    if (!$currentAdmin) {

        $currentAdmin = $users->findOne([
            "_id" => $sessionUserId
        ]);
    }


    /*
    |--------------------------------------------------------------------------
    | Fallback: Common User ID Fields
    |--------------------------------------------------------------------------
    */

    if (!$currentAdmin) {

        $currentAdmin = $users->findOne([
            "user_id" => $sessionUserId
        ]);
    }


    /*
    |--------------------------------------------------------------------------
    | Admin Must Exist
    |--------------------------------------------------------------------------
    */

    if (!$currentAdmin) {

        response(
            false,
            "Administrator account could not be verified.",
            [],
            403
        );
    }


    /*
    |--------------------------------------------------------------------------
    | Account Status
    |--------------------------------------------------------------------------
    */

    $status = strtolower(
        trim(
            (string)(
                $currentAdmin["status"]
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


    if (in_array($status, $blockedStatuses, true)) {

        response(
            false,
            "Administrator account is not active.",
            [],
            403
        );
    }


    /*
    |--------------------------------------------------------------------------
    | Role / Account Type
    |--------------------------------------------------------------------------
    */

    $role = strtolower(
        trim(
            (string)(
                $currentAdmin["role"]
                ?? ""
            )
        )
    );

    $accountType = strtolower(
        trim(
            (string)(
                $currentAdmin["account_type"]
                ?? ""
            )
        )
    );


    $isAdmin =
        $role === "admin" ||
        $role === "administrator" ||
        $accountType === "admin" ||
        $accountType === "administrator";


    if (!$isAdmin) {

        response(
            false,
            "Administrator access is required.",
            [],
            403
        );
    }


    /*
    |--------------------------------------------------------------------------
    | Optional ADMIN_USER_ID Protection
    |--------------------------------------------------------------------------
    */

    $configuredAdminId = trim(
        (string)getenv("ADMIN_USER_ID")
    );


    if ($configuredAdminId !== "") {

        $configuredId = $configuredAdminId;

        $sessionMatches = false;


        /*
        | Compare as strings first
        */

        if (
            strtolower($configuredId) ===
            strtolower($sessionUserId)
        ) {

            $sessionMatches = true;
        }


        /*
        | Compare ObjectIds when possible
        */

        if (
            !$sessionMatches &&
            preg_match(
                "/^[a-fA-F0-9]{24}$/",
                $configuredId
            ) &&
            preg_match(
                "/^[a-fA-F0-9]{24}$/",
                $sessionUserId
            )
        ) {

            try {

                $sessionMatches =
                    new MongoDB\BSON\ObjectId($configuredId)
                    ==
                    new MongoDB\BSON\ObjectId($sessionUserId);

            } catch (Throwable $e) {

                $sessionMatches = false;
            }
        }


        if (!$sessionMatches) {

            response(
                false,
                "This administrator account is not authorized for the admin panel.",
                [],
                403
            );
        }
    }


    /*
    |--------------------------------------------------------------------------
    | Helper: Convert MongoDB Numbers
    |--------------------------------------------------------------------------
    */

    function numberValue($value): float
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


    /*
    |--------------------------------------------------------------------------
    | Helper: Format Dates
    |--------------------------------------------------------------------------
    */

    function formatUserDate($value): string
    {

        if (
            $value instanceof MongoDB\BSON\UTCDateTime
        ) {

            return $value
                ->toDateTime()
                ->format("Y-m-d H:i");
        }

        if ($value instanceof DateTimeInterface) {

            return $value->format("Y-m-d H:i");
        }

        if (is_string($value) && trim($value) !== "") {

            $timestamp = strtotime($value);

            if ($timestamp !== false) {

                return date(
                    "Y-m-d H:i",
                    $timestamp
                );
            }
        }

        return "";
    }


    /*
    |--------------------------------------------------------------------------
    | Load Users
    |--------------------------------------------------------------------------
    */

    $cursor = $users->find(
        [],
        [
            "sort" => [
                "created_at" => -1
            ]
        ]
    );


    $userList = [];


    foreach ($cursor as $user) {

        $id = "";


        if (
            isset($user["_id"]) &&
            $user["_id"] instanceof MongoDB\BSON\ObjectId
        ) {

            $id = (string)$user["_id"];

        } elseif (isset($user["_id"])) {

            $id = (string)$user["_id"];

        } elseif (isset($user["user_id"])) {

            $id = (string)$user["user_id"];
        }


        $fullName = trim(
            (string)(
                $user["full_name"]
                ?? ""
            )
        );


        $firstName = trim(
            (string)(
                $user["first_name"]
                ?? ""
            )
        );


        $lastName = trim(
            (string)(
                $user["last_name"]
                ?? ""
            )
        );


        /*
        |--------------------------------------------------------------------------
        | Build Name If Necessary
        |--------------------------------------------------------------------------
        */

        if ($fullName === "") {

            $fullName = trim(
                $firstName . " " . $lastName
            );
        }


        if ($firstName === "" && $fullName !== "") {

            $parts = preg_split(
                "/\s+/",
                $fullName,
                -1,
                PREG_SPLIT_NO_EMPTY
            );

            $firstName = $parts[0] ?? "";
        }


        if ($lastName === "" && $fullName !== "") {

            $parts = preg_split(
                "/\s+/",
                $fullName,
                -1,
                PREG_SPLIT_NO_EMPTY
            );

            if (count($parts) > 1) {

                $lastName = implode(
                    " ",
                    array_slice($parts, 1)
                );
            }
        }


        /*
        |--------------------------------------------------------------------------
        | Balance
        |--------------------------------------------------------------------------
        */

        $balance = 0.0;


        if (isset($user["balance"])) {

            $balance = numberValue(
                $user["balance"]
            );

        } elseif (isset($user["wallet_balance"])) {

            $balance = numberValue(
                $user["wallet_balance"]
            );
        }


        /*
        |--------------------------------------------------------------------------
        | Status
        |--------------------------------------------------------------------------
        */

        $userStatus = strtolower(
            trim(
                (string)(
                    $user["status"]
                    ?? "active"
                )
            )
        );


        /*
        |--------------------------------------------------------------------------
        | Account Type
        |--------------------------------------------------------------------------
        */

        $userRole = strtolower(
            trim(
                (string)(
                    $user["role"]
                    ?? ""
                )
            )
        );


        $userAccountType = strtolower(
            trim(
                (string)(
                    $user["account_type"]
                    ?? "user"
                )
            )
        );


        /*
        |--------------------------------------------------------------------------
        | Created Date
        |--------------------------------------------------------------------------
        */

        $createdAt = formatUserDate(
            $user["created_at"] ?? null
        );


        /*
        |--------------------------------------------------------------------------
        | User Record
        |--------------------------------------------------------------------------
        */

        $userList[] = [

            "id" => $id,

            "_id" => $id,

            "user_id" => $id,

            "first_name" => $firstName,

            "last_name" => $lastName,

            "full_name" => $fullName,

            "email" => (string)(
                $user["email"]
                ?? ""
            ),

            "phone" => (string)(
                $user["phone"]
                ?? $user["phone_number"]
                ?? $user["mobile"]
                ?? ""
            ),

            "referral_code" => (string)(
                $user["referral_code"]
                ?? ""
            ),

            "balance" => $balance,

            "wallet_balance" => $balance,

            "status" => $userStatus,

            "role" => $userRole,

            "account_type" => $userAccountType,

            "created_at" => $createdAt
        ];
    }


    /*
    |--------------------------------------------------------------------------
    | Statistics
    |--------------------------------------------------------------------------
    */

    $totalUsers = count($userList);

    $activeUsers = 0;

    $blockedUsers = 0;

    $adminUsers = 0;


    foreach ($userList as $item) {

        if (
            strtolower(
                (string)$item["status"]
            ) === "active"
        ) {

            $activeUsers++;
        }


        if (
            in_array(
                strtolower(
                    (string)$item["status"]
                ),
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


        if (
            in_array(
                strtolower(
                    (string)$item["role"]
                ),
                [
                    "admin",
                    "administrator"
                ],
                true
            ) ||
            in_array(
                strtolower(
                    (string)$item["account_type"]
                ),
                [
                    "admin",
                    "administrator"
                ],
                true
            )
        ) {

            $adminUsers++;
        }
    }


    /*
    |--------------------------------------------------------------------------
    | Return
    |--------------------------------------------------------------------------
    */

    response(
        true,
        "Users loaded successfully.",
        [

            "users" => $userList,

            "data" => $userList,

            "stats" => [

                "total_users" => $totalUsers,

                "active_users" => $activeUsers,

                "blocked_users" => $blockedUsers,

                "admin_users" => $adminUsers
            ],

            "total_users" => $totalUsers,

            "active_users" => $activeUsers,

            "blocked_users" => $blockedUsers,

            "admin_users" => $adminUsers
        ]
    );


} catch (MongoDB\Driver\Exception\Exception $e) {

    error_log(
        "Crown Cash admin-users MongoDB error: " .
        $e->getMessage()
    );

    response(
        false,
        "Unable to load users from the database.",
        [],
        500
    );


} catch (Throwable $e) {

    error_log(
        "Crown Cash admin-users error: " .
        $e->getMessage()
    );

    response(
        false,
        "Unable to load user management.",
        [],
        500
    );
}
?>