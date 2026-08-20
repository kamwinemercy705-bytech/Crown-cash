<?php

require_once "admin_auth.php";

header("Content-Type: application/json");

try {

    $cursor = $auditLogs->find(
        [],
        [
            "sort" => [
                "created_at" => -1
            ],
            "limit" => 200
        ]
    );

    $logs = [];

    foreach ($cursor as $log) {

        $logs[] = [

            "id" =>
                (string)$log["_id"],

            "admin_id" =>
                (string)$log["admin_id"],

            "action" =>
                $log["action"] ?? "",

            "target_type" =>
                $log["target_type"] ?? "",

            "target_id" =>
                isset($log["target_id"])
                    ? (string)$log["target_id"]
                    : null,

            "details" =>
                $log["details"] ?? [],

            "created_at" =>
                isset($log["created_at"])
                    ? $log["created_at"]
                        ->toDateTime()
                        ->format("Y-m-d H:i:s")
                    : null
        ];
    }

    echo json_encode([
        "success" => true,
        "logs" => $logs
    ]);

} catch (Exception $e) {

    http_response_code(500);

    echo json_encode([
        "success" => false,
        "message" => "Unable to load audit logs."
    ]);
}
?>
