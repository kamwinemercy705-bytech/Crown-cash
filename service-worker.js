/* =========================================================
   CROWN CASH SERVICE WORKER
========================================================= */

"use strict";

const CACHE_NAME = "crown-cash-v1";

const APP_FILES = [
    "./",
    "./dashboard.html",
    "./dashboard.css",
    "./dashboard.js",
    "./manifest.json"
];


/* =========================================================
   INSTALL
========================================================= */

self.addEventListener(
    "install",
    function (event) {

        event.waitUntil(

            caches.open(CACHE_NAME)
                .then(
                    function (cache) {

                        return cache.addAll(
                            APP_FILES
                        );

                    }
                )

        );

        self.skipWaiting();
    }
);


/* =========================================================
   ACTIVATE
========================================================= */

self.addEventListener(
    "activate",
    function (event) {

        event.waitUntil(

            caches.keys()
                .then(
                    function (cacheNames) {

                        return Promise.all(

                            cacheNames
                                .filter(
                                    function (cacheName) {

                                        return (
                                            cacheName !==
                                            CACHE_NAME
                                        );

                                    }
                                )
                                .map(
                                    function (cacheName) {

                                        return caches.delete(
                                            cacheName
                                        );

                                    }
                                )

                        );

                    }
                )

        );

        self.clients.claim();
    }
);


/* =========================================================
   FETCH
========================================================= */

self.addEventListener(
    "fetch",
    function (event) {

        /*
         * Do not intercept API requests.
         * Crown Cash account data must come
         * directly from the server.
         */

        if (
            event.request.url.includes(
                "crown-cash1.onrender.com"
            )
        ) {

            return;
        }


        /*
         * Normal website files:
         * network first, cache fallback.
         */

        event.respondWith(

            fetch(event.request)
                .then(
                    function (response) {

                        if (
                            response &&
                            response.status === 200
                        ) {

                            const copy =
                                response.clone();

                            caches.open(
                                CACHE_NAME
                            ).then(
                                function (cache) {

                                    cache.put(
                                        event.request,
                                        copy
                                    );

                                }
                            );
                        }

                        return response;
                    }
                )
                .catch(
                    function () {

                        return caches.match(
                            event.request
                        );

                    }
                )

        );
    }
);