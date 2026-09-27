<?php

declare(strict_types=1);

/*
|--------------------------------------------------------------------------
| Crown Cash — Admin Support API
|--------------------------------------------------------------------------
| Handles administrator access to customer support tickets.
|
| GET:
|   Returns all support tickets for administrators.
|
| POST:
|   action=resolve
|   Marks a support ticket as resolved.
|
| Security:
|   - Cross-site secure session
|   - Administrator authorization
|   - ADMIN_USER_ID / ADMIN_EMAIL verification
|   - User status verification
|   - Audit logging
|--------------------------------------------------------------------------
*/


/* =========================================================
   CORS
   ========================================================= */

header("Content-Type: application/json; charset=utf-8");

header(
    "Access-Control-Allow-Origin: https://crown-cash.vercel.app"
);

header(
    "Access-Control-Allow-Credentials: true"
);

header(
    "Access-Control-Allow-Methods: GET, POST, OPTIONS"
);

header(
    "Access-Control-Allow-Headers: Content-Type, Accept"
);

header(
    "Cache-Control: no-store, no-cache, must-revalidate, max-age=0"
);


/* =========================================================
   PREFLIGHT
   ========================================================= */

if ($_SERVER["REQUEST_METHOD"] === "OPTIONS") {

    http_response_code(204);

    exit;
}


/* =========================================================
   SESSION
   ========================================================= */

session_set_cookie_params([
    "lifetime" => 0,
    "path" => "/",
    "secure" => true,
    "httponly" => true,
    "samesite" => "None"
]);

session_start();


/* =========================================================
   JSON RESPONSE HELPER
   ========================================================= */

function respond(
    bool $success,
    string $message = "",
    array $extra = [],
    int $statusCode = 200
): never {

    http_response_code($statusCode);

    echo json_encode(
        array_merge(
            [
                "success" => $success,
                "message" => $message
            ],
            $extra
        ),
        JSON_UNESCAPED_SLASHES |
        JSON_UNESCAPED_UNICODE
    );

    exit;
}


/* =========================================================
   METHOD CHECK
   ========================================================= */

$method =
    $_SERVER["REQUEST_METHOD"] ?? "GET";


if (
    $method !== "GET" &&
    $method !== "POST"
) {

    header(
        "Allow: GET, POST, OPTIONS"
    );

    respond(
        false,
        "Method not allowed.",
        [],
        405
    );
}


/* =========================================================
   LOGIN CHECK
   ========================================================= */

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


/* =========================================================
   ADMIN SESSION TIMEOUT
   ========================================================= */

$adminLoginTime =
    isset($_SESSION["admin_login_time"])
        ? (int)$_SESSION["admin_login_time"]
        : (
            isset($_SESSION["login_time"])
                ? (int)$_SESSION["login_time"]
                : time()
        );


if (
    $adminLoginTime > 0 &&
    (time() - $adminLoginTime) > 7200
) {

    session_unset();
    session_destroy();

    respond(
        false,
        "Administrator session has expired. Please login again.",
        [],
        401
    );
}


/* =========================================================
   LOAD DATABASE CONFIG
   ========================================================= */

try {

    require_once __DIR__ . "/config.php";

} catch (Throwable $e) {

    respond(
        false,
        "Database configuration could not be loaded.",
        [],
        500
    );
}


/* =========================================================
   VERIFY MONGODB OBJECTS
   ========================================================= */

if (
    !isset($db) ||
    !($db instanceof MongoDB\Database)
) {

    respond(
        false,
        "Database connection is not available.",
        [],
        500
    );
}


/* =========================================================
   COLLECTIONS
   ========================================================= */

try {

    $users =
        $db->selectCollection("users");

    $supportTickets =
        $db->selectCollection("support_tickets");

    $auditLogs =
        $db->selectCollection("audit_logs");

} catch (Throwable $e) {

    respond(
        false,
        "Unable to access support collections.",
        [],
        500
    );
}


/* =========================================================
   ADMIN AUTHORIZATION
   ========================================================= */

