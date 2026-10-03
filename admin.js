/* =========================================================
   CROWN CASH — ADMIN PANEL
   Production Admin Controller

   INCLUDES:
   - Admin authentication
   - Profile
   - Dashboard statistics
   - Recent transactions
   - Recent users
   - Deposit management
   - Withdrawal management
   - Investment management
   - Approve / Reject actions
   - Maintenance controls
   - Earnings monitor
   - Logout
   - Mobile navigation
========================================================= */

"use strict";


/* =========================================================
   API CONFIGURATION
========================================================= */

const API_BASE =
    "https://crown-cash1.onrender.com";

const ADMIN_AUTH_API =
    `${API_BASE}/admin-auth.php`;

const PROFILE_API =
    `${API_BASE}/profile.php`;

const ADMIN_DASHBOARD_API =
    `${API_BASE}/admin-dashboard.php`;

const ADMIN_DEPOSITS_API =
    `${API_BASE}/admin_deposit.php`;

const ADMIN_WITHDRAWALS_API =
    `${API_BASE}/admin_withdrawal.php`;

const ADMIN_INVESTMENTS_API =
    `${API_BASE}/admin_investments.php`;

const ADMIN_MAINTENANCE_API =
    `${API_BASE}/admin-maintenance.php`;

const LOGOUT_API =
    `${API_BASE}/logout.php`;

const REQUEST_TIMEOUT = 20000;


/* =========================================================
   ADMIN STATE
========================================================= */

const AdminDashboard = {

    authenticated: false,

    authorized: false,

    loading: false,

    data: null,

    profile: null,

    deposits: [],

    withdrawals: [],

    investments: [],

    maintenance: {

        maintenance_mode: false,

        new_investments: true,

        deposits: true,

        withdrawals: true,

        daily_earnings: true,

        user_registration: true,

        maintenance_message: "",

        last_earnings_run: null,

        earnings_processed_today: 0
    },

    maintenanceMonitor: {

        active_investments: 0,

        pending_investments: 0,

        earnings_processed_today: 0
    },

    initialized: false
};


/* =========================================================
   DOM HELPERS
========================================================= */

function $(selector) {

    return document.querySelector(selector);
}


function $all(selector) {

    return Array.from(
        document.querySelectorAll(selector)
    );
}


/* =========================================================
   LOADING SCREEN
========================================================= */

function hideAdminLoader() {

    const selectors = [

        "#adminLoader",
        "#adminLoading",
        "#loadingScreen",
        "#loadingOverlay",
        "#pageLoader",
        "#adminPageLoader",
        ".admin-loader",
        ".admin-loading",
        ".admin-loading-screen",
        ".loading-screen",
        ".loading-overlay",
        ".page-loader",
        "[data-admin-loader]",
        "[data-loading-screen]"
    ];

    selectors.forEach(selector => {

        $all(selector).forEach(element => {

            element.style.display = "none";
            element.style.visibility = "hidden";
            element.style.opacity = "0";
            element.style.pointerEvents = "none";

            element.setAttribute(
                "aria-hidden",
                "true"
            );
        });
    });

    document.body.classList.remove(
        "loading",
        "is-loading",
        "admin-loading",
        "page-loading"
    );

    document.documentElement.classList.remove(
        "loading",
        "is-loading",
        "admin-loading",
        "page-loading"
    );
}


function forceHideAdminLoader() {

    hideAdminLoader();

    setTimeout(
        hideAdminLoader,
        100
    );

    setTimeout(
        hideAdminLoader,
        500
    );
}


/* =========================================================
   GENERAL HELPERS
========================================================= */

