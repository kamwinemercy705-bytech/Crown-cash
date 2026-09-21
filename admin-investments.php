<?php

/* =========================================================
   CROWN CASH
   ADMIN INVESTMENTS API

   GET:
   Returns investment records for administrators.

   IMPORTANT:
   - Admin access is required.
   - This endpoint is READ-ONLY.
   - It does not create profits.
   - It does not change balances.
   - It does not approve investments.
   ========================================================= */


/* =========================================================
   SESSION COOKIE
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
    "Access-Control-Allow-Headers: Content-Type"
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

$sessionRole =
    strtolower(
        trim(
            (string)(
                $_SESSION["role"] ?? ""
            )
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
   HELPER FUNCTIONS
   ========================================================= */

function jsonSafeValue($value)
{
    if (
        $value instanceof MongoDB\BSON\ObjectId
    ) {

        return (string)$value;
    }


    if (
        $value instanceof MongoDB\BSON\UTCDateTime
    ) {

        return $value
            ->toDateTime()
            ->format(DATE_ATOM);
    }


    if (
        $value instanceof MongoDB\BSON\Decimal128
    ) {

        return (float)$value->__toString();
    }


    if (
        $value instanceof MongoDB\BSON\Int64
    ) {

        return (int)$value;
    }


    if (
        is_array($value)
    ) {

        $result = [];

        foreach ($value as $key => $item) {

            $result[$key] =
                jsonSafeValue($item);
        }

        return $result;
    }


    if (
        is_object($value)
    ) {

        $result = [];

        foreach (
            get_object_vars($value)
            as $key => $item
        ) {

            $result[$key] =
                jsonSafeValue($item);
        }

        return $result;
    }


    return $value;
}


function getField($document, $field, $default = null)
{
    if (
        isset($document[$field])
    ) {

        return $document[$field];
    }

    return $default;
}


function getCollectionSafely(
    $database,
    $possibleVariable,
    $collectionName
) {

    if (
        isset($GLOBALS[$possibleVariable])
    ) {

        return $GLOBALS[$possibleVariable];
    }

    return $database
        ->selectCollection($collectionName);
}


function formatDateValue($value)
{
    if (
        $value instanceof MongoDB\BSON\UTCDateTime
    ) {

        return $value
            ->toDateTime()
            ->format(DATE_ATOM);
    }


    if (
        $value instanceof MongoDB\BSON\ObjectId
    ) {

        return null;
    }


    if (
        is_string($value) &&
        trim($value) !== ""
    ) {

        return $value;
    }


    return null;
}


/* =========================================================
   MAIN
   ========================================================= */

