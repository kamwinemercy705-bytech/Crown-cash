<?php

/* =========================================================
   CROWN CASH - REFERRAL API
   ========================================================= */

declare(strict_types=1);


/* =========================================================
   CORS
   ========================================================= */

header("Access-Control-Allow-Origin: https://crown-cash.vercel.app");
header("Access-Control-Allow-Credentials: true");
header("Access-Control-Allow-Methods: GET, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Accept");
header("Content-Type: application/json; charset=UTF-8");


/* =========================================================
   PREFLIGHT
   ========================================================= */

if ($_SERVER["REQUEST_METHOD"] === "OPTIONS") {
    http_response_code(204);
    exit;
}


/* =========================================================
   METHOD CHECK
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
   CHECK LOGIN
   ========================================================= */

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


/* =========================================================
   LOAD DATABASE
   ========================================================= */

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
        "message" => "Database configuration failed."
    ]);

    exit;
}


/* =========================================================
   CHECK USERS COLLECTION
   ========================================================= */

if (!isset($users)) {

    http_response_code(500);

    echo json_encode([
        "success" => false,
        "message" => "Users collection is not configured."
    ]);

    exit;
}


/* =========================================================
   MONGODB
   ========================================================= */

try {

    $userId = new MongoDB\BSON\ObjectId(
        (string)$_SESSION["user_id"]
    );

} catch (Throwable $e) {

    http_response_code(400);

    echo json_encode([
        "success" => false,
        "message" => "Invalid user session."
    ]);

    exit;
}


/* =========================================================
   HELPER: DECIMAL / NUMBER
   ========================================================= */

function crownCashNumber(mixed $value): float
{
    if ($value === null) {
        return 0.0;
    }

    if ($value instanceof MongoDB\BSON\Decimal128) {
        return (float)$value->__toString();
    }

    if ($value instanceof MongoDB\BSON\Int64) {
        return (float)$value->__toString();
    }

    if (is_numeric($value)) {
        return (float)$value;
    }

    return 0.0;
}


/* =========================================================
   HELPER: DATE
   ========================================================= */

function crownCashDate(mixed $value): ?string
{
    try {

        if ($value instanceof MongoDB\BSON\UTCDateTime) {

            return $value
                ->toDateTime()
                ->format(DATE_ATOM);
        }

        if ($value instanceof DateTimeInterface) {

            return $value->format(DATE_ATOM);
        }

        if (is_string($value) && $value !== "") {

            $date = new DateTime($value);

            return $date->format(DATE_ATOM);
        }

    } catch (Throwable $e) {
        return null;
    }

    return null;
}


/* =========================================================
   HELPER: NORMALIZE PHONE
   ========================================================= */

function crownCashPhone(mixed $phone): string
{
    if ($phone === null) {
        return "";
    }

    return trim((string)$phone);
}


/* =========================================================
   HELPER: USER NAME
   ========================================================= */

function crownCashUserName(array $user): string
{
    $fullName =
        $user["full_name"] ??
        $user["fullName"] ??
        "";

    if (!empty($fullName)) {
        return trim((string)$fullName);
    }

    $firstName =
        $user["first_name"] ??
        $user["firstName"] ??
        "";

    $lastName =
        $user["last_name"] ??
        $user["lastName"] ??
        "";

    $name =
        trim(
            (string)$firstName .
            " " .
            (string)$lastName
        );

    if ($name !== "") {
        return $name;
    }

    return "Crown Cash Member";
}


/* =========================================================
   HELPER: FIND USER REFERRER
   ========================================================= */

function crownCashReferralCode(array $user): string
{
    return strtoupper(
        trim(
            (string)(
                $user["referral_code"] ??
                $user["referralCode"] ??
                ""
            )
        )
    );
}


/* =========================================================
   HELPER: FIND USER'S REFERRER
   =========================================================
   
   Crown Cash can recognize several common field names.
   This makes the API compatible with different versions
   of the registration backend.
   ========================================================= */

function crownCashReferrerId(array $user): ?string
{
    $possibleFields = [
        "referrer_id",
        "referred_by_id",
        "parent_id",
        "sponsor_id",
        "upline_id"
    ];

    foreach ($possibleFields as $field) {

        if (!isset($user[$field])) {
            continue;
        }

        $value = $user[$field];

        if ($value instanceof MongoDB\BSON\ObjectId) {
            return (string)$value;
        }

        if (is_string($value) && $value !== "") {
            return $value;
        }
    }

    return null;
}


