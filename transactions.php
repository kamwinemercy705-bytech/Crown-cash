<?php

/* =========================================================
   CROWN CASH - TRANSACTIONS API
   Returns the logged-in user's transaction history
========================================================= */


/* =========================================================
   ERROR HANDLING
========================================================= */

ini_set("display_errors", "0");
error_reporting(E_ALL);


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
    "Access-Control-Allow-Methods: GET, OPTIONS"
);

header(
    "Access-Control-Allow-Headers: Content-Type, Accept"
);


/* =========================================================
   PREFLIGHT
========================================================= */

if ($_SERVER["REQUEST_METHOD"] === "OPTIONS") {

    http_response_code(204);

    exit;

}


/* =========================================================
   ONLY GET
========================================================= */

if ($_SERVER["REQUEST_METHOD"] !== "GET") {

    http_response_code(405);

    echo json_encode([
        "success" => false,
        "message" => "Method not allowed."
    ]);

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
   CHECK LOGIN
========================================================= */

if (
    empty($_SESSION["logged_in"]) ||
    empty($_SESSION["user_id"])
) {

    http_response_code(401);

    echo json_encode([
        "success" => false,
        "message" => "You are not logged in."
    ]);

    exit;

}


/* =========================================================
   LOAD DATABASE CONFIG
========================================================= */

try {

    require_once __DIR__ . "/config.php";

} catch (Throwable $e) {

    http_response_code(500);

    echo json_encode([
        "success" => false,
        "message" => "Database configuration could not be loaded."
    ]);

    exit;

}


/* =========================================================
   CHECK COLLECTION
========================================================= */

if (!isset($transactions)) {

    http_response_code(500);

    echo json_encode([
        "success" => false,
        "message" => "Transactions collection is not configured."
    ]);

    exit;

}


/* =========================================================
   MONGODB
========================================================= */

use MongoDB\BSON\ObjectId;


/* =========================================================
   HELPERS
========================================================= */

function transactionNumber($value)
{
    if ($value === null) {
        return 0;
    }

    if (is_int($value) || is_float($value)) {
        return $value;
    }

    if (is_string($value)) {
        return is_numeric($value)
            ? (float)$value
            : 0;
    }

    if (
        is_object($value) &&
        method_exists($value, "toString")
    ) {

        return (float)$value->toString();

    }

    return 0;
}


function transactionDate($value)
{
    if ($value === null) {
        return null;
    }

    if (
        is_object($value) &&
        method_exists($value, "toDateTime")
    ) {

        return $value->toDateTime()->format(
            DateTime::ATOM
        );

    }

    if ($value instanceof DateTimeInterface) {

        return $value->format(
            DateTime::ATOM
        );

    }

    if (is_string($value)) {
        return $value;
    }

    return null;
}


function stringValue($value)
{
    if ($value === null) {
        return "";
    }

    if (is_string($value)) {
        return $value;
    }

    if (is_scalar($value)) {
        return (string)$value;
    }

    if (
        is_object($value) &&
        method_exists($value, "toString")
    ) {

        return $value->toString();

    }

    return "";
}


function normalizeType($type)
{
    $type = strtolower(
        trim(
            stringValue($type)
        )
    );

    if (
        strpos($type, "deposit") !== false ||
        $type === "credit" ||
        $type === "funding" ||
        $type === "topup" ||
        $type === "top-up"
    ) {

        return "deposit";

    }


    if (
        strpos($type, "withdraw") !== false ||
        $type === "debit"
    ) {

        return "withdrawal";

    }


    if (
        strpos($type, "invest") !== false
    ) {

        return "investment";

    }


    if (
        strpos($type, "income") !== false ||
        strpos($type, "earning") !== false ||
        strpos($type, "profit") !== false ||
        strpos($type, "return") !== false ||
        strpos($type, "commission") !== false ||
        strpos($type, "referral") !== false
    ) {

        return "income";

    }


    return "other";
}


function normalizeStatus($status)
{
    $status = strtolower(
        trim(
            stringValue($status)
        )
    );

    if (
        $status === "complete" ||
        $status === "completed" ||
        $status === "success" ||
        $status === "successful" ||
        $status === "approved"
    ) {

        return "completed";

    }


    if (
        $status === "failed" ||
        $status === "failure" ||
        $status === "error"
    ) {

        return "failed";

    }


    if (
        $status === "rejected" ||
        $status === "declined" ||
        $status === "denied"
    ) {

        return "rejected";

    }


    return "pending";
}


function getTitle($type)
{
    switch ($type) {

        case "deposit":
            return "Deposit";

        case "withdrawal":
            return "Withdrawal";

        case "investment":
            return "Investment";

        case "income":
            return "Income";

        default:
            return "Transaction";

    }
}


/* =========================================================
   GET USER ID
========================================================= */

$userIdString =
    (string)$_SESSION["user_id"];


/* =========================================================
   BUILD USER ID QUERY
========================================================= */

$userQueries = [];


/* ObjectId */

try {

    if (
        preg_match(
            "/^[a-f0-9]{24}$/i",
            $userIdString
        )
    ) {

        $userQueries[] = [
            "user_id" => new ObjectId(
                $userIdString
            )
        ];

    }

} catch (Throwable $e) {
    // Ignore invalid ObjectId
}


/* String user_id */

$userQueries[] = [
    "user_id" => $userIdString
];


/* =========================================================
   ALSO SUPPORT USER / USER_ID FIELDS
========================================================= */

$userQueries[] = [
    "user" => $userIdString
];

$userQueries[] = [
    "userId" => $userIdString
];

$userQueries[] = [
    "account_id" => $userIdString
];


/* =========================================================
   LOAD TRANSACTIONS
========================================================= */

try {

    $documents = [];

    /*
     * Query the transactions collection.
     * Each query is attempted so the API can work
     * with the different field names used by older
     * Crown Cash transaction records.
     */

    foreach ($userQueries as $query) {

        $cursor =
            $transactions->find(
                $query,
                [
                    "sort" => [
                        "created_at" => -1,
                        "_id" => -1
                    ],
                    "limit" => 200
                ]
            );

        foreach ($cursor as $document) {

            $id =
                isset($document["_id"])
                    ? (string)$document["_id"]
                    : "";

            if ($id === "") {
                continue;
            }

            /*
             * Prevent duplicates when the same
             * transaction is found by more than
             * one query.
             */

            $documents[$id] =
                $document;

        }

    }


    /* =====================================================
       SORT NEWEST FIRST
    ===================================================== */

    usort(
        $documents,
        function ($a, $b) {

            $dateA =
                isset($a["created_at"])
                    ? $a["created_at"]
                    : (
                        $a["createdAt"] ?? null
                    );

            $dateB =
                isset($b["created_at"])
                    ? $b["created_at"]
                    : (
                        $b["createdAt"] ?? null
                    );

            $timeA = 0;
            $timeB = 0;

            if (
                $dateA instanceof DateTimeInterface
            ) {

                $timeA =
                    $dateA->getTimestamp();

            }

            if (
                $dateB instanceof DateTimeInterface
            ) {

                $timeB =
                    $dateB->getTimestamp();

            }

            return $timeB <=> $timeA;

        }
    );


    /* =====================================================
       FORMAT TRANSACTIONS
    ===================================================== */

    $result = [];


    foreach ($documents as $document) {

        $rawType =
            $document["type"] ??
            $document["transaction_type"] ??
            $document["transactionType"] ??
            $document["category"] ??
            $document["kind"] ??
            "";


        $type =
            normalizeType(
                $rawType
            );


        $rawStatus =
            $document["status"] ??
            $document["state"] ??
            "pending";


        $status =
            normalizeStatus(
                $rawStatus
            );


        $amount =
            transactionNumber(
                $document["amount"] ??
                $document["value"] ??
                $document["total"] ??
                0
            );


        $reference =
            $document["transaction_reference"] ??
            $document["reference"] ??
            $document["transaction_id"] ??
            $document["transactionId"] ??
            $document["ref"] ??
            (
                isset($document["_id"])
                    ? (string)$document["_id"]
                    : ""
            );


        $description =
            $document["description"] ??
            $document["title"] ??
            $document["name"] ??
            getTitle($type);


        $createdAt =
            $document["created_at"] ??
            $document["createdAt"] ??
            $document["date"] ??
            $document["timestamp"] ??
            null;


        $result[] = [

            "id" =>
                isset($document["_id"])
                    ? (string)$document["_id"]
                    : null,

            "type" =>
                $type,

            "transaction_type" =>
                stringValue($rawType),

            "title" =>
                stringValue($description),

            "description" =>
                stringValue($description),

            "amount" =>
                $amount,

            "status" =>
                $status,

            "reference" =>
                stringValue($reference),

            "transaction_reference" =>
                stringValue($reference),

            "payment_method" =>
                stringValue(
                    $document["payment_method"] ??
                    $document["method"] ??
                    ""
                ),

            "method" =>
                stringValue(
                    $document["method"] ??
                    $document["payment_method"] ??
                    ""
                ),

            "created_at" =>
                transactionDate(
                    $createdAt
                )

        ];

    }


    /* =====================================================
       GET USER BALANCE
    ===================================================== */

    $balance = 0;


    if (isset($users)) {

        $user = null;


        /* Try ObjectId */

        try {

            if (
                preg_match(
                    "/^[a-f0-9]{24}$/i",
                    $userIdString
                )
            ) {

                $user =
                    $users->findOne([
                        "_id" =>
                            new ObjectId(
                                $userIdString
                            )
                    ]);

            }

        } catch (Throwable $e) {
            $user = null;
        }


        /* Try string _id */

        if (!$user) {

            try {

                $user =
                    $users->findOne([
                        "_id" =>
                            $userIdString
                    ]);

            } catch (Throwable $e) {
                $user = null;
            }

        }


        if ($user) {

            $balance =
                transactionNumber(
                    $user["balance"] ??
                    $user["wallet_balance"] ??
                    $user["walletBalance"] ??
                    0
                );

        }

    }


    /* =====================================================
       CALCULATE SUMMARY
    ===================================================== */

    $summary = [

        "deposits" => 0,

        "withdrawals" => 0,

        "investments" => 0,

        "income" => 0

    ];


    foreach ($result as $transaction) {

        $amount =
            transactionNumber(
                $transaction["amount"]
            );


        switch (
            $transaction["type"]
        ) {

            case "deposit":

                $summary["deposits"] +=
                    $amount;

                break;


            case "withdrawal":

                $summary["withdrawals"] +=
                    $amount;

                break;


            case "investment":

                $summary["investments"] +=
                    $amount;

                break;


            case "income":

                $summary["income"] +=
                    $amount;

                break;

        }

    }


    /* =====================================================
       RESPONSE
    ===================================================== */

    http_response_code(200);

    echo json_encode([

        "success" => true,

        "message" =>
            "Transactions loaded successfully.",

        "balance" =>
            $balance,

        "available_balance" =>
            $balance,

        "transactions" =>
            array_values($result),

        "summary" =>
            $summary,

        "count" =>
            count($result)

    ], JSON_UNESCAPED_SLASHES);

    exit;


} catch (Throwable $e) {

    error_log(
        "Crown Cash transactions.php error: " .
        $e->getMessage()
    );


    http_response_code(500);

    echo json_encode([

        "success" => false,

        "message" =>
            "Unable to load transactions.",

        "error" =>
            $e->getMessage()

    ], JSON_UNESCAPED_SLASHES);

    exit;

}
?>