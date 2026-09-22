"use strict";

/*
=========================================================
CROWN CASH - ADMIN WITHDRAWALS
=========================================================

Handles:

✓ Admin authentication
✓ Loading withdrawals
✓ Withdrawal statistics
✓ Search
✓ Status filter
✓ Payment method filter
✓ Withdrawal review modal
✓ Approve withdrawal
✓ Reject withdrawal
✓ 20% withdrawal fee display
✓ Customer payout amount
✓ Payout status
✓ Refresh
✓ Admin logout
✓ Mobile sidebar
✓ Secure HTML escaping

IMPORTANT:
Administrative approval does NOT automatically send
MTN/Airtel money.

After approval:

payout_status = "awaiting_payout"

Actual payout must be completed through an authorized
MTN/Airtel payment process or API.
=========================================================
*/


/* =========================================================
   API SETTINGS
   ========================================================= */

const API_BASE =
    "https://crown-cash1.onrender.com";

const WITHDRAWALS_API =
    `${API_BASE}/admin-withdrawals.php`;

const ADMIN_CHECK_API =
    `${API_BASE}/admin-check.php`;

const LOGOUT_API =
    `${API_BASE}/logout.php`;


/* =========================================================
   WITHDRAWAL SETTINGS
   ========================================================= */

const MINIMUM_WITHDRAWAL = 5000;

/*
20% withdrawal fee
*/
const WITHDRAWAL_FEE_RATE = 0.20;


/* =========================================================
   STATE
   ========================================================= */

let withdrawals = [];

let filteredWithdrawals = [];

let selectedWithdrawal = null;

let toastTimer = null;


/* =========================================================
   DOM HELPERS
   ========================================================= */

function $(selector) {
    return document.querySelector(selector);
}


function $all(selector) {
    return document.querySelectorAll(selector);
}


/* =========================================================
   INITIALIZATION
   ========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    async () => {

        setupEvents();

        const authorized =
            await checkAdminAuthentication();

        if (!authorized) {
            return;
        }

        await loadWithdrawals();

    }
);


/* =========================================================
   ADMIN AUTHENTICATION
   ========================================================= */

async function checkAdminAuthentication() {

    try {

        const response =
            await fetch(
                ADMIN_CHECK_API,
                {
                    method: "GET",
                    credentials: "include",
                    headers: {
                        "Accept": "application/json"
                    },
                    cache: "no-store"
                }
            );


        const data =
            await parseJsonResponse(response);


        if (
            !response.ok ||
            !data ||
            data.success !== true ||
            data.authorized !== true
        ) {

            redirectToAdminLogin();

            return false;

        }


        return true;


    } catch (error) {

        console.error(
            "Admin authentication error:",
            error
        );

        redirectToAdminLogin();

        return false;

    }

}


/* =========================================================
   ADMIN LOGIN REDIRECT
   ========================================================= */

function redirectToAdminLogin() {

    const currentPage =
        window.location.pathname;

    if (
        currentPage.includes("login.html")
    ) {

        return;

    }


    window.location.href =
        "/login.html?admin=login_required";

}


/* =========================================================
   EVENTS
   ========================================================= */

