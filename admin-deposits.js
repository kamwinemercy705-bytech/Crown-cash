/* =========================================================
   CROWN CASH ADMIN — DEPOSITS JS
========================================================= */

"use strict";


/* =========================================================
   CONFIGURATION
========================================================= */

const API_BASE = "https://crown-cash1.onrender.com";

const DEPOSITS_API =
    `${API_BASE}/admin-deposits.php`;

const LOGOUT_API =
    `${API_BASE}/logout.php`;


/* =========================================================
   STATE
========================================================= */

let deposits = [];

let filteredDeposits = [];

let selectedDeposit = null;

let isLoading = false;


/* =========================================================
   DOM ELEMENTS
========================================================= */

const tableBody =
    document.getElementById("depositTableBody");

const totalDeposits =
    document.getElementById("totalDeposits");

const approvedDeposits =
    document.getElementById("approvedDeposits");

const pendingDeposits =
    document.getElementById("pendingDeposits");

const rejectedDeposits =
    document.getElementById("rejectedDeposits");

const resultCount =
    document.getElementById("resultCount");

const searchInput =
    document.getElementById("searchInput");

const statusFilter =
    document.getElementById("statusFilter");

const methodFilter =
    document.getElementById("methodFilter");

const refreshBtn =
    document.getElementById("refreshBtn");

const logoutBtn =
    document.getElementById("logoutBtn");

const mobileMenu =
    document.getElementById("mobileMenu");

const sidebar =
    document.querySelector(".sidebar");


/* Modal */

const depositModal =
    document.getElementById("depositModal");

const closeModal =
    document.getElementById("closeModal");

const modalCustomer =
    document.getElementById("modalCustomer");

const modalPhone =
    document.getElementById("modalPhone");

const modalAmount =
    document.getElementById("modalAmount");

const modalMethod =
    document.getElementById("modalMethod");

const modalReference =
    document.getElementById("modalReference");

const modalStatus =
    document.getElementById("modalStatus");

const paymentVerified =
    document.getElementById("paymentVerified");

const approveBtn =
    document.getElementById("approveBtn");

const rejectBtn =
    document.getElementById("rejectBtn");

const modalMessage =
    document.getElementById("modalMessage");

const adminName =
    document.getElementById("adminName");


/* =========================================================
   INITIALIZATION
========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    () => {

        setupEvents();

        loadDeposits();

    }
);


/* =========================================================
   EVENT LISTENERS
========================================================= */

function setupEvents() {


    /* Search */

    if (searchInput) {

        searchInput.addEventListener(
            "input",
            applyFilters
        );

    }


    /* Status filter */

    if (statusFilter) {

        statusFilter.addEventListener(
            "change",
            applyFilters
        );

    }


    /* Method filter */

    if (methodFilter) {

        methodFilter.addEventListener(
            "change",
            applyFilters
        );

    }


    /* Refresh */

    if (refreshBtn) {

        refreshBtn.addEventListener(
            "click",
            () => {

                loadDeposits(true);

            }
        );

    }


    /* Close modal */

    if (closeModal) {

        closeModal.addEventListener(
            "click",
            closeDepositModal
        );

    }


    /* Click outside modal */

    if (depositModal) {

        depositModal.addEventListener(
            "click",
            event => {

                if (
                    event.target === depositModal
                ) {

                    closeDepositModal();

                }

            }
        );

    }


    /* Escape */

    document.addEventListener(
        "keydown",
        event => {

            if (
                event.key === "Escape" &&
                depositModal &&
                depositModal.classList.contains("show")
            ) {

                closeDepositModal();

            }

        }
    );


    /* Approve */

    if (approveBtn) {

        approveBtn.addEventListener(
            "click",
            approveDeposit
        );

    }


    /* Reject */

    if (rejectBtn) {

        rejectBtn.addEventListener(
            "click",
            rejectDeposit
        );

    }


    /* Logout */

    if (logoutBtn) {

        logoutBtn.addEventListener(
            "click",
            logoutAdmin
        );

    }


    /* Mobile menu */

    if (mobileMenu) {

        mobileMenu.addEventListener(
            "click",
            () => {

                if (sidebar) {

                    sidebar.classList.toggle(
                        "open"
                    );

                }

            }
        );

    }


    /* Close sidebar after navigation */

    document.querySelectorAll(
        ".sidebar a"
    ).forEach(link => {

        link.addEventListener(
            "click",
            () => {

                if (window.innerWidth <= 800) {

                    sidebar?.classList.remove(
                        "open"
                    );

                }

            }
        );

    });

}


