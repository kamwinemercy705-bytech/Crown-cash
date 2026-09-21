/* =========================================================
   CROWN CASH — ADMIN DASHBOARD
   admin.js
   ========================================================= */

"use strict";

/* =========================================================
   CONFIGURATION
   ========================================================= */

const API_BASE = "https://crown-cash1.onrender.com";

const ADMIN_DASHBOARD_API =
    `${API_BASE}/admin-dashboard.php`;

const LOGOUT_API =
    `${API_BASE}/logout.php`;


/* =========================================================
   GLOBAL STATE
   ========================================================= */

let adminDashboardData = null;


/* =========================================================
   DOM HELPERS
   ========================================================= */

function $(selector) {
    return document.querySelector(selector);
}

function $$(selector) {
    return Array.from(
        document.querySelectorAll(selector)
    );
}


/* =========================================================
   SAFE TEXT
   ========================================================= */

function escapeHTML(value) {

    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


/* =========================================================
   NUMBER FORMAT
   ========================================================= */

function formatNumber(value) {

    const number = Number(value);

    if (!Number.isFinite(number)) {
        return "0";
    }

    return number.toLocaleString("en-US");
}


/* =========================================================
   UGX FORMAT
   ========================================================= */

function formatUGX(value) {

    const number = Number(value);

    if (!Number.isFinite(number)) {
        return "UGX 0";
    }

    return "UGX " + number.toLocaleString(
        "en-US",
        {
            maximumFractionDigits: 0
        }
    );
}


/* =========================================================
   DATE FORMAT
   ========================================================= */

function formatDate(value) {

    if (!value) {
        return "—";
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return String(value);
    }

    return date.toLocaleDateString(
        "en-GB",
        {
            day: "2-digit",
            month: "short",
            year: "numeric"
        }
    );
}


/* =========================================================
   TIME FORMAT
   ========================================================= */

function formatTime(value) {

    if (!value) {
        return "";
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return "";
    }

    return date.toLocaleTimeString(
        "en-GB",
        {
            hour: "2-digit",
            minute: "2-digit"
        }
    );
}


/* =========================================================
   FIND ELEMENT
   ========================================================= */

function findElement(...selectors) {

    for (const selector of selectors) {

        const element = $(selector);

        if (element) {
            return element;
        }
    }

    return null;
}


/* =========================================================
   SET TEXT
   ========================================================= */

function setText(selectors, value) {

    const list = Array.isArray(selectors)
        ? selectors
        : [selectors];

    const element = findElement(...list);

    if (element) {
        element.textContent = value;
    }

    return element;
}


/* =========================================================
   REMOVE LOADING STATE
   ========================================================= */

function removeLoadingState() {

    $$(".loading-value").forEach(element => {
        element.classList.remove(
            "loading-value"
        );
    });
}


/* =========================================================
   ANIMATE NUMBER
   ========================================================= */

function animateNumber(
    element,
    finalValue,
    duration = 800
) {

    if (!element) {
        return;
    }

    const target = Number(finalValue);

    if (!Number.isFinite(target)) {
        element.textContent = "0";
        return;
    }

    const start = 0;
    const startTime = performance.now();

    function update(currentTime) {

        const elapsed =
            currentTime - startTime;

        const progress =
            Math.min(
                elapsed / duration,
                1
            );

        const eased =
            1 -
            Math.pow(
                1 - progress,
                3
            );

        const current =
            start +
            (target - start) *
            eased;

        element.textContent =
            Math.round(current)
                .toLocaleString("en-US");

        if (progress < 1) {
            requestAnimationFrame(update);
        }
    }

    requestAnimationFrame(update);
}


/* =========================================================
   SET ANIMATED NUMBER
   ========================================================= */

function setAnimatedNumber(
    selectors,
    value
) {

    const list = Array.isArray(selectors)
        ? selectors
        : [selectors];

    const element =
        findElement(...list);

    if (!element) {
        return;
    }

    animateNumber(
        element,
        value
    );
}


/* =========================================================
   INITIALS
   ========================================================= */

function getInitials(name) {

    const clean =
        String(name ?? "")
            .trim();

    if (!clean) {
        return "A";
    }

    const parts =
        clean
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


/* =========================================================
   NORMALIZE API RESPONSE
   ========================================================= */

function normalizeDashboardResponse(data) {

    if (!data || typeof data !== "object") {
        return {
            success: false,
            message: "Invalid server response."
        };
    }

    return data;
}


/* =========================================================
   LOAD ADMIN DASHBOARD
   ========================================================= */

async function loadAdminDashboard() {

    showDashboardLoading();

    try {

        const response =
            await fetch(
                ADMIN_DASHBOARD_API,
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

        let data = null;

        try {
            data = await response.json();
        } catch (error) {

            throw new Error(
                "The server returned an invalid response."
            );
        }

        data =
            normalizeDashboardResponse(data);

        if (
            response.status === 401 ||
            response.status === 403
        ) {

            throw new Error(
                data.message ||
                "Administrator access required."
            );
        }

        if (!response.ok) {

            throw new Error(
                data.message ||
                "Unable to load admin dashboard."
            );
        }

        if (data.success === false) {

            throw new Error(
                data.message ||
                "Unable to load admin dashboard."
            );
        }

        adminDashboardData = data;

        hideDashboardError();

        renderDashboard(data);

    } catch (error) {

        console.error(
            "Admin dashboard error:",
            error
        );

        showDashboardError(
            error.message ||
            "Unable to load dashboard."
        );

    } finally {

        removeLoadingState();
    }
}


/* =========================================================
   SHOW LOADING
   ========================================================= */

function showDashboardLoading() {

    const values = [
        "#totalUsers",
        "#activeUsers",
        "#pendingUsers",
        "#blockedUsers",
        "#totalUsersValue",
        "#activeUsersValue",
        "#pendingUsersValue",
        "#blockedUsersValue"
    ];

    values.forEach(selector => {

        const element = $(selector);

        if (element) {
            element.classList.add(
                "loading-value"
            );
        }
    });
}


/* =========================================================
   RENDER DASHBOARD
   ========================================================= */

function renderDashboard(data) {

    const stats =
        data.stats ||
        data.statistics ||
        {};

    const users =
        data.users ||
        {};

    const admin =
        data.admin ||
        data.administrator ||
        data.user ||
        {};

    const transactions =
        Array.isArray(data.transactions)
            ? data.transactions
            : Array.isArray(data.recent_transactions)
                ? data.recent_transactions
                : [];


    /* -----------------------------------------------------
       USER STATISTICS
       ----------------------------------------------------- */

    const totalUsers =
        stats.total_users ??
        stats.totalUsers ??
        users.total ??
        data.total_users ??
        0;

    const activeUsers =
        stats.active_users ??
        stats.activeUsers ??
        users.active ??
        data.active_users ??
        0;

    const pendingUsers =
        stats.pending_users ??
        stats.pendingUsers ??
        users.pending ??
        data.pending_users ??
        0;

    const blockedUsers =
        stats.blocked_users ??
        stats.blockedUsers ??
        users.blocked ??
        data.blocked_users ??
        0;


    setAnimatedNumber(
        [
            "#totalUsers",
            "#totalUsersValue"
        ],
        totalUsers
    );

    setAnimatedNumber(
        [
            "#activeUsers",
            "#activeUsersValue"
        ],
        activeUsers
    );

    setAnimatedNumber(
        [
            "#pendingUsers",
            "#pendingUsersValue"
        ],
        pendingUsers
    );

    setAnimatedNumber(
        [
            "#blockedUsers",
            "#blockedUsersValue"
        ],
        blockedUsers
    );


    /* -----------------------------------------------------
       ADMIN NAME
       ----------------------------------------------------- */

    const adminName =
        admin.full_name ||
        admin.fullName ||
        admin.name ||
        "Administrator";

    const adminEmail =
        admin.email ||
        "";

    setText(
        [
            "#adminName",
            ".admin-name"
        ],
        adminName
    );

    setText(
        [
            "#adminEmail",
            ".admin-email"
        ],
        adminEmail
    );


    /* -----------------------------------------------------
       ADMIN AVATAR
       ----------------------------------------------------- */

    const avatar =
        findElement(
            "#adminAvatar",
            ".admin-avatar"
        );

    if (avatar) {

        avatar.textContent =
            getInitials(adminName);
    }


    /* -----------------------------------------------------
       WELCOME MESSAGE
       ----------------------------------------------------- */

    setText(
        [
            "#welcomeAdminName",
            "#welcomeName"
        ],
        adminName
    );


    /* -----------------------------------------------------
       TRANSACTIONS
       ----------------------------------------------------- */

    renderTransactions(
        transactions
    );


    /* -----------------------------------------------------
       OPTIONAL EXTRA STATISTICS
       ----------------------------------------------------- */

    renderExtraStatistics(
        data
    );
}


/* =========================================================
   EXTRA STATISTICS
   ========================================================= */

function renderExtraStatistics(data) {

    const stats =
        data.stats ||
        data.statistics ||
        {};

    const totalDeposits =
        stats.total_deposits ??
        stats.totalDeposits;

    const totalWithdrawals =
        stats.total_withdrawals ??
        stats.totalWithdrawals;

    const totalInvestments =
        stats.total_investments ??
        stats.totalInvestments;

    const totalBalance =
        stats.total_balance ??
        stats.totalBalance;


    if (
        totalDeposits !== undefined
    ) {

        setText(
            [
                "#totalDeposits",
                "#totalDepositsValue"
            ],
            formatUGX(totalDeposits)
        );
    }


    if (
        totalWithdrawals !== undefined
    ) {

        setText(
            [
                "#totalWithdrawals",
                "#totalWithdrawalsValue"
            ],
            formatUGX(totalWithdrawals)
        );
    }


    if (
        totalInvestments !== undefined
    ) {

        setText(
            [
                "#totalInvestments",
                "#totalInvestmentsValue"
            ],
            formatUGX(totalInvestments)
        );
    }


    if (
        totalBalance !== undefined
    ) {

        setText(
            [
                "#totalBalance",
                "#totalBalanceValue"
            ],
            formatUGX(totalBalance)
        );
    }
}


/* =========================================================
   RENDER TRANSACTIONS
   ========================================================= */

function renderTransactions(
    transactions
) {

    const container =
        findElement(
            "#recentTransactions",
            ".recent-transactions",
            "[data-recent-transactions]"
        );

    if (!container) {
        return;
    }


    if (!Array.isArray(transactions) ||
        transactions.length === 0) {

        container.innerHTML = `
            <div class="empty-state">

                <div class="empty-icon">

                    <svg
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                    >
                        <rect
                            x="3"
                            y="4"
                            width="18"
                            height="16"
                            rx="2"
                        />

                        <path
                            d="M7 8h10"
                        />

                        <path
                            d="M7 12h6"
                        />

                        <path
                            d="M7 16h4"
                        />
                    </svg>

                </div>

                <h3>No recent transactions</h3>

                <p>
                    Transactions will appear here
                    when users make deposits,
                    withdrawals or investments.
                </p>

            </div>
        `;

        return;
    }


    container.innerHTML =
        transactions
            .slice(0, 10)
            .map(
                transaction =>
                    createTransactionHTML(
                        transaction
                    )
            )
            .join("");
}


/* =========================================================
   TRANSACTION HTML
   ========================================================= */

function createTransactionHTML(
    transaction
) {

    const type =
        String(
            transaction.type ||
            transaction.transaction_type ||
            "transaction"
        ).toLowerCase();


    const status =
        String(
            transaction.status ||
            "pending"
        ).toLowerCase();


    const amount =
        Number(
            transaction.amount || 0
        );


    const userName =
        transaction.user_name ||
        transaction.full_name ||
        transaction.name ||
        transaction.email ||
        "User";


    const email =
        transaction.email ||
        "";


    const reference =
        transaction.reference ||
        transaction.transaction_reference ||
        transaction.ref ||
        "—";


    const createdAt =
        transaction.created_at ||
        transaction.date ||
        transaction.createdAt ||
        "";


    let icon = `
        <svg
            viewBox="0 0 24 24"
            aria-hidden="true"
        >
            <circle
                cx="12"
                cy="12"
                r="9"
            />

            <path
                d="M12 7v10"
            />

            <path
                d="M9 10c0-1.2 1-2 3-2s3 .8 3 2-1 2-3 2-3 .8-3 2 1 2 3 2 3-.8 3-2"
            />
        </svg>
    `;


    if (
        type.includes("deposit")
    ) {

        icon = `
            <svg
                viewBox="0 0 24 24"
                aria-hidden="true"
            >
                <path
                    d="M12 5v14"
                />

                <path
                    d="M7 14l5 5 5-5"
                />

                <path
                    d="M5 4h14"
                />
            </svg>
        `;
    }


    if (
        type.includes("withdraw")
    ) {

        icon = `
            <svg
                viewBox="0 0 24 24"
                aria-hidden="true"
            >
                <path
                    d="M12 19V5"
                />

                <path
                    d="M7 10l5-5 5 5"
                />

                <path
                    d="M5 20h14"
                />
            </svg>
        `;
    }


    if (
        type.includes("investment")
    ) {

        icon = `
            <svg
                viewBox="0 0 24 24"
                aria-hidden="true"
            >
                <path
                    d="M4 19V5"
                />

                <path
                    d="M4 19h16"
                />

                <path
                    d="M7 15l3-4 3 2 5-6"
                />

                <path
                    d="M15 7h3v3"
                />
            </svg>
        `;
    }


    const statusClass =
        getStatusClass(status);


    return `
        <div class="transaction-row">

            <div class="transaction-icon">
                ${icon}
            </div>

            <div class="transaction-info">

                <strong>
                    ${escapeHTML(
                        capitalize(type)
                    )}
                </strong>

                <span>
                    ${escapeHTML(
                        userName
                    )}
                </span>

                <small>
                    ${escapeHTML(
                        reference
                    )}
                </small>

            </div>

            <div class="transaction-info">

                <span>
                    ${escapeHTML(
                        email
                    )}
                </span>

                <small>
                    ${formatDate(
                        createdAt
                    )}
                    ${formatTime(
                        createdAt
                    )}
                </small>

            </div>

            <div class="transaction-amount">
                ${formatUGX(amount)}
            </div>

            <div>

                <span
                    class="status-badge ${statusClass}"
                >
                    ${escapeHTML(
                        capitalize(status)
                    )}
                </span>

            </div>

        </div>
    `;
}


/* =========================================================
   STATUS CLASS
   ========================================================= */

function getStatusClass(status) {

    const clean =
        String(status)
            .toLowerCase();

    if (
        clean === "approved" ||
        clean === "completed" ||
        clean === "success" ||
        clean === "successful"
    ) {

        return "positive";
    }

    if (
        clean === "rejected" ||
        clean === "failed" ||
        clean === "cancelled" ||
        clean === "blocked"
    ) {

        return "danger";
    }

    return "warning";
}


/* =========================================================
   CAPITALIZE
   ========================================================= */

function capitalize(value) {

    const text =
        String(value ?? "");

    if (!text) {
        return "";
    }

    return text.charAt(0).toUpperCase() +
        text.slice(1);
}


/* =========================================================
   DASHBOARD ERROR
   ========================================================= */

function showDashboardError(
    message
) {

    let errorBox =
        findElement(
            "#dashboardError",
            ".dashboard-error"
        );


    if (!errorBox) {

        const content =
            findElement(
                ".dashboard-content",
                "main"
            );

        if (!content) {
            return;
        }

        errorBox =
            document.createElement(
                "div"
            );

        errorBox.id =
            "dashboardError";

        errorBox.className =
            "dashboard-error";

        content.prepend(
            errorBox
        );
    }


    errorBox.innerHTML = `

        <div class="error-icon">

            <svg
                viewBox="0 0 24 24"
                width="18"
                height="18"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
            >
                <path
                    d="M12 8v4"
                />

                <path
                    d="M12 16h.01"
                />

                <circle
                    cx="12"
                    cy="12"
                    r="9"
                />
            </svg>

        </div>

        <div>

            <strong>
                Unable to load dashboard
            </strong>

            <p>
                ${escapeHTML(message)}
            </p>

        </div>

        <button
            type="button"
            id="dashboardRetryButton"
        >
            Retry
        </button>
    `;


    errorBox.style.display =
        "flex";


    const retry =
        $("#dashboardRetryButton");

    if (retry) {

        retry.addEventListener(
            "click",
            loadAdminDashboard
        );
    }
}


/* =========================================================
   HIDE DASHBOARD ERROR
   ========================================================= */

function hideDashboardError() {

    const errorBox =
        findElement(
            "#dashboardError",
            ".dashboard-error"
        );

    if (errorBox) {
        errorBox.style.display =
            "none";
    }
}


/* =========================================================
   MOBILE SIDEBAR
   ========================================================= */

function setupMobileSidebar() {

    const sidebar =
        findElement(
            ".admin-sidebar",
            "#adminSidebar"
        );

    if (!sidebar) {
        return;
    }


    let menuButton =
        findElement(
            ".menu-toggle",
            "#menuToggle"
        );


    let overlay =
        findElement(
            ".sidebar-overlay",
            "#sidebarOverlay"
        );


    /* -----------------------------------------------------
       CREATE MENU BUTTON IF MISSING
       ----------------------------------------------------- */

    if (!menuButton) {

        const headerLeft =
            findElement(
                ".header-left",
                ".admin-header"
            );

        if (headerLeft) {

            menuButton =
                document.createElement(
                    "button"
                );

            menuButton.type =
                "button";

            menuButton.className =
                "menu-toggle";

            menuButton.id =
                "menuToggle";

            menuButton.setAttribute(
                "aria-label",
                "Open menu"
            );

            menuButton.innerHTML = `
                <svg
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                >
                    <path
                        d="M4 6h16"
                    />

                    <path
                        d="M4 12h16"
                    />

                    <path
                        d="M4 18h16"
                    />
                </svg>
            `;

            headerLeft.prepend(
                menuButton
            );
        }
    }


    /* -----------------------------------------------------
       CREATE OVERLAY IF MISSING
       ----------------------------------------------------- */

    if (!overlay) {

        overlay =
            document.createElement(
                "div"
            );

        overlay.className =
            "sidebar-overlay";

        overlay.id =
            "sidebarOverlay";

        document.body.appendChild(
            overlay
        );
    }


    /* -----------------------------------------------------
       OPEN MENU
       ----------------------------------------------------- */

    function openSidebar() {

        sidebar.classList.add(
            "open"
        );

        overlay.classList.add(
            "show"
        );

        document.body.style.overflow =
            "hidden";
    }


    /* -----------------------------------------------------
       CLOSE MENU
       ----------------------------------------------------- */

    function closeSidebar() {

        sidebar.classList.remove(
            "open"
        );

        overlay.classList.remove(
            "show"
        );

        document.body.style.overflow =
            "";
    }


    if (menuButton) {

        menuButton.addEventListener(
            "click",
            function () {

                if (
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


    overlay.addEventListener(
        "click",
        closeSidebar
    );


    /* -----------------------------------------------------
       CLOSE WHEN NAVIGATION IS CLICKED
       ----------------------------------------------------- */

    sidebar
        .querySelectorAll("a")
        .forEach(link => {

            link.addEventListener(
                "click",
                function () {

                    if (
                        window.innerWidth <= 850
                    ) {

                        closeSidebar();
                    }
                }
            );
        });


    window.addEventListener(
        "resize",
        function () {

            if (
                window.innerWidth > 850
            ) {

                closeSidebar();
            }
        }
    );
}


/* =========================================================
   ACTIVE NAVIGATION
   ========================================================= */

function setupActiveNavigation() {

    const currentPage =
        window.location.pathname
            .split("/")
            .pop()
            .toLowerCase();


    $$(".nav-link").forEach(link => {

        const href =
            link.getAttribute("href");

        if (!href) {
            return;
        }

        const linkPage =
            href
                .split("/")
                .pop()
                .split("#")[0]
                .toLowerCase();


        if (
            linkPage &&
            linkPage === currentPage
        ) {

            link.classList.add(
                "active"
            );

        } else if (
            currentPage === "" &&
            linkPage === "admin.html"
        ) {

            link.classList.add(
                "active"
            );
        }
    });
}


/* =========================================================
   LOGOUT
   ========================================================= */

async function logoutAdmin() {

    try {

        const response =
            await fetch(
                LOGOUT_API,
                {
                    method: "POST",

                    credentials: "include",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body: JSON.stringify({})
                }
            );


        if (
            !response.ok
        ) {

            console.warn(
                "Logout request returned:",
                response.status
            );
        }

    } catch (error) {

        console.error(
            "Logout error:",
            error
        );

    } finally {

        window.location.href =
            "/login.html";
    }
}


/* =========================================================
   LOGOUT BUTTON
   ========================================================= */

function setupLogout() {

    const logoutButtons =
        $$(
            "#logoutButton, " +
            ".logout-button, " +
            "[data-logout]"
        );


    logoutButtons.forEach(button => {

        button.addEventListener(
            "click",
            function (event) {

                event.preventDefault();

                const confirmed =
                    window.confirm(
                        "Are you sure you want to logout?"
                    );

                if (confirmed) {
                    logoutAdmin();
                }
            }
        );
    });
}


/* =========================================================
   REFRESH BUTTON
   ========================================================= */

function setupRefresh() {

    const buttons =
        $$(
            "#refreshDashboard, " +
            ".refresh-dashboard, " +
            "[data-refresh-dashboard]"
        );


    buttons.forEach(button => {

        button.addEventListener(
            "click",
            function () {

                loadAdminDashboard();
            }
        );
    });
}


/* =========================================================
   NOTIFICATION BUTTON
   ========================================================= */

function setupNotifications() {

    const button =
        findElement(
            "#notificationButton",
            ".notification-button"
        );

    if (!button) {
        return;
    }

    button.addEventListener(
        "click",
        function () {

            alert(
                "Notifications will be connected to the Crown Cash notification system."
            );
        }
    );
}


/* =========================================================
   INITIALIZE
   ========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    function () {

        setupMobileSidebar();

        setupActiveNavigation();

        setupLogout();

        setupRefresh();

        setupNotifications();

        loadAdminDashboard();
    }
);


/* =========================================================
   GLOBAL FUNCTIONS
   ========================================================= */

window.CrownCashAdmin = {

    reload: loadAdminDashboard,

    logout: logoutAdmin,

    getData: function () {
        return adminDashboardData;
    }

};