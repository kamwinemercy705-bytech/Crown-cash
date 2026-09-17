<?php

/*
|--------------------------------------------------------------------------
| Crown Cash — Admin Investment Management API
|--------------------------------------------------------------------------
*/

header("Access-Control-Allow-Origin: https://crown-cash.vercel.app");
header("Access-Control-Allow-Methods: GET, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");
header("Access-Control-Allow-Credentials: true");
header("Content-Type: application/json; charset=UTF-8");


/*
|--------------------------------------------------------------------------
| Handle CORS Preflight
|--------------------------------------------------------------------------
*/

if ($_SERVER["REQUEST_METHOD"] === "OPTIONS") {
    http_response_code(204);
    exit;
}


/*
|--------------------------------------------------------------------------
| Session Configuration
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
| Admin Authentication
|--------------------------------------------------------------------------
*/

function requireAdmin()
{
    global $users;

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


    try {

        $userId = new MongoDB\BSON\ObjectId(
            (string) $_SESSION["user_id"]
        );

    } catch (Throwable $e) {

        http_response_code(401);

        echo json_encode([
            "success" => false,
            "message" => "Invalid user session."
        ]);

        exit;
    }


    /*
    |--------------------------------------------------------------------------
    | Always verify admin role from MongoDB
    |--------------------------------------------------------------------------
    */

    $admin = $users->findOne([
        "_id" => $userId
    ]);


    if (!$admin) {

        http_response_code(403);

        echo json_encode([
            "success" => false,
            "message" => "Administrator account not found."
        ]);

        exit;
    }


    $role = strtolower(
        trim(
            (string) ($admin["role"] ?? "")
        )
    );


    if ($role !== "admin") {

        http_response_code(403);

        echo json_encode([
            "success" => false,
            "message" => "Administrator access required."
        ]);

        exit;
    }


    return $admin;
}


/*
|--------------------------------------------------------------------------
| Only GET is allowed
|--------------------------------------------------------------------------
*/

if ($_SERVER["REQUEST_METHOD"] !== "GET") {

    http_response_code(405);

    echo json_encode([
        "success" => false,
        "message" => "Method not allowed."
    ]);

    exit;
}


try {

    /*
    |--------------------------------------------------------------------------
    | Verify Administrator
    |--------------------------------------------------------------------------
    */

    $admin = requireAdmin();


    /*
    |--------------------------------------------------------------------------
    | Load Investments
    |--------------------------------------------------------------------------
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


    /*
    |--------------------------------------------------------------------------
    | Prepare Results
    |--------------------------------------------------------------------------
    */

    $investmentList = [];

    $totalInvestments = 0;
    $totalAmount = 0;

    $active = 0;
    $pending = 0;
    $completed = 0;


    foreach ($cursor as $investment) {

        $totalInvestments++;


        $amount = (float) (
            $investment["amount"] ?? 0
        );

        $totalAmount += $amount;


        $status = strtolower(
            trim(
                (string) (
                    $investment["status"] ?? "active"
                )
            )
        );


        if ($status === "active") {
            $active++;
        }

        elseif ($status === "pending") {
            $pending++;
        }

        elseif ($status === "completed") {
            $completed++;
        }


        /*
        |--------------------------------------------------------------------------
        | Find Investor
        |--------------------------------------------------------------------------
        */

        $user = null;


        if (
            isset($investment["user_id"]) &&
            $investment["user_id"] instanceof MongoDB\BSON\ObjectId
        ) {

            $user = $users->findOne([
                "_id" => $investment["user_id"]
            ]);
        }


        $firstName = $user["firstName"] ?? "";
        $lastName = $user["lastName"] ?? "";


        $fullName = trim(
            $firstName . " " . $lastName
        );


        if ($fullName === "") {
            $fullName = "Unknown User";
        }


        /*
        |--------------------------------------------------------------------------
        | Dates
        |--------------------------------------------------------------------------
        */

        $createdAt = "";

        if (
            isset($investment["created_at"]) &&
            $investment["created_at"] instanceof MongoDB\BSON\UTCDateTime
        ) {

            $createdAt =
                $investment["created_at"]
                    ->toDateTime()
                    ->format(DATE_ATOM);
        }


        $updatedAt = "";

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
        |--------------------------------------------------------------------------
        | Investment Record
        |--------------------------------------------------------------------------
        */

        $investmentList[] = [

            "id" => (string) $investment["_id"],

            "user" => [

                "name" => $fullName,

                "email" =>
                    $user["email"] ?? "",

                "phone" =>
                    $user["phone"] ?? ""
            ],

            "plan" =>
                $investment["plan"] ?? "",

            "amount" =>
                $amount,

            "currency" =>
                $investment["currency"] ?? "UGX",

            "status" =>
                $status,

            "type" =>
                $investment["type"] ?? "test",

            "duration_days" =>
                (int) (
                    $investment["duration_days"] ?? 30
                ),

            "created_at" =>
                $createdAt,

            "updated_at" =>
                $updatedAt
        ];
    }


    /*
    |--------------------------------------------------------------------------
    | Response
    |--------------------------------------------------------------------------
    */

    echo json_encode([

        "success" => true,

        "message" =>
            "Investments loaded successfully.",

        "admin" => [

            "id" =>
                (string) $admin["_id"],

            "name" =>
                trim(
                    ($admin["firstName"] ?? "") .
                    " " .
                    ($admin["lastName"] ?? "")
                ),

            "email" =>
                $admin["email"] ?? ""
        ],

        "stats" => [

            "total_investments" =>
                $totalInvestments,

            "total_amount" =>
                $totalAmount,

            "active" =>
                $active,

            "pending" =>
                $pending,

            "completed" =>
                $completed
        ],

        "investments" =>
            $investmentList
    ]);

    exit;


} catch (Throwable $e) {

    error_log(
        "CROWN CASH ADMIN INVESTMENTS ERROR: " .
        $e->getMessage()
    );

    http_response_code(500);

    echo json_encode([

        "success" => false,

        "message" =>
            "Unable to load investments."
    ]);

    exit;
}

?>