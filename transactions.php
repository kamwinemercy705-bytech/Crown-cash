<?php

declare(strict_types=1);

/*
|--------------------------------------------------------------------------
| CROWN CASH - TRANSACTIONS API
|--------------------------------------------------------------------------
| Returns transactions belonging ONLY to the authenticated Crown Cash user.
|
| Supported transaction types:
|   - deposit
|   - withdrawal
|   - investment
|   - income
|
| This endpoint is read-only.
| No investment approval/rejection workflow is used here.
|--------------------------------------------------------------------------
*/


/*
|--------------------------------------------------------------------------
| ERROR HANDLING
|--------------------------------------------------------------------------
*/

ini_set("display_errors", "0");
error_reporting(E_ALL);


/*
|--------------------------------------------------------------------------
| RESPONSE HEADERS / CORS
|--------------------------------------------------------------------------
*/

header("Content-Type: application/json; charset=UTF-8");

$allowedOrigins = [
    "https://crown-cash.vercel.app",
    "https://www.crown-cash.vercel.app"
];

$origin = $_SERVER["HTTP_ORIGIN"] ?? "";

if (in_array($origin, $allowedOrigins, true)) {
    header("Access-Control-Allow-Origin: " . $origin);
}

header("Vary: Origin");
header("Access-Control-Allow-Credentials: true");
header("Access-Control-Allow-Methods: GET, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Accept");


/*
|--------------------------------------------------------------------------
| PREFLIGHT
|--------------------------------------------------------------------------
*/

if ($_SERVER["REQUEST_METHOD"] === "OPTIONS") {
    http_response_code(204);
    exit;
}


/*
|--------------------------------------------------------------------------
| ONLY GET
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
| SESSION
|--------------------------------------------------------------------------
|
| Keep the same cross-site cookie configuration used by Crown Cash.
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
| MONGODB
|--------------------------------------------------------------------------
*/

use MongoDB\BSON\ObjectId;


/*
|--------------------------------------------------------------------------
| LOAD DATABASE CONFIGURATION
|--------------------------------------------------------------------------
*/

try {

    require_once __DIR__ . "/config.php";

} catch (Throwable $e) {

    error_log(
        "Crown Cash transactions.php config error: " .
        $e->getMessage()
    );

    http_response_code(500);

    echo json_encode([
        "success" => false,
        "message" => "Database configuration could not be loaded."
    ]);

    exit;
}


/*
|--------------------------------------------------------------------------
| CHECK TRANSACTIONS COLLECTION
|--------------------------------------------------------------------------
*/

if (!isset($transactions)) {

    http_response_code(500);

    echo json_encode([
        "success" => false,
        "message" => "Transactions collection is not configured."
    ]);

    exit;
}


/*
|--------------------------------------------------------------------------
| HELPER: JSON RESPONSE
|--------------------------------------------------------------------------
*/

function transactionResponse(
    bool $success,
    string $message,
    int $statusCode,
    array $data = []
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
    );

    exit;
}


/*
|--------------------------------------------------------------------------
| HELPER: NUMERIC VALUE
|--------------------------------------------------------------------------
*/

function transactionNumber(mixed $value): float|int
{
    if ($value === null) {
        return 0;
    }

    if (is_int($value) || is_float($value)) {
        return $value;
    }

    if (is_string($value)) {

        $clean = trim($value);

        if ($clean === "") {
            return 0;
        }

        return is_numeric($clean)
            ? (float)$clean
            : 0;
    }

    if (is_object($value)) {

        /*
         * MongoDB Decimal128 / Int64 / similar BSON values.
         */

        if (method_exists($value, "toString")) {

            $stringValue = $value->toString();

            return is_numeric($stringValue)
                ? (float)$stringValue
                : 0;
        }
    }

    return 0;
}


/*
|--------------------------------------------------------------------------
| HELPER: STRING VALUE
|--------------------------------------------------------------------------
*/

function transactionString(mixed $value): string
{
    if ($value === null) {
        return "";
    }

    if (is_string($value)) {
        return $value;
    }

    if (is_scalar($value)) {
        return (string)$value;
    }

    if (is_object($value) && method_exists($value, "toString")) {
        return $value->toString();
    }

    return "";
}


/*
|--------------------------------------------------------------------------
| HELPER: DATE
|--------------------------------------------------------------------------
*/

