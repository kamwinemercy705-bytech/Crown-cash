<?php

header("Access-Control-Allow-Origin: https://crown-cash.vercel.app");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");
header("Access-Control-Allow-Credentials: true");
header("Content-Type: application/json; charset=UTF-8");

if ($_SERVER["REQUEST_METHOD"] === "OPTIONS") {
    http_response_code(204);
    exit;
}

session_set_cookie_params([
    "lifetime" => 0,
    "path" => "/",
    "domain" => "",
    "secure" => true,
    "httponly" => true,
    "samesite" => "None"
]);

session_start();

require_once __DIR__ . "/config.php";


/*
|--------------------------------------------------------------------------
| RESPONSE HELPER
|--------------------------------------------------------------------------
*/

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


/*
|--------------------------------------------------------------------------
| ADMIN AUTHORIZATION
|--------------------------------------------------------------------------
*/

function requireAdmin()
{
    global $users;

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

        $adminId = new MongoDB\BSON\ObjectId(
            $_SESSION["user_id"]
        );

    } catch (Throwable $e) {

        sendResponse(
            false,
            "Invalid admin session.",
            [],
            401
        );
    }

    $admin = $users->findOne([
        "_id" => $adminId
    ]);

    if (!$admin) {

        sendResponse(
            false,
            "Admin account not found.",
            [],
            403
        );
    }

    if (($admin["role"] ?? "") !== "admin") {

        sendResponse(
            false,
            "Administrator access required.",
            [],
            403
        );
    }

    return $admin;
}


/*
|--------------------------------------------------------------------------
| REQUIRE ADMIN
|--------------------------------------------------------------------------
*/

$admin = requireAdmin();


/*
|--------------------------------------------------------------------------
| GET DEPOSITS
|--------------------------------------------------------------------------
*/

