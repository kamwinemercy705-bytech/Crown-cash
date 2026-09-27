<?php

declare(strict_types=1);

/*
|--------------------------------------------------------------------------
| Crown Cash - Admin Security & Audit API
|--------------------------------------------------------------------------
| Handles:
| - Administrator authentication
| - Security overview
| - Audit log retrieval
| - Security statistics
| - Maintenance mode settings
| - Maintenance mode audit logging
|--------------------------------------------------------------------------
*/

header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Origin: https://crown-cash.vercel.app");
header("Access-Control-Allow-Credentials: true");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");

if ($_SERVER["REQUEST_METHOD"] === "OPTIONS") {
    http_response_code(204);
    exit;
}

if (!in_array($_SERVER["REQUEST_METHOD"], ["GET", "POST"], true)) {
    http_response_code(405);

    echo json_encode([
        "success" => false,
        "message" => "Method not allowed."
    ]);

    exit;
}


/*
|--------------------------------------------------------------------------
| Secure Cross-Site Session
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
| JSON Response Helper
|--------------------------------------------------------------------------
*/

function jsonResponse(
    bool $success,
    string $message = "",
    array $data = [],
    int $statusCode = 200
): void {

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
| Check Administrator Session
|--------------------------------------------------------------------------
*/

if (
    !isset($_SESSION["logged_in"]) ||
    $_SESSION["logged_in"] !== true ||
    !isset($_SESSION["user_id"])
) {

    jsonResponse(
        false,
        "Administrator login required.",
        [],
        401
    );
}


/*
|--------------------------------------------------------------------------
| Administrator Session Timeout
|--------------------------------------------------------------------------
*/

$adminLoginTime = $_SESSION["admin_login_time"]
    ?? $_SESSION["login_time"]
    ?? 0;

$adminLoginTime = (int)$adminLoginTime;

$adminSessionTimeout = 7200; // 2 hours

if (
    $adminLoginTime <= 0 ||
    (time() - $adminLoginTime) > $adminSessionTimeout
) {

    $_SESSION = [];

    if (ini_get("session.use_cookies")) {

        $params = session_get_cookie_params();

        setcookie(
            session_name(),
            "",
            time() - 42000,
            $params["path"],
            $params["domain"] ?? "",
            (bool)$params["secure"],
            (bool)$params["httponly"]
        );
    }

    session_destroy();

    jsonResponse(
        false,
        "Administrator session expired. Please login again.",
        [],
        401
    );
}


/*
|--------------------------------------------------------------------------
| Load MongoDB Configuration
|--------------------------------------------------------------------------
*/

try {

    require_once __DIR__ . "/config.php";

} catch (Throwable $e) {

    jsonResponse(
        false,
        "Database configuration could not be loaded.",
        [],
        500
    );
}


/*
|--------------------------------------------------------------------------
| Verify Administrator Against Database
|--------------------------------------------------------------------------
*/

try {

    $userId = new MongoDB\BSON\ObjectId(
        (string)$_SESSION["user_id"]
    );

} catch (Throwable $e) {

    jsonResponse(
        false,
        "Invalid administrator session.",
        [],
        401
    );
}


try {

    $adminUser = $users->findOne([
        "_id" => $userId
    ]);

    if (!$adminUser) {

        jsonResponse(
            false,
            "Administrator account was not found.",
            [],
            401
        );
    }


    /*
    |--------------------------------------------------------------------------
    | Account Status
    |--------------------------------------------------------------------------
    */

    $accountStatus = strtolower(
        trim(
            (string)(
                $adminUser["status"]
                ?? "active"
            )
        )
    );

    $blockedStatuses = [
        "blocked",
        "suspended",
        "disabled",
        "banned",
        "inactive"
    ];

    if (in_array($accountStatus, $blockedStatuses, true)) {

        jsonResponse(
            false,
            "Administrator account is not active.",
            [],
            403
        );
    }


    /*
    |--------------------------------------------------------------------------
    | Role / Account Type
    |--------------------------------------------------------------------------
    */

    $role = strtolower(
        trim(
            (string)(
                $adminUser["role"]
                ?? ""
            )
        )
    );

    $accountType = strtolower(
        trim(
            (string)(
                $adminUser["account_type"]
                ?? ""
            )
        )
    );

    $isAdmin =
        $role === "admin" ||
        $role === "administrator" ||
        $accountType === "admin" ||
        $accountType === "administrator";


    if (!$isAdmin) {

        jsonResponse(
            false,
            "Administrator privileges are required.",
            [],
            403
        );
    }


    /*
    |--------------------------------------------------------------------------
    | Optional ADMIN_USER_ID Protection
    |--------------------------------------------------------------------------
    */

    $configuredAdminId = trim(
        (string)getenv("ADMIN_USER_ID")
    );

    $configuredAdminEmail = strtolower(
        trim(
            (string)getenv("ADMIN_EMAIL")
        )
    );


    /*
    |--------------------------------------------------------------------------
    | If ADMIN_USER_ID exists, it takes priority
    |--------------------------------------------------------------------------
    */

    if ($configuredAdminId !== "") {

        if (
            (string)$adminUser["_id"]
            !== $configuredAdminId
        ) {

            jsonResponse(
                false,
                "Administrator identity is not authorized.",
                [],
                403
            );
        }

    } elseif ($configuredAdminEmail !== "") {

        $databaseEmail = strtolower(
            trim(
                (string)(
                    $adminUser["email"]
                    ?? ""
                )
            )
        );

        if (
            $databaseEmail === "" ||
            $databaseEmail !== $configuredAdminEmail
        ) {

            jsonResponse(
                false,
                "Administrator email is not authorized.",
                [],
                403
            );
        }

    } else {

        /*
        |--------------------------------------------------------------------------
        | Fail Closed
        |--------------------------------------------------------------------------
        */

        jsonResponse(
            false,
            "Administrator security configuration is incomplete.",
            [],
            500
        );
    }


    /*
    |--------------------------------------------------------------------------
    | Refresh Administrator Session
    |--------------------------------------------------------------------------
    */

    $_SESSION["logged_in"] = true;
    $_SESSION["user_id"] = (string)$adminUser["_id"];
    $_SESSION["user_email"] = (string)(
        $adminUser["email"] ?? ""
    );
    $_SESSION["role"] = $role;
    $_SESSION["account_type"] = $accountType;
    $_SESSION["admin_login_time"] = time();


} catch (MongoDB\Driver\Exception\Exception $e) {

    jsonResponse(
        false,
        "Unable to verify administrator.",
        [],
        500
    );

} catch (Throwable $e) {

    jsonResponse(
        false,
        "Administrator verification failed.",
        [],
        500
    );
}


/*
|--------------------------------------------------------------------------
| Collections
|--------------------------------------------------------------------------
*/

try {

    $auditLogs = $db->selectCollection("audit_logs");

    /*
    | system_settings will be created automatically when the first
    | maintenance setting is saved.
    */
    $systemSettings = $db->selectCollection(
        "system_settings"
    );

} catch (Throwable $e) {

    jsonResponse(
        false,
        "Unable to load security collections.",
        [],
        500
    );
}


/*
|--------------------------------------------------------------------------
| Utility Functions
|--------------------------------------------------------------------------
*/

function mongoValueToString(mixed $value): string
{
    if ($value instanceof MongoDB\BSON\ObjectId) {
        return (string)$value;
    }

    if ($value instanceof MongoDB\BSON\UTCDateTime) {
        return $value
            ->toDateTime()
            ->format(DateTimeInterface::ATOM);
    }

    if ($value instanceof MongoDB\BSON\Decimal128) {
        return $value->__toString();
    }

    if (is_string($value)) {
        return $value;
    }

    if (is_numeric($value)) {
        return (string)$value;
    }

    if (is_bool($value)) {
        return $value ? "true" : "false";
    }

    if ($value === null) {
        return "";
    }

    return "";
}


function mongoValueToJson(mixed $value): mixed
{
    if (
        $value instanceof MongoDB\BSON\ObjectId ||
        $value instanceof MongoDB\BSON\UTCDateTime ||
        $value instanceof MongoDB\BSON\Decimal128
    ) {
        return mongoValueToString($value);
    }

    if (is_array($value)) {

        $result = [];

        foreach ($value as $key => $item) {
            $result[$key] = mongoValueToJson($item);
        }

        return $result;
    }

    if (is_object($value)) {

        $result = [];

        foreach (get_object_vars($value) as $key => $item) {
            $result[$key] = mongoValueToJson($item);
        }

        return $result;
    }

    return $value;
}


/*
|--------------------------------------------------------------------------
| Get Current Maintenance Settings
|--------------------------------------------------------------------------
*/

function getMaintenanceSettings(
    MongoDB\Collection $systemSettings
): array {

    $defaultSettings = [
        "enabled" => false,
        "message" => "Crown Cash is temporarily under maintenance. Please check again shortly.",
        "allow_admin_access" => true,
        "updated_at" => "",
        "updated_by" => ""
    ];


    try {

        $settings = $systemSettings->findOne([
            "_id" => "maintenance"
        ]);

        if (!$settings) {
            return $defaultSettings;
        }


        return [
            "enabled" => (bool)(
                $settings["enabled"]
                ?? false
            ),

            "message" => trim(
                (string)(
                    $settings["message"]
                    ?? $defaultSettings["message"]
                )
            ),

            "allow_admin_access" => (bool)(
                $settings["allow_admin_access"]
                ?? true
            ),

            "updated_at" => isset(
                $settings["updated_at"]
            )
                ? mongoValueToString(
                    $settings["updated_at"]
                )
                : "",

            "updated_by" => (string)(
                $settings["updated_by"]
                ?? ""
            )
        ];

    } catch (Throwable $e) {

        return $defaultSettings;
    }
}


/*
|--------------------------------------------------------------------------
| GET - Security Overview
|--------------------------------------------------------------------------
*/

if ($_SERVER["REQUEST_METHOD"] === "GET") {

    try {

        /*
        |--------------------------------------------------------------------------
        | Number of Audit Events
        |--------------------------------------------------------------------------
        */

        $securityEvents = $auditLogs->countDocuments([]);


        /*
        |--------------------------------------------------------------------------
        | Failed Security Events
        |--------------------------------------------------------------------------
        |
        | Count recent failed audit/security events from the last 24 hours.
        |
        */

        $last24Hours = new MongoDB\BSON\UTCDateTime(
            (time() - 86400) * 1000
        );

        $failedAttempts = $auditLogs->countDocuments([
            "created_at" => [
                '$gte' => $last24Hours
            ],
            '$or' => [
                [
                    "status" => "failed"
                ],
                [
                    "result" => "failed"
                ],
                [
                    "outcome" => "failed"
                ]
            ]
        ]);


        /*
        |--------------------------------------------------------------------------
        | Current Administrator Session
        |--------------------------------------------------------------------------
        |
        | PHP sessions are not stored in MongoDB by this application,
        | therefore this represents the currently verified admin session.
        |
        */

        $adminSessions = 1;


        /*
        |--------------------------------------------------------------------------
        | Security Status
        |--------------------------------------------------------------------------
        */

        $securityStatus = "Secure";

        if ($failedAttempts > 0) {
            $securityStatus = "Review";
        }


        /*
        |--------------------------------------------------------------------------
        | Load Recent Audit Records
        |--------------------------------------------------------------------------
        */

        $auditCursor = $auditLogs->find(
            [],
            [
                "sort" => [
                    "created_at" => -1
                ],
                "limit" => 500
            ]
        );


        $auditRecords = [];


        foreach ($auditCursor as $record) {

            $recordArray = [];


            foreach ($record as $key => $value) {

                if ($key === "_id") {

                    $recordArray["id"] =
                        mongoValueToString($value);

                    continue;
                }

                $recordArray[$key] =
                    mongoValueToJson($value);
            }


            /*
            |--------------------------------------------------------------------------
            | Normalize Common Audit Fields
            |--------------------------------------------------------------------------
            */

            $recordArray["id"] =
                (string)(
                    $recordArray["id"]
                    ?? ""
                );

            $recordArray["action"] =
                (string)(
                    $recordArray["action"]
                    ?? $recordArray["event"]
                    ?? $recordArray["type"]
                    ?? "system_event"
                );

            $recordArray["event"] =
                (string)(
                    $recordArray["event"]
                    ?? $recordArray["action"]
                    ?? ""
                );

            $recordArray["status"] =
                (string)(
                    $recordArray["status"]
                    ?? $recordArray["result"]
                    ?? "info"
                );

            $recordArray["admin_email"] =
                (string)(
                    $recordArray["admin_email"]
                    ?? $recordArray["email"]
                    ?? ""
                );

            $recordArray["user_id"] =
                (string)(
                    $recordArray["user_id"]
                    ?? ""
                );

            $recordArray["created_at"] =
                (string)(
                    $recordArray["created_at"]
                    ?? $recordArray["timestamp"]
                    ?? ""
                );


            $auditRecords[] = $recordArray;
        }


        /*
        |--------------------------------------------------------------------------
        | Maintenance Settings
        |--------------------------------------------------------------------------
        */

        $maintenance = getMaintenanceSettings(
            $systemSettings
        );


        /*
        |--------------------------------------------------------------------------
        | Security Controls
        |--------------------------------------------------------------------------
        */

        $securityControls = [
            "login_protection" => true,

            "session_security" => true,

            "admin_session_timeout" =>
                $adminSessionTimeout
        ];


        /*
        |--------------------------------------------------------------------------
        | Administrator Information
        |--------------------------------------------------------------------------
        */

        $adminInfo = [
            "id" => (string)$adminUser["_id"],

            "name" => (string)(
                $adminUser["full_name"]
                ?? $adminUser["name"]
                ?? ""
            ),

            "email" => (string)(
                $adminUser["email"]
                ?? ""
            ),

            "role" => (string)(
                $adminUser["role"]
                ?? $adminUser["account_type"]
                ?? "admin"
            )
        ];


        jsonResponse(
            true,
            "Security information loaded successfully.",
            [
                "security" => [
                    "status" => $securityStatus,

                    "admin_sessions" =>
                        $adminSessions,

                    "failed_attempts" =>
                        $failedAttempts,

                    "security_events" =>
                        $securityEvents,

                    "login_protection" => true,

                    "session_security" => true
                ],

                "security_controls" =>
                    $securityControls,

                "audit_logs" =>
                    $auditRecords,

                "audit_count" =>
                    count($auditRecords),

                "maintenance" =>
                    $maintenance,

                "admin" =>
                    $adminInfo
            ]
        );


    } catch (MongoDB\Driver\Exception\Exception $e) {

        jsonResponse(
            false,
            "Unable to load security information.",
            [],
            500
        );

    } catch (Throwable $e) {

        jsonResponse(
            false,
            "Security information could not be loaded.",
            [],
            500
        );
    }
}


/*
|--------------------------------------------------------------------------
| POST - Security Administration
|--------------------------------------------------------------------------
*/

if ($_SERVER["REQUEST_METHOD"] === "POST") {

    /*
    |--------------------------------------------------------------------------
    | Read JSON Body
    |--------------------------------------------------------------------------
    */

    $rawInput = file_get_contents("php://input");

    $payload = json_decode(
        $rawInput ?: "{}",
        true
    );

    if (!is_array($payload)) {
        $payload = [];
    }


    $action = strtolower(
        trim(
            (string)(
                $payload["action"]
                ?? ""
            )
        )
    );


    /*
    |--------------------------------------------------------------------------
    | Maintenance Action
    |--------------------------------------------------------------------------
    */

    if ($action === "maintenance") {

        /*
        |--------------------------------------------------------------------------
        | Validate Enabled State
        |--------------------------------------------------------------------------
        */

        if (
            !array_key_exists(
                "enabled",
                $payload
            )
        ) {

            jsonResponse(
                false,
                "Maintenance status is required.",
                [],
                400
            );
        }


        $enabled = filter_var(
            $payload["enabled"],
            FILTER_VALIDATE_BOOLEAN,
            FILTER_NULL_ON_FAILURE
        );

        if ($enabled === null) {

            jsonResponse(
                false,
                "Invalid maintenance status.",
                [],
                400
            );
        }


        /*
        |--------------------------------------------------------------------------
        | Validate Maintenance Message
        |--------------------------------------------------------------------------
        */

        $maintenanceMessage = trim(
            (string)(
                $payload["message"]
                ?? ""
            )
        );


        if (
            mb_strlen($maintenanceMessage)
            > 300
        ) {

            jsonResponse(
                false,
                "Maintenance message must not exceed 300 characters.",
                [],
                400
            );
        }


        if ($maintenanceMessage === "") {

            $maintenanceMessage =
                "Crown Cash is temporarily under maintenance. Please check again shortly.";
        }


        /*
        |--------------------------------------------------------------------------
        | Validate Admin Access Setting
        |--------------------------------------------------------------------------
        */

        $allowAdminAccess = true;

        if (
            array_key_exists(
                "allow_admin_access",
                $payload
            )
        ) {

            $allowAdminAccess = filter_var(
                $payload["allow_admin_access"],
                FILTER_VALIDATE_BOOLEAN,
                FILTER_NULL_ON_FAILURE
            );

            if ($allowAdminAccess === null) {

                jsonResponse(
                    false,
                    "Invalid administrator access setting.",
                    [],
                    400
                );
            }
        }


        /*
        |--------------------------------------------------------------------------
        | Existing Settings
        |--------------------------------------------------------------------------
        */

        $oldMaintenance =
            getMaintenanceSettings(
                $systemSettings
            );


        /*
        |--------------------------------------------------------------------------
        | Save Maintenance Settings
        |--------------------------------------------------------------------------
        */

        $now = new MongoDB\BSON\UTCDateTime(
            (int)(microtime(true) * 1000)
        );

        $adminId = (string)$adminUser["_id"];

        $adminEmail = (string)(
            $adminUser["email"]
            ?? ""
        );


        $systemSettings->updateOne(
            [
                "_id" => "maintenance"
            ],
            [
                '$set' => [
                    "enabled" =>
                        (bool)$enabled,

                    "message" =>
                        $maintenanceMessage,

                    "allow_admin_access" =>
                        (bool)$allowAdminAccess,

                    "updated_at" =>
                        $now,

                    "updated_by" =>
                        $adminId,

                    "updated_by_email" =>
                        $adminEmail
                ],

                '$setOnInsert' => [
                    "created_at" =>
                        $now
                ]
            ],
            [
                "upsert" => true
            ]
        );


        /*
        |--------------------------------------------------------------------------
        | Write Audit Log
        |--------------------------------------------------------------------------
        */

        $auditLogs->insertOne([
            "action" =>
                "maintenance_mode_changed",

            "event" =>
                "maintenance",

            "status" =>
                "success",

            "admin_id" =>
                $adminId,

            "admin_email" =>
                $adminEmail,

            "details" => [
                "previous_enabled" =>
                    (bool)$oldMaintenance["enabled"],

                "new_enabled" =>
                    (bool)$enabled,

                "previous_allow_admin_access" =>
                    (bool)$oldMaintenance[
                        "allow_admin_access"
                    ],

                "new_allow_admin_access" =>
                    (bool)$allowAdminAccess,

                "message" =>
                    $maintenanceMessage
            ],

            "created_at" =>
                $now
        ]);


        /*
        |--------------------------------------------------------------------------
        | Return Updated Settings
        |--------------------------------------------------------------------------
        */

        $updatedMaintenance =
            getMaintenanceSettings(
                $systemSettings
            );


        jsonResponse(
            true,
            $enabled
                ? "Maintenance mode has been enabled."
                : "Maintenance mode has been disabled.",
            [
                "maintenance" =>
                    $updatedMaintenance
            ]
        );
    }


    /*
    |--------------------------------------------------------------------------
    | Unknown Action
    |--------------------------------------------------------------------------
    */

    jsonResponse(
        false,
        "Unsupported security action.",
        [],
        400
    );
}


jsonResponse(
    false,
    "Invalid request.",
    [],
    400
);

?>