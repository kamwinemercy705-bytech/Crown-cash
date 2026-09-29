<?php

declare(strict_types=1);

/*
|--------------------------------------------------------------------------
| Crown Cash - Withdrawal API
|--------------------------------------------------------------------------
|
| POST:
|   Creates a pending withdrawal request.
|
| GET:
|   Returns the authenticated user's withdrawal/account information
|   and recent withdrawal history.
|
| IMPORTANT:
|   The frontend must NOT be trusted to provide:
|       - withdrawal phone number
|       - payment method/network
|       - another person's account
|
|   Those details are obtained from the authenticated user's
|   MongoDB account record.
|
|--------------------------------------------------------------------------
*/

header("Content-Type: application/json; charset=utf-8");
header("Access-Control-Allow-Origin: https://crown-cash.vercel.app");
header("Access-Control-Allow-Credentials: true");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");

if ($_SERVER["REQUEST_METHOD"] === "OPTIONS") {
    http_response_code(204);
    exit;
}


/*
|--------------------------------------------------------------------------
| Error handling
|--------------------------------------------------------------------------
*/

ini_set("display_errors", "0");
ini_set("log_errors", "1");

error_reporting(E_ALL);


function respond(
    bool $success,
    string $message,
    array $data = [],
    int $statusCode = 200
): never {

    http_response_code($statusCode);

    echo json_encode(
        array_merge(
            [
                "success" => $success,
                "message" => $message
            ],
            $data
        ),
        JSON_UNESCAPED_SLASHES
        | JSON_UNESCAPED_UNICODE
    );

    exit;
}


/*
|--------------------------------------------------------------------------
| Fatal-error protection
|--------------------------------------------------------------------------
*/

register_shutdown_function(function (): void {

    $error = error_get_last();

    if (!$error) {
        return;
    }

    $fatalTypes = [
        E_ERROR,
        E_PARSE,
        E_CORE_ERROR,
        E_COMPILE_ERROR
    ];

    if (!in_array($error["type"], $fatalTypes, true)) {
        return;
    }

    if (!headers_sent()) {
        http_response_code(500);
        header("Content-Type: application/json; charset=utf-8");
    }

    echo json_encode([
        "success" => false,
        "message" => "A server error occurred while processing the withdrawal request."
    ]);

});


/*
|--------------------------------------------------------------------------
| Load configuration
|--------------------------------------------------------------------------
*/

try {

    require_once __DIR__ . "/config.php";

} catch (Throwable $e) {

    error_log(
        "CROWN CASH WITHDRAW CONFIG ERROR: " .
        $e->getMessage()
    );

    respond(
        false,
        "Server configuration error.",
        [],
        500
    );
}


/*
|--------------------------------------------------------------------------
| MongoDB availability check
|--------------------------------------------------------------------------
*/

if (
    !isset($db) ||
    !($db instanceof MongoDB\Database)
) {

    respond(
        false,
        "Database connection is unavailable.",
        [],
        500
    );
}


if (
    !isset($users) ||
    !($users instanceof MongoDB\Collection)
) {

    $users = $db->selectCollection("users");
}


if (
    !isset($withdrawals) ||
    !($withdrawals instanceof MongoDB\Collection)
) {

    $withdrawals = $db->selectCollection("withdrawals");
}


if (
    !isset($transactions) ||
    !($transactions instanceof MongoDB\Collection)
) {

    $transactions = $db->selectCollection("transactions");
}


/*
|--------------------------------------------------------------------------
| Session
|--------------------------------------------------------------------------
*/

if (session_status() !== PHP_SESSION_ACTIVE) {

    session_set_cookie_params([
        "httponly" => true,
        "secure" => true,
        "samesite" => "None"
    ]);

    session_start();

}


/*
|--------------------------------------------------------------------------
| Authentication helper functions
|--------------------------------------------------------------------------
*/

