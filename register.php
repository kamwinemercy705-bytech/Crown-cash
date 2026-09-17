<?php

/*
|--------------------------------------------------------------------------
| Crown Cash — User Registration API
|--------------------------------------------------------------------------
| Receives registration data from the Vercel frontend
| and creates the user in MongoDB.
|--------------------------------------------------------------------------
*/

header("Content-Type: application/json; charset=UTF-8");

/*
|--------------------------------------------------------------------------
| CORS
|--------------------------------------------------------------------------
*/

$allowedOrigin = "https://crown-cash.vercel.app";

if (isset($_SERVER["HTTP_ORIGIN"]) &&
    $_SERVER["HTTP_ORIGIN"] === $allowedOrigin) {

    header("Access-Control-Allow-Origin: " . $allowedOrigin);
}

header("Access-Control-Allow-Credentials: true");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Accept");

/*
|--------------------------------------------------------------------------
| Handle OPTIONS / CORS preflight
|--------------------------------------------------------------------------
*/

if ($_SERVER["REQUEST_METHOD"] === "OPTIONS") {

    http_response_code(204);
    exit;
}

/*
|--------------------------------------------------------------------------
| Only POST is allowed
|--------------------------------------------------------------------------
*/

if ($_SERVER["REQUEST_METHOD"] !== "POST") {

    http_response_code(405);

    echo json_encode([
        "success" => false,
        "message" => "Method not allowed."
    ]);

    exit;
}


/*
|--------------------------------------------------------------------------
| Load MongoDB configuration
|--------------------------------------------------------------------------
*/

