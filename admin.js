/* =========================================================
   CROWN CASH ADMINISTRATION
   admin.js
   ========================================================= */

"use strict";

const API_BASE = "https://crown-cash1.onrender.com";

const ADMIN_AUTH_API =
    `${API_BASE}/admin-auth.php`;

const PROFILE_API =
    `${API_BASE}/profile.php`;

const ADMIN_DASHBOARD_API =
    `${API_BASE}/admin-dashboard.php`;

const LOGOUT_API =
    `${API_BASE}/logout.php`;


/* =========================================================
   GLOBAL STATE
   ========================================================= */

const AdminState = {
    authenticated: false,
    loading: false,
    sidebarOpen: false,
    dashboardLoaded: false
};


/* =========================================================
   HELPERS
   ========================================================= */

function getElement(id) {
    return document.getElementById(id);
}


function escapeHTML(value) {
    const div = document.createElement("div");

    div.textContent =
        value === null ||
        value === undefined
            ? ""
            : String(value);

    return div.innerHTML;
}


function getInitial(name) {
    const value =
        String(name || "A").trim();

    return (
        value.charAt(0).toUpperCase() ||
        "A"
    );
}


function formatCurrency(value) {

    let number = 0;

    if (
        value &&
        typeof value === "object"
    ) {
        if (
            typeof value.$numberDecimal !==
            "undefined"
        ) {
            number =
                Number(value.$numberDecimal) || 0;
        } else if (
            typeof value.$numberLong !==
            "undefined"
        ) {
            number =
                Number(value.$numberLong) || 0;
        } else {
            number =
                Number(value.value) || 0;
        }
    } else {
        number =
            Number(value) || 0;
    }

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


function formatNumber(value) {

    let number =
        Number(value) || 0;

    return number.toLocaleString(
        "en-UG",
        {
            maximumFractionDigits: 0
        }
    );
}


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
        "en-GB",
        {
            day: "2-digit",
            month: "short",
            year: "numeric"
        }
    );
}


function formatDateTime(value) {

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

    return date.toLocaleString(
        "en-GB",
        {
            day: "2-digit",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit"
        }
    );
}


/* =========================================================
   LOADER
   ========================================================= */

function showLoader() {

    const loader =
        getElement("pageLoader");

    if (!loader) {
        return;
    }

    loader.classList.remove(
        "hidden"
    );

    loader.style.display = "flex";

    loader.style.opacity = "1";

    loader.style.visibility =
        "visible";
}


function hideLoader() {

    const loader =
        getElement("pageLoader");

    if (!loader) {
        return;
    }

    loader.classList.add(
        "hidden"
    );

    loader.style.opacity = "0";

    loader.style.visibility =
        "hidden";

    loader.style.pointerEvents =
        "none";

    /*
     * Extra protection.
     * Even if CSS has a problem, the loader
     * cannot remain permanently visible.
     */
    setTimeout(() => {

        if (
            loader.classList.contains(
                "hidden"
            )
        ) {
            loader.style.display =
                "none";
        }

    }, 400);
}


/* =========================================================
   PAGE MESSAGE
   ========================================================= */

function showAdminMessage(
    message,
    type = "error"
) {

    let element =
        getElement("adminMessage");

    if (!element) {

        element =
            document.createElement(
                "div"
            );

        element.id =
            "adminMessage";

        element.className =
            "admin-message";

        const main =
            document.querySelector(
                ".main-content"
            );

        if (main) {
            main.prepend(element);
        }
    }

    element.textContent =
        message;

    element.className =
        `admin-message ${type}`;

    element.style.display =
        "block";
}


function clearAdminMessage() {

    const element =
        getElement("adminMessage");

    if (!element) {
        return;
    }

    element.textContent = "";

    element.style.display =
        "none";
}


/* =========================================================
   FETCH JSON
   ========================================================= */

async function fetchJSON(
    url,
    options = {}
) {

    const controller =
        new AbortController();

    const timeout =
        setTimeout(
            () => controller.abort(),
            15000
        );

    try {

        const response =
            await fetch(
                url,
                {
                    ...options,

                    credentials:
                        "include",

                    signal:
                        controller.signal,

                    headers: {
                        "Accept":
                            "application/json",

                        ...(options.headers ||
                            {})
                    }
                }
            );

        const text =
            await response.text();

        let data = {};

        try {
            data =
                text
                    ? JSON.parse(text)
                    : {};
        } catch (error) {

            throw new Error(
                "The server returned an invalid response."
            );
        }

        if (!response.ok) {

            const error =
                new Error(
                    data.message ||
                    `Server error ${response.status}`
                );

            error.status =
                response.status;

            throw error;
        }

        return data;

    } finally {

        clearTimeout(timeout);
    }
}


