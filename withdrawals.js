const API_BASE = "https://crown-cash1.onrender.com";


// ======================================================
// ELEMENTS
// ======================================================

const loadingState =
    document.getElementById("loadingState");

const emptyState =
    document.getElementById("emptyState");

const withdrawalsList =
    document.getElementById("withdrawalsList");

const pageMessage =
    document.getElementById("pageMessage");

const availableBalance =
    document.getElementById("availableBalance");

const registeredPhone =
    document.getElementById("registeredPhone");

const totalRequested =
    document.getElementById("totalRequested");

const totalFees =
    document.getElementById("totalFees");

const totalPayout =
    document.getElementById("totalPayout");

const pendingCount =
    document.getElementById("pendingCount");

const withdrawalCount =
    document.getElementById("withdrawalCount");

const searchInput =
    document.getElementById("searchInput");

const statusFilter =
    document.getElementById("statusFilter");

const methodFilter =
    document.getElementById("methodFilter");

const detailsModal =
    document.getElementById("detailsModal");

const closeModal =
    document.getElementById("closeModal");

const modalCloseButton =
    document.getElementById("modalCloseButton");

const modalStatus =
    document.getElementById("modalStatus");

const modalRequested =
    document.getElementById("modalRequested");

const modalFee =
    document.getElementById("modalFee");

const modalPayout =
    document.getElementById("modalPayout");

const modalMethod =
    document.getElementById("modalMethod");

const modalPhone =
    document.getElementById("modalPhone");

const modalDate =
    document.getElementById("modalDate");

const modalPayoutStatus =
    document.getElementById("modalPayoutStatus");

const modalPayoutStatusRow =
    document.getElementById("modalPayoutStatusRow");

const modalRejectionRow =
    document.getElementById("modalRejectionRow");

const modalRejectionReason =
    document.getElementById("modalRejectionReason");


// ======================================================
// DATA
// ======================================================

let allWithdrawals = [];


// ======================================================
// MONEY FORMAT
// ======================================================

function formatMoney(value) {

    const amount =
        Number(value) || 0;

    return new Intl.NumberFormat("en-UG", {
        maximumFractionDigits: 0
    }).format(amount);

}


// ======================================================
// ESCAPE HTML
// ======================================================

function escapeHTML(value) {

    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");

}


// ======================================================
// SHOW MESSAGE
// ======================================================

function showMessage(message, type = "error") {

    if (!pageMessage) {
        return;
    }

    pageMessage.textContent = message;

    pageMessage.className =
        `page-message ${type}`;

}


// ======================================================
// HIDE MESSAGE
// ======================================================

function hideMessage() {

    if (!pageMessage) {
        return;
    }

    pageMessage.textContent = "";

    pageMessage.className =
        "page-message";

}


// ======================================================
// NORMALIZE METHOD
// ======================================================

function normalizeMethod(method) {

    const value =
        String(method || "")
            .trim()
            .toLowerCase();

    if (value === "mtn") {
        return "MTN";
    }

    if (value === "airtel") {
        return "Airtel";
    }

    return method || "Unknown";

}


// ======================================================
// METHOD CLASS
// ======================================================

function getMethodClass(method) {

    const value =
        String(method || "")
            .trim()
            .toLowerCase();

    if (value === "mtn") {
        return "mtn";
    }

    if (value === "airtel") {
        return "airtel";
    }

    return "";
}


// ======================================================
// NORMALIZE STATUS
// ======================================================

function normalizeStatus(status) {

    const value =
        String(status || "pending")
            .trim()
            .toLowerCase();

    if (
        value === "approved" ||
        value === "rejected" ||
        value === "pending"
    ) {
        return value;
    }

    return "pending";

}


// ======================================================
// STATUS LABEL
// ======================================================

function statusLabel(status) {

    switch (normalizeStatus(status)) {

        case "approved":
            return "Approved";

        case "rejected":
            return "Rejected";

        default:
            return "Pending";

    }

}


// ======================================================
// PAYOUT STATUS LABEL
// ======================================================

function payoutStatusLabel(status) {

    const value =
        String(status || "not_paid")
            .trim()
            .toLowerCase();

    switch (value) {

        case "paid":
            return "Paid";

        case "awaiting_payout":
            return "Awaiting Payout";

        case "processing":
            return "Processing";

        case "failed":
            return "Payout Failed";

        default:
            return "Not Paid";

    }

}


// ======================================================
// DATE FORMAT
// ======================================================

function formatDate(dateValue) {

    if (!dateValue) {
        return "Date unavailable";
    }

    const date =
        new Date(dateValue);

    if (Number.isNaN(date.getTime())) {
        return String(dateValue);
    }

    return date.toLocaleString(
        "en-UG",
        {
            year: "numeric",
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit"
        }
    );

}


// ======================================================
// LOAD WITHDRAWALS
// ======================================================

