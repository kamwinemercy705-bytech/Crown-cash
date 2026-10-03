/* =========================================================
   CROWN CASH — ADMIN DEPOSITS
   Complete Production Deposit Management
   ========================================================= */

"use strict";


/* =========================================================
   API CONFIGURATION
   ========================================================= */

const API_BASE =
    "https://crown-cash1.onrender.com";

const ADMIN_AUTH_API =
    `${API_BASE}/admin-auth.php`;

const PROFILE_API =
    `${API_BASE}/profile.php`;

/*
 * IMPORTANT:
 * Backend file is admin_deposit.php
 */
const DEPOSITS_API =
    `${API_BASE}/admin_deposit.php`;

const LOGOUT_API =
    `${API_BASE}/logout.php`;


/* =========================================================
   STATE
   ========================================================= */

let deposits = [];

let filteredDeposits = [];

let currentStatus = "pending";

let currentPage = 1;

const ITEMS_PER_PAGE = 5;

let selectedDeposit = null;


/* =========================================================
   ELEMENT HELPER
   ========================================================= */

const $ = (id) =>
    document.getElementById(id);


/* =========================================================
   FETCH JSON
   ========================================================= */

async function fetchJson(
    url,
    options = {}
) {

    const response =
        await fetch(
            url,
            {
                credentials: "include",
                cache: "no-store",
                ...options,

                headers: {
                    Accept:
                        "application/json",

                    ...(options.headers || {})
                }
            }
        );

    const text =
        await response.text();

    let data = null;

    try {

        data =
            text
                ? JSON.parse(text)
                : {};

    } catch (error) {

        throw new Error(
            "The server returned an invalid response."
        );
    }


    if (!response.ok) {

        const error =
            new Error(
                data?.message ||
                `Request failed (${response.status})`
            );

        error.status =
            response.status;

        error.data =
            data;

        throw error;
    }


    return data;
}


/* =========================================================
   MESSAGE
   ========================================================= */

function showMessage(
    message,
    type = "success"
) {

    const element =
        $("depositMessage");

    if (!element) {
        return;
    }


    element.textContent =
        message;


    element.className =
        `deposit-message ${type}`;


    element.hidden =
        false;


    window.clearTimeout(
        showMessage.timer
    );


    showMessage.timer =
        window.setTimeout(
            () => {

                element.hidden =
                    true;

            },
            5000
        );
}


/* =========================================================
   ADMIN VERIFICATION
   ========================================================= */

async function verifyAdministrator() {

    try {

        const data =
            await fetchJson(
                ADMIN_AUTH_API,
                {
                    method: "GET"
                }
            );


        if (
            !data ||
            data.success !== true ||
            data.authorized !== true
        ) {

            throw new Error(
                data?.message ||
                "Administrator access is required."
            );
        }


        return true;

    } catch (error) {

        console.error(
            "Administrator verification failed:",
            error
        );


        if (
            error.status === 401
        ) {

            window.location.href =
                "login.html";

            return false;
        }


        showMessage(
            error.message ||
            "Administrator verification failed.",
            "error"
        );


        return false;
    }
}


/* =========================================================
   ADMIN PROFILE
   ========================================================= */

async function loadAdminProfile() {

    try {

        const data =
            await fetchJson(
                PROFILE_API,
                {
                    method: "GET"
                }
            );


        if (
            !data ||
            data.success !== true
        ) {

            return;
        }


        const user =
            data.user || {};


        const name =
            user.full_name ||
            [
                user.first_name,
                user.last_name
            ]
                .filter(Boolean)
                .join(" ") ||
            "Administrator";


        const email =
            user.email ||
            "";


        if ($("adminName")) {

            $("adminName").textContent =
                name;
        }


        if ($("adminEmail")) {

            $("adminEmail").textContent =
                email;
        }

    } catch (error) {

        console.warn(
            "Unable to load admin profile:",
            error
        );
    }
}


/* =========================================================
   NORMALIZE DEPOSIT
   ========================================================= */

