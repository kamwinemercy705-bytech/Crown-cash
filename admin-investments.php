<?php

/* =========================================================
   CROWN CASH — ADMIN INVESTMENTS API
   ========================================================= */

declare(strict_types=1);

/* =========================================================
   SESSION / COOKIE
   ========================================================= */

session_set_cookie_params([
    "path" => "/",
    "secure" => true,
    "httponly" => true,
    "samesite" => "None"
]);

session_start();

/* =========================================================
   HEADERS / CORS
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
   OPTIONS REQUEST
   ========================================================= */

if ($_SERVER["REQUEST_METHOD"] === "OPTIONS") {
    http_response_code(204);
    exit;
}

/* =========================================================
   ONLY GET ALLOWED
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
   ADMIN AUTHENTICATION
   ========================================================= */

if (
    !isset($_SESSION["logged_in"]) ||
    $_SESSION["logged_in"] !== true
) {

    http_response_code(401);

    echo json_encode([
        "success" => false,
        "message" => "Please login first."
    ]);

    exit;
}

/* =========================================================
   ADMIN ROLE CHECK
   ========================================================= */

$sessionRole = strtolower(
    trim(
        (string)($_SESSION["role"] ?? "")
    )
);

if (
    $sessionRole !== "admin" &&
    $sessionRole !== "administrator"
) {

    http_response_code(403);

    echo json_encode([
        "success" => false,
        "message" => "Administrator access required."
    ]);

    exit;
}

/* =========================================================
   DATABASE
   ========================================================= */

require_once __DIR__ . "/config.php";

/* =========================================================
   HELPER — CONVERT MONGODB VALUES
   ========================================================= */

function jsonSafeValue($value)
{
    if ($value instanceof MongoDB\BSON\ObjectId) {
        return (string)$value;
    }

    if ($value instanceof MongoDB\BSON\UTCDateTime) {
        return $value
            ->toDateTime()
            ->format(DATE_ATOM);
    }

    if ($value instanceof MongoDB\BSON\Decimal128) {
        return (float)$value->__toString();
    }

    if ($value instanceof MongoDB\BSON\Int64) {
        return (int)$value;
    }

    if ($value instanceof MongoDB\Model\BSONDocument) {
        $result = [];

        foreach ($value as $key => $item) {
            $result[$key] = jsonSafeValue($item);
        }

        return $result;
    }

    if ($value instanceof MongoDB\Model\BSONArray) {
        $result = [];

        foreach ($value as $key => $item) {
            $result[$key] = jsonSafeValue($item);
        }

        return $result;
    }

    if (is_array($value)) {

        $result = [];

        foreach ($value as $key => $item) {
            $result[$key] = jsonSafeValue($item);
        }

        return $result;
    }

    if (is_object($value)) {

        $result = [];

        foreach (get_object_vars($value) as $key => $item) {
            $result[$key] = jsonSafeValue($item);
        }

        return $result;
    }

    return $value;
}

/* =========================================================
   GET FIRST AVAILABLE FIELD
   ========================================================= */

function firstValue(array $document, array $fields, $default = null)
{
    foreach ($fields as $field) {

        if (
            array_key_exists($field, $document) &&
            $document[$field] !== null &&
            $document[$field] !== ""
        ) {
            return $document[$field];
        }
    }

    return $default;
}

/* =========================================================
   FORMAT DATE
   ========================================================= */

function formatDateValue($value)
{
    if ($value instanceof MongoDB\BSON\UTCDateTime) {

        return $value
            ->toDateTime()
            ->format(DATE_ATOM);
    }

    if ($value instanceof MongoDB\BSON\ObjectId) {
        return null;
    }

    if (is_string($value) && trim($value) !== "") {
        return $value;
    }

    if (is_numeric($value)) {

        try {

            $date = new DateTime(
                "@" . ((int)$value / 1000)
            );

            $date->setTimezone(
                new DateTimeZone("UTC")
            );

            return $date->format(DATE_ATOM);

        } catch (Throwable $e) {
            return null;
        }
    }

    return null;
}

/* =========================================================
   CONVERT VALUE TO OBJECT ID
   ========================================================= */

function makeObjectId($value)
{
    if ($value instanceof MongoDB\BSON\ObjectId) {
        return $value;
    }

    if (is_string($value)) {

        $value = trim($value);

        if (
            preg_match(
                '/^[a-f0-9]{24}$/i',
                $value
            )
        ) {

            try {
                return new MongoDB\BSON\ObjectId($value);
            } catch (Throwable $e) {
                return null;
            }
        }
    }

    if (is_array($value)) {

        if (isset($value["$oid"])) {
            return makeObjectId($value["$oid"]);
        }

        if (isset($value["oid"])) {
            return makeObjectId($value["oid"]);
        }
    }

    return null;
}

