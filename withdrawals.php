<?php

declare(strict_types=1);

session_set_cookie_params([
    "lifetime" => 0,
    "path" => "/",
    "secure" => true,
    "httponly" => true,
    "samesite" => "None"
]);

session_start();

header("Content-Type: application/json; charset=utf-8");
header("Access-Control-Allow-Origin: https://crown-cash.vercel.app");
header("Access-Control-Allow-Credentials: true");
header("Access-Control-Allow-Methods: GET, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");


// ======================================================
// CORS PREFLIGHT
// ======================================================

if ($_SERVER["REQUEST_METHOD"] === "OPTIONS") {
    http_response_code(204);
    exit;
}


// ======================================================
// ONLY GET ALLOWED
// ======================================================

if ($_SERVER["REQUEST_METHOD"] !== "GET") {

    http_response_code(405);

    echo json_encode([
        "success" => false,
        "message" => "Method not allowed."
    ]);

    exit;
}


// ======================================================
// LOGIN CHECK
// ======================================================

if (
    !isset($_SESSION["logged_in"]) ||
    $_SESSION["logged_in"] !== true ||
    empty($_SESSION["user_id"])
) {

    http_response_code(401);

    echo json_encode([
        "success" => false,
        "message" => "Please login first."
    ]);

    exit;
}


// ======================================================
// LOAD DATABASE
// ======================================================

require_once __DIR__ . "/config.php";