function findAuthenticatedUser(
    MongoDB\Collection $users
): ?MongoDB\Model\BSONDocument {

    /*
     * The existing Crown Cash authentication system may use
     * different session keys. We check the common ones.
     */

    $possibleIds = [
        $_SESSION["user_id"] ?? null,
        $_SESSION["userId"] ?? null,
        $_SESSION["userid"] ?? null,
        $_SESSION["id"] ?? null,
        $_SESSION["user"]["id"] ?? null,
        $_SESSION["user"]["_id"] ?? null,
        $_SESSION["user"]["user_id"] ?? null
    ];


    foreach ($possibleIds as $sessionId) {

        if (
            $sessionId === null ||
            $sessionId === ""
        ) {
            continue;
        }


        /*
         * MongoDB ObjectId
         */

        if (
            $sessionId instanceof MongoDB\BSON\ObjectId
        ) {

            try {

                $user = $users->findOne([
                    "_id" => $sessionId
                ]);

                if ($user !== null) {
                    return $user;
                }

            } catch (Throwable $e) {
                // Continue with other lookup methods.
            }

        }


        /*
         * ObjectId stored as string.
         */

        if (
            is_string($sessionId) &&
            preg_match(
                "/^[a-f0-9]{24}$/i",
                $sessionId
            )
        ) {

            try {

                $user = $users->findOne([
                    "_id" => new MongoDB\BSON\ObjectId($sessionId)
                ]);

                if ($user !== null) {
                    return $user;
                }

            } catch (Throwable $e) {
                // Continue.
            }

        }


        /*
         * Common string user-ID fields.
         */

        $fields = [
            "user_id",
            "userId",
            "userid",
            "id",
            "account_id",
            "accountId"
        ];


        foreach ($fields as $field) {

            try {

                $user = $users->findOne([
                    $field => $sessionId
                ]);

                if ($user !== null) {
                    return $user;
                }

            } catch (Throwable $e) {
                // Continue.
            }

        }

    }


    /*
     * Some authentication systems store email in session.
     */

    $possibleEmails = [
        $_SESSION["email"] ?? null,
        $_SESSION["user"]["email"] ?? null,
        $_SESSION["user_email"] ?? null
    ];


    foreach ($possibleEmails as $email) {

        if (
            !is_string($email) ||
            trim($email) === ""
        ) {
            continue;
        }


        try {

            $user = $users->findOne([
                "email" => strtolower(trim($email))
            ]);

            if ($user !== null) {
                return $user;
            }


            $user = $users->findOne([
                "email" => trim($email)
            ]);

            if ($user !== null) {
                return $user;
            }

        } catch (Throwable $e) {
            // Continue.
        }

    }


    return null;
}


/*
|--------------------------------------------------------------------------
| Authentication
|--------------------------------------------------------------------------
*/

$user = findAuthenticatedUser($users);


if ($user === null) {

    respond(
        false,
        "You must be logged in to continue.",
        [],
        401
    );

}


/*
|--------------------------------------------------------------------------
| Safe MongoDB value helper
|--------------------------------------------------------------------------
*/

function safeMongoValue(mixed $value): mixed {

    if (
        $value instanceof MongoDB\Model\BSONDocument
    ) {

        $array = $value->getArrayCopy();

        $result = [];

        foreach ($array as $key => $item) {

            $result[$key] = safeMongoValue($item);

        }

        return $result;
    }


    if (
        $value instanceof MongoDB\Model\BSONArray
    ) {

        $array = $value->getArrayCopy();

        $result = [];

        foreach ($array as $item) {

            $result[] = safeMongoValue($item);

        }

        return $result;
    }


    if (
        $value instanceof MongoDB\BSON\ObjectId
    ) {

        return (string) $value;
    }


    if (
        $value instanceof MongoDB\BSON\UTCDateTime
    ) {

        try {

            return $value
                ->toDateTime()
                ->format(DATE_ATOM);

        } catch (Throwable $e) {

            return null;

        }

    }


    if (is_array($value)) {

        $result = [];

        foreach ($value as $key => $item) {

            $result[$key] = safeMongoValue($item);

        }

        return $result;
    }


    return $value;
}


/*
|--------------------------------------------------------------------------
| Generic field helper
|--------------------------------------------------------------------------
*/

function firstUserValue(
    MongoDB\Model\BSONDocument $user,
    array $fields,
    mixed $default = null
): mixed {

    foreach ($fields as $field) {

        if (
            isset($user[$field]) &&
            $user[$field] !== null &&
            $user[$field] !== ""
        ) {

            return $user[$field];

        }

    }

    return $default;
}