/* =========================================================
   ADMIN AUTHENTICATION
   ========================================================= */

async function verifyAdmin() {

    try {

        const data =
            await fetchJSON(
                ADMIN_AUTH_API,
                {
                    method: "GET"
                }
            );

        if (
            !data ||
            data.success !== true ||
            data.authorized !== true
        ) {

            throw new Error(
                data?.message ||
                "Administrator access was not confirmed."
            );
        }

        AdminState.authenticated =
            true;

        return true;

    } catch (error) {

        AdminState.authenticated =
            false;

        console.error(
            "Admin authentication error:",
            error
        );

        if (
            error.status === 401 ||
            error.status === 403
        ) {

            redirectToLogin(
                "Your administrator session has expired."
            );

            return false;
        }

        showAdminMessage(
            error.name === "AbortError"
                ? "The administrator server took too long to respond."
                : (
                    error.message ||
                    "Unable to verify administrator access."
                ),
            "error"
        );

        return false;
    }
}


/* =========================================================
   REDIRECT
   ========================================================= */

function redirectToLogin(
    message = ""
) {

    try {

        sessionStorage.setItem(
            "crownCashAdminMessage",
            message
        );

    } catch (error) {
        console.warn(
            "Could not save login message."
        );
    }

    window.location.href =
        "login.html";
}


/* =========================================================
   LOAD ADMIN PROFILE
   ========================================================= */

async function loadAdminProfile() {

    try {

        const data =
            await fetchJSON(
                PROFILE_API,
                {
                    method: "GET"
                }
            );

        if (
            !data ||
            data.success !== true
        ) {
            return null;
        }

        const user =
            data.user || {};

        const fullName =
            user.full_name ||
            [
                user.first_name,
                user.last_name
            ]
                .filter(Boolean)
                .join(" ") ||
            "Administrator";

        const firstName =
            user.first_name ||
            fullName
                .trim()
                .split(/\s+/)[0] ||
            "Administrator";

        const email =
            user.email ||
            "";

        const accountType =
            user.account_type ||
            user.role ||
            "admin";


        setText(
            "adminName",
            fullName
        );

        setText(
            "adminFirstName",
            firstName
        );

        setText(
            "adminEmail",
            email
        );

        setText(
            "headerUserName",
            firstName
        );

        setText(
            "accountName",
            fullName
        );

        setText(
            "adminAccountType",
            "Administrator"
        );


        setInitial(
            "adminAvatar",
            getInitial(fullName)
        );

        setInitial(
            "accountAvatar",
            getInitial(fullName)
        );


        return user;

    } catch (error) {

        console.error(
            "Profile loading error:",
            error
        );

        return null;
    }
}


/* =========================================================
   TEXT HELPERS
   ========================================================= */

function setText(
    id,
    value
) {

    const element =
        getElement(id);

    if (!element) {
        return;
    }

    element.textContent =
        value === null ||
        value === undefined
            ? ""
            : String(value);
}


function setInitial(
    id,
    value
) {

    const element =
        getElement(id);

    if (!element) {
        return;
    }

    element.textContent =
        getInitial(value);
}


/* =========================================================
   DASHBOARD STATISTICS
   ========================================================= */

function getStat(
    data,
    key,
    fallback = 0
) {

    if (
        data &&
        data[key] !== undefined &&
        data[key] !== null
    ) {
        return data[key];
    }

    if (
        data &&
        data.summary &&
        data.summary[key] !== undefined
    ) {
        return data.summary[key];
    }

    if (
        data &&
        data.statistics &&
        data.statistics[key] !== undefined
    ) {
        return data.statistics[key];
    }

    return fallback;
}


