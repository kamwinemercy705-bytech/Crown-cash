<?php

declare(strict_types=1);

/*
|--------------------------------------------------------------------------
| Crown Cash - Support API
|--------------------------------------------------------------------------
| Handles:
| GET  -> Load the logged-in user's support tickets
| POST -> Create a new support ticket
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

header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Origin: https://crown-cash.vercel.app");
header("Access-Control-Allow-Credentials: true");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");

if ($_SERVER["REQUEST_METHOD"] === "OPTIONS") {
    http_response_code(204);
    exit;
}


/*
|--------------------------------------------------------------------------
| Helper: JSON response
|--------------------------------------------------------------------------
*/
function respond(
    bool $success,
    string $message = "",
    array $extra = [],
    int $statusCode = 200
): void {
    http_response_code($statusCode);

    echo json_encode(
        array_merge(
            [
                "success" => $success,
                "message" => $message
            ],
            $extra
        ),
        JSON_UNESCAPED_SLASHES
    );

    exit;
}


/*
|--------------------------------------------------------------------------
| Allow only GET and POST
|--------------------------------------------------------------------------
*/
$method = $_SERVER["REQUEST_METHOD"];

if (!in_array($method, ["GET", "POST"], true)) {
    respond(
        false,
        "Method not allowed.",
        [],
        405
    );
}


/*
|--------------------------------------------------------------------------
| Authentication
|--------------------------------------------------------------------------
*/
if (
    !isset($_SESSION["logged_in"]) ||
    $_SESSION["logged_in"] !== true ||
    empty($_SESSION["user_id"])
) {
    respond(
        false,
        "Please login first.",
        [],
        401
    );
}


/*
|--------------------------------------------------------------------------
| Load database configuration
|--------------------------------------------------------------------------
*/
require_once __DIR__ . "/config.php";


/*
|--------------------------------------------------------------------------
| Convert session user ID to MongoDB ObjectId
|--------------------------------------------------------------------------
*/
try {

    $userId = new MongoDB\BSON\ObjectId(
        (string)$_SESSION["user_id"]
    );

} catch (Throwable $e) {

    respond(
        false,
        "Invalid user session.",
        [],
        401
    );
}


/*
|--------------------------------------------------------------------------
| Get support collection
|--------------------------------------------------------------------------
|
| We create/select the collection directly here so you do not need
| to modify config.php immediately.
|
*/
try {

    $supportTickets = $db->selectCollection("support_tickets");

} catch (Throwable $e) {

    respond(
        false,
        "Unable to access support service.",
        [],
        500
    );
}


/*
|--------------------------------------------------------------------------
| GET
|--------------------------------------------------------------------------
| Return ONLY tickets belonging to the currently logged-in user.
|--------------------------------------------------------------------------
*/
if ($method === "GET") {

    try {

        $cursor = $supportTickets->find(
            [
                "user_id" => $userId
            ],
            [
                "sort" => [
                    "created_at" => -1
                ],
                "limit" => 100
            ]
        );

        $tickets = [];

        foreach ($cursor as $ticket) {

            $createdAt = "";

            if (
                isset($ticket["created_at"]) &&
                $ticket["created_at"] instanceof MongoDB\BSON\UTCDateTime
            ) {
                $createdAt = $ticket["created_at"]
                    ->toDateTime()
                    ->format("c");
            }

            $updatedAt = "";

            if (
                isset($ticket["updated_at"]) &&
                $ticket["updated_at"] instanceof MongoDB\BSON\UTCDateTime
            ) {
                $updatedAt = $ticket["updated_at"]
                    ->toDateTime()
                    ->format("c");
            }

            $tickets[] = [
                "id" => isset($ticket["_id"])
                    ? (string)$ticket["_id"]
                    : "",

                "ticket_reference" => (string)(
                    $ticket["ticket_reference"] ?? ""
                ),

                "category" => (string)(
                    $ticket["category"] ?? "General Support"
                ),

                "subject" => (string)(
                    $ticket["subject"] ?? ""
                ),

                "message" => (string)(
                    $ticket["message"] ?? ""
                ),

                "status" => (string)(
                    $ticket["status"] ?? "open"
                ),

                "priority" => (string)(
                    $ticket["priority"] ?? "normal"
                ),

                "created_at" => $createdAt,

                "updated_at" => $updatedAt
            ];
        }

        respond(
            true,
            "Support tickets loaded successfully.",
            [
                "tickets" => $tickets
            ]
        );

    } catch (MongoDB\Driver\Exception\Exception $e) {

        respond(
            false,
            "Unable to load support tickets.",
            [],
            500
        );

    } catch (Throwable $e) {

        respond(
            false,
            "Unable to load support tickets.",
            [],
            500
        );
    }
}