if ($_SERVER["REQUEST_METHOD"] === "GET") {

    try {

        /*
         * Deposits created by create_deposit.php are stored
         * inside the transactions collection.
         *
         * We support both:
         *
         * type = deposit
         *
         * and older records which may have balance_credited.
         */

        $filter = [
            '$or' => [
                [
                    "type" => "deposit"
                ],
                [
                    "balance_credited" => [
                        '$exists' => true
                    ]
                ]
            ]
        ];

        $cursor = $transactions->find(
            $filter,
            [
                "sort" => [
                    "created_at" => -1
                ],
                "limit" => 500
            ]
        );

        $deposits = [];

        /*
         * Cache users so we do not repeatedly query
         * the users collection.
         */

        $userCache = [];

        foreach ($cursor as $deposit) {

            $userIdString = "";

            if (
                isset($deposit["user_id"]) &&
                $deposit["user_id"] instanceof MongoDB\BSON\ObjectId
            ) {
                $userIdString = (string)$deposit["user_id"];
            }

            /*
             * Load user information.
             */

            if (
                $userIdString !== "" &&
                !isset($userCache[$userIdString])
            ) {

                try {

                    $user = $users->findOne([
                        "_id" => new MongoDB\BSON\ObjectId(
                            $userIdString
                        )
                    ]);

                    $userCache[$userIdString] = $user;

                } catch (Throwable $e) {

                    $userCache[$userIdString] = null;
                }
            }

            $user = $userCache[$userIdString] ?? null;


            /*
             * Date conversion.
             */

            $createdAt = null;
            $updatedAt = null;
            $processedAt = null;

            if (
                isset($deposit["created_at"]) &&
                $deposit["created_at"] instanceof MongoDB\BSON\UTCDateTime
            ) {
                $createdAt =
                    $deposit["created_at"]
                        ->toDateTime()
                        ->format(DATE_ATOM);
            }

            if (
                isset($deposit["updated_at"]) &&
                $deposit["updated_at"] instanceof MongoDB\BSON\UTCDateTime
            ) {
                $updatedAt =
                    $deposit["updated_at"]
                        ->toDateTime()
                        ->format(DATE_ATOM);
            }

            if (
                isset($deposit["processed_at"]) &&
                $deposit["processed_at"] instanceof MongoDB\BSON\UTCDateTime
            ) {
                $processedAt =
                    $deposit["processed_at"]
                        ->toDateTime()
                        ->format(DATE_ATOM);
            }


            /*
             * User display information.
             */

            $firstName = $user["firstName"] ?? "";
            $lastName = $user["lastName"] ?? "";

            $fullName = trim(
                $firstName . " " . $lastName
            );

            if ($fullName === "") {
                $fullName = "Unknown User";
            }


            /*
             * Deposit reference.
             */

            $reference =
                $deposit["reference"]
                ?? $deposit["transaction_reference"]
                ?? ("DEP-" . (string)$deposit["_id"]);


            /*
             * Payment method.
             */

            $method =
                strtoupper(
                    (string)(
                        $deposit["payment_method"]
                        ?? $deposit["method"]
                        ?? ""
                    )
                );


            /*
             * Account / phone.
             */

            $account =
                $deposit["phone"]
                ?? $deposit["account"]
                ?? "";


            /*
             * Status.
             */

            $status =
                strtolower(
                    (string)(
                        $deposit["status"]
                        ?? $deposit["payment_status"]
                        ?? "pending"
                    )
                );


            /*
             * Amount.
             */

            $amount =
                (float)(
                    $deposit["amount"]
                    ?? 0
                );


            $deposits[] = [

                "id" => (string)$deposit["_id"],

                "reference" => $reference,

                "user_id" => $userIdString,

                "user" => [
                    "name" => $fullName,
                    "firstName" => $firstName,
                    "lastName" => $lastName,
                    "email" => $user["email"] ?? "",
                    "phone" => $user["phone"] ?? ""
                ],

                "amount" => $amount,

                "currency" =>
                    $deposit["currency"]
                    ?? "UGX",

                "method" => $method,

                "account" => $account,

                "status" => $status,

                "payment_status" =>
                    $deposit["payment_status"]
                    ?? $status,

                "balance_credited" =>
                    (bool)(
                        $deposit["balance_credited"]
                        ?? false
                    ),

                "created_at" => $createdAt,

                "updated_at" => $updatedAt,

                "processed_at" => $processedAt
            ];
        }


        /*
         * Statistics.
         */

        $pendingCount = 0;
        $pendingAmount = 0;

        $approvedCount = 0;
        $rejectedCount = 0;

        foreach ($deposits as $deposit) {

            if ($deposit["status"] === "pending") {

                $pendingCount++;

                $pendingAmount +=
                    (float)$deposit["amount"];
            }

            if ($deposit["status"] === "approved") {
                $approvedCount++;
            }

            if ($deposit["status"] === "rejected") {
                $rejectedCount++;
            }
        }


        sendResponse(
            true,
            "Deposits loaded successfully.",
            [
                "deposits" => $deposits,

                "stats" => [
                    "pending_count" => $pendingCount,
                    "pending_amount" => $pendingAmount,
                    "approved_count" => $approvedCount,
                    "rejected_count" => $rejectedCount
                ]
            ]
        );

    } catch (Throwable $e) {

        error_log(
            "CROWN CASH ADMIN DEPOSIT GET ERROR: "
            . $e->getMessage()
        );

        sendResponse(
            false,
            "Unable to load deposits.",
            [],
            500
        );
    }
}


/*
|--------------------------------------------------------------------------
| POST APPROVE / REJECT DEPOSIT
|--------------------------------------------------------------------------
*/

