/* =========================================================
   CROWN CASH — ADMIN DASHBOARD
   admin.js
   ========================================================= */

"use strict";

/* =========================================================
   API CONFIGURATION
   ========================================================= */

const API_BASE = "https://crown-cash1.onrender.com";

const ADMIN_AUTH_API =
    `${API_BASE}/admin-auth.php`;

const PROFILE_API =
    `${API_BASE}/profile.php`;

const ADMIN_DASHBOARD_API =
    `${API_BASE}/admin-dashboard.php`;

const LOGOUT_API =
    `${API_BASE}/logout.php`;


/* =========================================================
   GLOBAL STATE
   ========================================================= */

const AdminDashboardState = {
    profile: null,
    dashboard: null,
    loading: false
};


/* =========================================================
   DOM HELPERS
   ========================================================= */

function $(selector) {
    return document.querySelector(selector);
}

function $all(selector) {
    return document.querySelectorAll(selector);
}


/* =========================================================
   TEXT HELPERS
   ========================================================= */

function setText(selector, value) {

    const element = $(selector);

    if (!element) {
        return;
    }

    element.textContent =
        value === null ||
        value === undefined ||
        value === ""
            ? "—"
            : String(value);
}


/* =========================================================
   HTML ESCAPE
   ========================================================= */

function escapeHTML(value) {

    if (value === null || value === undefined) {
        return "";
    }

    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


/* =========================================================
   NUMBER HELPERS
   ========================================================= */

function toNumber(value) {

    if (value === null || value === undefined) {
        return 0;
    }

    if (typeof value === "number") {
        return Number.isFinite(value) ? value : 0;
    }

    if (typeof value === "object") {

        if (value.$numberDecimal !== undefined) {
            return Number(value.$numberDecimal) || 0;
        }

        if (value.$numberInt !== undefined) {
            return Number(value.$numberInt) || 0;
        }

        if (value.$numberLong !== undefined) {
            return Number(value.$numberLong) || 0;
        }
    }

    const number = Number(value);

    return Number.isFinite(number)
        ? number
        : 0;
}


/* =========================================================
   CURRENCY FORMATTER
   ========================================================= */

function formatCurrency(value) {

    const amount = toNumber(value);

    return "UGX " +
        amount.toLocaleString("en-UG", {
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        });
}


/* =========================================================
   DATE FORMATTER
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
   DATE + TIME FORMATTER
   ========================================================= */

function formatDateTime(value) {

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

        return date.toLocaleString(
            "en-UG",
            {
                day: "2-digit",
                month: "short",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit"
            }
        );

    } catch (error) {
        return "—";
    }
}


/* =========================================================
   INITIAL LETTER
   ========================================================= */

function getInitial(name) {

    if (!name) {
        return "A";
    }

    const cleanName =
        String(name).trim();

    if (!cleanName) {
        return "A";
    }

    return cleanName
        .charAt(0)
        .toUpperCase();
}


/* =========================================================
   STATUS CLASS
   ========================================================= */

function getStatusClass(status) {

    const value =
        String(status || "")
            .toLowerCase()
            .replace(/\s+/g, "-");

    if (
        value === "approved" ||
        value === "active" ||
        value === "completed" ||
        value === "success" ||
        value === "successful"
    ) {
        return "status-success";
    }

    if (
        value === "pending" ||
        value === "processing" ||
        value === "awaiting-payout"
    ) {
        return "status-pending";
    }

    if (
        value === "rejected" ||
        value === "failed" ||
        value === "blocked" ||
        value === "suspended" ||
        value === "disabled"
    ) {
        return "status-danger";
    }

    return "status-neutral";
}


/* =========================================================
   STATUS LABEL
   ========================================================= */

function formatStatus(status) {

    if (!status) {
        return "Unknown";
    }

    return String(status)
        .replace(/_/g, " ")
        .replace(/-/g, " ")
        .replace(/\b\w/g, letter =>
            letter.toUpperCase()
        );
}


