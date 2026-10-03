"use strict";

/*
|--------------------------------------------------------------------------
| Crown Cash - Admin Withdrawals
|--------------------------------------------------------------------------
*/

const API_URL =
    "https://crown-cash1.onrender.com/admin_withdrawal.php";

const AUTH_API =
    "https://crown-cash1.onrender.com/admin-auth.php";

const REFRESH_INTERVAL = 30000;

let withdrawals = [];
let filteredWithdrawals = [];
let selectedWithdrawal = null;

let currentPage = 1;

const ITEMS_PER_PAGE = 10;


/*
|--------------------------------------------------------------------------
| PAGE LOADER
|--------------------------------------------------------------------------
*/

function hidePageLoader() {

    try {

        if (
            typeof window.hideAdminWithdrawalLoader ===
            "function"
        ) {

            window.hideAdminWithdrawalLoader();

        }

    } catch (error) {

        console.warn(
            "Unable to hide withdrawal page loader:",
            error
        );
    }
}


/*
|--------------------------------------------------------------------------
| MESSAGE HELPERS
|--------------------------------------------------------------------------
*/

function showMessage(message, type = "info") {

    console.log(
        `[Crown Cash Withdrawals] ${type}:`,
        message
    );

    const existing =
        document.querySelector(
            ".withdrawal-page-message"
        );

    if (existing) {
        existing.remove();
    }

    const messageBox =
        document.createElement("div");

    messageBox.className =
        `withdrawal-page-message ${type}`;

    messageBox.textContent = message;

    const container =
        document.querySelector(
            ".withdrawals-container"
        ) ||
        document.querySelector(
            "main"
        ) ||
        document.body;

    container.prepend(messageBox);

    setTimeout(() => {

        messageBox.remove();

    }, 5000);
}


/*
|--------------------------------------------------------------------------
| API
|--------------------------------------------------------------------------
*/

async function apiRequest(
    url,
    options = {}
) {

    const requestOptions = {

        method:
            options.method ||
            "GET",

        credentials:
            "include",

        cache:
            "no-store",

        headers: {
            "Accept":
                "application/json",

            ...(options.body
                ? {
                    "Content-Type":
                        "application/json"
                }
                : {}),

            ...(options.headers || {})
        }
    };

    if (options.body) {

        requestOptions.body =
            typeof options.body === "string"
                ? options.body
                : JSON.stringify(
                    options.body
                );
    }

    const response =
        await fetch(
            url,
            requestOptions
        );

    const raw =
        await response.text();

    let data = null;

    try {

        data =
            raw
                ? JSON.parse(raw)
                : {};

    } catch (error) {

        console.error(
            "Invalid JSON response:",
            raw
        );

        throw new Error(
            `Server returned invalid JSON (${response.status}).`
        );
    }

    if (!response.ok) {

        throw new Error(
            data?.message ||
            data?.error ||
            `Request failed (${response.status}).`
        );
    }

    if (
        data &&
        data.success === false
    ) {

        throw new Error(
            data.message ||
            data.error ||
            "Request failed."
        );
    }

    return data;
}


/*
|--------------------------------------------------------------------------
| ADMIN AUTH
|--------------------------------------------------------------------------
*/

async function verifyAdministrator() {

    try {

        const data =
            await apiRequest(
                AUTH_API
            );

        if (
            data &&
            data.success === false
        ) {

            return false;
        }

        return true;

    } catch (error) {

        console.warn(
            "Administrator verification failed:",
            error
        );

        /*
        |--------------------------------------------------------------------------
        | Do not block the page.
        |
        | admin_withdrawal.php performs the real authorization check.
        |--------------------------------------------------------------------------
        */

        return false;
    }
}


/*
|--------------------------------------------------------------------------
| VALUE HELPERS
|--------------------------------------------------------------------------
*/

function firstValue(
    ...values
) {

    for (const value of values) {

        if (
            value !== undefined &&
            value !== null &&
            String(value).trim() !== ""
        ) {

            return value;
        }
    }

    return "";
}


