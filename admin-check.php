<?php

declare(strict_types=1);

/*
|--------------------------------------------------------------------------
| Crown Cash - Admin Access Check
|--------------------------------------------------------------------------
| Purpose:
| Confirm that the current browser session belongs to an administrator.
|
| This endpoint does not grant admin access.
| It only verifies an already authenticated admin session.
|--------------------------------------------------------------------------
*/

require_once __DIR__ . "/admin-auth.php";


/* =========================
   ADMIN SESSION CONFIRMED
========================= */

echo json_encode([
    "success" => true,
    "authenticated" => true,
    "authorized" => true,
    "message" => "Administrator access confirmed."
]);

exit;
?>