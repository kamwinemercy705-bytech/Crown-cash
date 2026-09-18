"use strict";

/* =========================================================
CROWN CASH DASHBOARD
========================================================= */

const API_BASE =
"https://crown-cash1.onrender.com";

/*

* Display-only calculator rate.
* 
* IMPORTANT:
* This is a placeholder display rate.
* It does not guarantee actual investment returns.
  */

const DISPLAY_DAILY_RATE = 0.10;

/* =========================================================
DOM
========================================================= */

const menuToggle =
document.getElementById("menuToggle");

const sidebar =
document.getElementById("sidebar");

const logoutBtn =
document.getElementById("logoutBtn");

const adminPanelLink =
document.getElementById("adminPanelLink");

const adminQuickAction =
document.getElementById("adminQuickAction");

const sidebarUserName =
document.getElementById("sidebarUserName");

const sidebarUserRole =
document.getElementById("sidebarUserRole");

const topbarUserName =
document.getElementById("topbarUserName");

const topbarUserRole =
document.getElementById("topbarUserRole");

const welcomeUserName =
document.getElementById("welcomeUserName");

const availableBalance =
document.getElementById("availableBalance");

const totalInvested =
document.getElementById("totalInvested");

const totalEarnings =
document.getElementById("totalEarnings");

const teamCount =
document.getElementById("teamCount");

const transactionCount =
document.getElementById("transactionCount");

const investmentAmount =
document.getElementById("investmentAmount");

const dailyReturnPercentage =
document.getElementById(
"dailyReturnPercentage"
);

const dailyReturn =
document.getElementById("dailyReturn");

const monthlyReturn =
document.getElementById("monthlyReturn");

const totalAfter30 =
document.getElementById("totalAfter30");

const currentYear =
document.getElementById("currentYear");

/* =========================================================
MOBILE MENU
========================================================= */

if (menuToggle && sidebar) {

menuToggle.addEventListener(
    "click",
    function () {

        sidebar.classList.toggle(
            "active"
        );

    }
);

}

document.querySelectorAll(".nav-item")
.forEach(function (item) {

    item.addEventListener(
        "click",
        function () {

            if (
                window.innerWidth <= 900 &&
                sidebar
            ) {

                sidebar.classList.remove(
                    "active"
                );

            }

        }
    );

});

/* =========================================================
NUMBER HELPER
========================================================= */

function getNumber(value) {

if (
    value === null ||
    value === undefined
) {

    return 0;

}


if (typeof value === "number") {

    return Number.isFinite(value)
        ? value
        : 0;

}


if (typeof value === "string") {

    const cleaned =
        value.replace(
            /[^0-9.-]/g,
            ""
        );

    const number =
        Number(cleaned);

    return Number.isFinite(number)
        ? number
        : 0;

}


if (typeof value === "object") {

    if (
        value.$numberDecimal !== undefined
    ) {

        return (
            Number(
                value.$numberDecimal
            ) || 0
        );

    }


    if (
        value.$numberLong !== undefined
    ) {

        return (
            Number(
                value.$numberLong
            ) || 0
        );

    }


    if (
        value.value !== undefined
    ) {

        return getNumber(
            value.value
        );

    }

}


return 0;

}

/* =========================================================
UGX FORMAT
========================================================= */

function formatUGX(value) {

return (
    "UGX " +
    Math.round(
        getNumber(value)
    ).toLocaleString("en-UG")
);

}

/* =========================================================
USER NAME
========================================================= */

function extractUserName(data) {

if (!data) {

    return "Member";

}


const user =
    data.user ||
    data.account ||
    data.profile ||
    data.data ||
    data;


/* Full name */

if (
    user.full_name &&
    String(user.full_name).trim()
) {

    return String(
        user.full_name
    ).trim();

}


if (
    user.fullName &&
    String(user.fullName).trim()
) {

    return String(
        user.fullName
    ).trim();

}


if (
    user.name &&
    String(user.name).trim()
) {

    return String(
        user.name
    ).trim();

}


/* First + last name */

const first =
    user.first_name ||
    user.firstName ||
    "";

const last =
    user.last_name ||
    user.lastName ||
    "";


const full =
    `${first} ${last}`.trim();


if (full) {

    return full;

}


return "Member";

}