/* =========================================================
   FIND USER
   ========================================================= */

function findUserForInvestment(
    $userCollection,
    array $investment
) {

    if ($userCollection === null) {
        return null;
    }

    /*
     * Possible names used by different versions
     * of the Crown Cash investment system.
     */

    $possibleUserFields = [
        "user_id",
        "userId",
        "customer_id",
        "customerId",
        "member_id",
        "memberId",
        "account_id",
        "accountId"
    ];

    foreach ($possibleUserFields as $field) {

        if (
            !array_key_exists(
                $field,
                $investment
            )
        ) {
            continue;
        }

        $rawUserId = $investment[$field];

        $objectId = makeObjectId($rawUserId);

        if ($objectId === null) {
            continue;
        }

        try {

            $user = $userCollection->findOne([
                "_id" => $objectId
            ]);

            if ($user) {
                return $user;
            }

        } catch (Throwable $e) {
            continue;
        }
    }

    return null;
}

/* =========================================================
   FIND CUSTOMER DIRECTLY
   ========================================================= */

function findCustomerByPossibleId(
    $userCollection,
    array $investment
) {

    if ($userCollection === null) {
        return null;
    }

    /*
     * First try explicit user fields.
     */

    $user = findUserForInvestment(
        $userCollection,
        $investment
    );

    if ($user) {
        return $user;
    }

    /*
     * Some older investment records may contain
     * a reference under another field.
     */

    $possibleFields = [
        "customer",
        "customer_id",
        "customerId",
        "user",
        "user_id",
        "userId"
    ];

    foreach ($possibleFields as $field) {

        if (
            !isset($investment[$field])
        ) {
            continue;
        }

        $value = $investment[$field];

        if (is_array($value)) {

            $nestedId =
                $value["_id"] ??
                $value["id"] ??
                $value["$oid"] ??
                $value["oid"] ??
                null;

            if ($nestedId !== null) {

                $objectId =
                    makeObjectId($nestedId);

                if ($objectId !== null) {

                    try {

                        $user =
                            $userCollection->findOne([
                                "_id" => $objectId
                            ]);

                        if ($user) {
                            return $user;
                        }

                    } catch (Throwable $e) {
                        continue;
                    }
                }
            }
        }
    }

    return null;
}

/* =========================================================
   MAIN
   ========================================================= */

