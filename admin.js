/* =========================================================
   CROWN CASH - ADMIN DASHBOARD
   admin.js

   Includes:
   - Admin authentication
   - Admin profile
   - Dashboard statistics
   - Recent transactions/users
   - Deposit approval/rejection
   - Withdrawal approval/rejection
   - Investment approval/rejection
   - Pending action counts
   ========================================================= */

"use strict";

/* =========================================================
   CONFIGURATION
   ========================================================= */

const API_BASE = "https://crown-cash1.onrender.com";

const ADMIN_AUTH_API = `${API_BASE}/admin-auth.php`;
const PROFILE_API = `${API_BASE}/profile.php`;
const ADMIN_DASHBOARD_API = `${API_BASE}/admin-dashboard.php`;

const ADMIN_DEPOSITS_API = `${API_BASE}/admin_deposit.php`;
const ADMIN_WITHDRAWALS_API = `${API_BASE}/admin_withdrawal.php`;
const ADMIN_INVESTMENTS_API = `${API_BASE}/admin_investments.php`;

const LOGOUT_API = `${API_BASE}/logout.php`;

const REQUEST_TIMEOUT = 15000;


/* =========================================================
   STATE
   ========================================================= */

const AdminDashboard = {
    data: null,
    profile: null,
    authenticated: false,
    loading: false,

    deposits: [],
    withdrawals: [],
    investments: []
};


/* =========================================================
   DOM HELPERS
   ========================================================= */

function $(selector) {
    return document.querySelector(selector);
}


function setText(selector, value) {

    const element = $(selector);

    if (element) {
        element.textContent = value ?? "";
    }
}


function showElement(selector) {

    const element = $(selector);

    if (element) {
        element.style.display = "";
    }
}


function hideElement(selector) {

    const element = $(selector);

    if (element) {
        element.style.display = "none";
    }
}


/* =========================================================
   LOADER
   ========================================================= */

function showLoader(message = "Loading Administration") {

    const loader = $("#pageLoader");

    if (!loader) {
        return;
    }

    loader.classList.remove("hidden");

    const title =
        loader.querySelector(".loader-title") ||
        loader.querySelector("h1") ||
        loader.querySelector("h2");

    const subtitle =
        loader.querySelector(".loader-subtitle") ||
        loader.querySelector("p");

    if (title) {
        title.textContent = message;
    }

    if (subtitle) {
        subtitle.textContent =
            "Securing your administrator session...";
    }
}


function hideLoader() {

    const loader = $("#pageLoader");

    if (!loader) {
        return;
    }

    loader.classList.add("hidden");

    setTimeout(() => {

        if (loader) {

            loader.style.display = "none";

            loader.setAttribute(
                "aria-hidden",
                "true"
            );
        }

    }, 350);
}


/* =========================================================
   MESSAGE
   ========================================================= */

function showAdminMessage(
    message,
    type = "info"
) {

    let messageBox =
        $("#adminMessage");

    if (!messageBox) {

        messageBox =
            document.createElement("div");

        messageBox.id =
            "adminMessage";

        document.body.appendChild(
            messageBox
        );
    }

    messageBox.className =
        `admin-message ${type}`;

    messageBox.textContent =
        message;

    messageBox.style.display =
        "block";

    setTimeout(() => {

        if (messageBox) {
            messageBox.style.display =
                "none";
        }

    }, 6000);
}


/* =========================================================
   REQUEST WITH TIMEOUT
   ========================================================= */

async function fetchWithTimeout(
    url,
    options = {},
    timeout = REQUEST_TIMEOUT
) {

    const controller =
        new AbortController();

    const timeoutId =
        setTimeout(() => {
            controller.abort();
        }, timeout);

    try {

        const response =
            await fetch(
                url,
                {
                    ...options,
                    credentials: "include",
                    signal: controller.signal
                }
            );

        clearTimeout(timeoutId);

        return response;

    } catch (error) {

        clearTimeout(timeoutId);

        if (
            error.name ===
            "AbortError"
        ) {

            throw new Error(
                "The server took too long to respond. Please try again."
            );
        }

        throw error;
    }
}


/* =========================================================
   SAFE JSON
   ========================================================= */

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


/* =========================================================
   GENERIC API REQUEST
   ========================================================= */

async function apiRequest(
    url,
    options = {}
) {

    const response =
        await fetchWithTimeout(
            url,
            {
                ...options,
                headers: {
                    "Accept":
                        "application/json",
                    ...(options.headers || {})
                }
            }
        );

    const data =
        await readJson(response);

    if (
        response.status === 401
    ) {

        window.location.href =
            "login.html";

        throw new Error(
            "Administrator session expired."
        );
    }

    if (
        response.status === 403
    ) {

        throw new Error(
            data.message ||
            "Administrator access denied."
        );
    }

    if (
        !response.ok ||
        data.success === false
    ) {

        throw new Error(
            data.message ||
            `Request failed (${response.status})`
        );
    }

    return data;
}


/* =========================================================
   AUTHENTICATE ADMIN
   ========================================================= */

async function authenticateAdmin() {

    try {

        const data =
            await apiRequest(
                ADMIN_AUTH_API,
                {
                    method: "GET"
                }
            );

        console.log(
            "Admin authentication:",
            data
        );

        if (
            data.success === true &&
            data.authenticated === true &&
            data.authorized === true
        ) {

            AdminDashboard.authenticated =
                true;

            return true;
        }

        window.location.href =
            "login.html";

        return false;

    } catch (error) {

        console.error(
            "Admin authentication error:",
            error
        );

        showAdminMessage(
            error.message ||
            "Unable to verify administrator access.",
            "error"
        );

        return false;
    }
}


