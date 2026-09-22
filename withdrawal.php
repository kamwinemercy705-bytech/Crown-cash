<?php

declare(strict_types=1);

/*
=========================================================
CROWN CASH - USER WITHDRAWAL API
=========================================================

Features:

✓ Secure user session
✓ Cross-origin Vercel → Render requests
✓ MongoDB
✓ Minimum withdrawal UGX 5,000
✓ 20% withdrawal fee
✓ MTN Mobile Money
✓ Airtel Money
✓ Registered account phone must be used
✓ Uganda phone validation
✓ Blocks suspended/disabled/banned accounts
✓ Prevents multiple pending withdrawals
✓ Creates withdrawal record
✓ Creates transaction record
✓ Does NOT deduct balance at request time
✓ Admin approval is required
✓ Server calculates fee and payout
=========================================================
*/


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
    "Access-Control-Allow-Methods: POST, OPTIONS"
);

header(
    "Access-Control-Allow-Headers: Content-Type, Accept"
);

header(
    "Content-Type: application/json; charset=utf-8"
);


/* =========================================================
   OPTIONS REQUEST
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
   AUTHENTICATION CHECK
   ========================================================= */

if (
    !isset($_SESSION["logged_in"]) ||
    $_SESSION["logged_in"] !== true ||
    !isset($_SESSION["user_id"]) ||
    trim((string)$_SESSION["user_id"]) === ""
) {

    http_response_code(401);

    echo json_encode([
        "success" => false,
        "message" => "Please login first."
    ]);

    exit;
}


/* =========================================================
   LOAD DATABASE CONFIGURATION
   ========================================================= */

require_once __DIR__ . "/config.php";


/* =========================================================
   WITHDRAWAL SETTINGS
   ========================================================= */

$minimumWithdrawal = 5000;

/*
20% withdrawal fee.
*/
$withdrawalFeeRate = 0.20;


/* =========================================================
   HELPER FUNCTIONS
   ========================================================= */

