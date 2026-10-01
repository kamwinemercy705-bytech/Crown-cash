<?php

/*
|--------------------------------------------------------------------------
| CROWN CASH — ADMIN WITHDRAWAL MANAGEMENT API
|--------------------------------------------------------------------------
|
| GET  = Load withdrawal requests
| POST = Approve or reject a withdrawal
|
| IMPORTANT ACCOUNTING RULE:
|
| 1. Withdrawal creation reserves/deducts money from the user's balance.
| 2. Approval DOES NOT deduct money again.
| 3. Rejection restores the reserved amount.
| 4. This API does NOT automatically send Mobile Money.
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
header("Expires: 0");


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
| LOAD CONFIGURATION
|--------------------------------------------------------------------------
*/

try {

    require_once __DIR__ . "/config.php";

} catch (Throwable $e) {

    http_response_code(500);

    echo json_encode([
        "success" => false,
        "message" => "Unable to load Crown Cash configuration.",
        "error" => $e->getMessage(),
        "file" => $e->getFile(),
        "line" => $e->getLine()
    ]);

    exit;
}


/*
|--------------------------------------------------------------------------
| START SESSION
|--------------------------------------------------------------------------
*/

try {

    if (function_exists("startSecureSession")) {

        startSecureSession();

    } else {

        if (session_status() !== PHP_SESSION_ACTIVE) {

            session_set_cookie_params([
                "lifetime" => 0,
                "path" => "/",
                "domain" => "",
                "secure" => true,
                "httponly" => true,
                "samesite" => "None"
            ]);

            session_start();
        }
    }

} catch (Throwable $e) {

    http_response_code(500);

    echo json_encode([
        "success" => false,
        "message" => "Unable to start secure session.",
        "error" => $e->getMessage(),
        "file" => $e->getFile(),
        "line" => $e->getLine()
    ]);

    exit;
}


/*
|--------------------------------------------------------------------------
| RESPONSE HELPER
|--------------------------------------------------------------------------
*/

function ccWithdrawalResponse(
    int $status,
    array $data
): void {

    http_response_code($status);

    echo json_encode(
        $data,
        JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE
    );

    exit;
}


/*
|--------------------------------------------------------------------------
| CHECK REQUIRED DATABASE COLLECTIONS
|--------------------------------------------------------------------------
*/

if (!isset($users)) {

    ccWithdrawalResponse(500, [
        "success" => false,
        "message" => "Users collection is not available.",
        "error" => "Variable \$users is not defined in config.php."
    ]);
}


if (!isset($transactions)) {

    ccWithdrawalResponse(500, [
        "success" => false,
        "message" => "Transactions collection is not available.",
        "error" => "Variable \$transactions is not defined in config.php."
    ]);
}


/*
|--------------------------------------------------------------------------
| VALUE HELPERS
|--------------------------------------------------------------------------
*/

function ccWithdrawalMoney($value): float
{
    if ($value === null) {
        return 0.0;
    }

    try {

        if ($value instanceof MongoDB\BSON\Decimal128) {
            return (float)$value->__toString();
        }

        if ($value instanceof MongoDB\BSON\Int64) {
            return (float)$value->__toString();
        }

    } catch (Throwable $e) {
        return 0.0;
    }

    return (float)$value;
}


function ccWithdrawalBool($value): bool
{
    if (is_bool($value)) {
        return $value;
    }

    if (is_numeric($value)) {
        return ((int)$value) === 1;
    }

    $value = strtolower(trim((string)$value));

    return in_array(
        $value,
        [
            "1",
            "true",
            "yes",
            "on"
        ],
        true
    );
}


function ccWithdrawalDate($value): ?string
{
    try {

        if ($value instanceof MongoDB\BSON\UTCDateTime) {

            return $value
                ->toDateTime()
                ->format(DATE_ATOM);
        }


        if ($value instanceof DateTimeInterface) {

            return $value->format(DATE_ATOM);
        }


        if (is_string($value) && trim($value) !== "") {

            $timestamp = strtotime($value);

            if ($timestamp !== false) {

                return date(
                    DATE_ATOM,
                    $timestamp
                );
            }
        }

    } catch (Throwable $e) {

        return null;
    }

    return null;
}


