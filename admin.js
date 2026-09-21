"use strict";


/* =========================================================
   CROWN CASH ADMIN DASHBOARD
========================================================= */

const API_BASE =
    "https://crown-cash1.onrender.com";

const DASHBOARD_API =
    `${API_BASE}/admin-dashboard.php`;

const LOGOUT_API =
    `${API_BASE}/logout.php`;


/* =========================================================
   DOM
========================================================= */

const sidebar =
    document.getElementById("sidebar");

const menuButton =
    document.getElementById("menuButton");

const sidebarClose =
    document.getElementById("sidebarClose");

const sidebarOverlay =
    document.getElementById("sidebarOverlay");

const refreshButton =
    document.getElementById("refreshButton");

const logoutButton =
    document.getElementById("logoutButton");

const retryButton =
    document.getElementById("retryButton");

const totalUsers =
    document.getElementById("totalUsers");

const activeUsers =
    document.getElementById("activeUsers");

const pendingUsers =
    document.getElementById("pendingUsers");

const blockedUsers =
    document.getElementById("blockedUsers");

const totalBalance =
    document.getElementById("totalBalance");

const totalDeposits =
    document.getElementById("totalDeposits");

const totalWithdrawals =
    document.getElementById("totalWithdrawals");

const totalInvestments =
    document.getElementById("totalInvestments");

const adminName =
    document.getElementById("adminName");

const adminEmail =
    document.getElementById("adminEmail");

const adminAvatar =
    document.getElementById("adminAvatar");

const welcomeAdminName =
    document.getElementById("welcomeAdminName");

const recentTransactions =
    document.getElementById("recentTransactions");

const transactionsLoading =
    document.getElementById("transactionsLoading");

const transactionsEmpty =
    document.getElementById("transactionsEmpty");

const transactionsError =
    document.getElementById("transactionsError");

const dashboardErrorMessage =
    document.getElementById("dashboardErrorMessage");


/* =========================================================
   MOBILE SIDEBAR
========================================================= */

function openSidebar() {

    if (!sidebar) return;

    sidebar.classList.add("open");

    sidebarOverlay?.classList.add("show");

}


function closeSidebar() {

    if (!sidebar) return;

    sidebar.classList.remove("open");

    sidebarOverlay?.classList.remove("show");

}


menuButton?.addEventListener(
    "click",
    openSidebar
);

sidebarClose?.addEventListener(
    "click",
    closeSidebar
);

sidebarOverlay?.addEventListener(
    "click",
    closeSidebar
);


/* =========================================================
   NUMBER FORMAT
========================================================= */

function formatNumber(value) {

    const number =
        Number(value) || 0;

    return number.toLocaleString(
        "en-US"
    );
}


function formatUGX(value) {

    const number =
        Number(value) || 0;

    return `UGX ${number.toLocaleString("en-US")}`;
}


/* =========================================================
   SAFE TEXT
========================================================= */

function escapeHTML(value) {

    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}


/* =========================================================
   DATE
========================================================= */

function formatDate(value) {

    if (!value) {
        return "—";
    }

    const date =
        new Date(value);

    if (Number.isNaN(date.getTime())) {
        return String(value);
    }

    return date.toLocaleString(
        "en-GB",
        {
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit"
        }
    );
}


/* =========================================================
   TRANSACTION ICON
========================================================= */

function transactionIcon(type) {

    const normalized =
        String(type || "")
            .toLowerCase();

    if (
        normalized.includes("withdraw")
    ) {

        return `
            <svg viewBox="0 0 24 24" fill="none">

                <path
                    d="M12 20V8"
                    stroke="currentColor"
                    stroke-width="1.8"
                    stroke-linecap="round"
                />

                <path
                    d="M7.5 12L12 7.5L16.5 12"
                    stroke="currentColor"
                    stroke-width="1.8"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                />

            </svg>
        `;

    }


    if (
        normalized.includes("invest")
    ) {

        return `
            <svg viewBox="0 0 24 24" fill="none">

                <path
                    d="M4 20V12"
                    stroke="currentColor"
                    stroke-width="1.8"
                    stroke-linecap="round"
                />

                <path
                    d="M10 20V7"
                    stroke="currentColor"
                    stroke-width="1.8"
                    stroke-linecap="round"
                />

                <path
                    d="M16 20V10"
                    stroke="currentColor"
                    stroke-width="1.8"
                    stroke-linecap="round"
                />

                <path
                    d="M22 20V4"
                    stroke="currentColor"
                    stroke-width="1.8"
                    stroke-linecap="round"
                />

            </svg>
        `;

    }


    return `
        <svg viewBox="0 0 24 24" fill="none">

            <path
                d="M12 4V16"
                stroke="currentColor"
                stroke-width="1.8"
                stroke-linecap="round"
            />

            <path
                d="M7.5 12L12 16.5L16.5 12"
                stroke="currentColor"
                stroke-width="1.8"
                stroke-linecap="round"
                stroke-linejoin="round"
            />

        </svg>
    `;
}


/* =========================================================
   STATUS
========================================================= */

function statusClass(status) {

    const value =
        String(status || "")
            .toLowerCase();

    if (
        value === "approved" ||
        value === "completed" ||
        value === "success"
    ) {

        return "status-approved";

    }

    if (
        value === "active"
    ) {

        return "status-active";

    }

    return "status-pending";
}


/* =========================================================
   RENDER TRANSACTIONS
========================================================= */