async function loadWithdrawals() {

    hideMessage();

    showLoading();


    try {

        const response =
            await fetch(
                `${API_BASE}/withdrawals.php`,
                {
                    method: "GET",

                    credentials: "include",

                    cache: "no-store",

                    headers: {
                        "Accept":
                            "application/json"
                    }
                }
            );


        if (response.status === 401) {

            window.location.href =
                "/login.html?redirect=withdrawals";

            return;

        }


        let data = null;


        try {

            data =
                await response.json();

        } catch (error) {

            throw new Error(
                "The server returned an invalid response."
            );

        }


        if (
            !response.ok ||
            !data ||
            data.success !== true
        ) {

            throw new Error(
                data?.message ||
                "Unable to load withdrawal history."
            );

        }


        // ----------------------------------------------
        // Account information
        // ----------------------------------------------

        const user =
            data.user || {};


        if (availableBalance) {

            availableBalance.textContent =
                `UGX ${formatMoney(user.balance)}`;

        }


        if (registeredPhone) {

            registeredPhone.textContent =
                user.phone ||
                "No registered phone";

        }


        // ----------------------------------------------
        // Withdrawals
        // ----------------------------------------------

        allWithdrawals =
            Array.isArray(data.withdrawals)
                ? data.withdrawals
                : [];


        // ----------------------------------------------
        // Summary
        // ----------------------------------------------

        const summary =
            data.summary || {};


        if (totalRequested) {

            totalRequested.textContent =
                `UGX ${formatMoney(
                    summary.total_requested
                )}`;

        }


        if (totalFees) {

            totalFees.textContent =
                `UGX ${formatMoney(
                    summary.total_fees
                )}`;

        }


        if (totalPayout) {

            totalPayout.textContent =
                `UGX ${formatMoney(
                    summary.total_payout
                )}`;

        }


        if (pendingCount) {

            pendingCount.textContent =
                String(
                    Number(summary.pending_count) || 0
                );

        }


        renderWithdrawals();


    } catch (error) {

        console.error(
            "Withdrawal history error:",
            error
        );


        allWithdrawals = [];

        hideLoading();

        if (withdrawalsList) {
            withdrawalsList.innerHTML = "";
        }

        if (emptyState) {
            emptyState.hidden = true;
        }

        showMessage(
            error.message ||
            "Unable to load your withdrawal history. Please try again.",
            "error"
        );

    }

}


// ======================================================
// SHOW LOADING
// ======================================================

function showLoading() {

    if (loadingState) {
        loadingState.hidden = false;
    }

    if (emptyState) {
        emptyState.hidden = true;
    }

}


// ======================================================
// HIDE LOADING
// ======================================================

function hideLoading() {

    if (loadingState) {
        loadingState.hidden = true;
    }

}


// ======================================================
// FILTER WITHDRAWALS
// ======================================================

function getFilteredWithdrawals() {

    const search =
        String(searchInput?.value || "")
            .trim()
            .toLowerCase();


    const selectedStatus =
        String(statusFilter?.value || "all")
            .toLowerCase();


    const selectedMethod =
        String(methodFilter?.value || "all")
            .toLowerCase();


    return allWithdrawals.filter(
        function (withdrawal) {

            const status =
                normalizeStatus(
                    withdrawal.status
                );


            const method =
                String(
                    withdrawal.payment_method || ""
                )
                    .trim()
                    .toLowerCase();


            const searchText =
                [
                    withdrawal.id,
                    withdrawal.requested_amount,
                    withdrawal.amount,
                    withdrawal.fee,
                    withdrawal.payout_amount,
                    withdrawal.phone,
                    withdrawal.payment_method,
                    withdrawal.status,
                    withdrawal.payout_status,
                    withdrawal.created_at
                ]
                    .join(" ")
                    .toLowerCase();


            const matchesSearch =
                !search ||
                searchText.includes(search);


            const matchesStatus =
                selectedStatus === "all" ||
                status === selectedStatus;


            const matchesMethod =
                selectedMethod === "all" ||
                method === selectedMethod;


            return (
                matchesSearch &&
                matchesStatus &&
                matchesMethod
            );

        }
    );

}


// ======================================================
// RENDER WITHDRAWALS
// ======================================================

function renderWithdrawals() {

    hideLoading();

    const filtered =
        getFilteredWithdrawals();


    if (withdrawalCount) {

        withdrawalCount.textContent =
            `${filtered.length} ${
                filtered.length === 1
                    ? "request"
                    : "requests"
            }`;

    }


    if (!allWithdrawals.length) {

        if (withdrawalsList) {
            withdrawalsList.innerHTML = "";
        }

        if (emptyState) {
            emptyState.hidden = false;
        }

        return;

    }


    if (!filtered.length) {

        if (emptyState) {
            emptyState.hidden = true;
        }


        if (withdrawalsList) {

            withdrawalsList.innerHTML = `

                <div class="empty-state">

                    <div class="empty-icon">
                        🔎
                    </div>

                    <h2>
                        No Matching Withdrawals
                    </h2>

                    <p>
                        No withdrawal request matches
                        your current search or filters.
                    </p>

                </div>

            `;

        }

        return;

    }


    if (emptyState) {
        emptyState.hidden = true;
    }


    if (!withdrawalsList) {
        return;
    }


    withdrawalsList.innerHTML =
        filtered
            .map(
                function (withdrawal) {

                    return createWithdrawalCard(
                        withdrawal
                    );

                }
            )
            .join("");


    attachDetailsButtons();

}


// ======================================================
// CREATE WITHDRAWAL CARD
// ======================================================

function createWithdrawalCard(withdrawal) {

    const method =
        normalizeMethod(
            withdrawal.payment_method
        );


    const methodClass =
        getMethodClass(
            withdrawal.payment_method
        );


    const status =
        normalizeStatus(
            withdrawal.status
        );


    const statusText =
        statusLabel(status);


    const requested =
        Number(
            withdrawal.requested_amount ??
            withdrawal.amount ??
            0
        );


    const fee =
        Number(
            withdrawal.fee ??
            requested * 0.20
        );


    const payout =
        Number(
            withdrawal.payout_amount ??
            requested - fee
        );


    const phone =
        withdrawal.phone ||
        withdrawal.account_number ||
        "—";


    const payoutStatus =
        String(
            withdrawal.payout_status ||
            "not_paid"
        )
            .toLowerCase();


    const payoutStatusText =
        payoutStatusLabel(
            payoutStatus
        );


    const createdAt =
        formatDate(
            withdrawal.created_at
        );


    const safeId =
        escape