if ($_SERVER["REQUEST_METHOD"] === "POST") {

    try {

        $rawData =
            file_get_contents("php://input");

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
                $data["depositId"]
                ?? ""
            );

        $action =
            strtolower(
                trim(
                    $data["action"]
                    ?? ""
                )
            );


        /*
         * Allow approve/reject only.
         */

        if ($depositId === "") {

            sendResponse(
                false,
                "Deposit ID is required.",
                [],
                400
            );
        }

        if (!in_array(
            $action,
            ["approve", "reject"],
            true
        )) {

            sendResponse(
                false,
                "Invalid deposit action.",
                [],
                400
            );
        }


        /*
         * Convert ID.
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
         * Find deposit.
         */

        $deposit =
            $transactions->findOne([
                "_id" => $id,

                '$or' => [
                    [
                        "type" => "deposit"
                    ],
                    [
                        "balance_credited" => [
                            '$exists' => true
                        ]
                    ]
                ]
            ]);


        if (!$deposit) {

            sendResponse(
                false,
                "Deposit not found.",
                [],
                404
            );
        }


        /*
         * Only pending deposits can be processed.
         */

        $currentStatus =
            strtolower(
                (string)(
                    $deposit["status"]
                    ?? $deposit["payment_status"]
                    ?? "pending"
                )
            );


        if ($currentStatus !== "pending") {

            sendResponse(
                false,
                "This deposit has already been processed.",
                [],
                409
            );
        }


        /*
         * We require a user.
         */

        if (
            !isset($deposit["user_id"]) ||
            !($deposit["user_id"] instanceof MongoDB\BSON\ObjectId)
        ) {

            sendResponse(
                false,
                "Deposit user information is missing.",
                [],
                400
            );
        }


        $userId =
            $deposit["user_id"];

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


        /*
         * IMPORTANT:
         *
         * Approval here should only be performed after
         * independently verifying the MTN/Airtel payment.
         *
         * This endpoint does NOT contact MTN or Airtel.
         */


        /*
         * Start MongoDB transaction.
         */

        $session =
            $client->startSession();


        try {

            $session->startTransaction();


            /*
             * Re-check the deposit inside the transaction.
             *
             * This protects against two admins processing
             * the same deposit at the same time.
             */

            $freshDeposit =
                $transactions->findOne(
                    [
                        "_id" => $id,

                        "status" => "pending",

                        "balance_credited" => [
                            '$ne' => true
                        ]
                    ],
                    [
                        "session" => $session
                    ]
                );


            if (!$freshDeposit) {

                $session->abortTransaction();

                sendResponse(
                    false,
                    "This deposit has already been processed or credited.",
                    [],
                    409
                );
            }


            if ($action === "approve") {

                /*
                 * Credit the user's Crown Cash balance.
                 */

                $userUpdate =
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
                    $userUpdate->getMatchedCount() !== 1
                ) {

                    $session->abortTransaction();

                    sendResponse(
                        false,
                        "User account could not be found.",
                        [],
                        404
                    );
                }


                /*
                 * Mark deposit as credited.
                 */

                $now =
                    new MongoDB\BSON\UTCDateTime();


                $transactions->updateOne(
                    [
                        "_id" => $id,

                        "status" => "pending",

                        "balance_credited" => [
                            '$ne' => true
                        ]
                    ],
                    [
                        '$set' => [

                            "status" => "approved",

                            "payment_status" =>
                                "approved",

                            "balance_credited" =>
                                true,

                            "admin_approved" =>
                                true,

                            "admin_rejected" =>
                                false,

                            "admin_id" =>
                                $admin["_id"],

                            "admin_email" =>
                                $admin["email"] ?? "",

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
                    "Deposit approved and user balance credited.",
                    [
                        "deposit" => [
                            "id" =>
                                (string)$id,

                            "reference" =>
                                $deposit["reference"]
                                ?? "",

                            "amount" =>
                                $amount,

                            "status" =>
                                "approved"
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


            /*
             * REJECT
             */

            if ($action === "reject") {

                $now =
                    new MongoDB\BSON\UTCDateTime();


                $transactions->updateOne(
                    [
                        "_id" => $id,

                        "status" => "pending",

                        "balance_credited" => [
                            '$ne' => true
                        ]
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
                                $admin["_id"],

                            "admin_email" =>
                                $admin["email"] ?? "",

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


                $session->commitTransaction();


                sendResponse(
                    true,
                    "Deposit rejected successfully.",
                    [
                        "deposit" => [
                            "id" =>
                                (string)$id,

                            "reference" =>
                                $deposit["reference"]
                                ?? "",

                            "amount" =>
                                $amount,

                            "status" =>
                                "rejected"
                        ]
                    ]
                );
            }


        } catch (Throwable $e) {

            try {
                $session->abortTransaction();
            } catch (Throwable $ignore) {
            }

            throw $e;

        } finally {

            $session->endSession();
        }


    } catch (Throwable $e) {

        error_log(
            "CROWN CASH ADMIN DEPOSIT POST ERROR: "
            . $e->getMessage()
        );

        sendResponse(
            false,
            "Unable to process deposit.",
            [],
            500
        );
    }
}


/*
|--------------------------------------------------------------------------
| METHOD NOT ALLOWED
|--------------------------------------------------------------------------
*/

sendResponse(
    false,
    "Method not allowed.",
    [],
    405
);

?>