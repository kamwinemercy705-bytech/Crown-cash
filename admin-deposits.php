<?php

/* =========================================================
   CROWN CASH ADMIN — DEPOSITS API
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
    "Access-Control-Allow-Methods: GET, POST, OPTIONS"
);

header(
    "Access-Control-Allow-Headers: Content-Type, Accept"
);

header(
    "Content-Type: application/json; charset=UTF-8"
);


if (
    ($_SERVER["REQUEST_METHOD"] ?? "") === "OPTIONS"
) {

    http_response_code(204);

    exit;
}


/* =========================================================
   SECURE CROSS-SITE SESSION
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
   JSON RESPONSE
========================================================= */

function jsonResponse(
    array $data,
    int $status = 200
): never {

    http_response_code($status);

    echo json_encode(
        $data,
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

    jsonResponse([
        "success" => false,
        "authenticated" => false,
        "authorized" => false,
        "message" =>
            "Administrator session required."
    ], 401);
}


/* =========================================================
   DATABASE
========================================================= */

require_once __DIR__ . "/config.php";


/* =========================================================
   HELPERS
========================================================= */

function normalizeStatus(
    mixed $value
): string {

    return strtolower(
        trim(
            (string)$value
        )
    );
}


function idsMatch(
    string $first,
    string $second
): bool {

    $first =
        strtolower(
            trim($first)
        );

    $second =
        strtolower(
            trim($second)
        );


    if (
        $first === "" ||
        $second === ""
    ) {

        return false;
    }


    try {

        if (
            MongoDB\BSON\ObjectId::isValid($first) &&
            MongoDB\BSON\ObjectId::isValid($second)
        ) {

            return $first === $second;
        }

    } catch (Throwable $e) {

        // Continue with string comparison.
    }


    return $first === $second;
}


function findUserById(
    $users,
    string $userId
) {

    $conditions = [];


    $conditions[] = [
        "_id" => $userId
    ];


    try {

        if (
            MongoDB\BSON\ObjectId::isValid($userId)
        ) {

            $conditions[] = [
                "_id" =>
                    new MongoDB\BSON\ObjectId(
                        $userId
                    )
            ];
        }

    } catch (Throwable $e) {

        // Ignore invalid ObjectId.
    }


    return $users->findOne([
        '$or' => $conditions
    ]);
}


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
        is_numeric($value)
    ) {

        return (float)$value;
    }


    return 0.0;
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
            ->format(DATE_ATOM);
    }


    if (
        is_string($value) &&
        trim($value) !== ""
    ) {

        return $value;
    }


    return "";
}


function getDepositIdString(
    mixed $id
): string {

    return (string)$id;
}


/* =========================================================
   ADMIN AUTHORIZATION
========================================================= */