/* =========================================================
   LOAD DEPOSITS
========================================================= */

async function loadDeposits(showRefresh = false) {

    if (isLoading) {
        return;
    }

    isLoading = true;


    if (showRefresh) {

        setRefreshLoading(true);

    }


    showLoading();


    try {

        const response = await fetch(
            DEPOSITS_API,
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


        if (!response.ok) {

            throw new Error(
                data.message ||
                `Request failed (${response.status})`
            );

        }


        if (
            !data ||
            data.success !== true
        ) {

            throw new Error(
                data?.message ||
                "Unable to load deposits."
            );

        }


        /*
         * Support the common response formats:
         *
         * {
         *   success: true,
         *   deposits: []
         * }
         *
         * or
         *
         * {
         *   success: true,
         *   data: []
         * }
         */

        if (Array.isArray(data.deposits)) {

            deposits = data.deposits;

        } else if (Array.isArray(data.data)) {

            deposits = data.data;

        } else {

            deposits = [];

        }


        /*
         * Normalize each deposit so the frontend
         * can handle slightly different backend field names.
         */

        deposits =
            deposits.map(normalizeDeposit);


        /*
         * Update administrator name if returned.
         */

        if (
            data.admin &&
            adminName
        ) {

            const name =
                data.admin.name ||
                data.admin.full_name ||
                data.admin.email;

            if (name) {

                adminName.textContent =
                    name;

            }

        }


        updateStats();

        applyFilters();


    } catch (error) {

        console.error(
            "Deposit loading error:",
            error
        );

        showError(
            error.message ||
            "Unable to load deposits."
        );

    } finally {

        isLoading = false;

        if (showRefresh) {

            setRefreshLoading(false);

        }

    }

}


/* =========================================================
   NORMALIZE DEPOSIT
========================================================= */

function normalizeDeposit(deposit) {

    const item =
        deposit || {};


    const user =
        item.user ||
        item.customer ||
        {};


    const id =
        item.id ||
        item.deposit_id ||
        item._id?.$oid ||
        item._id ||
        "";


    const fullName =
        item.full_name ||
        item.name ||
        user.full_name ||
        user.name ||
        "";


    const email =
        item.email ||
        user.email ||
        "";


    const phone =
        item.phone ||
        item.phone_number ||
        user.phone ||
        "";


    const amount =
        Number(
            item.amount ??
            item.deposit_amount ??
            0
        );


    const method =
        String(
            item.method ||
            item.payment_method ||
            ""
        ).toLowerCase();


    const reference =
        item.reference ||
        item.transaction_reference ||
        item.payment_reference ||
        "";


    const status =
        String(
            item.status ||
            "pending"
        ).toLowerCase();


    const date =
        item.created_at ||
        item.createdAt ||
        item.date ||
        "";


    return {

        ...item,

        id: String(id),

        full_name:
            String(fullName),

        email:
            String(email),

        phone:
            String(phone),

        amount:
            Number.isFinite(amount)
                ? amount
                : 0,

        method,

        reference:
            String(reference),

        status,

        created_at:
            date

    };

}


/* =========================================================
   UPDATE STATISTICS
========================================================= */

function updateStats() {

    const total =
        deposits.length;


    const approved =
        deposits.filter(
            deposit =>
                deposit.status ===
                "approved"
        ).length;


    const pending =
        deposits.filter(
            deposit =>
                deposit.status ===
                "pending"
        ).length;


    const rejected =
        deposits.filter(
            deposit =>
                deposit.status ===
                "rejected"
        ).length;


    if (totalDeposits) {

        totalDeposits.textContent =
            formatNumber(total);

    }


    if (approvedDeposits) {

        approvedDeposits.textContent =
            formatNumber(approved);

    }


    if (pendingDeposits) {

        pendingDeposits.textContent =
            formatNumber(pending);

    }


    if (rejectedDeposits) {

        rejectedDeposits.textContent =
            formatNumber(rejected);

    }

}


/* =========================================================
   FILTERS
========================================================= */

function applyFilters() {

    const search =
        String(
            searchInput?.value ||
            ""
        )
        .trim()
        .toLowerCase();


    const selectedStatus =
        String(
            statusFilter?.value ||
            "all"
        )
        .toLowerCase();


    const selectedMethod =
        String(
            methodFilter?.value ||
            "all"
        )
        .toLowerCase();


    filteredDeposits =
        deposits.filter(
            deposit => {

                const searchableText =
                    [

                        deposit.full_name,

                        deposit.email,

                        deposit.phone,

                        deposit.reference,

                        deposit.id,

                        deposit.method,

                        deposit.status,

                        String(
                            deposit.amount
                        )

                    ]
                    .join(" ")
                    .toLowerCase();


                const matchesSearch =
                    !search ||
                    searchableText.includes(
                        search
                    );


                const matchesStatus =
                    selectedStatus ===
                    "all" ||
                    deposit.status ===
                    selectedStatus;


                const matchesMethod =
                    selectedMethod ===
                    "all" ||
                    deposit.method ===
                    selectedMethod;


                return (
                    matchesSearch &&
                    matchesStatus &&
                    matchesMethod
                );

            }
        );


    renderDeposits();

}


/* =========================================================
   RENDER TABLE
========================================================= */

function renderDeposits() {

    if (!tableBody) {
        return;
    }


    if (resultCount) {

        resultCount.textContent =
            `${filteredDeposits.length} ${
                filteredDeposits.length === 1
                    ? "deposit"
                    : "deposits"
            }`;

    }


    if (
        filteredDeposits.length === 0
    ) {

        showEmpty();

        return;

    }


    tableBody.innerHTML =
        filteredDeposits
            .map(
                createDepositRow
            )
            .join("");

}


/* =========================================================
   CREATE TABLE ROW
========================================================= */

function createDepositRow(deposit) {

    const initials =
        getInitials(
            deposit.full_name ||
            deposit.email ||
            "User"
        );


    const customerName =
        escapeHtml(
            deposit.full_name ||
            "Unknown User"
        );


    const email =
        escapeHtml(
            deposit.email ||
            "No email"
        );


    const phone =
        escapeHtml(
            deposit.phone ||
            "No phone"
        );


    const amount =
        formatCurrency(
            deposit.amount
        );


    const method =
        createMethodBadge(
            deposit.method
        );


    const reference =
        escapeHtml(
            deposit.reference ||
            "—"
        );


    const date =
        formatDate(
            deposit.created_at
        );


    const status =
        createStatusBadge(
            deposit.status
        );


    const action =
        deposit.status === "pending"
            ? `
                <button
                    type="button"
                    class="view-btn"
                    data-action="view"
                    data-id="${escapeAttribute(
                        deposit.id
                    )}"
                >

                    <svg
                        viewBox="0 0 24 24"
                        fill="none"
                    >

                        <path
                            d="M2.5 12C4.5 8 8 6 12 6C16 6 19.5 8 21.5 12C19.5 16 16 18 12 18C8 18 4.5 16 2.5 12Z"
                            stroke="currentColor"
                            stroke-width="1.7"
                        />

                        <circle
                            cx="12"
                            cy="12"
                            r="3"
                            stroke="currentColor"
                            stroke-width="1.7"
                        />

                    </svg>

                    Review

                </button>
            `
            : `
                <button
                    type="button"
                    class="view-btn"
                    data-action="view"
                    data-id="${escapeAttribute(
                        deposit.id
                    )}"
                >

                    <svg
                        viewBox="0 0 24 24"
                        fill="none"
                    >

                        <path
                            d="M2.5 12C4.5 8 8 6 12 6C16 6 19.5 8 21.5 12C19.5 16 16 18 12 18C8 18 4.5 16 2.5 12Z"
                            stroke="currentColor"
                            stroke-width="1.7"
                        />

                        <circle
                            cx="12"
                            cy="12"
                            r="3"
                            stroke="currentColor"
                            stroke-width="1.7"
                        />

                    </svg>

                    View

                </button>
            `;


    return `
        <tr>

            <td>

                <div class="customer-cell">

                    <div class="customer-avatar">
                        ${initials}
                    </div>

                    <div class="customer-info">

                        <strong>
                            ${customerName}
                        </strong>

                        <span>
                            ${email}
                        </span>

                    </div>

                </div>

            </td>


            <td class="amount">
                ${amount}
            </td>


            <td>
                ${method}
            </td>


            <td>

                <span class="reference">
                    ${reference}
                </span>

            </td>


            <td>
                ${date}
            </td>


            <td>
                ${status}
            </td>


            <td>
                ${action}
            </td>

        </tr>
    `;

}


/* =========================================================
   METHOD BADGE
========================================================= */

function createMethodBadge(method) {

    const normalized =
        String(
            method || ""
        ).toLowerCase();


    if (
        normalized.includes("airtel")
    ) {

        return `
            <span class="method-badge airtel">
                Airtel Money
            </span>
        `;

    }


    if (
        normalized.includes("mtn")
    ) {

        return `
            <span class="method-badge mtn">
                MTN Mobile Money
            </span>
        `;

    }


    return `
        <span class="method-badge">
            ${escapeHtml(
                method || "Unknown"
            )}
        </span>
    `;

}


/* =========================================================
   STATUS BADGE
========================================================= */

function createStatusBadge(status) {

    const normalized =
        String(
            status || "pending"
        ).toLowerCase();


    let label =
        normalized;


    if (
        normalized ===
        "approved"
    ) {

        label = "Approved";

    } else if (
        normalized ===
        "pending"
    ) {

        label = "Pending";

    } else if (
        normalized ===
        "rejected"
    ) {

        label = "Rejected";

    }


    return `
        <span
            class="status-badge ${escapeAttribute(
                normalized
            )}"
        >
            ${escapeHtml(label)}
        </span>
    `;

}


/* =========================================================
   TABLE CLICK HANDLER
========================================================= */

if (tableBody) {

    tableBody.addEventListener(
        "click",
        event => {

            const button =
                event.target.closest(
                    "[data-action='view']"
                );


            if (!button) {
                return;
            }


            const id =
                button.dataset.id;


            openDepositModal(id);

        }
    );

}


/* =========================================================
   OPEN DEPOSIT MODAL
========================================================= */

function openDepositModal(id) {

    const deposit =
        deposits.find(
            item =>
                String(item.id) ===
                String(id)
        );


    if (!deposit) {

        showToast(
            "Deposit could not be found.",
            "error"
        );

        return;

    }


    selectedDeposit =
        deposit;


    if (modalCustomer) {

        modalCustomer.textContent =
            deposit.full_name ||
            "Unknown User";

    }


    if (modalPhone) {

        modalPhone.textContent =
            deposit.phone ||
            "—";

    }


    if (modalAmount) {

        modalAmount.textContent =
            formatCurrency(
                deposit.amount
            );

    }


    if (modalMethod) {

        modalMethod.textContent =
            getMethodName(
                deposit.method
            );

    }


    if (modalReference) {

        modalReference.textContent =
            deposit.reference ||
            "—";

    }


    if (modalStatus) {

        modalStatus.textContent =
            capitalize(
                deposit.status
            );

    }


    if (paymentVerified) {

        paymentVerified.checked =
            false;

    }


    clearModalMessage();


    const isPending =
        deposit.status ===
        "pending";


    if (approveBtn) {

        approveBtn.disabled =
            !isPending;

    }


    if (rejectBtn) {

        rejectBtn.disabled =
            !isPending;

    }


    if (paymentVerified) {

        paymentVerified.disabled =
            !isPending;

    }


    if (depositModal) {

        depositModal.classList.add(
            "show"
        );

        document.body.style.overflow =
            "hidden";

    }

}


/* =========================================================
   CLOSE MODAL
========================================================= */

function closeDepositModal() {

    if (depositModal) {

        depositModal.classList.remove(
            "show"
        );

    }


    document.body.style.overflow =
        "";


    selectedDeposit =
        null;

}


/* =========================================================
   APPROVE DEPOSIT
========================================================= */

async function approveDeposit() {

    if (!selectedDeposit) {

        return;

    }


    /*
     * Only pending deposits may be approved.
     */

    if (
        selectedDeposit.status !==
        "pending"
    ) {

        showModalMessage(
            "This deposit has already been processed.",
            "error"
        );

        return;

    }


    /*
     * Require manual payment verification.
     */

    if (
        !paymentVerified ||
        !paymentVerified.checked
    ) {

        showModalMessage(
            "Please verify the payment in the official MTN/Airtel merchant system before approving this deposit.",
            "error"
        );

        return;

    }


    const confirmed =
        window.confirm(
            `Approve deposit of ${formatCurrency(
                selectedDeposit.amount
            )} for ${
                selectedDeposit.full_name ||
                "this customer"
            }?`
        );


    if (!confirmed) {

        return;

    }


    setActionLoading(
        approveBtn,
        true
    );

    setActionLoading(
        rejectBtn,
        true
    );


    try {

        const result =
            await updateDeposit(
                selectedDeposit.id,
                "approve",
                true
            );


        if (!result.success) {

            throw new Error(
                result.message ||
                "Unable to approve deposit."
            );

        }


        showModalMessage(
            "Deposit approved successfully.",
            "success"
        );


        /*
         * Reload from server so the
         * displayed balance/status is
         * based on backend data.
         */

        await loadDeposits();


        setTimeout(
            closeDepositModal,
            900
        );


        showToast(
            "Deposit approved successfully.",
            "success"
        );


    } catch (error) {

        console.error(
            "Approve deposit error:",
            error
        );


        showModalMessage(
            error.message ||
            "Unable to approve deposit.",
            "error"
        );

    } finally {

        setActionLoading(
            approveBtn,
            false
        );

        setActionLoading(
            rejectBtn,
            false
        );

    }

}


/* =========================================================
   REJECT DEPOSIT
========================================================= */

async function rejectDeposit() {

    if (!selectedDeposit) {

        return;

    }


    if (
        selectedDeposit.status !==
        "pending"
    ) {

        showModalMessage(
            "This deposit has already been processed.",
            "error"
        );

        return;

    }


    const confirmed =
        window.confirm(
            `Reject deposit of ${formatCurrency(
                selectedDeposit.amount
            )} for ${
                selectedDeposit.full_name ||
                "this customer"
            }?`
        );


    if (!confirmed) {

        return;

    }


    setActionLoading(
        rejectBtn,
        true
    );

    setActionLoading(
        approveBtn,
        true
    );


    try {

        const result =
            await updateDeposit(
                selectedDeposit.id,
                "reject",
                false
            );


        if (!result.success) {

            throw new Error(
                result.message ||
                "Unable to reject deposit."
            );

        }


        showModalMessage(
            "Deposit rejected successfully.",
            "success"
        );


        await loadDeposits();


        setTimeout(
            closeDepositModal,
            900
        );


        showToast(
            "Deposit rejected successfully.",
            "success"
        );


    } catch (error) {

        console.error(
            "Reject deposit error:",
            error
        );


        showModalMessage(
            error.message ||
            "Unable to reject deposit.",
            "error"
        );

    } finally {

        setActionLoading(
            rejectBtn,
            false
        );

        setActionLoading(
            approveBtn,
            false
        );

    }

}


/* =========================================================
   UPDATE DEPOSIT
========================================================= */

async function updateDeposit(
    depositId,
    action,
    paymentVerifiedValue
) {

    /*
     * This sends the action to the
     * existing admin-deposits.php
     * backend.
     *
     * The backend must remain the
     * final authority for authorization,
     * status changes and balance credit.
     */

    const payload = {

        deposit_id:
            depositId,

        id:
            depositId,

        action:
            action,

        payment_verified:
            paymentVerifiedValue === true

    };


    const response =
        await fetch(
            DEPOSITS_API,
            {
                method: "POST",

                credentials: "include",

                headers: {

                    "Content-Type":
                        "application/json",

                    "Accept":
                        "application/json"

                },

                body:
                    JSON.stringify(
                        payload
                    )

            }
        );


    const data =
        await parseJsonResponse(
            response
        );


    if (!response.ok) {

        throw new Error(
            data.message ||
            `Server returned ${response.status}`
        );

    }


    return data;

}


/* =========================================================
   LOADING STATE
========================================================= */

function showLoading() {

    if (!tableBody) {
        return;
    }


    tableBody.innerHTML = `
        <tr>

            <td colspan="7">

                <div class="loading-state">

                    <div class="loader"></div>

                    <span>
                        Loading deposits...
                    </span>

                </div>

            </td>

        </tr>
    `;

}


/* =========================================================
   EMPTY STATE
========================================================= */

function showEmpty() {

    if (!tableBody) {
        return;
    }


    tableBody.innerHTML = `
        <tr>

            <td colspan="7">

                <div class="empty-state">

                    <div class="empty-icon">

                        <svg
                            viewBox="0 0 24 24"
                            fill="none"
                        >

                            <circle
                                cx="12"
                                cy="12"
                                r="8"
                                stroke="currentColor"
                                stroke-width="1.6"
                            />

                            <path
                                d="M8.5 12H15.5"
                                stroke="currentColor"
                                stroke-width="1.7"
                                stroke-linecap="round"
                            />