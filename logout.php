<?php

session_start();

/* Remove all session data */
$_SESSION = [];

/* Delete the session cookie */
if (ini_get("session.use_cookies")) {

    $params = session_get_cookie_params();

    setcookie(
        session_name(),
        '',
        time() - 42000,
        $params["path"],
        $params["domain"],
        $params["secure"],
        $params["httponly"]
    );
}

/* Destroy session */
session_destroy();

/* Return to login */
header("Location: ../login.html");
exit;

?>
