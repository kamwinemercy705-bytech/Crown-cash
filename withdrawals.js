const API_BASE = "https://crown-cash1.onrender.com";

const PROFILE_API = `${API_BASE}/profile.php`;
const WITHDRAWALS_API = `${API_BASE}/withdrawals.php`;


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


// ======================================================
// MODAL ELEMENTS
// ======================================================

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

    return "unknown";

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
// SAFE API JSON
// ======================================================

async function getJSON(url) {

    const response =
        await fetch(
            url,
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
            "/login.html?redirect=withdrawals";

        throw new Error(
            "Your session has expired."
        );

    }


    let data;

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
            "Unable to load information."
        );

    }


    return data;

}


// ======================================================
// LOAD PROFILE
// ======================================================

async function loadProfile() {

    try {

        const data =
            await getJSON(PROFILE_API);


        const user =
            data.user || {};


        // ----------------------------------------------
        // BALANCE
        // ----------------------------------------------

        const balance =
            user.balance ??
            user.wallet_balance ??
            0;


        if (availableBalance) {

            availableBalance.textContent =
                `UGX ${formatMoney(balance)}`;

        }


        // ----------------------------------------------
        // PHONE
        // ----------------------------------------------

        const phone =
            user.phone ||
            user.phone_number ||
            user.mobile ||
            "";


        if (registeredPhone) {

            registeredPhone.textContent =
                phone || "No registered phone";

        }


        return user;

    } catch (error) {

        console.error(
            "Profile loading error:",
            error
        );


        if (availableBalance) {

            availableBalance.textContent =
                "UGX 0";

        }


        if (registeredPhone) {

            registeredPhone.textContent =
                "Unable to load";

        }


        throw error;

    }

}


// ======================================================
// LOAD WITHDRAWALS
// ======================================================

