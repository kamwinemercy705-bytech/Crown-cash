document.addEventListener("DOMContentLoaded", () => {

    const API_BASE =
        "https://crown-cash1.onrender.com";

    const ADMIN_CHECK_API =
        `${API_BASE}/admin-check.php`;

    const DASHBOARD_API =
        `${API_BASE}/admin-dashboard.php`;

    const LOGOUT_API =
        `${API_BASE}/logout.php`;


    /* =========================
       ELEMENTS
    ========================= */

    const menuToggle =
        document.getElementById("menuToggle");

    const sidebar =
        document.querySelector(".sidebar");

    const refreshButton =
        document.getElementById("refreshDashboard");

    const logoutButton =
        document.getElementById("logoutBtn");


    /* =========================
       REDIRECT TO LOGIN
    ========================= */

    function redirectToLogin() {

        window.location.replace(
            "/login.html?admin=login_required"
        );
    }


    /* =========================
       ADMIN ACCESS CHECK
    ========================= */

    async function checkAdminAccess() {

        try {

            const response =
                await fetch(
                    ADMIN_CHECK_API,
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


            /*
             * 401 = not logged in
             * 403 = logged in but not admin
             */

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


            return true;

        } catch (error) {

            console.error(
                "Admin authentication error:",
                error
            );


            /*
             * If the server cannot verify
             * the admin session, do not
             * display the admin dashboard.
             */

            redirectToLogin();

            return false;
        }
    }


    /* =========================
       FORMAT MONEY
    ========================= */

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


    /* =========================
       FORMAT DATE
    ========================= */

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


    /* =========================
       SAFE TEXT
    ========================= */

    function safeText(value) {

        return String(
            value ?? ""
        );
    }


    /* =========================
       UPDATE STATISTICS
    ========================= */

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

            platformBalance:
                document.getElementById(
                    "platformBalance"
                ),

            totalDeposits:
                document.getElementById(
                    "totalDeposits"
                ),

            pendingDeposits:
                document.getElementById(
                    "pendingDeposits"
                ),

            totalWithdrawals:
                document.getElementById(
                    "totalWithdrawals"
                ),

            pendingWithdrawals:
                document.getElementById(
                    "pendingWithdrawals"
                ),

            totalInvestments:
                document.getElementById(
                    "totalInvestments"
                ),

            activeInvestments:
                document.getElementById(
                    "activeInvestments"
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


        if (elements.platformBalance) {

            elements.platformBalance.textContent =
                formatUGX(
                    stats.platform_balance ?? 0
                );
        }


        if (elements.totalDeposits) {

            elements.totalDeposits.textContent =
                formatUGX(
                    stats.deposits_total ?? 0
                );
        }


        if (elements.pendingDeposits) {

            elements.pendingDeposits.textContent =
                formatUGX(
                    stats.deposits_pending ?? 0
                );
        }


        if (elements.totalWithdrawals) {

            elements.totalWithdrawals.textContent =
                formatUGX(
                    stats.withdrawals_total ?? 0
                );
        }


        if (elements.pendingWithdrawals) {

            elements.pendingWithdrawals.textContent =
                formatUGX(
                    stats.withdrawals_pending ?? 0
                );
        }


        if (elements.totalInvestments) {

            elements.totalInvestments.textContent =
                formatUGX(
                    stats.investments_total ?? 0
                );
        }


        if (elements.activeInvestments) {

            elements.activeInvestments.textContent =
                formatUGX(
                    stats.investments_active ?? 0
                );
        }
    }


    /* =========================
       RENDER RECENT USERS
    ========================= */

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
                    No users found.
                </div>
            `;

            return;
        }


        container.innerHTML =
            users.map(user => {

                const name =
                    safeText(
                        user.full_name ||
                        user.name ||
                        "Unknown User"
                    );

                const email =
                    safeText(
                        user.email ||
                        "No email"
                    );

                const status =
                    safeText(
                        user.status ||
                        "active"
                    );


                const initials =
                    name
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
                    <div class="recent-user">

                        <div class="user-avatar">
                            ${initials || "U"}
                        </div>

                        <div class="user-info">

                            <strong>
                                ${name}
                            </strong>

                            <small>
                                ${email}
                            </small>

                        </div>

                        <span class="status-badge">
                            ${status}
                        </span>

                    </div>
                `;

            }).join("");
    }


    /* =========================
       RENDER TRANSACTIONS
    ========================= */

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
                    No recent transactions.
                </div>
            `;

            return;
        }


        container.innerHTML =
            transactions.map(transaction => {

                const type =
                    safeText(
                        transaction.type ||
                        transaction.transaction_type ||
                        "transaction"
                    );


                const status =
                    safeText(
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
                    <div class="recent-transaction">

                        <div class="transaction-icon">

                            <svg
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                stroke-width="2"
                            >
                                <path
                                    d="M12 3v18"
                                />

                                <path
                                    d="M7 8l5-5 5 5"
                                />

                                <path
                                    d="M7 16l5 5 5-5"
                                />
                            </svg>

                        </div>


                        <div class="transaction-info">

                            <strong>
                                ${type}
                            </strong>

                            <small>
                                ${date}
                            </small>

                        </div>


                        <div class="transaction-right">

                            <strong>
                                ${amount}
                            </strong>

                            <span class="status-badge">
                                ${status}
                            </span>

                        </div>

                    </div>
                `;

            }).join("");
    }


    /* =========================
       LOAD DASHBOARD
    ========================= */

    async function loadDashboard(
        showLoading = true
    ) {

        if (showLoading) {

            const loading =
                document.getElementById(
                    "dashboardLoading"
                );

            if (loading) {
                loading.style.display =
                    "flex";
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


            /*
             * Never continue if the
             * server rejects admin access.
             */

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


            const message =
                document.getElementById(
                    "dashboardError"
                );


            if (message) {

                message.textContent =
                    error.message ||
                    "Unable to load dashboard.";
            }

        } finally {

            const loading =
                document.getElementById(
                    "dashboardLoading"
                );

            if (loading) {

                loading.style.display =
                    "none";
            }
        }
    }


    /* =========================
       REFRESH
    ========================= */

    if (refreshButton) {

        refreshButton.addEventListener(
            "click",
            async () => {

                const original =
                    refreshButton.innerHTML;


                refreshButton.disabled =
                    true;


                refreshButton.innerHTML = `
                    <span class="refresh-spinner"></span>
                    Refreshing...
                `;


                await loadDashboard(
                    false
                );


                refreshButton.disabled =
                    false;


                refreshButton.innerHTML =
                    original;
            }
        );
    }


    /* =========================
       LOGOUT
    ========================= */

    async function logout() {

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


    /* =========================
       MOBILE SIDEBAR
    ========================= */

    if (
        menuToggle &&
        sidebar
    ) {

        menuToggle.addEventListener(
            "click",
            () => {

                sidebar.classList.toggle(
                    "open"
                );
            }
        );
    }


    /* =========================
       CLOSE SIDEBAR
       AFTER LINK CLICK
    ========================= */

    if (sidebar) {

        const links =
            sidebar.querySelectorAll(
                "a"
            );


        links.forEach(link => {

            link.addEventListener(
                "click",
                () => {

                    sidebar.classList.remove(
                        "open"
                    );
                }
            );
        });
    }


    /* =========================
       START SECURITY CHECK
    ========================= */

    async function startAdminPanel() {

        /*
         * Do not load dashboard data
         * until authorization succeeds.
         */

        const authorized =
            await checkAdminAccess();


        if (!authorized) {
            return;
        }


        /*
         * Only an authenticated
         * administrator reaches here.
         */

        await loadDashboard(false);
    }


    startAdminPanel();

});