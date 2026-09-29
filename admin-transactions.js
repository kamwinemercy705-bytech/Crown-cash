/* =========================================================
   CROWN CASH
   ADMIN TRANSACTIONS
   admin-transactions.js
   ========================================================= */

"use strict";

/* =========================================================
   CONFIGURATION
   ========================================================= */

const API_BASE = "https://crown-cash1.onrender.com";

const TRANSACTIONS_API =
    `${API_BASE}/admin_transactions.php`;

const LOGOUT_API =
    `${API_BASE}/logout.php`;

const ITEMS_PER_PAGE = 15;


/* =========================================================
   STATE
   ========================================================= */

let allTransactions = [];
let filteredTransactions = [];

let currentPage = 1;

let isLoading = false;

let currentTransaction = null;


/* =========================================================
   DOM HELPERS
   ========================================================= */

const $ = (selector) => document.querySelector(selector);

const $$ = (selector) =>
    Array.from(document.querySelectorAll(selector));


/* =========================================================
   DOM ELEMENTS
   ========================================================= */

const sidebar = $("#sidebar");
const sidebarOverlay = $("#sidebarOverlay");
const menuButton = $("#menuButton");

const adminName = $("#adminName");

const pageMessage = $("#pageMessage");

const refreshButton = $("#refreshButton");

const totalCount = $("#totalCount");
const pendingCount = $("#pendingCount");
const approvedCount = $("#approvedCount");
const rejectedCount = $("#rejectedCount");

const transactionCount = $("#transactionCount");

const searchInput = $("#searchInput");
const typeFilter = $("#typeFilter");
const statusFilter = $("#statusFilter");
const methodFilter = $("#methodFilter");

const transactionTableBody =
    $("#transactionTableBody");

const emptyState = $("#emptyState");

const paginationInfo = $("#paginationInfo");
const previousPage = $("#previousPage");
const pageNumber = $("#pageNumber");
const nextPage = $("#nextPage");

const transactionModal = $("#transactionModal");
const modalClose = $("#modalClose");
const modalTitle = $("#modalTitle");
const modalDetails = $("#modalDetails");
const modalCancel = $("#modalCancel");

const loadingOverlay = $("#loadingOverlay");

const currentYear = $("#currentYear");


/* =========================================================
   INITIALIZATION
   ========================================================= */

document.addEventListener("DOMContentLoaded", () => {

    initializePage();

});


async function initializePage() {

    setCurrentYear();

    loadAdminName();

    setupSidebar();

    setupFilters();

    setupPagination();

    setupModal();

    setupRefreshButton();

    setupLogout();

    await loadTransactions();

}


/* =========================================================
   CURRENT YEAR
   ========================================================= */

function setCurrentYear() {

    if (currentYear) {
        currentYear.textContent =
            new Date().getFullYear();
    }

}


/* =========================================================
   ADMIN NAME
   ========================================================= */

function loadAdminName() {

    if (!adminName) {
        return;
    }

    try {

        const storedUser =
            localStorage.getItem("crowncash_user");

        if (!storedUser) {
            adminName.textContent = "Administrator";
            return;
        }

        let user = null;

        try {
            user = JSON.parse(storedUser);
        } catch {
            user = null;
        }

        if (!user) {
            adminName.textContent = "Administrator";
            return;
        }

        const firstName =
            user.firstName ||
            user.firstname ||
            user.first_name ||
            "";

        const lastName =
            user.lastName ||
            user.lastname ||
            user.last_name ||
            "";

        const fullName =
            `${firstName} ${lastName}`.trim();

        adminName.textContent =
            fullName ||
            user.name ||
            user.email ||
            "Administrator";

    } catch (error) {

        console.error(
            "Unable to load admin name:",
            error
        );

        adminName.textContent =
            "Administrator";
    }

}


/* =========================================================
   SIDEBAR
   ========================================================= */

function setupSidebar() {

    if (menuButton) {

        menuButton.addEventListener(
            "click",
            () => {

                toggleSidebar(true);

            }
        );

    }

    if (sidebarOverlay) {

        sidebarOverlay.addEventListener(
            "click",
            () => {

                toggleSidebar(false);

            }
        );

    }

    $$(".nav-link").forEach((link) => {

        link.addEventListener(
            "click",
            () => {

                if (
                    window.innerWidth <= 900
                ) {
                    toggleSidebar(false);
                }

            }
        );

    });

    window.addEventListener(
        "resize",
        () => {

            if (
                window.innerWidth > 900
            ) {
                toggleSidebar(false);
            }

        }
    );

}


