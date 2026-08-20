document.addEventListener("DOMContentLoaded", function () {

    const sidebar =
        document.getElementById("sidebar");

    const openSidebar =
        document.getElementById("openSidebar");

    const closeSidebar =
        document.getElementById("closeSidebar");

    const filters =
        document.querySelectorAll(".filter");

    const notifications =
        document.querySelectorAll(".notification");

    const emptyState =
        document.getElementById("emptyState");

    const readAll =
        document.getElementById("readAll");


    /* SIDEBAR */

    openSidebar.addEventListener("click", function () {

        sidebar.classList.add("open");

    });


    closeSidebar.addEventListener("click", function () {

        sidebar.classList.remove("open");

    });


    /* FILTERS */

    filters.forEach(function (filter) {

        filter.addEventListener("click", function () {

            filters.forEach(function (button) {

                button.classList.remove("active");

            });

            filter.classList.add("active");

            const selected =
                filter.dataset.filter;

            let visibleCount = 0;


            notifications.forEach(function (notification) {

                const type =
                    notification.dataset.type;

                if (
                    selected === "all" ||
                    selected === type
                ) {

                    notification.style.display = "flex";

                    visibleCount++;

                } else {

                    notification.style.display = "none";

                }

            });


            emptyState.style.display =
                visibleCount === 0
                    ? "block"
                    : "none";

        });

    });


    /* MARK ALL AS READ */

    readAll.addEventListener("click", function () {

        notifications.forEach(function (notification) {

            notification.classList.remove("unread");

            const dot =
                notification.querySelector(".unread-dot");

            if (dot) {

                dot.style.display = "none";

            }

        });

        readAll.textContent =
            "All notifications read";

    });


    /* YEAR */

    document.getElementById("year").textContent =
        new Date().getFullYear();

});