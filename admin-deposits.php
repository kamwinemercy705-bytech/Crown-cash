<?php

declare(strict_types=1);


/* =========================================================
   CROWN CASH - ADMIN DEPOSITS API
========================================================= */


/* =========================================================
   CORS
========================================================= */

header(
    "Content-Type: application/json; charset=utf-8"
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
   HELPERS
========================================================= */

function jsonResponse(
    array $data,
    int $status = 200
): void {

    http_response_code(
        $status
    );

    echo json_encode(
        $data,
        JSON_UNESCAPED_SLASHES
    );

    exit;

}


function mongoNumberToFloat(
    $value
): float {

    if (
        $value instanceof MongoDB\BSON\Decimal128
    ) {

        return (float)
            $value->__toString();

    }


    if (
        $value instanceof MongoDB\BSON\Int64
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
    $value
): string {

    if (
        $value instanceof MongoDB\BSON\UTCDateTime
    ) {

        return $value
            ->toDateTime()
            ->format("c");

    }


    if (
        $value instanceof DateTimeInterface
    ) {

        return $value
            ->format("c");

    }


    if (
        is_string($value) &&
        trim($value) !== ""
    ) {

        return $value;

    }


    return "";

}


function normalizeStatus(
    $value
): string {

    $status =
        strtolower(
            trim(
                (string)$value
            )
        );


    return $status !== ""
        ? $status
        : "pending";

}


function normalizeMethod(
    $value
): string {

    $method =
        strtolower(
            trim(
                (string)$value
            )
        );


    if (
        str_contains(
            $method,
            "mtn"
        )
    ) {

        return "mtn";

    }


    if (
        str_contains(
            $method,
            "airtel"
        )
    ) {

        return "airtel";

    }


    return $method;

}


function findUserById(
    $users,
    string $userId
) {

    $userId =
        trim($userId);


    if (
        $userId === ""
    ) {

        return null;

    }


    $conditions = [];


    $conditions[] = [
        "_id" => $userId
    ];


    try {

        if (
            preg_match(
                '/^[a-f0-9]{24}$/i',
                $userId
            )
        ) {

            $conditions[] = [
                "_id" =>
                    new MongoDB\BSON\ObjectId(
                        $userId
                    )
            ];

        }

    } catch (
        Throwable $e
    ) {
        // Continue with string ID.
    }


    return $users->findOne([
        '$or' => $conditions
    ]);

}


function sameIdentity(
    string $a,
    string $b
): bool {

    $a =
        strtolower(
            trim($a)
        );

    $b =
        strtolower(
            trim($b)
        );


    if (
        $a === "" ||
        $b === ""
    ) {

        return false;

    }


    return $a === $b;

}


/* =========================================================
   ADMIN AUTHORIZATION
========================================================= */

function authorizeAdmin(
    $users
) {

    if (
        !isset(
            $_SESSION["logged_in"]
        ) ||
        $_SESSION["logged_in"] !== true
    ) {

        jsonResponse(
            [
                "success" => false,
                "message" =>
                    "Please login as administrator."
            ],
            401
        );

    }


    $sessionUserId =
        trim(
            (string)(
                $_SESSION["user_id"] ??
                ""
            )
        );


    if (
        $sessionUserId === ""
    ) {

        jsonResponse(
            [
                "success" => false,
                "message" =>
                    "Administrator session is invalid."
            ],
            401
        );

    }


    $adminUserId =
        trim(
            (string)(
                getenv("ADMIN_USER_ID") ?: ""
            )
        );


    $adminEmail =
        strtolower(
            trim(
                (string)(
                    getenv("ADMIN_EMAIL") ?: ""
                )
            )
        );


    if (
        $adminUserId === "" &&
        $adminEmail === ""
    ) {

        jsonResponse(
            [
                "success" => false,
                "message" =>
                    "Administrator identity is not configured."
            ],
            500
        );

    }


    $adminUser =
        findUserById(
            $users,
            $sessionUserId
        );


    if (!$adminUser) {

        jsonResponse(
            [
                "success" => false,
                "message" =>
                    "Administrator account could not be found."
            ],
            401
        );

    }


    $status =
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
            $status,
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
        $role === "admin" ||
        $role === "administrator" ||
        $accountType === "admin" ||
        $accountType === "administrator";


    if (!$isAdmin) {

        jsonResponse(
            [
                "success" => false,
                "message" =>
                    "Administrator access denied."
            ],
            403
        );

    }


    /*
     * ADMIN_USER_ID is the strongest identity check.
     */

    if (
        $adminUserId !== "" &&
        !sameIdentity(
            $sessionUserId,
            $adminUserId
        )
    ) {

        /*
         * Also compare against the actual
         * MongoDB _id of the account.
         */

        $actualId = "";


        if (
            isset(
                $adminUser["_id"]
            )
        ) {

            $actualId =
                (string)
                $adminUser["_id"];

        }


        if (
            !sameIdentity(
                $actualId,
                $adminUserId
            )
        ) {

            jsonResponse(
                [
                    "success" => false,
                    "message" =>
                        "Administrator identity verification failed."
                ],
                403
            );

        }

    }


    /*
     * If ADMIN_USER_ID is not configured,
     * use ADMIN_EMAIL.
     */

    if (
        $adminUserId === "" &&
        $adminEmail !== ""
    ) {

        $userEmail =
            strtolower(
                trim(
                    (string)(
                        $adminUser["email"] ??
                        ""
                    )
                )
            );


        if (
            $userEmail !== $adminEmail
        ) {

            jsonResponse(
                [
                    "success" => false,
                    "message" =>
                        "Administrator email verification failed."
                ],
                403
            );

        }

    }


    return $adminUser;

}


/* =========================================================
   METHOD
========================================================= */

$method =
    strtoupper(
        $_SERVER["REQUEST_METHOD"] ??
        "GET"
    );


if (
    !in_array(
        $method,
        ["GET", "POST"],
        true
    )
) {

    jsonResponse(
        [
            "success" => false,
            "message" =>
                "Method not allowed."
        ],
        405
    );

}


/* =========================================================
   DATABASE
========================================================= */

try {

    require_once __DIR__ . "/config.php";

} catch (
    Throwable $e
) {

    jsonResponse(
        [
            "success" => false,
            "message" =>
                "Database configuration could not be loaded."
        ],
        500
    );

}


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


    $adminUser =
        authorizeAdmin(
            $users
        );


} catch (
    MongoDB\Driver\Exception\Exception $e
) {

    error_log(
        "Admin deposits MongoDB authorization error: " .
        $e->getMessage()
    );

    jsonResponse(
        [
            "success" => false,
            "message" =>
                "Database error."
        ],
        500
    );

} catch (
    Throwable $e
) {

    error_log(
        "Admin deposits authorization error: " .
        $e->getMessage()
    );

    jsonResponse(
        [
            "success" => false,
            "message" =>
                "Unable to verify administrator access."
        ],
        500
    );

}


/* =========================================================
   GET - LIST DEPOSITS
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
                        "created_at" => -1
                    ]
                ]
            );


        $depositList = [];


        $totalDeposits = 0.0;
        $pendingDeposits = 0.0;
        $approvedDeposits = 0.0;
        $rejectedDeposits = 0.0;


        foreach (
            $cursor as $deposit
        ) {

            $status =
                normalizeStatus(
                    $deposit["status"] ??
                    "pending"
                );


            $amount =
                mongoNumberToFloat(
                    $deposit["amount"] ??
                    0
                );


            $user = null;


            $userId =
                (string)(
                    $deposit["user_id"] ??
                    $deposit["userId"] ??
                    ""
                );


            if (
                $userId !== ""
            ) {

                $user =
                    findUserById(
                        $users,
                        $userId
                    );

            }


            $fullName =
                trim(
                    (string)(
                        $deposit["full_name"] ??
                        $deposit["user_name"] ??
                        $deposit["customer_name"] ??
                        ""
                    )
                );


            if (
                $fullName === "" &&
                $user
            ) {

                $fullName =
                    trim(
                        (string)(
                            $user["full_name"] ??
                            ""
                        )
                    );

            }


            if (
                $fullName === "" &&
                $user
            ) {

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
                    "Customer";

            }


            $phone =
                (string)(
                    $deposit["phone"] ??
                    $deposit["phone_number"] ??
                    $deposit["mobile"] ??
                    (
                        $user["phone"] ??
                        $user["phone_number"] ??
                        $user["mobile"] ??
                        ""
                    )
                );


            $email =
                (string)(
                    $deposit["email"] ??
                    (
                        $user["email"] ??
                        ""
                    )
                );


            $reference =
                (string)(
                    $deposit["transaction_reference"] ??
                    $deposit["reference"] ??
                    $deposit["payment_reference"] ??
                    $deposit["transaction_id"] ??
                    ""
                );


            $paymentMethod =
                normalizeMethod(
                    $deposit["payment_method"] ??
                    $deposit["method"] ??
                    ""
                );


            $depositId =
                isset(
                    $deposit["_id"]
                )
                    ? (string)
                        $deposit["_id"]
                    : "";


            $createdAt =
                formatDateValue(
                    $deposit["created_at"] ??
                    $deposit["date"] ??
                    null
                );


            $updatedAt =
                formatDateValue(
                    $deposit["updated_at"] ??
                    null
                );


            /*
             * Statistics
             */

            $totalDeposits +=
                $amount;


            if (
                $status === "pending"
            ) {

                $pendingDeposits +=
                    $amount;

            } elseif (
                $status === "approved"
            ) {

                $approvedDeposits +=
                    $amount;

            } elseif (
                $status === "rejected"
            ) {

                $rejectedDeposits +=
                    $amount;

            }


            $depositList[] = [

                "id" =>
                    $depositId,

                "_id" =>
                    $depositId,

                "user_id" =>
                    $userId,

                "full_name" =>
                    $fullName,

                "user_name" =>
                    $fullName,

                "email" =>
                    $email,

                "phone" =>
                    $phone,

                "amount" =>
                    $amount,

                "payment_method" =>
                    $paymentMethod,

                "method" =>
                    $paymentMethod,

                "transaction_reference" =>
                    $reference,

                "reference" =>
                    $reference,

                "status" =>
                    $status,

                "created_at" =>
                    $createdAt,

                "updated_at" =>
                    $updatedAt,

                "payment_verified" =>
                    (bool)(
                        $deposit["payment_verified"] ??
                        false
                    ),

                "approved_at" =>
                    formatDateValue(
                        $deposit["approved_at"] ??
                        null
                    ),

                "rejected_at" =>
                    formatDateValue(
                        $deposit["rejected_at"] ??
                        null
                    )

            ];

        }


        jsonResponse(
            [

                "success" =>
                    true,

                "deposits" =>
                    $depositList,

                "stats" => [

                    "total_deposits" =>
                        $totalDeposits,

                    "pending_deposits" =>
                        $pendingDeposits,

                    "approved_deposits" =>
                        $approvedDeposits,

                    "rejected_deposits" =>
                        $rejectedDeposits

                ],

                "total" =>
                    count(
                        $depositList
                    )

            ]
        );


    } catch (
        MongoDB\Driver\Exception\Exception $e
    ) {

        error_log(
            "Admin deposits GET error: " .
            $e->getMessage()
        );


        jsonResponse(
            [
                "success" => false,
                "message" =>
                    "Unable to load deposits."
            ],
            500
        );

    } catch (
        Throwable $e
    ) {

        error_log(
            "Admin deposits GET error: " .
            $e->getMessage()
        );


        jsonResponse(
            [
                "success" => false,
                "message" =>
                    "Unable to load deposit records."
            ],
            500
        );

    }

}