/* =========================================================
   TRANSACTION ICON
   ========================================================= */

function transactionIcon(type) {

    const value =
        String(type || "")
            .toLowerCase();

    if (
        value.includes("deposit") ||
        value.includes("credit")
    ) {

        return `
            <svg viewBox="0 0 24 24"
                 aria-hidden="true">
                <path d="M12 3v12"/>
                <path d="M7 10l5 5 5-5"/>
                <path d="M5 21h14"/>
            </svg>
        `;
    }

    if (
        value.includes("withdraw") ||
        value.includes("debit")
    ) {

        return `
            <svg viewBox="0 0 24 24"
                 aria-hidden="true">
                <path d="M12 21V9"/>
                <path d="M7 14l5-5 5 5"/>
                <path d="M5 3h14"/>
            </svg>
        `;
    }

    if (
        value.includes("invest")
    ) {

        return `
            <svg viewBox="0 0 24 24"
                 aria-hidden="true">
                <path d="M4 19V9"/>
                <path d="M10 19V5"/>
                <path d="M16 19v-7"/>
                <path d="M22 19V3"/>
                <path d="M3 21h20"/>
            </svg>
        `;
    }

    if (
        value.includes("referral") ||
        value.includes("commission")
    ) {

        return `
            <svg viewBox="0 0 24 24"
                 aria-hidden="true">
                <circle cx="9" cy="7" r="3"/>
                <circle cx="17" cy="9" r="2.5"/>
                <path d="M3 20c0-3.2 2.5-5 6-5s6 1.8 6 5"/>
                <path d="M15 15c3.2.2 5 1.7 5 4.5"/>
            </svg>
        `;
    }

    return `
        <svg viewBox="0 0 24 24"
             aria-hidden="true">
            <rect x="4" y="5" width="16" height="14" rx="2"/>
            <path d="M8 9h8"/>
            <path d="M8 13h5"/>
        </svg>
    `;
}


/* =========================================================
   API REQUEST HELPER
   ========================================================= */

async function apiRequest(
    url,
    options = {}
) {

    const requestOptions = {
        credentials: "include",
        ...options,
        headers: {
            "Accept": "application/json",
            ...(options.headers || {})
        }
    };

    const response =
        await fetch(
            url,
            requestOptions
        );

    let data = null;

    try {
        data = await response.json();
    } catch (error) {
        data = null;
    }

    if (
        response.status === 401 ||
        response.status === 403
    ) {

        redirectToLogin();

        throw new Error(
            "Administrator authentication required."
        );
    }

    if (!response.ok) {

        throw new Error(
            data?.message ||
            `Request failed (${response.status}).`
        );
    }

    if (
        data &&
        data.success === false
    ) {

        throw new Error(
            data.message ||
            "Request failed."
        );
    }

    return data;
}


/* =========================================================
   REDIRECT TO LOGIN
   ========================================================= */

function redirectToLogin() {

    window.location.href =
        "login.html";
}


/* =========================================================
   ADMIN AUTHENTICATION
   ========================================================= */

async function verifyAdmin() {

    try {

        const data =
            await apiRequest(
                ADMIN_AUTH_API,
                {
                    method: "GET"
                }
            );

        if (
            data &&
            data.success === true &&
            data.authorized === true
        ) {

            return true;
        }

        redirectToLogin();

        return false;

    } catch (error) {

        console.error(
            "Admin authentication error:",
            error
        );

        redirectToLogin();

        return false;
    }
}


/* =========================================================
   LOAD ADMIN PROFILE
   ========================================================= */

