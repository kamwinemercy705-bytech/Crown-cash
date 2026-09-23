"use strict";

const API_BASE = "https://crown-cash1.onrender.com";

const WITHDRAWALS_API = `${API_BASE}/withdrawals.php`;
const PROFILE_API = `${API_BASE}/profile.php`;


// ======================================================
// ELEMENTS
// ======================================================

const loadingState = document.getElementById("loadingState");
const emptyState = document.getElementById("emptyState");
const withdrawalsList = document.getElementById("withdrawalsList");
const pageMessage = document.getElementById("pageMessage");

const availableBalance = document.getElementById("availableBalance");
const registeredPhone = document.getElementById("registeredPhone");

const totalRequested = document.getElementById("totalRequested");
const totalFees = document.getElementById("totalFees");
const totalPayout = document.getElementById("totalPayout");
const pendingCount = document.getElementById("pendingCount");
const withdrawalCount = document.getElementById("withdrawalCount");

const searchInput = document.getElementById("searchInput");
const statusFilter = document.getElementById("statusFilter");
const methodFilter = document.getElementById("methodFilter");

const detailsModal = document.getElementById("detailsModal");
const closeModal = document.getElementById("closeModal");
const modalCloseButton = document.getElementById("modalCloseButton");

const modalStatus = document.getElementById("modalStatus");
const modalRequested = document.getElementById("modalRequested");
const modalFee = document.getElementById("modalFee");
const modalPayout = document.getElementById("modalPayout");
const modalMethod = document.getElementById("modalMethod");
const modalPhone = document.getElementById("modalPhone");
const modalDate = document.getElementById("modalDate");
const modalPayoutStatus = document.getElementById("modalPayoutStatus");
const modalPayoutStatusRow = document.getElementById("modalPayoutStatusRow");
const modalRejectionRow = document.getElementById("modalRejectionRow");
const modalRejectionReason = document.getElementById("modalRejectionReason");


// ======================================================
// DATA
// ======================================================

let allWithdrawals = [];


// ======================================================
// MONEY
// ======================================================