function updateDashboardStats(
    data
) {

    setText(
        "totalUsers",
        formatNumber(
            getStat(
                data,
                "total_users"
            )
        )
    );

    setText(
        "activeUsers",
        formatNumber(
            getStat(
                data,
                "active_users"
            )
        )
    );

    setText(
        "totalDeposits",
        formatCurrency(
            getStat(
                data,
                "total_deposits"
            )
        )
    );

    setText(
        "pendingDeposits",
        formatCurrency(
            getStat(
                data,
                "pending_deposits"
            )
        )
    );

    setText(
        "totalWithdrawals",
        formatCurrency(
            getStat(
                data,
                "total_withdrawals"
            )
        )
    );

    setText(
        "pendingWithdrawals",
        formatCurrency(
            getStat(
                data,
                "pending_withdrawals"
            )
        )
    );

    setText(
        "totalInvestments",
        formatCurrency(
            getStat(
                data,
                "total_investments"
            )
        )
    );

    setText(
        "activeInvestments",
        formatNumber(
            getStat(
                data,
                "active_investments"
            )
        )
    );

    setText(
        "totalReferrals",
        formatNumber(
            getStat(
                data,
                "total_referrals"
            )
        )
    );

    setText(
        "totalTransactions",
        formatNumber(
            getStat(
                data,
                "total_transactions"
            )
        )
    );

    setText(
        "openTickets",
        formatNumber(
            getStat(
                data,
                "open_tickets"
            )
        )
    );
}


/* =========================================================
   RECENT TRANSACTIONS
   ========================================================= */

function getTransactionArray(
    data
) {

    if (
        Array.isArray(
            data?.recent_transactions
        )
    ) {
        return data.recent_transactions;
    }

    if (
        Array.isArray(
            data?.transactions
        )
    ) {
        return data.transactions;
    }

    return [];
}


function getTransactionIcon(
    transaction
) {

    const type =
        String(
            transaction?.type ||
            transaction?.transaction_type ||
            ""
        ).toLowerCase();

    if (
        type.includes("deposit")
    ) {

        return `
            <svg viewBox="0 0 24 24"
                 aria-hidden="true">
                <path d="M12 19V5"></path>
                <path d="M6 11l6-6 6 6"></path>
            </svg>
        `;
    }

    if (
        type.includes("withdraw")
    ) {

        return `
            <svg viewBox="0 0 24 24"
                 aria-hidden="true">
                <path d="M12 5v14"></path>
                <path d="M18 13l-6 6-6-6"></path>
            </svg>
        `;
    }

    if (
        type.includes("investment")
    ) {

        return `
            <svg viewBox="0 0 24 24"
                 aria-hidden="true">
                <path d="M4 19V5"></path>
                <path d="M4 19h16"></path>
                <path d="M7 15l4-5 3 3 5-7"></path>
            </svg>
        `;
    }

    return `
        <svg viewBox="0 0 24 24"
             aria-hidden="true">
            <path d="M12 3v18"></path>
            <path d="M7 8l5-5 5 5"></path>
            <path d="M7 16l5 5 5-5"></path>
        </svg>
    `;
}


function getStatusClass(
    status
) {

    const value =
        String(
            status || ""
        ).toLowerCase();

    if (
        [
            "approved",
            "completed",
            "success",
            "successful",
            "active"
        ].includes(value)
    ) {
        return "status-success";
    }

    if (
        [
            "pending",
            "processing",
            "awaiting_payout"
        ].includes(value)
    ) {
        return "status-pending";
    }

    if (
        [
            "rejected",
            "failed",
            "cancelled",
            "blocked"
        ].includes(value)
    ) {
        return "status-danger";
    }

    return "status-neutral";
}


