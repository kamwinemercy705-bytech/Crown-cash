<?php

/* =========================================================
   CROWN CASH — ADMIN DEPOSITS API
   admin-deposits.php
   ========================================================= */

declare(strict_types=1);


/* =========================================================
   CORS
   ========================================================= */

header("Content-Type: application/json; charset=UTF-8");

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


if (
    $_SERVER["REQUEST_METHOD"] === "OPTIONS"
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
   JSON RESPONSE HELPER
   ========================================================= */

function respond(
    int $statusCode,
    array $data
): never {

    http_response_code($statusCode);

    echo json_encode(
        $data,
        JSON_UNESCAPED_SLASHES
    );

    exit;
}


/* =========================================================
   METHOD CHECK
   ========================================================= */

$method =
    $_SERVER["REQUEST_METHOD"] ?? "GET";


if (
    !in_array(
        $method,
        ["GET", "POST"],
        true
    )
) {

    respond(
        405,
        [
            "success" => false,
            "message" =>
                "Method not allowed."
        ]
    );
}


/* =========================================================
   BASIC SESSION CHECK
   ========================================================= */

if (
    !isset($_SESSION["logged_in"]) ||
    $_SESSION["logged_in"] !== true ||
    !isset($_SESSION["user_id"]) ||
    $_SESSION["user_id"] === ""
) {

    respond(
        401,
        [
            "success" => false,
            "authenticated" => false,
            "authorized" => false,
            "message" =>
                "Administrator login required."
        ]
    );
}


/* =========================================================
   DATABASE
   ========================================================= */

try {

    require_once __DIR__ . "/config.php";

} catch (Throwable $e) {

    respond(
        500,
        [
            "success" => false,
            "message" =>
                "Unable to load database configuration."
        ]
    );
}


/* =========================================================
   COLLECTIONS
   ========================================================= */

try {

    $users =
        $db->selectCollection(
            "users"
        );

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

} catch (Throwable $e) {

    respond(
        500,
        [
            "success" => false,
            "message" =>
                "Unable to access database collections."
        ]
    );
}


/* =========================================================
   OBJECT ID HELPER
   ========================================================= */

function makeObjectId(
    mixed $value
): ?MongoDB\BSON\ObjectId {

    if (
        $value instanceof MongoDB\BSON\ObjectId
    ) {
        return $value;
    }


    if (
        !is_string($value) ||
        $value === ""
    ) {
        return null;
    }


    try {

        return new MongoDB\BSON\ObjectId(
            $value
        );

    } catch (Throwable $e) {

        return null;
    }
}


/* =========================================================
   ID TO STRING
   ========================================================= */

function idToString(
    mixed $value
): string {

    if (
        $value instanceof MongoDB\BSON\ObjectId
    ) {

        return (string)$value;
    }


    if (
        is_string($value)
    ) {

        return $value;
    }


    if (
        is_object($value) &&
        method_exists(
            $value,
            "__toString"
        )
    ) {

        return (string)$value;
    }


    return "";
}


/* =========================================================
   COMPARE IDS
   ========================================================= */

function idsMatch(
    mixed $first,
    mixed $second
): bool {

    $firstString =
        strtolower(
            idToString($first)
        );

    $secondString =
        strtolower(
            idToString($second)
        );


    if (
        $firstString === "" ||
        $secondString === ""
    ) {
        return false;
    }


    return hash_equals(
        $firstString,
        $secondString
    );
}


/* =========================================================
   FIND USER BY ID
   ========================================================= */

function findUserById(
    $users,
    mixed $userId
): ?array {

    if (
        $userId === null ||
        $userId === ""
    ) {
        return null;
    }


    $conditions = [];


    $objectId =
        makeObjectId(
            $userId
        );


    if (
        $objectId
    ) {

        $conditions[] = [
            "_id" => $objectId
        ];
    }


    $conditions[] = [
        "_id" => (string)$userId
    ];


    $conditions[] = [
        "user_id" => (string)$userId
    ];


    $conditions[] = [
        "id" => (string)$userId
    ];


    foreach (
        $conditions as $condition
    ) {

        try {

            $user =
                $users->findOne(
                    $condition
                );


            if (
                $user
            ) {

                return $user;
            }

        } catch (Throwable $e) {

            continue;
        }
    }


    return null;
}


/* =========================================================
   FIND CURRENT ADMIN
   ========================================================= */

try {

    $sessionUserId =
        (string)(
            $_SESSION["user_id"] ?? ""
        );


    if (
        $sessionUserId === ""
    ) {

        respond(
            401,
            [
                "success" => false,
                "authenticated" => false,
                "authorized" => false,
                "message" =>
                    "Administrator login required."
            ]
        );
    }


    $adminUser =
        findUserById(
            $users,
            $sessionUserId
        );


    if (
        !$adminUser
    ) {

        respond(
            403,
            [
                "success" => false,
                "authenticated" => true,
                "authorized" => false,
                "message" =>
                    "Administrator account was not found."
            ]
        );
    }


    /* -----------------------------------------------------
       STATUS CHECK
       ----------------------------------------------------- */

    $accountStatus =
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
            $accountStatus,
            $blockedStatuses,
            true
        )
    ) {

        respond(
            403,
            [
                "success" => false,
                "authenticated" => true,
                "authorized" => false,
                "message" =>
                    "This administrator account is not active."
            ]
        );
    }


    /* -----------------------------------------------------
       ROLE / ACCOUNT TYPE
       ----------------------------------------------------- */

    $role =
        strtolower(
            trim(
                (string)(
                    $adminUser["role"] ??
                    ""
                )
            )
        );


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
        (
            $role === "admin" ||
            $role === "administrator" ||
            $accountType === "admin" ||
            $accountType === "administrator"
        );


    if (
        !$isAdmin
    ) {

        respond(
            403,
            [
                "success" => false,
                "authenticated" => true,
                "authorized" => false,
                "message" =>
                    "Administrator authorization required."
            ]
        );
    }


    /* -----------------------------------------------------
       OPTIONAL ADMIN ID RESTRICTION
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


    /*
     * Fail closed if neither admin identity is configured.
     */

    if (
        $configuredAdminId === "" &&
        $configuredAdminEmail === ""
    ) {

        respond(
            500,
            [
                "success" => false,
                "message" =>
                    "Administrator identity is not configured on the server."
            ]
        );
    }


    $identityMatched = false;


    if (
        $configuredAdminId !== ""
    ) {

        $identityMatched =
            idsMatch(
                $sessionUserId,
                $configuredAdminId
            );
    }


    if (
        !$identityMatched &&
        $configuredAdminEmail !== ""
    ) {

        $adminEmail =
            strtolower(
                trim(
                    (string)(
                        $adminUser["email"] ??
                        ""
                    )
                )
            );


        $identityMatched =
            (
                $adminEmail !== "" &&
                hash_equals(
                    $configuredAdminEmail,
                    $adminEmail
                )
            );
    }


    if (
        !$identityMatched
    ) {

        respond(
            403,
            [
                "success" => false,
                "authenticated" => true,
                "authorized" => false,
                "message" =>
                    "This account is not the configured administrator."
            ]
        );
    }

} catch (Throwable $e) {

    respond(
        500,
        [
            "success" => false,
            "message" =>
                "Administrator authorization could not be completed."
        ]
    );
}