/*
|--------------------------------------------------------------------------
| Determine user's registered withdrawal number
|--------------------------------------------------------------------------
|
| We support several possible field names so the API can work with
| the existing Crown Cash user documents.
|--------------------------------------------------------------------------
*/

$registeredNumber = firstUserValue(
    $user,
    [
        "withdrawal_number",
        "withdrawalNumber",
        "registered_withdrawal_number",
        "registeredWithdrawalNumber",
        "registered_phone",
        "registeredPhone",
        "phone",
        "phone_number",
        "phoneNumber",
        "mobile",
        "mobile_number",
        "mobileNumber"
    ]
);


/*
|--------------------------------------------------------------------------
| Determine account name
|--------------------------------------------------------------------------
*/

$firstName = firstUserValue(
    $user,
    [
        "first_name",
        "firstName",
        "firstname"
    ],
    ""
);


$lastName = firstUserValue(
    $user,
    [
        "last_name",
        "lastName",
        "lastname"
    ],
    ""
);


$accountName = firstUserValue(
    $user,
    [
        "account_name",
        "accountName",
        "name",
        "full_name",
        "fullName"
    ],
    ""
);


if (
    trim((string)$accountName) === "" &&
    (
        trim((string)$firstName) !== "" ||
        trim((string)$lastName) !== ""
    )
) {

    $accountName =
        trim(
            (string)$firstName .
            " " .
            (string)$lastName
        );

}


/*
|--------------------------------------------------------------------------
| Normalize phone number
|--------------------------------------------------------------------------
*/

function normalizePhoneNumber(
    mixed $number
): string {

    $number = trim((string)$number);

    /*
     * Keep only digits and a possible leading +.
     */

    $number = preg_replace(
        "/[^\d+]/",
        "",
        $number
    ) ?? "";


    /*
     * Uganda:
     * +2567XXXXXXXX -> 07XXXXXXXX
     */

    if (
        str_starts_with($number, "+256")
    ) {

        $number =
            "0" .
            substr($number, 4);

    }


    /*
     * Uganda:
     * 2567XXXXXXXX -> 07XXXXXXXX
     */

    if (
        str_starts_with($number, "256")
    ) {

        $number =
            "0" .
            substr($number, 3);

    }


    return $number;
}


$registeredNumber =
    normalizePhoneNumber($registeredNumber);


/*
|--------------------------------------------------------------------------
| Registered account validation
|--------------------------------------------------------------------------
*/

if ($registeredNumber === "") {

    respond(
        false,
        "No registered withdrawal number was found on your account. Please update your account details before requesting a withdrawal.",
        [],
        400
    );

}


/*
|--------------------------------------------------------------------------
| Basic Uganda mobile-number validation
|--------------------------------------------------------------------------
|
| This is intentionally a basic validation. The actual mobile-money
| network should come from the user's stored/verified account data.
|--------------------------------------------------------------------------
*/

if (
    !preg_match(
        "/^07\d{8}$/",
        $registeredNumber
    )
) {

    respond(
        false,
        "Your registered withdrawal number is invalid. Please contact Crown Cash support.",
        [],
        400
    );

}


/*
|--------------------------------------------------------------------------
| Determine registered network if stored
|--------------------------------------------------------------------------
|
| We do NOT allow the frontend to choose a network.
| If the account has a verified network field, preserve it.
|--------------------------------------------------------------------------
*/

$registeredNetwork = firstUserValue(
    $user,
    [
        "withdrawal_method",
        "withdrawalMethod",
        "withdrawal_network",
        "withdrawalNetwork",
        "registered_network",
        "registeredNetwork",
        "mobile_money_network",
        "mobileMoneyNetwork",
        "network"
    ],
    null
);


if ($registeredNetwork !== null) {

    $registeredNetwork =
        strtolower(trim((string)$registeredNetwork));

}


/*
|--------------------------------------------------------------------------
| Available balance
|--------------------------------------------------------------------------
*/

$availableBalanceValue = firstUserValue(
    $user,
    [
        "available_balance",
        "availableBalance",
        "balance",
        "wallet_balance",
        "walletBalance",
        "account_balance",
        "accountBalance"
    ],
    0
);


$availableBalance =
    is_numeric($availableBalanceValue)
        ? (float)$availableBalanceValue
        : 0.0;


/*
|--------------------------------------------------------------------------
| Constants
|--------------------------------------------------------------------------
*/