function formatMoney(value) {
    const amount = Number(value) || 0;

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
// MESSAGE
// ======================================================

function showMessage(message, type = "error") {
    if (!pageMessage) return;

    pageMessage.textContent = message;
    pageMessage.className = `page-message ${type}`;
}

function hideMessage() {
    if (!pageMessage) return;

    pageMessage.textContent = "";
    pageMessage.className = "page-message";
}


// ======================================================
// METHOD
// ======================================================

function normalizeMethod(method) {
    const value = String(method || "")
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


function getMethodClass(method) {
    const value = String(method || "")
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
// STATUS
// ======================================================

function normalizeStatus(status) {
    const value = String(status || "pending")
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
// PAYOUT STATUS
// ======================================================

function payoutStatusLabel(status) {
    const value = String(status || "not_paid")
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
// DATE
// ======================================================

function formatDate(dateValue) {
    if (!dateValue) {
        return "Date unavailable";
    }

    let value = dateValue;

    // MongoDB extended JSON support
    if (
        typeof value === "object" &&
        value !== null &&
        "$date" in value
    ) {
        value = value.$date;
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return String(value);
    }

    return date.toLocaleString("en-UG", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit"
    });
}


// ======================================================
// LOADING
// ======================================================

function showLoading() {
    if (loadingState) {
        loadingState.hidden = false;
    }

    if (emptyState) {
        emptyState.hidden = true;
    }

    if (withdrawalsList) {
        withdrawalsList.innerHTML = "";
    }
}


function hideLoading() {
    if (loadingState) {
        loadingState.hidden = true;
    }
}


// ======================================================
// LOAD PROFILE
// ======================================================

async function loadProfile() {
    try {
        const response = await fetch(PROFILE_API, {
            method: "GET",
            credentials: "include",
            cache: "no-store",
            headers: {
                "Accept": "application/json"
            }
        });

        if (response.status === 401) {
            window.location.href =
                "/login.html?redirect=withdrawals.html";

            return null;
        }

        const data = await response.json();

        if (!response.ok || !data.success) {
            throw new Error(
                data.message || "Unable to load account information."
            );
        }

        const user = data.user || {};

        if (availableBalance) {
            availableBalance.textContent =
                `UGX ${formatMoney(user.balance)}`;
        }

        if (registeredPhone) {
            registeredPhone.textContent =
                user.phone ||
                user.phone_number ||
                user.mobile ||
                "No registered phone";
        }

        return user;

    } catch (error) {

        console.error("Profile loading error:", error);

        if (registeredPhone) {
            registeredPhone.textContent = "Unable to load";
        }

        return null;
    }
}


// ======================================================
// LOAD WITHDRAWALS
// ======================================================

async function loadWithdrawals() {

    hideMessage();
    showLoading();

    try {

        const response = await fetch(
            WITHDRAWALS_API,
            {
                method: "GET",
                credentials: "include",
                cache: "no-store",
                headers: {
                    "Accept": "application/json"
                }
            }
        );


        if (response.status === 401) {

            window.location.href =
                "/login.html?redirect=withdrawals.html";

            return;
        }


        let data;

        try {
            data = await response.json();
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


        // ==============================================
        // USER
        // ==============================================

        const user = data.user || {};

        if (availableBalance) {
            availableBalance.textContent =
                `UGX ${formatMoney(
                    user.balance ??
                    user.wallet_balance ??
                    0
                )}`;
        }

        if (registeredPhone) {
            registeredPhone.textContent =
                user.phone ||
                user.phone_number ||
                user.mobile ||
                "No registered phone";
        }


        // ==============================================
        // WITHDRAWALS
        // ==============================================

        allWithdrawals =
            Array.isArray(data.withdrawals)
                ? data.withdrawals
                : [];


        // ==============================================
        // SUMMARY
        // ==============================================

        const summary = data.summary || {};


        if (totalRequested) {
            totalRequested.textContent =
                `UGX ${formatMoney(
                    summary.total_requested ?? 0
                )}`;
        }


        if (totalFees) {
            totalFees.textContent =
                `UGX ${formatMoney(
                    summary.total_fees ?? 0
                )}`;
        }


        if (totalPayout) {
            totalPayout.textContent =
                `UGX ${formatMoney(
                    summary.total_payout ??
                    summary.total_received ??
                    0
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
// FILTER
// ======================================================

function getFilteredWithdrawals() {

    const search =
        String(searchInput?.value || "")
            .trim()
            .toLowerCase();


    const selectedStatus =
        String(statusFilter?.value || "all")
            .trim()
            .toLowerCase();


    const selectedMethod =
        String(methodFilter?.value || "all")
            .trim()
            .toLowerCase();


    return allWithdrawals.filter(
        withdrawal => {

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


            const searchText = [
                withdrawal.id,
                withdrawal._id,
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
// RENDER
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


    // ==============================================
    // NO WITHDRAWALS
    // ==============================================

    if (!allWithdrawals.length) {

        if (withdrawalsList) {
            withdrawalsList.innerHTML = "";
        }

        if (emptyState) {
            emptyState.hidden = false;
        }

        return;
    }


    // ==============================================
    // NO FILTER RESULTS
    // ==============================================

    if (!filtered.length) {

        if (emptyState) {
            emptyState.hidden = true;
        }

        if (withdrawalsList) {

            withdrawalsList.innerHTML = `
                <div class="empty-state">

                    <div class="empty-icon">
                        <svg viewBox="0 0 24 24" fill="none">
                            <circle
                                cx="11"
                                cy="11"
                                r="6.5"
                                stroke="currentColor"
                                stroke-width="1.8"
                            />
                            <path
                                d="M16 16L20 20"
                                stroke="currentColor"
                                stroke-width="1.8"
                                stroke-linecap="round"
                            />
                        </svg>
                    </div>

                    <h2>No Matching Withdrawals</h2>

                    <p>
                        No withdrawal request matches
                        your current search or filters.
                    </p>

                </div>
            `;
        }

        return;
    }


    // ==============================================
    // SHOW RESULTS
    // ==============================================

    if (emptyState) {
        emptyState.hidden = true;
    }


    if (!withdrawalsList) {
        return;
    }


    withdrawalsList.innerHTML =
        filtered
            .map(createWithdrawalCard)
            .join("");


    attachDetailsButtons();
}


// ======================================================
// WITHDRAWAL CARD
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
            .trim()
            .toLowerCase();


    const payoutStatusText =
        payoutStatusLabel(
            payoutStatus
        );


    const createdAt =
        formatDate(
            withdrawal.created_at
        );


    const withdrawalId =
        withdrawal.id ||
        withdrawal._id ||
        "";


    const safeId =
        escapeHTML(
            withdrawalId
        );


    const safePhone =
        escapeHTML(
            phone
        );


    const rejectionReason =
        withdrawal.rejection_reason ||
        withdrawal.reason ||
        "";


    const safeReason =
        escapeHTML(
            rejectionReason
        );


    return `

        <article
            class="withdrawal-card"
            data-id="${safeId}"
        >

            <div class="withdrawal-card-main">


                <!-- METHOD ICON -->

                <div class="withdrawal-method-icon ${methodClass}">

                    <svg viewBox="0 0 24 24" fill="none">

                        <rect
                            x="4"
                            y="6"
                            width="16"
                            height="13"
                            rx="2"
                            stroke="currentColor"
                            stroke-width="1.8"
                        />

                        <path
                            d="M8 10H16"
                            stroke="currentColor"
                            stroke-width="1.8"
                            stroke-linecap="round"
                        />

                        <path
                            d="M12 13V17"
                            stroke="currentColor"
                            stroke-width="1.8"
                            stroke-linecap="round"
                        />

                    </svg>

                </div>


                <!-- MAIN DETAILS -->

                <div class="withdrawal-main-details">

                    <div class="withdrawal-top-row">

                        <div>

                            <h3>
                                ${escapeHTML(method)}
                                Withdrawal
                            </h3>

                            <span class="withdrawal-date">
                                ${escapeHTML(createdAt)}
                            </span>

                        </div>


                        <span class="status-badge status-${status}">
                            ${escapeHTML(statusText)}
                        </span>

                    </div>


                    <div class="withdrawal-amount">

                        <span>Requested</span>

                        <strong>
                            UGX ${formatMoney(requested)}
                        </strong>

                    </div>


                    <div class="withdrawal-meta">

                        <span>
                            ${escapeHTML(safePhone)}
                        </span>

                        <span>
                            Fee:
                            UGX ${formatMoney(fee)}
                        </span>

                        <span>
                            Receive:
                            UGX ${formatMoney(payout)}
                        </span>

                    </div>


                    ${
                        status === "approved"
                            ? `
                                <div class="payout-status">
                                    <span>
                                        Payout
                                    </span>

                                    <strong>
                                        ${escapeHTML(
                                            payoutStatusText
                                        )}
                                    </strong>
                                </div>
                            `
                            : ""
                    }


                    ${
                        status === "rejected" &&
                        rejectionReason
                            ? `
                                <div class="rejection-note">
                                    ${safeReason}
                                </div>
                            `
                            : ""
                    }

                </div>


                <!-- DETAILS -->

                <button
                    type="button"
                    class="details-button"
                    data-withdrawal-id="${safeId}"
                >
                    View Details
                </button>

            </div>

        </article>

    `;
}


// ======================================================
// DETAILS BUTTONS
// ======================================================

function attachDetailsButtons() {

    const buttons =
        document.querySelectorAll(
            "[data-withdrawal-id]"
        );


    buttons.forEach(button => {

        button.addEventListener(
            "click",
            function () {

                const id =
                    this.dataset.withdrawalId;

                openWithdrawalDetails(id);
            }
        );

    });
}


// ======================================================
// OPEN DETAILS
// ======================================================

function openWithdrawalDetails(id) {

    const withdrawal =
        allWithdrawals.find(
            item =>
                String(
                    item.id ||
                    item._id ||
                    ""
                ) === String(id)
        );


    if (!withdrawal) {
        return;
    }


    const status =
        normalizeStatus(
            withdrawal.status
        );


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


    const method =
        normalizeMethod(
            withdrawal.payment_method
        );


    const phone =
        withdrawal.phone ||
        withdrawal.account_number ||
        "—";


    if (modalStatus) {
        modalStatus.textContent =
            statusLabel(status);

        modalStatus.className =
            `modal-status status-${status}`;
    }


    if (modalRequested) {
        modalRequested.textContent =
            `UGX ${formatMoney(requested)}`;
    }


    if (modalFee) {
        modalFee.textContent =
            `UGX ${formatMoney(fee)}`;
    }


    if (modalPayout) {
        modalPayout.textContent =
            `UGX ${formatMoney(payout)}`;
    }


    if (modalMethod) {
        modalMethod.textContent =
            method;
    }


    if (modalPhone) {
        modalPhone.textContent =
            phone;
    }


    if (modalDate) {
        modalDate.textContent =
            formatDate(
                withdrawal.created_at
            );
    }


    const payoutStatus =
        String(
            withdrawal.payout_status ||
            "not_paid"
        )
            .toLowerCase();


    if (modalPayoutStatus) {
        modalPayoutStatus.textContent =
            payoutStatusLabel(
                payoutStatus
            );
    }


    if (modalPayoutStatusRow) {
        modalPayoutStatusRow.hidden =
            status !== "approved";
    }


    const reason =
        withdrawal.rejection_reason ||
        withdrawal.reason ||
        "";


    if (modalRejectionReason) {
        modalRejectionReason.textContent =
            reason ||
            "No rejection reason provided.";
    }


    if (modalRejectionRow) {
        modalRejectionRow.hidden =
            status !== "rejected";
    }


    if (detailsModal) {

        detailsModal.hidden = false;

        detailsModal.classList.add("open");

        document.body.classList.add(
            "modal-open"
        );
    }
}


// ======================================================
// CLOSE MODAL
// ======================================================

function closeDetailsModal() {

    if (!detailsModal) {
        return;
    }

    detailsModal.classList.remove("open");

    detailsModal.hidden = true;

    document.body.classList.remove(
        "modal-open"
    );
}


if (closeModal) {
    closeModal.addEventListener(
        "click",
        closeDetailsModal
    );
}


if (modalCloseButton) {
    modalCloseButton.addEventListener(
        "click",
        closeDetailsModal
    );
}


if (detailsModal) {

    detailsModal.addEventListener(
        "click",
        event => {

            if (
                event.target ===
                detailsModal
            ) {
                closeDetailsModal();
            }

        }
    );
}


document.addEventListener(
    "keydown",
    event => {

        if (event.key === "Escape") {
            closeDetailsModal();
        }

    }
);


// ======================================================
// FILTER EVENTS
// ======================================================

if (searchInput) {

    searchInput.addEventListener(
        "input",
        renderWithdrawals
    );

}


if (statusFilter) {

    statusFilter.addEventListener(
        "change",
        renderWithdrawals
    );

}


if (methodFilter) {

    methodFilter.addEventListener(
        "change",
        renderWithdrawals
    );

}


// ======================================================
// MOBILE SIDEBAR
// ======================================================

const sidebar =
    document.getElementById("sidebar");

const sidebarOverlay =
    document.getElementById("sidebarOverlay");

const sidebarClose =
    document.getElementById("sidebarClose");

const menuButton =
    document.getElementById("menuButton");


function openSidebar() {

    if (sidebar) {
        sidebar.classList.add("open");
    }

    if (sidebarOverlay) {
        sidebarOverlay.classList.add("show");
    }

    document.body.classList.add(
        "sidebar-open"
    );
}


function closeSidebar() {

    if (sidebar) {
        sidebar.classList.remove("open");
    }

    if (sidebarOverlay) {
        sidebarOverlay.classList.remove("show");
    }

    document.body.classList.remove(
        "sidebar-open"
    );
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


if (sidebarOverlay) {
    sidebarOverlay.addEventListener(
        "click",
        closeSidebar
    );
}


// ======================================================
// START PAGE
// ======================================================

document.addEventListener(
    "DOMContentLoaded",
    async function () {

        console.log(
            "Crown Cash withdrawals page started."
        );


        // Load profile independently.
        // This prevents the phone section from
        // remaining stuck if withdrawal history
        // has another problem.

        await loadProfile();


        // Load withdrawal history.

        await loadWithdrawals();

    }
);