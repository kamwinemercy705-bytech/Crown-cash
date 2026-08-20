<?php

session_start();

if (
    empty($_SESSION["logged_in"]) ||
    empty($_SESSION["user_id"])
) {
    header("Location: ../login.html");
    exit;
}

?>
