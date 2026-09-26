<?php

/* =========================================================
   CROWN CASH
   ADMIN DEPOSITS API
   ========================================================= */

header(
    "Content-Type: application/json; charset=UTF-8"
);

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
    "Access-Control-Allow-Headers: Content-Type"
);


/* =========================================================
   OPTIONS
   ========================================================= */

if (
    $_SERVER["REQUEST_METHOD"] === "OPTIONS"
) {

    http_response_code(204);

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
   RESPONSE
   ========================================================= */

function response(
    int $status,
    array $data
): void {

    http_response_code($status);

    echo json_encode(
        $data,
        JSON_UNESCAPED_SLASHES
    );

    exit;
}


/* =========================================================
   REQUEST METHOD
   ========================================================= */

$requestMethod =
    $_SERVER["REQUEST_METHOD"];


if (
    !in_array(
        $requestMethod,
        ["GET", "POST"],
        true
    )
) {

    response(
        405,
        [
            "success" => false,
            "message" =>
                "Method not allowed."
        ]
    );
}


/* =========================================================
   LOGIN CHECK
   ========================================================= */

if (
    !isset($_SESSION["logged_in"]) ||
    $_SESSION["logged_in"] !== true ||
    empty($_SESSION["user_id"])
) {

    response(
        401,
        [
            "success" => false,
            "message" =>
                "Administrator login required."
        ]
    );
}


/* =========================================================
   CONFIG
   ========================================================= */

try {

    require_once __DIR__ . "/config.php";

} catch (Throwable $e) {

    response(
        500,
        [
            "success" => false,
            "message" =>
                "Database configuration failed."
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

    response(
        500,
        [
            "success" => false,
            "message" =>
                "Database collections could not be loaded."
        ]
    );
}


/* =========================================================
   ID HELPERS
   ========================================================= */

function idString($id): string {

    if (
        $id instanceof MongoDB\BSON\ObjectId
    ) {
        return (string)$id;
    }

    return (string)$id;
}


function idsEqual(
    $a,
    $b
): bool {

    if (
        $a === null ||
        $b === null
    ) {
        return false;
    }

    return
        idString($a) ===
        idString($b);
}


/* =========================================================
   FIND USER
   ========================================================= */

function findUser(
    $users,
    $id
) {

    if (!$id) {
        return null;
    }


    try {

        if (
            $id instanceof
            MongoDB\BSON\ObjectId
        ) {

            $user =
                $users->findOne([
                    "_id" => $id
                ]);

            if ($user) {
                return $user;
            }
        }


        $value =
            (string)$id;


        if (
            preg_match(
                "/^[a-f0-9]{24}$/i",
                $value
            )
        ) {

            try {

                $user =
                    $users->findOne([
                        "_id" =>
                            new MongoDB\BSON\ObjectId(
                                $value
                            )
                    ]);

                if ($user) {
                    return $user;
                }

            } catch (Throwable $e) {
            }
        }


        return $users->findOne([
            "_id" => $value
        ]);

    } catch (Throwable $e) {

        return null;
    }
}


/* =========================================================
   ADMIN USER
   ========================================================= */

$sessionUserId =
    $_SESSION["user_id"];


$adminUser =
    findUser(
        $users,
        $sessionUserId
    );


if (!$adminUser) {

    response(
        401,
        [
            "success" => false,
            "message" =>
                "Administrator account was not found."
        ]
    );
}


/* =========================================================
   ACCOUNT STATUS
   ========================================================= */

$status =
    strtolower(
        trim(
            (string)(
                $adminUser["status"]
                ?? "active"
            )
        )
    );


if (
    in_array(
        $status,
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

    response(
        403,
        [
            "success" => false,
            "message" =>
                "Administrator account is not active."
        ]
    );
}


/* =========================================================
   ROLE
   ========================================================= */

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
    $role === "admin" ||
    $accountType === "admin";


if (!$isAdmin) {

    response(
        403,
        [
            "success" => false,
            "message" =>
                "Administrator privileges are required."
        ]
    );
}


/* =========================================================
   ADMIN ID
   ========================================================= */

$configuredAdminId =
    trim(
        (string)(
            getenv("ADMIN_USER_ID")
            ?: ""
        )
    );


$configuredAdminEmail =
    trim(
        (string)(
            getenv("ADMIN_EMAIL")
            ?: ""
        )
    );


if (
    $configuredAdminId !== ""
) {

    if (
        !idsEqual(
            $sessionUserId,
            $configuredAdminId
        )
    ) {

        response(
            403,
            [
                "success" => false,
                "message" =>
                    "This administrator account is not authorized."
            ]
        );
    }

} elseif (
    $configuredAdminEmail !== ""
) {

    $currentEmail =
        strtolower(
            trim(
                (string)(
                    $adminUser["email"]
                    ?? ""
                )
            )
        );


    if (
        $currentEmail !==
        strtolower(
            $configuredAdminEmail
        )
    ) {

        response(
            403,
            [
                "success" => false,
                "message" =>
                    "Administrator email is not authorized."
            ]
        );
    }

} else {

    response(
        500,
        [
            "success" => false,
            "message" =>
                "Administrator identity is not configured on the server."
        ]
    );
}


/* =========================================================
   ADMIN SESSION
   ========================================================= */

$_SESSION["role"] =
    "admin";

$_SESSION["account_type"] =
    "admin";

$_SESSION["admin_verified"] =
    true;


/* =========================================================
   GET DEPOSITS
   ========================================================= */

if (
    $requestMethod === "GET"
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


        $total =
            0;

        $pending =
            0;

        $approved =
            0;

        $rejected =
            0;


        foreach (
            $cursor as $deposit
        ) {

            $depositId =
                idString(
                    $deposit["_id"]
                );


            $userId =
                $deposit["user_id"]
                ??
                $deposit["customer_id"]
                ??
                null;


            $customer =
                $userId
                    ? findUser(
                        $users,
                        $userId
                    )
                    : null;


            /* CUSTOMER NAME */

            $name =
                (string)(
                    $deposit["customer_name"]
                    ??
                    $deposit["full_name"]
                    ??
                    ""
                );


            if (
                $name === "" &&
                $customer
            ) {

                $name =
                    trim(
                        (string)(
                            $customer["full_name"]
                            ??
                            ""
                        )
                    );


                if (
                    $name === ""
                ) {

                    $name =
                        trim(
                            (string)(
                                $customer["first_name"]
                                ??
                                ""
                            )
                            .
                            " "
                            .
                            trim(
                                (string)(
                                    $customer["last_name"]
                                    ??
                                    ""
                                )
                            )
                        );
                }
            }


            if (
                $name === ""
            ) {
                $name =
                    "Customer";
            }


            /* EMAIL */

            $email =
                (string)(
                    $deposit["email"]
                    ??
                    $deposit["customer_email"]
                    ??
                    (
                        $customer["email"]
                        ??
                        ""
                    )
                );


            /* PHONE */

            $phone =
                (string)(
                    $deposit["phone"]
                    ??
                    $deposit["customer_phone"]
                    ??
                    (
                        $customer["phone"]
                        ??
                        $customer["phone_number"]
                        ??
                        $customer["mobile"]
                        ??
                        ""
                    )
                );


            /* AMOUNT */

            $rawAmount =
                $deposit["amount"]
                ??
                0;


            if (
                $rawAmount
                instanceof
                MongoDB\BSON\Decimal128
            ) {

                $amount =
                    (float)
                    $rawAmount
                        ->__toString();

            } else {

                $amount =
                    (float)
                    $rawAmount;
            }


            /* STATUS */

            $depositStatus =
                strtolower(
                    trim(
                        (string)(
                            $deposit["status"]
                            ??
                            "pending"
                        )
                    )
                );


            /* METHOD */

            $paymentMethod =
                (string)(
                    $deposit["payment_method"]
                    ??
                    $deposit["method"]
                    ??
                    ""
                );


            /* REFERENCE */

            $reference =
                (string)(
                    $deposit["reference"]
                    ??
                    $deposit["transaction_reference"]
                    ??
                    $deposit["payment_reference"]
                    ??
                    ""
                );


            /* DATE */

            $createdAt =
                "";


            if (
                isset(
                    $deposit["created_at"]
                ) &&
                $deposit["created_at"]
                instanceof
                MongoDB\BSON\UTCDateTime
            ) {

                $createdAt =
                    $deposit["created_at"]
                        ->toDateTime()
                        ->format(
                            DATE_ATOM
                        );
            }


            /* STATISTICS */

            $total +=
                $amount;


            if (
                $depositStatus ===
                "pending"
            ) {

                $pending +=
                    $amount;
            }


            if (
                $depositStatus ===
                "approved"
            ) {

                $approved +=
                    $amount;
            }


            if (
                $depositStatus ===
                "rejected"
            ) {

                $rejected +=
                    $amount;
            }


            /* OUTPUT */

            $items[] = [

                "id" =>
                    $depositId,

                "deposit_id" =>
                    $depositId,

                "user_id" =>
                    $userId
                        ? idString(
                            $userId
                        )
                        : "",

                "customer_name" =>
                    $name,

                "full_name" =>
                    $name,

                "email" =>
                    $email,

                "phone" =>
                    $phone,

                "amount" =>
                    $amount,

                "payment_method" =>
                    $paymentMethod,

                "reference" =>
                    $reference,

                "status" =>
                    $depositStatus,

                "payment_verified" =>
                    (
                        $deposit[
                            "payment_verified"
                        ]
                        ??
                        false
                    ) === true,

                "created_at" =>
                    $createdAt
            ];
        }


        response(
            200,
            [

                "success" =>
                    true,

                "authenticated" =>
                    true,

                "authorized" =>
                    true,

                "deposits" =>
                    $items,

                "statistics" => [

                    "total_count" =>
                        count($items),

                    "total_amount" =>
                        $total,

                    "pending_amount" =>
                        $pending,

                    "approved_amount" =>
                        $approved,

                    "rejected_amount" =>
                        $rejected
                ]
            ]
        );


    } catch (
        MongoDB\Driver\Exception\Exception $e
    ) {

        response(
            500,
            [
                "success" => false,
                "message" =>
                    "Unable to load deposits from MongoDB."
            ]
        );

    } catch (Throwable $e) {

        response(
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
   POST
   ========================================================= */

if (
    $requestMethod === "POST"
) {

    $body =
        file_get_contents(
            "php://input"
        );


    $input =
        json_decode(
            $body,
            true
        );


    if (
        !is_array($input)
    ) {

        response(
            400,
            [
                "success" => false,
                "message" =>
                    "Invalid JSON request."
            ]
        );
    }


    $depositId =
        trim(
            (string)(
                $input["deposit_id"]
                ??
                ""
            )
        );


    $action =
        strtolower(
            trim(
                (string)(
                    $input["action"]
                    ??
                    ""
                )
            )
        );


    $paymentVerified =
        (
            $input[
                "payment_verified"
            ]
            ??
            false
        ) === true;


    if (
        !preg_match(
            "/^[a-f0-9]{24}$/i",
            $depositId
        )
    ) {

        response(
            400,
            [
                "success" => false,
                "message" =>
                    "Invalid deposit ID."
            ]
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

        response(
            400,
            [
                "success" => false,
                "message" =>
                    "Invalid deposit action."
            ]
        );
    }


    try {

        $objectId =
            new MongoDB\BSON\ObjectId(
                $depositId
            );

    } catch (Throwable $e) {

        response(
            400,
            [
                "success" => false,
                "message" =>
                    "Invalid deposit ID."
            ]
        );
    }


    /* =====================================================
       FIND PENDING DEPOSIT
       ===================================================== */

    $deposit =
        $deposits->findOne([
            "_id" =>
                $objectId,

            "status" =>
                "pending"
        ]);


    if (!$deposit) {

        response(
            409,
            [
                "success" => false,
                "message" =>
                    "This deposit has already been processed or does not exist."
            ]
        );
    }


    /* =====================================================
       USER
       ===================================================== */

    $userId =
        $deposit["user_id"]
        ??
        $deposit["customer_id"]
        ??
        null;


    if (!$userId) {

        response(
            400,
            [
                "success" => false,
                "message" =>
                    "This deposit is not linked to a customer."
            ]
        );
    }


    $customer =
        findUser(
            $users,
            $userId
        );


    if (!$customer) {

        response(
            404,
            [
                "success" => false,
                "message" =>
                    "Customer account could not be found."
            ]
        );
    }


    /* =====================================================
       AMOUNT
       ===================================================== */

    $rawAmount =
        $deposit["amount"]
        ??
        0;


    if (
        $rawAmount
        instanceof
        MongoDB\BSON\Decimal128
    ) {

        $amount =
            (float)
            $rawAmount
                ->__toString();

    } else {

        $amount =
            (float)
            $rawAmount;
    }


    if (
        $amount <= 0
    ) {

        response(
            400,
            [
                "success" => false,
                "message" =>
                    "Invalid deposit amount."
            ]
        );
    }


    /* =====================================================
       APPROVE
       ===================================================== */

    if (
        $action ===
        "approve"
    ) {


        if (
            !$paymentVerified
        ) {

            response(
                400,
                [
                    "success" => false,
                    "message" =>
                        "Payment verification is required before approval."
                ]
            );
        }


        try {

            /*
             * Atlas supports MongoDB transactions.
             */

            $session =
                $db->startSession();


            $session->startTransaction();


            /* ---------------------------------------------
               UPDATE DEPOSIT
               --------------------------------------------- */

            $update =
                $deposits->updateOne(
                    [
                        "_id" =>
                            $objectId,

                        "status" =>
                            "pending"
                    ],
                    [
                        '$set' => [

                            "status" =>
                                "approved",

                            "payment_verified" =>
                                true,

                            "approved_at" =>
                                new MongoDB\BSON\UTCDateTime(),

                            "approved_by" =>
                                new MongoDB\BSON\ObjectId(
                                    idString(
                                        $sessionUserId
                                    )
                                )
                        ]
                    ],
                    [
                        "session" =>
                            $session
                    ]
                );


            if (
                $update
                    ->getModifiedCount()
                !== 1
            ) {

                throw new RuntimeException(
                    "Deposit has already been processed."
                );
            }


            /* ---------------------------------------------
               CREDIT BALANCE
               --------------------------------------------- */

            $balanceUpdate =
                $users->updateOne(
                    [
                        "_id" =>
                            $customer["_id"]
                    ],
                    [
                        '$inc' => [

                            "balance" =>
                                $amount,

                            "wallet_balance" =>
                                $amount
                        ]
                    ],
                    [
                        "session" =>
                            $session
                    ]
                );


            if (
                $balanceUpdate
                    ->getModifiedCount()
                !== 1
            ) {

                throw new RuntimeException(
                    "Customer balance could not be updated."
                );
            }


            /* ---------------------------------------------
               FIND TRANSACTION
               --------------------------------------------- */

            $reference =
                $deposit["reference"]
                ??
                $deposit[
                    "transaction_reference"
                ]
                ??
                "";


            $transaction =
                $transactions->findOne(
                    [
                        "deposit_id" =>
                            $objectId
                    ],
                    [
                        "session" =>
                            $session
                    ]
                );


            /*
             * Some earlier Crown Cash deposits may not have
             * deposit_id inside their transaction record.
             *
             * Try reference + user as a fallback.
             */

            if (
                !$transaction &&
                $reference !== ""
            ) {

                $transaction =
                    $transactions->findOne(
                        [
                            "user_id" =>
                                $customer["_id"],

                            "reference" =>
                                $reference
                        ],
                        [
                            "session" =>
                                $session
                        ]
                    );
            }


            if ($transaction) {

                $transactions->updateOne(
                    [
                        "_id" =>
                            $transaction["_id"]
                    ],
                    [
                        '$set' => [

                            "deposit_id" =>
                                $objectId,

                            "status" =>
                                "completed",

                            "transaction_status" =>
                                "completed",

                            "updated_at" =>
                                new MongoDB\BSON\UTCDateTime(),

                            "approved_at" =>
                                new MongoDB\BSON\UTCDateTime(),

                            "approved_by" =>
                                new MongoDB\BSON\ObjectId(
                                    idString(
                                        $sessionUserId
                                    )
                                )
                        ]
                    ],
                    [
                        "session" =>
                            $session
                    ]
                );

            } else {

                $transactions->insertOne(
                    [

                        "user_id" =>
                            $customer["_id"],

                        "deposit_id" =>
                            $objectId,

                        "type" =>
                            "deposit",

                        "transaction_type" =>
                            "deposit",

                        "amount" =>
                            $amount,

                        "payment_method" =>
                            (
                                $deposit[
                                    "payment_method"
                                ]
                                ??
                                ""
                            ),

                        "reference" =>
                            $reference,

                        "status" =>
                            "completed",

                        "transaction_status" =>
                            "completed",

                        "created_at" =>
                            new MongoDB\BSON\UTCDateTime(),

                        "updated_at" =>
                            new MongoDB\BSON\UTCDateTime(),

                        "approved_at" =>
                            new MongoDB\BSON\UTCDateTime(),

                        "approved_by" =>
                            new MongoDB\BSON\ObjectId(
                                idString(
                                    $sessionUserId
                                )
                            )
                    ],
                    [
                        "session" =>
                            $session
                    ]
                );
            }


            /* ---------------------------------------------
               AUDIT
               --------------------------------------------- */

            $auditLogs->insertOne(
                [

                    "action" =>
                        "deposit_approved",

                    "event" =>
                        "deposit_approved",

                    "admin_id" =>
                        new MongoDB\BSON\ObjectId(
                            idString(
                                $sessionUserId
                            )
                        ),

                    "user_id" =>
                        $customer["_id"],

                    "deposit_id" =>
                        $objectId,

                    "amount" =>
                        $amount,

                    "payment_verified" =>
                        true,

                    "created_at" =>
                        new MongoDB\BSON\UTCDateTime()
                ],
                [
                    "session" =>
                        $session
                ]
            );


            /* ---------------------------------------------
               COMMIT
               --------------------------------------------- */

            $session->commitTransaction();


            response(
                200,
                [

                    "success" =>
                        true,

                    "message" =>
                        "Deposit approved successfully and customer balance credited.",

                    "deposit_id" =>
                        $depositId,

                    "amount" =>
                        $amount
                ]
            );


        } catch (
            MongoDB\Driver\Exception\Exception $e
        ) {

            if (
                isset($session)
            ) {

                try {
                    $session
                        ->abortTransaction();
                } catch (Throwable $ignore) {
                }
            }


            response(
                500,
                [
                    "success" => false,
                    "message" =>
                        "Deposit approval failed. No balance was credited."
                ]
            );


        } catch (Throwable $e) {

            if (
                isset($session)
            ) {

                try {
                    $session
                        ->abortTransaction();
                } catch (Throwable $ignore) {
                }
            }


            response(
                500,
                [
                    "success" => false,
                    "message" =>
                        $e->getMessage()
                        ===
                        "Deposit has already been processed."
                            ? "This deposit has already been processed."
                            : "Deposit approval failed. No balance was credited."
                ]
            );
        }
    }


    /* =====================================================
       REJECT
       ===================================================== */

    if (
        $action ===
        "reject"
    ) {

        try {

            $now =
                new MongoDB\BSON\UTCDateTime();


            $update =
                $deposits->updateOne(
                    [
                        "_id" =>
                            $objectId,

                        "status" =>
                            "pending"
                    ],
                    [
                        '$set' => [

                            "status" =>
                                "rejected",

                            "rejected_at" =>
                                $now,

                            "rejected_by" =>
                                new MongoDB\BSON\ObjectId(
                                    idString(
                                        $sessionUserId
                                    )
                                )
                        ]
                    ]
                );


            if (
                $update
                    ->getModifiedCount()
                !== 1
            ) {

                response(
                    409,
                    [
                        "success" => false,
                        "message" =>
                            "This deposit has already been processed."
                    ]
                );
            }


            /* TRANSACTION */

            $transactions->updateMany(
                [
                    "deposit_id" =>
                        $objectId
                ],
                [
                    '$set' => [

                        "status" =>
                            "rejected",

                        "transaction_status" =>
                            "rejected",

                        "updated_at" =>
                            $now,

                        "rejected_at" =>
                            $now,

                        "rejected_by" =>
                            new MongoDB\BSON\ObjectId(
                                idString(
                                    $sessionUserId
                                )
                            )
                    ]
                ]
            );


            /* AUDIT */

            $auditLogs->insertOne(
                [

                    "action" =>
                        "deposit_rejected",

                    "event" =>
                        "deposit_rejected",

                    "admin_id" =>
                        new MongoDB\BSON\ObjectId(
                            idString(
                                $sessionUserId
                            )
                        ),

                    "user_id" =>
                        $customer["_id"],

                    "deposit_id" =>
                        $objectId,

                    "amount" =>
                        $amount,

                    "created_at" =>
                        $now
                ]
            );


            response(
                200,
                [

                    "success" =>
                        true,

                    "message" =>
                        "Deposit rejected successfully.",

                    "deposit_id" =>
                        $depositId
                ]
            );


        } catch (Throwable $e) {

            response(
                500,
                [
                    "success" => false,
                    "message" =>
                        "Unable to reject deposit."
                ]
            );
        }
    }
}


/* =========================================================
   FALLBACK
   ========================================================= */

response(
    400,
    [
        "success" => false,
        "message" =>
            "Invalid request."
    ]
);

?>