/*
|--------------------------------------------------------------------------
| FIND USER
|--------------------------------------------------------------------------
|
| Supports:
| - ObjectId
| - string ObjectId
| - custom id
|--------------------------------------------------------------------------
*/

function ccFindWithdrawalUser(
    $users,
    $userValue
) {

    if ($userValue === null || $userValue === "") {
        return null;
    }


    /*
    |--------------------------------------------------------------------------
    | Already an ObjectId
    |--------------------------------------------------------------------------
    */

    if ($userValue instanceof MongoDB\BSON\ObjectId) {

        try {

            return $users->findOne([
                "_id" => $userValue
            ]);

        } catch (Throwable $e) {

            return null;
        }
    }


    $userString = (string)$userValue;


    /*
    |--------------------------------------------------------------------------
    | Try ObjectId
    |--------------------------------------------------------------------------
    */

    if (
        preg_match(
            '/^[a-f0-9]{24}$/i',
            $userString
        )
    ) {

        try {

            $user = $users->findOne([
                "_id" =>
                    new MongoDB\BSON\ObjectId(
                        $userString
                    )
            ]);

            if ($user) {
                return $user;
            }

        } catch (Throwable $e) {
            // Continue to custom ID search.
        }
    }


    /*
    |--------------------------------------------------------------------------
    | Try custom id
    |--------------------------------------------------------------------------
    */

    try {

        $user = $users->findOne([
            "id" => $userString
        ]);

        if ($user) {
            return $user;
        }

    } catch (Throwable $e) {
        // Continue.
    }


    /*
    |--------------------------------------------------------------------------
    | Try user_id
    |--------------------------------------------------------------------------
    */

    try {

        $user = $users->findOne([
            "user_id" => $userString
        ]);

        if ($user) {
            return $user;
        }

    } catch (Throwable $e) {
        // Continue.
    }


    return null;
}


/*
|--------------------------------------------------------------------------
| GET CURRENT ADMIN
|--------------------------------------------------------------------------
*/

