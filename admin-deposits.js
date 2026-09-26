/* =========================================================
   CROWN CASH ADMINISTRATION
   ADMIN DEPOSITS JAVASCRIPT
   ========================================================= */

"use strict";

/* =========================================================
   API CONFIGURATION
   ========================================================= */

const API_BASE = "https://crown-cash1.onrender.com";

const ADMIN_AUTH_API =
    `${API_BASE}/admin-auth.php`;

const PROFILE_API =
    `${API_BASE}/profile.php`;

const DEPOSITS_API =
    `${API_BASE}/admin-deposits.php`;

const LOGOUT_API =
    `${API_BASE}/logout.php`;


/* =========================================================
   APPLICATION STATE
   ========================================================= */

const state = {
    authenticated: false,

    deposits: [],
    filteredDeposits: [],

    currentPage: 1,
    perPage: 10,

    currentDeposit: null,

    isLoading: false
};


/* =========================================================
   DOM HELPER
   ========================================================= */

function $(id) {
    return document.getElementById(id);
}


/* =========================================================
   SAFE TEXT
   ========================================================= */

function escapeHTML(value) {

    if (
        value === null ||
        value === undefined
    ) {
        return "";
    }

    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


/* =========================================================
   FETCH JSON
   ========================================================= */

async function fetchJSON(
    url,
    options = {}
) {

    const response = await fetch(url, {
        credentials: "include",
        cache: "no-store",

        ...options,

        headers: {
            "Accept": "application/json",
            ...(options.body
                ? {
                    "Content-Type":
                        "application/json"
                }
                : {}),
            ...(options.headers || {})
        }
    });

    let data = null;

    try {

        data = await response.json();

    } catch (error) {

        data = null;
    }

    return {
        response,
        data
    };
}


/* =========================================================
   MESSAGE
   ========================================================= */

function showMessage(
    message,
    type = "error"
) {

    const box = $("depositsMessage");

    if (!box) {
        return;
    }

    box.textContent = message || "";

    box.className =
        `admin-message ${type}`;

    if (!message) {
        box.style.display = "none";
    } else {
        box.style.display = "block";
    }
}


/* =========================================================
   HIDE MESSAGE
   ========================================================= */

function clearMessage() {

    const box = $("depositsMessage");

    if (!box) {
        return;
    }

    box.textContent = "";

    box.style.display = "none";
}


/* =========================================================
   LOADING STATE
   ========================================================= */

function setLoading(isLoading) {

    state.isLoading = isLoading;

    const loading = $("depositsLoading");

    if (loading) {

        loading.style.display =
            isLoading ? "block" : "none";
    }
}


/* =========================================================
   PAGE LOADER
   ========================================================= */

function hidePageLoader() {

    const loader = $("pageLoader");

    if (!loader) {
        return;
    }

    loader.classList.add("hidden");

    setTimeout(() => {

        loader.style.display = "none";

    }, 300);
}


/* =========================================================
   ADMINISTRATOR VERIFICATION
   ========================================================= */

async function verifyAdministrator() {

    const authMessage =
        "Verifying administrator access...";

    clearMessage();

    const result =
        await fetchJSON(ADMIN_AUTH_API, {
            method: "GET"
        });

    const response = result.response;
    const data = result.data;

    /*
     * IMPORTANT:
     * Do NOT automatically call logout here.
     *
     * The browser must keep the existing
     * administrator session.
     */

    if (!response.ok) {

        state.authenticated = false;

        let message =
            "Administrator verification failed.";

        if (response.status === 401) {

            message =
                "Your administrator session has expired. Please login again.";

        } else if (response.status === 403) {

            message =
                "This account is not authorized to access the administrator panel.";

        } else if (
            data &&
            data.message
        ) {

            message = data.message;
        }

        showMessage(
            message,
            "error"
        );

        return false;
    }

    if (
        !data ||
        data.success !== true ||
        data.authorized !== true
    ) {

        state.authenticated = false;

        showMessage(
            data && data.message
                ? data.message
                : "Administrator verification failed.",
            "error"
        );

        return false;
    }

    state.authenticated = true;

    return true;
}


/* =========================================================
   LOAD ADMIN PROFILE
   ========================================================= */

async function loadAdminProfile() {

    try {

        const result =
            await fetchJSON(PROFILE_API);

        if (
            !result.response.ok ||
            !result.data ||
            result.data.success !== true
        ) {
            return;
        }

        const user =
            result.data.user || {};

        const fullName =
            user.full_name ||
            `${user.first_name || ""} ${user.last_name || ""}`
                .trim() ||
            "Administrator";

        const accountType =
            user.account_type ||
            "admin";

        const adminName =
            $("adminName");

        const headerUserName =
            $("headerUserName");

        const adminAccountType =
            $("adminAccountType");

        if (adminName) {

            adminName.textContent =
                fullName;
        }

        if (headerUserName) {

            headerUserName.textContent =
                fullName;
        }

        if (adminAccountType) {

            adminAccountType.textContent =
                accountType === "admin"
                    ? "Admin Account"
                    : accountType;
        }

        /*
         * Avatar uses first letter.
         * This does not use emoji.
         */

        const letter =
            fullName
                .charAt(0)
                .toUpperCase() || "A";

        const adminAvatar =
            $("adminAvatar");

        const accountAvatar =
            $("accountAvatar");

        if (adminAvatar) {

            adminAvatar.textContent =
                letter;
        }

        if (accountAvatar) {

            accountAvatar.textContent =
                letter;
        }

    } catch (error) {

        console.warn(
            "Admin profile could not be loaded:",
            error
        );
    }
}


/* =========================================================
   NORMALIZE PAYMENT METHOD
   ========================================================= */

function normalizeMethod(method) {

    const value =
        String(method || "")
            .trim()
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

    return "Other";
}


/* =========================================================
   METHOD LABEL
   ========================================================= */

function methodLabel(method) {

    const normalized =
        normalizeMethod(method);

    if (normalized === "MTN") {

        return "MTN Mobile Money";
    }

    if (normalized === "Airtel") {

        return "Airtel Money";
    }

    return "Other";
}


/* =========================================================
   STATUS NORMALIZATION
   ========================================================= */

function normalizeStatus(status) {

    const value =
        String(status || "")
            .trim()
            .toLowerCase();

    if (
        value === "approved" ||
        value === "completed"
    ) {
        return "approved";
    }

    if (
        value === "rejected" ||
        value === "declined"
    ) {
        return "rejected";
    }

    return "pending";
}


/* =========================================================
   STATUS LABEL
   ========================================================= */

function statusLabel(status) {

    const normalized =
        normalizeStatus(status);

    if (normalized === "approved") {

        return "Approved";
    }

    if (normalized === "rejected") {

        return "Rejected";
    }

    return "Pending";
}


/* =========================================================
   CURRENCY
   ========================================================= */

function formatCurrency(amount) {

    const number =
        Number(amount || 0);

    return (
        "UGX " +
        number.toLocaleString(
            "en-UG",
            {
                maximumFractionDigits: 0
            }
        )
    );
}


/* =========================================================
   DATE FORMAT
   ========================================================= */

function formatDate(value) {

    if (!value) {
        return "—";
    }

    const date =
        new Date(value);

    if (
        Number.isNaN(
            date.getTime()
        )
    ) {
        return String(value);
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


/* =========================================================
   GET CUSTOMER NAME
   ========================================================= */

function getCustomerName(deposit) {

    if (!deposit) {
        return "Customer";
    }

    if (
        deposit.full_name
    ) {
        return deposit.full_name;
    }

    if (
        deposit.customer_name
    ) {
        return deposit.customer_name;
    }

    if (
        deposit.name
    ) {
        return deposit.name;
    }

    if (
        deposit.user &&
        deposit.user.full_name
    ) {
        return deposit.user.full_name;
    }

    const first =
        deposit.first_name ||
        (
            deposit.user &&
            deposit.user.first_name
        ) ||
        "";

    const last =
        deposit.last_name ||
        (
            deposit.user &&
            deposit.user.last_name
        ) ||
        "";

    const combined =
        `${first} ${last}`.trim();

    return combined || "Customer";
}


/* =========================================================
   GET EMAIL
   ========================================================= */

function getCustomerEmail(deposit) {

    return (
        deposit.email ||
        deposit.customer_email ||
        (
            deposit.user &&
            deposit.user.email
        ) ||
        "—"
    );
}


/* =========================================================
   GET PHONE
   ========================================================= */

function getCustomerPhone(deposit) {

    return (
        deposit.phone ||
        deposit.phone_number ||
        deposit.mobile ||
        deposit.customer_phone ||
        (
            deposit.user &&
            (
                deposit.user.phone ||
                deposit.user.phone_number
            )
        ) ||
        "—"
    );
}


/* =========================================================
   GET REFERENCE
   ========================================================= */

function getReference(deposit) {

    return (
        deposit.reference ||
        deposit.transaction_reference ||
        deposit.transaction_ref ||
        deposit.payment_reference ||
        "—"
    );
}


/* =========================================================
   GET AMOUNT
   ========================================================= */

function getAmount(deposit) {

    return Number(
        deposit.amount ||
        deposit.deposit_amount ||
        0
    );
}


/* =========================================================
   GET CREATED DATE
   ========================================================= */

function getCreatedDate(deposit) {

    return (
        deposit.created_at ||
        deposit.createdAt ||
        deposit.date ||
        deposit.created ||
        ""
    );
}


/* =========================================================
   LOAD DEPOSITS
   ========================================================= */

async function loadDeposits() {

    setLoading(true);

    clearMessage();

    try {

        const result =
            await fetchJSON(
                DEPOSITS_API,
                {
                    method: "GET"
                }
            );

        const response =
            result.response;

        const data =
            result.data;

        if (!response.ok) {

            if (
                response.status === 401
            ) {

                state.authenticated =
                    false;

                showMessage(
                    "Your administrator session has expired. Please login again.",
                    "error"
                );

            } else if (
                response.status === 403
            ) {

                state.authenticated =
                    false;

                showMessage(
                    "Administrator authorization was denied.",
                    "error"
                );

            } else {

                showMessage(
                    data &&
                    data.message
                        ? data.message
                        : "Unable to load deposits.",
                    "error"
                );
            }

            state.deposits = [];

            state.filteredDeposits = [];

            updateStatistics();

            renderDeposits();

            return;
        }

        if (
            !data ||
            data.success !== true
        ) {

            showMessage(
                data &&
                data.message
                    ? data.message
                    : "Unable to load deposits.",
                "error"
            );

            state.deposits = [];

            state.filteredDeposits = [];

            updateStatistics();

            renderDeposits();

            return;
        }

        /*
         * Support both:
         * deposits: []
         * data: { deposits: [] }
         */

        let deposits = [];

        if (
            Array.isArray(
                data.deposits
            )
        ) {

            deposits =
                data.deposits;

        } else if (
            data.data &&
            Array.isArray(
                data.data.deposits
            )
        ) {

            deposits =
                data.data.deposits;
        }

        state.deposits =
            deposits;

        state.currentPage =
            1;

        applyFilters();

    } catch (error) {

        console.error(
            "Load deposits error:",
            error
        );

        showMessage(
            "Could not connect to the deposit administration service.",
            "error"
        );

        state.deposits = [];

        state.filteredDeposits = [];

        updateStatistics();

        renderDeposits();

    } finally {

        setLoading(false);
    }
}


/* =========================================================
   UPDATE STATISTICS
   ========================================================= */

function updateStatistics() {

    let total = 0;
    let pending = 0;
    let approved = 0;
    let rejected = 0;

    state.deposits.forEach(
        deposit => {

            const amount =
                getAmount(deposit);

            const status =
                normalizeStatus(
                    deposit.status
                );

            total += amount;

            if (status === "pending") {

                pending += amount;

            } else if (
                status === "approved"
            ) {

                approved += amount;

            } else if (
                status === "rejected"
            ) {

                rejected += amount;
            }
        }
    );

    if ($("totalDeposits")) {

        $("totalDeposits").textContent =
            formatCurrency(total);
    }

    if ($("pendingDeposits")) {

        $("pendingDeposits").textContent =
            formatCurrency(pending);
    }

    if ($("approvedDeposits")) {

        $("approvedDeposits").textContent =
            formatCurrency(approved);
    }

    if ($("rejectedDeposits")) {

        $("rejectedDeposits").textContent =
            formatCurrency(rejected);
    }
}


/* =========================================================
   APPLY FILTERS
   ========================================================= */

function applyFilters() {

    const search =
        (
            $("searchDeposits")?.value ||
            ""
        )
            .trim()
            .toLowerCase();

    const status =
        (
            $("statusFilter")?.value ||
            "all"
        )
            .trim()
            .toLowerCase();

    const method =
        (
            $("methodFilter")?.value ||
            "all"
        )
            .trim()
            .toLowerCase();

    state.filteredDeposits =
        state.deposits.filter(
            deposit => {

                const customer =
                    getCustomerName(
                        deposit
                    ).toLowerCase();

                const email =
                    getCustomerEmail(
                        deposit
                    ).toLowerCase();

                const phone =
                    getCustomerPhone(
                        deposit
                    ).toLowerCase();

                const reference =
                    getReference(
                        deposit
                    ).toLowerCase();

                const normalizedStatus =
                    normalizeStatus(
                        deposit.status
                    );

                const normalizedMethod =
                    normalizeMethod(
                        deposit.payment_method ||
                        deposit.method
                    ).toLowerCase();

                const matchesSearch =
                    !search ||
                    customer.includes(search) ||
                    email.includes(search) ||
                    phone.includes(search) ||
                    reference.includes(search);

                const matchesStatus =
                    status === "all" ||
                    normalizedStatus === status;

                const matchesMethod =
                    method === "all" ||
                    normalizedMethod === method;

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
   ICONS
   ========================================================= */

function icon(name) {

    const icons = {

        eye: `
            <svg viewBox="0 0 24 24"
                 aria-hidden="true">
                <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z"/>
                <circle cx="12" cy="12" r="2.5"/>
            </svg>
        `,

        check: `
            <svg viewBox="0 0 24 24"
                 aria-hidden="true">
                <path d="m5 12 4 4L19 6"/>
            </svg>
        `,

        close: `
            <svg viewBox="0 0 24 24"
                 aria-hidden="true">
                <path d="M6 6l12 12M18 6 6 18"/>
            </svg>
        `,

        refresh: `
            <svg viewBox="0 0 24 24"
                 aria-hidden="true">
                <path d="M20 11a8 8 0 0 0-14.7-4L3 10"/>
                <path d="M3 5v5h5"/>
                <path d="M4 13a8 8 0 0 0 14.7 4L21 14"/>
                <path d="M21 19v-5h-5"/>
            </svg>
        `,

        money: `
            <svg viewBox="0 0 24 24"
                 aria-hidden="true">
                <rect x="3" y="5" width="18"
                      height="14" rx="2"/>
                <path d="M7 9h.01M17 15h.01"/>
                <circle cx="12" cy="12" r="2.5"/>
            </svg>
        `,

        search: `
            <svg viewBox="0 0 24 24"
                 aria-hidden="true">
                <circle cx="11" cy="11" r="7"/>
                <path d="m20 20-4-4"/>
            </svg>
        `,

        shield: `
            <svg viewBox="0 0 24 24"
                 aria-hidden="true">
                <path d="M12 3 20 6v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3Z"/>
                <path d="m8.5 12 2.2 2.2 4.8-5"/>
            </svg>
        `
    };

    return icons[name] || "";
}


/* =========================================================
   RENDER DESKTOP TABLE
   ========================================================= */

function renderDesktopTable(
    deposits
) {

    const body =
        $("depositsTableBody");

    if (!body) {
        return;
    }

    if (!deposits.length) {

        body.innerHTML = "";

        return;
    }

    body.innerHTML =
        deposits.map(
            deposit => {

                const name =
                    getCustomerName(
                        deposit
                    );

                const amount =
                    getAmount(
                        deposit
                    );

                const method =
                    normalizeMethod(
                        deposit.payment_method ||
                        deposit.method
                    );

                const status =
                    normalizeStatus(
                        deposit.status
                    );

                const reference =
                    getReference(
                        deposit
                    );

                const date =
                    formatDate(
                        getCreatedDate(
                            deposit
                        )
                    );

                const id =
                    deposit._id ||
                    deposit.id ||
                    "";

                return `
                    <tr
                        class="deposit-row"
                        data-id="${escapeHTML(id)}"
                    >

                        <td>
                            <div class="deposit-customer">

                                <div class="customer-avatar">
                                    ${escapeHTML(
                                        name
                                            .charAt(0)
                                            .toUpperCase() ||
                                        "C"
                                    )}
                                </div>

                                <div class="customer-info">

                                    <strong>
                                        ${escapeHTML(name)}
                                    </strong>

                                    <small>
                                        ${escapeHTML(
                                            getCustomerPhone(
                                                deposit
                                            )
                                        )}
                                    </small>

                                </div>

                            </div>
                        </td>

                        <td>
                            <strong class="amount-value">
                                ${formatCurrency(amount)}
                            </strong>
                        </td>

                        <td>
                            <span class="method-badge ${method.toLowerCase()}">
                                ${escapeHTML(
                                    methodLabel(
                                        method
                                    )
                                )}
                            </span>
                        </td>

                        <td>
                            <span class="reference-value">
                                ${escapeHTML(reference)}
                            </span>
                        </td>

                        <td>
                            <span class="status-badge ${status}">
                                ${escapeHTML(
                                    statusLabel(
                                        status
                                    )
                                )}
                            </span>
                        </td>

                        <td>
                            <span class="date-value">
                                ${escapeHTML(date)}
                            </span>
                        </td>

                        <td>
                            <div class="deposit-actions">

                                <button
                                    type="button"
                                    class="icon-action view-deposit-btn"
                                    data-id="${escapeHTML(id)}"
                                    title="View deposit"
                                    aria-label="View deposit"
                                >
                                    ${icon("eye")}
                                </button>

                                ${
                                    status === "pending"
                                        ? `
                                            <button
                                                type="button"
                                                class="icon-action approve-deposit-btn"
                                                data-id="${escapeHTML(id)}"
                                                title="Approve deposit"
                                                aria-label="Approve deposit"
                                            >
                                                ${icon("check")}
                                            </button>

                                            <button
                                                type="button"
                                                class="icon-action reject-deposit-btn"
                                                data-id="${escapeHTML(id)}"
                                                title="Reject deposit"
                                                aria-label="Reject deposit"
                                            >
                                                ${icon("close")}
                                            </button>
                                        `
                                        : ""
                                }

                            </div>
                        </td>

                    </tr>
                `;
            }
        ).join("");
}


/* =========================================================
   RENDER MOBILE CARDS
   ========================================================= */

function renderMobileCards(
    deposits
) {

    const container =
        $("depositsMobileList");

    if (!container) {
        return;
    }

    if (!deposits.length) {

        container.innerHTML = "";

        return;
    }

    container.innerHTML =
        deposits.map(
            deposit => {

                const name =
                    getCustomerName(
                        deposit
                    );

                const amount =
                    getAmount(
                        deposit
                    );

                const method =
                    normalizeMethod(
                        deposit.payment_method ||
                        deposit.method
                    );

                const status =
                    normalizeStatus(
                        deposit.status
                    );

                const id =
                    deposit._id ||
                    deposit.id ||
                    "";

                return `
                    <article
                        class="deposit-mobile-card"
                        data-id="${escapeHTML(id)}"
                    >

                        <div class="mobile-deposit-top">

                            <div class="deposit-customer">

                                <div class="customer-avatar">
                                    ${escapeHTML(
                                        name
                                            .charAt(0)
                                            .toUpperCase() ||
                                        "C"
                                    )}
                                </div>

                                <div class="customer-info">

                                    <strong>
                                        ${escapeHTML(name)}
                                    </strong>

                                    <small>
                                        ${escapeHTML(
                                            getCustomerPhone(
                                                deposit
                                            )
                                        )}
                                    </small>

                                </div>

                            </div>

                            <span class="status-badge ${status}">
                                ${escapeHTML(
                                    statusLabel(status)
                                )}
                            </span>

                        </div>

                        <div class="mobile-deposit-amount">
                            ${formatCurrency(amount)}
                        </div>

                        <div class="mobile-deposit-details">

                            <div>
                                <span>Method</span>
                                <strong>
                                    ${escapeHTML(
                                        methodLabel(method)
                                    )}
                                </strong>
                            </div>

                            <div>
                                <span>Reference</span>
                                <strong>
                                    ${escapeHTML(
                                        getReference(
                                            deposit
                                        )
                                    )}
                                </strong>
                            </div>

                            <div>
                                <span>Date</span>
                                <strong>
                                    ${escapeHTML(
                                        formatDate(
                                            getCreatedDate(
                                                deposit
                                            )
                                        )
                                    )}
                                </strong>
                            </div>

                        </div>

                        <div class="mobile-deposit-actions">

                            <button
                                type="button"
                                class="admin-button secondary view-deposit-btn"
                                data-id="${escapeHTML(id)}"
                            >
                                ${icon("eye")}
                                <span>View</span>
                            </button>

                            ${
                                status === "pending"
                                    ? `
                                        <button
                                            type="button"
                                            class="admin-button approve approve-deposit-btn"
                                            data-id="${escapeHTML(id)}"
                                        >
                                            ${icon("check")}
                                            <span>Approve</span>
                                        </button>

                                        <button
                                            type="button"
                                            class="admin-button danger reject-deposit-btn"
                                            data-id="${escapeHTML(id)}"
                                        >
                                            ${icon("close")}
                                            <span>Reject</span>
                                        </button>
                                    `
                                    : ""
                            }

                        </div>

                    </article>
                `;
            }
        ).join("");
}


/* =========================================================
   RENDER EMPTY STATE
   ========================================================= */

function renderEmptyState() {

    const empty =
        $("depositsEmpty");

    if (!empty) {
        return;
    }

    if (
        state.filteredDeposits.length === 0
    ) {

        empty.style.display =
            "flex";

    } else {

        empty.style.display =
            "none";
    }
}


/* =========================================================
   PAGINATION
   ========================================================= */

function renderPagination() {

    const container =
        $("depositsPagination");

    if (!container) {
        return;
    }

    const total =
        state.filteredDeposits.length;

    const pages =
        Math.max(
            1,
            Math.ceil(
                total /
                state.perPage
            )
        );

    if (
       