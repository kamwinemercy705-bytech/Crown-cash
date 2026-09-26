<?php

/*
|--------------------------------------------------------------------------
| Crown Cash - Admin Deposit Management API
|--------------------------------------------------------------------------
*/

header("Content-Type: application/json");

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
| Session configuration
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
| JSON response helper
|--------------------------------------------------------------------------
*/

function responseJson(
    bool $success,
    string $message,
    int $status = 200,
    array $extra = []
): void {

    http_response_code($status);

    echo json_encode(
        array_merge(
            [
                "success" => $success,
                "message" => $message
            ],
            $extra
        )
    );

    exit;
}


/*
|--------------------------------------------------------------------------
| Database
|--------------------------------------------------------------------------
*/

try {

    require_once __DIR__ . "/config.php";

} catch (Throwable $e) {

    responseJson(
        false,
        "Database configuration could not be loaded.",
        500
    );
}


/*
|--------------------------------------------------------------------------
| Verify required collections
|--------------------------------------------------------------------------
*/

if (!isset($users) || !isset($db)) {

    responseJson(
        false,
        "Database collections are not available.",
        500
    );
}


$deposits = $db->selectCollection("deposits");
$transactions = $db->selectCollection("transactions");
$auditLogs = $db->selectCollection("audit_logs");


/*
|--------------------------------------------------------------------------
| Verify logged-in session
|--------------------------------------------------------------------------
*/

if (
    !isset($_SESSION["logged_in"]) ||
    $_SESSION["logged_in"] !== true ||
    !isset($_SESSION["user_id"]) ||
    trim((string)$_SESSION["user_id"]) === ""
) {

    responseJson(
        false,
        "Please login first.",
        401
    );
}


/*
|--------------------------------------------------------------------------
| Session timeout
|--------------------------------------------------------------------------
*/

$loginTime = isset($_SESSION["login_time"])
    ? (int)$_SESSION["login_time"]
    : 0;

if (
    $loginTime > 0 &&
    (time() - $loginTime) > 7200
) {

    $_SESSION = [];

    session_destroy();

    responseJson(
        false,
        "Administrator session has expired. Please login again.",
        401
    );
}


/*
|--------------------------------------------------------------------------
| Current logged-in user ID
|--------------------------------------------------------------------------
*/

$sessionUserId = trim(
    (string)$_SESSION["user_id"]
);


/*
|--------------------------------------------------------------------------
| Find current user
|--------------------------------------------------------------------------
*/

$currentUser = null;


/*
|--------------------------------------------------------------------------
| Try ObjectId
|--------------------------------------------------------------------------
*/

try {

    $objectId = new MongoDB\BSON\ObjectId(
        $sessionUserId
    );

    $currentUser = $users->findOne([
        "_id" => $objectId
    ]);

} catch (Throwable $e) {

    // Continue to string lookup.
}


/*
|--------------------------------------------------------------------------
| Try string ID
|--------------------------------------------------------------------------
*/

if (!$currentUser) {

    try {

        $currentUser = $users->findOne([
            "_id" => $sessionUserId
        ]);

    } catch (Throwable $e) {

        // Continue.
    }
}


/*
|--------------------------------------------------------------------------
| Fallback to session email
|--------------------------------------------------------------------------
*/

if (
    !$currentUser &&
    !empty($_SESSION["user_email"])
) {

    $sessionEmail = strtolower(
        trim((string)$_SESSION["user_email"])
    );

    $currentUser = $users->findOne([
        "email" => $sessionEmail
    ]);
}


/*
|--------------------------------------------------------------------------
| User must exist
|--------------------------------------------------------------------------
*/

if (!$currentUser) {

    responseJson(
        false,
        "The logged-in account could not be found.",
        403
    );
}


/*
|--------------------------------------------------------------------------
| Current user database ID
|--------------------------------------------------------------------------
*/

$currentUserId = isset($currentUser["_id"])
    ? (string)$currentUser["_id"]
    : "";


/*
|--------------------------------------------------------------------------
| Account status
|--------------------------------------------------------------------------
*/