try {

    $sessionUserId =
        (string)$_SESSION["user_id"];


    // ==================================================
    // OBJECT ID
    // ==================================================

    try {

        $userObjectId =
            new MongoDB\BSON\ObjectId(
                $sessionUserId
            );

    } catch (Throwable $e) {

        http_response_code(400);

        echo json_encode([
            "success" => false,
            "message" => "Invalid user account."
        ]);

        exit;

    }


    // ==================================================
    // LOAD USER
    // ==================================================

    $user =
        $users->findOne([
            "_id" => $userObjectId
        ]);


    if (!$user) {

        http_response_code(404);

        echo json_encode([
            "success" => false,
            "message" => "User account was not found."
        ]);

        exit;

    }


    // ==================================================
    // USER INFORMATION
    // ==================================================

    $fullName =
        (string)($user["full_name"] ?? "");


    $email =
        (string)($user["email"] ?? "");


    $registeredPhone =
        (string)(
            $user["phone"] ??
            $user["phone_number"] ??
            $user["mobile"] ??
            ""
        );


    // ==================================================
    // NORMALIZE PHONE
    // ==================================================

    $registeredPhone =
        trim($registeredPhone);

    $registeredPhone =
        preg_replace(
            "/[\s\-()]/",
            "",
            $registeredPhone
        );


    if (str_starts_with($registeredPhone, "+256")) {

        $registeredPhone =
            "0" .
            substr($registeredPhone, 4);

    } elseif (
        str_starts_with($registeredPhone, "256")
    ) {

        $registeredPhone =
            "0" .
            substr($registeredPhone, 3);

    }


    // ==================================================
    // BALANCE
    // ==================================================

    $balanceValue =
        $user["balance"] ??
        $user["wallet_balance"] ??
        0;


    if (
        $balanceValue
        instanceof MongoDB\BSON\Decimal128
    ) {

        $balance =
            (float)$balanceValue->__toString();

    } else {

        $balance =
            (float)$balanceValue;

    }


    // ==================================================
    // FIND USER WITH MULTIPLE POSSIBLE ID FORMATS
    // ==================================================

    $userIdQueries = [

        [
            "user_id" =>
                $userObjectId
        ],

        [
            "user_id" =>
                $sessionUserId
        ],

        [
            "userId" =>
                $userObjectId
        ],

        [
            "userId" =>
                $sessionUserId
        ],

        [
            "user" =>
                $userObjectId
        ],

        [
            "user" =>
                $sessionUserId
        ]

    ];


    // ==================================================
    // LOAD WITHDRAWALS
    // ==================================================

    $withdrawalDocuments = [];


    foreach ($userIdQueries as $query) {

        $cursor =
            $withdrawals->find(
                $query,
                [
                    "sort" => [
                        "created_at" => -1
                    ],
                    "limit" => 100
                ]
            );


        foreach ($cursor as $withdrawal) {

            $id =
                isset($withdrawal["_id"])
                    ? (string)$withdrawal["_id"]
                    : "";


            if ($id === "") {
                continue;
            }


            $withdrawalDocuments[$id] =
                $withdrawal;

        }

    }


    // ==================================================
    // CONVERT MONGODB NUMBERS
    // ==================================================

    function moneyValue($value): float
    {

        if (
            $value
            instanceof MongoDB\BSON\Decimal128
        ) {

            return (float)$value->__toString();

        }


        if (
            $value
            instanceof MongoDB\BSON\Int64
        ) {

            return (float)$value->__toString();

        }


        if (
            $value
            instanceof MongoDB\BSON\Int32
        ) {

            return (float)$value->__toString();

        }


        if (is_numeric($value)) {

            return (float)$value;

        }


        return 0.0;

    }


    // ==================================================
    // FORMAT DATE
    // ==================================================

    function formatDateValue($value): string
    {

        if (
            $value
            instanceof MongoDB\BSON\UTCDateTime
        ) {

            return $value
                ->toDateTime()
                ->format("Y-m-d H:i:s");

        }


        if ($value instanceof DateTimeInterface) {

            return $value->format(
                "Y-m-d H:i:s"
            );

        }


        if (is_string($value)) {

            return $value;

        }


        return "";

    }


    // ==================================================
    // BUILD RESPONSE
    // ==================================================

    $withdrawalsList = [];


    $totalRequested = 0;
    $totalFees = 0;
    $totalPayout = 0;

    $pendingCount = 0;
    $approvedCount = 0;
    $rejectedCount = 0;


    foreach (
        $withdrawalDocuments
        as $withdrawal
    ) {


        // ----------------------------------------------
        // ID
        // ----------------------------------------------

        $id =
            isset($withdrawal["_id"])
                ? (string)$withdrawal["_id"]
                : "";


        // ----------------------------------------------
        // AMOUNT
        // ----------------------------------------------

        $requestedAmount =
            moneyValue(
                $withdrawal["requested_amount"]
                ??
                $withdrawal["amount"]
                ??
                0
            );


        $fee =
            moneyValue(
                $withdrawal["fee"]
                ??
                0
            );


        $payoutAmount =
            moneyValue(
                $withdrawal["payout_amount"]
                ??
                (
                    $requestedAmount -
                    $fee
                )
            );


        $feeRate =
            moneyValue(
                $withdrawal["fee_rate"]
                ??
                0.20
            );


        // Handle databases where fee_rate was stored
        // as 20 instead of 0.20.

        if ($feeRate > 1) {

            $feeRate =
                $feeRate / 100;

        }


        // ----------------------------------------------
        // STATUS
        // ----------------------------------------------

        $status =
            strtolower(
                (string)(
                    $withdrawal["status"]
                    ??
                    "pending"
                )
            );


        $payoutStatus =
            strtolower(
                (string)(
                    $withdrawal["payout_status"]
                    ??
                    "not_paid"
                )
            );


        // ----------------------------------------------
        // PAYMENT METHOD
        // ----------------------------------------------

        $paymentMethod =
            (string)(
                $withdrawal["payment_method"]
                ??
                $withdrawal["method"]
                ??
                ""
            );


        // ----------------------------------------------
        // PHONE
        // ----------------------------------------------

        $phone =
            (string)(
                $withdrawal["phone"]
                ??
                $withdrawal["account_number"]
                ??
                $registeredPhone
            );


        // Normalize phone for display.

        $phone =
            trim($phone);

        $phone =
            preg_replace(
                "/[\s\-()]/",
                "",
                $phone
            );


        if (str_starts_with($phone, "+256")) {

            $phone =
                "0" .
                substr($phone, 4);

        } elseif (
            str_starts_with($phone, "256")
        ) {

            $phone =
                "0" .
                substr($phone, 3);

        }


        // ----------------------------------------------
        // DATES
        // ----------------------------------------------

        $createdAt =
            formatDateValue(
                $withdrawal["created_at"]
                ??
                $withdrawal["createdAt"]
                ??
                null
            );


        $approvedAt =
            formatDateValue(
                $withdrawal["approved_at"]
                ??
                null
            );


        $rejectedAt =
            formatDateValue(
                $withdrawal["rejected_at"]
                ??
                null
            );


        // ----------------------------------------------
        // REASON
        // ----------------------------------------------

        $rejectionReason =
            (string)(
                $withdrawal["rejection_reason"]
                ??
                ""
            );


        // ----------------------------------------------
        // ACCOUNT NAME
        // ----------------------------------------------

        $accountName =
            (string)(
                $withdrawal["full_name"]
                ??
                $fullName
            );


        // ----------------------------------------------
        // COUNTS
        // ----------------------------------------------

        if ($status === "pending") {

            $pendingCount++;

        } elseif ($status === "approved") {

            $approvedCount++;

        } elseif ($status === "rejected") {

            $rejectedCount++;

        }


        // ----------------------------------------------
        // TOTALS
        // ----------------------------------------------

        $totalRequested +=
            $requestedAmount;


        $totalFees +=
            $fee;


        if ($status === "approved") {

            $totalPayout +=
                $payoutAmount;

        }


        // ----------------------------------------------
        // RESPONSE ITEM
        // ----------------------------------------------

        $withdrawalsList[] = [

            "id" =>
                $id,

            "requested_amount" =>
                $requestedAmount,

            "amount" =>
                $requestedAmount,

            "fee_rate" =>
                $feeRate,

            "fee_percentage" =>
                $feeRate * 100,

            "fee" =>
                $fee,

            "payout_amount" =>
                $payoutAmount,

            "payment_method" =>
                $paymentMethod,

            "phone" =>
                $phone,

            "account_number" =>
                $phone,

            "account_name" =>
                $accountName,

            "status" =>
                $status,

            "payout_status" =>
                $payoutStatus,

            "rejection_reason" =>
                $rejectionReason,

            "created_at" =>
                $createdAt,

            "approved_at" =>
                $approvedAt,

            "rejected_at" =>
                $rejectedAt

        ];

    }


    // ==================================================
    // SORT AGAIN
    // ==================================================

    usort(
        $withdrawalsList,
        function ($a, $b) {

            return strcmp(
                (string)$b["created_at"],
                (string)$a["created_at"]
            );

        }
    );


    // ==================================================
    // RESPONSE
    // ==================================================

    echo json_encode([

        "success" =>
            true,

        "user" => [

            "full_name" =>
                $fullName,

            "email" =>
                $email,

            "phone" =>
                $registeredPhone,

            "balance" =>
                $balance

        ],

        "summary" => [

            "total_requested" =>
                $totalRequested,

            "total_fees" =>
                $totalFees,

            "total_payout" =>
                $totalPayout,

            "pending_count" =>
                $pendingCount,

            "approved_count" =>
                $approvedCount,

            "rejected_count" =>
                $rejectedCount,

            "total_count" =>
                count($withdrawalsList)

        ],

        "withdrawals" =>
            $withdrawalsList

    ]);

} catch (
    MongoDB\Driver\Exception\Exception $e
) {

    error_log(
        "Withdrawals MongoDB error: " .
        $e->getMessage()
    );

    http_response_code(500);

    echo json_encode([

        "success" =>
            false,

        "message" =>
            "Unable to load withdrawal history."

    ]);

} catch (Throwable $e) {

    error_log(
        "Withdrawals error: " .
        $e->getMessage()
    );

    http_response_code(500);

    echo json_encode([

        "success" =>
            false,

        "message" =>
            "Unable to load withdrawal history."

    ]);

}
?>