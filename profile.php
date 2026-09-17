<?php

/*
|--------------------------------------------------------------------------
| CROWN CASH - PROFILE API
|--------------------------------------------------------------------------
*/


/*
|--------------------------------------------------------------------------
| CROSS-SITE SESSION COOKIE
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
| HEADERS
|--------------------------------------------------------------------------
*/

header("Content-Type: application/json");

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


/*
|--------------------------------------------------------------------------
| OPTIONS REQUEST
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
| CHECK LOGIN SESSION
|--------------------------------------------------------------------------
*/

if (
    !isset($_SESSION["logged_in"]) ||
    $_SESSION["logged_in"] !== true ||
    !isset($_SESSION["user_id"])
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
| DATABASE
|--------------------------------------------------------------------------
*/

require_once __DIR__ . "/config.php";


/*
|--------------------------------------------------------------------------
| FIND USER
|--------------------------------------------------------------------------
*/

try {

    $userId = new MongoDB\BSON\ObjectId(
        $_SESSION["user_id"]
    );


    $user = $users->findOne([
        "_id" => $userId
    ]);


    /*
    |--------------------------------------------------------------------------
    | USER NOT FOUND
    |--------------------------------------------------------------------------
    */

    if (!$user) {

        http_response_code(404);

        echo json_encode([
            "success" => false,
            "message" => "User account was not found."
        ]);

        exit;
    }


    /*
    |--------------------------------------------------------------------------
    | FIRST NAME
    |--------------------------------------------------------------------------
    |
    | Supports:
    | first_name
    | firstname
    | firstName
    |
    */

    $firstName = "";

    if (!empty($user["first_name"])) {

        $firstName =
            (string)$user["first_name"];

    } elseif (!empty($user["firstname"])) {

        $firstName =
            (string)$user["firstname"];

    } elseif (!empty($user["firstName"])) {

        $firstName =
            (string)$user["firstName"];
    }


    /*
    |--------------------------------------------------------------------------
    | LAST NAME
    |--------------------------------------------------------------------------
    */

    $lastName = "";

    if (!empty($user["last_name"])) {

        $lastName =
            (string)$user["last_name"];

    } elseif (!empty($user["lastname"])) {

        $lastName =
            (string)$user["lastname"];

    } elseif (!empty($user["lastName"])) {

        $lastName =
            (string)$user["lastName"];
    }


    /*
    |--------------------------------------------------------------------------
    | FULL NAME
    |--------------------------------------------------------------------------
    */

    $fullName = "";

    if (!empty($user["full_name"])) {

        $fullName =
            trim((string)$user["full_name"]);

    } elseif (!empty($user["fullName"])) {

        $fullName =
            trim((string)$user["fullName"]);

    } elseif ($firstName !== "" || $lastName !== "") {

        $fullName =
            trim(
                $firstName . " " . $lastName
            );
    }


    /*
    |--------------------------------------------------------------------------
    | IF ONLY FULL NAME EXISTS
    |--------------------------------------------------------------------------
    */

    if (
        $fullName !== "" &&
        $firstName === "" &&
        $lastName === ""
    ) {

        $nameParts = preg_split(
            "/\s+/",
            $fullName,
            -1,
            PREG_SPLIT_NO_EMPTY
        );


        $firstName =
            $nameParts[0] ?? "";


        if (count($nameParts) > 1) {

            $lastName =
                implode(
                    " ",
                    array_slice(
                        $nameParts,
                        1
                    )
                );
        }
    }


    /*
    |--------------------------------------------------------------------------
    | EMAIL
    |--------------------------------------------------------------------------
    */

    $email =
        (string)($user["email"] ?? "");


    /*
    |--------------------------------------------------------------------------
    | PHONE
    |--------------------------------------------------------------------------
    */

    $phone = "";

    if (!empty($user["phone"])) {

        $phone =
            (string)$user["phone"];

    } elseif (!empty($user["phone_number"])) {

        $phone =
            (string)$user["phone_number"];

    } elseif (!empty($user["phoneNumber"])) {

        $phone =
            (string)$user["phoneNumber"];
    }


    /*
    |--------------------------------------------------------------------------
    | REFERRAL CODE
    |--------------------------------------------------------------------------
    */

    $referralCode = "";

    if (!empty($user["referral_code"])) {

        $referralCode =
            (string)$user["referral_code"];

    } elseif (!empty($user["referralCode"])) {

        $referralCode =
            (string)$user["referralCode"];
    }


    /*
    |--------------------------------------------------------------------------
    | BALANCE
    |--------------------------------------------------------------------------
    */

    $balance = 0;


    if (isset($user["balance"])) {

        if (
            $user["balance"]
            instanceof MongoDB\BSON\Decimal128
        ) {

            $balance =
                (float)$user["balance"]
                    ->__toString();

        } else {

            $balance =
                (float)$user["balance"];
        }

    } elseif (isset($user["wallet_balance"])) {

        if (
            $user["wallet_balance"]
            instanceof MongoDB\BSON\Decimal128
        ) {

            $balance =
                (float)$user["wallet_balance"]
                    ->__toString();

        } else {

            $balance =
                (float)$user["wallet_balance"];
        }
    }


    /*
    |--------------------------------------------------------------------------
    | ACCOUNT STATUS
    |--------------------------------------------------------------------------
    */

    $status =
        strtolower(
            (string)(
                $user["status"]
                ?? "active"
            )
        );


    /*
    |--------------------------------------------------------------------------
    | ACCOUNT TYPE
    |--------------------------------------------------------------------------
    */

    $accountType =
        strtolower(
            (string)(
                $user["account_type"]
                ?? "user"
            )
        );


    /*
    |--------------------------------------------------------------------------
    | CREATED DATE
    |--------------------------------------------------------------------------
    */

    $createdAt = "";


    if (isset($user["created_at"])) {

        if (
            $user["created_at"]
            instanceof MongoDB\BSON\UTCDateTime
        ) {

            $createdAt =
                $user["created_at"]
                    ->toDateTime()
                    ->format("Y-m-d");

        } else {

            $createdAt =
                (string)$user["created_at"];
        }
    }


    /*
    |--------------------------------------------------------------------------
    | RETURN USER DATA
    |--------------------------------------------------------------------------
    */

    echo json_encode([

        "success" => true,

        "user" => [

            "first_name" =>
                $firstName,

            "last_name" =>
                $lastName,

            "full_name" =>
                $fullName,

            "email" =>
                $email,

            "phone" =>
                $phone,

            "referral_code" =>
                $referralCode,

            "balance" =>
                $balance,

            "status" =>
                $status,

            "account_type" =>
                $accountType,

            "created_at" =>
                $createdAt
        ]

    ]);

} catch (
    MongoDB\Driver\Exception\Exception $e
) {

    http_response_code(500);

    echo json_encode([
        "success" => false,
        "message" => "Database error."
    ]);

} catch (Exception $e) {

    http_response_code(500);

    echo json_encode([
        "success" => false,
        "message" => "Unable to load profile."
    ]);
}

?>