function renderRecentTransactions(
    data
) {

    const container =
        getElement(
            "recentTransactions"
        );

    if (!container) {
        return;
    }

    const transactions =
        getTransactionArray(data);

    if (!transactions.length) {

        container.innerHTML = `
            <div class="admin-empty-state">
                <div class="empty-state-icon">
                    <svg viewBox="0 0 24 24">
                        <path d="M4 5h16"></path>
                        <path d="M4 10h16"></path>
                        <path d="M4 15h10"></path>
                        <path d="M4 20h7"></path>
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
        transactions
            .slice(0, 8)
            .map(
                transaction => {

                    const name =
                        transaction.full_name ||
                        transaction.user_name ||
                        transaction.name ||
                        "Customer";

                    const type =
                        transaction.type ||
                        transaction.transaction_type ||
                        "Transaction";

                    const status =
                        transaction.status ||
                        "pending";

                    const amount =
                        transaction.amount ||
                        transaction.value ||
                        0;

                    return `
                        <div class="transaction-row">

                            <div class="transaction-icon">
                                ${getTransactionIcon(
                                    transaction
                                )}
                            </div>

                            <div class="transaction-info">

                                <strong>
                                    ${escapeHTML(
                                        name
                                    )}
                                </strong>

                                <span>
                                    ${escapeHTML(
                                        type
                                    )}
                                </span>

                                <small>
                                    ${formatDateTime(
                                        transaction.created_at ||
                                        transaction.date
                                    )}
                                </small>

                            </div>

                            <div class="transaction-value">

                                <strong>
                                    ${formatCurrency(
                                        amount
                                    )}
                                </strong>

                                <span class="status-badge
                                    ${getStatusClass(
                                        status
                                    )}">
                                    ${escapeHTML(
                                        status
                                    )}
                                </span>

                            </div>

                        </div>
                    `;
                }
            )
            .join("");
}


/* =========================================================
   RECENT USERS
   ========================================================= */

function getUsersArray(
    data
) {

    if (
        Array.isArray(
            data?.recent_users
        )
    ) {
        return data.recent_users;
    }

    if (
        Array.isArray(
            data?.users
        )
    ) {
        return data.users;
    }

    return [];
}


function renderRecentUsers(
    data
) {

    const container =
        getElement(
            "recentUsers"
        );

    if (!container) {
        return;
    }

    const users =
        getUsersArray(data);

    if (!users.length) {

        container.innerHTML = `
            <div class="admin-empty-state">
                <div class="empty-state-icon">
                    <svg viewBox="0 0 24 24">
                        <circle cx="9" cy="8" r="3"></circle>
                        <path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"></path>
                        <path d="M17 5.5a3 3 0 010 5.8"></path>
                        <path d="M18 14c2.2.7 3.8 2.8 3.8 5.2"></path>
                    </svg>
                </div>

                <strong>
                    No recent users
                </strong>

                <span>
                    New customer accounts will appear here.
                </span>
            </div>
        `;

        return;
    }


    container.innerHTML =
        users
            .slice(0, 8)
            .map(
                user => {

                    const name =
                        user.full_name ||
                        [
                            user.first_name,
                            user.last_name
                        ]
                            .filter(Boolean)
                            .join(" ") ||
                        "Customer";

                    const status =
                        user.status ||
                        "active";

                    return `
                        <div class="user-row">

                            <div class="user-avatar-small">
                                ${escapeHTML(
                                    getInitial(
                                        name
                                    )
                                )}
                            </div>

                            <div class="user-info">

                                <strong>
                                    ${escapeHTML(
                                        name
                                    )}
                                </strong>

                                <span>
                                    ${escapeHTML(
                                        user.email ||
                                        "No email"
                                    )}
                                </span>

                                <small>
                                    Joined
                                    ${formatDate(
                                        user.created_at
                                    )}
                                </small>

                            </div>

                            <div class="user-status">

                                <span class="status-badge
                                    ${getStatusClass(
                                        status
                                    )}">
                                    ${escapeHTML(
                                        status
                                    )}
                                </span>

                            </div>

                        </div>
                    `;
                }
            )
            .join("");
}


/* =========================================================
   LOAD DASHBOARD
   ========================================================= */

async function loadDashboard() {

    if (
        !AdminState.authenticated
    ) {
        return;
    }

    try {

        const data =
            await fetchJSON(
                ADMIN_DASHBOARD_API,
                {
                    method: "GET"
                }
            );

        if (
            !data ||
            data.success !== true
        ) {

            throw new Error(
                data?.message ||
                "Unable to load dashboard information."
            );
        }

        updateDashboardStats(
            data
        );

        renderRecentTransactions(
            data
        );

        renderRecentUsers(
            data
        );

        AdminState.dashboardLoaded =
            true;

        animateDashboardCards();

    } catch (error) {

        console.error(
            "Dashboard loading error:",
            error
        );

        if (
            error.status === 401 ||
            error.status === 403
        ) {

            redirectToLogin(
                "Your administrator session has expired."
            );

            return;
        }

        showAdminMessage(
            error.name === "AbortError"
                ? "The dashboard server took too long to respond."
                : (
                    error.message ||
                    "Unable to load administration dashboard."
                ),
            "error"
        );

        renderDashboardError();
    }
}


/* =========================================================
   DASHBOARD ERROR
   ========================================================= */

function renderDashboardError() {

    const transactionContainer =
        getElement(
            "recentTransactions"
        );

    if (
        transactionContainer &&
        !transactionContainer.children.length
    ) {

        transactionContainer.innerHTML = `
            <div class="admin-error-state">

                <div class="error-state-icon">

                    <svg viewBox="0 0 24 24">
                        <circle cx="12" cy="12" r="9"></circle>
                        <path d="M12 8v5"></path>
                        <path d="M12 16h.01"></path>
                    </svg>

                </div>

                <strong>
                    Dashboard data could not be loaded
                </strong>

                <span>
                    Please use the refresh button to try again.
                </span>

                <button
                    type="button"
                    class="admin-action-button secondary"
                    id="dashboardRetryButton"
                >
                    Retry
                </button>

            </div>
        `;

        const retry =
            getElement(
                "dashboardRetryButton"
            );

        if (retry) {

            retry.addEventListener(
                "click",
                loadDashboard
            );
        }
    }
}


/* =========================================================
   ANIMATE CARDS
   ========================================================= */

function animateDashboardCards() {

    const cards =
        document.querySelectorAll(
            ".stat-card"
        );

    cards.forEach(
        (card, index) => {

            setTimeout(
                () => {

                    card.classList.add(
                        "dashboard-card-visible"
                    );

                },
                index * 60
            );
        }
    );
}


/* =========================================================
   SIDEBAR
   ========================================================= */

function openSidebar() {

    const sidebar =
        getElement("sidebar");

    const overlay =
        getElement(
            "sidebarOverlay"
        );

    if (!sidebar) {
        return;
    }

    sidebar.classList.add(
        "mobile-open"
    );

    sidebar.classList.add(
        "open"
    );

    if (overlay) {

        overlay.classList.add(
            "visible"
        );

        overlay.classList.add(
            "active"
        );
    }

    document.body.classList.add(
        "sidebar-open"
    );

    AdminState.sidebarOpen =
        true;
}


function closeSidebar() {

    const sidebar =
        getElement("sidebar");

    const overlay =
        getElement(
            "sidebarOverlay"
        );

    if (sidebar) {

        sidebar.classList.remove(
            "mobile-open"
        );

        sidebar.classList.remove(
            "open"
        );
    }

    if (overlay) {

        overlay.classList.remove(
            "visible"
        );

        overlay.classList.remove(
            "active"
        );
    }

    document.body.classList.remove(
        "sidebar-open"
    );

    AdminState.sidebarOpen =
        false;
}


function setupSidebar() {

    const menuButton =
        getElement("menuButton");

    const sidebarClose =
        getElement(
            "sidebarClose"
        );

    const overlay =
        getElement(
            "sidebarOverlay"
        );

    /*
     * IMPORTANT:
     * Always start closed on mobile.
     */
    closeSidebar();


    if (menuButton) {

        menuButton.addEventListener(
            "click",
            event => {

                event.preventDefault();

                if (
                    AdminState.sidebarOpen
                ) {
                    closeSidebar();
                } else {
                    openSidebar();
                }
            }
        );
    }


    if (sidebarClose) {

        sidebarClose.addEventListener(
            "click",
            event => {

                event.preventDefault();

                closeSidebar();
            }
        );
    }


    if (overlay) {

        overlay.addEventListener(
            "click",
            closeSidebar
        );
    }


    /*
     * Close sidebar when a navigation
     * link is selected on mobile.
     */
    const links =
        document.querySelectorAll(
            "#sidebar a"
        );

    links.forEach(
        link => {

            link.addEventListener(
                "click",
                () => {

                    if (
                        window.innerWidth <= 900
                    ) {
                        closeSidebar();
                    }
                }
            );
        }
    );


    /*
     * If the phone changes back to
     * desktop width, remove mobile
     * sidebar state.
     */
    window.addEventListener(
        "resize",
        () => {

            if (
                window.innerWidth > 900
            ) {
                closeSidebar();
            }
        }
    );
}


/* =========================================================
   LOGOUT
   ========================================================= */

async function logout() {

    const button =
        getElement("logoutBtn");

    if (button) {
        button.disabled = true;
    }

    try {

        await fetchJSON(
            LOGOUT_API,
            {
                method: "GET"
            }
        );

    } catch (error) {

        console.warn(
            "Logout request failed:",
            error
        );

    } finally {

        window.location.href =
            "login.html";
    }
}


function setupLogout() {

    const button =
        getElement("logoutBtn");

    if (!button) {
        return;