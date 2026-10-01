<?php

/*
|--------------------------------------------------------------------------
| Crown Cash — Admin Withdrawal Management API
|--------------------------------------------------------------------------
|
| GET:
|   Returns withdrawal requests for the admin dashboard.
|
| POST:
|   Approves or rejects a pending withdrawal.
|
| Rules:
|   - Only an authenticated administrator can use this endpoint.
|   - Withdrawal creation reserves/deducts the user's balance.
|   - Approval keeps the amount deducted.
|   - Rejection restores the reserved amount.
|   - This endpoint does NOT send Mobile Money automatically.
|
|--------------------------------------------------------------------------
*/


/*
|--------------------------------------------------------------------------
| HEADERS
|--------------------------------------------------------------------------
*/

header("Access-Control-Allow-Origin: https://crown-cash.vercel.app");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");
header("Access-Control-Allow-Credentials: true");
header("Content-Type: application/json; charset=UTF-8");

header("Cache-Control: no-store, no-cache, must-revalidate, max-age=0");
header("Pragma: no-cache");


/*
|--------------------------------------------------------------------------
| CORS PREFLIGHT
|--------------------------------------------------------------------------
*/

if ($_SERVER["REQUEST_METHOD"] === "OPTIONS") {

    http_response_code(204);

    exit;
}


/*
|--------------------------------------------------------------------------
| DATABASE / CONFIG
|--------------------------------------------------------------------------
*/

require_once __DIR__ . "/config.php";


/*
|--------------------------------------------------------------------------
| SESSION
|--------------------------------------------------------------------------
|
| Use the same secure cross-site cookie configuration as the rest of
| the Crown Cash application.
|--------------------------------------------------------------------------
*/

if (function_exists("startSecureSession")) {

    startSecureSession();

} else {

    session_set_cookie_params([
        "lifetime" => 0,
        "path" => "/",
        "domain" => "",
        "secure" => true,
        "httponly" => true,
        "samesite" => "None"
    ]);

    if (session_status() !== PHP_SESSION_ACTIVE) {
        session_start();
    }
}


/*
|--------------------------------------------------------------------------
| RESPONSE HELPER
|--------------------------------------------------------------------------
*/

function withdrawalResponse(
    int $statusCode,
    array $data
): void {

    http_response_code($statusCode);

    echo json_encode(
        $data,
        JSON_UNESCAPED_SLASHES
    );

    exit;
}


/*
|--------------------------------------------------------------------------
| VALUE HELPERS
|--------------------------------------------------------------------------
*/

function withdrawalString(
    $value,
    string $default = ""
): string {

    if ($value === null) {
        return $default;
    }

    return trim((string)$value);
}


function withdrawalMoney(
    $value
): float {

    if ($value === null) {
        return 0.0;
    }

    if (
        $value instanceof MongoDB\BSON\Decimal128
    ) {

        return (float)$value
            ->__toString();
    }

    if (
        $value instanceof MongoDB\BSON\Int64
    ) {

        return (float)$value
            ->__toString();
    }

    return (float)$value;
}


function withdrawalBool(
    $value
): bool {

    if (is_bool($value)) {
        return $value;
    }

    if (is_numeric($value)) {
        return ((int)$value) === 1;
    }

    $value =
        strtolower(
            trim((string)$value)
        );

    return in_array(
        $value,
        [
            "true",
            "yes",
            "1",
            "on"
        ],
        true
    );
}


/*
|--------------------------------------------------------------------------
| DATE HELPER
|--------------------------------------------------------------------------
*/

function withdrawalDate(
    $value
): ?string {

    try {

        if (
            $value instanceof
            MongoDB\BSON\UTCDateTime
        ) {

            return $value
                ->toDateTime()
                ->format(DATE_ATOM);
        }


        if (
            $value instanceof
            DateTimeInterface
        ) {

            return $value
                ->format(DATE_ATOM);
        }


        if (
            is_string($value) &&
            trim($value) !== ""
        ) {

            return date(
                DATE_ATOM,
                strtotime($value)
            );
        }

    } catch (Throwable $e) {

        return null;
    }

    return null;
}


/*
|--------------------------------------------------------------------------
| ADMIN AUTHORIZATION
|--------------------------------------------------------------------------
*/

