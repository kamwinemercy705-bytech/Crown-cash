/* =========================================================
   CROWN CASH — ADMIN DASHBOARD
   File: admin.js
   ========================================================= */

"use strict";

/* =========================================================
   API CONFIGURATION
   ========================================================= */

const API_BASE = "https://crown-cash1.onrender.com";

const ADMIN_AUTH_API = `${API_BASE}/admin-auth.php`;
const PROFILE_API = `${API_BASE}/profile.php`;
const ADMIN_DASHBOARD_API = `${API_BASE}/admin-dashboard.php`;
const LOGOUT_API = `${API_BASE}/logout.php`;


/* =========================================================
   DOM READY
   ========================================================= */

document.addEventListener("DOMContentLoaded", () => {

    initializeAdminPanel();

});


/* =========================================================
   INITIALIZE ADMIN PANEL
   ========================================================= */

async function initializeAdminPanel() {

    setupSidebar();
    setupNavigation();
    setupLogout();

    await verifyAdminAccess();

}


/* =========================================================
   ADMIN AUTHENTICATION
   ========================================================= */

async function verifyAdminAccess() {

    try {

        showPageLoading(true);

        const response = await fetch(ADMIN_AUTH_API, {
            method: "GET",
            credentials: "include",
            headers: {
                "Accept": "application/json"
            }
        });

        const data = await response.json();

        if (
            !response.ok ||
            !data.success ||
            data.authorized !== true
        ) {

            redirectToLogin();

            return;

        }

        await loadAdminProfile();
        await loadDashboardData();

        showPageLoading(false);

    } catch (error) {

        console.error("Admin authentication error:", error);

        showAdminMessage(
            "Unable to verify administrator access. Please try again.",
            "error"
        );

        showPageLoading(false);

    }

}


/* =========================================================
   LOAD ADMIN PROFILE
   ========================================================= */

