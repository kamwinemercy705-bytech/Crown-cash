<?php

/*
|--------------------------------------------------------------------------
| Crown Cash — Admin Investments API
|--------------------------------------------------------------------------
*/

header("Access-Control-Allow-Origin: https://crown-cash.vercel.app");
header("Access-Control-Allow-Methods: GET, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");
header("Access-Control-Allow-Credentials: true");
header("Content-Type: application/json; charset=UTF-8");


/*
|--------------------------------------------------------------------------
| CORS PREFLIGHT
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
| RESPONSE HELPER
|--------------------------------------------------------------------------
*/

function sendResponse(
    bool $success,
    string $message = "",
    array $data = [],
    int $statusCode = 200
): void {

    http_response_code($statusCode);

    echo json_encode(
        array_merge(
            [
                "success" => $success,
                "message" => $message
            ],
            $data
        )
    );

    exit;
}


/*
|--------------------------------------------------------------------------
| CHECK ADMIN
|--------------------------------------------------------------------------
*/

function requireAdmin()
{
    /*
     * Check login session
     */

    if (
        empty($_SESSION["logged_in"]) ||
        empty($_SESSION["user_id"])
    ) {

        sendResponse(
            false,
            "Please login first.",
            [],
            401
        );
    }


    /*
     * Convert session ID to MongoDB ObjectId
     */

    try {

        $userId = new MongoDB\BSON\ObjectId(
            (string) $_SESSION["user_id"]
        );

    } catch (Throwable $e) {

        sendResponse(
            false,
            "Invalid user session.",
            [
                "session_user_id" =>
                    $_SESSION["user_id"] ?? null
            ],
            401
        );
    }


    /*
     * Find the actual user in Crown Cash
     */

    global $users;

    $admin = $users->findOne([
        "_id" => $userId
    ]);


    /*
     * User not found
     */

    if (!$admin) {

        sendResponse(
            false,
            "The logged-in user was not found in Crown Cash.",
            [
                "session_user_id" =>
                    (string) $userId,

                "session_email" =>
                    $_SESSION["user_email"] ?? null
            ],
            403
        );
    }


    /*
     * Read role directly from MongoDB
     */

    $databaseRole = strtolower(
        trim(
            (string) (
                $admin["role"] ?? ""
            )
        )
    );


    /*
     * TEMPORARY DIAGNOSTIC
     *
     * This tells us exactly which user the session
     * is connected to.
     */

    if ($databaseRole !== "admin") {

        sendResponse(
            false,
            "Administrator role mismatch.",
            [
                "session" => [
                    "logged_in" =>
                        $_SESSION["logged_in"] ?? false,

                    "user_id" =>
                        $_SESSION["user_id"] ?? null,

                    "user_email" =>
                        $_SESSION["user_email"] ?? null,

                    "session_role" =>
                        $_SESSION["role"] ?? null
                ],

                "database_user" => [
                    "id" =>
                        (string) $admin["_id"],

                    "email" =>
                        $admin["email"] ?? "",

                    "firstName" =>
                        $admin["firstName"] ?? "",

                    "lastName" =>
                        $admin["lastName"] ?? "",

                    "role" =>
                        $admin["role"] ?? "NOT SET",

                    "status" =>
                        $admin["status"] ?? "NOT SET"
                ]
            ],
            403
        );
    }


    /*
     * Administrator confirmed
     */

    return $admin;
}


/*
|--------------------------------------------------------------------------
| METHOD CHECK
|--------------------------------------------------------------------------
*/

if ($_SERVER["REQUEST_METHOD"] !== "GET") {

    sendResponse(
        false,
        "Method not allowed.",
        [],
        405
    );
}


/*
|--------------------------------------------------------------------------
| VERIFY ADMIN
|--------------------------------------------------------------------------
*/

$admin = requireAdmin();


/*
|--------------------------------------------------------------------------
| LOAD INVESTMENTS
|--------------------------------------------------------------------------
*/

