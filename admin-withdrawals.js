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
✓ 10% withdrawal fee display
✓ Customer payout amount
✓ Payout status
✓ Refresh
✓ Admin logout
✓ Mobile sidebar
✓ Secure HTML escaping

IMPORTANT:
Administrative approval does NOT send MTN/Airtel money.
The approved withdrawal receives:

payout_status = "awaiting_payout"

Actual payout must be completed through an
authorized MTN/Airtel payment process or API.
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

const WITHDRAWAL_FEE_RATE = 0.10;


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
        currentPage.includes(
            "login.html"
        )
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
                processWithdrawal(
                    "approve"
                )
        );

    }


    if (rejectBtn) {

        rejectBtn.addEventListener(
            "click",
            () =>
                processWithdrawal(
                    "reject"
                )
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
    The new PHP uses requested_amount
    and amount.

    requested_amount is the amount
    deducted from the user's balance.

    payout_amount