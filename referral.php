<?php

/*
|--------------------------------------------------------------------------
| Crown Cash — Referral API
|--------------------------------------------------------------------------
| Returns referral information for the logged-in user.
| Referral commissions are kept server-side.
|--------------------------------------------------------------------------
*/

header("Content-Type: application/json; charset=UTF-8");

/*
|--------------------------------------------------------------------------
| CORS
|--------------------------------------------------------------------------
*/

$allowedOrigin = "https://crown-cash.vercel.app";

if (
    isset($_SERVER["HTTP_ORIGIN"]) &&
    $_SERVER["HTTP_ORIGIN"] === $allowedOrigin
) {
    header(
        "Access-Control-Allow-Origin: " .
        $allowedOrigin
    );
}

header("Access-Control-Allow-Credentials: true");
header(
    "Access-Control-Allow-Methods: GET, OPTIONS"
);
header(
    "Access-Control-Allow-Headers: Content-Type, Accept"
);


/*
|--------------------------------------------------------------------------
| OPTIONS
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
| Session
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
| Authentication
|--------------------------------------------------------------------------
*/

if (
    empty($_SESSION["logged_in"]) ||
    empty($_SESSION["user_id"])
) {

    http_response_code(401);

    echo json_encode([
        "success" => false,
        "message" => "Please log in to view your referrals."
    ]);

    exit;
}


/*
|--------------------------------------------------------------------------
| MongoDB
|--------------------------------------------------------------------------
*/

try {

    require_once __DIR__ . "/config.php";

} catch (Throwable $e) {

    error_log(
        "CROWN CASH REFERRAL CONFIG ERROR: " .
        $e->getMessage()
    );

    http_response_code(500);

    echo json_encode([
        "success" => false,
        "message" => "Database connection failed."
    ]);

    exit;
}


/*
|--------------------------------------------------------------------------
| ObjectId
|--------------------------------------------------------------------------
*/

try {

    $userId = new MongoDB\BSON\ObjectId(
        (string)$_SESSION["user_id"]
    );

} catch (Throwable $e) {

    http_response_code(400);

    echo json_encode([
        "success" => false,
        "message" => "Invalid user account."
    ]);

    exit;
}


/*
|--------------------------------------------------------------------------
| Main referral processing
|--------------------------------------------------------------------------
*/

