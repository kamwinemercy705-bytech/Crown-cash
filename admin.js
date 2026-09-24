/* =========================================================
   CROWN CASH - ADMIN DASHBOARD
   admin.js
   ========================================================= */

"use strict";

/* =========================================================
   CONFIGURATION
   ========================================================= */

const API_BASE = "https://crown-cash1.onrender.com";

const ADMIN_AUTH_API = `${API_BASE}/admin-auth.php`;
const PROFILE_API = `${API_BASE}/profile.php`;
const ADMIN_DASHBOARD_API = `${API_BASE}/admin-dashboard.php`;
const LOGOUT_API = `${API_BASE}/logout.php`;

const REQUEST_TIMEOUT = 15000;

/* =========================================================
   STATE
   ========================================================= */

const AdminDashboard = {
    data: null,
    profile: null,
    authenticated: false,
    loading: false
};

/* =========================================================
   DOM HELPERS
   ========================================================= */

function $(selector) {
    return document.querySelector(selector);
}

function setText(selector, value) {
    const element = $(selector);

    if (element) {
        element.textContent = value ?? "";
    }
}

function showElement(selector) {
    const element = $(selector);

    if (element) {
        element.style.display = "";
    }
}

function hideElement(selector) {
    const element = $(selector);

    if (element) {
        element.style.display = "none";
    }
}

/* =========================================================
   LOADER
   ========================================================= */

function showLoader(message = "Loading Administration") {
    const loader = $("#pageLoader");

    if (!loader) {
        return;
    }

    loader.classList.remove("hidden");

    const title =
        loader.querySelector(".loader-title") ||
        loader.querySelector("h1") ||
        loader.querySelector("h2");

    const subtitle =
        loader.querySelector(".loader-subtitle") ||
        loader.querySelector("p");

    if (title) {
        title.textContent = message;
    }

    if (subtitle) {
        subtitle.textContent = "Securing your administrator session...";
    }
}

function hideLoader() {
    const loader = $("#pageLoader");

    if (!loader) {
        return;
    }

    loader.classList.add("hidden");

    /*
     * Extra protection in case CSS does not contain
     * the .hidden rule.
     */
    setTimeout(() => {
        if (loader) {
            loader.style.display = "none";
            loader.setAttribute("aria-hidden", "true");
        }
    }, 350);
}

/* =========================================================
   MESSAGE
   ========================================================= */

function showAdminMessage(message, type = "info") {
    let messageBox = $("#adminMessage");

    if (!messageBox) {
        messageBox = document.createElement("div");
        messageBox.id = "adminMessage";

        document.body.appendChild(messageBox);
    }

    messageBox.className = `admin-message ${type}`;
    messageBox.textContent = message;

    messageBox.style.display = "block";

    setTimeout(() => {
        if (messageBox) {
            messageBox.style.display = "none";
        }
    }, 6000);
}

/* =========================================================
   REQUEST WITH TIMEOUT
   ========================================================= */

