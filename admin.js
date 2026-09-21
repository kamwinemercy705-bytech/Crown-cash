/* =========================================================
   CROWN CASH — ADVANCED ADMIN DASHBOARD
   admin.js
========================================================= */

"use strict";


/* =========================================================
   CONFIGURATION
========================================================= */

const API_BASE =
    "https://crown-cash1.onrender.com";


const DASHBOARD_API =
    `${API_BASE}/admin-dashboard.php`;


const LOGOUT_API =
    `${API_BASE}/logout.php`;


/* =========================================================
   DOM HELPERS
========================================================= */

const $ = (selector) => {
    return document.querySelector(selector);
};


const $$ = (selector) => {
    return document.querySelectorAll(selector);
};


/* =========================================================
   ELEMENTS
========================================================= */

const sidebar =
    $("#adminSidebar");

const sidebarOverlay =
    $("#sidebarOverlay");

const menuButton =
    $("#menuButton");

const sidebarClose =
    $("#sidebarClose");

const refreshButton =
    $("#refreshButton");

const logoutButton =
    $("#logoutButton");

const adminName =
    $("#adminName");

const adminEmail =
    $("#adminEmail");

const adminAvatar =
    $("#adminAvatar");

const welcomeAdminName =
    $("#welcomeAdminName");

const dashboardDate =
    $("#dashboardDate");

const recentTransactions =
    $("#recentTransactions");

const recentUsers =
    $("#recentUsers");


/* =========================================================
   NUMBER FORMATTER
========================================================= */

function formatNumber(value) {

    const number =
        Number(value) || 0;

    return new Intl.NumberFormat(
        "en-US",
        {
            maximumFractionDigits: 0
        }
    ).format(number);
}


/* =========================================================
   UGX FORMATTER
========================================================= */

function formatUGX(value) {

    const number =
        Number(value) || 0;

    return `UGX ${formatNumber(number)}`;
}


/* =========================================================
   DATE FORMATTER
========================================================= */

function formatDate(value) {

    if (!value) {
        return "—";
    }

    const date =
        new Date(value);

    if (Number.isNaN(date.getTime())) {
        return String(value);
    }

    return date.toLocaleDateString(
        "en-GB",
        {
            day: "2-digit",
            month: "short",
            year: "numeric"
        }
    );
}


/* =========================================================
   DATE + TIME FORMATTER
========================================================= */

function formatDateTime(value) {

    if (!value) {
        return "—";
    }

    const date =
        new Date(value);

    if (Number.isNaN(date.getTime())) {
        return String(value);
    }

    return date.toLocaleString(
        "en-GB",
        {
            day: "2-digit",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit"
        }
    );
}


/* =========================================================
   ESCAPE HTML
========================================================= */

