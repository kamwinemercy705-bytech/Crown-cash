<?php

/*
|--------------------------------------------------------------------------
| Crown Cash — Create Withdrawal API
|--------------------------------------------------------------------------
|
| Flow:
|
| User submits withdrawal
|        ↓
| Amount is reserved from balance
|        ↓
| Withdrawal saved as PENDING
|        ↓
| Admin reviews
|        ↓
| APPROVED → amount remains deducted
| REJECTED → amount is returned
|
| IMPORTANT:
| This endpoint does NOT automatically send Mobile Money.
|
|--------------------------------------------------------------------------
*/

header("Access-Control-Allow-Origin: https://crown-cash.vercel.app");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");
header("Access-Control-Allow-Credentials: true");
header("Content-Type: application/json; charset=UTF-8");

header("Cache-Control: no-store, no-cache, must-revalidate, max-age=0");
header("Pragma: no-cache");


/*
|--------------------------------------------------------------------------
| OPTIONS REQUEST
|--------------------------------------------------------------------------
*/

if ($_SERVER["REQUEST_METHOD"] === "OPTIONS") {
    http_response_code(204);
    exit;
}


/*
|--------------------------------------------------------------------------
| SESSION
|--------------------------------------------------------------------------
*/

session_set_cookie_params([
    "lifetime" => 0,
    "path" => "/",
    "domain" => "",
    "secure" => true,
    "httponly" => true,
    "samesite" => "None"
]);

session_start();


/*
|--------------------------------------------------------------------------
| DATABASE
|--------------------------------------------------------------------------
*/

require_once __DIR__ . "/config.php";


/*
|--------------------------------------------------------------------------
| METHOD CHECK
|--------------------------------------------------------------------------
*/

if ($_SERVER["REQUEST_METHOD"] !== "POST") {

    http_response_code(405);

    echo json_encode([
        "success" => false,
        "message" => "Method not allowed."
    ]);

    exit;
}


/*
|--------------------------------------------------------------------------
| LOGIN CHECK
|--------------------------------------------------------------------------
*/

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


/*
|--------------------------------------------------------------------------
| MAIN PROCESS
|--------------------------------------------------------------------------
*/

