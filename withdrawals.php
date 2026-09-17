<?php

/*
|--------------------------------------------------------------------------
| CROWN CASH - USER WITHDRAWAL HISTORY API
|--------------------------------------------------------------------------
*/


/*
|--------------------------------------------------------------------------
| CROSS-SITE SESSION
|--------------------------------------------------------------------------
*/

session_set_cookie_params([
    "lifetime" => 0,
    "path" => "/",
    "secure" => true,
    "httponly" => true,
    "samesite" => "None"
]);

session_start();


/*
|--------------------------------------------------------------------------
| CORS
|--------------------------------------------------------------------------
*/

header("Access-Control-Allow-Origin: https://crown-cash.vercel.app");
header("Access-Control-Allow-Credentials: true");
header("Access-Control-Allow-Methods: GET, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");
header("Content-Type: application/json");


/*
|--------------------------------------------------------------------------
| PREFLIGHT
|--------------------------------------------------------------------------
*/

if ($_SERVER["REQUEST_METHOD"] === "OPTIONS") {

    http_response_code(204);

    exit;
}


/*
|--------------------------------------------------------------------------
| ONLY GET ALLOWED
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


/*
|--------------------------------------------------------------------------
| CHECK LOGIN
|--------------------------------------------------------------------------
*/

if (
    empty($_SESSION["logged_in"]) ||
    empty($_SESSION["user_id"])
) {

    http_response_code(401);

    echo json_encode([
        "success" => false,
        "message" => "You must be logged in."
    ]);

    exit;
}


/*
|--------------------------------------------------------------------------
| DATABASE
|--------------------------------------------------------------------------
*/

require_once __DIR__ . "/config.php";


/*
|--------------------------------------------------------------------------
| CONVERT SESSION USER ID
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
        "message" => "Invalid user session."
    ]);

    exit;
}


/*
|--------------------------------------------------------------------------
| GET WITHDRAWALS
|--------------------------------------------------------------------------
*/

try {

    $cursor =
        $withdrawals->find(

            [
                "user_id" => $userId
            ],

            [
                "sort" => [
                    "created_at" => -1
                ],

                "limit" => 20
            ]

        );

} catch (Throwable $e) {

    http_response_code(500);

    echo json_encode([
        "success" => false,
        "message" => "Unable to load withdrawal history."
    ]);

    exit;
}


/*
|--------------------------------------------------------------------------
| BUILD RESPONSE
|--------------------------------------------------------------------------
*/

$withdrawalList = [];


foreach ($cursor as $withdrawal) {

    $createdAt = null;

    if (
        isset($withdrawal["created_at"]) &&
        $withdrawal["created_at"]
            instanceof MongoDB\BSON\UTCDateTime
    ) {

        $createdAt =
            $withdrawal["created_at"]
                ->toDateTime()
                ->format(
                    "Y-m-d H:i:s"
                );
    }


    $updatedAt = null;

    if (
        isset($withdrawal["updated_at"]) &&
        $withdrawal["updated_at"]
            instanceof MongoDB\BSON\UTCDateTime
    ) {

        $updatedAt =
            $withdrawal["updated_at"]
                ->toDateTime()
                ->format(
                    "Y-m-d H:i:s"
                );
    }


    $amount = 0;


    if (isset($withdrawal["amount"])) {

        if (
            $withdrawal["amount"]
                instanceof MongoDB\BSON\Decimal128
        ) {

            $amount =
                (float)$withdrawal["amount"]
                    ->toString();

        } else {

            $amount =
                (float)$withdrawal["amount"];
        }
    }


    $withdrawalList[] = [

        "id" =>
            isset($withdrawal["_id"])
                ? (string)$withdrawal["_id"]
                : "",

        "amount" =>
            $amount,

        "payment_method" =>
            (string)(
                $withdrawal["payment_method"]
                ?? ""
            ),

        "phone" =>
            (string)(
                $withdrawal["phone"]
                ?? ""
            ),

        "status" =>
            (string)(
                $withdrawal["status"]
                ?? "pending"
            ),

        "created_at" =>
            $createdAt,

        "updated_at" =>
            $updatedAt

    ];
}


/*
|--------------------------------------------------------------------------
| SUCCESS
|--------------------------------------------------------------------------
*/

echo json_encode([

    "success" => true,

    "withdrawals" =>
        $withdrawalList

]);

exit;
?>