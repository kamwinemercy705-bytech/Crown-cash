"use strict";

/*
=========================================================
CROWN CASH - ADMIN WITHDRAWALS
=========================================================

This file handles:

✓ Loading withdrawal requests
✓ Withdrawal statistics
✓ Search
✓ Status filter
✓ Payment method filter
✓ Withdrawal review modal
✓ Approve withdrawal
✓ Reject withdrawal
✓ Refresh
✓ Admin logout
✓ Mobile sidebar
✓ Secure HTML escaping

IMPORTANT:
Approving a withdrawal records the administrative approval.
It does NOT automatically send MTN/Airtel Mobile Money.
Actual payout must be handled through an authorized
payment process/API.
=========================================================
*/


/* =========================================================
   API SETTINGS
   ========================================================= */

const API_BASE = "https://crown-cash1.onrender.com";

const WITHDRAWALS_API =
    `${API_BASE}/admin-withdrawals.php`;

const LOGOUT_API =
    `${API_BASE}/logout.php`;


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

document.addEventListener("DOMContentLoaded", () => {

    setupEvents();

    loadWithdrawals();

});


/* =========================================================
   EVENTS
   ========================================================= */

function setupEvents() {

    const searchInput = $("#searchInput");

    const statusFilter = $("#statusFilter");

    const methodFilter = $("#methodFilter");

    const refreshBtn = $("#refreshBtn");

    const closeModal = $("#closeModal");

    const approveBtn = $("#approveBtn");

    const rejectBtn = $("#rejectBtn");

    const logoutBtn = $("#logoutBtn");

    const menuBtn = $("#menuBtn");

    const withdrawalModal = $("#withdrawalModal");


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
            loadWithdrawals
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
            () => processWithdrawal("approve")
        );

    }


    if (rejectBtn) {

        rejectBtn.addEventListener(
            "click",
            () => processWithdrawal("reject")
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


    /*
    Close modal when clicking outside it.
    */

    if (withdrawalModal) {

        withdrawalModal.addEventListener(
            "click",
            event => {

                if (
                    event.target === withdrawalModal
                ) {

                    closeWithdrawalModal();

                }

            }
        );

    }


    /*
    Escape key closes modal.
    */

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

        const response = await fetch(
            WITHDRAWALS_API,
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
            data.success === false
        ) {

            throw new Error(
                data?.message ||
                `Unable to load withdrawals (${response.status}).`
            );

        }


        withdrawals =
            normalizeWithdrawalList(data);


        updateAdminDetails(data);

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


        /*
        If the session has expired, show a clearer message.
        */

        if (
            String(error.message || "")
                .toLowerCase()
                .includes("login")
        ) {

            showToast(
                "Session",
                "Please login again.",
                "error"
            );

        } else {

            showToast(
                "Error",
                getErrorMessage(error),
                "error"
            );

        }

    } finally {

        setRefreshLoading(false);

    }

}


/* =========================================================
   JSON RESPONSE
   ========================================================= */