async function loadAdminProfile() {

    try {

        const response = await fetch(PROFILE_API, {
            method: "GET",
            credentials: "include",
            headers: {
                "Accept": "application/json"
            }
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
            return;
        }

        const user = data.user || {};

        const fullName =
            user.full_name ||
            `${user.first_name || ""} ${user.last_name || ""}`.trim() ||
            "Administrator";

        const firstName =
            user.first_name ||
            fullName.split(" ")[0] ||
            "Admin";

        const email =
            user.email ||
            "";

        updateText("adminName", fullName);
        updateText("adminFirstName", firstName);
        updateText("adminEmail", email);

        updateText(
            "headerUserName",
            firstName
        );

        updateText(
            "accountName",
            fullName
        );

        updateText(
            "adminAccountType",
            user.account_type || "Administrator"
        );

        updateAvatarInitials(fullName);

    } catch (error) {

        console.error("Unable to load admin profile:", error);

    }

}


/* =========================================================
   LOAD ADMIN DASHBOARD DATA
   ========================================================= */

async function loadDashboardData() {

    try {

        const response = await fetch(ADMIN_DASHBOARD_API, {
            method: "GET",
            credentials: "include",
            headers: {
                "Accept": "application/json"
            }
        });

        /*
         * If admin-dashboard.php has not yet been created,
         * keep the dashboard usable instead of breaking
         * the entire page.
         */

        if (!response.ok) {

            console.warn(
                "Admin dashboard API is not available yet."
            );

            return;

        }

        const data = await response.json();

        if (!data.success) {

            console.warn(
                data.message || "Dashboard data unavailable."
            );

            return;

        }

        const stats = data.stats || data.dashboard || {};

        updateDashboardStats(stats);

        renderRecentTransactions(
            data.recent_transactions ||
            data.recentTransactions ||
            []
        );

        renderRecentUsers(
            data.recent_users ||
            data.recentUsers ||
            []
        );

    } catch (error) {

        console.error(
            "Admin dashboard loading error:",
            error
        );

    }

}


/* =========================================================
   UPDATE DASHBOARD STATISTICS
   ========================================================= */

function updateDashboardStats(stats) {

    /*
     * Users
     */

    updateNumber(
        "totalUsers",
        stats.total_users ??
        stats.users ??
        stats.totalUsers ??
        0
    );

    updateNumber(
        "activeUsers",
        stats.active_users ??
        stats.activeUsers ??
        0
    );

    /*
     * Deposits
     */

    updateCurrency(
        "totalDeposits",
        stats.total_deposits ??
        stats.totalDeposits ??
        0
    );

    updateNumber(
        "pendingDeposits",
        stats.pending_deposits ??
        stats.pendingDeposits ??
        0
    );

    /*
     * Withdrawals
     */

    updateCurrency(
        "totalWithdrawals",
        stats.total_withdrawals ??
        stats.totalWithdrawals ??
        0
    );

    updateNumber(
        "pendingWithdrawals",
        stats.pending_withdrawals ??
        stats.pendingWithdrawals ??
        0
    );

    /*
     * Investments
     */

    updateCurrency(
        "totalInvestments",
        stats.total_investments ??
        stats.totalInvestments ??
        0
    );

    updateNumber(
        "activeInvestments",
        stats.active_investments ??
        stats.activeInvestments ??
        0
    );

    /*
     * Referrals
     */

    updateNumber(
        "totalReferrals",
        stats.total_referrals ??
        stats.totalReferrals ??
        0
    );

    /*
     * Transactions
     */

    updateNumber(
        "totalTransactions",
        stats.total_transactions ??
        stats.totalTransactions ??
        0
    );

    /*
     * Support tickets
     */

    updateNumber(
        "openTickets",
        stats.open_tickets ??
        stats.openTickets ??
        0
    );

}


/* =========================================================
   RECENT TRANSACTIONS
   ========================================================= */

function renderRecentTransactions(transactions) {

    const container =
        document.getElementById("recentTransactions");

    if (!container) {
        return;
    }

    if (!Array.isArray(transactions) || transactions.length === 0) {

        container.innerHTML = `
            <div class="admin-empty-state">
                <div class="empty-icon">
                    <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="1.8"
                    >
                        <rect
                            x="3"
                            y="4"
                            width="18"
                            height="16"
                            rx="2"
                        ></rect>

                        <path d="M7 8h10"></path>
                        <path d="M7 12h6"></path>
                        <path d="M7 16h4"></path>
                    </svg>
                </div>

                <p>No recent transactions</p>
            </div>
        `;

        return;
    }

    container.innerHTML = transactions
        .slice(0, 8)
        .map(transaction => {

            const type =
                transaction.type ||
                transaction.transaction_type ||
                "transaction";

            const status =
                transaction.status ||
                "pending";

            const amount =
                transaction.amount ||
                0;

            const description =
                transaction.description ||
                transaction.reference ||
                capitalize(type);

            return `
                <div class="transaction-row">

                    <div class="transaction-icon ${getTypeClass(type)}">

                        ${getTransactionIcon(type)}

                    </div>

                    <div class="transaction-info">

                        <strong>
                            ${escapeHTML(description)}
                        </strong>

                        <span>
                            ${formatDate(
                                transaction.created_at ||
                                transaction.date
                            )}
                        </span>

                    </div>

                    <div class="transaction-amount">

                        <strong>
                            ${formatCurrency(amount)}
                        </strong>

                        <span class="status-badge ${getStatusClass(status)}">
                            ${escapeHTML(
                                capitalize(status)
                            )}
                        </span>

                    </div>

                </div>
            `;

        })
        .join("");

}


/* =========================================================
   RECENT USERS
   ========================================================= */

function renderRecentUsers(users) {

    const container =
        document.getElementById("recentUsers");

    if (!container) {
        return;
    }

    if (!Array.isArray(users) || users.length === 0) {

        container.innerHTML = `
            <div class="admin-empty-state">

                <div class="empty-icon">

                    <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="1.8"
                    >
                        <path
                            d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"
                        ></path>

                        <circle
                            cx="9"
                            cy="7"
                            r="4"
                        ></circle>

                        <path
                            d="M22 21v-2a4 4 0 0 0-3-3.87"
                        ></path>

                        <path
                            d="M16 3.13a4 4 0 0 1 0 7.75"
                        ></path>

                    </svg>

                </div>

                <p>No recent users</p>

            </div>
        `;

        return;
    }

    container.innerHTML = users
        .slice(0, 8)
        .map(user => {

            const fullName =
                user.full_name ||
                `${user.first_name || ""} ${user.last_name || ""}`.trim() ||
                "User";

            const email =
                user.email ||
                "";

            const status =
                user.status ||
                "active";

            return `
                <div class="user-row">

                    <div class="user-avatar">

                        ${getInitials(fullName)}

                    </div>

                    <div class="user-info">

                        <strong>
                            ${escapeHTML(fullName)}
                        </strong>

                        <span>
                            ${escapeHTML(email)}
                        </span>

                    </div>

                    <div class="user-status">

                        <span class="status-badge ${getStatusClass(status)}">

                            ${escapeHTML(
                                capitalize(status)
                            )}

                        </span>

                    </div>

                </div>
            `;

        })
        .join("");

}


/* =========================================================
   SIDEBAR
   ========================================================= */

function setupSidebar() {

    const sidebar =
        document.getElementById("sidebar");

    const overlay =
        document.getElementById("sidebarOverlay");

    const menuButton =
        document.getElementById("menuButton");

    const closeButton =
        document.getElementById("sidebarClose");

    if (menuButton) {

        menuButton.addEventListener(
            "click",
            () => {

                sidebar?.classList.add("active");
                overlay?.classList.add("active");

                document.body.classList.add(
                    "sidebar-open"
                );

            }
        );

    }

    if (closeButton) {

        closeButton.addEventListener(
            "click",
            closeSidebar
        );

    }

    if (overlay) {

        overlay.addEventListener(
            "click",
            closeSidebar
        );

    }

}


/* =========================================================
   CLOSE SIDEBAR
   ========================================================= */

function closeSidebar() {

    const sidebar =
        document.getElementById("sidebar");

    const overlay =
        document.getElementById("sidebarOverlay");

    sidebar?.classList.remove("active");
    overlay?.classList.remove("active");

    document.body.classList.remove(
        "sidebar-open"
    );

}


/* =========================================================
   ADMIN NAVIGATION
   ========================================================= */

function setupNavigation() {

    const navLinks =
        document.querySelectorAll(
            ".admin-nav a, .sidebar-nav a, [data-admin-link]"
        );

    navLinks.forEach(link => {

        link.addEventListener(
            "click",
            function () {

                closeSidebar();

                navLinks.forEach(item => {
                    item.classList.remove("active");
                });

                this.classList.add("active");

            }
        );

    });

}


/* =========================================================
   LOGOUT
   ========================================================= */

function setupLogout() {

    const logoutButtons =
        document.querySelectorAll(
            "#logoutBtn, .logout-btn, [data-action='logout']"
        );

    logoutButtons.forEach(button => {

        button.addEventListener(
            "click",
            async function (event) {

                event.preventDefault();

                const confirmed =
                    confirm(
                        "Are you sure you want to logout?"
                    );

                if (!confirmed) {
                    return;
                }

                try {

                    button.disabled = true;

                    const response = await fetch(
                        LOGOUT_API,
                        {
                            method: "POST",
                            credentials: "include",
                            headers: {
                                "Content-Type":
                                    "application/json"
                            }
                        }
                    );

                    /*
                     * Whether or not the backend responds,
                     * send the administrator back to login.
                     */

                    if (
                        response.ok ||
                        !response.ok
                    ) {

                        window.location.href =
                            "login.html";

                    }

                } catch (error) {

                    console.error(
                        "Logout error:",
                        error
                    );

                    window.location.href =
                        "login.html";

                }

            }
        );

    });

}


/* =========================================================
   PAGE LOADING
   ========================================================= */

function showPageLoading(show) {

    const loader =
        document.getElementById("pageLoader");

    if (!loader) {
        return;
    }

    if (show) {

        loader.classList.remove("hidden");

    } else {

        loader.classList.add("hidden");

    }

}


/* =========================================================
   ADMIN MESSAGE
   ========================================================= */

function showAdminMessage(message, type = "info") {

    let messageBox =
        document.getElementById("adminMessage");

    if (!messageBox) {

        messageBox =
            document.createElement("div");

        messageBox.id =
            "adminMessage";

        messageBox.className =
            "admin-message";

        document.body.prepend(
            messageBox
        );

    }

    messageBox.className =
        `admin-message ${type}`;

    messageBox.textContent =
        message;

    messageBox.classList.add("show");

    setTimeout(() => {

        messageBox.classList.remove("show");

    }, 5000);

}


/* =========================================================
   REDIRECT LOGIN
   ========================================================= */

function redirectToLogin() {

    window.location.href =
        "login.html";

}


/* =========================================================
   TEXT HELPERS
   ========================================================= */

function updateText(id, value) {

    const element =
        document.getElementById(id);

    if (!element) {
        return;
    }

    element.textContent =
        value ?? "";

}


/* =========================================================
   NUMBER FORMAT
   ========================================================= */

function updateNumber(id, value) {

    const element =
        document.getElementById(id);

    if (!element) {
        return;
    }

    const number =
        Number(value) || 0;

    element.textContent =
        number.toLocaleString(
            "en-US"
        );

}


/* =========================================================
   CURRENCY FORMAT
   ========================================================= */

function updateCurrency(id, value) {

    const element =
        document.getElementById(id);

    if (!element) {
        return;
    }

    element.textContent =
        formatCurrency(value);

}


function formatCurrency(value) {

    const number =
        Number(value) || 0;

    return `UGX ${number.toLocaleString("en-US")}`;

}


/* =========================================================
   DATE FORMAT
   ========================================================= */

function formatDate(dateValue) {

    if (!dateValue) {
        return "No date";
    }

    const date =
        new Date(dateValue);

    if (Number.isNaN(date.getTime())) {
        return "No date";
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
   STATUS CLASS
   ========================================================= */

function getStatusClass(status) {

    const normalized =
        String(status)
            .toLowerCase()
            .trim();

    if (
        normalized === "approved" ||
        normalized === "active" ||
        normalized === "completed" ||
        normalized === "success" ||
        normalized === "successful"
    ) {

        return "status-success";

    }

    if (
        normalized === "rejected" ||
        normalized === "failed" ||
        normalized === "cancelled" ||
        normalized === "blocked" ||
        normalized === "suspended"
    ) {

        return "status-danger";

    }

    if (
        normalized === "pending" ||
        normalized === "processing" ||
        normalized === "awaiting_payout"
    ) {

        return "status-warning";

    }

    return "status-neutral";

}


/* =========================================================
   TRANSACTION TYPE CLASS
   ========================================================= */

function getTypeClass(type) {

    const normalized =
        String(type)
            .toLowerCase();

    if (
        normalized.includes("deposit")
    ) {

        return "type-deposit";

    }

    if (
        normalized.includes("withdraw")
    ) {

        return "type-withdrawal";

    }

    if (
        normalized.includes("invest")
    ) {

        return "type-investment";

    }

    if (
        normalized.includes("referral")
    ) {

        return "type-referral";

    }

    return "type-default";

}


/* =========================================================
   TRANSACTION ICONS
   ========================================================= */

function getTransactionIcon(type) {

    const normalized =
        String(type)
            .toLowerCase();

    if (
        normalized.includes("deposit")
    ) {

        return `
            <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="1.8"
            >
                <path d="M12 3v14"></path>
                <path d="m6 11 6 6 6-6"></path>
                <path d="M5 21h14"></path>
            </svg>
        `;

    }

    if (
        normalized.includes("withdraw")
    ) {

        return `
            <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="1.8"
            >
                <path d="M12 21V7"></path>
                <path d="m6 13 6-6 6 6"></path>
                <path d="M5 3h14"></path>
            </svg>
        `;

    }

    if (
        normalized.includes("invest")
    ) {

        return `
            <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="1.8"
            >
                <path d="M4 19V5"></path>
                <path d="M4 19h16"></path>
                <path d="m7 15 3-4 3 2 5-7"></path>
            </svg>
        `;

    }

    return `
        <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
        >
            <circle
                cx="12"
                cy="12"
                r="9"
            ></circle>

            <path d="M12 8v8"></path>
            <path d="M8 12h8"></path>
        </svg>
    `;

}


/* =========================================================
   CAPITALIZE
   ========================================================= */

function capitalize(value) {

    if (!value) {
        return "";
    }

    return String(value)
        .charAt(0)
        .toUpperCase() +
        String(value)
            .slice(1)
            .toLowerCase();

}


/* =========================================================
   INITIALS
   ========================================================= */

function getInitials(name) {

    const parts =
        String(name)
            .trim()
            .split(/\s+/)
            .filter(Boolean);

    if (parts.length === 0) {
        return "CC";
    }

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
   UPDATE AVATAR
   ========================================================= */

function updateAvatarInitials(name) {

    const initials =
        getInitials(name);

    const avatars =
        document.querySelectorAll(
            "#adminAvatar, #accountAvatar, .admin-avatar"
        );

    avatars.forEach(avatar => {

        /*
         * Only replace plain-text avatar contents.
         * Existing SVG logos/icons are left untouched.
         */

        if (
            avatar.children.length === 0
        ) {

            avatar.textContent =
                initials;

        }

    });

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
   GLOBAL ADMIN OBJECT
   ========================================================= */

window.CrownCashAdmin = {

    reload: loadDashboardData,

    refreshProfile: loadAdminProfile,

    logout: () => {

        window.location.href =
            "login.html";

    },

    formatCurrency,

    formatDate,

    getInitials

};