document.addEventListener("DOMContentLoaded", function () {

    const sidebar =
        document.getElementById("adminSidebar");

    const menuButton =
        document.getElementById("menuButton");


    menuButton.addEventListener("click", function () {

        sidebar.classList.toggle("open");

    });


    document.addEventListener("click", function (event) {

        if (
            window.innerWidth <= 900 &&
            sidebar.classList.contains("open") &&
            !sidebar.contains(event.target) &&
            !menuButton.contains(event.target)
        ) {

            sidebar.classList.remove("open");

        }

    });


    document.getElementById("year").textContent =
        new Date().getFullYear();

});