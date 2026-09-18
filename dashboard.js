/*

* Crown Cash
* Dashboard JavaScript
  */

"use strict";

/* =========================================================
API CONFIGURATION
========================================================= */

const API_BASE = "https://crown-cash1.onrender.com";

/* =========================================================
DOM ELEMENTS
========================================================= */

const menuToggle = document.getElementById("menuToggle");
const sidebar = document.getElementById("sidebar");
const logoutBtn = document.getElementById("logoutBtn");

const adminPanelLink = document.getElementById("adminPanelLink");
const adminQuickAction = document.getElementById("adminQuickAction");

const sidebarUserName = document.getElementById("sidebarUserName");
const sidebarUserRole = document.getElementById("sidebarUserRole");

const topbarUserName = document.getElementById("topbarUserName");
const topbarUserRole = document.getElementById("topbarUserRole");

const welcomeUserName = document.getElementById("welcomeUserName");

const availableBalance = document.getElementById("availableBalance");

const totalInvested = document.getElementById("totalInvested");
const totalEarnings = document.getElementById("totalEarnings");
const teamCount = document.getElementById("teamCount");
const transactionCount = document.getElementById("transactionCount");

const investmentAmount = document.getElementById("investmentAmount");
const dailyReturn = document.getElementById("dailyReturn");
const monthlyReturn = document.getElementById("monthlyReturn");
const totalAfter30 = document.getElementById("totalAfter30");

const currentYear = document.getElementById("currentYear");

/* =========================================================
MOBILE SIDEBAR
========================================================= */

if (menuToggle && sidebar) {

menuToggle.addEventListener("click", function () {

    sidebar.classList.toggle("active");

});

}

/* Close sidebar when clicking a navigation link on mobile */

document.querySelectorAll(".nav-item").forEach(function (item) {

item.addEventListener("click", function () {

    if (window.innerWidth <= 900 && sidebar) {
        sidebar.classList.remove("active");
    }

});

});

/* =========================================================
FORMAT UGX
========================================================= */

function formatUGX(value) {

let number = Number(value);

if (!Number.isFinite(number)) {
    number = 0;
}

return "UGX " + Math.round(number).toLocaleString("en-UG");

}

/* =========================================================
EXTRACT NUMBER
========================================================= */

function getNumber(value) {

if (value === null || value === undefined) {
    return 0;
}

if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
}

if (typeof value === "string") {

    const cleaned = value.replace(/[^0-9.-]/g, "");
    const number = Number(cleaned);

    return Number.isFinite(number) ? number : 0;
}

/* MongoDB Decimal128 / BSON-style values */

if (typeof value === "object") {

    if (value.$numberDecimal !== undefined) {
        return Number(value.$numberDecimal) || 0;
    }

    if (value.$numberLong !== undefined) {
        return Number(value.$numberLong) || 0;
    }

    if (value.value !== undefined) {
        return getNumber(value.value);
    }
}

return 0;

}

/* =========================================================
GET USER NAME
========================================================= */

function getUserName(data) {

if (!data) {
    return "Member";
}

if (data.user) {

    if (data.user.full_name) {
        return data.user.full_name;
    }

    if (data.user.name) {
        return data.user.name;
    }

    const first =
        data.user.first_name ||
        data.user.firstName ||
        "";

    const last =
        data.user.last_name ||
        data.user.lastName ||
        "";

    const full = `${first} ${last}`.trim();

    if (full) {
        return full;
    }
}

if (data.full_name) {
    return data.full_name;
}

if (data.name) {
    return data.name;
}

const first =
    data.first_name ||
    data.firstName ||
    "";

const last =
    data.last_name ||
    data.lastName ||
    "";

const full = `${first} ${last}`.trim();

if (full) {
    return full;
}

return "Member";

}

/* =========================================================
DETERMINE ADMIN
========================================================= */

function isAdmin(data) {

if (!data) {
    return false;
}

/*
 * Support different response structures.
 */

const user = data.user || data.account || data.data || data;

const role = String(
    user.role ||
    user.account_type ||
    user.accountType ||
    user.user_role ||
    user.userRole ||
    ""
).toLowerCase().trim();

return role === "admin" ||
       role === "administrator" ||
       role === "superadmin" ||
       role === "super_admin";

}

/* =========================================================
SHOW / HIDE ADMIN PANEL
========================================================= */

function setAdminVisibility(show) {

if (adminPanelLink) {

    adminPanelLink.style.display = show
        ? "flex"
        : "none";

}

if (adminQuickAction) {

    adminQuickAction.style.display = show
        ? "flex"
        : "none";

}

}

/* =========================================================
LOAD AUTHENTICATED USER
========================================================= */

