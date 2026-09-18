"use strict";

/*
|--------------------------------------------------------------------------
| Crown Cash - Admin Deposits
|--------------------------------------------------------------------------
*/

const API_URL = "https://crown-cash1.onrender.com";

let deposits = [];
let currentFilter = "all";
let selectedDeposit = null;
let selectedAction = null;


/* -----------------------------------------------------------------------
   DOM
------------------------------------------------------------------------ */

const loadingState = document.getElementById("loadingState");
const errorState = document.getElementById("errorState");
const emptyState = document.getElementById("emptyState");

const tableSection = document.getElementById("tableSection");
const mobileSection = document.getElementById("mobileSection");

const depositTableBody =
    document.getElementById("depositTableBody");

const mobileDepositList =
    document.getElementById("mobileDepositList");

const errorMessage =
    document.getElementById("errorMessage");

const messageBox =
    document.getElementById("messageBox");

const recordCount =
    document.getElementById("recordCount");

const pendingCount =
    document.getElementById("pendingCount");

const approvedCount =
    document.getElementById("approvedCount");

const rejectedCount =
    document.getElementById("rejectedCount");

const totalCount =
    document.getElementById("totalCount");

const actionModal =
    document.getElementById("actionModal");

const modalTitle =
    document.getElementById("modalTitle");

const modalText =
    document.getElementById("modalText");

const modalIcon =
    document.getElementById("modalIcon");

const modalCustomer =
    document.getElementById("modalCustomer");

const modalAmount =
    document.getElementById("modalAmount");

const modalReference =
    document.getElementById("modalReference");

const paymentVerified =
    document.getElementById("paymentVerified");

const confirmActionBtn =
    document.getElementById("confirmActionBtn");

const verificationCheck =
    document.getElementById("verificationCheck");


/* -----------------------------------------------------------------------
   Helpers
------------------------------------------------------------------------ */

