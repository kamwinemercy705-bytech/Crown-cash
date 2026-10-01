/* =========================================================
   CROWN CASH - ADMIN WITHDRAWALS
   Complete frontend controller
   ========================================================= */

"use strict";

/* =========================================================
   CONFIGURATION
   ========================================================= */

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


/* =========================================================
   DOM HELPERS
   ========================================================= */

function $(id) {
    return document.getElementById(id);
}


/* =========================================================
   PAGE LOADER
   ========================================================= */

function hidePageLoader() {

    if (typeof window.hideAdminWithdrawalLoader === "function") {
        window.hideAdminWithdrawalLoader();
        return;
    }

    const loader = $("pageLoader");

    if (!loader) {
        return;
    }

    loader.classList.add("hidden");

    setTimeout(function () {
        loader.classList.add("force-hidden");
    }, 450);
}


/* =========================================================
   MESSAGE
   ========================================================= */

function showMessage(message, type = "info") {

    const box = $("withdrawalMessage");

    if (!box) {
        return;
    }

    box.textContent = message;
    box.className = "admin-message " + type;

    box.style.display = "block";

    if (type !== "error") {

        setTimeout(function () {

            if (box.textContent === message) {
                box.style.display = "none";
            }

        }, 5000);
    }
}


function clearMessage() {

    const box = $("withdrawalMessage");

    if (!box) {
        return;
    }

    box.textContent = "";
    box.style.display = "none";
}


/* =========================================================
   API REQUEST
   ========================================================= */

async function apiRequest(url, options = {}) {

    const requestOptions = {
        method: options.method || "GET",
        credentials: "include",
        cache: "no-store",
        headers: {
            "Accept": "application/json",
            ...(options.body
                ? {
                    "Content-Type": "application/json"
                }
                : {}),
            ...(options.headers || {})
        }
    };

    if (options.body) {
        requestOptions.body =
            typeof options.body === "string"
                ? options.body
                : JSON.stringify(options.body);
    }

    let response;

    try {

        response = await fetch(
            url,
            requestOptions
        );

    } catch (error) {

        console.error(
            "Crown Cash API network error:",
            error
        );

        throw new Error(
            "Failed to connect to the Crown Cash server."
        );
    }


    const rawText =
        await response.text();

    console.log(
        "Crown Cash API:",
        url,
        response.status,
        rawText
    );


    let data = null;

    if (rawText) {

        try {

            data = JSON.parse(rawText);

        } catch (error) {

            console.error(
                "Invalid JSON response:",
                rawText
            );

            if (!response.ok) {

                throw new Error(
                    "Server returned HTTP " +
                    response.status
                );
            }

            throw new Error(
                "Server returned an invalid response."
            );
        }
    }


    if (!response.ok) {

        const message =
            data &&
            (
                data.message ||
                data.error ||
                data.details
            );

        throw new Error(
            message ||
            "Server error (" +
            response.status +
            ")."
        );
    }


    return data || {};
}


/* =========================================================
   AUTHENTICATION
   ========================================================= */

async function verifyAdministrator() {

    try {

        const data =
            await apiRequest(AUTH_API);

        console.log(
            "Administrator authentication:",
            data
        );

        if (
            data &&
            (
                data.success === true ||
                data.authenticated === true ||
                data.authorized === true
            )
        ) {

            updateAdministratorName(data);

            return true;
        }


        /*
         * Some existing Crown Cash deployments may
         * return the authenticated user directly.
         */

        if (
            data &&
            data.user &&
            (
                data.user.is_admin === true ||
                data.user.role === "admin" ||
                data.user.role === "administrator" ||
                data.user.account_type === "admin" ||
                data.user.account_type === "administrator"
            )
        ) {

            updateAdministratorName(data);

            return true;
        }


        throw new Error(
            data.message ||
            "Administrator authorization required."
        );

    } catch (error) {

        console.error(
            "Administrator verification failed:",
            error
        );

        /*
         * Do not block the withdrawal API if the
         * separate auth endpoint has a temporary issue.
         *
         * The withdrawal PHP endpoint performs its
         * own administrator authorization.
         */

        return false;
    }
}