/* =========================================================
   LOAD ADMIN PROFILE
   ========================================================= */

async function loadAdminProfile() {

    try {

        const data =
            await apiRequest(
                PROFILE_API,
                {
                    method: "GET"
                }
            );

        AdminDashboard.profile =
            data.user || {};

        renderAdminProfile(
            AdminDashboard.profile
        );

        return AdminDashboard.profile;

    } catch (error) {

        console.error(
            "Profile loading error:",
            error
        );

        setText(
            "#adminName",
            "Administrator"
        );

        setText(
            "#adminFirstName",
            "Administrator"
        );

        setText(
            "#headerUserName",
            "Administrator"
        );

        setText(
            "#accountName",
            "Administrator"
        );

        setText(
            "#adminAccountType",
            "Admin Account"
        );

        return null;
    }
}


/* =========================================================
   RENDER ADMIN PROFILE
   ========================================================= */

function renderAdminProfile(user) {

    const fullName =
        user.full_name ||
        user.fullName ||
        [
            user.first_name ||
            user.firstName,

            user.last_name ||
            user.lastName
        ]
            .filter(Boolean)
            .join(" ") ||
        "Administrator";


    const firstName =
        user.first_name ||
        user.firstName ||
        fullName.split(" ")[0] ||
        "Administrator";


    const email =
        user.email ||
        "";


    const accountType =
        user.account_type ||
        user.role ||
        "admin";


    const avatarLetter =
        firstName
            .charAt(0)
            .toUpperCase() ||
        "A";


    setText(
        "#adminName",
        fullName
    );

    setText(
        "#adminFirstName",
        firstName
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
        formatAccountType(
            accountType
        )
    );


    [
        "#adminAvatar",
        "#accountAvatar"
    ].forEach(selector => {

        const element =
            $(selector);

        if (!element) {
            return;
        }

        if (
            element.tagName === "IMG"
        ) {
            return;
        }

        element.textContent =
            avatarLetter;
    });
}


/* =========================================================
   LOAD MAIN DASHBOARD
   ========================================================= */

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

        renderDashboard(data);

        return data;

    } catch (error) {

        console.error(
            "Dashboard data error:",
            error
        );

        showAdminMessage(
            error.message ||
            "Dashboard data could not be loaded.",
            "error"
        );

        renderDashboardError();

        return null;
    }
}


/* =========================================================
   RENDER MAIN DASHBOARD
   ========================================================= */