function normalizeDeposit(
    deposit
) {

    if (!deposit) {
        return null;
    }


    const customer =
        deposit.customer ||
        {};


    return {

        ...deposit,


        id:
            String(
                deposit._id ||
                deposit.id ||
                deposit.deposit_id ||
                ""
            ),


        customerName:
            deposit.customer_name ||
            deposit.full_name ||
            customer.full_name ||
            customer.name ||
            "Customer",


        phone:
            deposit.phone ||
            deposit.phone_number ||
            deposit.mobile ||
            customer.phone ||
            "",


        email:
            deposit.email ||
            customer.email ||
            "",


        amount:
            Number(
                deposit.amount ||
                0
            ),


        method:
            deposit.payment_method ||
            deposit.method ||
            deposit.network ||
            "Unknown",


        reference:
            deposit.transaction_reference ||
            deposit.reference ||
            deposit.payment_reference ||
            "",


        merchantCode:
            deposit.merchant_code ||
            deposit.merchantCode ||
            "",


        network:
            deposit.network ||
            deposit.payment_method ||
            deposit.method ||
            "",


        status:
            String(
                deposit.status ||
                "pending"
            )
                .toLowerCase(),


        createdAt:
            deposit.created_at ||
            deposit.submitted_at ||
            deposit.date ||
            null
    };
}


/* =========================================================
   LOAD DEPOSITS
   ========================================================= */

async function loadDeposits() {

    const list =
        $("depositsMobileList");


    if (list) {

        list.innerHTML = `
            <div class="deposit-empty">
                <h3>Loading deposits...</h3>
                <p>Please wait.</p>
            </div>
        `;
    }


    try {

        const data =
            await fetchJson(
                DEPOSITS_API,
                {
                    method: "GET"
                }
            );


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
         * Support both:
         *
         * {
         *   deposits: [...]
         * }
         *
         * and:
         *
         * {
         *   data: [...]
         * }
         */

        const rawDeposits =
            Array.isArray(
                data.deposits
            )
                ? data.deposits

                : Array.isArray(
                    data.data
                )
                    ? data.data

                    : [];


        deposits =
            rawDeposits
                .map(
                    normalizeDeposit
                )
                .filter(Boolean);


        applyFilters();


    } catch (error) {

        console.error(
            "Deposit loading error:",
            error
        );


        if (list) {

            list.innerHTML = `
                <div class="deposit-empty">

                    <h3>
                        Unable to load deposits
                    </h3>

                    <p>
                        ${escapeHtml(
                            error.message ||
                            "Please try again."
                        )}
                    </p>

                </div>
            `;
        }


        showMessage(
            error.message ||
            "Unable to load deposits.",
            "error"
        );
    }
}


/* =========================================================
   FILTERS
   ========================================================= */

function applyFilters() {

    const search =
        (
            $("depositSearch")?.value ||
            ""
        )
            .trim()
            .toLowerCase();


    filteredDeposits =
        deposits.filter(
            (deposit) => {

                const statusMatches =
                    currentStatus === "all" ||
                    deposit.status ===
                        currentStatus;


                if (!statusMatches) {

                    return false;
                }


                if (!search) {

                    return true;
                }


                const searchable = [

                    deposit.customerName,

                    deposit.phone,

                    deposit.email,

                    deposit.reference,

                    deposit.method,

                    deposit.network,

                    deposit.merchantCode

                ]
                    .join(" ")
                    .toLowerCase();


                return searchable.includes(
                    search
                );
            }
        );


    currentPage = 1;


    renderDeposits();
}


/* =========================================================
   RENDER DEPOSITS
   ========================================================= */

function renderDeposits() {

    const list =
        $("depositsMobileList");


    const empty =
        $("depositEmpty");


    const count =
        $("depositCount");


    if (!list) {

        return;
    }


    if (count) {

        const total =
            filteredDeposits.length;


        count.textContent =
            `${total} ${
                total === 1
                    ? "deposit"
                    : "deposits"
            }`;
    }


    const start =
        (
            currentPage - 1
        ) *
        ITEMS_PER_PAGE;


    const pageItems =
        filteredDeposits.slice(
            start,
            start + ITEMS_PER_PAGE
        );


    if (!pageItems.length) {

        list.innerHTML =
            "";


        if (empty) {

            empty.hidden =
                false;
        }


        renderPagination();


        return;
    }


    if (empty) {

        empty.hidden =
            true;
    }


    list.innerHTML =
        pageItems
            .map(
                renderDepositCard
            )
            .join("");


    renderPagination();
}


/* =========================================================
   DEPOSIT CARD
   ========================================================= */

