/* =========================================================
   CROWN CASH — ADMIN CONTROLLER
   Production Admin Controller
   Version: 20261003ADMIN06

   FEATURES:
   - Secure admin authentication
   - Loader cannot remain stuck on data endpoints
   - Dashboard statistics
   - Deposits management
   - Withdrawals management
   - Investments management
   - Approve / Reject actions
   - Rejection reasons
   - MongoDB date parsing
   - MongoDB ObjectId parsing
   - Flexible API response parsing
   - Customer resolution
   - Refresh after actions
   - Maintenance controls
   - Secure logout
   ========================================================= */

(() => {
    "use strict";

    /* =====================================================
       CONFIGURATION
       ===================================================== */

    const API_BASE = "https://crown-cash1.onrender.com";

    const ENDPOINTS = {
        auth: `${API_BASE}/admin-auth.php`,
        profile: `${API_BASE}/profile.php`,
        dashboard: `${API_BASE}/admin-dashboard.php`,
        deposits: `${API_BASE}/admin_deposit.php`,
        withdrawals: `${API_BASE}/admin_withdrawal.php`,
        investments: `${API_BASE}/admin_investments.php`,
        maintenance: `${API_BASE}/admin-maintenance.php`,
        logout: `${API_BASE}/logout.php`
    };

    const state = {
        authenticated: false,
        authorized: false,

        admin: null,
        profile: null,
        dashboard: null,

        users: [],

        deposits: [],
        withdrawals: [],
        investments: [],

        maintenance: null,

        loading: {
            dashboard: false,
            deposits: false,
            withdrawals: false,
            investments: false,
            maintenance: false
        }
    };


    /* =====================================================
       DOM HELPERS
       ===================================================== */

    function byId(id) {
        return document.getElementById(id);
    }

    function qs(selector, root = document) {
        try {
            return root.querySelector(selector);
        } catch {
            return null;
        }
    }

    function qsa(selector, root = document) {
        try {
            return Array.from(root.querySelectorAll(selector));
        } catch {
            return [];
        }
    }


    /* =====================================================
       HTML ESCAPING
       ===================================================== */

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


    /* =====================================================
       MONEY
       ===================================================== */

    function money(value) {
        const amount = Number(value || 0);

        return new Intl.NumberFormat("en-UG", {
            style: "currency",
            currency: "UGX",
            maximumFractionDigits: 0
        }).format(
            Number.isFinite(amount) ? amount : 0
        );
    }

    function number(value) {
        const amount = Number(value || 0);

        return new Intl.NumberFormat("en-UG", {
            maximumFractionDigits: 0
        }).format(
            Number.isFinite(amount) ? amount : 0
        );
    }


    /* =====================================================
       DATE HELPERS
       ===================================================== */

    function extractDateValue(value) {
        if (
            value === null ||
            value === undefined ||
            value === ""
        ) {
            return null;
        }

        if (value instanceof Date) {
            return Number.isNaN(value.getTime())
                ? null
                : value;
        }

        if (typeof value === "number") {
            const milliseconds =
                value < 100000000000
                    ? value * 1000
                    : value;

            const date = new Date(milliseconds);

            return Number.isNaN(date.getTime())
                ? null
                : date;
        }

        if (typeof value === "string") {
            const trimmed = value.trim();

            if (!trimmed) {
                return null;
            }

            if (/^\d+$/.test(trimmed)) {
                const numeric = Number(trimmed);

                const milliseconds =
                    numeric < 100000000000
                        ? numeric * 1000
                        : numeric;

                const date = new Date(milliseconds);

                if (!Number.isNaN(date.getTime())) {
                    return date;
                }
            }

            const date = new Date(trimmed);

            return Number.isNaN(date.getTime())
                ? null
                : date;
        }

        if (typeof value === "object") {
            if (value.$date !== undefined) {
                return extractDateValue(value.$date);
            }

            if (value.$numberLong !== undefined) {
                return extractDateValue(value.$numberLong);
            }

            if (value.$numberInt !== undefined) {
                return extractDateValue(value.$numberInt);
            }

            if (value.date !== undefined) {
                return extractDateValue(value.date);
            }

            if (value.datetime !== undefined) {
                return extractDateValue(value.datetime);
            }

            if (value.created_at !== undefined) {
                return extractDateValue(value.created_at);
            }

            if (value.createdAt !== undefined) {
                return extractDateValue(value.createdAt);
            }

            if (value.updated_at !== undefined) {
                return extractDateValue(value.updated_at);
            }

            if (value.updatedAt !== undefined) {
                return extractDateValue(value.updatedAt);
            }

            if (value.timestamp !== undefined) {
                return extractDateValue(value.timestamp);
            }

            if (value.time !== undefined) {
                return extractDateValue(value.time);
            }

            if (value.milliseconds !== undefined) {
                return extractDateValue(value.milliseconds);
            }

            if (value.seconds !== undefined) {
                return extractDateValue(
                    Number(value.seconds)
                );
            }
        }

        return null;
    }

    function formatDate(value) {
        const date = extractDateValue(value);

        if (!date) {
            return "Not available";
        }

        try {
            return new Intl.DateTimeFormat(
                "en-GB",
                {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit"
                }
            ).format(date);
        } catch {
            return date.toLocaleString();
        }
    }


    /* =====================================================
       GENERIC HELPERS
       ===================================================== */

    function firstValue(
        object,
        keys,
        fallback = ""
    ) {
        if (
            !object ||
            typeof object !== "object"
        ) {
            return fallback;
        }

        for (const key of keys) {
            if (
                object[key] !== undefined &&
                object[key] !== null &&
                object[key] !== ""
            ) {
                return object[key];
            }
        }

        return fallback;
    }

    function normalizeId(value) {
        if (
            value === null ||
            value === undefined ||
            value === ""
        ) {
            return "";
        }

        if (typeof value === "object") {
            if (value.$oid) {
                return String(value.$oid);
            }

            if (value.id) {
                return String(value.id);
            }

            if (value._id) {
                return normalizeId(value._id);
            }
        }

        return String(value);
    }

    function getId(item, extraKeys = []) {
        const value = firstValue(
            item,
            [
                ...extraKeys,
                "_id",
                "id",
                "deposit_id",
                "withdrawal_id",
                "investment_id",
                "request_id"
            ],
            ""
        );

        return normalizeId(value);
    }


    /* =====================================================
       ARRAY EXTRACTION
       ===================================================== */

    function extractArray(
        response,
        possibleKeys = []
    ) {
        if (!response) {
            return [];
        }

        if (Array.isArray(response)) {
            return response;
        }

        if (typeof response !== "object") {
            return [];
        }

        const keys = [
            ...possibleKeys,
            "items",
            "records",
            "results",
            "requests",
            "data",
            "payload",
            "result"
        ];

        for (const key of keys) {
            const value = response[key];

            if (Array.isArray(value)) {
                return value;
            }

            if (
                value &&
                typeof value === "object"
            ) {
                const nested = extractArray(
                    value,
                    possibleKeys
                );

                if (nested.length) {
                    return nested;
                }
            }
        }

        for (const key of Object.keys(response)) {
            const value = response[key];

            if (Array.isArray(value)) {
                return value;
            }

            if (
                value &&
                typeof value === "object"
            ) {
                const nested = extractArray(
                    value,
                    []
                );

                if (nested.length) {
                    return nested;
                }
            }
        }

        return [];
    }


    /* =====================================================
       API REQUEST
       ===================================================== */

    async function apiRequest(
        url,
        options = {},
        redirectOnAuth = false
    ) {
        const controller =
            new AbortController();

        const timeout =
            setTimeout(() => {
                controller.abort();
            }, 20000);

        const requestOptions = {
            credentials: "include",
            ...options,
            signal: controller.signal,

            headers: {
                Accept: "application/json",

                ...(options.body
                    ? {
                        "Content-Type":
                            "application/json"
                    }
                    : {}),

                ...(options.headers || {})
            }
        };

        try {
            const response =
                await fetch(
                    url,
                    requestOptions
                );

            const text =
                await response.text();

            let data = {};

            if (text) {
                try {
                    data = JSON.parse(text);
                } catch {
                    data = {
                        success: false,
                        message: text
                    };
                }
            }

            if (
                response.status === 401 ||
                response.status === 403
            ) {
                if (redirectOnAuth) {
                    window.location.href =
                        "login.html?redirect=admin.html";
                }

                throw new Error(
                    data?.message ||
                    data?.error ||
                    "Administrator authorization required."
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
                error?.name ===
                "AbortError"
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


    /* =====================================================
       ADMIN LOADER
       ===================================================== */

    function hideAdminLoader() {
        const loader =
            byId("adminLoader");

        if (!loader) {
            return;
        }

        loader.classList.add("hidden");

        loader.style.display = "none";
        loader.style.opacity = "0";
        loader.style.visibility = "hidden";
        loader.style.pointerEvents = "none";

        loader.setAttribute(
            "aria-hidden",
            "true"
        );
    }

    function showAdminLoader(
        message = "Loading Crown Cash Admin..."
    ) {
        const loader =
            byId("adminLoader");

        if (!loader) {
            return;
        }

        loader.classList.remove("hidden");

        loader.style.display = "";
        loader.style.opacity = "1";
        loader.style.visibility = "visible";
        loader.style.pointerEvents = "auto";

        const textElement =
            qs(".loader-text", loader) ||
            qs("[data-loader-text]", loader);

        if (textElement) {
            textElement.textContent = message;
        }
    }


    /* =====================================================
       AUTHENTICATION
       ===================================================== */

    async function authenticateAdmin() {
        const data =
            await apiRequest(
                ENDPOINTS.auth,
                {
                    method: "GET"
                },
                true
            );

        const authenticated =
            Boolean(
                data?.authenticated ??
                data?.data?.authenticated
            );

        const authorized =
            Boolean(
                data?.authorized ??
                data?.data?.authorized ??
                data?.is_admin ??
                data?.data?.is_admin
            );

        if (
            !authenticated ||
            !authorized
        ) {
            throw new Error(
                "Administrator authorization required."
            );
        }

        state.authenticated = true;
        state.authorized = true;

        state.admin =
            data?.admin ||
            data?.data?.admin ||
            data?.user ||
            data?.data?.user ||
            null;

        return true;
    }


    /* =====================================================
       PROFILE
       ===================================================== */

    async function loadProfile() {
        try {
            const data =
                await apiRequest(
                    ENDPOINTS.profile,
                    {
                        method: "GET"
                    },
                    false
                );

            state.profile =
                data?.user ||
                data?.data?.user ||
                data?.profile ||
                data?.data?.profile ||
                null;

            renderAdminProfile();

        } catch (error) {
            console.warn(
                "Profile could not be loaded:",
                error.message
            );
        }
    }

    function renderAdminProfile() {
        const profile =
            state.profile ||
            state.admin ||
            {};

        const name =
            firstValue(
                profile,
                [
                    "full_name",
                    "fullname",
                    "name",
                    "username"
                ],
                "Administrator"
            );

        const email =
            firstValue(
                profile,
                [
                    "email",
                    "email_address"
                ],
                ""
            );

        qsa("[data-admin-name]")
            .forEach(element => {
                element.textContent = name;
            });

        qsa("[data-admin-email]")
            .forEach(element => {
                element.textContent = email;
            });

        [
            "adminName",
            "administratorName",
            "welcomeAdminName"
        ].forEach(id => {
            const element = byId(id);

            if (element) {
                element.textContent = name;
            }
        });
    }


    /* =====================================================
       TEXT HELPER
       ===================================================== */

    function setText(ids, value) {
        if (!Array.isArray(ids)) {
            ids = [ids];
        }

        ids.forEach(id => {
            const element = byId(id);

            if (element) {
                element.textContent = value;
            }
        });
    }


    /* =====================================================
       DASHBOARD
       ===================================================== */

    async function loadDashboard() {
        state.loading.dashboard = true;

        try {
            const data =
                await apiRequest(
                    ENDPOINTS.dashboard,
                    {
                        method: "GET"
                    },
                    false
                );

            state.dashboard = data;

            state.users =
                extractArray(
                    data,
                    [
                        "users",
                        "recent_users",
                        "recentUsers",
                        "all_users",
                        "allUsers"
                    ]
                );

            renderDashboard(data);

            return data;

        } catch (error) {
            console.error(
                "Dashboard loading failed:",
                error
            );

            return null;

        } finally {
            state.loading.dashboard = false;
        }
    }


    function renderDashboard(data) {
        const stats =
            data?.stats ||
            data?.statistics ||
            data?.data?.stats ||
            data?.data?.statistics ||
            {};

        const pending =
            data?.pending ||
            data?.pending_actions ||
            data?.data?.pending ||
            data?.data?.pending_actions ||
            {};

        setText(
            [
                "totalUsers",
                "usersCount"
            ],
            firstValue(
                stats,
                [
                    "total_users",
                    "users",
                    "totalUsers"
                ],
                0
            )
        );

        setText(
            [
                "totalDeposits",
                "depositsCount"
            ],
            money(
                firstValue(
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
            [
                "totalWithdrawals",
                "withdrawalsCount"
            ],
            money(
                firstValue(
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
            [
                "totalInvestments",
                "investmentsCount"
            ],
            money(
                firstValue(
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

        setText(
            [
                "pendingDeposits",
                "pendingDepositsCount"
            ],
            number(
                firstValue(
                    pending,
                    [
                        "deposits",
                        "pending_deposits",
                        "pendingDeposits"
                    ],
                    0
                )
            )
        );

        setText(
            [
                "pendingWithdrawals",
                "pendingWithdrawalsCount"
            ],
            number(
                firstValue(
                    pending,
                    [
                        "withdrawals",
                        "pending_withdrawals",
                        "pendingWithdrawals"
                    ],
                    0
                )
            )
        );

        setText(
            [
                "pendingInvestments",
                "pendingInvestmentsCount"
            ],
            number(
                firstValue(
                    pending,
                    [
                        "investments",
                        "pending_investments",
                        "pendingInvestments"
                    ],
                    0
                )
            )
        );

        const transactions =
            extractArray(
                data,
                [
                    "recent_transactions",
                    "recentTransactions",
                    "transactions"
                ]
            );

        renderRecentTransactions(
            transactions
        );

        renderRecentUsers(
            state.users
        );
    }


    /* =====================================================
       RECENT TRANSACTIONS
       ===================================================== */

    function renderRecentTransactions(
        transactions
    ) {
        const containers = [
            byId("recentTransactions"),
            byId("recentTransactionsList")
        ].filter(Boolean);

        if (!containers.length) {
            return;
        }

        if (!transactions.length) {
            containers.forEach(container => {
                container.innerHTML =
                    `<div class="empty-state">
                        No recent transactions found.
                    </div>`;
            });

            return;
        }

        const html =
            transactions
                .slice(0, 20)
                .map(transaction => {
                    const type =
                        firstValue(
                            transaction,
                            [
                                "type",
                                "transaction_type",
                                "transactionType"
                            ],
                            "transaction"
                        );

                    const amount =
                        firstValue(
                            transaction,
                            [
                                "amount",
                                "value"
                            ],
                            0
                        );

                    const status =
                        firstValue(
                            transaction,
                            [
                                "status",
                                "state"
                            ],
                            "unknown"
                        );

                    const date =
                        firstValue(
                            transaction,
                            [
                                "created_at",
                                "createdAt",
                                "date",
                                "timestamp",
                                "time",
                                "updated_at",
                                "updatedAt"
                            ],
                            null
                        );

                    return `
                        <div class="transaction-item">

                            <div>
                                <strong>
                                    ${escapeHtml(type)}
                                </strong>

                                <div>
                                    ${formatDate(date)}
                                </div>
                            </div>

                            <div>
                                <strong>
                                    ${money(amount)}
                                </strong>

                                <div>
                                    ${escapeHtml(status)}
                                </div>
                            </div>

                        </div>
                    `;
                })
                .join("");

        containers.forEach(container => {
            container.innerHTML = html;
        });
    }


    /* =====================================================
       RECENT USERS
       ===================================================== */

    function renderRecentUsers(users) {
        const container =
            byId("recentUsers") ||
            byId("recentUsersList");

        if (!container) {
            return;
        }

        if (!users.length) {
            container.innerHTML =
                `<div class="empty-state">
                    No recent users found.
                </div>`;

            return;
        }

        container.innerHTML =
            users
                .slice(0, 20)
                .map(user => {
                    const name =
                        firstValue(
                            user,
                            [
                                "full_name",
                                "fullname",
                                "name",
                                "username"
                            ],
                            "Unknown User"
                        );

                    const email =
                        firstValue(
                            user,
                            [
                                "email",
                                "email_address"
                            ],
                            ""
                        );

                    const status =
                        firstValue(
                            user,
                            [
                                "status",
                                "account_status"
                            ],
                            "active"
                        );

                    return `
                        <div class="user-item">

                            <div>
                                <strong>
                                    ${escapeHtml(name)}
                                </strong>

                                <div>
                                    ${escapeHtml(email)}
                                </div>
                            </div>

                            <span>
                                ${escapeHtml(status)}
                            </span>

                        </div>
                    `;
                })
                .join("");
    }


    /* =====================================================
       MANAGEMENT CONTAINERS
       ===================================================== */

    function findManagementContainer(type) {
        const selectors = {
            deposits: [
                "#depositsManagement",
                "#depositManagement",
                "#depositsList",
                "#depositList",
                "[data-management='deposits']",
                "#deposits .management-content",
                "#deposits"
            ],

            withdrawals: [
                "#withdrawalsManagement",
                "#withdrawalManagement",
                "#withdrawalsList",
                "#withdrawalList",
                "[data-management='withdrawals']",
                "#withdrawals .management-content",
                "#withdrawals"
            ],

            investments: [
                "#investmentsManagement",
                "#investmentManagement",
                "#investmentsList",
                "#investmentList",
                "[data-management='investments']",
                "#investments .management-content",
                "#investments"
            ]
        };

        for (
            const selector of
            selectors[type] || []
        ) {
            const element = qs(selector);

            if (element) {
                return element;
            }
        }

        return null;
    }


    /* =====================================================
       DEPOSITS
       ===================================================== */

    async function loadDeposits() {
        state.loading.deposits = true;

        const container =
            findManagementContainer(
                "deposits"
            );

        if (container) {
            showManagementLoading(
                container,
                "Loading deposit requests..."
            );
        }

        try {
            const data =
                await apiRequest(
                    ENDPOINTS.deposits,
                    {
                        method: "GET"
                    },
                    false
                );

            state.deposits =
                extractArray(
                    data,
                    [
                        "deposits",
                        "deposit_requests",
                        "pending_deposits",
                        "pendingDeposits"
                    ]
                );

            renderDeposits();

            return state.deposits;

        } catch (error) {
            console.error(
                "Deposits loading failed:",
                error
            );

            if (container) {
                showManagementError(
                    container,
                    error.message
                );
            }

            return [];

        } finally {
            state.loading.deposits = false;
        }
    }


    function renderDeposits() {
        const container =
            findManagementContainer(
                "deposits"
            );

        if (!container) {
            return;
        }

        if (!state.deposits.length) {
            container.innerHTML = `
                <div class="management-toolbar">

                    <strong>
                        Deposits Management
                    </strong>

                    <button
                        type="button"
                        class="admin-refresh-btn"
                        data-refresh="deposits">
                        Refresh
                    </button>

                </div>

                <div class="empty-state">
                    No deposit requests found.
                </div>
            `;

            bindManagementEvents();
            return;
        }

        container.innerHTML = `
            <div class="management-toolbar">

                <strong>
                    Deposits Management
                </strong>

                <button
                    type="button"
                    class="admin-refresh-btn"
                    data-refresh="deposits">
                    Refresh
                </button>

            </div>

            <div class="admin-table-wrap">

                <table class="admin-table">

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
                        ${state.deposits
                            .map(renderDepositRow)
                            .join("")}
                    </tbody>

                </table>

            </div>
        `;

        bindManagementEvents();
    }


    function renderDepositRow(deposit) {
        const id =
            getId(
                deposit,
                ["deposit_id"]
            );

        const user =
            getUserFromRecord(
                deposit
            );

        const name =
            firstValue(
                user,
                [
                    "full_name",
                    "fullname",
                    "name",
                    "username"
                ],
                firstValue(
                    deposit,
                    [
                        "user_name",
                        "customer_name",
                        "name",
                        "username",
                        "full_name"
                    ],
                    "Unknown Customer"
                )
            );

        const email =
            firstValue(
                user,
                [
                    "email",
                    "email_address"
                ],
                firstValue(
                    deposit,
                    [
                        "user_email",
                        "email"
                    ],
                    ""
                )
            );

        const amount =
            firstValue(
                deposit,
                [
                    "amount",
                    "deposit_amount"
                ],
                0
            );

        const method =
            firstValue(
                deposit,
                [
                    "method",
                    "payment_method",
                    "network"
                ],
                "—"
            );

        const reference =
            firstValue(
                deposit,
                [
                    "reference",
                    "transaction_id",
                    "transactionId"
                ],
                "—"
            );

        const status =
            String(
                firstValue(
                    deposit,
                    [
                        "status",
                        "state"
                    ],
                    "pending"
                )
            ).toLowerCase();

        const date =
            firstValue(
                deposit,
                [
                    "created_at",
                    "createdAt",
                    "date",
                    "timestamp",
                    "submitted_at",
                    "submittedAt"
                ],
                null
            );

        return `
            <tr>

                <td>
                    <strong>
                        ${escapeHtml(name)}
                    </strong>

                    ${
                        email
                            ? `<small>
                                ${escapeHtml(email)}
                               </small>`
                            : ""
                    }
                </td>

                <td>
                    <strong>
                        ${money(amount)}
                    </strong>
                </td>

                <td>
                    ${escapeHtml(method)}
                </td>

                <td>
                    ${escapeHtml(reference)}
                </td>

                <td>
                    ${statusBadge(status)}
                </td>

                <td>
                    ${formatDate(date)}
                </td>

                <td>
                    ${managementActions(
                        "deposit",
                        id,
                        status
                    )}
                </td>

            </tr>
        `;
    }


    /* =====================================================
       WITHDRAWALS
       ===================================================== */

    async function loadWithdrawals() {
        state.loading.withdrawals = true;

        const container =
            findManagementContainer(
                "withdrawals"
            );

        if (container) {
            showManagementLoading(
                container,
                "Loading withdrawal requests..."
            );
        }

        try {
            const data =
                await apiRequest(
                    ENDPOINTS.withdrawals,
                    {
                        method: "GET"
                    },
                    false
                );

            state.withdrawals =
                extractArray(
                    data,
                    [
                        "withdrawals",
                        "withdrawal_requests",
                        "pending_withdrawals",
                        "pendingWithdrawals",
                        "requests"
                    ]
                );

            renderWithdrawals();

            return state.withdrawals;

        } catch (error) {
            console.error(
                "Withdrawals loading failed:",
                error
            );

            if (container) {
                showManagementError(
                    container,
                    error.message
                );
            }

            return [];

        } finally {
            state.loading.withdrawals = false;
        }
    }


    function renderWithdrawals() {
        const container =
            findManagementContainer(
                "withdrawals"
            );

        if (!container) {
            return;
        }

        if (!state.withdrawals.length) {
            container.innerHTML = `
                <div class="management-toolbar">

                    <strong>
                        Withdrawals Management
                    </strong>

                    <button
                        type="button"
                        class="admin-refresh-btn"
                        data-refresh="withdrawals">
                        Refresh
                    </button>

                </div>

                <div class="empty-state">
                    No withdrawal requests found.
                </div>
            `;

            bindManagementEvents();
            return;
        }

        container.innerHTML = `
            <div class="management-toolbar">

                <strong>
                    Withdrawals Management
                </strong>

                <button
                    type="button"
                    class="admin-refresh-btn"
                    data-refresh="withdrawals">
                    Refresh
                </button>

            </div>

            <div class="admin-table-wrap">

                <table class="admin-table">

                    <thead>
                        <tr>
                            <th>Customer</th>
                            <th>Amount</th>
                            <th>Method</th>
                            <th>Account</th>
                            <th>Status</th>
                            <th>Date</th>
                            <th>Action</th>
                        </tr>
                    </thead>

                    <tbody>
                        ${state.withdrawals
                            .map(renderWithdrawalRow)
                            .join("")}
                    </tbody>

                </table>

            </div>
        `;

        bindManagementEvents();
    }


    function renderWithdrawalRow(
        withdrawal
    ) {
        const id =
            getId(
                withdrawal,
                ["withdrawal_id"]
            );

        const user =
            getUserFromRecord(
                withdrawal
            );

        const name =
            firstValue(
                user,
                [
                    "full_name",
                    "fullname",
                    "name",
                    "username"
                ],
                firstValue(
                    withdrawal,
                    [
                        "user_name",
                        "customer_name",
                        "name",
                        "username",
                        "full_name"
                    ],
                    "Unknown Customer"
                )
            );

        const email =
            firstValue(
                user,
                [
                    "email",
                    "email_address"
                ],
                firstValue(
                    withdrawal,
                    [
                        "user_email",
                        "email"
                    ],
                    ""
                )
            );

        const amount =
            firstValue(
                withdrawal,
                [
                    "amount",
                    "withdrawal_amount"
                ],
                0
            );

        const method =
            firstValue(
                withdrawal,
                [
                    "method",
                    "payment_method",
                    "network"
                ],
                "—"
            );

        const account =
            firstValue(
                withdrawal,
                [
                    "phone",
                    "phone_number",
                    "mobile",
                    "account_number",
                    "destination",
                    "recipient",
                    "account"
                ],
                "—"
            );

        const status =
            String(
                firstValue(
                    withdrawal,
                    [
                        "status",
                        "state"
                    ],
                    "pending"
                )
            ).toLowerCase();

        const date =
            firstValue(
                withdrawal,
                [
                    "created_at",
                    "createdAt",
                    "date",
                    "timestamp",
                    "submitted_at",
                    "submittedAt"
                ],
                null
            );

        const userId =
            normalizeId(
                firstValue(
                    withdrawal,
                    [
                        "user_id",
                        "userId",
                        "customer_id",
                        "customerId"
                    ],
                    firstValue(
                        user,
                        [
                            "_id",
                            "id",
                            "user_id",
                            "userId"
                        ],
                        ""
                    )
                )
            );

        return `
            <tr>

                <td>

                    <strong>
                        ${escapeHtml(name)}
                    </strong>

                    ${
                        email
                            ? `<small>
                                ${escapeHtml(email)}
                               </small>`
                            : ""
                    }

                </td>

                <td>
                    <strong>
                        ${money(amount)}
                    </strong>
                </td>

                <td>
                    ${escapeHtml(method)}
                </td>

                <td>
                    ${escapeHtml(account)}
                </td>

                <td>
                    ${statusBadge(status)}
                </td>

                <td>
                    ${formatDate(date)}
                </td>

                <td>
                    ${managementActions(
                        "withdrawal",
                        id,
                        status,
                        userId
                    )}
                </td>

            </tr>
        `;
    }


    /* =====================================================
       INVESTMENTS
       ===================================================== */

    async function loadInvestments() {
        state.loading.investments = true;

        const container =
            findManagementContainer(
                "investments"
            );

        if (container) {
            showManagementLoading(
                container,
                "Loading investment requests..."
            );
        }

        try {
            const data =
                await apiRequest(
                    ENDPOINTS.investments,
                    {
                        method: "GET"
                    },
                    false
                );

            state.investments =
                extractArray(
                    data,
                    [
                        "investments",
                        "investment_requests",
                        "pending_investments",
                        "pendingInvestments",
                        "requests"
                    ]
                );

            enrichInvestmentUsers();

            renderInvestments();

            return state.investments;

        } catch (error) {
            console.error(
                "Investments loading failed:",
                error
            );

            if (container) {
                showManagementError(
                    container,
                    error.message
                );
            }

            return [];

        } finally {
            state.loading.investments = false;
        }
    }


    function enrichInvestmentUsers() {
        state.investments =
            state.investments.map(
                investment => {
                    if (
                        investment.user &&
                        typeof investment.user ===
                        "object"
                    ) {
                        return investment;
                    }

                    const userId =
                        firstValue(
                            investment,
                            [
                                "user_id",
                                "userId",
                                "customer_id",
                                "customerId"
                            ],
                            ""
                        );

                    if (!userId) {
                        return investment;
                    }

                    const user =
                        findUserById(
                            userId
                        );

                    if (!user) {
                        return investment;
                    }

                    return {
                        ...investment,
                        user
                    };
                }
            );
    }


    function renderInvestments() {
        const container =
            findManagementContainer(
                "investments"
            );

        if (!container) {
            return;
        }

        if (!state.investments.length) {
            container.innerHTML = `
                <div class="management-toolbar">

                    <strong>
                        Investments Management
                    </strong>

                    <button
                        type="button"
                        class="admin-refresh-btn"
                        data-refresh="investments">
                        Refresh
                    </button>

                </div>

                <div class="empty-state">
                    No investment requests found.
                </div>
            `;

            bindManagementEvents();
            return;
        }

        container.innerHTML = `
            <div class="management-toolbar">

                <strong>
                    Investments Management
                </strong>

                <button
                    type="button"
                    class="admin-refresh-btn"
                    data-refresh="investments">
                    Refresh
                </button>

            </div>

            <div class="admin-table-wrap">

                <table class="admin-table">

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
                        ${state.investments
                            .map(renderInvestmentRow)
                            .join("")}
                    </tbody>

                </table>

            </div>
        `;

        bindManagementEvents();
    }


    function renderInvestmentRow(
        investment
    ) {
        const id =
            getId(
                investment,
                ["investment_id"]
            );

        const user =
            getUserFromRecord(
                investment
            );

        const userId =
            firstValue(
                investment,
                [
                    "user_id",
                    "userId",
                    "customer_id",
                    "customerId"
                ],
                ""
            );

        let name =
            firstValue(
                user,
                [
                    "full_name",
                    "fullname",
                    "name",
                    "username"
                ],
                ""
            );

        if (!name) {
            name =
                firstValue(
                    investment,
                    [
                        "user_name",
                        "customer_name",
                        "customer",
                        "name",
                        "username",
                        "full_name"
                    ],
                    ""
                );
        }

        if (!name && userId) {
            name =
                resolveUserName(
                    userId
                );
        }

        if (!name) {
            name = "Unknown Customer";
        }

        let email =
            firstValue(
                user,
                [
                    "email",
                    "email_address"
                ],
                ""
            );

        if (!email) {
            email =
                firstValue(
                    investment,
                    [
                        "user_email",
                        "email"
                    ],
                    ""
                );
        }

        const plan =
            firstValue(
                investment,
                [
                    "plan_name",
                    "plan",
                    "investment_plan",
                    "package",
                    "planName"
                ],
                "Investment Plan"
            );

        const amount =
            firstValue(
                investment,
                [
                    "amount",
                    "investment_amount",
                    "principal"
                ],
                0
            );

        const duration =
            firstValue(
                investment,
                [
                    "duration",
                    "duration_days",
                    "days",
                    "term"
                ],
                30
            );

        const status =
            String(
                firstValue(
                    investment,
                    [
                        "status",
                        "state"
                    ],
                    "pending"
                )
            ).toLowerCase();

        const date =
            firstValue(
                investment,
                [
                    "created_at",
                    "createdAt",
                    "date",
                    "timestamp",
                    "started_at",
                    "submitted_at",
                    "submittedAt",
                    "investment_date"
                ],
                null
            );

        return `
            <tr>

                <td>

                    <strong>
                        ${escapeHtml(name)}
                    </strong>

                    ${
                        email
                            ? `<small>
                                ${escapeHtml(email)}
                               </small>`
                            : ""
                    }

                </td>

                <td>
                    ${escapeHtml(plan)}
                </td>

                <td>
                    <strong>
                        ${money(amount)}
                    </strong>
                </td>

                <td>
                    ${escapeHtml(duration)}
                    days
                </td>

                <td>
                    ${statusBadge(status)}
                </td>

                <td>
                    ${formatDate(date)}
                </td>

                <td>
                    ${managementActions(
                        "investment",
                        id,
                        status
                    )}
                </td>

            </tr>
        `;
    }


    /* =====================================================
       USER RESOLUTION
       ===================================================== */

    function getUserFromRecord(record) {
        if (
            !record ||
            typeof record !== "object"
        ) {
            return {};
        }

        const objects = [
            record.user,
            record.customer,
            record.account,
            record.user_data,
            record.userData,
            record.owner
        ];

        for (const object of objects) {
            if (
                object &&
                typeof object === "object"
            ) {
                return object;
            }
        }

        const userId =
            firstValue(
                record,
                [
                    "user_id",
                    "userId",
                    "customer_id",
                    "customerId"
                ],
                ""
            );

        if (!userId) {
            return {};
        }

        return findUserById(userId) || {};
    }

    function findUserById(userId) {
        const normalized =
            normalizeId(userId);

        if (!normalized) {
            return null;
        }

        return (
            state.users.find(user => {
                const ids = [
                    user?._id,
                    user?.id,
                    user?.user_id,
                    user?.userId
                ];

                return ids.some(
                    id =>
                        normalizeId(id) ===
                        normalized
                );
            }) || null
        );
    }

    function resolveUserName(userId) {
        const user =
            findUserById(userId);

        if (!user) {
            return "";
        }

        return firstValue(
            user,
            [
                "full_name",
                "fullname",
                "name",
                "username"
            ],
            ""
        );
    }


    /* =====================================================
       STATUS BADGE
       ===================================================== */

    function statusBadge(status) {
        const normalized =
            String(
                status || "unknown"
            ).toLowerCase();

        return `
            <span
                class="status-badge status-${escapeHtml(normalized)}">
                ${escapeHtml(normalized)}
            </span>
        `;
    }


    /* =====================================================
       ACTION BUTTONS
       ===================================================== */

    function managementActions(
        type,
        id,
        status,
        userId = ""
    ) {
        const normalized =
            String(
                status || ""
            ).toLowerCase();

        if (!id) {
            return "—";
        }

        if (
            normalized === "approved" ||
            normalized === "rejected" ||
            normalized === "completed" ||
            normalized === "active"
        ) {
            return `
                <span class="action-status">
                    ${escapeHtml(normalized)}
                </span>
            `;
        }

        if (normalized === "pending") {
            if (type === "deposit") {
                return `
                    <div class="action-buttons">

                        <button
                            type="button"
                            class="approve-btn"
                            data-action="approve-deposit"
                            data-id="${escapeHtml(id)}">
                            Approve
                        </button>

                        <button
                            type="button"
                            class="reject-btn"
                            data-action="reject-deposit"
                            data-id="${escapeHtml(id)}">
                            Reject
                        </button>

                    </div>
                `;
            }

            if (type === "withdrawal") {
                return `
                    <div class="action-buttons">

                        <button
                            type="button"
                            class="approve-btn"
                            data-action="approve-withdrawal"
                            data-id="${escapeHtml(id)}"
                            data-user-id="${escapeHtml(userId)}">
                            Approve
                        </button>

                        <button
                            type="button"
                            class="reject-btn"
                            data-action="reject-withdrawal"
                            data-id="${escapeHtml(id)}"
                            data-user-id="${escapeHtml(userId)}">
                            Reject
                        </button>

                    </div>
                `;
            }

            if (type === "investment") {
                return `
                    <div class="action-buttons">

                        <button
                            type="button"
                            class="approve-btn"
                            data-action="approve-investment"
                            data-id="${escapeHtml(id)}">
                            Approve
                        </button>

                        <button
                            type="button"
                            class="reject-btn"
                            data-action="reject-investment"
                            data-id="${escapeHtml(id)}">
                            Reject
                        </button>

                    </div>
                `;
            }
        }

        return `
            <span class="action-status">
                ${escapeHtml(normalized)}
            </span>
        `;
    }


    /* =====================================================
       ACTION REQUESTS
       ===================================================== */

    async function processDepositAction(
        depositId,
        action,
        note = ""
    ) {
        if (!depositId) {
            throw new Error(
                "Deposit ID is missing."
            );
        }

        return apiRequest(
            ENDPOINTS.deposits,
            {
                method: "POST",
                body: JSON.stringify({
                    deposit_id: depositId,
                    id: depositId,
                    action,
                    status: action,
                    note,
                    reason: note,
                    rejection_reason: note
                })
            },
            false
        );
    }


    async function processWithdrawalAction(
        withdrawalId,
        userId,
        action,
        note = ""
    ) {
        if (!withdrawalId) {
            throw new Error(
                "Withdrawal ID is missing."
            );
        }

        return apiRequest(
            ENDPOINTS.withdrawals,
            {
                method: "POST",
                body: JSON.stringify({
                    withdrawal_id: withdrawalId,
                    id: withdrawalId,
                    user_id: userId || "",
                    action,
                    status: action,
                    note,
                    reason: note,
                    rejection_reason: note
                })
            },
            false
        );
    }


    async function processInvestmentAction(
        investmentId,
        action,
        note = ""
    ) {
        if (!investmentId) {
            throw new Error(
                "Investment ID is missing."
            );
        }

        return apiRequest(
            ENDPOINTS.investments,
            {
                method: "POST",
                body: JSON.stringify({
                    investment_id: investmentId,
                    id: investmentId,
                    action,
                    status: action,
                    note,
                    reason: note,
                    rejection_reason: note
                })
            },
            false
        );
    }


    /* =====================================================
       ACTION HANDLER
       ===================================================== */

    async function handleAction(
        type,
        action,
        id,
        userId = ""
    ) {
        let note = "";

        if (action === "reject") {
            note =
                window.prompt(
                    "Enter the reason for rejecting this request:"
                );

            if (note === null) {
                return;
            }

            note = note.trim();

            if (!note) {
                alert(
                    "Please provide a rejection reason."
                );
                return;
            }
        }

        if (action === "approve") {
            const confirmed =
                window.confirm(
                    `Are you sure you want to approve this ${type}?`
                );

            if (!confirmed) {
                return;
            }
        }

        try {
            const selector =
                `[data-action="${action === "approve"
                    ? "approve"
                    : "reject"
                }-${type}"]`;

            const buttons =
                qsa(selector)
                    .filter(
                        button =>
                            String(
                                button.dataset.id
                            ) === String(id)
                    );

            buttons.forEach(button => {
                button.disabled = true;
                button.dataset.originalText =
                    button.textContent;
                button.textContent =
                    "Processing...";
            });

            if (type === "deposit") {
                await processDepositAction(
                    id,
                    action,
                    note
                );
            }

            if (type === "withdrawal") {
                await processWithdrawalAction(
                    id,
                    userId,
                    action,
                    note
                );
            }

            if (type === "investment") {
                await processInvestmentAction(
                    id,
                    action,
                    note
                );
            }

            /*
             * Refresh the affected section first.
             */
            if (type === "deposit") {
                await loadDeposits();
            }

            if (type === "withdrawal") {
                await loadWithdrawals();
            }

            if (type === "investment") {
                await loadInvestments();
            }

            /*
             * Refresh dashboard counters.
             */
            await loadDashboard();

            alert(
                `${capitalize(type)} ${action}d successfully.`
            );

        } catch (error) {
            console.error(
                "Admin action failed:",
                error
            );

            alert(
                error?.message ||
                `Unable to ${action} ${type}.`
            );

            qsa(
                `[data-id="${escapeSelector(
                    String(id)
                )}"]`
            ).forEach(button => {
                if (
                    button.dataset.originalText
                ) {
                    button.disabled = false;

                    button.textContent =
                        button.dataset.originalText;
                }
            });
        }
    }


    /* =====================================================
       SAFE SELECTOR
       ===================================================== */

    function escapeSelector(value) {
        if (
            window.CSS &&
            typeof window.CSS.escape ===
            "function"
        ) {
            return window.CSS.escape(value);
        }

        return String(value)
            .replace(
                /["\\]/g,
                "\\$&"
            );
    }


    /* =====================================================
       MANAGEMENT EVENTS
       ===================================================== */

    function bindManagementEvents() {

        qsa("[data-refresh]")
            .forEach(button => {

                if (
                    button.dataset.eventBound ===
                    "true"
                ) {
                    return;
                }

                button.dataset.eventBound =
                    "true";

                button.addEventListener(
                    "click",
                    async () => {
                        const type =
                            button.dataset.refresh;

                        if (
                            type ===
                            "deposits"
                        ) {
                            await loadDeposits();
                        }

                        if (
                            type ===
                            "withdrawals"
                        ) {
                            await loadWithdrawals();
                        }

                        if (
                            type ===
                            "investments"
                        ) {
                            await loadInvestments();
                        }
                    }
                );
            });


        qsa("[data-action]")
            .forEach(button => {

                if (
                    button.dataset.eventBound ===
                    "true"
                ) {
                    return;
                }

                button.dataset.eventBound =
                    "true";

                button.addEventListener(
                    "click",
                    async () => {

                        const actionType =
                            button.dataset.action;

                        const id =
                            button.dataset.id;

                        const userId =
                            button.dataset.userId ||
                            "";

                        if (
                            actionType ===
                            "approve-deposit"
                        ) {
                            await handleAction(
                                "deposit",
                                "approve",
                                id
                            );
                        }

                        else if (
                            actionType ===
                            "reject-deposit"
                        ) {
                            await handleAction(
                                "deposit",
                                "reject",
                                id
                            );
                        }

                        else if (
                            actionType ===
                            "approve-withdrawal"
                        ) {
                            await handleAction(
                                "withdrawal",
                                "approve",
                                id,
                                userId
                            );
                        }

                        else if (
                            actionType ===
                            "reject-withdrawal"
                        ) {
                            await handleAction(
                                "withdrawal",
                                "reject",
                                id,
                                userId
                            );
                        }

                        else if (
                            actionType ===
                            "approve-investment"
                        ) {
                            await handleAction(
                                "investment",
                                "approve",
                                id
                            );
                        }

                        else if (
                            actionType ===
                            "reject-investment"
                        ) {
                            await handleAction(
                                "investment",
                                "reject",
                                id
                            );
                        }
                    }
                );
            });
    }


    /* =====================================================
       MAINTENANCE
       ===================================================== */

    async function loadMaintenance() {
        state.loading.maintenance = true;

        try {
            const data =
                await apiRequest(
                    ENDPOINTS.maintenance,
                    {
                        method: "GET"
                    },
                    false
                );

            state.maintenance =
                data?.settings ||
                data?.maintenance ||
                data?.data?.settings ||
                data?.data?.maintenance ||
                data;

            renderMaintenance();

            return state.maintenance;

        } catch (error) {
            console.error(
                "Maintenance loading failed:",
                error
            );

            return null;

        } finally {
            state.loading.maintenance = false;
        }
    }


    function renderMaintenance() {
        const settings =
            state.maintenance || {};

        const controls = [
            [
                "maintenance_mode",
                [
                    "maintenanceMode",
                    "maintenanceToggle"
                ]
            ],
            [
                "new_investments",
                [
                    "newInvestments",
                    "newInvestmentsToggle"
                ]
            ],
            [
                "deposits_enabled",
                [
                    "depositsEnabled",
                    "depositsToggle"
                ]
            ],
            [
                "withdrawals_enabled",
                [
                    "withdrawalsEnabled",
                    "withdrawalsToggle"
                ]
            ],
            [
                "daily_earnings_enabled",
                [
                    "dailyEarnings",
                    "dailyEarningsToggle"
                ]
            ],
            [
                "registration_enabled",
                [
                    "userRegistration",
                    "registrationToggle"
                ]
            ]
        ];

        controls.forEach(
            ([key, ids]) => {

                const value =
                    Boolean(
                        settings[key] ??
                        settings[camelCase(key)]
                    );

                ids.forEach(id => {
                    const element =
                        byId(id);

                    if (
                        element &&
                        element.type ===
                        "checkbox"
                    ) {
                        element.checked =
                            value;
                    }
                });
            }
        );

        const message =
            firstValue(
                settings,
                [
                    "maintenance_message",
                    "message"
                ],
                ""
            );

        const messageElement =
            byId(
                "maintenanceMessage"
            );

        if (messageElement) {
            messageElement.value =
                message;
        }

        const active =
            firstValue(
                settings,
                [
                    "active_investments",
                    "activeInvestments"
                ],
                0
            );

        const pending =
            firstValue(
                settings,
                [
                    "pending_investments",
                    "pendingInvestments"
                ],
                0
            );

        setText(
            ["activeInvestments"],
            number(active)
        );

        setText(
            ["pendingInvestments"],
            number(pending)
        );

        const lastRun =
            firstValue(
                settings,
                [
                    "last_run",
                    "lastRun",
                    "last_earnings_run",
                    "lastEarningsRun",
                    "last_daily_earnings_run"
                ],
                null
            );

        setText(
            [
                "lastRun",
                "lastEarningsRun"
            ],
            lastRun
                ? formatDate(lastRun)
                : "Not available"
        );

        const processed =
            firstValue(
                settings,
                [
                    "processed_today",
                    "processedToday",
                    "today_processed"
                ],
                0
            );

        setText(
            ["processedToday"],
            money(processed)
        );
    }


    async function saveMaintenance() {
        const payload = {
            maintenance_mode:
                getCheckboxValue(
                    [
                        "maintenanceMode",
                        "maintenanceToggle"
                    ]
                ),

            new_investments:
                getCheckboxValue(
                    [
                        "newInvestments",
                        "newInvestmentsToggle"
                    ]
                ),

            deposits_enabled:
                getCheckboxValue(
                    [
                        "depositsEnabled",
                        "depositsToggle"
                    ]
                ),

            withdrawals_enabled:
                getCheckboxValue(
                    [
                        "withdrawalsEnabled",
                        "withdrawalsToggle"
                    ]
                ),

            daily_earnings_enabled:
                getCheckboxValue(
                    [
                        "dailyEarnings",
                        "dailyEarningsToggle"
                    ]
                ),

            registration_enabled:
                getCheckboxValue(
                    [
                        "userRegistration",
                        "registrationToggle"
                    ]
                ),

            maintenance_message:
                byId(
                    "maintenanceMessage"
                )?.value || ""
        };

        try {
            await apiRequest(
                ENDPOINTS.maintenance,
                {
                    method: "POST",
                    body:
                        JSON.stringify(
                            payload
                        )
                },
                false
            );

            await loadMaintenance();

            alert(
                "Platform settings saved successfully."
            );

        } catch (error) {
            console.error(
                "Maintenance save failed:",
                error
            );

            alert(
                error?.message ||
                "Unable to save platform settings."
            );
        }
    }


    function getCheckboxValue(ids) {
        for (const id of ids) {
            const element = byId(id);

            if (element) {
                return Boolean(
                    element.checked
                );
            }
        }

        return false;
    }


    function camelCase(value) {
        return String(value)
            .replace(
                /_([a-z])/g,
                (_, letter) =>
                    letter.toUpperCase()
            );
    }


    /* =====================================================
       MANAGEMENT UI
       ===================================================== */

    function showManagementLoading(
        container,
        message
    ) {
        container.innerHTML = `
            <div class="loading-state">
                ${escapeHtml(message)}
            </div>
        `;
    }


    function showManagementError(
        container,
        message
    ) {
        container.innerHTML = `
            <div class="error-state">

                <strong>
                    Unable to load records
                </strong>

                <div>
                    ${escapeHtml(
                        message ||
                        "Please try again."
                    )}
                </div>

                <br>

                <button
                    type="button"
                    class="admin-refresh-btn"
                    onclick="location.reload()">
                    Reload Admin Panel
                </button>

            </div>
        `;
    }


    function capitalize(value) {
        if (!value) {
            return "";
        }

        return (
            value.charAt(0).toUpperCase() +
            value.slice(1)
        );
    }


    /* =====================================================
       REFRESH
       ===================================================== */

    async function refreshEverything() {
        await Promise.allSettled([
            loadDashboard(),
            loadDeposits(),
            loadWithdrawals(),
            loadInvestments(),
            loadMaintenance()
        ]);
    }


    /* =====================================================
       HASH NAVIGATION
       ===================================================== */

    function handleHashNavigation() {
        let hash =
            window.location.hash
                .replace("#", "")
                .trim()
                .toLowerCase();

        if (!hash) {
            hash = "dashboard";
        }

        if (hash === "deposits