try {

    $users =
        $db->selectCollection(
            "users"
        );


    $sessionUserId =
        trim(
            (string)(
                $_SESSION["user_id"] ?? ""
            )
        );


    if (
        $sessionUserId === ""
    ) {

        jsonResponse([
            "success" => false,
            "authenticated" => false,
            "authorized" => false,
            "message" =>
                "Administrator session is missing."
        ], 401);
    }


    $adminUser =
        findUserById(
            $users,
            $sessionUserId
        );


    if (!$adminUser) {

        jsonResponse([
            "success" => false,
            "authenticated" => false,
            "authorized" => false,
            "message" =>
                "Administrator account was not found."
        ], 401);
    }


    /* -----------------------------------------------------
       ACCOUNT STATUS
    ----------------------------------------------------- */

    $accountStatus =
        normalizeStatus(
            $adminUser["status"] ??
            "active"
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

        jsonResponse([
            "success" => false,
            "authenticated" => true,
            "authorized" => false,
            "message" =>
                "Administrator account is not active."
        ], 403);
    }


    /* -----------------------------------------------------
       ROLE
    ----------------------------------------------------- */

    $role =
        normalizeStatus(
            $adminUser["role"] ?? ""
        );


    $accountType =
        normalizeStatus(
            $adminUser["account_type"] ?? ""
        );


    $isAdmin =
        in_array(
            $role,
            [
                "admin",
                "administrator"
            ],
            true
        ) ||
        in_array(
            $accountType,
            [
                "admin",
                "administrator"
            ],
            true
        );


    if (!$isAdmin) {

        jsonResponse([
            "success" => false,
            "authenticated" => true,
            "authorized" => false,
            "message" =>
                "Administrator access is required."
        ], 403);
    }


    /* -----------------------------------------------------
       ADMIN ID / EMAIL
    ----------------------------------------------------- */

    $configuredAdminId =
        trim(
            (string)(
                getenv("ADMIN_USER_ID") ?: ""
            )
        );


    $configuredAdminEmail =
        strtolower(
            trim(
                (string)(
                    getenv("ADMIN_EMAIL") ?: ""
                )
            )
        );


    if (
        $configuredAdminId !== ""
    ) {

        if (
            !idsMatch(
                $sessionUserId,
                $configuredAdminId
            )
        ) {

            jsonResponse([
                "success" => false,
                "authenticated" => true,
                "authorized" => false,
                "message" =>
                    "Administrator verification failed."
            ], 403);
        }

    } elseif (
        $configuredAdminEmail !== ""
    ) {

        $currentEmail =
            strtolower(
                trim(
                    (string)(
                        $adminUser["email"] ??
                        ""
                    )
                )
            );


        if (
            $currentEmail !==
            $configuredAdminEmail
        ) {

            jsonResponse([
                "success" => false,
                "authenticated" => true,
                "authorized" => false,
                "message" =>
                    "Administrator verification failed."
            ], 403);
        }

    } else {

        jsonResponse([
            "success" => false,
            "authenticated" => true,
            "authorized" => false,
            "message" =>
                "Administrator identity is not configured."
        ], 500);
    }


    /* -----------------------------------------------------
       REFRESH ADMIN SESSION
    ----------------------------------------------------- */

    $_SESSION["role"] =
        "admin";

    $_SESSION["account_type"] =
        "admin";

    $_SESSION["admin_verified_at"] =
        time();

    $_SESSION["last_activity"] =
        time();


} catch (
    MongoDB\Driver\Exception\Exception $e
) {

    error_log(
        "Admin deposits authorization error: " .
        $e->getMessage()
    );

    jsonResponse([
        "success" => false,
        "message" =>
            "Database authorization error."
    ], 500);

} catch (Throwable $e) {

    error_log(
        "Admin deposits authorization error: " .
        $e->getMessage()
    );

    jsonResponse([
        "success" => false,
        "message" =>
            "Unable to verify administrator access."
    ], 500);
}


/* =========================================================
   GET — LOAD DEPOSITS
========================================================= */

