<?php

require_once "config.php";

/*
|--------------------------------------------------------------------------
| Run multiple MongoDB operations atomically
|--------------------------------------------------------------------------
*/

function runDatabaseTransaction($mongoClient, callable $callback)
{
    $session = $mongoClient->startSession();

    try {

        $session->startTransaction();

        $result = $callback($session);

        $session->commitTransaction();

        return $result;

    } catch (Throwable $e) {

        try {
            $session->abortTransaction();
        } catch (Throwable $ignore) {
        }

        throw $e;

    } finally {

        $session->endSession();
    }
}
?>
