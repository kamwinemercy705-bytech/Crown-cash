<?php
declare(strict_types=1);

/*
|--------------------------------------------------------------------------
| Crown Cash - Investment API
|--------------------------------------------------------------------------
| File: investment.php
|
| POST
|   Creates a new investment.
|
| ACCOUNTING RULES
|   1. User must have enough deposited wallet balance.
|   2. Investment amount is deducted exactly once when created.
|   3. Investment starts as pending.
|   4. Admin approval does NOT deduct money again.
|   5. Daily earnings are handled by daily_earnings.php.
|   6. Principal is returned when the investment completes.
|--------------------------------------------------------------------------
*/

header("Content-Type: application/json; charset=utf-8");
header("Access-Control-Allow-Origin: https://crown-cash.vercel.app");
header("Access-Control-Allow-Credentials: true");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With");
header("Access-Control-Allow-Methods: POST, OPTIONS");

if ($_SERVER["REQUEST_METHOD"] === "OPTIONS") {
    http_response_code(204);
    exit;
}

require_once __DIR__ . "/config.php";

use MongoDB\BSON\ObjectId;
use MongoDB\BSON\UTCDateTime;
use MongoDB\BSON\Decimal128;


/*
|--------------------------------------------------------------------------
| RESPONSE
|--------------------------------------------------------------------------
*/

