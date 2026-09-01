document.addEventListener("DOMContentLoaded", async function () {

    /* =========================
       LOAD USER PROFILE
    ========================= */

    let user;

    try {

        const response = await fetch(
            "https://crown-cash1.onrender.com/profile.php",
            {
                method: "GET",
                credentials: "include"
            }
        );

        const data = await response.json();

        if (!data.success) {

            window.location.href = "login.html";
            return;

        }

        user = data.user;

    } catch (error) {

        console.error(
            "Profile loading error:",
            error
        );

        alert(
            "Unable to load your profile. Please try again."
        );

        return;
    }


    /* =========================
       USER INFORMATION
    ========================= */

    const fullName =
        document.getElementById("fullName");

    const email =
        document.getElementById("email");

    const phone =
        document.getElementById("phone");

    const referralCode =
        document.getElementById("referralCode");


    const firstName =
        user.firstName || "";

    const completeName =
        user.fullName ||
        `${firstName} ${user.lastName || ""}`.trim();


    if (fullName) {

        fullName.textContent =
            completeName || "User Account";

    }


    if (email) {

        email.textContent =
            user.email || "Not available";

    }


    if (phone) {

        phone.textContent =
            user.phone || "Not available";

    }


    if (referralCode) {

        referralCode.textContent =
            user.referralCode || "Not available";

    }


    /* =========================
       PROFILE HEADER
    ========================= */

    const profileIntro =
        document.querySelector(".profile-intro h2");

    if (profileIntro) {

        profileIntro.textContent =
            completeName || "User Account";

    }


    /* =========================
       AVATARS
    ========================= */

    const avatars =
        document.querySelectorAll(
            ".avatar, .profile-avatar"
        );

    avatars.forEach(function (avatar) {

        if (firstName) {

            avatar.textContent =
                firstName.charAt(0).toUpperCase();

        }

    });


    /* =========================
       COPY REFERRAL CODE
    ========================= */

    const copyReferral =
        document.getElementById("copyReferral");

    const copyMessage =
        document.getElementById("copyMessage");


    if (copyReferral && referralCode) {

        copyReferral.addEventListener(
            "click",
            async function () {

                const code =
                    referralCode.textContent.trim();

                if (
                    !code ||
                    code === "Not available"
                ) {

                    copyMessage.textContent =
                        "No referral code is available.";

                    return;

                }

                try {

                    await navigator.clipboard.writeText(
                        code
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

            }
        );

    }


    /* =========================
       EDIT PROFILE
    ========================= */

    const editProfile =
        document.getElementById("editProfile");

    if (editProfile) {

        editProfile.addEventListener(
            "click",
            function () {

                alert(
                    "Profile editing will be added in the next backend step."
                );

            }
        );

    }


    /* =========================
       CHANGE PASSWORD
    ========================= */

    const changePassword =
        document.getElementById("changePassword");

    if (changePassword) {

        changePassword.addEventListener(
            "click",
            function () {

                alert(
                    "Password change will be connected to the secure Crown Cash backend."
                );

            }
        );

    }


    /* =========================
       SIDEBAR
    ========================= */

    const sidebar =
        document.getElementById("sidebar");

    const openSidebar =
        document.getElementById("openSidebar");

    const closeSidebar =
        document.getElementById("closeSidebar");


    if (openSidebar) {

        openSidebar.addEventListener(
            "click",
            function () {

                sidebar.classList.add("open");

            }
        );

    }


    if (closeSidebar) {

        closeSidebar.addEventListener(
            "click",
            function () {

                sidebar.classList.remove("open");

            }
        );

    }


    /* =========================
       CLOSE MOBILE SIDEBAR
    ========================= */

    document.addEventListener(
        "click",
        function (event) {

            if (
                window.innerWidth <= 900 &&
                sidebar &&
                sidebar.classList.contains("open") &&
                !sidebar.contains(event.target) &&
                openSidebar &&
                !openSidebar.contains(event.target)
            ) {

                sidebar.classList.remove("open");

            }

        }
    );


    /* =========================
       LOGOUT
    ========================= */

    const logoutLinks =
        document.querySelectorAll(
            'a[href="login.html"]'
        );


    logoutLinks.forEach(function (logoutLink) {

        logoutLink.addEventListener(
            "click",
            function () {

                localStorage.removeItem(
                    "crowncash_user"
                );

            }
        );

    });


    /* =========================
       YEAR
    ========================= */

    const year =
        document.getElementById("year");

    if (year) {

        year.textContent =
            new Date().getFullYear();

    }

});