/* =========================================================
   DEPOSIT ID
   ========================================================= */

function extractDepositId(
    array $payload
): string {

    $id =
        $payload["deposit_id"] ??
        $payload["depositId"] ??
        $payload["id"] ??
        "";


    if (
        is_array($id)
    ) {

        if (
            isset($id["$oid"])
        ) {

            $id =
                $id["$oid"];
        }
    }


    return trim(
        (string)$id
    );
}


/* =========================================================
   FIND DEPOSIT
   ========================================================= */

function findDepositById(
    $deposits,
    string $depositId
): ?array {

    $conditions = [];


    $objectId =
        makeObjectId(
            $depositId
        );


    if (
        $objectId
    ) {

        $conditions[] = [
            "_id" => $objectId
        ];
    }


    $conditions[] = [
        "_id" => $depositId
    ];


    $conditions[] = [
        "deposit_id" => $depositId
    ];


    $conditions[] = [
        "id" => $depositId
    ];


    foreach (
        $conditions as $condition
    ) {

        try {

            $deposit =
                $deposits->findOne(
                    $condition
                );


            if (
                $deposit
            ) {

                return $deposit;
            }

        } catch (Throwable $e) {

            continue;
        }
    }


    return null;
}


/* =========================================================
   USER ID FROM DEPOSIT
   ========================================================= */

