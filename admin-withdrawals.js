"use strict";

/*
=========================================================
 CROWN CASH — ADMIN WITHDRAWALS
=========================================================
 Handles:
 - Administrator authentication
 - Admin profile
 - Withdrawal loading
 - Search
 - Status filtering
 - Payment-method filtering
 - Payout-status filtering
 - Pagination
 - Withdrawal details modal
 - Approve withdrawal
 - Reject withdrawal
 - 20% fee display
 - MTN / Airtel display
 - Secure credentials
=========================================================
*/

const API_BASE = "https://crown-cash1.onrender.com";

const ADMIN_AUTH_API =
    `${API_BASE}/admin-auth.php`;

const PROFILE_API =
    `${API_BASE}/profile.php`;

const WITHDRAWALS_API =
    `${API_BASE}/admin-withdrawals.php`;

const LOGOUT_API =
    `${API_BASE}/logout.php`;


/* =========================================================
   CONFIGURATION
========================================================= */

const PAGE_SIZE = 10;
const WITHDRAWAL_FEE_RATE = 0.20;


/* =========================================================
   STATE
========================================================= */

const state = {
    withdrawals: [],
    filteredWithdrawals: [],
    currentPage: 1,
    selectedWithdrawal: null,
    loading: false
};


/* =========================================================
   DOM HELPERS
========================================================= */