function renderDepositCard(
    deposit
) {

    const status =
        capitalize(
            deposit.status
        );


    const method =
        formatMethod(
            deposit.method
        );


    const amount =
        formatCurrency(
            deposit.amount
        );


    const date =
        formatDate(
            deposit.createdAt
        );


    const pending =
        deposit.status ===
        "pending";


    const phone =
        deposit.phone ||
        "Not provided";


    const email =
        deposit.email ||
        "No email provided";


    const merchantCode =
        deposit.merchantCode ||
        "Not provided";


    const reference =
        deposit.reference ||
        "Not provided";


    return `
        <article
            class="deposit-card"
            data-deposit-id="${escapeAttr(
                deposit.id
            )}"
        >

            <div class="deposit-card-header">

                <div class="deposit-customer">

                    <h3 class="deposit-customer-name">
                        ${escapeHtml(
                            deposit.customerName
                        )}
                    </h3>

                    <p class="deposit-phone">
                        ${escapeHtml(
                            phone
                        )}
                    </p>

                    <p class="deposit-email">
                        ${escapeHtml(
                            email
                        )}
                    </p>

                </div>


                <span class="deposit-status">
                    ${escapeHtml(
                        status
                    )}
                </span>

            </div>


            <div class="payment-section">

                <div class="payment-label">
                    PAYMENT
                </div>


                <div class="deposit-amount-row">

                    <div>

                        <span class="amount-label">
                            Amount
                        </span>

                        <strong class="deposit-amount">
                            ${escapeHtml(
                                amount
                            )}
                        </strong>

                    </div>


                    <span class="payment-method">
                        ${escapeHtml(
                            method
                        )}
                    </span>

                </div>


                <div class="deposit-details">


                    <div class="deposit-detail">

                        <span class="deposit-detail-label">
                            Merchant Code
                        </span>

                        <span class="deposit-detail-value">
                            ${escapeHtml(
                                merchantCode
                            )}
                        </span>

                    </div>


                    <div class="deposit-detail">

                        <span class="deposit-detail-label">
                            Submitted
                        </span>

                        <span class="deposit-detail-value">
                            ${escapeHtml(
                                date
                            )}
                        </span>

                    </div>


                    <div class="deposit-detail">

                        <span class="deposit-detail-label">
                            Payment / Transaction Reference
                        </span>

                        <span class="deposit-detail-value">
                            ${escapeHtml(
                                reference
                            )}
                        </span>

                    </div>


                    <div class="deposit-detail">

                        <span class="deposit-detail-label">
                            Network
                        </span>

                        <span class="deposit-detail-value">
                            ${escapeHtml(
                                formatMethod(
                                    deposit.network
                                )
                            )}
                        </span>

                    </div>


                    <div class="deposit-detail">

                        <span class="deposit-detail-label">
                            Deposit Status
                        </span>

                        <span class="deposit-detail-value">
                            ${escapeHtml(
                                status
                            )}
                        </span>

                    </div>


                </div>


                ${
                    pending
                        ? `
                        <div class="deposit-actions">

                            <button
                                type="button"
                                class="deposit-action approve"
                                data-action="approve"
                                data-id="${escapeAttr(
                                    deposit.id
                                )}"
                            >
                                Approve
                            </button>


                            <button
                                type="button"
                                class="deposit-action reject"
                                data-action="reject"
                                data-id="${escapeAttr(
                                    deposit.id
                                )}"
                            >
                                Reject
                            </button>

                        </div>
                        `
                        : ""
                }

            </div>

        </article>
    `;
}


/* =========================================================
   PAGINATION
   ========================================================= */

function renderPagination() {

    const container =
        $("depositPagination");


    if (!container) {

        return;
    }


    const totalPages =
        Math.ceil(
            filteredDeposits.length /
            ITEMS_PER_PAGE
        );


    if (totalPages <= 1) {

        container.innerHTML =
            "";

        return;
    }


    let html =
        "";


    for (
        let page = 1;
        page <= totalPages;
        page++
    ) {

        html += `
            <button
                type="button"
                class="${
                    page === currentPage
                        ? "active"
                        : ""
                }"
                data-page="${page}"
            >
                ${page}
            </button>
        `;
    }


    container.innerHTML =
        html;
}


/* =========================================================
   OPEN REVIEW MODAL
   ========================================================= */