try {

    /*
    |--------------------------------------------------------------------------
    | Find logged-in user
    |--------------------------------------------------------------------------
    */

    $user = $users->findOne([
        "_id" => $userId
    ]);

    if ($user === null) {

        http_response_code(404);

        echo json_encode([
            "success" => false,
            "message" => "User account not found."
        ]);

        exit;
    }


    /*
    |--------------------------------------------------------------------------
    | Get user's referral code
    |--------------------------------------------------------------------------
    */

    $referralCode =
        (string)(
            $user["referral_code"] ??
            $user["referralCode"] ??
            $user["referral"] ??
            ""
        );


    /*
    |--------------------------------------------------------------------------
    | Find people referred by this user
    |--------------------------------------------------------------------------
    */

    $orConditions = [];


    if ($referralCode !== "") {

        $orConditions[] = [
            "referred_by" => $referralCode
        ];

        $orConditions[] = [
            "referral_code_used" => $referralCode
        ];

        $orConditions[] = [
            "referralCodeUsed" => $referralCode
        ];

        $orConditions[] = [
            "referrer_code" => $referralCode
        ];

        $orConditions[] = [
            "referredBy" => $referralCode
        ];
    }


    /*
    |--------------------------------------------------------------------------
    | Also search referral collection
    |--------------------------------------------------------------------------
    */

    $referralRecords = [];


    if (
        $referralCode !== "" &&
        isset($referrals)
    ) {

        try {

            $cursor = $referrals->find(
                [
                    "referrer_id" => $userId
                ],
                [
                    "sort" => [
                        "created_at" => -1
                    ],
                    "limit" => 100
                ]
            );

            foreach ($cursor as $record) {

                $referralRecords[] = $record;
            }

        } catch (Throwable $e) {

            error_log(
                "CROWN CASH REFERRAL COLLECTION ERROR: " .
                $e->getMessage()
            );
        }
    }


    /*
    |--------------------------------------------------------------------------
    | Collect referred user IDs
    |--------------------------------------------------------------------------
    */

    $referredUserIds = [];

    foreach ($referralRecords as $record) {

        if (
            isset($record["referred_user_id"]) &&
            $record["referred_user_id"]
                instanceof MongoDB\BSON\ObjectId
        ) {

            $referredUserIds[] =
                $record["referred_user_id"];
        }
    }


    /*
    |--------------------------------------------------------------------------
    | Find users by referral code
    |--------------------------------------------------------------------------
    */

    $members = [];


    if (!empty($orConditions)) {

        $cursor = $users->find(
            [
                "$or" => $orConditions,
                "_id" => [
                    "$ne" => $userId
                ]
            ],
            [
                "sort" => [
                    "created_at" => -1
                ],
                "limit" => 100
            ]
        );

        foreach ($cursor as $member) {

            $members[] = $member;
        }
    }


    /*
    |--------------------------------------------------------------------------
    | Find users from referral records
    |--------------------------------------------------------------------------
    */

    if (!empty($referredUserIds)) {

        $cursor = $users->find(
            [
                "_id" => [
                    "$in" => $referredUserIds,
                    "$ne" => $userId
                ]
            ]
        );

        foreach ($cursor as $member) {

            $members[] = $member;
        }
    }


    /*
    |--------------------------------------------------------------------------
    | Remove duplicates
    |--------------------------------------------------------------------------
    */

    $uniqueMembers = [];

    foreach ($members as $member) {

        if (!isset($member["_id"])) {
            continue;
        }

        $memberId =
            (string)$member["_id"];

        $uniqueMembers[$memberId] =
            $member;
    }


    /*
    |--------------------------------------------------------------------------
    | Prepare response members
    |--------------------------------------------------------------------------
    */

    $responseMembers = [];

    foreach ($uniqueMembers as $member) {

        $firstName =
            (string)(
                $member["first_name"] ??
                $member["firstName"] ??
                ""
            );

        $lastName =
            (string)(
                $member["last_name"] ??
                $member["lastName"] ??
                ""
            );

        $fullName =
            (string)(
                $member["full_name"] ??
                $member["fullName"] ??
                ""
            );


        if ($fullName === "") {

            $fullName =
                trim(
                    $firstName .
                    " " .
                    $lastName
                );
        }


        if ($fullName === "") {

            $fullName = "Crown Cash Member";
        }


        $status =
            strtolower(
                (string)(
                    $member["status"] ??
                    "active"
                )
            );


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
                        "Y-m-d\TH:i:s\Z"
                    );
        }


        $responseMembers[] = [

            "id" =>
                (string)$member["_id"],

            "name" =>
                $fullName,

            "first_name" =>
                $firstName,

            "last_name" =>
                $lastName,

            "status" =>
                $status,

            "created_at" =>
                $createdAt
        ];
    }


    /*
    |--------------------------------------------------------------------------
    | Statistics
    |--------------------------------------------------------------------------
    */

    $totalReferrals =
        count($responseMembers);

    $activeMembers = 0;


    foreach ($responseMembers as $member) {

        if (
            $member["status"] === "active"
        ) {

            $activeMembers++;
        }
    }


    /*
    |--------------------------------------------------------------------------
    | Referral earnings
    |--------------------------------------------------------------------------
    */

    $referralEarnings = 0;


    if (isset($user["referral_earnings"])) {

        $referralEarnings =
            $user["referral_earnings"];

    } elseif (isset($user["referralEarnings"])) {

        $referralEarnings =
            $user["referralEarnings"];
    }


    /*
    |--------------------------------------------------------------------------
    | Convert Decimal128 safely
    |--------------------------------------------------------------------------
    */

    if (
        $referralEarnings
        instanceof MongoDB\BSON\Decimal128
    ) {

        $referralEarnings =
            (float)$referralEarnings
                ->__toString();
    }


    $referralEarnings =
        (float)$referralEarnings;


    /*
    |--------------------------------------------------------------------------
    | Return result
    |--------------------------------------------------------------------------
    */

    echo json_encode([

        "success" => true,

        "referral_code" =>
            $referralCode,

        "total_referrals" =>
            $totalReferrals,

        "active_members" =>
            $activeMembers,

        "referral_earnings" =>
            $referralEarnings,

        "members" =>
            $responseMembers

    ]);

    exit;


} catch (Throwable $e) {

    error_log(
        "CROWN CASH REFERRAL ERROR: " .
        $e->getMessage()
    );

    http_response_code(500);

    echo json_encode([

        "success" => false,

        "message" =>
            "Unable to load referral information."

    ]);

    exit;
}
?>