function updateAdministratorName(data) {

    const nameElement =
        $("headerUserName");

    if (!nameElement) {
        return;
    }

    const user =
        data && data.user
            ? data.user
            : data;

    const name =
        user &&
        (
            user.name ||
            user.full_name ||
            user.fullName ||
            user.firstName
        );

    if (name) {
        nameElement.textContent = name;
    }
}


/* =========================================================
   VALUE HELPERS
   ========================================================= */

function numberValue(value) {

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
            .replace(/[^\d.-]/g, "");

    const number =
        Number(cleaned);

    return Number.isFinite(number)
        ? number
        : 0;
}


function stringValue(value, fallback = "") {

    if (
        value === null ||
        value === undefined
    ) {
        return fallback;
    }

    return String(value).trim() || fallback;
}


function firstValue(...values) {

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


/* =========================================================
   MONEY
   ========================================================= */

function formatMoney(amount) {

    const value =
        numberValue(amount);

    return (
        "UGX " +
        Math.round(value).toLocaleString(
            "en-UG"
        )
    );
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

    if (
        Number.isNaN(
            date.getTime()
        )
    ) {
        return stringValue(
            value,
            "—"
        );
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


/* =========================================================
   NORMALIZE WITHDRAWAL
   ========================================================= */

function normalizeWithdrawal(item) {

    const withdrawal =
        item || {};


    const amount =
        numberValue(
            firstValue(
                withdrawal.amount,
                withdrawal.requested_amount,
                withdrawal.withdrawal_amount,
                withdrawal.requestedAmount
            )
        );


    const fee =
        numberValue(
            firstValue(
                withdrawal.fee,
                withdrawal.withdrawal_fee,
                withdrawal.transaction_fee,
                withdrawal.fees
            )
        );


    const payoutExplicit =
        firstValue(
            withdrawal.payout_amount,
            withdrawal.payoutAmount,
            withdrawal.payout,
            withdrawal.net_amount,
            withdrawal.netAmount
        );


    const payout =
        payoutExplicit !== ""
            ? numberValue(payoutExplicit)
            : Math.max(
                0,
                amount - fee
            );


    const method =
        firstValue(
            withdrawal.method,
            withdrawal.payment_method,
            withdrawal.paymentMethod,
            withdrawal.network
        );


    const phone =
        firstValue(
            withdrawal.phone,
            withdrawal.phone_number,
            withdrawal.account_number,
            withdrawal.accountNumber,
            withdrawal.mobile_number
        );


    const name =
        firstValue(
            withdrawal.name,
            withdrawal.full_name,
            withdrawal.fullName,
            [
                withdrawal.firstName,
                withdrawal.lastName
            ]
                .filter(Boolean)
                .join(" ")
        ) || "Unknown User";


    const status =
        stringValue(
            firstValue(
                withdrawal.status,
                withdrawal.withdrawal_status
            ),
            "pending"
        ).toLowerCase();


    const payoutSent =
        withdrawal.payout_sent === true ||
        withdrawal.payoutSent === true;


    let payoutStatus =
        stringValue(
            firstValue(
                withdrawal.payout_status,
                withdrawal.payoutStatus
            )
        ).toLowerCase();


    if (!payoutStatus) {

        if (payoutSent) {
            payoutStatus = "paid";
        } else if (status === "approved") {
            payoutStatus = "awaiting_payout";
        } else {
            payoutStatus = "not_required";
        }
    }


    return {

        raw: withdrawal,

        id:
            firstValue(
                withdrawal.id,
                withdrawal._id,
                withdrawal.withdrawal_id
            ),

        reference:
            firstValue(
                withdrawal.reference,
                withdrawal.ref,
                withdrawal.transaction_reference
            ),

        userId:
            firstValue(
                withdrawal.user_id,
                withdrawal.userId
            ),

        name,

        email:
            firstValue(
                withdrawal.email,
                withdrawal.user_email
            ),

        phone,

        amount,

        fee,

        payout,

        method,

        accountName:
            firstValue(
                withdrawal.account_name,
                withdrawal.accountName,
                name
            ),

        accountNumber:
            firstValue(
                withdrawal.account_number,
                withdrawal.accountNumber,
                phone
            ),

        status,

        payoutStatus,

        balanceReserved:
            withdrawal.balance_reserved === true,

        balanceDeducted:
            withdrawal.balance_deducted === true,

        adminApproved:
            withdrawal.admin_approved === true,

        payoutSent,

        adminNote:
            firstValue(
                withdrawal.admin_note,
                withdrawal.adminNote
            ),

        adminId:
            firstValue(
                withdrawal.admin_id,
                withdrawal.adminId
            ),

        adminEmail:
            firstValue(
                withdrawal.admin_email,
                withdrawal.adminEmail
            ),

        createdAt:
            firstValue(
                withdrawal.created_at,
                withdrawal.createdAt,
                withdrawal.date
            ),

        processedAt:
            firstValue(
                withdrawal.processed_at,
                withdrawal.processedAt
            )
    };
}


/* =========================================================
   LOAD WITHDRAWALS
   ========================================================= */

async function loadWithdrawals() {

    setLoadingState();

    clearMessage();


    try {

        const data =
            await apiRequest(
                API_URL +
                "?_=" +
                Date.now()
            );


        console.log(
            "Withdrawal API response:",
            data
        );


        if (
            !data ||
            data.success !== true
        ) {

            throw new Error(
                data &&
                data.message
                    ? data.message
                    : "Unable to load withdrawal requests."
            );
        }


        /*
         * Your API returns both:
         *
         * withdrawals: [...]
         *
         * and
         *
         * data: [...]
         *
         * Prefer withdrawals.
         */

        const rawWithdrawals =
            Array.isArray(
                data.withdrawals
            )
                ? data.withdrawals
                : (
                    Array.isArray(data.data)
                        ? data.data
                        : []
                );


        withdrawals =
            rawWithdrawals.map(
                normalizeWithdrawal
            );


        console.log(
            "Normalized withdrawals:",
            withdrawals
        );


        updateStatistics(data);

        applyFilters();


        showMessage(
            withdrawals.length +
            " withdrawal request" +
            (
                withdrawals.length === 1
                    ? ""
                    : "s"
            ) +
            " loaded successfully.",
            "success"
        );


    } catch (error) {

        console.error(
            "Unable to load withdrawals:",
            error
        );


        withdrawals = [];
        filteredWithdrawals = [];


        updateStatistics({
            totals: {
                total_withdrawals: 0,
                pending_withdrawals: 0,
                approved_withdrawals: 0,
                rejected_withdrawals: 0
            }
        });


        renderWithdrawals();


        showErrorState(
            error.message ||
            "Unable to load withdrawal requests."
        );

    } finally {

        hidePageLoader();
    }
}


/* =========================================================
   LOADING STATE
   ========================================================= */

function setLoadingState() {

    const tableBody =
        $("withdrawalsTableBody");

    if (tableBody) {

        tableBody.innerHTML = `
            <tr>
                <td colspan="10" class="loading-cell">
                    Loading withdrawals...
                </td>
            </tr>
        `;
    }


    const mobileList =
        $("withdrawalsMobileList");

    if (mobileList) {

        mobileList.innerHTML = `
            <div class="loading-cell">
                Loading withdrawal requests...
            </div>
        `;
    }
}


/* =========================================================
   ERROR STATE
   ========================================================= */

function showErrorState(message) {

    const tableBody =
        $("withdrawalsTableBody");

    if (tableBody) {

        tableBody.innerHTML = `
            <tr>
                <td colspan="10" class="loading-cell">
                    <div style="padding:20px;">
                        <strong>
                            Unable to load withdrawal requests
                        </strong>

                        <p style="margin:8px 0;">
                            ${escapeHtml(message)}
                        </p>

                        <button
                            type="button"
                            class="refresh-button"
                            onclick="window.CrownCashWithdrawals.load()"
                        >
                            Retry
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }


    const mobileList =
        $("withdrawalsMobileList");

    if (mobileList) {

        mobileList.innerHTML = `
            <div class="loading-cell" style="padding:20px;">
                <strong>
                    Unable to load withdrawal requests
                </strong>

                <p>
                    ${escapeHtml(message)}
                </p>

                <button
                    type="button"
                    class="refresh-button"
                    onclick="window.CrownCashWithdrawals.load()"
                >
                    Retry
                </button>
            </div>
        `;
    }


    showMessage(
        message,
        "error"
    );
}


/* =========================================================
   STATISTICS
   ========================================================= */

function updateStatistics(data) {

    const totals =
        data &&
        data.totals
            ? data.totals
            : {};


    let total =
        numberValue(
            firstValue(
                totals.total_withdrawals,
                totals.withdrawals
            )
        );


    let pending =
        numberValue(
            firstValue(
                totals.pending_withdrawals,
                totals.pending
            )
        );


    let approved =
        numberValue(
            firstValue(
                totals.approved_withdrawals,
                totals.approved
            )
        );


    let rejected =
        numberValue(
            firstValue(
                totals.rejected_withdrawals,
                totals.rejected
            )
        );


    /*
     * If the backend doesn't provide totals,
     * calculate them from the records.
     */

    if (
        total === 0 &&
        withdrawals.length > 0
    ) {

        total =
            withdrawals.reduce(
                (sum, item) =>
                    sum + item.amount,
                0
            );
    }


    if (
        pending === 0 &&
        withdrawals.some(
            item => item.status === "pending"
        )
    ) {

        pending =
            withdrawals
                .filter(
                    item =>
                        item.status === "pending"
                )
                .reduce(
                    (sum, item) =>
                        sum + item.amount,
                    0
                );
    }


    if (
        approved === 0 &&
        withdrawals.some(
            item => item.status === "approved"
        )
    ) {

        approved =
            withdrawals
                .filter(
                    item =>
                        item.status === "approved"
                )
                .reduce(
                    (sum, item) =>
                        sum + item.amount,
                    0
                );
    }


    if (
        rejected === 0 &&
        withdrawals.some(
            item => item.status === "rejected"
        )
    ) {

        rejected =
            withdrawals
                .filter(
                    item =>
                        item.status === "rejected"
                )
                .reduce(
                    (sum, item) =>
                        sum + item.amount,
                    0
                );
    }


    if ($("totalWithdrawals")) {
        $("totalWithdrawals").textContent =
            formatMoney(total);
    }


    if ($("pendingWithdrawals")) {
        $("pendingWithdrawals").textContent =
            formatMoney(pending);
    }


    if ($("approvedWithdrawals")) {
        $("approvedWithdrawals").textContent =
            formatMoney(approved);
    }


    if ($("rejectedWithdrawals")) {
        $("rejectedWithdrawals").textContent =
            formatMoney(rejected);
    }
}


/* =========================================================
   FILTERS
   ========================================================= */

function applyFilters() {

    const search =
        stringValue(
            $("withdrawalSearch")?.value
        ).toLowerCase();


    const status =
        $("statusFilter")
            ? $("statusFilter").value
            : "all";


    const method =
        $("methodFilter")
            ? $("methodFilter").value
            : "all";


    const payoutStatus =
        $("payoutStatusFilter")
            ? $("payoutStatusFilter").value
            : "all";


    filteredWithdrawals =
        withdrawals.filter(
            function (item) {

                const searchable = [
                    item.name,
                    item.email,
                    item.phone,
                    item.reference,
                    item.id,
                    item.userId,
                    item.accountNumber
                ]
                    .filter(Boolean)
                    .join(" ")
                    .toLowerCase();


                if (
                    search &&
                    !searchable.includes(search)
                ) {
                    return false;
                }


                if (
                    status !== "all" &&
                    item.status !== status
                ) {
                    return false;
                }


                if (
                    method !== "all" &&
                    !methodMatches(
                        item.method,
                        method
                    )
                ) {
                    return false;
                }


                if (
                    payoutStatus !== "all" &&
                    item.payoutStatus !== payoutStatus
                ) {
                    return false;
                }


                return true;
            }
        );


    currentPage = 1;

    renderWithdrawals();
}


function methodMatches(actual, expected) {

    const a =
        stringValue(actual)
            .toLowerCase();

    const e =
        stringValue(expected)
            .toLowerCase();


    if (!a) {
        return false;
    }


    if (e === "mtn") {
        return a.includes("mtn");
    }


    if (e === "airtel") {
        return a.includes("airtel");
    }


    return a === e;
}


/* =========================================================
   RENDER
   ========================================================= */

function renderWithdrawals() {

    const tableBody =
        $("withdrawalsTableBody");

    const mobileList =
        $("withdrawalsMobileList");


    if (
        !filteredWithdrawals.length
    ) {

        if (tableBody) {

            tableBody.innerHTML = `
                <tr>
                    <td
                        colspan="10"
                        class="loading-cell"
                    >
                        No withdrawal requests found.
                    </td>
                </tr>
            `;
        }


        if (mobileList) {

            mobileList.innerHTML = `
                <div class="loading-cell">
                    No withdrawal requests found.
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
            pageItems
                .map(
                    renderTableRow
                )
                .join("");
    }


    if (mobileList) {

        mobileList.innerHTML =
            pageItems
                .map(
                    renderMobileCard
                )
                .join("");
    }


    renderPagination();
}


/* =========================================================
   TABLE ROW
   ========================================================= */

function renderTableRow(item) {

    const method =
        item.method
            ? escapeHtml(item.method)
            : "—";


    const phone =
        item.phone
            ? escapeHtml(item.phone)
            : "—";


    return `
        <tr>

            <td>
                <div class="withdrawal-user">

                    <strong>
                        ${escapeHtml(item.name)}
                    </strong>

                    ${
                        item.email
                            ? `
                                <small>
                                    ${escapeHtml(item.email)}
                                </small>
                            `
                            : ""
                    }

                </div>
            </td>


            <td>
                <strong>
                    ${formatMoney(item.amount)}
                </strong>
            </td>


            <td>
                ${formatMoney(item.fee)}
            </td>


            <td>
                <strong>
                    ${formatMoney(item.payout)}
                </strong>
            </td>


            <td>
                ${method}
            </td>


            <td>
                ${phone}
            </td>


            <td>
                ${statusBadge(item.status)}
            </td>


            <td>
                ${payoutBadge(item.payoutStatus)}
            </td>


            <td>
                ${escapeHtml(
                    formatDate(item.createdAt)
                )}
            </td>


            <td>

                <button
                    type="button"
                    class="withdrawal-action-button"
                    data-withdrawal-action="view"
                    data-withdrawal-id="${escapeHtml(item.id)}"
                >
                    Review
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
        <article
            class="withdrawal-mobile-card"
        >

            <div class="withdrawal-mobile-header">

                <div>

                    <strong>
                        ${escapeHtml(item.name)}
                    </strong>

                    <small>
                        ${escapeHtml(
                            item.reference || item.id
                        )}
                    </small>

                </div>

                ${statusBadge(item.status)}

            </div>


            <div class="withdrawal-mobile-details">

                <div>
                    <span>Requested</span>
                    <strong>
                        ${formatMoney(item.amount)}
                    </strong>
                </div>

                <div>
                    <span>Fee</span>
                    <strong>
                        ${formatMoney(item.fee)}
                    </strong>
                </div>

                <div>
                    <span>Payout</span>
                    <strong>
                        ${formatMoney(item.payout)}
                    </strong>
                </div>

                <div>
                    <span>Phone</span>
                    <strong>
                        ${escapeHtml(
                            item.phone || "—"
                        )}
                    </strong>
                </div>

                <div>
                    <span>Method</span>
                    <strong>
                        ${escapeHtml(
                            item.method || "—"
                        )}
                    </strong>
                </div>

                <div>
                    <span>Date</span>
                    <strong>
                        ${escapeHtml(
                            formatDate(item.createdAt)
                        )}
                    </strong>
                </div>

            </div>


            <div class="withdrawal-mobile-actions">

                <button
                    type="button"
                    class="withdrawal-action-button"
                    data-withdrawal-action="view"
                    data-withdrawal-id="${escapeHtml(item.id)}"
                >
                    Review Withdrawal
                </button>

            </div>

        </article>
    `;
}


/* =========================================================
   STATUS BADGES
   ========================================================= */

function statusBadge(status) {

    const normalized =
        stringValue(
            status,
            "pending"
        ).toLowerCase();


    const label =
        normalized.charAt(0).toUpperCase() +
        normalized.slice(1);


    return `
        <span
            class="withdrawal-status status-${escapeHtml(normalized)}"
        >
            ${escapeHtml(label)}
        </span>
    `;
}


function payoutBadge(status) {

    const normalized =
        stringValue(
            status,
            "not_required"
        ).toLowerCase();


    const labels = {

        not_required:
            "Not Required",

        awaiting_payout:
            "Awaiting Payout",

        paid:
            "Paid",

        payout_failed:
            "Payout Failed"
    };


    return `
        <span
            class="withdrawal-payout-status payout-${escapeHtml(normalized)}"
        >
            ${escapeHtml(
                labels[normalized] ||
                normalized
            )}
        </span>
    `;
}


/* =========================================================
   MODAL
   ========================================================= */

function openWithdrawalModal(id) {

    const item =
        withdrawals.find(
            withdrawal =>
                String(withdrawal.id) === String(id)
        );


    if (!item) {

        showMessage(
            "Withdrawal request could not be found.",
            "error"
        );

        return;
    }


    selectedWithdrawal = item;


    setText(
        "withdrawalRequestedAmount",
        formatMoney(item.amount)
    );


    setText(
        "withdrawalFee",
        formatMoney(item.fee)
    );


    setText(
        "withdrawalPayoutAmount",
        formatMoney(item.payout)
    );


    setText(
        "withdrawalPaymentMethod",
        item.method || "Not specified"
    );


    setText(
        "withdrawalRegisteredPhone",
        item.phone || "Not specified"
    );


    setText(
        "withdrawalStatus",
        capitalize(item.status)
    );


    setText(
        "withdrawalPayoutStatus",
        payoutStatusLabel(
            item.payoutStatus
        )
    );


    setText(
        "withdrawalRequestedDate",
        formatDate(item.createdAt)
    );


    setText(
        "withdrawalId",
        item.reference ||
        item.id ||
        "—"
    );


    const note =
        $("withdrawalAdminNote");

    if (note) {
        note.value =
            item.adminNote || "";
    }


    const approve =
        $("approveWithdrawalButton");

    const reject =
        $("rejectWithdrawalButton");


    const isPending =
        item.status === "pending";


    if (approve) {
        approve.disabled =
            !isPending;
    }


    if (reject) {
        reject.disabled =
            !isPending;
    }


    const modal =
        $("withdrawalModal");

    if (!modal) {
        return;
    }


    modal.hidden = false;

    document.body.classList.add(
        "modal-open"
    );
}


function closeWithdrawalModal() {

    const modal =
        $("withdrawalModal");

    if (modal) {
        modal.hidden = true;
    }

    document.body.classList.remove(
        "modal-open"
    );

    selectedWithdrawal = null;
}


function setText(id, value) {

    const element = $(id);

    if (element) {
        element.textContent =
            value === undefined ||
            value === null ||
            value === ""
                ? "—"
                : value;
    }
}


/* =========================================================
   APPROVE / REJECT
   ========================================================= */

async function processWithdrawal(
    action
) {

    if (!selectedWithdrawal) {

        showMessage(
            "Please select a withdrawal request first.",
            "error"
        );

        return;
    }


    if (
        action !== "approve" &&
        action !== "reject"
    ) {
        return;
    }


    const id =
        selectedWithdrawal.id;


    const note =
        $("withdrawalAdminNote")
            ? $("withdrawalAdminNote").value.trim()
            : "";


    const actionLabel =
        action === "approve"
            ? "approve"
            : "reject";


    const confirmed =
        window.confirm(
            "Are you sure you want to " +
            actionLabel +
            " this withdrawal of " +
            formatMoney(
                selectedWithdrawal.amount
            ) +
            "?"
        );


    if (!confirmed) {
        return;
    }


    const approveButton =
        $("approveWithdrawalButton");

    const rejectButton =
        $("rejectWithdrawalButton");


    if (approveButton) {
        approveButton.disabled = true;
    }


    if (rejectButton) {
        rejectButton.disabled = true;
    }


    try {

        const data =
            await apiRequest(
                API_URL,
                {
                    method: "POST",

                    body: {
                        withdrawalId: id,
                        action: action,
                        admin_note: note,
                        note: note
                    }
                }
            );


        if (
            data &&
            data.success === false
        ) {

            throw new Error(
                data.message ||
                "Unable to process withdrawal."
            );
        }


        showMessage(
            data.message ||
            (
                action === "approve"
                    ? "Withdrawal approved successfully."
                    : "Withdrawal rejected successfully."
            ),
            "success"
        );


        closeWithdrawalModal();


        await loadWithdrawals();


    } catch (error) {

        console.error(
            "Withdrawal processing failed:",
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


/* =========================================================
   PAGINATION
   ========================================================= */

function renderPagination() {

    const container =
        $("withdrawalPagination");

    if (!container) {
        return;
    }


    const totalPages =
        Math.ceil(
            filteredWithdrawals.length /
            ITEMS_PER_PAGE
        );


    if (totalPages <= 1) {

        container.innerHTML = "";

        return;
    }


    let html = "";


    if (currentPage > 1) {

        html += `
            <button
                type="button"
                data-page="${currentPage - 1}"
            >
                Previous
            </button>
        `;
    }


    for (
        let page = 1;
        page <= totalPages;
        page++
    ) {

        html += `
            <button
                type="button"
                data-page="${page}"
                class="${
                    page === currentPage
                        ? "active"
                        : ""
                }"
            >
                ${page}
            </button>
        `;
    }


    if (
        currentPage < totalPages
    ) {

        html += `
            <button
                type="button"
                data-page="${currentPage + 1}"
            >
                Next
            </button>
        `;
    }


    container.innerHTML = html;
}


/* =========================================================
   EVENT LISTENERS
   ========================================================= */

function setupEvents() {

    const search =
        $("withdrawalSearch");

    if (search) {

        search.addEventListener(
            "input",
            applyFilters
        );
    }


    const status =
        $("statusFilter");

    if (status) {

        status.addEventListener(
            "change",
            applyFilters
        );
    }


    const method =
        $("methodFilter");

    if (method) {

        method.addEventListener(
            "change",
            applyFilters
        );
    }


    const payoutStatus =
        $("payoutStatusFilter");

    if (payoutStatus) {

        payoutStatus.addEventListener(
            "change",
            applyFilters
        );
    }


    const refresh =
        $("refreshWithdrawalsBtn");

    if (refresh) {

        refresh.addEventListener(
            "click",
            function () {

                loadWithdrawals();

            }
        );
    }


    const tableBody =
        $("withdrawalsTableBody");

    if (tableBody) {

        tableBody.addEventListener(
            "click",
            handleWithdrawalClick
        );
    }


    const mobileList =
        $("withdrawalsMobileList");

    if (mobileList) {

        mobileList.addEventListener(
            "click",
            handleWithdrawalClick
        );
    }


    const pagination =
        $("withdrawalPagination");

    if (pagination) {

        pagination.addEventListener(
            "click",
            function (event) {

                const button =
                    event.target.closest(
                        "[data-page]"
                    );

                if (!button) {
                    return;
                }


                const page =
                    Number(
                        button.dataset.page
                    );


                if (
                    Number.isFinite(page) &&
                    page > 0
                ) {

                    currentPage = page;

                    renderWithdrawals();

                }
            }
        );
    }


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
            function () {

                processWithdrawal(
                    "approve"
                );

            }
        );
    }


    const rejectButton =
        $("rejectWithdrawalButton");

    if (rejectButton) {

        rejectButton.addEventListener(
            "click",
            function () {

                processWithdrawal(
                    "reject"
                );

            }
        );
    }


    const modal =
        $("withdrawalModal");

    if (modal) {

        modal.addEventListener(
            "click",
            function (event) {

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
        function (event) {

            if (
                event.key === "Escape"
            ) {

                const modal =
                    $("withdrawalModal");

                if (
                    modal &&
                    !modal.hidden
                ) {

                    closeWithdrawalModal();

                }
            }
        }
    );
}


function handleWithdrawalClick(event) {

    const button =
        event.target.closest(
            "[data-withdrawal-action]"
        );


    if (!button) {
        return;
    }


    const action =
        button.dataset.withdrawalAction;


    const id =
        button.dataset.withdrawalId;


    if (
        action === "view"
    ) {

        openWithdrawalModal(id);

    }
}


/* =========================================================
   UTILITY
   ========================================================= */

function capitalize(value) {

    const text =
        stringValue(
            value,
            "—"
        );


    return text.charAt(0).toUpperCase() +
        text.slice(1);
}


function payoutStatusLabel(status) {

    const labels = {

        not_required:
            "Not Required",

        awaiting_payout:
            "Awaiting Payout",

        paid:
            "Paid",

        payout_failed:
            "Payout Failed"
    };


    return (
        labels[status] ||
        capitalize(status)
    );
}


function escapeHtml(value) {

    return String(
        value === undefined ||
        value === null
            ? ""
            : value
    )
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


/* =========================================================
   INITIALIZATION
   ========================================================= */

async function initializeWithdrawals() {

    try {

        setupEvents();

        /*
         * Authentication is checked separately by PHP.
         * We don't prevent loading the withdrawal API when
         * this optional preliminary check fails.
         */

        await verifyAdministrator();

        await loadWithdrawals();

    } catch (error) {

        console.error(
            "Withdrawal page initialization failed:",
            error
        );

        hidePageLoader();
    }
}


/* =========================================================
   AUTO REFRESH
   ========================================================= */

let refreshTimer = null;


function startAutoRefresh() {

    if (refreshTimer) {
        clearInterval(refreshTimer);
    }


    refreshTimer =
        setInterval(
            function () {

                /*
                 * Don't refresh while the administrator
                 * is reviewing a withdrawal.
                 */

                const modal =
                    $("withdrawalModal");

                if (
                    modal &&
                    !modal.hidden
                ) {
                    return;
                }


                loadWithdrawals();

            },
            REFRESH_INTERVAL
        );
}


/* =========================================================
   GLOBAL API
   ========================================================= */

window.CrownCashWithdrawals = {

    load: loadWithdrawals,

    refresh: loadWithdrawals,

    open: openWithdrawalModal,

    close: closeWithdrawalModal,

    approve: function () {
        return processWithdrawal(
            "approve"
        );
    },

    reject: function () {
        return processWithdrawal(
            "reject"
        );
    }

};


/* =========================================================
   START
   ========================================================= */

if (
    document.readyState === "loading"
) {

    document.addEventListener(
        "DOMContentLoaded",
        function () {

            initializeWithdrawals();
            startAutoRefresh();

        }
    );

} else {

    initializeWithdrawals();
    startAutoRefresh();

}