/* =========================================================
   POST - APPROVE / REJECT
========================================================= */

$rawInput =
    file_get_contents(
        "php://input"
    );


$data = json_decode(
    $rawInput ?: "{}",
    true
);


if (
    !is_array($data)
) {

    $data = $_POST;

}


$depositId =
    trim(
        (string)(
            $data["deposit_id"] ??
            $data["id"] ??
            ""
        )
    );


$action =
    strtolower(
        trim(
            (string)(
                $data["action"] ??
                ""
            )
        )
    );


$paymentVerified =
    filter_var(
        $data["payment_verified"] ??
        false,
        FILTER_VALIDATE_BOOLEAN
    );


if (
    $depositId === ""
) {

    jsonResponse(
        [
            "success" => false,
            "message" =>
                "Deposit ID is required."
        ],
        400
    );

}


if (
    !in_array(
        $action,
        ["approve", "reject"],
        true
    )
) {

    jsonResponse(
        [
            "success" => false,
            "message" =>
                "Invalid deposit action."
        ],
        400
    );

}


/* =========================================================
   FIND DEPOSIT
========================================================= */

try {

    $depositConditions = [];


    $depositConditions[] = [
        "_id" => $depositId
    ];


    if (
        preg_match(
            '/^[a-f0-9]{24}$/i',
            $depositId
        )
    ) {

        $depositConditions[] = [
            "_id" =>
                new MongoDB\BSON\ObjectId(
                    $depositId
                )
        ];

    }


    $deposit =
        $deposits->findOne(
            [
                '$or' =>
                    $depositConditions
            ]
        );


    if (!$deposit) {

        jsonResponse(
            [
                "success" => false,
                "message" =>
                    "Deposit record was not found."
            ],
            404
        );

    }


    $currentStatus =
        normalizeStatus(
            $deposit["status"] ??
            "pending"
        );


    if (
        $currentStatus !== "pending"
    ) {

        jsonResponse(
            [
                "success" => false,
                "message" =>
                    "This deposit has already been processed."
            ],
            409
        );

    }


    /*
     * Approval MUST include payment verification.
     */

    if (
        $action === "approve" &&
        !$paymentVerified
    ) {

        jsonResponse(
            [
                "success" => false,
                "message" =>
                    "Payment verification is required before approval."
            ],
            400
        );

    }


    /*
     * Resolve customer.
     */

    $userId =
        (string)(
            $deposit["user_id"] ??
            $deposit["userId"] ??
            ""
        );


    if (
        $userId === ""
    ) {

        jsonResponse(
            [
                "success" => false,
                "message" =>
                    "This deposit is not linked to a customer account."
            ],
            400
        );

    }


    $customer =
        findUserById(
            $users,
            $userId
        );


    if (!$customer) {

        jsonResponse(
            [
                "success" => false,
                "message" =>
                    "Customer account linked to this deposit was not found."
            ],
            404
        );

    }


    $amount =
        mongoNumberToFloat(
            $deposit["amount"] ??
            0
        );


    if (
        $amount <= 0
    ) {

        jsonResponse(
            [
                "success" => false,
                "message" =>
                    "Invalid deposit amount."
            ],
            400
        );

    }


    $now =
        new MongoDB\BSON\UTCDateTime();


    /* =====================================================
       APPROVE
    ===================================================== */

    if (
        $action === "approve"
    ) {

        /*
         * Atomic update:
         *
         * pending -> approved
         *
         * and balance is credited only once.
         */

        $result =
            $deposits->findOneAndUpdate(
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

                        "approved_by" =>
                            (
                                $adminUser["_id"] ??
                                (
                                    $_SESSION["user_id"] ??
                                    ""
                                )
                            ),

                        "approved_at" =>
                            $now,

                        "updated_at" =>
                            $now

                    ]
                ],
                [
                    "returnDocument" =>
                        MongoDB\Operation\FindOneAndUpdate::RETURN_DOCUMENT_AFTER
                ]
            );


        if (!$result) {

            jsonResponse(
                [
                    "success" => false,
                    "message" =>
                        "This deposit was already processed or could not be approved."
                ],
                409
            );

        }


        /*
         * Credit the user's balance.
         *
         * Use a numeric amount matching the
         * existing Crown Cash balance structure.
         */

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
                    ],

                    '$set' => [
                        "updated_at" =>
                            $now
                    ]
                ]
            );


        /*
         * If wallet_balance does not exist or the
         * project uses only balance, the primary
         * balance is still updated.
         */

        if (
            $balanceUpdate->getModifiedCount() === 0
        ) {

            $users->updateOne(
                [
                    "_id" =>
                        $customer["_id"]
                ],
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

        }


        /*
         * Transaction record.
         */

        $transactions->insertOne(
            [

                "user_id" =>
                    $customer["_id"],

                "type" =>
                    "deposit",

                "transaction_type" =>
                    "deposit",

                "amount" =>
                    $amount,

                "status" =>
                    "completed",

                "reference" =>
                    (string)(
                        $deposit["transaction_reference"] ??
                        $deposit["reference"] ??
                        ""
                    ),

                "description" =>
                    "Deposit approved by administrator.",

                "deposit_id" =>
                    $deposit["_id"],

                "created_at" =>
                    $now,

                "updated_at" =>
                    $now

            ]
        );


        /*
         * Audit log.
         */

        $auditLogs->insertOne(
            [

                "action" =>
                    "admin_deposit_approved",

                "admin_user_id" =>
                    (
                        $adminUser["_id"] ??
                        (
                            $_SESSION["user_id"] ??
                            ""
                        )
                    ),

                "target_user_id" =>
                    $customer["_id"],

                "deposit_id" =>
                    $deposit["_id"],

                "amount" =>
                    $amount,

                "payment_verified" =>
                    true,

                "created_at" =>
                    $now

            ]
        );


        jsonResponse(
            [

                "success" =>
                    true,

                "message" =>
                    "Deposit approved successfully. Customer balance has been credited.",

                "deposit" => [

                    "id" =>
                        (string)$result["_id"],

                    "status" =>
                        "approved",

                    "amount" =>
                        $amount

                ]

            ]
        );

    }


    /* =====================================================
       REJECT
    ===================================================== */

    $result =
        $deposits->findOneAndUpdate(
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

                    "payment_verified" =>
                        false,

                    "rejected_by" =>
                        (
                            $adminUser["_id"] ??
                            (
                                $_SESSION["user_id"] ??
                                ""
                            )
                        ),

                    "rejected_at" =>
                        $now,

                    "updated_at" =>
                        $now

                ]
            ],
            [
                "returnDocument" =>
                    MongoDB\Operation\FindOneAndUpdate::RETURN_DOCUMENT_AFTER
            ]
        );


    if (!$result) {

        jsonResponse(
            [
                "success" => false,
                "message" =>
                    "This deposit was already processed or could not be rejected."
            ],
            409
        );

    }


    /*
     * Transaction history for rejection.
     */

    $transactions->insertOne(
        [

            "user_id" =>
                $customer["_id"],

            "type" =>
                "deposit",

            "transaction_type" =>
                "deposit",

            "amount" =>
                $amount,

            "status" =>
                "rejected",

            "reference" =>
                (string)(
                    $deposit["transaction_reference"] ??
                    $deposit["reference"] ??
                    ""
                ),

            "description" =>
                "Deposit rejected by administrator.",

            "deposit_id" =>
                $deposit["_id"],

            "created_at" =>
                $now,

            "updated_at" =>
                $now

        ]
    );


    /*
     * Audit log.
     */

    $auditLogs->insertOne(
        [

            "action" =>
                "admin_deposit_rejected",

            "admin_user_id" =>
                (
                    $adminUser["_id"] ??
                    (
                        $_SESSION["user_id"] ??
                        ""
                    )
                ),

            "target_user_id" =>
                $customer["_id"],

            "deposit_id" =>
                $deposit["_id"],

            "amount" =>
                $amount,

            "payment_verified" =>
                false,

            "created_at" =>
                $now

        ]
    );


    jsonResponse(
        [

            "success" =>
                true,

            "message" =>
                "Deposit rejected successfully.",

            "deposit" => [

                "id" =>
                    (string)$result["_id"],

                "status" =>
                    "rejected",

                "amount" =>
                    $amount

            ]

        ]
    );


} catch (
    MongoDB\Driver\Exception\Exception $e
) {

    error_log(
        "Admin deposit action MongoDB error: " .
        $e->getMessage()
    );


    jsonResponse(
        [
            "success" => false,
            "message" =>
                "Database error while processing the deposit."
        ],
        500
    );

} catch (
    Throwable $e
) {

    error_log(
        "Admin deposit action error: " .
        $e->getMessage()
    );


    jsonResponse(
        [
            "success" => false,
            "message" =>
                "Unable to process this deposit."
        ],
        500
    );

}
?>