/* =========================================================
ADMIN CHECK
========================================================= */

function checkAdmin(data) {

if (!data) {

    return false;

}


const user =
    data.user ||
    data.account ||
    data.profile ||
    data.data ||
    data;


const role =
    String(
        user.role ||
        user.account_type ||
        user.accountType ||
        user.user_role ||
        user.userRole ||
        ""
    )
    .toLowerCase()
    .trim();


return (
    role === "admin" ||
    role === "administrator" ||
    role === "superadmin" ||
    role === "super_admin"
);

}

/* =========================================================
SHOW ADMIN
========================================================= */

function setAdminVisibility(show) {

if (adminPanelLink) {

    adminPanelLink.style.display =
        show ? "flex" : "none";

}


if (adminQuickAction) {

    adminQuickAction.style.display =
        show ? "flex" : "none";

}

}

/* =========================================================
DISPLAY USER
========================================================= */

function displayUserName(name) {

if (!name) {

    name = "Member";

}


if (sidebarUserName) {

    sidebarUserName.textContent =
        name;

}


if (topbarUserName) {

    topbarUserName.textContent =
        name;

}


if (welcomeUserName) {

    welcomeUserName.textContent =
        name;

}

}

/* =========================================================
LOAD PROFILE
========================================================= */

async function loadProfile() {

try {

    const response =
        await fetch(
            `${API_BASE}/profile.php`,
            {
                method: "GET",

                credentials: "include",

                headers: {
                    "Accept":
                        "application/json"
                }
            }
        );


    const data =
        await response.json();


    if (!response.ok) {

        console.warn(
            "Profile request:",
            response.status,
            data
        );

        return null;

    }


    const name =
        extractUserName(data);


    displayUserName(name);


    /*
     * Store name for display only.
     */

    try {

        localStorage.setItem(
            "crown_cash_user_name",
            name
        );

    } catch (error) {
        console.warn(
            "Local storage unavailable."
        );
    }


    return data;

} catch (error) {

    console.warn(
        "Could not load profile:",
        error
    );

    return null;

}

}

/* =========================================================
AUTH CHECK
========================================================= */

async function loadAuthentication() {

try {

    const response =
        await fetch(
            `${API_BASE}/auth-check.php`,
            {
                method: "GET",

                credentials: "include",

                headers: {
                    "Accept":
                        "application/json"
                }
            }
        );


    let data = {};

    try {

        data =
            await response.json();

    } catch (error) {

        data = {};

    }


    if (
        !response.ok ||
        data.success === false ||
        data.logged_in === false
    ) {

        setAdminVisibility(false);

        window.location.href =
            "login.html";

        return false;

    }


    /*
     * Determine admin from auth response.
     */

    const admin =
        checkAdmin(data);


    setAdminVisibility(admin);


    const roleText =
        admin
            ? "Administrator"
            : "Member";


    if (sidebarUserRole) {

        sidebarUserRole.textContent =
            roleText;

    }


    if (topbarUserRole) {

        topbarUserRole.textContent =
            roleText;

    }


    /*
     * Try to get name from auth response first.
     */

    const authName =
        extractUserName(data);


    if (
        authName &&
        authName !== "Member"
    ) {

        displayUserName(
            authName
        );

    }


    /*
     * Then get the actual profile.
     * This fixes the missing user name
     * when auth-check only returns user_id.
     */

    await loadProfile();


    return true;

} catch (error) {

    console.error(
        "Authentication error:",
        error
    );

    setAdminVisibility(false);

    /*
     * Do not grant admin access if
     * authentication cannot be verified.
     */

    return false;

}

}

/* =========================================================
LOAD DASHBOARD DATA
========================================================= */

