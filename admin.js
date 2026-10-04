/* =========================================================
   CROWN CASH — ADMIN PANEL CONTROLLER
   Production-safe version
   Version: 20261004ADMIN03
   ========================================================= */

"use strict";


/* =========================================================
   CONFIGURATION
   ========================================================= */

const API_BASE =
    "https://crown-cash1.onrender.com";


const ENDPOINTS = {

    auth:
        `${API_BASE}/admin-auth.php`,

    profile:
        `${API_BASE}/profile.php`,

    dashboard:
        `${API_BASE}/admin-dashboard.php`,

    deposits:
        `${API_BASE}/admin_deposit.php`,

    withdrawals:
        `${API_BASE}/admin_withdrawal.php`,

    investments:
        `${API_BASE}/admin_investments.php`,

    maintenance:
        `${API_BASE}/admin-maintenance.php`,

    logout:
        `${API_BASE}/logout.php`

};


/* =========================================================
   STATE
   ========================================================= */

const state = {

    authenticated: false,

    authorized: false,

    isAdmin: false,

    authChecked: false,

    profile: null,

    dashboard: null,

    deposits: [],

    withdrawals: [],

    investments: [],

    maintenance: null,

    loading: false

};


/* =========================================================
   DOM HELPERS
   ========================================================= */

function $(id) {

    return document.getElementById(id);

}


function query(selector) {

    return document.querySelector(selector);

}


function queryAll(selector) {

    return Array.from(
        document.querySelectorAll(selector)
    );

}


/* =========================================================
   HTML ESCAPING
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


/* =========================================================
   NUMBER HELPERS
   ========================================================= */

function toNumber(value) {

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

    const cleaned =
        String(value)
            .replace(/,/g, "")
            .replace(/[^\d.-]/g, "");

    const number =
        Number(cleaned);

    return Number.isFinite(number)
        ? number
        : 0;

}


/* =========================================================
   UGX FORMAT
   ========================================================= */

function formatUGX(value) {

    const amount =
        Math.round(toNumber(value));

    return (
        "UGX " +
        amount.toLocaleString(
            "en-UG",
            {
                maximumFractionDigits: 0
            }
        )
    );

}


/* =========================================================
   DATE PARSER
   ========================================================= */

function parseDate(value) {

    if (
        value === null ||
        value === undefined ||
        value === ""
    ) {
        return null;
    }


    if (
        typeof value === "object" &&
        value.$date
    ) {

        value =
            value.$date;

    }


    if (
        typeof value === "object" &&
        value.date
    ) {

        value =
            value.date;

    }


    if (
        typeof value === "object" &&
        value.seconds
    ) {

        value =
            Number(value.seconds) * 1000;

    }


    if (
        typeof value === "number"
    ) {

        const timestamp =
            value < 10000000000
                ? value * 1000
                : value;

        const date =
            new Date(timestamp);

        return Number.isNaN(
            date.getTime()
        )
            ? null
            : date;

    }


    const stringValue =
        String(value).trim();


    if (!stringValue) {
        return null;
    }


    const date =
        new Date(stringValue);


    if (
        Number.isNaN(
            date.getTime()
        )
    ) {

        return null;

    }


    return date;

}


/* =========================================================
   DATE FORMAT
   ========================================================= */