/* =========================================================
   HELPER: FIND REFERRER CODE USED
   ========================================================= */

function crownCashUsedReferralCode(array $user): string
{
    $possibleFields = [
        "referred_by",
        "referrer_code",
        "sponsor_code",
        "parent_referral_code",
        "used_referral_code",
        "referredBy"
    ];

    foreach ($possibleFields as $field) {

        if (
            isset($user[$field]) &&
            is_string($user[$field]) &&
            trim($user[$field]) !== ""
        ) {

            return strtoupper(
                trim($user[$field])
            );
        }
    }

    return "";
}


/* =========================================================
   HELPER: GET STORED REFERRAL EARNING
   =========================================================
   
   We only use stored/verified earning fields here.
   This API does NOT invent income from registration.
   ========================================================= */

function crownCashStoredEarning(array $user, string $level): float
{
    $fieldGroups = [

        "L1" => [
            "referral_income_l1",
            "level1_income",
            "referral_earnings_l1",
            "l1_income",
            "l1_earnings"
        ],

        "L2" => [
            "referral_income_l2",
            "level2_income",
            "referral_earnings_l2",
            "l2_income",
            "l2_earnings"
        ],

        "L3" => [
            "referral_income_l3",
            "level3_income",
            "referral_earnings_l3",
            "l3_income",
            "l3_earnings"
        ]

    ];

    foreach ($fieldGroups[$level] as $field) {

        if (array_key_exists($field, $user)) {

            return crownCashNumber(
                $user[$field]
            );
        }
    }

    return 0.0;
}


/* =========================================================
   LOAD CURRENT USER
   ========================================================= */

try {

    $currentUser =
        $users->findOne([
            "_id" => $userId
        ]);

} catch (Throwable $e) {

    error_log(
        "CROWN CASH REFERRAL USER ERROR: " .
        $e->getMessage()
    );

    http_response_code(500);

    echo json_encode([
        "success" => false,
        "message" => "Unable to load your referral account."
    ]);

    exit;
}


if (!$currentUser) {

    http_response_code(404);

    echo json_encode([
        "success" => false,
        "message" => "User account was not found."
    ]);

    exit;
}


/* =========================================================
   CURRENT USER REFERRAL CODE
   ========================================================= */

$myReferralCode =
    crownCashReferralCode(
        $currentUser
    );


/*
   Some older accounts may not have a referral code.
*/

if ($myReferralCode === "") {

    $myReferralCode =
        "CC" .
        strtoupper(
            substr(
                md5((string)$userId),
                0,
                8
            )
        );

}


/* =========================================================
   REFERRAL LINK
   ========================================================= */

$referralLink =
    "https://crown-cash.vercel.app/" .
    "?ref=" .
    rawurlencode($myReferralCode);


/* =========================================================
   FIND ALL USERS
   =========================================================

   We retrieve the fields needed for the three-level
   referral tree.

   The result is limited to a reasonable number for the
   referral page. For a very large platform, this should
   eventually be replaced by MongoDB aggregation/indexes.
   ========================================================= */

try {

    $cursor = $users->find(
        [],
        [
            "projection" => [
                "_id" => 1,

                "first_name" => 1,
                "last_name" => 1,
                "firstName" => 1,
                "lastName" => 1,
                "full_name" => 1,
                "fullName" => 1,

                "phone" => 1,
                "phone_number" => 1,

                "referral_code" => 1,
                "referralCode" => 1,

                "referrer_id" => 1,
                "referred_by_id" => 1,
                "parent_id" => 1,
                "sponsor_id" => 1,
                "upline_id" => 1,

                "referred_by" => 1,
                "referrer_code" => 1,
                "sponsor_code" => 1,
                "parent_referral_code" => 1,
                "used_referral_code" => 1,
                "referredBy" => 1,

                "created_at" => 1,
                "joined_at" => 1,

                "referral_income_l1" => 1,
                "referral_income_l2" => 1,
                "referral_income_l3" => 1,

                "level1_income" => 1,
                "level2_income" => 1,
                "level3_income" => 1,

                "referral_earnings_l1" => 1,
                "referral_earnings_l2" => 1,
                "referral_earnings_l3" => 1,

                "l1_income" => 1,
                "l2_income" => 1,
                "l3_income" => 1,

                "l1_earnings" => 1,
                "l2_earnings" => 1,
                "l3_earnings" => 1
            ]
        ]
    );

    $allUsers = iterator_to_array(
        $cursor,
        false
    );

} catch (Throwable $e) {

    error_log(
        "CROWN CASH REFERRAL USERS ERROR: " .
        $e->getMessage()
    );

    http_response_code(500);

    echo json_encode([
        "success" => false,
        "message" => "Unable to load referral network."
    ]);

    exit;
}