function setupEvents() {

    const searchInput =
        $("#searchInput");

    const statusFilter =
        $("#statusFilter");

    const methodFilter =
        $("#methodFilter");

    const refreshBtn =
        $("#refreshBtn");

    const closeModal =
        $("#closeModal");

    const approveBtn =
        $("#approveBtn");

    const rejectBtn =
        $("#rejectBtn");

    const logoutBtn =
        $("#logoutBtn");

    const menuBtn =
        $("#menuBtn");

    const withdrawalModal =
        $("#withdrawalModal");


    if (searchInput) {

        searchInput.addEventListener(
            "input",
            applyFilters
        );

    }


    if (statusFilter) {

        statusFilter.addEventListener(
            "change",
            applyFilters
        );

    }


    if (methodFilter) {

        methodFilter.addEventListener(
            "change",
            applyFilters
        );

    }


    if (refreshBtn) {

        refreshBtn.addEventListener(
            "click",
            async () => {

                const authorized =
                    await checkAdminAuthentication();

                if (authorized) {

                    await loadWithdrawals();

                }

            }
        );

    }


    if (closeModal) {

        closeModal.addEventListener(
            "click",
            closeWithdrawalModal
        );

    }


    if (approveBtn) {

        approveBtn.addEventListener(
            "click",
            () =>
                processWithdrawal("approve")
        );

    }


    if (rejectBtn) {

        rejectBtn.addEventListener(
            "click",
            () =>
                processWithdrawal("reject")
        );

    }


    if (logoutBtn) {

        logoutBtn.addEventListener(
            "click",
            logoutAdmin
        );

    }


    if (menuBtn) {

        menuBtn.addEventListener(
            "click",
            toggleSidebar
        );

    }


    if (withdrawalModal) {

        withdrawalModal.addEventListener(
            "click",
            event => {

                if (
                    event.target ===
                    withdrawalModal
                ) {

                    closeWithdrawalModal();

                }

            }
        );

    }


    document.addEventListener(
        "keydown",
        event => {

            if (
                event.key === "Escape"
            ) {

                closeWithdrawalModal();

            }

        }
    );

}


/* =========================================================
   LOAD WITHDRAWALS
   ========================================================= */

async function loadWithdrawals() {

    setRefreshLoading(true);

    showTableLoading();


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


        const data =
            await parseJsonResponse(
                response
            );


        if (
            response.status === 401 ||
            response.status === 403
        ) {

            redirectToAdminLogin();

            return;

        }


        if (
            !response.ok ||
            !data ||
            data.success === false
        ) {

            throw new Error(
                data?.message ||
                `Unable to load withdrawals (${response.status}).`
            );

        }


        withdrawals =
            normalizeWithdrawalList(
                data
            );


        updateAdminDetails(
            data
        );


        updateStatistics();


        applyFilters();


    } catch (error) {

        console.error(
            "Withdrawal loading error:",
            error
        );


        withdrawals = [];

        filteredWithdrawals = [];


        updateStatistics();


        showTableError(
            getErrorMessage(error)
        );


        showToast(
            "Error",
            getErrorMessage(error),
            "error"
        );


    } finally {

        setRefreshLoading(false);

    }

}


/* =========================================================
   JSON RESPONSE
   ========================================================= */