/*
|--------------------------------------------------------------------------
| POST
|--------------------------------------------------------------------------
| Create a new support ticket.
|--------------------------------------------------------------------------
*/

$rawInput = file_get_contents("php://input");

$input = json_decode(
    $rawInput ?: "",
    true
);

if (!is_array($input)) {
    $input = $_POST;
}


/*
|--------------------------------------------------------------------------
| Read submitted fields
|--------------------------------------------------------------------------
*/
$category = trim(
    (string)(
        $input["category"] ??
        ""
    )
);

$subject = trim(
    (string)(
        $input["subject"] ??
        ""
    )
);

$message = trim(
    (string)(
        $input["message"] ??
        ""
    )
);


/*
|--------------------------------------------------------------------------
| Allowed categories
|--------------------------------------------------------------------------
*/
$allowedCategories = [
    "General Support",
    "Deposits",
    "Withdrawals",
    "Referrals",
    "Account & Security"
];

if ($category === "") {

    respond(
        false,
        "Please select a support category.",
        [],
        400
    );
}

if (!in_array($category, $allowedCategories, true)) {

    respond(
        false,
        "Invalid support category.",
        [],
        400
    );
}


/*
|--------------------------------------------------------------------------
| Validate subject
|--------------------------------------------------------------------------
*/
if ($subject === "") {

    respond(
        false,
        "Please enter a subject.",
        [],
        400
    );
}

if (mb_strlen($subject) < 3) {

    respond(
        false,
        "Subject must contain at least 3 characters.",
        [],
        400
    );
}

if (mb_strlen($subject) > 150) {

    respond(
        false,
        "Subject is too long.",
        [],
        400
    );
}


/*
|--------------------------------------------------------------------------
| Validate message
|--------------------------------------------------------------------------
*/
if ($message === "") {

    respond(
        false,
        "Please enter your message.",
        [],
        400
    );
}

if (mb_strlen($message) < 10) {

    respond(
        false,
        "Please provide more details in your message.",
        [],
        400
    );
}

if (mb_strlen($message) > 5000) {

    respond(
        false,
        "Message is too long. Maximum 5000 characters.",
        [],
        400
    );
}


/*
|--------------------------------------------------------------------------
| Security:
| Prevent users from submitting sensitive credentials.
|--------------------------------------------------------------------------
*/
$sensitivePatterns = [
    "/\bpassword\s*[:=]/i",
    "/\bpin\s*[:=]/i",
    "/\bpasscode\s*[:=]/i",
    "/\botp\s*[:=]/i",
    "/\bone[-\s]?time\s+password/i"
];

foreach ($sensitivePatterns as $pattern) {

    if (
        preg_match(
            $pattern,
            $message
        )
    ) {

        respond(
            false,
            "For your security, do not include passwords, PINs, OTPs, or other confidential credentials in support messages.",
            [],
            400
        );
    }
}


/*
|--------------------------------------------------------------------------
| Load current user
|--------------------------------------------------------------------------
*/
try {

    $user = $users->findOne(
        [
            "_id" => $userId
        ]
    );

} catch (Throwable $e) {

    respond(
        false,
        "Unable to verify your account.",
        [],
        500
    );
}


if (!$user) {

    respond(
        false,
        "User account was not found.",
        [],
        404
    );
}


/*
|--------------------------------------------------------------------------
| Account status
|--------------------------------------------------------------------------
*/
$userStatus = strtolower(
    (string)(
        $user["status"] ??
        "active"
    )
);

