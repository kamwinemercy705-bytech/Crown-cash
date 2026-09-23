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
// PAGE MESSAGE
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
// LOADING CONTROL
// ======================================================

function showLoading() {

    if (loadingState) {
        loadingState.hidden = false;
        loadingState.style.display = "";
    }

    if (emptyState) {
        emptyState.hidden = true;
        emptyState.style.display = "none";
    }

    if (withdrawalsList) {
        withdrawalsList.innerHTML = "";
    }
}


function hideLoading() {

    if (!loadingState) return;

    /*
     * Use BOTH hidden and display.
     * This prevents CSS from forcing the
     * loading message to remain visible.
     */
    loadingState.hidden = true;
    loadingState.style.display = "none";
}


function showEmptyState() {

    if (!emptyState) return;

    emptyState.hidden = false;
    emptyState.style.display = "";
}


function hideEmptyState() {

    if (!emptyState) return;

    emptyState.hidden = true;
    emptyState.style.display = "none";
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
// FETCH WITH TIMEOUT
// ======================================================

async function fetchWithTimeout(
    url,
    options = {},
    timeout = 30000
) {

    const controller = new AbortController();

    const timer = setTimeout(
        () => controller.abort(),
        timeout
    );

    try {

        return await fetch(
            url,
            {
                ...options,
                signal: controller.signal
            }
        );

    } finally {

        clearTimeout(timer);
    }
}


// ======================================================
// LOAD PROFILE
// ======================================================

async function loadProfile() {

    try {

        const response = await fetchWithTimeout(
            PROFILE_API,
            {
                method: "GET",
                credentials: "include",
                cache: "no-store",
                headers: {
                    "Accept": "application/json"
                }
            },
            30000
        );


        if (response.status === 401) {

            window.location.href =
                "/login.html?redirect=withdrawals.html";

            return null;
        }


        const data =
            await response.json();


        if (!response.ok || !data.success) {

            throw new Error(
                data.message ||
                "Unable to load account information."
            );
        }


        const user =
            data.user || {};


        // BALANCE

        if (availableBalance) {

            availableBalance.textContent =
                `UGX ${formatMoney(
                    user.balance ??
                    user.wallet_balance ??
                    0
                )}`;
        }


        // PHONE

        const phone =
            user.phone ||
            user.phone_number ||
            user.mobile ||
            "";


        if (registeredPhone) {

            registeredPhone.textContent =
                phone ||
                "No registered phone";
        }


        return user;


    } catch (error) {

        console.error(
            "Profile loading error:",
            error
        );


        /*
         * Do not leave the phone stuck on
         * "Loading phone..."
         */
        if (registeredPhone) {

            registeredPhone.textContent =
                "Unable to load";
        }


        return null;
    }
}


// ======================================================
// LOAD WITHDRAWAL HISTORY
// ======================================================

async function loadWithdrawals() {

    hideMessage();
    showLoading();

    console.log(
        "Loading withdrawal history..."
    );


    try {

        const response =
            await fetchWithTimeout(
                WITHDRAWALS_API,
                {
                    method: "GET",
                    credentials: "include",
                    cache: "no-store",
                    headers: {
                        "Accept": "application/json"
                    }
                },
                30000
            );


        console.log(
            "Withdrawals API status:",
            response.status
        );


        if (response.status === 401) {

            window.location.href =
                "/login.html?redirect=withdrawals.html";

            return;
        }


        let data;


        try {

            data =
                await response.json();

        } catch (jsonError) {

            throw new Error(
                "The withdrawal server returned an invalid response."
            );
        }


        console.log(
            "Withdrawals API response:",
            data
        );


        if (
            !response.ok ||
            !data ||
            data.success !== true
        ) {

            throw new Error(
                data?.message ||
                `Unable to load withdrawal history. Server status: ${response.status}`
            );
        }


        // ==================================================
        // USER
        // ==================================================

        const user =
            data.user || {};


        if (availableBalance) {

            availableBalance.textContent =
                `UGX ${formatMoney(
                    user.balance ??
                    user.wallet_balance ??
                    0
                )}`;
        }


        const phone =
            user.phone ||
            user.phone_number ||
            user.mobile ||
            "";


        if (registeredPhone) {

            registeredPhone.textContent =
                phone ||
                "No registered phone";
        }


        // ==================================================
        // WITHDRAWALS
        // ==================================================

        if (Array.isArray(data.withdrawals)) {

            allWithdrawals =
                data.withdrawals;

        } else {

            allWithdrawals = [];
        }


        // ==================================================
        // SUMMARY
        // ==================================================

        const summary =
            data.summary || {};


        if (totalRequested) {

            totalRequested.textContent =
                `UGX ${formatMoney(
                    summary.total_requested ??
                    0
                )}`;
        }


        if (totalFees) {

            totalFees.textContent =
                `UGX ${formatMoney(
                    summary.total_fees ??
                    0
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
                    Number(
                        summary.pending_count ??
                        allWithdrawals.filter(
                            item =>
                                normalizeStatus(
                                    item.status
                                ) === "pending"
                        ).length
                    )
                );
        }


        // ==================================================
        // RENDER
        // ==================================================

        renderWithdrawals();


        console.log(
            "Withdrawal history loaded successfully.",
            allWithdrawals.length
        );


    } catch (error) {

        console.error(
            "Withdrawal history error:",
            error
        );


        allWithdrawals = [];


        hideLoading();
        hideEmptyState();


        if (withdrawalsList) {

            withdrawalsList.innerHTML = "";
        }


        let message =
            "Unable to load your withdrawal history.";


        if (
            error.name === "AbortError"
        ) {

            message =
                "The withdrawal server took too long to respond. Please try again.";
        } else if (error.message) {

            message =
                error.message;
        }


        showMessage(
            message,
            "error"
        );
    }
}


// ======================================================
// FILTER
// ======================================================

function getFilteredWithdrawals() {

    const search =
        String(
            searchInput?.value || ""
        )
            .trim()
            .toLowerCase();


    const selectedStatus =
        String(
            statusFilter?.value || "all"
        )
            .trim()
            .toLowerCase();


    const selectedMethod =
        String(
            methodFilter?.value || "all"
        )
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
                    withdrawal.payment_method ||
                    withdrawal.method ||
                    ""
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
                withdrawal.account_number,
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


    // ==================================================
    // NO WITHDRAWALS
    // ==================================================

    if (!allWithdrawals.length) {

        if (withdrawalsList) {

            withdrawalsList.innerHTML = "";
        }


        showEmptyState();

        return;
    }


    // ==================================================
    // FILTER HAS NO RESULTS
    // ==================================================

    if (!filtered.length) {

        hideEmptyState();


        if (withdrawalsList) {

            withdrawalsList.innerHTML = `

                <div class="empty-state">

                    <div class="empty-icon">

                        <svg
                            viewBox="0 0 24 24"
                            fill="none"
                            aria-hidden="true"
                        >

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


    // ==================================================
    // SHOW RESULTS
    // ==================================================

    hideEmptyState();


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

function createWithdrawalCard(
    withdrawal
) {

    const method =
        normalizeMethod(
            withdrawal.payment_method ||
            withdrawal.method
        );


    const methodClass =
        getMethodClass(
            withdrawal.payment_method ||
            withdrawal.method
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
            withdrawal.withdrawal_fee ??
            requested * 0.20
        );


    const payout =
        Number(
            withdrawal.payout_amount ??
            withdrawal.payout ??
            withdrawal.amount_received ??
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


    const createdAt =
        formatDate(
            withdrawal.created_at ||
            withdrawal.date
        );


    const withdrawalId =
        withdrawal.id ||
        withdrawal._id ||
        "";


    const safeId =
        escapeHTML(
            withdrawalId
        );


    const rejectionReason =
        withdrawal.rejection_reason ||
        withdrawal.reason ||
        "";


    return `

        <article
            class="withdrawal-card"
            data-id="${safeId}"
        >

            <div class="withdrawal-card-main">


                <div
                    class="withdrawal-method-icon ${methodClass}"
                    aria-hidden="true"
                >

                    <svg
                        viewBox="0 0 24 24"
                        fill="none"
                    >

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


                        <span
                            class="status-badge status-${status}"
                        >
                            ${escapeHTML(
                                statusLabel(status)
                            )}
                        </span>

                    </div>


                    <div class="withdrawal-amount">

                        <span>
                            Requested
                        </span>

                        <strong>
                            UGX ${formatMoney(requested)}
                        </strong>

                    </div>


                    <div class="withdrawal-meta">

                        <span>
                            ${escapeHTML(phone)}
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
                                            payoutStatusLabel(
                                                payoutStatus
                                            )
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
                                    ${escapeHTML(
                                        rejectionReason
                                    )}
                                </div>

                            `
                            : ""
                    }

                </div>


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
            withdrawal.withdrawal_fee ??
            requested * 0.20
        );


    const payout =
        Number(
            withdrawal.payout_amount ??
            withdrawal.payout ??
            requested - fee
        );


    const method =
        normalizeMethod(
            withdrawal.payment_method ||
            withdrawal.method
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
                withdrawal.created_at ||
                withdrawal.date
            );
    }


    const payoutStatus =
        String(
            withdrawal.payout_status ||
            "not_paid"
        )
            .trim()
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

        detailsModal.style.display = "flex";

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

    detailsModal.style.display = "none";

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
// START
// ======================================================

async function initializeWithdrawalsPage() {

    console.log(
        "Crown Cash withdrawals page started."
    );


    /*
     * Set safe initial values.
     * This prevents the page from displaying
     * misleading loading text indefinitely.
     */

    if (registeredPhone) {
        registeredPhone.textContent =
            "Loading...";
    }


    if (availableBalance) {
        availableBalance.textContent =
            "UGX 0";
    }


    if (totalRequested) {
        totalRequested.textContent =
            "UGX 0";
    }


    if (totalFees) {
        totalFees.textContent =
            "UGX 0";
    }


    if (totalPayout) {
        totalPayout.textContent =
            "UGX 0";
    }


    if (pendingCount) {
        pendingCount.textContent =
            "0";
    }


    if (withdrawalCount) {
        withdrawalCount.textContent =
            "0 requests";
    }


    /*
     * Load account information.
     */
    await loadProfile();


    /*
     * Load withdrawal history.
     */
    await loadWithdrawals();
}


// ======================================================
// START PAGE
// ======================================================

if (
    document.readyState === "loading"
) {

    document.addEventListener(
        "DOMContentLoaded",
        initializeWithdrawalsPage
    );

} else {

    initializeWithdrawalsPage();
}