function extractDepositUserId(
    array $deposit
): mixed {

    return (
        $deposit["user_id"] ??
        $deposit["userId"] ??
        $deposit["customer_id"] ??
        $deposit["customerId"] ??
        null
    );
}


/* =========================================================
   AMOUNT
   ========================================================= */

function extractAmount(
    array $deposit
): float {

    $amount =
        $deposit["amount"] ??
        $deposit["deposit_amount"] ??
        $deposit["value"] ??
        0;


    if (
        $amount instanceof MongoDB\BSON\Decimal128
    ) {

        return (float)(
            $amount->__toString()
        );
    }


    if (
        is_object($amount) &&
        method_exists(
            $amount,
            "__toString"
        )
    ) {

        return (float)(
            $amount->__toString()
        );
    }


    return (float)$amount;
}


/* =========================================================
   GET DEPOSITS
   ========================================================= */

if (
    $method === "GET"
) {

    try {

        $cursor =
            $deposits->find(
                [],
                [
                    "sort" => [
                        "created_at" => -1,
                        "_id" => -1
                    ],
                    "limit" => 500
                ]
            );


        $items = [];


        foreach (
            $cursor as $depositDocument
        ) {

            $deposit =
                $depositDocument->getArrayCopy();


            $depositId =
                idToString(
                    $deposit["_id"] ?? ""
                );


            /*
             * Try to attach customer information.
             */

            $customerUserId =
                extractDepositUserId(
                    $deposit
                );


            $customer =
                null;


            if (
                $customerUserId !== null &&
                $customerUserId !== ""
            ) {

                $customer =
                    findUserById(
                        $users,
                        $customerUserId
                    );
            }


            if (
                $customer
            ) {

                if (
                    empty(
                        $deposit["full_name"]
                    )
                ) {

                    $deposit["full_name"] =
                        (string)(
                            $customer["full_name"] ??
                            ""
                        );
                }


                if (
                    empty(
                        $deposit["email"]
                    )
                ) {

                    $deposit["email"] =
                        (string)(
                            $customer["email"] ??
                            ""
                        );
                }


                if (
                    empty(
                        $deposit["phone"]
                    )
                ) {

                    $deposit["phone"] =
                        (string)(
                            $customer["phone"] ??
                            $customer["phone_number"] ??
                            $customer["mobile"] ??
                            ""
                        );
                }
            }


            /*
             * Convert MongoDB values into
             * frontend-safe JSON values.
             */

            $deposit["_id"] =
                $depositId;


            if (
                isset(
                    $deposit["amount"]
                )
            ) {

                $deposit["amount"] =
                    extractAmount(
                        $deposit
                    );
            }


            if (
                isset(
                    $deposit["created_at"]
                ) &&
                $deposit["created_at"]
                    instanceof MongoDB\BSON\UTCDateTime
            ) {

                $deposit["created_at"] =
                    $deposit["created_at"]
                        ->toDateTime()
                        ->format(
                            DATE_ATOM
                        );
            }


            if (
                isset(
                    $deposit["updated_at"]
                ) &&
                $deposit["updated_at"]
                    instanceof MongoDB\BSON\UTCDateTime
            ) {

                $deposit["updated_at"] =
                    $deposit["updated_at"]
                        ->toDateTime()
                        ->format(
                            DATE_ATOM
                        );
            }


            $items[] =
                $deposit;
        }


        respond(
            200,
            [
                "success" => true,
                "deposits" => $items,
                "count" => count($items)
            ]
        );

    } catch (Throwable $e) {

        error_log(
            "ADMIN DEPOSITS GET ERROR: " .
            $e->getMessage()
        );


        respond(
            500,
            [
                "success" => false,
                "message" =>
                    "Unable to load deposits."
            ]
        );
    }
}