function transactionDate(mixed $value): ?string
{
    if ($value === null) {
        return null;
    }

    try {

        if (
            is_object($value) &&
            method_exists($value, "toDateTime")
        ) {

            return $value
                ->toDateTime()
                ->format(DateTime::ATOM);
        }

        if ($value instanceof DateTimeInterface) {

            return $value->format(DateTime::ATOM);
        }

        if (is_string($value)) {

            $timestamp = strtotime($value);

            if ($timestamp === false) {
                return null;
            }

            return date(
                DateTime::ATOM,
                $timestamp
            );
        }

    } catch (Throwable $e) {

        return null;
    }

    return null;
}


/*
|--------------------------------------------------------------------------
| HELPER: TRANSACTION TYPE
|--------------------------------------------------------------------------
*/

function normalizeTransactionType(mixed $value): string
{
    $type = strtolower(
        trim(
            transactionString($value)
        )
    );

    if (
        str_contains($type, "deposit") ||
        $type === "credit" ||
        $type === "funding" ||
        $type === "topup" ||
        $type === "top-up"
    ) {

        return "deposit";
    }

    if (
        str_contains($type, "withdraw") ||
        $type === "debit"
    ) {

        return "withdrawal";
    }

    if (
        str_contains($type, "invest")
    ) {

        return "investment";
    }

    if (
        str_contains($type, "income") ||
        str_contains($type, "earning") ||
        str_contains($type, "profit") ||
        str_contains($type, "return") ||
        str_contains($type, "commission") ||
        str_contains($type, "referral")
    ) {

        return "income";
    }

    return "other";
}


/*
|--------------------------------------------------------------------------
| HELPER: TRANSACTION STATUS
|--------------------------------------------------------------------------
*/

function normalizeTransactionStatus(mixed $value): string
{
    $status = strtolower(
        trim(
            transactionString($value)
        )
    );

    if (
        $status === "complete" ||
        $status === "completed" ||
        $status === "success" ||
        $status === "successful" ||
        $status === "approved" ||
        $status === "paid"
    ) {

        return "completed";
    }

    if (
        $status === "failed" ||
        $status === "failure" ||
        $status === "error"
    ) {

        return "failed";
    }

    if (
        $status === "rejected" ||
        $status === "declined" ||
        $status === "denied"
    ) {

        return "rejected";
    }

    return "pending";
}


/*
|--------------------------------------------------------------------------
| HELPER: DEFAULT TITLE
|--------------------------------------------------------------------------
*/

function transactionTitle(string $type): string
{
    return match ($type) {

        "deposit" =>
            "Deposit",

        "withdrawal" =>
            "Withdrawal",

        "investment" =>
            "Crown Cash Investment",

        "income" =>
            "Investment Income",

        default =>
            "Transaction"
    };
}


/*
|--------------------------------------------------------------------------
| AUTHENTICATION
|--------------------------------------------------------------------------
|
| We support the different session key names that may have been used
| by the Crown Cash login system.
|
| IMPORTANT:
| We NEVER trust a user ID supplied by the browser URL or request.
| The identity comes from the server-side PHP session.
|--------------------------------------------------------------------------
*/

$sessionUserId = null;
$sessionEmail = null;


/*
|--------------------------------------------------------------------------
| USER ID FROM SESSION
|--------------------------------------------------------------------------
*/

$possibleUserIdKeys = [
    "user_id",
    "userId",
    "id",
    "uid"
];

foreach ($possibleUserIdKeys as $key) {

    if (
        isset($_SESSION[$key]) &&
        $_SESSION[$key] !== ""
    ) {

        $sessionUserId =
            transactionString(
                $_SESSION[$key]
            );

        if ($sessionUserId !== "") {
            break;
        }
    }
}


/*
|--------------------------------------------------------------------------
| USER ID FROM NESTED SESSION USER
|--------------------------------------------------------------------------
*/

if ($sessionUserId === null || $sessionUserId === "") {

    if (
        isset($_SESSION["user"]) &&
        is_array($_SESSION["user"])
    ) {

        foreach (
            ["_id", "id", "user_id", "userId"]
            as $key
        ) {

            if (
                isset($_SESSION["user"][$key]) &&
                $_SESSION["user"][$key] !== ""
            ) {

                $sessionUserId =
                    transactionString(
                        $_SESSION["user"][$key]
                    );

                if ($sessionUserId !== "") {
                    break;
                }
            }
        }
    }
}


