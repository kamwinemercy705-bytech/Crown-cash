// =====================================================
// CROWN CASH — DASHBOARD JAVASCRIPT
// =====================================================


document.addEventListener("DOMContentLoaded", function () {


    const sidebar =
        document.getElementById("sidebar");


    const openButton =
        document.getElementById("openSidebar");


    const closeButton =
        document.getElementById("closeSidebar");



    /*
     * OPEN SIDEBAR
     */

    if (openButton) {

        openButton.addEventListener("click", function () {

            sidebar.classList.add("open");

        });

    }



    /*
     * CLOSE SIDEBAR
     */

    if (closeButton) {

        closeButton.addEventListener("click", function () {

            sidebar.classList.remove("open");

        });

    }



    /*
     * CLOSE SIDEBAR WHEN
     * CLICKING OUTSIDE ON MOBILE
     */

    document.addEventListener("click", function (event) {

        if (
            window.innerWidth <= 850 &&
            sidebar.classList.contains("open") &&
            !sidebar.contains(event.target) &&
            !openButton.contains(event.target)
        ) {

            sidebar.classList.remove("open");

        }

    });



    /*
     * CURRENT YEAR
     */

    const year =
        document.getElementById("year");


    if (year) {

        year.textContent =
            new Date().getFullYear();

    }

});