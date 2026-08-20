<?php

require_once "config.php";

if ($_SERVER["REQUEST_METHOD"] !== "POST") {
    http_response_code(405);
    exit("Method not allowed.");
}

$fullName = trim($_POST["full_name"] ?? "");
$email = trim($_POST["email"] ?? "");
$phone = trim($_POST["phone"] ?? "");
$password = $_POST["password"] ?? "";
$referralCode = trim($_POST["referral_code"] ?? "");


/*
|--------------------------------------------------------------------------
| Validate required fields
|--------------------------------------------------------------------------
*/

if ($fullName === "" ||
    $email === "" ||
    $phone === "" ||
    $password === "") {

    exit("Please complete all required fields.");
}


if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    exit("Invalid email address.");
}


if (strlen($password) < 8) {
    exit("Password must contain at least 8 characters.");
}


/*
|--------------------------------------------------------------------------
| Check whether email already exists
|--------------------------------------------------------------------------
*/

$existingUser = $users->findOne([
    "email" => strtolower($email)
]);

if ($existingUser) {
    exit("An account with this email already exists.");
}


/*
|--------------------------------------------------------------------------
| Check whether phone already exists
|--------------------------------------------------------------------------
*/

$existingPhone = $users->findOne([
    "phone" => $phone
]);

if ($existingPhone) {
    exit("An account with this phone number already exists.");
}


/*
|--------------------------------------------------------------------------
| Create referral code
|--------------------------------------------------------------------------
*/

$userReferralCode =
    "CC" . strtoupper(
        bin2hex(random_bytes(4))
    );


/*
|--------------------------------------------------------------------------
| Hash password
|--------------------------------------------------------------------------
*/

$passwordHash = password_hash(
    $password,
    PASSWORD_DEFAULT
);


/*
|--------------------------------------------------------------------------
| Create user document
|--------------------------------------------------------------------------
*/

$user = [

    "full_name" => $fullName,

    "email" => strtolower($email),

    "phone" => $phone,

    "password" => $passwordHash,

    "referral_code" => $userReferralCode,

    "referred_by" =>
        $referralCode !== ""
            ? $referralCode
            : null,

    "balance" => 0,

    "status" => "active",

    "created_at" => new MongoDB\BSON\UTCDateTime()

];


/*
|--------------------------------------------------------------------------
| Save user
|--------------------------------------------------------------------------
*/

try {

    $result = $users->insertOne($user);

    if ($result->getInsertedCount() === 1) {

        echo "Registration successful.";

    } else {

        echo "Registration failed.";

    }

} catch (Exception $e) {

    http_response_code(500);

    echo "Unable to create account.";

}

?>