try {

    $cursor = $investments->find(
        [],
        [
            "sort" => [
                "created_at" => -1
            ],
            "limit" => 500
        ]
    );


    $investmentList = [];

    $totalInvestments = 0;
    $totalAmount = 0;
    $activeInvestments = 0;
    $pendingInvestments = 0;
    $completedInvestments = 0;


    /*
     |--------------------------------------------------------------------------
     | PROCESS INVESTMENTS
     |--------------------------------------------------------------------------
     */

    foreach ($cursor as $investment) {

        $totalInvestments++;


        /*
         * Amount
         */

        $amount = (float) (
            $investment["amount"] ?? 0
        );

        $totalAmount += $amount;


        /*
         * Status
         */

        $status = strtolower(
            trim(
                (string) (
                    $investment["status"] ?? "active"
                )
            )
        );


        if ($status === "active") {
            $activeInvestments++;
        }

        if ($status === "pending") {
            $pendingInvestments++;
        }

        if (
            $status === "completed" ||
            $status === "complete" ||
            $status === "closed"
        ) {
            $completedInvestments++;
        }


        /*
         * User information
         */

        $userName = "Unknown User";
        $userEmail = "";
        $userPhone = "";


        if (
            isset($investment["user_id"]) &&
            $investment["user_id"] instanceof MongoDB\BSON\ObjectId
        ) {

            $user = $users->findOne([
                "_id" => $investment["user_id"]
            ]);

            if ($user) {

                $firstName = trim(
                    (string) (
                        $user["firstName"] ?? ""
                    )
                );

                $lastName = trim(
                    (string) (
                        $user["lastName"] ?? ""
                    )
                );

                $userName = trim(
                    $firstName . " " . $lastName
                );

                if ($userName === "") {
                    $userName = "Crown Cash User";
                }

                $userEmail = (string) (
                    $user["email"] ?? ""
                );

                $userPhone = (string) (
                    $user["phone"] ?? ""
                );
            }
        }


        /*
         * Investment ID
         */

        $investmentId = "";

        if (
            isset($investment["_id"]) &&
            $investment["_id"] instanceof MongoDB\BSON\ObjectId
        ) {

            $investmentId =
                (string) $investment["_id"];
        }


        /*
         * Created date
         */

        $createdAt = null;

        if (
            isset($investment["created_at"]) &&
            $investment["created_at"] instanceof MongoDB\BSON\UTCDateTime
        ) {

            $createdAt =
                $investment["created_at"]
                    ->toDateTime()
                    ->format(DATE_ATOM);
        }


        /*
         * Updated date
         */

        $updatedAt = null;

        if (
            isset($investment["updated_at"]) &&
            $investment["updated_at"] instanceof MongoDB\BSON\UTCDateTime
        ) {

            $updatedAt =
                $investment["updated_at"]
                    ->toDateTime()
                    ->format(DATE_ATOM);
        }


        /*
         * Duration
         */

        $durationDays = (int) (
            $investment["duration_days"]
            ?? $investment["duration"]
            ?? 30
        );


        /*
         * Type
         */

        $type = (string) (
            $investment["type"] ?? "investment"
        );


        /*
         * Currency
         */

        $currency = (string) (
            $investment["currency"] ?? "UGX"
        );


        /*
         * Add investment
         */

        $investmentList[] = [

            "id" => $investmentId,

            "user" => [
                "name" => $userName,
                "email" => $userEmail,
                "phone" => $userPhone
            ],

            "plan" => (string) (
                $investment["plan"] ?? "Investment Plan"
            ),

            "amount" => $amount,

            "currency" => $currency,

            "status" => $status,

            "type" => $type,

            "duration_days" => $durationDays,

            "created_at" => $createdAt,

            "updated_at" => $updatedAt
        ];
    }


    /*
     |--------------------------------------------------------------------------
     | SUCCESS RESPONSE
     |--------------------------------------------------------------------------
     */

    sendResponse(
        true,
        "Investments loaded successfully.",
        [
            "admin" => [
                "id" =>
                    (string) $admin["_id"],

                "name" =>
                    trim(
                        (string) (
                            $admin["firstName"] ?? ""
                        )
                        . " "
                        . (string) (
                            $admin["lastName"] ?? ""
                        )
                    ),

                "email" =>
                    (string) (
                        $admin["email"] ?? ""
                    )
            ],

            "stats" => [
                "total_investments" =>
                    $totalInvestments,

                "total_amount" =>
                    $totalAmount,

                "active" =>
                    $activeInvestments,

                "pending" =>
                    $pendingInvestments,

                "completed" =>
                    $completedInvestments
            ],

            "investments" =>
                $investmentList
        ]
    );


} catch (Throwable $e) {

    error_log(
        "CROWN CASH ADMIN INVESTMENTS ERROR: "
        . $e->getMessage()
    );

    sendResponse(
        false,
        "Unable to load investments.",
        [],
        500
    );
}

?>