$blockedStatuses = [
    "blocked",
    "suspended",
    "disabled",
    "banned"
];

if (in_array($userStatus, $blockedStatuses, true)) {

    respond(
        false,
        "Your account is currently restricted. Please contact Crown Cash support through the appropriate channel.",
        [],
        403
    );
}


/*
|--------------------------------------------------------------------------
| User information
|--------------------------------------------------------------------------
*/
$userEmail = (string)(
    $user["email"] ??
    $_SESSION["user_email"] ??
    ""
);

$fullName = trim(
    (string)(
        $user["full_name"] ??
        ""
    )
);


/*
|--------------------------------------------------------------------------
| Generate unique Crown Cash support ticket reference
|--------------------------------------------------------------------------
*/
function generateTicketReference(
    MongoDB\Collection $collection
): string {

    for ($attempt = 0; $attempt < 10; $attempt++) {

        $randomPart = strtoupper(
            bin2hex(
                random_bytes(4)
            )
        );

        $reference =
            "CC-SUP-" .
            date("Ymd") .
            "-" .
            $randomPart;

        $existing = $collection->findOne(
            [
                "ticket_reference" => $reference
            ],
            [
                "projection" => [
                    "_id" => 1
                ]
            ]
        );

        if (!$existing) {
            return $reference;
        }
    }

    throw new RuntimeException(
        "Unable to generate ticket reference."
    );
}


/*
|--------------------------------------------------------------------------
| Create ticket
|--------------------------------------------------------------------------
*/
try {

    $ticketReference = generateTicketReference(
        $supportTickets
    );

    $now = new MongoDB\BSON\UTCDateTime();

    $ticket = [
        "_id" => new MongoDB\BSON\ObjectId(),

        "ticket_reference" => $ticketReference,

        "user_id" => $userId,

        "email" => $userEmail,

        "full_name" => $fullName,

        "category" => $category,

        "subject" => $subject,

        "message" => $message,

        "status" => "open",

        "priority" => "normal",

        "admin_reply" => "",

        "assigned_to" => null,

        "created_at" => $now,

        "updated_at" => $now
    ];

    $insertResult = $supportTickets->insertOne(
        $ticket
    );

    if ($insertResult->getInsertedCount() !== 1) {

        respond(
            false,
            "Support request could not be submitted.",
            [],
            500
        );
    }


    /*
    |--------------------------------------------------------------------------
    | Audit log
    |--------------------------------------------------------------------------
    */
    try {

        $auditLogs->insertOne(
            [
                "user_id" => $userId,

                "action" => "support_ticket_created",

                "action_type" => "support",

                "ticket_reference" => $ticketReference,

                "category" => $category,

                "subject" => $subject,

                "description" =>
                    "User created a support ticket.",

                "created_at" => $now
            ]
        );

    } catch (Throwable $auditError) {

        /*
        | Do not delete a successfully created support ticket
        | just because audit logging failed.
        |
        | The ticket itself has already been created.
        */
    }


    /*
    |--------------------------------------------------------------------------
    | Response ticket
    |--------------------------------------------------------------------------
    */
    $createdAt = $now
        ->toDateTime()
        ->format("c");

    respond(
        true,
        "Support request submitted successfully.",
        [
            "ticket_reference" => $ticketReference,

            "ticket" => [
                "id" => (string)$ticket["_id"],

                "ticket_reference" =>
                    $ticketReference,

                "category" =>
                    $category,

                "subject" =>
                    $subject,

                "message" =>
                    $message,

                "status" =>
                    "open",

                "priority" =>
                    "normal",

                "created_at" =>
                    $createdAt,

                "updated_at" =>
                    $createdAt
            ]
        ],
        201
    );

} catch (MongoDB\Driver\Exception\DuplicateKeyException $e) {

    respond(
        false,
        "A support request with this reference already exists. Please try again.",
        [],
        409
    );

} catch (MongoDB\Driver\Exception\Exception $e) {

    respond(
        false,
        "Database error while submitting your support request.",
        [],
        500
    );

} catch (Throwable $e) {

    respond(
        false,
        "Unable to submit your support request.",
        [],
        500
    );
}
?>