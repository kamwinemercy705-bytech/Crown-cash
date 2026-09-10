<?php

/*
|--------------------------------------------------------------------------
| CROWN CASH - SECURITY
|--------------------------------------------------------------------------
| Security headers and secure cross-site PHP session configuration.
|--------------------------------------------------------------------------
*/

/*
|--------------------------------------------------------------------------
| Security Headers
|--------------------------------------------------------------------------
*/

header("X-Content-Type-Options: nosniff");

header("X-Frame-Options: DENY");

header("Referrer-Policy: strict-origin-when-cross-origin");

/*
 * Keep the Content Security Policy compatible with the
 * Crown Cash frontend and API architecture.
 */
header(
    "Content-Security-Policy: default-src 'self';"
);


/*
|--------------------------------------------------------------------------
| Session Security
|--------------------------------------------------------------------------
|
| The Crown Cash frontend is hosted on Vercel while the PHP API
| is hosted on Render.
|
| Therefore the authenticated session cookie must allow the
| cross-site frontend → backend request.
|
|--------------------------------------------------------------------------
*/

if (session_status() === PHP_SESSION_NONE) {

    session_set_cookie_params([
        "lifetime" => 0,
        "path" => "/",
        "domain" => "",
        "secure" => true,
        "httponly" => true,
        "samesite" => "None"
    ]);

    session_start();
}

?>