function getWithdrawalAdmin(
    MongoDB\Collection $users
): array {

    /*
    |--------------------------------------------------------------------------
    | SESSION USER ID
    |--------------------------------------------------------------------------
    */

    $sessionUserId =
        $_SESSION["user_id"]
        ?? $_SESSION["userId"]
        ?? null;


    $sessionEmail =
        $_SESSION["email"]
        ?? $_SESSION["user_email"]
        ?? null;


    if (
        empty($sessionUserId) &&
        empty($sessionEmail)
    ) {

        withdrawalResponse(401, [

            "success" => false,

            "message" =>
                "Please login first."

        ]);
    }


    $admin = null;


    /*
    |--------------------------------------------------------------------------
    | LOOK UP BY OBJECT ID
    |--------------------------------------------------------------------------
    */

    if (
        !empty($sessionUserId) &&
        preg_match(
            '/^[a-f0-9]{24}$/i',
            (string)$sessionUserId
        )
    ) {

        try {

            $admin =
                $users->findOne([
                    "_id" =>
                        new MongoDB\BSON\ObjectId(
                            (string)$sessionUserId
                        )
                ]);

        } catch (Throwable $e) {

            $admin = null;
        }
    }


    /*
    |--------------------------------------------------------------------------
    | LOOK UP BY STRING ID
    |--------------------------------------------------------------------------
    */

    if (
        !$admin &&
        !empty($sessionUserId)
    ) {

        try {

            $admin =
                $users->findOne([
                    "id" =>
                        (string)$sessionUserId
                ]);

        } catch (Throwable $e) {

            $admin = null;
        }
    }


    /*
    |--------------------------------------------------------------------------
    | LOOK UP BY EMAIL
    |--------------------------------------------------------------------------
    */

    if (
        !$admin &&
        !empty($sessionEmail)
    ) {

        try {

            $admin =
                $users->findOne([
                    "email" =>
                        strtolower(
                            trim(
                                (string)$sessionEmail
                            )
                        )
                ]);

        } catch (Throwable $e) {

            $admin = null;
        }
    }


    if (!$admin) {

        withdrawalResponse(401, [

            "success" => false,

            "message" =>
                "Administrator account was not found."

        ]);
    }


    /*
    |--------------------------------------------------------------------------
    | ROLE
    |--------------------------------------------------------------------------
    */

    $role =
        strtolower(
            trim(
                (string)(
                    $admin["role"]
                    ?? ""
                )
            )
        );


    $accountType =
        strtolower(
            trim(
                (string)(
                    $admin["account_type"]
                    ?? ""
                )
            )
        );


    $adminEmail =
        strtolower(
            trim(
                (string)(
                    $admin["email"]
                    ?? ""
                )
            )
        );


    /*
    |--------------------------------------------------------------------------
    | ENVIRONMENT ADMIN SETTINGS
    |--------------------------------------------------------------------------
    */

    $configuredAdminEmail =
        strtolower(
            trim(
                (string)(
                    getenv("ADMIN_EMAIL")
                    ?: ""
                )
            )
        );


    $configuredAdminId =
        trim(
            (string)(
                getenv("ADMIN_USER_ID")
                ?: ""
            )
        );


    $documentId =
        isset($admin["_id"])
            ? (string)$admin["_id"]
            : "";


    $isConfiguredAdmin =
        (
            $configuredAdminEmail !== "" &&
            $adminEmail ===
            $configuredAdminEmail
        )
        ||
        (
            $configuredAdminId !== "" &&
            (
                $documentId ===
                $configuredAdminId
                ||
                (string)(
                    $admin["id"]
                    ?? ""
                ) ===
                $configuredAdminId
            )
        );


    $isRoleAdmin =
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


    if (
        !$isRoleAdmin &&
        !$isConfiguredAdmin
    ) {

        withdrawalResponse(403, [

            "success" => false,

            "message" =>
                "Access denied. Administrator permission is required."

        ]);
    }


    /*
    |--------------------------------------------------------------------------
    | RETURN ADMIN INFORMATION
    |--------------------------------------------------------------------------
    */

    return [

        "id" =>
            $admin["_id"]
            ?? ($admin["id"] ?? null),

        "email" =>
            $adminEmail,

        "firstName" =>
            (string)(
                $admin["firstName"]
                ?? $admin["first_name"]
                ?? ""
            ),

        "lastName" =>
            (string)(
                $admin["lastName"]
                ?? $admin["last_name"]
                ?? ""
            )

    ];
}


