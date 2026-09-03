<?php

/*
|--------------------------------------------------------------------------
| CROWN CASH — CREATE DEPOSIT API
|--------------------------------------------------------------------------
| Creates a pending deposit request.
|
| IMPORTANT:
| This endpoint does NOT automatically add money to the user's balance.
| The balance must only be credited after the payment provider confirms
| the transaction.
|--------------------------------------------------------------------------
*/

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
   HANDLE CORS PREFLIGHT
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
   LOGIN CHECK
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
   READ REQUEST DATA
========================================================= */

try {

    $rawData =
        file_get_contents("php://input");

    $data =
        json_decode(
            $rawData,
            true
        );


    if (
        !is_array($data)
    ) {

        http_response_code(400);

        echo json_encode([
            "success" => false,
            "message" => "Invalid deposit data."
        ]);

        exit;

    }


    /* =====================================================
       GET VALUES
    ===================================================== */

    $amount =
        (float) (
            $data["amount"] ?? 0
        );


    $phone =
        trim(
            $data["phone"] ?? ""
        );


    $paymentMethod =
        strtoupper(
            trim(
                $data["paymentMethod"] ?? ""
            )
        );


    /* =====================================================
       VALIDATE AMOUNT
    ===================================================== */

    if (
        $amount < 1000
    ) {

        http_response_code(400);

        echo json_encode([
            "success" => false,
            "message" =>
                "Minimum deposit is UGX 1,000."
        ]);

        exit;

    }


    if (
        $amount > 10000000
    ) {

        http_response_code(400);

        echo json_encode([
            "success" => false,
            "message" =>
                "Deposit amount is too large."
        ]);

        exit;

    }


    /*
     * Only allow whole UGX amounts.
     */

    if (
        floor($amount) !== $amount
    ) {

        http_response_code(400);

        echo json_encode([
            "success" => false,
            "message" =>
                "Deposit amount must be a whole UGX amount."
        ]);

        exit;

    }


    /* =====================================================
       VALIDATE PAYMENT METHOD
    ===================================================== */

    $allowedMethods = [
        "MTN",
        "AIRTEL"
    ];


    if (
        !in_array(
            $paymentMethod,
            $allowedMethods,
            true
        )
    ) {

        http_response_code(400);

        echo json_encode([
            "success" => false,
            "message" =>
                "Invalid payment method."
        ]);

        exit;

    }


    /* =====================================================
       NORMALIZE PHONE NUMBER
    ===================================================== */

    $phone =
        preg_replace(
            "/[\s\-]/",
            "",
            $phone
        );


    if (
        str_starts_with(
            $phone,
            "+256"
        )
    ) {

        $phone =
            "0" .
            substr(
                $phone,
                4
            );

    }


    if (
        str_starts_with(
            $phone,
            "256"
        )
    ) {

        $phone =
            "0" .
            substr(
                $phone,
                3
            );

    }


    /* =====================================================
       VALIDATE UGANDA PHONE
    ===================================================== */

    if (
        !preg_match(
            "/^07[0-9]{8}$/",
            $phone
        )
    ) {

        http_response_code(400);

        echo json_encode([
            "success" => false,
            "message" =>
                "Enter a valid Uganda mobile-money number."
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

    } catch (
        Throwable $e
    ) {

        http_response_code(400);

        echo json_encode([
            "success" => false,
            "message" =>
                "Invalid user session."
        ]);

        exit;

    }


    /* =====================================================
       FIND USER
    ===================================================== */

    $user =
        $users->findOne([
            "_id" => $userId
        ]);


    if (
        !$user
    ) {

        http_response_code(404);

        echo json_encode([
            "success" => false,
            "message" =>
                "User account was not found."
        ]);

        exit;

    }


    /* =====================================================
       CREATE UNIQUE REFERENCE
    ===================================================== */

    $depositReference =
        "CC-" .
        strtoupper(
            bin2hex(
                random_bytes(5)
            )
        );


    /* =====================================================
       CREATE DEPOSIT
    ===================================================== */

    $deposit = [

        "user_id" =>
            $userId,

        "reference" =>
            $depositReference,

        "amount" =>
            $amount,

        "currency" =>
            "UGX",

        "phone" =>
            $phone,

        "payment_method" =>
            $paymentMethod,

        "status" =>
            "pending",

        "payment_status" =>
            "pending",

        "balance_credited" =>
            false,

        "type" =>
            "deposit",

        "created_at" =>
            new MongoDB\BSON\UTCDateTime(),

        "updated_at" =>
            new MongoDB\BSON\UTCDateTime()

    ];


    /* =====================================================
       SAVE DEPOSIT
    ===================================================== */

    $result =
        $transactions->insertOne(
            $deposit
        );


    /* =====================================================
       RESPONSE
    ===================================================== */

    echo json_encode([

        "success" =>
            true,

        "message" =>
            "Deposit request created. Complete the payment when prompted. Your balance will be updated after payment verification.",

        "deposit" => [

            "id" =>
                (string)
                $result->getInsertedId(),

            "reference" =>
                $depositReference,

            "amount" =>
                $amount,

            "currency" =>
                "UGX",

            "phone" =>
                $phone,

            "paymentMethod" =>
                $paymentMethod,

            "status" =>
                "pending"

        ],

        "user" => [

            "id" =>
                (string)
                $user["_id"],

            "firstName" =>
                $user["firstName"] ?? "",

            "lastName" =>
                $user["lastName"] ?? "",

            "email" =>
                $user["email"] ?? "",

            "phone" =>
                $user["phone"] ?? "",

            "referralCode" =>
                $user["referralCode"] ?? "",

            "balance" =>
                $user["balance"] ?? 0

        ]

    ]);

} catch (
    Throwable $e
) {

    error_log(
        "CROWN CASH CREATE DEPOSIT ERROR: " .
        $e->getMessage()
    );


    http_response_code(500);


    echo json_encode([

        "success" =>
            false,

        "message" =>
            "Unable to create deposit request."

    ]);

}

?>