function formatDate(value) {

    const date =
        parseDate(value);


    if (!date) {

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


/* =========================================================
   ID HELPERS
   ========================================================= */

function getId(value) {

    if (
        value === null ||
        value === undefined
    ) {
        return "";
    }


    if (
        typeof value === "string" ||
        typeof value === "number"
    ) {

        return String(value);

    }


    if (
        typeof value === "object"
    ) {

        if (value.$oid) {
            return String(value.$oid);
        }

        if (value._id) {
            return getId(value._id);
        }

        if (value.id) {
            return getId(value.id);
        }

        if (value.ID) {
            return getId(value.ID);
        }

    }


    return "";

}


/* =========================================================
   ARRAY EXTRACTION
   ========================================================= */

function extractArray(data, keys = []) {

    if (Array.isArray(data)) {

        return data;

    }


    if (
        !data ||
        typeof data !== "object"
    ) {

        return [];

    }


    for (const key of keys) {

        if (
            Array.isArray(
                data[key]
            )
        ) {

            return data[key];

        }

    }


    return [];

}


/* =========================================================
   RESPONSE JSON
   ========================================================= */

async function safeJson(response) {

    const text =
        await response.text();


    if (!text) {

        return {};

    }


    try {

        return JSON.parse(text);

    } catch (error) {

        return {

            success: false,

            message:
                text.substring(0, 500)

        };

    }

}


/* =========================================================
   API REQUEST
   ========================================================= */

async function apiRequest(
    url,
    options = {},
    config = {}
) {

    const {

        redirectOnAuth = false,

        timeout = 20000

    } = config;


    const controller =
        new AbortController();


    const timeoutId =
        setTimeout(
            () => {
                controller.abort();
            },
            timeout
        );


    const requestOptions = {

        credentials: "include",

        ...options,

        signal:
            controller.signal,

        headers: {

            Accept:
                "application/json",

            ...(options.headers || {})

        }

    };


    try {

        const response =
            await fetch(
                url,
                requestOptions
            );


        const data =
            await safeJson(
                response
            );


        if (
            response.status === 401 ||
            response.status === 403
        ) {

            if (redirectOnAuth) {

                handleAuthenticationFailure(
                    response.status
                );

            }


            const error =
                new Error(
                    data.message ||
                    (
                        response.status === 401
                            ? "Authentication required."
                            : "Administrator access required."
                    )
                );


            error.status =
                response.status;


            error.data =
                data;


            throw error;

        }


        if (!response.ok) {

            const error =
                new Error(
                    data.message ||
                    data.error ||
                    `Request failed (${response.status})`
                );


            error.status =
                response.status;


            error.data =
                data;


            throw error;

        }


        return data;

    } catch (error) {

        if (
            error.name === "AbortError"
        ) {

            const timeoutError =
                new Error(
                    "The server request timed out."
                );

            timeoutError.code =
                "TIMEOUT";

            throw timeoutError;

        }


        throw error;

    } finally {

        clearTimeout(
            timeoutId
        );

    }

}


/* =========================================================
   AUTHENTICATION FAILURE
   ========================================================= */

function handleAuthenticationFailure(
    status
) {

    state.authenticated =
        false;

    state.authorized =
        false;

    state.isAdmin =
        false;


    /*
     * Do NOT blank the document.
     *
     * Give the user a clear message and then
     * redirect only for a real authentication failure.
     */

    if (
        status === 401
    ) {

        showPageMessage(
            "Your admin session has expired. Redirecting to login...",
            "warning"
        );


        setTimeout(
            () => {

                window.location.href =
                    "login.html";

            },
            1200
        );

        return;

    }


    if (
        status === 403
    ) {

        showPageMessage(
            "Administrator access is required for this page.",
            "error"
        );


        setTimeout(
            () => {

                window.location.href =
                    "dashboard.html";

            },
            1800
        );

    }

}


/* =========================================================
   PAGE MESSAGE
   ========================================================= */

function showPageMessage(
    message,
    type = "error"
) {

    let element =
        $("adminPageMessage");


    if (!element) {

        element =
            document.createElement(
                "div"
            );

        element.id =
            "adminPageMessage";

        element.style.position =
            "fixed";

        element.style.left =
            "50%";

        element.style.top =
            "20px";

        element.style.transform =
            "translateX(-50%)";

        element.style.zIndex =
            "999999";

        element.style.maxWidth =
            "calc(100vw - 30px)";

        element.style.padding =
            "14px 18px";

        element.style.borderRadius =
            "12px";

        element.style.fontFamily =
            "Arial, sans-serif";

        element.style.fontSize =
            "14px";

        element.style.fontWeight =
            "700";

        element.style.boxShadow =
            "0 10px 35px rgba(0,0,0,.35)";

        document.body.appendChild(
            element
        );

    }


    element.textContent =
        message;


    element.style.background =
        type === "warning"
            ? "#6d5614"
            : "#7b2530";


    element.style.color =
        "#ffffff";


    element.style.display =
        "block";

}


/* =========================================================
   LOADER
   ========================================================= */

function showLoader() {

    const loader =
        $("pageLoader");


    if (!loader) {
        return;
    }


    loader.style.display =
        "flex";

    loader.style.visibility =
        "visible";

    loader.style.opacity =
        "1";

    loader.style.pointerEvents =
        "auto";

}


function hideLoader() {

    const loader =
        $("pageLoader");


    if (!loader) {
        return;
    }


    loader.style.display =
        "none";

    loader.style.visibility =
        "hidden";

    loader.style.opacity =
        "0";

    loader.style.pointerEvents =
        "none";

    loader.setAttribute(
        "aria-hidden",
        "true"
    );

}


/* =========================================================
   FAILSAFE LOADER
   ========================================================= */

function forceHideLoader() {

    hideLoader();


    const loader =
        $("pageLoader");


    if (loader) {

        loader.removeAttribute(
            "style"
        );


        loader.style.display =
            "none";

        loader.style.visibility =
            "hidden";

        loader.style.opacity =
            "0";

        loader.style.pointerEvents =
            "none";

    }

}


/* =========================================================
   ENSURE APPLICATION VISIBILITY
   ========================================================= */

function ensureApplicationVisible() {

    const app =
        $("adminApp");


    if (app) {

        app.style.visibility =
            "visible";

        app.style.opacity =
            "1";

    }


    const main =
        query(".admin-main");


    if (main) {

        main.style.visibility =
            "visible";

        main.style.opacity =
            "1";

    }


    const content =
        query(".admin-content");


    if (content) {

        content.style.visibility =
            "visible";

        content.style.opacity =
            "1";

    }


    forceHideLoader();

}


/* =========================================================
   AUTHENTICATION
   ========================================================= */

async function authenticateAdmin() {

    try {

        const data =
            await apiRequest(
                ENDPOINTS.auth,
                {
                    method: "GET"
                },
                {
                    redirectOnAuth: false,
                    timeout: 15000
                }
            );


        state.authChecked =
            true;


        state.authenticated =
            Boolean(
                data.authenticated !== false
            );


        state.authorized =
            Boolean(
                data.authorized ||
                data.is_admin ||
                data.isAdmin ||
                data.admin
            );


        /*
         * Some backend responses return authenticated=true
         * with the authoritative admin flag in nested data.
         */

        const user =
            data.user ||
            data.account ||
            data.profile ||
            {};


        if (
            user &&
            (
                user.is_admin === true ||
                user.isAdmin === true ||
                user.role === "admin" ||
                user.role === "administrator" ||
                user.role === "super_admin" ||
                user.role === "superadmin" ||
                user.account_type === "admin" ||
                user.account_type === "administrator" ||
                user.account_type === "super_admin" ||
                user.account_type === "superadmin"
            )
        ) {

            state.authorized =
                true;

        }


        state.isAdmin =
            state.authorized;


        if (
            !state.authenticated
        ) {

            handleAuthenticationFailure(
                401
            );

            return false;

        }


        if (
            !state.authorized
        ) {

            handleAuthenticationFailure(
                403
            );

            return false;

        }


        /*
         * CRITICAL:
         *
         * As soon as admin authentication succeeds,
         * reveal the page.
         *
         * Other API requests must NEVER block the page.
         */

        ensureApplicationVisible();


        return true;

    } catch (error) {

        state.authChecked =
            true;


        /*
         * Do NOT turn the entire page white.
         */

        ensureApplicationVisible();


        /*
         * A genuine 401/403 was already handled.
         */

        if (
            error.status === 401 ||
            error.status === 403
        ) {

            return false;

        }


        showPageMessage(
            "Admin authentication could not be completed. Please check the server connection.",
            "error"
        );


        return false;

    }

}


/* =========================================================
   PROFILE
   ========================================================= */

async function loadProfile() {

    try {

        const data =
            await apiRequest(
                ENDPOINTS.profile,
                {
                    method: "GET"
                },
                {
                    redirectOnAuth: false,
                    timeout: 15000
                }
            );


        state.profile =
            data;


        renderProfile(
            data
        );


        return data;

    } catch (error) {

        console.error(
            "Profile request failed:",
            error
        );


        return null;

    }

}


/* =========================================================
   PROFILE RENDER
   ========================================================= */

function renderProfile(data) {

    const user =
        data.user ||
        data.profile ||
        data.account ||
        data;


    if (
        !user ||
        typeof user !== "object"
    ) {

        return;

    }


    const name =
        user.name ||
        user.full_name ||
        user.fullName ||
        (
            [
                user.first_name,
                user.last_name
            ]
                .filter(Boolean)
                .join(" ")
        ) ||
        "Administrator";


    const email =
        user.email ||
        user.username ||
        "Administrator";


    const role =
        user.role ||
        user.account_type ||
        "Administrator";


    const avatar =
        name
            .trim()
            .charAt(0)
            .toUpperCase() ||
        "A";


    if ($("adminName")) {

        $("adminName").textContent =
            name;

    }


    if ($("adminRole")) {

        $("adminRole").textContent =
            role;

    }


    if ($("adminEmail")) {

        $("adminEmail").textContent =
            email;

    }


    if ($("adminAvatar")) {

        $("adminAvatar").textContent =
            avatar;

    }


    if ($("adminAvatarTop")) {

        $("adminAvatarTop").textContent =
            avatar;

    }

}


/* =========================================================
   DASHBOARD
   ========================================================= */

async function loadDashboard() {

    try {

        const data =
            await apiRequest(
                ENDPOINTS.dashboard,
                {
                    method: "GET"
                },
                {
                    redirectOnAuth: false,
                    timeout: 20000
                }
            );


        state.dashboard =
            data;


        renderDashboard(
            data
        );


        return data;

    } catch (error) {

        console.error(
            "Dashboard request failed:",
            error
        );


        showDashboardError(
            error
        );


        return null;

    }

}


/* =========================================================
   DASHBOARD DATA RENDER
   ========================================================= */

function renderDashboard(data) {

    if (!data) {
        return;
    }


    const stats =
        data.stats ||
        data.statistics ||
        data.overview ||
        data.summary ||
        data;


    const users =
        stats.total_users ??
        stats.users ??
        stats.user_count ??
        data.total_users ??
        0;


    const deposits =
        stats.total_deposits ??
        stats.deposits ??
        data.total_deposits ??
        0;


    const withdrawals =
        stats.total_withdrawals ??
        stats.withdrawals ??
        data.total_withdrawals ??
        0;


    const investments =
        stats.total_investments ??
        stats.investments ??
        data.total_investments ??
        0;


    if ($("totalUsers")) {

        $("totalUsers").textContent =
            Number(users).toLocaleString(
                "en-UG"
            );

    }


    if ($("totalDeposits")) {

        $("totalDeposits").textContent =
            formatUGX(
                deposits
            );

    }


    if ($("totalWithdrawals")) {

        $("totalWithdrawals").textContent =
            formatUGX(
                withdrawals
            );

    }


    if ($("totalInvestments")) {

        $("totalInvestments").textContent =
            formatUGX(
                investments
            );

    }


    const pending =
        data.pending ||
        data.pending_items ||
        data;


    const pendingDeposits =
        pending.pending_deposits ??
        pending.pendingDepositAmount ??
        data.pending_deposits ??
        0;


    const pendingWithdrawals =
        pending.pending_withdrawals ??
        pending.pendingWithdrawalAmount ??
        data.pending_withdrawals ??
        0;


    const pendingInvestments =
        pending.pending_investments ??
        pending.pendingInvestmentAmount ??
        data.pending_investments ??
        0;


    if ($("pendingDeposits")) {

        $("pendingDeposits").textContent =
            formatUGX(
                pendingDeposits
            );

    }


    if ($("pendingWithdrawals")) {

        $("pendingWithdrawals").textContent =
            formatUGX(
                pendingWithdrawals
            );

    }


    if ($("pendingInvestments")) {

        $("pendingInvestments").textContent =
            formatUGX(
                pendingInvestments
            );

    }


    renderRecentTransactions(
        extractArray(
            data,
            [
                "recent_transactions",
                "recentTransactions",
                "transactions"
            ]
        )
    );


    renderRecentUsers(
        extractArray(
            data,
            [
                "recent_users",
                "recentUsers",
                "users"
            ]
        )
    );

}


/* =========================================================
   DASHBOARD ERROR
   ========================================================= */

function showDashboardError(error) {

    const message =
        escapeHtml(
            error && error.message
                ? error.message
                : "Unable to load dashboard data."
        );


    if ($("recentTransactions")) {

        $("recentTransactions").innerHTML = `

            <tr>

                <td
                    colspan="5"
                    class="table-empty"
                >
                    Unable to load transactions.
                    <br>
                    <small>${message}</small>
                </td>

            </tr>

        `;

    }


    if ($("recentUsers")) {

        $("recentUsers").innerHTML = `

            <tr>

                <td
                    colspan="5"
                    class="table-empty"
                >
                    Unable to load users.
                    <br>
                    <small>${message}</small>
                </td>

            </tr>

        `;

    }

}


/* =========================================================
   RECENT TRANSACTIONS
   ========================================================= */

function renderRecentTransactions(
    transactions
) {

    const tbody =
        $("recentTransactions");


    if (!tbody) {
        return;
    }


    if (
        !Array.isArray(
            transactions
        ) ||
        transactions.length === 0
    ) {

        tbody.innerHTML = `

            <tr>

                <td
                    colspan="5"
                    class="table-empty"
                >
                    No recent transactions available.
                </td>

            </tr>

        `;

        return;

    }


    tbody.innerHTML =
        transactions
            .slice(0, 10)
            .map(
                transaction =>
                    renderTransactionRow(
                        transaction
                    )
            )
            .join("");

}


/* =========================================================
   TRANSACTION ROW
   ========================================================= */

function renderTransactionRow(
    transaction
) {

    const user =
        transaction.user ||
        transaction.customer ||
        transaction.account ||
        {};


    const name =
        transaction.user_name ||
        transaction.userName ||
        transaction.name ||
        user.name ||
        user.full_name ||
        user.email ||
        "Unknown user";


    const type =
        transaction.type ||
        transaction.transaction_type ||
        transaction.category ||
        "Transaction";


    const amount =
        transaction.amount ??
        transaction.value ??
        transaction.total ??
        0;


    const status =
        transaction.status ||
        "unknown";


    const date =
        transaction.created_at ||
        transaction.createdAt ||
        transaction.date ||
        transaction.timestamp ||
        transaction.time;


    return `

        <tr>

            <td>
                ${escapeHtml(name)}
            </td>

            <td>
                ${escapeHtml(
                    String(type)
                )}
            </td>

            <td>
                ${formatUGX(amount)}
            </td>

            <td>
                ${statusBadge(status)}
            </td>

            <td>
                ${escapeHtml(
                    formatDate(date)
                )}
            </td>

        </tr>

    `;

}


/* =========================================================
   RECENT USERS
   ========================================================= */

function renderRecentUsers(
    users
) {

    const tbody =
        $("recentUsers");


    if (!tbody) {
        return;
    }


    if (
        !Array.isArray(users) ||
        users.length === 0
    ) {

        tbody.innerHTML = `

            <tr>

                <td
                    colspan="5"
                    class="table-empty"
                >
                    No recent users available.
                </td>

            </tr>

        `;

        return;

    }


    tbody.innerHTML =
        users
            .slice(0, 10)
            .map(
                user =>
                    renderUserRow(
                        user
                    )
            )
            .join("");

}


/* =========================================================
   USER ROW
   ========================================================= */

function renderUserRow(user) {

    const name =
        user.name ||
        user.full_name ||
        user.fullName ||
        [
            user.first_name,
            user.last_name
        ]
            .filter(Boolean)
            .join(" ") ||
        "Unknown user";


    const email =
        user.email ||
        "Not available";


    const phone =
        user.phone ||
        user.phone_number ||
        user.mobile ||
        "Not available";


    const balance =
        user.balance ??
        user.wallet_balance ??
        user.walletBalance ??
        0;


    const status =
        user.status ||
        user.account_status ||
        "active";


    return `

        <tr>

            <td>
                ${escapeHtml(name)}
            </td>

            <td>
                ${escapeHtml(email)}
            </td>

            <td>
                ${escapeHtml(phone)}
            </td>

            <td>
                ${formatUGX(balance)}
            </td>

            <td>
                ${statusBadge(status)}
            </td>

        </tr>

    `;

}


/* =========================================================
   STATUS BADGE
   ========================================================= */

function statusBadge(status) {

    const normalized =
        String(
            status || "unknown"
        )
            .toLowerCase()
            .trim();


    let className =
        "status-badge";


    if (
        [
            "approved",
            "completed",
            "complete",
            "success",
            "successful",
            "active",
            "paid"
        ].includes(
            normalized
        )
    ) {

        className +=
            " status-success";

    } else if (
        [
            "pending",
            "processing",
            "review"
        ].includes(
            normalized
        )
    ) {

        className +=
            " status-pending";

    } else if (
        [
            "rejected",
            "failed",
            "cancelled",
            "canceled",
            "inactive"
        ].includes(
            normalized
        )
    ) {

        className +=
            " status-danger";

    } else {

        className +=
            " status-neutral";

    }


    return `

        <span class="${className}">
            ${escapeHtml(
                normalized
                    .charAt(0)
                    .toUpperCase() +
                normalized.slice(1)
            )}
        </span>

    `;

}


/* =========================================================
   DEPOSITS
   ========================================================= */

async function loadDeposits() {

    const tbody =
        $("depositsTableBody");


    if (tbody) {

        tbody.innerHTML = `

            <tr>

                <td
                    colspan="6"
                    class="table-empty"
                >
                    Loading deposits...
                </td>

            </tr>

        `;

    }


    try {

        const data =
            await apiRequest(
                ENDPOINTS.deposits,
                {
                    method: "GET"
                },
                {
                    redirectOnAuth: false,
                    timeout: 20000
                }
            );


        state.deposits =
            extractArray(
                data,
                [
                    "deposits",
                    "data",
                    "items",
                    "results"
                ]
            );


        renderDeposits(
            state.deposits
        );


        return state.deposits;

    } catch (error) {

        console.error(
            "Deposits request failed:",
            error
        );


        renderManagementError(
            "depositsTableBody",
            6,
            error
        );


        return [];

    }

}


/* =========================================================
   DEPOSITS RENDER
   ========================================================= */

function renderDeposits(
    deposits
) {

    const tbody =
        $("depositsTableBody");


    if (!tbody) {
        return;
    }


    if (
        !deposits.length
    ) {

        tbody.innerHTML = `

            <tr>

                <td
                    colspan="6"
                    class="table-empty"
                >
                    No deposit requests found.
                </td>

            </tr>

        `;

        return;

    }


    tbody.innerHTML =
        deposits
            .map(
                deposit =>
                    renderDepositRow(
                        deposit
                    )
            )
            .join("");

}


/* =========================================================
   DEPOSIT ROW
   ========================================================= */

function renderDepositRow(
    deposit
) {

    const user =
        deposit.user ||
        deposit.customer ||
        {};


    const name =
        deposit.user_name ||
        deposit.userName ||
        deposit.name ||
        user.name ||
        user.full_name ||
        user.email ||
        "Unknown user";


    const amount =
        deposit.amount ??
        deposit.value ??
        0;


    const method =
        deposit.method ||
        deposit.payment_method ||
        deposit.paymentMethod ||
        "Not available";


    const status =
        deposit.status ||
        "pending";


    const date =
        deposit.created_at ||
        deposit.createdAt ||
        deposit.date ||
        deposit.timestamp;


    const id =
        getId(
            deposit._id ||
            deposit.id
        );


    return `

        <tr>

            <td>
                ${escapeHtml(name)}
            </td>

            <td>
                ${formatUGX(amount)}
            </td>

            <td>
                ${escapeHtml(method)}
            </td>

            <td>
                ${statusBadge(status)}
            </td>

            <td>
                ${escapeHtml(
                    formatDate(date)
                )}
            </td>

            <td>
                ${managementActions(
                    id,
                    status,
                    "deposit"
                )}
            </td>

        </tr>

    `;

}


/* =========================================================
   WITHDRAWALS
   ========================================================= */

async function loadWithdrawals() {

    const tbody =
        $("withdrawalsTableBody");


    if (tbody) {

        tbody.innerHTML = `

            <tr>

                <td
                    colspan="6"
                    class="table-empty"
                >
                    Loading withdrawals...
                </td>

            </tr>

        `;

    }


    try {

        const data =
            await apiRequest(
                ENDPOINTS.withdrawals,
                {
                    method: "GET"
                },
                {
                    redirectOnAuth: false,
                    timeout: 20000
                }
            );


        state.withdrawals =
            extractArray(
                data,
                [
                    "withdrawals",
                    "data",
                    "items",
                    "results"
                ]
            );


        renderWithdrawals(
            state.withdrawals
        );


        return state.withdrawals;

    } catch (error) {

        console.error(
            "Withdrawals request failed:",
            error
        );


        renderManagementError(
            "withdrawalsTableBody",
            6,
            error
        );


        return [];

    }

}


/* =========================================================
   WITHDRAWALS RENDER
   ========================================================= */

function renderWithdrawals(
    withdrawals
) {

    const tbody =
        $("withdrawalsTableBody");


    if (!tbody) {
        return;
    }


    if (
        !withdrawals.length
    ) {

        tbody.innerHTML = `

            <tr>

                <td
                    colspan="6"
                    class="table-empty"
                >
                    No withdrawal requests found.
                </td>

            </tr>

        `;

        return;

    }


    tbody.innerHTML =
        withdrawals
            .map(
                withdrawal =>
                    renderWithdrawalRow(
                        withdrawal
                    )
            )
            .join("");

}


/* =========================================================
   WITHDRAWAL ROW
   ========================================================= */

function renderWithdrawalRow(
    withdrawal
) {

    const user =
        withdrawal.user ||
        withdrawal.customer ||
        {};


    const name =
        withdrawal.user_name ||
        withdrawal.userName ||
        withdrawal.name ||
        user.name ||
        user.full_name ||
        user.email ||
        "Unknown user";


    const amount =
        withdrawal.amount ??
        withdrawal.value ??
        0;


    const method =
        withdrawal.method ||
        withdrawal.payment_method ||
        withdrawal.paymentMethod ||
        "Not available";


    const status =
        withdrawal.status ||
        "pending";


    const date =
        withdrawal.created_at ||
        withdrawal.createdAt ||
        withdrawal.date ||
        withdrawal.timestamp;


    const id =
        getId(
            withdrawal._id ||
            withdrawal.id
        );


    return `

        <tr>

            <td>
                ${escapeHtml(name)}
            </td>

            <td>
                ${formatUGX(amount)}
            </td>

            <td>
                ${escapeHtml(method)}
            </td>

            <td>
                ${statusBadge(status)}
            </td>

            <td>
                ${escapeHtml(
                    formatDate(date)
                )}
            </td>

            <td>
                ${managementActions(
                    id,
                    status,
                    "withdrawal"
                )}
            </td>

        </tr>

    `;

}


/* =========================================================
   INVESTMENTS
   ========================================================= */

async function loadInvestments() {

    const tbody =
        $("investmentsTableBody");


    if (tbody) {

        tbody.innerHTML = `

            <tr>

                <td
                    colspan="6"
                    class="table-empty"
                >
                    Loading investments...
                </td>

            </tr>

        `;

    }


    try {

        const data =
            await apiRequest(
                ENDPOINTS.investments,
                {
                    method: "GET"
                },
                {
                    redirectOnAuth: false,
                    timeout: 20000
                }
            );


        state.investments =
            extractArray(
                data,
                [
                    "investments",
                    "data",
                    "items",
                    "results"
                ]
            );


        renderInvestments(
            state.investments
        );


        return state.investments;

    } catch (error) {

        console.error(
            "Investments request failed:",
            error
        );


        renderManagementError(
            "investmentsTableBody",
            6,
            error
        );


        return [];

    }

}


/* =========================================================
   INVESTMENTS RENDER
   ========================================================= */

function renderInvestments(
    investments
) {

    const tbody =
        $("investmentsTableBody");


    if (!tbody) {
        return;
    }


    if (
        !investments.length
    ) {

        tbody.innerHTML = `

            <tr>

                <td
                    colspan="6"
                    class="table-empty"
                >
                    No investment requests found.
                </td>

            </tr>

        `;

        return;

    }


    tbody.innerHTML =
        investments
            .map(
                investment =>
                    renderInvestmentRow(
                        investment
                    )
            )
            .join("");

}


/* =========================================================
   INVESTMENT ROW
   ========================================================= */

function renderInvestmentRow(
    investment
) {

    const user =
        investment.user ||
        investment.customer ||
        {};


    const name =
        investment.user_name ||
        investment.userName ||
        investment.name ||
        user.name ||
        user.full_name ||
        user.email ||
        "Unknown user";


    const plan =
        investment.plan_name ||
        investment.planName ||
        investment.plan ||
        investment.package ||
        "Investment";


    const amount =
        investment.amount ??
        investment.principal ??
        investment.investment_amount ??
        0;


    const duration =
        investment.duration ??
        investment.duration_days ??
        investment.days ??
        30;


    const status =
        investment.status ||
        "pending";


    const id =
        getId(
            investment._id ||
            investment.id
        );


    return `

        <tr>

            <td>
                ${escapeHtml(name)}
            </td>

            <td>
                ${escapeHtml(
                    String(plan)
                )}
            </td>

            <td>
                ${formatUGX(amount)}
            </td>

            <td>
                ${escapeHtml(
                    String(duration)
                )} days
            </td>

            <td>
                ${statusBadge(status)}
            </td>

            <td>
                ${managementActions(
                    id,
                    status,
                    "investment"
                )}
            </td>

        </tr>

    `;

}


/* =========================================================
   MANAGEMENT ACTION BUTTONS
   ========================================================= */

function managementActions(
    id,
    status,
    type
) {

    const normalized =
        String(
            status || ""
        )
            .toLowerCase()
            .trim();


    if (
        !id ||
        [
            "approved",
            "completed",
            "complete",
            "rejected",
            "cancelled",
            "canceled",
            "failed"
        ].includes(
            normalized
        )
    ) {

        return `
            <span class="action-none">
                —
            </span>
        `;

    }


    return `

        <div class="table-actions">

            <button
                type="button"
                class="action-button action-approve"
                data-action="approve"
                data-id="${escapeHtml(id)}"
                data-type="${escapeHtml(type)}"
            >
                Approve
            </button>

            <button
                type="button"
                class="action-button action-reject"
                data-action="reject"
                data-id="${escapeHtml(id)}"
                data-type="${escapeHtml(type)}"
            >
                Reject
            </button>

        </div>

    `;

}


/* =========================================================
   MANAGEMENT ERROR
   ========================================================= */

function renderManagementError(
    elementId,
    colspan,
    error
) {

    const tbody =
        $(elementId);


    if (!tbody) {
        return;
    }


    const message =
        escapeHtml(
            error && error.message
                ? error.message
                : "Unable to load this section."
        );


    tbody.innerHTML = `

        <tr>

            <td
                colspan="${colspan}"
                class="table-empty"
            >

                Unable to load data.

                <br>

                <small>
                    ${message}
                </small>

            </td>

        </tr>

    `;

}


/* =========================================================
   APPROVE / REJECT
   ========================================================= */

async function processManagementAction(
    type,
    id,
    action
) {

    if (
        !type ||
        !id ||
        !action
    ) {

        return;

    }


    const labels = {

        deposit:
            "deposit",

        withdrawal:
            "withdrawal",

        investment:
            "investment"

    };


    const label =
        labels[type] ||
        "request";


    if (
        action === "approve"
    ) {

        const confirmed =
            window.confirm(
                `Approve this ${label}?`
            );


        if (!confirmed) {
            return;
        }

    }


    let rejectionReason =
        "";


    if (
        action === "reject"
    ) {

        rejectionReason =
            window.prompt(
                `Enter a reason for rejecting this ${label}:`,
                ""
            );


        if (
            rejectionReason === null
        ) {

            return;

        }

    }


    let endpoint;


    if (
        type === "deposit"
    ) {

        endpoint =
            ENDPOINTS.deposits;

    } else if (
        type === "withdrawal"
    ) {

        endpoint =
            ENDPOINTS.withdrawals;

    } else if (
        type === "investment"
    ) {

        endpoint =
            ENDPOINTS.investments;

    } else {

        return;

    }


    try {

        const body = {

            id: id,

            action: action,

            status:
                action === "approve"
                    ? "approved"
                    : "rejected"

        };


        if (
            action === "reject"
        ) {

            body.reason =
                rejectionReason;

            body.rejection_reason =
                rejectionReason;

        }


        const data =
            await apiRequest(
                endpoint,
                {

                    method: "POST",

                    headers: {

                        "Content-Type":
                            "application/json"

                    },

                    body:
                        JSON.stringify(
                            body
                        )

                },
                {
                    redirectOnAuth: false,
                    timeout: 20000
                }
            );


        showPageMessage(
            data.message ||
            `${label} ${action}d successfully.`,
            "success"
        );


        /*
         * Refresh only the affected section.
         */

        if (
            type === "deposit"
        ) {

            await loadDeposits();

        } else if (
            type === "withdrawal"
        ) {

            await loadWithdrawals();

        } else if (
            type === "investment"
        ) {

            await loadInvestments();

        }


        /*
         * Also refresh dashboard statistics.
         */

        await loadDashboard();


    } catch (error) {

        console.error(
            `Unable to ${action} ${label}:`,
            error
        );


        showPageMessage(
            error.message ||
            `Unable to ${action} ${label}.`,
            "error"
        );

    }

}


/* =========================================================
   MAINTENANCE
   ========================================================= */

async function loadMaintenance() {

    try {

        const data =
            await apiRequest(
                ENDPOINTS.maintenance,
                {
                    method: "GET"
                },
                {
                    redirectOnAuth: false,
                    timeout: 20000
                }
            );


        state.maintenance =
            data;


        renderMaintenance(
            data
        );


        return data;

    } catch (error) {

        console.error(
            "Maintenance request failed:",
            error
        );


        /*
         * IMPORTANT:
         *
         * Maintenance failure must NEVER blank
         * the admin dashboard.
         */

        return null;

    }

}


/* =========================================================
   MAINTENANCE RENDER
   ========================================================= */

function renderMaintenance(
    data
) {

    if (!data) {
        return;
    }


    const settings =
        data.settings ||
        data.maintenance ||
        data.data ||
        data;


    const maintenanceMode =
        Boolean(
            settings.maintenance_mode ??
            settings.maintenance ??
            settings.maintenanceMode ??
            false
        );


    const investments =
        settings.new_investments ??
        settings.investments ??
        settings.allow_investments ??
        true;


    const deposits =
        settings.deposits ??
        settings.allow_deposits ??
        true;


    const withdrawals =
        settings.withdrawals ??
        settings.allow_withdrawals ??
        true;


    const earnings =
        settings.daily_earnings ??
        settings.earnings ??
        settings.allow_daily_earnings ??
        true;


    const registration =
        settings.user_registration ??
        settings.registration ??
        settings.allow_registration ??
        true;


    const message =
        settings.message ||
        settings.maintenance_message ||
        "";


    setChecked(
        "maintenanceModeToggle",
        maintenanceMode
    );


    setChecked(
        "maintenanceInvestmentsToggle",
        Boolean(investments)
    );


    setChecked(
        "maintenanceDepositsToggle",
        Boolean(deposits)
    );


    setChecked(
        "maintenanceWithdrawalsToggle",
        Boolean(withdrawals)
    );


    setChecked(
        "maintenanceEarningsToggle",
        Boolean(earnings)
    );


    setChecked(
        "maintenanceRegistrationToggle",
        Boolean(registration)
    );


    if ($("maintenanceMessage")) {

        $("maintenanceMessage").value =
            message;

    }


    const monitor =
        data.monitor ||
        data.earnings ||
        settings.monitor ||
        {};


    if ($("earningsEngineStatus")) {

        const enabled =
            monitor.enabled ??
            earnings;


        $("earningsEngineStatus").textContent =
            enabled
                ? "Enabled"
                : "Disabled";

    }


    if ($("lastEarningsRun")) {

        $("lastEarningsRun").textContent =
            formatDate(
                monitor.last_run ||
                monitor.lastRun ||
                monitor.last_earnings_run
            );

    }


    if ($("earningsProcessedToday")) {

        $("earningsProcessedToday").textContent =
            formatUGX(
                monitor.processed_today ??
                monitor.processedToday ??
                0
            );

    }


    if ($("maintenanceActiveInvestments")) {

        $("maintenanceActiveInvestments").textContent =
            Number(
                monitor.active_investments ??
                monitor.activeInvestments ??
                0
            ).toLocaleString(
                "en-UG"
            );

    }


    if ($("maintenancePendingInvestments")) {

        $("maintenancePendingInvestments").textContent =
            Number(
                monitor.pending_investments ??
                monitor.pendingInvestments ??
                0
            ).toLocaleString(
                "en-UG"
            );

    }


    updateMaintenanceStatus(
        maintenanceMode
    );

}


/* =========================================================
   CHECKBOX
   ========================================================= */

function setChecked(
    id,
    value
) {

    const element =
        $(id);


    if (!element) {
        return;
    }


    element.checked =
        Boolean(value);

}


/* =========================================================
   MAINTENANCE STATUS
   ========================================================= */

function updateMaintenanceStatus(
    enabled
) {

    const statusText =
        $("maintenanceStatusText");


    const dot =
        $("maintenanceStatusDot");


    const description =
        $("maintenanceDescription");


    if (statusText) {

        statusText.textContent =
            enabled
                ? "Maintenance Mode"
                : "System Online";

    }


    if (description) {

        description.textContent =
            enabled
                ? "Crown Cash is currently in maintenance mode."
                : "Crown Cash platform operations are currently available.";

    }


    if (dot) {

        dot.classList.toggle(
            "active",
            Boolean(enabled)
        );

    }

}


/* =========================================================
   SAVE MAINTENANCE
   ========================================================= */

async function saveMaintenance() {

    const button =
        $("saveMaintenanceBtn");


    const status =
        $("maintenanceSaveStatus");


    const payload = {

        maintenance_mode:
            Boolean(
                $("maintenanceModeToggle")?.checked
            ),

        new_investments:
            Boolean(
                $("maintenanceInvestmentsToggle")?.checked
            ),

        deposits:
            Boolean(
                $("maintenanceDepositsToggle")?.checked
            ),

        withdrawals:
            Boolean(
                $("maintenanceWithdrawalsToggle")?.checked
            ),

        daily_earnings:
            Boolean(
                $("maintenanceEarningsToggle")?.checked
            ),

        user_registration:
            Boolean(
                $("maintenanceRegistrationToggle")?.checked
            ),

        message:
            $("maintenanceMessage")
                ?.value
                ?.trim() || ""

    };


    if (button) {

        button.disabled =
            true;

        button.textContent =
            "Saving...";

    }


    if (status) {

        status.textContent =
            "";

    }


    try {

        const data =
            await apiRequest(
                ENDPOINTS.maintenance,
                {

                    method: "POST",

                    headers: {

                        "Content-Type":
                            "application/json"

                    },

                    body:
                        JSON.stringify(
                            payload
                        )

                },
                {
                    redirectOnAuth: false,
                    timeout: 20000
                }
            );


        state.maintenance =
            data;


        updateMaintenanceStatus(
            payload.maintenance_mode
        );


        if (status) {

            status.textContent =
                data.message ||
                "Platform settings saved successfully.";

        }


        showPageMessage(
            data.message ||
            "Platform settings saved successfully.",
            "success"
        );


    } catch (error) {

        console.error(
            "Maintenance save failed:",
            error
        );


        if (status) {

            status.textContent =
                error.message ||
                "Unable to save platform settings.";

        }


        showPageMessage(
            error.message ||
            "Unable to save platform settings.",
            "error"
        );


    } finally {

        if (button) {

            button.disabled =
                false;

            button.textContent =
                "Save Platform Settings";

        }

    }

}


/* =========================================================
   NAVIGATION
   ========================================================= */

function setupNavigation() {

    const links =
        queryAll(
            ".nav-link"
        );


    links.forEach(
        link => {

            link.addEventListener(
                "click",
                function () {

                    links.forEach(
                        item =>
                            item.classList.remove(
                                "active"
                            )
                    );


                    this.classList.add(
                        "active"
                    );

                }
            );

        }
    );


    window.addEventListener(
        "hashchange",
        updateNavigationFromHash
    );


    updateNavigationFromHash();

}


/* =========================================================
   HASH NAVIGATION
   ========================================================= */

function updateNavigationFromHash() {

    const hash =
        window.location.hash
            .replace(
                "#",
                ""
            );


    if (!hash) {
        return;
    }


    const navMap = {

        dashboard:
            "dashboardNavLink",

        users:
            "usersNavLink",

        deposits:
            "depositsNavLink",

        withdrawals:
            "withdrawalsNavLink",

        investments:
            "investmentsNavLink",

        transactions:
            "transactionsNavLink",

        referrals:
            "referralsNavLink",

        support:
            "supportNavLink",

        security:
            "securityNavLink",

        maintenance:
            "maintenanceNavLink"

    };


    queryAll(
        ".nav-link"
    )
        .forEach(
            link =>
                link.classList.remove(
                    "active"
                )
        );


    const linkId =
        navMap[hash];


    if (linkId) {

        const link =
            $(linkId);


        if (link) {

            link.classList.add(
                "active"
            );

        }

    }

}


/* =========================================================
   MOBILE MENU
   ========================================================= */

function setupMobileMenu() {

    const button =
        $("mobileMenuButton");


    const sidebar =
        $("sidebar");


    const overlay =
        $("sidebarOverlay");


    if (!button) {
        return;
    }


    function openMenu() {

        if (sidebar) {

            sidebar.classList.add(
                "open"
            );

        }


        if (overlay) {

            overlay.classList.add(
                "active"
            );

        }


        button.setAttribute(
            "aria-expanded",
            "true"
        );

    }


    function closeMenu() {

        if (sidebar) {

            sidebar.classList.remove(
                "open"
            );

        }


        if (overlay) {

            overlay.classList.remove(
                "active"
            );

        }


        button.setAttribute(
            "aria-expanded",
            "false"
        );

    }


    button.addEventListener(
        "click",
        function () {

            if (
                sidebar &&
                sidebar.classList.contains(
                    "open"
                )
            ) {

                closeMenu();

            } else {

                openMenu();

            }

        }
    );


    if (overlay) {

        overlay.addEventListener(
            "click",
            closeMenu
        );

    }


    queryAll(
        ".nav-link"
    )
        .forEach(
            link => {

                link.addEventListener(
                    "click",
                    closeMenu
                );

            }
        );

}


/* =========================================================
   ACTION EVENT DELEGATION
   ========================================================= */

function setupActionHandlers() {

    document.addEventListener(
        "click",
        function (event) {

            const button =
                event.target.closest(
                    "[data-action]"
                );


            if (!button) {
                return;
            }


            const action =
                button.dataset.action;


            const id =
                button.dataset.id;


            const type =
                button.dataset.type;


            if (
                action !== "approve" &&
                action !== "reject"
            ) {

                return;

            }


            processManagementAction(
                type,
                id,
                action
            );

        }
    );

}


/* =========================================================
   REFRESH BUTTONS
   ========================================================= */

function setupRefreshButtons() {

    const depositButton =
        $("refreshDepositsButton");


    if (depositButton) {

        depositButton.addEventListener(
            "click",
            loadDeposits
        );

    }


    const withdrawalButton =
        $("refreshWithdrawalsButton");


    if (withdrawalButton) {

        withdrawalButton.addEventListener(
            "click",
            loadWithdrawals
        );

    }


    const investmentButton =
        $("refreshInvestmentsButton");


    if (investmentButton) {

        investmentButton.addEventListener(
            "click",
            loadInvestments
        );

    }

}


/* =========================================================
   LOGOUT
   ========================================================= */

async function logout() {

    const button =
        $("logoutButton");


    if (button) {

        button.disabled =
            true;

        button.textContent =
            "Logging out...";

    }


    try {

        await apiRequest(
            ENDPOINTS.logout,
            {
                method: "POST"
            },
            {
                redirectOnAuth: false,
                timeout: 10000
            }
        );

    } catch (error) {

        console.warn(
            "Logout request:",
            error
        );

    } finally {

        window.location.href =
            "login.html";

    }

}


/* =========================================================
   LOGOUT HANDLER
   ========================================================= */

function setupLogout() {

    const button =
        $("logoutButton");


    if (!button) {
        return;
    }


    button.addEventListener(
        "click",
        function () {

            const confirmed =
                window.confirm(
                    "Are you sure you want to logout?"
                );


            if (!confirmed) {
                return;
            }


            logout();

        }
    );

}


/* =========================================================
   CURRENT YEAR
   ========================================================= */

function updateYear() {

    const year =
        $("currentYear");


    if (year) {

        year.textContent =
            String(
                new Date().getFullYear()
            );

    }

}


/* =========================================================
   SECURITY DISPLAY
   ========================================================= */

function updateSecurityDisplay() {

    const status =
        $("securityStatus");


    const description =
        $("securityDescription");


    if (status) {

        status.textContent =
            "✓";

    }


    if (description) {

        description.textContent =
            "Administrator authentication and protected server-side endpoints are active.";

    }

}


/* =========================================================
   LOAD NON-CRITICAL DATA
   ========================================================= */

async function loadNonCriticalData() {

    /*
     * These requests intentionally run independently.
     *
     * A failure in one endpoint MUST NOT blank the page
     * or prevent the other sections from loading.
     */

    await Promise.allSettled([

        loadProfile(),

        loadDashboard(),

        loadDeposits(),

        loadWithdrawals(),

        loadInvestments(),

        loadMaintenance()

    ]);

}


/* =========================================================
   INITIALIZATION
   ========================================================= */

async function initializeAdmin() {

    /*
     * Immediately make the HTML application visible.
     */

    ensureApplicationVisible();


    updateYear();

    setupMobileMenu();

    setupNavigation();

    setupActionHandlers();

    setupRefreshButtons();

    setupLogout();

    updateSecurityDisplay();


    /*
     * Authentication is the ONLY blocking request.
     */

    const authenticated =
        await authenticateAdmin();


    if (!authenticated) {

        /*
         * Do not continue loading protected data.
         */

        ensureApplicationVisible();

        return;

    }


    /*
     * Authentication succeeded.
     *
     * The page is already visible.
     */

    ensureApplicationVisible();


    /*
     * Load everything else independently.
     */

    loadNonCriticalData()
        .catch(
            error => {

                console.error(
                    "Non-critical admin loading error:",
                    error
                );

            }
        );


    /*
     * Final safety check.
     */

    setTimeout(
        ensureApplicationVisible,
        100
    );


    setTimeout(
        ensureApplicationVisible,
        1000
    );


    setTimeout(
        ensureApplicationVisible,
        3000
    );


    setTimeout(
        ensureApplicationVisible,
        7000
    );

}


/* =========================================================
   GLOBAL ERROR PROTECTION
   ========================================================= */

window.addEventListener(
    "error",
    function (event) {

        console.error(
            "Crown Cash Admin JavaScript error:",
            event.error || event.message
        );


        /*
         * NEVER allow an uncaught JS error to leave
         * the loader covering the admin page.
         */

        ensureApplicationVisible();

    }
);


/* =========================================================
   UNHANDLED PROMISE PROTECTION
   ========================================================= */

window.addEventListener(
    "unhandledrejection",
    function (event) {

        console.error(
            "Crown Cash Admin promise error:",
            event.reason
        );


        ensureApplicationVisible();

    }
);


/* =========================================================
   GLOBAL ADMIN API
   ========================================================= */

window.CrownCashAdmin = {

    state,

    reload: function () {

        return loadNonCriticalData();

    },

    reloadDashboard: function () {

        return loadDashboard();

    },

    reloadDeposits: function () {

        return loadDeposits();

    },

    reloadWithdrawals: function () {

        return loadWithdrawals();

    },

    reloadInvestments: function () {

        return loadInvestments();

    },

    reloadMaintenance: function () {

        return loadMaintenance();

    },

    saveMaintenance: function () {

        return saveMaintenance();

    },

    logout: function () {

        return logout();

    }

};


/* =========================================================
   START APPLICATION
   ========================================================= */

if (
    document.readyState === "loading"
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