try {

    /* =====================================================
       VERIFY DATABASE VARIABLES
       ===================================================== */

    if (
        !isset($database) &&
        !isset($investments)
    ) {

        throw new Exception(
            "Database configuration is unavailable."
        );
    }

    /* =====================================================
       INVESTMENTS COLLECTION
       ===================================================== */

    if (isset($investments)) {

        $investmentCollection =
            $investments;

    } elseif (isset($database)) {

        $investmentCollection =
            $database->selectCollection(
                "investments"
            );

    } else {

        throw new Exception(
            "Investments collection is unavailable."
        );
    }

    /* =====================================================
       USERS COLLECTION
       ===================================================== */

    if (isset($users)) {

        $userCollection = $users;

    } elseif (isset($database)) {

        $userCollection =
            $database->selectCollection(
                "users"
            );

    } else {

        $userCollection = null;
    }

    /* =====================================================
       READ INVESTMENTS
       ===================================================== */

    $cursor =
        $investmentCollection->find(
            [],
            [
                "sort" => [
                    "created_at" => -1,
                    "createdAt" => -1,
                    "_id" => -1
                ],
                "limit" => 500
            ]
        );

    $investmentRecords = [];

    /* =====================================================
       PROCESS EACH INVESTMENT
       ===================================================== */

    foreach ($cursor as $investmentDocument) {

        /*
         * Convert MongoDB document into
         * normal PHP array.
         */

        $investment =
            jsonSafeValue(
                $investmentDocument
            );

        /* =================================================
           INVESTMENT ID
           ================================================= */

        $investmentId =
            (string)(
                $investment["_id"] ?? ""
            );

        /* =================================================
           USER ID
           ================================================= */

        $userId = firstValue(
            $investment,
            [
                "user_id",
                "userId",
                "customer_id",
                "customerId",
                "member_id",
                "memberId",
                "account_id",
                "accountId"
            ],
            null
        );

        if (is_array($userId)) {

            $userId =
                $userId["$oid"] ??
                $userId["oid"] ??
                $userId["id"] ??
                null;
        }

        if ($userId !== null) {
            $userId = (string)$userId;
        }

        /* =================================================
           CUSTOMER DATA FROM INVESTMENT
           ================================================= */

        $fullName = firstValue(
            $investment,
            [
                "full_name",
                "fullName",
                "customer_name",
                "customerName",
                "user_name",
                "userName",
                "name",
                "customer"
            ],
            ""
        );

        /*
         * If customer is an embedded object,
         * extract the name.
         */

        if (is_array($fullName)) {

            $fullName =
                $fullName["full_name"] ??
                $fullName["fullName"] ??
                $fullName["name"] ??
                "";
        }

        $email = firstValue(
            $investment,
            [
                "email",
                "customer_email",
                "customerEmail",
                "user_email",
                "userEmail"
            ],
            ""
        );

        $phone = firstValue(
            $investment,
            [
                "phone",
                "phone_number",
                "phoneNumber",
                "customer_phone",
                "customerPhone",
                "user_phone",
                "userPhone"
            ],
            ""
        );

        /* =================================================
           LOOK UP USER IN USERS COLLECTION
           ================================================= */

        $userDocument =
            findCustomerByPossibleId(
                $userCollection,
                $investment
            );

        if ($userDocument) {

            $user =
                jsonSafeValue(
                    $userDocument
                );

            if (
                trim((string)$fullName) === ""
            ) {

                $firstName =
                    $user["first_name"] ??
                    $user["firstName"] ??
                    "";

                $lastName =
                    $user["last_name"] ??
                    $user["lastName"] ??
                    "";

                $combinedName =
                    trim(
                        $firstName .
                        " " .
                        $lastName
                    );

                $fullName =
                    $user["full_name"] ??
                    $user["fullName"] ??
                    $user["name"] ??
                    $combinedName;
            }

            if (
                trim((string)$email) === ""
            ) {

                $email =
                    $user["email"] ??
                    "";
            }

            if (
                trim((string)$phone) === ""
            ) {

                $phone =
                    $user["phone"] ??
                    $user["phone_number"] ??
                    $user["phoneNumber"] ??
                    "";
            }

            /*
             * If the investment didn't contain a user_id,
             * use the actual user document ID.
             */

            if (
                $userId === null ||
                $userId === ""
            ) {

                $userId =
                    isset($user["_id"])
                        ? (string)$user["_id"]
                        : null;
            }
        }

        /* =================================================
           CUSTOMER FALLBACK
           ================================================= */

        if (
            trim((string)$fullName) === ""
        ) {

            /*
             * Keep Unknown User only when there is
             * genuinely no customer information.
             */

            $fullName =
                "Unknown User";
        }

        /* =================================================
           PLAN
           ================================================= */

        $plan = firstValue(
            $investment,
            [
                "plan",
                "plan_name",
                "planName",
                "investment_plan",
                "investmentPlan",
                "package",
                "package_name",
                "packageName"
            ],
            "Investment"
        );

        $plan =
            trim((string)$plan);

        if ($plan === "") {
            $plan = "Investment";
        }

        /* =================================================
           AMOUNT
           ================================================= */

        $amount = firstValue(
            $investment,
            [
                "amount",
                "investment_amount",
                "investmentAmount",
                "invested_amount",
                "investedAmount",
                "amount_invested",
                "amountInvested"
            ],
            0
        );

        if (
            $amount instanceof MongoDB\BSON\Decimal128
        ) {

            $amount =
                (float)$amount->__toString();

        } elseif (
            is_string($amount)
        ) {

            /*
             * Remove commas/currency symbols
             * while preserving numeric value.
             */

            $cleanAmount =
                preg_replace(
                    '/[^0-9.\-]/',
                    "",
                    $amount
                );

            $amount =
                (float)$cleanAmount;

        } else {

            $amount =
                (float)$amount;
        }

        /* =================================================
           CURRENCY
           ================================================= */

        $currency = firstValue(
            $investment,
            [
                "currency",
                "currency_code",
                "currencyCode"
            ],
            "UGX"
        );

        $currency =
            strtoupper(
                trim(
                    (string)$currency
                )
            );

        if ($currency === "") {
            $currency = "UGX";
        }

        /* =================================================
           STATUS
           ================================================= */

        $status = firstValue(
            $investment,
            [
                "status",
                "investment_status",
                "investmentStatus"
            ],
            "pending"
        );

        $status =
            strtolower(
                trim(
                    (string)$status
                )
            );

        /*
         * Normalize backend status for frontend.
         */

        if (
            $status === "approved" ||
            $status === "running"
        ) {

            $displayStatus =
                "active";

        } elseif (
            $status === "complete" ||
            $status === "finished"
        ) {

            $displayStatus =
                "completed";

        } elseif (
            $status === "rejected" ||
            $status === "declined"
        ) {

            $displayStatus =
                "cancelled";

        } else {

            $displayStatus =
                $status;
        }

        /* =================================================
           DURATION
           ================================================= */

        $duration = firstValue(
            $investment,
            [
                "duration",
                "duration_days",
                "durationDays",
                "period",
                "period_days",
                "periodDays",
                "term"
            ],
            30
        );

        /*
         * Handle values such as "30 days".
         */

        if (
            is_string($duration)
        ) {

            preg_match(
                '/\d+/',
                $duration,
                $matches
            );

            $duration =
                isset($matches[0])
                    ? (int)$matches[0]
                    : 30;

        } else {

            $duration =
                (int)$duration;
        }

        if ($duration <= 0) {
            $duration = 30;
        }

        /* =================================================
           START DATE
           ================================================= */

        $startDate = firstValue(
            $investment,
            [
                "start_date",
                "startDate",
                "started_at",
                "startedAt",
                "investment_date",
                "investmentDate"
            ],
            null
        );

        /*
         * If no explicit start date exists,
         * use created date.
         */

        if (
            $startDate === null ||
            $startDate === ""
        ) {

            $startDate =
                firstValue(
                    $investment,
                    [
                        "created_at",
                        "createdAt",
                        "date_created",
                        "dateCreated"
                    ],
                    null
                );
        }

        $startDate =
            formatDateValue(
                $startDate
            );

        /* =================================================
           END DATE
           ================================================= */

        $endDate = firstValue(
            $investment,
            [
                "end_date",
                "endDate",
                "maturity_date",
                "maturityDate",
                "completed_at",
                "completedAt"
            ],
            null
        );

        /*
         * If no end date exists, calculate it from
         * the start date and duration.
         */

        if (
            (
                $endDate === null ||
                $endDate === ""
            ) &&
            $startDate !== null
        ) {

            try {

                $startDateObject =
                    new DateTime(
                        $startDate
                    );

                $startDateObject->modify(
                    "+" . $duration . " days"
                );

                $endDate =
                    $startDateObject
                        ->format(DATE_ATOM);

            } catch (Throwable $e) {

                $endDate = null;
            }
        } else {

            $endDate =
                formatDateValue(
                    $endDate
                );
        }

        /* =================================================
           CREATED DATE
           ================================================= */

        $createdAt =
            firstValue(
                $investment,
                [
                    "created_at",
                    "createdAt",
                    "date_created",
                    "dateCreated"
                ],
                null
            );

        $createdAt =
            formatDateValue(
                $createdAt
            );

        /* =================================================
           RETURN / PROFIT
           ================================================= */

        $recordedReturn =
            firstValue(
                $investment,
                [
                    "return_amount",
                    "returnAmount",
                    "earnings",
                    "profit",
                    "total_return",
                    "totalReturn"
                ],
                0
            );

        if (
            $recordedReturn
            instanceof
            MongoDB\BSON\Decimal128
        ) {

            $recordedReturn =
                (float)
                $recordedReturn->__toString();

        } elseif (
            is_string($recordedReturn)
        ) {

            $recordedReturn =
                (float)
                preg_replace(
                    '/[^0-9.\-]/',
                    "",
                    $recordedReturn
                );

        } else {

            $recordedReturn =
                (float)$recordedReturn;
        }

        /* =================================================
           BUILD RECORD
           ================================================= */

        $investmentRecords[] = [

            "id" =>
                $investmentId,

            "investment_id" =>
                $investmentId,

            "investmentId" =>
                $investmentId,

            "user_id" =>
                $userId,

            "userId" =>
                $userId,

            "full_name" =>
                (string)$fullName,

            "fullName" =>
                (string)$fullName,

            "customer_name" =>
                (string)$fullName,

            "customerName" =>
                (string)$fullName,

            "name" =>
                (string)$fullName,

            "email" =>
                (string)$email,

            "phone" =>
                (string)$phone,

            "plan" =>
                $plan,

            "plan_name" =>
                $plan,

            "planName" =>
                $plan,

            "amount" =>
                $amount,

            "investment_amount" =>
                $amount,

            "investmentAmount" =>
                $amount,

            "currency" =>
                $currency,

            "duration" =>
                $duration,

            "duration_days" =>
                $duration,

            "period" =>
                $duration . " days",

            "period_days" =>
                $duration,

            "status" =>
                $displayStatus,

            "original_status" =>
                $status,

            "start_date" =>
                $startDate,

            "startDate" =>
                $startDate,

            "end_date" =>
                $endDate,

            "endDate" =>
                $endDate,

            "created_at" =>
                $createdAt,

            "createdAt" =>
                $createdAt,

            "return_amount" =>
                $recordedReturn,

            "returnAmount" =>
                $recordedReturn,

            "earnings" =>
                $recordedReturn,

            "profit" =>
                $recordedReturn
        ];
    }

    /* =====================================================
       ADMIN INFORMATION
       ===================================================== */

    $admin = [

        "name" =>
            "Administrator",

        "full_name" =>
            "Administrator",

        "email" =>
            (string)(
                $_SESSION["user_email"] ?? ""
            )
    ];

    /* =====================================================
       LOAD ACTUAL ADMIN USER
       ===================================================== */

    if (
        $userCollection !== null &&
        isset($_SESSION["user_id"])
    ) {

        try {

            $adminObjectId =
                makeObjectId(
                    $_SESSION["user_id"]
                );

            if ($adminObjectId !== null) {

                $adminUser =
                    $userCollection->findOne([
                        "_id" =>
                            $adminObjectId
                    ]);

                if ($adminUser) {

                    $adminUser =
                        jsonSafeValue(
                            $adminUser
                        );

                    $adminName =
                        $adminUser["full_name"] ??
                        $adminUser["fullName"] ??
                        $adminUser["name"] ??
                        "Administrator";

                    $adminEmail =
                        $adminUser["email"] ??
                        ($_SESSION["user_email"] ?? "");

                    $admin = [

                        "name" =>
                            (string)$adminName,

                        "full_name" =>
                            (string)$adminName,

                        "email" =>
                            (string)$adminEmail
                    ];
                }
            }

        } catch (Throwable $e) {

            /*
             * Keep default administrator information.
             */
        }
    }

    /* =====================================================
       CALCULATE SUMMARY
       ===================================================== */

    $totalInvestments =
        count($investmentRecords);

    $activeInvestments = 0;

    $pendingInvestments = 0;

    $completedInvestments = 0;

    $cancelledInvestments = 0;

    $totalAmount = 0;

    foreach ($investmentRecords as $record) {

        $totalAmount +=
            (float)(
                $record["amount"] ?? 0
            );

        switch (
            $record["status"] ?? "pending"
        ) {

            case "active":
            case "approved":

                $activeInvestments++;
                break;

            case "pending":

                $pendingInvestments++;
                break;

            case "completed":

                $completedInvestments++;
                break;

            case "cancelled":
            case "canceled":
            case "rejected":

                $cancelledInvestments++;
                break;
        }
    }

    /* =====================================================
       RESPONSE
       ===================================================== */

    echo json_encode(
        [

            "success" =>
                true,

            "message" =>
                "Investment records loaded successfully.",

            "admin" =>
                $admin,

            "count" =>
                $totalInvestments,

            "total_investments" =>
                $totalInvestments,

            "active_investments" =>
                $activeInvestments,

            "pending_investments" =>
                $pendingInvestments,

            "completed_investments" =>
                $completedInvestments,

            "cancelled_investments" =>
                $cancelledInvestments,

            "total_amount" =>
                $totalAmount,

            "summary" => [

                "total_investments" =>
                    $totalInvestments,

                "active_investments" =>
                    $activeInvestments,

                "pending_investments" =>
                    $pendingInvestments,

                "completed_investments" =>
                    $completedInvestments,

                "cancelled_investments" =>
                    $cancelledInvestments,

                "total_amount" =>
                    $totalAmount
            ],

            "investments" =>
                $investmentRecords
        ],

        JSON_UNESCAPED_SLASHES
    );

} catch (
    MongoDB\Driver\Exception\Exception $e
) {

    error_log(
        "admin-investments.php MongoDB error: " .
        $e->getMessage()
    );

    http_response_code(500);

    echo json_encode(
        [
            "success" =>
                false,

            "message" =>
                "Database error while loading investments."
        ]
    );

} catch (Throwable $e) {

    error_log(
        "admin-investments.php error: " .
        $e->getMessage()
    );

    http_response_code(500);

    echo json_encode(
        [
            "success" =>
                false,

            "message" =>
                "Unable to load investment records."
        ]
    );
}

?>