function escapeHTML(value) {

    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


/* =========================================================
   INITIALS
========================================================= */

function getInitials(name) {

    const cleanName =
        String(name || "Administrator").trim();

    if (!cleanName) {
        return "A";
    }

    const parts =
        cleanName.split(/\s+/);

    if (parts.length === 1) {
        return parts[0]
            .substring(0, 2)
            .toUpperCase();
    }

    return (
        parts[0][0] +
        parts[parts.length - 1][0]
    ).toUpperCase();
}


/* =========================================================
   CURRENT DATE
========================================================= */

function showCurrentDate() {

    if (!dashboardDate) {
        return;
    }

    const today =
        new Date();

    dashboardDate.textContent =
        today.toLocaleDateString(
            "en-GB",
            {
                weekday: "short",
                day: "2-digit",
                month: "short",
                year: "numeric"
            }
        );
}


/* =========================================================
   TOAST
========================================================= */

function showToast(message) {

    let toast =
        document.querySelector(".admin-toast");

    if (!toast) {

        toast =
            document.createElement("div");

        toast.className =
            "admin-toast";

        document.body.appendChild(toast);
    }

    toast.textContent =
        message;

    toast.classList.add("show");

    clearTimeout(
        toast._timer
    );

    toast._timer =
        setTimeout(() => {

            toast.classList.remove("show");

        }, 3000);
}


/* =========================================================
   MOBILE SIDEBAR
========================================================= */

function openSidebar() {

    if (!sidebar) {
        return;
    }

    sidebar.classList.add("open");

    if (sidebarOverlay) {
        sidebarOverlay.classList.add("show");
    }

    document.body.style.overflow =
        "hidden";
}


function closeSidebar() {

    if (!sidebar) {
        return;
    }

    sidebar.classList.remove("open");

    if (sidebarOverlay) {
        sidebarOverlay.classList.remove("show");
    }

    document.body.style.overflow =
        "";
}


if (menuButton) {

    menuButton.addEventListener(
        "click",
        openSidebar
    );
}


if (sidebarClose) {

    sidebarClose.addEventListener(
        "click",
        closeSidebar
    );
}


if (sidebarOverlay) {

    sidebarOverlay.addEventListener(
        "click",
        closeSidebar
    );
}


/* =========================================================
   CLOSE MOBILE SIDEBAR WHEN LINK IS CLICKED
========================================================= */

$$(".admin-sidebar .nav-item")
    .forEach((link) => {

        link.addEventListener(
            "click",
            () => {

                if (
                    window.innerWidth <= 760
                ) {
                    closeSidebar();
                }

            }
        );

    });


/* =========================================================
   NORMALIZE API OBJECT
========================================================= */

function normalizeObject(value) {

    if (!value) {
        return {};
    }

    if (
        typeof value === "string"
    ) {

        try {
            return JSON.parse(value);
        } catch {
            return {};
        }

    }

    return value;
}


/* =========================================================
   EXTRACT ARRAY
========================================================= */

function extractArray(data, keys) {

    for (const key of keys) {

        if (
            Array.isArray(data?.[key])
        ) {
            return data[key];
        }

    }

    return [];
}


/* =========================================================
   GET FIELD
========================================================= */

function getField(object, fields, fallback = "") {

    for (const field of fields) {

        if (
            object &&
            object[field] !== undefined &&
            object[field] !== null &&
            object[field] !== ""
        ) {

            return object[field];
        }

    }

    return fallback;
}


/* =========================================================
   UPDATE ADMIN DETAILS
========================================================= */

function updateAdminDetails(admin) {

    admin =
        normalizeObject(admin);

    const name =
        getField(
            admin,
            [
                "full_name",
                "name",
                "username",
                "email"
            ],
            "Administrator"
        );

    const email =
        getField(
            admin,
            [
                "email",
                "user_email"
            ],
            "Admin Account"
        );

    if (adminName) {
        adminName.textContent =
            name;
    }

    if (adminEmail) {
        adminEmail.textContent =
            email;
    }

    if (welcomeAdminName) {
        welcomeAdminName.textContent =
            name;
    }

    if (adminAvatar) {
        adminAvatar.textContent =
            getInitials(name);
    }
}


/* =========================================================
   UPDATE MAIN STATISTICS
========================================================= */

function updateStats(stats) {

    stats =
        normalizeObject(stats);

    const totalUsers =
        getField(
            stats,
            [
                "total_users",
                "totalUsers",
                "users",
                "user_count"
            ],
            0
        );

    const activeUsers =
        getField(
            stats,
            [
                "active_users",
                "activeUsers",
                "active"
            ],
            0
        );

    const pendingUsers =
        getField(
            stats,
            [
                "pending_users",
                "pendingUsers",
                "pending"
            ],
            0
        );

    const blockedUsers =
        getField(
            stats,
            [
                "blocked_users",
                "blockedUsers",
                "blocked"
            ],
            0
        );


    const totalUsersElement =
        $("#totalUsers");

    const activeUsersElement =
        $("#activeUsers");

    const pendingUsersElement =
        $("#pendingUsers");

    const blockedUsersElement =
        $("#blockedUsers");


    if (totalUsersElement) {
        totalUsersElement.textContent =
            formatNumber(totalUsers);
    }

    if (activeUsersElement) {
        activeUsersElement.textContent =
            formatNumber(activeUsers);
    }

    if (pendingUsersElement) {
        pendingUsersElement.textContent =
            formatNumber(pendingUsers);
    }

    if (blockedUsersElement) {
        blockedUsersElement.textContent =
            formatNumber(blockedUsers);
    }


    /* -----------------------------------------
       Deposits
    ----------------------------------------- */

    const totalDeposits =
        getField(
            stats,
            [
                "total_deposits",
                "totalDeposits",
                "deposits_total"
            ],
            0
        );

    const depositCount =
        getField(
            stats,
            [
                "deposit_count",
                "depositCount",
                "deposits_count"
            ],
            0
        );


    const depositsElement =
        $("#totalDeposits");

    const depositCountElement =
        $("#depositCount");


    if (depositsElement) {

        depositsElement.textContent =
            formatUGX(totalDeposits);

    }

    if (depositCountElement) {

        depositCountElement.textContent =
            `${formatNumber(depositCount)} deposits`;

    }


    /* -----------------------------------------
       Withdrawals
    ----------------------------------------- */

    const totalWithdrawals =
        getField(
            stats,
            [
                "total_withdrawals",
                "totalWithdrawals",
                "withdrawals_total"
            ],
            0
        );

    const withdrawalCount =
        getField(
            stats,
            [
                "withdrawal_count",
                "withdrawalCount",
                "withdrawals_count"
            ],
            0
        );


    const withdrawalsElement =
        $("#totalWithdrawals");

    const withdrawalCountElement =
        $("#withdrawalCount");


    if (withdrawalsElement) {

        withdrawalsElement.textContent =
            formatUGX(totalWithdrawals);

    }

    if (withdrawalCountElement) {

        withdrawalCountElement.textContent