async function parseJsonResponse(
    response
) {

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
   NORMALIZE BACKEND DATA
   ========================================================= */

function normalizeWithdrawalList(
    data
) {

    let list = [];


    if (Array.isArray(data)) {

        list = data;

    } else if (
        Array.isArray(
            data.withdrawals
        )
    ) {

        list =
            data.withdrawals;

    } else if (
        Array.isArray(data.data)
    ) {

        list =
            data.data;

    } else if (
        Array.isArray(data.results)
    ) {

        list =
            data.results;

    }


    return list.map(
        normalizeWithdrawal
    );

}


/* =========================================================
   NORMALIZE ONE WITHDRAWAL
   ========================================================= */

function normalizeWithdrawal(
    item
) {

    item = item || {};


    const customer =
        item.customer ||
        item.user ||
        {};


    const user =
        typeof customer === "object"
            ? customer
            : {};


    const id =
        item.withdrawal_id ??
        item.withdrawalId ??
        item.id ??
        item._id ??
        "";


    const customerName =
        item.customer_name ??
        item.full_name ??
        item.name ??
        user.full_name ??
        user.name ??
        [
            user.first_name,
            user.last_name
        ]
            .filter(Boolean)
            .join(" ") ??
        "Unknown Customer";


    const email =
        item.email ??
        user.email ??
        "";


    const phone =
        item.phone ??
        item.phone_number ??
        item.account_number ??
        item.mobile ??
        user.phone ??
        user.phone_number ??
        "";


    /*
    requested_amount:
    Amount requested by the customer.

    This is also the amount deducted from the
    customer's wallet when the withdrawal is approved.

    fee:
    20% withdrawal fee.

    payout_amount:
    Amount the customer receives after the fee.
    */


    let requestedAmount =
        toNumber(
            item.requested_amount ??
            item.amount ??
            item.withdrawal_amount ??
            0
        );


    let feeRate =
        toNumber(
            item.fee_rate ??
            WITHDRAWAL_FEE_RATE
        );


    /*
    If old records contain 0.10 but the current
    system is now 20%, display the current configured
    rate for pending/new withdrawals.
    */

    if (
        !Number.isFinite(feeRate) ||
        feeRate < 0
    ) {

        feeRate =
            WITHDRAWAL_FEE_RATE;

    }


    let fee =
        toNumber(
            item.fee ??
            item.withdrawal_fee ??
            0
        );


    let payoutAmount =
        toNumber(
            item.payout_amount ??
            item.net_amount ??
            0
        );


    /*
    Calculate missing fee/payout values.
    */

    if (
        fee <= 0 &&
        requestedAmount > 0
    ) {

        fee =
            Math.round(
                requestedAmount *
                feeRate
            );

    }


    if (
        payoutAmount <= 0 &&
        requestedAmount > 0
    ) {

        payoutAmount =
            requestedAmount -
            fee;

    }


    const status =
        String(
            item.status ??
            "pending"
        )
            .toLowerCase();


    const paymentMethod =
        normalizePaymentMethod(
            item.payment_method ??
            item.method ??
            item.paymentMethod ??
            ""
        );


    const payoutStatus =
        String(
            item.payout_status ??
            "not_paid"
        )
            .toLowerCase();


    const createdAt =
        item.created_at ??
        item.createdAt ??
        item.date ??
        "";


    const updatedAt =
        item.updated_at ??
        item.updatedAt ??
        "";


    const approvedAt =
        item.approved_at ??
        "";


    const rejectedAt =
        item.rejected_at ??
        "";


    return {

        raw: item,

        id: String(id),

        customerName:
            customerName ||
            "Unknown Customer",

        email:
            String(email || ""),

        phone:
            String(phone || ""),

        requestedAmount:
            requestedAmount,

        amount:
            requestedAmount,

        feeRate:
            feeRate,

        fee:
            fee,

        payoutAmount:
            payoutAmount,

        paymentMethod:
            paymentMethod,

        status:
            status,

        payoutStatus:
            payoutStatus,

        accountName:
            String(
                item.account_name ??
                item.accountName ??
                customerName ??
                ""
            ),

        account:
            String(
                item.account ??
                item.phone ??
                phone ??
                ""
            ),

        createdAt:
            createdAt,

        updatedAt:
            updatedAt,

        approvedAt:
            approvedAt,

        rejectedAt:
            rejectedAt,

        approvedBy:
            String(
                item.approved_by ??
                ""
            ),

        rejectionReason:
            String(
                item.rejection_reason ??
                ""
            )

    };

}


/* =========================================================
   NUMBER CONVERSION
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
                parseInt(
                    value.$numberInt,
                    10
                ) || 0
            );

        }

    }


    const number =
        parseFloat(
            String(value)
        );


    return Number.isFinite(number)
        ? number
        : 0;

}


/* =========================================================
   PAYMENT METHOD NORMALIZATION
   ========================================================= */

function normalizePaymentMethod(
    method
) {

    const value =
        String(
            method || ""
        )
            .trim()
            .toLowerCase();


    if (
        value.includes("mtn")
    ) {

        return "MTN";

    }


    if (
        value.includes("airtel")
    ) {

        return "Airtel";

    }


    return method
        ? String(method)
        : "Unknown";

}


/* =========================================================
   UPDATE ADMIN DETAILS
   ========================================================= */

function updateAdminDetails(data) {

    const admin =
        data.admin ||
        data.administrator ||
        data.admin_user ||
        {};


    const adminName =
        admin.name ||
        admin.full_name ||
        data.admin_name ||
        data.administrator_name ||
        "";


    const adminEmail =
        admin.email ||
        data.admin_email ||
        "";


    const nameElements =
        $all(
            "[data-admin-name]"
        );


    nameElements.forEach(
        element => {

            if (adminName) {

                element.textContent =
                    adminName;

            }

        }
    );


    const emailElements =
        $all(
            "[data-admin-email]"
        );


    emailElements.forEach(
        element => {

            if (adminEmail) {

                element.textContent =
                    adminEmail;

            }

        }
    );

}


/* =========================================================
   STATISTICS
   ========================================================= */

function updateStatistics() {

    const total =
        withdrawals.length;


    const pending =
        withdrawals.filter(
            withdrawal =>
                withdrawal.status ===
                "pending"
        ).length;


    const approved =
        withdrawals.filter(
            withdrawal =>
                withdrawal.status ===
                "approved"
        ).length;


    const rejected =
        withdrawals.filter(
            withdrawal =>
                withdrawal.status ===
                "rejected"
        ).length;


    const totalRequested =
        withdrawals.reduce(
            (
                total,
                withdrawal
            ) =>
                total +
                withdrawal.requestedAmount,
            0
        );


    const totalFees =
        withdrawals
            .filter(
                withdrawal =>
                    withdrawal.status ===
                    "approved"
            )
            .reduce(
                (
                    total,
                    withdrawal
                ) =>
                    total +
                    withdrawal.fee,
                0
            );


    const totalPayout =
        withdrawals
            .filter(
                withdrawal =>
                    withdrawal.status ===
                    "approved"
            )
            .reduce(
                (
                    total,
                    withdrawal
                ) =>
                    total +
                    withdrawal.payoutAmount,
                0
            );


    setText(
        "#totalWithdrawals",
        total
    );


    setText(
        "#pendingWithdrawals",
        pending
    );


    setText(
        "#approvedWithdrawals",
        approved
    );


    setText(
        "#rejectedWithdrawals",
        rejected
    );


    setText(
        "#totalRequested",
        formatUGX(
            totalRequested
        )
    );


    setText(
        "#totalFees",
        formatUGX(
            totalFees
        )
    );


    setText(
        "#totalPayout",
        formatUGX(
            totalPayout
        )
    );


    /*
    Support alternative IDs in case your
    HTML uses different statistic IDs.
    */

    setText(
        "#withdrawalCount",
        total
    );


    setText(
        "#pendingCount",
        pending
    );


    setText(
        "#approvedCount",
        approved
    );


    setText(
        "#rejectedCount",
        rejected
    );

}


/* =========================================================
   FILTERS
   ========================================================= */

function applyFilters() {

    const searchInput =
        $("#searchInput");


    const statusFilter =
        $("#statusFilter");


    const methodFilter =
        $("#methodFilter");


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
            "all"
        )
            .trim()
            .toLowerCase();


    const method =
        String(
            methodFilter?.value ||
            "all"
        )
            .trim()
            .toLowerCase();


    filteredWithdrawals =
        withdrawals.filter(
            withdrawal => {

                const searchableText =
                    [
                        withdrawal.id,
                        withdrawal.customerName,
                        withdrawal.email,
                        withdrawal.phone,
                        withdrawal.paymentMethod,
                        withdrawal.account,
                        withdrawal.status,
                        withdrawal.payoutStatus
                    ]
                        .join(" ")
                        .toLowerCase();


                const matchesSearch =
                    !search ||
                    searchableText.includes(
                        search
                    );


                const matchesStatus =
                    status === "all" ||
                    status === "" ||
                    withdrawal.status ===
                        status;


                const matchesMethod =
                    method === "all" ||
                    method === "" ||
                    withdrawal.paymentMethod
                        .toLowerCase() ===
                        method;


                return (
                    matchesSearch &&
                    matchesStatus &&
                    matchesMethod
                );

            }
        );


    renderWithdrawals();

}