function escapeHTML(value) {

    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


function formatUGX(amount) {

    const number = Number(amount) || 0;

    return "UGX " + number.toLocaleString("en-UG");
}


function formatDate(value) {

    if (!value) {
        return "—";
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


function normalizeStatus(status) {

    return String(status || "pending")
        .trim()
        .toLowerCase();
}


function normalizeMethod(method) {

    const value = String(method || "")
        .trim()
        .toLowerCase();

    if (
        value === "mtn_momo" ||
        value === "mtn" ||
        value.includes("mtn")
    ) {
        return "mtn";
    }

    if (
        value === "airtel_money" ||
        value === "airtel" ||
        value.includes("airtel")
    ) {
        return "airtel";
    }

    return value || "unknown";
}


function getInitial(name) {

    const value = String(name || "U").trim();

    return value.charAt(0).toUpperCase() || "U";
}


function getCustomerName(deposit) {

    if (deposit.user && typeof deposit.user === "object") {

        if (deposit.user.name) {
            return deposit.user.name;
        }
    }

    return (
        deposit.name ||
        deposit.full_name ||
        "Unknown User"
    );
}


function getCustomerEmail(deposit) {

    if (deposit.user && typeof deposit.user === "object") {

        if (deposit.user.email) {
            return deposit.user.email;
        }
    }

    return deposit.email || "";
}


function getCustomerPhone(deposit) {

    if (deposit.user && typeof deposit.user === "object") {

        if (deposit.user.phone) {
            return deposit.user.phone;
        }
    }

    return deposit.phone || "";
}


function getReference(deposit) {

    return (
        deposit.reference ||
        deposit.transaction_reference ||
        deposit.payment_reference ||
        "—"
    );
}


function getAmount(deposit) {

    return Number(deposit.amount) || 0;
}


function showMessage(message, type = "success") {

    messageBox.textContent = message;

    messageBox.className =
        "message-box " + type;

    messageBox.hidden = false;

    setTimeout(() => {
        messageBox.hidden = true;
    }, 4500);
}


function hideAllStates() {

    loadingState.hidden = true;
    errorState.hidden = true;
    emptyState.hidden = true;
    tableSection.hidden = true;
    mobileSection.hidden = true;
}


function showLoading() {

    hideAllStates();

    loadingState.hidden = false;
}


function showError(message) {

    hideAllStates();

    errorMessage.textContent =
        message || "Something went wrong.";

    errorState.hidden = false;
}


function showEmpty() {

    hideAllStates();

    emptyState.hidden = false;
}


/* -----------------------------------------------------------------------
   Load deposits
------------------------------------------------------------------------ */

async function loadDeposits() {

    showLoading();

    try {

        const response = await fetch(
            `${API_URL}/admin-deposits.php?status=all`,
            {
                method: "GET",
                credentials: "include",
                headers: {
                    "Accept": "application/json"
                }
            }
        );

        const text = await response.text();

        let data;

        try {
            data = JSON.parse(text);
        } catch (error) {

            throw new Error(
                "The server returned an invalid response."
            );
        }

        if (response.status === 401 ||
            response.status === 403) {

            throw new Error(
                data.message ||
                "Admin access required. Please log in again."
            );
        }

        if (!response.ok || !data.success) {

            throw new Error(
                data.message ||
                "Unable to load deposits."
            );
        }

        deposits = Array.isArray(data.deposits)
            ? data.deposits
            : [];

        updateStatistics(data.counts || {});
        renderDeposits();

    } catch (error) {

        console.error(
            "Admin deposits error:",
            error
        );

        showError(
            error.message ||
            "Unable to load deposits."
        );
    }
}


/* -----------------------------------------------------------------------
   Statistics
------------------------------------------------------------------------ */

function updateStatistics(counts) {

    pendingCount.textContent =
        Number(counts.pending || 0).toLocaleString();

    approvedCount.textContent =
        Number(counts.approved || 0).toLocaleString();

    rejectedCount.textContent =
        Number(counts.rejected || 0).toLocaleString();

    totalCount.textContent =
        Number(counts.total || deposits.length)
            .toLocaleString();
}


/* -----------------------------------------------------------------------
   Filtering
------------------------------------------------------------------------ */

function getFilteredDeposits() {

    if (currentFilter === "all") {
        return deposits;
    }

    return deposits.filter(
        deposit =>
            normalizeStatus(deposit.status) ===
            currentFilter
    );
}


function renderDeposits() {

    const filtered = getFilteredDeposits();

    recordCount.textContent =
        filtered.length.toLocaleString();

    if (filtered.length === 0) {
        showEmpty();
        return;
    }

    hideAllStates();

    tableSection.hidden = false;
    mobileSection.hidden = false;

    renderTable(filtered);
    renderMobile(filtered);
}


/* -----------------------------------------------------------------------
   Table
------------------------------------------------------------------------ */

function renderTable(list) {

    depositTableBody.innerHTML = list.map(
        deposit => {

            const name =
                getCustomerName(deposit);

            const email =
                getCustomerEmail(deposit);

            const phone =
                getCustomerPhone(deposit);

            const amount =
                getAmount(deposit);

            const method =
                normalizeMethod(
                    deposit.payment_method ||
                    deposit.method
                );

            const reference =
                getReference(deposit);

            const status =
                normalizeStatus(deposit.status);

            const id =
                deposit.id ||
                deposit.deposit_id ||
                "";

            return `
                <tr>

                    <td>
                        <div class="customer-cell">

                            <div class="customer-avatar">
                                ${escapeHTML(
                                    getInitial(name)
                                )}
                            </div>

                            <div>
                                <div class="customer-name">
                                    ${escapeHTML(name)}
                                </div>

                                <div class="customer-contact">
                                    ${escapeHTML(
                                        phone || email || "No contact"
                                    )}
                                </div>
                            </div>

                        </div>
                    </td>

                    <td>
                        <span class="amount">
                            ${formatUGX(amount)}
                        </span>
                    </td>

                    <td>
                        <span class="method ${escapeHTML(method)}">

                            <i class="fa-solid ${
                                method === "mtn"
                                    ? "fa-mobile-screen-button"
                                    : method === "airtel"
                                        ? "fa-mobile-screen-button"
                                        : "fa-wallet"
                            }"></i>

                            ${escapeHTML(method)}
                        </span>
                    </td>

                    <td>
                        <span
                            class="reference"
                            title="${escapeHTML(reference)}"
                        >
                            ${escapeHTML(reference)}
                        </span>
                    </td>

                    <td>
                        ${escapeHTML(
                            formatDate(
                                deposit.created_at
                            )
                        )}
                    </td>

                    <td>
                        ${statusBadge(status)}
                    </td>

                    <td>
                        ${actionButtons(
                            deposit,
                            id
                        )}
                    </td>

                </tr>
            `;
        }
    ).join("");
}


/* -----------------------------------------------------------------------
   Mobile
------------------------------------------------------------------------ */

function renderMobile(list) {

    mobileDepositList.innerHTML = list.map(
        deposit => {

            const name =
                getCustomerName(deposit);

            const phone =
                getCustomerPhone(deposit);

            const amount =
                getAmount(deposit);

            const method =
                normalizeMethod(
                    deposit.payment_method ||
                    deposit.method
                );

            const reference =
                getReference(deposit);

            const status =
                normalizeStatus(deposit.status);

            const id =
                deposit.id ||
                deposit.deposit_id ||
                "";

            return `
                <div class="mobile-deposit-card">

                    <div class="mobile-top">

                        <div class="mobile-customer">

                            <div class="customer-avatar">
                                ${escapeHTML(
                                    getInitial(name)
                                )}
                            </div>

                            <div>
                                <div class="customer-name">
                                    ${escapeHTML(name)}
                                </div>

                                <div class="customer-contact">
                                    ${escapeHTML(
                                        phone || "No phone"
                                    )}
                                </div>
                            </div>

                        </div>

                        ${statusBadge(status)}

                    </div>


                    <div class="mobile-details">

                        <div class="detail">
                            <span>Amount</span>
                            <strong>
                                ${formatUGX(amount)}
                            </strong>
                        </div>

                        <div class="detail">
                            <span>Method</span>
                            <strong>
                                ${escapeHTML(
                                    method.toUpperCase()
                                )}
                            </strong>
                        </div>

                        <div class="detail">
                            <span>Reference</span>
                            <strong>
                                ${escapeHTML(reference)}
                            </strong>
                        </div>

                        <div class="detail">
                            <span>Date</span>
                            <strong>
                                ${escapeHTML(
                                    formatDate(
                                        deposit.created_at
                                    )
                                )}
                            </strong>
                        </div>

                    </div>


                    ${
                        status === "pending"
                            ? `
                                <div class="mobile-actions">

                                    <button
                                        class="action-btn approve-btn"
                                        data-action="approve"
                                        data-id="${escapeHTML(id)}"
                                    >
                                        <i class="fa-solid fa-check"></i>
                                        Approve
                                    </button>

                                    <button
                                        class="action-btn reject-btn"
                                        data-action="reject"
                                        data-id="${escapeHTML(id)}"
                                    >
                                        <i class="fa-solid fa-xmark"></i>
                                        Reject
                                    </button>

                                </div>
                            `
                            : ""
                    }

                </div>
            `;
        }
    ).join("");
}


/* -----------------------------------------------------------------------
   Status badge
------------------------------------------------------------------------ */

function statusBadge(status) {

    let icon = "fa-clock";

    if (status === "approved") {
        icon = "fa-circle-check";
    }

    if (status === "rejected") {
        icon = "fa-circle-xmark";
    }

    if (status === "approval_error") {
        icon = "fa-triangle-exclamation";
    }

    return `
        <span class="status ${escapeHTML(status)}">
            <i class="fa-solid ${icon}"></i>
            ${escapeHTML(
                status.replace(/_/g, " ")
            )}
        </span>
    `;
}


/* -----------------------------------------------------------------------
   Action buttons
------------------------------------------------------------------------ */

function actionButtons(deposit, id) {

    const status =
        normalizeStatus(deposit.status);

    if (status !== "pending") {
        return `<span style="color:#718198;font-size:11px;">Processed</span>`;
    }

    return `
        <div class="action-buttons">

            <button
                class="action-btn approve-btn"
                data-action="approve"
                data-id="${escapeHTML(id)}"
                title="Approve deposit"
            >
                <i class="fa-solid fa-check"></i>
                Approve
            </button>

            <button
                class="action-btn reject-btn"
                data-action="reject"
                data-id="${escapeHTML(id)}"
                title="Reject deposit"
            >
                <i class="fa-solid fa-xmark"></i>
                Reject
            </button>

        </div>
    `;
}


/* -----------------------------------------------------------------------
   Open modal
------------------------------------------------------------------------ */

function openActionModal(deposit, action) {

    selectedDeposit = deposit;
    selectedAction = action;

    const name =
        getCustomerName(deposit);

    const amount =
        getAmount(deposit);

    const reference =
        getReference(deposit);

    modalCustomer.textContent =
        name;

    modalAmount.textContent =
        formatUGX(amount);

    modalReference.textContent =
        reference;

    paymentVerified.checked = false;

    if (action === "approve") {

        modalTitle.textContent =
            "Approve Deposit";

        modalText.textContent =
            "Only continue after independently verifying that this Mobile Money payment was actually received.";

        modalIcon.innerHTML =
            '<i class="fa-solid fa-circle-check"></i>';

        verificationCheck.hidden = false;

        confirmActionBtn.innerHTML =
            '<i class="fa-solid fa-circle-check"></i> Confirm Approval';

    } else {

        modalTitle.textContent =
            "Reject Deposit";

        modalText.textContent =
            "Are you sure you want to reject this pending deposit? The customer's wallet will not be credited.";

        modalIcon.innerHTML =
            '<i class="fa-solid fa-circle-xmark"></i>';

        verificationCheck.hidden = true;

        confirmActionBtn.innerHTML =
            '<i class="fa-solid fa-xmark"></i> Confirm Rejection';
    }

    actionModal.hidden = false;
}


function closeActionModal() {

    actionModal.hidden = true;

    selectedDeposit = null;
    selectedAction = null;

    paymentVerified.checked = false;
}


/* -----------------------------------------------------------------------
   Process action
------------------------------------------------------------------------ */

async function processAction() {

    if (!selectedDeposit ||
        !selectedAction) {
        return;
    }

    const depositId =
        selectedDeposit.id ||
        selectedDeposit.deposit_id;

    if (!depositId) {
        showMessage(
            "Deposit ID is missing.",
            "error"
        );

        return;
    }

    /*
     * Approval requires explicit verification.
     */
    if (
        selectedAction === "approve" &&
        !paymentVerified.checked
    ) {

        showMessage(
            "Please confirm that the payment was independently verified.",
            "error"
        );

        return;
    }

    const originalText =
        confirmActionBtn.innerHTML;

    confirmActionBtn.disabled = true;

    confirmActionBtn.innerHTML =
        '<i class="fa-solid fa-spinner fa-spin"></i> Processing...';

    try {

        const payload = {
            deposit_id: depositId,
            action: selectedAction,
            payment_verified:
                selectedAction === "approve"
                    ? true
                    : false
        };

        const response = await fetch(
            `${API_URL}/admin-deposits.php`,
            {
                method: "POST",
                credentials: "include",
                headers: {
                    "Content-Type":
                        "application/json",
                    "Accept":
                        "application/json"
                },
                body: JSON.stringify(payload)
            }
        );

        const text =
            await response.text();

        let data;

        try {
            data = JSON.parse(text);
        } catch (error) {

            throw new Error(
                "The server returned an invalid response."
            );
        }

        if (!response.ok ||
            !data.success) {

            throw new Error(
                data.message ||
                "The action could not be completed."
            );
        }

        closeActionModal();

        showMessage(
            data.message ||
            "Deposit updated successfully.",
            "success"
        );

        await loadDeposits();

    } catch (error) {

        console.error(
            "Deposit action error:",
            error
        );

        showMessage(
            error.message ||
            "Unable to process the deposit.",
            "error"
        );

    } finally {

        confirmActionBtn.disabled = false;

        confirmActionBtn.innerHTML =
            originalText;
    }
}


/* -----------------------------------------------------------------------
   Events
------------------------------------------------------------------------ */

document.addEventListener(
    "click",
    event => {

        const actionButton =
            event.target.closest(
                "[data-action]"
            );

        if (!actionButton) {
            return;
        }

        const action =
            actionButton.dataset.action;

        const id =
            actionButton.dataset.id;

        const deposit =
            deposits.find(item =>
                String(
                    item.id ||
                    item.deposit_id ||
                    ""
                ) === String(id)
            );

        if (!deposit) {
            showMessage(
                "Deposit record could not be found.",
                "error"
            );

            return;
        }

        openActionModal(
            deposit,
            action
        );
    }
);


document.querySelectorAll(
    ".filter-btn"
).forEach(button => {

    button.addEventListener(
        "click",
        () => {

            document.querySelectorAll(
                ".filter-btn"
            ).forEach(btn =>
                btn.classList.remove("active")
            );

            button.classList.add("active");

            currentFilter =
                button.dataset.status ||
                "all";

            renderDeposits();
        }
    );
});


document.getElementById(
    "refreshBtn"
).addEventListener(
    "click",
    loadDeposits
);


document.getElementById(
    "retryBtn"
).addEventListener(
    "click",
    loadDeposits
);


document.getElementById(
    "modalClose"
).addEventListener(
    "click",
    closeActionModal
);


document.getElementById(
    "cancelBtn"
).addEventListener(
    "click",
    closeActionModal
);


actionModal.addEventListener(
    "click",
    event => {

        if (event.target === actionModal) {
            closeActionModal();
        }
    }
);


confirmActionBtn.addEventListener(
    "click",
    processAction
);


/* -----------------------------------------------------------------------
   Mobile menu
------------------------------------------------------------------------ */

const menuToggle =
    document.getElementById("menuToggle");

const sidebar =
    document.getElementById("sidebar");

menuToggle.addEventListener(
    "click",
    () => {
        sidebar.classList.toggle("open");
    }
);


/* -----------------------------------------------------------------------
   Logout
------------------------------------------------------------------------ */

document.getElementById(
    "logoutBtn"
).addEventListener(
    "click",
    async () => {

        try {

            await fetch(
                `${API_URL}/logout.php`,
                {
                    method: "GET",
                    credentials: "include"
                }
            );

        } catch (error) {
            console.warn(
                "Logout request failed:",
                error
            );
        }

        localStorage.removeItem(
            "crowncash_user"
        );

        window.location.href =
            "login.html";
    }
);


/* -----------------------------------------------------------------------
   Year
------------------------------------------------------------------------ */

document.getElementById(
    "currentYear"
).textContent =
    new Date().getFullYear();


/* -----------------------------------------------------------------------
   Start
------------------------------------------------------------------------ */

loadDeposits();