async function loadWithdrawals() {

    hideMessage();

    showLoading();


    try {

        /*
         * Load both APIs independently.
         *
         * profile.php:
         * - balance
         * - registered phone
         *
         * withdrawals.php:
         * - withdrawal history
         * - summary
         */

        const profilePromise =
            loadProfile()
                .catch(
                    function(error) {

                        console.error(
                            "Profile API failed:",
                            error
                        );

                        return null;

                    }
                );


        const withdrawalsPromise =
            getJSON(WITHDRAWALS_API);


        const results =
            await Promise.allSettled([
                profilePromise,
                withdrawalsPromise
            ]);


        const withdrawalResult =
            results[1];


        if (
            withdrawalResult.status !==
            "fulfilled"
        ) {

            throw (
                withdrawalResult.reason ||
                new Error(
                    "Unable to load withdrawal history."
                )
            );

        }


        const data =
            withdrawalResult.value;


        // ----------------------------------------------
        // ACCOUNT INFORMATION FROM WITHDRAWALS API
        // ----------------------------------------------

        const user =
            data.user || {};


        /*
         * Only replace profile information if the
         * withdrawal API actually returned it.
         */

        if (
            availableBalance &&
            (
                user.balance !== undefined ||
                user.wallet_balance !== undefined
            )
        ) {

            const balance =
                user.balance ??
                user.wallet_balance ??
                0;


            availableBalance.textContent =
                `UGX ${formatMoney(balance)}`;

        }


        if (
            registeredPhone &&
            (
                user.phone ||
                user.phone_number ||
                user.mobile
            )
        ) {

            registeredPhone.textContent =
                user.phone ||
                user.phone_number ||
                user.mobile;

        }


        // ----------------------------------------------
        // WITHDRAWALS
        // ----------------------------------------------

        allWithdrawals =
            Array.isArray(data.withdrawals)
                ? data.withdrawals
                : [];


        // ----------------------------------------------
        // SUMMARY
        // ----------------------------------------------

        const summary =
            data.summary || {};


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
                    summary.total_payout ?? 0
                )}`;

        }


        if (pendingCount) {

            pendingCount.textContent =
                String(
                    Number(
                        summary.pending_count
                    ) || 0
                );

        }


        // ----------------------------------------------
        // RENDER
        // ----------------------------------------------

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
        function(withdrawal) {

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
                    withdrawal._id,
                    withdrawal.reference,
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


    // ----------------------------------------------
    // REQUEST COUNT
    // ----------------------------------------------

    if (withdrawalCount) {

        withdrawalCount.textContent =
            `${filtered.length} ${
                filtered.length === 1
                    ? "request"
                    : "requests"
            }`;

    }


    // ----------------------------------------------
    // NO WITHDRAWALS AT ALL
    // ----------------------------------------------

    if (!allWithdrawals.length) {

        if (withdrawalsList) {
            withdrawalsList.innerHTML = "";
        }

        if (emptyState) {
            emptyState.hidden = false;
        }

        return;

    }


    // ----------------------------------------------
    // NO MATCHING RESULTS
    // ----------------------------------------------

    if (!filtered.length) {

        if (emptyState) {
            emptyState.hidden = true;
        }


        if (withdrawalsList) {

            withdrawalsList.innerHTML = `

                <div class="filtered-empty">

                    <div class="filtered-empty-icon">

                        <svg
                            viewBox="0 0 24 24"
                            fill="none"
                            aria-hidden="true"
                        >

                            <circle
                                cx="11"
                                cy="11"
                                r="6"
                                stroke="currentColor"
                                stroke-width="1.8"
                            />

                            <path
                                d="M16 16L21 21"
                                stroke="currentColor"
                                stroke-width="1.8"
                                stroke-linecap="round"
                            />

                        </svg>

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
                function(withdrawal) {

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


    const id =
        withdrawal.id ||
        withdrawal._id ||
        withdrawal.reference ||
        "";


    const safeId =
        escapeHTML(id);


    const reference =
        withdrawal.reference ||
        withdrawal.withdrawal_id ||
        id ||
        "Withdrawal";


    const safeReference =
        escapeHTML(reference);


    const safePhone =
        escapeHTML(phone);


    const statusText =
        statusLabel(status);


    return `

        <article
            class="withdrawal-card"
            data-withdrawal-id="${safeId}"
        >

            <div class="withdrawal-card-top">

                <div class="withdrawal-method">

                    <div
                        class="method-icon ${methodClass}"
                    >

                        <svg
                            viewBox="0 0 24 24"
                            fill="none"
                            aria-hidden="true"
                        >

                            <path
                                d="M5 8H19"
                                stroke="currentColor"
                                stroke-width="1.8"
                                stroke-linecap="round"
                            />

                            <rect
                                x="4"
                                y="5"
                                width="16"
                                height="14"
                                rx="2"
                                stroke="currentColor"
                                stroke-width="1.8"
                            />

                            <path
                                d="M8 13H12"
                                stroke="currentColor"
                                stroke-width="1.8"
                                stroke-linecap="round"
                            />

                        </svg>

                    </div>


                    <div>

                        <strong>
                            ${escapeHTML(method)}
                        </strong>

                        <span>
                            ${safePhone}
                        </span>

                    </div>

                </div>


                <span
                    class="status-badge ${status}"
                >
                    ${escapeHTML(statusText)}
                </span>

            </div>


            <div class="withdrawal-reference">

                <span>
                    Reference
                </span>

                <strong>
                    ${safeReference}
                </strong>

            </div>


            <div class="withdrawal-amount-grid">

                <div>

                    <span>
                        Requested
                    </span>

                    <strong>
                        UGX ${formatMoney(requested)}
                    </strong>

                </div>


                <div>

                    <span>
                        Fee
                    </span>

                    <strong>
                        UGX ${formatMoney(fee)}
                    </strong>

                </div>


                <div>

                    <span>
                        You'll receive
                    </span>

                    <strong>
                        UGX ${formatMoney(payout)}
                    </strong>

                </div>

            </div>


            <div class="withdrawal-card-bottom">

                <div class="withdrawal-date">

                    <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        aria-hidden="true"
                    >

                        <rect
                            x="4"
                            y="5"
                            width="16"
                            height="15"
                            rx="2"
                            stroke="currentColor"
                            stroke-width="1.8"
                        />

                        <path
                            d="M8 3V7M16 3V7M4 10H20"
                            stroke="currentColor"
                            stroke-width="1.8"
                            stroke-linecap="round"
                        />

                    </svg>

                    <span>
                        ${escapeHTML(createdAt)}
                    </span>

                </div>


                <div class="withdrawal-card-actions">

                    ${
                        status === "approved"
                            ? `
                                <span class="payout-status">
                                    ${escapeHTML(
                                        payoutStatusText
                                    )}
                                </span>
                              `
                            : ""
                    }


                    <button
                        type="button"
                        class="details-button"
                        data-withdrawal-id="${safeId}"
                    >

                        <span>
                            View Details
                        </span>

                        <svg
                            viewBox="0 0 24 24"
                            fill="none"
                            aria-hidden="true"
                        >

                            <path
                                d="M5 12H19"
                                stroke="currentColor"
                                stroke-width="1.8"
                                stroke-linecap="round"
                            />

                            <path
                                d="M13 6L19 12L13 18"
                                stroke="currentColor"
                                stroke-width="1.8"
                                stroke-linecap="round"
                                stroke-linejoin="round"
                            />

                        </svg>

                    </button>

                </div>

            </div>

        </article>

    `;

}