if (
    ($_SERVER["REQUEST_METHOD"] ?? "") === "GET"
) {

    try {

        $deposits =
            $db->selectCollection(
                "deposits"
            );


        $items = [];


        $totalAmount =
            0.0;

        $pendingAmount =
            0.0;

        $approvedAmount =
            0.0;

        $rejectedAmount =
            0.0;


        $cursor =
            $deposits->find(
                [],
                [
                    "sort" => [
                        "created_at" => -1
                    ]
                ]
            );


        foreach (
            $cursor as $deposit
        ) {

            $amount =
                mongoNumberToFloat(
                    $deposit["amount"] ?? 0
                );


            $status =
                normalizeStatus(
                    $deposit["status"] ??
                    "pending"
                );


            switch ($status) {

                case "pending":

                    $pendingAmount +=
                        $amount;

                    break;


                case "approved":

                    $approvedAmount +=
                        $amount;

                    break;


                case "rejected":

                    $rejectedAmount +=
                        $amount;

                    break;
            }


            $totalAmount +=
                $amount;


            /* -------------------------------------------------
               CUSTOMER
            ------------------------------------------------- */

            $userId =
                isset(
                    $deposit["user_id"]
                )
                    ? (string)$deposit["user_id"]
                    : "";


            $customer =
                null;


            if (
                $userId !== ""
            ) {

                $customer =
                    findUserById(
                        $users,
                        $userId
                    );
            }


            $userName =
                (string)(
                    $deposit["full_name"] ??
                    $deposit["user_name"] ??
                    $deposit["name"] ??
                    ""
                );


            if (
                $userName === "" &&
                $customer
            ) {

                $userName =
                    (string)(
                        $customer["full_name"] ??
                        ""
                    );


                if (
                    $userName === ""
                ) {

                    $userName =
                        trim(
                            (string)(
                                $customer["first_name"] ??
                                ""
                            ) .
                            " " .
                            (string)(
                                $customer["last_name"] ??
                                ""
                            )
                        );
                }
            }


            if (
                $userName === ""
            ) {

                $userName =
                    "Customer";
            }


            $email =
                (string)(
                    $deposit["email"] ??
                    ""
                );


            if (
                $email === "" &&
                $customer
            ) {

                $email =
                    (string)(
                        $customer["email"] ??
                        ""
                    );
            }


            $phone =
                (string)(
                    $deposit["phone"] ??
                    ""
                );


            if (
                $phone === "" &&
                $customer
            ) {

                $phone =
                    (string)(
                        $customer["phone"] ??
                        $customer["phone_number"] ??
                        $customer["mobile"] ??
                        ""
                    );
            }


            /* -------------------------------------------------
               REFERENCE
            ------------------------------------------------- */

            $reference =
                (string)(
                    $deposit["reference"] ??
                    $deposit["transaction_reference"] ??
                    $deposit["payment_reference"] ??
                    ""
                );


            /* -------------------------------------------------
               METHOD
            ------------------------------------------------- */

            $method =
                (string)(
                    $deposit["payment_method"] ??
                    $deposit["method"] ??
                    ""
                );


            /* -------------------------------------------------
               ID
            ------------------------------------------------- */

            $id =
                isset(
                    $deposit["_id"]
                )
                    ? getDepositIdString(
                        $deposit["_id"]
                    )
                    : "";


            /* -------------------------------------------------
               PAYMENT VERIFIED
            ------------------------------------------------- */

            $paymentVerified =
                (
                    isset(
                        $deposit["payment_verified"]
                    ) &&
                    $deposit["payment_verified"] === true
                );


            $items[] = [

                "id" =>
                    $id,

                "_id" =>
                    $id,

                "user_id" =>
                    $userId,

                "full_name" =>
                    $userName,

                "user_name" =>
                    $userName,

                "email" =>
                    $email,

                "phone" =>
                    $phone,

                "amount" =>
                    $amount,

                "payment_method" =>
                    $method,

                "method" =>
                    $method,

                "reference" =>
                    $reference,

                "transaction_reference" =>
                    $reference,

                "payment_reference" =>
                    $reference,

                "status" =>
                    $status,

                "payment_verified" =>
                    $paymentVerified,

                "created_at" =>
                    formatDateValue(
                        $deposit["created_at"] ??
                        null
                    ),

                "updated_at" =>
                    formatDateValue(
                        $deposit["updated_at"] ??
                        null
                    ),

                "reviewed_at" =>
                    formatDateValue(
                        $deposit["reviewed_at"] ??
                        null
                    )
            ];
        }


        jsonResponse([

            "success" => true,

            "deposits" =>
                $items,

            "stats" => [

                "total_deposits_amount" =>
                    $totalAmount,

                "pending_amount" =>
                    $pendingAmount,

                "approved_amount" =>
                    $approvedAmount,

                "rejected_amount" =>
                    $rejectedAmount,

                "total_count" =>
                    count($items)
            ]
        ]);


    } catch (
        MongoDB\Driver\Exception\Exception $e
    ) {

        error_log(
            "Admin deposits GET error: " .
            $e->getMessage()
        );

        jsonResponse([
            "success" => false,
            "message" =>
                "Unable to load deposits."
        ], 500);

    } catch (Throwable $e) {

        error_log(
            "Admin deposits GET error: " .
            $e->getMessage()
        );

        jsonResponse([
            "success" => false,
            "message" =>
                "Unable to load deposits."
        ], 500);
    }
}


