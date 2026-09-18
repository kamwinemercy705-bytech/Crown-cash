"use strict";

/* =========================================================
CROWN CASH DASHBOARD JAVASCRIPT
========================================================= */

const API_BASE =
"https://crown-cash1.onrender.com";

/* =========================================================
DOM ELEMENTS
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

        sidebar.classList.toggle("active");

    }
);

}

document.querySelectorAll(".nav-item").forEach(
function (item) {

    item.addEventListener(
        "click",
        function () {

            if (window.innerWidth <= 900) {

                sidebar.classList.remove(
                    "active"
                );

            }

        }
    );

}

);

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
UGX FORMATTER
========================================================= */

function formatUGX(value) {

const number =
    getNumber(value);

return (
    "UGX " +
    Math.round(number)
        .toLocaleString("en-UG")
);

}

/* =========================================================
USER NAME
========================================================= */

function getUserName(data) {

if (!data) {
    return "Member";
}


const user =
    data.user ||
    data.account ||
    data.data ||
    data;


if (user.full_name) {
    return user.full_name;
}


if (user.name) {
    return user.name;
}


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

function isAdmin(data) {

if (!data) {
    return false;
}


const user =
    data.user ||
    data.account ||
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
ADMIN VISIBILITY
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
LOAD AUTHENTICATION
========================================================= */

async function loadAuthenticatedUser() {

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


    /*
     * If authentication fails,
     * do not show admin access.
     */

    if (
        !response.ok ||
        data.success === false ||
        data.logged_in === false
    ) {

        setAdminVisibility(false);

        window.location.href =
            "login.html";

        return;

    }


    const name =
        getUserName(data);


    const admin =
        isAdmin(data);


    /* USER NAME */

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


    /* USER ROLE */

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
     * Show Admin Panel only when
     * backend confirms admin role.
     */

    setAdminVisibility(admin);


    /*
     * Non-sensitive local display cache.
     */

    try {

        localStorage.setItem(
            "crown_cash_user_name",
            name
        );

        localStorage.setItem(
            "crown_cash_role",
            admin
                ? "admin"
                : "user"
        );

    } catch (error) {

        console.warn(
            "Local storage unavailable."
        );

    }


    await loadDashboardData();

} catch (error) {

    console.error(
        "Authentication error:",
        error
    );

    setAdminVisibility(false);

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
            "Dashboard API status:",
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


    /* INVESTED */

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


    /* EARNINGS */

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


    /* REFERRAL TEAM */

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
INVESTMENT CALCULATOR
========================================================= */

/*

* This is only a display calculator.
* 
* It does not create an investment,
* credit a wallet, or guarantee returns.
  */

const DISPLAY_DAILY_RATE = 0.10;

function calculateInvestment() {

if (!investmentAmount) {
    return;
}


const amount =
    Number(
        investmentAmount.value
    ) || 0;


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


const monthly =
    daily * 30;


const total =
    amount + monthly;


if (dailyReturn) {

    dailyReturn.textContent =
        formatUGX(daily);

}


if (monthlyReturn) {

    monthlyReturn.textContent =
        formatUGX(monthly);

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
INVESTMENT PAGE
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
        "Logout request failed:",
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
        "Could not clear local storage."
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
START
========================================================= */

document.addEventListener(
"DOMContentLoaded",
function () {

    loadAuthenticatedUser();

}

);