document.addEventListener("DOMContentLoaded", function () {

    const sidebar =
        document.getElementById("sidebar");

    const openSidebar =
        document.getElementById("openSidebar");

    const closeSidebar =
        document.getElementById("closeSidebar");

    const copyReferral =
        document.getElementById("copyReferral");

    const referralCode =
        document.getElementById("referralCode");

    const copyMessage =
        document.getElementById("copyMessage");

    const editProfile =
        document.getElementById("editProfile");

    const changePassword =
        document.getElementById("changePassword");


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


    /* COPY REFERRAL CODE */

    if (copyReferral) {

        copyReferral.addEventListener("click", async function () {

            try {

                await navigator.clipboard.writeText(
                    referralCode.textContent.trim()
                );

                copyMessage.textContent =
                    "Referral code copied successfully.";

                copyReferral.textContent =
                    "Copied";

                setTimeout(function () {

                    copyReferral.textContent =
                        "Copy Code";

                    copyMessage.textContent =
                        "Share your referral code through the Crown Cash referral program.";

                }, 2500);

            } catch (error) {

                copyMessage.textContent =
                    "Unable to copy automatically. Please copy the code manually.";

            }

        });

    }


    /* EDIT PROFILE */

    if (editProfile) {

        editProfile.addEventListener("click", function () {

            alert(
                "Profile editing will be connected to PHP and MySQL in the backend stage."
            );

        });

    }


    /* CHANGE PASSWORD */

    if (changePassword) {

        changePassword.addEventListener("click", function () {

            alert(
                "Password management will be connected to the secure PHP backend."
            );

        });

    }


    /* MOBILE SIDEBAR */

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


    /* YEAR */

    const year =
        document.getElementById("year");

    if (year) {

        year.textContent =
            new Date().getFullYear();

    }

});