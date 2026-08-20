<?php

/*
|--------------------------------------------------------------------------
| Security Headers
|--------------------------------------------------------------------------
*/

header("X-Content-Type-Options: nosniff");

header("X-Frame-Options: DENY");

header(
    "Referrer-Policy: strict-origin-when-cross-origin"
);

header(
    "Content-Security-Policy: default-src 'self';"
);


/*
|--------------------------------------------------------------------------
| Session Security
|--------------------------------------------------------------------------
*/

if (session_status() === PHP_SESSION_NONE) {

    session_set_cookie_params([
        "httponly" => true,
        "secure" => true,
        "samesite" => "Strict"
    ]);

    session_start();
}

?>