$status = strtolower(
    trim((string)(
        $currentUser["status"] ?? "active"
    ))
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
        $status,
        $blockedStatuses,
        true
    )
) {

    responseJson(
        false,
        "Administrator account is not active.",
        403
    );
}


/*
|--------------------------------------------------------------------------
| Check administrator role
|--------------------------------------------------------------------------
*/

$role = strtolower(
    trim((string)(
        $currentUser["role"] ?? ""
    ))
);

$accountType = strtolower(
    trim((string)(
        $currentUser["account_type"] ?? ""
    ))
);

$isAdmin = (
    $role === "admin" ||
    $role === "administrator" ||
    $accountType === "admin" ||
    $accountType === "administrator"
);

if (!$isAdmin) {

    responseJson(
        false,
        "Administrator privileges are required.",
        403
    );
}


/*
|--------------------------------------------------------------------------
| Verify configured administrator identity
|--------------------------------------------------------------------------
*/

$configuredAdminId = trim(
    (string)(getenv("ADMIN_USER_ID") ?: "")
);

$configuredAdminEmail = strtolower(
    trim((string)(getenv("ADMIN_EMAIL") ?: ""))
);


/*
|--------------------------------------------------------------------------
| Identity configuration required
|--------------------------------------------------------------------------
*/

if (
    $configuredAdminId === "" &&
    $configuredAdminEmail === ""
) {

    responseJson(
        false,
        "Administrator identity is not configured.",
        500
    );
}


/*
|--------------------------------------------------------------------------
| Match administrator ID
|--------------------------------------------------------------------------
*/

$identityAuthorized = false;

if (
    $configuredAdminId !== "" &&
    $currentUserId !== "" &&
    hash_equals(
        $configuredAdminId,
        $currentUserId
    )
) {

    $identityAuthorized = true;
}


/*
|--------------------------------------------------------------------------
| Match administrator email
|--------------------------------------------------------------------------
*/

if (
    !$identityAuthorized &&
    $configuredAdminEmail !== ""
) {

    $currentEmail = strtolower(
        trim((string)(
            $currentUser["email"] ?? ""
        ))
    );

    if (
        $currentEmail !== "" &&
        hash_equals(
            $configuredAdminEmail,
            $currentEmail
        )
    ) {

        $identityAuthorized = true;
    }
}


/*
|--------------------------------------------------------------------------
| Reject unauthorized administrator
|--------------------------------------------------------------------------
*/

if (!$identityAuthorized) {

    responseJson(
        false,
        "This administrator account is not authorized.",
        403
    );
}


/*
|--------------------------------------------------------------------------
| Refresh trusted session
|--------------------------------------------------------------------------
*/

$_SESSION["logged_in"] = true;

$_SESSION["user_id"] = $currentUserId;

$_SESSION["user_email"] = (string)(
    $currentUser["email"] ?? ""
);

$_SESSION["role"] = $role;

$_SESSION["account_type"] = $accountType;

$_SESSION["login_time"] = time();


/*
|--------------------------------------------------------------------------
| Helper: Find user by ID
|--------------------------------------------------------------------------
*/