/* =========================================================
   BUILD USER INDEXES
   ========================================================= */

$usersById = [];

$usersByReferralCode = [];


foreach ($allUsers as $user) {

    if (!isset($user["_id"])) {
        continue;
    }

    $id = (string)$user["_id"];

    $usersById[$id] = $user;


    $code =
        crownCashReferralCode(
            $user
        );

    if ($code !== "") {

        $usersByReferralCode[$code] = $user;
    }
}


/* =========================================================
   FIND DIRECT REFERRALS - L1
   ========================================================= */

$level1 = [];

foreach ($allUsers as $user) {

    if (!isset($user["_id"])) {
        continue;
    }

    $candidateId =
        (string)$user["_id"];


    /*
       Never include the current user as a referral.
    */

    if ($candidateId === (string)$userId) {
        continue;
    }


    /*
       Method 1:
       User stores the referrer ObjectId.
    */

    $referrerId =
        crownCashReferrerId(
            $user
        );

    if (
        $referrerId !== null &&
        $referrerId === (string)$userId
    ) {

        $level1[$candidateId] = $user;

        continue;
    }


    /*
       Method 2:
       User stores the referral code used during registration.
    */

    $usedCode =
        crownCashUsedReferralCode(
            $user
        );

    if (
        $usedCode !== "" &&
        $usedCode === $myReferralCode
    ) {

        $level1[$candidateId] = $user;
    }

}


/* =========================================================
   FIND L2
   ========================================================= */

$level2 = [];


foreach ($level1 as $l1User) {

    $l1Id =
        (string)$l1User["_id"];

    $l1Code =
        crownCashReferralCode(
            $l1User
        );


    foreach ($allUsers as $user) {

        if (!isset($user["_id"])) {
            continue;
        }

        $candidateId =
            (string)$user["_id"];


        if (
            $candidateId === (string)$userId ||
            isset($level1[$candidateId])
        ) {
            continue;
        }


        /*
           Check ObjectId-style referral relationship.
        */

        $referrerId =
            crownCashReferrerId(
                $user
            );

        if (
            $referrerId !== null &&
            $referrerId === $l1Id
        ) {

            $level2[$candidateId] = $user;

            continue;
        }


        /*
           Check referral-code-style relationship.
        */

        $usedCode =
            crownCashUsedReferralCode(
                $user
            );

        if (
            $l1Code !== "" &&
            $usedCode !== "" &&
            $usedCode === $l1Code
        ) {

            $level2[$candidateId] = $user;
        }

    }

}


/* =========================================================
   FIND L3
   ========================================================= */

$level3 = [];


foreach ($level2 as $l2User) {

    $l2Id =
        (string)$l2User["_id"];

    $l2Code =
        crownCashReferralCode(
            $l2User
        );


    foreach ($allUsers as $user) {

        if (!isset($user["_id"])) {
            continue;
        }

        $candidateId =
            (string)$user["_id"];


        if (
            $candidateId === (string)$userId ||
            isset($level1[$candidateId]) ||
            isset($level2[$candidateId])
        ) {
            continue;
        }


        /*
           ObjectId relationship.
        */

        $referrerId =
            crownCashReferrerId(
                $user
            );

        if (
            $referrerId !== null &&
            $referrerId === $l2Id
        ) {

            $level3[$candidateId] = $user;

            continue;
        }


        /*
           Referral-code relationship.
        */

        $usedCode =
            crownCashUsedReferralCode(
                $user
            );

        if (
            $l2Code !== "" &&
            $usedCode !== "" &&
            $usedCode === $l2Code
        ) {

            $level3[$candidateId] = $user;
        }

    }

}


/* =========================================================
   BUILD TEAM MEMBERS
   ========================================================= */

$members = [];


/*
   Add L1 members.
*/