async function loadAdminProfile() {

    try {

        const data =
            await apiRequest(
                PROFILE_API,
                {
                    method: "GET"
                }
            );

        if (
            !data ||
            data.success !== true ||
            !data.user
        ) {
            return;
        }

        const user =
            data.user;

        AdminDashboardState.profile =
            user;

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

        setText(
            "#adminName",
            fullName
        );

        setText(
            "#adminFirstName",
            firstName
        );

        setText(
            "#adminEmail",
            user.email || "—"
        );

        setText(
            "#headerUserName",
            firstName
        );

        setText(
            "#accountName",
            fullName
        );

        setText(
            "#adminAccountType",
            user.account_type ||
            user.role ||
            "Admin Account"
        );

        const initials =
            getInitial(fullName);

        const avatarElements = [
            "#accountAvatar",
            "#adminAvatar"
        ];

        avatarElements.forEach(
            selector => {

                const element =
                    $(selector);

                if (!element) {
                    return;
                }

                if (
                    element.tagName === "IMG"
                ) {

                    if (
                        element.dataset &&
                        element.dataset.defaultAvatar
                    ) {
                        return;
                    }

                    element.alt =
                        fullName;
                } else {

                    element.textContent =
                        initials;
                }
            }
        );

    } catch (error) {

        console.error(
            "Unable to load admin profile:",
            error
        );
    }
}


/* =========================================================
   FIND STAT VALUE
   ========================================================= */

function findStat(
    data,
    ...keys
) {

    for (const key of keys) {

        if (
            data &&
            data[key] !== undefined &&
            data[key] !== null
        ) {
            return data[key];
        }
    }

    return 0;
}


/* =========================================================
   LOAD DASHBOARD DATA
   ========================================================= */