/* =========================================================
   RENDER WITHDRAWALS
   ========================================================= */

function renderWithdrawals() {

    const tableBody =
        $(
            "#withdrawalsTableBody"
        ) ||
        $(
            "#withdrawalTableBody"
        ) ||
        $(
            "tbody"
        );


    if (!tableBody) {

        console.warn(
            "Withdrawal table body not found."
        );

        return;

    }


    if (
        filteredWithdrawals.length === 0
    ) {

        tableBody.innerHTML = `
            <tr>
                <td colspan="20" class="empty-state">
                    <div class="empty-withdrawals">
                        <div class="empty-icon">
                            💸
                        </div>

                        <h3>No withdrawals found</h3>

                        <p>
                            There are no withdrawal
                            requests matching your filters.
                        </p>
                    </div>
                </td>
            </tr>
        `;

        updateVisibleCount(0);

        return;

    }


    tableBody.innerHTML =
        filteredWithdrawals
            .map(
                withdrawal =>
                    createWithdrawalRow(
                        withdrawal
                    )
            )
            .join("");


    updateVisibleCount(
        filteredWithdrawals.length
    );


    /*
    Attach click events to review buttons.
    */

    $all(
        "[data-withdrawal-id]"
    ).forEach(
        button => {

            button.addEventListener(
                "click",
                () => {

                    const id =
                        button.getAttribute(
                            "data-withdrawal-id"
                        );


                    const withdrawal =
                        withdrawals.find(
                            item =>
                                item.id ===
                                id
                        );


                    if (withdrawal) {

                        openWithdrawalModal(
                            withdrawal
                        );

                    }

                }
            );

        }
    );

}


