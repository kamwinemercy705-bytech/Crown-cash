/* ==========================================================================
   CROWN CASH - ADMIN DASHBOARD
   COMPLETE REPLACEMENT admin.js
   Version: 2026-10-03 ADMIN03
   ========================================================================== */

(() => {
    "use strict";

    /* ======================================================================
       CONFIGURATION
    ====================================================================== */

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

    const ADMIN_MAINTENANCE_API =
        `${API_BASE}/admin-maintenance.php`;

    const LOGOUT_API =
        `${API_BASE}/logout.php`;

    const REQUEST_TIMEOUT = 20000;


    /* ======================================================================
       STATE
    ====================================================================== */

    const AdminDashboard = {

        authenticated: false,

        authorized: false,

        loading: false,

        initialized: false,

        data: null,

        profile: null,

        deposits: [],

        withdrawals: [],

        investments: [],

        maintenance: null

    };


    /* ======================================================================
       DOM HELPERS
    ====================================================================== */

    function $(selector, parent = document) {

        return parent.querySelector(selector);

    }


    function $$(selector, parent = document) {

        return Array.from(
            parent.querySelectorAll(selector)
        );

    }


    function setText(selector, value) {

        const element = $(selector);

        if (!element) {
            return;
        }

        if (
            value === null ||
            value === undefined
        ) {

            element.textContent = "0";

            return;
        }

        element.textContent =
            String(value);
    }


    /* ======================================================================
       LOADER
    ====================================================================== */

    function showLoader() {

        const loader =
            $("#pageLoader");

        if (!loader) {
            return;
        }

        loader.classList.remove("hidden");

        loader.style.display =
            "flex";
    }


    function hideLoader() {

        const loader =
            $("#pageLoader");

        if (!loader) {
            return;
        }

        loader.classList.add("hidden");

        loader.style.display =
            "none";
    }


    /* ======================================================================
       MESSAGE
    ====================================================================== */

    function showAdminMessage(
        message,
        type = "info"
    ) {

        let box =
            $("#adminMessage");


        if (!box) {

            box =
                document.createElement("div");

            box.id =
                "adminMessage";

            box.style.position =
                "fixed";

            box.style.top =
                "20px";

            box.style.right =
                "20px";

            box.style.zIndex =
                "999999";

            box.style.maxWidth =
                "420px";

            box.style.padding =
                "14px 18px";

            box.style.borderRadius =
                "12px";

            box.style.fontSize =
                "14px";

            box.style.fontWeight =
                "600";

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
            message ||
            "Operation completed.";

        box.style.display =
            "block";


        clearTimeout(
            box._hideTimer
        );


        box._hideTimer =
            setTimeout(
                () => {

                    box.style.display =
                        "none";

                },
                7000
            );
    }


    /* ======================================================================
       FETCH
    ====================================================================== */

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

                    credentials:
                        "include",

                    cache:
                        "no-store",

                    signal:
                        controller.signal
                }
            );

        } finally {

            clearTimeout(timer);
        }
    }


    /* ======================================================================
       READ RESPONSE
    ====================================================================== */

    async function readResponse(
        response
    ) {

        const text =
            await response.text();


        let data = {};


        if (text) {

            try {

                data =
                    JSON.parse(text);

            } catch (error) {

                console.error(
                    "Invalid JSON from server:",
                    text
                );


                data = {

                    success: false,

                    message:
                        text.substring(
                            0,
                            500
                        )

                };
            }
        }


        data._httpStatus =
            response.status;

        data._ok =
            response.ok;


        return data;
    }


    /* ======================================================================
       API REQUEST
    ====================================================================== */

    async function apiRequest(
        url,
        options = {},
        config = {}
    ) {

        const {

            redirectOnAuth = false,

            timeout =
                REQUEST_TIMEOUT

        } = config;


        let response;


        try {

            response =
                await fetchWithTimeout(
                    url,
                    {
                        ...options,

                        headers: {

                            "Accept":
                                "application/json",

                            ...(options.body
                                ? {
                                    "Content-Type":
                                        "application/json"
                                }
                                : {}),

                            ...(options.headers ||
                                {})

                        }

                    },
                    timeout
                );

        } catch (error) {

            console.error(
                "Crown Cash network error:",
                url,
                error
            );


            if (
                error.name ===
                "AbortError"
            ) {

                throw new Error(
                    "Request timed out. Please try again."
                );
            }


            throw new Error(
                "Unable to connect to the Crown Cash server."
            );
        }


        const data =
            await readResponse(
                response
            );


        if (!response.ok) {

            console.error(
                "Crown Cash API error:",
                {
                    url,
                    status:
                        response.status,
                    response:
                        data
                }
            );
        }


        if (
            response.status ===
            401
        ) {

            if (redirectOnAuth) {

                AdminDashboard.authenticated =
                    false;

                AdminDashboard.authorized =
                    false;

                redirectToLogin();
            }


            throw new Error(
                data.message ||
                data.error ||
                "Administrator authentication is required."
            );
        }


        if (
            response.status ===
            403
        ) {

            throw new Error(
                data.message ||
                data.error ||
                "Administrator access denied."
            );
        }


        if (!response.ok) {

            const message =
                data.message ||
                data.error ||
                data.details ||
                data.reason ||
                `Server error (${response.status}).`;


            throw new Error(message);
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
                data.error ||
                "The requested operation failed."
            );
        }


        return data;
    }


    /* ======================================================================
       LOGIN REDIRECT
    ====================================================================== */

    function redirectToLogin() {

        if (
            window.location.pathname.endsWith(
                "login.html"
            )
        ) {
            return;
        }


        window.location.href =
            "login.html";
    }


    /* ======================================================================
       ADMIN AUTHENTICATION
    ====================================================================== */

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


            console.log(
                "Crown Cash admin authentication:",
                {
                    authenticated,
                    authorized,
                    response: data
                }
            );


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

            console.error(
                "Admin authentication failed:",
                error
            );


            AdminDashboard.authenticated =
                false;


            AdminDashboard.authorized =
                false;


            showAdminMessage(
                error.message ||
                "Administrator authentication failed.",
                "error"
            );


            setTimeout(
                redirectToLogin,
                1500
            );


            return false;
        }
    }


    /* ======================================================================
       PROFILE
    ====================================================================== */

    async function loadAdminProfile() {

        try {

            const data =
                await apiRequest(
                    PROFILE_API,
                    {
                        method: "GET"
                    }
                );


            const user =
                data.user ||
                data.admin ||
                data.profile ||
                null;


            if (user) {

                AdminDashboard.profile =
                    user;


                renderAdminProfile(
                    user
                );
            }


            return data;

        } catch (error) {

            console.warn(
                "Profile API failed:",
                error.message
            );


            return null;
        }
    }


    function renderAdminProfile(
        user
    ) {

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
                [
                    "email"
                ],
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


    /* ======================================================================
       DASHBOARD DATA
    ====================================================================== */

    async function loadDashboardData() {

        try {

            const data =
                await apiRequest(
                    ADMIN_DASHBOARD_API,
                    {
                        method: "GET"
                    }
                );


            console.log(
                "Crown Cash admin dashboard response:",
                data
            );


            AdminDashboard.data =
                data;


            const admin =
                data.admin ||
                data.user ||
                null;


            if (admin) {

                renderAdminProfile(
                    admin
                );
            }


            renderDashboard(
                data
            );


            return data;

        } catch (error) {

            console.error(
                "Admin dashboard API failed:",
                error
            );


            showAdminMessage(
                `Dashboard data could not be loaded: ${error.message}`,
                "error"
            );


            showDashboardConnectionError(
                error.message
            );


            return null;
        }
    }


    function renderDashboard(
        data
    ) {

        if (!data) {
            return;
        }


        const stats =
            data.stats ||
            data.summary ||
            data.overview ||
            data.statistics ||
            {};


        const pending =
            data.pending_activity ||
            data.pending ||
            data.pending_actions ||
            {};


        const users =
            data.users_summary ||
            data.user_stats ||
            {};


        const totalUsers =
            getNumericValue(
                stats.total_users,
                stats.users,
                stats.users_count,
                data.total_users,
                data.totalUsers,
                users.total_users,
                users.total,
                0
            );


        const activeUsers =
            getNumericValue(
                stats.active_users,
                stats.activeUsers,
                data.active_users,
                data.activeUsers,
                users.active_users,
                users.active,
                0
            );


        const newAccounts =
            getNumericValue(
                stats.new_accounts,
                stats.newAccounts,
                pending.new_accounts,
                pending.newAccounts,
                data.new_accounts,
                data.newAccounts,
                0
            );


        setText(
            "#totalUsers",
            formatNumber(totalUsers)
        );


        setText(
            "#activeUsers",
            formatNumber(activeUsers)
        );


        setText(
            "#newAccounts",
            formatNumber(newAccounts)
        );


        const totalDeposits =
            getNumericValue(
                stats.total_deposits,
                stats.totalDeposits,
                stats.deposits_total,
                data.total_deposits,
                data.totalDeposits,
                data.deposits_total,
                data.deposit_total,
                0
            );


        const pendingDeposits =
            getNumericValue(
                stats.pending_deposits,
                stats.pendingDeposits,
                pending.deposits,
                pending.pending_deposits,
                data.pending_deposits,
                data.pendingDeposits,
                0
            );


        setText(
            "#totalDeposits",
            formatCurrency(totalDeposits)
        );


        setText(
            "#pendingDeposits",
            formatCurrency(pendingDeposits)
        );


        const totalWithdrawals =
            getNumericValue(
                stats.total_withdrawals,
                stats.totalWithdrawals,
                stats.withdrawals_total,
                data.total_withdrawals,
                data.totalWithdrawals,
                data.withdrawals_total,
                data.withdrawal_total,
                0
            );


        const pendingWithdrawals =
            getNumericValue(
                stats.pending_withdrawals,
                stats.pendingWithdrawals,
                pending.withdrawals,
                pending.pending_withdrawals,
                data.pending_withdrawals,
                data.pendingWithdrawals,
                0
            );


        setText(
            "#totalWithdrawals",
            formatCurrency(totalWithdrawals)
        );


        setText(
            "#pendingWithdrawals",
            formatCurrency(pendingWithdrawals)
        );


        const totalInvestments =
            getNumericValue(
                stats.total_investments,
                stats.totalInvestments,
                stats.investments_total,
                data.total_investments,
                data.totalInvestments,
                data.investments_total,
                data.investment_total,
                0
            );


        setText(
            "#totalInvestments",
            formatCurrency(totalInvestments)
        );


        const totalReferrals =
            getNumericValue(
                stats.total_referrals,
                stats.totalReferrals,
                data.total_referrals,
                data.totalReferrals,
                0
            );


        setText(
            "#totalReferrals",
            formatNumber(totalReferrals)
        );


        const totalTransactions =
            getNumericValue(
                stats.total_transactions,
                stats.totalTransactions,
                data.total_transactions,
                data.totalTransactions,
                0
            );


        setText(
            "#totalTransactions",
            formatNumber(totalTransactions)
        );


        const openTickets =
            getNumericValue(
                stats.open_tickets,
                stats.openTickets,
                data.open_tickets,
                data.openTickets,
                0
            );


        setText(
            "#openTickets",
            formatNumber(openTickets)
        );


        renderRecentTransactions(
            data.recent_transactions ||
            data.recentTransactions ||
            data.transactions ||
            []
        );


        renderRecentUsers(
            data.recent_users ||
            data.recentUsers ||
            data.users ||
            []
        );
    }


    function showDashboardConnectionError(
        message
    ) {

        const transactionBox =
            $("#recentTransactions");


        const userBox =
            $("#recentUsers");


        if (transactionBox) {

            transactionBox.innerHTML = `
                <div class="empty-state">
                    <p>
                        Unable to load transactions.
                    </p>
                    <small>
                        ${escapeHtml(message || "")}
                    </small>
                </div>
            `;
        }


        if (userBox) {

            userBox.innerHTML = `
                <div class="empty-state">
                    <p>
                        Unable to load recent users.
                    </p>
                    <small>
                        ${escapeHtml(message || "")}
                    </small>
                </div>
            `;
        }
    }


    /* ======================================================================
       RECENT TRANSACTIONS
    ====================================================================== */

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
                            transaction.created_at ||
                            transaction.createdAt ||
                            transaction.date
                        );


                    const name =
                        escapeHtml(
                            transaction.user_name ||
                            transaction.userName ||
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

                                <strong>
                                    ${name}
                                </strong>

                                <span>
                                    ${escapeHtml(type)}
                                </span>

                                <small>
                                    ${escapeHtml(date)}
                                </small>

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
                })
                .join("");
    }


    /* ======================================================================
       RECENT USERS
    ====================================================================== */

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
                        user.full_name ||
                        user.fullName ||
                        `${user.first_name || ""} ${user.last_name || ""}`
                            .trim() ||
                        "Crown Cash User";


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
                            user.created_at ||
                            user.createdAt
                        );


                    const statusClass =
                        getStatusClass(
                            user.status
                        );


                    const initials =
                        escapeHtml(
                            getInitials(
                                rawName
                            )
                        );


                    return `
                        <div class="user-item">

                            <div class="user-avatar">
                                ${initials}
                            </div>

                            <div class="user-details">

                                <strong>
                                    ${escapeHtml(rawName)}
                                </strong>

                                <span>
                                    ${email}
                                </span>

                                <small>
                                    ${escapeHtml(date)}
                                </small>

                            </div>

                            <span class="${statusClass}">
                                ${escapeHtml(status)}
                            </span>

                        </div>
                    `;
                })
                .join("");
    }


    /* ======================================================================
       APPROVAL CENTER
    ====================================================================== */

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

                    <h2>
                        Approval Center
                    </h2>

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
                    <span id="approvalDepositCount">
                        0
                    </span>
                </button>


                <button
                    type="button"
                    class="approval-tab"
                    data-approval-tab="withdrawals"
                >
                    Withdrawals
                    <span id="approvalWithdrawalCount">
                        0
                    </span>
                </button>


                <button
                    type="button"
                    class="approval-tab"
                    data-approval-tab="investments"
                >
                    Investments
                    <span id="approvalInvestmentCount">
                        0
                    </span>
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

        if ($("#approvalCenterStyles")) {
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


    /* ======================================================================
       LOAD APPROVAL DATA
    ====================================================================== */

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


        const depositResult =
            results[0];

        const withdrawalResult =
            results[1];

        const investmentResult =
            results[2];


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
                "Deposit API failed:",
                depositResult.reason
            );
        }


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

            AdminDashboard.withdrawals =
                [];

            console.error(
                "Withdrawal API failed:",
                withdrawalResult.reason
            );


            const withdrawalPanel =
                $("#approvalWithdrawals");


            if (withdrawalPanel) {

                withdrawalPanel.innerHTML = `

                    <div class="approval-empty">

                        <strong>
                            Unable to load withdrawal requests
                        </strong>

                        <p style="margin-top:8px;">
                            ${escapeHtml(
                                withdrawalResult.reason?.message ||
                                "Withdrawal server error."
                            )}
                        </p>

                    </div>

                `;
            }
        }


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
                "Investment API failed:",
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

        if (
            Array.isArray(data)
        ) {
            return data;
        }


        for (
            const key of keys
        ) {

            if (
                Array.isArray(
                    data?.[key]
                )
            ) {

                return data[key];
            }
        }


        return [];
    }


    /* ======================================================================
       APPROVAL RENDER
    ====================================================================== */

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


    /* ======================================================================
       DEPOSITS
    ====================================================================== */

    function renderDepositApprovals(
        items
    ) {

        const container =
            $("#approvalDeposits");


        if (!container) {
            return;
        }


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
                            item.deposit_amount,
                            item.depositAmount,
                            0
                        );


                    const name =
                        escapeHtml(
                            getValue(
                                item,
                                [
                                    "user_name",
                                    "userName",
                                    "name",
                                    "full_name",
                                    "fullName"
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
                                    ${
                                        reference
                                            ? `Reference: ${reference}`
                                            : "Deposit awaiting approval"
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
                })
                .join("");


        attachApprovalListeners(
            container
        );
    }


    /* ======================================================================
       WITHDRAWALS
    ====================================================================== */

    function renderWithdrawalApprovals(
        items
    ) {

        const container =
            $("#approvalWithdrawals");


        if (!container) {
            return;
        }


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
            items
                .map(item => {

                    const id =
                        getItemId(item);


                    const amount =
                        getNumericValue(
                            item.amount,
                            item.requested_amount,
                            item.requestedAmount,
                            0
                        );


                    const netAmount =
                        getNumericValue(
                            item.net_amount,
                            item.netAmount,
                            item.payout_amount,
                            item.payoutAmount,
                            amount
                        );


                    const fee =
                        getNumericValue(
                            item.fee,
                            item.withdrawal_fee,
                            0
                        );


                    const name =
                        escapeHtml(
                            getValue(
                                item,
                                [
                                    "user_name",
                                    "userName",
                                    "name",
                                    "full_name",
                                    "fullName"
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


                    const method =
                        escapeHtml(
                            getValue(
                                item,
                                [
                                    "method",
                                    "payment_method"
                                ],
                                ""
                            )
                        );


                    const account =
                        escapeHtml(
                            getValue(
                                item,
                                [
                                    "account",
                                    "account_number",
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

                                ${
                                    method
                                        ? `<span>Method: ${method}</span>`
                                        : ""
                                }

                                ${
                                    account
                                        ? `<span>Payment: ${account}</span>`
                                        : ""
                                }

                                <span>
                                    Requested:
                                    ${formatCurrency(amount)}
                                </span>

                                <span>
                                    Fee:
                                    ${formatCurrency(fee)}
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
                })
                .join("");


        attachApprovalListeners(
            container
        );
    }


    /* ======================================================================
       INVESTMENTS
    ====================================================================== */

    function renderInvestmentApprovals(
        items
    ) {

        const container =
            $("#approvalInvestments");


        if (!container) {
            return;
        }


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
            items
                .map(item => {

                    const id =
                        getItemId(item);


                    const amount =
                        getNumericValue(
                            item.amount,
                            item.principal,
                            item.investment_amount,
                            item.investmentAmount,
                            0
                        );


                    const plan =
                        escapeHtml(
                            getValue(
                                item,
                                [
                                    "plan",
                                    "plan_name",
                                    "package",
                                    "package_name"
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
                                    "userName",
                                    "name",
                                    "full_name",
                                    "fullName"
                                ],
                                "Crown Cash User"
                            )
                        );


                    const duration =
                        getNumericValue(
                            item.duration,
                            item.duration_days,
                            item.durationDays,
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
                })
                .join("");


        attachApprovalListeners(
            container
        );
    }


    /* ======================================================================
       APPROVAL LISTENERS
    ====================================================================== */

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

                            showAdminMessage(
                                "Invalid approval request.",
                                "error"
                            );

                            return;
                        }


                        let reason = "";


                        if (
                            action ===
                            "reject"
                        ) {

                            reason =
                                window.prompt(
                                    "Enter the reason for rejecting this request:"
                                );


                            if (
                                reason ===
                                null
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


                        const confirmed =
                            window.confirm(
                                action === "approve"
                                    ? `Approve this ${type}?`
                                    : `Reject this ${type}?`
                            );


                        if (!confirmed) {
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


    /* ======================================================================
       PROCESS APPROVAL
    ====================================================================== */

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

            button.disabled =
                true;

            button.textContent =
                action === "approve"
                    ? "Approving..."
                    : "Rejecting...";
        }


        let endpoint;


        if (type === "deposit") {

            endpoint =
                ADMIN_DEPOSITS_API;

        } else if (type === "withdrawal") {

            endpoint =
                ADMIN_WITHDRAWALS_API;

        } else if (type === "investment") {

            endpoint =
                ADMIN_INVESTMENTS_API;

        } else {

            showAdminMessage(
                "Unknown approval type.",
                "error"
            );

            return false;
        }


        const payload = {

            action,

            reason,

            note:
                reason,

            admin_note:
                reason
        };


        if (type === "deposit") {

            payload.depositId =
                id;

            payload.deposit_id =
                id;
        }


        if (type === "withdrawal") {

            payload.withdrawalId =
                id;

            payload.withdrawal_id =
                id;
        }


        if (type === "investment") {

            payload.investmentId =
                id;

            payload.investment_id =
                id;
        }


        try {

            const data =
                await apiRequest(
                    endpoint,
                    {
                        method: "POST",

                        body:
                            JSON.stringify(
                                payload
                            )
                    }
                );


            showAdminMessage(
                data.message ||
                `${capitalize(type)} ${action}d successfully.`,
                "success"
            );


            await Promise.allSettled([

                loadDashboardData(),

                loadApprovalData()

            ]);


            return true;

        } catch (error) {

            console.error(
                "Approval operation failed:",
                {
                    type,
                    action,
                    id,
                    error
                }
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


    /* ======================================================================
       PENDING BADGES
    ====================================================================== */

    function updatePendingBadges() {

        updateBadge(
            "#navPendingDeposits",
            AdminDashboard.deposits.length
        );


        updateBadge(
            "#navPendingWithdrawals",
            AdminDashboard.withdrawals.length
        );


        const investmentLink =
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
                    document.createElement(
                        "span"
                    );


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
                AdminDashboard.investments.length
            );
        }
    }


    function updateBadge(
        selector,
        count
    ) {

        const badge =
            $(selector);


        if (!badge) {
            return;
        }


        updateBadgeElement(
            badge,
            count
        );
    }


    function updateBadgeElement(
        badge,
        count
    ) {

        const number =
            Number(count);


        const safeCount =
            Number.isFinite(number)
                ? number
                : 0;


        badge.textContent =
            String(safeCount);


        badge.style.display =
            safeCount > 0
                ? "inline-flex"
                : "none";
    }


    /* ======================================================================
       MAINTENANCE
       ====================================================================== */

    async function loadMaintenanceSettings() {

        try {

            const data =
                await apiRequest(
                    ADMIN_MAINTENANCE_API,
                    {
                        method: "GET"
                    }
                );


            const settings =
                data.settings ||
                data.maintenance ||
                data.data ||
                data;


            AdminDashboard.maintenance =
                settings;


            renderMaintenanceSettings(
                settings
            );


            return settings;

        } catch (error) {

            console.error(
                "Maintenance settings failed:",
                error
            );


            showMaintenanceError(
                error.message
            );


            return null;
        }
    }


    function renderMaintenanceSettings(
        settings
    ) {

        if (!settings) {
            return;
        }


        const maintenanceMode =
            getBooleanValue(
                settings.maintenance_mode,
                settings.maintenanceMode,
                settings.system_maintenance,
                false
            );


        const investments =
            getBooleanValue(
                settings.investments_enabled,
                settings.new_investments,
                settings.newInvestments,
                true
            );


        const deposits =
            getBooleanValue(
                settings.deposits_enabled,
                settings.deposits,
                true
            );


        const withdrawals =
            getBooleanValue(
                settings.withdrawals_enabled,
                settings.withdrawals,
                true
            );


        const earnings =
            getBooleanValue(
                settings.earnings_enabled,
                settings.daily_earnings,
                settings.dailyEarnings,
                true
            );


        const registration =
            getBooleanValue(
                settings.registration_enabled,
                settings.user_registration,
                settings.userRegistration,
                true
            );


        setCheckbox(
            "#maintenanceModeToggle",
            maintenanceMode
        );


        setCheckbox(
            "#maintenanceInvestmentsToggle",
            investments
        );


        setCheckbox(
            "#maintenanceDepositsToggle",
            deposits
        );


        setCheckbox(
            "#maintenanceWithdrawalsToggle",
            withdrawals
        );


        setCheckbox(
            "#maintenanceEarningsToggle",
            earnings
        );


        setCheckbox(
            "#maintenanceRegistrationToggle",
            registration
        );


        const message =
            getValue(
                settings,
                [
                    "maintenance_message",
                    "maintenanceMessage",
                    "message"
                ],
                ""
            );


        const messageBox =
            $("#maintenanceMessage");


        if (messageBox) {

            messageBox.value =
                String(message);
        }


        const lastRun =
            getValue(
                settings,
                [
                    "last_earnings_run",
                    "lastEarningsRun",
                    "last_daily_earnings_run",
                    "last_run"
                ],
                ""
            );


        setText(
            "#lastEarningsRun",
            lastRun
                ? formatDate(lastRun)
                : "Not available"
        );


        const processed =
            getNumericValue(
                settings.earnings_processed_today,
                settings.earningsProcessedToday,
                settings.processed_today,
                0
            );


        setText(
            "#earningsProcessedToday",
            formatCurrency(processed)
        );


        const active =
            getNumericValue(
                settings.active_investments,
                settings.activeInvestments,
                AdminDashboard.investments.filter(
                    item =>
                        String(
                            item.status || ""
                        ).toLowerCase() ===
                        "active"
                ).length,
                0
            );


        const pending =
            getNumericValue(
                settings.pending_investments,
                settings.pendingInvestments,
                AdminDashboard.investments.length,
                0
            );


        setText(
            "#maintenanceActiveInvestments",
            formatNumber(active)
        );


        setText(
            "#maintenancePendingInvestments",
            formatNumber(pending)
        );


        const engineEnabled =
            earnings;


        const engineStatus =
            $("#earningsEngineStatus");


        if (engineStatus) {

            engineStatus.textContent =
                engineEnabled
                    ? "Engine Enabled"
                    : "Engine Disabled";

            engineStatus.style.color =
                engineEnabled
                    ? "#72dda0"
                    : "#e56b6f";
        }


        updateMaintenanceStatus();
    }


    function setupMaintenance() {

        const saveButton =
            $("#saveMaintenanceBtn");


        if (
            saveButton &&
            !saveButton.dataset.ccMaintenanceReady
        ) {

            saveButton.dataset.ccMaintenanceReady =
                "true";


            saveButton.addEventListener(
                "click",
                saveMaintenanceSettings
            );
        }


        const controls = [

            "#maintenanceModeToggle",

            "#maintenanceInvestmentsToggle",

            "#maintenanceDepositsToggle",

            "#maintenanceWithdrawalsToggle",

            "#maintenanceEarningsToggle",

            "#maintenanceRegistrationToggle"

        ];


        controls.forEach(selector => {

            const element =
                $(selector);


            if (
                element &&
                !element.dataset.ccMaintenanceReady
            ) {

                element.dataset.ccMaintenanceReady =
                    "true";


                element.addEventListener(
                    "change",
                    updateMaintenanceStatus
                );
            }
        });


        loadMaintenanceSettings();
    }


    function updateMaintenanceStatus() {

        const maintenanceMode =
            $("#maintenanceModeToggle")?.checked === true;


        const status =
            $("#maintenanceStatus");


        const statusText =
            $("#maintenanceStatusText");


        const statusDot =
            $("#maintenanceStatusDot");


        if (
            !status ||
            !statusText ||
            !statusDot
        ) {
            return;
        }


        if (maintenanceMode) {

            statusText.textContent =
                "Maintenance Mode";


            status.style.background =
                "rgba(255,193,7,0.08)";


            status.style.borderColor =
                "rgba(255,193,7,0.18)";


            statusText.style.color =
                "#ffd166";


            statusDot.style.background =
                "#ffd166";


            statusDot.style.boxShadow =
                "0 0 10px rgba(255,209,102,.5)";

        } else {

            statusText.textContent =
                "System Online";


            status.style.background =
                "rgba(72,210,125,0.08)";


            status.style.borderColor =
                "rgba(72,210,125,0.14)";


            statusText.style.color =
                "#72dda0";


            statusDot.style.background =
                "#50d58a";


            statusDot.style.boxShadow =
                "0 0 10px rgba(80,213,138,.5)";
        }
    }


    async function saveMaintenanceSettings() {

        const button =
            $("#saveMaintenanceBtn");


        const status =
            $("#maintenanceSaveStatus");


        const settings = {

            maintenance_mode:
                $("#maintenanceModeToggle")?.checked === true,

            investments_enabled:
                $("#maintenanceInvestmentsToggle")?.checked === true,

            deposits_enabled:
                $("#maintenanceDepositsToggle")?.checked === true,

            withdrawals_enabled:
                $("#maintenanceWithdrawalsToggle")?.checked === true,

            earnings_enabled:
                $("#maintenanceEarningsToggle")?.checked === true,

            registration_enabled:
                $("#maintenanceRegistrationToggle")?.checked === true,

            maintenance_message:
                $("#maintenanceMessage")?.value.trim() || ""

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
                    ADMIN_MAINTENANCE_API,
                    {
                        method: "POST",

                        body:
                            JSON.stringify(
                                settings
                            )
                    }
                );


            AdminDashboard.maintenance =
                data.settings ||
                data.maintenance ||
                settings;


            renderMaintenanceSettings(
                AdminDashboard.maintenance
            );


            if (status) {

                status.textContent =
                    "Settings saved successfully.";

                status.style.color =
                    "#72dda0";
            }


            showAdminMessage(
                data.message ||
                "Platform maintenance settings saved.",
                "success"
            );


        } catch (error) {

            console.error(
                "Unable to save maintenance settings:",
                error
            );


            if (status) {

                status.textContent =
                    error.message ||
                    "Unable to save settings.";

                status.style.color =
                    "#e56b6f";
            }


            showAdminMessage(
                error.message ||
                "Unable to save maintenance settings.",
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


    function showMaintenanceError(
        message
    ) {

        const status =
            $("#maintenanceSaveStatus");


        if (status) {

            status.textContent =
                `Maintenance settings unavailable: ${message || "Server error."}`;

            status.style.color =
                "#e56b6f";
        }
    }


    function setCheckbox(
        selector,
        value
    ) {

        const element =
            $(selector);


        if (!element) {
            return;
        }


        element.checked =
            Boolean(value);
    }


    function getBooleanValue(
        ...values
    ) {

        for (
            const value of values
        ) {

            if (
                value ===
                undefined ||
                value ===
                null
            ) {
                continue;
            }


            if (
                typeof value ===
                "boolean"
            ) {

                return value;
            }


            if (
                typeof value ===
                "number"
            ) {

                return value !== 0;
            }


            const text =
                String(value)
                    .trim()
                    .toLowerCase();


            if (
                [
                    "true",
                    "1",
                    "yes",
                    "on",
                    "enabled",
                    "active"
                ].includes(text)
            ) {

                return true;
            }


            if (
                [
                    "false",
                    "0",
                    "no",
                    "off",
                    "disabled",
                    "inactive"
                ].includes(text)
            ) {

                return false;
            }
        }


        return false;
    }


    /* ======================================================================
       SIDEBAR
    ====================================================================== */

    function setupSidebar() {

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


        $$("#sidebar a")
            .forEach(link => {

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


    /* ======================================================================
       LOGOUT
    ====================================================================== */

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


                await logoutAdmin();
            }
        );
    }


    async function logoutAdmin() {

        try {

            await fetchWithTimeout(
                LOGOUT_API,
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body:
                        JSON.stringify({})
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


    /* ======================================================================
       FORMATTING
    ====================================================================== */

    function formatCurrency(
        value
    ) {

        const number =
            Number(value) || 0;


        return new Intl.NumberFormat(
            "en-UG",
            {
                style:
                    "currency",

                currency:
                    "UGX",

                maximumFractionDigits:
                    0
            }
        ).format(number);
    }


    function formatNumber(
        value
    ) {

        const number =
            Number(value) || 0;


        return new Intl.NumberFormat(
            "en-UG"
        ).format(number);
    }


    function formatDate(
        value
    ) {

        if (!value) {
            return "Date unavailable";
        }


        let date;


        if (
            typeof value === "object" &&
            value !== null &&
            "$date" in value
        ) {

            date =
                new Date(
                    value.$date
                );

        } else {

            date =
                new Date(value);
        }


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
                year:
                    "numeric",

                month:
                    "short",

                day:
                    "numeric",

                hour:
                    "2-digit",

                minute:
                    "2-digit"
            }
        ).format(date);
    }


    function formatStatus(
        status
    ) {

        if (!status) {
            return "Unknown";
        }


        return String(status)
            .replace(
                /[_-]+/g,
                " "
            )
            .replace(
                /\s+/g,
                " "
            )
            .trim()
            .replace(
                /\b\w/g,
                letter =>
                    letter.toUpperCase()
            );
    }


    function formatTransactionType(
        type
    ) {

        if (!type) {
            return "Transaction";
        }


        const map = {

            deposit:
                "Deposit",

            withdrawal:
                "Withdrawal",

            investment:
                "Investment",

            investment_principal:
                "Investment",

            daily_earning:
                "Daily Earning",

            referral_bonus:
                "Referral Bonus",

            referral_commission:
                "Referral Commission",

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


        return (
            map[key] ||
            formatStatus(type)
        );
    }


    function formatAccountType(
        type
    ) {

        if (!type) {
            return "Administrator";
        }


        return String(type)
            .replace(
                /[_-]+/g,
                " "
            )
            .replace(
                /\b\w/g,
                letter =>
                    letter.toUpperCase()
            );
    }


    function getTransactionIcon(
        type
    ) {

        const key =
            String(type || "")
                .toLowerCase();


        const icons = {

            deposit:
                "↓",

            withdrawal:
                "↑",

            investment:
                "◆",

            investment_principal:
                "◆",

            daily_earning:
                "✦",

            referral_bonus:
                "★",

            referral_commission:
                "★",

            refund:
                "↩",

            fee:
                "−",

            debit:
                "−",

            credit:
                "+"

        };


        return (
            icons[key] ||
            "•"
        );
    }


    function getTypeClass(
        type
    ) {

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


    function getStatusClass(
        status
    ) {

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


    /* ======================================================================
       VALUE HELPERS
    ====================================================================== */

    function getNumericValue(
        ...values
    ) {

        for (
            const value of values
        ) {

            if (
                value === null ||
                value === undefined ||
                value === ""
            ) {
                continue;
            }


            if (
                typeof value === "object" &&
                value !== null
            ) {

                const mongoNumbers = [

                    "$numberInt",
                    "$numberLong",
                    "$numberDecimal",
                    "$numberDouble"

                ];


                for (
                    const key of mongoNumbers
                ) {

                    if (
                        value[key] !==
                        undefined
                    ) {

                        const number =
                            Number(
                                value[key]
                            );


                        if (
                            Number.isFinite(
                                number
                            )
                        ) {

                            return number;
                        }
                    }
                }
            }


            const number =
                Number(
                    String(value)
                        .replace(
                            /,/g,
                            ""
                        )
                        .replace(
                            /UGX/gi,
                            ""
                        )
                        .trim()
                );


            if (
                Number.isFinite(
                    number
                )
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


        for (
            const key of keys
        ) {

            if (
                object[key] !==
                    undefined &&
                object[key] !==
                    null &&
                object[key] !==
                    ""
            ) {

                return object[key];
            }
        }


        return fallback;
    }


    function getItemId(
        item
    ) {

        if (!item) {
            return "";
        }


        const value =
            getValue(
                item,
                [
                    "_id",
                    "id",
                    "depositId",
                    "deposit_id",
                    "withdrawalId",
                    "withdrawal_id",
                    "investmentId",
                    "investment_id",
                    "reference"
                ],
                ""
            );


        if (
            typeof value === "object" &&
            value !== null
        ) {

            if (value.$oid) {

                return String(
                    value.$oid
                );
            }
        }


        return String(value);
    }


    function getInitials(
        name
    ) {

        if (!name) {
            return "CC";
        }


        const parts =
            String(name)
                .trim()
                .split(/\s+/)
                .filter(Boolean);


        if (
            parts.length === 1
        ) {

            return parts[0]
                .substring(
                    0,
                    2
                )
                .toUpperCase();
        }


        return (
            parts[0][0] +
            parts[
                parts.length - 1
            ][0]
        ).toUpperCase();
    }


    function capitalize(
        value
    ) {

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


    /* ======================================================================
       HTML ESCAPING
    ====================================================================== */

    function escapeHtml(
        value
    ) {

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


    /* ======================================================================
       GLOBAL ADMIN API
    ====================================================================== */

    window.CrownCashAdmin = {

        reload:
            async () => {

                await Promise.allSettled([

                    loadDashboardData(),

                    loadApprovalData(),

                    loadMaintenanceSettings()

                ]);
            },


        loadDashboard:
            loadDashboardData,


        loadApprovals:
            loadApprovalData,


        loadMaintenance:
            loadMaintenanceSettings,


        saveMaintenance:
            saveMaintenanceSettings,


        refresh:
            async () => {

                await Promise.allSettled([

                    loadDashboardData(),

                    loadApprovalData(),

                    loadMaintenanceSettings()

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


    /* ======================================================================
       INITIALIZATION
    ====================================================================== */

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

            /* ----------------------------------------------------------
               STEP 1: VERIFY ADMIN
            ---------------------------------------------------------- */

            const authenticated =
                await authenticateAdmin();


            if (!authenticated) {
                return;
            }


            /* ----------------------------------------------------------
               STEP 2: PAGE CONTROLS
            ---------------------------------------------------------- */

            setupSidebar();

            setupLogout();

            setupMaintenance();

            createApprovalCenter();


            /* ----------------------------------------------------------
               STEP 3: LOAD ADMIN DATA
            ---------------------------------------------------------- */

            const results =
                await Promise.allSettled([

                    loadAdminProfile(),

                    loadDashboardData(),

                    loadApprovalData(),

                    loadMaintenanceSettings()

                ]);


            console.log(
                "Crown Cash admin initialization:",
                results
            );


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


    /* ======================================================================
       START
    ====================================================================== */

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