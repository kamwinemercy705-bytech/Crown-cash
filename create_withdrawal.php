<?php

/*
|--------------------------------------------------------------------------
| Crown Cash — Create Withdrawal API
|--------------------------------------------------------------------------
| Withdrawal flow:
|
| User submits withdrawal
|        ↓
| Balance is reserved
|        ↓
| Withdrawal saved as PENDING
|        ↓
| Admin reviews
|        ↓
| APPROVED or REJECTED
|
| IMPORTANT:
| This endpoint does NOT send money automatically.
|--------------------------------------------------------------------------
*/


/* =========================================================
   CORS
   ========================================================= */

header(
    "Access-Control-Allow-Origin: https://crown-cash.vercel.app"
);

header(
    "Access-Control-Allow-Methods: POST, OPTIONS"
);

header(
    "Access-Control-Allow-Headers: Content-Type"
);

header(
    "Access-Control-Allow-Credentials: true"
);

header(
    "Content-Type: application/json; charset=UTF-8"
);


/* =========================================================
   HANDLE PREFLIGHT REQUEST
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
   REQUEST METHOD
   ========================================================= */

if (
    $_SERVER["REQUEST_METHOD"] !== "POST"
) {

    http_response_code(405);

    echo json_encode([
        "success" => false,
        "message" => "Method not allowed."
    ]);

    exit;
}


/* =========================================================
   CHECK LOGIN
   ========================================================= */

if (
    empty($_SESSION["logged_in"]) ||
    empty($_SESSION["user_id"])
) {

    http_response_code(401);

    echo json_encode([
        "success" => false,
        "message" => "Please login first."
    ]);

    exit;
}


/* =========================================================
   MAIN PROCESS
   ========================================================= */