try {

    require_once __DIR__ . "/config.php";

} catch (Throwable $e) {

    error_log(
        "CROWN CASH REGISTER CONFIG ERROR: " .
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
| Read JSON request
|--------------------------------------------------------------------------
*/

$rawInput = file_get_contents("php://input");

$data = json_decode($rawInput, true);


/*
|--------------------------------------------------------------------------
| Also support normal POST form data
|--------------------------------------------------------------------------
*/

if (!is_array($data)) {

    $data = $_POST;
}


/*
|--------------------------------------------------------------------------
| Read fields
|--------------------------------------------------------------------------
*/

$firstName = trim(
    (string)($data["first_name"] ?? "")
);

$lastName = trim(
    (string)($data["last_name"] ?? "")
);

$fullName = trim(
    (string)($data["full_name"] ?? "")
);

$phone = trim(
    (string)($data["phone"] ?? "")
);

$email = strtolower(
    trim((string)($data["email"] ?? ""))
);

$password = (string)(
    $data["password"] ?? ""
);

$confirmPassword = (string)(
    $data["confirm_password"] ?? ""
);

$referralCode = strtoupper(
    trim((string)($data["referral_code"] ?? ""))
);


/*
|--------------------------------------------------------------------------
| Build full name if frontend did not send it
|--------------------------------------------------------------------------
*/

if ($fullName === "") {

    $fullName = trim(
        $firstName . " " . $lastName
    );
}


/*
|--------------------------------------------------------------------------
| Validate required fields
|--------------------------------------------------------------------------
*/

if (
    $firstName === "" ||
    $lastName === "" ||
    $phone === "" ||
    $email === "" ||
    $password === ""
) {

    http_response_code(400);

    echo json_encode([
        "success" => false,
        "message" => "Please complete all required fields."
    ]);

    exit;
}


/*
|--------------------------------------------------------------------------
| Validate email
|--------------------------------------------------------------------------
*/

if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {

    http_response_code(400);

    echo json_encode([
        "success" => false,
        "message" => "Please enter a valid email address."
    ]);

    exit;
}


/*
|--------------------------------------------------------------------------
| Validate password
|--------------------------------------------------------------------------
*/

if (strlen($password) < 8) {

    http_response_code(400);

    echo json_encode([
        "success" => false,
        "message" => "Password must contain at least 8 characters."
    ]);

    exit;
}


/*
|--------------------------------------------------------------------------
| Confirm password
|--------------------------------------------------------------------------
*/

if (
    $confirmPassword !== "" &&
    $password !== $confirmPassword
) {

    http_response_code(400);

    echo json_encode([
        "success" => false,
        "message" => "Passwords do not match."
    ]);

    exit;
}


/*
|--------------------------------------------------------------------------
| Normalize Uganda phone number
|--------------------------------------------------------------------------
*/

$phone = preg_replace(
    "/[\s\-\(\)]/",
    "",
    $phone
);


/*
|--------------------------------------------------------------------------
| Convert +256XXXXXXXXX to 0XXXXXXXXX
|--------------------------------------------------------------------------
*/

if (strpos($phone, "+256") === 0) {

    $phone = "0" . substr($phone, 4);
}

elseif (strpos($phone, "256") === 0) {

    $phone = "0" . substr($phone, 3);
}


/*
|--------------------------------------------------------------------------
| Validate Uganda phone number
|--------------------------------------------------------------------------
*/

if (!preg_match(
    "/^0(7[0-8])[0-9]{7}$/",
    $phone
)) {

    http_response_code(400);

    echo json_encode([
        "success" => false,
        "message" => "Please enter a valid Ugandan phone number."
    ]);

    exit;
}


/*
|--------------------------------------------------------------------------
| Password hashing
|--------------------------------------------------------------------------
*/

$passwordHash = password_hash(
    $password,
    PASSWORD_DEFAULT
);


/*
|--------------------------------------------------------------------------
| Create user
|--------------------------------------------------------------------------
*/

try {

    /*
    |--------------------------------------------------------------------------
    | Check whether email already exists
    |--------------------------------------------------------------------------
    */

    $existingEmail = $users->findOne([
        "email" => $email
    ]);

    if ($existingEmail !== null) {

        http_response_code(409);

        echo json_encode([
            "success" => false,
            "message" => "An account with this email already exists."
        ]);

        exit;
    }


    /*
    |--------------------------------------------------------------------------
    | Check whether phone already exists
    |--------------------------------------------------------------------------
    */

    $existingPhone = $users->findOne([
        "phone" => $phone
    ]);

    if ($existingPhone !== null) {

        http_response_code(409);

        echo json_encode([
            "success" => false,
            "message" => "An account with this phone number already exists."
        ]);

        exit;
    }


    /*
    |--------------------------------------------------------------------------
    | Registration fee
    |--------------------------------------------------------------------------
    */

    $registrationFee = 12000;


    /*
    |--------------------------------------------------------------------------
    | Registration bonus
    |--------------------------------------------------------------------------
    |
    | This is stored separately so the amount can be changed later.
    |
    */

    $registrationBonus = 0;


    /*
    |--------------------------------------------------------------------------
    | Prepare user document
    |--------------------------------------------------------------------------
    */

    $now = new MongoDB\BSON\UTCDateTime();

    $userDocument = [

        "first_name" => $firstName,

        "last_name" => $lastName,

        "full_name" => $fullName,

        "phone" => $phone,

        "email" => $email,

        "password" => $passwordHash,

        "referral_code" => "",

        "referred_by" => $referralCode,

        "referral_code_used" => $referralCode,

        "balance" => 0,

        "wallet_balance" => 0,

        "registration_fee" => $registrationFee,

        "registration_bonus" => $registrationBonus,

        "account_type" => "user",

        "status" => "active",

        "created_at" => $now,

        "updated_at" => $now
    ];


    /*
    |--------------------------------------------------------------------------
    | Validate referral code
    |--------------------------------------------------------------------------
    |
    | If a referral code was supplied, make sure it belongs to
    | an existing Crown Cash user.
    |--------------------------------------------------------------------------
    */

    $referrer = null;

    if ($referralCode !== "") {

        $referrer = $users->findOne([
            "referral_code" => $referralCode
        ]);

        if ($referrer === null) {

            http_response_code(400);

            echo json_encode([
                "success" => false,
                "message" => "The referral code is not valid."
            ]);

            exit;
        }
    }


    /*
    |--------------------------------------------------------------------------
    | Generate unique referral code for new user
    |--------------------------------------------------------------------------
    */

    do {

        $newReferralCode =
            "CC" .
            strtoupper(
                substr(
                    bin2hex(random_bytes(5)),
                    0,
                    8
                )
            );

        $existingReferralCode =
            $users->findOne([
                "referral_code" => $newReferralCode
            ]);

    } while ($existingReferralCode !== null);


    /*
    |--------------------------------------------------------------------------
    | Save new user's referral code
    |--------------------------------------------------------------------------
    */

    $userDocument["referral_code"] =
        $newReferralCode;


    /*
    |--------------------------------------------------------------------------
    | Insert user into MongoDB
    |--------------------------------------------------------------------------
    */

    $result = $users->insertOne(
        $userDocument
    );


    /*
    |--------------------------------------------------------------------------
    | Make sure insertion succeeded
    |--------------------------------------------------------------------------
    */

    if ($result->getInsertedCount() !== 1) {

        throw new Exception(
            "User could not be created."
        );
    }


    /*
    |--------------------------------------------------------------------------
    | Get new user's ID
    |--------------------------------------------------------------------------
    */

    $newUserId =
        $result->getInsertedId();


    /*
    |--------------------------------------------------------------------------
    | Create audit log if collection exists
    |--------------------------------------------------------------------------
    */

    try {

        if (isset($audit_logs)) {

            $audit_logs->insertOne([

                "user_id" => $newUserId,

                "action" => "account_created",

                "description" =>
                    "New Crown Cash account registered.",

                "ip_address" =>
                    $_SERVER["REMOTE_ADDR"] ?? "",

                "created_at" => $now

            ]);
        }

    } catch (Throwable $auditError) {

        /*
        | Do not cancel successful registration
        | if audit logging fails.
        */

        error_log(
            "CROWN CASH AUDIT LOG ERROR: " .
            $auditError->getMessage()
        );
    }


    /*
    |--------------------------------------------------------------------------
    | Create referral record
    |--------------------------------------------------------------------------
    */

    if (
        $referrer !== null &&
        isset($referrals)
    ) {

        try {

            $referrerId =
                $referrer["_id"];

            $referrals->insertOne([

                "referrer_id" => $referrerId,

                "referred_user_id" => $newUserId,

                "referral_code" => $referralCode,

                "status" => "active",

                "commission" => 0,

                "created_at" => $now

            ]);

        } catch (Throwable $referralError) {

            error_log(
                "CROWN CASH REFERRAL ERROR: " .
                $referralError->getMessage()
            );
        }
    }


    /*
    |--------------------------------------------------------------------------
    | Success response
    |--------------------------------------------------------------------------
    */

    http_response_code(201);

    echo json_encode([

        "success" => true,

        "message" =>
            "Account created successfully!",

        "user_id" =>
            (string)$newUserId,

        "referral_code" =>
            $newReferralCode,

        "referred_by" =>
            $referralCode

    ]);

    exit;


} catch (Throwable $e) {

    /*
    |--------------------------------------------------------------------------
    | Log real database error
    |--------------------------------------------------------------------------
    */

    error_log(
        "CROWN CASH REGISTRATION ERROR: " .
        $e->getMessage()
    );


    /*
    |--------------------------------------------------------------------------
    | Special handling for MongoDB permission errors
    |--------------------------------------------------------------------------
    */

    $errorMessage =
        strtolower($e->getMessage());

    if (
        strpos(
            $errorMessage,
            "not authorized"
        ) !== false ||

        strpos(
            $errorMessage,
            "not allowed"
        ) !== false ||

        strpos(
            $errorMessage,
            "insert"
        ) !== false
    ) {

        http_response_code(500);

        echo json_encode([

            "success" => false,

            "message" =>
                "The database user does not have permission to create accounts. Please check the MongoDB Atlas database user permissions."

        ]);

        exit;
    }


    /*
    |--------------------------------------------------------------------------
    | General server error
    |--------------------------------------------------------------------------
    */

    http_response_code(500);

    echo json_encode([

        "success" => false,

        "message" =>
            "Unable to create your account right now. Please try again."

    ]);

    exit;
}
?>
