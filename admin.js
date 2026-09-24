document.addEventListener("DOMContentLoaded", () => {

    const API_BASE =
        "https://crown-cash1.onrender.com";

    const ADMIN_CHECK_API =
        `${API_BASE}/admin-check.php`;

    const DASHBOARD_API =
        `${API_BASE}/admin-dashboard.php`;

    const LOGOUT_API =
        `${API_BASE}/logout.php`;


    /* =====================================================
       ELEMENTS
    ===================================================== */

    const sidebar =
        document.getElementById("adminSidebar");

    const sidebarOverlay =
        document.getElementById("sidebarOverlay");

    const sidebarClose =
        document.getElementById("sidebarClose");

    const menuButton =
        document.getElementById("menuButton");

    const refreshButton =
        document.getElementById("refreshButton");

    const logoutButton =
        document.getElementById("logoutButton");

    const adminName =
        document.getElementById("adminName");

    const adminEmail =
        document.getElementById("adminEmail");

    const adminAvatar =
        document.getElementById("adminAvatar");

    const welcomeAdminName =
        document.getElementById("welcomeAdminName");

    const dashboardDate =
        document.getElementById("dashboardDate");


    /* =====================================================
       LOGIN REDIRECT
    ===================================================== */

    function redirectToLogin() {

        window.location.replace(
            "/login.html?admin=login_required"
        );
    }


    /* =====================================================
       ADMIN ACCESS CHECK
    ===================================================== */

    async function checkAdminAccess() {

        try {

            const response = await fetch(
                ADMIN_CHECK_API,
                {
                    method: "GET",

                    credentials: "include",

                    headers: {
                        "Accept": "application/json"
                    },

                    cache: "no-store"
                }
            );


            const data =
                await response
                    .json()
                    .catch(() => null);


            if (
                response.status === 401 ||
                response.status === 403
            ) {

                redirectToLogin();

                return false;
            }


            if (
                !response.ok ||
                !data ||
                data.success !== true ||
                data.authorized !== true
            ) {

                redirectToLogin();

                return false;
            }


            /*
             * If the API returns admin information,
             * display it in the header.
             */

            const user =
                data.user ||
                data.admin ||
                null;


            if (user) {

                const name =
                    user.full_name ||
                    user.name ||
                    user.email ||
                    "Administrator";

                const email =
                    user.email ||
                    "Admin Account";


                if (adminName) {
                    adminName.textContent =
                        name;
                }


                if (adminEmail) {
                    adminEmail.textContent =
                        email;
                }


                if (welcomeAdminName) {
                    welcomeAdminName.textContent =
                        name.split(" ")[0] ||
                        "Administrator";
                }


                if (adminAvatar) {

                    adminAvatar.textContent =
                        name
                            .trim()
                            .charAt(0)
                            .toUpperCase();
                }
            }


            return true;

        } catch (error) {

            console.error(
                "Admin authentication error:",
                error
            );

            redirectToLogin();

            return false;
        }
    }


    /* =====================================================
       FORMAT UGX
    ===================================================== */

    function formatUGX(amount) {

        const number =
            Number(amount || 0);

        return (
            "UGX " +
            number.toLocaleString(
                "en-UG",
                {
                    maximumFractionDigits: 0
                }
            )
        );
    }


    /* =====================================================
       FORMAT DATE
    ===================================================== */

    function formatDate(value) {

        if (!value) {
            return "—";
        }


        let date;


        if (
            typeof value === "object" &&
            value.$date
        ) {

            date =
                new Date(value.$date);

        } else {

            date =
                new Date(value);
        }


        if (
            Number.isNaN(
                date.getTime()
            )
        ) {

            return "—";
        }


        return date.toLocaleDateString(
            "en-UG",
            {
                year: "numeric",
                month: "short",
                day: "numeric"
            }
        );
    }


    /* =====================================================
       SAFE HTML
    ===================================================== */

    function escapeHTML(value) {

        return String(value ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }


    /* =====================================================
       DASHBOARD DATE
    ===================================================== */

    function updateDashboardDate() {

        if (!dashboardDate) {
            return;
        }


        const now =
            new Date();


        dashboardDate.textContent =
            now.toLocaleDateString(
                "en-UG",
                {
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                    year: "numeric"
                }
            );
    }


    /* =====================================================
       UPDATE STATISTICS
    ===================================================== */

    function updateStats(stats) {

        if (!stats) {
            return;
        }


        const elements = {

            totalUsers:
                document.getElementById(
                    "totalUsers"
                ),

            activeUsers:
                document.getElementById(
                    "activeUsers"
                ),

            pendingUsers:
                document.getElementById(
                    "pendingUsers"
                ),

            blockedUsers:
                document.getElementById(
                    "blockedUsers"
                ),

            totalDeposits:
                document.getElementById(
                    "totalDeposits"
                ),

            depositCount:
                document.getElementById(
                    "depositCount"
                ),

            totalWithdrawals:
                document.getElementById(
                    "totalWithdrawals"
                ),

            withdrawalCount:
                document.getElementById(
                    "withdrawalCount"
                ),

            totalInvestments:
                document.getElementById(
                    "totalInvestments"
                ),

            investmentCount:
                document.getElementById(
                    "investmentCount"
                ),

            platformBalance:
                document.getElementById(
                    "platformBalance"
                )
        };


        if (elements.totalUsers) {

            elements.totalUsers.textContent =
                Number(
                    stats.total_users ?? 0
                ).toLocaleString();
        }


        if (elements.activeUsers) {

            elements.activeUsers.textContent =
                Number(
                    stats.active_users ?? 0
                ).toLocaleString();
        }


        if (elements.pendingUsers) {

            elements.pendingUsers.textContent =
                Number(
                    stats.pending_users ?? 0
                ).toLocaleString();
        }


        if (elements.blockedUsers) {

            elements.blockedUsers.textContent =
                Number(
                    stats.blocked_users ?? 0
                ).toLocaleString();
        }


        if (elements.totalDeposits) {

            elements.totalDeposits.textContent =
                formatUGX(
                    stats.deposits_total ?? 0
                );
        }


        if (elements.depositCount) {

            const count =
                Number(
                    stats.deposits_count ??
                    stats.deposit_count ??
                    0
                );

            elements.depositCount.textContent =
                `${count.toLocaleString()} deposits`;
        }


        if (elements.totalWithdrawals) {

            elements.totalWithdrawals.textContent =
                formatUGX(
                    stats.withdrawals_total ?? 0
                );
        }


        if (elements.withdrawalCount) {

            const count =
                Number(
                    stats.withdrawals_count ??
                    stats.withdrawal_count ??
                    0
                );

            elements.withdrawalCount.textContent =
                `${count.toLocaleString()} withdrawals`;
        }


        if (elements.totalInvestments) {

            elements.totalInvestments.textContent =
                formatUGX(
                    stats.investments_total ?? 0
                );
        }


        if (elements.investmentCount) {

            const count =
                Number(
                    stats.investments_count ??
                    stats.investment_count ??
                    0
                );

            elements.investmentCount.textContent =
                `${count.toLocaleString()} investments`;
        }


        if (elements.platformBalance) {

            elements.platformBalance.textContent =
                formatUGX(
                    stats.platform_balance ?? 0
                );
        }
    }


    /* =====================================================
       TRANSACTION ICON
    ===================================================== */

    function transactionIcon(type) {

        const value =
            String(type || "")
                .toLowerCase();


        if (value.includes("deposit")) {

            return `
                <svg viewBox="0 0 24 24" fill="none">
                    <rect
                        x="3"
                        y="5"
                        width="18"
                        height="14"
                        rx="3"
                        stroke="currentColor"
                        stroke-width="1.8"
                    />

                    <path
                        d="M12 8V15"
                        stroke="currentColor"
                        stroke-width="1.8"
                        stroke-linecap="round"
                    />

                    <path
                        d="M9 12L12 15L15 12"
                        stroke="currentColor"
                        stroke-width="1.8"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                    />
                </svg>
            `;
        }


        if (value.includes("withdraw")) {

            return `
                <svg viewBox="0 0 24 24" fill="none">
                    <rect
                        x="3"
                        y="5"
                        width="18"
                        height="14"
                        rx="3"
                        stroke="currentColor"
                        stroke-width="1.8"
                    />

                    <path
                        d="M12 16V9"
                        stroke="currentColor"
                        stroke-width="1.8"
                        stroke-linecap="round"
                    />

                    <path
                        d="M9 12L12 9L15 12"
                        stroke="currentColor"
                        stroke-width="1.8"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                    />
                </svg>
            `;
        }


        if (value.includes("investment")) {

            return `
                <svg viewBox="0 0 24 24" fill="none">
                    <path
                        d="M4 18L9 13L13 16L20 8"
                        stroke="currentColor"
                        stroke-width="1.8"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                    />

                    <path
                        d="M15 8H20V13"
                        stroke="currentColor"
                        stroke-width="1.8"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                    />
                </svg>
            `;
        }


        return `
            <svg viewBox="0 0 24 24" fill="none">
                <path
                    d="M6 4H18"
                    stroke="currentColor"
                    stroke-width="1.8"
                    stroke-linecap="round"
                />

                <path
                    d="M6 9H18"
                    stroke="currentColor"
                    stroke-width="1.8"
                    stroke-linecap="round"
                />

                <path
                    d="M6 14H14"
                    stroke="currentColor"
                    stroke-width="1.8"
                    stroke-linecap="round"
                />

                <path
                    d="M6 19H11"
                    stroke="currentColor"
                    stroke-width="1.8"
                    stroke-linecap="round"
                />
            </svg>
        `;
    }


    /* =====================================================
       RENDER RECENT USERS
    ===================================================== */

    function renderUsers(users) {

        const container =
            document.getElementById(
                "recentUsers"
            );


        if (!container) {
            return;
        }


        if (
            !Array.isArray(users) ||
            users.length === 0
        ) {

            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">
                        <svg viewBox="0 0 24 24" fill="none">
                            <circle
                                cx="12"
                                cy="8"
                                r="4"
                                stroke="currentColor"
                                stroke-width="1.8"
                            />

                            <path
                                d="M4 21C4 16.58 7.58 13 12 13C16.42 13 20 16.58 20 21"
                                stroke="currentColor"
                                stroke-width="1.8"
                                stroke-linecap="round"
                            />
                        </svg>
                    </div>

                    <strong>
                        No recent users
                    </strong>

                    <span>
                        Newly registered members appear here.
                    </span>
                </div>
            `;

            return;
        }


        container.innerHTML =
            users.map(user => {

                const name =
                    escapeHTML(
                        user.full_name ||
                        user.name ||
                        "Unknown User"
                    );

                const email =
                    escapeHTML(
                        user.email ||
                        "No email"
                    );

                const status =
                    escapeHTML(
                        user.status ||
                        "active"
                    );


                const initials =
                    String(
                        user.full_name ||
                        user.name ||
                        "U"
                    )
                        .trim()
                        .split(/\s+/)
                        .map(
                            part =>
                                part
                                    .charAt(0)
                                    .toUpperCase()
                        )
                        .slice(0, 2)
                        .join("");


                return `
                    <div class="user-item">

                        <div class="user-avatar">
                            ${escapeHTML(
                                initials || "U"
                            )}
                        </div>

                        <div class="user-info">

                            <strong>
                                ${name}
                            </strong>

                            <span>
                                ${email}
                            </span>

                        </div>

                        <span class="status-badge ${status}">
                            ${status}
                        </span>

                    </div>
                `;

            }).join("");
    }


    /* =====================================================
       RENDER TRANSACTIONS
    ===================================================== */

    function renderTransactions(
        transactions
    ) {

        const container =
            document.getElementById(
                "recentTransactions"
            );


        if (!container) {
            return;
        }


        if (
            !Array.isArray(transactions) ||
            transactions.length === 0
        ) {

            container.innerHTML = `
                <div class="empty-state">

                    <div class="empty-icon">

                        <svg viewBox="0 0 24 24" fill="none">

                            <rect
                                x="5"
                                y="3"
                                width="14"
                                height="18"
                                rx="2"
                                stroke="currentColor"
                                stroke-width="1.8"
                            />

                            <path
                                d="M8 8H16"
                                stroke="currentColor"
                                stroke-width="1.8"
                                stroke-linecap="round"
                            />

                            <path
                                d="M8 12H16"
                                stroke="currentColor"
                                stroke-width="1.8"
                                stroke-linecap="round"
                            />

                            <path
                                d="M8 16H13"
                                stroke="currentColor"
                                stroke-width="1.8"
                                stroke-linecap="round"
                            />

                        </svg>

                    </div>

                    <strong>
                        No recent transactions
                    </strong>

                    <span>
                        Transaction activity will appear here.
                    </span>

                </div>
            `;

            return;
        }


        container.innerHTML =
            transactions.map(transaction => {

                const type =
                    escapeHTML(
                        transaction.type ||
                        transaction.transaction_type ||
                        "transaction"
                    );


                const status =
                    escapeHTML(
                        transaction.status ||
                        "pending"
                    );


                const amount =
                    formatUGX(
                        transaction.amount || 0
                    );


                const date =
                    formatDate(
                        transaction.created_at ||
                        transaction.date
                    );


                return `
                    <div class="transaction-item">

                        <div class="transaction-icon">
                            ${transactionIcon(type)}
                        </div>

                        <div class="transaction-info">

                            <strong>
                                ${type}
                            </strong>

                            <span>
                                ${date}
                            </span>

                        </div>

                        <div class="transaction-amount">

                            <strong>
                                ${amount}
                            </strong>

                            <span class="status-badge ${status}">
                                ${status}
                            </span>

                        </div>

                    </div>
                `;

            }).join("");
    }


    /* =====================================================
       LOAD DASHBOARD
    ===================================================== */

    async function loadDashboard(
        showLoading = false
    ) {

        if (showLoading) {

            const transactions =
                document.getElementById(
                    "recentTransactions"
                );

            const users =
                document.getElementById(
                    "recentUsers"
                );


            if (transactions) {

                transactions.innerHTML = `
                    <div class="loading">
                        Loading transactions...
                    </div>
                `;
            }


            if (users) {

                users.innerHTML = `
                    <div class="loading">
                        Loading users...
                    </div>
                `;
            }
        }


        try {

            const response =
                await fetch(
                    DASHBOARD_API,
                    {
                        method: "GET",

                        credentials: "include",

                        headers: {
                            "Accept":
                                "application/json"
                        },

                        cache: "no-store"
                    }
                );


            const data =
                await response
                    .json()
                    .catch(() => null);


            if (
                response.status === 401 ||
                response.status === 403
            ) {

                redirectToLogin();

                return;
            }


            if (
                !response.ok ||
                !data ||
                data.success !== true
            ) {

                throw new Error(
                    data?.message ||
                    "Unable to load dashboard."
                );
            }


            updateStats(
                data.stats || {}
            );


            renderUsers(
                data.recent_users ||
                data.users ||
                []
            );


            renderTransactions(
                data.recent_transactions ||
                data.transactions ||
                []
            );


        } catch (error) {

            console.error(
                "Dashboard loading error:",
                error
            );


            const transactions =
                document.getElementById(
                    "recentTransactions"
                );

            const users =
                document.getElementById(
                    "recentUsers"
                );


            if (transactions) {

                transactions.innerHTML = `
                    <div class="empty-state">
                        <strong>
                            Unable to load transactions
                        </strong>

                        <span>
                            Please refresh the dashboard.
                        </span>
                    </div>
                `;
            }


            if (users) {

                users.innerHTML = `
                    <div class="empty-state">
                        <strong>
                            Unable to load users
                        </strong>

                        <span>
                            Please refresh the dashboard.
                        </span>
                    </div>
                `;
            }
        }
    }


    /* =====================================================
       REFRESH BUTTON
    ===================================================== */

    if (refreshButton) {

        refreshButton.addEventListener(
            "click",
            async () => {

                if (
                    refreshButton.disabled
                ) {
                    return;
                }


                const original =
                    refreshButton.innerHTML;


                refreshButton.disabled =
                    true;


                refreshButton.classList.add(
                    "is-refreshing"
                );


                refreshButton.innerHTML = `
                    <svg
                        viewBox="0 0 24 24"
                        fill="none"
                    >
                        <path
                            d="M20 11A8 8 0 0 0 5.2 6.2L4 8"
                            stroke="currentColor"
                            stroke-width="2"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                        />

                        <path
                            d="M4 4V8H8"
                            stroke="currentColor"
                            stroke-width="2"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                        />

                        <path
                            d="M4 13A8 8 0 0 0 18.8 17.8L20 16"
                            stroke="currentColor"
                            stroke-width="2"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                        />

                        <path
                            d="M20 20V16H16"
                            stroke="currentColor"
                            stroke-width="2"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                        />
                    </svg>

                    <span>Refreshing...</span>
                `;


                await loadDashboard(
                    true
                );


                refreshButton.innerHTML =
                    original;


                refreshButton.disabled =
                    false;


                refreshButton.classList.remove(
                    "is-refreshing"
                );
            }
        );
    }


    /* =====================================================
       LOGOUT
    ===================================================== */

    async function logout() {

        if (logoutButton) {

            logoutButton.disabled =
                true;
        }


        try {

            await fetch(
                LOGOUT_API,
                {
                    method: "POST",

                    credentials: "include",

                    headers: {
                        "Content-Type":
                            "application/json"
                    }
                }
            );

        } catch (error) {

            console.error(
                "Logout error:",
                error
            );
        }


        window.location.replace(
            "/login.html"
        );
    }


    if (logoutButton) {

        logoutButton.addEventListener(
            "click",
            event => {

                event.preventDefault();

                logout();
            }
        );
    }


    /* =====================================================
       MOBILE SIDEBAR
    ===================================================== */

    function openSidebar() {

        if (!sidebar) {
            return;
        }


        sidebar.classList.add(
            "open"
        );


        if (sidebarOverlay) {

            sidebarOverlay.classList.add(
                "show"
            );
        }


        document.body.classList.add(
            "sidebar-open"
        );
    }


    function closeSidebar() {

        if (!sidebar) {
            return;
        }


        sidebar.classList.remove(
            "open"
        );


        if (sidebarOverlay) {

            sidebarOverlay.classList.remove(
                "show"
            );
        }


        document.body.classList.remove(
            "sidebar-open"
        );
    }


    if (menuButton) {

        menuButton.addEventListener(
            "click",
            openSidebar
        );
    }


    if (sidebarClose) {

        sidebarClose.addEventListener(
            "click",
            closeSidebar
        );
    }


    if (sidebarOverlay) {

        sidebarOverlay.addEventListener(
            "click",
            closeSidebar
        );
    }


    if (sidebar) {

        const links =
            sidebar.querySelectorAll(
                "a"
            );


        links.forEach(link => {

            link.addEventListener(
                "click",
                closeSidebar
            );
        });
    }


    /* =====================================================
       ESCAPE KEY
    ===================================================== */

    document.addEventListener(
        "keydown",
        event => {

            if (
                event.key === "Escape"
            ) {

                closeSidebar();
            }
        }
    );


    /* =====================================================
       START ADMIN PANEL
    ===================================================== */

    async function startAdminPanel() {

        updateDashboardDate();


        const authorized =
            await checkAdminAccess();


        if (!authorized) {
            return;
        }


        await loadDashboard(
            true
        );
    }


    startAdminPanel();

});