function renderDashboard(data) {

    const stats =
        data.stats ||
        data.summary ||
        data;


    setText(
        "#totalUsers",
        formatNumber(
            getValue(
                stats,
                [
                    "total_users",
                    "users",
                    "totalUsers"
                ],
                0
            )
        )
    );


    setText(
        "#activeUsers",
        formatNumber(
            getValue(
                stats,
                [
                    "active_users",
                    "activeUsers"
                ],
                0
            )
        )
    );


    setText(
        "#totalDeposits",
        formatCurrency(
            getValue(
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
        "#pendingDeposits",
        formatCurrency(
            getValue(
                stats,
                [
                    "pending_deposits",
                    "pendingDeposits"
                ],
                0
            )
        )
    );


    setText(
        "#totalWithdrawals",
        formatCurrency(
            getValue(
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
        "#pendingWithdrawals",
        formatCurrency(
            getValue(
                stats,
                [
                    "pending_withdrawals",
                    "pendingWithdrawals"
                ],
                0
            )
        )
    );


    setText(
        "#totalInvestments",
        formatCurrency(
            getValue(
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
        "#activeInvestments",
        formatNumber(
            getValue(
                stats,
                [
                    "active_investments",
                    "activeInvestments"
                ],
                0
            )
        )
    );


    setText(
        "#totalReferrals",
        formatNumber(
            getValue(
                stats,
                [
                    "total_referrals",
                    "referrals",
                    "totalReferrals"
                ],
                0
            )
        )
    );


    setText(
        "#totalTransactions",
        formatNumber(
            getValue(
                stats,
                [
                    "total_transactions",
                    "transactions",
                    "totalTransactions"
                ],
                0
            )
        )
    );


    setText(
        "#openTickets",
        formatNumber(
            getValue(
                stats,
                [
                    "open_tickets",
                    "open_support",
                    "openTickets"
                ],
                0
            )
        )
    );


    setText(
        "#newAccounts",
        formatNumber(
            getValue(
                stats,
                [
                    "new_accounts",
                    "newAccounts"
                ],
                0
            )
        )
    );


    renderRecentTransactions(
        data.recent_transactions ||
        data.recentTransactions ||
        []
    );


    renderRecentUsers(
        data.recent_users ||
        data.recentUsers ||
        []
    );
}


/* =========================================================
   DASHBOARD ERROR
   ========================================================= */

function renderDashboardError() {

    const transactionContainer =
        $("#recentTransactions");

    if (transactionContainer) {

        transactionContainer.innerHTML = `
            <div class="admin-empty-state">
                <div class="empty-icon">
                    <svg
                        width="28"
                        height="28"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="1.8">
                        <circle
                            cx="12"
                            cy="12"
                            r="9">
                        </circle>
                        <line
                            x1="12"
                            y1="8"
                            x2="12"
                            y2="12">
                        </line>
                        <line
                            x1="12"
                            y1="16"
                            x2="12.01"
                            y2="16">
                        </line>
                    </svg>
                </div>

                <strong>
                    Unable to load activity
                </strong>

                <span>
                    Check your connection and refresh the page.
                </span>
            </div>
        `;
    }
}


/* =========================================================
   RECENT TRANSACTIONS
   ========================================================= */

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
            <div class="admin-empty-state">
                <div class="empty-icon">
                    <svg
                        width="28"
                        height="28"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="1.8">
                        <path d="M3 12h18"></path>
                        <path d="M12 3v18"></path>
                    </svg>
                </div>

                <strong>
                    No transactions yet
                </strong>

                <span>
                    Recent platform activity will appear here.
                </span>
            </div>
        `;

        return;
    }


    container.innerHTML =
        transactions
            .slice(0, 8)
            .map(transaction => {

                const type =
                    transaction.type ||
                    transaction.transaction_type ||
                    "transaction";

                const status =
                    transaction.status ||
                    "pending";

                const amount =
                    getNumericValue(
                        transaction.amount
                    );

                const name =
                    transaction.full_name ||
                    transaction.user_name ||
                    transaction.name ||
                    transaction.email ||
                    "Crown Cash User";


                return `
                    <div class="transaction-row">

                        <div class="transaction-icon ${getTypeClass(type)}">

                            ${getTransactionIcon(type)}

                        </div>

                        <div class="transaction-info">

                            <strong>
                                ${escapeHtml(
                                    formatTransactionType(type)
                                )}
                            </strong>

                            <span>
                                ${escapeHtml(name)}
                            </span>

                        </div>

                        <div class="transaction-value">

                            <strong>
                                ${formatCurrency(amount)}
                            </strong>

                            <span
                                class="status-badge ${getStatusClass(status)}">

                                ${escapeHtml(
                                    formatStatus(status)
                                )}

                            </span>

                        </div>

                    </div>
                `;
            })
            .join("");
}


/* =========================================================
   RECENT USERS
   ========================================================= */

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
            <div class="admin-empty-state">

                <div class="empty-icon">

                    <svg
                        width="28"
                        height="28"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="1.8">

                        <circle
                            cx="12"
                            cy="8"
                            r="3">
                        </circle>

                        <path
                            d="M5 20c0-3.5 3-6 7-6s7 2.5 7 6">
                        </path>

                    </svg>

                </div>

                <strong>
                    No users yet
                </strong>

                <span>
                    Newly registered users will appear here.
                </span>

            </div>
        `;

        return;
    }


    container.innerHTML =
        users
            .slice(0, 8)
            .map(user => {

                const name =
                    user.full_name ||
                    user.fullName ||
                    [
                        user.first_name ||
                        user.firstName,

                        user.last_name ||
                        user.lastName
                    ]
                        .filter(Boolean)
                        .join(" ") ||
                    "User";


                const email =
                    user.email ||
                    "No email";


                const status =
                    user.status ||
                    "active";


                const firstLetter =
                    name
                        .charAt(0)
                        .toUpperCase();


                return `
                    <div class="user-row">

                        <div class="user-avatar">
                            ${escapeHtml(firstLetter)}
                        </div>

                        <div class="user-info">

                            <strong>
                                ${escapeHtml(name)}
                            </strong>

                            <span>
                                ${escapeHtml(email)}
                            </span>

                        </div>

                        <div class="user-status">

                            <span
                                class="status-badge ${getStatusClass(status)}">

                                ${escapeHtml(
                                    formatStatus(status)
                                )}

                            </span>

                        </div>

                    </div>
                `;
            })
            .join("");
}


/* =========================================================
   APPROVAL CENTER
   ========================================================= */

function createApprovalCenter() {

    let existing =
        $("#adminApprovalCenter");

    if (existing) {
        return existing;
    }


    const pendingSection =
        document.querySelector(
            ".pending-section"
        );

    if (!pendingSection) {
        return null;
    }


    const section =
        document.createElement(
            "section"
        );

    section.id =
        "adminApprovalCenter";

    section.className =
        "admin-approval-center";


    section.innerHTML = `

        <style>

            .admin-approval-center {
                width: 100%;
                max-width: 1200px;
                margin: 34px auto 0;
            }

            .approval-heading {
                margin-bottom: 18px;
            }

            .approval-heading .section-label {
                display: block;
                margin-bottom: 10px;
                color: #ed4ac1;
                font-size: 12px;
                font-weight: 900;
                letter-spacing: 2px;
                text-transform: uppercase;
            }

            .approval-heading h2 {
                color: #ffffff;
                font-size: 29px;
                font-weight: 820;
                letter-spacing: -0.7px;
            }

            .approval-tabs {
                display: flex;
                gap: 9px;
                flex-wrap: wrap;
                margin-bottom: 15px;
            }

            .approval-tab {
                min-height: 40px;
                padding: 0 16px;
                border-radius: 11px;
                border: 1px solid rgba(255,255,255,0.08);
                background: rgba(255,255,255,0.035);
                color: rgba(255,255,255,0.65);
                cursor: pointer;
                font-size: 12px;
                font-weight: 750;
            }

            .approval-tab.active {
                color: #170812;
                background:
                    linear-gradient(
                        110deg,
                        #ffd04c,
                        #ff43b4
                    );
                border-color: transparent;
            }

            .approval-panel {
                display: none;
            }

            .approval-panel.active {
                display: block;
            }

            .approval-list {
                display: flex;
                flex-direction: column;
                gap: 11px;
            }

            .approval-item {
                padding: 18px;
                border-radius: 18px;
                background:
                    linear-gradient(
                        145deg,
                        rgba(42,20,44,0.88),
                        rgba(21,11,25,0.92)
                    );
                border:
                    1px solid rgba(255,255,255,0.07);
            }

            .approval-item-top {
                display: flex;
                align-items: flex-start;
                justify-content: space-between;
                gap: 15px;
            }

            .approval-user {
                min-width: 0;
            }

            .approval-user strong {
                display: block;
                color: #ffffff;
                font-size: 14px;
                font-weight: 800;
            }

            .approval-user span {
                display: block;
                margin-top: 4px;
                color: rgba(255,255,255,0.45);
                font-size: 11px;
            }

            .approval-amount {
                text-align: right;
                white-space: nowrap;
            }

            .approval-amount strong {
                display: block;
                color: #ffd343;
                font-size: 16px;
                font-weight: 850;
            }

            .approval-details {
                display: grid;
                grid-template-columns:
                    repeat(4, minmax(0, 1fr));
                gap: 9px;
                margin-top: 15px;
            }

            .approval-detail {
                padding: 10px;
                border-radius: 11px;
                background: rgba(255,255,255,0.025);
                border:
                    1px solid rgba(255,255,255,0.05);
            }

            .approval-detail span {
                display: block;
                color: rgba(255,255,255,0.36);
                font-size: 9px;
                text-transform: uppercase;
                letter-spacing: 0.7px;
            }

            .approval-detail strong {
                display: block;
                margin-top: 4px;
                color: rgba(255,255,255,0.86);
                font-size: 11px;
                word-break: break-word;
            }

            .approval-actions {
                display: flex;
                justify-content: flex-end;
                gap: 9px;
                margin-top: 15px;
            }

            .approval-btn {
                min-height: 40px;
                padding: 0 17px;
                border-radius: 11px;
                border: 1px solid transparent;
                cursor: pointer;
                font-size: 11px;
                font-weight: 800;
            }

            .approval-btn:disabled {
                opacity: 0.55;
                cursor: not-allowed;
            }

            .approval-btn.approve {
                color: #091007;
                background:
                    linear-gradient(
                        110deg,
                        #b9f57c,
                        #58d66b
                    );
            }

            .approval-btn.reject {
                color: #ffffff;
                background: rgba(255,60,100,0.08);
                border-color: rgba(255,60,100,0.25);
            }

            .approval-empty {
                padding: 35px 20px;
                text-align: center;
                border-radius: 18px;
                background: rgba(255,255,255,0.025);
                border:
                    1px solid rgba(255,255,255,0.06);
                color: rgba(255,255,255,0.40);
            }

            .approval-empty strong {
                display: block;
                color: rgba(255,255,255,0.75);
                font-size: 13px;
            }

            .approval-empty span {
                display: block;
                margin-top: 5px;
                font-size: 11px;
            }

            @media (max-width: 700px) {

                .approval-details {
                    grid-template-columns:
                        repeat(2, minmax(0, 1fr));
                }

                .approval-item-top {
                    flex-direction: column;
                }

                .approval-amount {
                    text-align: left;
                }

                .approval-actions {
                    justify-content: stretch;
                }

                .approval-btn {
                    flex: 1;
                }
            }

            @media (max-width: 430px) {

                .approval-details {
                    grid-template-columns: 1fr;
                }

                .approval-actions {
                    flex-direction: column;
                }
            }

        </style>


        <div class="approval-heading">

            <span class="section-label">
                Administrator Controls
            </span>

            <h2>
                Approvals &amp; Rejections
            </h2>

        </div>


        <div class="approval-tabs">

            <button
                type="button"
                class="approval-tab active"
                data-approval-tab="deposits">

                Deposits
                <span id="approvalDepositCount">
                    (0)
                </span>

            </button>


            <button
                type="button"
                class="approval-tab"
                data-approval-tab="withdrawals">

                Withdrawals
                <span id="approvalWithdrawalCount">
                    (0)
                </span>

            </button>


            <button
                type="button"
                class="approval-tab"
                data-approval-tab="investments">

                Investments
                <span id="approvalInvestmentCount">
                    (0)
                </span>

            </button>

        </div>


        <div
            class="approval-panel active"
            id="approvalDeposits">

            <div
                class="approval-list"
                id="depositApprovalList">
            </div>

        </div>


        <div
            class="approval-panel"
            id="approvalWithdrawals">

            <div
                class="approval-list"
                id="withdrawalApprovalList">
            </div>

        </div>


        <div
            class="approval-panel"
            id="approvalInvestments">

            <div
                class="approval-list"
                id="investmentApprovalList">
            </div>

        </div>

    `;


    pendingSection.insertAdjacentElement(
        "afterend",
        section
    );


    setupApprovalTabs();

    return section;
}


/* =========================================================
   APPROVAL TABS
   ========================================================= */

function setupApprovalTabs() {

    document
        .querySelectorAll(
            "[data-approval-tab]"
        )
        .forEach(button => {

            button.addEventListener(
                "click",
                () => {

                    const target =
                        button.dataset.approvalTab;


                    document
                        .querySelectorAll(
                            "[data-approval-tab]"
                        )
                        .forEach(tab => {

                            tab.classList.toggle(
                                "active",
                                tab === button
                            );
                        });


                    document
                        .querySelectorAll(
                            ".approval-panel"
                        )
                        .forEach(panel => {

                            panel.classList.remove(
                                "active"
                            );
                        });


                    const panel =
                        document.querySelector(
                            `#approval${capitalize(target)}`
                        );

                    if (panel) {
                        panel.classList.add(
                            "active"
                        );
                    }

                }
            );

        });
}


/* =========================================================
   LOAD ALL APPROVAL DATA
   ========================================================= */

async function loadApprovalData() {

    createApprovalCenter();

    try {

        const [
            depositData,
            withdrawalData,
            investmentData
        ] = await Promise.all([

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


        AdminDashboard.deposits =
            Array.isArray(
                depositData.deposits
            )
                ? depositData.deposits
                : [];


        AdminDashboard.withdrawals =
            Array.isArray(
                withdrawalData.withdrawals
            )
                ? withdrawalData.withdrawals
                : [];


        AdminDashboard.investments =
            Array.isArray(
                investmentData.investments
            )
                ? investmentData.investments
                : [];


        renderApprovalCenter();

        updatePendingBadges();

        return true;

    } catch (error) {

        console.error(
            "Approval data error:",
            error
        );

        showAdminMessage(
            error.message ||
            "Unable to load approval requests.",
            "error"
        );

        renderApprovalError();

        return false;
    }
}


/* =========================================================
   RENDER APPROVAL CENTER
   ========================================================= */

function renderApprovalCenter() {

    renderDepositApprovals();

    renderWithdrawalApprovals();

    renderInvestmentApprovals();

    updatePendingBadges();
}


/* =========================================================
   DEPOSITS
   ========================================================= */

function renderDepositApprovals() {

    const container =
        $("#depositApprovalList");

    if (!container) {
        return;
    }


    const pending =
        AdminDashboard.deposits.filter(
            item =>
                String(
                    item.status ||
                    "pending"
                ).toLowerCase()
                === "pending"
        );


    setText(
        "#approvalDepositCount",
        `(${pending.length})`
    );


    if (pending.length === 0) {

        container.innerHTML =
            approvalEmpty(
                "No pending deposits",
                "All deposit requests have been processed."
            );

        return;
    }


    container.innerHTML =
        pending.map(deposit => {

            const id =
                deposit.id ||
                deposit._id ||
                "";


            const name =
                deposit.user_name ||
                deposit.customer_name ||
                deposit.email ||
                "Crown Cash User";


            const email =
                deposit.email ||
                "No email";


            const amount =
                getNumericValue(
                    deposit.amount
                );


            const method =
                deposit.payment_method ||
                deposit.paymentMethod ||
                "Mobile Money";


            const reference =
                deposit.transaction_reference ||
                deposit.transactionReference ||
                "—";


            return `
                <div class="approval-item">

                    <div class="approval-item-top">

                        <div class="approval-user">

                            <strong>
                                ${escapeHtml(name)}
                            </strong>

                            <span>
                                ${escapeHtml(email)}
                            </span>

                        </div>


                        <div class="approval-amount">

                            <strong>
                                ${formatCurrency(amount)}
                            </strong>

                            <span class="status-badge warning">
                                Pending
                            </span>

                        </div>

                    </div>


                    <div class="approval-details">

                        ${approvalDetail(
                            "Payment Method",
                            method
                        )}

                        ${approvalDetail(
                            "Reference",
                            reference
                        )}

                        ${approvalDetail(
                            "Merchant",
                            deposit.merchant_code || "—"
                        )}

                        ${approvalDetail(
                            "Date",
                            formatDate(deposit.created_at)
                        )}

                    </div>


                    <div class="approval-actions">

                        <button
                            type="button"
                            class="approval-btn reject"
                            data-approval-type="deposit"
                            data-approval-action="reject"
                            data-id="${escapeHtml(id)}">

                            Reject

                        </button>


                        <button
                            type="button"
                            class="approval-btn approve"
                            data-approval-type="deposit"
                            data-approval-action="approve"
                            data-id="${escapeHtml(id)}">

                            Approve Deposit

                        </button>

                    </div>

                </div>
            `;

        }).join("");
}


/* =========================================================
   WITHDRAWALS
   ========================================================= */

function renderWithdrawalApprovals() {

    const container =
        $("#withdrawalApprovalList");

    if (!container) {
        return;
    }


    const pending =
        AdminDashboard.withdrawals.filter(
            item =>
                String(
                    item.status ||
                    "pending"
                ).toLowerCase()
                === "pending"
        );


    setText(
        "#approvalWithdrawalCount",
        `(${pending.length})`
    );


    if (pending.length === 0) {

        container.innerHTML =
            approvalEmpty(
                "No pending withdrawals",
                "All withdrawal requests have been processed."
            );

        return;
    }


    container.innerHTML =
        pending.map(withdrawal => {

            const id =
                withdrawal.id ||
                withdrawal._id ||
                "";


            const name =
                withdrawal.user_name ||
                withdrawal.email ||
                "Crown Cash User";


            const email =
                withdrawal.email ||
                "No email";


            const amount =
                getNumericValue(
                    withdrawal.amount
                );


            const fee =
                getNumericValue(
                    withdrawal.fee
                );


            const net =
                getNumericValue(
                    withdrawal.net_amount
                );


            const phone =
                withdrawal.phone ||
                withdrawal.account ||
                "—";


            const reference =
                withdrawal.reference ||
                withdrawal.transaction_reference ||
                "—";


            return `
                <div class="approval-item">

                    <div class="approval-item-top">

                        <div class="approval-user">

                            <strong>
                                ${escapeHtml(name)}
                            </strong>

                            <span>
                                ${escapeHtml(email)}
                            </span>

                        </div>


                        <div class="approval-amount">

                            <strong>
                                ${formatCurrency(amount)}
                            </strong>

                            <span class="status-badge warning">
                                Pending
                            </span>

                        </div>

                    </div>


                    <div class="approval-details">

                        ${approvalDetail(
                            "Phone",
                            phone
                        )}

                        ${approvalDetail(
                            "Fee",
                            formatCurrency(fee)
                        )}

                        ${approvalDetail(
                            "Net Payout",
                            formatCurrency(net)
                        )}

                        ${approvalDetail(
                            "Reference",
                            reference
                        )}

                    </div>


                    <div class="approval-actions">

                        <button
                            type="button"
                            class="approval-btn reject"
                            data-approval-type="withdrawal"
                            data-approval-action="reject"
                            data-id="${escapeHtml(id)}">

                            Reject

                        </button>


                        <button
                            type="button"
                            class="approval-btn approve"
                            data-approval-type="withdrawal"
                            data-approval-action="approve"
                            data-id="${escapeHtml(id)}">

                            Approve Withdrawal

                        </button>

                    </div>

                </div>
            `;

        }).join("");
}


/* =========================================================
   INVESTMENTS
   ========================================================= */

function renderInvestmentApprovals() {

    const container =
        $("#investmentApprovalList");

    if (!container) {
        return;
    }


    const pending =
        AdminDashboard.investments.filter(
            item =>
                String(
                    item.status ||
                    "pending"
                ).toLowerCase()
                === "pending"
        );


    setText(
        "#approvalInvestmentCount",
        `(${pending.length})`
    );


    if (pending.length === 0) {

        container.innerHTML =
            approvalEmpty(
                "No pending investments",
                "All investment requests have been processed."
            );

        return;
    }


    container.innerHTML =
        pending.map(investment => {

            const id =
                investment.id ||
                investment._id ||
                "";


            const name =
                investment.user_name ||
                investment.email ||
                "Crown Cash User";


            const email =
                investment.email ||
                "No email";


            const amount =
                getNumericValue(
                    investment.amount
                );


            const plan =
                investment.plan ||
                "Investment";


            const duration =
                investment.duration_days ||
                30;


            const reference =
                investment.reference ||
                "—";


            return `
                <div class="approval-item">

                    <div class="approval-item-top">

                        <div class="approval-user">

                            <strong>
                                ${escapeHtml(name)}
                            </strong>

                            <span>
                                ${escapeHtml(email)}
                            </span>

                        </div>


                        <div class="approval-amount">

                            <strong>
                                ${formatCurrency(amount)}
                            </strong>

                            <span class="status-badge warning">
                                Pending
                            </span>

                        </div>

                    </div>


                    <div class="approval-details">

                        ${approvalDetail(
                            "Plan",
                            plan
                        )}

                        ${approvalDetail(
                            "Duration",
                            `${duration} days`
                        )}

                        ${approvalDetail(
                            "Reference",
                            reference
                        )}

                        ${approvalDetail(
                            "Date",
                            formatDate(investment.created_at)
                        )}

                    </div>


                    <div class="approval-actions">

                        <button
                            type="button"
                            class="approval-btn reject"
                            data-approval-type="investment"
                            data-approval-action="reject"
                            data-id="${escapeHtml(id)}">

                            Reject

                        </button>


                        <button
                            type="button"
                            class="approval-btn approve"
                            data-approval-type="investment"
                            data-approval-action="approve"
                            data-id="${escapeHtml(id)}">

                            Approve Investment

                        </button>

                    </div>

                </div>
            `;

        }).join("");
}


/* =========================================================
   APPROVAL EMPTY STATE
   ========================================================= */

function approvalEmpty(
    title,
    description
) {

    return `
        <div class="approval-empty">

            <strong>
                ${escapeHtml(title)}
            </strong>

            <span>
                ${escapeHtml(description)}
            </span>

        </div>
    `;
}


/* =========================================================
   APPROVAL DETAIL
   ========================================================= */

function approvalDetail(
    label,
    value
) {

    return `
        <div class="approval-detail">

            <span>
                ${escapeHtml(label)}
            </span>

            <strong>
                ${escapeHtml(value)}
            </strong>

        </div>
    `;
}


/* =========================================================
   APPROVAL ERROR
   ========================================================= */

function renderApprovalError() {

    [
        "#depositApprovalList",
        "#withdrawalApprovalList",
        "#investmentApprovalList"
    ].forEach(selector => {

        const element =
            $(selector);

        if (!element) {
            return;
        }

        element.innerHTML =
            approvalEmpty(
                "Unable to load requests",
                "Please refresh the administration dashboard."
            );
    });
}


/* =========================================================
   APPROVAL CLICK HANDLER
   ========================================================= */

document.addEventListener(
    "click",
    async event => {

        const button =
            event.target.closest(
                "[data-approval-action]"
            );

        if (!button) {
            return;
        }


        const action =
            button.dataset.approvalAction;


        const type =
            button.dataset.approvalType;


        const id =
            button.dataset.id;


        if (!id) {

            showAdminMessage(
                "Invalid request ID.",
                "error"
            );

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
                    "error"
                );

                return;
            }
        }


        const actionName =
            action === "approve"
                ? "approve"
                : "reject";


        const confirmed =
            window.confirm(
                `Are you sure you want to ${actionName} this ${type}?`
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


/* =========================================================
   PROCESS APPROVAL
   ========================================================= */

async function processApproval(
    type,
    action,
    id,
    reason,
    button
) {

    if (button) {
        button.disabled = true;
    }


    const originalText =
        button
            ? button.textContent
            : "";


    if (button) {
        button.textContent =
            action === "approve"
                ? "Approving..."
                : "Rejecting...";
    }


    try {

        let endpoint;


        if (type === "deposit") {
            endpoint =
                ADMIN_DEPOSITS_API;
        }

        else if (
            type === "withdrawal"
        ) {
            endpoint =
                ADMIN_WITHDRAWALS_API;
        }

        else if (
            type === "investment"
        ) {
            endpoint =
                ADMIN_INVESTMENTS_API;
        }

        else {
            throw new Error(
                "Unknown approval type."
            );
        }


        const body = {
            action: action
        };


        if (type === "deposit") {

            body.depositId =
                id;
        }


        if (
            type === "withdrawal"
        ) {

            body.withdrawalId =
                id;
        }


        if (
            type === "investment"
        ) {

            body.investmentId =
                id;
        }


        if (reason) {

            body.reason =
                reason;
        }


        const data =
            await apiRequest(
                endpoint,
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body:
                        JSON.stringify(body)
                }
            );


        showAdminMessage(
            data.message ||
            `${type} ${action}d successfully.`,
            "success"
        );


        /*
         * Refresh all dashboard information
         * so balances, totals and pending counts
         * immediately reflect the action.
         */

        await Promise.allSettled([

            loadDashboardData(),

            loadApprovalData()

        ]);

    } catch (error) {

        console.error(
            "Approval processing error:",
            error
        );

        showAdminMessage(
            error.message ||
            `Unable to ${action} ${type}.`,
            "error"
        );

        if (button) {

            button.disabled =
                false;

            button.textContent =
                originalText;
        }
    }
}


/* =========================================================
   UPDATE PENDING BADGES
   ========================================================= */

function updatePendingBadges() {

    const pendingDeposits =
        AdminDashboard.deposits.filter(
            item =>
                String(
                    item.status ||
                    ""
                ).toLowerCase()
                === "pending"
        ).length;


    const pendingWithdrawals =
        AdminDashboard.withdrawals.filter(
            item =>
                String(
                    item.status ||
                    ""
                ).toLowerCase()
                === "pending"
        ).length;


    const pendingInvestments =
        AdminDashboard.investments.filter(
            item =>
                String(
                    item.status ||
                    ""
                ).toLowerCase()
                === "pending"
        ).length;


    setText(
        "#navPendingDeposits",
        pendingDeposits
    );


    setText(
        "#navPendingWithdrawals",
        pendingWithdrawals
    );


    /*
     * Your existing HTML does not currently have
     * a pending-investment badge, so create one.
     */

    addInvestmentNavBadge(
        pendingInvestments
    );
}


/* =========================================================
   ADD INVESTMENT NAV BADGE
   ========================================================= */

function addInvestmentNavBadge(
    count
) {

    const investmentLink =
        document.querySelector(
            'a[href="admin-investments.html"]'
        );

    if (!investmentLink) {
        return;
    }


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

        investmentLink.appendChild(
            badge
        );
    }


    badge.textContent =
        count;
}


/* =========================================================
   SIDEBAR
   ========================================================= */

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

            overlay.classList.add(
                "active"
            );
        }

        document.body.classList.add(
            "sidebar-open"
        );
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

            overlay.classList.remove(
                "active"
            );
        }

        document.body.classList.remove(
            "sidebar-open"
        );

        document.body.style.overflow =
            "";
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


    if (overlay) {

        overlay.addEventListener(
            "click",
            closeSidebar
        );
    }


    document
        .querySelectorAll(
            "#sidebar a"
        )
        .forEach(link => {

            link.addEventListener(
                "click",
                closeSidebar
            );
        });
}


/* =========================================================
   LOGOUT
   ========================================================= */

async function logoutAdmin() {

    const button =
        $("#logoutBtn");


    if (button) {

        button.disabled =
            true;

        button.style.opacity =
            "0.6";
    }


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
            8000
        );

    } catch (error) {

        console.warn(
            "Logout request error:",
            error
        );

    } finally {

        window.location.href =
            "login.html";
    }
}


