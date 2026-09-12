<?php

header("Access-Control-Allow-Origin: https://crown-cash.vercel.app");
header("Access-Control-Allow-Methods: GET, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");
header("Access-Control-Allow-Credentials: true");
header("Content-Type: application/json; charset=UTF-8");


/*
|--------------------------------------------------------------------------
| Handle CORS preflight
|--------------------------------------------------------------------------
*/

if ($_SERVER["REQUEST_METHOD"] === "OPTIONS") {
    http_response_code(204);
    exit;
}


/*
|--------------------------------------------------------------------------
| Session configuration
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
| Database
|--------------------------------------------------------------------------
*/

require_once __DIR__ . "/config.php";


/*
|--------------------------------------------------------------------------
| Response helper
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
| Admin authentication
|--------------------------------------------------------------------------
*/

function requireAdmin(): object
{
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

    try {

        $userId = new MongoDB\BSON\ObjectId(
            (string) $_SESSION["user_id"]
        );

    } catch (Throwable $e) {

        sendResponse(
            false,
            "Invalid user session.",
            [],
            401
        );
    }

    global $users;

    $admin = $users->findOne([
        "_id" => $userId
    ]);

    if (!$admin) {

        sendResponse(
            false,
            "Administrator account not found.",
            [],
            403
        );
    }

    if (($admin["role"] ?? "") !== "admin") {

        sendResponse(
            false,
            "Administrator access required.",
            [],
            403
        );
    }

    return $admin;
}


/*
|--------------------------------------------------------------------------
| Only GET is allowed
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
| Verify administrator
|--------------------------------------------------------------------------
*/

$admin = requireAdmin();


/*
|--------------------------------------------------------------------------
| Load investments
|--------------------------------------------------------------------------
*/

try {

    /*
     * Current Crown Cash investments are stored
     * in the investments collection.
     */

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
     | Process every investment
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
            $investmentId = (string) $investment["_id"];
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
         * Add investment to response
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
     | Send response
     |--------------------------------------------------------------------------
     */

    sendResponse(
        true,
        "Investments loaded successfully.",
        [
            "admin" => [
                "id" => (string) $admin["_id"],
                "name" =>
                    trim(
                        (string) ($admin["firstName"] ?? "")
                        . " "
                        . (string) ($admin["lastName"] ?? "")
                    ),
                "email" => (string) (
                    $admin["email"] ?? ""
                )
            ],

            "stats" => [
                "total_investments" => $totalInvestments,
                "total_amount" => $totalAmount,
                "active" => $activeInvestments,
                "pending" => $pendingInvestments,
                "completed" => $completedInvestments
            ],

            "investments" => $investmentList
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