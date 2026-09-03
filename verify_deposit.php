<?php

/*
|--------------------------------------------------------------------------
| CROWN CASH — VERIFY DEPOSIT API
|--------------------------------------------------------------------------
|
| IMPORTANT:
| This endpoint is designed for controlled verification/testing.
|
| It does NOT trust the frontend to confirm a payment.
| A deposit is credited only when this endpoint receives an
| authorized verification request.
|
| For LIVE MTN/Airtel integration, the provider's official
| callback/API verification must call this endpoint after
| the payment has actually been confirmed.
|
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
    "Access-Control-Allow-Headers: Content-Type, X-Verification-Key"
);

header(
    "Access-Control-Allow-Credentials: true"
);

header(
    "Content-Type: application/json; charset=UTF-8"
);


/* =========================================================
   HANDLE PREFLIGHT
========================================================= */

if (
    $_SERVER["REQUEST_METHOD"] === "OPTIONS"
) {

    http_response_code(204);

    exit;

}


/* =========================================================
   ONLY POST ALLOWED
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
   DATABASE
========================================================= */

require_once __DIR__ . "/config.php";


/* =========================================================
   READ REQUEST
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
            "message" => "Invalid verification data."
        ]);

        exit;

    }


    /* =====================================================
       GET VALUES
    ===================================================== */

    $reference =
        trim(
            $data["reference"] ?? ""
        );


    $providerTransactionId =
        trim(
            $data["providerTransactionId"] ?? ""
        );


    $verificationStatus =
        strtolower(
            trim(
                $data["verificationStatus"] ?? ""
            )
        );


    /* =====================================================
       VALIDATE REFERENCE
    ===================================================== */

    if (
        $reference === ""
    ) {

        http_response_code(400);

        echo json_encode([
            "success" => false,
            "message" => "Deposit reference is required."
        ]);

        exit;

    }


    /* =====================================================
       VALIDATE STATUS
    ===================================================== */

    $allowedStatuses = [
        "verified",
        "failed"
    ];


    if (
        !in_array(
            $verificationStatus,
            $allowedStatuses,
            true
        )
    ) {

        http_response_code(400);

        echo json_encode([
            "success" => false,
            "message" =>
                "Invalid verification status."
        ]);

        exit;

    }


    /* =====================================================
       FIND DEPOSIT
    ===================================================== */

    $deposit =
        $transactions->findOne([
            "reference" => $reference,
            "type" => "deposit"
        ]);


    if (
        !$deposit
    ) {

        http_response_code(404);

        echo json_encode([
            "success" => false,
            "message" =>
                "Deposit transaction was not found."
        ]);

        exit;

    }


    /* =====================================================
       PREVENT DOUBLE CREDIT
    ===================================================== */

    if (
        ($deposit["balance_credited"] ?? false)
        === true
    ) {

        echo json_encode([

            "success" =>
                true,

            "message" =>
                "This deposit has already been credited.",

            "reference" =>
                $reference,

            "status" =>
                $deposit["status"] ?? "completed",

            "balanceCredited" =>
                true

        ]);

        exit;

    }


    /* =====================================================
       CHECK CURRENT STATUS
    ===================================================== */

    $currentStatus =
        strtolower(
            $deposit["status"] ?? "pending"
        );


    if (
        $currentStatus === "completed"
    ) {

        echo json_encode([

            "success" =>
                true,

            "message" =>
                "This deposit is already completed.",

            "reference" =>
                $reference,

            "status" =>
                "completed"

        ]);

        exit;

    }


    /* =====================================================
       FAILED PAYMENT
    ===================================================== */

    if (
        $verificationStatus === "failed"
    ) {

        $transactions->updateOne(

            [
                "_id" =>
                    $deposit["_id"]
            ],

            [
                '$set' => [

                    "status" =>
                        "failed",

                    "payment_status" =>
                        "failed",

                    "balance_credited" =>
                        false,

                    "provider_transaction_id" =>
                        $providerTransactionId,

                    "updated_at" =>
                        new MongoDB\BSON\UTCDateTime()

                ]

            ]

        );


        echo json_encode([

            "success" =>
                true,

            "message" =>
                "Payment marked as failed.",

            "reference" =>
                $reference,

            "status" =>
                "failed",

            "balanceCredited" =>
                false

        ]);

        exit;

    }


    /* =====================================================
       VERIFIED PAYMENT
    ===================================================== */

    if (
        $verificationStatus === "verified"
    ) {


        /* =================================================
           GET USER ID
        ================================================= */

        if (
            !isset(
                $deposit["user_id"]
            )
        ) {

            http_response_code(500);

            echo json_encode([
                "success" => false,
                "message" =>
                    "Deposit has no user account."
            ]);

            exit;

        }


        $userId =
            $deposit["user_id"];


        /* =================================================
           FIND USER
        ================================================= */

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


        /* =================================================
           DEPOSIT AMOUNT
        ================================================= */

        $depositAmount =
            (float)(
                $deposit["amount"] ?? 0
            );


        if (
            $depositAmount <= 0
        ) {

            http_response_code(400);

            echo json_encode([
                "success" => false,
                "message" =>
                    "Invalid deposit amount."
            ]);

            exit;

        }


        /* =================================================
           CURRENT BALANCE
        ================================================= */

        $currentBalance =
            (float)(
                $user["balance"] ?? 0
            );


        /* =================================================
           NEW BALANCE
        ================================================= */

        $newBalance =
            $currentBalance +
            $depositAmount;


        /* =================================================
           UPDATE USER BALANCE
        ================================================= */

        $users->updateOne(

            [
                "_id" =>
                    $userId
            ],

            [
                '$set' => [

                    "balance" =>
                        $newBalance,

                    "updated_at" =>
                        new MongoDB\BSON\UTCDateTime()

                ]

            ]

        );


        /* =================================================
           UPDATE DEPOSIT
        ================================================= */

        $transactions->updateOne(

            [
                "_id" =>
                    $deposit["_id"]
            ],

            [
                '$set' => [

                    "status" =>
                        "completed",

                    "payment_status" =>
                        "verified",

                    "balance_credited" =>
                        true,

                    "provider_transaction_id" =>
                        $providerTransactionId,

                    "verified_at" =>
                        new MongoDB\BSON\UTCDateTime(),

                    "updated_at" =>
                        new MongoDB\BSON\UTCDateTime()

                ]

            ]

        );


        /* =================================================
           RESPONSE
        ================================================= */

        echo json_encode([

            "success" =>
                true,

            "message" =>
                "Deposit verified and balance credited.",

            "deposit" => [

                "reference" =>
                    $reference,

                "amount" =>
                    $depositAmount,

                "currency" =>
                    "UGX",

                "status" =>
                    "completed",

                "balanceCredited" =>
                    true

            ],

            "user" => [

                "id" =>
                    (string)
                    $user["_id"],

                "balance" =>
                    $newBalance

            ]

        ]);

        exit;

    }


} catch (
    Throwable $e
) {


    /* =====================================================
       LOG SERVER ERROR
    ===================================================== */

    error_log(
        "CROWN CASH VERIFY DEPOSIT ERROR: " .
        $e->getMessage()
    );


    http_response_code(500);


    echo json_encode([

        "success" =>
            false,

        "message" =>
            "Unable to verify deposit."

    ]);

    exit;

}

?>