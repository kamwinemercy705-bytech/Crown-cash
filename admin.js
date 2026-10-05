/* =========================================================
   CROWN CASH — ADMIN PANEL CONTROLLER
   Complete production replacement
   Version: 20261005ADMIN05
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
   APPLICATION STATE
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

    users: [],

    userMap: new Map(),

    loading: false,

    initialized: false

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

    if (
        typeof value === "number"
    ) {

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
        Math.round(
            toNumber(value)
        );

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
        value.$numberLong
    ) {

        value =
            Number(value.$numberLong);

    }

    if (
        typeof value === "object" &&
        value.seconds !== undefined
    ) {

        value =
            Number(value.seconds) * 1000;

    }

    if (
        typeof value === "object" &&
        value._seconds !== undefined
    ) {

        value =
            Number(value._seconds) * 1000;

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

            return String(
                value.$oid
            );

        }

        if (value._id) {

            return getId(
                value._id
            );

        }

        if (value.id) {

            return getId(
                value.id
            );

        }

        if (value.ID) {

            return getId(
                value.ID
            );

        }

        if (value.user_id) {

            return getId(
                value.user_id
            );

        }

        if (value.userId) {

            return getId(
                value.userId
            );

        }

        if (value.account_id) {

            return getId(
                value.account_id
            );

        }

        if (value.accountId) {

            return getId(
                value.accountId
            );

        }

    }

    return "";

}


/* =========================================================
   RECORD ID
   ========================================================= */

function getRecordId(record) {

    if (!record) {

        return "";

    }

    return getId(
        record._id ??
        record.id ??
        record.ID ??
        record.deposit_id ??
        record.depositId ??
        record.withdrawal_id ??
        record.withdrawalId ??
        record.investment_id ??
        record.investmentId
    );

}


/* =========================================================
   USER ID
   ========================================================= */

function getUserId(record) {

    if (!record) {

        return "";

    }

    const embeddedUser =
        record.user ||
        record.customer ||
        record.account ||
        record.owner ||
        {};

    return getId(
        record.user_id ??
        record.userId ??
        record.userID ??
        record.customer_id ??
        record.customerId ??
        record.account_id ??
        record.accountId ??
        record.owner_id ??
        record.ownerId ??
        embeddedUser._id ??
        embeddedUser.id
    );

}


/* =========================================================
   ARRAY EXTRACTION
   ========================================================= */

function extractArray(
    data,
    keys = []
) {

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

    const containers = [

        data.data,

        data.result,

        data.results,

        data.response,

        data.payload,

        data.records,

        data.items

    ];

    for (
        const container
        of containers
    ) {

        if (
            Array.isArray(
                container
            )
        ) {

            return container;

        }

        if (
            container &&
            typeof container === "object"
        ) {

            for (
                const key
                of keys
            ) {

                if (
                    Array.isArray(
                        container[key]
                    )
                ) {

                    return container[key];

                }

            }

        }

    }

    const visited =
        new Set();

    function deepSearch(object) {

        if (
            !object ||
            typeof object !== "object"
        ) {

            return null;

        }

        if (
            visited.has(object)
        ) {

            return null;

        }

        visited.add(object);

        for (
            const key
            of keys
        ) {

            if (
                Array.isArray(
                    object[key]
                )
            ) {

                return object[key];

            }

        }

        for (
            const value
            of Object.values(object)
        ) {

            if (
                value &&
                typeof value === "object"
            ) {

                const result =
                    deepSearch(value);

                if (result) {

                    return result;

                }

            }

        }

        return null;

    }

    return deepSearch(data) || [];

}


/* =========================================================
   USER NAME
   ========================================================= */

function getUserName(record) {

    if (!record) {

        return "Unknown user";

    }

    const user =
        record.user ||
        record.customer ||
        record.account ||
        record.owner ||
        {};

    const directName =
        record.user_name ||
        record.userName ||
        record.customer_name ||
        record.customerName ||
        record.account_name ||
        record.accountName ||
        record.name ||
        record.full_name ||
        record.fullName;

    if (directName) {

        return String(
            directName
        );

    }

    const nestedName =
        user.name ||
        user.full_name ||
        user.fullName ||
        [
            user.first_name,
            user.last_name
        ]
            .filter(Boolean)
            .join(" ");

    if (nestedName) {

        return String(
            nestedName
        );

    }

    const userId =
        getUserId(record);

    if (
        userId &&
        state.userMap.has(
            userId
        )
    ) {

        const cachedUser =
            state.userMap.get(
                userId
            );

        return getUserName(
            cachedUser
        );

    }

    if (
        record.email
    ) {

        return String(
            record.email
        );

    }

    return "Unknown user";

}


