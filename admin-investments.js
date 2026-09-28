"use strict";

/* =========================================================
   CROWN CASH — ADMIN INVESTMENTS
   ========================================================= */

const API_BASE =
    "https://crown-cash1.onrender.com";

const ADMIN_AUTH_API =
    `${API_BASE}/admin-auth.php`;

const INVESTMENTS_API =
    `${API_BASE}/admin-investments.php`;

const REQUEST_TIMEOUT = 12000;

const state = {

    investments: [],

    filteredInvestments: [],

    currentPage: 1,

    perPage: 10,

    currentInvestment: null,

    loading: false
};


/* =========================================================
   SVG ICONS
   ========================================================= */

const ICONS = {

    chart: `
        <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M4 19V5"></path>
            <path d="M4 19h16"></path>
            <path d="m7 15 4-4 3 2 5-6"></path>
        </svg>
    `,

    users: `
        <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path>
            <circle cx="9" cy="7" r="4"></circle>
            <path d="M22 21v-2a4 4 0 0 0-3-3.87"></path>
            <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
        </svg>
    `,

    clock: `
        <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="12" cy="12" r="9"></circle>
            <path d="M12 7v5l3 2"></path>
        </svg>
    `,

    check: `
        <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="m5 12 4 4L19 6"></path>
        </svg>
    `,

    close: `
        <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M6 6l12 12"></path>
            <path d="M18 6 6 18"></path>
        </svg>
    `,

    refresh: `
        <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M20 11a8 8 0 0 0-14.5-4L3 10"></path>
            <path d="M3 5v5h5"></path>
            <path d="M4 13a8 8 0 0 0 14.5 4L21 14"></path>
            <path d="M21 19v-5h-5"></path>
        </svg>
    `,

    eye: `
        <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z"></path>
            <circle cx="12" cy="12" r="2.5"></circle>
        </svg>
    `,

    shield: `
        <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 3 20 6v5c0 5-3.2 8.3-8 10-4.8-1.7-8-5-8-10V6l8-3Z"></path>
            <path d="m9 12 2 2 4-4"></path>
        </svg>
    `,

    investment: `
        <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M4 19V5"></path>
            <path d="M4 19h16"></path>
            <rect x="7" y="12" width="2.5" height="4" rx="1"></rect>
            <rect x="11" y="9" width="2.5" height="7" rx="1"></rect>
            <rect x="15" y="6" width="2.5" height="10" rx="1"></rect>
        </svg>
    `
};


/* =========================================================
   DOM HELPERS
   ========================================================= */

function $(selector) {

    return document.querySelector(selector);
}


function $all(selector) {

    return Array.from(
        document.querySelectorAll(selector)
    );
}


/* =========================================================
   PAGE VISIBILITY
   ========================================================= */

function showAdminPage() {

    const page =
        $("#adminInvestmentsPage") ||
        $(".admin-investments-page") ||
        $(".main-content");

    if (!page) {
        return;
    }

    page.hidden = false;

    page.style.display = "block";
    page.style.visibility = "visible";
    page.style.opacity = "1";
    page.style.pointerEvents = "auto";

    page.classList.add("page-ready");
}


function showLoader(
    message = "Verifying administrator access..."
) {

    const loader =
        $("#pageLoader");

    if (!loader) {
        return;
    }

    loader.classList.remove("hidden");

    loader.style.display = "flex";
    loader.style.visibility = "visible";
    loader.style.opacity = "1";

    const text =
        loader.querySelector(".loader-text") ||
        loader.querySelector("[data-loader-text]") ||
        loader.querySelector("p") ||
        loader.querySelector("span");

    if (text) {
        text.textContent = message;
    }
}


function hideLoader() {

    const loader =
        $("#pageLoader");

    if (!loader) {
        return;
    }

    loader.classList.add("hidden");

    loader.style.opacity = "0";
    loader.style.visibility = "hidden";
    loader.style.pointerEvents = "none";

    setTimeout(() => {

        loader.style.display = "none";

    }, 250);
}


/* =========================================================
   MESSAGE
   ========================================================= */