/* =========================================================
   CREATE WITHDRAWAL ROW
   ========================================================= */

function createWithdrawalRow(
    withdrawal
) {

    const status =
        withdrawal.status;


    const statusClass =
        getStatusClass(status);


    const methodClass =
        withdrawal.paymentMethod
            .toLowerCase()
            .replace(
                /[^a-z0-9]/g,
                "-"
            );


    const createdDate =
        formatDateTime(
            withdrawal.createdAt
        );


    return `
        <tr>

            <td>
                <span class="withdrawal-id">
                    ${escapeHTML(
                        shortId(
                            withdrawal.id
                        )
                    )}
                </span>
            </td>


            <td>
                <div class="customer-cell">

                    <strong>
                        ${escapeHTML(
                            withdrawal.customerName
                        )}
                    </strong>

                    ${
                        withdrawal.email
                            ? `
                                <small>
                                    ${escapeHTML(
                                        withdrawal.email
                                    )}
                                </small>
                            `
                            : ""
                    }

                </div>
            </td>


            <td>
                <span>
                    ${escapeHTML(
                        withdrawal.phone
                    )}
                </span>
            </td>


            <td>
                <span
                    class="payment-method ${methodClass}"
                >
                    ${escapeHTML(
                        withdrawal.paymentMethod
                    )}
                </span>
            </td>


            <td>
                <strong>
                    ${formatUGX(
                        withdrawal.requestedAmount
                    )}
                </strong>
            </td>


            <td>
                <span class="fee-amount">
                    ${formatUGX(
                        withdrawal.fee
                    )}
                </span>

                <small>
                    20%
                </small>
            </td>


            <td>
                <strong class="payout-amount">
                    ${formatUGX(
                        withdrawal.payoutAmount
                    )}
                </strong>
            </td>


            <td>
                <span
                    class="status-badge ${statusClass}"
                >
                    ${escapeHTML(
                        capitalize(
                            status
                        )
                    )}
                </span>
            </td>


            <td>
                <span
                    class="payout-status ${getPayoutStatusClass(
                        withdrawal.payoutStatus
                    )}"
                >
                    ${escapeHTML(
                        formatPayoutStatus(
                            withdrawal.payoutStatus
                        )
                    )}
                </span>
            </td>


            <td>
                ${escapeHTML(
                    createdDate
                )}
            </td>


            <td>

                <button
                    type="button"
                    class="review-btn"
                    data-withdrawal-id="${escapeAttribute(
                        withdrawal.id
                    )}"
                >
                    Review
                </button>

            </td>

        </tr>
    `;

}


/* =========================================================
   OPEN WITHDRAWAL MODAL
   ========================================================= */

