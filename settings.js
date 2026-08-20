document.addEventListener("DOMContentLoaded", function () {

    const sidebar =
        document.getElementById("sidebar");

    const openSidebar =
        document.getElementById("openSidebar");

    const closeSidebar =
        document.getElementById("closeSidebar");

    const saveButton =
        document.getElementById("saveSettings");

    const saveMessage =
        document.getElementById("saveMessage");

    const changePassword =
        document.getElementById("changePassword");

    const sessionsButton =
        document.getElementById("sessionsButton");


    /* SIDEBAR */

    openSidebar.addEventListener("click", function () {

        sidebar.classList.add("open");

    });


    closeSidebar.addEventListener("click", function () {

        sidebar.classList.remove("open");

    });


    /* SAVE SETTINGS */

    saveButton.addEventListener("click", function () {

        saveMessage.textContent =
            "Settings saved successfully.";

        setTimeout(function () {

            saveMessage.textContent = "";

        }, 3000);

    });


    /* CHANGE PASSWORD */

    changePassword.addEventListener("click", function () {

        alert(
            "Password changing will be connected to the secure PHP backend."
        );

    });


    /* SESSIONS */

    sessionsButton.addEventListener("click", function () {

        alert(
            "Session management will be connected during the backend stage."
        );

    });


    /* YEAR */

    document.getElementById("year").textContent =
        new Date().getFullYear();

});