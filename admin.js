/* =========================================================
   CROWN CASH — ADMIN DASHBOARD JAVASCRIPT
========================================================= */

const API_URL = "https://crown-cash1.onrender.com";

/* =========================================================
   HELPERS
========================================================= */

function $(selector) {
    return document.querySelector(selector);
}

function escapeHTML(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


/* =========================================================
   MOBILE SIDEBAR
========================================================= */

const menuButton = $("#menuButton");
const adminSidebar = $("#adminSidebar");

if (menuButton && adminSidebar) {

    menuButton.addEventListener("click", function () {

        adminSidebar.classList.toggle("open");

    });

}


/* Close sidebar after selecting a menu item on mobile */

document.querySelectorAll(".admin-nav a").forEach(link => {

    link.addEventListener("click", function () {

        if (window.innerWidth <= 900 && adminSidebar) {
            adminSidebar.classList.remove("open");
        }

    });

});


/* =========================================================
   CURRENT YEAR
========================================================= */

const yearElement = $("#year");

if (yearElement) {
    yearElement.textContent = new Date().getFullYear();
}


/* =========================================================
   ADMIN AUTHENTICATION
========================================================= */

async function checkAdminAccess() {

    try {

        const response = await fetch(
            `${API_URL}/auth-check.php`,
            {
                method: "GET",
                credentials: "include",
                headers: {
                    "Accept": "application/json"
                }
            }
        );

        let data = {};

        try {
            data = await response.json();
        } catch (error) {
            data = {};
        }


        /* Not logged in */

        if (
            response.status === 401 ||
            data.authenticated === false ||
            data.logged_in === false
        ) {

            redirectToLogin();
            return false;
        }


        /* Detect role */

        const role = String(
            data.role ||
            data.account_type ||
            data.user?.role ||
            data.user?.account_type ||
            ""
        ).toLowerCase();


        /* If the backend provides a role,
           make sure it is admin */

        if (
            role &&
            role !== "admin" &&
            role !== "administrator"
        ) {

            showAccessDenied();

            return false;
        }


        /* Update administrator information */

        updateAdminIdentity(data);

        return true;

    } catch (error) {

        console.error("Admin authentication error:", error);

        /*
         * Do not automatically assume the user is logged in
         * when the authentication server cannot be reached.
         */

        showConnectionError();

        return false;
    }
}


/* =========================================================
   UPDATE ADMIN IDENTITY
========================================================= */

function updateAdminIdentity(data) {

    const user = data.user || data;

    const name =
        user.name ||
        user.full_name ||
        user.fullName ||
        user.username ||
        "Administrator";

    const firstLetter =
        String(name).trim().charAt(0).toUpperCase() || "A";


    const avatar = $(".admin-avatar");

    if (avatar) {
        avatar.textContent = firstLetter;
    }


    const adminStrong = $(".admin-user strong");

    if (adminStrong) {
        adminStrong.textContent = escapeHTML(name);
    }


    const adminSmall = $(".admin-user small");

    if (adminSmall) {
        adminSmall.textContent = "Admin Account";
    }

}


/* =========================================================
   REDIRECT TO LOGIN
========================================================= */

function redirectToLogin() {

    window.location.href = "../login.html";

}


/* =========================================================
   ACCESS DENIED
========================================================= */

function showAccessDenied() {

    document.body.innerHTML = `
        <div style="
            min-height:100vh;
            display:flex;
            align-items:center;
            justify-content:center;
            padding:25px;
            background:#07111f;
            font-family:Arial,sans-serif;
            color:white;
            text-align:center;
        ">

            <div style="
                max-width:480px;
                width:100%;
                padding:40px 25px;
                border:1px solid rgba(216,179,106,.25);
                border-radius:20px;
                background:rgba(255,255,255,.04);
            ">

                <div style="
                    width:70px;
                    height:70px;
                    margin:0 auto 20px;
                    display:grid;
                    place-items:center;
                    border-radius:50%;
                    background:rgba(216,179,106,.12);
                    color:#d8b36a;
                    font-size:30px;
                ">
                    !
                </div>

                <h2 style="
                    margin-bottom:12px;
                    font-size:24px;
                ">
                    Access Restricted
                </h2>

                <p style="
                    color:#9da8b7;
                    line-height:1.7;
                    font-size:14px;
                ">
                    This area is only available to authorized
                    Crown Cash administrators.
                </p>

                <a href="../dashboard.html"
                   style="
                       display:inline-block;
                       margin-top:25px;
                       padding:13px 22px;
                       border-radius:10px;
                       background:#d8b36a;
                       color:#07111f;
                       font-weight:800;
                       text-decoration:none;
                   ">
                    Return to Dashboard
                </a>

            </div>

        </div>
    `;

}


/* =========================================================
   CONNECTION ERROR
========================================================= */

function showConnectionError() {

    const content = $(".admin-content");

    if (!content) {
        return;
    }

    const existingNotice = document.querySelector(".admin-connection-error");

    if (existingNotice) {
        return;
    }


    const notice = document.createElement("div");

    notice.className = "admin-connection-error";

    notice.innerHTML = `
        <div style="
            display:flex;
            gap:14px;
            align-items:flex-start;
            padding:18px;
            margin-bottom:25px;
            border:1px solid rgba(216,179,106,.3);
            border-radius:14px;
            background:#fff;
        ">

            <div style="
                width:35px;
                height:35px;
                flex-shrink:0;
                display:grid;
                place-items:center;
                border-radius:50%;
                background:rgba(216,179,106,.12);
                color:#b18b45;
                font-weight:900;
            ">
                !
            </div>

            <div>

                <strong style="
                    display:block;
                    color:#07111f;
                    font-size:13px;
                ">
                    Unable to verify administrator session
                </strong>

                <p style="
                    margin-top:6px;
                    color:#778294;
                    font-size:11px;
                    line-height:1.6;
                ">
                    Please make sure the Crown Cash backend is
                    running and then refresh this page.
                </p>

                <button
                    type="button"
                    onclick="window.location.reload()"
                    style="
                        margin-top:10px;
                        padding:9px 14px;
                        border:0;
                        border-radius:8px;
                        background:#07111f;
                        color:#d8b36a;
                        cursor:pointer;
                        font-weight:700;
                    ">
                    Retry
                </button>

            </div>

        </div>
    `;

    content.prepend(notice);

}


/* =========================================================
   NAVIGATION HIGHLIGHT
========================================================= */

function setActiveNavigation() {

    const currentPage =
        window.location.pathname
            .split("/")
            .pop()
            .toLowerCase();


    document.querySelectorAll(".admin-nav a").forEach(link => {

        const href =
            link.getAttribute("href") || "";

        const targetPage =
            href.split("/").pop().toLowerCase();


        link.classList.remove("active");


        if (
            targetPage &&
            targetPage === currentPage
        ) {

            link.classList.add("active");

        }

    });

}


/* =========================================================
   LOGOUT
========================================================= */

async function logoutAdmin() {

    try {

        await fetch(
            `${API_URL}/logout.php`,
            {
                method: "GET",
                credentials: "include"
            }
        );

    } catch (error) {

        console.warn(
            "Logout request failed:",
            error
        );

    }


    /* Clear local browser information */

    try {

        localStorage.removeItem("crown_cash_user");
        localStorage.removeItem("user");
        localStorage.removeItem("crownCashUser");

    } catch (error) {

        console.warn(
            "Could not clear local storage:",
            error
        );

    }


    window.location.href = "../login.html";

}


/* =========================================================
   FIND LOGOUT LINK
========================================================= */

document.querySelectorAll(".admin-bottom a").forEach(link => {

    const text =
        (link.textContent || "").trim().toLowerCase();

    if (text.includes("logout")) {

        link.addEventListener("click", function(event) {

            event.preventDefault();

            const confirmed = confirm(
                "Are you sure you want to log out of the Crown Cash Admin Panel?"
            );

            if (confirmed) {
                logoutAdmin();
            }

        });

    }

});


/* =========================================================
   CLOSE SIDEBAR WHEN CLICKING OUTSIDE
========================================================= */

document.addEventListener("click", function(event) {

    if (
        window.innerWidth > 900 ||
        !adminSidebar ||
        !adminSidebar.classList.contains("open")
    ) {
        return;
    }


    const clickedInsideSidebar =
        adminSidebar.contains(event.target);

    const clickedMenuButton =
        menuButton &&
        menuButton.contains(event.target);


    if (
        !clickedInsideSidebar &&
        !clickedMenuButton
    ) {

        adminSidebar.classList.remove("open");

    }

});


/* =========================================================
   ESC KEY CLOSES MOBILE SIDEBAR
========================================================= */

document.addEventListener("keydown", function(event) {

    if (event.key === "Escape") {

        if (adminSidebar) {
            adminSidebar.classList.remove("open");
        }

    }

});


/* =========================================================
   INITIALIZE ADMIN DASHBOARD
========================================================= */

document.addEventListener("DOMContentLoaded", async function() {

    setActiveNavigation();

    await checkAdminAccess();

});