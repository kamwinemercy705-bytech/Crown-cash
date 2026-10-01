/* ==========================================================================
   CROWN CASH - ADMIN DASHBOARD
   ========================================================================== */

(() => {
    "use strict";

    /* ----------------------------------------------------------------------
       CONFIGURATION
    ---------------------------------------------------------------------- */

    const API_BASE = "https://crown-cash1.onrender.com";

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

        if (element) {
            element.textContent =
                value === null ||
                value === undefined ||
                value === ""
                    ? "0"
                    : String(value);
        }
    }


    function showElement(selector) {
        const element = $(selector);

        if (element) {
            element.classList.remove("hidden");

            if (element.dataset.previousDisplay) {
                element.style.display =
                    element.dataset.previousDisplay;
            }
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

        /*
         * The existing admin.html has a CSS rule hiding the loader.
         * Do not force display if the page intentionally hides it.
         */
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

    function showAdminMessage(message, type = "info") {
        let box = $("#adminMessage");

        if (!box) {
            box = document.createElement("div");
            box.id = "adminMessage";

            box.style.position = "fixed";
            box.style.top = "20px";
            box.style.right = "20px";
            box.style.zIndex = "99999";
            box.style.maxWidth = "380px";
            box.style.padding = "14px 18px";
            box.style.borderRadius = "12px";
            box.style.fontSize = "14px";
            box.style.fontWeight = "600";
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
            colors[type] || colors.info;

        box.style.background =
            selected.background;

        box.style.color =
            selected.color;

        box.textContent = message;

        box.style.display = "block";

        clearTimeout(box._hideTimer);

        box._hideTimer = setTimeout(() => {
            box.style.display = "none";
        }, 5000);
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
            return await fetch(url, {
                ...options,
                credentials: "include",
                signal: controller.signal
            });
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
                text
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
                            "Content-Type":
                                "application/json",
                            ...(options.headers || {})
                        }
                    },
                    timeout
                );
        } catch (error) {
            if (error.name === "AbortError") {
                throw new Error(
                    "Request timed out. Please try again."
                );
            }

            throw new Error(
                "Unable to connect to the Crown Cash server."
            );
        }

        const data =
            await readJson(response);

        if (response.status === 401) {
            AdminDashboard.authenticated = false;
            AdminDashboard.authorized = false;

            if (redirectOnAuth) {
                redirectToLogin();
            }

            throw new Error(
                data.message ||
                "Your session has expired."
            );
        }

        if (response.status === 403) {
            AdminDashboard.authorized = false;

            throw new Error(
                data.message ||
                "Administrator access denied."
            );
        }

        if (!response.ok) {
            throw new Error(
                data.message ||
                `Server error (${response.status}).`
            );
        }

        if (
            Object.prototype.hasOwnProperty.call(
                data,
                "success"
            ) &&
            data.success === false
        ) {
            throw new Error(
                data.message ||
                "The requested operation failed."
            );
        }

        return data;
    }


    function redirectToLogin() {
        /*
         * Keep the existing login destination if one exists.
         */
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

            if (!authenticated || !authorized) {
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
            AdminDashboard.authenticated = false;
            AdminDashboard.authorized = false;

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

            /*
             * Dashboard authentication remains valid.
             * Use admin information returned by admin-dashboard.php.
             */
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
                `${firstName} ${lastName}`.trim();
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
            firstName || fullName.split(" ")[0]
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
            const initials =
                getInitials(fullName);

            avatar.textContent =
                initials;
        }
    }


    /* ----------------------------------------------------------------------
       DASHBOARD DATA
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


        /* ------------------------------------------------------------------
           USERS
        ------------------------------------------------------------------ */

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


        /* ------------------------------------------------------------------
           DEPOSITS
        ------------------------------------------------------------------ */

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


        /* ------------------------------------------------------------------
           WITHDRAWALS
        ------------------------------------------------------------------ */

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


        /* ------------------------------------------------------------------
           INVESTMENTS
        ------------------------------------------------------------------ */

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


        /* ------------------------------------------------------------------
           REFERRALS
        ------------------------------------------------------------------ */

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


        /* ------------------------------------------------------------------
           TRANSACTIONS
        ------------------------------------------------------------------ */

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


        /* ------------------------------------------------------------------
           SUPPORT
        ------------------------------------------------------------------ */

        setText(
            "#openTickets",
            formatNumber(
                getNumericValue(
                    stats.open_tickets,
                    0
                )
            )
        );


        /* ------------------------------------------------------------------
           RECENT TRANSACTIONS
        ------------------------------------------------------------------ */

        renderRecentTransactions(
            data.recent_transactions || []
        );


        /* ------------------------------------------------------------------
           RECENT USERS
        ------------------------------------------------------------------ */

        renderRecentUsers(
            data.recent_users || []
        );
    }


    function renderDashboardError(message) {
        console.error(
            "Admin dashboard:",
            message
        );

        /*
         * Do not destroy the existing design.
         * Keep visible values and show a notification.
         */
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

        if (!container) {
            return;
        }

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
            transactions.map(
                transaction => {

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

                    const typeClass =
                        getTypeClass(
                            transaction.type
                        );

                    const statusClass =
                        getStatusClass(
                            transaction.status
                        );

                    const icon =
                        getTransactionIcon(
                            transaction.type
                        );

                    return `
                        <div class="transaction-item">
                            <div class="transaction-icon ${typeClass}">
                                ${icon}
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

                                <span class="${statusClass}">
                                    ${escapeHtml(status)}
                                </span>
                            </div>
                        </div>
                    `;
                }
            )
            .join("");
    }


    /* ----------------------------------------------------------------------
       RECENT USERS
    ---------------------------------------------------------------------- */

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
                <div class="empty-state">
                    <p>No users found.</p>
                </div>
            `;

            return;
        }

        container.innerHTML =
            users.map(user => {

                const name =
                    escapeHtml(
                        user.name ||
                        `${user.first_name || ""} ${user.last_name || ""}`.trim() ||
                        "Crown Cash User"
                    );

                const email =
                    escapeHtml(
                        user.email ||
                        ""
                    );

                const status =
                    formatStatus(
                        user.status
                    );

                const date =
                    formatDate(
                        user.created_at
                    );

                const statusClass =
                    getStatusClass(
                        user.status
                    );

                const initials =
                    escapeHtml(
                        getInitials(
                            user.name ||
                            `${user.first_name || ""} ${user.last_name || ""}`
                        )
                    );

                return `
                    <div class="user-item">

                        <div class="user-avatar">
                            ${initials}
                        </div>

                        <div class="user-details">
                            <strong>${name}</strong>
                            <span>${email}</span>
                            <small>${escapeHtml(date)}</small>
                        </div>

                        <span class="${statusClass}">
                            ${escapeHtml(status)}
                        </span>

                    </div>
                `;
            }).join("");
    }


    /* ----------------------------------------------------------------------
       APPROVAL CENTER
    ---------------------------------------------------------------------- */

    function createApprovalCenter() {
        if (
            $("#approvalCenter")
        ) {
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
                            error.message,
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
        $$(".approval-tab").forEach(tab => {

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
                        $(`#approval${capitalize(target)}`);

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


        /*
         * Deposits
         */
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
            AdminDashboard.deposits = [];

            console.warn(
                "Deposit approval data:",
                depositResult.reason
            );
        }


        /*
         * Withdrawals
         */
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
        } else {
            AdminDashboard.withdrawals = [];

            console.warn(
                "Withdrawal approval data:",
                withdrawalResult.reason
            );
        }


        /*
         * Investments
         */
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
            AdminDashboard.investments = [];

            console.warn(
                "Investment approval data:",
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


    function extractArray(
        data,
        keys
    ) {
        if (Array.isArray(data)) {
            return data;
        }

        for (const key of keys) {
            if (Array.isArray(data?.[key])) {
                return data[key];
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


    function renderDepositApprovals(items) {
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
            items.map(
                item => {

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

                                <span>
                                    ${reference
                                        ? `Reference: ${reference}`
                                        : "Deposit awaiting approval"}
                                </span>
                            </div>

                            <div class="approval-amount">
                                ${formatCurrency(amount)}
                            </div>

                            <div class="approval-actions">

                                <button
                                    type="button"
                                    class="approve-btn"
                                    data-approval-action="approve"
                                    data-approval-type="deposit"
                                    data-approval-id="${escapeHtml(id)}"
                                >
                                    Approve
                                </button>

                                <button
                                    type="button"
                                    class="reject-btn"
                                    data-approval-action="reject"
                                    data-approval-type="deposit"
                                    data-approval-id="${escapeHtml(id)}"
                                >
                                    Reject
                                </button>

                            </div>

                        </div>
                    `;
                }
            )
            .join("");

        attachApprovalListeners(
            container
        );
    }


    function renderWithdrawalApprovals(items) {
        const container =
            $("#approvalWithdrawals");

        if (!container) return;

        if (
            !Array.isArray(items) ||
            items.length === 0
        ) {
            container.innerHTML = `
                <div class="approval-empty">
                    No pending withdrawals.
                </div>
            `;

            return;
        }

        container.innerHTML =
            items.map(
                item => {

                    const id =
                        getItemId(item);

                    const amount =
                        getNumericValue(
                            item.amount,
                            0
                        );

                    const netAmount =
                        getNumericValue(
                            item.net_amount,
                            item.netAmount,
                            amount
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

                                <span>
                                    Requested:
                                    ${formatCurrency(amount)}
                                </span>

                                <span>
                                    Net payout:
                                    ${formatCurrency(netAmount)}
                                </span>
                            </div>

                            <div class="approval-amount">
                                ${formatCurrency(amount)}
                            </div>

                            <div class="approval-actions">

                                <button
                                    type="button"
                                    class="approve-btn"
                                    data-approval-action="approve"
                                    data-approval-type="withdrawal"
                                    data-approval-id="${escapeHtml(id)}"
                                >
                                    Approve
                                </button>

                                <button
                                    type="button"
                                    class="reject-btn"
                                    data-approval-action="reject"
                                    data-approval-type="withdrawal"
                                    data-approval-id="${escapeHtml(id)}"
                                >
                                    Reject
                                </button>

                            </div>

                        </div>
                    `;
                }
            )
            .join("");

        attachApprovalListeners(
            container
        );
    }


    function renderInvestmentApprovals(items) {
        const container =
            $("#approvalInvestments");

        if (!container) return;

        if (
            !Array.isArray(items) ||
            items.length === 0
        ) {
            container.innerHTML = `
                <div class="approval-empty">
                    No pending investments.
                </div>
            `;

            return;
        }

        container.innerHTML =
            items.map(
                item => {

                    const id =
                        getItemId(item);

                    const amount =
                        getNumericValue(
                            item.amount,
                            item.principal,
                            0
                        );

                    const plan =
                        escapeHtml(
                            getValue(
                                item,
                                [
                                    "plan",
                                    "plan_name",
                                    "package"
                                ],
                                "Investment"
                            )
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

                    const duration =
                        getNumericValue(
                            item.duration,
                            item.duration_days,
                            0
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
                                    Plan: ${plan}
                                </span>

                                <span>
                                    ${
                                        duration > 0
                                            ? `${duration} days`
                                            : "Investment awaiting approval"
                                    }
                                </span>
                            </div>

                            <div class="approval-amount">
                                ${formatCurrency(amount)}
                            </div>

                            <div class="approval-actions">

                                <button
                                    type="button"
                                    class="approve-btn"
                                    data-approval-action="approve"
                                    data-approval-type="investment"
                                    data-approval-id="${escapeHtml(id)}"
                                >
                                    Approve
                                </button>

                                <button
                                    type="button"
                                    class="reject-btn"
                                    data-approval-action="reject"
                                    data-approval-type="investment"
                                    data-approval-id="${escapeHtml(id)}"
                                >
                                    Reject
                                </button>

                            </div>

                        </div>
                    `;
                }
            )
            .join("");

        attachApprovalListeners(
            container
        );
    }


    function attachApprovalListeners(
        container
    ) {
        container
            .querySelectorAll(
                "[data-approval-action]"
            )
            .forEach(button => {

                button.addEventListener(
                    "click",
                    async () => {

                        const action =
                            button.dataset.approvalAction;

                        const type =
                            button.dataset.approvalType;

                        const id =
                            button.dataset.approvalId;

                        if (
                            !id ||
                            !type ||
                            !action
                        ) {
                            return;
                        }

                        let reason = "";

                        if (action === "reject") {

                            reason =
                                window.prompt(
                                    "Enter the reason for rejecting this request:"
                                );

                            if (
                                reason === null
                            ) {
                                return;
                            }

                            reason =
                                reason.trim();

                            if (!reason) {
                                showAdminMessage(
                                    "A rejection reason is required.",
                                    "warning"
                                );

                                return;
                            }
                        }

                        const message =
                            action === "approve"
                                ? `Approve this ${type}?`
                                : `Reject this ${type}?`;

                        if (
                            !window.confirm(
                                message
                            )
                        ) {
                            return;
                        }

                        await processApproval(
                            type,
                            action,
                            id,
                            reason,
                            button
                        );
                    }
                );
            });
    }


    /* ----------------------------------------------------------------------
       PROCESS APPROVAL
    ---------------------------------------------------------------------- */

    async function processApproval(
        type,
        action,
        id,
        reason = "",
        button = null
    ) {
        if (!id) {
            showAdminMessage(
                "Invalid approval ID.",
                "error"
            );

            return false;
        }

        if (button) {
            button.disabled = true;
            button.textContent =
                action === "approve"
                    ? "Approving..."
                    : "Rejecting...";
        }

        let endpoint;

        switch (type) {

            case "deposit":
                endpoint =
                    ADMIN_DEPOSITS_API;
                break;

            case "withdrawal":
                endpoint =
                    ADMIN_WITHDRAWALS_API;
                break;

            case "investment":
                endpoint =
                    ADMIN_INVESTMENTS_API;
                break;

            default:
                showAdminMessage(
                    "Unknown approval type.",
                    "error"
                );

                if (button) {
                    button.disabled =
                        false;
                }

                return false;
        }


        const payload = {
            action,
            reason
        };


        if (type === "deposit") {
            payload.depositId = id;
        }

        if (type === "withdrawal") {
            payload.withdrawalId = id;
        }

        if (type === "investment") {
            payload.investmentId = id;
        }


        try {

            const data =
                await apiRequest(
                    endpoint,
                    {
                        method: "POST",
                        body: JSON.stringify(
                            payload
                        )
                    }
                );

            showAdminMessage(
                data.message ||
                `${capitalize(type)} ${action}d successfully.`,
                "success"
            );


            /*
             * Refresh everything after approval.
             */
            await Promise.allSettled([
                loadDashboardData(),
                loadApprovalData()
            ]);

            return true;

        } catch (error) {

            console.error(
                "Approval error:",
                error
            );

            showAdminMessage(
                error.message ||
                "Approval operation failed.",
                "error"
            );

            if (button) {
                button.disabled =
                    false;

                button.textContent =
                    action === "approve"
                        ? "Approve"
                        : "Reject";
            }

            return false;
        }
    }


    /* ----------------------------------------------------------------------
       PENDING BADGES
    ---------------------------------------------------------------------- */

    function updatePendingBadges() {

        const depositCount =
            AdminDashboard.deposits.length;

        const withdrawalCount =
            AdminDashboard.withdrawals.length;

        const investmentCount =
            AdminDashboard.investments.length;


        updateBadge(
            "#navPendingDeposits",
            depositCount
        );

        updateBadge(
            "#navPendingWithdrawals",
            withdrawalCount
        );


        /*
         * Create investment badge if the existing
         * admin.html does not contain one.
         */
        let investmentLink =
            document.querySelector(
                'a[href="admin-investments.html"]'
            );

        if (investmentLink) {

            let badge =
                investmentLink.querySelector(
                    ".nav-badge"
                );

            if (!badge) {
                badge =
                    document.createElement("span");

                badge.className =
                    "nav-badge";

                badge.id =
                    "navPendingInvestments";

                investmentLink.appendChild(
                    badge
                );
            }

            updateBadgeElement(
                badge,
                investmentCount
            );
        }
    }


    function updateBadge(
        selector,
        count
    ) {
        const badge =
            $(selector);

        if (!badge) return;

        updateBadgeElement(
            badge,
            count
        );
    }


    function updateBadgeElement(
        badge,
        count
    ) {
        const safeCount =
            Number.isFinite(Number(count))
                ? Number(count)
                : 0;

        badge.textContent =
            String(safeCount);

        /*
         * Keep the badge available in the DOM but
         * visually hide it when there is nothing pending.
         */
        if (safeCount <= 0) {
            badge.style.display =
                "none";
        } else {
            badge.style.display =
                "inline-flex";
        }
    }


    /* ----------------------------------------------------------------------
       SIDEBAR
    ---------------------------------------------------------------------- */

    function setupSidebar() {

        /*
         * admin.html already contains a mobile sidebar script.
         *
         * We intentionally use idempotent onclick handlers here instead
         * of adding another group of listeners that could fight with the
         * existing inline script.
         */

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
                sidebar.classList.add(
                    "open"
                );
            }

            if (overlay) {
                overlay.classList.add(
                    "open"
                );
            }

            document.body.style.overflow =
                "hidden";
        }


        function closeSidebar() {

            if (sidebar) {
                sidebar.classList.remove(
                    "open"
                );
            }

            if (overlay) {
                overlay.classList.remove(
                    "open"
                );
            }

            document.body.style.overflow =
                "";
        }


        /*
         * Only attach if the element does not already
         * have our admin handler.
         */
        if (
            menuButton &&
            !menuButton.dataset.ccAdminHandler
        ) {
            menuButton.dataset.ccAdminHandler =
                "true";

            menuButton.addEventListener(
                "click",
                event => {
                    event.stopPropagation();

                    if (
                        sidebar &&
                        sidebar.classList.contains(
                            "open"
                        )
                    ) {
                        closeSidebar();
                    } else {
                        openSidebar();
                    }
                }
            );
        }


        if (
            sidebarClose &&
            !sidebarClose.dataset.ccAdminHandler
        ) {
            sidebarClose.dataset.ccAdminHandler =
                "true";

            sidebarClose.addEventListener(
                "click",
                event => {
                    event.stopPropagation();
                    closeSidebar();
                }
            );
        }


        if (
            overlay &&
            !overlay.dataset.ccAdminHandler
        ) {
            overlay.dataset.ccAdminHandler =
                "true";

            overlay.addEventListener(
                "click",
                closeSidebar
            );
        }


        $$("#sidebar a").forEach(link => {

            if (
                link.dataset.ccAdminHandler
            ) {
                return;
            }

            link.dataset.ccAdminHandler =
                "true";

            link.addEventListener(
                "click",
                () => {
                    if (
                        window.innerWidth <=
                        1050
                    ) {
                        closeSidebar();
                    }
                }
            );
        });


        window.addEventListener(
            "resize",
            () => {
                if (
                    window.innerWidth >
                    1050
                ) {
                    closeSidebar();
                }
            }
        );
    }


    /* ----------------------------------------------------------------------
       LOGOUT
    ---------------------------------------------------------------------- */

    function setupLogout() {
        const logoutButton =
            $("#logoutBtn");

        if (!logoutButton) {
            return;
        }

        if (
            logoutButton.dataset.ccLogoutReady
        ) {
            return;
        }

        logoutButton.dataset.ccLogoutReady =
            "true";

        logoutButton.addEventListener(
            "click",
            async event => {

                event.preventDefault();

                if (
                    !window.confirm(
                        "Are you sure you want to logout?"
                    )
                ) {
                    return;
                }

                logoutButton.disabled =
                    true;

                logoutButton.textContent =
                    "Logging out...";

                await logoutAdmin(
                    logoutButton
                );
            }
        );
    }


    async function logoutAdmin(
        button = null
    ) {
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
                10000
            );

        } catch (error) {
            console.warn(
                "Logout request failed:",
                error.message
            );

        } finally {

            AdminDashboard.authenticated =
                false;

            AdminDashboard.authorized =
                false;

            window.location.href =
                "login.html";
        }
    }


    /* ----------------------------------------------------------------------
       FORMATTING
    ---------------------------------------------------------------------- */

    function formatCurrency(value) {
        const number =
            Number(value) || 0;

        return new Intl.NumberFormat(
            "en-UG",
            {
                style: "currency",
                currency: "UGX",
                maximumFractionDigits: 0
            }
        ).format(number);
    }


    function formatNumber(value) {
        const number =
            Number(value) || 0;

        return new Intl.NumberFormat(
            "en-UG"
        ).format(number);
    }


    function formatDate(value) {

        if (!value) {
            return "Date unavailable";
        }

        const date =
            new Date(value);

        if (
            Number.isNaN(
                date.getTime()
            )
        ) {
            return "Date unavailable";
        }

        return new Intl.DateTimeFormat(
            "en-UG",
            {
                year: "numeric",
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit"
            }
        ).format(date);
    }


    function formatStatus(status) {

        if (!status) {
            return "Unknown";
        }

        return String(status)
            .replace(/[_-]+/g, " ")
            .replace(/\s+/g, " ")
            .trim()
            .replace(
                /\b\w/g,
                letter =>
                    letter.toUpperCase()
            );
    }


    function formatTransactionType(type) {

        if (!type) {
            return "Transaction";
        }

        const map = {
            deposit: "Deposit",
            withdrawal: "Withdrawal",
            investment: "Investment",
            investment_principal:
                "Investment",
            daily_earning:
                "Daily Earning",
            referral_bonus:
                "Referral Bonus",
            refund:
                "Refund",
            fee:
                "Fee",
            debit:
                "Debit",
            credit:
                "Credit"
        };

        const key =
            String(type)
                .toLowerCase();

        return map[key] ||
            formatStatus(type);
    }


    function formatAccountType(type) {

        if (!type) {
            return "Administrator";
        }

        return String(type)
            .replace(/[_-]+/g, " ")
            .replace(/\b\w/g, letter =>
                letter.toUpperCase()
            );
    }


    function getTransactionIcon(type) {

        const key =
            String(type || "")
                .toLowerCase();

        const icons = {
            deposit: "↓",
            withdrawal: "↑",
            investment: "◆",
            investment_principal: "◆",
            daily_earning: "✦",
            referral_bonus: "★",
            refund: "↩",
            fee: "−",
            debit: "−",
            credit: "+"
        };

        return icons[key] || "•";
    }


    function getTypeClass(type) {

        const key =
            String(type || "")
                .toLowerCase();

        if (
            key.includes("deposit")
        ) {
            return "deposit";
        }

        if (
            key.includes("withdraw")
        ) {
            return "withdrawal";
        }

        if (
            key.includes("earning")
        ) {
            return "earning";
        }

        if (
            key.includes("referral")
        ) {
            return "referral";
        }

        if (
            key.includes("investment")
        ) {
            return "investment";
        }

        return "transaction";
    }


    function getStatusClass(status) {

        const key =
            String(status || "")
                .toLowerCase();

        if (
            [
                "approved",
                "active",
                "completed",
                "verified",
                "paid",
                "processed",
                "success",
                "successful"
            ].includes(key)
        ) {
            return "status-success";
        }

        if (
            [
                "pending",
                "processing",
                "submitted",
                "running"
            ].includes(key)
        ) {
            return "status-pending";
        }

        if (
            [
                "rejected",
                "declined",
                "cancelled",
                "canceled",
                "failed",
                "blocked",
                "suspended"
            ].includes(key)
        ) {
            return "status-danger";
        }

        return "status-neutral";
    }


    /* ----------------------------------------------------------------------
       VALUE HELPERS
    ---------------------------------------------------------------------- */

    function getNumericValue(
        ...values
    ) {
        for (const value of values) {

            if (
                value === null ||
                value === undefined ||
                value === ""
            ) {
                continue;
            }

            const number =
                Number(
                    String(value)
                        .replace(/,/g, "")
                );

            if (
                Number.isFinite(number)
            ) {
                return number;
            }
        }

        return 0;
    }


    function getValue(
        object,
        keys,
        fallback = ""
    ) {
        if (!object) {
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


    function getItemId(item) {

        if (!item) {
            return "";
        }

        return String(
            getValue(
                item,
                [
                    "_id",
                    "id",
                    "depositId",
                    "withdrawalId",
                    "investmentId"
                ],
                ""
            )
        );
    }


    function getInitials(name) {

        if (!name) {
            return "CC";
        }

        const parts =
            String(name)
                .trim()
                .split(/\s+/)
                .filter(Boolean);

        if (parts.length === 1) {
            return parts[0]
                .substring(0, 2)
                .toUpperCase();
        }

        return (
            parts[0][0] +
            parts[parts.length - 1][0]
        ).toUpperCase();
    }


    function capitalize(value) {

        if (!value) {
            return "";
        }

        return (
            String(value)
                .charAt(0)
                .toUpperCase() +
            String(value)
                .slice(1)
        );
    }


    /* ----------------------------------------------------------------------
       HTML ESCAPING
    ---------------------------------------------------------------------- */

    function escapeHtml(value) {

        return String(
            value === null ||
            value === undefined
                ? ""
                : value
        )
            .replace(
                /&/g,
                "&amp;"
            )
            .replace(
                /</g,
                "&lt;"
            )
            .replace(
                />/g,
                "&gt;"
            )
            .replace(
                /"/g,
                "&quot;"
            )
            .replace(
                /'/g,
                "&#039;"
            );
    }


    /* ----------------------------------------------------------------------
       GLOBAL ADMIN API
    ---------------------------------------------------------------------- */

    window.CrownCashAdmin = {

        reload: async () => {
            await Promise.allSettled([
                loadDashboardData(),
                loadApprovalData()
            ]);
        },

        loadDashboard:
            loadDashboardData,

        loadApprovals:
            loadApprovalData,

        refresh: async () => {
            await Promise.allSettled([
                loadDashboardData(),
                loadApprovalData()
            ]);
        },

        approveDeposit:
            id =>
                processApproval(
                    "deposit",
                    "approve",
                    id
                ),

        rejectDeposit:
            async id => {

                const reason =
                    window.prompt(
                        "Enter the reason for rejecting this deposit:"
                    );

                if (
                    reason === null ||
                    !reason.trim()
                ) {
                    return false;
                }

                return processApproval(
                    "deposit",
                    "reject",
                    id,
                    reason.trim()
                );
            },

        approveWithdrawal:
            id =>
                processApproval(
                    "withdrawal",
                    "approve",
                    id
                ),

        rejectWithdrawal:
            async id => {

                const reason =
                    window.prompt(
                        "Enter the reason for rejecting this withdrawal:"
                    );

                if (
                    reason === null ||
                    !reason.trim()
                ) {
                    return false;
                }

                return processApproval(
                    "withdrawal",
                    "reject",
                    id,
                    reason.trim()
                );
            },

        approveInvestment:
            id =>
                processApproval(
                    "investment",
                    "approve",
                    id
                ),

        rejectInvestment:
            async id => {

                const reason =
                    window.prompt(
                        "Enter the reason for rejecting this investment:"
                    );

                if (
                    reason === null ||
                    !reason.trim()
                ) {
                    return false;
                }

                return processApproval(
                    "investment",
                    "reject",
                    id,
                    reason.trim()
                );
            },

        logout:
            logoutAdmin
    };


    /* ----------------------------------------------------------------------
       INITIALIZATION
    ---------------------------------------------------------------------- */

    async function initializeAdminDashboard() {

        if (
            AdminDashboard.initialized
        ) {
            return;
        }

        AdminDashboard.initialized =
            true;

        AdminDashboard.loading =
            true;

        showLoader();

        try {

            /*
             * First verify administrator privileges.
             */
            const authenticated =
                await authenticateAdmin();

            if (!authenticated) {
                return;
            }


            /*
             * Setup existing page controls.
             */
            setupSidebar();
            setupLogout();


            /*
             * Create approval section.
             */
            createApprovalCenter();


            /*
             * Load all admin information.
             *
             * A profile failure does not prevent the dashboard
             * or approval center from loading.
             */
            const results =
                await Promise.allSettled([
                    loadAdminProfile(),
                    loadDashboardData(),
                    loadApprovalData()
                ]);


            const failures =
                results.filter(
                    result =>
                        result.status ===
                        "rejected"
                );


            if (
                failures.length > 0
            ) {
                console.warn(
                    "Some admin dashboard resources failed:",
                    failures
                );
            }


            /*
             * Final UI state.
             */
            AdminDashboard.loading =
                false;

        } catch (error) {

            console.error(
                "Admin initialization error:",
                error
            );

            showAdminMessage(
                error.message ||
                "Unable to initialize administrator dashboard.",
                "error"
            );

        } finally {

            AdminDashboard.loading =
                false;

            hideLoader();
        }
    }


    /* ----------------------------------------------------------------------
       START
    ---------------------------------------------------------------------- */

    if (
        document.readyState ===
        "loading"
    ) {
        document.addEventListener(
            "DOMContentLoaded",
            initializeAdminDashboard,
            {
                once: true
            }
        );
    } else {
        initializeAdminDashboard();
    }

})();