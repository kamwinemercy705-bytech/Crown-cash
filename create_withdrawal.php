<?php

/*
|--------------------------------------------------------------------------
| Crown Cash — Create Withdrawal API
|--------------------------------------------------------------------------
| 
| This endpoint creates a PENDING withdrawal request.
|
| Important:
| - It does NOT send Mobile Money.
| - It does NOT approve the withdrawal.
| - It reserves the requested amount by deducting it from balance.
| - If an admin rejects the request, the amount must be restored.
| - If an admin approves it, the deducted amount remains reserved.
|
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


/*
|--------------------------------------------------------------------------
| CORS PREFLIGHT
|--------------------------------------------------------------------------
*/

if (
    $_SERVER["REQUEST_METHOD"] === "OPTIONS"
) {

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
| METHOD
|--------------------------------------------------------------------------
*/

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
| PROCESS
|--------------------------------------------------------------------------
*/

try {

    /*
    |--------------------------------------------------------------------------
    | READ REQUEST
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
    | INPUTS
    |--------------------------------------------------------------------------
    */

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


    /*
    |--------------------------------------------------------------------------
    | AMOUNT VALIDATION
    |--------------------------------------------------------------------------
    */

    if (
        $amount < 1000
    ) {

        http_response_code(400);

        echo json_encode([
            "success" => false,
            "message" =>
                "Minimum withdrawal is UGX 1,000."
        ]);

        exit;
    }


    if (
        floor($amount) !== $amount
    ) {

        http_response_code(400);

        echo json_encode([
            "success" => false,
            "message" =>
                "Withdrawal amount must be a whole UGX amount."
        ]);

        exit;
    }


    /*
    |--------------------------------------------------------------------------
    | MAXIMUM SAFETY LIMIT
    |--------------------------------------------------------------------------
    */

    if (
        $amount > 10000000
    ) {

        http_response_code(400);

        echo json_encode([
            "success" => false,
            "message" =>
                "Maximum withdrawal for this request is UGX 10,000,000."
        ]);

        exit;
    }


    /*
    |--------------------------------------------------------------------------
    | PAYMENT METHOD
    |--------------------------------------------------------------------------
    */

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
                "Invalid withdrawal method."
        ]);

        exit;
    }


    /*
    |--------------------------------------------------------------------------
    | NORMALIZE PHONE
    |--------------------------------------------------------------------------
    */

    $phone =
        preg_replace(
            '/\s+/',
            '',
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

    } elseif (
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


    /*
    |--------------------------------------------------------------------------
    | UGANDA PHONE VALIDATION
    |--------------------------------------------------------------------------
    */

    if (
        !preg_match(
            '/^07[0-9]{8}$/',
            $phone
        )
    ) {

        http_response_code(400);

        echo json_encode([
            "success" => false,
            "message" =>
                "Invalid Ugandan Mobile Money number."
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
    | FIND USER
    |--------------------------------------------------------------------------
    */

    $user =
        $users->findOne([
            "_id" => $userId
        ]);


    if (!$user) {

        http_response_code(404);

        echo json_encode([
            "success" => false,
            "message" =>
                "User account not found."
        ]);

        exit;
    }


    /*
    |--------------------------------------------------------------------------
    | UNIQUE WITHDRAWAL REFERENCE
    |--------------------------------------------------------------------------
    */

    $reference =
        "CW-" .
        strtoupper(
            bin2hex(
                random_bytes(5)
            )
        );


    /*
    |--------------------------------------------------------------------------
    | ATOMIC BALANCE RESERVATION
    |--------------------------------------------------------------------------
    |
    | We deduct the amount only if the user's current balance
    | is sufficient.
    |
    | This prevents two simultaneous withdrawal requests from
    | spending the same balance.
    |
    */

    $balanceBefore =
        (float) (
            $user["balance"] ?? 0
        );


    if (
        $balanceBefore < $amount
    ) {

        http_response_code(400);

        echo json_encode([
            "success" => false,
            "message" =>
                "Insufficient available balance."
        ]);

        exit;
    }


    /*
    |--------------------------------------------------------------------------
    | ATOMIC UPDATE
    |--------------------------------------------------------------------------
    */

    $updatedUser =
        $users->findOneAndUpdate(
            [
                "_id" => $userId,

                "balance" => [
                    '$gte' => $amount
                ]
            ],
            [
                '$inc' => [
                    "balance" => -$amount
                ]
            ],
            [
                "returnDocument" =>
                    MongoDB\Operation\FindOneAndUpdate::RETURN_DOCUMENT_AFTER
            ]
        );


    /*
    |--------------------------------------------------------------------------
    | BALANCE RESERVATION FAILED
    |--------------------------------------------------------------------------
    */

    if (!$updatedUser) {

        http_response_code(400);

        echo json_encode([
            "success" => false,
            "message" =>
                "Insufficient available balance or balance changed. Please try again."
        ]);

        exit;
    }


    /*
    |--------------------------------------------------------------------------
    | NEW BALANCE
    |--------------------------------------------------------------------------
    */

    $newBalance =
        (float) (
            $updatedUser["balance"] ?? 0
        );


    /*
    |--------------------------------------------------------------------------
    | CREATE WITHDRAWAL RECORD
    |--------------------------------------------------------------------------
    */

    $withdrawal = [

        "user_id" =>
            $userId,

        "reference" =>
            $reference,

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

        "balance_reserved" =>
            true,

        "balance_before" =>
            $balanceBefore,

        "balance_after_reservation" =>
            $newBalance,

        "type" =>
            "withdrawal",

        "created_at" =>
            new MongoDB\BSON\UTCDateTime(),

        "updated_at" =>
            new MongoDB\BSON\UTCDateTime()

    ];


    /*
    |--------------------------------------------------------------------------
    | SAVE TRANSACTION
    |--------------------------------------------------------------------------
    */

    $result =
        $transactions->insertOne(
            $withdrawal
        );


    /*
    |--------------------------------------------------------------------------
    | RESPONSE
    |--------------------------------------------------------------------------
    */

    echo json_encode([

        "success" => true,

        "message" =>
            "Withdrawal request submitted successfully and is pending review.",

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

            "phone" =>
                $phone,

            "payment_method" =>
                $paymentMethod,

            "status" =>
                "pending",

            "payment_status" =>
                "pending"

        ],

        "user" => [

            "balance" =>
                $newBalance

        ]

    ]);


} catch (Throwable $e) {

    /*
    |--------------------------------------------------------------------------
    | IMPORTANT
    |--------------------------------------------------------------------------
    | If the balance was deducted but transaction insertion
    | fails, production should use a MongoDB transaction/session
    | or a compensating rollback.
    |--------------------------------------------------------------------------
    */

    error_log(
        "CROWN CASH CREATE WITHDRAWAL ERROR: " .
        $e->getMessage()
    );


    http_response_code(500);


    echo json_encode([

        "success" => false,

        "message" =>
            "Unable to create withdrawal request."

    ]);
}

?>