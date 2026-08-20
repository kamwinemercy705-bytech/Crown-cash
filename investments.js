document.addEventListener("DOMContentLoaded", function () {

    const sidebar =
        document.getElementById("sidebar");

    const openSidebar =
        document.getElementById("openSidebar");

    const closeSidebar =
        document.getElementById("closeSidebar");


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


    const year =
        document.getElementById("year");

    if (year) {

        year.textContent =
            new Date().getFullYear();

    }

});