try {

    /*
     * config.php should normally expose:
     *
     * $database
     * $users
     * $investments
     *
     * We support both direct collection variables
     * and database->selectCollection().
     */

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

    if (
        isset($investments)
    ) {

        $investmentCollection =
            $investments;

    } else {

        $investmentCollection =
            $database->selectCollection(
                "investments"
            );
    }


    /* =====================================================
       USERS COLLECTION
       ===================================================== */

    if (
        isset($users)
    ) {

        $userCollection =
            $users;

    } elseif (
        isset($database)
    ) {

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
                    "_id" => -1
                ],
                "limit" => 500
            ]
        );


    $investmentRecords = [];


    foreach ($cursor as $investment) {

        /*
         * Convert BSON document to array.
         */

        $investment =
            jsonSafeValue(
                $investment
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

        $userId =
            $investment["user_id"] ??
            $investment["userId"] ??
            null;


        if (
            is_array($userId) &&
            isset($userId["$oid"])
        ) {

            $userId =
                $userId["$oid"];
        }


        if (
            $userId !== null
        ) {

            $userId =
                (string)$userId;
        }


        /* =================================================
           CUSTOMER INFORMATION
           ================================================= */

        $fullName =
            $investment["full_name"] ??
            $investment["fullName"] ??
            $investment["customer_name"] ??
            $investment["customerName"] ??
            $investment["name"] ??
            "";


        $email =
            $investment["email"] ??
            "";


        $phone =
            $investment["phone"] ??
            "";


        /*
         * If investment does not contain customer
         * information, look it up in users collection.
         */

        if (
            $userCollection !== null &&
            $userId !== null
        ) {

            try {

                $userObjectId =
                    new MongoDB\BSON\ObjectId(
                        $userId
                    );


                $user =
                    $userCollection->findOne([
                        "_id" => $userObjectId
                    ]);


                if ($user) {

                    $user =
                        jsonSafeValue(
                            $user
                        );


                    if (
                        $fullName === ""
                    ) {

                        $fullName =
                            $user["full_name"] ??
                            $user["fullName"] ??
                            $user["name"] ??
                            "";
                    }


                    if (
                        $email === ""
                    ) {

                        $email =
                            $user["email"] ??
                            "";
                    }


                    if (
                        $phone === ""
                    ) {

                        $phone =
                            $user["phone"] ??
                            "";
                    }
                }

            } catch (
                MongoDB\Driver\Exception\Exception $userError
            ) {

                /*
                 * Do not fail the entire investment list
                 * if one user's ObjectId cannot be resolved.
                 */
            }
        }


        if (
            trim((string)$fullName) === ""
        ) {

            $fullName =
                "Unknown User";
        }


        /* =================================================
           PLAN
           ================================================= */

        $plan =
            $investment["plan"] ??
            $investment["plan_name"] ??
            $investment["planName"] ??
            $investment["package"] ??
            "";


        $plan =
            strtolower(
                trim(
                    (string)$plan
                )
            );


        /* =================================================
           AMOUNT
           ================================================= */

        $amount =
            $investment["amount"] ??
            $investment["investment_amount"] ??
            $investment["investmentAmount"] ??
            0;


        if (
            $amount instanceof MongoDB\BSON\Decimal128
        ) {

            $amount =
                (float)$amount->__toString();

        } else {

            $amount =
                (float)$amount;
        }


        /* =================================================
           STATUS
           ================================================= */

        $status =
            $investment["status"] ??
            "pending";


        $status =
            strtolower(
                trim(
                    (string)$status
                )
            );


        /*
         * Normalize a few common backend statuses.
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

        $duration =
            $investment["duration"] ??
            $investment["duration_days"] ??
            $investment["durationDays"] ??
            30;


        $duration =
            (int)$duration;


        if (
            $duration <= 0
        ) {

            $duration = 30;
        }


        /* =================================================
           DATES
           ================================================= */

        $startDate =
            $investment["start_date"] ??
            $investment["startDate"] ??
            $investment["started_at"] ??
            $investment["startedAt"] ??
            null;


        $endDate =
            $investment["end_date"] ??
            $investment["endDate"] ??
            $investment["maturity_date"] ??
            $investment["maturityDate"] ??
            null;


        $createdAt =
            $investment["created_at"] ??
            $investment["createdAt"] ??
            null;


        $startDate =
            formatDateValue(
                $startDate
            );


        $endDate =
            formatDateValue(
                $endDate
            );


        $createdAt =
            formatDateValue(
                $createdAt
            );


        /* =================================================
           RECORDED RETURN
           ================================================= */

        $recordedReturn =
            $investment["return_amount"] ??
            $investment["returnAmount"] ??
            $investment["earnings"] ??
            $investment["profit"] ??
            $investment["total_return"] ??
            $investment["totalReturn"] ??
            0;


        if (
            $recordedReturn instanceof
            MongoDB\BSON\Decimal128
        ) {

            $recordedReturn =
                (float)$recordedReturn->__toString();

        } else {

            $recordedReturn =
                (float)$recordedReturn;
        }


        /* =================================================
           BUILD RESPONSE RECORD
           ================================================= */

        $investmentRecords[] = [

            "id" =>
                $investmentId,

            "investment_id" =>
                $investmentId,

            "user_id" =>
                $userId,

            "full_name" =>
                (string)$fullName,

            "fullName" =>
                (string)$fullName,

            "customer_name" =>
                (string)$fullName,

            "email" =>
                (string)$email,

            "phone" =>
                (string)$phone,

            "plan" =>
                $plan,

            "plan_name" =>
                $plan,

            "amount" =>
                $amount,

            "investment_amount" =>
                $amount,

            "duration" =>
                $duration,

            "duration_days" =>
                $duration,

            "status" =>
                $displayStatus,

            "original_status" =>
                $status,

            "start_date" =>
                $startDate,

            "end_date" =>
                $endDate,

            "created_at" =>
                $createdAt,

            "return_amount" =>
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


    /*
     * If an admin user exists, retrieve the actual
     * name/email from the database.
     */

    if (
        isset($users) &&
        isset($_SESSION["user_id"])
    ) {

        try {

            $adminObjectId =
                new MongoDB\BSON\ObjectId(
                    $_SESSION["user_id"]
                );


            $adminUser =
                $users->findOne([
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

        } catch (
            MongoDB\Driver\Exception\Exception $adminError
        ) {

            /*
             * Keep default Administrator information.
             */
        }
    }


    /* =====================================================
       RESPONSE
       ===================================================== */

    echo json_encode(
        [
            "success" => true,

            "message" =>
                "Investment records loaded successfully.",

            "admin" =>
                $admin,

            "count" =>
                count($investmentRecords),

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

    echo json_encode([
        "success" => false,
        "message" =>
            "Database error while loading investments."
    ]);


} catch (
    Throwable $e
) {

    error_log(
        "admin-investments.php error: " .
        $e->getMessage()
    );


    http_response_code(500);

    echo json_encode([
        "success" => false,
        "message" =>
            "Unable to load investment records."
    ]);
}

?>