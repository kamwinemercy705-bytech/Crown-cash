/* =========================================================
   CROWN CASH — ADMIN CONTROLLER
   Production Admin Controller
   Version: 20261003ADMIN04

   FIXES:
   - Admin authentication
   - Dashboard statistics
   - Deposits management
   - Withdrawals management
   - Investments management
   - Approve / Reject actions
   - Flexible API response parsing
   - MongoDB date parsing
   - Investment customer-name resolution
   - Withdrawal request resolution
   - Refresh after actions
   - Maintenance controls
   - Secure logout
   ========================================================= */

(() => {
    "use strict";

    /* =====================================================
       CONFIG
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

        dashboard: null,
        profile: null,

        users: [],

        deposits: [],
        withdrawals: [],
        investments: [],

        maintenance: null,

        loading: {
            deposits: false,
            withdrawals: false,
            investments: false
        }
    };


    /* =====================================================
       DOM HELPERS
       ===================================================== */

    function byId(id) {
        return document.getElementById(id);
    }

    function qs(selector, root = document) {
        return root.querySelector(selector);
    }

    function qsa(selector, root = document) {
        return Array.from(root.querySelectorAll(selector));
    }

    function escapeHtml(value) {
        if (value === null || value === undefined) return "";

        return String(value)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function money(value) {
        const amount = Number(value || 0);

        return new Intl.NumberFormat("en-UG", {
            style: "currency",
            currency: "UGX",
            maximumFractionDigits: 0
        }).format(amount);
    }

    function number(value) {
        const n = Number(value || 0);

        return new Intl.NumberFormat("en-UG", {
            maximumFractionDigits: 0
        }).format(n);
    }


    /* =====================================================
       DATE HANDLING
       ===================================================== */

    function extractDateValue(value) {
        if (value === null || value === undefined) {
            return null;
        }

        if (value instanceof Date) {
            return value;
        }

        if (typeof value === "number") {
            // MongoDB / JavaScript timestamp
            const ms = value < 100000000000
                ? value * 1000
                : value;

            const date = new Date(ms);

            if (!Number.isNaN(date.getTime())) {
                return date;
            }
        }

        if (typeof value === "string") {
            const trimmed = value.trim();

            if (!trimmed) return null;

            const date = new Date(trimmed);

            if (!Number.isNaN(date.getTime())) {
                return date;
            }
        }

        if (typeof value === "object") {

            if (value.$date !== undefined) {
                return extractDateValue(value.$date);
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

            if (value.timestamp !== undefined) {
                return extractDateValue(value.timestamp);
            }

            if (value.time !== undefined) {
                return extractDateValue(value.time);
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
            return new Intl.DateTimeFormat("en-GB", {
                day: "2-digit",
                month: "short",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit"
            }).format(date);
        } catch (error) {
            return date.toLocaleString();
        }
    }


    /* =====================================================
       GENERIC VALUE HELPERS
       ===================================================== */

    function firstValue(obj, keys, fallback = "") {
        if (!obj || typeof obj !== "object") {
            return fallback;
        }

        for (const key of keys) {
            if (
                obj[key] !== undefined &&
                obj[key] !== null &&
                obj[key] !== ""
            ) {
                return obj[key];
            }
        }

        return fallback;
    }

    function getId(item, keys = []) {
        const value = firstValue(item, [
            ...keys,
            "_id",
            "id",
            "deposit_id",
            "withdrawal_id",
            "investment_id",
            "request_id"
        ], "");

        if (typeof value === "object" && value !== null) {
            if (value.$oid) return value.$oid;
            if (value.id) return value.id;
        }

        return value;
    }


    /* =====================================================
       RESPONSE ARRAY EXTRACTION
       ===================================================== */

    function extractArray(response, possibleKeys = []) {
        if (!response) {
            return [];
        }

        if (Array.isArray(response)) {
            return response;
        }

        const keys = [
            ...possibleKeys,
            "items",
            "records",
            "results",
            "requests",
            "data"
        ];

        for (const key of keys) {
            const value = response[key];

            if (Array.isArray(value)) {
                return value;
            }

            if (
                value &&
                typeof value === "object" &&
                Array.isArray(value.items)
            ) {
                return value.items;
            }

            if (
                value &&
                typeof value === "object" &&
                Array.isArray(value.records)
            ) {
                return value.records;
            }

            if (
                value &&
                typeof value === "object" &&
                Array.isArray(value.results)
            ) {
                return value.results;
            }

            if (
                value &&
                typeof value === "object" &&
                Array.isArray(value.requests)
            ) {
                return value.requests;
            }
        }

        return [];
    }


    /* =====================================================
       API REQUEST
       ===================================================== */

    async function apiRequest(url, options = {}, redirectOnAuth = false) {

        const controller = new AbortController();

        const timeout = setTimeout(() => {
            controller.abort();
        }, 20000);

        const requestOptions = {
            credentials: "include",
            ...options,
            signal: controller.signal,
            headers: {
                Accept: "application/json",
                ...(options.body
                    ? { "Content-Type": "application/json" }
                    : {}),
                ...(options.headers || {})
            }
        };

        try {

            const response = await fetch(url, requestOptions);

            const text = await response.text();

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

            if (error.name === "AbortError") {
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
       ADMIN AUTHENTICATION
       ===================================================== */

    async function authenticateAdmin() {

        try {

            const data = await apiRequest(
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

            if (!authenticated || !authorized) {
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

        } catch (error) {

            state.authenticated = false;
            state.authorized = false;

            throw error;
        }
    }


    /* =====================================================
       PROFILE
       ===================================================== */

    async function loadProfile() {

        try {

            const data = await apiRequest(
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
            firstValue(profile, [
                "full_name",
                "fullname",
                "name",
                "username"
            ], "Administrator");

        const email =
            firstValue(profile, [
                "email",
                "email_address"
            ], "");

        qsa("[data-admin-name]").forEach(el => {
            el.textContent = name;
        });

        qsa("[data-admin-email]").forEach(el => {
            el.textContent = email;
        });

        const nameElements = [
            byId("adminName"),
            byId("administratorName"),
            byId("welcomeAdminName")
        ];

        nameElements.forEach(el => {
            if (el) {
                el.textContent = name;
            }
        });
    }


    /* =====================================================
       DASHBOARD
       ===================================================== */

    async function loadDashboard() {

        const data = await apiRequest(
            ENDPOINTS.dashboard,
            {
                method: "GET"
            },
            false
        );

        state.dashboard = data;

        state.users = extractArray(
            data,
            [
                "users",
                "recent_users",
                "recentUsers"
            ]
        );

        renderDashboard(data);

        return data;
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

        renderRecentUsers(state.users);
    }


    function setText(ids, value) {

        if (!Array.isArray(ids)) {
            ids = [ids];
        }

        ids.forEach(id => {

            const el = byId(id);

            if (el) {
                el.textContent = value;
            }
        });
    }


    /* =====================================================
       RECENT TRANSACTIONS
       ===================================================== */

    function renderRecentTransactions(transactions) {

        const containers = [
            byId("recentTransactions"),
            byId("recentTransactionsList")
        ].filter(Boolean);

        if (!containers.length) return;

        if (!transactions.length) {

            containers.forEach(container => {
                container.innerHTML =
                    `<div class="empty-state">
                        No recent transactions found.
                    </div>`;
            });

            return;
        }

        const html = transactions
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
                            "time"
                        ],
                        null
                    );

                return `
                    <div class="transaction-item">
                        <div>
                            <strong>${escapeHtml(type)}</strong>
                            <div>${formatDate(date)}</div>
                        </div>

                        <div>
                            <strong>${money(amount)}</strong>
                            <div>${escapeHtml(status)}</div>
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

        if (!container) return;

        if (!users.length) {

            container.innerHTML =
                `<div class="empty-state">
                    No recent users found.
                </div>`;

            return;
        }

        container.innerHTML = users
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
                            <strong>${escapeHtml(name)}</strong>
                            <div>${escapeHtml(email)}</div>
                        </div>

                        <span>${escapeHtml(status)}</span>
                    </div>
                `;
            })
            .join("");
    }


    /* =====================================================
       MANAGEMENT CONTAINER FINDER
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

        for (const selector of selectors[type] || []) {

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
            findManagementContainer("deposits");

        if (container) {
            showManagementLoading(
                container,
                "Loading deposit requests..."
            );
        }

        try {

            const data = await apiRequest(
                ENDPOINTS.deposits,
                {
                    method: "GET"
                }
            );

            state.deposits = extractArray(
                data,
                [
                    "deposits",
                    "deposit_requests",
                    "pending_deposits",
                    "data"
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
            findManagementContainer("deposits");

        if (!container) return;

        const deposits = state.deposits;

        if (!deposits.length) {

            container.innerHTML =
                `<div class="empty-state">
                    No deposit requests found.
                </div>`;

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
                        ${deposits.map(renderDepositRow).join("")}
                    </tbody>
                </table>
            </div>
        `;

        bindManagementEvents();
    }


    function renderDepositRow(deposit) {

        const id = getId(deposit, [
            "deposit_id"
        ]);

        const user = getUserFromRecord(deposit);

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
                        "username"
                    ],
                    "Unknown Customer"
                )
            );

        const email =
            firstValue(
                user,
                [
                    "email"
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
                    "submitted_at"
                ],
                null
            );

        return `
            <tr>
                <td>
                    <strong>${escapeHtml(name)}</strong>
                    <small>${escapeHtml(email)}</small>
                </td>

                <td>
                    <strong>${money(amount)}</strong>
                </td>

                <td>${escapeHtml(method)}</td>

                <td>${escapeHtml(reference)}</td>

                <td>
                    ${statusBadge(status)}
                </td>

                <td>${formatDate(date)}</td>

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
            findManagementContainer("withdrawals");

        if (container) {
            showManagementLoading(
                container,
                "Loading withdrawal requests..."
            );
        }

        try {

            const data = await apiRequest(
                ENDPOINTS.withdrawals,
                {
                    method: "GET"
                }
            );

            /*
             * IMPORTANT:
             * Different versions of the PHP endpoint may return:
             *
             * withdrawals
             * withdrawal_requests
             * pending_withdrawals
             * requests
             * items
             * records
             * data
             */

            state.withdrawals = extractArray(
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
            findManagementContainer("withdrawals");

        if (!container) return;

        if (!state.withdrawals.length) {

            container.innerHTML =
                `<div class="management-toolbar">
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
                </div>`;

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


    function renderWithdrawalRow(withdrawal) {

        const id = getId(withdrawal, [
            "withdrawal_id"
        ]);

        const user = getUserFromRecord(withdrawal);

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
                        "username"
                    ],
                    "Unknown Customer"
                )
            );

        const email =
            firstValue(
                user,
                [
                    "email"
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
                    "destination"
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
                    "submitted_at"
                ],
                null
            );

        const userId =
            firstValue(
                withdrawal,
                [
                    "user_id",
                    "userId"
                ],
                firstValue(
                    user,
                    [
                        "_id",
                        "id",
                        "user_id"
                    ],
                    ""
                )
            );

        return `
            <tr>
                <td>
                    <strong>${escapeHtml(name)}</strong>
                    <small>${escapeHtml(email)}</small>
                </td>

                <td>
                    <strong>${money(amount)}</strong>
                </td>

                <td>${escapeHtml(method)}</td>

                <td>${escapeHtml(account)}</td>

                <td>${statusBadge(status)}</td>

                <td>${formatDate(date)}</td>

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
            findManagementContainer("investments");

        if (container) {
            showManagementLoading(
                container,
                "Loading investment requests..."
            );
        }

        try {

            const data = await apiRequest(
                ENDPOINTS.investments,
                {
                    method: "GET"
                }
            );

            state.investments = extractArray(
                data,
                [
                    "investments",
                    "investment_requests",
                    "pending_investments",
                    "requests"
                ]
            );

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


    function renderInvestments() {

        const container =
            findManagementContainer("investments");

        if (!container) return;

        if (!state.investments.length) {

            container.innerHTML =
                `<div class="management-toolbar">
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
                </div>`;

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


    function renderInvestmentRow(investment) {

        const id = getId(investment, [
            "investment_id"
        ]);

        const user = getUserFromRecord(investment);

        /*
         * Try many possible customer fields.
         */

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
                    investment,
                    [
                        "user_name",
                        "customer_name",
                        "customer",
                        "name",
                        "username",
                        "full_name"
                    ],
                    resolveUserName(
                        firstValue(
                            investment,
                            [
                                "user_id",
                                "userId"
                            ],
                            ""
                        )
                    ) || "Unknown Customer"
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
                    investment,
                    [
                        "user_email",
                        "email"
                    ],
                    ""
                )
            );

        const plan =
            firstValue(
                investment,
                [
                    "plan_name",
                    "plan",
                    "investment_plan",
                    "package"
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
                    "submitted_at"
                ],
                null
            );

        return `
            <tr>
                <td>
                    <strong>${escapeHtml(name)}</strong>
                    ${
                        email
                            ? `<small>${escapeHtml(email)}</small>`
                            : ""
                    }
                </td>

                <td>${escapeHtml(plan)}</td>

                <td>
                    <strong>${money(amount)}</strong>
                </td>

                <td>
                    ${escapeHtml(duration)} days
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

        if (!record || typeof record !== "object") {
            return {};
        }

        if (
            record.user &&
            typeof record.user === "object"
        ) {
            return record.user;
        }

        if (
            record.customer &&
            typeof record.customer === "object"
        ) {
            return record.customer;
        }

        if (
            record.account &&
            typeof record.account === "object"
        ) {
            return record.account;
        }

        const userId = firstValue(
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

        const normalizedId =
            normalizeId(userId);

        const found =
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
                        normalizedId
                );
            });

        return found || {};
    }


    function resolveUserName(userId) {

        if (!userId) return "";

        const normalized =
            normalizeId(userId);

        const user =
            state.users.find(item => {

                const ids = [
                    item?._id,
                    item?.id,
                    item?.user_id,
                    item?.userId
                ];

                return ids.some(
                    id =>
                        normalizeId(id) === normalized
                );
            });

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


    function normalizeId(value) {

        if (
            value === null ||
            value === undefined
        ) {
            return "";
        }

        if (
            typeof value === "object" &&
            value !== null
        ) {

            if (value.$oid) {
                return String(value.$oid);
            }

            if (value.id) {
                return String(value.id);
            }
        }

        return String(value);
    }


    /* =====================================================
       STATUS BADGE
       ===================================================== */

    function statusBadge(status) {

        const normalized =
            String(status || "unknown")
                .toLowerCase();

        return `
            <span class="status-badge status-${escapeHtml(normalized)}">
                ${escapeHtml(normalized)}
            </span>
        `;
    }


    /* =====================================================
       MANAGEMENT ACTIONS
       ===================================================== */

    function managementActions(
        type,
        id,
        status,
        userId = ""
    ) {

        const normalized =
            String(status || "")
                .toLowerCase();

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

        return "—";
    }


    /* =====================================================
       ACTION HANDLERS
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

        const payload = {
            deposit_id: depositId,
            id: depositId,
            action,
            status: action,
            note,
            reason: note,
            rejection_reason: note
        };

        const result = await apiRequest(
            ENDPOINTS.deposits,
            {
                method: "POST",
                body: JSON.stringify(payload)
            }
        );

        await refreshEverything();

        return result;
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

        const payload = {
            withdrawal_id: withdrawalId,
            id: withdrawalId,
            user_id: userId || "",
            action,
            status: action,
            note,
            reason: note,
            rejection_reason: note
        };

        const result = await apiRequest(
            ENDPOINTS.withdrawals,
            {
                method: "POST",
                body: JSON.stringify(payload)
            }
        );

        await refreshEverything();

        return result;
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

        const payload = {
            investment_id: investmentId,
            id: investmentId,
            action,
            status: action,
            note,
            reason: note,
            rejection_reason: note
        };

        const result = await apiRequest(
            ENDPOINTS.investments,
            {
                method: "POST",
                body: JSON.stringify(payload)
            }
        );

        await refreshEverything();

        return result;
    }


    /* =====================================================
       CONFIRMATION
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

            if (type === "deposit") {

                await processDepositAction(
                    id,
                    action,
                    note
                );

            } else if (type === "withdrawal") {

                await processWithdrawalAction(
                    id,
                    userId,
                    action,
                    note
                );

            } else if (type === "investment") {

                await processInvestmentAction(
                    id,
                    action,
                    note
                );
            }

            alert(
                `${capitalize(type)} ${action}d successfully.`
            );

        } catch (error) {

            console.error(error);

            alert(
                error.message ||
                `Unable to ${action} ${type}.`
            );
        }
    }


    /* =====================================================
       MANAGEMENT EVENTS
       ===================================================== */

    function bindManagementEvents() {

        qsa("[data-refresh]").forEach(button => {

            button.onclick = async () => {

                const type =
                    button.dataset.refresh;

                if (type === "deposits") {
                    await loadDeposits();
                }

                if (type === "withdrawals") {
                    await loadWithdrawals();
                }

                if (type === "investments") {
                    await loadInvestments();
                }
            };
        });


        qsa("[data-action]").forEach(button => {

            button.onclick = async () => {

                const actionType =
                    button.dataset.action;

                const id =
                    button.dataset.id;

                const userId =
                    button.dataset.userId || "";

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

                if (
                    actionType ===
                    "reject-deposit"
                ) {

                    await handleAction(
                        "deposit",
                        "reject",
                        id
                    );
                }

                if (
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

                if (
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

                if (
                    actionType ===
                    "approve-investment"
                ) {

                    await handleAction(
                        "investment",
                        "approve",
                        id
                    );
                }

                if (
                    actionType ===
                    "reject-investment"
                ) {

                    await handleAction(
                        "investment",
                        "reject",
                        id
                    );
                }
            };
        });
    }


    /* =====================================================
       MANAGEMENT LOADERS
       ===================================================== */

    async function loadManagementSection(type) {

        if (type === "deposits") {
            return loadDeposits();
        }

        if (type === "withdrawals") {
            return loadWithdrawals();
        }

        if (type === "investments") {
            return loadInvestments();
        }

        return [];
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

        const managementTypes = [
            "deposits",
            "withdrawals",
            "investments"
        ];

        if (
            managementTypes.includes(hash)
        ) {

            loadManagementSection(hash)
                .catch(error => {
                    console.error(
                        `Unable to load ${hash}:`,
                        error
                    );
                });
        }
    }


    /* =====================================================
       REFRESH ALL
       ===================================================== */

    async function refreshEverything() {

        try {
            await loadDashboard();
        } catch (error) {
            console.warn(
                "Dashboard refresh failed:",
                error.message
            );
        }

        await Promise.allSettled([
            loadDeposits(),
            loadWithdrawals(),
            loadInvestments()
        ]);

        try {
            await loadMaintenance();
        } catch (error) {
            console.warn(
                "Maintenance refresh failed:",
                error.message
            );
        }
    }


    /* =====================================================
       MAINTENANCE
       ===================================================== */

    async function loadMaintenance() {

        const data = await apiRequest(
            ENDPOINTS.maintenance,
            {
                method: "GET"
            }
        );

        state.maintenance =
            data?.settings ||
            data?.maintenance ||
            data?.data?.settings ||
            data?.data?.maintenance ||
            data;

        renderMaintenance();

        return state.maintenance;
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

        controls.forEach(([key, ids]) => {

            const value =
                Boolean(
                    settings[key] ??
                    settings[
                        camelCase(key)
                    ]
                );

            ids.forEach(id => {

                const element = byId(id);

                if (!element) return;

                if (
                    element.type ===
                    "checkbox"
                ) {
                    element.checked = value;
                }
            });
        });


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
            byId("maintenanceMessage");

        if (messageElement) {
            messageElement.value = message;
        }


        const active =
            firstValue(
                settings,
                [
                    "active_investments",
                    "activeInvestments"
                ],
                null
            );

        const pending =
            firstValue(
                settings,
                [
                    "pending_investments",
                    "pendingInvestments"
                ],
                null
            );

        setText(
            [
                "activeInvestments"
            ],
            active !== null
                ? number(active)
                : "0"
        );

        setText(
            [
                "pendingInvestments"
            ],
            pending !== null
                ? number(pending)
                : "0"
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
                byId("maintenanceMessage")?.value
                || ""
        };

        try {

            await apiRequest(
                ENDPOINTS.maintenance,
                {
                    method: "POST",
                    body: JSON.stringify(payload)
                }
            );

            await loadMaintenance();

            alert(
                "Platform settings saved successfully."
            );

        } catch (error) {

            console.error(error);

            alert(
                error.message ||
                "Unable to save platform settings."
            );
        }
    }


    function getCheckboxValue(ids) {

        for (const id of ids) {

            const element = byId(id);

            if (element) {
                return Boolean(element.checked);
            }
        }

        return false;
    }


    function camelCase(value) {

        return value.replace(
            /_([a-z])/g,
            (_, letter) =>
                letter.toUpperCase()
        );
    }


    /* =====================================================
       UI HELPERS
       ===================================================== */

    function showManagementLoading(
        container,
        message
    ) {

        container.innerHTML =
            `<div class="loading-state">
                ${escapeHtml(message)}
            </div>`;
    }


    function showManagementError(
        container,
        message
    ) {

        container.innerHTML =
            `<div class="error-state">
                ${escapeHtml(
                    message ||
                    "Unable to load records."
                )}
            </div>`;
    }


    function capitalize(value) {

        if (!value) return "";

        return value.charAt(0)
            .toUpperCase() +
            value.slice(1);
    }


    /* =====================================================
       LOGOUT
       ===================================================== */

    async function logout() {

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


    /* =====================================================
       MOBILE NAVIGATION
       ===================================================== */

    function initMobileNavigation() {

        const menuButton =
            byId("mobileMenuButton") ||
            qs("[data-mobile-menu]") ||
            qs(".mobile-menu-button");

        const sidebar =
            byId("adminSidebar") ||
            qs(".admin-sidebar") ||
            qs(".sidebar");

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
                    "open"
                );
            }
        );
    }


    /* =====================================================
       EVENT BINDING
       ===================================================== */

    function bindGeneralEvents() {

        const logoutButtons =
            qsa(
                "#logoutBtn, [data-admin-logout]"
            );

        logoutButtons.forEach(button => {

            button.addEventListener(
                "click",
                event => {

                    event.preventDefault();

                    logout();
                }
            );
        });


        const saveButton =
            byId("savePlatformSettings");

        if (saveButton) {

            saveButton.addEventListener(
                "click",
                event => {

                    event.preventDefault();

                    saveMaintenance();
                }
            );
        }


        window.addEventListener(
            "hashchange",
            handleHashNavigation
        );


        qsa(
            'a[href^="#"]'
        ).forEach(link => {

            link.addEventListener(
                "click",
                () => {

                    const sidebar =
                        qs(".admin-sidebar");

                    if (sidebar) {
                        sidebar.classList.remove(
                            "open"
                        );
                    }
                }
            );
        });
    }


    /* =====================================================
       GLOBAL ADMIN API
       ===================================================== */

    window.CrownCashAdmin = {

        loadDashboard,

        loadDeposits,

        loadWithdrawals,

        loadInvestments,

        loadMaintenance,

        refreshEverything,

        approveDeposit: depositId =>
            handleAction(
                "deposit",
                "approve",
                depositId
            ),

        rejectDeposit: depositId =>
            handleAction(
                "deposit",
                "reject",
                depositId
            ),

        approveWithdrawal: (
            withdrawalId,
            userId
        ) =>
            handleAction(
                "withdrawal",
                "approve",
                withdrawalId,
                userId
            ),

        rejectWithdrawal: (
            withdrawalId,
            userId
        ) =>
            handleAction(
                "withdrawal",
                "reject",
                withdrawalId,
                userId
            ),

        approveInvestment: investmentId =>
            handleAction(
                "investment",
                "approve",
                investmentId
            ),

        rejectInvestment: investmentId =>
            handleAction(
                "investment",
                "reject",
                investmentId
            )
    };


    /* =====================================================
       INITIALIZATION
       ===================================================== */

    async function init() {

        try {

            await authenticateAdmin();

            await Promise.allSettled([
                loadProfile(),
                loadDashboard(),
                loadDeposits(),
                loadWithdrawals(),
                loadInvestments(),
                loadMaintenance()
            ]);

            bindGeneralEvents();

            initMobileNavigation();

            handleHashNavigation();

            console.log(
                "Crown Cash Admin initialized successfully."
            );

        } catch (error) {

            console.error(
                "Admin initialization failed:",
                error
            );

            /*
             * Do not expose internal API details
             * to normal users.
             */

            const message =
                error.message ||
                "Administrator access required.";

            const loader =
                byId("adminLoader");

            if (loader) {
                loader.innerHTML =
                    `<div class="error-state">
                        ${escapeHtml(message)}
                    </div>`;
            }

            /*
             * Authentication endpoint already
             * controls unauthorized access.
             */
        }
    }


    if (
        document.readyState ===
        "loading"
    ) {

        document.addEventListener(
            "DOMContentLoaded",
            init
        );

    } else {
        init();
    }

})();