function openWithdrawalModal(
    withdrawal
) {

    selectedWithdrawal =
        withdrawal;


    const modal =
        $("#withdrawalModal");


    if (!modal) {

        return;

    }


    setText(
        "#modalWithdrawalId",
        shortId(
            withdrawal.id
        )
    );


    setText(
        "#modalCustomerName",
        withdrawal.customerName
    );


    setText(
        "#modalCustomerEmail",
        withdrawal.email ||
        "Not provided"
    );


    setText(
        "#modalCustomerPhone",
        withdrawal.phone ||
        "Not provided"
    );


    setText(
        "#modalAccountName",
        withdrawal.accountName ||
        withdrawal.customerName ||
        "Not provided"
    );


    setText(
        "#modalAccount",
        withdrawal.account ||
        withdrawal.phone ||
        "Not provided"
    );


    setText(
        "#modalPaymentMethod",
        withdrawal.paymentMethod
    );


    setText(
        "#modalAmount",
        formatUGX(
            withdrawal.requestedAmount
        )
    );


    setText(
        "#modalFee",
        `${formatUGX(
            withdrawal.fee
        )} (20%)`
    );


    setText(
        "#modalPayoutAmount",
        formatUGX(
            withdrawal.payoutAmount
        )
    );


    setText(
        "#modalStatus",
        capitalize(
            withdrawal.status
        )
    );


    setText(
        "#modalPayoutStatus",
        formatPayoutStatus(
            withdrawal.payoutStatus
        )
    );


    setText(
        "#modalCreatedAt",
        formatDateTime(
            withdrawal.createdAt
        )
    );


    setText(
        "#modalApprovedAt",
        withdrawal.approvedAt
            ? formatDateTime(
                withdrawal.approvedAt
            )
            : "—"
    );


    const rejectionReason =
        $("#modalRejectionReason");


    if (rejectionReason) {

        rejectionReason.textContent =
            withdrawal.rejectionReason ||
            "—";

    }


    const approveBtn =
        $("#approveBtn");


    const rejectBtn =
        $("#rejectBtn");


    const pending =
        withdrawal.status ===
        "pending";


    if (approveBtn) {

        approveBtn.disabled =
            !pending;

        approveBtn.style.display =
            pending
                ? ""
                : "none";

    }


    if (rejectBtn) {

        rejectBtn.disabled =
            !pending;

        rejectBtn.style.display =
            pending
                ? ""
                : "none";

    }


    modal.classList.add(
        "active"
    );


    modal.classList.add(
        "show"
    );


    modal.removeAttribute(
        "aria-hidden"
    );


    document.body.classList.add(
        "modal-open"
    );

}


/* =========================================================
   CLOSE WITHDRAWAL MODAL
   ========================================================= */

function closeWithdrawalModal() {

    const modal =
        $("#withdrawalModal");


    if (!modal) {

        return;

    }


    modal.classList.remove(
        "active"
    );


    modal.classList.remove(
        "show"
    );


    modal.setAttribute(
        "aria-hidden",
        "true"
    );


    document.body.classList.remove(
        "modal-open"
    );


    selectedWithdrawal =
        null;

}


/* =========================================================
   PROCESS WITHDRAWAL
   ========================================================= */

async function processWithdrawal(
    action
) {

    if (!selectedWithdrawal) {

        showToast(
            "Error",
            "Please select a withdrawal first.",
            "error"
        );

        return;

    }


    if (
        selectedWithdrawal.status !==
        "pending"
    ) {

        showToast(
            "Already processed",
            "This withdrawal is no longer pending.",
            "error"
        );

        return;

    }


    const actionText =
        action === "approve"
            ? "approve"
            : "reject";


    let confirmationMessage;


    if (
        action === "approve"
    ) {

        confirmationMessage =
            `Approve this withdrawal?\n\n` +
            `Requested: ${formatUGX(
                selectedWithdrawal.requestedAmount
            )}\n` +
            `Withdrawal fee: ${formatUGX(
                selectedWithdrawal.fee
            )} (20%)\n` +
            `Customer payout: ${formatUGX(
                selectedWithdrawal.payoutAmount
            )}\n\n` +
            `The customer's balance will be deducted ` +
            `by the requested amount.\n\n` +
            `The