function escapeHtml(value) {

    if (
        value === null ||
        value === undefined
    ) {
        return "";
    }

    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


function formatCurrency(value) {

    const number =
        Number(value || 0);

    return `UGX ${number.toLocaleString(
        "en-UG",
        {
            maximumFractionDigits: 0
        }
    )}`;
}


function formatNumber(value) {

    const number =
        Number(value || 0);

    return number.toLocaleString(
        "en-UG",
        {
            maximumFractionDigits: 0
        }
    );
}


function formatDate(value) {

    if (!value) {
        return "Not available";
    }

    if (
        typeof value === "object" &&
        value !== null
    ) {

        if (value.$date) {
            value = value.$date;
        } else if (value.date) {
            value = value.date;
        } else if (value.timestamp) {
            value = value.timestamp;
        }
    }

    const date =
        new Date(value);

    if (
        Number.isNaN(
            date.getTime()
        )
    ) {
        return "Not available";
    }

    return date.toLocaleString(
        "en-UG",
        {
            year: "numeric",
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit"
        }
    );
}


function normalizeBoolean(
    value,
    fallback = false
) {

    if (
        value === true ||
        value === 1 ||
        value === "1" ||
        value === "true" ||
        value === "TRUE" ||
        value === "on"
    ) {
        return true;
    }

    if (
        value === false ||
        value === 0 ||
        value === "0" ||
        value === "false" ||
        value === "FALSE" ||
        value === "off"
    ) {
        return false;
    }

    return fallback;
}


function normalizeArray(data) {

    if (Array.isArray(data)) {
        return data;
    }

    if (
        Array.isArray(data?.data)
    ) {
        return data.data;
    }

    if (
        Array.isArray(data?.items)
    ) {
        return data.items;
    }

    if (
        Array.isArray(data?.results)
    ) {
        return data.results;
    }

    return [];
}


function getRecordId(record) {

    if (!record) {
        return "";
    }

    const id =
        record.id ??
        record._id ??
        record.deposit_id ??
        record.depositId ??
        record.withdrawal_id ??
        record.withdrawalId ??
        record.investment_id ??
        record.investmentId ??
        "";

    if (
        typeof id === "object" &&
        id !== null
    ) {

        return String(
            id.$oid ??
            id.oid ??
            ""
        );
    }

    return String(id);
}


function getCustomerName(record) {

    if (!record) {
        return "Unknown Customer";
    }

    const direct =
        record.user_name ||
        record.customer_name ||
        record.customerName ||
        record.name ||
        record.full_name ||
        record.fullName;

    if (direct) {
        return String(direct);
    }

    const first =
        record.first_name ||
        record.firstName ||
        "";

    const last =
        record.last_name ||
        record.lastName ||
        "";

    const combined =
        `${first} ${last}`.trim();

    if (combined) {
        return combined;
    }

    return (
        record.email ||
        "Unknown Customer"
    );
}


function getStatusClass(status) {

    const value =
        String(status || "")
            .toLowerCase();

    if (
        value === "approved" ||
        value === "completed" ||
        value === "active" ||
        value === "success" ||
        value === "successful"
    ) {
        return "approved";
    }

    if (
        value === "rejected" ||
        value === "failed" ||
        value === "cancelled" ||
        value === "canceled"
    ) {
        return "rejected";
    }

    return "pending";
}


/* =========================================================
   MESSAGE
========================================================= */

function showMessage(
    message,
    type = "success"
) {

    const existing =
        document.querySelector(
            ".admin-js-message"
        );

    if (existing) {
        existing.remove();
    }

    const box =
        document.createElement(
            "div"
        );

    box.className =
        `admin-js-message ${type}`;

    box.textContent =
        message;

    Object.assign(
        box.style,
        {
            position: "fixed",
            top: "20px",
            right: "20px",
            zIndex: "99999",
            maxWidth: "360px",
            padding: "13px 16px",
            borderRadius: "12px",
            background:
                type === "error"
                    ? "rgba(180,35,75,.96)"
                    : "rgba(28,115,75,.96)",
            color: "#fff",
            fontSize: "12px",
            fontWeight: "700",
            boxShadow:
                "0 12px 35px rgba(0,0,0,.30)"
        }
    );

    document.body.appendChild(box);

    setTimeout(
        () => {

            if (box.parentNode) {
                box.remove();
            }

        },
        4000
    );
}


/* =========================================================
   API REQUEST
========================================================= */

async function apiRequest(
    url,
    options = {},
    redirectOnAuth = false
) {

    const controller =
        new AbortController();

    const timeout =
        setTimeout(
            () => {
                controller.abort();
            },
            REQUEST_TIMEOUT
        );

    try {

        const response =
            await fetch(
                url,
                {
                    ...options,

                    credentials:
                        "include",

                    headers: {

                        "Accept":
                            "application/json",

                        ...(options.body
                            ? {
                                "Content-Type":
                                    "application/json"
                            }
                            : {}),

                        ...(options.headers || {})
                    },

                    signal:
                        controller.signal
                }
            );

        const text =
            await response.text();

        let data = null;

        try {

            data =
                text
                    ? JSON.parse(text)
                    : null;

        } catch {

            data = {

                success: false,

                message:
                    text ||
                    `HTTP ${response.status}`
            };
        }

        if (
            response.status === 401 ||
            response.status === 403
        ) {

            if (redirectOnAuth) {

                window.location.href =
                    "login.html";

                return null;
            }

            throw new Error(
                data?.message ||
                "Administrator authentication required."
            );
        }

        if (!response.ok) {

            throw new Error(
                data?.message ||
                data?.error ||
                `Request failed (${response.status})`
            );
        }

        return data;

    } catch (error) {

        if (
            error?.name === "AbortError"
        ) {

            throw new Error(
                "Request timed out. Please try again."
            );
        }

        throw error;

    } finally {

        clearTimeout(timeout);
    }
}


/* =========================================================
   AUTHENTICATE ADMIN
========================================================= */

async function authenticateAdmin() {

    try {

        const response =
            await apiRequest(
                ADMIN_AUTH_API,
                {
                    method: "GET"
                },
                false
            );

        if (!response) {
            return false;
        }

        const authenticated =
            normalizeBoolean(
                response.authenticated ??
                response.logged_in ??
                response.loggedIn ??
                response.success,
                false
            );

        const authorized =
            normalizeBoolean(
                response.authorized ??
                response.is_admin ??
                response.isAdmin ??
                response.admin,
                false
            );

        AdminDashboard.authenticated =
            authenticated;

        AdminDashboard.authorized =
            authorized;

        if (
            !authenticated ||
            !authorized
        ) {

            console.warn(
                "Admin access denied.",
                {
                    authenticated,
                    authorized
                }
            );

            window.location.href =
                "login.html";

            return false;
        }

        return true;

    } catch (error) {

        console.error(
            "Admin authentication error:",
            error
        );

        forceHideAdminLoader();

        showMessage(
            error.message ||
            "Unable to verify administrator access.",
            "error"
        );

        setTimeout(
            () => {
                window.location.href =
                    "login.html";
            },
            1200
        );

        return false;
    }
}


/* =========================================================
   PROFILE
========================================================= */

async function loadProfile() {

    try {

        const response =
            await apiRequest(
                PROFILE_API,
                {
                    method: "GET"
                },
                false
            );

        if (!response) {
            return null;
        }

        const profile =
            response.user ||
            response.profile ||
            response.data ||
            response;

        AdminDashboard.profile =
            profile;

        renderProfile(profile);

        return profile;

    } catch (error) {

        console.warn(
            "Unable to load profile:",
            error
        );

        return null;
    }
}


function renderProfile(profile) {

    if (!profile) {
        return;
    }

    const name =
        profile.name ||
        profile.full_name ||
        profile.fullName ||
        [
            profile.first_name,
            profile.last_name
        ]
            .filter(Boolean)
            .join(" ") ||
        profile.username ||
        profile.email ||
        "Administrator";

    const email =
        profile.email ||
        "";

    const role =
        profile.role ||
        profile.user_role ||
        profile.account_type ||
        "Administrator";

    $all(
        "#adminName, #welcomeName, #profileName, [data-admin-name]"
    )
        .forEach(
            element => {
                element.textContent =
                    name;
            }
        );

    $all(
        "#adminEmail, #profileEmail, [data-admin-email]"
    )
        .forEach(
            element => {
                element.textContent =
                    email;
            }
        );

    $all(
        "#adminRole, #profileRole, [data-admin-role]"
    )
        .forEach(
            element => {
                element.textContent =
                    role;
            }
        );
}


/* =========================================================
   DASHBOARD
========================================================= */

async function loadAdminDashboard() {

    try {

        const response =
            await apiRequest(
                ADMIN_DASHBOARD_API,
                {
                    method: "GET"
                },
                false
            );

        if (!response) {
            return null;
        }

        const data =
            response.data ||
            response.dashboard ||
            response;

        AdminDashboard.data =
            data;

        renderDashboardStats(data);

        renderRecentTransactions(data);

        renderRecentUsers(data);

        return data;

    } catch (error) {

        console.error(
            "Admin dashboard error:",
            error
        );

        return null;
    }
}


function renderDashboardStats(data) {

    if (!data) {
        return;
    }

    const stats =
        data.stats ||
        data.statistics ||
        data.summary ||
        data;

    const mapping = {

        totalUsers:
            [
                stats.total_users,
                stats.totalUsers,
                stats.users
            ],

        totalDeposits:
            [
                stats.total_deposits,
                stats.totalDeposits
            ],

        totalWithdrawals:
            [
                stats.total_withdrawals,
                stats.totalWithdrawals
            ],

        totalInvestments:
            [
                stats.total_investments,
                stats.totalInvestments
            ],

        pendingDeposits:
            [
                stats.pending_deposits,
                stats.pendingDeposits
            ],

        pendingWithdrawals:
            [
                stats.pending_withdrawals,
                stats.pendingWithdrawals
            ],

        pendingInvestments:
            [
                stats.pending_investments,
                stats.pendingInvestments
            ],

        activeInvestments:
            [
                stats.active_investments,
                stats.activeInvestments
            ],

        totalBalance:
            [
                stats.total_balance,
                stats.totalBalance
            ],

        totalEarnings:
            [
                stats.total_earnings,
                stats.totalEarnings
            ]
    };

    Object.entries(mapping)
        .forEach(
            ([key, values]) => {

                const value =
                    values.find(
                        item =>
                            item !== undefined &&
                            item !== null
                    );

                if (
                    value === undefined
                ) {
                    return;
                }

                $all(
                    `[data-stat="${key}"], #${key}`
                )
                    .forEach(
                        element => {

                            if (
                                key.includes("Balance") ||
                                key.includes("Deposits") ||
                                key.includes("Withdrawals") ||
                                key.includes("Investments") ||
                                key.includes("Earnings")
                            ) {

                                if (
                                    typeof value === "number" ||
                                    !Number.isNaN(
                                        Number(value)
                                    )
                                ) {

                                    element.textContent =
                                        key === "totalBalance" ||
                                        key === "totalEarnings"
                                            ? formatCurrency(value)
                                            : formatNumber(value);

                                } else {

                                    element.textContent =
                                        value;
                                }

                            } else {

                                element.textContent =
                                    formatNumber(value);
                            }
                        }
                    );
            }
        );

    renderPendingActions(stats);
}


function renderPendingActions(stats) {

    const pendingDeposits =
        Number(
            stats.pending_deposits ??
            stats.pendingDeposits ??
            0
        );

    const pendingWithdrawals =
        Number(
            stats.pending_withdrawals ??
            stats.pendingWithdrawals ??
            0
        );

    const pendingInvestments =
        Number(
            stats.pending_investments ??
            stats.pendingInvestments ??
            0
        );

    const total =
        pendingDeposits +
        pendingWithdrawals +
        pendingInvestments;

    $all(
        "#pendingActionsCount, [data-stat='pendingActions']"
    )
        .forEach(
            element => {
                element.textContent =
                    formatNumber(total);
            }
        );

    $all(
        "#pendingDeposits, [data-pending='deposits']"
    )
        .forEach(
            element => {
                element.textContent =
                    formatNumber(
                        pendingDeposits
                    );
            }
        );

    $all(
        "#pendingWithdrawals, [data-pending='withdrawals']"
    )
        .forEach(
            element => {
                element.textContent =
                    formatNumber(
                        pendingWithdrawals
                    );
            }
        );

    $all(
        "#pendingInvestments, [data-pending='investments']"
    )
        .forEach(
            element => {
                element.textContent =
                    formatNumber(
                        pendingInvestments
                    );
            }
        );
}


/* =========================================================
   RECENT TRANSACTIONS
========================================================= */

function renderRecentTransactions(data) {

    const container =
        $("#recentTransactions");

    if (!container) {
        return;
    }

    const transactions =
        data.transactions ||
        data.recent_transactions ||
        data.recentTransactions ||
        [];

    if (
        !Array.isArray(transactions) ||
        transactions.length === 0
    ) {

        container.innerHTML =
            `<div class="empty-state">
                No recent transactions found.
            </div>`;

        return;
    }

    container.innerHTML =
        transactions
            .slice(0, 10)
            .map(
                transaction => {

                    const type =
                        transaction.type ||
                        transaction.transaction_type ||
                        "Transaction";

                    const amount =
                        Number(
                            transaction.amount || 0
                        );

                    const status =
                        transaction.status ||
                        "pending";

                    const date =
                        transaction.created_at ||
                        transaction.createdAt ||
                        transaction.date ||
                        transaction.timestamp ||
                        transaction.created ||
                        transaction.updated_at ||
                        transaction.updatedAt;

                    return `
                        <div class="transaction-row">

                            <div class="transaction-info">

                                <strong>
                                    ${escapeHtml(type)}
                                </strong>

                                <span>
                                    ${escapeHtml(
                                        formatDate(date)
                                    )}
                                </span>

                            </div>

                            <div class="transaction-amount">

                                <strong>
                                    ${formatCurrency(amount)}
                                </strong>

                                <span>
                                    ${escapeHtml(status)}
                                </span>

                            </div>

                        </div>
                    `;
                }
            )
            .join("");
}


/* =========================================================
   RECENT USERS
========================================================= */

function renderRecentUsers(data) {

    const container =
        $("#recentUsers");

    if (!container) {
        return;
    }

    const users =
        data.users ||
        data.recent_users ||
        data.recentUsers ||
        [];

    if (
        !Array.isArray(users) ||
        users.length === 0
    ) {

        container.innerHTML =
            `<div class="empty-state">
                No recent users found.
            </div>`;

        return;
    }

    container.innerHTML =
        users
            .slice(0, 10)
            .map(
                user => {

                    const name =
                        user.name ||
                        user.full_name ||
                        user.fullName ||
                        user.username ||
                        user.email ||
                        "User";

                    const email =
                        user.email ||
                        "";

                    const status =
                        user.status ||
                        "active";

                    return `
                        <div class="user-row">

                            <div class="user-info">

                                <strong>
                                    ${escapeHtml(name)}
                                </strong>

                                <span>
                                    ${escapeHtml(email)}
                                </span>

                            </div>

                            <span class="user-status">
                                ${escapeHtml(status)}
                            </span>

                        </div>
                    `;
                }
            )
            .join("");
}


/* =========================================================
   MANAGEMENT SECTION FINDER
========================================================= */

function findManagementContainer(
    type
) {

    const selectors = {

        deposits: [
            "#deposits",
            "#depositManagement",
            "#deposit-management",
            "[data-section='deposits']",
            "[data-management='deposits']"
        ],

        withdrawals: [
            "#withdrawals",
            "#withdrawalManagement",
            "#withdrawal-management",
            "[data-section='withdrawals']",
            "[data-management='withdrawals']"
        ],

        investments: [
            "#investments",
            "#investmentManagement",
            "#investment-management",
            "[data-section='investments']",
            "[data-management='investments']"
        ]
    };

    const list =
        selectors[type] || [];

    for (
        const selector of list
    ) {

        const element =
            $(selector);

        if (element) {
            return element;
        }
    }

    return null;
}


/* =========================================================
   MANAGEMENT STYLE
========================================================= */

function injectManagementStyles() {

    if (
        document.getElementById(
            "crownCashManagementStyles"
        )
    ) {
        return;
    }

    const style =
        document.createElement("style");

    style.id =
        "crownCashManagementStyles";

    style.textContent = `

        .cc-management-wrapper {
            width: 100%;
            margin-top: 18px;
        }

        .cc-management-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            gap: 12px;
            margin-bottom: 15px;
            flex-wrap: wrap;
        }

        .cc-management-title {
            font-size: 18px;
            font-weight: 800;
        }

        .cc-management-count {
            font-size: 12px;
            opacity: .7;
        }

        .cc-management-table-wrap {
            width: 100%;
            overflow-x: auto;
            border-radius: 14px;
        }

        .cc-management-table {
            width: 100%;
            border-collapse: collapse;
            min-width: 850px;
        }

        .cc-management-table th,
        .cc-management-table td {
            padding: 12px 10px;
            text-align: left;
            border-bottom: 1px solid rgba(255,255,255,.08);
            font-size: 12px;
            vertical-align: middle;
        }

        .cc-management-table th {
            font-size: 11px;
            text-transform: uppercase;
            letter-spacing: .04em;
            opacity: .65;
        }

        .cc-customer {
            display: flex;
            flex-direction: column;
            gap: 3px;
        }

        .cc-customer strong {
            font-size: 12px;
        }

        .cc-customer span {
            font-size: 10px;
            opacity: .6;
        }

        .cc-status {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            padding: 5px 9px;
            border-radius: 999px;
            font-size: 10px;
            font-weight: 800;
            text-transform: capitalize;
        }

        .cc-status.pending {
            background: rgba(255,193,7,.12);
            color: #ffd05a;
        }

        .cc-status.approved {
            background: rgba(72,210,125,.12);
            color: #72dda0;
        }

        .cc-status.rejected {
            background: rgba(255,80,110,.12);
            color: #ff809c;
        }

        .cc-actions {
            display: flex;
            gap: 7px;
            flex-wrap: wrap;
        }

        .cc-action-btn {
            border: 0;
            border-radius: 8px;
            padding: 7px 11px;
            cursor: pointer;
            font-size: 10px;
            font-weight: 800;
            color: #fff;
        }

        .cc-action-btn:disabled {
            opacity: .5;
            cursor: not-allowed;
        }

        .cc-approve {
            background: #197a4d;
        }

        .cc-reject {
            background: #a82d4f;
        }

        .cc-refresh {
            border: 1px solid rgba(255,255,255,.12);
            background: rgba(255,255,255,.05);
            color: #fff;
            border-radius: 8px;
            padding: 7px 12px;
            cursor: pointer;
            font-size: 10px;
            font-weight: 700;
        }

        .cc-empty {
            padding: 25px;
            text-align: center;
            opacity: .6;
            font-size: 12px;
        }

        .cc-loading {
            padding: 25px;
            text-align: center;
            opacity: .7;
            font-size: 12px;
        }

        @media (max-width: 700px) {

            .cc-management-table {
                min-width: 760px;
            }
        }
    `;

    document.head.appendChild(style);
}


/* =========================================================
   LOAD DEPOSITS
========================================================= */

async function loadDeposits() {

    const container =
        findManagementContainer(
            "deposits"
        );

    if (!container) {
        return [];
    }

    const management =
        ensureManagementArea(
            container,
            "deposits"
        );

    if (!management) {
        return [];
    }

    management.body.innerHTML =
        `<div class="cc-loading">
            Loading deposits...
        </div>`;

    try {

        const response =
            await apiRequest(
                ADMIN_DEPOSITS_API,
                {
                    method: "GET"
                },
                false
            );

        const deposits =
            normalizeArray(
                response?.deposits ??
                response?.data ??
                response?.items ??
                response
            );

        AdminDashboard.deposits =
            deposits;

        renderDeposits(
            management.body,
            deposits
        );

        return deposits;

    } catch (error) {

        console.error(
            "Load deposits error:",
            error
        );

        management.body.innerHTML =
            `<div class="cc-empty">
                Unable to load deposits.
                <br>
                <small>${escapeHtml(
                    error.message
                )}</small>
            </div>`;

        return [];
    }
}


/* =========================================================
   RENDER DEPOSITS
========================================================= */

function renderDeposits(
    container,
    deposits
) {

    if (
        !Array.isArray(deposits) ||
        deposits.length === 0
    ) {

        container.innerHTML =
            `<div class="cc-empty">
                No deposit requests found.
            </div>`;

        return;
    }

    container.innerHTML = `

        <div class="cc-management-table-wrap">

            <table class="cc-management-table">

                <thead>

                    <tr>
                        <th>Customer</th>
                        <th>Amount</th>
                        <th>Method</th>
                        <th>Reference</th>
                        <th>Status</th>
                        <th>Date</th>
                        <th>Action</th>
                    </tr>

                </thead>

                <tbody>

                    ${deposits.map(
                        deposit => {

                            const id =
                                getRecordId(
                                    deposit
                                );

                            const status =
                                deposit.status ||
                                "pending";

                            const method =
                                deposit.payment_method ||
                                deposit.paymentMethod ||
                                "-";

                            const reference =
                                deposit.transaction_reference ||
                                deposit.transactionReference ||
                                "-";

                            return `

                                <tr>

                                    <td>

                                        <div class="cc-customer">

                                            <strong>
                                                ${escapeHtml(
                                                    getCustomerName(
                                                        deposit
                                                    )
                                                )}
                                            </strong>

                                            <span>
                                                ${escapeHtml(
                                                    deposit.email ||
                                                    deposit.phone ||
                                                    ""
                                                )}
                                            </span>

                                        </div>

                                    </td>

                                    <td>
                                        <strong>
                                            ${formatCurrency(
                                                deposit.amount
                                            )}
                                        </strong>
                                    </td>

                                    <td>
                                        ${escapeHtml(
                                            method
                                        )}
                                    </td>

                                    <td>
                                        ${escapeHtml(
                                            reference
                                        )}
                                    </td>

                                    <td>

                                        <span class="cc-status ${getStatusClass(status)}">
                                            ${escapeHtml(
                                                status
                                            )}
                                        </span>

                                    </td>

                                    <td>
                                        ${escapeHtml(
                                            formatDate(
                                                deposit.created_at ||
                                                deposit.createdAt ||
                                                deposit.date
                                            )
                                        )}
                                    </td>

                                    <td>

                                        ${renderActionButtons(
                                            "deposit",
                                            id,
                                            status
                                        )}

                                    </td>

                                </tr>

                            `;
                        }
                    ).join("")}

                </tbody>

            </table>

        </div>
    `;
}


/* =========================================================
   LOAD WITHDRAWALS
========================================================= */

async function loadWithdrawals() {

    const container =
        findManagementContainer(
            "withdrawals"
        );

    if (!container) {
        return [];
    }

    const management =
        ensureManagementArea(
            container,
            "withdrawals"
        );

    if (!management) {
        return [];
    }

    management.body.innerHTML =
        `<div class="cc-loading">
            Loading withdrawals...
        </div>`;

    try {

        const response =
            await apiRequest(
                ADMIN_WITHDRAWALS_API,
                {
                    method: "GET"
                },
                false
            );

        const withdrawals =
            normalizeArray(
                response?.withdrawals ??
                response?.data ??
                response?.items ??
                response
            );

        AdminDashboard.withdrawals =
            withdrawals;

        renderWithdrawals(
            management.body,
            withdrawals
        );

        return withdrawals;

    } catch (error) {

        console.error(
            "Load withdrawals error:",
            error
        );

        management.body.innerHTML =
            `<div class="cc-empty">
                Unable to load withdrawals.
                <br>
                <small>${escapeHtml(
                    error.message
                )}</small>
            </div>`;

        return [];
    }
}


/* =========================================================
   RENDER WITHDRAWALS
========================================================= */

function renderWithdrawals(
    container,
    withdrawals
) {

    if (
        !Array.isArray(withdrawals) ||
        withdrawals.length === 0
    ) {

        container.innerHTML =
            `<div class="cc-empty">
                No withdrawal requests found.
            </div>`;

        return;
    }

    container.innerHTML = `

        <div class="cc-management-table-wrap">

            <table class="cc-management-table">

                <thead>

                    <tr>
                        <th>Customer</th>
                        <th>Amount</th>
                        <th>Method</th>
                        <th>Reference</th>
                        <th>Status</th>
                        <th>Date</th>
                        <th>Action</th>
                    </tr>

                </thead>

                <tbody>

                    ${withdrawals.map(
                        withdrawal => {

                            const id =
                                getRecordId(
                                    withdrawal
                                );

                            const status =
                                withdrawal.status ||
                                "pending";

                            const method =
                                withdrawal.payment_method ||
                                withdrawal.paymentMethod ||
                                withdrawal.method ||
                                "-";

                            const reference =
                                withdrawal.transaction_reference ||
                                withdrawal.transactionReference ||
                                withdrawal.reference ||
                                "-";

                            const userId =
                                withdrawal.user_id ||
                                withdrawal.userId ||
                                "";

                            return `

                                <tr>

                                    <td>

                                        <div class="cc-customer">

                                            <strong>
                                                ${escapeHtml(
                                                    getCustomerName(
                                                        withdrawal
                                                    )
                                                )}
                                            </strong>

                                            <span>
                                                ${escapeHtml(
                                                    withdrawal.email ||
                                                    withdrawal.phone ||
                                                    ""
                                                )}
                                            </span>

                                        </div>

                                    </td>

                                    <td>
                                        <strong>
                                            ${formatCurrency(
                                                withdrawal.amount
                                            )}
                                        </strong>
                                    </td>

                                    <td>
                                        ${escapeHtml(
                                            method
                                        )}
                                    </td>

                                    <td>
                                        ${escapeHtml(
                                            reference
                                        )}
                                    </td>

                                    <td>

                                        <span class="cc-status ${getStatusClass(status)}">
                                            ${escapeHtml(
                                                status
                                            )}
                                        </span>

                                    </td>

                                    <td>
                                        ${escapeHtml(
                                            formatDate(
                                                withdrawal.created_at ||
                                                withdrawal.createdAt ||
                                                withdrawal.date
                                            )
                                        )}
                                    </td>

                                    <td>

                                        ${renderActionButtons(
                                            "withdrawal",
                                            id,
                                            status,
                                            userId
                                        )}

                                    </td>

                                </tr>

                            `;
                        }
                    ).join("")}

                </tbody>

            </table>

        </div>
    `;
}


/* =========================================================
   LOAD INVESTMENTS
========================================================= */

async function loadInvestments() {

    const container =
        findManagementContainer(
            "investments"
        );

    if (!container) {
        return [];
    }

    const management =
        ensureManagementArea(
            container,
            "investments"
        );

    if (!management) {
        return [];
    }

    management.body.innerHTML =
        `<div class="cc-loading">
            Loading investments...
        </div>`;

    try {

        const response =
            await apiRequest(
                ADMIN_INVESTMENTS_API,
                {
                    method: "GET"
                },
                false
            );

        const investments =
            normalizeArray(
                response?.investments ??
                response?.data ??
                response?.items ??
                response
            );

        AdminDashboard.investments =
            investments;

        renderInvestments(
            management.body,
            investments
        );

        return investments;

    } catch (error) {

        console.error(
            "Load investments error:",
            error
        );

        management.body.innerHTML =
            `<div class="cc-empty">
                Unable to load investments.
                <br>
                <small>${escapeHtml(
                    error.message
                )}</small>
            </div>`;

        return [];
    }
}


/* =========================================================
   RENDER INVESTMENTS
========================================================= */

function renderInvestments(
    container,
    investments
) {

    if (
        !Array.isArray(investments) ||
        investments.length === 0
    ) {

        container.innerHTML =
            `<div class="cc-empty">
                No investment requests found.
            </div>`;

        return;
    }

    container.innerHTML = `

        <div class="cc-management-table-wrap">

            <table class="cc-management-table">

                <thead>

                    <tr>
                        <th>Customer</th>
                        <th>Plan</th>
                        <th>Amount</th>
                        <th>Duration</th>
                        <th>Status</th>
                        <th>Date</th>
                        <th>Action</th>
                    </tr>

                </thead>

                <tbody>

                    ${investments.map(
                        investment => {

                            const id =
                                getRecordId(
                                    investment
                                );

                            const status =
                                investment.status ||
                                "pending";

                            const plan =
                                investment.plan_name ||
                                investment.planName ||
                                investment.plan ||
                                investment.package ||
                                "Investment";

                            const duration =
                                investment.duration_days ??
                                investment.duration ??
                                30;

                            return `

                                <tr>

                                    <td>

                                        <div class="cc-customer">

                                            <strong>
                                                ${escapeHtml(
                                                    getCustomerName(
                                                        investment
                                                    )
                                                )}
                                            </strong>

                                            <span>
                                                ${escapeHtml(
                                                    investment.email ||
                                                    ""
                                                )}
                                            </span>

                                        </div>

                                    </td>

                                    <td>
                                        ${escapeHtml(
                                            plan
                                        )}
                                    </td>

                                    <td>
                                        <strong>
                                            ${formatCurrency(
                                                investment.amount
                                            )}
                                        </strong>
                                    </td>

                                    <td>
                                        ${escapeHtml(
                                            String(duration)
                                        )} days
                                    </td>

                                    <td>

                                        <span class="cc-status ${getStatusClass(status)}">
                                            ${escapeHtml(
                                                status
                                            )}
                                        </span>

                                    </td>

                                    <td>
                                        ${escapeHtml(
                                            formatDate(
                                                investment.created_at ||
                                                investment.createdAt ||
                                                investment.date
                                            )
                                        )}
                                    </td>

                                    <td>

                                        ${renderActionButtons(
                                            "investment",
                                            id,
                                            status
                                        )}

                                    </td>

                                </tr>

                            `;
                        }
                    ).join("")}

                </tbody>

            </table>

        </div>
    `;
}


/* =========================================================
   ENSURE MANAGEMENT AREA
========================================================= */

function ensureManagementArea(
    container,
    type
) {

    injectManagementStyles();

    let wrapper =
        container.querySelector(
            ".cc-management-wrapper"
        );

    if (!wrapper) {

        wrapper =
            document.createElement(
                "div"
            );

        wrapper.className =
            "cc-management-wrapper";

        wrapper.innerHTML = `

            <div class="cc-management-header">

                <div>

                    <div class="cc-management-title">
                        ${type.charAt(0).toUpperCase() + type.slice(1)}
                        Management
                    </div>

                    <div class="cc-management-count"
                         data-management-count="${type}">
                        Loading...
                    </div>

                </div>

                <button
                    type="button"
                    class="cc-refresh"
                    data-management-refresh="${type}">
                    Refresh
                </button>

            </div>

            <div
                class="cc-management-body"
                data-management-body="${type}">
            </div>
        `;

        container.appendChild(
            wrapper
        );
    }

    const body =
        wrapper.querySelector(
            ".cc-management-body"
        );

    const count =
        wrapper.querySelector(
            `[data-management-count="${type}"]`
        );

    const refresh =
        wrapper.querySelector(
            `[data-management-refresh="${type}"]`
        );

    if (
        refresh &&
        !refresh.dataset.bound
    ) {

        refresh.dataset.bound =
            "1";

        refresh.addEventListener(
            "click",
            () => {

                if (
                    type === "deposits"
                ) {
                    loadDeposits();
                }

                if (
                    type === "withdrawals"
                ) {
                    loadWithdrawals();
                }

                if (
                    type === "investments"
                ) {
                    loadInvestments();
                }
            }
        );
    }

    if (count) {

        let length = 0;

        if (
            type === "deposits"
        ) {
            length =
                AdminDashboard.deposits.length;
        }

        if (
            type === "withdrawals"
        ) {
            length =
                AdminDashboard.withdrawals.length;
        }

        if (
            type === "investments"
        ) {
            length =
                AdminDashboard.investments.length;
        }

        count.textContent =
            `${formatNumber(length)} request${length === 1 ? "" : "s"}`;
    }

    return {
        wrapper,
        body,
        count,
        refresh
    };
}


/* =========================================================
   ACTION BUTTONS
========================================================= */

function renderActionButtons(
    type,
    id,
    status,
    userId = ""
) {

    const normalized =
        String(status || "")
            .toLowerCase();

    const pending =
        [
            "pending",
            "submitted",
            "processing"
        ].includes(
            normalized
        );

    if (!pending) {

        return `
            <span class="cc-status ${getStatusClass(status)}">
                ${escapeHtml(status)}
            </span>
        `;
    }

    const safeId =
        escapeHtml(id);

    const safeUserId =
        escapeHtml(userId);

    return `

        <div class="cc-actions">

            <button
                type="button"
                class="cc-action-btn cc-approve"
                data-cc-action="approve"
                data-cc-type="${escapeHtml(type)}"
                data-cc-id="${safeId}"
                data-cc-user-id="${safeUserId}">
                Approve
            </button>

            <button
                type="button"
                class="cc-action-btn cc-reject"
                data-cc-action="reject"
                data-cc-type="${escapeHtml(type)}"
                data-cc-id="${safeId}"
                data-cc-user-id="${safeUserId}">
                Reject
            </button>

        </div>
    `;
}


/* =========================================================
   MANAGEMENT ACTION EVENT DELEGATION
========================================================= */

function setupManagementActions() {

    if (
        document.body.dataset.ccManagementActions
        === "1"
    ) {
        return;
    }

    document.body.dataset.ccManagementActions =
        "1";

    document.addEventListener(
        "click",
        async event => {

            const button =
                event.target.closest(
                    "[data-cc-action]"
                );

            if (!button) {
                return;
            }

            event.preventDefault();

            if (
                button.disabled
            ) {
                return;
            }

            const action =
                button.dataset.ccAction;

            const type =
                button.dataset.ccType;

            const id =
                button.dataset.ccId;

            const userId =
                button.dataset.ccUserId ||
                "";

            if (
                !id ||
                !type
            ) {
                return;
            }


            /* -------------------------------------------------
               CONFIRM APPROVAL
            ------------------------------------------------- */

            if (
                action === "approve"
            ) {

                const confirmed =
                    window.confirm(
                        `Are you sure you want to approve this ${type}?`
                    );

                if (!confirmed) {
                    return;
                }
            }


            /* -------------------------------------------------
               REJECTION REASON
            ------------------------------------------------- */

            let note = "";

            if (
                action === "reject"
            ) {

                note =
                    window.prompt(
                        `Enter a reason for rejecting this ${type}:`,
                        ""
                    );

                if (
                    note === null
                ) {
                    return;
                }

                note =
                    note.trim();

                if (!note) {

                    note =
                        "Rejected by administrator.";
                }
            }


            button.disabled =
                true;

            const originalText =
                button.textContent;

            button.textContent =
                action === "approve"
                    ? "Approving..."
                    : "Rejecting...";


            try {

                let response = null;

                if (
                    type === "deposit"
                ) {

                    response =
                        await processDepositAction(
                            id,
                            action,
                            note
                        );
                }

                if (
                    type === "withdrawal"
                ) {

                    response =
                        await processWithdrawalAction(
                            id,
                            userId,
                            action,
                            note
                        );
                }

                if (
                    type === "investment"
                ) {

                    response =
                        await processInvestmentAction(
                            id,
                            action,
                            note
                        );
                }

                if (!response) {
                    return;
                }

                /*
                 * Refresh the affected management
                 * section immediately.
                 */

                if (
                    type === "deposit"
                ) {
                    await loadDeposits();
                }

                if (
                    type === "withdrawal"
                ) {
                    await loadWithdrawals();
                }

                if (
                    type === "investment"
                ) {
                    await loadInvestments();
                }

                /*
                 * Refresh dashboard numbers.
                 */

                await loadAdminDashboard();

            } finally {

                button.disabled =
                    false;

                button.textContent =
                    originalText;
            }
        }
    );
}


/* =========================================================
   DEPOSIT ACTION
========================================================= */

async function processDepositAction(
    depositId,
    action,
    note = ""
) {

    return processAdminAction(
        ADMIN_DEPOSITS_API,
        {
            deposit_id:
                depositId,

            depositId:
                depositId,

            id:
                depositId,

            action,

            reason:
                note,

            rejection_reason:
                note,

            status:
                action === "approve"
                    ? "approved"
                    : action === "reject"
                        ? "rejected"
                        : action
        },
        `Deposit ${action === "approve" ? "approved" : "rejected"} successfully.`
    );
}


/* =========================================================
   WITHDRAWAL ACTION
========================================================= */

async function processWithdrawalAction(
    withdrawalId,
    userId,
    action,
    note = ""
) {

    return processAdminAction(
        ADMIN_WITHDRAWALS_API,
        {
            withdrawal_id:
                withdrawalId,

            withdrawalId:
                withdrawalId,

            id:
                withdrawalId,

            user_id:
                userId,

            userId,

            action,

            reason:
                note,

            rejection_reason:
                note,

            note,

            status:
                action === "approve"
                    ? "approved"
                    : action === "reject"
                        ? "rejected"
                        : action
        },
        `Withdrawal ${action === "approve" ? "approved" : "rejected"} successfully.`
    );
}


/* =========================================================
   INVESTMENT ACTION
========================================================= */

async function processInvestmentAction(
    investmentId,
    action,
    note = ""
) {

    return processAdminAction(
        ADMIN_INVESTMENTS_API,
        {
            investment_id:
                investmentId,

            investmentId:
                investmentId,

            id:
                investmentId,

            action,

            reason:
                note,

            rejection_reason:
                note,

            note,

            status:
                action === "approve"
                    ? "approved"
                    : action === "reject"
                        ? "rejected"
                        : action
        },
        `Investment ${action === "approve" ? "approved" : "rejected"} successfully.`
    );
}


/* =========================================================
   GENERIC ADMIN ACTION
========================================================= */

async function processAdminAction(
    endpoint,
    payload,
    successMessage
) {

    try {

        const response =
            await apiRequest(
                endpoint,
                {
                    method: "POST",

                    body:
                        JSON.stringify(
                            payload
                        )
                },
                false
            );

        if (!response) {
            return null;
        }

        showMessage(
            response.message ||
            successMessage ||
            "Action completed successfully."
        );

        return response;

    } catch (error) {

        console.error(
            "Admin action failed:",
            error
        );

        showMessage(
            error.message ||
            "Unable to complete administrator action.",
            "error"
        );

        return null;
    }
}


/* =========================================================
   LOAD ALL MANAGEMENT DATA
========================================================= */

async function loadManagementData() {

    await Promise.allSettled([

        loadDeposits(),

        loadWithdrawals(),

        loadInvestments()

    ]);
}


/* =========================================================
   MAINTENANCE
========================================================= */

async function loadMaintenanceSettings() {

    try {

        const response =
            await apiRequest(
                ADMIN_MAINTENANCE_API,
                {
                    method: "GET"
                },
                false
            );

        if (!response) {
            return null;
        }

        const settings =
            response.settings ||
            response.data ||
            response;

        const monitor =
            response.monitor ||
            response.earnings_monitor ||
            {};

        AdminDashboard.maintenance = {

            maintenance_mode:
                normalizeBoolean(
                    settings.maintenance_mode,
                    false
                ),

            new_investments:
                normalizeBoolean(
                    settings.new_investments,
                    true
                ),

            deposits:
                normalizeBoolean(
                    settings.deposits,
                    true
                ),

            withdrawals:
                normalizeBoolean(
                    settings.withdrawals,
                    true
                ),

            daily_earnings:
                normalizeBoolean(
                    settings.daily_earnings,
                    true
                ),

            user_registration:
                normalizeBoolean(
                    settings.user_registration,
                    true
                ),

            maintenance_message:
                settings.maintenance_message ||
                "",

            last_earnings_run:
                settings.last_earnings_run ||
                null,

            earnings_processed_today:
                Number(
                    settings.earnings_processed_today ||
                    0
                )
        };

        AdminDashboard.maintenanceMonitor = {

            active_investments:
                Number(
                    monitor.active_investments ??
                    monitor.activeInvestments ??
                    0
                ),

            pending_investments:
                Number(
                    monitor.pending_investments ??
                    monitor.pendingInvestments ??
                    0
                ),

            earnings_processed_today:
                Number(
                    monitor.earnings_processed_today ??
                    monitor.earningsProcessedToday ??
                    settings.earnings_processed_today ??
                    0
                )
        };

        renderMaintenanceSettings(
            AdminDashboard.maintenance,
            AdminDashboard.maintenanceMonitor
        );

        return response;

    } catch (error) {

        console.error(
            "Maintenance settings error:",
            error
        );

        setMaintenanceEngineStatus(
            "Unable to load"
        );

        return null;
    }
}


function renderMaintenanceSettings(
    settings,
    monitor
) {

    const maintenanceToggle =
        $("#maintenanceModeToggle");

    const investmentsToggle =
        $("#maintenanceInvestmentsToggle");

    const depositsToggle =
        $("#maintenanceDepositsToggle");

    const withdrawalsToggle =
        $("#maintenanceWithdrawalsToggle");

    const earningsToggle =
        $("#maintenanceEarningsToggle");

    const registrationToggle =
        $("#maintenanceRegistrationToggle");

    const message =
        $("#maintenanceMessage");

    if (maintenanceToggle) {
        maintenanceToggle.checked =
            !!settings.maintenance_mode;
    }

    if (investmentsToggle) {
        investmentsToggle.checked =
            !!settings.new_investments;
    }

    if (depositsToggle) {
        depositsToggle.checked =
            !!settings.deposits;
    }

    if (withdrawalsToggle) {
        withdrawalsToggle.checked =
            !!settings.withdrawals;
    }

    if (earningsToggle) {
        earningsToggle.checked =
            !!settings.daily_earnings;
    }

    if (registrationToggle) {
        registrationToggle.checked =
            !!settings.user_registration;
    }

    if (message) {
        message.value =
            settings.maintenance_message ||
            "";
    }

    const lastRun =
        $("#lastEarningsRun");

    if (lastRun) {

        lastRun.textContent =
            settings.last_earnings_run
                ? formatDate(
                    settings.last_earnings_run
                )
                : "Not available";
    }

    const processed =
        $("#earningsProcessedToday");

    if (processed) {

        processed.textContent =
            formatCurrency(
                monitor.earnings_processed_today ||
                settings.earnings_processed_today ||
                0
            );
    }

    const active =
        $("#maintenanceActiveInvestments");

    if (active) {

        active.textContent =
            formatNumber(
                monitor.active_investments
            );
    }

    const pending =
        $("#maintenancePendingInvestments");

    if (pending) {

        pending.textContent =
            formatNumber(
                monitor.pending_investments
            );
    }

    updateMaintenanceStatus(
        !!settings.maintenance_mode
    );

    setMaintenanceEngineStatus(
        settings.daily_earnings
            ? "Enabled"
            : "Disabled"
    );
}


function updateMaintenanceStatus(
    enabled
) {

    const status =
        $("#maintenanceStatus");

    const statusText =
        $("#maintenanceStatusText");

    const statusDot =
        $("#maintenanceStatusDot");

    const description =
        $("#maintenanceDescription");

    if (!statusText) {
        return;
    }

    if (enabled) {

        statusText.textContent =
            "Maintenance Mode";

        if (description) {

            description.textContent =
                "Maintenance mode is active. Platform activity can be restricted according to the controls below.";
        }

        if (status) {

            status.style.background =
                "rgba(255,193,7,.08)";

            status.style.borderColor =
                "rgba(255,193,7,.15)";
        }

        statusText.style.color =
            "#ffd05a";

        if (statusDot) {

            statusDot.style.background =
                "#ffd05a";

            statusDot.style.boxShadow =
                "0 0 10px rgba(255,193,7,.5)";
        }

    } else {

        statusText.textContent =
            "System Online";

        if (description) {

            description.textContent =
                "Control important platform functions from this administrator panel.";
        }

        if (status) {

            status.style.background =
                "rgba(72,210,125,.08)";

            status.style.borderColor =
                "rgba(72,210,125,.14)";
        }

        statusText.style.color =
            "#72dda0";

        if (statusDot) {

            statusDot.style.background =
                "#50d58a";

            statusDot.style.boxShadow =
                "0 0 10px rgba(80,213,138,.5)";
        }
    }
}


function setMaintenanceEngineStatus(text) {

    const element =
        $("#earningsEngineStatus");

    if (!element) {
        return;
    }

    element.textContent =
        text;

    if (
        text === "Enabled" ||
        text === "Running"
    ) {

        element.style.color =
            "#72dda0";

        element.style.background =
            "rgba(72,210,125,.07)";

        element.style.borderColor =
            "rgba(72,210,125,.12)";

    } else if (
        text === "Disabled"
    ) {

        element.style.color =
            "#ffd05a";

        element.style.background =
            "rgba(255,193,7,.07)";

        element.style.borderColor =
            "rgba(255,193,7,.12)";

    } else {

        element.style.color =
            "rgba(255,255,255,.55)";
    }
}


function collectMaintenanceSettings() {

    return {

        maintenance_mode:
            !!$("#maintenanceModeToggle")?.checked,

        new_investments:
            !!$("#maintenanceInvestmentsToggle")?.checked,

        deposits:
            !!$("#maintenanceDepositsToggle")?.checked,

        withdrawals:
            !!$("#maintenanceWithdrawalsToggle")?.checked,

        daily_earnings:
            !!$("#maintenanceEarningsToggle")?.checked,

        user_registration:
            !!$("#maintenanceRegistrationToggle")?.checked,

        maintenance_message:
            $("#maintenanceMessage")
                ?.value
                ?.trim() || ""
    };
}


async function saveMaintenanceSettings() {

    const button =
        $("#saveMaintenanceBtn");

    const status =
        $("#maintenanceSaveStatus");

    const settings =
        collectMaintenanceSettings();

    if (button) {

        button.disabled = true;

        button.textContent =
            "Saving...";
    }

    if (status) {

        status.textContent =
            "Saving platform settings...";
    }

    try {

        const response =
            await apiRequest(
                ADMIN_MAINTENANCE_API,
                {
                    method: "POST",

                    body:
                        JSON.stringify(
                            settings
                        )
                },
                false
            );

        if (!response) {

            throw new Error(
                "No response from maintenance server."
            );
        }

        const savedSettings =
            response.settings ||
            response.data ||
            settings;

        AdminDashboard.maintenance = {

            ...AdminDashboard.maintenance,

            ...savedSettings
        };

        updateMaintenanceStatus(
            !!settings.maintenance_mode
        );

        setMaintenanceEngineStatus(
            settings.daily_earnings
                ? "Enabled"
                : "Disabled"
        );

        if (status) {

            status.textContent =
                "Platform settings saved successfully.";

            status.style.color =
                "#72dda0";
        }

        showMessage(
            "Maintenance settings saved successfully."
        );

    } catch (error) {

        console.error(
            "Save maintenance error:",
            error
        );

        if (status) {

            status.textContent =
                error.message ||
                "Unable to save settings.";

            status.style.color =
                "#ff7c9d";
        }

        showMessage(
            error.message ||
            "Unable to save maintenance settings.",
            "error"
        );

    } finally {

        if (button) {

            button.disabled = false;

            button.textContent =
                "Save Platform Settings";
        }
    }
}


function setupMaintenanceControls() {

    const maintenanceToggle =
        $("#maintenanceModeToggle");

    if (maintenanceToggle) {

        maintenanceToggle.addEventListener(
            "change",
            () => {

                updateMaintenanceStatus(
                    maintenanceToggle.checked
                );
            }
        );
    }

    const saveButton =
        $("#saveMaintenanceBtn");

    if (saveButton) {

        saveButton.addEventListener(
            "click",
            saveMaintenanceSettings
        );
    }
}


/* =========================================================
   LOGOUT
========================================================= */

async function logoutAdmin() {

    try {

        await apiRequest(
            LOGOUT_API,
            {
                method: "POST"
            },
            false
        );

    } catch (error) {

        console.warn(
            "Logout request failed:",
            error
        );

    } finally {

        window.location.href =
            "login.html";
    }
}


function setupLogout() {

    $all(
        "#logoutBtn, [data-action='logout'], .logout-btn"
    )
        .forEach(
            button => {

                button.addEventListener(
                    "click",
                    event => {

                        event.preventDefault();

                        logoutAdmin();
                    }
                );
            }
        );
}


/* =========================================================
   MOBILE SIDEBAR
========================================================= */

function setupMobileMenu() {

    const menuButton =
        $(
            "#mobileMenuBtn, #menuToggle, .mobile-menu-btn"
        );

    const sidebar =
        $(
            ".sidebar, #adminSidebar"
        );

    const overlay =
        $(
            ".sidebar-overlay, #sidebarOverlay"
        );

    if (
        !menuButton ||
        !sidebar
    ) {
        return;
    }

    menuButton.addEventListener(
        "click",
        () => {

            sidebar.classList.toggle(
                "active"
            );

            if (overlay) {

                overlay.classList.toggle(
                    "active"
                );
            }
        }
    );

    if (overlay) {

        overlay.addEventListener(
            "click",
            () => {

                sidebar.classList.remove(
                    "active"
                );

                overlay.classList.remove(
                    "active"
                );
            }
        );
    }

    $all(
        ".nav-link"
    )
        .forEach(
            link => {

                link.addEventListener(
                    "click",
                    () => {

                        if (
                            window.innerWidth <= 900
                        ) {

                            sidebar.classList.remove(
                                "active"
                            );

                            if (overlay) {

                                overlay.classList.remove(
                                    "active"
                                );
                            }
                        }
                    }
                );
            }
        );
}


/* =========================================================
   NAVIGATION
========================================================= */

function setupNavigation() {

    const links =
        $all(".nav-link");

    links.forEach(
        link => {

            link.addEventListener(
                "click",
                () => {

                    links.forEach(
                        item => {

                            item.classList.remove(
                                "active"
                            );
                        }
                    );

                    link.classList.add(
                        "active"
                    );

                    /*
                     * Load the relevant management
                     * section when its navigation
                     * link is selected.
                     */

                    const href =
                        link.getAttribute(
                            "href"
                        ) || "";

                    const hash =
                        href.split("#")[1];

                    if (
                        hash === "deposits"
                    ) {
                        loadDeposits();
                    }

                    if (
                        hash === "withdrawals"
                    ) {
                        loadWithdrawals();
                    }

                    if (
                        hash === "investments"
                    ) {
                        loadInvestments();
                    }
                }
            );
        }
    );
}


/* =========================================================
   CURRENT YEAR
========================================================= */

function updateCurrentYear() {

    const year =
        new Date().getFullYear();

    $all(
        "#currentYear, [data-current-year]"
    )
        .forEach(
            element => {

                element.textContent =
                    year;
            }
        );
}


/* =========================================================
   INITIALIZE
========================================================= */

async function initializeAdmin() {

    if (
        AdminDashboard.initialized
    ) {
        return;
    }

    AdminDashboard.initialized =
        true;

    const safetyLoaderTimer =
        setTimeout(
            () => {
                forceHideAdminLoader();
            },
            22000
        );

    try {

        setupMobileMenu();

        setupNavigation();

        setupLogout();

        setupMaintenanceControls();

        setupManagementActions();

        updateCurrentYear();

        AdminDashboard.loading =
            true;


        /* -------------------------------------------------
           AUTHENTICATE FIRST
        ------------------------------------------------- */

        const authenticated =
            await authenticateAdmin();

        if (!authenticated) {

            AdminDashboard.loading =
                false;

            forceHideAdminLoader();

            return;
        }


        /*
         * Release the page immediately after
         * successful authentication.
         */

        forceHideAdminLoader();


        /* -------------------------------------------------
           LOAD ADMIN DATA
        ------------------------------------------------- */

        await Promise.allSettled([

            loadProfile(),

            loadAdminDashboard(),

            loadMaintenanceSettings(),

            loadManagementData()

        ]);


        AdminDashboard.loading =
            false;

        forceHideAdminLoader();

    } catch (error) {

        console.error(
            "Admin initialization error:",
            error
        );

        AdminDashboard.loading =
            false;

        forceHideAdminLoader();

        showMessage(
            error.message ||
            "Unable to initialize admin panel.",
            "error"
        );

    } finally {

        clearTimeout(
            safetyLoaderTimer
        );

        forceHideAdminLoader();
    }
}


/* =========================================================
   PAGE START
========================================================= */

if (
    document.readyState ===
    "loading"
) {

    document.addEventListener(
        "DOMContentLoaded",
        initializeAdmin,
        {
            once: true
        }
    );

} else {

    initializeAdmin();
}


/* =========================================================
   GLOBAL API
========================================================= */

window.CrownCashAdmin = {

    state:
        AdminDashboard,

    authenticate:
        authenticateAdmin,

    loadProfile:
        loadProfile,

    loadDashboard:
        loadAdminDashboard,

    loadDeposits:
        loadDeposits,

    loadWithdrawals:
        loadWithdrawals,

    loadInvestments:
        loadInvestments,

    loadManagement:
        loadManagementData,

    loadMaintenance:
        loadMaintenanceSettings,

    saveMaintenance:
        saveMaintenanceSettings,

    approveDeposit:
        depositId =>
            processDepositAction(
                depositId,
                "approve"
            ),

    rejectDeposit:
        (
            depositId,
            reason = ""
        ) =>
            processDepositAction(
                depositId,
                "reject",
                reason
            ),

    approveWithdrawal:
        (
            withdrawalId,
            userId
        ) =>
            processWithdrawalAction(
                withdrawalId,
                userId,
                "approve"
            ),

    rejectWithdrawal:
        (
            withdrawalId,
            userId,
            reason = ""
        ) =>
            processWithdrawalAction(
                withdrawalId,
                userId,
                "reject",
                reason
            ),

    approveInvestment:
        investmentId =>
            processInvestmentAction(
                investmentId,
                "approve"
            ),

    rejectInvestment:
        (
            investmentId,
            reason = ""
        ) =>
            processInvestmentAction(
                investmentId,
                "reject",
                reason
            )
};


/* =========================================================
   FINAL LOADER SAFETY
========================================================= */

window.addEventListener(
    "load",
    () => {

        if (
            AdminDashboard.authenticated
        ) {

            forceHideAdminLoader();
        }
    }
);