const MIN_WITHDRAWAL = 5000.0;
const WITHDRAWAL_FEE_RATE = 0.20;


/*
|--------------------------------------------------------------------------
| GET
|--------------------------------------------------------------------------
|
| Returns account information for the withdrawal page.
|--------------------------------------------------------------------------
*/

if ($_SERVER["REQUEST_METHOD"] === "GET") {

    try {

        /*
         * Recent withdrawals belonging ONLY to this user.
         */

        $userId =
            $user["_id"] ?? null;


        $withdrawalQuery = [];


        if ($userId !== null) {

            $withdrawalQuery = [
                "user_id" => $userId
            ];

        }


        $recentWithdrawals = [];


        if (!empty($withdrawalQuery)) {

            $cursor =
                $withdrawals->find(
                    $withdrawalQuery,
                    [
                        "sort" => [
                            "created_at" => -1
                        ],
                        "limit" => 10
                    ]
                );


            foreach ($cursor as $withdrawal) {

                $recentWithdrawals[] =
                    safeMongoValue($withdrawal);

            }

        }


        /*
         * Check whether there is currently a pending withdrawal.
         */

        $pendingWithdrawal =
            null;


        if (!empty($withdrawalQuery)) {

            $pendingWithdrawal =
                $withdrawals->findOne(
                    array_merge(
                        $withdrawalQuery,
                        [
                            "status" => [
                                '$in' => [
                                    "pending",
                                    "processing",
                                    "awaiting_approval"
                                ]
                            ]
                        ]
                    )
                );

        }


        respond(
            true,
            "Withdrawal account loaded.",
            [
                "user" => [
                    "id" => isset($user["_id"])
                        ? (string)$user["_id"]
                        : null,

                    "name" =>
                        (string)$accountName,

                    "account_name" =>
                        (string)$accountName,

                    "withdrawal_number" =>
                        $registeredNumber,

                    "withdrawalNumber" =>
                        $registeredNumber,

                    "available_balance" =>
                        $availableBalance,

                    "availableBalance" =>
                        $availableBalance,

                    /*
                     * Network is returned only if it is already
                     * stored on the account. It is never accepted
                     * from the browser during POST.
                     */
                    "withdrawal_network" =>
                        $registeredNetwork
                ],

                "pending_withdrawal" =>
                    $pendingWithdrawal !== null,

                "withdrawals" =>
                    $recentWithdrawals
            ]
        );


    } catch (Throwable $e) {

        error_log(
            "CROWN CASH WITHDRAW GET ERROR: " .
            $e->getMessage()
        );

        respond(
            false,
            "Unable to load withdrawal information.",
            [],
            500
        );

    }

}


/*
|--------------------------------------------------------------------------
| Only POST remains
|--------------------------------------------------------------------------
*/

if ($_SERVER["REQUEST_METHOD"] !== "POST") {

    respond(
        false,
        "Invalid request method.",
        [],
        405
    );

}


/*
|--------------------------------------------------------------------------
| Read JSON request
|--------------------------------------------------------------------------
*/

$rawInput =
    file_get_contents("php://input");


if (
    $rawInput === false ||
    trim($rawInput) === ""
) {

    respond(
        false,
        "No withdrawal data was received.",
        [],
        400
    );

}


$input =
    json_decode(
        $rawInput,
        true
    );


if (
    !is_array($input)
) {

    respond(
        false,
        "Invalid withdrawal data.",
        [],
        400
    );

}


/*
|--------------------------------------------------------------------------
| IMPORTANT SECURITY RULE
|--------------------------------------------------------------------------
|
| Only amount is accepted from the frontend.
|
| We deliberately ignore:
|   method
|   account
|   phone
|   network
|   withdrawal_number
|   withdrawalNumber
|
| This prevents a user from changing the destination account.
|--------------------------------------------------------------------------
*/

if (!array_key_exists("amount", $input)) {

    respond(
        false,
        "Withdrawal amount is required.",
        [],
        400
    );

}


$amountValue =
    $input["amount"];


if (
    is_string($amountValue)
) {

    $amountValue =
        trim($amountValue);

}


if (
    !is_numeric($amountValue)
) {

    respond(
        false,
        "Please enter a valid withdrawal amount.",
        [],
        400
    );

}