function showMessage(
    message,
    type = "error"
) {

    const messageBox =
        $("#investmentMessage") ||
        $("#adminMessage") ||
        $("#pageMessage");

    if (!messageBox) {

        console.error(message);

        return;
    }

    messageBox.textContent =
        message;

    messageBox.className =
        `admin-message ${type}`;

    messageBox.style.display =
        "block";
}


function clearMessage() {

    const messageBox =
        $("#investmentMessage") ||
        $("#adminMessage") ||
        $("#pageMessage");

    if (!messageBox) {
        return;
    }

    messageBox.textContent =
        "";

    messageBox.style.display =
        "none";
}


/* =========================================================
   FETCH WITH TIMEOUT
   ========================================================= */

async function fetchJson(
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

        const response =
            await fetch(
                url,
                {
                    ...options,

                    credentials:
                        "include",

                    cache:
                        "no-store",

                    signal:
                        controller.signal,

                    headers: {

                        "Accept":
                            "application/json",

                        ...(options.headers || {})
                    }
                }
            );

        const contentType =
            response.headers.get(
                "content-type"
            ) || "";

        let data;

        if (
            contentType.includes(
                "application/json"
            )
        ) {

            data =
                await response.json();

        } else {

            const text =
                await response.text();

            try {

                data =
                    JSON.parse(text);

            } catch {

                throw new Error(
                    `Server returned an invalid response (${response.status}).`
                );
            }
        }

        if (!response.ok) {

            const error =
                new Error(
                    data?.message ||
                    data?.error ||
                    `Request failed (${response.status}).`
                );

            error.status =
                response.status;

            throw error;
        }

        return data;

    } catch (error) {

        if (
            error.name ===
            "AbortError"
        ) {

            throw new Error(
                "The server took too long to respond. Please try again."
            );
        }

        throw error;

    } finally {

        clearTimeout(timer);
    }
}


/* =========================================================
   VERIFY ADMIN
   ========================================================= */

async function verifyAdministrator() {

    try {

        const data =
            await fetchJson(
                ADMIN_AUTH_API,
                {
                    method: "GET"
                },
                12000
            );

        if (
            data &&
            data.success === true &&
            data.authorized === true
        ) {

            return true;
        }

        if (
            data &&
            data.authorized === true
        ) {

            return true;
        }

        throw new Error(
            data?.message ||
            "Administrator access was not confirmed."
        );

    } catch (error) {

        console.error(
            "Administrator verification failed:",
            error
        );

        hideLoader();

        if (
            error.status === 401
        ) {

            showMessage(
                "Your administrator session has expired. Please log in again.",
                "error"
            );

        } else if (
            error.status === 403
        ) {

            showMessage(
                "Administrator access is required to view this page.",
                "error"
            );

        } else {

            showMessage(
                error.message ||
                "Unable to verify administrator access.",
                "error"
            );
        }

        return false;
    }
}


/* =========================================================
   ADMIN PROFILE
   ========================================================= */

async function loadAdminProfile() {

    try {

        const data =
            await fetchJson(
                `${API_BASE}/profile.php`,
                {
                    method: "GET"
                },
                10000
            );

        const user =
            data?.user || {};

        const name =
            user.full_name ||
            [
                user.first_name,
                user.last_name
            ]
                .filter(Boolean)
                .join(" ") ||
            "Administrator";

        $all(
            "#adminName, #headerAdminName, #adminProfileName, #adminUserName"
        )
            .forEach(element => {

                element.textContent =
                    name;
            });

        $all(
            "#adminRole, #adminProfileRole"
        )
            .forEach(element => {

                element.textContent =
                    "Administrator";
            });

    } catch (error) {

        console.warn(
            "Admin profile could not be loaded:",
            error
        );
    }
}


/* =========================================================
   NORMALIZATION
   ========================================================= */

function getId(item) {

    if (!item) {
        return "";
    }

    if (
        typeof item._id ===
        "string"
    ) {

        return item._id;
    }

    if (
        item._id?.$oid
    ) {

        return item._id.$oid;
    }

    return String(
        item.id ||
        item.investment_id ||
        item.investmentId ||
        ""
    );
}


