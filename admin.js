/* ==========================================================================
   CROWN CASH - ADMIN DASHBOARD
   Complete admin.js
   ========================================================================== */

(() => {
    "use strict";

    /* ----------------------------------------------------------------------
       CONFIGURATION
    ---------------------------------------------------------------------- */

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

    const LOGOUT_API =
        `${API_BASE}/logout.php`;

    const REQUEST_TIMEOUT = 15000;


    /* ----------------------------------------------------------------------
       STATE
    ---------------------------------------------------------------------- */

    const AdminDashboard = {
        authenticated: false,
        authorized: false,
        loading: false,

        data: null,
        profile: null,

        deposits: [],
        withdrawals: [],
        investments: [],

        initialized: false
    };


    /* ----------------------------------------------------------------------
       DOM HELPERS
    ---------------------------------------------------------------------- */

    const $ = (selector, parent = document) =>
        parent.querySelector(selector);

    const $$ = (selector, parent = document) =>
        Array.from(parent.querySelectorAll(selector));


    function setText(selector, value) {
        const element = $(selector);

        if (!element) return;

        if (
            value === null ||
            value === undefined ||
            value === ""
        ) {
            element.textContent = "0";
            return;
        }

        element.textContent = String(value);
    }


    function showElement(selector) {
        const element = $(selector);

        if (!element) return;

        element.classList.remove("hidden");

        if (element.dataset.previousDisplay) {
            element.style.display =
                element.dataset.previousDisplay;
        }
    }


    function hideElement(selector) {
        const element = $(selector);

        if (element) {
            element.classList.add("hidden");
        }
    }


    /* ----------------------------------------------------------------------
       LOADER
    ---------------------------------------------------------------------- */

    function showLoader() {
        const loader = $("#pageLoader");

        if (!loader) return;

        loader.classList.remove("hidden");
    }


    function hideLoader() {
        const loader = $("#pageLoader");

        if (!loader) return;

        loader.classList.add("hidden");
        loader.style.display = "none";
    }


    /* ----------------------------------------------------------------------
       MESSAGE
    ---------------------------------------------------------------------- */

    function showAdminMessage(
        message,
        type = "info"
    ) {
        let box = $("#adminMessage");

        if (!box) {
            box = document.createElement("div");

            box.id = "adminMessage";

            box.style.position = "fixed";
            box.style.top = "20px";
            box.style.right = "20px";
            box.style.zIndex = "99999";
            box.style.maxWidth = "420px";
            box.style.padding = "14px 18px";
            box.style.borderRadius = "12px";
            box.style.fontSize = "14px";
            box.style.fontWeight = "600";
            box.style.lineHeight = "1.45";
            box.style.boxShadow =
                "0 10px 30px rgba(0,0,0,.15)";

            document.body.appendChild(box);
        }

        const colors = {
            success: {
                background: "#e8f8ef",
                color: "#147a42"
            },

            error: {
                background: "#fdecec",
                color: "#b42318"
            },

            warning: {
                background: "#fff7e6",
                color: "#9a6700"
            },

            info: {
                background: "#eef4ff",
                color: "#2456a6"
            }
        };

        const selected =
            colors[type] ||
            colors.info;

        box.style.background =
            selected.background;

        box.style.color =
            selected.color;

        box.textContent =
            String(
                message ||
                "Operation completed."
            );

        box.style.display = "block";

        clearTimeout(box._hideTimer);

        box._hideTimer =
            setTimeout(() => {
                box.style.display = "none";
            }, 6000);
    }


    /* ----------------------------------------------------------------------
       FETCH
    ---------------------------------------------------------------------- */

    async function fetchWithTimeout(
        url,
        options = {},
        timeout = REQUEST_TIMEOUT
    ) {
        const controller =
            new AbortController();

        const timer =
            setTimeout(
                () => controller.abort(),
                timeout
            );

        try {
            return await fetch(
                url,
                {
                    ...options,

                    credentials: "include",

                    cache: "no-store",

                    signal:
                        controller.signal
                }
            );

        } finally {
            clearTimeout(timer);
        }
    }


    async function readJson(response) {

        const text =
            await response.text();

        if (!text) {
            return {};
        }

        try {
            return JSON.parse(text);

        } catch (error) {

            console.error(
                "Invalid JSON response:",
                {
                    status: response.status,
                    url: response.url,
                    text
                }
            );

            throw new Error(
                "The server returned an invalid response."
            );
        }
    }


    async function apiRequest(
        url,
        options = {},
        config = {}
    ) {
        const {
            redirectOnAuth = true,
            timeout = REQUEST_TIMEOUT
        } = config;

        let response;

        try {

            response =
                await fetchWithTimeout(
                    url,
                    {
                        ...options,

                        headers: {
                            Accept:
                                "application/json",

                            "Content-Type":
                                "application/json",

                            ...(options.headers || {})
                        }
                    },
                    timeout
                );

        } catch (error) {

            if (
                error.name ===
                "AbortError"
            ) {
                throw new Error(
                    "Request timed out. Please try again."
                );
            }

            console.error(
                "Network request failed:",
                {
                    url,
                    error
                }
            );

            throw new Error(
                "Unable to connect to the Crown Cash server."
            );
        }

        let data = {};

        try {
            data =
                await readJson(response);

        } catch (error) {

            if (!response.ok) {

                throw new Error(
                    `Server error (${response.status}).`
                );
            }

            throw error;
        }


        /* --------------------------------------------------------------
           DEBUGGING INFORMATION
        -------------------------------------------------------------- */

        console.log(
            "Crown Cash API:",
            {
                url,
                status: response.status,
                success: data?.success,
                message: data?.message
            }
        );


        /* --------------------------------------------------------------
           AUTHENTICATION
        -------------------------------------------------------------- */

        if (
            response.status === 401
        ) {

            AdminDashboard.authenticated =
                false;

            AdminDashboard.authorized =
                false;

            if (redirectOnAuth) {
                redirectToLogin();
            }

            throw new Error(
                data.message ||
                "Your session has expired."
            );
        }


        /* --------------------------------------------------------------
           AUTHORIZATION
        -------------------------------------------------------------- */

        if (
            response.status === 403
        ) {

            AdminDashboard.authorized =
                false;

            throw new Error(
                data.message ||
                "Administrator access denied."
            );
        }


        /* --------------------------------------------------------------
           SERVER ERRORS
        -------------------------------------------------------------- */

        if (!response.ok) {

            console.error(
                "Crown Cash API ERROR:",
                {
                    url,
                    status:
                        response.status,
                    statusText:
                        response.statusText,
                    response:
                        data
                }
            );

            throw new Error(
                data.message ||
                data.error ||
                data.details ||
                `Server error (${response.status}).`
            );
        }


        /* --------------------------------------------------------------
           APPLICATION ERRORS
        -------------------------------------------------------------- */

        if (
            Object.prototype.hasOwnProperty.call(
                data,
                "success"
            ) &&
            data.success === false
        ) {

            throw new Error(
                data.message ||
                data.error ||
                data.details ||
                "The requested operation failed."
            );
        }

        return data;
    }


    function redirectToLogin() {

        const loginPage =
            "login.html";

        if (
            !window.location.pathname.endsWith(
                loginPage
            )
        ) {
            window.location.href =
                loginPage;
        }
    }


    /* ----------------------------------------------------------------------
       ADMIN AUTHENTICATION
    ---------------------------------------------------------------------- */

    async function authenticateAdmin() {

        try {

            const data =
                await apiRequest(
                    ADMIN_AUTH_API,
                    {
                        method: "GET"
                    },
                    {
                        redirectOnAuth: false
                    }
                );

            const authenticated =
                data.authenticated === true;

            const authorized =
                data.authorized === true;

            AdminDashboard.authenticated =
                authenticated;

            AdminDashboard.authorized =
                authorized;

            if (
                !authenticated ||
                !authorized
            ) {

                showAdminMessage(
                    data.message ||
                    "Administrator access is required.",
                    "error"
                );

                setTimeout(
                    redirectToLogin,
                    1200
                );

                return false;
            }

            return true;

        } catch (error) {

            AdminDashboard.authenticated =
                false;

            AdminDashboard.authorized =
                false;

            console.error(
                "Admin authentication error:",
                error
            );

            showAdminMessage(
                error.message ||
                "Administrator authentication failed.",
                "error"
            );

            setTimeout(
                redirectToLogin,
                1200
            );

            return false;
        }
    }


    /* ----------------------------------------------------------------------
       PROFILE
    ---------------------------------------------------------------------- */

    async function loadAdminProfile() {

        try {

            const data =
                await apiRequest(
                    PROFILE_API,
                    {
                        method: "GET"
                    }
                );

            if (data.user) {

                AdminDashboard.profile =
                    data.user;

                renderAdminProfile(
                    data.user
                );
            }

            return data;

        } catch (error) {

            console.warn(
                "Admin profile could not be loaded:",
                error.message
            );

            return null;
        }
    }


    function renderAdminProfile(user) {

        const firstName =
            getValue(
                user,
                [
                    "first_name",
                    "firstName"
                ],
                ""
            );

        const lastName =
            getValue(
                user,
                [
                    "last_name",
                    "lastName"
                ],
                ""
            );

        let fullName =
            getValue(
                user,
                [
                    "name",
                    "full_name",
                    "fullName"
                ],
                ""
            );

        if (!fullName) {

            fullName =
                `${firstName} ${lastName}`
                    .trim();
        }

        if (!fullName) {
            fullName =
                "Administrator";
        }

        const email =
            getValue(
                user,
                ["email"],
                ""
            );

        const role =
            getValue(
                user,
                [
                    "role",
                    "account_type",
                    "accountType"
                ],
                "Administrator"
            );

        setText(
            "#adminName",
            fullName
        );

        setText(
            "#adminFirstName",
            firstName ||
            fullName.split(" ")[0]
        );

        setText(
            "#headerUserName",
            fullName
        );

        setText(
            "#accountName",
            fullName
        );

        setText(
            "#adminEmail",
            email
        );

        setText(
            "#adminAccountType",
            formatAccountType(role)
        );

        const avatar =
            $("#adminAvatar");

        if (avatar) {

            avatar.textContent =
                getInitials(fullName);
        }
    }


    /* ----------------------------------------------------------------------
       ADMIN DASHBOARD
    ---------------------------------------------------------------------- */

    async function loadDashboardData() {

        try {

            const data =
                await apiRequest(
                    ADMIN_DASHBOARD_API,
                    {
                        method: "GET"
                    }
                );

            AdminDashboard.data =
                data;

            if (data.admin) {

                renderAdminProfile(
                    data.admin
                );
            }

            renderDashboard(data);

            return data;

        } catch (error) {

            console.error(
                "Dashboard error:",
                error
            );

            renderDashboardError(
                error.message
            );

            throw error;
        }
    }


    function renderDashboard(data) {

        const stats =
            data.stats ||
            data.summary ||
            {};

        const pending =
            data.pending_activity ||
            {};


        /* USERS */

        setText(
            "#totalUsers",
            formatNumber(
                getNumericValue(
                    stats.total_users,
                    stats.users,
                    0
                )
            )
        );

        setText(
            "#activeUsers",
            formatNumber(
                getNumericValue(
                    stats.active_users,
                    0
                )
            )
        );

        setText(
            "#newAccounts",
            formatNumber(
                getNumericValue(
                    stats.new_accounts,
                    pending.new_accounts,
                    0
                )
            )
        );


        /* DEPOSITS */

        setText(
            "#totalDeposits",
            formatCurrency(
                getNumericValue(
                    stats.total_deposits,
                    stats.deposits,
                    0
                )
            )
        );

        setText(
            "#pendingDeposits",
            formatCurrency(
                getNumericValue(
                    stats.pending_deposits,
                    pending.deposits,
                    0
                )
            )
        );


        /* WITHDRAWALS */

        setText(
            "#totalWithdrawals",
            formatCurrency(
                getNumericValue(
                    stats.total_withdrawals,
                    stats.withdrawals,
                    0
                )
            )
        );

        setText(
            "#pendingWithdrawals",
            formatCurrency(
                getNumericValue(
                    stats.pending_withdrawals,
                    pending.withdrawals,
                    0
                )
            )
        );


        /* INVESTMENTS */

        setText(
            "#totalInvestments",
            formatCurrency(
                getNumericValue(
                    stats.total_investments,
                    stats.investments,
                    0
                )
            )
        );


        /* REFERRALS */

        setText(
            "#totalReferrals",
            formatNumber(
                getNumericValue(
                    stats.total_referrals,
                    stats.referrals,
                    0
                )
            )
        );


        /* TRANSACTIONS */

        setText(
            "#totalTransactions",
            formatNumber(
                getNumericValue(
                    stats.total_transactions,
                    stats.transactions,
                    0
                )
            )
        );


        /* SUPPORT */

        setText(
            "#openTickets",
            formatNumber(
                getNumericValue(
                    stats.open_tickets,
                    0
                )
            )
        );


        renderRecentTransactions(
            data.recent_transactions ||
            []
        );

        renderRecentUsers(
            data.recent_users ||
            []
        );
    }


    function renderDashboardError(message) {

        console.error(
            "Admin dashboard:",
            message
        );

        showAdminMessage(
            message ||
            "Unable to load dashboard data.",
            "error"
        );
    }


    /* ----------------------------------------------------------------------
       RECENT TRANSACTIONS
    ---------------------------------------------------------------------- */

    function renderRecentTransactions(
        transactions
    ) {

        const container =
            $("#recentTransactions");

        if (!container) return;

        if (
            !Array.isArray(transactions) ||
            transactions.length === 0
        ) {

            container.innerHTML = `
                <div class="empty-state">
                    <p>No recent transactions found.</p>
                </div>
            `;

            return;
        }

        container.innerHTML =
            transactions
                .map(transaction => {

                    const amount =
                        getNumericValue(
                            transaction.amount,
                            0
                        );

                    const type =
                        formatTransactionType(
                            transaction.type
                        );

                    const status =
                        formatStatus(
                            transaction.status
                        );

                    const date =
                        formatDate(
                            transaction.created_at
                        );

                    const name =
                        escapeHtml(
                            transaction.user_name ||
                            transaction.name ||
                            "Crown Cash User"
                        );

                    return `
                        <div class="transaction-item">

                            <div class="transaction-icon ${getTypeClass(transaction.type)}">
                                ${getTransactionIcon(transaction.type)}
                            </div>

                            <div class="transaction-details">
                                <strong>${name}</strong>
                                <span>${escapeHtml(type)}</span>
                                <small>${escapeHtml(date)}</small>
                            </div>

                            <div class="transaction-amount">
                                <strong>
                                    ${formatCurrency(amount)}
                                </strong>

                                <span class="${getStatusClass(transaction.status)}">
                                    ${escapeHtml(status)}
                                </span>
                            </div>

                        </div>
                    `;
                })
                .join("");
    }


    /* ----------------------------------------------------------------------
       RECENT USERS
    ---------------------------------------------------------------------- */

    function renderRecentUsers(users) {

        const container =
            $("#recentUsers");

        if (!container) return;

        if (
            !Array.isArray(users) ||
            users.length === 0
        ) {

            container.innerHTML = `
                <div class="empty-state">
                    <p>No users found.</p>
                </div>
            `;

            return;
        }

        container.innerHTML =
            users
                .map(user => {

                    const rawName =
                        user.name ||
                        `${user.first_name || ""} ${user.last_name || ""}`
                            .trim() ||
                        "Crown Cash User";

                    const name =
                        escapeHtml(rawName);

                    const email =
                        escapeHtml(
                            user.email || ""
                        );

                    const status =
                        formatStatus(
                            user.status
                        );

                    const date =
                        formatDate(
                            user.created_at
                        );

                    return `
                        <div class="user-item">

                            <div class="user-avatar">
                                ${escapeHtml(getInitials(rawName))}
                            </div>

                            <div class="user-details">
                                <strong>${name}</strong>
                                <span>${email}</span>
                                <small>${escapeHtml(date)}</small>
                            </div>

                            <span class="${getStatusClass(user.status)}">
                                ${escapeHtml(status)}
                            </span>

                        </div>
                    `;
                })
                .join("");
    }


    /* ----------------------------------------------------------------------
       APPROVAL CENTER
    ---------------------------------------------------------------------- */

    function createApprovalCenter() {

        if ($("#approvalCenter")) {
            return;
        }

        const pendingSection =
            $(".pending-section");

        if (!pendingSection) {
            return;
        }

        const section =
            document.createElement("section");

        section.id =
            "approvalCenter";

        section.className =
            "approval-center";

        section.innerHTML = `
            <div class="approval-header">

                <div>
                    <h2>Approval Center</h2>

                    <p>
                        Review and process pending
                        deposits, withdrawals and investments.
                    </p>
                </div>

                <button
                    type="button"
                    id="refreshApprovals"
                    class="approval-refresh"
                >
                    ↻ Refresh
                </button>

            </div>

            <div class="approval-tabs">

                <button
                    type="button"
                    class="approval-tab active"
                    data-approval-tab="deposits"
                >
                    Deposits
                    <span id="approvalDepositCount">0</span>
                </button>

                <button
                    type="button"
                    class="approval-tab"
                    data-approval-tab="withdrawals"
                >
                    Withdrawals
                    <span id="approvalWithdrawalCount">0</span>
                </button>

                <button
                    type="button"
                    class="approval-tab"
                    data-approval-tab="investments"
                >
                    Investments
                    <span id="approvalInvestmentCount">0</span>
                </button>

            </div>

            <div
                id="approvalDeposits"
                class="approval-panel active"
            ></div>

            <div
                id="approvalWithdrawals"
                class="approval-panel"
                style="display:none;"
            ></div>

            <div
                id="approvalInvestments"
                class="approval-panel"
                style="display:none;"
            ></div>
        `;

        pendingSection.insertAdjacentElement(
            "afterend",
            section
        );

        addApprovalStyles();

        setupApprovalTabs();

        const refreshButton =
            $("#refreshApprovals");

        if (refreshButton) {

            refreshButton.addEventListener(
                "click",
                async () => {

                    refreshButton.disabled =
                        true;

                    refreshButton.textContent =
                        "Refreshing...";

                    try {

                        await loadApprovalData();

                        showAdminMessage(
                            "Approval data refreshed.",
                            "success"
                        );

                    } catch (error) {

                        showAdminMessage(
                            error.message ||
                            "Unable to refresh approval data.",
                            "error"
                        );

                    } finally {

                        refreshButton.disabled =
                            false;

                        refreshButton.textContent =
                            "↻ Refresh";
                    }
                }
            );
        }
    }


    function addApprovalStyles() {

        if (
            $("#approvalCenterStyles")
        ) {
            return;
        }

        const style =
            document.createElement("style");

        style.id =
            "approvalCenterStyles";

        style.textContent = `
            #approvalCenter {
                margin-top: 24px;
                background: #fff;
                border-radius: 18px;
                padding: 20px;
                box-shadow: 0 8px 30px rgba(0,0,0,.06);
            }

            .approval-header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 20px;
                margin-bottom: 18px;
            }

            .approval-header h2 {
                margin: 0 0 5px;
            }

            .approval-header p {
                margin: 0;
                opacity: .7;
                font-size: 14px;
            }

            .approval-refresh {
                border: 0;
                border-radius: 10px;
                padding: 10px 15px;
                cursor: pointer;
                font-weight: 700;
            }

            .approval-refresh:disabled {
                opacity: .6;
                cursor: wait;
            }

            .approval-tabs {
                display: flex;
                gap: 8px;
                flex-wrap: wrap;
                margin-bottom: 16px;
            }

            .approval-tab {
                border: 0;
                padding: 10px 14px;
                border-radius: 10px;
                cursor: pointer;
                font-weight: 700;
                background: #f3f5f8;
            }

            .approval-tab.active {
                background: #111827;
                color: #fff;
            }

            .approval-tab span {
                display: inline-flex;
                min-width: 22px;
                height: 22px;
                align-items: center;
                justify-content: center;
                margin-left: 5px;
                border-radius: 50%;
                background: rgba(255,255,255,.2);
                font-size: 11px;
            }

            .approval-panel {
                display: block;
            }

            .approval-item {
                border: 1px solid #edf0f4;
                border-radius: 14px;
                padding: 16px;
                margin-bottom: 12px;
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 18px;
            }

            .approval-info {
                min-width: 0;
                flex: 1;
            }

            .approval-info strong {
                display: block;
                margin-bottom: 4px;
            }

            .approval-info span {
                display: block;
                font-size: 13px;
                opacity: .7;
                margin-bottom: 3px;
                overflow-wrap: anywhere;
            }

            .approval-amount {
                font-size: 17px;
                font-weight: 800;
                white-space: nowrap;
            }

            .approval-actions {
                display: flex;
                gap: 8px;
                flex-wrap: wrap;
            }

            .approval-actions button {
                border: 0;
                border-radius: 9px;
                padding: 9px 13px;
                cursor: pointer;
                font-weight: 700;
            }

            .approval-actions .approve-btn {
                background: #e8f8ef;
                color: #147a42;
            }

            .approval-actions .reject-btn {
                background: #fdecec;
                color: #b42318;
            }

            .approval-actions button:disabled {
                opacity: .5;
                cursor: wait;
            }

            .approval-empty {
                padding: 30px 15px;
                text-align: center;
                opacity: .65;
            }

            .approval-error {
                padding: 20px;
                border-radius: 12px;
                background: #fff4f4;
                color: #b42318;
                text-align: center;
            }

            @media (max-width: 700px) {

                .approval-header,
                .approval-item {
                    align-items: stretch;
                    flex-direction: column;
                }

                .approval-amount {
                    white-space: normal;
                }

                .approval-actions {
                    width: 100%;
                }

                .approval-actions button {
                    flex: 1;
                }
            }
        `;

        document.head.appendChild(style);
    }


    function setupApprovalTabs() {

        $$(".approval-tab")
            .forEach(tab => {

                tab.addEventListener(
                    "click",
                    () => {

                        $$(".approval-tab")
                            .forEach(button => {
                                button.classList.remove(
                                    "active"
                                );
                            });

                        $$(".approval-panel")
                            .forEach(panel => {

                                panel.style.display =
                                    "none";

                                panel.classList.remove(
                                    "active"
                                );
                            });

                        tab.classList.add(
                            "active"
                        );

                        const target =
                            tab.dataset.approvalTab;

                        const panel =
                            $(
                                `#approval${capitalize(target)}`
                            );

                        if (panel) {

                            panel.style.display =
                                "block";

                            panel.classList.add(
                                "active"
                            );
                        }
                    }
                );
            });
    }


    /* ----------------------------------------------------------------------
       APPROVAL DATA
    ---------------------------------------------------------------------- */

    async function loadApprovalData() {

        createApprovalCenter();

        const results =
            await Promise.allSettled([

                apiRequest(
                    ADMIN_DEPOSITS_API,
                    {
                        method: "GET"
                    }
                ),

                apiRequest(
                    ADMIN_WITHDRAWALS_API,
                    {
                        method: "GET"
                    }
                ),

                apiRequest(
                    ADMIN_INVESTMENTS_API,
                    {
                        method: "GET"
                    }
                )
            ]);

        const [
            depositResult,
            withdrawalResult,
            investmentResult
        ] = results;


        /* --------------------------------------------------------------
           DEPOSITS
        -------------------------------------------------------------- */

        if (
            depositResult.status ===
            "fulfilled"
        ) {

            AdminDashboard.deposits =
                extractArray(
                    depositResult.value,
                    [
                        "deposits",
                        "data",
                        "items",
                        "pending"
                    ]
                );

        } else {

            AdminDashboard.deposits =
                [];

            console.error(
                "Deposit approval request failed:",
                depositResult.reason
            );
        }


        /* --------------------------------------------------------------
           WITHDRAWALS
        -------------------------------------------------------------- */

        if (
            withdrawalResult.status ===
            "fulfilled"
        ) {

            AdminDashboard.withdrawals =
                extractArray(
                    withdrawalResult.value,
                    [
                        "withdrawals",
                        "data",
                        "items",
                        "pending"
                    ]
                );

            console.log(
                "Withdrawals loaded:",
                AdminDashboard.withdrawals
            );

        } else {

            AdminDashboard.withdrawals =
                [];

            console.error(
                "Withdrawal approval request failed:",
                withdrawalResult.reason
            );

            renderWithdrawalLoadError(
                withdrawalResult.reason
            );
        }


        /* --------------------------------------------------------------
           INVESTMENTS
        -------------------------------------------------------------- */

        if (
            investmentResult.status ===
            "fulfilled"
        ) {

            AdminDashboard.investments =
                extractArray(
                    investmentResult.value,
                    [
                        "investments",
                        "data",
                        "items",
                        "pending"
                    ]
                );

        } else {

            AdminDashboard.investments =
                [];

            console.error(
                "Investment approval request failed:",
                investmentResult.reason
            );
        }


        renderApprovalCenter();

        updatePendingBadges();

        return {
            deposits:
                AdminDashboard.deposits,

            withdrawals:
                AdminDashboard.withdrawals,

            investments:
                AdminDashboard.investments
        };
    }


    function renderWithdrawalLoadError(
        error
    ) {

        const container =
            $("#approvalWithdrawals");

        if (!container) return;

        const message =
            error?.message ||
            "Unable to load withdrawal requests.";

        container.innerHTML = `
            <div class="approval-error">
                <strong>
                    Unable to load withdrawal requests
                </strong>

                <p style="margin:8px 0 0;">
                    ${escapeHtml(message)}
                </p>

                <button
                    type="button"
                    id="retryWithdrawals"
                    style="
                        margin-top:12px;
                        border:0;
                        border-radius:9px;
                        padding:9px 14px;
                        cursor:pointer;
                        font-weight:700;
                    "
                >
                    Retry
                </button>
            </div>
        `;

        const retryButton =
            $("#retryWithdrawals");

        if (retryButton) {

            retryButton.addEventListener(
                "click",
                async () => {

                    retryButton.disabled =
                        true;

                    retryButton.textContent =
                        "Loading...";

                    try {

                        const data =
                            await apiRequest(
                                ADMIN_WITHDRAWALS_API,
                                {
                                    method: "GET"
                                }
                            );

                        AdminDashboard.withdrawals =
                            extractArray(
                                data,
                                [
                                    "withdrawals",
                                    "data",
                                    "items",
                                    "pending"
                                ]
                            );

                        renderApprovalCenter();

                        updatePendingBadges();

                        showAdminMessage(
                            "Withdrawals loaded successfully.",
                            "success"
                        );

                    } catch (retryError) {

                        console.error(
                            "Withdrawal retry failed:",
                            retryError
                        );

                        showAdminMessage(
                            retryError.message ||
                            "Unable to load withdrawals.",
                            "error"
                        );

                        retryButton.disabled =
                            false;

                        retryButton.textContent =
                            "Retry";
                    }
                }
            );
        }
    }


    function extractArray(
        data,
        keys
    ) {

        if (Array.isArray(data)) {
            return data;
        }

        if (
            data &&
            typeof data === "object"
        ) {

            for (const key of keys) {

                if (
                    Array.isArray(
                        data[key]
                    )
                ) {
                    return data[key];
                }
            }

            /*
             * Some APIs return the array inside:
             *
             * { result: { withdrawals: [] } }
             */

            if (
                data.result &&
                typeof data.result === "object"
            ) {

                for (const key of keys) {

                    if (
                        Array.isArray(
                            data.result[key]
                        )
                    ) {
                        return data.result[key];
                    }
                }
            }
        }

        return [];
    }


    /* ----------------------------------------------------------------------
       APPROVAL CENTER RENDER
    ---------------------------------------------------------------------- */

    function renderApprovalCenter() {

        renderDepositApprovals(
            AdminDashboard.deposits
        );

        renderWithdrawalApprovals(
            AdminDashboard.withdrawals
        );

        renderInvestmentApprovals(
            AdminDashboard.investments
        );

        setText(
            "#approvalDepositCount",
            AdminDashboard.deposits.length
        );

        setText(
            "#approvalWithdrawalCount",
            AdminDashboard.withdrawals.length
        );

        setText(
            "#approvalInvestmentCount",
            AdminDashboard.investments.length
        );
    }


    /* ----------------------------------------------------------------------
       DEPOSIT APPROVALS
    ---------------------------------------------------------------------- */

    function renderDepositApprovals(
        items
    ) {

        const container =
            $("#approvalDeposits");

        if (!container) return;

        if (
            !Array.isArray(items) ||
            items.length === 0
        ) {

            container.innerHTML = `
                <div class="approval-empty">
                    No pending deposits.
                </div>
            `;

            return;
        }

        container.innerHTML =
            items
                .map(item => {

                    const id =
                        getItemId(item);

                    const amount =
                        getNumericValue(
                            item.amount,
                            0
                        );

                    const name =
                        escapeHtml(
                            getValue(
                                item,
                                [
                                    "user_name",
                                    "name",
                                    "full_name"
                                ],
                                "Crown Cash User"
                            )
                        );

                    const phone =
                        escapeHtml(
                            getValue(
                                item,
                                [
                                    "phone",
                                    "phone_number",
                                    "mobile"
                                ],
                                ""
                            )
                        );

                    const reference =
                        escapeHtml(
                            getValue(
                                item,
                                [
                                    "reference",
                                    "transaction_reference",
                                    "payment_reference"
                                ],
                                ""
                            )
                        );

                    return `
                        <div
                            class="approval-item"
                            data-approval-id="${escapeHtml(id)}"
                        >

                            <div class="approval-info">

                                <strong>
                                    ${name}
                                </strong>

                                <span>
                                    ${phone}
                                </span>