/* =========================================================
   POST — APPROVE / REJECT
   ========================================================= */

if (
    $method === "POST"
) {

    $rawInput =
        file_get_contents(
            "php://input"
        );


    $payload = [];


    if (
        is_string($rawInput) &&
        trim($rawInput) !== ""
    ) {

        $decoded =
            json_decode(
                $rawInput,
                true
            );


        if (
            is_array($decoded)
        ) {

            $payload =
                $decoded;
        }
    }


    /*
     * Also support normal POST data.
     */

    if (
        empty($payload) &&
        !empty($_POST)
    ) {

        $payload =
            $_POST;
    }


    $depositId =
        extractDepositId(
            $payload
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


    $paymentVerified =
        filter_var(
            $payload["payment_verified"] ??
            false,
            FILTER_VALIDATE_BOOLEAN
        );


    if (
        $depositId === ""
    ) {

        respond(
            400,
            [
                "success" => false,
                "message" =>
                    "Deposit ID is required."
            ]
        );
    }


    if (
        !in_array(
            $action,
            ["approve", "reject"],
            true
        )
    ) {

        respond(
            400,
            [
                "success" => false,
                "message" =>
                    "Invalid deposit action."
            ]
        );
    }


    try {

        $deposit =
            findDepositById(
                $deposits,
                $depositId
            );


        if (
            !$deposit
        ) {

            respond(
                404,
                [
                    "success" => false,
                    "message" =>
                        "Deposit was not found."
                ]
            );
        }


        $currentStatus =
            strtolower(
                trim(
                    (string)(
                        $deposit["status"] ??
                        "pending"
                    )
                )
            );


        if (
            !in_array(
                $currentStatus,
                [
                    "pending"
                ],
                true
            )
        ) {

            respond(
                409,
                [
                    "success" => false,
                    "message" =>
                        "This deposit has already been processed."
                ]
            );
        }


        $customerUserId =
            extractDepositUserId(
                $deposit
            );


        if (
            $customerUserId === null ||
            $customerUserId === ""
        ) {

            respond(
                400,
                [
                    "success" => false,
                    "message" =>
                        "This deposit is not linked to a customer account."
                ]
            );
        }


        $customer =
            findUserById(
                $users,
                $customerUserId
            );


        if (
            !$customer
        ) {

            respond(
                404,
                [
                    "success" => false,
                    "message" =>
                        "The customer account linked to this deposit was not found."
                ]
            );
        }


        /* =================================================
           REJECT
           ================================================= */

        if (
            $action === "reject"
        ) {

            $result =
                $deposits->updateOne(
                    [
                        "_id" =>
                            $deposit["_id"] ??
                            null,

                        "status" =>
                            "pending"
                    ],
                    [
                        "$set" => [
                            "status" =>
                                "rejected",

                            "rejected_at" =>
                                new MongoDB\BSON\UTCDateTime(),

                            "rejected_by" =>
                                $_SESSION["user_id"],

                            "updated_at" =>
                                new MongoDB\BSON\UTCDateTime()
                        ]
                    ]
                );


            if (
                $result->getModifiedCount() !== 1
            ) {

                respond(
                    409,
                    [
                        "success" => false,
                        "message" =>
                            "The deposit could not be rejected because its status changed."
                    ]
                );
            }


            /*
             * Update related transaction records.
             */

            $transactionFilter = [
                "type" => "deposit",
                "status" => "pending"
            ];


            $transactionOr = [
                [
                    "deposit_id" =>
                        $depositId
                ],
                [
                    "reference" =>
                        (string)(
                            $deposit["reference"] ??
                            $deposit["transaction_reference"] ??
                            ""
                        )
                ]
            ];


            try {

                $transactions->updateMany(
                    [
                        "status" => "pending",
                        "$or" =>
                            $transactionOr
                    ],
                    [
                        "$set" => [
                            "status" =>
                                "rejected",

                            "updated_at" =>
                                new MongoDB\BSON\UTCDateTime(),

                            "processed_by" =>
                                $_SESSION["user_id"]
                        ]
                    ]
                );

            } catch (Throwable $e) {

                error_log(
                    "Deposit transaction update failed: " .
                    $e->getMessage()
                );
            }


            /*
             * Audit log.
             */

            try {

                $auditLogs->insertOne(
                    [
                        "action" =>
                            "deposit_rejected",

                        "type" =>
                            "deposit",

                        "deposit_id" =>
                            $depositId,

                        "user_id" =>
                            $customerUserId,

                        "admin_id" =>
                            $_SESSION["user_id"],

                        "amount" =>
                            extractAmount(
                                $deposit
                            ),

                        "created_at" =>
                            new MongoDB\BSON\UTCDateTime()
                    ]
                );

            } catch (Throwable $e) {

                error_log(
                    "Deposit rejection audit failed: " .
                    $e->getMessage()
                );
            }


            respond(
                200,
                [
                    "success" => true,
                    "message" =>
                        "Deposit rejected successfully.",
                    "deposit_id" =>
                        $depositId,
                    "status" =>
                        "rejected"
                ]
            );
        }


        /* =================================================
           APPROVE
           ================================================= */

        /*
         * The administrator must explicitly confirm
         * payment verification in the admin interface.
         */

        if (
            !$paymentVerified
        ) {

            respond(
                400,
                [
                    "success" => false,
                    "message" =>
                        "Payment verification confirmation is required before approval."
                ]
            );
        }


        /*
         * Check customer account status.
         */

        $customerStatus =
            strtolower(
                trim(
                    (string)(
                        $customer["status"] ??
                        "active"
                    )
                )
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

            respond(
                403,
                [
                    "success" => false,
                    "message" =>
                        "The customer's account is not active."
                ]
            );
        }


        $amount =
            extractAmount(
                $deposit
            );


        if (
            $amount <= 0
        ) {

            respond(
                400,
                [
                    "success" => false,
                    "message" =>
                        "Invalid deposit amount."
                ]
            );
        }


        /*
         * Use the actual MongoDB document _id whenever
         * possible for the atomic status update.
         */

        $depositFilter = [
            "status" =>
                "pending"
        ];


        if (
            isset(
                $deposit["_id"]
            )
        ) {

            $depositFilter["_id"] =
                $deposit["_id"];

        } else {

            $depositFilter["_id"] =
                $depositId;
        }


        /*
         * First atomically reserve the deposit.
         *
         * The second update credits the customer.
         * If crediting fails, we attempt to restore
         * the deposit to pending.
         */

        $approvalTime =
            new MongoDB\BSON\UTCDateTime();


        $approveResult =
            $deposits->updateOne(
                $depositFilter,
                [
                    "$set" => [
                        "status" =>
                            "approved",

                        "payment_verified" =>
                            true,

                        "approved_at" =>
                            $approvalTime,

                        "approved_by" =>
                            $_SESSION["user_id"],

                        "updated_at" =>
                            $approvalTime
                    ]
                ]
            );


        if (
            $approveResult->getModifiedCount() !== 1
        ) {

            respond(
                409,
                [
                    "success" => false,
                    "message" =>
                        "The deposit could not be approved because it has already been processed."
                ]
            );
        }


        /*
         * Credit the customer's balance.
         */

        $customerFilter = [];


        if (
            isset(
                $customer["_id"]
            )
        ) {

            $customerFilter["_id"] =
                $customer["_id"];

        } else {

            $customerFilter["_id"] =
                (string)$customerUserId;
        }


        $balanceResult =
            $users->updateOne(
                $customerFilter,
                [
                    "$inc" => [
                        "balance" =>
                            $amount,

                        "wallet_balance" =>
                            $amount
                    ],

                    "$set" => [
                        "updated_at" =>
                            $approvalTime
                    ]
                ]
            );


        /*
         * If the customer does not have the expected
         * document, try a second lookup by ObjectId.
         */

        if (
            $balanceResult->getModifiedCount() !== 1 &&
            $balanceResult->getMatchedCount() !== 1
        ) {

            $customerObjectId =
                makeObjectId(
                    $customerUserId
                );


            if (
                $customerObjectId
            ) {

                $balanceResult =
                    $users->updateOne(
                        [
                            "_id" =>
                                $customerObjectId
                        ],
                        [
                            "$inc" => [
                                "balance" =>
                                    $amount,

                                "wallet_balance" =>
                                    $amount
                            ],

                            "$set" => [
                                "updated_at" =>
                                    $approvalTime
                            ]
                        ]
                    );
            }
        }


        /*
         * If balance update failed, restore deposit
         * to pending so it is not falsely approved.
         */

        if (
            $balanceResult->getMatchedCount() !== 1
        ) {

            try {

                $deposits->updateOne(
                    [
                        "_id" =>
                            $deposit["_id"] ??
                            null,

                        "status" =>
                            "approved"
                    ],
                    [
                        "$set" => [
                            "status" =>
                                "pending",

                            "payment_verified" =>
                                false,

                            "updated_at" =>
                                new MongoDB\BSON\UTCDateTime()
                        ],

                        "$unset" => [
                            "approved_at" => "",
                            "approved_by" => ""
                        ]
                    ]
                );

            } catch (Throwable $rollbackError) {

                error_log(
                    "Deposit rollback failed: " .
                    $rollbackError->getMessage()
                );
            }


            respond(
                500,
                [
                    "success" => false,
                    "message" =>
                        "Deposit approval failed because the customer balance could not be updated."
                ]
            );
        }


        /*
         * Update transaction.
         */

        try {

            $reference =
                (string)(
                    $deposit["reference"] ??
                    $deposit["transaction_reference"] ??
                    ""
                );


            $transactionFilter = [
                "status" =>
                    "pending",
                "$or" => [
                    [
                        "deposit_id" =>
                            $depositId
                    ],
                    [
                        "reference" =>
                            $reference
                    ]
                ]
            ];


            $transactions->updateMany(
                $transactionFilter,
                [
                    "$set" => [
                        "status" =>
                            "completed",

                        "transaction_status" =>
                            "completed",

                        "deposit_status" =>
                            "approved",

                        "processed_by" =>
                            $_SESSION["user_id"],

                        "processed_at" =>
                            $approvalTime,

                        "updated_at" =>
                            $approvalTime
                    ]
                ]
            );

        } catch (Throwable $e) {

            error_log(
                "Deposit transaction update failed: " .
                $e->getMessage()
            );
        }


        /*
         * Audit log.
         */

        try {

            $auditLogs->insertOne(
                [
                    "action" =>
                        "deposit_approved",

                    "type" =>
                        "deposit",

                    "deposit_id" =>
                        $depositId,

                    "user_id" =>
                        $customerUserId,

                    "admin_id" =>
                        $_SESSION["user_id"],

                    "amount" =>
                        $amount,

                    "payment_verified" =>
                        true,

                    "created_at" =>
                        $approvalTime
                ]
            );

        } catch (Throwable $e) {

            error_log(
                "Deposit approval audit failed: " .
                $e->getMessage()
            );
        }


        respond(
            200,
            [
                "success" => true,
                "message" =>
                    "Deposit approved and customer balance credited successfully.",
                "deposit_id" =>
                    $depositId,
                "status" =>
                    "approved",
                "amount" =>
                    $amount
            ]
        );
    }


    catch (
        MongoDB\Driver\Exception\Exception $e
    ) {

        error_log(
            "ADMIN DEPOSITS MONGODB ERROR: " .
            $e->getMessage()
        );


        respond(
            500,
            [
                "success" => false,
                "message" =>
                    "A database error occurred while processing the deposit."
            ]
        );

    } catch (
        Throwable $e
    ) {

        error_log(
            "ADMIN DEPOSITS POST ERROR: " .
            $e->getMessage()
        );


        respond(
            500,
            [
                "success" => false,
                "message" =>
                    "Unable to process the deposit."
            ]
        );
    }
}


/* =========================================================
   FALLBACK
   ========================================================= */

respond(
    405,
    [
        "success" => false,
        "message" =>
            "Unsupported request."
    ]
);

?>