function getUserName(item) {

    return (
        item.full_name ||
        item.fullName ||
        item.user_name ||
        item.name ||
        item.customer_name ||
        item.customerName ||
        item.user?.full_name ||
        item.user?.fullName ||
        item.user?.name ||
        item.email ||
        "Customer"
    );
}


function getPlan(item) {

    return (
        item.plan ||
        item.plan_name ||
        item.planName ||
        item.investment_plan ||
        item.package ||
        "Investment"
    );
}


function getAmount(item) {

    const value =
        item.amount ??
        item.investment_amount ??
        item.investmentAmount ??
        item.invested_amount ??
        item.amount_invested ??
        0;

    return (
        Number(value) || 0
    );
}


function getPeriod(item) {

    const value =
        item.period ??
        item.duration ??
        item.duration_days ??
        item.durationDays ??
        item.term ??
        30;

    if (
        typeof value ===
        "number"
    ) {

        return `${value} days`;
    }

    const text =
        String(value);

    if (
        /^\d+$/.test(text)
    ) {

        return `${text} days`;
    }

    return text;
}


function getStatus(item) {

    return String(
        item.status ||
        item.investment_status ||
        "pending"
    )
        .toLowerCase()
        .trim();
}


function getStartDate(item) {

    return (
        item.start_date ||
        item.startDate ||
        item.started_at ||
        item.startedAt ||
        item.created_at ||
        item.createdAt ||
        ""
    );
}


function getEndDate(item) {

    return (
        item.end_date ||
        item.endDate ||
        item.maturity_date ||
        item.maturityDate ||
        item.completed_at ||
        item.completedAt ||
        ""
    );
}


/* =========================================================
   FORMATTING
   ========================================================= */

