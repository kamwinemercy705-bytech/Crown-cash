<?php

// ============================================================
// CROWN CASH - REFERRAL API
// File: referral.php
// ============================================================

declare(strict_types=1);

// ------------------------------------------------------------
// CORS
// ------------------------------------------------------------

header("Access-Control-Allow-Origin: https://crown-cash.vercel.app");
header("Access-Control-Allow-Credentials: true");
header("Access-Control-Allow-Headers: Content-Type, Accept");
header("Access-Control-Allow-Methods: GET, OPTIONS");
header("Content-Type: application/json; charset=UTF-8");

// ------------------------------------------------------------
// PREFLIGHT
// ------------------------------------------------------------

if ($_SERVER["REQUEST_METHOD"] === "OPTIONS") {
    http_response_code(204);
    exit;
}

// Only GET is allowed
if ($_SERVER["REQUEST_METHOD"] !== "GET") {
    http_response_code(405);

    echo json_encode([
        "success" => false,
        "message" => "Method not allowed."
    ]);

    exit;
}

// ------------------------------------------------------------
// SESSION
// ------------------------------------------------------------

session_set_cookie_params([
    "lifetime" => 0,
    "path" => "/",
    "secure" => true,
    "httponly" => true,
    "samesite" => "None"
]);

session_start();

// ------------------------------------------------------------
// LOGIN CHECK
// ------------------------------------------------------------

