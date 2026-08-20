<?php

require_once "auth.php";
require_once "config.php";

/*
|--------------------------------------------------------------------------
| Verify that the logged-in user is an administrator
|--------------------------------------------------------------------------
*/

try {

    $userId = new MongoDB\BSON\ObjectId(
        $_SESSION["user_id"]
    );

    $adminUser = $users->findOne([
        "_id" => $userId
    ]);

    if (!$adminUser) {
        http_response_code(401);
        exit("User not found.");
    }

    /*
    | The database should contain:
    | role = "admin"
    */

    if (($adminUser["role"] ?? "user") !== "admin") {
        http_response_code(403);
        exit("Administrator access required.");
    }

} catch (Exception $e) {

    http_response_code(500);
    exit("Authorization check failed.");

}
?>