try {

    /*
    |--------------------------------------------------------------------------
    | READ JSON
    |--------------------------------------------------------------------------
    */

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


    /*
    |--------------------------------------------------------------------------
    | GET VALUES
    |--------------------------------------------------------------------------
    */

    $amountInput =
        $data["amount"] ?? 0;


    $method =
        strtoupper(
            trim(
                (string)(
                    $data["method"] ?? ""
                )
            )
        );


    $account =
        trim(
            (string)(
                $data["account"] ?? ""
            )
        );


    /*
    |--------------------------------------------------------------------------
    | AMOUNT VALIDATION
    |--------------------------------------------------------------------------
    */

    if (
        $amountInput === "" ||
        !is_numeric($amountInput)
    ) {

        http_response_code(400);

        echo json_encode([
            "success" => false,
            "message" =>
                "Please enter a valid withdrawal amount."
        ]);

        exit;
    }


    $amount =
        (float)$amountInput;


    if ($amount < 1000) {

        http_response_code(400);

        echo json_encode([
            "success" => false,
            "message" =>
                "Minimum withdrawal amount is UGX 1,000."
        ]);

        exit;
    }


    if (floor($amount) != $amount) {

        http_response_code(400);

        echo json_encode([
            "success" => false,
            "message" =>
                "Withdrawal amount must be a whole UGX amount."
        ]);

        exit;
    }


    if ($amount > 10000000) {

        http_response_code(400);

        echo json_encode([
            "success" => false,
            "message" =>
                "Maximum withdrawal per request is UGX 10,000,000."
        ]);

        exit;
    }


    /*
    |--------------------------------------------------------------------------
    | PAYMENT METHOD VALIDATION
    |--------------------------------------------------------------------------
    */

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
            "message" =>
                "Please select MTN Mobile Money or Airtel Money."
        ]);

        exit;
    }


    /*
    |--------------------------------------------------------------------------
    | PHONE NUMBER CLEANUP
    |--------------------------------------------------------------------------
    */

    $account =
        preg_replace(
            '/[\s\-()]/',
            '',
            $account
        );


    /*
    |--------------------------------------------------------------------------
    | CONVERT INTERNATIONAL UGANDA NUMBER
    |--------------------------------------------------------------------------
    */

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


    /*
    |--------------------------------------------------------------------------
    | UGANDA NUMBER VALIDATION
    |--------------------------------------------------------------------------
    */

    if (
        !preg_match(
            '/^07[0-9]{8}$/',
            $account
        )
    ) {

        http_response_code(400);

        echo json_encode([
            "success" => false,
            "message" =>
                "Please enter a valid Uganda mobile money number."
        ]);

        exit;
    }


    /*
    |--------------------------------------------------------------------------
    | USER OBJECT ID
    |--------------------------------------------------------------------------
    */

    try {

        $userId =
            new MongoDB\BSON\ObjectId(
                $_SESSION["user_id"]
            );

    } catch (Throwable $e) {

        http_response_code(400);

        echo json_encode([
            "success" => false,
            "message" =>
                "Invalid user session."
        ]);

        exit;
    }


    /*
    |--------------------------------------------------------------------------
    | GENERATE UNIQUE WITHDRAWAL REFERENCE
    |--------------------------------------------------------------------------
    */

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


    /*
    |--------------------------------------------------------------------------
    | ATOMIC BALANCE RESERVATION
    |--------------------------------------------------------------------------
    |
    | The balance is reduced only when:
    |
    |   - The user exists
    |   - The account is active
    |   - The balance is sufficient
    |
    | MongoDB performs this atomically, helping prevent
    | two simultaneous withdrawals from spending the same balance.
    |
    */

    $balanceUpdate =
        $users->findOneAndUpdate(

            [
                "_id" =>
                    $userId,

                "status" =>
                    "active",

                "balance" => [
                    '$gte' =>
                        $amount
                ]
            ],

            [
                '$inc' => [
                    "balance" =>
                        -$amount
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


    /*
    |--------------------------------------------------------------------------
    | INSUFFICIENT BALANCE
    |--------------------------------------------------------------------------
    */

    if (!$balanceUpdate) {

        http_response_code(400);

        echo json_encode([
            "success" => false,
            "message" =>
                "Insufficient available balance or inactive account."
        ]);

        exit;
    }


    /*
    |--------------------------------------------------------------------------
    | CREATE WITHDRAWAL RECORD
    |--------------------------------------------------------------------------
    */

    $now =
        new MongoDB\BSON\UTCDateTime();


    $withdrawal = [

        /*
        |--------------------------------------------------------------------------
        | IMPORTANT TYPE FIELD
        |--------------------------------------------------------------------------
        */

        "type" =>
            "withdrawal",


        /*
        |--------------------------------------------------------------------------
        | USER
        |--------------------------------------------------------------------------
        */

        "user_id" =>
            $userId,


        /*
        |--------------------------------------------------------------------------
        | REFERENCE
        |--------------------------------------------------------------------------
        */

        "reference" =>
            $reference,


        /*
        |--------------------------------------------------------------------------
        | AMOUNT
        |--------------------------------------------------------------------------
        */

        "amount" =>
            $amount,


        "currency" =>
            "UGX",


        /*
        |--------------------------------------------------------------------------
        | PAYMENT DETAILS
        |--------------------------------------------------------------------------
        */

        "method" =>
            $method,


        "account" =>
            $account,


        /*
        |--------------------------------------------------------------------------
        | STATUS
        |--------------------------------------------------------------------------
        */

        "status" =>
            "pending",


        /*
        |--------------------------------------------------------------------------
        | BALANCE STATE
        |--------------------------------------------------------------------------
        */

        "balance_reserved" =>
            true,

        "balance_deducted" =>
            false,

        "balance_restored" =>
            false,


        /*
        |--------------------------------------------------------------------------
        | PAYOUT STATE
        |--------------------------------------------------------------------------
        */

        "payout_sent" =>
            false,


        /*
        |--------------------------------------------------------------------------
        | ADMIN STATE
        |--------------------------------------------------------------------------
        */

        "admin_approved" =>
            false,

        "admin_rejected" =>
            false,


        /*
        |--------------------------------------------------------------------------
        | ADMIN ACTION
        |--------------------------------------------------------------------------
        */

        "admin_id" =>
            null,

        "admin_email" =>
            "",

        "admin_action_at" =>
            null,


        /*
        |--------------------------------------------------------------------------
        | DATES
        |--------------------------------------------------------------------------
        */

        "created_at" =>
            $now,

        "updated_at" =>
            $now
    ];


    /*
    |--------------------------------------------------------------------------
    | SAVE WITHDRAWAL
    |--------------------------------------------------------------------------
    */

    try {

        $result =
            $transactions->insertOne(
                $withdrawal
            );

    } catch (Throwable $insertError) {

        /*
        |--------------------------------------------------------------------------
        | RESTORE BALANCE IF SAVING FAILED
        |--------------------------------------------------------------------------
        |
        | We already reserved the money.
        | If the transaction record cannot be created,
        | return the money to the user.
        |
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


    /*
    |--------------------------------------------------------------------------
    | SUCCESS RESPONSE
    |--------------------------------------------------------------------------
    */

    echo json_encode([

        "success" =>
            true,

        "message" =>
            "Withdrawal request submitted successfully and is pending admin review.",

        "withdrawal" => [

            "id" =>
                (string)(
                    $result->getInsertedId()
                ),

            "type" =>
                "withdrawal",

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
                (string)(
                    $balanceUpdate["_id"]
                ),

            "balance" =>
                (float)(
                    $balanceUpdate["balance"] ?? 0
                )

        ]

    ]);

} catch (Throwable $e) {

    /*
    |--------------------------------------------------------------------------
    | ERROR LOG
    |--------------------------------------------------------------------------
    */

    error_log(
        "CROWN CASH CREATE WITHDRAWAL ERROR: " .
        $e->getMessage()
    );


    /*
    |--------------------------------------------------------------------------
    | ERROR RESPONSE
    |--------------------------------------------------------------------------
    */

    http_response_code(500);

    echo json_encode([

        "success" =>
            false,

        "message" =>
            "Unable to create withdrawal request. Please try again."

    ]);
}

?>