async function loadAuthenticatedUser() {

try {

    const response = await fetch(
        `${API_BASE}/auth-check.php`,
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

    if (!response.ok || data.success === false || data.logged_in === false) {

        setAdminVisibility(false);

        /*
         * Don't repeatedly redirect if the browser
         * is already on the login page.
         */

        if (!window.location.pathname.endsWith("login.html")) {

            window.location.href = "login.html";

        }

        return;

    }


    /* Get user information */

    const user = data.user || data.account || data.data || data;

    const name = getUserName(data);

    const admin = isAdmin(data);


    /* ===============================================
       DISPLAY USER NAME
    =============================================== */

    if (sidebarUserName) {
        sidebarUserName.textContent = name;
    }

    if (topbarUserName) {
        topbarUserName.textContent = name;
    }

    if (welcomeUserName) {
        welcomeUserName.textContent = name;
    }


    /* ===============================================
       DISPLAY ROLE
    =============================================== */

    const roleText = admin
        ? "Administrator"
        : "Member";

    if (sidebarUserRole) {
        sidebarUserRole.textContent = roleText;
    }

    if (topbarUserRole) {
        topbarUserRole.textContent = roleText;
    }


    /* ===============================================
       ADMIN PANEL VISIBILITY
    =============================================== */

    setAdminVisibility(admin);


    /*
     * Store only non-sensitive display information.
     */

    try {

        localStorage.setItem(
            "crown_cash_user_name",
            name
        );

        localStorage.setItem(
            "crown_cash_role",
            admin ? "admin" : "user"
        );

    } catch (error) {
        console.warn("Local storage unavailable.");
    }


    /*
     * Continue loading dashboard data.
     */

    await loadDashboardData();

} catch (error) {

    console.error(
        "Authentication check failed:",
        error
    );

    setAdminVisibility(false);

    /*
     * If the authentication endpoint cannot be reached,
     * do not grant admin access.
     */

}

}

/* =========================================================
LOAD DASHBOARD DATA
========================================================= */

async function loadDashboardData() {

/*
 * Your dashboard.php endpoint may already exist.
 *
 * If it exists, this function will use it.
 */

try {

    const response = await fetch(
        `${API_BASE}/dashboard.php`,
        {
            method: "GET",
            credentials: "include",
            headers: {
                "Accept": "application/json"
            }
        }
    );


    if (!response.ok) {

        console.warn(
            "Dashboard endpoint returned:",
            response.status
        );

        return;

    }


    const data = await response.json();


    if (!data) {
        return;
    }


    /* ===============================================
       BALANCE
    =============================================== */

    const balance = getNumber(
        data.balance ??
        data.available_balance ??
        data.wallet_balance ??
        data.user?.balance ??
        data.user?.available_balance
    );

    if (availableBalance) {
        availableBalance.textContent = formatUGX(balance);
    }


    /* ===============================================
       TOTAL INVESTED
    =============================================== */

    const invested = getNumber(
        data.total_invested ??
        data.totalInvested ??
        data.invested ??
        data.statistics?.total_invested
    );

    if (totalInvested) {
        totalInvested.textContent = formatUGX(invested);
    }


    /* ===============================================
       TOTAL EARNINGS
    =============================================== */

    const earnings = getNumber(
        data.total_earnings ??
        data.totalEarnings ??
        data.earnings ??
        data.statistics?.total_earnings
    );

    if (totalEarnings) {
        totalEarnings.textContent = formatUGX(earnings);
    }


    /* ===============================================
       TEAM COUNT
    =============================================== */

    const team = getNumber(
        data.team_count ??
        data.teamCount ??
        data.total_team ??
        data.referral_count ??
        data.referrals ??
        data.statistics?.team_count
    );

    if (teamCount) {
        teamCount.textContent = Math.round(team).toLocaleString("en-UG");
    }


    /* ===============================================
       TRANSACTION COUNT
    =============================================== */

    const transactions = getNumber(
        data.transaction_count ??
        data.transactionCount ??
        data.total_transactions ??
        data.statistics?.transaction_count
    );

    if (transactionCount) {
        transactionCount.textContent =
            Math.round(transactions).toLocaleString("en-UG");
    }


} catch (error) {

    console.warn(
        "Dashboard data could not be loaded:",
        error
    );

}

}

/* =========================================================
INVESTMENT CALCULATOR
========================================================= */

/*

* IMPORTANT:
* This calculator uses a placeholder rate for the
* dashboard display only.
* 
* It does NOT create an investment, credit money,
* or guarantee actual returns.
  */

const DISPLAY_DAILY_RATE = 0.10;

function calculateInvestment() {

if (!investmentAmount) {
    return;
}

const amount = Number(investmentAmount.value) || 0;


if (amount <= 0) {

    if (dailyReturn) {
        dailyReturn.textContent = "UGX 0";
    }

    if (monthlyReturn) {
        monthlyReturn.textContent = "UGX 0";
    }

    if (totalAfter30) {
        totalAfter30.textContent = "UGX 0";
    }

    return;

}


const daily = amount * DISPLAY_DAILY_RATE;
const monthly = daily * 30;
const total = amount + monthly;


if (dailyReturn) {
    dailyReturn.textContent = formatUGX(daily);
}

if (monthlyReturn) {
    monthlyReturn.textContent = formatUGX(monthly);
}

if (totalAfter30) {
    totalAfter30.textContent = formatUGX(total);
}

}

if (investmentAmount) {

investmentAmount.addEventListener(
    "input",
    calculateInvestment
);

}

/* =========================================================
GO TO INVESTMENTS
========================================================= */

function goToInvestment() {

window.location.href = "investments.html";

}

/*

* Make function available to the inline button
* in dashboard.html.
  */

window.goToInvestment = goToInvestment;

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
                "Accept": "application/json"
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

    localStorage.removeItem("crown_cash_user");
    localStorage.removeItem("crown_cash_user_name");
    localStorage.removeItem("crown_cash_role");

} catch (error) {
    console.warn("Could not clear local storage.");
}


window.location.href = "login.html";

}

if (logoutBtn) {

logoutBtn.addEventListener(
    "click",
    logoutUser
);

}

/* =========================================================
CURRENT YEAR
========================================================= */

if (currentYear) {

currentYear.textContent =
    new Date().getFullYear();

}

/* =========================================================
INITIALIZE DASHBOARD
========================================================= */

document.addEventListener(
"DOMContentLoaded",
function () {

    loadAuthenticatedUser();

}

);