/* =========================================================
   REGISTERED PHONE
   ========================================================= */

function getRegisteredPhone(record) {

    if (!record) {

        return "Not available";

    }

    const user =
        record.user ||
        record.customer ||
        record.account ||
        record.owner ||
        {};

    /*
     * Prefer the registered account number.
     */

    const phone =
        record.registered_phone ||
        record.registeredPhone ||
        record.registered_mobile ||
        record.registeredMobile ||
        record.account_phone ||
        record.accountPhone ||
        record.phone ||
        record.phone_number ||
        record.phoneNumber ||
        record.mobile ||
        record.mobile_number ||
        record.mobileNumber ||
        user.registered_phone ||
        user.registeredPhone ||
        user.phone ||
        user.phone_number ||
        user.phoneNumber ||
        user.mobile ||
        user.mobile_number ||
        user.mobileNumber;

    if (phone) {

        return String(
            phone
        ).trim();

    }

    /*
     * Try the cached user by user ID.
     */

    const userId =
        getUserId(record);

    if (
        userId &&
        state.userMap.has(
            userId
        )
    ) {

        const cachedUser =
            state.userMap.get(
                userId
            );

        const cachedPhone =
            getRegisteredPhone(
                cachedUser
            );

        if (
            cachedPhone &&
            cachedPhone !== "Not available"
        ) {

            return cachedPhone;

        }

    }

    /*
     * Try email lookup.
     */

    const email =
        record.email ||
        user.email;

    if (email) {

        const cachedUser =
            state.userMap.get(
                `email:${String(email).toLowerCase()}`
            );

        if (cachedUser) {

            const cachedPhone =
                getRegisteredPhone(
                    cachedUser
                );

            if (
                cachedPhone &&
                cachedPhone !== "Not available"
            ) {

                return cachedPhone;

            }

        }

    }

    return "Not available";

}


/* =========================================================
   CACHE USERS
   ========================================================= */

function cacheUsers(users) {

    if (
        !Array.isArray(users)
    ) {

        return;

    }

    for (
        const user
        of users
    ) {

        if (
            !user ||
            typeof user !== "object"
        ) {

            continue;

        }

        const id =
            getId(
                user._id ??
                user.id ??
                user.ID ??
                user.user_id ??
                user.userId
            );

        if (id) {

            state.userMap.set(
                id,
                user
            );

        }

        if (user.email) {

            state.userMap.set(
                `email:${String(user.email).toLowerCase()}`,
                user
            );

        }

    }

    state.users =
        Array.from(
            state.userMap.values()
        )
            .filter(
                user =>
                    user &&
                    typeof user === "object"
            );

}


/* =========================================================
   CACHE USERS FROM RECORDS
   ========================================================= */