function normalizeBoolean(value) {

    if (
        value === true ||
        value === 1 ||
        value === "1" ||
        value === "true" ||
        value === "yes"
    ) {

        return true;
    }

    return false;
}


function normalizeMoney(value) {

    if (
        value === null ||
        value === undefined ||
        value === ""
    ) {

        return 0;
    }

    if (typeof value === "number") {
        return Number.isFinite(value)
            ? value
            : 0;
    }

    const cleaned =
        String(value)
            .replace(/,/g, "")
            .replace(/UGX/gi, "")
            .trim();

    const number =
        Number(cleaned);

    return Number.isFinite(number)
        ? number
        : 0;
}


function formatMoney(value) {

    return new Intl.NumberFormat(
        "en-UG",
        {
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }
    ).format(
        normalizeMoney(value)
    );
}


function formatUGX(value) {

    return `UGX ${formatMoney(value)}`;
}


function formatDate(value) {

    if (!value) {
        return "—";
    }

    const date =
        new Date(value);

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
            dateStyle: "medium",
            timeStyle: "short"
        }
    );
}


/*
|--------------------------------------------------------------------------
| NORMALIZE WITHDRAWAL
|--------------------------------------------------------------------------
*/

function normalizeWithdrawal(item) {

    if (!item) {
        return null;
    }

    const id =
        firstValue(
            item.id,
            item._id,
            item.withdrawalId
        );

    const reference =
        firstValue(
            item.reference,
            item.transaction_id,
            id
        );

    const userId =
        firstValue(
            item.user_id,
            item.userId,
            item.userid,
            item.userID
        );

    const amount =
        normalizeMoney(
            firstValue(
                item.amount,
                item.withdrawal_amount,
                item.value,
                0
            )
        );

    const fee =
        normalizeMoney(
            firstValue(
                item.fee,
                item.withdrawal_fee,
                0
            )
        );

    const payout =
        normalizeMoney(
            firstValue(
                item.payout_amount,
                item.payout,
                amount - fee
            )
        );

    const status =
        String(
            firstValue(
                item.status,
                "pending"
            )
        )
        .toLowerCase();

    const method =
        firstValue(
            item.method,
            item.payment_method,
            item.withdrawal_method,
            ""
        );

    const phone =
        firstValue(
            item.phone,
            item.phone_number,
            item.mobile,
            item.account_number,
            item.accountNumber,
            ""
        );

    const name =
        firstValue(
            item.name,
            item.full_name,
            item.fullName,
            [
                item.firstName,
                item.lastName
            ]
                .filter(Boolean)
                .join(" "),
            "Unknown user"
        );

    const payoutStatus =
        item.payout_sent === true ||
        item.payout_sent === 1 ||
        item.payout_sent === "1"
            ? "Sent"
            : "Not sent";

    return {

        ...item,

        id,

        reference,

        userId,

        user_id: userId,

        name,

        full_name: name,

        firstName:
            firstValue(
                item.firstName,
                item.first_name,
                ""
            ),

        lastName:
            firstValue(
                item.lastName,
                item.last_name,
                ""
            ),

        email:
            firstValue(
                item.email,
                ""
            ),

        phone,

        amount,

        fee,

        payout,

        method,

        payment_method:
            method,

        accountNumber:
            firstValue(
                item.accountNumber,
                item.account_number,
                phone,
                ""
            ),

        accountName:
            firstValue(
                item.accountName,
                item.account_name,
                name,
                ""
            ),

        status,

        payoutStatus,

        balanceReserved:
            normalizeBoolean(
                item.balance_reserved
            ),

        balanceDeducted:
            normalizeBoolean(
                item.balance_deducted
            ),

        adminApproved:
            normalizeBoolean(
                item.admin_approved
            ),

        payoutSent:
            normalizeBoolean(
                item.payout_sent
            ),

        createdAt:
            firstValue(
                item.created_at,
                item.createdAt,
                item.date,
                ""
            ),

        processedAt:
            firstValue(
                item.processed_at,
                item.updated_at,
                ""
            ),

        adminNote:
            firstValue(
                item.admin_note,
                item.adminNote,
                item.rejection_reason,
                ""
            ),

        adminId:
            firstValue(
                item.admin_id,
                ""
            ),

        adminEmail:
            firstValue(
                item.admin_email,
                ""
            )
    };
}


