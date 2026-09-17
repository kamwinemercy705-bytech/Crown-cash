<?php

/*
|--------------------------------------------------------------------------
| Crown Cash — Referral Team API
|--------------------------------------------------------------------------
*/

require_once __DIR__ . "/config.php";

/*
|--------------------------------------------------------------------------
| Session configuration
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

header(
    "Content-Type: application/json; charset=UTF-8"
);


/*
|--------------------------------------------------------------------------
| Handle OPTIONS request
|--------------------------------------------------------------------------
*/

if ($_SERVER["REQUEST_METHOD"] === "OPTIONS") {

    http_response_code(204);

    exit;
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


/*
|--------------------------------------------------------------------------
| Check login
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
| Convert session ID to MongoDB ObjectId
|--------------------------------------------------------------------------
*/

try {

    $userId = new MongoDB\BSON\ObjectId(
        (string) $_SESSION["user_id"]
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
| Find current user
|--------------------------------------------------------------------------
*/

try {

    $currentUser = $users->findOne([
        "_id" => $userId
    ]);


    if (!$currentUser) {

        http_response_code(404);

        echo json_encode([
            "success" => false,
            "message" => "User account not found."
        ]);

        exit;
    }


    /*
    |--------------------------------------------------------------------------
    | Get current user's referral code
    |--------------------------------------------------------------------------
    */

    $myReferralCode =
        $currentUser["referral_code"]
        ?? $currentUser["referralCode"]
        ?? $currentUser["referral"]
        ?? "";


    $myReferralCode =
        trim((string) $myReferralCode);


    /*
    |--------------------------------------------------------------------------
    | Prepare search conditions
    |--------------------------------------------------------------------------
    |
    | We support several possible field names so that this API can
    | work with older Crown Cash user records too.
    |
    */

    $orConditions = [];


    if ($myReferralCode !== "") {

        $orConditions[] = [
            "referred_by" => $myReferralCode
        ];

        $orConditions[] = [
            "referral_code_used" => $myReferralCode
        ];

        $orConditions[] = [
            "referralCodeUsed" => $myReferralCode
        ];

        $orConditions[] = [
            "referrer_code" => $myReferralCode
        ];

        $orConditions[] = [
            "referredBy" => $myReferralCode
        ];
    }


    /*
    |--------------------------------------------------------------------------
    | Search by referrer user ID where supported
    |--------------------------------------------------------------------------
    */

    $orConditions[] = [
        "referrer_id" => $userId
    ];

    $orConditions[] = [
        "referred_by_user_id" => $userId
    ];

    $orConditions[] = [
        "referrerId" => $userId
    ];


    /*
    |--------------------------------------------------------------------------
    | If there is no possible referral identifier
    |--------------------------------------------------------------------------
    */

    if (empty($orConditions)) {

        echo json_encode([

            "success" => true,

            "total_referrals" => 0,

            "active_members" => 0,

            "referral_earnings" => 0,

            "members" => []

        ]);

        exit;
    }


    /*
    |--------------------------------------------------------------------------
    | Find referred users
    |--------------------------------------------------------------------------
    |
    | Exclude the current user to prevent accidental self-display.
    |
    */

    $cursor = $users->find(

        [
            "_id" => [
                '$ne' => $userId
            ],

            '$or' => $orConditions
        ],

        [
            "sort" => [
                "created_at" => -1
            ],

            "limit" => 100
        ]

    );


    /*
    |--------------------------------------------------------------------------
    | Prepare response
    |--------------------------------------------------------------------------
    */

    $members = [];


    foreach ($cursor as $member) {

        /*
        |--------------------------------------------------------------------------
        | Member ID
        |--------------------------------------------------------------------------
        */

        $memberId =
            isset($member["_id"])
            ? (string) $member["_id"]
            : "";


        /*
        |--------------------------------------------------------------------------
        | First name
        |--------------------------------------------------------------------------
        */

        $firstName =
            $member["first_name"]
            ?? $member["firstName"]
            ?? "";


        /*
        |--------------------------------------------------------------------------
        | Last name
        |--------------------------------------------------------------------------
        */

        $lastName =
            $member["last_name"]
            ?? $member["lastName"]
            ?? "";


        /*
        |--------------------------------------------------------------------------
        | Full name
        |--------------------------------------------------------------------------
        */

        $fullName =
            $member["full_name"]
            ?? $member["fullName"]
            ?? $member["name"]
            ?? "";


        $firstName =
            trim((string) $firstName);

        $lastName =
            trim((string) $lastName);

        $fullName =
            trim((string) $fullName);


        /*
        |--------------------------------------------------------------------------
        | Build member name
        |--------------------------------------------------------------------------
        */

        if ($fullName !== "") {

            $displayName = $fullName;

        } elseif (
            $firstName !== "" ||
            $lastName !== ""
        ) {

            $displayName =
                trim(
                    $firstName .
                    " " .
                    $lastName
                );

        } else {

            $displayName =
                "Crown Cash Member";
        }


        /*
        |--------------------------------------------------------------------------
        | Member status
        |--------------------------------------------------------------------------
        */

        $status =
            $member["status"]
            ?? $member["account_status"]
            ?? "active";


        $status =
            strtolower(
                trim((string) $status)
            );


        /*
        |--------------------------------------------------------------------------
        | Normalize status
        |--------------------------------------------------------------------------
        */

        if (
            $status !== "active" &&
            $status !== "pending" &&
            $status !== "blocked" &&
            $status !== "suspended" &&
            $status !== "disabled"
        ) {

            $status = "active";
        }


        /*
        |--------------------------------------------------------------------------
        | Created date
        |--------------------------------------------------------------------------
        */

        $createdAt = null;


        if (
            isset($member["created_at"]) &&
            $member["created_at"]
                instanceof MongoDB\BSON\UTCDateTime
        ) {

            $createdAt =
                $member["created_at"]
                    ->toDateTime()
                    ->format(
                        DateTimeInterface::ATOM
                    );

        } elseif (
            isset($member["createdAt"]) &&
            $member["createdAt"]
                instanceof MongoDB\BSON\UTCDateTime
        ) {

            $createdAt =
                $member["createdAt"]
                    ->toDateTime()
                    ->format(
                        DateTimeInterface::ATOM
                    );
        }


        /*
        |--------------------------------------------------------------------------
        | Add member
        |--------------------------------------------------------------------------
        */

        $members[] = [

            "id" => $memberId,

            "name" => $displayName,

            "first_name" => $firstName,

            "last_name" => $lastName,

            "status" => $status,

            "created_at" => $createdAt

        ];
    }


    /*
    |--------------------------------------------------------------------------
    | Count referrals
    |--------------------------------------------------------------------------
    */

    $totalReferrals =
        count($members);


    /*
    |--------------------------------------------------------------------------
    | Count active members
    |--------------------------------------------------------------------------
    */

    $activeMembers = 0;


    foreach ($members as $member) {

        if (
            strtolower(
                (string) $member["status"]
            ) === "active"
        ) {

            $activeMembers++;

        }
    }


    /*
    |--------------------------------------------------------------------------
    | Referral earnings
    |--------------------------------------------------------------------------
    |
    | For now this reads an earnings field from the current user.
    | It does NOT automatically create or credit money.
    |
    */

    $referralEarnings =
        $currentUser["referral_earnings"]
        ?? $currentUser["referralEarnings"]
        ?? 0;


    if (
        $referralEarnings
            instanceof MongoDB\BSON\Decimal128
    ) {

        $referralEarnings =
            (float)
            $referralEarnings->toString();

    } else {

        $referralEarnings =
            (float) $referralEarnings;
    }


    /*
    |--------------------------------------------------------------------------
    | Return response
    |--------------------------------------------------------------------------
    */

    echo json_encode([

        "success" => true,

        "total_referrals" =>
            $totalReferrals,

        "active_members" =>
            $activeMembers,

        "referral_earnings" =>
            $referralEarnings,

        "members" =>
            $members

    ]);

} catch (Throwable $e) {

    /*
    |--------------------------------------------------------------------------
    | Log technical error
    |--------------------------------------------------------------------------
    */

    error_log(
        "CROWN CASH TEAM ERROR: " .
        $e->getMessage()
    );


    /*
    |--------------------------------------------------------------------------
    | Return safe error
    |--------------------------------------------------------------------------
    */

    http_response_code(500);

    echo json_encode([

        "success" => false,

        "message" =>
            "Unable to load referral team."

    ]);
}

?>