$amount =
    (float)$amountValue;


/*
|--------------------------------------------------------------------------
| Validate amount
|--------------------------------------------------------------------------
*/

if (
    !is_finite($amount) ||
    $amount <= 0
) {

    respond(
        false,
        "Please enter a valid withdrawal amount.",
        [],
        400
    );

}


if (
    $amount < MIN_WITHDRAWAL
) {

    respond(
        false,
        "The minimum withdrawal amount is UGX 5,000.",
        [
            "minimum_withdrawal" =>
                MIN_WITHDRAWAL
        ],
        400
    );

}


/*
|--------------------------------------------------------------------------
| Optional amount precision protection
|--------------------------------------------------------------------------
|
| Crown Cash withdrawal amounts are handled as whole Uganda Shillings.
|--------------------------------------------------------------------------
*/

if (
    floor($amount) !== $amount
) {

    respond(
        false,
        "Withdrawal amounts must be whole Uganda Shillings.",
        [],
        400
    );

}


/*
|--------------------------------------------------------------------------
| Balance check
|--------------------------------------------------------------------------
*/

if (
    $amount > $availableBalance
) {

    respond(
        false,
        "Your withdrawal amount cannot exceed your available balance.",
        [
            "available_balance" =>
                $availableBalance,

            "requested_amount" =>
                $amount
        ],
        400
    );

}


/*
|--------------------------------------------------------------------------
| Calculate fee and net amount
|--------------------------------------------------------------------------
*/

$fee =
    round(
        $amount * WITHDRAWAL_FEE_RATE,
        2
    );


$netAmount =
    round(
        $amount - $fee,
        2
    );


/*
|--------------------------------------------------------------------------
| User identity
|--------------------------------------------------------------------------
*/

$userId =
    $user["_id"] ?? null;


if ($userId === null) {

    respond(
        false,
        "Your account could not be identified.",
        [],
        401
    );

}


/*
|--------------------------------------------------------------------------
| Prevent duplicate pending withdrawals
|--------------------------------------------------------------------------
*/

try {

    $pendingQuery = [
        "user_id" => $userId,

        "status" => [
            '$in' => [
                "pending",
                "processing",
                "awaiting_approval"
            ]
        ]
    ];


    $existingPending =
        $withdrawals->findOne(
            $pendingQuery
        );


    if ($existingPending !== null) {

        respond(
            false,
            "You already have a pending withdrawal request. Please wait for it to be processed before requesting another withdrawal.",
            [
                "pending_withdrawal" => true
            ],
            409
        );

    }


} catch (Throwable $e) {

    error_log(
        "CROWN CASH PENDING WITHDRAW CHECK ERROR: " .
        $e->getMessage()
    );

    respond(
        false,
        "Unable to verify your existing withdrawal requests.",
        [],
        500
    );

}


/*
|--------------------------------------------------------------------------
| Generate withdrawal reference
|--------------------------------------------------------------------------
*/

try {

    $withdrawalReference =
        "CW-" .
        date("YmdHis") .
        "-" .
        strtoupper(
            bin2hex(
                random_bytes(4)
            )
        );

} catch (Throwable $e) {

    $withdrawalReference =
        "CW-" .
        date("YmdHis") .
        "-" .
        strtoupper(
            substr(
                md5(
                    uniqid(
                        (string)mt_rand(),
                        true
                    )
                ),
                0,
                8
            )
        );

}


/*
|--------------------------------------------------------------------------
| Prepare withdrawal document
|--------------------------------------------------------------------------
*/

$now =
    new MongoDB\BSON\UTCDateTime(
        (int)(microtime(true) * 1000)
    );