function normalizeUgandaPhone(
    string $phone
): string {

    /*
    Remove spaces, brackets, hyphens, etc.
    */

    $phone = preg_replace(
        "/[^0-9+]/",
        "",
        trim($phone)
    );


    if (!$phone) {

        return "";

    }


    /*
    +256772123456
    →
    0772123456
    */

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


    /*
    256772123456
    →
    0772123456
    */

    elseif (
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
    Ensure the number is in Uganda
    local format.
    */

    if (
        preg_match(
            "/^0[0-9]{9}$/",
            $phone
        )
    ) {

        return $phone;

    }


    return "";

}


/* =========================================================
   VALIDATE UGANDAN MOBILE NUMBER
   ========================================================= */

function isValidUgandaPhone(
    string $phone
): bool {

    /*
    Uganda mobile prefixes commonly include:

    MTN:
    077
    078
    076

    Airtel:
    070
    075

    Other valid Uganda mobile ranges may also
    exist, therefore the validation allows
    recognised 07x mobile ranges.
    */

    return (bool)preg_match(
        "/^07[0-9]{8}$/",
        $phone
    );

}


/* =========================================================
   JSON INPUT
   ========================================================= */

$rawInput =
    file_get_contents(
        "php://input"
    );


$data = json_decode(
    $rawInput,
    true
);


/*
Support normal form POST as well.
*/

if (
    !is_array($data)
) {

    $data = $_POST;

}


/* =========================================================
   READ REQUEST DATA
   ========================================================= */

$amountInput =
    $data["amount"] ??
    null;


$paymentMethod =
    trim(
        (string)(
            $data["payment_method"] ??
            $data["method"] ??
            ""
        )
    );


$submittedPhone =
    trim(
        (string)(
            $data["phone"] ??
            $data["phone_number"] ??
            $data["mobile"] ??
            ""
        )
    );


/* =========================================================
   VALIDATE AMOUNT
   ========================================================= */

if (
    $amountInput === null ||
    $amountInput === ""
) {

    http_response_code(400);

    echo json_encode([
        "success" => false,
        "message" => "Please enter a withdrawal amount."
    ]);

    exit;
}


/*
Do not accept decimals.

Withdrawals are whole Ugandan shillings.
*/

if (
    !is_numeric($amountInput)
) {

    http_response_code(400);

    echo json_encode([
        "success" => false,
        "message" => "Withdrawal amount must be a valid number."
    ]);

    exit;
}


$amount =
    (int)$amountInput;


if (
    $amount <= 0
) {

    http_response_code(400);

    echo json_encode([
        "success" => false,
        "message" => "Withdrawal amount must be greater than zero."
    ]);

    exit;
}


/*
Prevent decimal amounts such as:

5000.50
*/

if (
    (float)$amountInput !=
    (float)$amount
) {

    http_response_code(400);

    echo json_encode([
        "success" => false,
        "message" => "Withdrawal amount must be a whole UGX amount."
    ]);

    exit;
}


/* =========================================================
   MINIMUM WITHDRAWAL
   ========================================================= */

if (
    $amount < $minimumWithdrawal
) {

    http_response_code(400);

    echo json_encode([
        "success" => false,
        "message" =>
            "Minimum withdrawal is UGX " .
            number_format(
                $minimumWithdrawal
            ) .
            "."
    ]);

    exit;
}


/* =========================================================
   PAYMENT METHOD
   ========================================================= */

$paymentMethodNormalized =
    strtolower(
        preg_replace(
            "/[^a-z]/",
            "",
            $paymentMethod
        )
    );


if (
    in_array(
        $paymentMethodNormalized,
        [
            "mtn",
            "mtnmobilemoney"
        ],
        true
    )
) {

    $paymentMethod =
        "MTN";

} elseif (
    in_array(
        $paymentMethodNormalized,
        [
            "airtel",
            "airtelmoney"
        ],
        true
    )
) {

    $paymentMethod =
        "Airtel";

} else {

    http_response_code(400);

    echo json_encode([
        "success" => false,
        "message" =>
            "Please select MTN Mobile Money or Airtel Money."
    ]);

    exit;
}


/* =========================================================
   USER ID
   ========================================================= */

$userIdString =
    trim(
        (string)$_SESSION["user_id"]
    );


/* =========================================================
   DATABASE OPERATION
   ========================================================= */

try {

    /*
    Convert session user ID to MongoDB ObjectId.
    */

    try {

        $userId =
            new MongoDB\BSON\ObjectId(
                $userIdString
            );

    } catch (
        Throwable $e
    ) {

        http_response_code(400);

        echo json_encode([
            "success" => false,
            "message" => "Invalid user account."
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


    if (!$user) {

        http_response_code(404);

        echo json_encode([
            "success" => false,
            "message" => "User account was not found."
        ]);

        exit;
    }


    /* =====================================================
       ACCOUNT STATUS
       ===================================================== */

    $accountStatus =
        strtolower(
            trim(
                (string)(
                    $user["status"] ??
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

        http_response_code(403);

        echo json_encode([
            "success" => false,
            "message" =>
                "Your account is not allowed to make withdrawals."
        ]);

        exit;
    }


    /* =====================================================
       GET REGISTERED USER PHONE
       ===================================================== */

    $registeredPhone =
        trim(
            (string)(
                $user["phone"] ??
                $user["phone_number"] ??
                $user["mobile"] ??
                ""
            )
        );


    /*
    Normalize the registered number.
    */

    $normalizedRegisteredPhone =
        normalizeUgandaPhone(
            $registeredPhone
        );


    /*
    The account must have a valid registered
    Uganda mobile number before withdrawal.
    */

    if (
        $normalizedRegisteredPhone === "" ||
        !isValidUgandaPhone(
            $normalizedRegisteredPhone
        )
    ) {

        http_response_code(400);

        echo json_encode([
            "success" => false,
            "message" =>
                "Your registered account phone number is missing or invalid. Please update your account phone number before withdrawing."
        ]);

        exit;
    }


    /* =====================================================
       USER-SUBMITTED PHONE
       ===================================================== */

    $normalizedSubmittedPhone =
        normalizeUgandaPhone(
            $submittedPhone
        );


    /*
    The user MUST provide a valid number.
    */

    if (
        $normalizedSubmittedPhone === ""
    ) {

        http_response_code(400);

        echo json_encode([
            "success" => false,
            "message" =>
                "Please use your registered account phone number for withdrawal."
        ]);

        exit;
    }


    if (
        !isValidUgandaPhone(
            $normalizedSubmittedPhone
        )
    ) {

        http_response_code(400);

        echo json_encode([
            "success" => false,
            "message" =>
                "Please enter a valid Ugandan mobile number."
        ]);

        exit;
    }


    /* =====================================================
       IMPORTANT PHONE MATCH CHECK
       ===================================================== */

    if (
        $normalizedSubmittedPhone !==
        $normalizedRegisteredPhone
    ) {

        http_response_code(403);

        echo json_encode([
            "success" => false,
            "message" =>
                "Withdrawal must use the mobile number registered on your Crown Cash account."
        ]);

        exit;
    }


    /*
    From this point onward we use the
    registered/verified number from the database,
    NOT a number supplied by the browser.

    This prevents a user from changing the
    destination number through developer tools.
    */

    $withdrawalPhone =
        $normalizedRegisteredPhone;


    /* =====================================================
       GET USER BALANCE
       ===================================================== */

    $balanceValue =
        $user["balance"] ??
        $user["wallet_balance"] ??
        0;


    if (
        $balanceValue instanceof
        MongoDB\BSON\Decimal128
    ) {

        $balance =
            (float)$balanceValue->__toString();

    } elseif (
        $balanceValue instanceof
        MongoDB\BSON\Int64
    ) {

        $balance =
            (float)$balanceValue->__toString();

    } else {

        $balance =
            (float)$balanceValue;

    }


    /* =====================================================
       CHECK BALANCE
       ===================================================== */

    if (
        $balance < $minimumWithdrawal
    ) {

        http_response_code(400);

        echo json_encode([
            "success" => false,
            "message" =>
                "Your balance is below the minimum withdrawal amount of UGX " .
                number_format(
                    $minimumWithdrawal
                ) .
                "."
        ]);

        exit;
    }


    if (
        $amount > $balance
    ) {

        http_response_code(400);

        echo json_encode([
            "success" => false,
            "message" =>
                "Insufficient balance."
        ]);

        exit;
    }


    /* =====================================================
       PREVENT MULTIPLE PENDING WITHDRAWALS
       ===================================================== */

    $existingPending =
        $withdrawals->findOne([
            "user_id" => $userId,

            "status" => "pending"
        ]);


    if (
        $existingPending
    ) {

        http_response_code(409);

        echo json_encode([
            "success" => false,
            "message" =>
                "You already have a pending withdrawal. Please wait for it to be processed before creating another withdrawal."
        ]);

        exit;
    }


    /* =====================================================
       CALCULATE 20% FEE
       ===================================================== */

    $withdrawalFee =
        (int)round(
            $amount *
            $withdrawalFeeRate
        );


    /* =====================================================
       CUSTOMER PAYOUT
       ===================================================== */

    $payoutAmount =
        $amount -
        $withdrawalFee;


    if (
        $payoutAmount <= 0
    ) {

        http_response_code(400);

        echo json_encode([
            "success" => false,
            "message" =>
                "The withdrawal amount is too small after applying the withdrawal fee."
        ]);

        exit;
    }


    /* =====================================================
       CREATE WITHDRAWAL ID
       ===================================================== */

    $withdrawalId =
        new MongoDB\BSON\ObjectId();


    $now =
        new MongoDB\BSON\UTCDateTime();


    /* =====================================================
       WITHDRAWAL DOCUMENT
       ===================================================== */

    $withdrawalDocument = [

        "_id" =>
            $withdrawalId,

        "user_id" =>
            $userId,

        "user_email" =>
            (string)(
                $user["email"] ??
                $_SESSION["user_email"] ??
                ""
            ),

        "full_name" =>
            (string)(
                $user["full_name"] ??
                ""
            ),

        /*
        This is always the registered account
        phone retrieved from MongoDB.
        */

        "phone" =>
            $withdrawalPhone,

        "account_number" =>
            $withdrawalPhone,

        "payment_method" =>
            $paymentMethod,

        "method" =>
            $paymentMethod,

        /*
        Amount requested by customer.

        This is the amount that will be deducted
        from the wallet when an admin approves it.
        */

        "requested_amount" =>
            $amount,

        "amount" =>
            $amount,

        /*
        Current Crown Cash withdrawal fee:
        20%
        */

        "fee_rate" =>
            $withdrawalFeeRate,

        "fee" =>
            $withdrawalFee,

        /*
        Amount customer receives after fee.
        */

        "payout_amount" =>
            $payoutAmount,

        "status" =>
            "pending",

        /*
        No money has actually been sent yet.
        */

        "payout_status" =>
            "not_paid",

        "created_at" =>
            $now,

        "updated_at" =>
            $now

    ];


    /* =====================================================
       INSERT WITHDRAWAL
       ===================================================== */

    $withdrawals->insertOne(
        $withdrawalDocument
    );


    /* =====================================================
       TRANSACTION RECORD
       ===================================================== */

    $transactionDocument = [

        "user_id" =>
            $userId,

        "type" =>
            "withdrawal",

        "transaction_type" =>
            "withdrawal",

        "reference" =>
            "WD-" .
            strtoupper(
                substr(
                    (string)$withdrawalId,
                    -10
                )
            ),

        "withdrawal_id" =>
            $withdrawalId,

        "amount" =>
            $amount,

        "requested_amount" =>
            $amount,

        "fee_rate" =>
            $withdrawalFeeRate,

        "fee" =>
            $withdrawalFee,

        "payout_amount" =>
            $payoutAmount,

        "payment_method" =>
            $paymentMethod,

        "phone" =>
            $withdrawalPhone,

        "status" =>
            "pending",

        "description" =>
            "Withdrawal request - pending admin approval.",

        "created_at" =>
            $now,

        "updated_at" =>
            $now

    ];


    /* =====================================================
       INSERT TRANSACTION
       ===================================================== */

    $transactions->insertOne(
        $transactionDocument
    );


    /* =====================================================
       AUDIT LOG
       ===================================================== */

    try {

        $auditLogs->insertOne([

            "user_id" =>
                $userId,

            "action" =>
                "withdrawal_requested",

            "type" =>
                "withdrawal",

            "withdrawal_id" =>
                $withdrawalId,

            "amount" =>
                $amount,

            "fee" =>
                $withdrawalFee,

            "payout_amount" =>
                $payoutAmount,

            "payment_method" =>
                $paymentMethod,

            "phone" =>
                $withdrawalPhone,

            "status" =>
                "pending",

            "description" =>
                "User submitted withdrawal request using registered account phone number.",

            "created_at" =>
                $now

        ]);

    } catch (
        Throwable $auditError
    ) {

        /*
        Audit failure should not prevent a valid
        withdrawal request from being created.

        Log it for server administrators.
        */

        error_log(
            "Withdrawal audit log error: " .
            $auditError->getMessage()
        );

    }


    /* =====================================================
       SUCCESS RESPONSE
       ===================================================== */

    echo json_encode([

        "success" =>
            true,

        "message" =>
            "Withdrawal request submitted successfully. It is now waiting for admin approval.",

        "withdrawal" => [

            "id" =>
                (string)$withdrawalId,

            "requested_amount" =>
                $amount,

            "amount" =>
                $amount,

            "fee_rate" =>
                $withdrawalFeeRate,

            "fee" =>
                $withdrawalFee,

            "payout_amount" =>
                $payoutAmount,

            "payment_method" =>
                $paymentMethod,

            /*
            Return the registered number that was
            actually used.
            */

            "phone" =>
                $withdrawalPhone,

            "status" =>
                "pending",

            "payout_status" =>
                "not_paid"

        ]

    ]);

} catch (
    MongoDB\Driver\Exception\Exception $e
) {

    error_log(
        "Withdrawal MongoDB error: " .
        $e->getMessage()
    );


    http_response_code(500);

    echo json_encode([

        "success" =>
            false,

        "message" =>
            "Database error while processing withdrawal."

    ]);

} catch (
    Throwable $e
) {

    error_log(
        "Withdrawal error: " .
        $e->getMessage()
    );


    http_response_code(500);

    echo json_encode([

        "success" =>
            false,

        "message" =>
            "Unable to process withdrawal."

    ]);

}

?>