// ======================================================
// ATTACH DETAILS BUTTONS
// ======================================================

function attachDetailsButtons() {

    const buttons =
        document.querySelectorAll(
            ".details-button"
        );


    buttons.forEach(
        function(button) {

            button.addEventListener(
                "click",
                function() {

                    const id =
                        button.dataset.withdrawalId;


                    const withdrawal =
                        allWithdrawals.find(
                            function(item) {

                                const itemId =
                                    item.id ||
                                    item._id ||
                                    item.reference ||
                                    "";

                                return String(itemId) ===
                                    String(id);

                            }
                        );


                    if (withdrawal) {

                        openDetailsModal(
                            withdrawal
                        );

                    }

                }
            );

        }
    );

}


// ======================================================
// OPEN MODAL
// ======================================================

function openDetailsModal(withdrawal) {

    if (!detailsModal) {
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


    const payoutStatus =
        withdrawal.payout_status ||
        "not_paid";


    if (modalStatus) {

        modalStatus.textContent =
            statusLabel(status);

        modalStatus.className =
            `modal-status ${status}`;

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


    if (modalRejectionRow) {

        modalRejectionRow.hidden =
            status !== "rejected";

    }


    if (modalRejectionReason) {

        modalRejectionReason.textContent =
            withdrawal.rejection_reason ||
            withdrawal.rejected_reason ||
            "No rejection reason was provided.";

    }


    detailsModal.hidden = false;

    document.body.classList.add(
        "modal-open"
    );

}


// ======================================================
// CLOSE MODAL
// ======================================================

function closeDetailsModal() {

    if (!detailsModal) {
        return;
    }


    detailsModal.hidden = true;

    document.body.classList.remove(
        "modal-open"
    );

}


// ======================================================
// SEARCH / FILTER EVENTS
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
// MODAL EVENTS
// ======================================================

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
        function(event) {

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
    function(event) {

        if (
            event.key === "Escape" &&
            detailsModal &&
            !detailsModal.hidden
        ) {

            closeDetailsModal();

        }

    }
);


// ======================================================
// START
// ======================================================

document.addEventListener(
    "DOMContentLoaded",
    function() {

        loadWithdrawals();

    }
);


// ======================================================
// GLOBAL HELPERS
// ======================================================

window.CrownCashWithdrawals = {

    reload: loadWithdrawals,

    refresh: loadWithdrawals,

    getWithdrawals:
        function() {
            return allWithdrawals;
        },

    getFilteredWithdrawals:
        getFilteredWithdrawals

};