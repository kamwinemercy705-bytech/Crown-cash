<?php

session_start();

header("Content-Type: application/json");
header("Access-Control-Allow-Origin: https://crown-cash.vercel.app");
header("Access-Control-Allow-Credentials: true");
header("Access-Control-Allow-Methods: GET, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");

if ($_SERVER["REQUEST_METHOD"] === "OPTIONS") {
    http_response_code(204);
    exit;
}


/*
|--------------------------------------------------------------------------
| CHECK LOGIN
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
| LOAD MONGODB CONFIGURATION
|--------------------------------------------------------------------------
*/

require_once __DIR__ . "/config.php";

try {

    /*
    |--------------------------------------------------------------------------
    | FIND USER
    |--------------------------------------------------------------------------
    */

    $userId = new MongoDB\BSON\ObjectId($_SESSION["user_id"]);

    $user = $users->findOne([
        "_id" => $userId
    ]);


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
    | SPLIT FULL NAME
    |--------------------------------------------------------------------------
    */

    $fullName = trim((string)($user["full_name"] ?? ""));

    $nameParts = preg_split(
        "/\s+/",
        $fullName,
        -1,
        PREG_SPLIT_NO_EMPTY
    );

    $firstName = $nameParts[0] ?? "";
    $lastName = "";

    if (count($nameParts) > 1) {
        $lastName = implode(
            " ",
            array_slice($nameParts, 1)
        );
    }


    /*
    |--------------------------------------------------------------------------
    | ACCOUNT DATA
    |--------------------------------------------------------------------------
    */

    $balance = $user["balance"] ?? 0;

    if ($balance instanceof MongoDB\BSON\Decimal128) {
        $balance = (float)$balance->__toString();
    } else {
        $balance = (float)$balance;
    }


    /*
    |--------------------------------------------------------------------------
    | CREATED DATE
    |--------------------------------------------------------------------------
    */

    $createdAt = "";

    if (
        isset($user["created_at"]) &&
        $user["created_at"] instanceof MongoDB\BSON\UTCDateTime
    ) {

        $createdAt = $user["created_at"]
            ->toDateTime()
            ->format("Y-m-d");

    }


    /*
    |--------------------------------------------------------------------------
    | RETURN USER PROFILE
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
                (string)($user["email"] ?? ""),

            "phone" =>
                (string)($user["phone"] ?? ""),

            "referral_code" =>
                (string)($user["referral_code"] ?? ""),

            "balance" =>
                $balance,

            "status" =>
                (string)($user["status"] ?? "active"),

            "account_type" =>
                (string)($user["account_type"] ?? "user"),

            "created_at" =>
                $createdAt
        ]

    ]);

} catch (MongoDB\Driver\Exception\Exception $e) {

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

Step 2 — Connect "profile.html" to it

In your "profile.html", replace the small JavaScript section at the bottom with this:

:::writing{variant="document" id="76314" title="Profile API Connection JavaScript"}

<script>

    /* ================= MOBILE MENU ================= */

    const menuBtn = document.getElementById("menuBtn");
    const sidebar = document.getElementById("sidebar");

    if (menuBtn) {

        menuBtn.addEventListener("click", function () {

            sidebar.classList.toggle("open");

            const icon = menuBtn.querySelector("i");

            if (sidebar.classList.contains("open")) {

                icon.classList.remove("fa-bars");
                icon.classList.add("fa-xmark");

            } else {

                icon.classList.remove("fa-xmark");
                icon.classList.add("fa-bars");

            }

        });

    }


    /* ================= LOAD PROFILE ================= */

    async function loadProfile() {

        try {

            const response = await fetch(
                "https://crown-cash1.onrender.com/profile.php",
                {
                    method: "GET",
                    credentials: "include"
                }
            );


            const data = await response.json();


            if (!response.ok || !data.success) {

                console.log(
                    data.message || "Unable to load profile."
                );

                return;
            }


            const user = data.user;


            /* NAME */

            document.getElementById("profileName").textContent =
                user.full_name || "Crown Cash User";


            /* FIRST NAME */

            document.getElementById("firstName").textContent =
                user.first_name || "Not available";


            /* LAST NAME */

            document.getElementById("lastName").textContent =
                user.last_name || "Not available";


            /* PHONE */

            document.getElementById("phoneNumber").textContent =
                user.phone || "Not available";


            /* EMAIL */

            document.getElementById("emailAddress").textContent =
                user.email || "Not available";


            /* BALANCE */

            document.getElementById("balance").textContent =
                "UGX " +
                Number(user.balance || 0).toLocaleString();


            /* REFERRAL CODE */

            document.getElementById("referralCode").textContent =
                user.referral_code || "Not available";


            /* MEMBER SINCE */

            document.getElementById("memberSince").textContent =
                user.created_at || "Not available";


        } catch (error) {

            console.error(
                "Profile loading error:",
                error
            );

        }

    }


    /* ================= CHANGE PASSWORD ================= */

    function changePassword() {

        window.location.href =
            "change-password.html";

    }


    /* ================= START ================= */

    loadProfile();

</script>

Step 3 — Important

Your "config.php" must continue using the same MongoDB environment variable that your Render service actually has configured. Your recent setup changed between "MONGODB_URI" and "DB_URI", so they must match exactly.

Also, your login system must establish:

$_SESSION["logged_in"] = true;
$_SESSION["user_id"] = $user["_id"]->toString();

Otherwise "profile.php" will correctly respond:

Please login first.

What this will achieve

Once a user logs in and opens:

"https://crown-cash.vercel.app/profile.html"

the page can display their actual:

👤 Name
📱 Phone
✉️ Email
💰 Balance
👥 Referral code
📅 Member since
🛡️ Account status

rather than the "Not available" placeholders.

Next backend step after this: we should test the complete flow Register → Login → Profile, because that will tell us whether your PHP session between Vercel and Render is working correctly before we connect deposits, investments, and withdrawals.