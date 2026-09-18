<?php

// ============================================
// CROWN CASH - REFERRAL API
// File: referral.php
// ============================================

// --------------------------------------------
// CORS
// --------------------------------------------

header("Access-Control-Allow-Origin: https://crown-cash.vercel.app");
header("Access-Control-Allow-Credentials: true");
header("Access-Control-Allow-Headers: Content-Type");
header("Access-Control-Allow-Methods: GET, OPTIONS");
header("Content-Type: application/json; charset=UTF-8");


// --------------------------------------------
// PREFLIGHT
// --------------------------------------------

if ($_SERVER["REQUEST_METHOD"] === "OPTIONS") {
    http_response_code(204);
    exit;
}


// --------------------------------------------
// SESSION
// --------------------------------------------

session_set_cookie_params([
    "lifetime" => 0,
    "path" => "/",
    "secure" => true,
    "httponly" => true,
    "samesite" => "None"
]);

session_start();


// --------------------------------------------
// CHECK LOGIN
// --------------------------------------------

if (
    empty($_SESSION["logged_in"]) ||
    $_SESSION["logged_in"] !== true ||
    empty($_SESSION["user_id"])
) {
    http_response_code(401);

    echo json_encode([
        "success" => false,
        "message" => "You are not logged in."
    ]);

    exit;
}


// --------------------------------------------
// LOAD DATABASE
// --------------------------------------------

try {

    require_once __DIR__ . "/config.php";

} catch (Throwable $e) {

    http_response_code(500);

    echo json_encode([
        "success" => false,
        "message" => "Database configuration could not be loaded."
    ]);

    exit;
}


// --------------------------------------------
// CHECK USERS COLLECTION
// --------------------------------------------

if (!isset($users)) {

    http_response_code(500);

    echo json_encode([
        "success" => false,
        "message" => "Users collection is not configured."
    ]);

    exit;
}


// --------------------------------------------
// HELPER FUNCTIONS
// --------------------------------------------

function getReferralValue($user, $fields)
{
    foreach ($fields as $field) {

        if (
            isset($user[$field]) &&
            $user[$field] !== null &&
            $user[$field] !== ""
        ) {
            return $user[$field];
        }
    }

    return null;
}


function getUserIdString($user)
{
    if (!isset($user["_id"])) {
        return "";
    }

    return (string) $user["_id"];
}


function getUserName($user)
{
    $first = trim((string) ($user["first_name"] ?? ""));
    $last  = trim((string) ($user["last_name"] ?? ""));

    $full = trim((string) ($user["full_name"] ?? ""));

    if ($first || $last) {
        return trim($first . " " . $last);
    }

    if ($full) {
        return $full;
    }

    return "Crown Cash Member";
}


function getNumberValue($value)
{
    if ($value === null || $value === "") {
        return 0;
    }

    try {

        if ($value instanceof MongoDB\BSON\Decimal128) {
            return (float) $value->__toString();
        }

        if ($value instanceof MongoDB\BSON\Int64) {
            return (float) $value->__toString();
        }

        return (float) $value;

    } catch (Throwable $e) {

        return 0;
    }
}


// --------------------------------------------
// GET CURRENT USER
// --------------------------------------------