/* =========================================================
   POST — APPROVE / REJECT
========================================================= */

if (
    ($_SERVER["REQUEST_METHOD"] ?? "") === "POST"
) {

    $rawBody =
        file_get_contents(
            "php://input"
        );


    $payload =
        json_decode(
            $rawBody,
            true
        );


    if (
        !is_array($payload)
    ) {

        jsonResponse([
            "success" => false,
            "message" =>
                "Invalid request."
        ], 400);
    }


    $depositId =
        trim(
            (string)(
                $payload["deposit_id"] ??
                $payload["id"] ??
                ""
            )
        );


    $action =
        strtolower(
            trim(
                (string)(
                    $payload["action"] ??
                    ""
                )
            )
        );


    if (
        $depositId === ""
    ) {

        jsonResponse([
            "success" => false,
            "message" =>
                "Deposit ID is required."
        ], 400);
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

        jsonResponse([
            "success" => false,
            "message" =>
                "Invalid deposit action."
        ], 400);
    }


    try {

        $deposits =
            $db->selectCollection(
                "deposits"
            );

        $transactions =
            $db->selectCollection(
                "transactions"
            );

        $auditLogs =
            $db->selectCollection(
                "audit_logs"
            );


        /* -------------------------------------------------
           FIND DEPOSIT
        ------------------------------------------------- */

        $deposit =
            null;


        try {

            if (
                MongoDB\BSON\ObjectId::isValid(
                    $depositId
                )
            ) {

                $deposit =
                    $deposits->findOne([
                        "_id" =>
                            new MongoDB\BSON\ObjectId(
                                $depositId
                            )
                    ]);
            }

        } catch (Throwable $e) {

            $deposit =
                null;
        }


        if (!$deposit) {

            $deposit =
                $deposits->findOne([
                    "_id" =>
                        $depositId
                ]);
        }


        if (!$deposit) {

            jsonResponse([
                "success" => false,
                "message" =>
                    "Deposit was not found."
            ], 404);
        }


        /* -------------------------------------------------
           STATUS
        ------------------------------------------------- */

        $currentStatus =
            normalizeStatus(
                $deposit["status"] ??
                "pending"
            );


        if (
            $currentStatus !== "pending"
        ) {

            jsonResponse([
                "success" => false,
                "message" =>
                    "This deposit has already been processed."
            ], 409);
        }


        /* -------------------------------------------------
           AMOUNT
        ------------------------------------------------- */

        $amount =
            mongoNumberToFloat(
                $deposit["amount"] ?? 0
            );


        if (
            $amount <= 0
        ) {

            jsonResponse([
                "success" => false,
                "message" =>
                    "Deposit amount is invalid."
            ], 400);
        }


        /* =================================================
           REJECT
        ================================================= */

        if (
            $action === "reject"
        ) {

            $updateResult =
                $deposits->updateOne(
                    [
                        "_id" =>
                            $deposit["_id"],

                        "status" =>
                            "pending"
                    ],
                    [
                        '$set' => [

                            "status" =>
                                "rejected",

                            "updated_at" =>
                                new MongoDB\BSON\UTCDateTime(),

                            "reviewed_at" =>
                                new MongoDB\BSON\UTCDateTime(),

                            "reviewed_by" =>
                                $sessionUserId
                        ]
                    ]
                );


            if (
                $updateResult->getModifiedCount() !== 1
            ) {

                jsonResponse([
                    "success" => false,
                    "message" =>
                        "Deposit could not be rejected. It may already have been processed."
                ], 409);
            }


            $depositIdString =
                (string)$deposit["_id"];


            $reference =
                (string)(
                    $deposit["reference"] ??
                    $deposit["transaction_reference"] ??
                    $deposit["payment_reference"] ??
                    ""
                );


            $transactionQueries = [
                [
                    "deposit_id" =>
                        $depositIdString
                ]
            ];


            if (
                $reference !== ""
            ) {

                $transactionQueries[] = [
                    "reference" =>
                        $reference
                ];

                $transactionQueries[] = [
                    "transaction_reference" =>
                        $reference
                ];
            }


            $transactions->updateMany(
                [
                    '$or' =>
                        $transactionQueries
                ],
                [
                    '$set' => [

                        "status" =>
                            "rejected",

                        "updated_at" =>
                            new MongoDB\BSON\UTCDateTime()
                    ]
                ]
            );


            $auditLogs->insertOne([

                "action" =>
                    "deposit_rejected",

                "admin_user_id" =>
                    $sessionUserId,

                "deposit_id" =>
                    $depositIdString,

                "amount" =>
                    $amount,

                "created_at" =>
                    new MongoDB\BSON\UTCDateTime()
            ]);


            jsonResponse([

                "success" => true,

                "message" =>
                    "Deposit rejected successfully.",

                "deposit" => [

                    "id" =>
                        $depositIdString,

                    "status" =>
                        "rejected"
                ]
            ]);
        }


        /* =================================================
           APPROVE
        ================================================= */


        /*
         * The frontend must explicitly tell the server that
         * the administrator manually verified the payment.
         */

        $requestedVerification =
            $payload["payment_verified"] ??
            false;


        if (
            $requestedVerification !== true
        ) {

            jsonResponse([
                "success" => false,
                "message" =>
                    "Payment must be manually verified before approval."
            ], 400);
        }


        /* -------------------------------------------------
           USER ID
        ------------------------------------------------- */

        $userId =
            $deposit["user_id"] ??
            null;


        if (
            $userId === null ||
            $userId === ""
        ) {

            jsonResponse([
                "success" => false,
                "message" =>
                    "Deposit is not linked to a customer account."
            ], 400);
        }


        /* -------------------------------------------------
           CUSTOMER
        ------------------------------------------------- */

        $customer =
            findUserById(
                $users,
                (string)$userId
            );


        if (!$customer) {

            jsonResponse([
                "success" => false,
                "message" =>
                    "Customer account linked to this deposit was not found."
            ], 404);
        }


        $customerStatus =
            normalizeStatus(
                $customer["status"] ??
                "active"
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

            jsonResponse([
                "success" => false,
                "message" =>
                    "Customer account is not active."
            ], 400);
        }


        /* -------------------------------------------------
           CUSTOMER ID
        ------------------------------------------------- */

        $customerId =
            $customer["_id"];


        /* -------------------------------------------------
           BALANCE FIELD
        ------------------------------------------------- */

        $balanceField =
            "balance";


        if (
            !isset(
                $customer["balance"]
            ) &&
            isset(
                $customer["wallet_balance"]
            )
        ) {

            $balanceField =
                "wallet_balance";
        }


        /* =================================================
           MONGODB TRANSACTION
        ================================================= */

        $mongoSession =
            $db->startSession();


        try {

            $mongoSession->startTransaction();


            /* ---------------------------------------------
               APPROVE DEPOSIT
            --------------------------------------------- */

            $updateResult =
                $deposits->updateOne(
                    [
                        "_id" =>
                            $deposit["_id"],

                        "status" =>
                            "pending"
                    ],
                    [
                        '$set' => [

                            "status" =>
                                "approved",

                            "payment_verified" =>
                                true,

                            "updated_at" =>
                                new MongoDB\BSON\UTCDateTime(),

                            "reviewed_at" =>
                                new MongoDB\BSON\UTCDateTime(),

                            "reviewed_by" =>
                                $sessionUserId
                        ]
                    ],
                    [
                        "session" =>
                            $mongoSession
                    ]
                );


            if (
                $updateResult->getModifiedCount() !== 1
            ) {

                throw new RuntimeException(
                    "Deposit has already been processed."
                );
            }


            /* ---------------------------------------------
               CREDIT CUSTOMER
            --------------------------------------------- */

            $balanceResult =
                $users->updateOne(
                    [
                        "_id" =>
                            $customerId
                    ],
                    [
                        '$inc' => [

                            $balanceField =>
                                $amount

                        ],

                        '$set' => [

                            "updated_at" =>
                                new MongoDB\BSON\UTCDateTime()
                        ]
                    ],
                    [
                        "session" =>
                            $mongoSession
                    ]
                );


            if (
                $balanceResult->getModifiedCount() !== 1
            ) {

                throw new RuntimeException(
                    "Customer balance could not be updated."
                );
            }


            /* ---------------------------------------------
               TRANSACTION RECORD
            --------------------------------------------- */

            $depositIdString =
                (string)$deposit["_id"];


            $reference =
                (string)(
                    $deposit["reference"] ??
                    $deposit["transaction_reference"] ??
                    $deposit["payment_reference"] ??
                    ""
                );


            $transactionQueries = [

                [
                    "deposit_id" =>
                        $depositIdString
                ]

            ];


            if (
                $reference !== ""
            ) {

                $transactionQueries[] = [

                    "reference" =>
                        $reference

                ];

                $transactionQueries[] = [

                    "transaction_reference" =>
                        $reference

                ];
            }


            $transactions->updateMany(
                [
                    '$or' =>
                        $transactionQueries
                ],
                [
                    '$set' => [

                        "status" =>
                            "completed",

                        "updated_at" =>
                            new MongoDB\BSON\UTCDateTime(),

                        "completed_at" =>
                            new MongoDB\BSON\UTCDateTime(),

                        "approved_by" =>
                            $sessionUserId
                    ]
                ],
                [
                    "session" =>
                        $mongoSession
                ]
            );


            /* ---------------------------------------------
               AUDIT LOG
            --------------------------------------------- */

            $auditLogs->insertOne(

                [

                    "action" =>
                        "deposit_approved",

                    "admin_user_id" =>
                        $sessionUserId,

                    "deposit_id" =>
                        $depositIdString,

                    "user_id" =>
                        (string)$customerId,

                    "amount" =>
                        $amount,

                    "payment_verified" =>
                        true,

                    "created_at" =>
                        new MongoDB\BSON\UTCDateTime()
                ],

                [
                    "session" =>
                        $mongoSession
                ]
            );


            /* ---------------------------------------------
               COMMIT
            --------------------------------------------- */

            $mongoSession->commitTransaction();


        } catch (Throwable $transactionError) {

            try {

                $mongoSession->abortTransaction();

            } catch (Throwable $abortError) {

                error_log(
                    "MongoDB transaction abort error: " .
                    $abortError->getMessage()
                );
            }


            throw $transactionError;


        } finally {

            $mongoSession->endSession();
        }


        /* =================================================
           SUCCESS
        ================================================= */

        jsonResponse([

            "success" => true,

            "message" =>
                "Deposit approved and customer balance credited successfully.",

            "deposit" => [

                "id" =>
                    (string)$deposit["_id"],

                "status" =>
                    "approved",

                "payment_verified" =>
                    true,

                "amount" =>
                    $amount
            ]
        ]);


    } catch (
        MongoDB\Driver\Exception\Exception $e
    ) {

        error_log(
            "Deposit processing database error: " .
            $e->getMessage()
        );

        jsonResponse([
            "success" => false,
            "message" =>
                "Database error while processing deposit."
        ], 500);

    } catch (RuntimeException $e) {

        error_log(
            "Deposit processing error: " .
            $e->getMessage()
        );

        jsonResponse([
            "success" => false,
            "message" =>
                $e->getMessage()
        ], 409);

    } catch (Throwable $e) {

        error_log(
            "Deposit processing error: " .
            $e->getMessage()
        );

        jsonResponse([
            "success" => false,
            "message" =>
                "Unable to process deposit."
        ], 500);
    }
}


/* =========================================================
   METHOD NOT ALLOWED
========================================================= */

jsonResponse([
    "success" => false,
    "message" =>
        "Method not allowed."
], 405);

?>