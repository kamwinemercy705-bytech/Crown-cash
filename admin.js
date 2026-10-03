/* ============================================================
   CROWN CASH - ADMIN PANEL
   Production Admin Controller
   Version: 20261003ADMIN06
   ============================================================ */

(() => {
    "use strict";

    /* ============================================================
       CONFIGURATION
       ============================================================ */

    const API_BASE = "https://crown-cash1.onrender.com";

    const ENDPOINTS = {
        auth: "/admin-auth.php",
        profile: "/profile.php",
        dashboard: "/admin-dashboard.php",
        deposits: "/admin_deposit.php",
        withdrawals: "/admin_withdrawal.php",
        investments: "/admin_investments.php",
        maintenance: "/admin-maintenance.php",
        logout: "/logout.php"
    };

    const REQUEST_TIMEOUT = 20000;

    const state = {
        authenticated: false,
        authorized: false,
        isAdmin: false,
        profile: null,
        dashboard: null,
        deposits: [],
        withdrawals: [],
        investments: [],
        maintenance: null,
        initialized: false,
        loading: false
    };


    /* ============================================================
       BASIC HELPERS
       ============================================================ */

    function $(selector, root = document) {
        try {
            return root.querySelector(selector);
        } catch (error) {
            return null;
        }
    }

    function $$(selector, root = document) {
        try {
            return Array.from(root.querySelectorAll(selector));
        } catch (error) {
            return [];
        }
    }

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

    function formatUGX(value) {
        const number = Number(value || 0);

        if (!Number.isFinite(number)) {
            return "UGX 0";
        }

        return "UGX " + Math.round(number).toLocaleString("en-UG");
    }

    function formatNumber(value) {
        const number = Number(value || 0);

        if (!Number.isFinite(number)) {
            return "0";
        }

        return Math.round(number).toLocaleString("en-UG");
    }

    function normalizeId(value) {
        if (value === null || value === undefined) {
            return "";
        }

        if (typeof value === "string") {
            return value;
        }

        if (typeof value === "number") {
            return String(value);
        }

        if (typeof value === "object") {
            if (value.$oid) {
                return String(value.$oid);
            }

            if (value.oid) {
                return String(value.oid);
            }

            if (value._id) {
                return normalizeId(value._id);
            }

            if (value.id) {
                return normalizeId(value.id);
            }
        }

        return String(value);
    }

    function getValue(object, keys, fallback = "") {
        if (!object || typeof object !== "object") {
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

    function extractArray(payload, possibleKeys = []) {
        if (Array.isArray(payload)) {
            return payload;
        }

        if (!payload || typeof payload !== "object") {
            return [];
        }

        for (const key of possibleKeys) {
            if (Array.isArray(payload[key])) {
                return payload[key];
            }
        }

        const commonKeys = [
            "data",
            "results",
            "items",
            "records",
            "transactions",
            "users",
            "deposits",
            "withdrawals",
            "investments"
        ];

        for (const key of commonKeys) {
            if (Array.isArray(payload[key])) {
                return payload[key];
            }
        }

        return [];
    }


    /* ============================================================
       DATE HELPERS
       ============================================================ */

    function parseDate(value) {
        if (!value) {
            return null;
        }

        if (value instanceof Date) {
            return isNaN(value.getTime()) ? null : value;
        }

        if (typeof value === "object") {
            if (value.$date) {
                return parseDate(value.$date);
            }

            if (value.date) {
                return parseDate(value.date);
            }

            if (value.createdAt) {
                return parseDate(value.createdAt);
            }
        }

        if (typeof value === "number") {
            const date = new Date(
                value < 100000000000
                    ? value * 1000
                    : value
            );

            return isNaN(date.getTime()) ? null : date;
        }

        const stringValue = String(value).trim();

        if (!stringValue) {
            return null;
        }

        const date = new Date(stringValue);

        if (!isNaN(date.getTime())) {
            return date;
        }

        return null;
    }

    function formatDate(value) {
        const date = parseDate(value);

        if (!date) {
            return "Not available";
        }

        try {
            return date.toLocaleString("en-UG", {
                year: "numeric",
                month: "short",
                day: "2-digit",
                hour: "2-digit",
                minute: "2-digit"
            });
        } catch (error) {
            return date.toLocaleString();
        }
    }


    /* ============================================================
       LOADER CONTROL
       ============================================================ */

    function findLoaderElements() {
        const selectors = [
            "#adminLoader",
            "#admin-loader",
            "#pageLoader",
            "#page-loader",
            "#loadingScreen",
            "#loading-screen",
            ".admin-loader",
            ".admin-loading",
            ".loading-screen",
            ".loading-overlay",
            ".page-loader",
            ".loader-overlay",
            "[data-admin-loader]"
        ];

        const elements = [];

        selectors.forEach(selector => {
            $$(selector).forEach(element => {
                if (!elements.includes(element)) {
                    elements.push(element);
                }
            });
        });

        return elements;
    }

    function showAdminLoader() {
        const loaders = findLoaderElements();

        loaders.forEach(loader => {
            loader.style.display = "flex";
            loader.style.visibility = "visible";
            loader.style.opacity = "1";
            loader.removeAttribute("aria-hidden");
        });

        document.documentElement.classList.add("admin-loading");
        document.body.classList.add("admin-loading");
    }

    function hideAdminLoader() {
        const loaders = findLoaderElements();

        loaders.forEach(loader => {
            loader.style.display = "none";
            loader.style.visibility = "hidden";
            loader.style.opacity = "0";
            loader.setAttribute("aria-hidden", "true");
        });

        document.documentElement.classList.remove("admin-loading");
        document.body.classList.remove("admin-loading");

        /*
         * Some loading screens are positioned above the page with
         * z-index. Force them out of the visual layer as well.
         */
        loaders.forEach(loader => {
            loader.style.pointerEvents = "none";
        });

        state.loading = false;
    }

    /*
     * Emergency failsafe.
     *
     * If the page itself is already available but a loader element
     * gets stuck because of a frontend error, it will not remain
     * covering the admin panel forever.
     */
    function startLoaderFailsafe() {
        setTimeout(() => {
            if (state.authenticated && state.authorized) {
                hideAdminLoader();
            }
        }, 7000);
    }


    /* ============================================================
       API REQUEST
       ============================================================ */

    async function apiRequest(path, options = {}, redirectOnAuth = false) {
        const controller = new AbortController();

        const timeout = setTimeout(() => {
            controller.abort();
        }, REQUEST_TIMEOUT);

        const requestOptions = {
            method: options.method || "GET",
            credentials: "include",
            cache: "no-store",
            signal: controller.signal,
            headers: {
                "Accept": "application/json",
                ...(options.body
                    ? {
                        "Content-Type": "application/json"
                    }
                    : {}),
                ...(options.headers || {})
            }
        };

        if (options.body !== undefined) {
            requestOptions.body =
                typeof options.body === "string"
                    ? options.body
                    : JSON.stringify(options.body);
        }

        try {
            const response = await fetch(
                API_BASE + path,
                requestOptions
            );

            const text = await response.text();

            let data = {};

            if (text) {
                try {
                    data = JSON.parse(text);
                } catch (parseError) {
                    data = {
                        success: false,
                        message: text
                    };
                }
            }

            if (response.status === 401) {
                state.authenticated = false;
                state.authorized = false;
                state.isAdmin = false;

                if (redirectOnAuth) {
                    window.location.href = "login.html";
                }

                throw new Error(
                    data.message ||
                    "Your administrator session has expired."
                );
            }

            if (response.status === 403) {
                state.authorized = false;
                state.isAdmin = false;

                throw new Error(
                    data.message ||
                    "Administrator access is required."
                );
            }

            if (!response.ok) {
                throw new Error(
                    data.message ||
                    data.error ||
                    `Request failed with HTTP ${response.status}`
                );
            }

            return data;

        } catch (error) {
            if (error.name === "AbortError") {
                throw new Error(
                    "The server took too long to respond."
                );
            }

            throw error;

        } finally {
            clearTimeout(timeout);
        }
    }


    /* ============================================================
       ADMIN AUTHENTICATION
       ============================================================ */

    async function authenticateAdmin() {
        try {
            const data = await apiRequest(
                ENDPOINTS.auth,
                {
                    method: "GET"
                },
                false
            );

            const authorized =
                data.authorized === true ||
                data.is_admin === true ||
                data.isAdmin === true ||
                data.admin === true ||
                data.role === "admin" ||
                data.role === "administrator" ||
                data.account_type === "admin" ||
                data.account_type === "administrator";

            if (!authorized) {
                state.authenticated = true;
                state.authorized = false;
                state.isAdmin = false;

                throw new Error(
                    "Administrator authorization was not confirmed."
                );
            }

            state.authenticated = true;
            state.authorized = true;
            state.isAdmin = true;

            /*
             * VERY IMPORTANT:
             *
             * Authentication is the only operation that should block
             * the administrator from seeing the page.
             *
             * Once authenticated, remove the full-screen loader NOW.
             * Other API requests are allowed to continue in background.
             */
            hideAdminLoader();

            return data;

        } catch (error) {
            state.authenticated = false;
            state.authorized = false;
            state.isAdmin = false;

            hideAdminLoader();

            /*
             * If the backend explicitly says unauthorized, send the
             * user back to login.
             */
            if (
                error.message &&
                (
                    error.message.toLowerCase().includes("unauthorized") ||
                    error.message.toLowerCase().includes("administrator") ||
                    error.message.toLowerCase().includes("session")
                )
            ) {
                window.location.href = "login.html";
            }

            throw error;
        }
    }


    /* ============================================================
       PROFILE
       ============================================================ */

    async function loadProfile() {
        try {
            const data = await apiRequest(
                ENDPOINTS.profile,
                {
                    method: "GET"
                },
                false
            );

            state.profile = data;

            renderProfile(data);

            return data;

        } catch (error) {
            console.warn(
                "Crown Cash Admin: profile request failed:",
                error.message
            );

            return null;
        }
    }

    function renderProfile(data) {
        if (!data) {
            return;
        }

        const user =
            data.user ||
            data.profile ||
            data.data ||
            data;

        const name =
            getValue(
                user,
                [
                    "full_name",
                    "fullName",
                    "name",
                    "username",
                    "display_name",
                    "displayName"
                ],
                "Administrator"
            );

        const email =
            getValue(
                user,
                ["email"],
                ""
            );

        const nameElements = [
            "#adminName",
            "#administratorName",
            "#profileName",
            ".admin-name",
            "[data-admin-name]"
        ];

        nameElements.forEach(selector => {
            $$(selector).forEach(element => {
                element.textContent = name;
            });
        });

        const emailElements = [
            "#adminEmail",
            "#administratorEmail",
            ".admin-email",
            "[data-admin-email]"
        ];

        emailElements.forEach(selector => {
            $$(selector).forEach(element => {
                if (email) {
                    element.textContent = email;
                }
            });
        });
    }


    /* ============================================================
       DASHBOARD
       ============================================================ */

    async function loadDashboard() {
        try {
            const data = await apiRequest(
                ENDPOINTS.dashboard,
                {
                    method: "GET"
                },
                false
            );

            state.dashboard = data;

            renderDashboard(data);

            return data;

        } catch (error) {
            console.warn(
                "Crown Cash Admin: dashboard request failed:",
                error.message
            );

            return null;
        }
    }

    function findNumber(data, keys, fallback = 0) {
        if (!data || typeof data !== "object") {
            return fallback;
        }

        for (const key of keys) {
            if (
                data[key] !== undefined &&
                data[key] !== null
            ) {
                const number = Number(data[key]);

                if (Number.isFinite(number)) {
                    return number;
                }
            }
        }

        return fallback;
    }

    function renderDashboard(data) {
        if (!data) {
            return;
        }

        const root =
            data.data ||
            data.dashboard ||
            data;

        const stats =
            root.stats ||
            root.statistics ||
            root.overview ||
            root;

        const totalUsers = findNumber(
            stats,
            [
                "total_users",
                "totalUsers",
                "users_count",
                "user_count"
            ]
        );

        const totalDeposits = findNumber(
            stats,
            [
                "total_deposits",
                "totalDeposits",
                "deposits_total"
            ]
        );

        const totalWithdrawals = findNumber(
            stats,
            [
                "total_withdrawals",
                "totalWithdrawals",
                "withdrawals_total"
            ]
        );

        const totalInvestments = findNumber(
            stats,
            [
                "total_investments",
                "totalInvestments",
                "investments_total"
            ]
        );

        const pendingDeposits = findNumber(
            stats,
            [
                "pending_deposits",
                "pendingDeposits"
            ]
        );

        const pendingWithdrawals = findNumber(
            stats,
            [
                "pending_withdrawals",
                "pendingWithdrawals"
            ]
        );

        const pendingInvestments = findNumber(
            stats,
            [
                "pending_investments",
                "pendingInvestments"
            ]
        );

        setText(
            [
                "#totalUsers",
                "#total-users",
                "[data-stat='total-users']"
            ],
            formatNumber(totalUsers)
        );

        setText(
            [
                "#totalDeposits",
                "#total-deposits",
                "[data-stat='total-deposits']"
            ],
            formatUGX(totalDeposits)
        );

        setText(
            [
                "#totalWithdrawals",
                "#total-withdrawals",
                "[data-stat='total-withdrawals']"
            ],
            formatUGX(totalWithdrawals)
        );

        setText(
            [
                "#totalInvestments",
                "#total-investments",
                "[data-stat='total-investments']"
            ],
            formatUGX(totalInvestments)
        );

        setText(
            [
                "#pendingDeposits",
                "#pending-deposits",
                "[data-stat='pending-deposits']"
            ],
            formatNumber(pendingDeposits)
        );

        setText(
            [
                "#pendingWithdrawals",
                "#pending-withdrawals",
                "[data-stat='pending-withdrawals']"
            ],
            formatNumber(pendingWithdrawals)
        );

        setText(
            [
                "#pendingInvestments",
                "#pending-investments",
                "[data-stat='pending-investments']"
            ],
            formatNumber(pendingInvestments)
        );

        renderRecentTransactions(root);
        renderRecentUsers(root);
    }


    /* ============================================================
       GENERIC TEXT SETTER
       ============================================================ */

    function setText(selectors, value) {
        if (!Array.isArray(selectors)) {
            selectors = [selectors];
        }

        for (const selector of selectors) {
            const elements = $$(selector);

            if (elements.length) {
                elements.forEach(element => {
                    element.textContent = value;
                });

                return;
            }
        }
    }


    /* ============================================================
       RECENT TRANSACTIONS
       ============================================================ */

    function renderRecentTransactions(root) {
        const transactions =
            extractArray(
                root.recent_transactions ||
                root.recentTransactions ||
                root.transactions ||
                [],
                [
                    "transactions",
                    "recent_transactions",
                    "recentTransactions"
                ]
            );

        const container =
            $(
                "#recentTransactionsList"
            ) ||
            $(
                "#recentTransactions"
            ) ||
            $(
                ".recent-transactions-list"
            );

        if (!container) {
            return;
        }

        if (!transactions.length) {
            container.innerHTML = `
                <div class="empty-state">
                    No recent transactions found.
                </div>
            `;

            return;
        }

        container.innerHTML = transactions
            .slice(0, 10)
            .map(transaction => {
                const type = getValue(
                    transaction,
                    ["type", "transaction_type", "transactionType"],
                    "Transaction"
                );

                const status = getValue(
                    transaction,
                    ["status"],
                    "unknown"
                );

                const amount = Number(
                    getValue(
                        transaction,
                        ["amount", "value"],
                        0
                    )
                );

                const date = getValue(
                    transaction,
                    [
                        "created_at",
                        "createdAt",
                        "date",
                        "timestamp",
                        "updated_at",
                        "updatedAt"
                    ],
                    null
                );

                const reference = getValue(
                    transaction,
                    [
                        "reference",
                        "transaction_id",
                        "transactionId"
                    ],
                    ""
                );

                return `
                    <div class="transaction-row">
                        <div class="transaction-main">
                            <strong>
                                ${escapeHTML(type)}
                            </strong>

                            ${
                                reference
                                    ? `
                                    <small>
                                        ${escapeHTML(reference)}
                                    </small>
                                    `
                                    : ""
                            }
                        </div>

                        <div class="transaction-amount">
                            ${formatUGX(amount)}
                        </div>

                        <div class="transaction-status">
                            <span class="status-badge ${statusClass(status)}">
                                ${escapeHTML(status)}
                            </span>
                        </div>

                        <div class="transaction-date">
                            ${escapeHTML(formatDate(date))}
                        </div>
                    </div>
                `;
            })
            .join("");
    }


    /* ============================================================
       RECENT USERS
       ============================================================ */

    function renderRecentUsers(root) {
        const users =
            extractArray(
                root.recent_users ||
                root.recentUsers ||
                root.users ||
                [],
                [
                    "users",
                    "recent_users",
                    "recentUsers"
                ]
            );

        const container =
            $(
                "#recentUsersList"
            ) ||
            $(
                "#recentUsers"
            ) ||
            $(
                ".recent-users-list"
            );

        if (!container) {
            return;
        }

        if (!users.length) {
            container.innerHTML = `
                <div class="empty-state">
                    No recent users found.
                </div>
            `;

            return;
        }

        container.innerHTML = users
            .slice(0, 10)
            .map(user => {
                const name = getValue(
                    user,
                    [
                        "full_name",
                        "fullName",
                        "name",
                        "username"
                    ],
                    "Unknown User"
                );

                const email = getValue(
                    user,
                    ["email"],
                    ""
                );

                const date = getValue(
                    user,
                    [
                        "created_at",
                        "createdAt",
                        "date",
                        "registered_at"
                    ],
                    null
                );

                const status = getValue(
                    user,
                    ["status", "account_status"],
                    "active"
                );

                return `
                    <div class="user-row">
                        <div class="user-main">
                            <strong>
                                ${escapeHTML(name)}
                            </strong>

                            ${
                                email
                                    ? `
                                    <small>
                                        ${escapeHTML(email)}
                                    </small>
                                    `
                                    : ""
                            }
                        </div>

                        <div class="user-status">
                            <span class="status-badge ${statusClass(status)}">
                                ${escapeHTML(status)}
                            </span>
                        </div>

                        <div class="user-date">
                            ${escapeHTML(formatDate(date))}
                        </div>
                    </div>
                `;
            })
            .join("");
    }


    /* ============================================================
       DEPOSITS
       ============================================================ */

    async function loadDeposits() {
        try {
            const data = await apiRequest(
                ENDPOINTS.deposits,
                {
                    method: "GET"
                },
                false
            );

            state.deposits = extractArray(
                data,
                [
                    "deposits",
                    "data",
                    "results",
                    "items"
                ]
            );

            renderDeposits(state.deposits);

            return state.deposits;

        } catch (error) {
            console.warn(
                "Crown Cash Admin: deposits request failed:",
                error.message
            );

            return [];
        }
    }

    function renderDeposits(items) {
        const container = findManagementContainer(
            "deposits"
        );

        if (!container) {
            return;
        }

        renderManagementTable(
            container,
            "Deposit Requests",
            items,
            "deposit"
        );
    }


    /* ============================================================
       WITHDRAWALS
       ============================================================ */

    async function loadWithdrawals() {
        try {
            const data = await apiRequest(
                ENDPOINTS.withdrawals,
                {
                    method: "GET"
                },
                false
            );

            state.withdrawals = extractArray(
                data,
                [
                    "withdrawals",
                    "data",
                    "results",
                    "items"
                ]
            );

            renderWithdrawals(state.withdrawals);

            return state.withdrawals;

        } catch (error) {
            console.warn(
                "Crown Cash Admin: withdrawals request failed:",
                error.message
            );

            return [];
        }
    }

    function renderWithdrawals(items) {
        const container = findManagementContainer(
            "withdrawals"
        );

        if (!container) {
            return;
        }

        renderManagementTable(
            container,
            "Withdrawal Requests",
            items,
            "withdrawal"
        );
    }


    /* ============================================================
       INVESTMENTS
       ============================================================ */

    async function loadInvestments() {
        try {
            const data = await apiRequest(
                ENDPOINTS.investments,
                {
                    method: "GET"
                },
                false
            );

            state.investments = extractArray(
                data,
                [
                    "investments",
                    "data",
                    "results",
                    "items"
                ]
            );

            renderInvestments(state.investments);

            return state.investments;

        } catch (error) {
            console.warn(
                "Crown Cash Admin: investments request failed:",
                error.message
            );

            return [];
        }
    }

    function renderInvestments(items) {
        const container = findManagementContainer(
            "investments"
        );

        if (!container) {
            return;
        }

        renderManagementTable(
            container,
            "Investment Requests",
            items,
            "investment"
        );
    }


    /* ============================================================
       MANAGEMENT CONTAINER
       ============================================================ */

    function findManagementContainer(type) {
        const selectors = {
            deposits: [
                "#deposits",
                "#depositManagement",
                "#depositsManagement",
                "[data-management='deposits']"
            ],

            withdrawals: [
                "#withdrawals",
                "#withdrawalManagement",
                "#withdrawalsManagement",
                "[data-management='withdrawals']"
            ],

            investments: [
                "#investments",
                "#investmentManagement",
                "#investmentsManagement",
                "[data-management='investments']"
            ]
        };

        for (const selector of selectors[type] || []) {
            const element = $(selector);

            if (element) {
                return element;
            }
        }

        return null;
    }


    /* ============================================================
       MANAGEMENT TABLE
       ============================================================ */

    function renderManagementTable(
        container,
        title,
        items,
        type
    ) {
        if (!container) {
            return;
        }

        if (!Array.isArray(items)) {
            items = [];
        }

        const rows = items.map(item => {
            const id = normalizeId(
                getValue(
                    item,
                    [
                        "_id",
                        "id",
                        "deposit_id",
                        "withdrawal_id",
                        "investment_id"
                    ],
                    ""
                )
            );

            const customer = resolveCustomer(item);

            const amount = Number(
                getValue(
                    item,
                    [
                        "amount",
                        "principal",
                        "investment_amount",
                        "value"
                    ],
                    0
                )
            );

            const status = getValue(
                item,
                ["status"],
                "pending"
            );

            const date = getValue(
                item,
                [
                    "created_at",
                    "createdAt",
                    "date",
                    "timestamp"
                ],
                null
            );

            return `
                <tr>
                    <td>
                        ${escapeHTML(
                            customer.name
                        )}
                        ${
                            customer.email
                                ? `
                                <br>
                                <small>
                                    ${escapeHTML(
                                        customer.email
                                    )}
                                </small>
                                `
                                : ""
                        }
                    </td>

                    <td>
                        ${formatUGX(amount)}
                    </td>

                    <td>
                        <span class="status-badge ${statusClass(status)}">
                            ${escapeHTML(status)}
                        </span>
                    </td>

                    <td>
                        ${escapeHTML(
                            formatDate(date)
                        )}
                    </td>

                    <td>
                        <div class="admin-actions">
                            ${
                                String(status).toLowerCase() === "pending"
                                    ? `
                                    <button
                                        type="button"
                                        class="admin-action-btn approve-btn"
                                        data-action="approve"
                                        data-type="${escapeHTML(type)}"
                                        data-id="${escapeHTML(id)}"
                                    >
                                        Approve
                                    </button>

                                    <button
                                        type="button"
                                        class="admin-action-btn reject-btn"
                                        data-action="reject"
                                        data-type="${escapeHTML(type)}"
                                        data-id="${escapeHTML(id)}"
                                    >
                                        Reject
                                    </button>
                                    `
                                    : `
                                    <span class="action-complete">
                                        No action
                                    </span>
                                    `
                            }
                        </div>
                    </td>
                </tr>
            `;
        }).join("");

        container.innerHTML = `
            <div class="management-panel">
                <div class="management-header">
                    <div>
                        <h2>
                            ${escapeHTML(title)}
                        </h2>

                        <p>
                            Review and manage ${escapeHTML(type)} requests.
                        </p>
                    </div>

                    <div>
                        <span class="management-count">
                            ${formatNumber(items.length)}
                        </span>
                    </div>
                </div>

                ${
                    items.length
                        ? `
                        <div class="table-wrapper">
                            <table class="admin-management-table">
                                <thead>
                                    <tr>
                                        <th>Customer</th>
                                        <th>Amount</th>
                                        <th>Status</th>
                                        <th>Date</th>
                                        <th>Action</th>
                                    </tr>
                                </thead>

                                <tbody>
                                    ${rows}
                                </tbody>
                            </table>
                        </div>
                        `
                        : `
                        <div class="empty-state">
                            No ${escapeHTML(type)} requests found.
                        </div>
                        `
                }
            </div>
        `;
    }


    /* ============================================================
       CUSTOMER RESOLUTION
       ============================================================ */

    function resolveCustomer(item) {
        const customer =
            item.user ||
            item.customer ||
            item.account ||
            item.member ||
            {};

        const name =
            getValue(
                customer,
                [
                    "full_name",
                    "fullName",
                    "name",
                    "username"
                ],
                ""
            ) ||
            getValue(
                item,
                [
                    "user_name",
                    "userName",
                    "customer_name",
                    "customerName",
                    "username",
                    "name"
                ],
                "Unknown User"
            );

        const email =
            getValue(
                customer,
                ["email"],
                ""
            ) ||
            getValue(
                item,
                ["email", "user_email"],
                ""
            );

        return {
            name,
            email
        };
    }


    /* ============================================================
       STATUS
       ============================================================ */

    function statusClass(status) {
        const value = String(
            status || ""
        ).toLowerCase();

        if (
            value === "approved" ||
            value === "completed" ||
            value === "active" ||
            value === "success" ||
            value === "successful"
        ) {
            return "status-approved";
        }

        if (
            value === "rejected" ||
            value === "failed" ||
            value === "cancelled" ||
            value === "canceled"
        ) {
            return "status-rejected";
        }

        if (
            value === "processing" ||
            value === "pending"
        ) {
            return "status-pending";
        }

        return "status-neutral";
    }


    /* ============================================================
       ACTION HANDLING
       ============================================================ */

    async function handleAction(
        type,
        id,
        action
    ) {
        if (!id) {
            alert("The request ID is missing.");
            return;
        }

        if (
            action !== "approve" &&
            action !== "reject"
        ) {
            return;
        }

        let reason = "";

        if (action === "reject") {
            reason = window.prompt(
                "Enter the reason for rejection:"
            );

            if (reason === null) {
                return;
            }

            reason = reason.trim();

            if (!reason) {
                alert(
                    "A rejection reason is required."
                );

                return;
            }
        }

        if (action === "approve") {
            const confirmed = window.confirm(
                `Are you sure you want to approve this ${type}?`
            );

            if (!confirmed) {
                return;
            }
        }

        const endpoints = {
            deposit: ENDPOINTS.deposits,
            withdrawal: ENDPOINTS.withdrawals,
            investment: ENDPOINTS.investments
        };

        const endpoint = endpoints[type];

        if (!endpoint) {
            alert("Unknown management type.");
            return;
        }

        const payload = {
            action,
            id
        };

        if (action === "reject") {
            payload.reason = reason;
            payload.rejection_reason = reason;
        }

        try {
            showActionBusy(type, id);

            await apiRequest(
                endpoint,
                {
                    method: "POST",
                    body: payload
                },
                false
            );

            alert(
                `${capitalize(action)} successful.`
            );

            await refreshEverything();

        } catch (error) {
            console.error(
                "Crown Cash Admin action error:",
                error
            );

            alert(
                error.message ||
                "The requested action could not be completed."
            );

        } finally {
            hideActionBusy(type, id);
        }
    }

    function capitalize(value) {
        if (!value) {
            return "";
        }

        return (
            String(value).charAt(0).toUpperCase() +
            String(value).slice(1)
        );
    }

    function showActionBusy(type, id) {
        const selector =
            `[data-action][data-type="${escapeAttribute(type)}"][data-id="${escapeAttribute(id)}"]`;

        $$(selector).forEach(button => {
            button.disabled = true;
            button.dataset.originalText =
                button.textContent;

            button.textContent = "Processing...";
        });
    }

    function hideActionBusy(type, id) {
        const selector =
            `[data-action][data-type="${escapeAttribute(type)}"][data-id="${escapeAttribute(id)}"]`;

        $$(selector).forEach(button => {
            button.disabled = false;

            if (button.dataset.originalText) {
                button.textContent =
                    button.dataset.originalText;
            }
        });
    }

    function escapeAttribute(value) {
        return String(value || "")
            .replace(/\\/g, "\\\\")
            .replace(/"/g, '\\"')
            .replace(/'/g, "\\'")
            .replace(/\]/g, "\\]");
    }


    /* ============================================================
       MAINTENANCE
       ============================================================ */

    async function loadMaintenance() {
        try {
            const data = await apiRequest(
                ENDPOINTS.maintenance,
                {
                    method: "GET"
                },
                false
            );

            state.maintenance =
                data.data ||
                data.maintenance ||
                data;

            renderMaintenance(
                state.maintenance
            );

            return state.maintenance;

        } catch (error) {
            console.warn(
                "Crown Cash Admin: maintenance request failed:",
                error.message
            );

            return null;
        }
    }

    function renderMaintenance(data) {
        if (!data || typeof data !== "object") {
            return;
        }

        const settings =
            data.settings ||
            data.controls ||
            data;

        setCheckbox(
            [
                "#maintenanceMode",
                "#maintenance",
                "[data-setting='maintenance_mode']"
            ],
            readBoolean(
                settings,
                [
                    "maintenance_mode",
                    "maintenanceMode"
                ]
            )
        );

        setCheckbox(
            [
                "#newInvestments",
                "#allowInvestments",
                "[data-setting='new_investments']"
            ],
            readBoolean(
                settings,
                [
                    "new_investments",
                    "newInvestments",
                    "investments_enabled"
                ],
                true
            )
        );

        setCheckbox(
            [
                "#depositsEnabled",
                "#allowDeposits",
                "[data-setting='deposits']"
            ],
            readBoolean(
                settings,
                [
                    "deposits",
                    "deposits_enabled",
                    "depositsEnabled"
                ],
                true
            )
        );

        setCheckbox(
            [
                "#withdrawalsEnabled",
                "#allowWithdrawals",
                "[data-setting='withdrawals']"
            ],
            readBoolean(
                settings,
                [
                    "withdrawals",
                    "withdrawals_enabled",
                    "withdrawalsEnabled"
                ],
                true
            )
        );

        setCheckbox(
            [
                "#dailyEarnings",
                "#dailyEarningsEnabled",
                "[data-setting='daily_earnings']"
            ],
            readBoolean(
                settings,
                [
                    "daily_earnings",
                    "dailyEarnings",
                    "daily_earnings_enabled"
                ],
                true
            )
        );

        setCheckbox(
            [
                "#userRegistration",
                "#registrationEnabled",
                "[data-setting='user_registration']"
            ],
            readBoolean(
                settings,
                [
                    "user_registration",
                    "userRegistration",
                    "registration_enabled"
                ],
                true
            )
        );

        const message = getValue(
            settings,
            [
                "maintenance_message",
                "maintenanceMessage",
                "message"
            ],
            ""
        );

        setValue(
            [
                "#maintenanceMessage",
                "#maintenanceMessageText",
                "textarea[name='maintenance_message']"
            ],
            message
        );

        const monitor =
            data.monitor ||
            data.earnings_engine ||
            data.earningsEngine ||
            {};

        setText(
            [
                "#earningsLastRun",
                "#lastEarningsRun",
                "[data-monitor='last-run']"
            ],
            formatDate(
                getValue(
                    monitor,
                    [
                        "last_run",
                        "lastRun",
                        "last_processed_at",
                        "lastProcessedAt"
                    ],
                    null
                )
            )
        );

        setText(
            [
                "#earningsProcessedToday",
                "#processedToday",
                "[data-monitor='processed-today']"
            ],
            formatUGX(
                getValue(
                    monitor,
                    [
                        "processed_today",
                        "processedToday",
                        "today"
                    ],
                    0
                )
            )
        );

        setText(
            [
                "#activeInvestments",
                "[data-monitor='active-investments']"
            ],
            formatNumber(
                getValue(
                    monitor,
                    [
                        "active_investments",
                        "activeInvestments"
                    ],
                    0
                )
            )
        );

        setText(
            [
                "#pendingInvestmentsMonitor",
                "#maintenancePendingInvestments",
                "[data-monitor='pending-investments']"
            ],
            formatNumber(
                getValue(
                    monitor,
                    [
                        "pending_investments",
                        "pendingInvestments"
                    ],
                    0
                )
            )
        );

        setText(
            [
                "#earningsEngineStatus",
                "[data-monitor='engine-status']"
            ],
            readBoolean(
                monitor,
                [
                    "enabled",
                    "active",
                    "running"
                ],
                false
            )
                ? "Enabled"
                : "Disabled"
        );
    }

    function readBoolean(
        object,
        keys,
        fallback = false
    ) {
        if (!object || typeof object !== "object") {
            return fallback;
        }

        for (const key of keys) {
            if (
                object[key] !== undefined &&
                object[key] !== null
            ) {
                const value = object[key];

                if (typeof value === "boolean") {
                    return value;
                }

                if (
                    value === 1 ||
                    value === "1" ||
                    String(value).toLowerCase() === "true" ||
                    String(value).toLowerCase() === "enabled" ||
                    String(value).toLowerCase() === "on"
                ) {
                    return true;
                }

                if (
                    value === 0 ||
                    value === "0" ||
                    String(value).toLowerCase() === "false" ||
                    String(value).toLowerCase() === "disabled" ||
                    String(value).toLowerCase() === "off"
                ) {
                    return false;
                }
            }
        }

        return fallback;
    }

    function setCheckbox(
        selectors,
        checked
    ) {
        if (!Array.isArray(selectors)) {
            selectors = [selectors];
        }

        for (const selector of selectors) {
            const elements = $$(selector);

            if (elements.length) {
                elements.forEach(element => {
                    if (
                        element instanceof HTMLInputElement &&
                        (
                            element.type === "checkbox" ||
                            element.type === "radio"
                        )
                    ) {
                        element.checked = Boolean(
                            checked
                        );
                    }
                });

                return;
            }
        }
    }

    function setValue(
        selectors,
        value
    ) {
        if (!Array.isArray(selectors)) {
            selectors = [selectors];
        }

        for (const selector of selectors) {
            const elements = $$(selector);

            if (elements.length) {
                elements.forEach(element => {
                    if (
                        "value" in element
                    ) {
                        element.value =
                            value ?? "";
                    }
                });

                return;
            }
        }
    }


    /* ============================================================
       SAVE MAINTENANCE SETTINGS
       ============================================================ */

    async function saveMaintenanceSettings() {
        const payload = {
            action: "update_settings",

            maintenance_mode:
                readCheckbox([
                    "#maintenanceMode",
                    "#maintenance",
                    "[data-setting='maintenance_mode']"
                ]),

            new_investments:
                readCheckbox([
                    "#newInvestments",
                    "#allowInvestments",
                    "[data-setting='new_investments']"
                ]),

            deposits:
                readCheckbox([
                    "#depositsEnabled",
                    "#allowDeposits",
                    "[data-setting='deposits']"
                ]),

            withdrawals:
                readCheckbox([
                    "#withdrawalsEnabled",
                    "#allowWithdrawals",
                    "[data-setting='withdrawals']"
                ]),

            daily_earnings:
                readCheckbox([
                    "#dailyEarnings",
                    "#dailyEarningsEnabled",
                    "[data-setting='daily_earnings']"
                ]),

            user_registration:
                readCheckbox([
                    "#userRegistration",
                    "#registrationEnabled",
                    "[data-setting='user_registration']"
                ]),

            maintenance_message:
                readInput([
                    "#maintenanceMessage",
                    "#maintenanceMessageText",
                    "textarea[name='maintenance_message']"
                ])
        };

        try {
            await apiRequest(
                ENDPOINTS.maintenance,
                {
                    method: "POST",
                    body: payload
                },
                false
            );

            alert(
                "Platform settings saved successfully."
            );

            await loadMaintenance();

        } catch (error) {
            console.error(
                "Crown Cash Admin: maintenance save error:",
                error
            );

            alert(
                error.message ||
                "Unable to save platform settings."
            );
        }
    }

    function readCheckbox(selectors) {
        if (!Array.isArray(selectors)) {
            selectors = [selectors];
        }

        for (const selector of selectors) {
            const element = $(selector);

            if (element) {
                return Boolean(
                    element.checked
                );
            }
        }

        return false;
    }

    function readInput(selectors) {
        if (!Array.isArray(selectors)) {
            selectors = [selectors];
        }

        for (const selector of selectors) {
            const element = $(selector);

            if (element) {
                return element.value || "";
            }
        }

        return "";
    }


    /* ============================================================
       REFRESH
       ============================================================ */

    async function refreshEverything() {
        if (!state.authenticated || !state.authorized) {
            return;
        }

        await Promise.allSettled([
            loadProfile(),
            loadDashboard(),
            loadDeposits(),
            loadWithdrawals(),
            loadInvestments(),
            loadMaintenance()
        ]);
    }


    /* ============================================================
       GENERAL EVENTS
       ============================================================ */

    function bindGeneralEvents() {
        /*
         * Approve / reject buttons
         */
        document.addEventListener(
            "click",
            event => {
                const button =
                    event.target.closest(
                        "[data-action][data-type][data-id]"
                    );

                if (!button) {
                    return;
                }

                const action =
                    button.getAttribute(
                        "data-action"
                    );

                const type =
                    button.getAttribute(
                        "data-type"
                    );

                const id =
                    button.getAttribute(
                        "data-id"
                    );

                handleAction(
                    type,
                    id,
                    action
                );
            }
        );

        /*
         * Save maintenance settings
         */
        const saveButtons = [
            "#savePlatformSettings",
            "#saveMaintenance",
            "#saveMaintenanceSettings",
            "[data-save-maintenance]"
        ];

        saveButtons.forEach(selector => {
            $$(selector).forEach(button => {
                button.addEventListener(
                    "click",
                    event => {
                        event.preventDefault();

                        saveMaintenanceSettings();
                    }
                );
            });
        });

        /*
         * Logout
         */
        const logoutButtons = [
            "#adminLogout",
            "#logout",
            "[data-admin-logout]"
        ];

        logoutButtons.forEach(selector => {
            $$(selector).forEach(button => {
                button.addEventListener(
                    "click",
                    event => {
                        event.preventDefault();

                        logoutAdmin();
                    }
                );
            });
        });
    }


    /* ============================================================
       MOBILE NAVIGATION
       ============================================================ */

    function initMobileNavigation() {
        const buttons = [
            "#mobileMenuButton",
            "#menuToggle",
            ".mobile-menu-toggle",
            "[data-mobile-menu]"
        ];

        let toggleButton = null;

        for (const selector of buttons) {
            toggleButton = $(selector);

            if (toggleButton) {
                break;
            }
        }

        const sidebar =
            $("#adminSidebar") ||
            $(".admin-sidebar") ||
            $(".sidebar");

        if (!toggleButton || !sidebar) {
            return;
        }

        toggleButton.addEventListener(
            "click",
            event => {
                event.preventDefault();

                sidebar.classList.toggle(
                    "open"
                );

                document.body.classList.toggle(
                    "sidebar-open"
                );
            }
        );

        $$(".admin-sidebar a, .sidebar a").forEach(
            link => {
                link.addEventListener(
                    "click",
                    () => {
                        sidebar.classList.remove(
                            "open"
                        );

                        document.body.classList.remove(
                            "sidebar-open"
                        );
                    }
                );
            }
        );
    }


    /* ============================================================
       HASH NAVIGATION
       ============================================================ */

    function handleHashNavigation() {
        const hash =
            window.location.hash;

        if (!hash) {
            return;
        }

        const id =
            hash.substring(1);

        if (!id) {
            return;
        }

        setTimeout(() => {
            const target =
                document.getElementById(id);

            if (target) {
                try {
                    target.scrollIntoView({
                        behavior: "smooth",
                        block: "start"
                    });
                } catch (error) {
                    target.scrollIntoView();
                }
            }
        }, 100);
    }


    /* ============================================================
       LOGOUT
       ============================================================ */

    async function logoutAdmin() {
        try {
            await apiRequest(
                ENDPOINTS.logout,
                {
                    method: "POST"
                },
                false
            );
        } catch (error) {
            console.warn(
                "Logout request failed:",
                error.message
            );
        } finally {
            window.location.href =
                "login.html";
        }
    }


    /* ============================================================
       CURRENT YEAR
       ============================================================ */

    function updateCurrentYear() {
        const year =
            new Date().getFullYear();

        $$("#currentYear").forEach(
            element => {
                element.textContent =
                    year;
            }
        );

        $$("[data-current-year]").forEach(
            element => {
                element.textContent =
                    year;
            }
        );
    }


    /* ============================================================
       GLOBAL API
       ============================================================ */

    window.CrownCashAdmin = {
        state,

        authenticateAdmin,
        loadProfile,
        loadDashboard,
        loadDeposits,
        loadWithdrawals,
        loadInvestments,
        loadMaintenance,
        refreshEverything,
        saveMaintenanceSettings,
        logoutAdmin,

        showLoader: showAdminLoader,
        hideLoader: hideAdminLoader
    };


    /* ============================================================
       INITIALIZATION
       ============================================================ */

    async function initializeAdmin() {
        if (state.initialized) {
            return;
        }

        state.initialized = true;
        state.loading = true;

        showAdminLoader();
        startLoaderFailsafe();

        /*
         * AUTHENTICATION IS THE ONLY BLOCKING OPERATION.
         */
        try {
            await authenticateAdmin();

        } catch (error) {
            console.error(
                "Crown Cash Admin authentication failed:",
                error
            );

            hideAdminLoader();

            return;
        }

        /*
         * IMPORTANT:
         *
         * Authentication succeeded.
         *
         * The loader has already been hidden inside
         * authenticateAdmin().
         *
         * The following requests are NON-BLOCKING from
         * the user's point of view.
         */
        try {
            bindGeneralEvents();
            initMobileNavigation();
            handleHashNavigation();
            updateCurrentYear();

            /*
             * Load all admin data in parallel.
             * A slow endpoint cannot keep the loader visible.
             */
            await Promise.allSettled([
                loadProfile(),
                loadDashboard(),
                loadDeposits(),
                loadWithdrawals(),
                loadInvestments(),
                loadMaintenance()
            ]);

        } catch (error) {
            console.error(
                "Crown Cash Admin initialization error:",
                error
            );

        } finally {
            /*
             * FINAL GUARANTEE:
             * The loader is always removed after initialization.
             */
            hideAdminLoader();
        }
    }


    /* ============================================================
       START
       ============================================================ */

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

})();