async function loadDashboardData() {

try {

    const response =
        await fetch(
            `${API_BASE}/dashboard.php`,
            {
                method: "GET",

                credentials: "include",

                headers: {
                    "Accept":
                        "application/json"
                }
            }
        );


    if (!response.ok) {

        console.warn(
            "Dashboard API:",
            response.status
        );

        return;

    }


    const data =
        await response.json();


    if (!data) {

        return;

    }


    /* BALANCE */

    const balance =
        getNumber(
            data.balance ??
            data.available_balance ??
            data.wallet_balance ??
            data.user?.balance ??
            data.user?.available_balance
        );


    if (availableBalance) {

        availableBalance.textContent =
            formatUGX(balance);

    }


    /* TOTAL INVESTED */

    const invested =
        getNumber(
            data.total_invested ??
            data.totalInvested ??
            data.invested ??
            data.statistics?.total_invested
        );


    if (totalInvested) {

        totalInvested.textContent =
            formatUGX(invested);

    }


    /* TOTAL EARNINGS */

    const earnings =
        getNumber(
            data.total_earnings ??
            data.totalEarnings ??
            data.earnings ??
            data.statistics?.total_earnings
        );


    if (totalEarnings) {

        totalEarnings.textContent =
            formatUGX(earnings);

    }


    /* TEAM */

    const team =
        getNumber(
            data.team_count ??
            data.teamCount ??
            data.total_team ??
            data.referral_count ??
            data.statistics?.team_count
        );


    if (teamCount) {

        teamCount.textContent =
            Math.round(team)
                .toLocaleString("en-UG");

    }


    /* TRANSACTIONS */

    const transactions =
        getNumber(
            data.transaction_count ??
            data.transactionCount ??
            data.total_transactions ??
            data.statistics?.transaction_count
        );


    if (transactionCount) {

        transactionCount.textContent =
            Math.round(transactions)
                .toLocaleString("en-UG");

    }


} catch (error) {

    console.warn(
        "Dashboard data error:",
        error
    );

}

}

/* =========================================================
CALCULATOR
========================================================= */

function calculateInvestment() {

/*
 * Always display the daily percentage.
 */

if (dailyReturnPercentage) {

    dailyReturnPercentage.textContent =
        "10%";

}


const amount =
    investmentAmount
        ? Number(
            investmentAmount.value
        ) || 0
        : 0;


if (amount <= 0) {

    if (dailyReturn) {

        dailyReturn.textContent =
            "UGX 0";

    }


    if (monthlyReturn) {

        monthlyReturn.textContent =
            "UGX 0";

    }


    if (totalAfter30) {

        totalAfter30.textContent =
            "UGX 0";

    }

    return;

}


const daily =
    amount *
    DISPLAY_DAILY_RATE;


const thirtyDayReturn =
    daily * 30;


const total =
    amount +
    thirtyDayReturn;


if (dailyReturn) {

    dailyReturn.textContent =
        formatUGX(daily);

}


if (monthlyReturn) {

    monthlyReturn.textContent =
        formatUGX(thirtyDayReturn);

}


if (totalAfter30) {

    totalAfter30.textContent =
        formatUGX(total);

}

}

if (investmentAmount) {

investmentAmount.addEventListener(
    "input",
    calculateInvestment
);

}

/* =========================================================
INVESTMENT BUTTON
========================================================= */

function goToInvestment() {

window.location.href =
    "investments.html";

}

window.goToInvestment =
goToInvestment;

/* =========================================================
LOGOUT
========================================================= */

async function logoutUser() {

if (logoutBtn) {

    logoutBtn.disabled = true;

}


try {

    await fetch(
        `${API_BASE}/logout.php`,
        {
            method: "POST",

            credentials: "include",

            headers: {
                "Accept":
                    "application/json"
            }
        }
    );

} catch (error) {

    console.warn(
        "Logout error:",
        error
    );

}


try {

    localStorage.removeItem(
        "crown_cash_user"
    );

    localStorage.removeItem(
        "crown_cash_user_name"
    );

    localStorage.removeItem(
        "crown_cash_role"
    );

} catch (error) {

    console.warn(
        "Storage cleanup failed."
    );

}


window.location.href =
    "login.html";

}

if (logoutBtn) {

logoutBtn.addEventListener(
    "click",
    logoutUser
);

}

/* =========================================================
YEAR
========================================================= */

if (currentYear) {

currentYear.textContent =
    new Date().getFullYear();

}

/* =========================================================
INITIALIZE
========================================================= */

document.addEventListener(
"DOMContentLoaded",
async function () {

    /*
     * Put 10% on screen immediately.
     */

    calculateInvestment();


    /*
     * Authenticate first.
     */

    const authenticated =
        await loadAuthentication();


    if (!authenticated) {

        return;

    }


    /*
     * Then load balances/statistics.
     */

    await loadDashboardData();

}

);