function openReviewModal(
    deposit
) {

    selectedDeposit =
        deposit;


    const modal =
        $("depositModal");


    const details =
        $("depositReviewDetails");


    const checkbox =
        $("paymentVerified");


    if (
        !modal ||
        !details
    ) {

        return;
    }


    details.innerHTML = `

        <div class="review-row">

            <span>
                Customer
            </span>

            <span>
                ${escapeHtml(
                    deposit.customerName
                )}
            </span>

        </div>


        <div class="review-row">

            <span>
                Email
            </span>

            <span>
                ${escapeHtml(
                    deposit.email ||
                    "Not provided"
                )}
            </span>

        </div>


        <div class="review-row">

            <span>
                Phone
            </span>

            <span>
                ${escapeHtml(
                    deposit.phone ||
                    "Not provided"
                )}
            </span>

        </div>


        <div class="review-row">

            <span>
                Amount
            </span>

            <span>
                ${escapeHtml(
                    formatCurrency(
                        deposit.amount
                    )
                )}
            </span>

        </div>


        <div class="review-row">

            <span>
                Payment Method
            </span>

            <span>
                ${escapeHtml(
                    formatMethod(
                        deposit.method
                    )
                )}
            </span>

        </div>


        <div class="review-row">

            <span>
                Merchant Code
            </span>

            <span>
                ${escapeHtml(
                    deposit.merchantCode ||
                    "Not provided"
                )}
            </span>

        </div>


        <div class="review-row">

            <span>
                Reference
            </span>

            <span>
                ${escapeHtml(
                    deposit.reference ||
                    "Not provided"
                )}
            </span>

        </div>


        <div class="review-row">

            <span>
                Status
            </span>

            <span>
                ${escapeHtml(
                    capitalize(
                        deposit.status
                    )
                )}
            </span>

        </div>


        <div class="review-row">

            <span>
                Submitted
            </span>

            <span>
                ${escapeHtml(
                    formatDate(
                        deposit.createdAt
                    )
                )}
            </span>

        </div>

    `;


    if (checkbox) {

        checkbox.checked =
            false;
    }


    const approve =
        $("approveDepositButton");


    if (approve) {

        approve.disabled =
            false;

        approve.textContent =
            "Approve Deposit";
    }


    modal.classList.add(
        "show"
    );


    modal.setAttribute(
        "aria-hidden",
        "false"
    );
}


/* =========================================================
   CLOSE REVIEW MODAL
   ========================================================= */

function closeReviewModal() {

    const modal =
        $("depositModal");


    if (!modal) {

        return;
    }


    modal.classList.remove(
        "show"
    );


    modal.setAttribute(
        "aria-hidden",
        "true"
    );


    selectedDeposit =
        null;
}


/* =========================================================
   PROCESS DEPOSIT
   ========================================================= */

async function processDeposit(
    deposit,
    action,
    paymentVerified = false
) {

    if (!deposit) {

        return;
    }


    if (
        action === "approve" &&
        !paymentVerified
    ) {

        showMessage(
            "Please verify the customer's payment before approving.",
            "error"
        );

        return;
    }


    const actionText =
        action === "approve"
            ? "approve"
            : "reject";


    const confirmed =
        window.confirm(
            `Are you sure you want to ${actionText} this deposit of ${formatCurrency(
                deposit.amount
            )}?`
        );


    if (!confirmed) {

        return;
    }


    try {

        const response =
            await fetchJson(
                DEPOSITS_API,
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body:
                        JSON.stringify({

                            deposit_id:
                                deposit.id,

                            action:
                                action,

                            payment_verified:
                                action ===
                                "approve"
                                    ? true
                                    : false

                        })
                }
            );


        if (
            !response ||
            response.success !== true
        ) {

            throw new Error(
                response?.message ||
                `Unable to ${actionText} deposit.`
            );
        }


        showMessage(
            response.message ||
            `Deposit ${actionText}d successfully.`,
            "success"
        );


        closeReviewModal();


        await loadDeposits();


    } catch (error) {

        console.error(
            "Deposit action error:",
            error
        );


        showMessage(
            error.message ||
            `Unable to ${actionText} deposit.`,
            "error"
        );
    }
}


/* =========================================================
   EVENT HANDLING
   ========================================================= */