/*
|--------------------------------------------------------------------------
| EMAIL FROM SESSION
|--------------------------------------------------------------------------
*/

$possibleEmailKeys = [
    "email",
    "user_email",
    "userEmail"
];

foreach ($possibleEmailKeys as $key) {

    if (
        isset($_SESSION[$key]) &&
        $_SESSION[$key] !== ""
    ) {

        $sessionEmail =
            strtolower(
                trim(
                    transactionString(
                        $_SESSION[$key]
                    )
                )
            );

        if ($sessionEmail !== "") {
            break;
        }
    }
}


/*
|--------------------------------------------------------------------------
| EMAIL FROM NESTED SESSION USER
|--------------------------------------------------------------------------
*/

if ($sessionEmail === null || $sessionEmail === "") {

    if (
        isset($_SESSION["user"]) &&
        is_array($_SESSION["user"])
    ) {

        foreach (
            ["email", "user_email", "userEmail"]
            as $key
        ) {

            if (
                isset($_SESSION["user"][$key]) &&
                $_SESSION["user"][$key] !== ""
            ) {

                $sessionEmail =
                    strtolower(
                        trim(
                            transactionString(
                                $_SESSION["user"][$key]
                            )
                        )
                    );

                if ($sessionEmail !== "") {
                    break;
                }
            }
        }
    }
}


/*
|--------------------------------------------------------------------------
| AUTHENTICATION CHECK
|--------------------------------------------------------------------------
|
| We accept either a valid server session user ID OR email.
|--------------------------------------------------------------------------
*/

if (
    ($sessionUserId === null || $sessionUserId === "") &&
    ($sessionEmail === null || $sessionEmail === "")
) {

    transactionResponse(
        false,
        "You are not logged in. Please log in again.",
        401
    );
}


/*
|--------------------------------------------------------------------------
| FIND THE AUTHENTICATED USER
|--------------------------------------------------------------------------
*/

$user = null;

if (isset($users)) {

    $userQueries = [];


    /*
     * ObjectId user ID.
     */

    if (
        $sessionUserId !== null &&
        $sessionUserId !== "" &&
        preg_match(
            "/^[a-f0-9]{24}$/i",
            $sessionUserId
        )
    ) {

        try {

            $userQueries[] = [
                "_id" => new ObjectId(
                    $sessionUserId
                )
            ];

        } catch (Throwable $e) {
            // Ignore invalid ObjectId.
        }
    }


    /*
     * String user ID.
     */

    if (
        $sessionUserId !== null &&
        $sessionUserId !== ""
    ) {

        $userQueries[] = [
            "_id" => $sessionUserId
        ];

        $userQueries[] = [
            "user_id" => $sessionUserId
        ];

        $userQueries[] = [
            "id" => $sessionUserId
        ];
    }


    /*
     * Email.
     */

    if (
        $sessionEmail !== null &&
        $sessionEmail !== ""
    ) {

        $userQueries[] = [
            "email" => $sessionEmail
        ];
    }


    /*
     * Find user.
     */

    foreach ($userQueries as $query) {

        try {

            $foundUser =
                $users->findOne($query);

            if ($foundUser) {

                $user = $foundUser;

                break;
            }

        } catch (Throwable $e) {

            continue;
        }
    }
}


/*
|--------------------------------------------------------------------------
| IF USER COLLECTION EXISTS BUT USER CANNOT BE FOUND
|--------------------------------------------------------------------------
*/

if (isset($users) && !$user) {

    transactionResponse(
        false,
        "Your account could not be found. Please log in again.",
        401
    );
}


/*
|--------------------------------------------------------------------------
| BUILD SAFE USER IDENTIFIERS
|--------------------------------------------------------------------------
|
| These identifiers are used ONLY against server-side database records.
|--------------------------------------------------------------------------
*/

$identityQueries = [];


/*
|--------------------------------------------------------------------------
| Session user ID variants
|--------------------------------------------------------------------------
*/

if (
    $sessionUserId !== null &&
    $sessionUserId !== ""
) {

    $identityQueries[] = [
        "user_id" => $sessionUserId
    ];

    $identityQueries[] = [
        "userId" => $sessionUserId
    ];

    $identityQueries[] = [
        "user" => $sessionUserId
    ];

    $identityQueries[] = [
        "account_id" => $sessionUserId
    ];


    /*
     * ObjectId variant.
     */

    if (
        preg_match(
            "/^[a-f0-9]{24}$/i",
            $sessionUserId
        )
    ) {

        try {

            $objectId =
                new ObjectId(
                    $sessionUserId
                );

            $identityQueries[] = [
                "user_id" => $objectId
            ];

            $identityQueries[] = [
                "userId" => $objectId
            ];

            $identityQueries[] = [
                "user" => $objectId
            ];

            $identityQueries[] = [
                "account_id" => $objectId
            ];

        } catch (Throwable $e) {
            // Ignore.
        }
    }
}


