/* =========================================================
   CROWN CASH - ADMIN DASHBOARD
   admin.js
   ========================================================= */

"use strict";

const API_BASE = "https://crown-cash1.onrender.com";

document.addEventListener("DOMContentLoaded", () => {
    initializeAdminDashboard();
});


/* =========================================================
   INITIALIZE
   ========================================================= */

async function initializeAdminDashboard() {
    setupSidebar();
    setupMobileMenu();
    setupLogout();
    setupNavigation();
    setupQuickActions();

    await loadAdminDashboard();
}


/* =========================================================
   SIDEBAR
   ========================================================= */

function setupSidebar() {
    const sidebarLinks = document.querySelectorAll(
        ".sidebar a, .admin-nav a, .nav-link"
    );

    sidebarLinks.forEach(link => {
        link.addEventListener("click", () => {
            sidebarLinks.forEach(item => item.classList.remove("active"));
            link.classList.add("active");
        });
    });
}


/* =========================================================
   MOBILE MENU
   ========================================================= */

function setupMobileMenu() {
    const menuButton = document.querySelector(
        "#menuToggle, .menu-toggle, #mobileMenuBtn"
    );

    const sidebar = document.querySelector(
        "#sidebar, .sidebar, .admin-sidebar"
    );

    const overlay = document.querySelector(
        "#sidebarOverlay, .sidebar-overlay"
    );

    if (!menuButton || !sidebar) return;

    menuButton.addEventListener("click", () => {
        sidebar.classList.toggle("open");

        if (overlay) {
            overlay.classList.toggle("show");
        }
    });

    if (overlay) {
        overlay.addEventListener("click", () => {
            sidebar.classList.remove("open");
            overlay.classList.remove("show");
        });
    }
}


/* =========================================================
   NAVIGATION
   ========================================================= */

function setupNavigation() {
    const links = document.querySelectorAll("[data-page]");

    links.forEach(link => {
        link.addEventListener("click", event => {
            const page = link.dataset.page;

            if (!page) return;

            event.preventDefault();

            navigateToAdminPage(page);
        });
    });
}


function navigateToAdminPage(page) {

    const pages = {
        dashboard: "admin.html",
        users: "users.html",
        deposits: "admin-deposits.html",
        withdrawals: "admin-withdrawals.html",
        investments: "admin-investments.html",
        referrals: "admin-referrals.html",
        transactions: "admin-transactions.html",
        security: "admin-security.html"
    };

    if (pages[page]) {
        window.location.href = pages[page];
    }
}


/* =========================================================
   LOAD ADMIN DASHBOARD
   ========================================================= */

async function loadAdminDashboard() {

    showLoadingState();

    try {

        const response = await fetch(
            `${API_BASE}/admin-dashboard.php`,
            {
                method: "GET",
                credentials: "include",
                headers: {
                    "Accept": "application/json"
                }
            }
        );

        if (!response.ok) {
            throw new Error(
                `Server returned ${response.status}`
            );
        }

        const data = await response.json();

        if (data.success === false) {
            throw new Error(
                data.message || "Unable to load admin dashboard."
            );
        }

        updateDashboard(data);

    } catch (error) {

        console.error("Admin dashboard error:", error);

        /*
         * The dashboard can still display its static
         * interface even when the backend endpoint has
         * not yet been created.
         */
        showDashboardError(
            "Dashboard data could not be loaded. Please check the backend connection."
        );
    }
}


/* =========================================================
   UPDATE DASHBOARD
   ========================================================= */

function updateDashboard(data) {

    const stats = data.stats || data.statistics || {};
    const recent = data.recent || data.recent_transactions || [];

    setValue(
        ["totalUsers", "usersCount", "total-users"],
        formatNumber(stats.total_users ?? stats.users ?? 0)
    );

    setValue(
        ["activeUsers", "active-users"],
        formatNumber(stats.active_users ?? 0)
    );

    setValue(
        ["pendingDeposits", "pending-deposits"],
        formatNumber(stats.pending_deposits ?? 0)
    );

    setValue(
        ["pendingWithdrawals", "pending-withdrawals"],
        formatNumber(stats.pending_withdrawals ?? 0)
    );

    setValue(
        ["totalInvestments", "total-investments"],
        formatUGX(stats.total_investments ?? 0)
    );

    setValue(
        ["totalDeposits", "total-deposits"],
        formatUGX(stats.total_deposits ?? 0)
    );

    setValue(
        ["totalWithdrawals", "total-withdrawals"],
        formatUGX(stats.total_withdrawals ?? 0)
    );

    setValue(
        ["totalBalance", "total-balance"],
        formatUGX(stats.total_balance ?? 0)
    );

    updateRecentTransactions(recent);

    updatePendingBadges(stats);

    hideLoadingState();
}