$withdrawalDocument = [

    /*
     * User identity
     */

    "user_id" =>
        $userId,

    "userId" =>
        $userId,


    /*
     * User information snapshot.
     */

    "user_name" =>
        (string)$accountName,

    "account_name" =>
        (string)$accountName,


    /*
     * Registered destination.
     *
     * These values are taken from MongoDB, NOT from
     * the frontend request.
     */

    "withdrawal_number" =>
        $registeredNumber,

    "withdrawalNumber" =>
        $registeredNumber,


    /*
     * Preserve verified network if it exists.
     */

    "withdrawal_network" =>
        $registeredNetwork,

    "withdrawalNetwork" =>
        $registeredNetwork,


    /*
     * Money
     */

    "amount" =>
        $amount,

    "requested_amount" =>
        $amount,

    "fee" =>
        $fee,

    "withdrawal_fee" =>
        $fee,

    "fee_rate" =>
        WITHDRAWAL_FEE_RATE,

    "net_amount" =>
        $netAmount,

    "amount_to_receive" =>
        $netAmount,

    "currency" =>
        "UGX",


    /*
     * Status
     */

    "status" =>
        "pending",

    "approved" =>
        false,

    "verified" =>
        false,

    "paid" =>
        false,

    "payout_completed" =>
        false,


    /*
     * Admin review
     */

    "admin_approved" =>
        false,

    "admin_rejected" =>
        false,

    "admin_id" =>
        null,

    "admin_note" =>
        null,

    "rejection_reason" =>
        null,


    /*
     * Reference
     */

    "withdrawal_reference" =>
        $withdrawalReference,

    "reference" =>
        $withdrawalReference,


    /*
     * Timestamps
     */

    "created_at" =>
        $now,

    "updated_at" =>
        $now,

    "requested_at" =>
        $now,

    "approved_at" =>
        null,

    "rejected_at" =>
        null,

    "paid_at" =>
        null

];


/*
|--------------------------------------------------------------------------
| Insert withdrawal
|--------------------------------------------------------------------------
*/

try {

    $insertResult =
        $withdrawals->insertOne(
            $withdrawalDocument
        );


    if (
        !$insertResult->isAcknowledged()
    ) {

        respond(
            false,
            "The withdrawal request could not be saved.",
            [],
            500
        );

    }


    $withdrawalId =
        $insertResult->getInsertedId();


} catch (Throwable $e) {

    error_log(
        "CROWN CASH WITHDRAW INSERT ERROR: " .
        $e->getMessage()
    );

    respond(
        false,
        "Unable to create your withdrawal request. Please try again.",
        [],
        500
    );

}


/*
|--------------------------------------------------------------------------
| Create transaction record
|--------------------------------------------------------------------------
|
| This does NOT mark the withdrawal as paid.
| It simply records the withdrawal request.
|--------------------------------------------------------------------------
*/

try {

    $transactionDocument = [

        "user_id" =>
            $userId,

        "userId" =>
            $userId,

        "type" =>
            "withdrawal",

        "transaction_type" =>
            "withdrawal",

        "category" =>
            "withdrawal",

        "amount" =>
            $amount,

        "fee" =>
            $fee,

        "net_amount" =>
            $netAmount,

        "currency" =>
            "UGX",

        "status" =>
            "pending",

        "withdrawal_id" =>
            $withdrawalId,

        "withdrawal_reference" =>
            $withdrawalReference,

        "reference" =>
            $withdrawalReference,

        "description" =>
            "Withdrawal request pending administration approval.",

        "created_at" =>
            $now,

        "updated_at" =>
            $now

    ];


    $transactions->insertOne(
        $transactionDocument
    );


} catch (Throwable $e) {

    /*
     * The withdrawal itself has already been created.
     * Log transaction failure instead of falsely telling
     * the user that the withdrawal failed.
     */

    error_log(
        "CROWN CASH WITHDRAW TRANSACTION LOG ERROR: " .
        $e->getMessage()
    );

}


/*
|--------------------------------------------------------------------------
| Success response
|--------------------------------------------------------------------------
*/

respond(
    true,
    "Withdrawal request submitted successfully. It is now pending Crown Cash administration review.",
    [

        "withdrawal" => [

            "id" =>
                (string)$withdrawalId,

            "reference" =>
                $withdrawalReference,

            "amount" =>
                $amount,

            "fee" =>
                $fee,

            "fee_rate" =>
                WITHDRAWAL_FEE_RATE,

            "net_amount" =>
                $netAmount,

            "currency" =>
                "UGX",

            /*
             * The server-confirmed registered destination.
             */

            "withdrawal_number" =>
                $registeredNumber,

            "account_name" =>
                (string)$accountName,

            "withdrawal_network" =>
                $registeredNetwork,

            "status" =>
                "pending",

            "approved" =>
                false,

            "paid" =>
                false

        ]

    ],
    201
);

?>