/* =========================================================
   SETUP LOGOUT
   ========================================================= */

function setupLogout() {

    const button =
        $("#logoutBtn");

    if (!button) {
        return;
    }


    button.addEventListener(
        "click",
        event => {

            event.preventDefault();


            const confirmed =
                window.confirm(
                    "Are you sure you want to logout of the Crown Cash Administration Panel?"
                );


            if (!confirmed) {
                return;
            }


            logoutAdmin();

        }
    );
}


/* =========================================================
   INITIALIZE ADMIN DASHBOARD
   ========================================================= */

async function initializeAdminDashboard() {

    if (
        AdminDashboard.loading
    ) {
        return;
    }


    AdminDashboard.loading =
        true;


    showLoader(
        "Loading Administration"
    );


    try {

        /*
         * 1. Verify admin.
         */

        const authenticated =
            await authenticateAdmin();


        if (!authenticated) {
            return;
        }


        /*
         * 2. Prepare interface.
         */

        setupSidebar();

        setupLogout();

        createApprovalCenter();


        /*
         * 3. Load dashboard/profile/approvals.
         */

        await Promise.allSettled([

            loadAdminProfile(),

            loadDashboardData(),

            loadApprovalData()

        ]);

    } catch (error) {

        console.error(
            "Admin initialization error:",
            error
        );

        showAdminMessage(
            error.message ||
            "Unable to load administration dashboard.",
            "error"
        );

    } finally {

        hideLoader();

        AdminDashboard.loading =
            false;
    }
}