try {

    $currentUserId = (string) $_SESSION["user_id"];

    $objectId = null;

    try {

        $objectId = new MongoDB\BSON\ObjectId($currentUserId);

    } catch (Throwable $e) {

        $objectId = null;
    }


    // ----------------------------------------
    // FIND CURRENT USER
    // ----------------------------------------

    $currentUser = null;

    if ($objectId !== null) {

        $currentUser = $users->findOne([
            "_id" => $objectId
        ]);

    }


    // Fallback: try string ID
    if (!$currentUser) {

        $currentUser = $users->findOne([
            "_id" => $currentUserId
        ]);

    }


    if (!$currentUser) {

        http_response_code(404);

        echo json_encode([
            "success" => false,
            "message" => "Your Crown Cash account could not be found."
        ]);

        exit;
    }


    // ----------------------------------------
    // GET REFERRAL CODE
    // ----------------------------------------

    $referralCode = getReferralValue(
        $currentUser,
        [
            "referral_code",
            "referralCode",
            "code"
        ]
    );


    // ----------------------------------------
    // MAKE SURE CODE EXISTS
    // ----------------------------------------

    if (!$referralCode) {

        // Generate a referral code for older accounts
        $referralCode =
            "CC" .
            strtoupper(
                substr(
                    bin2hex(random_bytes(5)),
                    0,
                    8
                )
            );

        // Save it
        if ($objectId !== null) {

            $users->updateOne(
                [
                    "_id" => $objectId
                ],
                [
                    '$set' => [
                        "referral_code" => $referralCode,
                        "updated_at" => new MongoDB\BSON\UTCDateTime()
                    ]
                ]
            );

        }
    }


    // ----------------------------------------
    // REFERRAL LINK
    // ----------------------------------------

    $referralLink =
        "https://crown-cash.vercel.app/register.html?ref=" .
        rawurlencode((string) $referralCode);


    // ----------------------------------------
    // LOAD ALL USERS
    // ----------------------------------------

    $allUsers = $users->find(
        [],
        [
            "projection" => [
                "_id" => 1,
                "first_name" => 1,
                "last_name" => 1,
                "full_name" => 1,
                "email" => 1,
                "phone" => 1,

                "referral_code" => 1,
                "referralCode" => 1,

                "referrer_id" => 1,
                "referred_by_id" => 1,
                "parent_id" => 1,
                "sponsor_id" => 1,
                "upline_id" => 1,

                "referred_by" => 1,
                "referral_code_used" => 1,
                "referrer_code" => 1,

                "referral_earnings" => 1,
                "l1_earnings" => 1,
                "l2_earnings" => 1,
                "l3_earnings" => 1
            ]
        ]
    )->toArray();


    // ----------------------------------------
    // BUILD USER INDEX
    // ----------------------------------------

    $usersById = [];
    $usersByCode = [];

    foreach ($allUsers as $user) {

        $id = getUserIdString($user);

        if ($id !== "") {
            $usersById[$id] = $user;
        }


        $code = getReferralValue(
            $user,
            [
                "referral_code",
                "referralCode"
            ]
        );

        if ($code) {

            $usersByCode[strtoupper(trim((string) $code))]
                = $user;
        }
    }


    // ----------------------------------------
    // CURRENT USER ID
    // ----------------------------------------

    $currentId = getUserIdString($currentUser);

    if (!$currentId) {
        $currentId = $currentUserId;
    }


    // ----------------------------------------
    // FIND LEVEL 1
    // ----------------------------------------

    $level1 = [];

    foreach ($allUsers as $user) {

        $userId = getUserIdString($user);

        if ($userId === $currentId) {
            continue;
        }


        $referrerId = getReferralValue(
            $user,
            [
                "referrer_id",
                "referred_by_id",
                "parent_id",
                "sponsor_id",
                "upline_id"
            ]
        );


        if ($referrerId !== null) {

            if ((string) $referrerId === $currentId) {

                $level1[] = $user;
                continue;
            }


            if (
                is_object($referrerId) &&
                isset($referrerId->__toString)
            ) {
                if ((string) $referrerId === $currentId) {
                    $level1[] = $user;
                    continue;
                }
            }
        }


        // Check referral code used by the user
        $usedCode = getReferralValue(
            $user,
            [
                "referred_by",
                "referral_code_used",
                "referrer_code"
            ]
        );


        if (
            $usedCode &&
            strtoupper(trim((string) $usedCode))
            === strtoupper(trim((string) $referralCode))
        ) {
            $level1[] = $user;
        }
    }


    // ----------------------------------------
    // FIND LEVEL 2
    // ----------------------------------------

    $level1Ids = [];

    $level1Codes = [];

    foreach ($level1 as $member) {

        $id = getUserIdString($member);

        if ($id) {
            $level1Ids[$id] = true;
        }

        $code = getReferralValue(
            $member,
            [
                "referral_code",
                "referralCode"
            ]
        );

        if ($code) {
            $level1Codes[
                strtoupper(trim((string) $code))
            ] = true;
        }
    }


    $level2 = [];

    foreach ($allUsers as $user) {

        $userId = getUserIdString($user);

        if (
            $userId === $currentId ||
            isset($level1Ids[$userId])
        ) {
            continue;
        }


        $referrerId = getReferralValue(
            $user,
            [
                "referrer_id",
                "referred_by_id",
                "parent_id",
                "sponsor_id",
                "upline_id"
            ]
        );


        $usedCode = getReferralValue(
            $user,
            [
                "referred_by",
                "referral_code_used",
                "referrer_code"
            ]
        );


        $matched = false;


        if ($referrerId !== null) {

            if (
                isset($level1Ids[(string) $referrerId])
            ) {
                $matched = true;
            }
        }


        if (
            !$matched &&
            $usedCode &&
            isset(
                $level1Codes[
                    strtoupper(trim((string) $usedCode))
                ]
            )
        ) {
            $matched = true;
        }


        if ($matched) {
            $level2[] = $user;
        }
    }


    // ----------------------------------------
    // FIND LEVEL 3
    // ----------------------------------------

    $level2Ids = [];
    $level2Codes = [];

    foreach ($level2 as $member) {

        $id = getUserIdString($member);

        if ($id) {
            $level2Ids[$id] = true;
        }

        $code = getReferralValue(
            $member,
            [
                "referral_code",
                "referralCode"
            ]
        );

        if ($code) {

            $level2Codes[
                strtoupper(trim((string) $code))
            ] = true;
        }
    }


    $level3 = [];

    foreach ($allUsers as $user) {

        $userId = getUserIdString($user);

        if (
            $userId === $currentId ||
            isset($level1Ids[$userId]) ||
            isset($level2Ids[$userId])
        ) {
            continue;
        }


        $referrerId = getReferralValue(
            $user,
            [
                "referrer_id",
                "referred_by_id",
                "parent_id",
                "sponsor_id",
                "upline_id"
            ]
        );


        $usedCode = getReferralValue(
            $user,
            [
                "referred_by",
                "referral_code_used",
                "referrer_code"
            ]
        );


        $matched = false;


        if (
            $referrerId !== null &&
            isset($level2Ids[(string) $referrerId])
        ) {
            $matched = true;
        }


        if (
            !$matched &&
            $usedCode &&
            isset(
                $level2Codes[
                    strtoupper(trim((string) $usedCode))
                ]
            )
        ) {
            $matched = true;
        }


        if ($matched) {
            $level3[] = $user;
        }
    }


    // ----------------------------------------
    // BUILD TEAM MEMBERS
    // ----------------------------------------

    $members = [];


    foreach ($level1 as $member) {

        $members[] = [
            "id" => getUserIdString($member),
            "name" => getUserName($member),
            "phone" => (string) ($member["phone"] ?? ""),
            "email" => (string) ($member["email"] ?? ""),
            "level" => "L1"
        ];
    }


    foreach ($level2 as $member) {

        $members[] = [
            "id" => getUserIdString($member),
            "name" => getUserName($member),
            "phone" => (string) ($member["phone"] ?? ""),
            "email" => (string) ($member["email"] ?? ""),
            "level" => "L2"
        ];
    }


    foreach ($level3 as $member) {

        $members[] = [
            "id" => getUserIdString($member),
            "name" => getUserName($member),
            "phone" => (string) ($member["phone"] ?? ""),
            "email" => (string) ($member["email"] ?? ""),
            "level" => "L3"
        ];
    }


    // ----------------------------------------
    // REFERRAL EARNINGS
    // ----------------------------------------

    $l1Income = getNumberValue(
        getReferralValue(
            $currentUser,
            [
                "l1_earnings"
            ]
        )
    );


    $l2Income = getNumberValue(
        getReferralValue(
            $currentUser,
            [
                "l2_earnings"
            ]
        )
    );


    $l3Income = getNumberValue(
        getReferralValue(
            $currentUser,
            [
                "l3_earnings"
            ]
        )
    );


    // If separate earnings are not available,
    // try the combined referral earnings field.

    $combinedIncome = getNumberValue(
        getReferralValue(
            $currentUser,
            [
                "referral_earnings",
                "referral_income",
                "total_referral_income"
            ]
        )
    );


    if (
        $l1Income == 0 &&
        $l2Income == 0 &&
        $l3Income == 0 &&
        $combinedIncome > 0
    ) {
        $l1Income = $combinedIncome;
    }


    $totalIncome =
        $l1Income +
        $l2Income +
        $l3Income;


    // ----------------------------------------
    // RESPONSE
    // ----------------------------------------

    http_response_code(200);

    echo json_encode([
        "success" => true,

        "referral_code" => (string) $referralCode,

        "referral_link" => $referralLink,

        "counts" => [
            "total" =>
                count($level1) +
                count($level2) +
                count($level3),

            "l1" => count($level1),
            "l2" => count($level2),
            "l3" => count($level3)
        ],

        "team_counts" => [
            "total" =>
                count($level1) +
                count($level2) +
                count($level3),

            "l1" => count($level1),
            "l2" => count($level2),
            "l3" => count($level3)
        ],

        "commission_structure" => [
            "l1" => 15,
            "l2" => 5,
            "l3" => 2
        ],

        "earnings" => [
            "l1" => $l1Income,
            "l2" => $l2Income,
            "l3" => $l3Income,
            "total" => $totalIncome
        ],

        "referral_earnings" => [
            "l1" => $l1Income,
            "l2" => $l2Income,
            "l3" => $l3Income,
            "total" => $totalIncome
        ],

        "members" => $members
    ]);

    exit;


} catch (Throwable $e) {

    http_response_code(500);

    echo json_encode([
        "success" => false,
        "message" => "Unable to load referral data.",
        "error" => $e->getMessage()
    ]);

    exit;
}
?>