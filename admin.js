/* =========================================================
   CROWN CASH — ADMIN PANEL
   Production Admin Controller
   FIXED:
   - Admin loading screen
   - Admin authentication
   - Profile
   - Dashboard statistics
   - Recent transactions
   - Recent users
   - Maintenance controls
   - Earnings monitor
   - Approval actions
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
   ADMIN LOADING SCREEN FIX
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

    /*
       Also remove common body loading classes.
    */

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


/*
   Safety fallback.

   Even if an unexpected API request hangs,
   the page must not remain covered by the
   loading screen forever.
*/

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

    /*
       Support MongoDB-style date objects.
    */

    if (
        typeof value === "object" &&
        value !== null
    ) {

        if (value.$date) {

            value = value.$date;
        } else if (value.date) {

            value = value.date;
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

        /*
           IMPORTANT:
           Both conditions must be true.

           A normal user must never be treated
           as an administrator just because the
           authentication endpoint returned success.
        */

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

        /*
           Do not leave the loading screen stuck.
        */

        forceHideAdminLoader();

        showMessage(
            error.message ||
            "Unable to verify administrator access.",
            "error"
        );

        /*
           Give the message a moment to display
           instead of instantly trapping the user
           on the loading screen.
        */

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
   LOAD PROFILE
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


/* =========================================================
   RENDER PROFILE
========================================================= */

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
   LOAD ADMIN DASHBOARD
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


/* =========================================================
   DASHBOARD STATS
========================================================= */

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


/* =========================================================
   PENDING ACTIONS
========================================================= */

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
                            transaction.amount ||
                            0
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
   LOAD MAINTENANCE SETTINGS
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


/* =========================================================
   RENDER MAINTENANCE
========================================================= */

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


/* =========================================================
   MAINTENANCE STATUS
========================================================= */

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


/* =========================================================
   EARNINGS ENGINE STATUS
========================================================= */

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


/* =========================================================
   COLLECT MAINTENANCE FORM
========================================================= */

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


/* =========================================================
   SAVE MAINTENANCE SETTINGS
========================================================= */

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


/* =========================================================
   MAINTENANCE CONTROL EVENTS
========================================================= */

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
   ADMIN ACTION
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

        await Promise.allSettled([

            loadAdminDashboard(),

            loadMaintenanceSettings()

        ]);

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
            deposit_id: depositId,

            id: depositId,

            action,

            status:
                action === "approve"
                    ? "approved"
                    : action === "reject"
                        ? "rejected"
                        : action,

            note
        },
        `Deposit ${action}d successfully.`
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

            id:
                withdrawalId,

            user_id:
                userId,

            userId,

            action,

            note
        },
        `Withdrawal ${action}d successfully.`
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

            id:
                investmentId,

            action,

            status:
                action === "approve"
                    ? "approved"
                    : action === "reject"
                        ? "rejected"
                        : action,

            note
        },
        `Investment ${action}d successfully.`
    );
}


/* =========================================================
   GLOBAL ADMIN API
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
        depositId =>
            processDepositAction(
                depositId,
                "reject"
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
            userId
        ) =>
            processWithdrawalAction(
                withdrawalId,
                userId,
                "reject"
            ),

    approveInvestment:
        investmentId =>
            processInvestmentAction(
                investmentId,
                "approve"
            ),

    rejectInvestment:
        investmentId =>
            processInvestmentAction(
                investmentId,
                "reject"
            )
};


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


/* =========================================================
   LOGOUT EVENTS
========================================================= */

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
   ACTIVE NAVIGATION
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
   INITIALIZE ADMIN PANEL
========================================================= */

async function initializeAdmin() {

    if (
        AdminDashboard.initialized
    ) {

        return;
    }

    AdminDashboard.initialized =
        true;

    /*
       Safety timer.

       The admin panel must NEVER remain on
       the loading screen permanently.
    */

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

        updateCurrentYear();

        AdminDashboard.loading =
            true;

        /*
           Authenticate first.
        */

        const authenticated =
            await authenticateAdmin();

        if (!authenticated) {

            AdminDashboard.loading =
                false;

            forceHideAdminLoader();

            return;
        }

        /*
           IMPORTANT FIX:
           Release the page immediately after
           successful admin authentication.

           The other API requests can continue
           loading in the background.
        */

        forceHideAdminLoader();

        /*
           Load all secondary information
           independently.

           One failure cannot block the page.
        */

        await Promise.allSettled([

            loadProfile(),

            loadAdminDashboard(),

            loadMaintenanceSettings()

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

        /*
           Final guarantee that the loading
           overlay is removed.
        */

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
   GLOBAL SAFETY LOADER
========================================================= */

window.addEventListener(
    "load",
    () => {

        /*
           Do not hide before authentication.
           This only acts as a final visual safeguard
           after the page itself has finished loading.
        */

        if (
            AdminDashboard.authenticated
        ) {

            forceHideAdminLoader();
        }
    }
);