async function fetchWithTimeout(url, options = {}, timeout = REQUEST_TIMEOUT) {

    const controller = new AbortController();

    const timeoutId = setTimeout(() => {
        controller.abort();
    }, timeout);

    try {

        const response = await fetch(url, {
            ...options,
            credentials: "include",
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        return response;

    } catch (error) {

        clearTimeout(timeoutId);

        if (error.name === "AbortError") {
            throw new Error(
                "The server took too long to respond. Please try again."
            );
        }

        throw error;
    }
}

/* =========================================================
   SAFE JSON
   ========================================================= */

async function readJson(response) {

    const text = await response.text();

    if (!text) {
        return {};
    }

    try {
        return JSON.parse(text);
    } catch (error) {

        console.error("Invalid JSON response:", text);

        throw new Error(
            "The server returned an invalid response."
        );
    }
}

/* =========================================================
   AUTHENTICATE ADMIN
   ========================================================= */

async function authenticateAdmin() {

    try {

        const response = await fetchWithTimeout(
            ADMIN_AUTH_API,
            {
                method: "GET",
                headers: {
                    "Accept": "application/json"
                }
            }
        );

        const data = await readJson(response);

        console.log("Admin authentication:", data);

        if (
            response.ok &&
            data.success === true &&
            data.authenticated === true &&
            data.authorized === true
        ) {

            AdminDashboard.authenticated = true;

            return true;
        }

        if (response.status === 401) {

            window.location.href = "login.html";
            return false;
        }

        if (response.status === 403) {

            showAdminMessage(
                data.message ||
                "Administrator access is required.",
                "error"
            );

            setTimeout(() => {
                window.location.href = "dashboard.html";
            }, 1800);

            return false;
        }

        throw new Error(
            data.message ||
            "Administrator authentication failed."
        );

    } catch (error) {

        console.error(
            "Admin authentication error:",
            error
        );

        showAdminMessage(
            error.message ||
            "Unable to verify administrator access.",
            "error"
        );

        return false;
    }
}

/* =========================================================
   LOAD ADMIN PROFILE
   ========================================================= */

async function loadAdminProfile() {

    try {

        const response = await fetchWithTimeout(
            PROFILE_API,
            {
                method: "GET",
                headers: {
                    "Accept": "application/json"
                }
            }
        );

        const data = await readJson(response);

        console.log("Admin profile:", data);

        if (
            !response.ok ||
            data.success !== true
        ) {

            throw new Error(
                data.message ||
                "Unable to load administrator profile."
            );
        }

        AdminDashboard.profile = data.user || {};

        renderAdminProfile(
            AdminDashboard.profile
        );

        return AdminDashboard.profile;

    } catch (error) {

        console.error(
            "Profile loading error:",
            error
        );

        /*
         * Profile failure should not completely
         * destroy the dashboard.
         */

        setText("#adminName", "Administrator");
        setText("#adminFirstName", "Administrator");
        setText("#headerUserName", "Administrator");
        setText("#accountName", "Administrator");
        setText("#adminAccountType", "Admin Account");

        return null;
    }
}

/* =========================================================
   RENDER ADMIN PROFILE
   ========================================================= */

function renderAdminProfile(user) {

    const fullName =
        user.full_name ||
        [
            user.first_name,
            user.last_name
        ]
            .filter(Boolean)
            .join(" ") ||
        "Administrator";

    const firstName =
        user.first_name ||
        fullName.split(" ")[0] ||
        "Administrator";

    const email =
        user.email ||
        "";

    const accountType =
        user.account_type ||
        user.role ||
        "admin";

    const avatarLetter =
        firstName
            .charAt(0)
            .toUpperCase() ||
        "A";

    setText("#adminName", fullName);
    setText("#adminFirstName", firstName);
    setText("#headerUserName", fullName);
    setText("#accountName", fullName);
    setText("#adminEmail", email);
    setText("#adminAccountType", formatAccountType(accountType));

    const avatars = [
        "#adminAvatar",
        "#accountAvatar"
    ];

    avatars.forEach(selector => {

        const element = $(selector);

        if (!element) {
            return;
        }

        /*
         * Only replace text when the avatar is a text
         * avatar. Existing SVGs/images remain untouched.
         */

        if (
            element.tagName === "IMG"
        ) {
            return;
        }

        element.textContent = avatarLetter;
    });
}

/* =========================================================
   LOAD DASHBOARD DATA
   ========================================================= */

async function loadDashboardData() {

    try {

        const response = await fetchWithTimeout(
            ADMIN_DASHBOARD_API,
            {
                method: "GET",
                headers: {
                    "Accept": "application/json"
                }
            }
        );

        const data = await readJson(response);

        console.log(
            "Admin dashboard response:",
            data
        );

        if (response.status === 401) {

            window.location.href = "login.html";
            return null;
        }

        if (response.status === 403) {

            showAdminMessage(
                data.message ||
                "Administrator access denied.",
                "error"
            );

            return null;
        }

        if (
            !response.ok ||
            data.success !== true
        ) {

            throw new Error(
                data.message ||
                "Unable to load dashboard data."
            );
        }

        AdminDashboard.data = data;

        renderDashboard(data);

        return data;

    } catch (error) {

        console.error(
            "Dashboard data error:",
            error
        );

        /*
         * Do NOT keep the loading screen forever.
         */

        showAdminMessage(
            error.message ||
            "Dashboard data could not be loaded.",
            "error"
        );

        renderDashboardError();

        return null;
    }
}

/* =========================================================
   RENDER DASHBOARD
   ========================================================= */

function renderDashboard(data) {

    const stats =
        data.stats ||
        data.summary ||
        data;

    /* -------------------------------
       USERS
       ------------------------------- */

    setText(
        "#totalUsers",
        formatNumber(
            getValue(
                stats,
                [
                    "total_users",
                    "users",
                    "totalUsers"
                ],
                0
            )
        )
    );

    setText(
        "#activeUsers",
        formatNumber(
            getValue(
                stats,
                [
                    "active_users",
                    "activeUsers"
                ],
                0
            )
        )
    );

    /* -------------------------------
       DEPOSITS
       ------------------------------- */

    setText(
        "#totalDeposits",
        formatCurrency(
            getValue(
                stats,
                [
                    "total_deposits",
                    "deposits",
                    "totalDeposits"
                ],
                0
            )
        )
    );

    setText(
        "#pendingDeposits",
        formatCurrency(
            getValue(
                stats,
                [
                    "pending_deposits",
                    "pendingDeposits"
                ],
                0
            )
        )
    );

    /* -------------------------------
       WITHDRAWALS
       ------------------------------- */

    setText(
        "#totalWithdrawals",
        formatCurrency(
            getValue(
                stats,
                [
                    "total_withdrawals",
                    "withdrawals",
                    "totalWithdrawals"
                ],
                0
            )
        )
    );

    setText(
        "#pendingWithdrawals",
        formatCurrency(
            getValue(
                stats,
                [
                    "pending_withdrawals",
                    "pendingWithdrawals"
                ],
                0
            )
        )
    );

    /* -------------------------------
       INVESTMENTS
       ------------------------------- */

    setText(
        "#totalInvestments",
        formatCurrency(
            getValue(
                stats,
                [
                    "total_investments",
                    "investments",
                    "totalInvestments"
                ],
                0
            )
        )
    );

    /* -------------------------------
       ACTIVE INVESTMENTS
       ------------------------------- */

    setText(
        "#activeInvestments",
        formatNumber(
            getValue(
                stats,
                [
                    "active_investments",
                    "activeInvestments"
                ],
                0
            )
        )
    );

    /* -------------------------------
       REFERRALS
       ------------------------------- */

    setText(
        "#totalReferrals",
        formatNumber(
            getValue(
                stats,
                [
                    "total_referrals",
                    "referrals",
                    "totalReferrals"
                ],
                0
            )
        )
    );

    /* -------------------------------
       TRANSACTIONS
       ------------------------------- */

    setText(
        "#totalTransactions",
        formatNumber(
            getValue(
                stats,
                [
                    "total_transactions",
                    "transactions",
                    "totalTransactions"
                ],
                0
            )
        )
    );

    /* -------------------------------
       SUPPORT
       ------------------------------- */

    setText(
        "#openTickets",
        formatNumber(
            getValue(
                stats,
                [
                    "open_tickets",
                    "open_support",
                    "openTickets"
                ],
                0
            )
        )
    );

    /* -------------------------------
       RECENT TRANSACTIONS
       ------------------------------- */

    renderRecentTransactions(
        data.recent_transactions ||
        data.recentTransactions ||
        []
    );

    /* -------------------------------
       RECENT USERS
       ------------------------------- */

    renderRecentUsers(
        data.recent_users ||
        data.recentUsers ||
        []
    );
}

/* =========================================================
   DASHBOARD ERROR STATE
   ========================================================= */

function renderDashboardError() {

    const transactionContainer =
        $("#recentTransactions");

    if (transactionContainer) {

        transactionContainer.innerHTML = `
            <div class="admin-empty-state">
                <div class="empty-icon">
                    <svg
                        width="28"
                        height="28"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="1.8"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                    >
                        <circle cx="12" cy="12" r="9"></circle>
                        <line x1="12" y1="8" x2="12" y2="12"></line>
                        <line x1="12" y1="16" x2="12.01" y2="16"></line>
                    </svg>
                </div>

                <strong>Unable to load activity</strong>

                <span>
                    Check your connection and refresh the page.
                </span>
            </div>
        `;
    }

    const usersContainer =
        $("#recentUsers");

    if (usersContainer) {

        usersContainer.innerHTML = `
            <div class="admin-empty-state">
                <div class="empty-icon">
                    <svg
                        width="28"
                        height="28"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="1.8"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                    >
                        <circle cx="12" cy="8" r="3"></circle>
                        <path d="M5 20c0-3.5 3-6 7-6s7 2.5 7 6"></path>
                    </svg>
                </div>

                <strong>Unable to load users</strong>

                <span>
                    Check your connection and refresh the page.
                </span>
            </div>
        `;
    }
}

/* =========================================================
   RECENT TRANSACTIONS
   ========================================================= */

function renderRecentTransactions(transactions) {

    const container =
        $("#recentTransactions");

    if (!container) {
        return;
    }

    if (
        !Array.isArray(transactions) ||
        transactions.length === 0
    ) {

        container.innerHTML = `
            <div class="admin-empty-state">
                <div class="empty-icon">
                    <svg
                        width="28"
                        height="28"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="1.8"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                    >
                        <path d="M3 12h18"></path>
                        <path d="M12 3v18"></path>
                    </svg>
                </div>

                <strong>No transactions yet</strong>

                <span>
                    Recent platform activity will appear here.
                </span>
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
                getNumericValue(
                    transaction.amount
                );

            const name =
                transaction.full_name ||
                transaction.user_name ||
                transaction.name ||
                transaction.email ||
                "Crown Cash User";

            const date =
                transaction.created_at ||
                transaction.date ||
                transaction.timestamp ||
                "";

            return `
                <div class="transaction-row">

                    <div class="transaction-icon ${getTypeClass(type)}">

                        ${getTransactionIcon(type)}

                    </div>

                    <div class="transaction-info">

                        <strong>
                            ${escapeHtml(
                                formatTransactionType(type)
                            )}
                        </strong>

                        <span>
                            ${escapeHtml(name)}
                        </span>

                    </div>

                    <div class="transaction-value">

                        <strong>
                            ${formatCurrency(amount)}
                        </strong>

                        <span class="status-badge ${getStatusClass(status)}">
                            ${escapeHtml(
                                formatStatus(status)
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
        $("#recentUsers");

    if (!container) {
        return;
    }

    if (
        !Array.isArray(users) ||
        users.length === 0
    ) {

        container.innerHTML = `
            <div class="admin-empty-state">

                <div class="empty-icon">

                    <svg
                        width="28"
                        height="28"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="1.8"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                    >
                        <circle cx="12" cy="8" r="3"></circle>
                        <path d="M5 20c0-3.5 3-6 7-6s7 2.5 7 6"></path>
                    </svg>

                </div>

                <strong>No users yet</strong>

                <span>
                    Newly registered users will appear here.
                </span>

            </div>
        `;

        return;
    }

    container.innerHTML = users
        .slice(0, 8)
        .map(user => {

            const name =
                user.full_name ||
                [
                    user.first_name,
                    user.last_name
                ]
                    .filter(Boolean)
                    .join(" ") ||
                "User";

            const email =
                user.email ||
                "No email";

            const status =
                user.status ||
                "active";

            const firstLetter =
                name
                    .charAt(0)
                    .toUpperCase();

            return `
                <div class="user-row">

                    <div class="user-avatar">
                        ${escapeHtml(firstLetter)}
                    </div>

                    <div class="user-info">

                        <strong>
                            ${escapeHtml(name)}
                        </strong>

                        <span>
                            ${escapeHtml(email)}
                        </span>

                    </div>

                    <div class="user-status">

                        <span class="status-badge ${getStatusClass(status)}">
                            ${escapeHtml(
                                formatStatus(status)
                            )}
                        </span>

                    </div>

                </div>
            `;
        })
        .join("");
}

/* =========================================================
   TRANSACTION ICONS
   ========================================================= */

function getTransactionIcon(type) {

    const value =
        String(type)
            .toLowerCase();

    if (
        value.includes("deposit") ||
        value.includes("credit")
    ) {

        return `
            <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="1.8"
                stroke-linecap="round"
                stroke-linejoin="round"
            >
                <circle cx="12" cy="12" r="9"></circle>
                <path d="M12 16V8"></path>
                <path d="M9 11l3-3 3 3"></path>
            </svg>
        `;
    }

    if (
        value.includes("withdraw")
    ) {

        return `
            <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="1.8"
                stroke-linecap="round"
                stroke-linejoin="round"
            >
                <circle cx="12" cy="12" r="9"></circle>
                <path d="M12 8v8"></path>
                <path d="M9 13l3 3 3-3"></path>
            </svg>
        `;
    }

    if (
        value.includes("investment")
    ) {

        return `
            <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="1.8"
                stroke-linecap="round"
                stroke-linejoin="round"
            >
                <path d="M4 19V9"></path>
                <path d="M10 19V5"></path>
                <path d="M16 19v-7"></path>
                <path d="M22 19V3"></path>
            </svg>
        `;
    }

    return `
        <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linecap="round"
            stroke-linejoin="round"
        >
            <circle cx="12" cy="12" r="9"></circle>
            <path d="M8 12h8"></path>
            <path d="M12 8v8"></path>
        </svg>
    `;
}

/* =========================================================
   TYPE CLASS
   ========================================================= */

function getTypeClass(type) {

    const value =
        String(type)
            .toLowerCase();

    if (value.includes("deposit")) {
        return "deposit";
    }

    if (value.includes("withdraw")) {
        return "withdrawal";
    }

    if (value.includes("investment")) {
        return "investment";
    }

    return "transaction";
}

/* =========================================================
   STATUS
   ========================================================= */

function getStatusClass(status) {

    const value =
        String(status)
            .toLowerCase()
            .replace(/\s+/g, "_");

    if (
        value === "approved" ||
        value === "completed" ||
        value === "active" ||
        value === "success" ||
        value === "successful"
    ) {
        return "success";
    }

    if (
        value === "rejected" ||
        value === "failed" ||
        value === "blocked" ||
        value === "suspended" ||
        value === "disabled"
    ) {
        return "danger";
    }

    if (
        value === "pending" ||
        value === "processing" ||
        value === "awaiting_payout"
    ) {
        return "warning";
    }

    return "neutral";
}

/* =========================================================
   FORMAT STATUS
   ========================================================= */

function formatStatus(status) {

    return String(status || "unknown")
        .replace(/_/g, " ")
        .replace(/\b\w/g, letter =>
            letter.toUpperCase()
        );
}

/* =========================================================
   FORMAT TRANSACTION TYPE
   ========================================================= */

function formatTransactionType(type) {

    return String(type || "Transaction")
        .replace(/_/g, " ")
        .replace(/\b\w/g, letter =>
            letter.toUpperCase()
        );
}

/* =========================================================
   ACCOUNT TYPE
   ========================================================= */

function formatAccountType(type) {

    const value =
        String(type || "admin")
            .toLowerCase();

    if (
        value === "admin" ||
        value === "administrator"
    ) {
        return "Admin Account";
    }

    return formatStatus(value);
}

/* =========================================================
   CURRENCY
   ========================================================= */

function formatCurrency(value) {

    const number =
        getNumericValue(value);

    return (
        "UGX " +
        new Intl.NumberFormat(
            "en-UG",
            {
                maximumFractionDigits: 0
            }
        ).format(number)
    );
}

/* =========================================================
   NUMBER
   ========================================================= */

function formatNumber(value) {

    const number =
        getNumericValue(value);

    return new Intl.NumberFormat(
        "en-UG",
        {
            maximumFractionDigits: 0
        }
    ).format(number);
}

/* =========================================================
   NUMERIC VALUE
   ========================================================= */

function getNumericValue(value) {

    if (
        value === null ||
        value === undefined ||
        value === ""
    ) {
        return 0;
    }

    if (typeof value === "number") {
        return Number.isFinite(value)
            ? value
            : 0;
    }

    if (typeof value === "object") {

        if (
            value.$numberDecimal !== undefined
        ) {
            return parseFloat(
                value.$numberDecimal
            ) || 0;
        }

        if (
            value.$numberInt !== undefined
        ) {
            return parseFloat(
                value.$numberInt
            ) || 0;
        }

        if (
            value.$numberLong !== undefined
        ) {
            return parseFloat(
                value.$numberLong
            ) || 0;
        }
    }

    const parsed =
        parseFloat(
            String(value)
                .replace(/,/g, "")
        );

    return Number.isFinite(parsed)
        ? parsed
        : 0;
}

/* =========================================================
   GET VALUE FROM OBJECT
   ========================================================= */

function getValue(object, keys, fallback = 0) {

    if (!object || typeof object !== "object") {
        return fallback;
    }

    for (const key of keys) {

        if (
            object[key] !== undefined &&
            object[key] !== null
        ) {
            return object[key];
        }
    }

    return fallback;
}

/* =========================================================
   ESCAPE HTML
   ========================================================= */

function escapeHtml(value) {

    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

/* =========================================================
   SIDEBAR
   ========================================================= */

function setupSidebar() {

    const sidebar =
        $("#sidebar");

    const overlay =
        $("#sidebarOverlay");

    const menuButton =
        $("#menuButton");

    const sidebarClose =
        $("#sidebarClose");

    function openSidebar() {

        if (sidebar) {
            sidebar.classList.add("open");
        }

        if (overlay) {
            overlay.classList.add("active");
        }

        document.body.classList.add(
            "sidebar-open"
        );
    }

    function closeSidebar() {

        if (sidebar) {
            sidebar.classList.remove("open");
        }

        if (overlay) {
            overlay.classList.remove("active");
        }

        document.body.classList.remove(
            "sidebar-open"
        );
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

    if (overlay) {

        overlay.addEventListener(
            "click",
            closeSidebar
        );
    }

    /*
     * Close mobile sidebar when a navigation
     * link is selected.
     */

    document
        .querySelectorAll(
            "#sidebar a"
        )
        .forEach(link => {

            link.addEventListener(
                "click",
                closeSidebar
            );
        });
}

/* =========================================================
   LOGOUT
   ========================================================= */

async function logoutAdmin() {

    const button =
        $("#logoutBtn");

    if (button) {
        button.disabled = true;
        button.style.opacity = "0.6";
    }

    try {

        await fetchWithTimeout(
            LOGOUT_API,
            {
                method: "POST",
                headers: {
                    "Content-Type":
                        "application/json"
                },
                body: JSON.stringify({})
            },
            8000
        );

    } catch (error) {

        console.warn(
            "Logout request error:",
            error
        );

    } finally {

        window.location.href = "login.html";
    }
}

/* =========================================================
   SETUP LOGOUT
   ========================================================= */

function setupLogout() {

    const button =
        $("#logoutBtn");

    if (!button) {
        return;
    }

    button.addEventListener(
        "click",
        event => {

            event.preventDefault();

            const confirmed =
                window.confirm(
                    "Are you sure you want to logout of the Crown Cash Administration Panel?"
                );

            if (!confirmed) {
                return;
            }

            logoutAdmin();
        }
    );
}

/* =========================================================
   INITIALIZE DASHBOARD
   ========================================================= */

async function initializeAdminDashboard() {

    if (AdminDashboard.loading) {
        return;
    }

    AdminDashboard.loading = true;

    showLoader(
        "Loading Administration"
    );

    try {

        /*
         * STEP 1
         * Verify administrator session.
         */

        const authenticated =
            await authenticateAdmin();

        if (!authenticated) {
            return;
        }

        /*
         * STEP 2
         * Set up UI immediately.
         */

        setupSidebar();
        setupLogout();

        /*
         * STEP 3
         * Load profile and dashboard
         * independently.
         *
         * If profile fails, dashboard can
         * still load.
         */

        await Promise.allSettled([
            loadAdminProfile(),
            loadDashboardData()
        ]);

    } catch (error) {

        console.error(
            "Admin initialization error:",
            error
        );

        showAdminMessage(
            error.message ||
            "Unable to load administration dashboard.",
            "error"
        );

    } finally {

        /*
         * CRITICAL FIX:
         *
         * No matter what happens above,
         * the loading screen is removed.
         */

        hideLoader();

        AdminDashboard.loading = false;
    }
}

/* =========================================================
   START
   ========================================================= */

if (
    document.readyState ===
    "loading"
) {

    document.addEventListener(
        "DOMContentLoaded",
        initializeAdminDashboard
    );

} else {

    initializeAdminDashboard();
}

/* =========================================================
   GLOBAL API
   ========================================================= */

window.CrownCashAdmin = {

    reload: initializeAdminDashboard,

    loadProfile: loadAdminProfile,

    loadDashboard: loadDashboardData,

    logout: logoutAdmin,

    state: AdminDashboard

};