function ccGetWithdrawalAdmin($users): array
{
    $sessionUserId =
        $_SESSION["user_id"]
        ?? $_SESSION["userId"]
        ?? null;


    $sessionEmail =
        $_SESSION["email"]
        ?? $_SESSION["user_email"]
        ?? null;


    /*
    |--------------------------------------------------------------------------
    | REQUIRE LOGIN
    |--------------------------------------------------------------------------
    */

    if (
        empty($sessionUserId) &&
        empty($sessionEmail)
    ) {

        ccWithdrawalResponse(401, [
            "success" => false,
            "message" => "Please login first."
        ]);
    }


    $admin = null;


    /*
    |--------------------------------------------------------------------------
    | LOOKUP BY OBJECT ID
    |--------------------------------------------------------------------------
    */

    if (!empty($sessionUserId)) {

        $sessionIdString =
            (string)$sessionUserId;


        if (
            preg_match(
                '/^[a-f0-9]{24}$/i',
                $sessionIdString
            )
        ) {

            try {

                $admin = $users->findOne([
                    "_id" =>
                        new MongoDB\BSON\ObjectId(
                            $sessionIdString
                        )
                ]);

            } catch (Throwable $e) {

                $admin = null;
            }
        }
    }


    /*
    |--------------------------------------------------------------------------
    | LOOKUP BY CUSTOM ID
    |--------------------------------------------------------------------------
    */

    if (
        !$admin &&
        !empty($sessionUserId)
    ) {

        try {

            $admin = $users->findOne([
                "id" =>
                    (string)$sessionUserId
            ]);

        } catch (Throwable $e) {

            $admin = null;
        }
    }


    /*
    |--------------------------------------------------------------------------
    | LOOKUP BY EMAIL
    |--------------------------------------------------------------------------
    */

    if (
        !$admin &&
        !empty($sessionEmail)
    ) {

        try {

            $admin = $users->findOne([
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


    /*
    |--------------------------------------------------------------------------
    | ADMIN NOT FOUND
    |--------------------------------------------------------------------------
    */

    if (!$admin) {

        ccWithdrawalResponse(401, [
            "success" => false,
            "message" =>
                "Administrator account was not found."
        ]);
    }


    /*
    |--------------------------------------------------------------------------
    | ADMIN DETAILS
    |--------------------------------------------------------------------------
    */

    $role = strtolower(
        trim(
            (string)(
                $admin["role"]
                ?? ""
            )
        )
    );


    $accountType = strtolower(
        trim(
            (string)(
                $admin["account_type"]
                ?? ""
            )
        )
    );


    $adminEmail = strtolower(
        trim(
            (string)(
                $admin["email"]
                ?? ""
            )
        )
    );


    $documentId =
        isset($admin["_id"])
            ? (string)$admin["_id"]
            : "";


    $customId =
        (string)(
            $admin["id"]
            ?? ""
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


    /*
    |--------------------------------------------------------------------------
    | ROLE ADMIN
    |--------------------------------------------------------------------------
    */

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


    /*
    |--------------------------------------------------------------------------
    | ENV ADMIN
    |--------------------------------------------------------------------------
    */

    $isConfiguredAdmin = false;


    if (
        $configuredAdminEmail !== "" &&
        $adminEmail !== "" &&
        $adminEmail === $configuredAdminEmail
    ) {

        $isConfiguredAdmin = true;
    }


    if (
        $configuredAdminId !== "" &&
        (
            $documentId === $configuredAdminId
            ||
            $customId === $configuredAdminId
        )
    ) {

        $isConfiguredAdmin = true;
    }


    /*
    |--------------------------------------------------------------------------
    | ACCESS DENIED
    |--------------------------------------------------------------------------
    */

    if (
        !$isRoleAdmin &&
        !$isConfiguredAdmin
    ) {

        ccWithdrawalResponse(403, [
            "success" => false,
            "message" =>
                "Access denied. Administrator permission is required."
        ]);
    }


    /*
    |--------------------------------------------------------------------------
    | RETURN ADMIN
    |--------------------------------------------------------------------------
    */

    return [

        "id" =>
            $admin["_id"]
            ?? (
                $admin["id"]
                ?? null
            ),

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
| AUTHENTICATE ADMIN
|--------------------------------------------------------------------------
*/

try {

    $admin =
        ccGetWithdrawalAdmin($users);

} catch (Throwable $e) {

    ccWithdrawalResponse(500, [
        "success" => false,
        "message" =>
            "Administrator authentication failed.",
        "error" =>
            $e->getMessage(),
        "file" =>
            $e->getFile(),
        "line" =>
            $e->getLine()
    ]);
}


/*
|--------------------------------------------------------------------------
| GET — LOAD WITHDRAWALS
|--------------------------------------------------------------------------
*/

if ($_SERVER["REQUEST_METHOD"] === "GET") {

    try {

        /*
        |--------------------------------------------------------------------------
        | WITHDRAWAL FILTER
        |--------------------------------------------------------------------------
        |
        | Crown Cash may have withdrawal records using different historical
        | fields. This filter supports all of them.
        |--------------------------------------------------------------------------
        */

        $withdrawalFilter = [

            '$or' => [

                [
                    "type" => [
                        '$in' => [
                            "withdrawal",
                            "Withdrawal",
                            "WITHDRAWAL"
                        ]
                    ]
                ],

                [
                    "type" => "withdraw"
                ],

                [
                    "transaction_type" => [
                        '$in' => [
                            "withdrawal",
                            "Withdrawal",
                            "WITHDRAWAL"
                        ]
                    ]
                ],

                [
                    "payout_sent" => [
                        '$exists" => true
                    ]
                ],

                [
                    "balance_reserved" => true
                ],

                [
                    "admin_approved" => true
                ],

                [
                    "admin_rejected" => true
                ]

            ]

        ];


        /*
        |--------------------------------------------------------------------------
        | IMPORTANT:
        |
        | Correct a MongoDB operator typo safely.
        |--------------------------------------------------------------------------
        */

        $withdrawalFilter["\$or"][3] = [
            "payout_sent" => [
                '$exists' => true
            ]
        ];


        /*
        |--------------------------------------------------------------------------
        | LOAD TRANSACTIONS
        |--------------------------------------------------------------------------
        */

        $cursor = $transactions->find(
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
        | PROCESS TRANSACTIONS
        |--------------------------------------------------------------------------
        */

        foreach ($cursor as $withdrawal) {

            try {

                /*
                |--------------------------------------------------------------------------
                | WITHDRAWAL ID
                |--------------------------------------------------------------------------
                */

                if (!isset($withdrawal["_id"])) {
                    continue;
                }


                $withdrawalId =
                    (string)$withdrawal["_id"];


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
                    $userIdValue !== null
                        ? (string)$userIdValue
                        : "";


                /*
                |--------------------------------------------------------------------------
                | DEFAULT USER INFORMATION
                |--------------------------------------------------------------------------
                */

                $userName =
                    "Unknown User";

                $userEmail =
                    "";

                $userPhone =
                    "";


                /*
                |--------------------------------------------------------------------------
                | LOAD USER
                |--------------------------------------------------------------------------
                */

                if ($userId !== "") {

                    if (!array_key_exists(
                        $userId,
                        $userCache
                    )) {

                        $userCache[$userId] =
                            ccFindWithdrawalUser(
                                $users,
                                $userIdValue
                            );
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


                        if ($userName === "") {

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
                                ?? $user["mobile"]
                                ?? ""
                            );
                    }
                }


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
                | CREATED / UPDATED
                |--------------------------------------------------------------------------
                */

                $createdAt =
                    ccWithdrawalDate(
                        $withdrawal["created_at"]
                        ?? $withdrawal["createdAt"]
                        ?? null
                    );


                $updatedAt =
                    ccWithdrawalDate(
                        $withdrawal["updated_at"]
                        ?? $withdrawal["updatedAt"]
                        ?? null
                    );


                /*
                |--------------------------------------------------------------------------
                | PAYMENT METHOD
                |--------------------------------------------------------------------------
                */

                $method =
                    (string)(
                        $withdrawal["method"]
                        ?? $withdrawal["payment_method"]
                        ?? $withdrawal["paymentMethod"]
                        ?? ""
                    );


                /*
                |--------------------------------------------------------------------------
                | PAYMENT ACCOUNT
                |--------------------------------------------------------------------------
                */

                $account =
                    (string)(
                        $withdrawal["account"]
                        ?? $withdrawal["account_number"]
                        ?? $withdrawal["accountNumber"]
                        ?? $withdrawal["phone"]
                        ?? $withdrawal["phone_number"]
                        ?? ""
                    );


                /*
                |--------------------------------------------------------------------------
                | AMOUNT
                |--------------------------------------------------------------------------
                */

                $amount =
                    ccWithdrawalMoney(
                        $withdrawal["amount"]
                        ?? $withdrawal["requested_amount"]
                        ?? $withdrawal["requestedAmount"]
                        ?? 0
                    );


                /*
                |--------------------------------------------------------------------------
                | ADD RESPONSE RECORD
                |--------------------------------------------------------------------------
                */

                $withdrawals[] = [

                    "id" =>
                        $withdrawalId,

                    "reference" =>
                        (string)(
                            $withdrawal["reference"]
                            ?? $withdrawal["transaction_reference"]
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
                        $amount,

                    "currency" =>
                        strtoupper(
                            (string)(
                                $withdrawal["currency"]
                                ?? "UGX"
                            )
                        ),

                    "method" =>
                        strtoupper(
                            $method
                        ),

                    "account" =>
                        $account,

                    "status" =>
                        $status,

                    "balance_reserved" =>
                        ccWithdrawalBool(
                            $withdrawal["balance_reserved"]
                            ?? false
                        ),

                    "balance_deducted" =>
                        ccWithdrawalBool(
                            $withdrawal["balance_deducted"]
                            ?? false
                        ),

                    "balance_restored" =>
                        ccWithdrawalBool(
                            $withdrawal["balance_restored"]
                            ?? false
                        ),

                    "payout_sent" =>
                        ccWithdrawalBool(
                            $withdrawal["payout_sent"]
                            ?? false
                        ),

                    "admin_approved" =>
                        ccWithdrawalBool(
                            $withdrawal["admin_approved"]
                            ?? false
                        ),

                    "admin_rejected" =>
                        ccWithdrawalBool(
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
                | A SINGLE BAD RECORD MUST NOT BREAK THE PAGE
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
        | CALCULATE TOTALS
        |--------------------------------------------------------------------------
        */

        $totalWithdrawals = 0.0;
        $pendingWithdrawals = 0.0;
        $approvedWithdrawals = 0.0;
        $rejectedWithdrawals = 0.0;


        foreach ($withdrawals as $item) {

            $amount =
                (float)(
                    $item["amount"]
                    ?? 0
                );


            $totalWithdrawals +=
                $amount;


            if (
                $item["status"] === "pending"
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
        | SUCCESS RESPONSE
        |--------------------------------------------------------------------------
        */

        ccWithdrawalResponse(200, [

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

        /*
        |--------------------------------------------------------------------------
        | DETAILED ERROR
        |--------------------------------------------------------------------------
        |
        | This is intentional while we diagnose the 500 error.
        |--------------------------------------------------------------------------
        */

        error_log(
            "CROWN CASH ADMIN WITHDRAWAL GET ERROR: " .
            $e->getMessage()
        );

        error_log(
            "FILE: " .
            $e->getFile()
        );

        error_log(
            "LINE: " .
            $e->getLine()
        );

        ccWithdrawalResponse(500, [

            "success" =>
                false,

            "message" =>
                "Unable to load withdrawals.",

            "error" =>
                $e->getMessage(),

            "file" =>
                $e->getFile(),

            "line" =>
                $e->getLine()

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
        | READ REQUEST BODY
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

            ccWithdrawalResponse(400, [

                "success" =>
                    false,

                "message" =>
                    "Invalid JSON request."

            ]);
        }


        /*
        |--------------------------------------------------------------------------
        | WITHDRAWAL ID
        |--------------------------------------------------------------------------
        */

        $withdrawalId =
            trim(
                (string)(
                    $data["withdrawalId"]
                    ?? $data["withdrawal_id"]
                    ?? $data["id"]
                    ?? ""
                )
            );


        /*
        |--------------------------------------------------------------------------
        | ACTION
        |--------------------------------------------------------------------------
        */

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
        | VALIDATE ID
        |--------------------------------------------------------------------------
        */

        if ($withdrawalId === "") {

            ccWithdrawalResponse(400, [

                "success" =>
                    false,

                "message" =>
                    "Withdrawal ID is required."

            ]);
        }


        /*
        |--------------------------------------------------------------------------
        | VALIDATE ACTION
        |--------------------------------------------------------------------------
        */

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

            ccWithdrawalResponse(400, [

                "success" =>
                    false,

                "message" =>
                    "Action must be approve or reject."

            ]);
        }


        /*
        |--------------------------------------------------------------------------
        | CREATE WITHDRAWAL ID FILTER
        |--------------------------------------------------------------------------
        */

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
                                    [
                                        '$in' => [
                                            "withdrawal",
                                            "Withdrawal",
                                            "WITHDRAWAL"
                                        ]
                                    ]
                            ],

                            [
                                "type" =>
                                    "withdraw"
                            ],

                            [
                                "transaction_type" =>
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
                            ]

                        ]
                    ],

                    [
                        "status" =>
                            "pending"
                    ]

                ]

            ]);


        /*
        |--------------------------------------------------------------------------
        | WITHDRAWAL NOT FOUND
        |--------------------------------------------------------------------------
        */

        if (!$withdrawal) {

            ccWithdrawalResponse(409, [

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
            ccWithdrawalMoney(
                $withdrawal["amount"]
                ?? $withdrawal["requested_amount"]
                ?? 0
            );


        if ($amount <= 0) {

            ccWithdrawalResponse(400, [

                "success" =>
                    false,

                "message" =>
                    "The withdrawal amount is invalid."

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

            ccWithdrawalResponse(400, [

                "success" =>
                    false,

                "message" =>
                    "This withdrawal has no associated user account."

            ]);
        }


        /*
        |--------------------------------------------------------------------------
        | USER FILTER
        |--------------------------------------------------------------------------
        */

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
            | IMPORTANT:
            |
            | Do NOT deduct balance here.
            |
            | Withdrawal creation already reserved/deducted it.
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
                $update->getModifiedCount() !== 1
            ) {

                ccWithdrawalResponse(409, [

                    "success" =>
                        false,

                    "message" =>
                        "The withdrawal could not be approved because it was already processed."

                ]);
            }


            ccWithdrawalResponse(200, [

                "success" =>
                    true,

                "message" =>
                    "Withdrawal approved successfully. Payment must still be completed through the authorized payment provider.",

                "withdrawal" => [

                    "id" =>
                        (string)$withdrawal["_id"],

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
            | FIND USER
            |--------------------------------------------------------------------------
            */

            $user =
                ccFindWithdrawalUser(
                    $users,
                    $withdrawalUser
                );


            if (!$user) {

                ccWithdrawalResponse(404, [

                    "success" =>
                        false,

                    "message" =>
                        "The user account connected to this withdrawal was not found."

                ]);
            }


            /*
            |--------------------------------------------------------------------------
            | RESTORE BALANCE
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
                $balanceRestore->getModifiedCount() !== 1
            ) {

                ccWithdrawalResponse(500, [

                    "success" =>
                        false,

                    "message" =>
                        "The user's balance could not be restored."

                ]);
            }


            /*
            |--------------------------------------------------------------------------
            | MARK WITHDRAWAL REJECTED
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


            /*
            |--------------------------------------------------------------------------
            | ROLLBACK BALANCE IF UPDATE FAILED
            |--------------------------------------------------------------------------
            */

            if (
                $update->getModifiedCount() !== 1
            ) {

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


                ccWithdrawalResponse(409, [

                    "success" =>
                        false,

                    "message" =>
                        "The withdrawal could not be rejected because it was already processed."

                ]);
            }


            /*
            |--------------------------------------------------------------------------
            | SUCCESS
            |--------------------------------------------------------------------------
            */

            ccWithdrawalResponse(200, [

                "success" =>
                    true,

                "message" =>
                    "Withdrawal rejected successfully and the amount has been returned to the user's balance.",

                "withdrawal" => [

                    "id" =>
                        (string)$withdrawal["_id"],

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
        | UNKNOWN ACTION
        |--------------------------------------------------------------------------
        */

        ccWithdrawalResponse(400, [

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

        error_log(
            "FILE: " .
            $e->getFile()
        );

        error_log(
            "LINE: " .
            $e->getLine()
        );


        ccWithdrawalResponse(500, [

            "success" =>
                false,

            "message" =>
                "Unable to process the withdrawal request.",

            "error" =>
                $e->getMessage(),

            "file" =>
                $e->getFile(),

            "line" =>
                $e->getLine()

        ]);
    }
}


/*
|--------------------------------------------------------------------------
| METHOD NOT ALLOWED
|--------------------------------------------------------------------------
*/

ccWithdrawalResponse(405, [

    "success" =>
        false,

    "message" =>
        "Method not allowed."

]);

?>