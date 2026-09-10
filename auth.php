<?php

/*
|--------------------------------------------------------------------------
| CROWN CASH - AUTHENTICATION
|--------------------------------------------------------------------------
| Protects pages/endpoints that require a logged-in user.
|--------------------------------------------------------------------------
*/

require_once __DIR__ . "/security.php";


/*
|--------------------------------------------------------------------------
| Require Login
|--------------------------------------------------------------------------
*/

if (
    empty($_SESSION["logged_in"]) ||
    empty($_SESSION["user_id"])
) {
    header("Location: https://crown-cash.vercel.app/login.html");
    exit;
}


/*
|--------------------------------------------------------------------------
| Get Authenticated User ID
|--------------------------------------------------------------------------
*/

function getAuthenticatedUserId(): ?string
{
    if (
        empty($_SESSION["logged_in"]) ||
        empty($_SESSION["user_id"])
    ) {
        return null;
    }

    return (string) $_SESSION["user_id"];
}

?>