function cacheUsersFromRecords(records) {

    if (
        !Array.isArray(records)
    ) {

        return;

    }

    for (
        const record
        of records
    ) {

        if (!record) {

            continue;

        }

        const user =
            record.user ||
            record.customer ||
            record.account ||
            record.owner;

        if (
            user &&
            typeof user === "object"
        ) {

            cacheUsers([
                user
            ]);

        }

    }

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

        return JSON.parse(
            text
        );

    } catch (error) {

        return {

            success: false,

            message:
                text.substring(
                    0,
                    500
                )

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

        credentials:
            "include",

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

            if (
                redirectOnAuth
            ) {

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

        if (
            !response.ok
        ) {

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

        Object.assign(
            element.style,
            {

                position:
                    "fixed",

                left:
                    "50%",

                top:
                    "20px",

                transform:
                    "translateX(-50%)",

                zIndex:
                    "999999",

                maxWidth:
                    "calc(100vw - 30px)",

                padding:
                    "14px 18px",

                borderRadius:
                    "12px",

                fontFamily:
                    "Inter, Arial, sans-serif",

                fontSize:
                    "14px",

                fontWeight:
                    "700",

                boxShadow:
                    "0 10px 35px rgba(0,0,0,.35)",

                textAlign:
                    "center"

            }
        );

        document.body.appendChild(
            element
        );

    }

    element.textContent =
        message;

    if (
        type === "success"
    ) {

        element.style.background =
            "#155d3b";

    } else if (
        type === "warning"
    ) {

        element.style.background =
            "#6d5614";

    } else {

        element.style.background =
            "#7b2530";

    }

    element.style.color =
        "#ffffff";

    element.style.display =
        "block";

    clearTimeout(
        element._hideTimer
    );

    element._hideTimer =
        setTimeout(
            () => {

                element.style.display =
                    "none";

            },
            5000
        );

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
   FORCE APPLICATION VISIBILITY
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

    hideLoader();

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
                    method:
                        "GET"
                },
                {
                    redirectOnAuth:
                        false,

                    timeout:
                        15000
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

        ensureApplicationVisible();

        return true;

    } catch (error) {

        state.authChecked =
            true;

        ensureApplicationVisible();

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
                    method:
                        "GET"
                },
                {
                    redirectOnAuth:
                        false,

                    timeout:
                        15000
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
        data?.user ||
        data?.profile ||
        data?.account ||
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
        [
            user.first_name,
            user.last_name
        ]
            .filter(Boolean)
            .join(" ") ||
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
        String(name)
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
                    method:
                        "GET"
                },
                {
                    redirectOnAuth:
                        false,

                    timeout:
                        20000
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
   DASHBOARD RENDER
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
        data.data?.stats ||
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
            Number(
                users
            ).toLocaleString(
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
        data.data?.pending ||
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

    const transactions =
        extractArray(
            data,
            [
                "recent_transactions",
                "recentTransactions",
                "transactions"
            ]
        );

    const usersList =
        extractArray(
            data,
            [
                "recent_users",
                "recentUsers",
                "users"
            ]
        );

    cacheUsers(
        usersList
    );

    renderRecentTransactions(
        transactions
    );

    renderRecentUsers(
        usersList
    );

    if (
        state.investments.length
    ) {

        renderInvestments(
            state.investments
        );

    }

    if (
        state.withdrawals.length
    ) {

        renderWithdrawals(
            state.withdrawals
        );

    }

    if (
        state.deposits.length
    ) {

        renderDeposits(
            state.deposits
        );

    }

}


/* =========================================================
   DASHBOARD ERROR
   ========================================================= */

function showDashboardError(error) {

    const message =
        escapeHtml(
            error?.message ||
            "Unable to load dashboard data."
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

                    <small>
                        ${message}
                    </small>

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

                    <small>
                        ${message}
                    </small>

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
        !Array.isArray(transactions) ||
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

    cacheUsersFromRecords(
        transactions
    );

    tbody.innerHTML =
        transactions
            .slice(0, 10)
            .map(
                renderTransactionRow
            )
            .join("");

}


/* =========================================================
   TRANSACTION ROW
   ========================================================= */

function renderTransactionRow(
    transaction
) {

    const name =
        getUserName(
            transaction
        );

    const type =
        transaction.type ||
        transaction.transaction_type ||
        transaction.transactionType ||
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
        transaction.created_on ||
        transaction.createdOn ||
        transaction.date ||
        transaction.timestamp ||
        transaction.time ||
        transaction.updated_at;

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

    cacheUsers(
        users
    );

    tbody.innerHTML =
        users
            .slice(0, 10)
            .map(
                renderUserRow
            )
            .join("");

}


/* =========================================================
   USER ROW
   ========================================================= */

function renderUserRow(user) {

    const name =
        getUserName(
            user
        );

    const email =
        user.email ||
        "Not available";

    const phone =
        getRegisteredPhone(
            user
        );

    const balance =
        user.balance ??
        user.wallet_balance ??
        user.walletBalance ??
        user.wallet?.balance ??
        0;

    const status =
        user.status ||
        user.account_status ||
        user.accountStatus ||
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
            "approval_processing",
            "approval processing",
            "review",
            "awaiting",
            "requested"
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

    const label =
        normalized
            .replace(/_/g, " ")
            .replace(/\b\w/g, char =>
                char.toUpperCase()
            );

    return `

        <span class="${className}">
            ${escapeHtml(label)}
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
                    method:
                        "GET"
                },
                {
                    redirectOnAuth:
                        false,

                    timeout:
                        20000
                }
            );

        state.deposits =
            extractArray(
                data,
                [
                    "deposits",
                    "deposit_requests",
                    "depositRequests",
                    "records",
                    "items",
                    "results",
                    "data"
                ]
            );

        cacheUsersFromRecords(
            state.deposits
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
   DEPOSIT RENDER
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
        !Array.isArray(deposits) ||
        deposits.length === 0
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
                renderDepositRow
            )
            .join("");

}


/* =========================================================
   DEPOSIT ROW
   ========================================================= */

function renderDepositRow(
    deposit
) {

    const amount =
        deposit.amount ??
        deposit.value ??
        deposit.deposit_amount ??
        deposit.depositAmount ??
        0;

    const method =
        deposit.method ||
        deposit.payment_method ||
        deposit.paymentMethod ||
        deposit.network ||
        "Not available";

    const status =
        deposit.status ||
        "pending";

    const date =
        deposit.created_at ||
        deposit.createdAt ||
        deposit.created_on ||
        deposit.createdOn ||
        deposit.date ||
        deposit.timestamp;

    const id =
        getRecordId(
            deposit
        );

    return `

        <tr>

            <td>
                ${escapeHtml(
                    getUserName(deposit)
                )}
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
                    colspan="7"
                    class="table-empty"
                >
                    Loading withdrawal requests...
                </td>

            </tr>

        `;

    }

    try {

        const data =
            await apiRequest(
                ENDPOINTS.withdrawals,
                {
                    method:
                        "GET"
                },
                {
                    redirectOnAuth:
                        false,

                    timeout:
                        20000
                }
            );

        state.withdrawals =
            extractArray(
                data,
                [
                    "withdrawals",
                    "withdrawal_requests",
                    "withdrawalRequests",
                    "requests",
                    "records",
                    "items",
                    "results",
                    "data"
                ]
            );

        /*
         * Cache both embedded users and any users
         * returned directly by the withdrawal API.
         */

        cacheUsersFromRecords(
            state.withdrawals
        );

        const responseUsers =
            extractArray(
                data,
                [
                    "users",
                    "customers",
                    "accounts"
                ]
            );

        cacheUsers(
            responseUsers
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
            7,
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
        !Array.isArray(withdrawals) ||
        withdrawals.length === 0
    ) {

        tbody.innerHTML = `

            <tr>

                <td
                    colspan="7"
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
                renderWithdrawalRow
            )
            .join("");

}


/* =========================================================
   WITHDRAWAL ROW
   ========================================================= */

function renderWithdrawalRow(
    withdrawal
) {

    const amount =
        withdrawal.amount ??
        withdrawal.value ??
        withdrawal.withdrawal_amount ??
        withdrawal.withdrawalAmount ??
        0;

    const method =
        withdrawal.method ||
        withdrawal.payment_method ||
        withdrawal.paymentMethod ||
        withdrawal.network ||
        "Not available";

    const status =
        withdrawal.status ||
        "pending";

    const date =
        withdrawal.created_at ||
        withdrawal.createdAt ||
        withdrawal.created_on ||
        withdrawal.createdOn ||
        withdrawal.date ||
        withdrawal.timestamp;

    const id =
        getRecordId(
            withdrawal
        );

    const registeredPhone =
        getRegisteredPhone(
            withdrawal
        );

    return `

        <tr>

            <td>
                ${escapeHtml(
                    getUserName(withdrawal)
                )}
            </td>

            <td>
                <strong>
                    ${escapeHtml(
                        registeredPhone
                    )}
                </strong>
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
                    method:
                        "GET"
                },
                {
                    redirectOnAuth:
                        false,

                    timeout:
                        20000
                }
            );

        state.investments =
            extractArray(
                data,
                [
                    "investments",
                    "investment_requests",
                    "investmentRequests",
                    "requests",
                    "records",
                    "items",
                    "results",
                    "data"
                ]
            );

        cacheUsersFromRecords(
            state.investments
        );

        renderInvestments(
            state.investments
        );

        setTimeout(
            () => {

                if (
                    state.investments.length
                ) {

                    renderInvestments(
                        state.investments
                    );

                }

            },
            500
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
        !Array.isArray(investments) ||
        investments.length === 0
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
                renderInvestmentRow
            )
            .join("");

}


/* =========================================================
   INVESTMENT ROW
   ========================================================= */

function renderInvestmentRow(
    investment
) {

    const plan =
        investment.plan_name ||
        investment.planName ||
        investment.plan ||
        investment.package ||
        investment.package_name ||
        investment.packageName ||
        "Investment";

    const amount =
        investment.amount ??
        investment.principal ??
        investment.investment_amount ??
        investment.investmentAmount ??
        0;

    const duration =
        investment.duration ??
        investment.duration_days ??
        investment.durationDays ??
        investment.days ??
        30;

    const status =
        investment.status ||
        "pending";

    const id =
        getRecordId(
            investment
        );

    return `

        <tr>

            <td>
                ${escapeHtml(
                    getUserName(investment)
                )}
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

    /*
     * Important:
     * approval_processing IS intentionally actionable.
     */

    const finalStatuses = [

        "approved",

        "completed",

        "complete",

        "rejected",

        "cancelled",

        "canceled",

        "failed"

    ];

    if (
        !id ||
        finalStatuses.includes(
            normalized
        )
    ) {

        return `

            <span class="action-none">
                —
            </span>

        `;

    }

    const approveLabel =
        normalized ===
            "approval_processing"
            ? "Approve"
            : "Approve";

    return `

        <div class="table-actions">

            <button
                type="button"
                class="action-button action-approve"
                data-action="approve"
                data-id="${escapeHtml(id)}"
                data-type="${escapeHtml(type)}"
            >
                ${approveLabel}
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
            error?.message ||
            "Unable to load this section."
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

            id:
                id,

            action:
                action,

            status:
                action === "approve"
                    ? "approved"
                    : "rejected"

        };

        if (
            type === "deposit"
        ) {

            body.deposit_id =
                id;

        }

        if (
            type === "withdrawal"
        ) {

            body.withdrawal_id =
                id;

        }

        if (
            type === "investment"
        ) {

            body.investment_id =
                id;

        }

        if (
            action === "reject"
        ) {

            body.reason =
                rejectionReason;

            body.rejection_reason =
                rejectionReason;

        }

        /*
         * Disable the clicked button while processing.
         */

        const clickedButton =
            document.querySelector(
                `[data-action="${action}"][data-id="${CSS.escape(id)}"][data-type="${CSS.escape(type)}"]`
            );

        if (clickedButton) {

            clickedButton.disabled =
                true;

            clickedButton.textContent =
                "Processing...";

        }

        const data =
            await apiRequest(
                endpoint,
                {

                    method:
                        "POST",

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
                    redirectOnAuth:
                        false,

                    timeout:
                        30000
                }
            );

        showPageMessage(
            data.message ||
            `${label} ${action}d successfully.`,
            "success"
        );

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

        /*
         * Reload the withdrawal list so the admin sees
         * the real server status after an error.
         */

        if (
            type === "withdrawal"
        ) {

            await loadWithdrawals();

        }

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
                    method:
                        "GET"
                },
                {
                    redirectOnAuth:
                        false,

                    timeout:
                        20000
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

        showPageMessage(
            "Unable to load platform maintenance settings.",
            "warning"
        );

        return null;

    }

}


/* =========================================================
   MAINTENANCE SETTINGS
   ========================================================= */

function getMaintenanceSettings(data) {

    if (!data) {

        return {};

    }

    return (
        data.settings ||
        data.maintenance ||
        data.data?.settings ||
        data.data?.maintenance ||
        data.data ||
        data
    );

}


function toBoolean(
    value,
    fallback = false
) {

    if (
        value === null ||
        value === undefined ||
        value === ""
    ) {

        return fallback;

    }

    if (
        typeof value === "boolean"
    ) {

        return value;

    }

    if (
        typeof value === "number"
    ) {

        return value !== 0;

    }

    const normalized =
        String(value)
            .trim()
            .toLowerCase();

    if (
        [
            "true",
            "1",
            "yes",
            "on",
            "enabled"
        ].includes(
            normalized
        )
    ) {

        return true;

    }

    if (
        [
            "false",
            "0",
            "no",
            "off",
            "disabled"
        ].includes(
            normalized
        )
    ) {

        return false;

    }

    return fallback;

}


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
   MAINTENANCE RENDER
   ========================================================= */

function renderMaintenance(
    data
) {

    if (!data) {

        return;

    }

    const settings =
        getMaintenanceSettings(
            data
        );

    const maintenanceMode =
        toBoolean(
            settings.maintenance_mode ??
            settings.maintenance ??
            settings.maintenanceMode,
            false
        );

    const investments =
        toBoolean(
            settings.new_investments ??
            settings.investments ??
            settings.allow_investments,
            true
        );

    const deposits =
        toBoolean(
            settings.deposits ??
            settings.allow_deposits,
            true
        );

    const withdrawals =
        toBoolean(
            settings.withdrawals ??
            settings.allow_withdrawals,
            true
        );

    const earnings =
        toBoolean(
            settings.daily_earnings ??
            settings.earnings ??
            settings.allow_daily_earnings,
            true
        );

    const registration =
        toBoolean(
            settings.user_registration ??
            settings.registration ??
            settings.allow_registration,
            true
        );

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
        investments
    );

    setChecked(
        "maintenanceDepositsToggle",
        deposits
    );

    setChecked(
        "maintenanceWithdrawalsToggle",
        withdrawals
    );

    setChecked(
        "maintenanceEarningsToggle",
        earnings
    );

    setChecked(
        "maintenanceRegistrationToggle",
        registration
    );

    if (
        $("maintenanceMessage")
    ) {

        $("maintenanceMessage").value =
            message;

    }

    const monitor =
        data.monitor ||
        data.earnings ||
        data.data?.monitor ||
        data.data?.earnings ||
        settings.monitor ||
        {};

    if (
        $("earningsEngineStatus")
    ) {

        const enabled =
            monitor.enabled ??
            earnings;

        $("earningsEngineStatus").textContent =
            toBoolean(
                enabled,
                Boolean(earnings)
            )
                ? "Enabled"
                : "Disabled";

    }

    if (
        $("lastEarningsRun")
    ) {

        $("lastEarningsRun").textContent =
            formatDate(
                monitor.last_run ||
                monitor.lastRun ||
                monitor.last_earnings_run ||
                monitor.lastEarningsRun
            );

    }

    if (
        $("earningsProcessedToday")
    ) {

        $("earningsProcessedToday").textContent =
            formatUGX(
                monitor.processed_today ??
                monitor.processedToday ??
                0
            );

    }

    if (
        $("maintenanceActiveInvestments")
    ) {

        $("maintenanceActiveInvestments").textContent =
            Number(
                monitor.active_investments ??
                monitor.activeInvestments ??
                0
            ).toLocaleString(
                "en-UG"
            );

    }

    if (
        $("maintenancePendingInvestments")
    ) {

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

    const status =
        Boolean(enabled);

    if (
        statusText
    ) {

        statusText.textContent =
            status
                ? "Maintenance Mode"
                : "System Online";

    }

    if (
        description
    ) {

        description.textContent =
            status
                ? "Crown Cash is currently in maintenance mode."
                : "Crown Cash platform operations are currently available.";

    }

    if (
        dot
    ) {

        dot.classList.toggle(
            "active",
            status
        );

    }

    const mainStatus =
        $("maintenanceStatus");

    if (
        mainStatus
    ) {

        mainStatus.textContent =
            status
                ? "Maintenance Mode"
                : "System Online";

    }

}


/* =========================================================
   MAINTENANCE TOGGLES
   ========================================================= */

function setupMaintenanceToggles() {

    const toggle =
        $("maintenanceModeToggle");

    if (!toggle) {

        return;

    }

    toggle.addEventListener(
        "change",
        function () {

            updateMaintenanceStatus(
                this.checked
            );

        }
    );

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

    const requestBody = {

        ...payload,

        settings:
            {
                ...payload
            }

    };

    if (button) {

        button.disabled =
            true;

        button.textContent =
            "Saving...";

    }

    if (status) {

        status.textContent =
            "Saving platform settings...";

        status.style.display =
            "block";

    }

    try {

        const data =
            await apiRequest(
                ENDPOINTS.maintenance,
                {

                    method:
                        "POST",

                    headers: {

                        "Content-Type":
                            "application/json"

                    },

                    body:
                        JSON.stringify(
                            requestBody
                        )

                },
                {
                    redirectOnAuth:
                        false,

                    timeout:
                        20000
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

        await loadMaintenance();

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
   MAINTENANCE SAVE HANDLER
   ========================================================= */

function setupMaintenanceSave() {

    const button =
        $("saveMaintenanceBtn");

    if (!button) {

        return;

    }

    if (
        button.dataset.listenerAttached ===
        "true"
    ) {

        return;

    }

    button.dataset.listenerAttached =
        "true";

    button.addEventListener(
        "click",
        function (event) {

            event.preventDefault();

            event.stopPropagation();

            saveMaintenance();

        }
    );

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

            if (
                link.dataset.navigationAttached ===
                "true"
            ) {

                return;

            }

            link.dataset.navigationAttached =
                "true";

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

        const dashboardLink =
            $("dashboardNavLink");

        if (
            dashboardLink
        ) {

            dashboardLink.classList.add(
                "active"
            );

        }

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

    if (
        button.dataset.menuAttached !==
        "true"
    ) {

        button.dataset.menuAttached =
            "true";

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

    }

    if (
        overlay &&
        overlay.dataset.overlayAttached !==
        "true"
    ) {

        overlay.dataset.overlayAttached =
            "true";

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

                if (
                    link.dataset.mobileAttached ===
                    "true"
                ) {

                    return;

                }

                link.dataset.mobileAttached =
                    "true";

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

    if (
        document.body.dataset.actionsAttached ===
        "true"
    ) {

        return;

    }

    document.body.dataset.actionsAttached =
        "true";

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

            event.preventDefault();

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

    if (
        depositButton &&
        depositButton.dataset.listenerAttached !==
        "true"
    ) {

        depositButton.dataset.listenerAttached =
            "true";

        depositButton.addEventListener(
            "click",
            loadDeposits
        );

    }

    const withdrawalButton =
        $("refreshWithdrawalsButton");

    if (
        withdrawalButton &&
        withdrawalButton.dataset.listenerAttached !==
        "true"
    ) {

        withdrawalButton.dataset.listenerAttached =
            "true";

        withdrawalButton.addEventListener(
            "click",
            loadWithdrawals
        );

    }

    const investmentButton =
        $("refreshInvestmentsButton");

    if (
        investmentButton &&
        investmentButton.dataset.listenerAttached !==
        "true"
    ) {

        investmentButton.dataset.listenerAttached =
            "true";

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
                method:
                    "POST"
            },
            {
                redirectOnAuth:
                    false,

                timeout:
                    10000
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

    if (
        button.dataset.listenerAttached ===
        "true"
    ) {

        return;

    }

    button.dataset.listenerAttached =
        "true";

    button.addEventListener(
        "click",
        function (event) {

            event.preventDefault();

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

    const results =
        await Promise.allSettled([

            loadProfile(),

            loadDashboard(),

            loadDeposits(),

            loadWithdrawals(),

            loadInvestments(),

            loadMaintenance()

        ]);

    results.forEach(
        result => {

            if (
                result.status ===
                "rejected"
            ) {

                console.error(
                    "Admin data request failed:",
                    result.reason
                );

            }

        }
    );

    if (
        state.deposits.length
    ) {

        renderDeposits(
            state.deposits
        );

    }

    if (
        state.withdrawals.length
    ) {

        renderWithdrawals(
            state.withdrawals
        );

    }

    if (
        state.investments.length
    ) {

        renderInvestments(
            state.investments
        );

    }

    ensureApplicationVisible();

}


/* =========================================================
   INITIALIZATION
   ========================================================= */

async function initializeAdmin() {

    if (
        state.initialized
    ) {

        return;

    }

    state.initialized =
        true;

    ensureApplicationVisible();

    updateYear();

    setupMobileMenu();

    setupNavigation();

    setupActionHandlers();

    setupRefreshButtons();

    setupLogout();

    setupMaintenanceSave();

    setupMaintenanceToggles();

    updateSecurityDisplay();

    const authenticated =
        await authenticateAdmin();

    if (!authenticated) {

        ensureApplicationVisible();

        return;

    }

    ensureApplicationVisible();

    loadNonCriticalData()
        .catch(
            error => {

                console.error(
                    "Non-critical admin loading error:",
                    error
                );

            }
        );

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
            event.error ||
            event.message
        );

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

    reload:
        function () {

            return loadNonCriticalData();

        },

    reloadDashboard:
        function () {

            return loadDashboard();

        },

    reloadDeposits:
        function () {

            return loadDeposits();

        },

    reloadWithdrawals:
        function () {

            return loadWithdrawals();

        },

    reloadInvestments:
        function () {

            return loadInvestments();

        },

    reloadMaintenance:
        function () {

            return loadMaintenance();

        },

    saveMaintenance:
        function () {

            return saveMaintenance();

        },

    logout:
        function () {

            return logout();

        }

};


/* =========================================================
   START APPLICATION
   ========================================================= */

if (
    document.readyState ===
    "loading"
) {

    document.addEventListener(
        "DOMContentLoaded",
        initializeAdmin,
        {
            once:
                true
        }
    );

} else {

    initializeAdmin();

}