try {

    $sessionUserId =
        (string)$_SESSION["user_id"];


    if ($sessionUserId === "") {

        respond(
            false,
            "Administrator identity is missing.",
            [],
            403
        );
    }


    /*
    |--------------------------------------------------------------------------
    | Convert session ID to MongoDB ObjectId
    |--------------------------------------------------------------------------
    */

    try {

        $mongoUserId =
            new MongoDB\BSON\ObjectId(
                $sessionUserId
            );

    } catch (Throwable $e) {

        respond(
            false,
            "Invalid administrator identity.",
            [],
            403
        );
    }


    /*
    |--------------------------------------------------------------------------
    | Find current administrator
    |--------------------------------------------------------------------------
    */

    $adminUser =
        $users->findOne([
            "_id" => $mongoUserId
        ]);


    if (!$adminUser) {

        respond(
            false,
            "Administrator account was not found.",
            [],
            403
        );
    }


    /*
    |--------------------------------------------------------------------------
    | Account status
    |--------------------------------------------------------------------------
    */

    $accountStatus =
        strtolower(
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


    if (
        in_array(
            $accountStatus,
            $blockedStatuses,
            true
        )
    ) {

        respond(
            false,
            "Administrator account is not active.",
            [],
            403
        );
    }


    /*
    |--------------------------------------------------------------------------
    | Role / account type
    |--------------------------------------------------------------------------
    */

    $role =
        strtolower(
            trim(
                (string)(
                    $adminUser["role"]
                    ?? ""
                )
            )
        );


    $accountType =
        strtolower(
            trim(
                (string)(
                    $adminUser["account_type"]
                    ?? ""
                )
            )
        );


    $isAdmin =
        (
            $role === "admin" ||
            $role === "administrator" ||
            $accountType === "admin" ||
            $accountType === "administrator"
        );


    if (!$isAdmin) {

        respond(
            false,
            "Administrator access is required.",
            [],
            403
        );
    }


    /*
    |--------------------------------------------------------------------------
    | ADMIN_USER_ID protection
    |--------------------------------------------------------------------------
    */

    $configuredAdminId =
        trim(
            (string)(
                getenv("ADMIN_USER_ID") ?: ""
            )
        );


    if (
        $configuredAdminId !== "" &&
        $configuredAdminId !== $sessionUserId
    ) {

        respond(
            false,
            "This administrator account is not authorized.",
            [],
            403
        );
    }


    /*
    |--------------------------------------------------------------------------
    | ADMIN_EMAIL fallback / restriction
    |--------------------------------------------------------------------------
    */

    $configuredAdminEmail =
        strtolower(
            trim(
                (string)(
                    getenv("ADMIN_EMAIL") ?: ""
                )
            )
        );


    if (
        $configuredAdminId === "" &&
        $configuredAdminEmail === ""
    ) {

        respond(
            false,
            "Administrator identity is not configured.",
            [],
            403
        );
    }


    if (
        $configuredAdminId === "" &&
        $configuredAdminEmail !== ""
    ) {

        $adminEmail =
            strtolower(
                trim(
                    (string)(
                        $adminUser["email"]
                        ?? ""
                    )
                )
            );


        if (
            $adminEmail === "" ||
            $adminEmail !== $configuredAdminEmail
        ) {

            respond(
                false,
                "Administrator email authorization failed.",
                [],
                403
            );
        }
    }


    /*
    |--------------------------------------------------------------------------
    | Refresh admin session information
    |--------------------------------------------------------------------------
    */

    $_SESSION["admin_authenticated"] = true;

    $_SESSION["admin_user_id"] =
        $sessionUserId;

    $_SESSION["admin_login_time"] =
        time();

    $_SESSION["role"] =
        "admin";

    $_SESSION["account_type"] =
        "admin";

} catch (Throwable $e) {

    respond(
        false,
        "Administrator authorization failed.",
        [],
        403
    );
}


/* =========================================================
   ADMIN INFORMATION
   ========================================================= */

$adminName =
    trim(
        (string)(
            $adminUser["full_name"]
            ?? $adminUser["name"]
            ?? "Administrator"
        )
    );


$adminEmail =
    trim(
        (string)(
            $adminUser["email"]
            ?? ""
        )
    );


/* =========================================================
   GET SUPPORT TICKETS
   ========================================================= */

if ($method === "GET") {

    try {

        /*
        |--------------------------------------------------------------------------
        | Read optional filters
        |--------------------------------------------------------------------------
        */

        $requestedStatus =
            strtolower(
                trim(
                    (string)(
                        $_GET["status"] ?? "all"
                    )
                )
            );


        $requestedCategory =
            strtolower(
                trim(
                    (string)(
                        $_GET["category"] ?? "all"
                    )
                )
            );


        $search =
            trim(
                (string)(
                    $_GET["search"] ?? ""
                )
            );


        /*
        |--------------------------------------------------------------------------
        | Build MongoDB query
        |--------------------------------------------------------------------------
        */

        $query = [];


        if (
            $requestedStatus !== "" &&
            $requestedStatus !== "all"
        ) {

            $query["status"] =
                $requestedStatus;
        }


        if (
            $requestedCategory !== "" &&
            $requestedCategory !== "all"
        ) {

            $query["category"] =
                $requestedCategory;
        }


        /*
        |--------------------------------------------------------------------------
        | Search
        |--------------------------------------------------------------------------
        */

        if ($search !== "") {

            $safeSearch =
                preg_quote(
                    $search,
                    "/"
                );


            $regex =
                new MongoDB\BSON\Regex(
                    $safeSearch,
                    "i"
                );


            $query["\$or"] = [
                [
                    "ticket_id" => $regex
                ],
                [
                    "subject" => $regex
                ],
                [
                    "message" => $regex
                ],
                [
                    "email" => $regex
                ],
                [
                    "full_name" => $regex
                ],
                [
                    "user_name" => $regex
                ],
                [
                    "customer_name" => $regex
                ]
            ];
        }


        /*
        |--------------------------------------------------------------------------
        | Retrieve tickets
        |--------------------------------------------------------------------------
        */

        $cursor =
            $supportTickets->find(
                $query,
                [
                    "sort" => [
                        "created_at" => -1
                    ],
                    "limit" => 500
                ]
            );


        $tickets = [];


        foreach ($cursor as $ticket) {

            /*
            |--------------------------------------------------------------------------
            | Convert MongoDB document to array
            |--------------------------------------------------------------------------
            */

            $ticketId =
                (string)(
                    $ticket["ticket_id"]
                    ?? ""
                );


            if (
                $ticketId === "" &&
                isset($ticket["_id"])
            ) {

                $ticketId =
                    (string)$ticket["_id"];
            }


            /*
            |--------------------------------------------------------------------------
            | User information
            |--------------------------------------------------------------------------
            */

            $userId =
                "";


            if (
                isset($ticket["user_id"])
            ) {

                $userId =
                    (string)$ticket["user_id"];
            }


            $fullName =
                trim(
                    (string)(
                        $ticket["full_name"]
                        ?? $ticket["customer_name"]
                        ?? $ticket["user_name"]
                        ?? ""
                    )
                );


            $email =
                trim(
                    (string)(
                        $ticket["email"]
                        ?? $ticket["customer_email"]
                        ?? $ticket["user_email"]
                        ?? ""
                    )
                );


            /*
            |--------------------------------------------------------------------------
            | If ticket does not contain user details,
            | retrieve them from users collection.
            |--------------------------------------------------------------------------
            */

            if (
                $userId !== "" &&
                (
                    $fullName === "" ||
                    $email === ""
                )
            ) {

                try {

                    $customer = null;


                    try {

                        $customer =
                            $users->findOne([
                                "_id" =>
                                    new MongoDB\BSON\ObjectId(
                                        $userId
                                    )
                            ]);

                    } catch (Throwable $e) {

                        /*
                        | Some older records may use
                        | string user IDs.
                        */
                        $customer =
                            $users->findOne([
                                "_id" =>
                                    $userId
                            ]);
                    }


                    if ($customer) {

                        if ($fullName === "") {

                            $fullName =
                                trim(
                                    (string)(
                                        $customer["full_name"]
                                        ?? $customer["name"]
                                        ?? ""
                                    )
                                );
                        }


                        if ($email === "") {

                            $email =
                                trim(
                                    (string)(
                                        $customer["email"]
                                        ?? ""
                                    )
                                );
                        }
                    }

                } catch (Throwable $e) {
                    /*
                    | Do not fail the entire support list
                    | because one customer's data cannot load.
                    */
                }
            }


            /*
            |--------------------------------------------------------------------------
            | Ticket fields
            |--------------------------------------------------------------------------
            */

            $category =
                trim(
                    (string)(
                        $ticket["category"]
                        ?? "other"
                    )
                );


            $subject =
                trim(
                    (string)(
                        $ticket["subject"]
                        ?? $ticket["title"]
                        ?? "Support request"
                    )
                );


            $message =
                (string)(
                    $ticket["message"]
                    ?? $ticket["description"]
                    ?? ""
                );


            $status =
                strtolower(
                    trim(
                        (string)(
                            $ticket["status"]
                            ?? "open"
                        )
                    )
                );


            $createdAt =
                $ticket["created_at"]
                ?? $ticket["createdAt"]
                ?? $ticket["submitted_at"]
                ?? null;


            $updatedAt =
                $ticket["updated_at"]
                ?? $ticket["updatedAt"]
                ?? null;


            /*
            |--------------------------------------------------------------------------
            | Convert dates into JSON-friendly values
            |--------------------------------------------------------------------------
            */

            if (
                $createdAt instanceof MongoDB\BSON\UTCDateTime
            ) {

                $createdAt =
                    $createdAt
                        ->toDateTime()
                        ->format(
                            DATE_ATOM
                        );

            } elseif (
                $createdAt !== null
            ) {

                $createdAt =
                    (string)$createdAt;
            }


            if (
                $updatedAt instanceof MongoDB\BSON\UTCDateTime
            ) {

                $updatedAt =
                    $updatedAt
                        ->toDateTime()
                        ->format(
                            DATE_ATOM
                        );

            } elseif (
                $updatedAt !== null
            ) {

                $updatedAt =
                    (string)$updatedAt;
            }


            /*
            |--------------------------------------------------------------------------
            | Return normalized ticket
            |--------------------------------------------------------------------------
            */

            $tickets[] = [
                "id" =>
                    $ticketId,

                "ticket_id" =>
                    $ticketId,

                "user_id" =>
                    $userId,

                "full_name" =>
                    $fullName !== ""
                        ? $fullName
                        : "Customer",

                "customer_name" =>
                    $fullName !== ""
                        ? $fullName
                        : "Customer",

                "email" =>
                    $email,

                "customer_email" =>
                    $email,

                "category" =>
                    $category,

                "subject" =>
                    $subject,

                "message" =>
                    $message,

                "status" =>
                    $status,

                "created_at" =>
                    $createdAt,

                "updated_at" =>
                    $updatedAt
            ];
        }


        /* =====================================================
           CALCULATE STATISTICS
           ===================================================== */

        $total =
            count($tickets);


        $open =
            0;


        $resolved =
            0;


        $closed =
            0;


        foreach ($tickets as $ticket) {

            $status =
                strtolower(
                    (string)(
                        $ticket["status"]
                        ?? ""
                    )
                );


            if (
                $status === "open" ||
                $status === "pending" ||
                $status === "in_progress"
            ) {

                $open++;
            }


            if ($status === "resolved") {

                $resolved++;
            }


            if ($status === "closed") {

                $closed++;
            }
        }


        /* =====================================================
           RESPONSE
           ===================================================== */

        respond(
            true,
            "Support tickets loaded successfully.",
            [
                "admin" => [
                    "name" =>
                        $adminName,

                    "email" =>
                        $adminEmail
                ],

                "stats" => [
                    "total" =>
                        $total,

                    "open" =>
                        $open,

                    "resolved" =>
                        $resolved,

                    "closed" =>
                        $closed
                ],

                "tickets" =>
                    $tickets,

                "count" =>
                    $total
            ]
        );


    } catch (
        MongoDB\Driver\Exception\Exception $e
    ) {

        respond(
            false,
            "Database error while loading support tickets.",
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


/* =========================================================
   POST — SUPPORT ACTIONS
   ========================================================= */

if ($method === "POST") {

    /*
    |--------------------------------------------------------------------------
    | Read JSON request
    |--------------------------------------------------------------------------
    */

    $rawInput =
        file_get_contents("php://input");


    $payload = [];


    if (
        is_string($rawInput) &&
        trim($rawInput) !== ""
    ) {

        $decoded =
            json_decode(
                $rawInput,
                true
            );


        if (
            is_array($decoded)
        ) {

            $payload =
                $decoded;
        }
    }


    /*
    |--------------------------------------------------------------------------
    | Also support normal POST form data
    |--------------------------------------------------------------------------
    */

    if (
        empty($payload) &&
        !empty($_POST)
    ) {

        $payload =
            $_POST;
    }


    $action =
        strtolower(
            trim(
                (string)(
                    $payload["action"]
                    ?? ""
                )
            )
        );


    if ($action === "") {

        respond(
            false,
            "Support action is required.",
            [],
            400
        );
    }


    /* =====================================================
       RESOLVE TICKET
       ===================================================== */

    if ($action === "resolve") {

        $ticketId =
            trim(
                (string)(
                    $payload["ticket_id"]
                    ?? $payload["id"]
                    ?? ""
                )
            );


        if ($ticketId === "") {

            respond(
                false,
                "Ticket ID is required.",
                [],
                400
            );
        }


        try {

            /*
            |--------------------------------------------------------------------------
            | Find ticket
            |--------------------------------------------------------------------------
            */

            $ticket =
                $supportTickets->findOne([
                    "ticket_id" =>
                        $ticketId
                ]);


            /*
            |--------------------------------------------------------------------------
            | Fallback to MongoDB ObjectId
            |--------------------------------------------------------------------------
            */

            if (!$ticket) {

                try {

                    $ticket =
                        $supportTickets->findOne([
                            "_id" =>
                                new MongoDB\BSON\ObjectId(
                                    $ticketId
                                )
                        ]);

                } catch (Throwable $e) {
                    /*
                    | Ignore invalid ObjectId and
                    | continue to not-found response.
                    */
                }
            }


            if (!$ticket) {

                respond(
                    false,
                    "Support ticket was not found.",
                    [],
                    404
                );
            }


            /*
            |--------------------------------------------------------------------------
            | Current status
            |--------------------------------------------------------------------------
            */

            $currentStatus =
                strtolower(
                    trim(
                        (string)(
                            $ticket["status"]
                            ?? "open"
                        )
                    )
                );


            if (
                $currentStatus === "resolved"
            ) {

                respond(
                    true,
                    "This support ticket is already resolved.",
                    [
                        "ticket_id" =>
                            $ticketId,

                        "status" =>
                            "resolved"
                    ]
                );
            }


            if (
                $currentStatus === "closed"
            ) {

                respond(
                    false,
                    "A closed support ticket cannot be changed.",
                    [],
                    400
                );
            }


            /*
            |--------------------------------------------------------------------------
            | Update ticket
            |--------------------------------------------------------------------------
            */

            $now =
                new MongoDB\BSON\UTCDateTime(
                    (int)(microtime(true) * 1000)
                );


            $filter = [
                "ticket_id" =>
                    $ticketId
            ];


            /*
            |--------------------------------------------------------------------------
            | If the ticket does not have ticket_id,
            | use its MongoDB _id.
            |--------------------------------------------------------------------------
            */

            if (
                !isset($ticket["ticket_id"]) &&
                isset($ticket["_id"])
            ) {

                $filter = [
                    "_id" =>
                        $ticket["_id"]
                ];
            }


            $updateResult =
                $supportTickets->updateOne(
                    $filter,
                    [
                        "\$set" => [
                            "status" =>
                                "resolved",

                            "updated_at" =>
                                $now,

                            "resolved_at" =>
                                $now,

                            "resolved_by" =>
                                $mongoUserId,

                            "resolved_by_admin" =>
                                $adminName
                        ]
                    ]
                );


            if (
                $updateResult->getMatchedCount() === 0
            ) {

                respond(
                    false,
                    "The support ticket could not be updated.",
                    [],
                    409
                );
            }


            /*
            |--------------------------------------------------------------------------
            | Audit log
            |--------------------------------------------------------------------------
            */

            try {

                $auditLogs->insertOne([
                    "action" =>
                        "support_ticket_resolved",

                    "event" =>
                        "support_ticket_resolved",

                    "admin_user_id" =>
                        $mongoUserId,

                    "admin_email" =>
                        $adminEmail,

                    "admin_name" =>
                        $adminName,

                    "ticket_id" =>
                        $ticketId,

                    "previous_status" =>
                        $currentStatus,

                    "new_status" =>
                        "resolved",

                    "created_at" =>
                        $now,

                    "ip_address" =>
                        $_SERVER["REMOTE_ADDR"]
                        ?? "",

                    "user_agent" =>
                        $_SERVER["HTTP_USER_AGENT"]
                        ?? ""
                ]);

            } catch (Throwable $e) {

                /*
                | The ticket was already updated.
                | Do not reverse the successful action
                | just because audit logging failed.
                */
            }


            respond(
                true,
                "Support ticket marked as resolved.",
                [
                    "ticket_id" =>
                        $ticketId,

                    "status" =>
                        "resolved"
                ]
            );
        }


        catch (
            MongoDB\Driver\Exception\Exception $e
        ) {

            respond(
                false,
                "Database error while updating the support ticket.",
                [],
                500
            );

        }


        catch (Throwable $e) {

            respond(
                false,
                "Unable to update the support ticket.",
                [],
                500
            );
        }
    }


    /* =====================================================
       CLOSE TICKET
       ===================================================== */

    if ($action === "close") {

        $ticketId =
            trim(
                (string)(
                    $payload["ticket_id"]
                    ?? $payload["id"]
                    ?? ""
                )
            );


        if ($ticketId === "") {

            respond(
                false,
                "Ticket ID is required.",
                [],
                400
            );
        }


        try {

            $ticket =
                $supportTickets->findOne([
                    "ticket_id" =>
                        $ticketId
                ]);


            if (!$ticket) {

                try {

                    $ticket =
                        $supportTickets->findOne([
                            "_id" =>
                                new MongoDB\BSON\ObjectId(
                                    $ticketId
                                )
                        ]);

                } catch (Throwable $e) {
                    // Ignore invalid ObjectId.
                }
            }


            if (!$ticket) {

                respond(
                    false,
                    "Support ticket was not found.",
                    [],
                    404
                );
            }


            $currentStatus =
                strtolower(
                    trim(
                        (string)(
                            $ticket["status"]
                            ?? "open"
                        )
                    )
                );


            if (
                $currentStatus === "closed"
            ) {

                respond(
                    true,
                    "This support ticket is already closed.",
                    [
                        "ticket_id" =>
                            $ticketId,

                        "status" =>
                            "closed"
                    ]
                );
            }


            $now =
                new MongoDB\BSON\UTCDateTime(
                    (int)(microtime(true) * 1000)
                );


            $filter = [
                "ticket_id" =>
                    $ticketId
            ];


            if (
                !isset($ticket["ticket_id"]) &&
                isset($ticket["_id"])
            ) {

                $filter = [
                    "_id" =>
                        $ticket["_id"]
                ];
            }


            $result =
                $supportTickets->updateOne(
                    $filter,
                    [
                        "\$set" => [
                            "status" =>
                                "closed",

                            "updated_at" =>
                                $now,

                            "closed_at" =>
                                $now,

                            "closed_by" =>
                                $mongoUserId,

                            "closed_by_admin" =>
                                $adminName
                        ]
                    ]
                );


            if (
                $result->getMatchedCount() === 0
            ) {

                respond(
                    false,
                    "The support ticket could not be closed.",
                    [],
                    409
                );
            }


            try {

                $auditLogs->insertOne([
                    "action" =>
                        "support_ticket_closed",

                    "event" =>
                        "support_ticket_closed",

                    "admin_user_id" =>
                        $mongoUserId,

                    "admin_email" =>
                        $adminEmail,

                    "admin_name" =>
                        $adminName,

                    "ticket_id" =>
                        $ticketId,

                    "previous_status" =>
                        $currentStatus,

                    "new_status" =>
                        "closed",

                    "created_at" =>
                        $now,

                    "ip_address" =>
                        $_SERVER["REMOTE_ADDR"]
                        ?? "",

                    "user_agent" =>
                        $_SERVER["HTTP_USER_AGENT"]
                        ?? ""
                ]);

            } catch (Throwable $e) {
                // Do not undo successful ticket update.
            }


            respond(
                true,
                "Support ticket closed successfully.",
                [
                    "ticket_id" =>
                        $ticketId,

                    "status" =>
                        "closed"
                ]
            );


        } catch (
            MongoDB\Driver\Exception\Exception $e
        ) {

            respond(
                false,
                "Database error while closing the support ticket.",
                [],
                500
            );

        } catch (Throwable $e) {

            respond(
                false,
                "Unable to close the support ticket.",
                [],
                500
            );
        }
    }


    /* =====================================================
       UNSUPPORTED ACTION
       ===================================================== */

    respond(
        false,
        "Unsupported support action.",
        [],
        400
    );
}


/* =========================================================
   FALLBACK
   ========================================================= */

respond(
    false,
    "Unable to process the request.",
    [],
    500
);

?>