/* =========================================================
   SET VALUE
   ========================================================= */

function setValue(ids, value) {

    if (!Array.isArray(ids)) {
        ids = [ids];
    }

    for (const id of ids) {

        const element = document.getElementById(id);

        if (element) {
            element.textContent = value;
            return;
        }

        const selector = `[data-stat="${id}"]`;
        const dataElement = document.querySelector(selector);

        if (dataElement) {
            dataElement.textContent = value;
            return;
        }
    }
}


/* =========================================================
   NUMBER FORMAT
   ========================================================= */

function formatNumber(value) {

    const number = Number(value);

    if (!Number.isFinite(number)) {
        return "0";
    }

    return number.toLocaleString("en-US");
}


/* =========================================================
   UGX FORMAT
   ========================================================= */

function formatUGX(value) {

    const number = Number(value);

    if (!Number.isFinite(number)) {
        return "UGX 0";
    }

    return "UGX " + number.toLocaleString("en-UG");
}


/* =========================================================
   RECENT TRANSACTIONS
   ========================================================= */

function updateRecentTransactions(transactions) {

    const container =
        document.getElementById("recentTransactions") ||
        document.querySelector("[data-recent-transactions]");

    if (!container) return;

    if (!Array.isArray(transactions) || transactions.length === 0) {

        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">✓</div>
                <h3>No Recent Transactions</h3>
                <p>There are no recent transactions to display.</p>
            </div>
        `;

        return;
    }

    container.innerHTML = transactions
        .slice(0, 10)
        .map(transaction => createTransactionHTML(transaction))
        .join("");
}


/* =========================================================
   TRANSACTION HTML
   ========================================================= */

function createTransactionHTML(transaction) {

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

    const user =
        transaction.user_name ||
        transaction.name ||
        transaction.email ||
        "User";

    const date =
        transaction.created_at ||
        transaction.date ||
        "";

    return `
        <div class="transaction-row">

            <div class="transaction-icon ${escapeHTML(type)}">
                ${getTransactionIcon(type)}
            </div>

            <div class="transaction-info">

                <strong>
                    ${escapeHTML(formatTransactionType(type))}
                </strong>

                <span>
                    ${escapeHTML(user)}
                </span>

                <small>
                    ${escapeHTML(formatDate(date))}
                </small>

            </div>

            <div class="transaction-amount">
                ${formatUGX(amount)}
            </div>

            <span class="status-badge ${escapeHTML(status)}">
                ${escapeHTML(capitalize(status))}
            </span>

        </div>
    `;
}


/* =========================================================
   TRANSACTION ICONS
   ========================================================= */

function getTransactionIcon(type) {

    type = String(type).toLowerCase();

    if (
        type.includes("deposit")
    ) {
        return `
            <svg viewBox="0 0 24 24"
                 width="20"
                 height="20"
                 fill="none"
                 stroke="currentColor"
                 stroke-width="2">
                <path d="M12 3v14"/>
                <path d="M7 12l5 5 5-5"/>
                <path d="M5 21h14"/>
            </svg>
        `;
    }

    if (
        type.includes("withdraw")
    ) {
        return `
            <svg viewBox="0 0 24 24"
                 width="20"
                 height="20"
                 fill="none"
                 stroke="currentColor"
                 stroke-width="2">
                <path d="M12 21V7"/>
                <path d="M7 12l5-5 5 5"/>
                <path d="M5 3h14"/>
            </svg>
        `;
    }

    if (
        type.includes("investment")
    ) {
        return `
            <svg viewBox="0 0 24 24"
                 width="20"
                 height="20"
                 fill="none"
                 stroke="currentColor"
                 stroke-width="2">
                <path d="M4 19V5"/>
                <path d="M4 19h16"/>
                <path d="M7 15l4-4 3 2 5-6"/>
            </svg>
        `;
    }

    return `
        <svg viewBox="0 0 24 24"
             width="20"
             height="20"
             fill="none"
             stroke="currentColor"
             stroke-width="2">
            <circle cx="12" cy="12" r="9"/>
            <path d="M12 7v10"/>
            <path d="M8 11l4 4 4-4"/>
        </svg>
    `;
}


/* =========================================================
   PENDING BADGES
   ========================================================= */

function updatePendingBadges(stats) {

    const deposits =
        Number(stats.pending_deposits || 0);

    const withdrawals =
        Number(stats.pending_withdrawals || 0);

    updateBadge(
        [
            "#depositBadge",
            "#pendingDepositBadge",
            "[data-badge='deposits']"
        ],
        deposits
    );

    updateBadge(
        [
            "#withdrawalBadge",
            "#pendingWithdrawalBadge",
            "[data-badge='withdrawals']"
        ],
        withdrawals
    );
}


function updateBadge(selectors, number) {

    selectors.forEach(selector => {

        const elements =
            document.querySelectorAll(selector);

        elements.forEach(element => {

            if (number > 0) {

                element.textContent =
                    formatNumber(number);

                element.style.display = "inline-flex";

            } else {

                element.style.display = "none";
            }
        });
    });
}


/* =========================================================
   QUICK ACTIONS
   ========================================================= */

function setupQuickActions() {

    const actionButtons =
        document.querySelectorAll(
            "[data-action]"
        );

    actionButtons.forEach(button => {

        button.addEventListener("click", () => {

            const action =
                button.dataset.action;

            switch (action) {

                case "users":
                    window.location.href =
                        "users.html";
                    break;

                case "deposits":
                    window.location.href =
                        "admin-deposits.html";
                    break;

                case "withdrawals":
                    window.location.href =
                        "admin-withdrawals.html";
                    break;

                case "investments":
                    window.location.href =
                        "admin-investments.html";
                    break;

                case "transactions":
                    window.location.href =
                        "admin-transactions.html";
                    break;

                case "security":
                    window.location.href =
                        "admin-security.html";
                    break;
            }
        });
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

        button.addEventListener("click", async event => {

            event.preventDefault();

            button.disabled = true;

            try {

                await fetch(
                    `${API_BASE}/logout.php`,
                    {
                        method: "POST",
                        credentials: "include",
                        headers: {
                            "Content-Type": "application/json"
                        }
                    }
                );

            } catch (error) {

                console.error(
                    "Logout request failed:",
                    error
                );

            } finally {

                localStorage.removeItem("user");
                localStorage.removeItem("userData");
                localStorage.removeItem("loggedIn");

                window.location.href =
                    "login.html";
            }
        });
    });
}


/* =========================================================
   LOADING STATE
   ========================================================= */

function showLoadingState() {

    document
        .querySelectorAll(
            ".stat-value, [data-stat]"
        )
        .forEach(element => {

            if (
                element.textContent.trim() === "" ||
                element.textContent.trim() === "0"
            ) {
                element.classList.add("loading-value");
            }
        });
}


function hideLoadingState() {

    document
        .querySelectorAll(
            ".loading-value"
        )
        .forEach(element => {

            element.classList.remove(
                "loading-value"
            );
        });
}


/* =========================================================
   ERROR MESSAGE
   ========================================================= */

function showDashboardError(message) {

    const errorBox =
        document.getElementById("dashboardError") ||
        document.querySelector(".dashboard-error");

    if (!errorBox) {

        console.warn(message);
        return;
    }

    errorBox.innerHTML = `
        <div class="error-icon">!</div>
        <div>
            <strong>Dashboard data unavailable</strong>
            <p>${escapeHTML(message)}</p>
        </div>
        <button
            type="button"
            onclick="loadAdminDashboard()">
            Retry
        </button>
    `;

    errorBox.style.display = "flex";
}


/* =========================================================
   DATE FORMAT
   ========================================================= */

function formatDate(value) {

    if (!value) {
        return "—";
    }

    try {

        let date;

        if (
            typeof value === "object" &&
            value.$date
        ) {
            date = new Date(value.$date);
        } else {
            date = new Date(value);
        }

        if (Number.isNaN(date.getTime())) {
            return "—";
        }

        return date.toLocaleDateString(
            "en-UG",
            {
                day: "2-digit",
                month: "short",
                year: "numeric"
            }
        );

    } catch (error) {

        return "—";
    }
}


/* =========================================================
   TRANSACTION TYPE
   ========================================================= */

function formatTransactionType(type) {

    const text =
        String(type || "Transaction")
            .replace(/[_-]/g, " ");

    return text
        .replace(/\b\w/g, letter =>
            letter.toUpperCase()
        );
}


/* =========================================================
   CAPITALIZE
   ========================================================= */

function capitalize(value) {

    const text =
        String(value || "");

    if (!text) return "";

    return (
        text.charAt(0).toUpperCase() +
        text.slice(1).toLowerCase()
    );
}


/* =========================================================
   HTML ESCAPE
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
   GLOBAL RETRY
   ========================================================= */

window.loadAdminDashboard =
    loadAdminDashboard;