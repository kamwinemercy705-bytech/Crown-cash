<?php

/* =========================================================
   CROWN CASH ADMIN USERS API
========================================================= */

declare(strict_types=1);


/* =========================================================
   CORS
========================================================= */

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

header(
    "Content-Type: application/json; charset=UTF-8"
);


/* =========================================================
   OPTIONS
========================================================= */

if (
    $_SERVER["REQUEST_METHOD"] ===
    "OPTIONS"
) {

    http_response_code(204);

    exit;
}


/* =========================================================
   METHOD
========================================================= */

if (
    $_SERVER["REQUEST_METHOD"] !==
    "GET"
) {

    http_response_code(405);

    echo json_encode([
        "success" => false,
        "message" => "Method not allowed."
    ]);

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
   JSON HELPER
========================================================= */

function jsonResponse(
    array $data,
    int $status = 200
): never {

    http_response_code(
        $status
    );

    echo json_encode(
        $data,
        JSON_UNESCAPED_SLASHES
    );

    exit;
}


/* =========================================================
   BASIC LOGIN CHECK
========================================================= */

if (
    !isset($_SESSION["logged_in"]) ||
    $_SESSION["logged_in"] !== true ||
    empty($_SESSION["user_id"])
) {

    jsonResponse(
        [
            "success" => false,
            "message" =>
                "Please login first."
        ],
        401
    );

}


/* =========================================================
   CONFIG
========================================================= */

try {

    require_once __DIR__ .
        "/config.php";

} catch (Throwable $e) {

    jsonResponse(
        [
            "success" => false,
            "message" =>
                "Database configuration could not be loaded."
        ],
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
        $value instanceof
        MongoDB\BSON\Decimal128
    ) {

        return (float)
            $value->__toString();

    }

    if (
        $value instanceof
        MongoDB\BSON\Int64
    ) {

        return (float)
            $value->__toString();

    }

    if (
        is_object($value) &&
        method_exists(
            $value,
            "__toString"
        )
    ) {

        return (float)
            $value->__toString();

    }

    return is_numeric($value)
        ? (float)$value
        : 0.0;
}


function formatDateValue(
    mixed $value
): string {

    if (
        $value instanceof
        MongoDB\BSON\UTCDateTime
    ) {

        return $value
            ->toDateTime()
            ->format(
                DATE_ATOM
            );

    }

    if (
        $value instanceof
        DateTimeInterface
    ) {

        return $value
            ->format(
                DATE_ATOM
            );

    }

    if (
        is_string($value) &&
        trim($value) !== ""
    ) {

        return $value;

    }

    return "";

}


function getUserIdVariants(
    string $id
): array {

    $variants = [
        $id
    ];


    try {

        if (
            preg_match(
                '/^[a-fA-F0-9]{24}$/',
                $id
            )
        ) {

            $variants[] =
                new MongoDB\BSON\ObjectId(
                    $id
                );

        }

    } catch (Throwable $e) {

        /* Ignore invalid ObjectId. */

    }


    return $variants;
}


/* =========================================================
   ADMIN VERIFICATION
========================================================= */

try {

    $usersCollection =
        $db->selectCollection(
            "users"
        );


    $sessionUserId =
        (string)
        $_SESSION["user_id"];


    $adminUser = null;


    /*
     * First try ObjectId.
     */

    try {

        if (
            preg_match(
                '/^[a-fA-F0-9]{24}$/',
                $sessionUserId
            )
        ) {

            $adminUser =
                $usersCollection->findOne([
                    "_id" =>
                        new MongoDB\BSON\ObjectId(
                            $sessionUserId
                        )
                ]);

        }

    } catch (Throwable $e) {

        $adminUser = null;

    }


    /*
     * Fallback to string _id.
     */

    if (!$adminUser) {

        $adminUser =
            $usersCollection->findOne([
                "_id" =>
                    $sessionUserId
            ]);

    }


    /*
     * Fallback to stored user_id.
     */

    if (!$adminUser) {

        $adminUser =
            $usersCollection->findOne([
                "user_id" =>
                    $sessionUserId
            ]);

    }


    if (!$adminUser) {

        jsonResponse(
            [
                "success" => false,
                "message" =>
                    "Administrator account could not be found."
            ],
            403
        );

    }


    /* STATUS */

    $adminStatus =
        strtolower(
            trim(
                (string)(
                    $adminUser["status"] ??
                    "active"
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
            [
                "success" => false,
                "message" =>
                    "Administrator account is not active."
            ],
            403
        );

    }


    /* ROLE */

    $role =
        strtolower(
            trim(
                (string)(
                    $adminUser["role"] ??
                    ""
                )
            )
        );


    /* ACCOUNT TYPE */

    $accountType =
        strtolower(
            trim(
                (string)(
                    $adminUser["account_type"] ??
                    ""
                )
            )
        );


    $isAdmin =
        in_array(
            $role,
            [
                "admin",
                "administrator"
            ],
            true
        )
        ||
        in_array(
            $accountType,
            [
                "admin",
                "administrator"
            ],
            true
        );


    if (!$isAdmin) {

        jsonResponse(
            [
                "success" => false,
                "message" =>
                    "Administrator access is required."
            ],
            403
        );

    }


    /*
     * Optional ADMIN_USER_ID protection.
     *
     * This matches the same environment variable
     * used by the existing Crown Cash admin system.
     */

    $configuredAdminId =
        trim(
            (string)(
                getenv(
                    "ADMIN_USER_ID"
                ) ?: ""
            )
        );


    if (
        $configuredAdminId !== "" &&
        $configuredAdminId !==
        $sessionUserId
    ) {

        jsonResponse(
            [
                "success" => false,
                "message" =>
                    "Administrator verification failed."
            ],
            403
        );

    }


} catch (
    MongoDB\Driver\Exception\Exception $e
) {

    jsonResponse(
        [
            "success" => false,
            "message" =>
                "Unable to verify administrator."
        ],
        500
    );

} catch (Throwable $e) {

    jsonResponse(
        [
            "success" => false,
            "message" =>
                "Administrator verification failed."
        ],
        500
    );

}


/* =========================================================
   LOAD USERS
========================================================= */

try {

    $cursor =
        $usersCollection->find(
            [],
            [
                "sort" => [
                    "created_at" => -1
                ]
            ]
        );


    $users = [];


    foreach ($cursor as $user) {

        $fullName =
            trim(
                (string)(
                    $user["full_name"] ??
                    ""
                )
            );


        $firstName =
            trim(
                (string)(
                    $user["first_name"] ??
                    ""
                )
            );


        $lastName =
            trim(
                (string)(
                    $user["last_name"] ??
                    ""
                )
            );


        if (
            $fullName === "" &&
            (
                $firstName !== "" ||
                $lastName !== ""
            )
        ) {

            $fullName =
                trim(
                    $firstName .
                    " " .
                    $lastName
                );

        }


        if (
            $fullName === ""
        ) {

            $fullName =
                "User";

        }


        /*
         * Balance
         */

        $balance =
            $user["balance"] ??
            $user["wallet_balance"] ??
            0;


        $balance =
            mongoNumberToFloat(
                $balance
            );


        /*
         * ID
         */

        $id = "";


        if (
            isset(
                $user["_id"]
            )
        ) {

            if (
                $user["_id"]
                instanceof
                MongoDB\BSON\ObjectId
            ) {

                $id =
                    (string)
                    $user["_id"];

            } else {

                $id =
                    (string)
                    $user["_id"];

            }

        }


        /*
         * Status
         */

        $status =
            strtolower(
                trim(
                    (string)(
                        $user["status"] ??
                        "active"
                    )
                )
            );


        /*
         * Role/account type
         */

        $role =
            strtolower(
                trim(
                    (string)(
                        $user["role"] ??
                        ""
                    )
                )
            );


        $accountType =
            strtolower(
                trim(
                    (string)(
                        $user["account_type"] ??
                        ""
                    )
                )
            );


        /*
         * Phone
         */

        $phone =
            (string)(
                $user["phone"] ??
                $user["phone_number"] ??
                $user["mobile"] ??
                ""
            );


        /*
         * Created date
         */

        $createdAt =
            formatDateValue(
                $user["created_at"] ??
                null
            );


        $users[] = [

            "id" =>
                $id,

            "_id" =>
                $id,

            "first_name" =>
                $firstName,

            "last_name" =>
                $lastName,

            "full_name" =>
                $fullName,

            "email" =>
                (string)(
                    $user["email"] ??
                    ""
                ),

            "phone" =>
                $phone,

            "referral_code" =>
                (string)(
                    $user["referral_code"] ??
                    ""
                ),

            "balance" =>
                $balance,

            "wallet_balance" =>
                $balance,

            "status" =>
                $status,

            "role" =>
                $role,

            "account_type" =>
                $accountType,

            "created_at" =>
                $createdAt

        ];

    }


    /* =====================================================
       STATISTICS
    ====================================================== */

    $totalUsers =
        count($users);


    $activeUsers = 0;
    $blockedUsers = 0;
    $adminUsers = 0;


    foreach (
        $users as $user
    ) {

        if (
            strtolower(
                (string)(
                    $user["status"] ??
                    ""
                )
            ) === "active"
        ) {

            $activeUsers++;

        }


        if (
            strtolower(
                (string)(
                    $user["status"] ??
                    ""
                )
            ) === "blocked"
        ) {

            $blockedUsers++;

        }


        $role =
            strtolower(
                (string)(
                    $user["role"] ??
                    ""
                )
            );


        $type =
            strtolower(
                (string)(
                    $user["account_type"] ??
                    ""
                )
            );


        if (
            in_array(
                $role,
                [
                    "admin",
                    "administrator"
                ],
                true
            )
            ||
            in_array(
                $type,
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


    /* =====================================================
       RESPONSE
    ====================================================== */

    jsonResponse([
        "success" => true,

        "message" =>
            "Users loaded successfully.",

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

        "total_users" =>
            $totalUsers,

        "active_users" =>
            $activeUsers,

        "blocked_users" =>
            $blockedUsers,

        "admin_users" =>
            $adminUsers,

        "users" =>
            $users

    ]);


} catch (
    MongoDB\Driver\Exception\Exception $e
) {

    jsonResponse(
        [
            "success" => false,
            "message" =>
                "Database error while loading users."
        ],
        500
    );

} catch (Throwable $e) {

    jsonResponse(
        [
            "success" => false,
            "message" =>
                "Unable to load users."
        ],
        500
    );

}

?>