function $(id) {
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


/* =========================================================
   NUMBER HELPERS
========================================================= */

function toNumber(value) {
    if (
        value === null ||
        value === undefined ||
        value === ""
    ) {
        return 0;
    }

    if (
        typeof value === "object" &&
        value !== null
    ) {
        if (value.$numberDecimal !== undefined) {
            return Number(value.$numberDecimal) || 0;
        }

        if (value.$numberLong !== undefined) {
            return Number(value.$numberLong) || 0;
        }

        if (value.toString) {
            const parsed = Number(value.toString());

            if (!Number.isNaN(parsed)) {
                return parsed;
            }
        }
    }

    const number = Number(value);

    return Number.isFinite(number)
        ? number
        : 0;
}


function formatCurrency(value) {
    const amount = toNumber(value);

    return new Intl.NumberFormat("en-UG", {
        style: "currency",
        currency: "UGX",
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(amount);
}


function formatNumber(value) {
    return new Intl.NumberFormat("en-UG", {
        maximumFractionDigits: 0
    }).format(toNumber(value));
}


/* =========================================================
   DATE HELPERS
========================================================= */

function parseDate(value) {
    if (!value) {
        return null;
    }

    if (
        typeof value === "object" &&
        value !== null &&
        value.$date
    ) {
        value = value.$date;
    }

    if (
        typeof value === "object" &&
        value !== null &&
        value.date
    ) {
        value = value.date;
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return null;
    }

    return date;
}


function formatDate(value) {
    const date = parseDate(value);

    if (!date) {
        return "—";
    }

    return new Intl.DateTimeFormat("en-UG", {
        year: "numeric",
        month: "short",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit"
    }).format(date);
}


/* =========================================================
   USER NAME
========================================================= */

function getUserName(withdrawal) {
    const fullName =
        withdrawal.full_name ||
        withdrawal.user_name ||
        withdrawal.name;

    if (fullName) {
        return String(fullName);
    }

    const firstName =
        withdrawal.first_name ||
        withdrawal.firstName ||
        "";

    const lastName =
        withdrawal.last_name ||
        withdrawal.lastName ||
        "";

    const combined =
        `${firstName} ${lastName}`.trim();

    return combined || "Unknown User";
}


function getUserEmail(withdrawal) {
    return (
        withdrawal.email ||
        withdrawal.user_email ||
        withdrawal.userEmail ||
        "No email"
    );
}


/* =========================================================
   ID HELPERS
========================================================= */

function getWithdrawalId(withdrawal) {
    if (!withdrawal) {
        return "";
    }

    if (withdrawal.id) {
        return String(withdrawal.id);
    }

    if (withdrawal.withdrawal_id) {
        return String(withdrawal.withdrawal_id);
    }

    if (withdrawal._id) {
        if (
            typeof withdrawal._id === "object" &&
            withdrawal._id.$oid
        ) {
            return String(withdrawal._id.$oid);
        }

        return String(withdrawal._id);
    }

    return "";
}


/* =========================================================
   STATUS HELPERS
========================================================= */

function normalizeStatus(status) {
    return String(
        status || "pending"
    )
        .trim()
        .toLowerCase()
        .replace(/\s+/g, "_");
}


function normalizeMethod(method) {
    const value = String(
        method || ""
    )
        .trim()
        .toLowerCase();

    if (
        value.includes("airtel")
    ) {
        return "Airtel";
    }

    if (
        value.includes("mtn")
    ) {
        return "MTN";
    }

    return method
        ? String(method)
        : "—";
}


function normalizePayoutStatus(status) {
    const value = String(
        status || ""
    )
        .trim()
        .toLowerCase()
        .replace(/\s+/g, "_");

    return value || "not_required";
}


function statusLabel(status) {
    const normalized =
        normalizeStatus(status);

    const labels = {
        pending: "Pending",
        approved: "Approved",
        rejected: "Rejected",
        cancelled: "Cancelled",
        processing: "Processing"
    };

    return (
        labels[normalized] ||
        String(status || "Unknown")
    );
}


function payoutStatusLabel(status) {
    const normalized =
        normalizePayoutStatus(status);

    const labels = {
        not_required: "Not Required",
        awaiting_payout: "Awaiting Payout",
        paid: "Paid",
        failed: "Payout Failed",
        payout_failed: "Payout Failed",
        processing: "Processing"
    };

    return (
        labels[normalized] ||
        String(status || "Unknown")
    );
}


function getStatusClass(status) {
    const normalized =
        normalizeStatus(status);

    switch (normalized) {
        case "approved":
            return "status-approved";

        case "rejected":
            return "status-rejected";

        case "cancelled":
            return "status-cancelled";

        case "pending":
        default:
            return "status-pending";
    }
}


function getPayoutStatusClass(status) {
    const normalized =
        normalizePayoutStatus(status);

    switch (normalized) {
        case "awaiting_payout":
            return "status-awaiting";

        case "paid":
            return "status-approved";

        case "failed":
        case "payout_failed":
            return "status-rejected";

        case "processing":
            return "status-awaiting";

        case "not_required":
        default:
            return "status-cancelled";
    }
}


/* =========================================================
   WITHDRAWAL FIELD NORMALIZATION
========================================================= */

function normalizeWithdrawal(item) {
    const withdrawal = {
        ...item
    };

    withdrawal.id =
        getWithdrawalId(item);

    withdrawal.full_name =
        getUserName(item);

    withdrawal.email =
        getUserEmail(item);

    withdrawal.phone =
        item.phone ||
        item.phone_number ||
        item.mobile ||
        item.registered_phone ||
        "";

    withdrawal.payment_method =
        normalizeMethod(
            item.payment_method ||
            item.method ||
            item.paymentMethod
        );

    withdrawal.status =
        normalizeStatus(
            item.status ||
            item.withdrawal_status
        );

    withdrawal.payout_status =
        normalizePayoutStatus(
            item.payout_status ||
            item.payoutStatus
        );

    withdrawal.amount =
        toNumber(
            item.amount ||
            item.requested_amount ||
            item.withdrawal_amount
        );

    withdrawal.fee =
        toNumber(
            item.fee ||
            item.withdrawal_fee ||
            item.fee_amount
        );

    /*
     * If the backend did not return the fee,
     * calculate the configured 20% fee for display.
     */
    if (
        withdrawal.fee <= 0 &&
        withdrawal.amount > 0
    ) {
        withdrawal.fee =
            withdrawal.amount *
            WITHDRAWAL_FEE_RATE;
    }

    withdrawal.payout_amount =
        toNumber(
            item.payout_amount ||
            item.payout ||
            item.net_amount
        );

    /*
     * If backend did not return payout amount,
     * calculate requested amount minus 20% fee.
     */
    if (
        withdrawal.payout_amount <= 0 &&
        withdrawal.amount > 0
    ) {
        withdrawal.payout_amount =
            withdrawal.amount -
            withdrawal.fee;
    }

    withdrawal.created_at =
        item.created_at ||
        item.createdAt ||
        item.requested_at ||
        item.date ||
        null;

    withdrawal.admin_note =
        item.admin_note ||
        item.adminNote ||
        item.note ||
        item.rejection_reason ||
        "";

    return withdrawal;
}


/* =========================================================
   MESSAGE
========================================================= */

function showMessage(
    message,
    type = "info"
) {
    const element =
        $("withdrawalMessage");

    if (!element) {
        return;
    }

    element.textContent =
        message || "";

    element.className =
        "withdrawal-message show";

    if (type === "error") {
        element.classList.add("error");
    }

    if (type === "success") {
        element.classList.add("success");
    }

    clearTimeout(
        showMessage.timeout
    );

    showMessage.timeout =
        setTimeout(() => {
            element.classList.remove("show");
        }, 5000);
}


/* =========================================================
   ADMIN AUTHENTICATION
========================================================= */

async function verifyAdmin() {
    try {
        const response =
            await fetch(
                ADMIN_AUTH_API,
                {
                    method: "GET",
                    credentials: "include",
                    headers: {
                        "Accept":
                            "application/json"
                    }
                }
            );

        if (
            response.status === 401 ||
            response.status === 403
        ) {
            window.location.href =
                "login.html";

            return false;
        }

        const data =
            await response.json();

        if (
            !response.ok ||
            !data.success ||
            data.authorized === false
        ) {
            window.location.href =
                "login.html";

            return false;
        }

        return true;

    } catch (error) {
        console.error(
            "Admin authentication error:",
            error
        );

        showMessage(
            "Unable to verify administrator access.",
            "error"
        );

        return false;
    }
}


/* =========================================================
   PROFILE
========================================================= */

async function loadAdminProfile() {
    try {
        const response =
            await fetch(
                PROFILE_API,
                {
                    method: "GET",
                    credentials: "include",
                    headers: {
                        "Accept":
                            "application/json"
                    }
                }
            );

        if (
            response.status === 401 ||
            response.status === 403
        ) {
            window.location.href =
                "login.html";

            return;
        }

        const data =
            await response.json();

        if (
            !response.ok ||
            !data.success ||
            !data.user
        ) {
            return;
        }

        const user =
            data.user;

        const firstName =
            user.first_name ||
            "";

        const fullName =
            user.full_name ||
            `${firstName} ${user.last_name || ""}`.trim() ||
            "Administrator";

        const email =
            user.email ||
            "";

        if ($("adminName")) {
            $("adminName").textContent =
                fullName;
        }

        if ($("headerUserName")) {
            $("headerUserName").textContent =
                fullName;
        }

        if ($("adminAccountType")) {
            $("adminAccountType").textContent =
                user.account_type ||
                user.role ||
                "Administrator";
        }

        updateAvatar(
            $("adminAvatar"),
            fullName
        );

        updateAvatar(
            $("accountAvatar"),
            fullName
        );

    } catch (error) {
        console.error(
            "Profile loading error:",
            error
        );
    }
}


function updateAvatar(
    element,
    name
) {
    if (!element) {
        return;
    }

    /*
     * Keep the existing SVG avatar.
     * The name is intentionally not placed
     * inside the icon container.
     */
}


/* =========================================================
   LOAD WITHDRAWALS
========================================================= */

async function loadWithdrawals() {
    if (state.loading) {
        return;
    }

    state.loading = true;

    showLoadingState(true);

    try {
        const response =
            await fetch(
                WITHDRAWALS_API,
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

        if (
            response.status === 401 ||
            response.status === 403
        ) {
            window.location.href =
                "login.html";

            return;
        }

        const data =
            await response.json();

        if (!response.ok) {
            throw new Error(
                data.message ||
                "Unable to load withdrawals."
            );
        }

        if (!data.success) {
            throw new Error(
                data.message ||
                "Unable to load withdrawals."
            );
        }

        let withdrawals =
            Array.isArray(data.withdrawals)
                ? data.withdrawals
                : [];

        state.withdrawals =
            withdrawals.map(
                normalizeWithdrawal
            );

        updateSummary(
            data
        );

        applyFilters();

    } catch (error) {
        console.error(
            "Withdrawal loading error:",
            error
        );

        state.withdrawals = [];
        state.filteredWithdrawals = [];

        updateSummary({
            total_withdrawals: 0,
            pending_withdrawals: 0,
            approved_withdrawals: 0,
            rejected_withdrawals: 0
        });

        showLoadingState(false);

        showEmptyState(
            "Unable to load withdrawal requests. Please refresh and try again.",
            true
        );

    } finally {
        state.loading = false;
    }
}


/* =========================================================
   SUMMARY
========================================================= */

function updateSummary(data) {
    /*
     * The API may return either:
     *
     * counts:
     * {
     *   total,
     *   pending,
     *   approved,
     *   rejected
     * }
     *
     * or direct values.
     */

    const summary =
        data.summary ||
        data.statistics ||
        {};

    const total =
        data.total_withdrawals ??
        summary.total_withdrawals ??
        summary.total ??
        calculateTotalByStatus();

    const pending =
        data.pending_withdrawals ??
        summary.pending_withdrawals ??
        summary.pending ??
        calculateAmountByStatus("pending");

    const approved =
        data.approved_withdrawals ??
        summary.approved_withdrawals ??
        summary.approved ??
        calculateAmountByStatus("approved");

    const rejected =
        data.rejected_withdrawals ??
        summary.rejected_withdrawals ??
        summary.rejected ??
        calculateAmountByStatus("rejected");

    /*
     * If the API gives counts instead of monetary totals,
     * use them only where explicitly provided.
     */

    setText(
        "totalWithdrawals",
        formatSummaryValue(total)
    );

    setText(
        "pendingWithdrawals",
        formatSummaryValue(pending)
    );

    setText(
        "approvedWithdrawals",
        formatSummaryValue(approved)
    );

    setText(
        "rejectedWithdrawals",
        formatSummaryValue(rejected)
    );
}


function formatSummaryValue(value) {
    /*
     * Admin withdrawal summary is intended
     * to display monetary totals.
     */
    return formatCurrency(value);
}


function calculateTotalByStatus() {
    return state.withdrawals.reduce(
        (sum, item) =>
            sum + toNumber(item.amount),
        0
    );
}


function calculateAmountByStatus(
    status
) {
    return state.withdrawals
        .filter(
            item =>
                normalizeStatus(item.status) ===
                status
        )
        .reduce(
            (sum, item) =>
                sum + toNumber(item.amount),
            0
        );
}


function setText(
    id,
    value
) {
    const element = $(id);

    if (element) {
        element.textContent =
            value;
    }
}


/* =========================================================
   FILTERS
========================================================= */

function applyFilters() {
    const search =
        (
            $("searchWithdrawals")?.value ||
            ""
        )
            .trim()
            .toLowerCase();

    const status =
        normalizeFilterValue(
            $("statusFilter")?.value
        );

    const method =
        normalizeFilterValue(
            $("methodFilter")?.value
        );

    const payoutStatus =
        normalizeFilterValue(
            $("payoutStatusFilter")?.value
        );

    state.filteredWithdrawals =
        state.withdrawals.filter(
            withdrawal => {

                if (search) {
                    const searchableText = [
                        withdrawal.full_name,
                        withdrawal.email,
                        withdrawal.phone,
                        withdrawal.id,
                        withdrawal.payment_method,
                        withdrawal.status,
                        withdrawal.payout_status
                    ]
                        .join(" ")
                        .toLowerCase();

                    if (
                        !searchableText.includes(
                            search
                        )
                    ) {
                        return false;
                    }
                }


                if (
                    status !== "all" &&
                    normalizeStatus(
                        withdrawal.status
                    ) !== status
                ) {
                    return false;
                }


                if (
                    method !== "all" &&
                    normalizeMethod(
                        withdrawal.payment_method
                    ).toLowerCase() !==
                    method.toLowerCase()
                ) {
                    return false;
                }


                if (
                    payoutStatus !== "all" &&
                    normalizePayoutStatus(
                        withdrawal.payout_status
                    ) !== payoutStatus
                ) {
                    return false;
                }


                return true;
            }
        );

    state.currentPage = 1;

    renderWithdrawals();
}


function normalizeFilterValue(
    value
) {
    if (!value) {
        return "all";
    }

    return String(value)
        .trim()
        .toLowerCase()
        .replace(/\s+/g, "_");
}


/* =========================================================
   RENDER TABLE
========================================================= */

function renderWithdrawals() {
    const tableBody =
        $("withdrawalsTableBody");

    if (!tableBody) {
        return;
    }

    showLoadingState(false);

    const total =
        state.filteredWithdrawals.length;

    if (total === 0) {
        tableBody.innerHTML = "";

        showEmptyState(
            "There are no withdrawal requests matching the current filters."
        );

        renderPagination(0);

        return;
    }

    hideEmptyState();

    const totalPages =
        Math.ceil(
            total / PAGE_SIZE
        );

    if (
        state.currentPage >
        totalPages
    ) {
        state.currentPage =
            totalPages;
    }

    const start =
        (
            state.currentPage - 1
        ) * PAGE_SIZE;

    const pageItems =
        state.filteredWithdrawals.slice(
            start,
            start + PAGE_SIZE
        );

    tableBody.innerHTML =
        pageItems
            .map(
                renderWithdrawalRow
            )
            .join("");

    renderPagination(
        totalPages
    );
}


function renderWithdrawalRow(
    withdrawal
) {
    const id =
        escapeHTML(
            withdrawal.id
        );

    const name =
        escapeHTML(
            withdrawal.full_name
        );

    const email =
        escapeHTML(
            withdrawal.email
        );

    const phone =
        escapeHTML(
            withdrawal.phone ||
            "—"
        );

    const method =
        normalizeMethod(
            withdrawal.payment_method
        );

    const methodClass =
        method === "Airtel"
            ? "airtel"
            : "";

    const status =
        normalizeStatus(
            withdrawal.status
        );

    const payoutStatus =
        normalizePayoutStatus(
            withdrawal.payout_status
        );

    const isPending =
        status === "pending";

    return `
        <tr
            data-withdrawal-id="${id}"
        >

            <td>

                <div class="withdrawal-user">

                    <div class="withdrawal-user-avatar">

                        <svg viewBox="0 0 24 24">
                            <circle
                                cx="12"
                                cy="8"
                                r="3.2"
                            ></circle>

                            <path
                                d="M5.5 20c.7-3.7 3-5.5 6.5-5.5s5.8 1.8 6.5 5.5"
                            ></path>
                        </svg>

                    </div>

                    <div>

                        <div
                            class="withdrawal-user-name"
                            title="${name}"
                        >
                            ${name}
                        </div>

                        <div
                            class="withdrawal-user-email"
                            title="${email}"
                        >
                            ${email}
                        </div>

                    </div>

                </div>

            </td>


            <td>
                <span class="withdrawal-amount">
                    ${formatCurrency(
                        withdrawal.amount
                    )}
                </span>
            </td>


            <td>
                <span class="withdrawal-fee">
                    ${formatCurrency(
                        withdrawal.fee
                    )}
                </span>
            </td>


            <td>
                <span class="withdrawal-payout">
                    ${formatCurrency(
                        withdrawal.payout_amount
                    )}
                </span>
            </td>


            <td>

                <span class="withdrawal-method">

                    <span
                        class="method-dot ${methodClass}"
                    ></span>

                    ${escapeHTML(
                        method
                    )}

                </span>

            </td>


            <td>
                <span class="withdrawal-phone">
                    ${phone}
                </span>
            </td>


            <td>

                <span
                    class="withdrawal-status ${getStatusClass(status)}"
                >
                    ${escapeHTML(
                        statusLabel(status)
                    )}
                </span>

            </td>


            <td>

                <span
                    class="payout-status ${getPayoutStatusClass(payoutStatus)}"
                >
                    ${escapeHTML(
                        payoutStatusLabel(
                            payoutStatus
                        )
                    )}
                </span>

            </td>


            <td>
                ${escapeHTML(
                    formatDate(
                        withdrawal.created_at
                    )
                )}
            </td>


            <td>

                <div class="withdrawal-actions">

                    <button
                        type="button"
                        class="withdrawal-action-btn"
                        data-action="view"
                        data-withdrawal-id="${id}"
                        title="View withdrawal"
                        aria-label="View withdrawal"
                    >

                        <svg viewBox="0 0 24 24">
                            <path
                                d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-