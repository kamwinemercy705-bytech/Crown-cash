/* =========================================================
   CROWN CASH - ADMIN WITHDRAWALS
   ========================================================= */

"use strict";

const API_BASE = "https://crown-cash1.onrender.com";

const ADMIN_AUTH_API = `${API_BASE}/admin-auth.php`;
const WITHDRAWALS_API = `${API_BASE}/admin-withdrawals.php`;
const PROFILE_API = `${API_BASE}/profile.php`;

let withdrawals = [];
let filteredWithdrawals = [];
let currentPage = 1;
const ITEMS_PER_PAGE = 10;

let selectedWithdrawal = null;


/* =========================================================
   DOM HELPERS
   ========================================================= */

function $(id) {
    return document.getElementById(id);
}

function showElement(element) {
    if (!element) return;

    element.hidden = false;
    element.style.display = "";
}

function hideElement(element) {
    if (!element) return;

    element.hidden = true;
    element.style.display = "none";
}


/* =========================================================
   PAGE LOADER
   ========================================================= */

function showLoader(message = "Verifying administrator access...") {

    const loader = $("pageLoader");

    if (!loader) {
        return;
    }

    showElement(loader);

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

    const loader = $("pageLoader");

    if (!loader) {
        return;
    }

    hideElement(loader);
}


/* =========================================================
   MESSAGE
   ========================================================= */

function showMessage(message, type = "error") {

    const messageBox =
        $("withdrawalMessage") ||
        $("withdrawMessage") ||
        $("adminMessage");

    if (!messageBox) {
        console.error(message);
        return;
    }

    messageBox.textContent = message;

    messageBox.className =
        `admin-message ${type}`;

    messageBox.style.display = "block";

    setTimeout(() => {

        if (messageBox) {
            messageBox.style.display = "none";
        }

    }, 7000);
}


/* =========================================================
   FETCH WITH TIMEOUT
   ========================================================= */

