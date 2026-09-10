<?php

/* =========================================================
   CROWN CASH — ADMIN DEPOSIT MANAGEMENT
   Handles:
   - Admin authentication
   - GET deposit list
   - Approve deposit
   - Reject deposit
   - Safe one-time balance credit
   ========================================================= */

header("Access-Control-Allow-Origin: https://crown-cash.vercel.app");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");
header("Access-Control-Allow-Credentials: true");
header("Content-Type: application/json; charset=UTF-8");

/* =========================================================
   CORS PREFLIGHT
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
    "domain" => "",
    "secure" => true,
    "httponly" => true,
    "samesite" => "None"
]);

session_start();

/* =========================================================
   DATABASE
   ========================================================= */

require_once __DIR__ . "/config.php";

/* =========================================================
   RESPONSE HELPER
   ========================================================= */

function sendResponse(
    bool $success,
    string $message = "",
    array $extra = [],
    int $statusCode = 200
): void {

    http_response_code($statusCode);

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

/* =========================================================
   ADMIN AUTHENTICATION
   ========================================================= */

function requireAdmin($users): MongoDB\Model\BSONDocument|array
{
    if (
        empty($_SESSION["logged_in"]) ||
        empty($_SESSION["user_id"])
    ) {
        sendResponse(
            false,
            "Please login first.",
            [],
            401
        );
    }

    try {

        $userId =
            new MongoDB\BSON\ObjectId(
                $_SESSION["user_id"]
            );

    } catch (Throwable $e) {

        sendResponse(
            false,
            "Invalid user session.",
            [],
            401
        );
    }

    $user =
        $users->findOne([
            "_id" => $userId
        ]);

    if (!$user) {

        sendResponse(
            false,
            "Administrator account not found.",
            [],
            403
        );
    }

    if (
        strtolower(
            trim(
                (string)($user["role"] ?? "")
            )
        ) !== "admin"
    ) {

        sendResponse(
            false,
            "Administrator access required.",
            [],
            403
        );
    }

    return $user;
}

/* =========================================================
   CHECK ADMIN
   ========================================================= */

$admin = requireAdmin($users);

/* =========================================================
   GET — LOAD DEPOSITS
   ========================================================= */

if ($_SERVER["REQUEST_METHOD"] === "GET") {

    try {

        /*
         * We support both:
         *
         * type = deposit
         *
         * and older deposit records that may not
         * have the type field.
         */

        $cursor = $transactions->find(
            [
                '$or' => [
                    [
                        "type" => "deposit"
                    ],
                    [
                        "payment_status" => [
                            '$in' => [
                                "pending",
                                "approved",
                                "verified",
                                "rejected"
                            ]
                        ],
                        "balance_credited" => [
                            '$exists" => true
                        ]
                    ]
                ]
            ],
            [
                "sort" => [
                    "created_at" => -1
                ],
                "limit" => 500
            ]
        );

        $deposits = [];

        /* User cache avoids repeatedly querying the same user */
        $userCache = [];

        foreach ($cursor as $deposit) {

            $userId = $deposit["user_id"] ?? null;

            $user = null;

            if ($userId) {

                $userKey = (string)$userId;

                if (isset($userCache[$userKey])) {

                    $user =
                        $userCache[$userKey];

                } else {

                    $user =
                        $users->findOne([
                            "_id" => $userId
                        ]);

                    $userCache[$userKey] =
                        $user;
                }
            }

            $firstName =
                (string)($user["firstName"] ?? "");

            $lastName =
                (string)($user["lastName"] ?? "");

            $userName =
                trim(
                    $firstName .
                    " " .
                    $lastName
                );

            if ($userName === "") {
                $userName = "Unknown User";
            }

            $createdAt = null;

            if (
                isset(
                    $deposit["created_at"]
                ) &&
                $deposit["created_at"]
                instanceof MongoDB\BSON\UTCDateTime
            ) {

                $createdAt =
                    $deposit["created_at"]
                        ->toDateTime()
                        ->format(
                            "c"
                        );
            }

            $updatedAt = null;

            if (
                isset(
                    $deposit["updated_at"]
                ) &&
                $deposit["updated_at"]
                instanceof MongoDB\BSON\UTCDateTime
            ) {

                $updatedAt =
                    $deposit["updated_at"]
                        ->toDateTime()
                        ->format(
                            "c"
                        );
            }

            $status =
                strtolower(
                    (string)(
                        $deposit["status"]
                        ??
                        $deposit["payment_status"]
                        ??
                        "pending"
                    )
                );

            /*
             * Keep frontend status values simple.
             */

            if (
                $status === "verified" ||
                $status === "completed"
            ) {
                $status = "approved";
            }

            $deposits[] = [

                "id" =>
                    (string)$deposit["_id"],

                "reference" =>
                    (string)(
                        $deposit["reference"]
                        ?? ""
                    ),

                "user_id" =>
                    $userId
                        ? (string)$userId
                        : "",

                "user_name" =>
                    $userName,

                "user_email" =>
                    (string)(
                        $user["email"]
                        ?? ""
                    ),

                "amount" =>
                    (float)(
                        $deposit["amount"]
                        ?? 0
                    ),

                "currency" =>
                    (string)(
                        $deposit["currency"]
                        ?? "UGX"
                    ),

                "phone" =>
                    (string)(
                        $deposit["phone"]
                        ?? ""
                    ),

                "payment_method" =>
                    strtoupper(
                        (string)(
                            $deposit["payment_method"]
                            ??
                            $deposit["method"]
                            ??
                            ""
                        )
                    ),

                "status" =>
                    $status,

                "payment_status" =>
                    (string)(
                        $deposit["payment_status"]
                        ?? $status
                    ),

                "balance_credited" =>
                    (bool)(
                        $deposit["balance_credited"]
                        ?? false
                    ),

                "admin_approved" =>
                    (bool)(
                        $deposit["admin_approved"]
                        ?? false
                    ),

                "admin_rejected" =>
                    (bool)(
                        $deposit["admin_rejected"]
                        ?? false
                    ),

                "admin_email" =>
                    (string)(
                        $deposit["admin_email"]
                        ?? ""
                    ),

                "created_at" =>
                    $createdAt,

                "updated_at" =>
                    $updatedAt
            ];
        }

        sendResponse(
            true,
            "Deposits loaded successfully.",
            [
                "deposits" => $deposits
            ]
        );

    } catch (Throwable $e) {

        error_log(
            "CROWN CASH ADMIN DEPOSITS GET ERROR: " .
            $e->getMessage()
        );

        sendResponse(
            false,
            "Unable to load deposits.",
            [],
            500
        );
    }
}

/* =========================================================
   POST — APPROVE / REJECT
   ========================================================= */

if ($_SERVER["REQUEST_METHOD"] === "POST") {

    try {

        /*
         * New admin_deposits.js sends JSON.
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

            sendResponse(
                false,
                "Invalid request data.",
                [],
                400
            );
        }

        $depositId =
            trim(
                (string)(
                    $data["depositId"]
                    ??
                    $data["deposit_id"]
                    ??
                    ""
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

        if ($depositId === "") {

            sendResponse(
                false,
                "Deposit ID is required.",
                [],
                400
            );
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

            sendResponse(
                false,
                "Invalid deposit action.",
                [],
                400
            );
        }

        /*
         * Convert ID to ObjectId.
         */

        try {

            $id =
                new MongoDB\BSON\ObjectId(
                    $depositId
                );

        } catch (Throwable $e) {

            sendResponse(
                false,
                "Invalid deposit ID.",
                [],
                400
            );
        }

        /*
         * Find the deposit.
         *
         * balance_credited=false is important:
         * it prevents the same deposit from
         * crediting the user twice.
         */

        $deposit =
            $transactions->findOne([
                "_id" => $id,
                "type" => "deposit",
                "status" => "pending",
                "balance_credited" => false
            ]);

        /*
         * Compatibility for older deposit records
         * that may not have type=deposit.
         */

        if (!$deposit) {

            $deposit =
                $transactions->findOne([
                    "_id" => $id,
                    "status" => "pending",
                    "balance_credited" => false,
                    '$or' => [
                        [
                            "type" => "deposit"
                        ],
                        [
                            "payment_method" => [
                                '$in' => [
                                    "MTN",
                                    "AIRTEL"
                                ]
                            ]
                        ]
                    ]
                ]);
        }

        if (!$deposit) {

            sendResponse(
                false,
                "Deposit not found, already processed, or already credited.",
                [],
                409
            );
        }

        $userId =
            $deposit["user_id"]
            ?? null;

        if (!$userId) {

            sendResponse(
                false,
                "Deposit has no associated user.",
                [],
                400
            );
        }

        $amount =
            (float)(
                $deposit["amount"]
                ?? 0
            );

        if ($amount <= 0) {

            sendResponse(
                false,
                "Invalid deposit amount.",
                [],
                400
            );
        }

        /* =================================================
           START DATABASE TRANSACTION
           ================================================= */

        $session =
            $client->startSession();

        try {

            $session->startTransaction();

            /*
             * Re-read the deposit inside the transaction.
             */

            $currentDeposit =
                $transactions->findOne(
                    [
                        "_id" => $id,
                        "status" => "pending",
                        "balance_credited" => false
                    ],
                    [
                        "session" => $session
                    ]
                );

            if (!$currentDeposit) {

                $session->abortTransaction();

                sendResponse(
                    false,
                    "This deposit has already been processed.",
                    [],
                    409
                );
            }

            $now =
                new MongoDB\BSON\UTCDateTime();

            $adminId =
                $_SESSION["user_id"];

            $adminEmail =
                (string)(
                    $admin["email"]
                    ?? ""
                );

            /* =================================================
               APPROVE
               ================================================= */

            if ($action === "approve") {

                /*
                 * IMPORTANT:
                 *
                 * The admin must independently verify
                 * that the MTN/Airtel payment was actually
                 * received before using this action.
                 *
                 * A user-entered payment reference alone
                 * is not proof of payment.
                 */

                $user =
                    $users->findOne(
                        [
                            "_id" => $userId
                        ],
                        [
                            "session" => $session
                        ]
                    );

                if (!$user) {

                    $session->abortTransaction();

                    sendResponse(
                        false,
                        "User associated with this deposit was not found.",
                        [],
                        404
                    );
                }

                /*
                 * Credit the user's balance exactly once.
                 */

                $balanceResult =
                    $users->updateOne(
                        [
                            "_id" => $userId
                        ],
                        [
                            '$inc' => [
                                "balance" => $amount
                            ]
                        ],
                        [
                            "session" => $session
                        ]
                    );

                if (
                    $balanceResult
                        ->getModifiedCount() !== 1
                ) {

                    $session->abortTransaction();

                    sendResponse(
                        false,
                        "Unable to credit user balance.",
                        [],
                        500
                    );
                }

                /*
                 * Mark deposit approved
                 * and balance credited.
                 */

                $depositResult =
                    $transactions->updateOne(
                        [
                            "_id" => $id,
                            "status" => "pending",
                            "balance_credited" => false
                        ],
                        [
                            '$set' => [

                                "status" =>
                                    "approved",

                                "payment_status" =>
                                    "verified",

                                "balance_credited" =>
                                    true,

                                "admin_approved" =>
                                    true,

                                "admin_rejected" =>
                                    false,

                                "admin_id" =>
                                    $adminId,

                                "admin_email" =>
                                    $adminEmail,

                                "admin_action_at" =>
                                    $now,

                                "processed_at" =>
                                    $now,

                                "updated_at" =>
                                    $now
                            ]
                        ],
                        [
                            "session" => $session
                        ]
                    );

                if (
                    $depositResult
                        ->getModifiedCount() !== 1
                ) {

                    $session->abortTransaction();

                    sendResponse(
                        false,
                        "Unable to finalize deposit approval.",
                        [],
                        500
                    );
                }

                /*
                 * Commit.
                 */

                $session->commitTransaction();

                /*
                 * Get new balance.
                 */

                $updatedUser =
                    $users->findOne([
                        "_id" => $userId
                    ]);

                $newBalance =
                    (float)(
                        $updatedUser["balance"]
                        ?? 0
                    );

                sendResponse(
                    true,
                    "Deposit approved and user balance credited successfully.",
                    [
                        "deposit" => [
                            "id" =>
                                (string)$id,

                            "reference" =>
                                (string)(
                                    $deposit["reference"]
                                    ?? ""
                                ),

                            "amount" =>
                                $amount,

                            "status" =>
                                "approved",

                            "balance_credited" =>
                                true
                        ],

                        "user" => [
                            "id" =>
                                (string)$userId,

                            "balance" =>
                                $newBalance
                        ]
                    ]
                );
            }

            /* =================================================
               REJECT
               ================================================= */

            if ($action === "reject") {

                /*
                 * Rejection does NOT credit the balance.
                 */

                $depositResult =
                    $transactions->updateOne(
                        [
                            "_id" => $id,
                            "status" => "pending",
                            "balance_credited" => false
                        ],
                        [
                            '$set' => [

                                "status" =>
                                    "rejected",

                                "payment_status" =>
                                    "rejected",

                                "balance_credited" =>
                                    false,

                                "admin_approved" =>
                                    false,

                                "admin_rejected" =>
                                    true,

                                "admin_id" =>
                                    $adminId,

                                "admin_email" =>
                                    $adminEmail,

                                "admin_action_at" =>
                                    $now,

                                "processed_at" =>
                                    $now,

                                "updated_at" =>
                                    $now
                            ]
                        ],
                        [
                            "session" => $session
                        ]
                    );

                if (
                    $depositResult
                        ->getModifiedCount() !== 1
                ) {

                    $session->abortTransaction();

                    sendResponse(
                        false,
                        "Unable to reject deposit.",
                        [],
                        500
                    );
                }

                /*
                 * Commit rejection.
                 */

                $session->commitTransaction();

                sendResponse(
                    true,
                    "Deposit rejected successfully.",
                    [
                        "deposit" => [
                            "id" =>
                                (string)$id,

                            "reference" =>
                                (string)(
                                    $deposit["reference"]
                                    ?? ""
                                ),

                            "amount" =>
                                $amount,

                            "status" =>
                                "rejected",

                            "balance_credited" =>
                                false
                        ]
                    ]
                );
            }

            /*
             * Safety fallback.
             */

            $session->abortTransaction();

            sendResponse(
                false,
                "Unknown deposit action.",
                [],
                400
            );

        } catch (Throwable $transactionError) {

            try {
                $session->abortTransaction();
            } catch (Throwable $ignore) {
                /* Ignore abort failure */
            }

            throw $transactionError;

        } finally {

            $session->endSession();
        }

    } catch (Throwable $e) {

        error_log(
            "CROWN CASH ADMIN DEPOSIT ACTION ERROR: " .
            $e->getMessage()
        );

        sendResponse(
            false,
            "Unable to process deposit.",
            [],
            500
        );
    }
}

/* =========================================================
   INVALID METHOD
   ========================================================= */

sendResponse(
    false,
    "Method not allowed.",
    [],
    405
);

?>