function toggleSidebar(open) {

    if (!sidebar) {
        return;
    }

    sidebar.classList.toggle(
        "open",
        Boolean(open)
    );

    if (sidebarOverlay) {

        sidebarOverlay.classList.toggle(
            "active",
            Boolean(open)
        );

    }

    if (menuButton) {

        menuButton.setAttribute(
            "aria-expanded",
            open ? "true" : "false"
        );

    }

}


/* =========================================================
   FILTER SETUP
   ========================================================= */

function setupFilters() {

    if (searchInput) {

        searchInput.addEventListener(
            "input",
            debounce(() => {

                currentPage = 1;

                applyFilters();

            }, 180)
        );

    }

    [
        typeFilter,
        statusFilter,
        methodFilter
    ].forEach((select) => {

        if (!select) {
            return;
        }

        select.addEventListener(
            "change",
            () => {

                currentPage = 1;

                applyFilters();

            }
        );

    });

}


/* =========================================================
   REFRESH
   ========================================================= */

function setupRefreshButton() {

    if (!refreshButton) {
        return;
    }

    refreshButton.addEventListener(
        "click",
        async () => {

            await loadTransactions();

        }
    );

}


/* =========================================================
   LOAD TRANSACTIONS
   ========================================================= */

async function loadTransactions() {

    if (isLoading) {
        return;
    }

    isLoading = true;

    setLoading(true);

    hideMessage();

    try {

        const response =
            await fetch(
                TRANSACTIONS_API,
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

        const result =
            await parseJsonResponse(response);

        if (
            !response.ok ||
            !result ||
            result.success !== true
        ) {

            throw new Error(
                result?.message ||
                `Request failed (${response.status})`
            );

        }

        allTransactions =
            Array.isArray(result.transactions)
                ? result.transactions
                : [];

        currentPage = 1;

        updateStatistics();

        applyFilters();

        if (allTransactions.length === 0) {

            showMessage(
                "No transactions have been recorded yet.",
                "info"
            );

        }

    } catch (error) {

        console.error(
            "Transaction loading error:",
            error
        );

        allTransactions = [];
        filteredTransactions = [];

        updateStatistics();
        renderTransactions();
        updatePagination();

        showMessage(
            getErrorMessage(error),
            "error"
        );

    } finally {

        isLoading = false;

        setLoading(false);

    }

}


/* =========================================================
   JSON RESPONSE PARSER
   ========================================================= */

async function parseJsonResponse(response) {

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
   FILTERING
   ========================================================= */

function applyFilters() {

    const search =
        normalize(
            searchInput?.value || ""
        );

    const selectedType =
        normalize(
            typeFilter?.value || "all"
        );

    const selectedStatus =
        normalize(
            statusFilter?.value || "all"
        );

    const selectedMethod =
        normalize(
            methodFilter?.value || "all"
        );

    filteredTransactions =
        allTransactions.filter(
            (transaction) => {

                const type =
                    normalize(
                        transaction.type ||
                        getTransactionType(transaction)
                    );

                const status =
                    normalize(
                        transaction.status ||
                        "unknown"
                    );

                const method =
                    normalize(
                        transaction.method ||
                        "system"
                    );

                const searchableText =
                    [
                        transaction.reference,
                        transaction.id,
                        transaction.user_name,
                        transaction.user_email,
                        transaction.user_phone,
                        transaction.amount,
                        transaction.currency,
                        transaction.type,
                        transaction.status,
                        transaction.method,
                        transaction.account,
                        transaction.description
                    ]
                        .filter(
                            (value) =>
                                value !== undefined &&
                                value !== null
                        )
                        .join(" ")
                        .toLowerCase();

                const matchesSearch =
                    !search ||
                    searchableText.includes(search);

                const matchesType =
                    selectedType === "all" ||
                    type === selectedType;

                const matchesStatus =
                    selectedStatus === "all" ||
                    status === selectedStatus;

                const matchesMethod =
                    selectedMethod === "all" ||
                    method === selectedMethod;

                return (
                    matchesSearch &&
                    matchesType &&
                    matchesStatus &&
                    matchesMethod
                );

            }
        );

    const totalPages =
        getTotalPages();

    if (
        totalPages > 0 &&
        currentPage > totalPages
    ) {
        currentPage = totalPages;
    }

    if (totalPages === 0) {
        currentPage = 1;
    }

    renderTransactions();

    updatePagination();

}


/* =========================================================
   STATISTICS
   ========================================================= */

function updateStatistics() {

    const total =
        allTransactions.length;

    const pending =
        allTransactions.filter(
            (transaction) =>
                normalize(
                    transaction.status
                ) === "pending"
        ).length;

    const approved =
        allTransactions.filter(
            (transaction) => {

                const status =
                    normalize(
                        transaction.status
                    );

                return (
                    status === "approved" ||
                    status === "completed"
                );

            }
        ).length;

    const rejected =
        allTransactions.filter(
            (transaction) => {

                const status =
                    normalize(
                        transaction.status
                    );

                return (
                    status === "rejected" ||
                    status === "failed"
                );

            }
        ).length;

    setText(
        totalCount,
        formatNumber(total)
    );

    setText(
        pendingCount,
        formatNumber(pending)
    );

    setText(
        approvedCount,
        formatNumber(approved)
    );

    setText(
        rejectedCount,
        formatNumber(rejected)
    );

}


/* =========================================================
   RENDER TRANSACTIONS
   ========================================================= */

function renderTransactions() {

    if (!transactionTableBody) {
        return;
    }

    transactionTableBody.innerHTML = "";

    const pageItems =
        getCurrentPageItems();

    if (
        pageItems.length === 0
    ) {

        showEmptyState(true);

        return;

    }

    showEmptyState(false);

    const fragment =
        document.createDocumentFragment();

    pageItems.forEach(
        (transaction) => {

            const row =
                createTransactionRow(
                    transaction
                );

            fragment.appendChild(row);

        }
    );

    transactionTableBody.appendChild(
        fragment
    );

}


/* =========================================================
   CREATE TRANSACTION ROW
   ========================================================= */

function createTransactionRow(transaction) {

    const row =
        document.createElement("tr");

    const type =
        normalize(
            transaction.type ||
            getTransactionType(transaction)
        );

    const status =
        normalize(
            transaction.status ||
            "unknown"
        );

    const method =
        normalize(
            transaction.method ||
            "system"
        );

    const reference =
        transaction.reference ||
        transaction.id ||
        "—";

    const userName =
        transaction.user_name ||
        "Unknown user";

    const userEmail =
        transaction.user_email ||
        "No email";

    const amount =
        formatAmount(
            transaction.amount,
            transaction.currency
        );

    const date =
        formatDate(
            transaction.created_at
        );

    row.innerHTML = `
        <td>
            <span class="transaction-reference">
                ${escapeHtml(reference)}
            </span>
        </td>

        <td>
            <div class="transaction-user">
                <span class="transaction-user-name">
                    ${escapeHtml(userName)}
                </span>

                <span class="transaction-user-email">
                    ${escapeHtml(userEmail)}
                </span>
            </div>
        </td>

        <td>
            <span class="type-badge ${getBadgeClass(type)}">
                ${escapeHtml(formatLabel(type))}
            </span>
        </td>

        <td>
            <span class="transaction-amount">
                ${escapeHtml(amount)}
            </span>
        </td>

        <td>
            <span class="method-badge ${getBadgeClass(method)}">
                ${escapeHtml(formatLabel(method))}
            </span>
        </td>

        <td>
            <span class="status-badge ${getBadgeClass(status)}">
                ${escapeHtml(formatLabel(status))}
            </span>
        </td>

        <td>
            <span class="transaction-date">
                ${escapeHtml(date)}
            </span>
        </td>

        <td>
            <button
                type="button"
                class="view-button"
                title="View transaction"
                aria-label="View transaction"
            >
                ${eyeIcon()}
            </button>
        </td>
    `;

    const viewButton =
        row.querySelector(
            ".view-button"
        );

    if (viewButton) {

        viewButton.addEventListener(
            "click",
            () => {

                openTransactionModal(
                    transaction
                );

            }
        );

    }

    return row;

}


/* =========================================================
   PAGINATION
   ========================================================= */

function setupPagination() {

    if (previousPage) {

        previousPage.addEventListener(
            "click",
            () => {

                if (
                    currentPage <= 1
                ) {
                    return;
                }

                currentPage--;

                renderTransactions();

                updatePagination();

                scrollTableToTop();

            }
        );

    }

    if (nextPage) {

        nextPage.addEventListener(
            "click",
            () => {

                const totalPages =
                    getTotalPages();

                if (
                    currentPage >= totalPages
                ) {
                    return;
                }

                currentPage++;

                renderTransactions();

                updatePagination();

                scrollTableToTop();

            }
        );

    }

}


function getTotalPages() {

    if (
        filteredTransactions.length === 0
    ) {
        return 0;
    }

    return Math.ceil(
        filteredTransactions.length /
        ITEMS_PER_PAGE
    );

}


function getCurrentPageItems() {

    const start =
        (currentPage - 1) *
        ITEMS_PER_PAGE;

    const end =
        start +
        ITEMS_PER_PAGE;

    return filteredTransactions.slice(
        start,
        end
    );

}


function updatePagination() {

    const total =
        filteredTransactions.length;

    const totalPages =
        getTotalPages();

    const start =
        total === 0
            ? 0
            : (
                (currentPage - 1) *
                ITEMS_PER_PAGE
            ) + 1;

    const end =
        total === 0
            ? 0
            : Math.min(
                currentPage *
                ITEMS_PER_PAGE,
                total
            );

    if (paginationInfo) {

        paginationInfo.textContent =
            total === 0
                ? "Showing 0 transactions"
                : `Showing ${start}–${end} of ${total}`;

    }

    if (pageNumber) {

        pageNumber.textContent =
            totalPages === 0
                ? "1"
                : `${currentPage}`;

    }

    if (previousPage) {

        previousPage.disabled =
            currentPage <= 1 ||
            totalPages === 0;

    }

    if (nextPage) {

        nextPage.disabled =
            currentPage >= totalPages ||
            totalPages === 0;

    }

    if (transactionCount) {

        transactionCount.textContent =
            total === 0
                ? "0 transactions"
                : `${formatNumber(total)} ${
                    total === 1
                        ? "transaction"
                        : "transactions"
                }`;

    }

}


/* =========================================================
   SCROLL TABLE TO TOP
   ========================================================= */

function scrollTableToTop() {

    const tableWrapper =
        document.querySelector(
            ".table-wrapper"
        );

    if (!tableWrapper) {
        return;
    }

    tableWrapper.scrollTo({
        top: 0,
        behavior: "smooth"
    });

}


/* =========================================================
   EMPTY STATE
   ========================================================= */

function showEmptyState(show) {

    if (emptyState) {

        emptyState.style.display =
            show ? "block" : "none";

    }

    if (transactionTableBody) {

        transactionTableBody.style.display =
            show ? "none" : "";

    }

}


/* =========================================================
   TRANSACTION MODAL
   ========================================================= */

function setupModal() {

    if (modalClose) {

        modalClose.addEventListener(
            "click",
            closeTransactionModal
        );

    }

    if (modalCancel) {

        modalCancel.addEventListener(
            "click",
            closeTransactionModal
        );

    }

    if (transactionModal) {

        transactionModal.addEventListener(
            "click",
            (event) => {

                if (
                    event.target ===
                    transactionModal
                ) {
                    closeTransactionModal();
                }

            }
        );

    }

    document.addEventListener(
        "keydown",
        (event) => {

            if (
                event.key === "Escape"
            ) {

                closeTransactionModal();

            }

        }
    );

}


function openTransactionModal(transaction) {

    if (!transactionModal) {
        return;
    }

    currentTransaction =
        transaction;

    const type =
        normalize(
            transaction.type ||
            getTransactionType(transaction)
        );

    const status =
        normalize(
            transaction.status ||
            "unknown"
        );

    const method =
        normalize(
            transaction.method ||
            "system"
        );

    if (modalTitle) {

        modalTitle.textContent =
            `Transaction ${transaction.reference || transaction.id || ""}`.trim();

    }

    if (modalDetails) {

        modalDetails.innerHTML =
            buildTransactionDetails(
                transaction,
                type,
                status,
                method
            );

    }

    transactionModal.classList.add(
        "show"
    );

    transactionModal.setAttribute(
        "aria-hidden",
        "false"
    );

    document.body.style.overflow =
        "hidden";

}


function closeTransactionModal() {

    if (!transactionModal) {
        return;
    }

    transactionModal.classList.remove(
        "show"
    );

    transactionModal.setAttribute(
        "aria-hidden",
        "true"
    );

    document.body.style.overflow =
        "";

    currentTransaction = null;

}


function buildTransactionDetails(
    transaction,
    type,
    status,
    method
) {

    const details = [

        [
            "Reference",
            transaction.reference ||
            transaction.id ||
            "—"
        ],

        [
            "Transaction ID",
            transaction.id ||
            "—"
        ],

        [
            "User",
            transaction.user_name ||
            "Unknown user"
        ],

        [
            "Email",
            transaction.user_email ||
            "—"
        ],

        [
            "Phone",
            transaction.user_phone ||
            "—"
        ],

        [
            "Amount",
            formatAmount(
                transaction.amount,
                transaction.currency
            )
        ],

        [
            "Type",
            formatLabel(type),
            "badge"
        ],

        [
            "Status",
            formatLabel(status),
            "badge"
        ],

        [
            "Method",
            formatLabel(method),
            "badge"
        ],

        [
            "Account",
            transaction.account ||
            "—"
        ],

        [
            "Description",
            transaction.description ||
            "—"
        ],

        [
            "Balance Reserved",
            formatBoolean(
                transaction.balance_reserved
            )
        ],

        [
            "Balance Deducted",
            formatBoolean(
                transaction.balance_deducted
            )
        ],

        [
            "Balance Restored",
            formatBoolean(
                transaction.balance_restored
            )
        ],

        [
            "Payout Sent",
            formatBoolean(
                transaction.payout_sent
            )
        ],

        [
            "Admin Approved",
            formatBoolean(
                transaction.admin_approved
            )
        ],

        [
            "Admin Rejected",
            formatBoolean(
                transaction.admin_rejected
            )
        ],

        [
            "Admin ID",
            transaction.admin_id ||
            "—"
        ],

        [
            "Admin Email",
            transaction.admin_email ||
            "—"
        ],

        [
            "Admin Action At",
            formatDate(
                transaction.admin_action_at
            )
        ],

        [
            "Created",
            formatDate(
                transaction.created_at
            )
        ],

        [
            "Updated",
            formatDate(
                transaction.updated_at
            )
        ]

    ];

    return details
        .map(
            (item) => {

                const label =
                    item[0];

                const value =
                    item[1];

                const typeClass =
                    item[2] || "";

                return `
                    <div class="detail-item">
                        <div class="detail-label">
                            ${escapeHtml(label)}
                        </div>

                        <div class="
                            detail-value
                            ${typeClass === "badge"
                                ? "transaction-detail-badge"
                                : ""}
                            ${label === "Amount"
                                ? "amount"
                                : ""}
                        ">
                            ${escapeHtml(value)}
                        </div>
                    </div>
                `;

            }
        )
        .join("");

}


/* =========================================================
   LOGOUT
   ========================================================= */

function setupLogout() {

    const logoutLinks =
        $$(".logout-link");

    logoutLinks.forEach(
        (link) => {

            link.addEventListener(
                "click",
                async (event) => {

                    event.preventDefault();

                    await logout();

                }
            );

        }
    );

}


async function logout() {

    setLoading(true);

    try {

        await fetch(
            LOGOUT_API,
            {
                method: "POST",

                credentials: "include",

                headers: {
                    "Accept":
                        "application/json"
                }
            }
        );

    } catch (error) {

        console.warn(
            "Logout request failed:",
            error
        );

    } finally {

        try {
            localStorage.removeItem(
                "crowncash_user"
            );
        } catch {
            /* Ignore localStorage errors */
        }

        window.location.href =
            "https://crown-cash.vercel.app/login.html";

    }

}


/* =========================================================
   LOADING
   ========================================================= */

function setLoading(show) {

    if (!loadingOverlay) {
        return;
    }

    loadingOverlay.classList.toggle(
        "show",
        Boolean(show)
    );

    loadingOverlay.setAttribute(
        "aria-hidden",
        show ? "false" : "true"
    );

}


/* =========================================================
   PAGE MESSAGES
   ========================================================= */

function showMessage(
    message,
    type = "info"
) {

    if (!pageMessage) {
        return;
    }

    pageMessage.textContent =
        message;

    pageMessage.className =
        `page-message show ${type}`;

}


function hideMessage() {

    if (!pageMessage) {
        return;
    }

    pageMessage.textContent =
        "";

    pageMessage.className =
        "page-message";

}


/* =========================================================
   ERROR MESSAGE
   ========================================================= */

function getErrorMessage(error) {

    const message =
        error?.message ||
        "";

    if (
        message.includes("401") ||
        message.toLowerCase().includes("unauthorized") ||
        message.toLowerCase().includes("admin")
    ) {

        return "Administrator authorization is required. Please log in again.";

    }

    if (
        message.toLowerCase().includes("failed to fetch") ||
        message.toLowerCase().includes("network")
    ) {

        return "Unable to connect to Crown Cash server. Please check your connection and try again.";

    }

    return (
        message ||
        "Unable to load transactions. Please try again."
    );

}


/* =========================================================
   FORMATTING
   ========================================================= */

function normalize(value) {

    return String(
        value ?? ""
    )
        .trim()
        .toLowerCase();

}


function formatLabel(value) {

    if (!value) {
        return "Unknown";
    }

    return String(value)
        .replace(/[_-]+/g, " ")
        .replace(
            /\b\w/g,
            (letter) =>
                letter.toUpperCase()
        );

}


function formatNumber(value) {

    const number =
        Number(value);

    if (
        !Number.isFinite(number)
    ) {
        return "0";
    }

    return number.toLocaleString(
        "en-US"
    );

}


function formatAmount(
    amount,
    currency
) {

    const number =
        Number(amount);

    const safeCurrency =
        currency ||
        "UGX";

    if (
        !Number.isFinite(number)
    ) {

        return `0 ${safeCurrency}`;

    }

    return `${safeCurrency} ${number.toLocaleString(
        "en-US",
        {
            minimumFractionDigits: 0,
            maximumFractionDigits: 2
        }
    )}`;

}


function formatDate(value) {

    if (!value) {
        return "—";
    }

    let date = null;

    if (
        typeof value === "object" &&
        value.$date
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

        return String(value);

    }

    return date.toLocaleString(
        "en-UG",
        {
            year: "numeric",
            month: "short",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit"
        }
    );

}


function formatBoolean(value) {

    if (
        value === true ||
        value === 1 ||
        value === "1" ||
        normalize(value) === "true"
    ) {

        return "Yes";

    }

    if (
        value === false ||
        value === 0 ||
        value === "0" ||
        normalize(value) === "false"
    ) {

        return "No";

    }

    return "—";

}


/* =========================================================
   TRANSACTION TYPE FALLBACK
   ========================================================= */

function getTransactionType(
    transaction
) {

    const description =
        normalize(
            transaction.description
        );

    const method =
        normalize(
            transaction.method
        );

    const payoutSent =
        transaction.payout_sent;

    if (
        method === "mtn" ||
        method === "airtel" ||
        payoutSent === true
    ) {

        return "withdrawal";

    }

    if (
        description.includes("deposit")
    ) {

        return "deposit";

    }

    if (
        description.includes("investment")
    ) {

        return "investment";

    }

    if (
        description.includes("return")
    ) {

        return "return";

    }

    if (
        description.includes("bonus")
    ) {

        return "bonus";

    }

    if (
        description.includes("referral")
    ) {

        return "referral";

    }

    return "other";

}


/* =========================================================
   BADGE CLASS
   ========================================================= */

function getBadgeClass(value) {

    const normalized =
        normalize(value);

    return normalized
        .replace(
            /[^a-z0-9_-]/g,
            ""
        );

}


/* =========================================================
   HTML ESCAPING
   ========================================================= */

function escapeHtml(value) {

    if (
        value === undefined ||
        value === null
    ) {

        return "";

    }

    return String(value)
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
   ICON
   ========================================================= */

function eyeIcon() {

    return `
        <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
        >
            <path
                d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z"
            ></path>

            <circle
                cx="12"
                cy="12"
                r="2.5"
            ></circle>
        </svg>
    `;

}


/* =========================================================
   GENERIC HELPERS
   ========================================================= */

function setText(
    element,
    value
) {

    if (element) {
        element.textContent = value;
    }

}


function debounce(
    callback,
    delay
) {

    let timer = null;

    return (...args) => {

        clearTimeout(timer);

        timer = setTimeout(
            () => callback(...args),
            delay
        );

    };

}


/* =========================================================
   PREVENT BACKGROUND SCROLL WHEN MOBILE SIDEBAR IS OPEN
   ========================================================= */

function updateBodySidebarState() {

    if (!sidebar) {
        return;
    }

    if (
        window.innerWidth <= 900 &&
        sidebar.classList.contains("open")
    ) {

        document.body.classList.add(
            "sidebar-open"
        );

    } else {

        document.body.classList.remove(
            "sidebar-open"
        );

    }

}


window.addEventListener(
    "resize",
    updateBodySidebarState
);


/* =========================================================
   END
   ========================================================= */