/*
|--------------------------------------------------------------------------
| ADMIN CHECK
|--------------------------------------------------------------------------
*/

$admin =
    getWithdrawalAdmin($users);


/*
|--------------------------------------------------------------------------
| GET WITHDRAWALS
|--------------------------------------------------------------------------
*/

if ($_SERVER["REQUEST_METHOD"] === "GET") {

    try {

        /*
        |--------------------------------------------------------------------------
        | WITHDRAWAL FILTER
        |--------------------------------------------------------------------------
        |
        | Support both modern and older Crown Cash transaction records.
        |--------------------------------------------------------------------------
        */

        $withdrawalFilter = [

            '$or' => [

                [
                    "type" =>
                        [
                            '$in' => [
                                "withdrawal",
                                "Withdrawal",
                                "WITHDRAWAL"
                            ]
                        ]
                ],

                [
                    "payout_sent" =>
                        [
                            '$exists' => true
                        ]
                ],

                [
                    "balance_reserved" =>
                        true
                ],

                [
                    "admin_approved" =>
                        true
                ]

            ]

        ];


        /*
        |--------------------------------------------------------------------------
        | LOAD TRANSACTIONS
        |--------------------------------------------------------------------------
        */

        $cursor =
            $transactions->find(
                $withdrawalFilter,
                [
                    "sort" => [
                        "created_at" => -1
                    ],

                    "limit" => 500
                ]
            );


        $withdrawals = [];

        $userCache = [];


        /*
        |--------------------------------------------------------------------------
        | PROCESS EACH WITHDRAWAL
        |--------------------------------------------------------------------------
        */

        foreach ($cursor as $withdrawal) {

            try {

                /*
                |--------------------------------------------------------------------------
                | ID
                |--------------------------------------------------------------------------
                */

                $withdrawalId =
                    isset($withdrawal["_id"])
                        ? (string)$withdrawal["_id"]
                        : "";


                if ($withdrawalId === "") {
                    continue;
                }


                /*
                |--------------------------------------------------------------------------
                | USER ID
                |--------------------------------------------------------------------------
                */

                $userIdValue =
                    $withdrawal["user_id"]
                    ?? $withdrawal["userId"]
                    ?? null;


                $userId =
                    $userIdValue
                        ? (string)$userIdValue
                        : "";


                /*
                |--------------------------------------------------------------------------
                | USER INFORMATION
                |--------------------------------------------------------------------------
                */

                $userName =
                    "Unknown User";

                $userEmail =
                    "";

                $userPhone =
                    "";


                if ($userId !== "") {

                    if (
                        !isset(
                            $userCache[$userId]
                        )
                    ) {

                        $user = null;


                        /*
                        |--------------------------------------------------------------------------
                        | ObjectId USER
                        |--------------------------------------------------------------------------
                        */

                        if (
                            $userIdValue
                            instanceof
                            MongoDB\BSON\ObjectId
                        ) {

                            $user =
                                $users->findOne([
                                    "_id" =>
                                        $userIdValue
                                ]);

                        } else {

                            /*
                            |--------------------------------------------------------------------------
                            | Try ObjectId
                            |--------------------------------------------------------------------------
                            */

                            try {

                                if (
                                    preg_match(
                                        '/^[a-f0-9]{24}$/i',
                                        $userId
                                    )
                                ) {

                                    $user =
                                        $users->findOne([
                                            "_id" =>
                                                new MongoDB\BSON\ObjectId(
                                                    $userId
                                                )
                                        ]);
                                }

                            } catch (Throwable $e) {

                                $user = null;
                            }


                            /*
                            |--------------------------------------------------------------------------
                            | Try string user_id
                            |--------------------------------------------------------------------------
                            */

                            if (!$user) {

                                $user =
                                    $users->findOne([
                                        "id" =>
                                            $userId
                                    ]);
                            }
                        }


                        $userCache[$userId] =
                            $user;
                    }


                    $user =
                        $userCache[$userId];


                    if ($user) {

                        $firstName =
                            trim(
                                (string)(
                                    $user["firstName"]
                                    ?? $user["first_name"]
                                    ?? ""
                                )
                            );


                        $lastName =
                            trim(
                                (string)(
                                    $user["lastName"]
                                    ?? $user["last_name"]
                                    ?? ""
                                )
                            );


                        $userName =
                            trim(
                                $firstName .
                                " " .
                                $lastName
                            );


                        if (
                            $userName === ""
                        ) {

                            $userName =
                                (string)(
                                    $user["name"]
                                    ?? $user["full_name"]
                                    ?? "Unknown User"
                                );
                        }


                        $userEmail =
                            (string)(
                                $user["email"]
                                ?? ""
                            );


                        $userPhone =
                            (string)(
                                $user["phone"]
                                ?? $user["phone_number"]
                                ?? ""
                            );
                    }
                }


                /*
                |--------------------------------------------------------------------------
                | DATE
                |--------------------------------------------------------------------------
                */

                $createdAt =
                    withdrawalDate(
                        $withdrawal["created_at"]
                        ?? $withdrawal["createdAt"]
                        ?? null
                    );


                $updatedAt =
                    withdrawalDate(
                        $withdrawal["updated_at"]
                        ?? $withdrawal["updatedAt"]
                        ?? null
                    );


                /*
                |--------------------------------------------------------------------------
                | STATUS
                |--------------------------------------------------------------------------
                */

                $status =
                    strtolower(
                        trim(
                            (string)(
                                $withdrawal["status"]
                                ?? "pending"
                            )
                        )
                    );


                /*
                |--------------------------------------------------------------------------
                | RESPONSE OBJECT
                |--------------------------------------------------------------------------
                */

                $withdrawals[] = [

                    "id" =>
                        $withdrawalId,

                    "reference" =>
                        (string)(
                            $withdrawal["reference"]
                            ?? ""
                        ),

                    "user_id" =>
                        $userId,

                    "user_name" =>
                        $userName,

                    "user_email" =>
                        $userEmail,

                    "user_phone" =>
                        $userPhone,

                    "amount" =>
                        withdrawalMoney(
                            $withdrawal["amount"]
                            ?? 0
                        ),

                    "currency" =>
                        strtoupper(
                            (string)(
                                $withdrawal["currency"]
                                ?? "UGX"
                            )
                        ),

                    "method" =>
                        strtoupper(
                            (string)(
                                $withdrawal["method"]
                                ?? $withdrawal["payment_method"]
                                ?? ""
                            )
                        ),

                    "account" =>
                        (string)(
                            $withdrawal["account"]
                            ?? $withdrawal["account_number"]
                            ?? $withdrawal["phone"]
                            ?? ""
                        ),

                    "status" =>
                        $status,

                    "balance_reserved" =>
                        withdrawalBool(
                            $withdrawal["balance_reserved"]
                            ?? false
                        ),

                    "balance_deducted" =>
                        withdrawalBool(
                            $withdrawal["balance_deducted"]
                            ?? false
                        ),

                    "balance_restored" =>
                        withdrawalBool(
                            $withdrawal["balance_restored"]
                            ?? false
                        ),

                    "payout_sent" =>
                        withdrawalBool(
                            $withdrawal["payout_sent"]
                            ?? false
                        ),

                    "admin_approved" =>
                        withdrawalBool(
                            $withdrawal["admin_approved"]
                            ?? false
                        ),

                    "admin_rejected" =>
                        withdrawalBool(
                            $withdrawal["admin_rejected"]
                            ?? false
                        ),

                    "created_at" =>
                        $createdAt,

                    "updated_at" =>
                        $updatedAt

                ];

            } catch (Throwable $rowError) {

                /*
                |--------------------------------------------------------------------------
                | Do not allow one bad withdrawal record to break
                | the entire admin withdrawals page.
                |--------------------------------------------------------------------------
                */

                error_log(
                    "CROWN CASH WITHDRAWAL ROW ERROR: " .
                    $rowError->getMessage()
                );

                continue;
            }
        }


        /*
        |--------------------------------------------------------------------------
        | TOTALS
        |--------------------------------------------------------------------------
        */

        $totalWithdrawals =
            0.0;

        $pendingWithdrawals =
            0.0;

        $approvedWithdrawals =
            0.0;

        $rejectedWithdrawals =
            0.0;


        foreach ($withdrawals as $item) {

            $amount =
                (float)(
                    $item["amount"]
                    ?? 0
                );


            $totalWithdrawals +=
                $amount;


            if (
                $item["status"] ===
                "pending"
            ) {

                $pendingWithdrawals +=
                    $amount;
            }


            if (
                in_array(
                    $item["status"],
                    [
                        "approved",
                        "completed",
                        "success",
                        "successful"
                    ],
                    true
                )
            ) {

                $approvedWithdrawals +=
                    $amount;
            }


            if (
                in_array(
                    $item["status"],
                    [
                        "rejected",
                        "declined",
                        "cancelled",
                        "canceled"
                    ],
                    true
                )
            ) {

                $rejectedWithdrawals +=
                    $amount;
            }
        }


        /*
        |--------------------------------------------------------------------------
        | SUCCESS
        |--------------------------------------------------------------------------
        */

        withdrawalResponse(200, [

            "success" =>
                true,

            "message" =>
                "Withdrawals loaded successfully.",

            "withdrawals" =>
                $withdrawals,

            "count" =>
                count($withdrawals),

            "totals" => [

                "total" =>
                    $totalWithdrawals,

                "pending" =>
                    $pendingWithdrawals,

                "approved" =>
                    $approvedWithdrawals,

                "rejected" =>
                    $rejectedWithdrawals

            ]

        ]);

    } catch (Throwable $e) {

        error_log(
            "CROWN CASH ADMIN WITHDRAWAL GET ERROR: " .
            $e->getMessage()
        );

        withdrawalResponse(500, [

            "success" =>
                false,

            "message" =>
                "Unable to load withdrawals.",

            "error" =>
                $e->getMessage()

        ]);
    }
}