function setupEvents() {


    /* -----------------------------------------------------
       SEARCH
       ----------------------------------------------------- */

    const search =
        $("depositSearch");


    if (search) {

        search.addEventListener(
            "input",
            applyFilters
        );
    }


    /* -----------------------------------------------------
       STATUS TABS
       ----------------------------------------------------- */

    document
        .querySelectorAll(
            ".deposit-tab"
        )
        .forEach(
            (button) => {

                button.addEventListener(
                    "click",
                    () => {

                        document
                            .querySelectorAll(
                                ".deposit-tab"
                            )
                            .forEach(
                                (tab) => {

                                    tab.classList.remove(
                                        "active"
                                    );
                                }
                            );


                        button.classList.add(
                            "active"
                        );


                        currentStatus =
                            button.dataset.status ||
                            "pending";


                        applyFilters();
                    }
                );
            }
        );


    /* -----------------------------------------------------
       REFRESH
       ----------------------------------------------------- */

    const refresh =
        $("refreshDepositsBtn");


    if (refresh) {

        refresh.addEventListener(
            "click",
            loadDeposits
        );
    }


    /* -----------------------------------------------------
       DEPOSIT ACTIONS
       ----------------------------------------------------- */

    const list =
        $("depositsMobileList");


    if (list) {

        list.addEventListener(
            "click",
            (event) => {

                const button =
                    event.target.closest(
                        "[data-action]"
                    );


                if (!button) {

                    return;
                }


                const id =
                    button.dataset.id;


                const deposit =
                    deposits.find(
                        (item) =>
                            item.id === id
                    );


                if (!deposit) {

                    showMessage(
                        "Deposit could not be found.",
                        "error"
                    );

                    return;
                }


                const action =
                    button.dataset.action;


                if (
                    action ===
                    "approve"
                ) {

                    openReviewModal(
                        deposit
                    );

                } else if (
                    action ===
                    "reject"
                ) {

                    processDeposit(
                        deposit,
                        "reject",
                        false
                    );
                }
            }
        );
    }


    /* -----------------------------------------------------
       PAGINATION
       ----------------------------------------------------- */

    const pagination =
        $("depositPagination");


    if (pagination) {

        pagination.addEventListener(
            "click",
            (event) => {

                const button =
                    event.target.closest(
                        "[data-page]"
                    );


                if (!button) {

                    return;
                }


                currentPage =
                    Number(
                        button.dataset.page
                    ) || 1;


                renderDeposits();


                window.scrollTo({
                    top: 0,
                    behavior: "smooth"
                });
            }
        );
    }


    /* -----------------------------------------------------
       MODAL CLOSE
       ----------------------------------------------------- */

    $("closeDepositModal")
        ?.addEventListener(
            "click",
            closeReviewModal
        );


    $("cancelDepositReview")
        ?.addEventListener(
            "click",
            closeReviewModal
        );


    /* -----------------------------------------------------
       CLICK OUTSIDE MODAL
       ----------------------------------------------------- */

    $("depositModal")
        ?.addEventListener(
            "click",
            (event) => {

                const modal =
                    $("depositModal");


                if (
                    modal &&
                    event.target ===
                    modal
                ) {

                    closeReviewModal();
                }
            }
        );


    /* -----------------------------------------------------
       APPROVE DEPOSIT
       ----------------------------------------------------- */

    $("approveDepositButton")
        ?.addEventListener(
            "click",
            async () => {

                if (!selectedDeposit) {

                    return;
                }


                const checkbox =
                    $("paymentVerified");


                const verified =
                    checkbox?.checked === true;


                if (!verified) {

                    showMessage(
                        "Please verify the customer's payment before approving.",
                        "error"
                    );

                    return;
                }


                const button =
                    $("approveDepositButton");


                if (button) {

                    button.disabled =
                        true;

                    button.textContent =
                        "Approving...";
                }


                await processDeposit(
                    selectedDeposit,
                    "approve",
                    true
                );


                /*
                 * If processDeposit succeeded,
                 * the modal is closed.
                 *
                 * If it failed, restore the
                 * button so the admin can retry.
                 */

                if (button) {

                    button.disabled =
                        false;

                    button.textContent =
                        "Approve Deposit";
                }
            }
        );


    /* -----------------------------------------------------
       ESCAPE KEY
       ----------------------------------------------------- */

    document.addEventListener(
        "keydown",
        (event) => {

            if (
                event.key ===
                "Escape"
            ) {

                closeReviewModal();
            }
        }
    );


    /* -----------------------------------------------------
       SIDEBAR
       ----------------------------------------------------- */

    const sidebar =
        $("sidebar");


    const overlay =
        $("sidebarOverlay");


    const menuButton =
        $("menuButton");


    const closeButton =
        $("sidebarClose");


    function openSidebar() {

        sidebar?.classList.add(
            "active"
        );


        overlay?.classList.add(
            "active"
        );


        document.body.classList.add(
            "sidebar-open"
        );
    }


    function closeSidebar() {

        sidebar?.classList.remove(
            "active"
        );


        overlay?.classList.remove(
            "active"
        );


        document.body.classList.remove(
            "sidebar-open"
        );
    }


    menuButton?.addEventListener(
        "click",
        openSidebar
    );


    closeButton?.addEventListener(
        "click",
        closeSidebar
    );


    overlay?.addEventListener(
        "click",
        closeSidebar
    );


    /* -----------------------------------------------------
       CLOSE SIDEBAR AFTER NAVIGATION
       ----------------------------------------------------- */

    document
        .querySelectorAll(
            ".admin-nav-link"
        )
        .forEach(
            (link) => {

                link.addEventListener(
                    "click",
                    closeSidebar
                );
            }
        );


    /* -----------------------------------------------------
       LOGOUT
       ----------------------------------------------------- */

    $("logoutButton")
        ?.addEventListener(
            "click",
            async () => {

                const confirmed =
                    window.confirm(
                        "Are you sure you want to logout?"
                    );


                if (!confirmed) {

                    return;
                }


                try {

                    await fetchJson(
                        LOGOUT_API,
                        {
                            method: "GET"
                        }
                    );

                } catch (error) {

                    console.warn(
                        "Logout request failed:",
                        error
                    );

                } finally {

                    window.location.href =
                        "login.html";
                }
            }
        );
}