function formatMoney(value) {

    const number =
        Number(value) || 0;

    return `UGX ${number.toLocaleString(
        "en-UG"
    )}`;
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


function statusLabel(status) {

    const labels = {

        pending:
            "Pending",

        active:
            "Active",

        approved:
            "Approved",

        completed:
            "Completed",

        rejected:
            "Rejected",

        cancelled:
            "Cancelled",

        canceled:
            "Cancelled"
    };

    return (
        labels[status] ||
        String(
            status ||
            "Pending"
        )
            .replace(
                /_/g,
                " "
            )
            .replace(
                /\b\w/g,
                letter =>
                    letter.toUpperCase()
            )
    );
}


function statusClass(status) {

    switch (status) {

        case "active":
            return "status-active";

        case "approved":
            return "status-approved";

        case "completed":
            return "status-completed";

        case "rejected":
            return "status-rejected";

        case "cancelled":
        case "canceled":
            return "status-cancelled";

        case "pending":
        default:
            return "status-pending";
    }
}


/* =========================================================
   LOAD INVESTMENTS
   ========================================================= */

async function loadInvestments() {

    state.loading =
        true;

    clearMessage();

    const tableBody =
        $("#investmentsTableBody") ||
        $("#investmentTableBody");

    const mobileList =
        $("#investmentsMobileList") ||
        $("#investmentMobileList");

    if (tableBody) {

        tableBody.innerHTML = `
            <tr>
                <td colspan="8" class="loading-cell">
                    <div class="inline-loader"></div>
                    <span>
                        Loading investment records...
                    </span>
                </td>
            </tr>
        `;
    }

    if (mobileList) {

        mobileList.innerHTML = "";
    }

    try {

        const data =
            await fetchJson(
                INVESTMENTS_API,
                {
                    method: "GET"
                },
                15000
            );

        const records =
            data?.investments ||
            data?.records ||
            data?.items ||
            data?.data ||
            [];

        state.investments =
            Array.isArray(records)
                ? records
                : [];

        state.currentPage =
            1;

        updateStats(
            data
        );

        applyFilters();

    } catch (error) {

        console.error(
            "Failed to load investments:",
            error
        );

        state.investments =
            [];

        state.filteredInvestments =
            [];

        updateStats({
            total_investments:
                0,

            active_investments:
                0,

            pending_investments:
                0,

            completed_investments:
                0
        });

        showMessage(
            error.message ||
            "Failed to load investment records.",
            "error"
        );

        renderEmptyState(
            "Unable to load investment records."
        );

    } finally {

        state.loading =
            false;
    }
}


/* =========================================================
   STATISTICS
   ========================================================= */

function updateStats(
    data = {}
) {

    const records =
        state.investments;

    const total =
        Number(
            data.total_investments ??
            data.stats?.total_investments ??
            data.summary?.total_investments
        );

    const active =
        Number(
            data.active_investments ??
            data.stats?.active_investments ??
            data.summary?.active_investments
        );

    const pending =
        Number(
            data.pending_investments ??
            data.stats?.pending_investments ??
            data.summary?.pending_investments
        );

    const completed =
        Number(
            data.completed_investments ??
            data.stats?.completed_investments ??
            data.summary?.completed_investments
        );

    const calculatedTotal =
        Number.isFinite(total)
            ? total
            : records.length;

    const calculatedActive =
        Number.isFinite(active)
            ? active
            : records.filter(
                item =>
                    getStatus(item) ===
                    "active"
            ).length;

    const calculatedPending =
        Number.isFinite(pending)
            ? pending
            : records.filter(
                item =>
                    getStatus(item) ===
                    "pending"
            ).length;

    const calculatedCompleted =
        Number.isFinite(completed)
            ? completed
            : records.filter(
                item =>
                    getStatus(item) ===
                    "completed"
            ).length;

    setText(
        [
            "#totalInvestments",
            "#totalInvestment",
            "[data-stat='total-investments']"
        ],
        calculatedTotal
    );

    setText(
        [
            "#activeInvestments",
            "#activeInvestment",
            "[data-stat='active-investments']"
        ],
        calculatedActive
    );

    setText(
        [
            "#pendingInvestments",
            "#pendingInvestment",
            "[data-stat='pending-investments']"
        ],
        calculatedPending
    );

    setText(
        [
            "#completedInvestments",
            "#completedInvestment",
            "[data-stat='completed-investments']"
        ],
        calculatedCompleted
    );
}


function setText(
    selectors,
    value
) {

    selectors.forEach(
        selector => {

            $all(selector)
                .forEach(element => {

                    element.textContent =
                        value;
                });
        }
    );
}


/* =========================================================
   FILTERS
   ========================================================= */

function getSearchValue() {

    const input =
        $("#investmentSearch") ||
        $("#searchInvestments") ||
        $("#searchInput") ||
        document.querySelector(
            "input[placeholder*='Search']"
        );

    return input
        ? input.value
            .trim()
            .toLowerCase()
        : "";
}


function getStatusFilter() {

    const select =
        $("#statusFilter") ||
        $("#investmentStatusFilter");

    return select
        ? select.value
            .toLowerCase()
        : "all";
}


function getPlanFilter() {

    const select =
        $("#planFilter") ||
        $("#investmentPlanFilter");

    return select
        ? select.value
            .toLowerCase()
        : "all";
}


function getPeriodFilter() {

    const select =
        $("#periodFilter") ||
        $("#investmentPeriodFilter");

    return select
        ? select.value
            .toLowerCase()
        : "all";
}


function applyFilters() {

    const search =
        getSearchValue();

    const status =
        getStatusFilter();

    const plan =
        getPlanFilter();

    const period =
        getPeriodFilter();

    state.filteredInvestments =
        state.investments.filter(
            item => {

                const id =
                    getId(item)
                        .toLowerCase();

                const user =
                    getUserName(item)
                        .toLowerCase();

                const planName =
                    getPlan(item)
                        .toLowerCase();

                const itemStatus =
                    getStatus(item);

                const itemPeriod =
                    getPeriod(item)
                        .toLowerCase();

                const matchesSearch =
                    !search ||
                    user.includes(search) ||
                    planName.includes(search) ||
                    id.includes(search);

                const matchesStatus =
                    status === "all" ||
                    status === "" ||
                    itemStatus === status;

                const matchesPlan =
                    plan === "all" ||
                    plan === "" ||
                    planName === plan;

                const matchesPeriod =
                    period === "all" ||
                    period === "" ||
                    itemPeriod.includes(
                        period
                    );

                return (
                    matchesSearch &&
                    matchesStatus &&
                    matchesPlan &&
                    matchesPeriod
                );
            }
        );

    state.currentPage =
        1;

    renderInvestments();
}


/* =========================================================
   RENDER INVESTMENTS
   ========================================================= */

function renderInvestments() {

    const tableBody =
        $("#investmentsTableBody") ||
        $("#investmentTableBody");

    const mobileList =
        $("#investmentsMobileList") ||
        $("#investmentMobileList");

    if (
        state.filteredInvestments
            .length === 0
    ) {

        renderEmptyState(
            "No investment records found."
        );

        if (mobileList) {

            mobileList.innerHTML = `
                <div class="empty-state">

                    <div class="empty-icon">
                        ${ICONS.investment}
                    </div>

                    <h3>
                        No investment records
                    </h3>

                    <p>
                        No investments match your current filters.
                    </p>

                </div>
            `;
        }

        renderPagination();

        return;
    }

    const start =
        (state.currentPage - 1) *
        state.perPage;

    const pageItems =
        state.filteredInvestments.slice(
            start,
            start + state.perPage
        );

    if (tableBody) {

        tableBody.innerHTML =
            pageItems
                .map(renderTableRow)
                .join("");
    }

    if (mobileList) {

        mobileList.innerHTML =
            pageItems
                .map(renderMobileCard)
                .join("");
    }

    renderPagination();
}


/* =========================================================
   TABLE ROW
   ========================================================= */

function renderTableRow(item) {

    const id =
        getId(item);

    const user =
        getUserName(item);

    const plan =
        getPlan(item);

    const amount =
        getAmount(item);

    const period =
        getPeriod(item);

    const startDate =
        getStartDate(item);

    const endDate =
        getEndDate(item);

    const status =
        getStatus(item);

    return `
        <tr>

            <td>

                <div class="user-cell">

                    <div class="record-icon">
                        ${ICONS.users}
                    </div>

                    <div>

                        <strong>
                            ${escapeHtml(user)}
                        </strong>

                        <small>
                            ${escapeHtml(
                                id ||
                                "Investment record"
                            )}
                        </small>

                    </div>

                </div>

            </td>

            <td>

                <span class="plan-name">
                    ${escapeHtml(plan)}
                </span>

            </td>

            <td>

                <strong class="amount-value">
                    ${formatMoney(amount)}
                </strong>

            </td>

            <td>
                ${escapeHtml(period)}
            </td>

            <td>
                ${formatDate(startDate)}
            </td>

            <td>
                ${formatDate(endDate)}
            </td>

            <td>

                <span
                    class="status-pill ${statusClass(status)}"
                >
                    ${escapeHtml(
                        statusLabel(status)
                    )}
                </span>

            </td>

            <td>

                <button
                    type="button"
                    class="view-button"
                    data-action="view"
                    data-id="${escapeHtml(id)}"
                    title="View investment"
                >

                    ${ICONS.eye}

                    <span>
                        View
                    </span>

                </button>

            </td>

        </tr>
    `;
}


/* =========================================================
   MOBILE CARD
   ========================================================= */

function renderMobileCard(item) {

    const id =
        getId(item);

    const user =
        getUserName(item);

    const plan =
        getPlan(item);

    const amount =
        getAmount(item);

    const period =
        getPeriod(item);

    const startDate =
        getStartDate(item);

    const endDate =
        getEndDate(item);

    const status =
        getStatus(item);

    return `
        <article
            class="investment-mobile-card"
        >

            <div class="mobile-card-header">

                <div class="mobile-user">

                    <div class="record-icon">
                        ${ICONS.users}
                    </div>

                    <div>

                        <strong>
                            ${escapeHtml(user)}
                        </strong>

                        <small>
                            ${escapeHtml(
                                id ||
                                "Investment"
                            )}
                        </small>

                    </div>

                </div>

                <span
                    class="status-pill ${statusClass(status)}"
                >
                    ${escapeHtml(
                        statusLabel(status)
                    )}
                </span>

            </div>

            <div class="mobile-card-amount">

                <span>
                    Investment Amount
                </span>

                <strong>
                    ${formatMoney(amount)}
                </strong>

            </div>

            <div class="mobile-info-grid">

                <div>

                    <span>
                        Plan
                    </span>

                    <strong>
                        ${escapeHtml(plan)}
                    </strong>

                </div>

                <div>

                    <span>
                        Period
                    </span>

                    <strong>
                        ${escapeHtml(period)}
                    </strong>

                </div>

                <div>

                    <span>
                        Start Date
                    </span>

                    <strong>
                        ${formatDate(startDate)}
                    </strong>

                </div>

                <div>

                    <span>
                        End Date
                    </span>

                    <strong>
                        ${formatDate(endDate)}
                    </strong>

                </div>

            </div>

            <button
                type="button"
                class="mobile-view-button"
                data-action="view"
                data-id="${escapeHtml(id)}"
            >

                ${ICONS.eye}

                <span>
                    View Investment
                </span>

            </button>

        </article>
    `;
}


/* =========================================================
   EMPTY STATE
   ========================================================= */

function renderEmptyState(
    message
) {

    const tableBody =
        $("#investmentsTableBody") ||
        $("#investmentTableBody");

    if (!tableBody) {
        return;
    }

    tableBody.innerHTML = `
        <tr>

            <td colspan="8">

                <div class="empty-state">

                    <div class="empty-icon">
                        ${ICONS.investment}
                    </div>

                    <h3>
                        ${escapeHtml(message)}
                    </h3>

                    <p>
                        Investment records will appear here once customers create investments.
                    </p>

                </div>

            </td>

        </tr>
    `;
}


/* =========================================================
   PAGINATION
   ========================================================= */

function renderPagination() {

    const container =
        $("#investmentPagination") ||
        $("#investmentsPagination");

    if (!container) {
        return;
    }

    const total =
        state.filteredInvestments.length;

    const pages =
        Math.max(
            1,
            Math.ceil(
                total /
                state.perPage
            )
        );

    if (pages <= 1) {

        container.innerHTML =
            "";

        return;
    }

    let html =
        "";

    for (
        let page = 1;
        page <= pages;
        page++
    ) {

        html += `
            <button
                type="button"
                class="${
                    page ===
                    state.currentPage
                        ? "active"
                        : ""
                }"
                data-page="${page}"
            >
                ${page}
            </button>
        `;
    }

    container.innerHTML =
        html;
}


/* =========================================================
   INVESTMENT MODAL
   ========================================================= */

function openInvestmentModal(
    id
) {

    const investment =
        state.investments.find(
            item =>
                getId(item) ===
                id
        );

    if (!investment) {
        return;
    }

    state.currentInvestment =
        investment;

    const modal =
        $("#investmentModal");

    if (!modal) {
        return;
    }

    const user =
        getUserName(
            investment
        );

    const plan =
        getPlan(
            investment
        );

    const amount =
        getAmount(
            investment
        );

    const period =
        getPeriod(
            investment
        );

    const status =
        getStatus(
            investment
        );

    setModalText(
        [
            "#investmentCustomer",
            "#modalCustomer",
            "#investmentUser"
        ],
        user
    );

    setModalText(
        [
            "#investmentPlan",
            "#modalPlan",
            "#modalInvestmentPlan"
        ],
        plan
    );

    setModalText(
        [
            "#investmentAmount",
            "#modalAmount"
        ],
        formatMoney(amount)
    );

    setModalText(
        [
            "#investmentPeriod",
            "#modalPeriod"
        ],
        period
    );

    setModalText(
        [
            "#investmentStartDate",
            "#modalStartDate"
        ],
        formatDate(
            getStartDate(
                investment
            )
        )
    );

    setModalText(
        [
            "#investmentEndDate",
            "#modalEndDate"
        ],
        formatDate(
            getEndDate(
                investment
            )
        )
    );

    setModalText(
        [
            "#investmentStatus",
            "#modalStatus"
        ],
        statusLabel(status)
    );

    setModalText(
        [
            "#investmentId",
            "#modalInvestmentId"
        ],
        id || "—"
    );

    modal.classList.add(
        "open"
    );

    modal.style.display =
        "flex";

    document.body.classList.add(
        "modal-open"
    );
}


function setModalText(
    selectors,
    value
) {

    selectors.forEach(
        selector => {

            $all(selector)
                .forEach(element => {

                    element.textContent =
                        value;
                });
        }
    );
}


function closeInvestmentModal() {

    const modal =
        $("#investmentModal");

    if (!modal) {
        return;
    }

    modal.classList.remove(
        "open"
    );

    modal.style.display =
        "none";

    document.body.classList.remove(
        "modal-open"
    );
}


/* =========================================================
   EVENTS
   ========================================================= */

function setupEvents() {

    const search =
        $("#investmentSearch") ||
        $("#searchInvestments") ||
        $("#searchInput") ||
        document.querySelector(
            "input[placeholder*='Search']"
        );

    if (search) {

        search.addEventListener(
            "input",
            applyFilters
        );
    }

    const filterIds = [

        "#statusFilter",

        "#investmentStatusFilter",

        "#planFilter",

        "#investmentPlanFilter",

        "#periodFilter",

        "#investmentPeriodFilter"
    ];

    filterIds.forEach(
        selector => {

            const element =
                $(selector);

            if (element) {

                element.addEventListener(
                    "change",
                    applyFilters
                );
            }
        }
    );

    const refresh =
        $("#refreshInvestmentsBtn") ||
        $("#refreshInvestmentBtn") ||
        $("#refreshBtn");

    if (refresh) {

        refresh.addEventListener(
            "click",
            async () => {

                refresh.disabled =
                    true;

                try {

                    await loadInvestments();

                } finally {

                    refresh.disabled =
                        false;
                }
            }
        );
    }

    document.addEventListener(
        "click",
        event => {

            const viewButton =
                event.target.closest(
                    "[data-action='view']"
                );

            if (viewButton) {

                openInvestmentModal(
                    viewButton.dataset.id
                );

                return;
            }

            const pageButton =
                event.target.closest(
                    "[data-page]"
                );

            if (
                pageButton &&
                (
                    pageButton.closest(
                        "#investmentPagination"
                    ) ||
                    pageButton.closest(
                        "#investmentsPagination"
                    )
                )
            ) {

                state.currentPage =
                    Number(
                        pageButton.dataset.page
                    ) || 1;

                renderInvestments();
            }
        }
    );

    const closeButtons = [

        "#closeInvestmentModal",

        "#closeInvestmentDetails",

        "#cancelInvestmentReview"
    ];

    closeButtons.forEach(
        selector => {

            const button =
                $(selector);

            if (button) {

                button.addEventListener(
                    "click",
                    closeInvestmentModal
                );
            }
        }
    );

    const modal =
        $("#investmentModal");

    if (modal) {

        modal.addEventListener(
            "click",
            event => {

                if (
                    event.target ===
                    modal
                ) {

                    closeInvestmentModal();
                }
            }
        );
    }

    document.addEventListener(
        "keydown",
        event => {

            if (
                event.key ===
                "Escape"
            ) {

                closeInvestmentModal();
            }
        }
    );

    const retry =
        $("#retryInvestmentsBtn") ||
        $("#retryButton");

    if (retry) {

        retry.addEventListener(
            "click",
            async () => {

                clearMessage();

                await loadInvestments();
            }
        );
    }
}


/* =========================================================
   INITIALIZATION
   ========================================================= */

async function initializeAdminInvestments() {

    showAdminPage();

    showLoader(
        "Verifying administrator access..."
    );

    const authorized =
        await verifyAdministrator();

    if (!authorized) {

        showAdminPage();

        return;
    }

    showAdminPage();

    await loadAdminProfile();

    hideLoader();

    await loadInvestments();
}


/* =========================================================
   START
   ========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    () => {

        showAdminPage();

        setupEvents();

        initializeAdminInvestments()
            .catch(error => {

                console.error(
                    "Admin Investments initialization error:",
                    error
                );

                showAdminPage();

                hideLoader();

                showMessage(
                    error.message ||
                    "Unable to initialize the Investments administration page.",
                    "error"
                );
            });
    }
);


/* =========================================================
   GLOBAL HELPERS
   ========================================================= */

window.CrownCashAdminInvestments = {

    loadInvestments,

    verifyAdministrator,

    openInvestmentModal,

    closeInvestmentModal,

    applyFilters
};