function investmentResponse(
    bool $success,
    string $message = "",
    array $data = [],
    int $status = 200
): void {

    http_response_code($status);

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
| SESSION
|--------------------------------------------------------------------------
*/

if (function_exists("startSecureSession")) {

    startSecureSession();

} elseif (session_status() !== PHP_SESSION_ACTIVE) {

    session_set_cookie_params([
        "lifetime" => 0,
        "path" => "/",
        "secure" => true,
        "httponly" => true,
        "samesite" => "None"
    ]);

    session_start();
}


/*
|--------------------------------------------------------------------------
| HELPERS
|--------------------------------------------------------------------------
*/

function investmentString($value, string $default = ""): string
{
    if ($value === null) {
        return $default;
    }

    if (is_string($value)) {
        return trim($value);
    }

    if (is_scalar($value)) {
        return trim((string)$value);
    }

    return $default;
}


function investmentMoney($value): float
{
    if ($value instanceof Decimal128) {
        return (float)$value->__toString();
    }

    if (is_int($value) || is_float($value)) {
        return (float)$value;
    }

    if (is_string($value)) {

        $clean = str_replace(
            [",", "UGX", "ugx", " "],
            "",
            $value
        );

        if (is_numeric($clean)) {
            return (float)$clean;
        }
    }

    if (is_numeric($value)) {
        return (float)$value;
    }

    return 0.0;
}


function investmentObjectId($value): ?ObjectId
{
    if ($value instanceof ObjectId) {
        return $value;
    }

    if (
        is_string($value) &&
        preg_match(
            '/^[a-fA-F0-9]{24}$/',
            trim($value)
        )
    ) {

        try {
            return new ObjectId(trim($value));
        } catch (Throwable $e) {
            return null;
        }
    }

    return null;
}


/*
|--------------------------------------------------------------------------
| CURRENT USER
|--------------------------------------------------------------------------
*/

function getInvestmentUser()
{
    global $users;

    $sessionUserId =
        $_SESSION["user_id"] ??
        $_SESSION["userId"] ??
        null;

    $sessionEmail =
        $_SESSION["email"] ??
        $_SESSION["user_email"] ??
        null;

    if ($sessionUserId !== null) {

        $objectId = investmentObjectId(
            $sessionUserId
        );

        if ($objectId !== null) {

            try {

                $user = $users->findOne([
                    "_id" => $objectId
                ]);

                if ($user !== null) {
                    return $user;
                }

            } catch (Throwable $e) {
                error_log(
                    "Investment ObjectId user lookup: " .
                    $e->getMessage()
                );
            }
        }

        try {

            $user = $users->findOne([
                "id" => investmentString(
                    $sessionUserId
                )
            ]);

            if ($user !== null) {
                return $user;
            }

        } catch (Throwable $e) {
            error_log(
                "Investment string user lookup: " .
                $e->getMessage()
            );
        }
    }

    if ($sessionEmail !== null) {

        try {

            $user = $users->findOne([
                "email" => strtolower(
                    trim(
                        (string)$sessionEmail
                    )
                )
            ]);

            if ($user !== null) {
                return $user;
            }

        } catch (Throwable $e) {
            error_log(
                "Investment email lookup: " .
                $e->getMessage()
            );
        }
    }

    return null;
}


/*
|--------------------------------------------------------------------------
| WALLET BALANCE
|--------------------------------------------------------------------------
*/

function getInvestmentWalletBalance($user): float
{
    if (array_key_exists("balance", $user)) {
        return investmentMoney(
            $user["balance"]
        );
    }

    if (array_key_exists("wallet_balance", $user)) {
        return investmentMoney(
            $user["wallet_balance"]
        );
    }

    if (array_key_exists("walletBalance", $user)) {
        return investmentMoney(
            $user["walletBalance"]
        );
    }

    if (
        isset($user["wallet"]) &&
        (
            is_array($user["wallet"]) ||
            $user["wallet"] instanceof \MongoDB\Model\BSONDocument
        )
    ) {

        return investmentMoney(
            $user["wallet"]["balance"] ?? 0
        );
    }

    return 0.0;
}


/*
|--------------------------------------------------------------------------
| WALLET UPDATE
|--------------------------------------------------------------------------
|
| We update all existing Crown Cash wallet fields together.
| This prevents dashboard/profile pages from showing different balances.
|--------------------------------------------------------------------------
*/

function deductInvestmentWallet(
    $user,
    float $amount,
    float $currentBalance
): array {

    global $users;

    $newBalance = $currentBalance - $amount;

    if ($newBalance < 0) {
        return [
            "success" => false,
            "new_balance" => $currentBalance
        ];
    }

    $filter = [];

    if (isset($user["_id"])) {

        $filter = [
            "_id" => $user["_id"],
            '$or' => [
                [
                    "balance" => $currentBalance
                ],
                [
                    "wallet_balance" => $currentBalance
                ],
                [
                    "walletBalance" => $currentBalance
                ],
                [
                    "wallet.balance" => $currentBalance
                ]
            ]
        ];

    } elseif (isset($user["id"])) {

        $filter = [
            "id" => $user["id"],
            '$or' => [
                [
                    "balance" => $currentBalance
                ],
                [
                    "wallet_balance" => $currentBalance
                ],
                [
                    "walletBalance" => $currentBalance
                ],
                [
                    "wallet.balance" => $currentBalance
                ]
            ]
        ];

    } else {

        return [
            "success" => false,
            "new_balance" => $currentBalance
        ];
    }

    $set = [];

    if (array_key_exists("balance", $user)) {
        $set["balance"] = $newBalance;
    }

    if (array_key_exists("wallet_balance", $user)) {
        $set["wallet_balance"] = $newBalance;
    }

    if (array_key_exists("walletBalance", $user)) {
        $set["walletBalance"] = $newBalance;
    }

    if (
        isset($user["wallet"]) &&
        (
            is_array($user["wallet"]) ||
            $user["wallet"] instanceof \MongoDB\Model\BSONDocument
        )
    ) {
        $set["wallet.balance"] = $newBalance;
    }

    /*
    |--------------------------------------------------------------------------
    | Default wallet field
    |--------------------------------------------------------------------------
    */

    if (count($set) === 0) {
        $set["balance"] = $newBalance;
    }

    $set["updated_at"] = new UTCDateTime();

    $result = $users->updateOne(
        $filter,
        [
            '$set' => $set
        ]
    );

    return [
        "success" =>
            $result->getMatchedCount() > 0,

        "new_balance" =>
            $newBalance,

        "matched" =>
            $result->getMatchedCount(),

        "modified" =>
            $result->getModifiedCount()
    ];
}


/*
|--------------------------------------------------------------------------
| READ REQUEST
|--------------------------------------------------------------------------
*/

if ($_SERVER["REQUEST_METHOD"] !== "POST") {

    investmentResponse(
        false,
        "Method not allowed.",
        [],
        405
    );
}

try {

    /*
    |--------------------------------------------------------------------------
    | Authenticate user
    |--------------------------------------------------------------------------
    */

    $user = getInvestmentUser();

    if ($user === null) {

        investmentResponse(
            false,
            "Authentication required.",
            [],
            401
        );
    }

    /*
    |--------------------------------------------------------------------------
    | Account status
    |--------------------------------------------------------------------------
    */

    foreach (
        [
            "blocked",
            "suspended",
            "disabled",
            "banned"
        ] as $field
    ) {

        if (
            isset($user[$field]) &&
            filter_var(
                $user[$field],
                FILTER_VALIDATE_BOOLEAN
            )
        ) {

            investmentResponse(
                false,
                "Your account is not allowed to make investments.",
                [],
                403
            );
        }
    }

    /*
    |--------------------------------------------------------------------------
    | JSON
    |--------------------------------------------------------------------------
    */

    $rawBody = file_get_contents(
        "php://input"
    );

    $input = json_decode(
        $rawBody ?: "{}",
        true
    );

    if (!is_array($input)) {
        $input = [];
    }

    /*
    |--------------------------------------------------------------------------
    | PLAN
    |--------------------------------------------------------------------------
    */

    $plan = strtolower(
        investmentString(
            $input["plan"] ??
            $input["investment_plan"] ??
            ""
        )
    );

    $plans = [

        "starter" => [
            "name" => "Starter",
            "amount" => 10000,
            "duration" => 30,
            "daily_rate" => 0.10
        ],

        "standard" => [
            "name" => "Standard",
            "amount" => 15000,
            "duration" => 30,
            "daily_rate" => 0.10
        ],

        "advanced" => [
            "name" => "Advanced",
            "amount" => 25000,
            "duration" => 30,
            "daily_rate" => 0.10
        ]
    ];

    /*
    |--------------------------------------------------------------------------
    | Allow direct amount if the frontend sends it
    |--------------------------------------------------------------------------
    */

    $requestedAmount = investmentMoney(
        $input["amount"] ??
        $input["investmentAmount"] ??
        0
    );

    if ($plan === "" && $requestedAmount > 0) {

        foreach ($plans as $planKey => $planData) {

            if (
                abs(
                    $requestedAmount -
                    $planData["amount"]
                ) < 0.01
            ) {

                $plan = $planKey;
                break;
            }
        }
    }

    if (!isset($plans[$plan])) {

        investmentResponse(
            false,
            "Invalid investment plan.",
            [
                "available_plans" =>
                    array_keys($plans)
            ],
            400
        );
    }

    $planData = $plans[$plan];

    $amount = (float)$planData["amount"];

    /*
    |--------------------------------------------------------------------------
    | Prevent amount manipulation
    |--------------------------------------------------------------------------
    */

    if (
        $requestedAmount > 0 &&
        abs($requestedAmount - $amount) > 0.01
    ) {

        investmentResponse(
            false,
            "The investment amount does not match the selected plan.",
            [
                "plan" => $plan,
                "required_amount" => $amount
            ],
            400
        );
    }

    /*
    |--------------------------------------------------------------------------
    | USER ID
    |--------------------------------------------------------------------------
    */

    $userId = "";

    if (isset($user["_id"])) {

        $userId = (string)$user["_id"];

    } elseif (isset($user["id"])) {

        $userId = investmentString(
            $user["id"]
        );
    }

    if ($userId === "") {

        investmentResponse(
            false,
            "Unable to determine your user account.",
            [],
            500
        );
    }

    /*
    |--------------------------------------------------------------------------
    | CURRENT WALLET
    |--------------------------------------------------------------------------
    */

    $walletBalance =
        getInvestmentWalletBalance(
            $user
        );

    /*
    |--------------------------------------------------------------------------
    | INSUFFICIENT FUNDS
    |--------------------------------------------------------------------------
    */

    if ($walletBalance < $amount) {

        investmentResponse(
            false,
            "Insufficient wallet balance. Please deposit funds before investing.",
            [
                "required" => $amount,
                "wallet_balance" => $walletBalance,
                "shortfall" =>
                    $amount - $walletBalance
            ],
            400
        );
    }

    /*
    |--------------------------------------------------------------------------
    | PREVENT DUPLICATE PENDING INVESTMENT
    |--------------------------------------------------------------------------
    */

    $duplicateFilter = [
        '$and' => [
            [
                '$or' => [
                    [
                        "user_id" => $userId
                    ],
                    [
                        "userId" => $userId
                    ]
                ]
            ],
            [
                "status" => [
                    '$in' => [
                        "pending",
                        "approved",
                        "active",
                        "running"
                    ]
                ]
            ]
        ]
    ];

    $existingInvestment =
        $investments->findOne(
            $duplicateFilter,
            [
                "sort" => [
                    "created_at" => -1
                ]
            ]
        );

    if ($existingInvestment !== null) {

        investmentResponse(
            false,
            "You already have an active or pending investment.",
            [
                "investment_id" =>
                    isset($existingInvestment["_id"])
                        ? (string)$existingInvestment["_id"]
                        : ""
            ],
            409
        );
    }

    /*
    |--------------------------------------------------------------------------
    | INVESTMENT DATES
    |--------------------------------------------------------------------------
    */

    $now = new UTCDateTime();

    /*
    |--------------------------------------------------------------------------
    | INVESTMENT DOCUMENT
    |--------------------------------------------------------------------------
    */

    $investmentDocument = [

        "user_id" =>
            $userId,

        "userId" =>
            $userId,

        "plan" =>
            $plan,

        "plan_name" =>
            $planData["name"],

        "amount" =>
            $amount,

        "principal" =>
            $amount,

        "reserved_amount" =>
            $amount,

        "duration" =>
            $planData["duration"],

        "duration_days" =>
            $planData["duration"],

        "daily_rate" =>
            $planData["daily_rate"],

        "status" =>
            "pending",

        "balance_reserved" =>
            true,

        "principal_returned" =>
            false,

        "created_at" =>
            $now,

        "updated_at" =>
            $now
    ];

    /*
    |--------------------------------------------------------------------------
    | TRANSACTION
    |--------------------------------------------------------------------------
    |
    | Use MongoDB transaction where supported.
    |--------------------------------------------------------------------------
    */

    $session = null;

    try {

        $session = $client->startSession();

        $result = $session->withTransaction(
            function ($session) use (
                &$investmentDocument,
                $user,
                $amount,
                $walletBalance,
                $userId,
                $now
            ) {

                global $users;
                global $investments;
                global $transactions;

                /*
                |--------------------------------------------------------------------------
                | Re-check wallet inside transaction
                |--------------------------------------------------------------------------
                */

                $userFilter = [];

                if (isset($user["_id"])) {

                    $userFilter = [
                        "_id" => $user["_id"],
                        '$or' => [
                            [
                                "balance" =>
                                    $walletBalance
                            ],
                            [
                                "wallet_balance" =>
                                    $walletBalance
                            ],
                            [
                                "walletBalance" =>
                                    $walletBalance
                            ],
                            [
                                "wallet.balance" =>
                                    $walletBalance
                            ]
                        ]
                    ];

                } elseif (isset($user["id"])) {

                    $userFilter = [
                        "id" => $user["id"],
                        '$or' => [
                            [
                                "balance" =>
                                    $walletBalance
                            ],
                            [
                                "wallet_balance" =>
                                    $walletBalance
                            ],
                            [
                                "walletBalance" =>
                                    $walletBalance
                            ],
                            [
                                "wallet.balance" =>
                                    $walletBalance
                            ]
                        ]
                    ];
                }

                if (empty($userFilter)) {

                    throw new RuntimeException(
                        "Unable to build wallet filter."
                    );
                }

                /*
                |--------------------------------------------------------------------------
                | Deduct wallet exactly once
                |--------------------------------------------------------------------------
                */

                $newBalance =
                    $walletBalance - $amount;

                $walletSet = [];

                if (array_key_exists("balance", $user)) {
                    $walletSet["balance"] =
                        $newBalance;
                }

                if (array_key_exists("wallet_balance", $user)) {
                    $walletSet["wallet_balance"] =
                        $newBalance;
                }

                if (array_key_exists("walletBalance", $user)) {
                    $walletSet["walletBalance"] =
                        $newBalance;
                }

                if (
                    isset($user["wallet"]) &&
                    (
                        is_array($user["wallet"]) ||
                        $user["wallet"] instanceof \MongoDB\Model\BSONDocument
                    )
                ) {
                    $walletSet["wallet.balance"] =
                        $newBalance;
                }

                if (empty($walletSet)) {
                    $walletSet["balance"] =
                        $newBalance;
                }

                $walletSet["updated_at"] =
                    $now;

                $walletUpdate =
                    $users->updateOne(
                        $userFilter,
                        [
                            '$set' =>
                                $walletSet
                        ],
                        [
                            "session" =>
                                $session
                        ]
                    );

                if (
                    $walletUpdate->getMatchedCount() !== 1
                ) {

                    throw new RuntimeException(
                        "Wallet balance changed before the investment could be created. Please try again."
                    );
                }

                /*
                |--------------------------------------------------------------------------
                | Insert investment
                |--------------------------------------------------------------------------
                */

                $investmentInsert =
                    $investments->insertOne(
                        $investmentDocument,
                        [
                            "session" =>
                                $session
                        ]
                    );

                if (
                    $investmentInsert->getInsertedCount() !== 1
                ) {

                    throw new RuntimeException(
                        "Investment could not be created."
                    );
                }

                $investmentId =
                    $investmentInsert
                        ->getInsertedId();

                /*
                |--------------------------------------------------------------------------
                | Investment transaction
                |--------------------------------------------------------------------------
                */

                $transactionDocument = [

                    "user_id" =>
                        $userId,

                    "userId" =>
                        $userId,

                    "type" =>
                        "investment",

                    "category" =>
                        "investment",

                    "direction" =>
                        "debit",

                    "amount" =>
                        $amount,

                    "status" =>
                        "pending",

                    "reference" =>
                        "INV-" .
                        strtoupper(
                            substr(
                                (string)$investmentId,
                                -12
                            )
                        ),

                    "investment_id" =>
                        (string)$investmentId,

                    "description" =>
                        "Investment created - wallet balance deducted",

                    "balance_before" =>
                        $walletBalance,

                    "balance_after" =>
                        $newBalance,

                    "created_at" =>
                        $now
                ];

                $transactions->insertOne(
                    $transactionDocument,
                    [
                        "session" =>
                            $session
                    ]
                );

                /*
                |--------------------------------------------------------------------------
                | Audit
                |--------------------------------------------------------------------------
                */

                if (function_exists("audit")) {

                    try {

                        audit(
                            "investment_created",
                            [
                                "user_id" =>
                                    $userId,

                                "investment_id" =>
                                    (string)$investmentId,

                                "plan" =>
                                    $investmentDocument["plan"],

                                "amount" =>
                                    $amount,

                                "balance_before" =>
                                    $walletBalance,

                                "balance_after" =>
                                    $newBalance
                            ]
                        );

                    } catch (Throwable $auditError) {

                        error_log(
                            "Investment audit error: " .
                            $auditError->getMessage()
                        );
                    }
                }

                $investmentDocument["_id"] =
                    $investmentId;

                $investmentDocument["wallet_balance_before"] =
                    $walletBalance;

                $investmentDocument["wallet_balance_after"] =
                    $newBalance;

                return [
                    "investment_id" =>
                        (string)$investmentId,

                    "new_balance" =>
                        $newBalance
                ];
            }
        );

    } catch (Throwable $transactionError) {

        /*
        |--------------------------------------------------------------------------
        | Fallback
        |--------------------------------------------------------------------------
        |
        | If MongoDB transactions are unavailable, do not silently create
        | an investment without deducting the wallet.
        |--------------------------------------------------------------------------
        */

        error_log(
            "Crown Cash investment transaction error: " .
            $transactionError->getMessage()
        );

        investmentResponse(
            false,
            "Investment could not be completed safely. Please try again.",
            [
                "error" =>
                    $transactionError->getMessage()
            ],
            500
        );

    } finally {

        if ($session !== null) {

            try {
                $session->endSession();
            } catch (Throwable $e) {
                // Ignore.
            }
        }
    }

    /*
    |--------------------------------------------------------------------------
    | SUCCESS
    |--------------------------------------------------------------------------
    */

    $investmentId =
        $result["investment_id"] ??
        "";

    $newBalance =
        investmentMoney(
            $result["new_balance"] ??
            ($walletBalance - $amount)
        );

    investmentResponse(
        true,
        "Investment created successfully. The investment amount has been deducted from your wallet.",
        [
            "investment" => [

                "id" =>
                    $investmentId,

                "user_id" =>
                    $userId,

                "plan" =>
                    $plan,

                "plan_name" =>
                    $planData["name"],

                "amount" =>
                    $amount,

                "principal" =>
                    $amount,

                "duration" =>
                    $planData["duration"],

                "daily_rate" =>
                    $planData["daily_rate"],

                "status" =>
                    "pending",

                "balance_reserved" =>
                    true
            ],

            "wallet" => [

                "previous_balance" =>
                    $walletBalance,

                "amount_deducted" =>
                    $amount,

                "new_balance" =>
                    $newBalance
            ]
        ]
    );

} catch (Throwable $e) {

    error_log(
        "Crown Cash investment.php error: " .
        $e->getMessage()
    );

    investmentResponse(
        false,
        "Unable to create investment.",
        [
            "error" =>
                $e->getMessage()
        ],
        500
    );
}