/* =========================================================
   HELPERS
   ========================================================= */

function formatCurrency(
    amount
) {

    const value =
        Number(amount) || 0;


    return (
        "UGX " +
        value.toLocaleString(
            "en-UG"
        )
    );
}


/* =========================================================
   FORMAT PAYMENT METHOD
   ========================================================= */

function formatMethod(
    method
) {

    const value =
        String(
            method || ""
        )
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


    return (
        method ||
        "Unknown"
    );
}


/* =========================================================
   FORMAT DATE
   ========================================================= */

function formatDate(
    value
) {

    if (!value) {

        return "Not available";
    }


    try {

        let date;


        if (
            typeof value ===
                "object" &&
            value.$date
        ) {

            date =
                new Date(
                    value.$date
                );

        } else {

            date =
                new Date(
                    value
                );
        }


        if (
            Number.isNaN(
                date.getTime()
            )
        ) {

            return String(
                value
            );
        }


        return date.toLocaleString(
            "en-GB",
            {
                day:
                    "2-digit",

                month:
                    "short",

                year:
                    "numeric",

                hour:
                    "2-digit",

                minute:
                    "2-digit"
            }
        );

    } catch (error) {

        return String(
            value
        );
    }
}


/* =========================================================
   CAPITALIZE
   ========================================================= */

function capitalize(
    value
) {

    const text =
        String(
            value || ""
        );


    return text
        ? text.charAt(0).toUpperCase() +
          text.slice(1)

        : "";
}


/* =========================================================
   ESCAPE HTML
   ========================================================= */

function escapeHtml(
    value
) {

    return String(
        value ?? ""
    )
        .replaceAll(
            "&",
            "&amp;"
        )
        .replaceAll(
            "<",
            "&lt;"
        )
        .replaceAll(
            ">",
            "&gt;"
        )
        .replaceAll(
            '"',
            "&quot;"
        )
        .replaceAll(
            "'",
            "&#039;"
        );
}


/* =========================================================
   ESCAPE ATTRIBUTE
   ========================================================= */

function escapeAttr(
    value
) {

    return escapeHtml(
        value
    );
}


/* =========================================================
   INITIALIZATION
   ========================================================= */

async function initializeDepositsPage() {

    const authorized =
        await verifyAdministrator();


    if (!authorized) {

        return;
    }


    await loadAdminProfile();


    setupEvents();


    await loadDeposits();
}


/* =========================================================
   GLOBAL API
   ========================================================= */

window.CrownCashAdminDeposits = {

    reload:
        loadDeposits,

    refresh:
        loadDeposits,

    filter:
        applyFilters

};


/* =========================================================
   START
   ========================================================= */

if (
    document.readyState ===
    "loading"
) {

    document.addEventListener(
        "DOMContentLoaded",
        initializeDepositsPage
    );

} else {

    initializeDepositsPage();
}