function renderTransactions(
    transactions
) {

    if (!recentTransactions) {
        return;
    }

    recentTransactions.innerHTML = "";

    if (
        !Array.isArray(transactions) ||
        transactions.length === 0
    ) {

        transactionsEmpty.hidden = false;

        return;
    }

    transactionsEmpty.hidden = true;


    transactions.forEach(
        (transaction) => {

            const type =
                transaction.type ||
                transaction.transaction_type ||
                transaction.category ||
                "Transaction";

            const user =
                transaction.user_name ||
                transaction.full_name ||
                transaction.name ||
                transaction.email ||
                "Unknown User";

            const amount =
                transaction.amount ??
                transaction.value ??
                0;

            const status =
                transaction.status ||
                "pending";

            const date =
                transaction.created_at ||
                transaction.date ||
                transaction.timestamp ||
                "";


            const row =
                document.createElement("tr");


            row.innerHTML = `

                <td>

                    <div class="transaction-type">

                        <span class="transaction-mini-icon">

                            ${transactionIcon(type)}

                        </span>

                        <span>
                            ${escapeHTML(type)}
                        </span>

                    </div>

                </td>


                <td>
                    ${escapeHTML(user)}
                </td>


                <td>
                    ${formatUGX(amount)}
                </td>


                <td>

                    <span
                        class="status-badge ${statusClass(status)}"
                    >
                        ${escapeHTML(status)}
                    </span>

                </td>


                <td>
                    ${escapeHTML(formatDate(date))}
                </td>


                <td>

                    <span class="transaction-view">
                        View
                    </span>

                </td>

            `;


            recentTransactions.appendChild(row);

        }
    );

}


/* =========================================================
   ANIMATE NUMBER
========================================================= */

function animateNumber(
    element,
    target
) {

    if (!element) return;

    const finalValue =
        Number(target) || 0;

    const duration = 650;

    const start =
        performance.now();


    function update(now) {

        const progress =
            Math.min(
                (now - start) / duration,
                1
            );

        const eased =
            1 -
            Math.pow(
                1 - progress,
                3
            );

        const current =
            Math.round(
                finalValue * eased
            );

        element.textContent =
            formatNumber(current);


        if (progress < 1) {

            requestAnimationFrame(
                update
            );

        }

    }


    requestAnimationFrame(
        update
    );
}


/* =========================================================
   LOAD DASHBOARD
========================================================= */

async function loadDashboard() {

    if (transactionsLoading) {
        transactionsLoading.style.display =
            "flex";
    }

    if (transactionsEmpty) {
        transactionsEmpty.hidden = true;
    }

    if (transactionsError) {
        transactionsError.hidden = true;
    }

    if (refreshButton) {
        refreshButton.disabled = true;
        refreshButton.style.opacity = "0.65";
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
            await response.json()
                .catch(
                    () => ({})
                );


        if (
            !response.ok ||
            data.success !== true
        ) {

            throw new Error(
                data.message ||
                "Unable to load admin dashboard."
            );

        }


        /* ADMIN */

        const admin =
            data.admin || {};

        const name =
            admin.full_name ||
            admin.name ||
            "Administrator";

        const email =
            admin.email ||
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
                name;
        }

        if (adminAvatar) {

            const firstLetter =
                name
                    .trim()
                    .charAt(0)
                    .toUpperCase();

            adminAvatar.textContent =
                firstLetter || "A";
        }


        /* STATS */

        const stats =
            data.stats || {};


        animateNumber(
            totalUsers,
            stats.total_users
        );

        animateNumber(
            activeUsers,
            stats.active_users
        );

        animateNumber(
            pendingUsers,
            stats.pending_users
        );

        animateNumber(
            blockedUsers,
            stats.blocked_users
        );

        animateNumber(
            totalDeposits,
            stats.total_deposits
        );

        animateNumber(
            totalWithdrawals,
            stats.total_withdrawals
        );

        animateNumber(
            totalInvestments,
            stats.total_investments
        );


        if (totalBalance) {

            totalBalance.textContent =
                formatUGX(
                    stats.total_balance
                );

        }


        /* TRANSACTIONS */

        const transactions =
            data.recent_transactions ||
            data.transactions ||
            [];


        renderTransactions(
            transactions
        );


    } catch (error) {

        console.error(
            "Admin dashboard:",
            error
        );


        if (transactionsError) {
            transactionsError.hidden =
                false;
        }

        if (dashboardErrorMessage) {

            dashboardErrorMessage.textContent =
                error.message ||
                "Please try again.";

        }


    } finally {

        if (transactionsLoading) {
            transactionsLoading.style.display =
                "none";
        }

        if (refreshButton) {
            refreshButton.disabled = false;
            refreshButton.style.opacity = "1";
        }

    }

}


/* =========================================================
   REFRESH
========================================================= */

refreshButton?.addEventListener(
    "click",
    loadDashboard
);

retryButton?.addEventListener(
    "click",
    loadDashboard
);


/* =========================================================
   LOGOUT
========================================================= */

logoutButton?.addEventListener(
    "click",
    async () => {

        const confirmed =
            confirm(
                "Are you sure you want to logout?"
            );

        if (!confirmed) {
            return;
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


        window.location.href =
            "login.html";

    }
);


/* =========================================================
   NOTIFICATIONS
========================================================= */

document
    .getElementById("notificationButton")
    ?.addEventListener(
        "click",
        () => {

            alert(
                "Admin notifications will appear here."
            );

        }
    );


/* =========================================================
   CLOSE SIDEBAR AFTER NAVIGATION
========================================================= */

document
    .querySelectorAll(".sidebar a")
    .forEach(
        (link) => {

            link.addEventListener(
                "click",
                closeSidebar
            );

        }
    );


/* =========================================================
   START
========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    () => {

        loadDashboard();

    }
);