async function parseJsonResponse(response) {

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

function normalizeWithdrawalList(data) {

    let list = [];


    if (Array.isArray(data)) {

        list = data;

    } else if (
        Array.isArray(data.withdrawals)
    ) {

        list = data.withdrawals;

    } else if (
        Array.isArray(data.data)
    ) {

        list = data.data;

    } else if (
        Array.isArray(data.results)
    ) {

        list = data.results;

    }


    return list.map(
        normalizeWithdrawal
    );

}


/* =========================================================
   NORMALIZE ONE WITHDRAWAL
   ========================================================= */

function normalizeWithdrawal(item) {

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


    const amount =
        Number(
            item.amount ??
            item.withdrawal_amount ??
            item.value ??
            0
        );


    const method =
        String(
            item.method ??
            item.payment_method ??
            item.provider ??
            ""
        )
            .trim()
            .toLowerCase();


    const status =
        String(
            item.status ??
            "pending"
        )
            .trim()
            .toLowerCase();


    const createdAt =
        item.created_at ??
        item.createdAt ??
        item.requested_at ??
        item.date ??
        "";


    return {

        raw: item,

        id: String(id),

        customerName:
            String(customerName || "Unknown Customer"),

        email:
            String(email || ""),

        phone:
            String(phone || ""),

        amount:
            Number.isFinite(amount)
                ? amount
                : 0,

        method:
            method || "unknown",

        status:
            status || "pending",

        createdAt:
            createdAt,

        payoutStatus:
            item.payout_status ??
            item.payoutStatus ??
            "",

        userId:
            item.user_id ??
            item.userId ??
            user.id ??
            user._id ??
            ""

    };

}


/* =========================================================
   ADMIN DETAILS
   ========================================================= */

function updateAdminDetails(data) {

    const admin =
        data?.admin ||
        data?.administrator ||
        {};


    const name =
        admin.name ??
        admin.full_name ??
        admin.fullName ??
        data?.admin_name ??
        "Administrator";


    const email =
        admin.email ??
        data?.admin_email ??
        "Admin Account";


    const adminName =
        $("#adminName");

    const adminEmail =
        $("#adminEmail");

    const adminAvatar =
        $("#adminAvatar");


    if (adminName) {

        adminName.textContent =
            String(name);

    }


    if (adminEmail) {

        adminEmail.textContent =
            String(email);

    }


    if (adminAvatar) {

        const initials =
            getInitials(
                String(name)
            );

        adminAvatar.textContent =
            initials;

    }

}


/* =========================================================
   STATISTICS
   ========================================================= */

function updateStatistics() {

    const total =
        withdrawals.length;


    const approved =
        withdrawals.filter(
            item =>
                normalizeStatus(item.status)
                === "approved"
        ).length;


    const pending =
        withdrawals.filter(
            item =>
                normalizeStatus(item.status)
                === "pending"
        ).length;


    const rejected =
        withdrawals.filter(
            item =>
                normalizeStatus(item.status)
                === "rejected"
        ).length;


    setText(
        "#totalWithdrawals",
        formatNumber(total)
    );


    setText(
        "#approvedWithdrawals",
        formatNumber(approved)
    );


    setText(
        "#pendingWithdrawals",
        formatNumber(pending)
    );


    setText(
        "#rejectedWithdrawals",
        formatNumber(rejected)
    );

}


/* =========================================================
   FILTERS
   ========================================================= */

function applyFilters() {

    const search =
        String(
            $("#searchInput")?.value ||
            ""
        )
            .trim()
            .toLowerCase();


    const status =
        String(
            $("#statusFilter")?.value ||
            "all"
        )
            .toLowerCase();


    const method =
        String(
            $("#methodFilter")?.value ||
            "all"
        )
            .toLowerCase();


    filteredWithdrawals =
        withdrawals.filter(item => {

            const customer =
                item.customerName
                    .toLowerCase();


            const phone =
                item.phone
                    .toLowerCase();


            const email =
                item.email
                    .toLowerCase();


            const id =
                item.id
                    .toLowerCase();


            const searchMatch =
                !search ||
                customer.includes(search) ||
                phone.includes(search) ||
                email.includes(search) ||
                id.includes(search);


            const normalizedStatus =
                normalizeStatus(
                    item.status
                );


            const statusMatch =
                status === "all" ||
                normalizedStatus === status;


            const normalizedMethod =
                normalizeMethod(
                    item.method
                );


            const methodMatch =
                method === "all" ||
                normalizedMethod === method;


            return (
                searchMatch &&
                statusMatch &&
                methodMatch
            );

        });


    /*
    Newest requests first.
    */

    filteredWithdrawals.sort(
        (a, b) =>
            getTimestamp(b.createdAt) -
            getTimestamp(a.createdAt)
    );


    renderWithdrawals();

}


/* =========================================================
   RENDER TABLE
   ========================================================= */

function renderWithdrawals() {

    const tbody =
        $("#withdrawalTableBody");


    const resultCount =
        $("#resultCount");


    if (resultCount) {

        resultCount.textContent =
            formatNumber(
                filteredWithdrawals.length
            );

    }


    if (!tbody) {

        return;

    }


    if (
        filteredWithdrawals.length === 0
    ) {

        tbody.innerHTML = `

            <tr>

                <td colspan="7">

                    <div class="empty-state">

                        <div class="empty-icon">

                            <svg viewBox="0 0 24 24">

                                <path d="M12 21V7"/>
                                <path d="M7 12l5-5 5 5"/>
                                <path d="M4 3h16"/>

                            </svg>

                        </div>

                        <strong>
                            No withdrawal requests found
                        </strong>

                        <p>
                            There are no withdrawal requests
                            matching your current search or filters.
                        </p>

                    </div>

                </td>

            </tr>

        `;

        return;

    }


    tbody.innerHTML =
        filteredWithdrawals
            .map(
                renderWithdrawalRow
            )
            .join("");

}


/* =========================================================
   RENDER ROW
   ========================================================= */

function renderWithdrawalRow(item) {

    const initials =
        getInitials(
            item.customerName
        );


    const status =
        normalizeStatus(
            item.status
        );


    const method =
        normalizeMethod(
            item.method
        );


    const methodLabel =
        getMethodLabel(method);


    const date =
        formatDate(
            item.createdAt
        );


    const amount =
        formatCurrency(
            item.amount
        );


    return `

        <tr>

            <td>

                <div class="customer">

                    <div class="customer-avatar">
                        ${escapeHtml(initials)}
                    </div>

                    <div class="customer-info">

                        <strong>
                            ${escapeHtml(item.customerName)}
                        </strong>

                        <span>
                            ${escapeHtml(
                                item.email || "Customer"
                            )}
                        </span>

                    </div>

                </div>

            </td>


            <td>

                <span class="amount">
                   