async function loadDashboard() {

    if (AdminDashboardState.loading) {
        return;
    }

    AdminDashboardState.loading =
        true;

    try {

        const data =
            await apiRequest(
                ADMIN_DASHBOARD_API,
                {
                    method: "GET"
                }
            );

        if (
            !data ||
            data.success !== true
        ) {
            throw new Error(
                data?.message ||
                "Unable to load dashboard."
            );
        }

        AdminDashboardState.dashboard =
            data;

        renderDashboard(
            data
        );

    } catch (error) {

        console.error(
            "Dashboard loading error:",
            error
        );

        showDashboardError(
            error.message
        );

    } finally {

        AdminDashboardState.loading =
            false;
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

    /* -----------------------------
       USERS
       ----------------------------- */

    setText(
        "#totalUsers",
        toNumber(
            findStat(
                stats,
                "total_users",
                "users",
                "totalUsers"
            )
        ).toLocaleString()
    );

    setText(
        "#activeUsers",
        toNumber(
            findStat(
                stats,
                "active_users",
                "activeUsers"
            )
        ).toLocaleString()
    );


    /* -----------------------------
       DEPOSITS
       ----------------------------- */

    setText(
        "#totalDeposits",
        formatCurrency(
            findStat(
                stats,
                "total_deposits",
                "deposits",
                "deposit_total"
            )
        )
    );

    setText(
        "#pendingDeposits",
        formatCurrency(
            findStat(
                stats,
                "pending_deposits",
                "pendingDepositAmount"
            )
        )
    );


    /* -----------------------------
       WITHDRAWALS
       ----------------------------- */

    setText(
        "#totalWithdrawals",
        formatCurrency(
            findStat(
                stats,
                "total_withdrawals",
                "withdrawals",
                "withdrawal_total"
            )
        )
    );

    setText(
        "#pendingWithdrawals",
        formatCurrency(
            findStat(
                stats,
                "pending_withdrawals",
                "pendingWithdrawalAmount"
            )
        )
    );


    /* -----------------------------
       INVESTMENTS
       ----------------------------- */

    setText(
        "#totalInvestments",
        formatCurrency(
            findStat(
                stats,
                "total_investments",
                "investments",
                "investment_total"
            )
        )
    );

    setText(
        "#activeInvestments",
        toNumber(
            findStat(
                stats,
                "active_investments",
                "activeInvestments"
            )
        ).toLocaleString()
    );


    /* -----------------------------
       REFERRALS
       ----------------------------- */

    setText(
        "#totalReferrals",
        toNumber(
            findStat(
                stats,
                "total_referrals",
                "referrals",
                "totalReferrals"
            )
        ).toLocaleString()
    );


    /* -----------------------------
       TRANSACTIONS
       ----------------------------- */

    setText(
        "#totalTransactions",
        toNumber(
            findStat(
                stats,
                "total_transactions",
                "transactions",
                "totalTransactions"
            )
        ).toLocaleString()
    );


    /* -----------------------------
       SUPPORT
       ----------------------------- */

    setText(
        "#openTickets",
        toNumber(
            findStat(
                stats,
                "open_tickets",
                "openTickets"
            )
        ).toLocaleString()
    );


    /* -----------------------------
       RECENT DATA
       ----------------------------- */

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
}


/* =========================================================
   RECENT TRANSACTIONS
   ========================================================= */

function renderRecentTransactions(
    transactions
) {

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
                <div class="empty-state-icon">
                    <svg viewBox="0 0 24 24"
                         aria-hidden="true">
                        <rect x="4" y="5"
                              width="16"
                              height="14"
                              rx="2"/>
                        <path d="M8 9h8"/>
                        <path d="M8 13h5"/>
                    </svg>
                </div>

                <strong>No recent transactions</strong>

                <span>
                    New platform transactions
                    will appear here.
                </span>
            </div>
        `;

        return;
    }

    container.innerHTML =
        transactions
            .slice(0, 8)
            .map(transaction => {

                const type =
                    transaction.type ||
                    transaction.transaction_type ||
                    transaction.category ||
                    "Transaction";

                const status =
                    transaction.status ||
                    "pending";

                const amount =
                    transaction.amount ||
                    transaction.value ||
                    0;

                const name =
                    transaction.full_name ||
                    transaction.user_name ||
                    transaction.name ||
                    "Crown Cash User";

                const date =
                    transaction.created_at ||
                    transaction.date ||
                    transaction.timestamp;

                const amountClass =
                    String(type)
                        .toLowerCase()
                        .includes("withdraw")
                        ? "amount-negative"
                        : "amount-positive";

                return `
                    <div class="transaction-row">

                        <div class="transaction-icon">
                            ${transactionIcon(type)}
                        </div>

                        <div class="transaction-info">

                            <strong>
                                ${escapeHTML(type)}
                            </strong>

                            <span>
                                ${escapeHTML(name)}
                            </span>

                            <small>
                                ${escapeHTML(
                                    formatDateTime(date)
                                )}
                            </small>

                        </div>

                        <div class="transaction-value">

                            <strong class="${amountClass}">
                                ${formatCurrency(amount)}
                            </strong>

                            <span class="status-badge ${getStatusClass(status)}">
                                ${escapeHTML(
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

function renderRecentUsers(
    users
) {

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

                <div class="empty-state-icon">
                    <svg viewBox="0 0 24 24"
                         aria-hidden="true">
                        <circle cx="12"
                                cy="8"
                                r="3"/>
                        <path d="M5 21c0-4 3-6 7-6s7 2 7 6"/>
                    </svg>
                </div>

                <strong>No users yet</strong>

                <span>
                    Newly registered users
                    will appear here.
                </span>

            </div>
        `;

        return;
    }

    container.innerHTML =
        users
            .slice(0, 8)
            .map(user => {

                const fullName =
                    user.full_name ||
                    [
                        user.first_name,
                        user.last_name
                    ]
                        .filter(Boolean)
                        .join(" ") ||
                    "Crown Cash User";

                const status =
                    user.status ||
                    "active";

                const email =
                    user.email ||
                    "No email";

                const createdAt =
                    user.created_at ||
                    user.date;

                const initial =
                    getInitial(fullName);

                return `
                    <div class="user-row">

                        <div class="user-avatar-small">
                            ${escapeHTML(initial)}
                        </div>

                        <div class="user-info">

                            <strong>
                                ${escapeHTML(fullName)}
                            </strong>

                            <span>
                                ${escapeHTML(email)}
                            </span>

                            <small>
                                Joined
                                ${escapeHTML(
                                    formatDate(createdAt)
                                )}
                            </small>

                        </div>

                        <div class="user-status">

                            <span class="status