function findDepositUser($users, $userId)
{
    if (
        $userId instanceof MongoDB\BSON\ObjectId
    ) {

        return $users->findOne([
            "_id" => $userId
        ]);
    }

    $userIdString = trim(
        (string)$userId
    );

    if ($userIdString === "") {
        return null;
    }


    /*
    |--------------------------------------------------------------
    | ObjectId lookup
    |--------------------------------------------------------------
    */

    try {

        $objectId = new MongoDB\BSON\ObjectId(
            $userIdString
        );

        $user = $users->findOne([
            "_id" => $objectId
        ]);

        if ($user) {
            return $user;
        }

    } catch (Throwable $e) {

        // Continue.
    }


    /*
    |--------------------------------------------------------------
    | String ID lookup
    |--------------------------------------------------------------
    */

    try {

        $user = $users->findOne([
            "_id" => $userIdString
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
| Helper: Convert MongoDB values to numbers
|--------------------------------------------------------------------------
*/

function depositNumber($value): float
{
    if (
        $value instanceof MongoDB\BSON\Decimal128
    ) {

        return (float)$value->__toString();
    }

    if (
        $value instanceof MongoDB\BSON\Int64
    ) {

        return (float)$value->__toString();
    }

    if (
        $value instanceof MongoDB\BSON\Int32
    ) {

        return (float)$value->__toString();
    }

    if (is_numeric($value)) {

        return (float)$value;
    }

    return 0;
}


/*
|--------------------------------------------------------------------------
| Helper: Format date
|--------------------------------------------------------------------------
*/

function depositDate($value): string
{
    if (
        $value instanceof MongoDB\BSON\UTCDateTime
    ) {

        return $value
            ->toDateTime()
            ->format("Y-m-d H:i:s");
    }

    if (is_string($value)) {

        return $value;
    }

    return "";
}


/*
|--------------------------------------------------------------------------
| GET - Load deposits
|--------------------------------------------------------------------------
*/

if ($_SERVER["REQUEST_METHOD"] === "GET") {

    try {

        $cursor = $deposits->find(
            [],
            [
                "sort" => [
                    "created_at" => -1
                ]
            ]
        );


        $depositList = [];

        $totalAmount = 0;

        $pendingAmount = 0;

        $approvedAmount = 0;

        $rejectedAmount = 0;


        foreach ($cursor as $deposit) {

            $depositId = isset($deposit["_id"])
                ? (string)$deposit["_id"]
                : "";


            /*
            |----------------------------------------------------------
            | User ID
            |----------------------------------------------------------
            */

            $depositUserId = null;

            if (
                isset($deposit["user_id"])
            ) {

                $depositUserId = $deposit["user_id"];

            } elseif (
                isset($deposit["userId"])
            ) {

                $depositUserId = $deposit["userId"];

            } elseif (
                isset($deposit["customer_id"])
            ) {

                $depositUserId = $deposit["customer_id"];
            }


            /*
            |----------------------------------------------------------
            | Find customer
            |----------------------------------------------------------
            */

            $customer = null;

            if ($depositUserId !== null) {

                $customer = findDepositUser(
                    $users,
                    $depositUserId
                );
            }


            /*
            |----------------------------------------------------------
            | Customer information
            |----------------------------------------------------------
            */

            $customerName = (string)(
                $deposit["full_name"] ??
                $deposit["customer_name"] ??
                ""
            );

            $customerEmail = (string)(
                $deposit["email"] ??
                $deposit["customer_email"] ??
                ""
            );

            $customerPhone = (string)(
                $deposit["phone"] ??
                $deposit["customer_phone"] ??
                ""
            );


            if ($customer) {

                if ($customerName === "") {

                    $customerName = (string)(
                        $customer["full_name"] ?? ""
                    );
                }

                if ($customerEmail === "") {

                    $customerEmail = (string)(
                        $customer["email"] ?? ""
                    );
                }

                if ($customerPhone === "") {

                    $customerPhone = (string)(
                        $customer["phone"] ??
                        $customer["phone_number"] ??
                        $customer["mobile"] ??
                        ""
                    );
                }
            }


            /*
            |----------------------------------------------------------
            | Amount
            |----------------------------------------------------------
            */

            $amount = depositNumber(
                $deposit["amount"] ?? 0
            );


            /*
            |----------------------------------------------------------
            | Status
            |----------------------------------------------------------
            */

            $statusValue = strtolower(
                trim((string)(
                    $deposit["status"] ?? "pending"
                ))
            );


            /*
            |----------------------------------------------------------
            | Payment method
            |----------------------------------------------------------
            */

            $method = strtolower(
                trim((string)(
                    $deposit["payment_method"] ??
                    $deposit["method"] ??
                    ""
                ))
            );


            /*
            |----------------------------------------------------------
            | Payment reference
            |----------------------------------------------------------
            */

            $reference = (string)(
                $deposit["transaction_reference"] ??
                $deposit["reference"] ??
                $deposit["payment_reference"] ??
                ""
            );


            /*
            |----------------------------------------------------------
            | Verification status
            |----------------------------------------------------------
            */

            $paymentVerified = (
                ($deposit["payment_verified"] ?? false) === true
            );


            /*
            |----------------------------------------------------------
            | Created date
            |----------------------------------------------------------
            */

            $createdAt = depositDate(
                $deposit["created_at"] ?? null
            );


            /*
            |----------------------------------------------------------
            | Summary calculations
            |----------------------------------------------------------
            */

            $totalAmount += $amount;

            if ($statusValue === "pending") {

                $pendingAmount += $amount;

            } elseif ($statusValue === "approved") {

                $approvedAmount += $amount;

            } elseif ($statusValue === "rejected") {

                $rejectedAmount += $amount;
            }


            /*
            |----------------------------------------------------------
            | Return deposit
            |----------------------------------------------------------
            */

            $depositList[] = [
                "id" => $depositId,
                "_id" => $depositId,

                "user_id" => $depositUserId !== null
                    ? (string)$depositUserId
                    : "",

                "customer_name" => $customerName,
                "full_name" => $customerName,

                "customer_email" => $customerEmail,
                "email" => $customerEmail,

                "customer_phone" => $customerPhone,
                "phone" => $customerPhone,

                "amount" => $amount,

                "payment_method" => $method,
                "method" => $method,

                "reference" => $reference,
                "transaction_reference" => $reference,

                "status" => $statusValue,

                "payment_verified" => $paymentVerified,

                "created_at" => $createdAt
            ];
        }


        /*
        |--------------------------------------------------------------
        | Return data
        |--------------------------------------------------------------
        */

        responseJson(
            true,
            "Deposits loaded successfully.",
            200,
            [
                "deposits" => $depositList,

                "data" => $depositList,

                "summary" => [
                    "total" => $totalAmount,
                    "pending" => $pendingAmount,
                    "approved" => $approvedAmount,
                    "rejected" => $rejectedAmount
                ],

                "statistics" => [
                    "total" => $totalAmount,
                    "pending" => $pendingAmount,
                    "approved" => $approvedAmount,
                    "rejected" => $rejectedAmount
                ]
            ]
        );

    } catch (Throwable $e) {

        responseJson(
            false,
            "Unable to load deposits.",
            500
        );
    }
}


/*
|--------------------------------------------------------------------------
| POST - Approve / Reject deposit
|--------------------------------------------------------------------------
*/

if ($_SERVER["REQUEST_METHOD"] === "POST") {

    try {

        $rawInput = file_get_contents(
            "php://input"
        );

        $input = json_decode(
            $rawInput,
            true
        );

        if (!is_array($input)) {

            $input = $_POST;
        }


        /*
        |--------------------------------------------------------------
        | Deposit ID
        |--------------------------------------------------------------
        */

        $depositId = trim(
            (string)(
                $input["deposit_id"] ??
                $input["id"] ??
                ""
            )
        );


        /*
        |--------------------------------------------------------------
        | Action
        |--------------------------------------------------------------
        */

        $action = strtolower(
            trim((string)(
                $input["action"] ?? ""
            ))
        );


        if ($depositId === "") {

            responseJson(
                false,
                "Deposit ID is required.",
                400
            );
        }


        if (
            $action !== "approve" &&
            $action !== "reject"
        ) {

            responseJson(
                false,
                "Invalid deposit action.",
                400
            );
        }


        /*
        |--------------------------------------------------------------
        | Convert deposit ID
        |--------------------------------------------------------------
        */

        try {

            $depositObjectId =
                new MongoDB\BSON\ObjectId(
                    $depositId
                );

        } catch (Throwable $e) {

            responseJson(
                false,
                "Invalid deposit ID.",
                400
            );
        }


        /*
        |--------------------------------------------------------------
        | Find deposit
        |--------------------------------------------------------------
        */

        $deposit = $deposits->findOne([
            "_id" => $depositObjectId
        ]);


        if (!$deposit) {

            responseJson(
                false,
                "Deposit was not found.",
                404
            );
        }


        /*
        |--------------------------------------------------------------
        | Current status
        |--------------------------------------------------------------
        */

        $currentStatus = strtolower(
            trim((string)(
                $deposit["status"] ?? "pending"
            ))
        );


        /*
        |--------------------------------------------------------------
        | Only pending deposits can be processed
        |--------------------------------------------------------------
        */

        if ($currentStatus !== "pending") {

            responseJson(
                false,
                "This deposit has already been processed.",
                409
            );
        }


        /*
        |--------------------------------------------------------------
        | Reject deposit
        |--------------------------------------------------------------
        */

        if ($action === "reject") {

            $updateResult = $deposits->updateOne(
                [
                    "_id" => $depositObjectId,
                    "status" => "pending"
                ],
                [
                    '$set' => [
                        "status" => "rejected",
                        "rejected_at" =>
                            new MongoDB\BSON\UTCDateTime(),
                        "rejected_by" =>
                            $currentUserId,
                        "updated_at" =>
                            new MongoDB\BSON\UTCDateTime()
                    ]
                ]
            );


            if (
                $updateResult->getModifiedCount() !== 1
            ) {

                responseJson(
                    false,
                    "Deposit could not be rejected.",
                    409
                );
            }


            /*
            |----------------------------------------------------------
            | Update transaction
            |----------------------------------------------------------
            */

            $transactions->updateMany(
                [
                    "deposit_id" => $depositObjectId
                ],
                [
                    '$set' => [
                        "status" => "rejected",
                        "updated_at" =>
                            new MongoDB\BSON\UTCDateTime()
                    ]
                ]
            );


            /*
            |----------------------------------------------------------
            | Audit log
            |----------------------------------------------------------
            */

            $auditLogs->insertOne([
                "action" => "deposit_rejected",
                "admin_user_id" => $currentUserId,
                "deposit_id" => $depositObjectId,
                "created_at" =>
                    new MongoDB\BSON\UTCDateTime()
            ]);


            responseJson(
                true,
                "Deposit rejected successfully.",
                200
            );
        }


        /*
        |--------------------------------------------------------------------------
        | APPROVAL
        |--------------------------------------------------------------------------
        */

        if ($action === "approve") {


            /*
            |----------------------------------------------------------
            | Admin payment verification
            |----------------------------------------------------------
            */

            $paymentVerified = (
                ($input["payment_verified"] ?? false) === true
            );


            if (!$paymentVerified) {

                responseJson(
                    false,
                    "Please verify the payment before approving this deposit.",
                    400
                );
            }


            /*
            |----------------------------------------------------------
            | Deposit customer ID
            |----------------------------------------------------------
            */

            $depositUserId = null;

            if (
                isset($deposit["user_id"])
            ) {

                $depositUserId =
                    $deposit["user_id"];

            } elseif (
                isset($deposit["userId"])
            ) {

                $depositUserId =
                    $deposit["userId"];

            } elseif (
                isset($deposit["customer_id"])
            ) {

                $depositUserId =
                    $deposit["customer_id"];
            }


            if ($depositUserId === null) {

                responseJson(
                    false,
                    "Customer account could not be identified.",
                    400
                );
            }


            /*
            |----------------------------------------------------------
            | Find customer
            |----------------------------------------------------------
            */

            $customer = findDepositUser(
                $users,
                $depositUserId
            );


            if (!$customer) {

                responseJson(
                    false,
                    "Customer account was not found.",
                    404
                );
            }


            /*
            |----------------------------------------------------------
            | Check customer status
            |----------------------------------------------------------
            */

            $customerStatus = strtolower(
                trim((string)(
                    $customer["status"] ?? "active"
                ))
            );


            if (
                in_array(
                    $customerStatus,
                    [
                        "blocked",
                        "suspended",
                        "disabled",
                        "banned",
                        "inactive"
                    ],
                    true
                )
            ) {

                responseJson(
                    false,
                    "Customer account is not active.",
                    400
                );
            }


            /*
            |----------------------------------------------------------
            | Amount
            |----------------------------------------------------------
            */

            $amount = depositNumber(
                $deposit["amount"] ?? 0
            );


            if ($amount <= 0) {

                responseJson(
                    false,
                    "Invalid deposit amount.",
                    400
                );
            }


            /*
            |----------------------------------------------------------
            | Customer ID
            |----------------------------------------------------------
            */

            $customerId = $customer["_id"];


            /*
            |----------------------------------------------------------
            | Credit balance
            |----------------------------------------------------------
            */

            $balanceResult = $users->updateOne(
                [
                    "_id" => $customerId
                ],
                [
                    '$inc' => [
                        "balance" => $amount,
                        "wallet_balance" => $amount
                    ],

                    '$set' => [
                        "updated_at" =>
                            new MongoDB\BSON\UTCDateTime()
                    ]
                ]
            );


            if (
                $balanceResult->getModifiedCount() !== 1
            ) {

                responseJson(
                    false,
                    "Customer balance could not be updated.",
                    500
                );
            }


            /*
            |----------------------------------------------------------
            | Mark deposit approved
            |----------------------------------------------------------
            */

            $approvalResult = $deposits->updateOne(
                [
                    "_id" => $depositObjectId,
                    "status" => "pending"
                ],
                [
                    '$set' => [
                        "status" => "approved",
                        "payment_verified" => true,
                        "approved_at" =>
                            new MongoDB\BSON\UTCDateTime(),
                        "approved_by" =>
                            $currentUserId,
                        "updated_at" =>
                            new MongoDB\BSON\UTCDateTime()
                    ]
                ]
            );


            /*
            |----------------------------------------------------------
            | If deposit could not be changed, reverse balance
            |----------------------------------------------------------
            */

            if (
                $approvalResult->getModifiedCount() !== 1
            ) {

                $users->updateOne(
                    [
                        "_id" => $customerId
                    ],
                    [
                        '$inc' => [
                            "balance" => -$amount,
                            "wallet_balance" => -$amount
                        ]
                    ]
                );


                responseJson(
                    false,
                    "Deposit could not be approved.",
                    409
                );
            }


            /*
            |----------------------------------------------------------
            | Update transaction
            |----------------------------------------------------------
            */

            $transactions->updateMany(
                [
                    "deposit_id" => $depositObjectId
                ],
                [
                    '$set' => [
                        "status" => "approved",
                        "payment_verified" => true,
                        "approved_at" =>
                            new MongoDB\BSON\UTCDateTime(),
                        "updated_at" =>
                            new MongoDB\BSON\UTCDateTime()
                    ]
                ]
            );


            /*
            |----------------------------------------------------------
            | Create transaction if deposit has none
            |----------------------------------------------------------
            */

            $existingTransaction =
                $transactions->findOne([
                    "deposit_id" =>
                        $depositObjectId
                ]);


            if (!$existingTransaction) {

                $transactions->insertOne([
                    "user_id" => $customerId,
                    "deposit_id" => $depositObjectId,
                    "type" => "deposit",
                    "transaction_type" => "deposit",
                    "amount" => $amount,
                    "status" => "approved",
                    "payment_verified" => true,
                    "created_at" =>
                        new MongoDB\BSON\UTCDateTime()
                ]);
            }


            /*
            |----------------------------------------------------------
            | Audit
            |----------------------------------------------------------
            */

            $auditLogs->insertOne([
                "action" => "deposit_approved",
                "admin_user_id" => $currentUserId,
                "user_id" => $customerId,
                "deposit_id" => $depositObjectId,
                "amount" => $amount,
                "created_at" =>
                    new MongoDB\BSON\UTCDateTime()
            ]);


            responseJson(
                true,
                "Deposit approved and customer balance credited successfully.",
                200,
                [
                    "deposit_id" => $depositId,
                    "amount" => $amount,
                    "customer_id" =>
                        (string)$customerId
                ]
            );
        }

    } catch (MongoDB\Driver\Exception\Exception $e) {

        responseJson(
            false,
            "Database error while processing the deposit.",
            500
        );

    } catch (Throwable $e) {

        responseJson(
            false,
            "Unable to process the deposit.",
            500
        );
    }
}


/*
|--------------------------------------------------------------------------
| Unsupported method
|--------------------------------------------------------------------------
*/

responseJson(
    false,
    "Method not allowed.",
    405
);

?>