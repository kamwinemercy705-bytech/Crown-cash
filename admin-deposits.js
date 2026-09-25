/* =========================================================
   CROWN CASH ADMIN — DEPOSITS
========================================================= */

"use strict";


const API_BASE =
    "https://crown-cash1.onrender.com";

const ADMIN_AUTH_API =
    `${API_BASE}/admin-auth.php`;

const PROFILE_API =
    `${API_BASE}/profile.php`;

const DEPOSITS_API =
    `${API_BASE}/admin-deposits.php`;

const LOGOUT_API =
    `${API_BASE}/logout.php`;


/* =========================================================
   STATE
========================================================= */

const state = {
    authenticated: false,
    deposits: [],
    filteredDeposits: [],
    currentPage: 1,
    perPage: 10
};


/* =========================================================
   HELPERS
========================================================= */

function $(id) {
    return document.getElementById(id);
}


function escapeHtml(value) {

    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


function formatMoney(value) {

    const number = Number(value || 0);

    return new Intl.NumberFormat("en-UG", {
        maximumFractionDigits: 0
    }).format(number);
}


function formatUGX(value) {

    return `UGX ${formatMoney(value)}`;
}


function formatDate(value) {

    if (!value) {
        return "—";
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return "—";
    }

    return date.toLocaleDateString("en-UG", {
        day: "2-digit",
        month: "short",
        year: "numeric"
    });
}


function normalizeStatus(value) {

    return String(value || "pending")
        .toLowerCase()
        .trim();
}


function normalizeMethod(value) {

    const method =
        String(value || "")
            .toLowerCase()
            .trim();

    if (
        method.includes("airtel")
    ) {
        return "airtel";
    }

    return "mtn";
}


function methodLabel(value) {

    return normalizeMethod(value) === "airtel"
        ? "Airtel Money"
        : "MTN Mobile Money";
}


function getInitials(name) {

    const text =
        String(name || "User")
            .trim();

    if (!text) {
        return "U";
    }

    const parts =
        text.split(/\s+/);

    if (parts.length === 1) {
        return parts[0]
            .substring(0, 1)
            .toUpperCase();
    }

    return (
        parts[0][0] +
        parts[1][0]
    ).toUpperCase();
}


function showMessage(
    message,
    type = "info"
) {

    const element =
        $("depositsMessage");

    if (!element) {
        return;
    }

    element.hidden = false;

    element.className =
        `admin-message ${type}`;

    element.textContent =
        message;
}


function hideMessage() {

    const element =
        $("depositsMessage");

    if (!element) {
        return;
    }

    element.hidden = true;
}


function hideLoader() {

    const loader =
        $("pageLoader");

    if (!loader) {
        return;
    }

    loader.classList.add("hidden");
}


/* =========================================================
   FETCH JSON
========================================================= */

async function fetchJson(
    url,
    options = {}
) {

    const response =
        await fetch(url, {
            credentials: "include",

            cache: "no-store",

            ...options,

            headers: {
                Accept:
                    "application/json",

                ...(options.headers || {})
            }
        });

    let data = null;

    try {
        data =
            await response.json();
    } catch (error) {
        data = null;
    }

    return {
        response,
        data
    };
}


/* =========================================================
   ADMIN AUTHENTICATION
========================================================= */

async function verifyAdministrator() {

    try {

        const {
            response,
            data
        } = await fetchJson(
            ADMIN_AUTH_API,
            {
                method: "GET"
            }
        );


        if (
            response.ok &&
            data &&
            data.success === true &&
            data.authenticated === true &&
            data.authorized === true
        ) {

            state.authenticated = true;

            return true;
        }


        state.authenticated = false;


        if (response.status === 401) {

            showMessage(
                data?.message ||
                "Your administrator session has expired. Please login again.",
                "error"
            );

            return false;
        }


        if (response.status === 403) {

            showMessage(
                data?.message ||
                "Administrator access is required to view deposits.",
                "error"
            );

            return false;
        }


        showMessage(
            data?.message ||
            "Administrator verification failed. Please try again.",
            "error"
        );

        return false;

    } catch (error) {

        console.error(
            "Admin authentication error:",
            error
        );

        showMessage(
            "Unable to verify the administrator session. Please refresh and try again.",
            "error"
        );

        return false;
    }
}


/* =========================================================
   LOAD ADMIN PROFILE
========================================================= */

async function loadAdminProfile() {

    try {

        const {
            response,
            data
        } = await fetchJson(
            PROFILE_API,
            {
                method: "GET"
            }
        );


        if (
            !response.ok ||
            !data ||
            data.success !== true ||
            !data.user
        ) {
            return;
        }


        const user =
            data.user;


        const fullName =
            user.full_name ||
            [
                user.first_name,
                user.last_name
            ]
                .filter(Boolean)
                .join(" ") ||
            "Administrator";


        const firstLetter =
            fullName
                .charAt(0)
                .toUpperCase();


        if ($("adminName")) {
            $("adminName").textContent =
                fullName;
        }


        if ($("headerUserName")) {
            $("headerUserName").textContent =
                fullName;
        }


        if ($("adminAvatar")) {
            $("adminAvatar").textContent =
                firstLetter;
        }


        if ($("accountAvatar")) {
            $("accountAvatar").textContent =
                firstLetter;
        }


        if ($("adminAccountType")) {

            $("adminAccountType").textContent =
                user.account_type ||
                user.role ||
                "Admin Account";
        }

    } catch (error) {

        console.warn(
            "Admin profile could not be loaded:",
            error
        );
    }
}


/* =========================================================
   LOAD DEPOSITS
========================================================= */

async function loadDeposits() {

    if (!state.authenticated) {
        return;
    }


    setLoading(true);

    hideMessage();


    try {

        const {
            response,
            data
        } = await fetchJson(
            DEPOSITS_API,
            {
                method: "GET"
            }
        );


        if (
            response.status === 401
        ) {

            showMessage(
                data?.message ||
                "Administrator session expired. Please login again.",
                "error"
            );

            state.authenticated = false;

            return;
        }


        if (
            response.status === 403
        ) {

            showMessage(
                data?.message ||
                "Administrator access is required.",
                "error"
            );

            return;
        }


        if (
            !response.ok ||
            !data ||
            data.success !== true
        ) {

            throw new Error(
                data?.message ||
                "Unable to load deposits."
            );
        }


        state.deposits =
            Array.isArray(data.deposits)
                ? data.deposits
                : [];


        updateStatistics(
            data.stats || {}
        );


        applyFilters();

    } catch (error) {

        console.error(
            "Deposit loading error:",
            error
        );

        state.deposits = [];

        updateStatistics({});

        renderDeposits();

        showMessage(
            error.message ||
            "Unable to load deposits.",
            "error"
        );

    } finally {

        setLoading(false);
    }
}


/* =========================================================
   LOADING STATE
========================================================= */

function setLoading(isLoading) {

    const loading =
        $("depositsLoading");

    const empty =
        $("depositsEmpty");

    const table =
        $("depositsTableWrapper");

    const mobile =
        $("depositMobileList");


    if (isLoading) {

        if (loading) {
            loading.hidden = false;
        }

        if (empty) {
            empty.hidden = true;
        }

        if (table) {
            table.hidden = true;
        }

        if (mobile) {
            mobile.hidden = true;
        }

    } else {

        if (loading) {
            loading.hidden = true;
        }
    }
}


/* =========================================================
   STATISTICS
========================================================= */

function updateStatistics(stats) {

    let total =
        Number(
            stats.total_deposits_amount ??
            stats.total_amount ??
            0
        );

    let pending =
        Number(
            stats.pending_amount ??
            stats.pending_deposits_amount ??
            0
        );

    let approved =
        Number(
            stats.approved_amount ??
            stats.approved_deposits_amount ??
            0
        );

    let rejected =
        Number(
            stats.rejected_amount ??
            stats.rejected_deposits_amount ??
            0
        );


    /* fallback calculation */

    if (
        !stats.total_deposits_amount &&
        !stats.total_amount
    ) {

        total =
            state.deposits.reduce(
                (sum, deposit) =>
                    sum +
                    Number(
                        deposit.amount || 0
                    ),
                0
            );


        pending =
            state.deposits
                .filter(
                    deposit =>
                        normalizeStatus(
                            deposit.status
                        ) === "pending"
                )
                .reduce(
                    (sum, deposit) =>
                        sum +
                        Number(
                            deposit.amount || 0
                        ),
                    0
                );


        approved =
            state.deposits
                .filter(
                    deposit =>
                        normalizeStatus(
                            deposit.status
                        ) === "approved"
                )
                .reduce(
                    (sum, deposit) =>
                        sum +
                        Number(
                            deposit.amount || 0
                        ),
                    0
                );


        rejected =
            state.deposits
                .filter(
                    deposit =>
                        normalizeStatus(
                            deposit.status
                        ) === "rejected"
                )
                .reduce(
                    (sum, deposit) =>
                        sum +
                        Number(
                            deposit.amount || 0
                        ),
                    0
                );
    }


    if ($("totalDeposits")) {
        $("totalDeposits").textContent =
            formatUGX(total);
    }


    if ($("pendingDeposits")) {
        $("pendingDeposits").textContent =
            formatUGX(pending);
    }


    if ($("approvedDeposits")) {
        $("approvedDeposits").textContent =
            formatUGX(approved);
    }


    if ($("rejectedDeposits")) {
        $("rejectedDeposits").textContent =
            formatUGX(rejected);
    }
}


/* =========================================================
   FILTERS
========================================================= */

function applyFilters() {

    const search =
        String(
            $("searchDeposits")?.value ||
            ""
        )
            .toLowerCase()
            .trim();


    const status =
        $("statusFilter")?.value ||
        "all";


    const method =
        $("methodFilter")?.value ||
        "all";


    state.filteredDeposits =
        state.deposits.filter(
            deposit => {

                const customer =
                    String(
                        deposit.full_name ||
                        deposit.user_name ||
                        deposit.name ||
                        ""
                    )
                        .toLowerCase();


                const phone =
                    String(
                        deposit.phone ||
                        ""
                    )
                        .toLowerCase();


                const email =
                    String(
                        deposit.email ||
                        ""
                    )
                        .toLowerCase();


                const reference =
                    String(
                        deposit.reference ||
                        deposit.transaction_reference ||
                        deposit.payment_reference ||
                        ""
                    )
                        .toLowerCase();


                const depositStatus =
                    normalizeStatus(
                        deposit.status
                    );


                const depositMethod =
                    normalizeMethod(
                        deposit.payment_method ||
                        deposit.method
                    );


                const matchesSearch =
                    !search ||
                    customer.includes(search) ||
                    phone.includes(search) ||
                    email.includes(search) ||
                    reference.includes(search);


                const matchesStatus =
                    status === "all" ||
                    depositStatus === status;


                const matchesMethod =
                    method === "all" ||
                    depositMethod === method;


                return (
                    matchesSearch &&
                    matchesStatus &&
                    matchesMethod
                );
            }
        );


    state.currentPage = 1;

    renderDeposits();
}


/* =========================================================
   RENDER
========================================================= */

function renderDeposits() {

    const list =
        state.filteredDeposits;


    const empty =
        $("depositsEmpty");

    const table =
        $("depositsTableWrapper");

    const mobile =
        $("depositMobileList");


    if (!list.length) {

        if (empty) {
            empty.hidden = false;
        }

        if (table) {
            table.hidden = true;
        }

        if (mobile) {
            mobile.hidden = true;
        }

        renderPagination();

        return;
    }


    if (empty) {
        empty.hidden = true;
    }


    const start =
        (state.currentPage - 1) *
        state.perPage;


    const end =
        start + state.perPage;


    const pageItems =
        list.slice(start, end);


    renderDesktopTable(
        pageItems
    );


    renderMobileCards(
        pageItems
    );


    renderPagination();
}


/* =========================================================
   DESKTOP TABLE
========================================================= */

function renderDesktopTable(items) {

    const wrapper =
        $("depositsTableWrapper");

    const body =
        $("depositsTableBody");


    if (!wrapper || !body) {
        return;
    }


    wrapper.hidden = false;


    body.innerHTML =
        items.map(
            deposit =>
                createTableRow(deposit)
        ).join("");
}


function createTableRow(deposit) {

    const name =
        deposit.full_name ||
        deposit.user_name ||
        deposit.name ||
        "Customer";


    const email =
        deposit.email || "";


    const amount =
        Number(
            deposit.amount || 0
        );


    const method =
        normalizeMethod(
            deposit.payment_method ||
            deposit.method
        );


    const reference =
        deposit.reference ||
        deposit.transaction_reference ||
        deposit.payment_reference ||
        "—";


    const status =
        normalizeStatus(
            deposit.status
        );


    const date =
        deposit.created_at ||
        deposit.date ||
        deposit.submitted_at;


    const id =
        deposit.id ||
        deposit._id ||
        "";


    const actions =
        status === "pending"
            ? `
                <div class="action-buttons">

                    <button
                        type="button"
                        class="deposit-action view"
                        data-action="view"
                        data-id="${escapeHtml(id)}"
                        title="View deposit"
                    >
                        <svg viewBox="0 0 24 24">
                            <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12z"/>
                            <circle cx="12" cy="12" r="2.5"/>
                        </svg>
                    </button>

                    <button
                        type="button"
                        class="deposit-action approve"
                        data-action="approve"
                        data-id="${escapeHtml(id)}"
                        title="Approve deposit"
                    >
                        <svg viewBox="0 0 24 24">
                            <path d="M5 12l4 4L19 6"/>
                        </svg>
                    </button>

                    <button
                        type="button"
                        class="deposit-action reject"
                        data-action="reject"
                        data-id="${escapeHtml(id)}"
                        title="Reject deposit"
                    >
                        <svg viewBox="0 0 24 24">
                            <path d="M6 6l12 12"/>
                            <path d="M18 6L6 18"/>
                        </svg>
                    </button>

                </div>
            `
            : `
                <button
                    type="button"
                    class="deposit-action view"
                    data-action="view"
                    data-id="${escapeHtml(id)}"
                    title="View deposit"
                >
                    <svg viewBox="0 0 24 24">
                        <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12z"/>
                        <circle cx="12" cy="12" r="2.5"/>
                    </svg>
                </button>
            `;


    return `
        <tr>

            <td>

                <div class="customer-cell">

                    <div class="customer-avatar">

                        <svg viewBox="0 0 24 24">
                            <circle cx="12" cy="8" r="3"/>
                            <path d="M5 20c.5-3.5 2.8-5.5 7-5.5s6.5 2 7 5.5"/>
                        </svg>

                    </div>

                    <div class="customer-info">

                        <strong>
                            ${escapeHtml(name)}
                        </strong>

                        <span>
                            ${escapeHtml(email)}
                        </span>

                    </div>

                </div>

            </td>


            <td>

                <span class="amount-value">
                    ${formatUGX(amount)}
                </span>

            </td>


            <td>

                <span class="method-badge ${method}">

                    <span class="method-dot"></span>

                    ${methodLabel(method)}

                </span>

            </td>


            <td>

                <span class="reference-value">
                    ${escapeHtml(reference)}
                </span>

            </td>


            <td>
                ${formatDate(date)}
            </td>


            <td>

                <span class="status-badge ${escapeHtml(status)}">
                    ${escapeHtml(status)}
                </span>

            </td>


            <td>
                ${actions}
            </td>

        </tr>
    `;
}


/* =========================================================
   MOBILE CARDS
========================================================= */

function renderMobileCards(items) {

    const container =
        $("depositMobileList");

    if (!container) {
        return;
    }


    container.hidden = false;


    container.innerHTML =
        items.map(
            deposit =>
                createMobileCard(deposit)
        ).join("");
}


function createMobileCard(deposit) {

    const name =
        deposit.full_name ||
        deposit.user_name ||
        deposit.name ||
        "Customer";


    const amount =
        Number(
            deposit.amount || 0
        );


    const method =
        normalizeMethod(
            deposit.payment_method ||
            deposit.method
        );


    const reference =
        deposit.reference ||
        deposit.transaction_reference ||
        deposit.payment_reference ||
        "—";


    const status =
        normalizeStatus(
            deposit.status
        );


    const date =
        deposit.created_at ||
        deposit.date ||
        deposit.submitted_at;


    const id =
        deposit.id ||
        deposit._id ||
        "";


    let actions = `
        <button
            type="button"
            class="deposit-action view"
            data-action="view"
            data-id="${escapeHtml(id)}"
        >
            <svg viewBox="0 0 24 24">
                <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12z"/>
                <circle cx="12" cy="12" r="2.5"/>
            </svg>
        </button>
    `;


    if (status === "pending") {

        actions += `
            <button
                type="button"
                class="deposit-action approve"
                data-action="approve"
                data-id="${escapeHtml(id)}"
            >
                <svg viewBox="0 0 24 24">
                    <path d="M5 12l4 4L19 6"/>
                </svg>
            </button>

            <button
                type="button"
                class="deposit-action reject"
                data-action="reject"
                data-id="${escapeHtml(id)}"
            >
                <svg viewBox="0 0 24 24">
                    <path d="M6 6l12 12"/>
                    <path d="M18 6L6 18"/>
                </svg>
            </button>
        `;
    }


    return `
        <article class="deposit-mobile-card">

            <div class="mobile-deposit-top">

                <div class="mobile-customer">

                    <div class="customer-avatar">

                        <svg viewBox="0 0 24 24">
                            <circle cx="12" cy="8" r="3"/>
                            <path d="M5 20c.5-3.5 2.8-5.5 7-5.5s6.5 2 7 5.5"/>
                        </svg>

                    </div>

                    <div class="customer-info">

                        <strong>
                            ${escapeHtml(name)}
                        </strong>

                        <span>
                            ${formatDate(date)}
                        </span>

                    </div>

                </div>

                <span class="status-badge ${escapeHtml(status)}">
                    ${escapeHtml(status)}
                </span>

            </div>


            <div class="mobile-deposit-details">

                <div class="mobile-detail">

                    <span>
                        Amount
                    </span>

                    <strong>
                        ${formatUGX(amount)}
                    </strong>

                </div>


                <div class="mobile-detail">

                    <span>
                        Method
                    </span>

                    <strong>
                        ${methodLabel(method)}
                    </strong>

                </div>


                <div class="mobile-detail">

                    <span>
                        Reference
                    </span>

                    <strong>
                        ${escapeHtml(reference)}
                    </strong>

                </div>


                <div class="mobile-detail">

                    <span>
                        Phone
                    </span>

                    <strong>
                        ${escapeHtml(
                            deposit.phone || "—"
                        )}
                    </strong>

                </div>

            </div>


            <div class="mobile-actions">
                ${actions}
            </div>

        </article>
    `;
}


/* =========================================================
   PAGINATION
========================================================= */

function renderPagination() {

    const container =
        $("pagination");

    if (!container) {
        return;
    }


    const totalPages =
        Math.ceil(
            state.filteredDeposits.length /
            state.perPage
        );


    if (totalPages <= 1) {

        container.hidden = true;

        container.innerHTML = "";

        return;
    }


    container.hidden = false;


    let html = "";


    html += `
        <button
            type="button"
            class="page-button"
            data-page="${state.currentPage - 1}"
            ${state.currentPage === 1 ? "disabled" : ""}
        >
            ‹
        </button>
    `;


    for (
        let page = 1;
        page <= totalPages;
        page++
    ) {

        html += `
            <button
                type="button"
                class="page-button ${
                    page === state.currentPage
                        ? "active"
                        : ""
                }"
                data-page="${page}"
            >
                ${page}
            </button>
        `;
    }


    html += `
        <button
            type="button"
            class="page-button"
            data-page="${state.currentPage + 1}"
            ${state.currentPage === totalPages ? "disabled" : ""}
        >
            ›
        </button>
    `;


    container.innerHTML = html;
}


/* =========================================================
   DEPOSIT ACTIONS
========================================================= */

async function processDeposit(
    id,
    action
) {

    const deposit =
        state.deposits.find(
            item =>
                String(
                    item.id ||
                    item._id ||
                    ""
                ) === String(id)
        );


    if (!deposit) {

        showMessage(
            "Deposit could not be found.",
            "error"
        );

        return;
    }


    const amount =
        Number(
            deposit.amount || 0
        );


    const actionText =
        action === "approve"
            ? "approve"
            : "reject";


    const confirmed =
        window.confirm(
            `Are you sure you want to ${actionText} this deposit of ${formatUGX(amount)}?`
        );


    if (!confirmed) {
        return;
    }


    try {

        showMessage(
            `${action === "approve" ? "Approving" : "Rejecting"} deposit...`,
            "info"
        );


        const {
            response,
            data
        } = await fetchJson(
            DEPOSITS_API,
            {
                method: "POST",

                headers: {
                    "Content-Type":
                        "application/json"
                },

                body: JSON.stringify({
                    deposit_id:
                        deposit.id ||
                        deposit._id,

                    action
                })
            }
        );


        if (
            response.status === 401
        ) {

            showMessage(
                "Administrator session expired. Please login again.",
                "error"
            );

            return;
        }


        if (
            response.status === 403
        ) {

            showMessage(
                data?.message ||
                "Administrator access is required.",
                "error"
            );

            return;
        }


        if (
            !response.ok ||
            !data ||
            data.success !== true
        ) {

            throw new Error(
                data?.message ||
                `Unable to ${actionText} deposit.`
            );
        }


        showMessage(
            data.message ||
            `Deposit ${action}d successfully.`,
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
            "Unable to update deposit.",
            "error"
        );
    }
}


/* =========================================================
   VIEW DEPOSIT
========================================================= */

function viewDeposit(id) {

    const deposit =
        state.deposits.find(
            item =>
                String(
                    item.id ||
                    item._id ||
                    ""
                ) === String(id)
        );


    if (!deposit) {
        return;
    }


    const name =
        deposit.full_name ||
        deposit.user_name ||
        deposit.name ||
        "Customer";


    const amount =
        Number(
            deposit.amount || 0
        );


    const method =
        methodLabel(
            deposit.payment_method ||
            deposit.method
        );


    const reference =
        deposit.reference ||
        deposit.transaction_reference ||
        deposit.payment_reference ||
        "—";


    const phone =
        deposit.phone ||
        "—";


    const status =
        normalizeStatus(
            deposit.status
        );


    const date =
        formatDate(
            deposit.created_at ||
            deposit.date ||
            deposit.submitted_at
        );


    window.alert(
        [
            "CROWN CASH DEPOSIT",
            "",
            `Customer: ${name}`,
            `Phone: ${phone}`,
            `Amount: ${formatUGX(amount)}`,
            `Method: ${method}`,
            `Reference: ${reference}`,
            `Status: ${status}`,
            `Date: ${date}`
        ].join("\n")
    );
}


/* =========================================================
   EVENTS
========================================================= */

function setupEvents() {


    $("searchDeposits")
        ?.addEventListener(
            "input",
            applyFilters
        );


    $("statusFilter")
        ?.addEventListener(
            "change",
            applyFilters
        );


    $("methodFilter")
        ?.addEventListener(
            "change",
            applyFilters
        );


    $("refreshDepositsBtn")
        ?.addEventListener(
            "click",
            loadDeposits
        );


    $("depositsTableBody")
        ?.addEventListener(
            "click",
            handleDepositAction
        );


    $("depositMobileList")
        ?.addEventListener(
            "click",
            handleDepositAction
        );


    $("pagination")
        ?.addEventListener(
            "click",
            event => {

                const button =
                    event.target.closest(
                        "[data-page]"
                    );


                if (!button) {
                    return;
                }


                if (button.disabled) {
                    return;
                }


                const page =
                    Number(
                        button.dataset.page
                    );


                if (
                    page < 1
                ) {
                    return;
                }


                state.currentPage =
                    page;


                renderDeposits();

                window.scrollTo({
                    top: 0,
                    behavior: "smooth"
                });
            }
        );


    $("menuButton")
        ?.addEventListener(
            "click",
            openSidebar
        );


    $("sidebarClose")
        ?.addEventListener(
            "click",
            closeSidebar
        );


    $("sidebarOverlay")
        ?.addEventListener(
            "click",
            closeSidebar
        );


    $("logoutBtn")
        ?.addEventListener(
            "click",
            logoutAdmin
        );
}


function handleDepositAction(event) {

    const button =
        event.target.closest(
            "[data-action]"
        );


    if (!button) {
        return;
    }


    const action =
        button.dataset.action;


    const id =
        button.dataset.id;


    if (action === "view") {

        viewDeposit(id);

        return;
    }


    if (
        action === "approve" ||
        action === "reject"
    ) {

        processDeposit(
            id,
            action
        );
    }
}


/* =========================================================
   SIDEBAR
========================================================= */

function openSidebar() {

    $("sidebar")
        ?.classList.add("open");

    $("sidebarOverlay")
        ?.classList.add("show");
}


function closeSidebar() {

    $("sidebar")
        ?.classList.remove("open");

    $("sidebarOverlay")
        ?.classList.remove("show");
}


/* =========================================================
   LOGOUT
========================================================= */

async function logoutAdmin() {

    const confirmed =
        window.confirm(
            "Are you sure you want to logout?"
        );


    if (!confirmed) {
        return;
    }


    try {

        await fetch(
            LOGOUT_API,
            {
                method: "POST",

                credentials: "include",

                headers: {
                    "Content-Type":
                        "application/json"
                }
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


/* =========================================================
   INITIALIZE
========================================================= */

async function initializeDepositsPage() {

    try {

        const authorized =
            await verifyAdministrator();


        if (!authorized) {

            return;
        }


        await loadAdminProfile();

        await loadDeposits();

    } finally {

        setTimeout(
            hideLoader,
            100
        );
    }
}


/* =========================================================
   GLOBAL API
========================================================= */

window.CrownCashAdminDeposits = {

    loadDeposits,

    applyFilters,

    refresh: loadDeposits
};


/* =========================================================
   START
========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    () => {

        setupEvents();

        initializeDepositsPage();
    }
);