if (
    !isset($_SESSION["logged_in"]) ||
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

// ------------------------------------------------------------
// LOAD DATABASE
// ------------------------------------------------------------

try {

    require_once __DIR__ . "/config.php";

} catch (Throwable $e) {

    error_log(
        "Referral config error: " . $e->getMessage()
    );

    http_response_code(500);

    echo json_encode([
        "success" => false,
        "message" => "Database configuration could not be loaded."
    ]);

    exit;
}

// ------------------------------------------------------------
// CHECK USERS COLLECTION
// ------------------------------------------------------------

if (!isset($users)) {

    http_response_code(500);

    echo json_encode([
        "success" => false,
        "message" => "Users collection is not configured."
    ]);

    exit;
}

// ============================================================
// HELPER FUNCTIONS
// ============================================================

function referralValue(
    $document,
    array $fields
) {
    foreach ($fields as $field) {

        if (
            isset($document[$field]) &&
            $document[$field] !== null &&
            $document[$field] !== ""
        ) {
            return $document[$field];
        }
    }

    return null;
}


// ------------------------------------------------------------
// Convert MongoDB ID to string safely
// ------------------------------------------------------------

function idToString($value): string
{
    if ($value === null || $value === "") {
        return "";
    }

    try {
        return (string)$value;
    } catch (Throwable $e) {
        return "";
    }
}


// ------------------------------------------------------------
// Normalize an ID for comparison
// ------------------------------------------------------------

function normalizeId($value): string
{
    return strtolower(trim(idToString($value)));
}


// ------------------------------------------------------------
// Normalize referral code
// ------------------------------------------------------------

function normalizeCode($value): string
{
    return strtoupper(
        trim(
            (string)($value ?? "")
        )
    );
}


// ------------------------------------------------------------
// Get user's display name
// ------------------------------------------------------------

function getDisplayName($user): string
{
    $firstName = trim(
        (string)($user["first_name"] ?? "")
    );

    $lastName = trim(
        (string)($user["last_name"] ?? "")
    );

    $fullName = trim(
        (string)($user["full_name"] ?? "")
    );

    if ($firstName !== "" || $lastName !== "") {
        return trim(
            $firstName . " " . $lastName
        );
    }

    if ($fullName !== "") {
        return $fullName;
    }

    return "Crown Cash Member";
}


// ------------------------------------------------------------
// Convert Mongo numeric values to float
// ------------------------------------------------------------

function numberValue($value): float
{
    if ($value === null || $value === "") {
        return 0.0;
    }

    try {

        if ($value instanceof MongoDB\BSON\Decimal128) {
            return (float)$value->__toString();
        }

        if ($value instanceof MongoDB\BSON\Int64) {
            return (float)$value->__toString();
        }

        if ($value instanceof MongoDB\BSON\Int32) {
            return (float)$value->__toString();
        }

        return (float)$value;

    } catch (Throwable $e) {

        return 0.0;
    }
}


// ============================================================
// MAIN
// ============================================================

try {

    // --------------------------------------------------------
    // CURRENT SESSION USER ID
    // --------------------------------------------------------

    $sessionUserId =
        trim(
            (string)$_SESSION["user_id"]
        );

    if ($sessionUserId === "") {

        http_response_code(401);

        echo json_encode([
            "success" => false,
            "message" => "Your login session is invalid."
        ]);

        exit;
    }


    // --------------------------------------------------------
    // FIND CURRENT USER
    // --------------------------------------------------------

    $currentUser = null;

    // Try ObjectId first
    try {

        $currentObjectId =
            new MongoDB\BSON\ObjectId(
                $sessionUserId
            );

        $currentUser =
            $users->findOne([
                "_id" => $currentObjectId
            ]);

    } catch (Throwable $e) {

        // Ignore and try string ID below
    }


    // Try string ID if necessary
    if (!$currentUser) {

        $currentUser =
            $users->findOne([
                "_id" => $sessionUserId
            ]);
    }


    if (!$currentUser) {

        http_response_code(404);

        echo json_encode([
            "success" => false,
            "message" =>
                "Your Crown Cash account could not be found."
        ]);

        exit;
    }


    // --------------------------------------------------------
    // CURRENT USER ID
    // --------------------------------------------------------

    $currentUserId =
        normalizeId(
            $currentUser["_id"] ?? $sessionUserId
        );


    // --------------------------------------------------------
    // CURRENT REFERRAL CODE
    // --------------------------------------------------------

    $referralCode =
        referralValue(
            $currentUser,
            [
                "referral_code",
                "referralCode",
                "code"
            ]
        );


    // --------------------------------------------------------
    // GENERATE CODE IF MISSING
    // --------------------------------------------------------

    if (!$referralCode) {

        $referralCode =
            "CC" .
            strtoupper(
                substr(
                    bin2hex(
                        random_bytes(5)
                    ),
                    0,
                    8
                )
            );

        try {

            $users->updateOne(
                [
                    "_id" =>
                        $currentUser["_id"]
                ],
                [
                    '$set' => [
                        "referral_code" =>
                            $referralCode,

                        "updated_at" =>
                            new MongoDB\BSON\UTCDateTime()
                    ]
                ]
            );

        } catch (Throwable $e) {

            error_log(
                "Referral code update error: " .
                $e->getMessage()
            );
        }
    }


    $referralCode =
        (string)$referralCode;


    // --------------------------------------------------------
    // REFERRAL LINK
    // --------------------------------------------------------

    $referralLink =
        "https://crown-cash.vercel.app/register.html?ref=" .
        rawurlencode($referralCode);


    // ========================================================
    // LOAD USERS
    // ========================================================

    $allUsers =
        $users->find(
            [],
            [
                "projection" => [
                    "_id" => 1,

                    "first_name" => 1,
                    "last_name" => 1,
                    "full_name" => 1,

                    "email" => 1,
                    "phone" => 1,
                    "mobile" => 1,
                    "phone_number" => 1,

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

                    "l1_earnings" => 1,
                    "l2_earnings" => 1,
                    "l3_earnings" => 1,

                    "referral_earnings" => 1,
                    "referral_income" => 1,
                    "total_referral_income" => 1
                ]
            ]
        )->toArray();


    // ========================================================
    // INDEX USERS
    // ========================================================

    $usersById = [];
    $usersByReferralCode = [];

    foreach ($allUsers as $user) {

        $userId =
            normalizeId(
                $user["_id"] ?? ""
            );

        if ($userId !== "") {
            $usersById[$userId] = $user;
        }


        $code =
            referralValue(
                $user,
                [
                    "referral_code",
                    "referralCode"
                ]
            );

        $normalizedCode =
            normalizeCode($code);

        if ($normalizedCode !== "") {

            $usersByReferralCode[
                $normalizedCode
            ] = $user;
        }
    }


    // ========================================================
    // FUNCTION: FIND REFERRER
    // ========================================================

    $findReferrerId =
        function ($user) {

            // --------------------------------------------
            // First check direct referrer ID fields
            // --------------------------------------------

            $referrerId =
                referralValue(
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

                $normalized =
                    normalizeId($referrerId);

                if ($normalized !== "") {
                    return [
                        "type" => "id",
                        "value" => $normalized
                    ];
                }
            }


            // --------------------------------------------
            // Then check referral code fields
            // --------------------------------------------

            $usedCode =
                referralValue(
                    $user,
                    [
                        "referred_by",
                        "referral_code_used",
                        "referrer_code"
                    ]
                );

            if ($usedCode !== null) {

                $normalizedCode =
                    normalizeCode($usedCode);

                if ($normalizedCode !== "") {
                    return [
                        "type" => "code",
                        "value" => $normalizedCode
                    ];
                }
            }


            return null;
        };


    // ========================================================
    // FIND LEVEL 1
    // ========================================================

    $level1 = [];

    foreach ($allUsers as $user) {

        $userId =
            normalizeId(
                $user["_id"] ?? ""
            );


        // Never count yourself
        if (
            $userId !== "" &&
            $userId === $currentUserId
        ) {
            continue;
        }


        $relationship =
            $findReferrerId($user);

        if (!$relationship) {
            continue;
        }


        // Match direct referrer ID
        if (
            $relationship["type"] === "id" &&
            $relationship["value"] ===
            $currentUserId
        ) {
            $level1[] = $user;
            continue;
        }


        // Match referral code
        if (
            $relationship["type"] === "code" &&
            $relationship["value"] ===
            normalizeCode($referralCode)
        ) {
            $level1[] = $user;
            continue;
        }
    }


    // ========================================================
    // LEVEL 1 INDEX
    // ========================================================

    $level1Ids = [];
    $level1Codes = [];

    foreach ($level1 as $member) {

        $memberId =
            normalizeId(
                $member["_id"] ?? ""
            );

        if ($memberId !== "") {
            $level1Ids[$memberId] = true;
        }


        $memberCode =
            normalizeCode(
                referralValue(
                    $member,
                    [
                        "referral_code",
                        "referralCode"
                    ]
                )
            );

        if ($memberCode !== "") {
            $level1Codes[$memberCode] = true;
        }
    }


    // ========================================================
    // FIND LEVEL 2
    // ========================================================

    $level2 = [];

    foreach ($allUsers as $user) {

        $userId =
            normalizeId(
                $user["_id"] ?? ""
            );


        if (
            $userId === $currentUserId ||
            isset($level1Ids[$userId])
        ) {
            continue;
        }


        $relationship =
            $findReferrerId($user);

        if (!$relationship) {
            continue;
        }


        // ID relationship
        if (
            $relationship["type"] === "id" &&
            isset(
                $level1Ids[
                    $relationship["value"]
                ]
            )
        ) {
            $level2[] = $user;
            continue;
        }


        // Referral code relationship
        if (
            $relationship["type"] === "code" &&
            isset(
                $level1Codes[
                    $relationship["value"]
                ]
            )
        ) {
            $level2[] = $user;
            continue;
        }
    }


    // ========================================================
    // LEVEL 2 INDEX
    // ========================================================

    $level2Ids = [];
    $level2Codes = [];

    foreach ($level2 as $member) {

        $memberId =
            normalizeId(
                $member["_id"] ?? ""
            );

        if ($memberId !== "") {
            $level2Ids[$memberId] = true;
        }


        $memberCode =
            normalizeCode(
                referralValue(
                    $member,
                    [
                        "referral_code",
                        "referralCode"
                    ]
                )
            );

        if ($memberCode !== "") {
            $level2Codes[$memberCode] = true;
        }
    }


    // ========================================================
    // FIND LEVEL 3
    // ========================================================

    $level3 = [];

    foreach ($allUsers as $user) {

        $userId =
            normalizeId(
                $user["_id"] ?? ""
            );


        if (
            $userId === $currentUserId ||
            isset($level1Ids[$userId]) ||
            isset($level2Ids[$userId])
        ) {
            continue;
        }


        $relationship =
            $findReferrerId($user);

        if (!$relationship) {
            continue;
        }


        // ID relationship
        if (
            $relationship["type"] === "id" &&
            isset(
                $level2Ids[
                    $relationship["value"]
                ]
            )
        ) {
            $level3[] = $user;
            continue;
        }


        // Referral code relationship
        if (
            $relationship["type"] === "code" &&
            isset(
                $level2Codes[
                    $relationship["value"]
                ]
            )
        ) {
            $level3[] = $user;
            continue;
        }
    }


    // ========================================================
    // BUILD MEMBERS RESPONSE
    // ========================================================

    $members = [];


    $addMember =
        function (
            $member,
            string $level
        ) use (&$members) {

            $phone =
                referralValue(
                    $member,
                    [
                        "phone",
                        "phone_number",
                        "mobile"
                    ]
                );

            $members[] = [
                "id" =>
                    idToString(
                        $member["_id"] ?? ""
                    ),

                "name" =>
                    getDisplayName($member),

                "phone" =>
                    (string)($phone ?? ""),

                "email" =>
                    (string)(
                        $member["email"] ?? ""
                    ),

                "level" =>
                    $level
            ];
        };


    foreach ($level1 as $member) {
        $addMember($member, "L1");
    }

    foreach ($level2 as $member) {
        $addMember($member, "L2");
    }

    foreach ($level3 as $member) {
        $addMember($member, "L3");
    }


    // ========================================================
    // EARNINGS
    // ========================================================

    $l1Income =
        numberValue(
            referralValue(
                $currentUser,
                [
                    "l1_earnings"
                ]
            )
        );


    $l2Income =
        numberValue(
            referralValue(
                $currentUser,
                [
                    "l2_earnings"
                ]
            )
        );


    $l3Income =
        numberValue(
            referralValue(
                $currentUser,
                [
                    "l3_earnings"
                ]
            )
        );


    $combinedIncome =
        numberValue(
            referralValue(
                $currentUser,
                [
                    "referral_earnings",
                    "referral_income",
                    "total_referral_income"
                ]
            )
        );


    // If only a combined value exists,
    // keep it as referral income without
    // changing the commission structure.

    if (
        $l1Income == 0 &&
        $l2Income == 0 &&
        $l3Income == 0 &&
        $combinedIncome > 0
    ) {
        $l1Income =
            $combinedIncome;
    }


    $totalIncome =
        $l1Income +
        $l2Income +
        $l3Income;


    // ========================================================
    // FINAL RESPONSE
    // ========================================================

    http_response_code(200);

    echo json_encode(
        [
            "success" => true,

            "referral_code" =>
                $referralCode,

            "referral_link" =>
                $referralLink,

            "counts" => [
                "total" =>
                    count($level1) +
                    count($level2) +
                    count($level3),

                "l1" =>
                    count($level1),

                "l2" =>
                    count($level2),

                "l3" =>
                    count($level3)
            ],

            "team_counts" => [
                "total" =>
                    count($level1) +
                    count($level2) +
                    count($level3),

                "l1" =>
                    count($level1),

                "l2" =>
                    count($level2),

                "l3" =>
                    count($level3)
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

            "members" =>
                $members
        ],
        JSON_UNESCAPED_SLASHES
    );

    exit;


} catch (Throwable $e) {

    error_log(
        "Referral API error: " .
        $e->getMessage()
    );

    http_response_code(500);

    echo json_encode([
        "success" => false,
        "message" =>
            "Unable to load referral data."
    ]);

    exit;
}
?>