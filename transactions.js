document.addEventListener("DOMContentLoaded", function () {

    const sidebar =
        document.getElementById("sidebar");

    const openSidebar =
        document.getElementById("openSidebar");

    const closeSidebar =
        document.getElementById("closeSidebar");

    const filterButton =
        document.getElementById("filterButton");


    /* SIDEBAR */

    if (openSidebar) {

        openSidebar.addEventListener("click", function () {

            sidebar.classList.add("open");

        });

    }


    if (closeSidebar) {

        closeSidebar.addEventListener("click", function () {

            sidebar.classList.remove("open");

        });

    }


    document.addEventListener("click", function (event) {

        if (
            window.innerWidth <= 900 &&
            sidebar.classList.contains("open") &&
            !sidebar.contains(event.target) &&
            !openSidebar.contains(event.target)
        ) {

            sidebar.classList.remove("open");

        }

    });


    /* FILTER BUTTON */

    if (filterButton) {

        filterButton.addEventListener("click", function () {

            const type =
                document.getElementById("type").value;

            const status =
                document.getElementById("status").value;


            /*
             * Real transaction filtering will be handled
             * by PHP/MySQL after backend integration.
             */

            console.log(
                "Selected type:",
                type,
                "Selected status:",
                status
            );

        });

    }


    /* YEAR */

    const year =
        document.getElementById("year");

    if (year) {

        year.textContent =
            new Date().getFullYear();

    }

});