/*
|--------------------------------------------------------------------------
| LOAD WITHDRAWALS
|--------------------------------------------------------------------------
*/

async function loadWithdrawals() {

    const tableBody =
        document.getElementById(
            "withdrawalsTableBody"
        );

    if (tableBody) {

        tableBody.innerHTML = `
            <tr>
                <td colspan="8" class="loading-row">
                    Loading withdrawal requests...
                </td>
            </tr>
        `;
    }

    try {

        const data =
            await apiRequest(
                API_URL
            );

        const rawWithdrawals =
            Array.isArray(
                data?.withdrawals
            )
                ? data.withdrawals
                : Array.isArray(
                    data?.data
                )
                    ? data.data
                    : [];

        withdrawals =
            rawWithdrawals
                .map(
                    normalizeWithdrawal
                )
                .filter(Boolean);

        filteredWithdrawals =
            [...withdrawals];

        currentPage = 1;

        updateStats(
            data?.totals
        );

        applyFilters();

        hidePageLoader();

        console.log(
            "Crown Cash withdrawals loaded:",
            withdrawals
        );

    } catch (error) {

        console.error(
            "Failed to load withdrawals:",
            error
        );

        hidePageLoader();

        if (tableBody) {

            tableBody.innerHTML = `
                <tr>
                    <td colspan="8" class="error-row">
                        Unable to load withdrawal requests.
                        <br>
                        <small>
                            ${escapeHtml(
                                error.message ||
                                "Failed to fetch"
                            )}
                        </small>
                    </td>
                </tr>
            `;
        }

        showMessage(
            error.message ||
            "Unable to load withdrawal requests.",
            "error"
        );
    }
}


/*
|--------------------------------------------------------------------------
| STATS
|--------------------------------------------------------------------------
*/