foreach ($level1 as $user) {

    $members[] = [

        "id" =>
            (string)$user["_id"],

        "name" =>
            crownCashUserName($user),

        "phone" =>
            crownCashPhone(
                $user["phone"] ??
                $user["phone_number"] ??
                ""
            ),

        "level" =>
            "L1",

        "created_at" =>
            crownCashDate(
                $user["created_at"] ??
                $user["joined_at"] ??
                null
            )

    ];

}


/*
   Add L2 members.
*/

foreach ($level2 as $user) {

    $members[] = [

        "id" =>
            (string)$user["_id"],

        "name" =>
            crownCashUserName($user),

        "phone" =>
            crownCashPhone(
                $user["phone"] ??
                $user["phone_number"] ??
                ""
            ),

        "level" =>
            "L2",

        "created_at" =>
            crownCashDate(
                $user["created_at"] ??
                $user["joined_at"] ??
                null
            )

    ];

}


/*
   Add L3 members.
*/

foreach ($level3 as $user) {

    $members[] = [

        "id" =>
            (string)$user["_id"],

        "name" =>
            crownCashUserName($user),

        "phone" =>
            crownCashPhone(
                $user["phone"] ??
                $user["phone_number"] ??
                ""
            ),

        "level" =>
            "L3",

        "created_at" =>
            crownCashDate(
                $user["created_at"] ??
                $user["joined_at"] ??
                null
            )

    ];

}


/* =========================================================
   COUNTS
   ========================================================= */

$level1Count =
    count($level1);

$level2Count =
    count($level2);

$level3Count =
    count($level3);

$totalTeam =
    $level1Count +
    $level2Count +
    $level3Count;


/* =========================================================
   REFERRAL EARNINGS
   =========================================================

   IMPORTANT:
   These values are read from stored referral-income
   fields only.

   This endpoint does NOT automatically award money simply
   because someone registered.

   A verified commission system should credit these values
   after the qualifying transaction/investment has actually
   been verified.
   ========================================================= */

$level1Income =
    crownCashStoredEarning(
        (array)$currentUser,
        "L1"
    );

$level2Income =
    crownCashStoredEarning(
        (array)$currentUser,
        "L2"
    );

$level3Income =
    crownCashStoredEarning(
        (array)$currentUser,
        "L3"
    );

$totalReferralIncome =
    $level1Income +
    $level2Income +
    $level3Income;


/* =========================================================
   COMMISSION STRUCTURE
   ========================================================= */

$commissionStructure = [

    "L1" => [
        "percentage" => 15,
        "description" => "Direct referrals"
    ],

    "L2" => [
        "percentage" => 5,
        "description" => "Second level"
    ],

    "L3" => [
        "percentage" => 2,
        "description" => "Third level"
    ]

];


/* =========================================================
   SORT TEAM MEMBERS
   ========================================================= */

usort(
    $members,
    function ($a, $b) {

        $dateA =
            $a["created_at"] ?? "";

        $dateB =
            $b["created_at"] ?? "";

        return strcmp(
            (string)$dateB,
            (string)$dateA
        );
    }
);


/* =========================================================
   RESPONSE
   ========================================================= */

$response = [

    "success" => true,

    "referral_code" =>
        $myReferralCode,

    "referral_link" =>
        $referralLink,

    "counts" => [

        "total" =>
            $totalTeam,

        "L1" =>
            $level1Count,

        "L2" =>
            $level2Count,

        "L3" =>
            $level3Count
    ],

    "team_counts" => [

        "total" =>
            $totalTeam,

        "L1" =>
            $level1Count,

        "L2" =>
            $level2Count,

        "L3" =>
            $level3Count
    ],

    "commission_structure" =>
        $commissionStructure,

    "earnings" => [

        "L1" =>
            $level1Income,

        "L2" =>
            $level2Income,

        "L3" =>
            $level3Income,

        "total" =>
            $totalReferralIncome
    ],

    "referral_earnings" => [

        "L1" =>
            $level1Income,

        "L2" =>
            $level2Income,

        "L3" =>
            $level3Income,

        "total" =>
            $totalReferralIncome
    ],

    "members" =>
        $members

];


http_response_code(200);

echo json_encode(
    $response,
    JSON_UNESCAPED_SLASHES |
    JSON_UNESCAPED_UNICODE
);

exit;

?>