try {

    /* -----------------------------------------------------
       READ JSON
       ----------------------------------------------------- */

    $rawData =
        file_get_contents("php://input");

    $data =
        json_decode(
            $rawData,
            true
        );


    if (!is_array($data)) {

        http_response_code(400);

        echo json_encode([
            "success" => false,
            "message" => "Invalid withdrawal data."
        ]);

        exit;
    }


    /* -----------------------------------------------------
       GET FORM VALUES
       ----------------------------------------------------- */

    $amount =
        $data["amount"] ?? 0;

    $method =
        strtoupper(
            trim(
                $data["method"] ?? ""
            )
        );

    $account =
        trim(
            $data["account"] ?? ""
        );


    /* -----------------------------------------------------
       VALIDATE AMOUNT
       ----------------------------------------------------- */

    if (
        !is_numeric($amount)
    ) {

        http_response_code(400);

        echo json_encode([
            "success" => false,
            "message" => "Please enter a valid withdrawal amount."
        ]);

        exit;
    }


    /*
     * Convert to number.
     */

    $amount =
        (float)$amount;


    /*
     * Minimum withdrawal.
     */

    if (
        $amount < 1000
    ) {

        http_response_code(400);

        echo json_encode([
            "success" => false,
            "message" => "Minimum withdrawal amount is UGX 1,000."
        ]);

        exit;
    }


    /*
     * Only whole UGX amounts.
     */

    if (
        floor($amount) != $amount
    ) {

        http_response_code(400);

        echo json_encode([
            "success" => false,
            "message" => "Withdrawal amount must be a whole UGX amount."
        ]);

        exit;
    }


    /*
     * Maximum safety limit for one request.
     *
     * This can be changed later according
     * to the platform's final withdrawal policy.
     */

    if (
        $amount > 10000000
    ) {

        http_response_code(400);

        echo json_encode([
            "success" => false,
            "message" => "Maximum withdrawal per request is UGX 10,000,000."
        ]);

        exit;
    }


    /* -----------------------------------------------------
       VALIDATE PAYMENT METHOD
       ----------------------------------------------------- */

    $allowedMethods = [
        "MTN",
        "AIRTEL"
    ];


    if (
        !in_array(
            $method,
            $allowedMethods,
            true
        )
    ) {

        http_response_code(400);

        echo json_encode([
            "success" => false,
            "message" => "Please select MTN Mobile Money or Airtel Money."
        ]);

        exit;
    }


    /* -----------------------------------------------------
       NORMALIZE PHONE NUMBER
       ----------------------------------------------------- */

    /*
     * Accept:
     *
     * 07XXXXXXXX
     * +2567XXXXXXXX
     * 2567XXXXXXXX
     *
     * Store internally as:
     *
     * 07XXXXXXXX
     */

    $account =
        preg_replace(
            '/[\s\-()]/',
            '',
            $account
        );


    if (
        str_starts_with(
            $account,
            "+256"
        )
    ) {

        $account =
            "0" .
            substr(
                $account,
                4
            );

    } elseif (
        str_starts_with(
            $account,
            "256"
        )
    ) {

        $account =
            "0" .
            substr(
                $account,
                3
            );
    }


    /* -----------------------------------------------------
       VALIDATE UGANDA NUMBER
       ----------------------------------------------------- */

    if (
        !preg_match(
            '/^07[0-9]{8}$/',
            $account
        )
    ) {

        http_response_code(400);

        echo json_encode([
            "success" => false,
            "message" => "Please enter a valid Uganda mobile money number."
        ]);

        exit;
    }


    /* =====================================================
       USER ID
       ===================================================== */

    try {

        $userId =
            new MongoDB\BSON\ObjectId(
                $_SESSION["user_id"]
            );

    } catch (Throwable $e) {

        http_response_code(400);

        echo json_encode([
            "success" => false,
            "message" => "Invalid user session."
        ]);

        exit;
    }


    /* =====================================================
       GENERATE WITHDRAWAL REFERENCE
       ===================================================== */

    $reference =
        "CW-" .
        date("YmdHis") .
        "-" .
        strtoupper(
            substr(
                bin2hex(
                    random_bytes(4)
                ),
                0,
                8
            )
        );


    /* =====================================================
       ATOMICALLY RESERVE BALANCE
       ===================================================== */

    /*
     * IMPORTANT:
     *
     * We do NOT simply:
     *
     * 1. Read balance
     * 2. Check balance
     * 3. Deduct balance
     *
     * because two requests could arrive
     * at almost the same time.
     *
     * Instead MongoDB performs:
     *
     * balance >= requested amount
     *
     * AND
     *
     * balance = balance - requested amount
     *
     * as one atomic operation.
     */

    $balanceUpdate =
        $users->findOneAndUpdate(
            [
                "_id" => $userId,

                "status" => "active",

                "balance" => [
                    '$gte' => $amount
                ]
            ],
            [
                '$inc' => [
                    "balance" => -$amount
                ],

                '$set' => [
                    "updated_at" =>
                        new MongoDB\BSON\UTCDateTime()
                ]
            ],
            [
                "returnDocument" =>
                    MongoDB\Operation\FindOneAndUpdate::RETURN_DOCUMENT_AFTER
            ]
        );


    /* =====================================================
       CHECK BALANCE UPDATE
       ===================================================== */

    if (
        !$balanceUpdate
    ) {

        http_response_code(400);

        echo json_encode([
            "success" => false,
            "message" => "Insufficient available balance or inactive account."
        ]);

        exit;
    }


    /* =====================================================
       CREATE WITHDRAWAL RECORD
       ===================================================== */

    $withdrawal = [

        "user_id" =>
            $userId,

        "reference" =>
            $reference,

        "amount" =>
            $amount,

        "currency" =>
            "UGX",

        "method" =>
            $method,

        "account" =>
            $account,

        /*
         * Withdrawal starts pending.
         */

        "status" =>
            "pending",

        /*
         * Money has been reserved
         * from the user's available balance.
         */

        "balance_reserved" =>
            true,

        /*
         * No payout has happened yet.
         */

        "payout_sent" =>
            false,

        /*
         * Admin has not approved it yet.
         */

        "admin_approved" =>
            false,

        "created_at" =>
            new MongoDB\BSON\UTCDateTime(),

        "updated_at" =>
            new MongoDB\BSON\UTCDateTime()

    ];


    /* =====================================================
       SAVE WITHDRAWAL
       ===================================================== */

    try {

        $result =
            $transactions->insertOne(
                $withdrawal
            );

    } catch (Throwable $insertError) {

        /*
         * The withdrawal record failed to save.
         *
         * Restore the reserved balance so the
         * user does not lose money.
         */

        try {

            $users->updateOne(
                [
                    "_id" =>
                        $userId
                ],
                [
                    '$inc' => [
                        "balance" =>
                            $amount
                    ],

                    '$set' => [
                        "updated_at" =>
                            new MongoDB\BSON\UTCDateTime()
                    ]
                ]
            );

        } catch (Throwable $restoreError) {

            error_log(
                "CROWN CASH BALANCE RESTORE ERROR: " .
                $restoreError->getMessage()
            );
        }


        throw $insertError;
    }


    /* =====================================================
       RETURN SUCCESS
       ===================================================== */

    echo json_encode([

        "success" =>
            true,

        "message" =>
            "Withdrawal request submitted successfully and is pending admin review.",

        "withdrawal" => [

            "id" =>
                (string)
                $result->getInsertedId(),

            "reference" =>
                $reference,

            "amount" =>
                $amount,

            "currency" =>
                "UGX",

            "method" =>
                $method,

            "account" =>
                $account,

            "status" =>
                "pending",

            "balance_reserved" =>
                true

        ],

        "user" => [

            "id" =>
                (string)
                $balanceUpdate["_id"],

            "balance" =>
                $balanceUpdate["balance"] ?? 0

        ]

    ]);


} catch (Throwable $e) {

    /* =====================================================
       ERROR LOG
       ===================================================== */

    error_log(
        "CROWN CASH CREATE WITHDRAWAL ERROR: " .
        $e->getMessage()
    );


    /* =====================================================
       ERROR RESPONSE
       ===================================================== */

    http_response_code(500);

    echo json_encode([

        "success" =>
            false,

        "message" =>
            "Unable to create withdrawal request. Please try again."

    ]);

}

?>