/*
|--------------------------------------------------------------------------
| POST — APPROVE / REJECT
|--------------------------------------------------------------------------
*/

if ($_SERVER["REQUEST_METHOD"] === "POST") {

    try {

        /*
        |--------------------------------------------------------------------------
        | READ JSON
        |--------------------------------------------------------------------------
        */

        $rawData =
            file_get_contents(
                "php://input"
            );


        $data =
            json_decode(
                $rawData,
                true
            );


        if (!is_array($data)) {

            withdrawalResponse(400, [

                "success" =>
                    false,

                "message" =>
                    "Invalid request data."

            ]);
        }


        $withdrawalId =
            trim(
                (string)(
                    $data["withdrawalId"]
                    ?? $data["withdrawal_id"]
                    ?? $data["id"]
                    ?? ""
                )
            );


        $action =
            strtolower(
                trim(
                    (string)(
                        $data["action"]
                        ?? ""
                    )
                )
            );


        /*
        |--------------------------------------------------------------------------
        | VALIDATION
        |--------------------------------------------------------------------------
        */

        if ($withdrawalId === "") {

            withdrawalResponse(400, [

                "success" =>
                    false,

                "message" =>
                    "Withdrawal ID is required."

            ]);
        }


        if (
            !in_array(
                $action,
                [
                    "approve",
                    "reject"
                ],
                true
            )
        ) {

            withdrawalResponse(400, [

                "success" =>
                    false,

                "message" =>
                    "Invalid withdrawal action."

            ]);
        }


        /*
        |--------------------------------------------------------------------------
        | ID FILTER
        |--------------------------------------------------------------------------
        */

        $idFilter = null;


        if (
            preg_match(
                '/^[a-f0-9]{24}$/i',
                $withdrawalId
            )
        ) {

            $idFilter = [

                "_id" =>
                    new MongoDB\BSON\ObjectId(
                        $withdrawalId
                    )

            ];

        } else {

            $idFilter = [

                "reference" =>
                    $withdrawalId

            ];
        }


        /*
        |--------------------------------------------------------------------------
        | FIND PENDING WITHDRAWAL
        |--------------------------------------------------------------------------
        */

        $withdrawal =
            $transactions->findOne([

                '$and' => [

                    $idFilter,

                    [
                        '$or' => [

                            [
                                "type" =>
                                    "withdrawal"
                            ],

                            [
                                "payout_sent" =>
                                    [
                                        '$exists' =>
                                            true
                                    ]
                            ],

                            [
                                "balance_reserved" =>
                                    true
                            ]

                        ]
                    ],

                    [
                        "status" =>
                            "pending"
                    ]

                ]

            ]);


        if (!$withdrawal) {

            withdrawalResponse(409, [

                "success" =>
                    false,

                "message" =>
                    "This withdrawal is no longer pending, has already been processed, or could not be found."

            ]);
        }


        /*
        |--------------------------------------------------------------------------
        | AMOUNT
        |--------------------------------------------------------------------------
        */

        $amount =
            withdrawalMoney(
                $withdrawal["amount"]
                ?? 0
            );


        if ($amount <= 0) {

            withdrawalResponse(400, [

                "success" =>
                    false,

                "message" =>
                    "Invalid withdrawal amount."

            ]);
        }


        /*
        |--------------------------------------------------------------------------
        | USER ID
        |--------------------------------------------------------------------------
        */

        $withdrawalUser =
            $withdrawal["user_id"]
            ?? $withdrawal["userId"]
            ?? null;


        if ($withdrawalUser === null) {

            withdrawalResponse(400, [

                "success" =>
                    false,

                "message" =>
                    "Withdrawal has no associated user account."

            ]);
        }


        /*
        |--------------------------------------------------------------------------
        | NORMALIZE USER ID
        |--------------------------------------------------------------------------
        */

        $userFilter = null;


        if (
            $withdrawalUser
            instanceof MongoDB\BSON\ObjectId
        ) {

            $userFilter = [

                "_id" =>
                    $withdrawalUser

            ];

        } else {

            $userIdString =
                (string)$withdrawalUser;


            if (
                preg_match(
                    '/^[a-f0-9]{24}$/i',
                    $userIdString
                )
            ) {

                $userFilter = [

                    "_id" =>
                        new MongoDB\BSON\ObjectId(
                            $userIdString
                        )

                ];

            } else {

                $userFilter = [

                    "id" =>
                        $userIdString

                ];
            }
        }


        /*
        |--------------------------------------------------------------------------
        | CURRENT TIME
        |--------------------------------------------------------------------------
        */

        $now =
            new MongoDB\BSON\UTCDateTime();


        /*
        |--------------------------------------------------------------------------
        | APPROVE
        |--------------------------------------------------------------------------
        */

        if ($action === "approve") {

            /*
            |--------------------------------------------------------------------------
            | Approval does NOT return money.
            |
            | The amount was already reserved/deducted when the
            | withdrawal was created.
            |--------------------------------------------------------------------------
            */

            $update =
                $transactions->updateOne(

                    [
                        "_id" =>
                            $withdrawal["_id"],

                        "status" =>
                            "pending"

                    ],

                    [
                        '$set' => [

                            "status" =>
                                "approved",

                            "admin_approved" =>
                                true,

                            "admin_rejected" =>
                                false,

                            "balance_reserved" =>
                                false,

                            "balance_deducted" =>
                                true,

                            "balance_restored" =>
                                false,

                            "admin_id" =>
                                $admin["id"],

                            "admin_email" =>
                                $admin["email"],

                            "admin_action_at" =>
                                $now,

                            "updated_at" =>
                                $now

                        ]

                    ]
                );


            if (
                $update->getModifiedCount()
                !== 1
            ) {

                withdrawalResponse(409, [

                    "success" =>
                        false,

                    "message" =>
                        "The withdrawal could not be approved because it was already processed."

                ]);
            }


            withdrawalResponse(200, [

                "success" =>
                    true,

                "message" =>
                    "Withdrawal approved successfully. The payout still needs to be sent through the authorized payment provider.",

                "withdrawal" => [

                    "id" =>
                        (string)(
                            $withdrawal["_id"]
                        ),

                    "reference" =>
                        (string)(
                            $withdrawal["reference"]
                            ?? ""
                        ),

                    "amount" =>
                        $amount,

                    "status" =>
                        "approved"

                ]

            ]);
        }


        /*
        |--------------------------------------------------------------------------
        | REJECT
        |--------------------------------------------------------------------------
        */

        if ($action === "reject") {

            /*
            |--------------------------------------------------------------------------
            | Find user
            |--------------------------------------------------------------------------
            */

            $user =
                $users->findOne(
                    $userFilter
                );


            if (!$user) {

                withdrawalResponse(404, [

                    "success" =>
                        false,

                    "message" =>
                        "The user account connected to this withdrawal was not found."

                ]);
            }


            /*
            |--------------------------------------------------------------------------
            | RESTORE RESERVED BALANCE
            |--------------------------------------------------------------------------
            */

            $balanceRestore =
                $users->updateOne(

                    $userFilter,

                    [
                        '$inc' => [

                            "balance" =>
                                $amount

                        ],

                        '$set' => [

                            "updated_at" =>
                                $now

                        ]

                    ]
                );


            if (
                $balanceRestore->getModifiedCount()
                !== 1
            ) {

                withdrawalResponse(500, [

                    "success" =>
                        false,

                    "message" =>
                        "The user's balance could not be restored."

                ]);
            }


            /*
            |--------------------------------------------------------------------------
            | MARK REJECTED
            |--------------------------------------------------------------------------
            */

            $update =
                $transactions->updateOne(

                    [
                        "_id" =>
                            $withdrawal["_id"],

                        "status" =>
                            "pending"

                    ],

                    [
                        '$set' => [

                            "status" =>
                                "rejected",

                            "admin_approved" =>
                                false,

                            "admin_rejected" =>
                                true,

                            "balance_reserved" =>
                                false,

                            "balance_deducted" =>
                                false,

                            "balance_restored" =>
                                true,

                            "payout_sent" =>
                                false,

                            "admin_id" =>
                                $admin["id"],

                            "admin_email" =>
                                $admin["email"],

                            "admin_action_at" =>
                                $now,

                            "updated_at" =>
                                $now

                        ]

                    ]
                );


            if (
                $update->getModifiedCount()
                !== 1
            ) {

                /*
                |--------------------------------------------------------------------------
                | IMPORTANT:
                |
                | Because this deployment may not support MongoDB
                | transactions, try to undo the balance restoration
                | if updating the withdrawal failed.
                |--------------------------------------------------------------------------
                */

                try {

                    $users->updateOne(

                        $userFilter,

                        [
                            '$inc' => [

                                "balance" =>
                                    -$amount

                            ]

                        ]

                    );

                } catch (Throwable $rollbackError) {

                    error_log(
                        "CROWN CASH WITHDRAWAL BALANCE ROLLBACK ERROR: " .
                        $rollbackError->getMessage()
                    );
                }


                withdrawalResponse(409, [

                    "success" =>
                        false,

                    "message" =>
                        "The withdrawal could not be rejected because it was already processed."

                ]);
            }


            withdrawalResponse(200, [

                "success" =>
                    true,

                "message" =>
                    "Withdrawal rejected successfully and the amount has been returned to the user's available balance.",

                "withdrawal" => [

                    "id" =>
                        (string)(
                            $withdrawal["_id"]
                        ),

                    "reference" =>
                        (string)(
                            $withdrawal["reference"]
                            ?? ""
                        ),

                    "amount" =>
                        $amount,

                    "status" =>
                        "rejected",

                    "balance_restored" =>
                        true

                ]

            ]);
        }


        /*
        |--------------------------------------------------------------------------
        | FALLBACK
        |--------------------------------------------------------------------------
        */

        withdrawalResponse(400, [

            "success" =>
                false,

            "message" =>
                "Unknown withdrawal action."

        ]);

    } catch (Throwable $e) {

        error_log(
            "CROWN CASH ADMIN WITHDRAWAL POST ERROR: " .
            $e->getMessage()
        );


        withdrawalResponse(500, [

            "success" =>
                false,

            "message" =>
                "Unable to process the withdrawal request.",

            "error" =>
                $e->getMessage()

        ]);
    }
}


/*
|--------------------------------------------------------------------------
| METHOD NOT ALLOWED
|--------------------------------------------------------------------------
*/

withdrawalResponse(405, [

    "success" =>
        false,

    "message" =>
        "Method not allowed."

]);

?>