function updateStats(totals = null) {

    const total =
        totals &&
        totals.total_withdrawals !== undefined
            ? totals.total_withdrawals
            : withdrawals.reduce(
                (
                    sum,
                    item
                ) =>
                    sum +
                    item.amount,
                0
            );

    const pending =
        totals &&
        totals.pending_withdrawals !== undefined
            ? totals.pending_withdrawals
            : withdrawals
                .filter(
                    item =>
                        item.status ===
                        "pending"
                )
                .reduce(
                    (
                        sum,
                        item
                    ) =>
                        sum +
                        item.amount,
                    0
                );

    const approved =
        totals &&
        totals.approved_withdrawals !== undefined
            ? totals.approved_withdrawals
            : withdrawals
                .filter(
                    item =>
                        item.status ===
                            "approved" ||
                        item.status ===
                            "completed"
                )
                .reduce(
                    (
                        sum,
                        item
                    ) =>
                        sum +
                        item.amount,
                    0
                );

    const rejected =
        totals &&
        totals.rejected_withdrawals !== undefined
            ? totals.rejected_withdrawals
            : withdrawals
                .filter(
                    item =>
                        item.status ===
                        "rejected"
                )
                .reduce(
                    (
                        sum,
                        item
                    ) =>
                        sum +
                        item.amount,
                    0
                );

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


/*
|--------------------------------------------------------------------------
| FILTERS
|--------------------------------------------------------------------------
*/

function applyFilters() {

    const searchInput =
        document.getElementById(
            "withdrawalSearch"
        );

    const statusFilter =
        document.getElementById(
            "statusFilter"
        );

    const methodFilter =
        document.getElementById(
            "methodFilter"
        );

    const payoutFilter =
        document.getElementById(
            "payoutStatusFilter"
        );

    const search =
        String(
            searchInput?.value ||
            ""
        )
        .trim()
        .toLowerCase();

    const status =
        String(
            statusFilter?.value ||
            ""
        )
        .toLowerCase();

    const method =
        String(
            methodFilter?.value ||
            ""
        )
        .toLowerCase();

    const payoutStatus =
        String(
            payoutFilter?.value ||
            ""
        ).toLowerCase();

    filteredWithdrawals =
        withdrawals.filter(
            item => {

                const searchable =
                    [
                        item.name,
                        item.email,
                        item.phone,
                        item.reference,
                        item.id,
                        item.userId,
                        item.accountNumber
                    ]
                        .join(" ")
                        .toLowerCase();

                if (
                    search &&
                    !searchable.includes(
                        search
                    )
                ) {

                    return false;
                }

                if (
                    status &&
                    item.status !== status
                ) {

                    return false;
                }

                if (
                    method &&
                    item.method
                        .toLowerCase() !==
                    method
                ) {

                    return false;
                }

                if (
                    payoutStatus &&
                    item.payoutStatus
                        .toLowerCase() !==
                    payoutStatus
                ) {

                    return false;
                }

                return true;
            }
        );

    currentPage = 1;

    renderWithdrawals();
}


/*
|--------------------------------------------------------------------------
| RENDER
|--------------------------------------------------------------------------
*/

function renderWithdrawals() {

    const start =
        (currentPage - 1) *
        ITEMS_PER_PAGE;

    const end =
        start +
        ITEMS_PER_PAGE;

    const pageItems =
        filteredWithdrawals.slice(
            start,
            end
        );

    renderTable(
        pageItems
    );

    renderMobile(
        pageItems
    );

    renderPagination();
}


/*
|--------------------------------------------------------------------------
| TABLE
|--------------------------------------------------------------------------
*/

function renderTable(items) {

    const body =
        document.getElementById(
            "withdrawalsTableBody"
        );

    if (!body) {
        return;
    }

    if (!items.length) {

        body.innerHTML = `
            <tr>
                <td colspan="8" class="empty-row">
                    No withdrawal requests found.
                </td>
            </tr>
        `;

        return;
    }

    body.innerHTML =
        items
            .map(
                item => {

                    const statusClass =
                        escapeHtml(
                            item.status
                        );

                    return `
                        <tr>

                            <td>
                                <strong>
                                    ${escapeHtml(
                                        item.name
                                    )}
                                </strong>

                                <small>
                                    ${escapeHtml(
                                        item.email ||
                                        "—"
                                    )}
                                </small>
                            </td>

                            <td>
                                ${escapeHtml(
                                    item.reference
                                )}
                            </td>

                            <td>
                                ${escapeHtml(
                                    item.phone ||
                                    "—"
                                )}
                            </td>

                            <td>
                                <strong>
                                    ${formatUGX(
                                        item.amount
                                    )}
                                </strong>
                            </td>

                            <td>
                                ${escapeHtml(
                                    item.method ||
                                    "—"
                                )}
                            </td>

                            <td>
                                <span class="status-badge ${statusClass}">
                                    ${escapeHtml(
                                        capitalize(
                                            item.status
                                        )
                                    )}
                                </span>
                            </td>

                            <td>
                                ${formatDate(
                                    item.createdAt
                                )}
                            </td>

                            <td>
                                <button
                                    type="button"
                                    class="view-withdrawal-button"
                                    data-id="${escapeHtml(
                                        item.id
                                    )}"
                                >
                                    Review
                                </button>
                            </td>

                        </tr>
                    `;
                }
            )
            .join("");
}


/*
|--------------------------------------------------------------------------
| MOBILE
|--------------------------------------------------------------------------
*/

function renderMobile(items) {

    const container =
        document.getElementById(
            "withdrawalsMobileList"
        );

    if (!container) {
        return;
    }

    if (!items.length) {

        container.innerHTML = `
            <div class="empty-row">
                No withdrawal requests found.
            </div>
        `;

        return;
    }

    container.innerHTML =
        items
            .map(
                item => {

                    return `
                        <article
                            class="withdrawal-mobile-card"
                        >

                            <div class="mobile-card-header">

                                <strong>
                                    ${escapeHtml(
                                        item.name
                                    )}
                                </strong>

                                <span
                                    class="status-badge ${escapeHtml(
                                        item.status
                                    )}"
                                >
                                    ${escapeHtml(
                                        capitalize(
                                            item.status
                                        )
                                    )}
                                </span>

                            </div>

                            <div class="mobile-card-row">
                                <span>Reference</span>
                                <strong>
                                    ${escapeHtml(
                                        item.reference
                                    )}
                                </strong>
                            </div>

                            <div class="mobile-card-row">
                                <span>Amount</span>
                                <strong>
                                    ${formatUGX(
                                        item.amount
                                    )}
                                </strong>
                            </div>

                            <div class="mobile-card-row">
                                <span>Phone</span>
                                <strong>
                                    ${escapeHtml(
                                        item.phone ||
                                        "—"
                                    )}
                                </strong>
                            </div>

                            <div class="mobile-card-row">
                                <span>Method</span>
                                <strong>
                                    ${escapeHtml(
                                        item.method ||
                                        "—"
                                    )}
                                </strong>
                            </div>

                            <button
                                type="button"
                                class="view-withdrawal-button"
                                data-id="${escapeHtml(
                                    item.id
                                )}"
                            >
                                Review Withdrawal
                            </button>

                        </article>
                    `;
                }
            )
            .join("");
}


/*
|--------------------------------------------------------------------------
| MODAL
|--------------------------------------------------------------------------
*/

function openWithdrawalModal(
    withdrawal
) {

    if (!withdrawal) {
        return;
    }

    selectedWithdrawal =
        withdrawal;

    setText(
        "withdrawalRequestedAmount",
        formatUGX(
            withdrawal.amount
        )
    );

    setText(
        "withdrawalFee",
        formatUGX(
            withdrawal.fee
        )
    );

    setText(
        "withdrawalPayoutAmount",
        formatUGX(
            withdrawal.payout
        )
    );

    setText(
        "withdrawalPaymentMethod",
        withdrawal.method ||
        "Not specified"
    );

    setText(
        "withdrawalRegisteredPhone",
        withdrawal.phone ||
        "—"
    );

    setText(
        "withdrawalStatus",
        capitalize(
            withdrawal.status
        )
    );

    setText(
        "withdrawalPayoutStatus",
        withdrawal.payoutStatus
    );

    setText(
        "withdrawalRequestedDate",
        formatDate(
            withdrawal.createdAt
        )
    );

    setText(
        "withdrawalId",
        withdrawal.reference ||
        withdrawal.id ||
        "—"
    );

    /*
    |--------------------------------------------------------------------------
    | User ID
    |--------------------------------------------------------------------------
    */

    setText(
        "withdrawalUserId",
        withdrawal.userId ||
        "—"
    );

    const noteInput =
        document.getElementById(
            "withdrawalAdminNote"
        );

    if (noteInput) {

        noteInput.value =
            withdrawal.adminNote ||
            "";
    }

    const approveButton =
        document.getElementById(
            "approveWithdrawalButton"
        );

    const rejectButton =
        document.getElementById(
            "rejectWithdrawalButton"
        );

    const isPending =
        withdrawal.status ===
        "pending";

    if (approveButton) {
        approveButton.disabled =
            !isPending;
    }

    if (rejectButton) {
        rejectButton.disabled =
            !isPending;
    }

    const modal =
        document.getElementById(
            "withdrawalModal"
        );

    if (modal) {

        modal.classList.add(
            "active"
        );

        modal.removeAttribute(
            "aria-hidden"
        );
    }
}


/*
|--------------------------------------------------------------------------
| CLOSE MODAL
|--------------------------------------------------------------------------
*/

function closeWithdrawalModal() {

    const modal =
        document.getElementById(
            "withdrawalModal"
        );

    if (modal) {

        modal.classList.remove(
            "active"
        );

        modal.setAttribute(
            "aria-hidden",
            "true"
        );
    }

    selectedWithdrawal =
        null;
}


/*
|--------------------------------------------------------------------------
| PROCESS WITHDRAWAL
|--------------------------------------------------------------------------
*/

async function processWithdrawal(
    action
) {

    if (!selectedWithdrawal) {

        showMessage(
            "Please select a withdrawal first.",
            "error"
        );

        return;
    }

    const id =
        selectedWithdrawal.id;

    const userId =
        selectedWithdrawal.userId;

    if (!id) {

        showMessage(
            "Withdrawal ID is missing.",
            "error"
        );

        return;
    }

    /*
    |--------------------------------------------------------------------------
    | User ID should exist because it is required by the backend.
    |--------------------------------------------------------------------------
    */

    if (!userId) {

        showMessage(
            "This withdrawal does not contain a user ID.",
            "error"
        );

        return;
    }

    const actionName =
        action === "approve"
            ? "approve"
            : "reject";

    const confirmed =
        window.confirm(
            actionName === "approve"
                ? "Approve this withdrawal request?"
                : "Reject this withdrawal and restore the reserved funds?"
        );

    if (!confirmed) {
        return;
    }

    const noteInput =
        document.getElementById(
            "withdrawalAdminNote"
        );

    const note =
        noteInput?.value?.trim() ||
        "";

    const approveButton =
        document.getElementById(
            "approveWithdrawalButton"
        );

    const rejectButton =
        document.getElementById(
            "rejectWithdrawalButton"
        );

    if (approveButton) {
        approveButton.disabled = true;
    }

    if (rejectButton) {
        rejectButton.disabled = true;
    }

    try {

        /*
        |--------------------------------------------------------------------------
        | IMPORTANT:
        | Send both withdrawal ID and user ID.
        |--------------------------------------------------------------------------
        */

        const payload = {

            withdrawalId:
                id,

            withdrawal_id:
                id,

            user_id:
                userId,

            userId:
                userId,

            action:
                actionName,

            admin_note:
                note,

            note:
                note
        };

        console.log(
            "Processing Crown Cash withdrawal:",
            payload
        );

        const data =
            await apiRequest(
                API_URL,
                {
                    method:
                        "POST",

                    body:
                        payload
                }
            );

        console.log(
            "Withdrawal processing response:",
            data
        );

        showMessage(
            data.message ||
            (
                actionName === "approve"
                    ? "Withdrawal approved successfully."
                    : "Withdrawal rejected successfully."
            ),
            "success"
        );

        closeWithdrawalModal();

        await loadWithdrawals();

    } catch (error) {

        console.error(
            "Withdrawal processing error:",
            error
        );

        showMessage(
            error.message ||
            "Unable to process withdrawal.",
            "error"
        );

        if (approveButton) {
            approveButton.disabled = false;
        }

        if (rejectButton) {
            rejectButton.disabled = false;
        }
    }
}


/*
|--------------------------------------------------------------------------
| PAGINATION
|--------------------------------------------------------------------------
*/

function renderPagination() {

    const container =
        document.querySelector(
            ".pagination"
        ) ||
        document.getElementById(
            "withdrawalsPagination"
        );

    if (!container) {
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

    if (
        currentPage >
        totalPages
    ) {

        currentPage =
            totalPages;
    }

    if (totalPages <= 1) {

        container.innerHTML = "";

        return;
    }

    container.innerHTML = `

        <button
            type="button"
            class="pagination-button"
            data-page="${currentPage - 1}"
            ${currentPage <= 1
                ? "disabled"
                : ""}
        >
            Previous
        </button>

        <span class="pagination-info">
            Page ${currentPage} of ${totalPages}
        </span>

        <button
            type="button"
            class="pagination-button"
            data-page="${currentPage + 1}"
            ${currentPage >= totalPages
                ? "disabled"
                : ""}
        >
            Next
        </button>

    `;
}


/*
|--------------------------------------------------------------------------
| TEXT HELPER
|--------------------------------------------------------------------------
*/

function setText(
    id,
    value
) {

    const element =
        document.getElementById(
            id
        );

    if (element) {

        element.textContent =
            value ?? "—";
    }
}


/*
|--------------------------------------------------------------------------
| HTML ESCAPE
|--------------------------------------------------------------------------
*/

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


/*
|--------------------------------------------------------------------------
| CAPITALIZE
|--------------------------------------------------------------------------
*/

function capitalize(value) {

    const text =
        String(
            value || ""
        );

    if (!text) {
        return "";
    }

    return (
        text.charAt(0).toUpperCase() +
        text.slice(1)
    );
}


/*
|--------------------------------------------------------------------------
| EVENT HANDLERS
|--------------------------------------------------------------------------
*/

function setupEvents() {

    document.addEventListener(
        "click",
        event => {

            const reviewButton =
                event.target.closest(
                    ".view-withdrawal-button"
                );

            if (reviewButton) {

                const id =
                    reviewButton.dataset.id;

                const withdrawal =
                    withdrawals.find(
                        item =>
                            String(
                                item.id
                            ) ===
                            String(id)
                    );

                if (withdrawal) {

                    openWithdrawalModal(
                        withdrawal
                    );
                }

                return;
            }

            const paginationButton =
                event.target.closest(
                    ".pagination-button"
                );

            if (
                paginationButton &&
                !paginationButton.disabled
            ) {

                const page =
                    Number(
                        paginationButton.dataset.page
                    );

                if (
                    Number.isFinite(page) &&
                    page > 0
                ) {

                    currentPage =
                        page;

                    renderWithdrawals();
                }
            }

        }
    );


    const search =
        document.getElementById(
            "withdrawalSearch"
        );

    if (search) {

        search.addEventListener(
            "input",
            applyFilters
        );
    }


    const status =
        document.getElementById(
            "statusFilter"
        );

    if (status) {

        status.addEventListener(
            "change",
            applyFilters
        );
    }


    const method =
        document.getElementById(
            "methodFilter"
        );

    if (method) {

        method.addEventListener(
            "change",
            applyFilters
        );
    }


    const payout =
        document.getElementById(
            "payoutStatusFilter"
        );

    if (payout) {

        payout.addEventListener(
            "change",
            applyFilters
        );
    }


    const approve =
        document.getElementById(
            "approveWithdrawalButton"
        );

    if (approve) {

        approve.addEventListener(
            "click",
            () =>
                processWithdrawal(
                    "approve"
                )
        );
    }


    const reject =
        document.getElementById(
            "rejectWithdrawalButton"
        );

    if (reject) {

        reject.addEventListener(
            "click",
            () =>
                processWithdrawal(
                    "reject"
                )
        );
    }


    const cancel =
        document.getElementById(
            "cancelWithdrawalReview"
        );

    if (cancel) {

        cancel.addEventListener(
            "click",
            closeWithdrawalModal
        );
    }


    const modal =
        document.getElementById(
            "withdrawalModal"
        );

    if (modal) {

        modal.addEventListener(
            "click",
            event => {

                if (
                    event.target ===
                    modal
                ) {

                    closeWithdrawalModal();
                }
            }
        );
    }
}


/*
|--------------------------------------------------------------------------
| INITIALIZE
|--------------------------------------------------------------------------
*/

async function initializeWithdrawals() {

    hidePageLoader();

    setupEvents();

    await verifyAdministrator();

    await loadWithdrawals();

    /*
    |--------------------------------------------------------------------------
    | Automatic refresh
    |--------------------------------------------------------------------------
    */

    setInterval(
        async () => {

            const modal =
                document.getElementById(
                    "withdrawalModal"
                );

            const modalOpen =
                modal &&
                modal.classList.contains(
                    "active"
                );

            if (!modalOpen) {

                await loadWithdrawals();
            }

        },
        REFRESH_INTERVAL
    );
}


/*
|--------------------------------------------------------------------------
| GLOBAL API
|--------------------------------------------------------------------------
*/

window.CrownCashWithdrawals = {

    load:
        loadWithdrawals,

    refresh:
        loadWithdrawals,

    approve:
        () =>
            processWithdrawal(
                "approve"
            ),

    reject:
        () =>
            processWithdrawal(
                "reject"
            ),

    closeModal:
        closeWithdrawalModal

};


/*
|--------------------------------------------------------------------------
| START
|--------------------------------------------------------------------------
*/

if (
    document.readyState ===
    "loading"
) {

    document.addEventListener(
        "DOMContentLoaded",
        initializeWithdrawals
    );

} else {

    initializeWithdrawals();
}