/* =========================================================
   UTILITIES
   ========================================================= */

function capitalize(value) {

    const string =
        String(value || "");

    return (
        string.charAt(0).toUpperCase() +
        string.slice(1)
    );
}


function formatDate(value) {

    if (!value) {
        return "—";
    }


    try {

        let date;


        if (
            typeof value === "object" &&
            value.$date
        ) {
            date =
                new Date(
                    value.$date
                );
        }

        else {
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

    } catch (error) {

        return "—";
    }
}


function getTransactionIcon(type) {

    const value =
        String(type)
            .toLowerCase();


    if (
        value.includes("deposit") ||
        value.includes("credit")
    ) {

        return `
            <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="1.8">

                <circle
                    cx="12"
                    cy="12"
                    r="9">
                </circle>

                <path
                    d="M12 16V8">
                </path>

                <path
                    d="M9 11l3-3 3 3">
                </path>

            </svg>
        `;
    }


    if (
        value.includes("withdraw")
    ) {

        return `
            <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="1.8">

                <circle
                    cx="12"
                    cy="12"
                    r="9">
                </circle>

                <path
                    d="M12 8v8">
                </path>

                <path
                    d="M9 13l3 3 3-3">
                </path>

            </svg>
        `;
    }


    if (
        value.includes("investment")
    ) {

        return `
            <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="1.8">

                <path d="M4 19V9"></path>
                <path d="M10 19V5"></path>
                <path d="M16 19v-7"></path>
                <path d="M22 19V3"></path>

            </svg>
        `;
    }


    return `
        <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8">

            <circle
                cx="12"
                cy="12"
                r="9">
            </circle>

            <path
                d="M8 12h8">
            </path>

            <path
                d="M12 8v8">
            </path>

        </svg>
    `;
}


function getTypeClass(type) {

    const value =
        String(type)
            .toLowerCase();


    if (
        value.includes("deposit")
    ) {
        return "deposit";
    }


    if (
        value.includes("withdraw")
    ) {
        return "withdrawal";
    }


    if (
        value.includes("investment")
    ) {
        return "investment";
    }


    return "transaction";
}


function getStatusClass(status) {

    const value =
        String(status)
            .toLowerCase()
            .replace(/\s+/g, "_");


    if (
        value === "approved" ||
        value === "completed" ||
        value === "active" ||
        value === "success" ||
        value === "successful"
    ) {
        return "success";
    }


    if (
        value === "rejected" ||
        value === "failed" ||
        value === "blocked" ||
        value === "suspended" ||
        value === "disabled"
    ) {
        return "danger";
    }


    if (
        value === "pending" ||
        value === "processing" ||
        value === "awaiting_payout"
    ) {
        return "warning";
    }


    return "neutral";
}


function formatStatus(status) {

    return String(
        status || "unknown"
    )
        .replace(/_/g, " ")
        .replace(
            /\b\w/g,
            letter =>
                letter.toUpperCase()
        );
}


function formatTransactionType(
    type
) {

    return String(
        type || "Transaction"
    )
        .replace(/_/g, " ")
        .replace(
            /\b\w/g,
            letter =>
                letter.toUpperCase()
        );
}


function formatAccountType(type) {

    const value =
        String(
            type || "admin"
        ).toLowerCase();


    if (
        value === "admin" ||
        value === "administrator"
    ) {
        return "Admin Account";
    }


    return formatStatus(value);
}


function formatCurrency(value) {

    const number =
        getNumericValue(value);


    return (
        "UGX " +
        new Intl.NumberFormat(
            "en-UG",
            {
                maximumFractionDigits: 0
            }
        ).format(number)
    );
}


function formatNumber(value) {

    const number =
        getNumericValue(value);


    return new Intl.NumberFormat(
        "en-UG",
        {
            maximumFractionDigits: 0
        }
    ).format(number);
}


function getNumericValue(value) {

    if (
        value === null ||
        value === undefined ||
        value === ""
    ) {
        return 0;
    }


    if (
        typeof value === "number"
    ) {

        return Number.isFinite(value)
            ? value
            : 0;
    }


    if (
        typeof value === "object"
    ) {

        if (
            value.$numberDecimal !==
            undefined
        ) {

            return (
                parseFloat(
                    value.$numberDecimal
                ) || 0
            );
        }


        if (
            value.$numberInt !==
            undefined
        ) {

            return (
                parseFloat(
                    value.$numberInt
                ) || 0
            );
        }


        if (
            value.$numberLong !==
            undefined
        ) {

            return (
                parseFloat(
                    value.$numberLong
                ) || 0
            );
        }


        if (
            value.$date !==
            undefined
        ) {
            return 0;
        }
    }


    const parsed =
        parseFloat(
            String(value)
                .replace(/,/g, "")
        );


    return Number.isFinite(parsed)
        ? parsed
        : 0;
}


function getValue(
    object,
    keys,
    fallback = 0
) {

    if (
        !object ||
        typeof object !== "object"
    ) {
        return fallback;
    }


    for (
        const key of keys
    ) {

        if (
            object[key] !==
                undefined &&
            object[key] !==
                null
        ) {

            return object[key];
        }
    }


    return fallback;
}


function escapeHtml(value) {

    return String(
        value ?? ""
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


/* =========================================================
   START
   ========================================================= */

if (
    document.readyState ===
    "loading"
) {

    document.addEventListener(
        "DOMContentLoaded",
        initializeAdminDashboard
    );

} else {

    initializeAdminDashboard();
}


/* =========================================================
   GLOBAL API
   ========================================================= */

window.CrownCashAdmin = {

    reload:
        initializeAdminDashboard,

    loadProfile:
        loadAdminProfile,

    loadDashboard:
        loadDashboardData,

    loadApprovals:
        loadApprovalData,

    approveDeposit:
        id =>
            processApproval(
                "deposit",
                "approve",
                id,
                "",
                null
            ),

    rejectDeposit:
        id =>
            processApproval(
                "deposit",
                "reject",
                id,
                "",
                null
            ),

    approveWithdrawal:
        id =>
            processApproval(
                "withdrawal",
                "approve",
                id,
                "",
                null
            ),

    rejectWithdrawal:
        id =>
            processApproval(
                "withdrawal",
                "reject",
                id,
                "",
                null
            ),

    approveInvestment:
        id =>
            processApproval(
                "investment",
                "approve",
                id,
                "",
                null
            ),

    rejectInvestment:
        id =>
            processApproval(
                "investment",
                "reject",
                id,
                "",
                null
            ),

    logout:
        logoutAdmin,

    state:
        AdminDashboard

};