/*
|--------------------------------------------------------------------------
| Authenticated user's email
|--------------------------------------------------------------------------
*/

if ($user) {

    $databaseUserEmail =
        strtolower(
            trim(
                transactionString(
                    $user["email"] ?? ""
                )
            )
        );

    if ($databaseUserEmail !== "") {

        $identityQueries[] = [
            "email" => $databaseUserEmail
        ];

        $identityQueries[] = [
            "user_email" => $databaseUserEmail
        ];
    }
}


/*
|--------------------------------------------------------------------------
| Session email
|--------------------------------------------------------------------------
*/

if (
    $sessionEmail !== null &&
    $sessionEmail !== ""
) {

    $identityQueries[] = [
        "email" => $sessionEmail
    ];

    $identityQueries[] = [
        "user_email" => $sessionEmail
    ];
}


/*
|--------------------------------------------------------------------------
| LOAD TRANSACTIONS
|--------------------------------------------------------------------------
*/

try {

    $documents = [];


    /*
     * --------------------------------------------------------------
     * SEARCH TRANSACTIONS
     * --------------------------------------------------------------
     */

    foreach ($identityQueries as $query) {

        try {

            $cursor =
                $transactions->find(
                    $query,
                    [
                        "sort" => [
                            "created_at" => -1,
                            "_id" => -1
                        ],
                        "limit" => 500
                    ]
                );


            foreach ($cursor as $document) {

                if (!isset($document["_id"])) {
                    continue;
                }

                $documentId =
                    (string)$document["_id"];


                /*
                 * Deduplicate records that were found
                 * using multiple identity fields.
                 */

                $documents[$documentId] =
                    $document;
            }

        } catch (Throwable $e) {

            /*
             * One legacy query failing should not prevent
             * the other supported identity queries.
             */

            continue;
        }
    }


    /*
     * --------------------------------------------------------------
     * SORT NEWEST FIRST
     * --------------------------------------------------------------
     */

    $documents =
        array_values($documents);


    usort(
        $documents,
        function ($a, $b) {

            $dateA =
                $a["created_at"] ??
                $a["createdAt"] ??
                $a["date"] ??
                $a["timestamp"] ??
                null;

            $dateB =
                $b["created_at"] ??
                $b["createdAt"] ??
                $b["date"] ??
                $b["timestamp"] ??
                null;


            $timeA = 0;
            $timeB = 0;


            try {

                if (
                    $dateA instanceof DateTimeInterface
                ) {

                    $timeA =
                        $dateA->getTimestamp();

                } elseif ($dateA !== null) {

                    $parsedA =
                        strtotime(
                            transactionString($dateA)
                        );

                    if ($parsedA !== false) {
                        $timeA = $parsedA;
                    }
                }

            } catch (Throwable $e) {
                $timeA = 0;
            }


            try {

                if (
                    $dateB instanceof DateTimeInterface
                ) {

                    $timeB =
                        $dateB->getTimestamp();

                } elseif ($dateB !== null) {

                    $parsedB =
                        strtotime(
                            transactionString($dateB)
                        );

                    if ($parsedB !== false) {
                        $timeB = $parsedB;
                    }
                }

            } catch (Throwable $e) {
                $timeB = 0;
            }


            return $timeB <=> $timeA;
        }
    );


    /*
     * --------------------------------------------------------------
     * FORMAT TRANSACTIONS
     * --------------------------------------------------------------
     */

    $result = [];


    foreach ($documents as $document) {

        /*
         * Type.
         */

        $rawType =
            $document["type"] ??
            $document["transaction_type"] ??
            $document["transactionType"] ??
            $document["category"] ??
            $document["kind"] ??
            "";


        $type =
            normalizeTransactionType(
                $rawType
            );


        /*
         * Status.
         */

        $rawStatus =
            $document["status"] ??
            $document["state"] ??
            "pending";


        $status =
            normalizeTransactionStatus(
                $rawStatus
            );


        /*
         * Amount.
         */

        $amount =
            transactionNumber(
                $document["amount"] ??
                $document["value"] ??
                $document["total"] ??
                $document["transaction_amount"] ??
                0
            );


        /*
         * Reference.
         */

        $reference =
            $document["transaction_reference"] ??
            $document["reference"] ??
            $document["transaction_id"] ??
            $document["transactionId"] ??
            $document["ref"] ??
            (
                isset($document["_id"])
                    ? (string)$document["_id"]
                    : ""
            );


        /*
         * Description.
         */

        $description =
            $document["description"] ??
            $document["title"] ??
            $document["name"] ??
            null;


        $description =
            transactionString(
                $description
            );


        /*
         * For new Crown Cash investments, don't expose
         * old Starter / Standard / Advanced plan names.
         */

        if ($type === "investment") {

            $description =
                "Crown Cash Investment";
        }


        if ($description === "") {

            $description =
                transactionTitle($type);
        }


        /*
         * Date.
         */

        $createdAt =
            $document["created_at"] ??
            $document["createdAt"] ??
            $document["date"] ??
            $document["timestamp"] ??
            null;


        /*
         * Payment method.
         */

        $paymentMethod =
            transactionString(
                $document["payment_method"] ??
                $document["method"] ??
                ""
            );


        /*
         * Optional investment reference.
         */

        $investmentId =
            transactionString(
                $document["investment_id"] ??
                $document["investmentId"] ??
                ""
            );


        /*
         * Optional metadata.
         */

        $result[] = [

            "id" =>
                isset($document["_id"])
                    ? (string)$document["_id"]
                    : null,

            "type" =>
                $type,

            "title" =>
                $description,

            "description" =>
                $description,

            "amount" =>
                $amount,

            "currency" =>
                "UGX",

            "status" =>
                $status,

            "reference" =>
                transactionString(
                    $reference
                ),

            "transaction_reference" =>
                transactionString(
                    $reference
                ),

            "payment_method" =>
                $paymentMethod,

            "method" =>
                $paymentMethod,

            "investment_id" =>
                $investmentId,

            "created_at" =>
                transactionDate(
                    $createdAt
                )
        ];
    }


    /*
     * --------------------------------------------------------------
     * GET CURRENT WALLET BALANCE
     * --------------------------------------------------------------
     */

    $balance = 0;


    if ($user) {

        $balance =
            transactionNumber(
                $user["balance"] ??
                $user["wallet_balance"] ??
                $user["walletBalance"] ??
                0
            );
    }


    /*
     * --------------------------------------------------------------
     * CALCULATE SUMMARY
     * --------------------------------------------------------------
     *
     * Only completed financial transactions are included in totals.
     * This prevents pending/failed deposits or withdrawals from
     * incorrectly inflating the dashboard totals.
     *
     * Investments are counted when their transaction itself is
     * completed, because the new Crown Cash investment flow deducts
     * the amount immediately.
     * --------------------------------------------------------------
     */

    $summary = [
        "deposits" => 0,
        "withdrawals" => 0,
        "investments" => 0,
        "income" => 0
    ];


    foreach ($result as $transaction) {

        if (
            $transaction["status"] !== "completed"
        ) {
            continue;
        }


        $amount =
            transactionNumber(
                $transaction["amount"]
            );


        switch (
            $transaction["type"]
        ) {

            case "deposit":

                $summary["deposits"] +=
                    $amount;

                break;


            case "withdrawal":

                $summary["withdrawals"] +=
                    $amount;

                break;


            case "investment":

                $summary["investments"] +=
                    $amount;

                break;


            case "income":

                $summary["income"] +=
                    $amount;

                break;
        }
    }


    /*
     * --------------------------------------------------------------
     * RESPONSE
     * --------------------------------------------------------------
     */

    transactionResponse(
        true,
        "Transactions loaded successfully.",
        200,
        [

            "balance" =>
                $balance,

            "available_balance" =>
                $balance,

            "wallet_balance" =>
                $balance,

            "transactions" =>
                $result,

            "summary" =>
                $summary,

            "count" =>
                count($result)
        ]
    );


} catch (Throwable $e) {

    error_log(
        "Crown Cash transactions.php error: " .
        $e->getMessage()
    );


    /*
     * Never expose database/server error details
     * to the user in production.
     */

    transactionResponse(
        false,
        "Unable to load transactions. Please try again.",
        500
    );
}