async function fetchWithTimeout(
    url,
    options = {},
    timeout = 10000
) {

    const controller = new AbortController();

    const timer = setTimeout(() => {
        controller.abort();
    }, timeout);

    try {

        const response = await fetch(url, {
            ...options,
            signal: controller.signal,
            credentials: "include",
            cache: "no-store",
            headers: {
                "Accept": "application/json",
                ...(options.headers || {})
            }
        });

        return response;

    } catch (error) {

        if (error.name === "AbortError") {
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
   JSON RESPONSE
   ========================================================= */

async function readJson(response) {

    const text = await response.text();

    if (!text) {
        throw new Error(
            `Server returned an empty response (${response.status}).`
        );
    }

    try {

        return JSON.parse(text);

    } catch (error) {

        console.error("Invalid JSON response:", text);

        throw new Error(
            `Server returned an invalid response (${response.status}).`
        );
    }
}


/* =========================================================
   ADMIN AUTHENTICATION
   ========================================================= */

async function verifyAdministrator() {

    console.log(
        "[Crown Cash] Checking administrator authentication..."
    );

    try {

        const response = await fetchWithTimeout(
            ADMIN_AUTH_API,
            {
                method: "GET"
            },
            10000
        );

        console.log(
            "[Crown Cash] Admin auth HTTP status:",
            response.status
        );

        const data = await readJson(response);

        console.log(
            "[Crown Cash] Admin auth response:",
            data
        );

        if (
            response.status === 401 ||
            response.status === 403
        ) {

            throw new Error(
                data.message ||
                "Administrator access was denied. Please login as an administrator."
            );
        }

        if (!response.ok) {

            throw new Error(
                data.message ||
                `Administrator verification failed (${response.status}).`
            );
        }

        if (
            data.success !== true ||
            data.authorized !== true
        ) {

            throw new Error(
                data.message ||
                "Administrator authorization was not confirmed."
            );
        }

        console.log(
            "[Crown Cash] Administrator access confirmed."
        );

        return data;

    } catch (error) {

        console.error(
            "[Crown Cash] Administrator verification error:",
            error
        );

        throw error;
    }
}


/* =========================================================
   LOAD ADMIN PROFILE
   ========================================================= */

async function loadAdminProfile() {

    try {

        const response = await fetchWithTimeout(
            PROFILE_API,
            {
                method: "GET"
            },
            10000
        );

        if (!response.ok) {
            return;
        }

        const data = await readJson(response);

        if (!data.success || !data.user) {
            return;
        }

        const user = data.user;

        const fullName =
            user.full_name ||
            `${user.first_name || ""} ${user.last_name || ""}`.trim() ||
            "Administrator";

        const adminName = $("adminName");

        if (adminName) {
            adminName.textContent = fullName;
        }

        const adminEmail = $("adminEmail");

        if (adminEmail) {
            adminEmail.textContent =
                user.email || "";
        }

        const headerUserName = $("headerUserName");

        if (headerUserName) {
            headerUserName.textContent = fullName;
        }

    } catch (error) {

        console.warn(
            "[Crown Cash] Could not load admin profile:",
            error
        );
    }
}


/* =========================================================
   FORMAT MONEY
   ========================================================= */

function formatMoney(value) {

    const number = Number(value) || 0;

    return new Intl.NumberFormat("en-UG", {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(number);
}


function formatUGX(value) {

    return `UGX ${formatMoney(value)}`;
}


/* =========================================================
   FORMAT DATE
   ========================================================= */

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

            date = new Date(value.$date);

        } else {

            date = new Date(value);
        }

        if (Number.isNaN(date.getTime())) {
            return "—";
        }

        return date.toLocaleString("en-UG", {
            day: "2-digit",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit"
        });

    } catch (error) {

        return "—";
    }
}


/* =========================================================
   GET WITHDRAWAL ID
   ========================================================= */

function getWithdrawalId(item) {

    if (!item) {
        return "";
    }

    if (typeof item._id === "string") {
        return item._id;
    }

    if (
        item._id &&
        typeof item._id === "object"
    ) {

        if (item._id.$oid) {
            return item._id.$oid;
        }

        if (item._id.oid) {
            return item._id.oid;
        }

        if (item._id.toString) {
            return item._id.toString();
        }
    }

    return (
        item.withdrawal_id ||
        item.id ||
        item.withdrawalId ||
        ""
    );
}


/* =========================================================
   NORMALIZE WITHDRAWAL
   ========================================================= */

function normalizeWithdrawal(item) {

    const requestedAmount =
        Number(
            item.requested_amount ??
            item.amount ??
            item.requested ??
            0
        );

    const fee =
        Number(
            item.fee ??
            item.withdrawal_fee ??
            0
        );

    const payoutAmount =
        Number(
            item.payout_amount ??
            item.payout ??
            item.net_amount ??
            Math.max(0, requestedAmount - fee)
        );

    const user =
        item.user ||
        {};

    const name =
        item.full_name ||
        item.user_name ||
        item.name ||
        user.full_name ||
        user.name ||
        "Customer";

    const email =
        item.email ||
        user.email ||
        "";

    const phone =
        item.phone ||
        item.registered_phone ||
        item.mobile ||
        user.phone ||
        "";

    const method =
        item.payment_method ||
        item.method ||
        "";

    const status =
        String(
            item.status ||
            "pending"
        ).toLowerCase();

    const payoutStatus =
        String(
            item.payout_status ||
            "not_required"
        ).toLowerCase();

    const date =
        item.created_at ||
        item.requested_at ||
        item.date ||
        item.createdAt ||
        "";

    return {
        raw: item,
        id: getWithdrawalId(item),
        name,
        email,
        phone,
        method,
        status,
        payoutStatus,
        requestedAmount,
        fee,
        payoutAmount,
        date,
        adminNote:
            item.admin_note ||
            item.note ||
            ""
    };
}


/* =========================================================
   LOAD WITHDRAWALS
   ========================================================= */

async function loadWithdrawals() {

    const tableBody = $("withdrawalsTableBody");

    if (tableBody) {

        tableBody.innerHTML = `
            <tr>
                <td colspan="10" class="loading-cell">
                    Loading withdrawal requests...
                </td>
            </tr>
        `;
    }

    try {

        console.log(
            "[Crown Cash] Loading admin withdrawals..."
        );

        const response = await fetchWithTimeout(
            WITHDRAWALS_API,
            {
                method: "GET"
            },
            15000
        );

        console.log(
            "[Crown Cash] Withdrawals HTTP status:",
            response.status
        );

        const data = await readJson(response);

        console.log(
            "[Crown Cash] Withdrawals response:",
            data
        );

        if (
            response.status === 401 ||
            response.status === 403
        ) {

            throw new Error(
                data.message ||
                "Administrator authorization is required."
            );
        }

        if (!response.ok) {

            throw new Error(
                data.message ||
                `Unable to load withdrawals (${response.status}).`
            );
        }

        if (data.success === false) {

            throw new Error(
                data.message ||
                "Unable to load withdrawal requests."
            );
        }

        const rawWithdrawals =
            data.withdrawals ||
            data.items ||
            data.records ||
            data.data ||
            [];

        if (!Array.isArray(rawWithdrawals)) {

            console.warn(
                "[Crown Cash] Unexpected withdrawal response:",
                data
            );

            withdrawals = [];

        } else {

            withdrawals =
                rawWithdrawals.map(
                    normalizeWithdrawal
                );
        }

        filteredWithdrawals =
            [...withdrawals];

        currentPage = 1;

        updateStatistics(data);

        applyFilters();

        console.log(
            `[Crown Cash] Loaded ${withdrawals.length} withdrawals.`
        );

    } catch (error) {

        console.error(
            "[Crown Cash] Withdrawal loading error:",
            error
        );

        withdrawals = [];
        filteredWithdrawals = [];

        updateStatistics({});

        renderWithdrawals();

        showMessage(
            error.message ||
            "Unable to load withdrawal requests.",
            "error"
        );

    }
}


/* =========================================================
   STATISTICS
   ========================================================= */

function updateStatistics(data) {

    let total = 0;
    let pending = 0;
    let approved = 0;
    let rejected = 0;

    withdrawals.forEach(item => {

        total += item.requestedAmount;

        if (item.status === "pending") {
            pending += item.requestedAmount;
        }

        if (item.status === "approved") {
            approved += item.requestedAmount;
        }

        if (item.status === "rejected") {
            rejected += item.requestedAmount;
        }
    });

    const serverStats =
        data.stats ||
        data.summary ||
        {};

    if (
        serverStats.total !== undefined ||
        serverStats.total_withdrawals !== undefined
    ) {

        total =
            Number(
                serverStats.total ??
                serverStats.total_withdrawals
            ) || total;
    }

    if (
        serverStats.pending !== undefined ||
        serverStats.pending_withdrawals !== undefined
    ) {

        pending =
            Number(
                serverStats.pending ??
                serverStats.pending_withdrawals
            ) || pending;
    }

    if (
        serverStats.approved !== undefined ||
        serverStats.approved_withdrawals !== undefined
    ) {

        approved =
            Number(
                serverStats.approved ??
                serverStats.approved_withdrawals
            ) || approved;
    }

    if (
        serverStats.rejected !== undefined ||
        serverStats.rejected_withdrawals !== undefined
    ) {

        rejected =
            Number(
                serverStats.rejected ??
                serverStats.rejected_withdrawals
            ) || rejected;
    }

    setText(
        "totalWithdrawals",
        formatUGX(total)
    );

    setText(
        "pendingWithdrawals",
        formatUGX(pending)
    );

    setText(
        "approvedWithdrawals",
        formatUGX(approved)
    );

    setText(
        "rejectedWithdrawals",
        formatUGX(rejected)
    );
}


function setText(id, value) {

    const element = $(id);

    if (element) {
        element.textContent = value;
    }
}


/* =========================================================
   FILTERS
   ========================================================= */

function applyFilters() {

    const statusFilter =
        $("statusFilter")?.value || "all";

    const methodFilter =
        $("methodFilter")?.value || "all";

    const payoutFilter =
        $("payoutStatusFilter")?.value || "all";

    const search =
        (
            $("withdrawalSearch")?.value ||
            $("searchWithdrawals")?.value ||
            ""
        )
        .trim()
        .toLowerCase();

    filteredWithdrawals =
        withdrawals.filter(item => {

            const statusMatches =
                statusFilter === "all" ||
                item.status === statusFilter;

            const methodMatches =
                methodFilter === "all" ||
                normalizeMethod(item.method) ===
                normalizeMethod(methodFilter);

            const payoutMatches =
                payoutFilter === "all" ||
                item.payoutStatus === payoutFilter;

            const searchMatches =
                !search ||
                item.name.toLowerCase().includes(search) ||
                item.email.toLowerCase().includes(search) ||
                item.phone.toLowerCase().includes(search) ||
                item.id.toLowerCase().includes(search);

            return (
                statusMatches &&
                methodMatches &&
                payoutMatches &&
                searchMatches
            );
        });

    currentPage = 1;

    renderWithdrawals();
}


function normalizeMethod(value) {

    return String(value || "")
        .toLowerCase()
        .replace(/[\s_-]+/g, "");
}


/* =========================================================
   RENDER WITHDRAWALS
   ========================================================= */

function renderWithdrawals() {

    const tableBody =
        $("withdrawalsTableBody");

    const mobileList =
        $("withdrawalsMobileList");

    if (!filteredWithdrawals.length) {

        if (tableBody) {

            tableBody.innerHTML = `
                <tr>
                    <td colspan="10" class="empty-cell">
                        No withdrawal requests found.
                    </td>
                </tr>
            `;
        }

        if (mobileList) {

            mobileList.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">
                        ${emptyIcon()}
                    </div>
                    <h3>No withdrawal requests</h3>
                    <p>
                        There are no withdrawal requests matching your filters.
                    </p>
                </div>
            `;
        }

        renderPagination();

        return;
    }

    const start =
        (currentPage - 1) *
        ITEMS_PER_PAGE;

    const pageItems =
        filteredWithdrawals.slice(
            start,
            start + ITEMS_PER_PAGE
        );

    if (tableBody) {

        tableBody.innerHTML =
            pageItems.map(
                renderTableRow
            ).join("");
    }

    if (mobileList) {

        mobileList.innerHTML =
            pageItems.map(
                renderMobileCard
            ).join("");
    }

    renderPagination();
}


/* =========================================================
   TABLE ROW
   ========================================================= */

function renderTableRow(item) {

    return `
        <tr>

            <td>
                <div class="user-cell">
                    <div class="user-icon">
                        ${userIcon()}
                    </div>

                    <div>
                        <strong>
                            ${escapeHtml(item.name)}
                        </strong>

                        ${
                            item.email
                                ? `<small>${escapeHtml(item.email)}</small>`
                                : ""
                        }
                    </div>
                </div>
            </td>

            <td>
                <strong>
                    ${formatUGX(item.requestedAmount)}
                </strong>
            </td>

            <td>
                ${formatUGX(item.fee)}
            </td>

            <td>
                <strong>
                    ${formatUGX(item.payoutAmount)}
                </strong>
            </td>

            <td>
                ${escapeHtml(formatMethod(item.method))}
            </td>

            <td>
                ${escapeHtml(item.phone || "—")}
            </td>

            <td>
                ${statusBadge(item.status)}
            </td>

            <td>
                ${payoutStatusBadge(item.payoutStatus)}
            </td>

            <td>
                ${formatDate(item.date)}
            </td>

            <td>
                <button
                    type="button"
                    class="table-action-button"
                    data-action="view"
                    data-id="${escapeHtml(item.id)}"
                >
                    ${eyeIcon()}
                    <span>View</span>
                </button>
            </td>

        </tr>
    `;
}


/* =========================================================
   MOBILE CARD
   ========================================================= */

function renderMobileCard(item) {

    return `
        <article class="withdrawal-mobile-card">

            <div class="mobile-card-header">

                <div class="user-cell">

                    <div class="user-icon">
                        ${userIcon()}
                    </div>

                    <div>
                        <strong>
                            ${escapeHtml(item.name)}
                        </strong>

                        <small>
                            ${escapeHtml(item.phone || "—")}
                        </small>
                    </div>

                </div>

                ${statusBadge(item.status)}

            </div>

            <div class="mobile-card-grid">

                <div>
                    <span>Requested</span>
                    <strong>
                        ${formatUGX(item.requestedAmount)}
                    </strong>
                </div>

                <div>
                    <span>Fee</span>
                    <strong>
                        ${formatUGX(item.fee)}
                    </strong>
                </div>

                <div>
                    <span>Payout</span>
                    <strong>
                        ${formatUGX(item.payoutAmount)}
                    </strong>
                </div>

                <div>
                    <span>Method</span>
                    <strong>
                        ${escapeHtml(formatMethod(item.method))}
                    </strong>
                </div>

            </div>

            <div class="mobile-card-footer">

                ${payoutStatusBadge(item.payoutStatus)}

                <button
                    type="button"
                    class="table-action-button"
                    data-action="view"
                    data-id="${escapeHtml(item.id)}"
                >
                    ${eyeIcon()}
                    View Details
                </button>

            </div>

        </article>
    `;
}


/* =========================================================
   STATUS BADGES
   ========================================================= */

function statusBadge(status) {

    const clean =
        String(status || "pending")
            .toLowerCase();

    let label =
        clean.charAt(0).toUpperCase() +
        clean.slice(1);

    return `
        <span class="status-badge status-${escapeHtml(clean)}">
            ${escapeHtml(label)}
        </span>
    `;
}


function payoutStatusBadge(status) {

    const clean =
        String(status || "not_required")
            .toLowerCase();

    const labels = {
        not_required: "Not Required",
        awaiting_payout: "Awaiting Payout",
        paid: "Paid",
        payout_failed: "Payout Failed"
    };

    return `
        <span class="payout-status-badge payout-${escapeHtml(clean)}">
            ${escapeHtml(
                labels[clean] ||
                clean.replace(/_/g, " ")
            )}
        </span>
    `;
}


/* =========================================================
   METHOD
   ========================================================= */

function formatMethod(method) {

    const value =
        String(method || "")
            .toLowerCase();

    if (value.includes("mtn")) {
        return "MTN Mobile Money";
    }

    if (value.includes("airtel")) {
        return "Airtel Money";
    }

    return method || "—";
}


/* =========================================================
   PAGINATION
   ========================================================= */

function renderPagination() {

    const pagination =
        $("withdrawalPagination");

    if (!pagination) {
        return;
    }

    const totalPages =
        Math.max(
            1,
            Math.ceil(
                filteredWithdrawals.length /
                ITEMS_PER_PAGE
            )
        );

    if (totalPages <= 1) {

        pagination.innerHTML = "";
        return;
    }

    let html = "";

    html += `
        <button
            type="button"
            class="pagination-button"
            data-page="${currentPage - 1}"
            ${currentPage === 1 ? "disabled" : ""}
        >
            ${chevronLeftIcon()}
        </button>
    `;

    for (
        let page = 1;
        page <= totalPages;
        page++
    ) {

        html += `
            <button
                type="button"
                class="pagination-button ${
                    page === currentPage
                        ? "active"
                        : ""
                }"
                data-page="${page}"
            >
                ${page}
            </button>
        `;
    }

    html += `
        <button
            type="button"
            class="pagination-button"
            data-page="${currentPage + 1}"
            ${currentPage === totalPages ? "disabled" : ""}
        >
            ${chevronRightIcon()}
        </button>
    `;

    pagination.innerHTML = html;
}


/* =========================================================
   MODAL
   ========================================================= */

function openWithdrawalModal(item) {

    selectedWithdrawal = item;

    const modal =
        $("withdrawalModal");

    if (!modal) {
        return;
    }

    setText(
        "withdrawalRequestedAmount",
        formatUGX(item.requestedAmount)
    );

    setText(
        "withdrawalFee",
        formatUGX(item.fee)
    );

    setText(
        "withdrawalPayoutAmount",
        formatUGX(item.payoutAmount)
    );

    setText(
        "withdrawalPaymentMethod",
        formatMethod(item.method)
    );

    setText(
        "withdrawalRegisteredPhone",
        item.phone || "—"
    );

    setText(
        "withdrawalStatus",
        formatStatusText(item.status)
    );

    setText(
        "withdrawalPayoutStatus",
        formatStatusText(item.payoutStatus)
    );

    setText(
        "withdrawalRequestedDate",
        formatDate(item.date)
    );

    setText(
        "withdrawalId",
        item.id || "—"
    );

    const adminNote =
        $("withdrawalAdminNote");

    if (adminNote) {
        adminNote.value =
            item.adminNote || "";
    }

    showElement(modal);

    modal.classList.add("open");
    document.body.classList.add("modal-open");
}


function closeWithdrawalModal() {

    const modal =
        $("withdrawalModal");

    if (!modal) {
        return;
    }

    modal.classList.remove("open");

    hideElement(modal);

    document.body.classList.remove(
        "modal-open"
    );

    selectedWithdrawal = null;
}


function formatStatusText(status) {

    return String(status || "")
        .replace(/_/g, " ")
        .replace(/\b\w/g, char =>
            char.toUpperCase()
        );
}


/* =========================================================
   PROCESS WITHDRAWAL
   ========================================================= */

async function processWithdrawal(action) {

    if (!selectedWithdrawal) {
        return;
    }

    if (
        !selectedWithdrawal.id
    ) {

        showMessage(
            "This withdrawal does not have a valid ID.",
            "error"
        );

        return;
    }

    const adminNote =
        $("withdrawalAdminNote")?.value.trim() ||
        "";

    let confirmation;

    if (action === "approve") {

        confirmation =
            `Approve this withdrawal?\n\n` +
            `Requested: ${formatUGX(
                selectedWithdrawal.requestedAmount
            )}\n` +
            `Payout: ${formatUGX(
                selectedWithdrawal.payoutAmount
            )}\n` +
            `Phone: ${selectedWithdrawal.phone}`;
    } else {

        confirmation =
            `Reject this withdrawal request?\n\n` +
            `Amount: ${formatUGX(
                selectedWithdrawal.requestedAmount
            )}`;
    }

    if (!window.confirm(confirmation)) {
        return;
    }

    try {

        const button =
            action === "approve"
                ? $("approveWithdrawalButton")
                : $("rejectWithdrawalButton");

        if (button) {
            button.disabled = true;
        }

        const response =
            await fetchWithTimeout(
                WITHDRAWALS_API,
                {
                    method: "POST",
                    headers: {
                        "Content-Type":
                            "application/json"
                    },
                    body: JSON.stringify({
                        withdrawal_id:
                            selectedWithdrawal.id,

                        action,

                        admin_note:
                            adminNote
                    })
                },
                15000
            );

        const data =
            await readJson(response);

        if (!response.ok || data.success === false) {

            throw new Error(
                data.message ||
                `Unable to ${action} withdrawal.`
            );
        }

        showMessage(
            data.message ||
            `Withdrawal ${action}d successfully.`,
            "success"
        );

        closeWithdrawalModal();

        await loadWithdrawals();

    } catch (error) {

        console.error(
            "[Crown Cash] Withdrawal action error:",
            error
        );

        showMessage(
            error.message ||
            "Unable to process withdrawal.",
            "error"
        );

    } finally {

        const approveButton =
            $("approveWithdrawalButton");

        const rejectButton =
            $("rejectWithdrawalButton");

        if (approveButton) {
            approveButton.disabled = false;
        }

        if (rejectButton) {
            rejectButton.disabled = false;
        }
    }
}


/* =========================================================
   EVENTS
   ========================================================= */

function setupEvents() {

    const refreshButton =
        $("refreshWithdrawalsBtn");

    if (refreshButton) {

        refreshButton.addEventListener(
            "click",
            async () => {

                refreshButton.disabled = true;

                try {
                    await loadWithdrawals();
                } finally {
                    refreshButton.disabled = false;
                }
            }
        );
    }


    const statusFilter =
        $("statusFilter");

    if (statusFilter) {

        statusFilter.addEventListener(
            "change",
            applyFilters
        );
    }


    const methodFilter =
        $("methodFilter");

    if (methodFilter) {

        methodFilter.addEventListener(
            "change",
            applyFilters
        );
    }


    const payoutFilter =
        $("payoutStatusFilter");

    if (payoutFilter) {

        payoutFilter.addEventListener(
            "change",
            applyFilters
        );
    }


    const search =
        $("withdrawalSearch") ||
        $("searchWithdrawals");

    if (search) {

        search.addEventListener(
            "input",
            applyFilters
        );
    }


    document.addEventListener(
        "click",
        event => {

            const viewButton =
                event.target.closest(
                    '[data-action="view"]'
                );

            if (viewButton) {

                const id =
                    viewButton.dataset.id;

                const item =
                    withdrawals.find(
                        withdrawal =>
                            withdrawal.id === id
                    );

                if (item) {
                    openWithdrawalModal(item);
                }

                return;
            }


            const pageButton =
                event.target.closest(
                    "[data-page]"
                );

            if (
                pageButton &&
                !pageButton.disabled
            ) {

                const page =
                    Number(
                        pageButton.dataset.page
                    );

                if (page >= 1) {

                    const totalPages =
                        Math.ceil(
                            filteredWithdrawals.length /
                            ITEMS_PER_PAGE
                        );

                    if (
                        page <= totalPages
                    ) {

                        currentPage = page;

                        renderWithdrawals();
                    }
                }

                return;
            }
        }
    );


    const closeButton =
        $("closeWithdrawalModal");

    if (closeButton) {

        closeButton.addEventListener(
            "click",
            closeWithdrawalModal
        );
    }


    const cancelButton =
        $("cancelWithdrawalReview");

    if (cancelButton) {

        cancelButton.addEventListener(
            "click",
            closeWithdrawalModal
        );
    }


    const approveButton =
        $("approveWithdrawalButton");

    if (approveButton) {

        approveButton.addEventListener(
            "click",
            () => processWithdrawal("approve")
        );
    }


    const rejectButton =
        $("rejectWithdrawalButton");

    if (rejectButton) {

        rejectButton.addEventListener(
            "click",
            () => processWithdrawal("reject")
        );
    }


    const modal =
        $("withdrawalModal");

    if (modal) {

        modal.addEventListener(
            "click",
            event => {

                if (
                    event.target === modal
                ) {

                    closeWithdrawalModal();
                }
            }
        );
    }


    document.addEventListener(
        "keydown",
        event => {

            if (event.key === "Escape") {

                closeWithdrawalModal();
            }
        }
    );
}


/* =========================================================
   LOGOUT
   ========================================================= */

function setupLogout() {

    const logoutButtons =
        document.querySelectorAll(
            '[data-action="logout"], #logoutBtn, #logoutButton'
        );

    logoutButtons.forEach(button => {

        button.addEventListener(
            "click",
            async event => {

                event.preventDefault();

                try {

                    await fetch(
                        `${API_BASE}/logout.php`,
                        {
                            method: "GET",
                            credentials: "include",
                            cache: "no-store"
                        }
                    );

                } catch (error) {

                    console.warn(
                        "Logout request failed:",
                        error
                    );
                }

                window.location.href =
                    "login.html";
            }
        );
    });
}


/* =========================================================
   ESCAPE HTML
   ========================================================= */

function escapeHtml(value) {

    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


/* =========================================================
   SVG ICONS
   ========================================================= */

function userIcon() {

    return `
        <svg
            viewBox="0 0 24 24"
            width="18"
            height="18"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linecap="round"
            stroke-linejoin="round"
        >
            <circle cx="12" cy="8" r="3.5"></circle>
            <path d="M5 20c.8-3.4 3.2-5 7-5s6.2 1.6 7 5"></path>
        </svg>
    `;
}


function eyeIcon() {

    return `
        <svg
            viewBox="0 0 24 24"
            width="16"
            height="16"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linecap="round"
            stroke-linejoin="round"
        >
            <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6z"></path>
            <circle cx="12" cy="12" r="2.5"></circle>
        </svg>
    `;
}


function chevronLeftIcon() {

    return `
        <svg
            viewBox="0 0 24 24"
            width="16"
            height="16"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
        >
            <path d="m15 18-6-6 6-6"></path>
        </svg>
    `;
}


function chevronRightIcon() {

    return `
        <svg
            viewBox="0 0 24 24"
            width="16"
            height="16"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
        >
            <path d="m9 18 6-6-6-6"></path>
        </svg>
    `;
}


function emptyIcon() {

    return `
        <svg
            viewBox="0 0 24 24"
            width="24"
            height="24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.6"
            stroke-linecap="round"
            stroke-linejoin="round"
        >
            <rect
                x="3"
                y="5"
                width="18"
                height="14"
                rx="2"
            ></rect>
            <path d="M7 9h10"></path>
            <path d="M7 13h6"></path>
        </svg>
    `;
}


/* =========================================================
   INITIALIZATION
   ========================================================= */

async function initializeAdminWithdrawals() {

    console.log(
        "========================================"
    );

    console.log(
        "CROWN CASH ADMIN WITHDRAWALS"
    );

    console.log(
        "Initializing..."
    );

    console.log(
        "Admin Auth API:",
        ADMIN_AUTH_API
    );

    console.log(
        "Withdrawals API:",
        WITHDRAWALS_API
    );

    console.log(
        "========================================"
    );

    showLoader(
        "Verifying administrator access..."
    );

    /*
     * IMPORTANT:
     * If anything goes wrong, we ALWAYS hide
     * the loader. This prevents the page from
     * being permanently stuck.
     */

    try {

        await verifyAdministrator();

        hideLoader();

        console.log(
            "[Crown Cash] Loader hidden."
        );

        await loadAdminProfile();

        await loadWithdrawals();

    } catch (error) {

        console.error(
            "[Crown Cash] Admin withdrawals initialization failed:",
            error
        );

        hideLoader();

        showMessage(
            error.message ||
            "Unable to verify administrator access.",
            "error"
        );

        const tableBody =
            $("withdrawalsTableBody");

        if (tableBody) {

            tableBody.innerHTML = `
                <tr>
                    <td
                        colspan="10"
                        class="error-cell"
                    >
                        <strong>
                            Unable to load withdrawal management.
                        </strong>

                        <br>

                        <span>
                            ${escapeHtml(
                                error.message ||
                                "Administrator verification failed."
                            )}
                        </span>

                        <br><br>

                        <button
                            type="button"
                            class="retry-button"
                            id="retryAdminWithdrawals"
                        >
                            Try Again
                        </button>
                    </td>
                </tr>
            `;

            const retry =
                $("retryAdminWithdrawals");

            if (retry) {

                retry.addEventListener(
                    "click",
                    () => {
                        initializeAdminWithdrawals();
                    }
                );
            }
        }
    }
}


/* =========================================================
   EMERGENCY LOADER FAIL-SAFE
   ========================================================= */

setTimeout(() => {

    const loader =
        $("pageLoader");

    if (
        loader &&
        !loader.hidden
    ) {

        console.warn(
            "[Crown Cash] Emergency loader timeout."
        );

        hideLoader();

        showMessage(
            "Administrator verification is taking too long. Please refresh the page and try again.",
            "error"
        );
    }

}, 12000);


/* =========================================================
   DOM READY
   ========================================================= */

if (
    document.readyState === "loading"
) {

    document.addEventListener(
        "DOMContentLoaded",
        () => {

            setupEvents();
            setupLogout();

            initializeAdminWithdrawals();
        }
    );

} else {

    setupEvents();
    setupLogout();

    initializeAdminWithdrawals();
}