/* =========================================================
   CROWN CASH — ADMIN DEPOSITS
   admin-deposits.js
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
   PAGE STATE
   ========================================================= */

const depositState = {
    authenticated: false,
    deposits: [],
    filteredDeposits: [],
    currentPage: 1,
    perPage: 10,
    currentDeposit: null,
    loading: false
};


/* =========================================================
   DOM HELPERS
   ========================================================= */

function getElement(id) {
    return document.getElementById(id);
}


function setText(id, value) {
    const element = getElement(id);

    if (element) {
        element.textContent =
            value === null ||
            value === undefined ||
            value === ""
                ? "—"
                : value;
    }
}


function showElement(element) {
    if (!element) return;

    element.hidden = false;
    element.style.display = "";
}


function hideElement(element) {
    if (!element) return;

    element.hidden = true;
    element.style.display = "none";
}


/* =========================================================
   MESSAGE SYSTEM
   ========================================================= */

function showMessage(message, type = "info") {

    const container =
        getElement("depositMessage");

    if (!container) return;

    container.textContent = message;

    container.className =
        `admin-message ${type}`;

    container.style.display = "block";

    window.clearTimeout(
        container._hideTimer
    );

    if (type === "success") {

        container._hideTimer =
            window.setTimeout(() => {

                container.style.display = "none";

            }, 5000);
    }
}


function hideMessage() {

    const container =
        getElement("depositMessage");

    if (!container) return;

    container.style.display = "none";
    container.textContent = "";
}


/* =========================================================
   PAGE LOADER
   ========================================================= */

function hidePageLoader() {

    const loader =
        getElement("pageLoader");

    if (!loader) return;

    loader.classList.add("hidden");

    window.setTimeout(() => {
        loader.style.display = "none";
    }, 350);
}


function showPageLoader() {

    const loader =
        getElement("pageLoader");

    if (!loader) return;

    loader.style.display = "flex";
    loader.classList.remove("hidden");
}


/* =========================================================
   SAFE JSON FETCH
   ========================================================= */

async function fetchJson(
    url,
    options = {}
) {

    const finalOptions = {
        method: "GET",
        credentials: "include",
        cache: "no-store",
        headers: {
            "Accept": "application/json"
        },
        ...options
    };

    finalOptions.credentials = "include";
    finalOptions.cache = "no-store";

    const response =
        await fetch(url, finalOptions);

    const contentType =
        response.headers.get(
            "content-type"
        ) || "";

    let data = null;

    if (
        contentType.includes(
            "application/json"
        )
    ) {
        data = await response.json();
    } else {

        const text =
            await response.text();

        try {
            data = JSON.parse(text);
        } catch {
            data = {
                success: false,
                message:
                    text ||
                    "The server returned an invalid response."
            };
        }
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
            response.status === 401
        ) {

            depositState.authenticated =
                false;

            showMessage(
                "Your administrator session has expired. Please login again.",
                "error"
            );

            return false;
        }


        if (
            response.status === 403
        ) {

            depositState.authenticated =
                false;

            showMessage(
                "Administrator access is not authorized for this account.",
                "error"
            );

            return false;
        }


        if (
            !response.ok
        ) {

            depositState.authenticated =
                false;

            showMessage(
                data?.message ||
                "Administrator verification failed.",
                "error"
            );

            return false;
        }


        if (
            data &&
            data.success === true &&
            (
                data.authorized === true ||
                data.authenticated === true
            )
        ) {

            depositState.authenticated =
                true;

            return true;
        }


        depositState.authenticated =
            false;

        showMessage(
            data?.message ||
            "Administrator verification failed.",
            "error"
        );

        return false;

    } catch (error) {

        console.error(
            "Administrator verification error:",
            error
        );

        depositState.authenticated =
            false;

        showMessage(
            "Unable to verify administrator access. Please check your connection and try again.",
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
            data.success !== true
        ) {

            setText(
                "adminName",
                "Administrator"
            );

            setText(
                "adminEmail",
                "Administrator account"
            );

            return;
        }


        const user =
            data.user ||
            data.profile ||
            data.data ||
            {};


        const fullName =
            user.full_name ||
            [
                user.first_name,
                user.last_name
            ]
                .filter(Boolean)
                .join(" ")
            ||
            "Administrator";


        const email =
            user.email ||
            "Administrator account";


        setText(
            "adminName",
            fullName
        );

        setText(
            "adminEmail",
            email
        );

    } catch (error) {

        console.warn(
            "Admin profile could not be loaded:",
            error
        );

        setText(
            "adminName",
            "Administrator"
        );

        setText(
            "adminEmail",
            "Administrator account"
        );
    }
}


/* =========================================================
   CURRENCY
   ========================================================= */

function formatCurrency(
    value
) {

    const number =
        Number(value);

    if (
        !Number.isFinite(number)
    ) {
        return "UGX 0";
    }

    return (
        "UGX " +
        Math.round(number)
            .toLocaleString("en-UG")
    );
}


/* =========================================================
   NUMBER NORMALIZATION
   ========================================================= */

function numberValue(value) {

    if (
        value === null ||
        value === undefined ||
        value === ""
    ) {
        return 0;
    }


    if (
        typeof value === "number"
    ) {
        return Number.isFinite(value)
            ? value
            : 0;
    }


    if (
        typeof value === "object"
    ) {

        if (
            value.$numberDecimal !== undefined
        ) {
            return (
                Number(
                    value.$numberDecimal
                ) || 0
            );
        }

        if (
            value.$numberLong !== undefined
        ) {
            return (
                Number(
                    value.$numberLong
                ) || 0
            );
        }

        if (
            value.toString
        ) {

            return (
                Number(
                    value.toString()
                ) || 0
            );
        }
    }


    return (
        Number(
            String(value)
                .replace(/,/g, "")
        ) || 0
    );
}


/* =========================================================
   DEPOSIT AMOUNT
   ========================================================= */

function getDepositAmount(
    deposit
) {

    return numberValue(
        deposit.amount ??
        deposit.deposit_amount ??
        deposit.value ??
        0
    );
}


/* =========================================================
   STATUS NORMALIZATION
   ========================================================= */

function normalizeStatus(
    status
) {

    const value =
        String(
            status || "pending"
        )
            .trim()
            .toLowerCase()
            .replace(/[\s-]+/g, "_");


    if (
        value === "approved" ||
        value === "complete" ||
        value === "completed" ||
        value === "success" ||
        value === "successful"
    ) {
        return "approved";
    }


    if (
        value === "rejected" ||
        value === "declined" ||
        value === "cancelled" ||
        value === "canceled"
    ) {
        return "rejected";
    }


    return "pending";
}


/* =========================================================
   PAYMENT METHOD
   ========================================================= */

function normalizeMethod(
    method
) {

    const value =
        String(
            method || ""
        )
            .trim()
            .toLowerCase();


    if (
        value.includes("mtn")
    ) {
        return "mtn";
    }


    if (
        value.includes("airtel")
    ) {
        return "airtel";
    }


    return "other";
}


function methodLabel(
    method
) {

    const normalized =
        normalizeMethod(method);


    if (
        normalized === "mtn"
    ) {
        return "MTN Mobile Money";
    }


    if (
        normalized === "airtel"
    ) {
        return "Airtel Money";
    }


    return (
        method ||
        "Other"
    );
}


/* =========================================================
   STATUS LABEL
   ========================================================= */

function statusLabel(
    status
) {

    const normalized =
        normalizeStatus(status);


    if (
        normalized === "approved"
    ) {
        return "Approved";
    }


    if (
        normalized === "rejected"
    ) {
        return "Rejected";
    }


    return "Pending";
}


/* =========================================================
   STATUS ICONS
   ========================================================= */

function statusIcon(
    status
) {

    const normalized =
        normalizeStatus(status);


    if (
        normalized === "approved"
    ) {

        return `
            <svg viewBox="0 0 24 24"
                 aria-hidden="true">
                <path d="M20 6 9 17l-5-5"/>
            </svg>
        `;
    }


    if (
        normalized === "rejected"
    ) {

        return `
            <svg viewBox="0 0 24 24"
                 aria-hidden="true">
                <path d="M6 6l12 12M18 6 6 18"/>
            </svg>
        `;
    }


    return `
        <svg viewBox="0 0 24 24"
             aria-hidden="true">
            <circle cx="12" cy="12" r="8"/>
            <path d="M12 8v5l3 2"/>
        </svg>
    `;
}


/* =========================================================
   METHOD ICON
   ========================================================= */

function methodIcon(
    method
) {

    const normalized =
        normalizeMethod(method);


    if (
        normalized === "airtel"
    ) {

        return `
            <svg viewBox="0 0 24 24"
                 aria-hidden="true">
                <path d="M8 4h8"/>
                <path d="M7 8h10"/>
                <path d="M6 12h12"/>
                <path d="M7 16h10"/>
                <path d="M8 20h8"/>
            </svg>
        `;
    }


    return `
        <svg viewBox="0 0 24 24"
             aria-hidden="true">
            <rect x="5" y="3" width="14" height="18" rx="3"/>
            <path d="M9 7h6"/>
            <path d="M9 11h6"/>
            <circle cx="12" cy="17" r="1"/>
        </svg>
    `;
}


/* =========================================================
   DATE FORMAT
   ========================================================= */

function formatDate(
    value
) {

    if (!value) {
        return "—";
    }


    let date;


    if (
        typeof value === "object" &&
        value.$date
    ) {

        date =
            new Date(
                value.$date
            );

    } else {

        date =
            new Date(value);
    }


    if (
        Number.isNaN(
            date.getTime()
        )
    ) {

        return "—";
    }


    return new Intl.DateTimeFormat(
        "en-UG",
        {
            day: "2-digit",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit"
        }
    ).format(date);
}


/* =========================================================
   CUSTOMER DETAILS
   ========================================================= */

function getCustomerName(
    deposit
) {

    return (
        deposit.full_name ||
        deposit.fullName ||
        deposit.customer_name ||
        deposit.customerName ||
        deposit.user_name ||
        deposit.name ||
        "Customer"
    );
}


function getCustomerEmail(
    deposit
) {

    return (
        deposit.email ||
        deposit.customer_email ||
        deposit.customerEmail ||
        "—"
    );
}


function getCustomerPhone(
    deposit
) {

    return (
        deposit.phone ||
        deposit.phone_number ||
        deposit.mobile ||
        deposit.customer_phone ||
        "—"
    );
}


function getReference(
    deposit
) {

    return (
        deposit.reference ||
        deposit.transaction_reference ||
        deposit.transactionReference ||
        deposit.payment_reference ||
        deposit.paymentReference ||
        "—"
    );
}


/* =========================================================
   DEPOSIT ID
   ========================================================= */

function getDepositId(
    deposit
) {

    if (
        typeof deposit._id === "string"
    ) {
        return deposit._id;
    }


    if (
        deposit._id &&
        deposit._id.$oid
    ) {
        return deposit._id.$oid;
    }


    if (
        deposit.id
    ) {
        return String(
            deposit.id
        );
    }


    if (
        deposit.deposit_id
    ) {
        return String(
            deposit.deposit_id
        );
    }


    return "";
}


/* =========================================================
   LOAD DEPOSITS
   ========================================================= */

async function loadDeposits() {

    if (
        !depositState.authenticated
    ) {
        return;
    }


    depositState.loading =
        true;


    setLoadingState();


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

            depositState.authenticated =
                false;

            showMessage(
                "Your administrator session has expired. Please login again.",
                "error"
            );

            renderDeposits();

            return;
        }


        if (
            response.status === 403
        ) {

            showMessage(
                "You are not authorized to view deposits.",
                "error"
            );

            renderDeposits();

            return;
        }


        if (
            !response.ok
        ) {

            throw new Error(
                data?.message ||
                "Unable to load deposits."
            );
        }


        if (
            data &&
            data.success === false
        ) {

            throw new Error(
                data.message ||
                "Unable to load deposits."
            );
        }


        let deposits = [];


        if (
            Array.isArray(data)
        ) {

            deposits = data;

        } else if (
            Array.isArray(data?.deposits)
        ) {

            deposits =
                data.deposits;

        } else if (
            Array.isArray(data?.data)
        ) {

            deposits =
                data.data;

        } else if (
            Array.isArray(data?.items)
        ) {

            deposits =
                data.items;

        } else if (
            Array.isArray(data?.results)
        ) {

            deposits =
                data.results;

        } else if (
            Array.isArray(data?.data?.deposits)
        ) {

            deposits =
                data.data.deposits;
        }


        depositState.deposits =
            deposits.map(
                deposit => ({
                    ...deposit,
                    _normalizedStatus:
                        normalizeStatus(
                            deposit.status
                        ),
                    _normalizedMethod:
                        normalizeMethod(
                            deposit.payment_method ||
                            deposit.paymentMethod ||
                            deposit.method
                        )
                })
            );


        depositState.currentPage =
            1;


        updateStatistics();

        applyFilters();

        hideMessage();

    } catch (error) {

        console.error(
            "Deposit loading error:",
            error
        );


        depositState.deposits =
            [];

        depositState.filteredDeposits =
            [];


        updateStatistics();

        renderDeposits();


        showMessage(
            error.message ||
            "Unable to load customer deposits.",
            "error"
        );

    } finally {

        depositState.loading =
            false;

        hidePageLoader();
    }
}


/* =========================================================
   LOADING STATE
   ========================================================= */

function setLoadingState() {

    const tableBody =
        getElement(
            "depositsTableBody"
        );

    const mobileList =
        getElement(
            "depositsMobileList"
        );


    if (tableBody) {

        tableBody.innerHTML = `
            <tr>
                <td colspan="7">
                    <div class="admin-loading-state">
                        <div class="loading-spinner"></div>
                        <span>Loading deposits...</span>
                    </div>
                </td>
            </tr>
        `;
    }


    if (mobileList) {

        mobileList.innerHTML = `
            <div class="admin-loading-state">
                <div class="loading-spinner"></div>
                <span>Loading deposits...</span>
            </div>
        `;
    }
}


/* =========================================================
   STATISTICS
   ========================================================= */

function updateStatistics() {

    const deposits =
        depositState.deposits;


    let total = 0;
    let pending = 0;
    let approved = 0;
    let rejected = 0;


    deposits.forEach(
        deposit => {

            const amount =
                getDepositAmount(
                    deposit
                );

            const status =
                normalizeStatus(
                    deposit.status
                );


            total += amount;


            if (
                status === "pending"
            ) {
                pending += amount;
            }


            if (
                status === "approved"
            ) {
                approved += amount;
            }


            if (
                status === "rejected"
            ) {
                rejected += amount;
            }
        }
    );


    setText(
        "totalDeposits",
        formatCurrency(total)
    );

    setText(
        "pendingDeposits",
        formatCurrency(pending)
    );

    setText(
        "approvedDeposits",
        formatCurrency(approved)
    );

    setText(
        "rejectedDeposits",
        formatCurrency(rejected)
    );
}


/* =========================================================
   FILTERS
   ========================================================= */

function applyFilters() {

    const statusFilter =
        getElement(
            "statusFilter"
        )?.value || "all";


    const methodFilter =
        getElement(
            "methodFilter"
        )?.value || "all";


    depositState.filteredDeposits =
        depositState.deposits.filter(
            deposit => {

                const status =
                    normalizeStatus(
                        deposit.status
                    );


                const method =
                    normalizeMethod(
                        deposit.payment_method ||
                        deposit.paymentMethod ||
                        deposit.method
                    );


                const statusMatch =
                    statusFilter === "all" ||
                    status === statusFilter;


                const methodMatch =
                    methodFilter === "all" ||
                    method === methodFilter;


                return (
                    statusMatch &&
                    methodMatch
                );
            }
        );


    depositState.currentPage =
        1;


    renderDeposits();
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
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


/* =========================================================
   STATUS BADGE
   ========================================================= */

function statusBadge(
    status
) {

    const normalized =
        normalizeStatus(status);


    return `
        <span class="status-badge ${normalized}">
            <span class="status-badge-icon">
                ${statusIcon(normalized)}
            </span>
            <span>
                ${escapeHtml(
                    statusLabel(normalized)
                )}
            </span>
        </span>
    `;
}


/* =========================================================
   METHOD BADGE
   ========================================================= */

function methodBadge(
    method
) {

    const normalized =
        normalizeMethod(method);


    return `
        <span class="method-badge ${normalized}">
            <span class="method-icon">
                ${methodIcon(normalized)}
            </span>

            <span>
                ${escapeHtml(
                    methodLabel(method)
                )}
            </span>
        </span>
    `;
}


/* =========================================================
   RENDER DESKTOP TABLE
   ========================================================= */

function renderDesktopDeposits(
    deposits
) {

    const tableBody =
        getElement(
            "depositsTableBody"
        );


    if (!tableBody) {
        return;
    }


    if (
        deposits.length === 0
    ) {

        tableBody.innerHTML = `
            <tr>
                <td colspan="7">
                    <div class="admin-empty-state">
                        <div class="empty-icon">
                            <svg viewBox="0 0 24 24"
                                 aria-hidden="true">
                                <rect x="3" y="5"
                                      width="18"
                                      height="14"
                                      rx="3"/>
                                <path d="M7 10h10"/>
                                <path d="M7 14h6"/>
                            </svg>
                        </div>

                        <h3>No deposits found</h3>

                        <p>
                            There are no deposit records
                            matching the selected filters.
                        </p>
                    </div>
                </td>
            </tr>
        `;

        return;
    }


    tableBody.innerHTML =
        deposits.map(
            deposit => {

                const id =
                    getDepositId(
                        deposit
                    );


                const customer =
                    getCustomerName(
                        deposit
                    );


                const amount =
                    getDepositAmount(
                        deposit
                    );


                const method =
                    deposit.payment_method ||
                    deposit.paymentMethod ||
                    deposit.method ||
                    "";


                const reference =
                    getReference(
                        deposit
                    );


                const status =
                    normalizeStatus(
                        deposit.status
                    );


                const created =
                    deposit.created_at ||
                    deposit.createdAt ||
                    deposit.date ||
                    deposit.timestamp;


                return `
                    <tr>

                        <td>
                            <div class="customer-cell">

                                <div class="customer-avatar">
                                    <svg viewBox="0 0 24 24"
                                         aria-hidden="true">
                                        <circle cx="12"
                                                cy="8"
                                                r="3.5"/>
                                        <path d="M5 20c.8-3.3
                                                 3.1-5
                                                 7-5s6.2 1.7
                                                 7 5"/>
                                    </svg>
                                </div>

                                <div class="customer-info">
                                    <strong>
                                        ${escapeHtml(customer)}
                                    </strong>

                                    <small>
                                        ${escapeHtml(
                                            getCustomerEmail(
                                                deposit
                                            )
                                        )}
                                    </small>
                                </div>

                            </div>
                        </td>


                        <td>
                            <strong class="amount-value">
                                ${escapeHtml(
                                    formatCurrency(amount)
                                )}
                            </strong>
                        </td>


                        <td>
                            ${methodBadge(method)}
                        </td>


                        <td>
                            <span class="reference-value">
                                ${escapeHtml(reference)}
                            </span>
                        </td>


                        <td>
                            ${statusBadge(status)}
                        </td>


                        <td>
                            <span class="date-value">
                                ${escapeHtml(
                                    formatDate(created)
                                )}
                            </span>
                        </td>


                        <td>

                            <div class="deposit-actions">

                                <button
                                    type="button"
                                    class="icon-action-button view-deposit-button"
                                    data-deposit-id="${escapeHtml(id)}"
                                    title="Review deposit"
                                    aria-label="Review deposit"
                                >
                                    <svg viewBox="0 0 24 24"
                                         aria-hidden="true">
                                        <path d="M2.5 12s3.5-6
                                                 9.5-6
                                                 9.5 6
                                                 9.5 6
                                                 -3.5 6
                                                 -9.5 6
                                                 -9.5-6
                                                 -9.5-6Z"/>
                                        <circle cx="12"
                                                cy="12"
                                                r="2.5"/>
                                    </svg>
                                </button>

                            </div>

                        </td>

                    </tr>
                `;
            }
        ).join("");
}


/* =========================================================
   RENDER MOBILE
   ========================================================= */

function renderMobileDeposits(
    deposits
) {

    const container =
        getElement(
            "depositsMobileList"
        );


    if (!container) {
        return;
    }


    if (
        deposits.length === 0
    ) {

        container.innerHTML = `
            <div class="admin-empty-state">

                <div class="empty-icon">
                    <svg viewBox="0 0 24 24"
                         aria-hidden="true">
                        <rect x="3" y="5"
                              width="18"
                              height="14"
                              rx="3"/>
                        <path d="M7 10h10"/>
                        <path d="M7 14h6"/>
                    </svg>
                </div>

                <h3>No deposits found</h3>

                <p>
                    No deposit records match
                    the current filters.
                </p>

            </div>
        `;

        return;
    }


    container.innerHTML =
        deposits.map(
            deposit => {

                const id =
                    getDepositId(
                        deposit
                    );


                const customer =
                    getCustomerName(
                        deposit
                    );


                const amount =
                    getDepositAmount(
                        deposit
                    );


                const method =
                    deposit.payment_method ||
                    deposit.paymentMethod ||
                    deposit.method ||
                    "";


                const reference =
                    getReference(
                        deposit
                    );


                const status =
                    normalizeStatus(
                        deposit.status
                    );


                const created =
                    deposit.created_at ||
                    deposit.createdAt ||
                    deposit.date ||
                    deposit.timestamp;


                return `
                    <article
                        class="deposit-mobile-card"
                    >

                        <div class="deposit-mobile-top">

                            <div class="customer-cell">

                                <div class="customer-avatar">
                                    <svg viewBox="0 0 24 24"
                                         aria-hidden="true">
                                        <circle cx="12"
                                                cy="8"
                                                r="3.5"/>
                                        <path d="M5 20c.8-3.3
                                                 3.1-5
                                                 7-5s6.2 1.7
                                                 7 5"/>
                                    </svg>
                                </div>

                                <div class="customer-info">

                                    <strong>
                                        ${escapeHtml(customer)}
                                    </strong>

                                    <small>
                                        ${escapeHtml(
                                            getCustomerPhone(
                                                deposit
                                            )
                                        )}
                                    </small>

                                </div>

                            </div>

                            ${statusBadge(status)}

                        </div>


                        <div class="deposit-mobile-amount">
                            ${escapeHtml(
                                formatCurrency(amount)
                            )}
                        </div>


                        <div class="deposit-mobile-details">

                            <div>
                                <span>Method</span>
                                ${methodBadge(method)}
                            </div>

                            <div>
                                <span>Reference</span>
                                <strong>
                                    ${escapeHtml(reference)}
                                </strong>
                            </div>

                            <div>
                                <span>Date</span>
                                <strong>
                                    ${escapeHtml(
                                        formatDate(created)
                                    )}
                                </strong>
                            </div>

                        </div>


                        <button
                            type="button"
                            class="primary-button full-width view-deposit-button"
                            data-deposit-id="${escapeHtml(id)}"
                        >
                            <svg viewBox="0 0 24 24"
                                 aria-hidden="true">
                                <path d="M2.5 12s3.5-6
                                         9.5-6
                                         9.5 6
                                         9.5 6
                                         -3.5 6
                                         -9.5 6
                                         -9.5-6
                                         -9.5-6Z"/>
                                <circle cx="12"
                                        cy="12"
                                        r="2.5"/>
                            </svg>

                            Review Deposit
                        </button>

                    </article>
                `;
            }
        ).join("");
}


/* =========================================================
   PAGINATION
   ========================================================= */

function renderPagination(
    totalItems
) {

    const pagination =
        getElement(
            "depositPagination"
        );


    if (!pagination) {
        return;
    }


    const totalPages =
        Math.max(
            1,
            Math.ceil(
                totalItems /
                depositState.perPage
            )
        );


    if (
        totalItems === 0 ||
        totalPages <= 1
    ) {

        pagination.innerHTML = "";
        return;
    }


    let html = "";


    html += `
        <button
            type="button"
            class="pagination-button"
            data-page="${depositState.currentPage - 1}"
            ${depositState.currentPage <= 1 ? "disabled" : ""}
        >
            <svg viewBox="0 0 24 24"
                 aria-hidden="true">
                <path d="m15 18-6-6 6-6"/>
            </svg>
        </button>
    `;


    for (
        let page = 1;
        page <= totalPages;
        page++
    ) {

        if (
            totalPages > 7 &&
            page > 3 &&
            page < totalPages - 2 &&
            Math.abs(
                page -
                depositState.currentPage
            ) > 1
        ) {

            if (
                page === 4
            ) {

                html += `
                    <span class="pagination-dots">
                        ...
                    </span>
                `;
            }

            continue;
        }


        html += `
            <button
                type="button"
                class="pagination-button ${
                    page === depositState.currentPage
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
            class="pagination-button"
            data-page="${depositState.currentPage + 1}"
            ${depositState.currentPage >= totalPages ? "disabled" : ""}
        >
            <svg viewBox="0 0 24 24"
                 aria-hidden="true">
                <path d="m9 18 6-6-6-6"/>
            </svg>
        </button>
    `;


    pagination.innerHTML =
        html;


    pagination
        .querySelectorAll(
            "[data-page]"
        )
        .forEach(
            button => {

                button.addEventListener(
                    "click",
                    () => {

                        const page =
                            Number(
                                button.dataset.page
                            );


                        if (
                            !Number.isFinite(page) ||
                            page < 1 ||
                            page > totalPages
                        ) {
                            return;
                        }


                        depositState.currentPage =
                            page;


                        renderDeposits();


                        window.scrollTo({
                            top: 0,
                            behavior: "smooth"
                        });
                    }
                );
            }
        );
}


/* =========================================================
   MAIN RENDER
   ========================================================= */

function renderDeposits() {

    const filtered =
        depositState.filteredDeposits;


    const start =
        (
            depositState.currentPage -
            1
        ) *
        depositState.perPage;


    const end =
        start +
        depositState.perPage;


    const pageItems =
        filtered.slice(
            start,
            end
        );


    renderDesktopDeposits(
        pageItems
    );


    renderMobileDeposits(
        pageItems
    );


    renderPagination(
        filtered.length
    );
}


/* =========================================================
   REVIEW MODAL
   ========================================================= */

function openDepositModal(
    deposit
) {

    const modal =
        getElement(
            "depositModal"
        );


    const details =
        getElement(
            "depositReviewDetails"
        );


    const checkbox =
        getElement(
            "paymentVerified"
        );


    const approveButton =
        getElement(
            "approveDepositButton"
        );


    if (
        !modal ||
        !details
    ) {
        return;
    }


    depositState.currentDeposit =
        deposit;


    const customer =
        getCustomerName(
            deposit
        );


    const email =
        getCustomerEmail(
            deposit
        );


    const phone =
        getCustomerPhone(
            deposit
        );


    const amount =
        getDepositAmount(
            deposit
        );


    const method =
        deposit.payment_method ||
        deposit.paymentMethod ||
        deposit.method ||
        "";


    const reference =
        getReference(
            deposit
        );


    const status =
        normalizeStatus(
            deposit.status
        );


    const created =
        deposit.created_at ||
        deposit.createdAt ||
        deposit.date ||
        deposit.timestamp;


    const alreadyProcessed =
        status !== "pending";


    details.innerHTML = `
        <div class="review-detail-grid">

            <div class="review-detail-card">

                <span>Customer</span>

                <strong>
                    ${escapeHtml(customer)}
                </strong>

            </div>


            <div class="review-detail-card">

                <span>Email</span>

                <strong>
                    ${escapeHtml(email)}
                </strong>

            </div>


            <div class="review-detail-card">

                <span>Phone</span>

                <strong>
                    ${escapeHtml(phone)}
                </strong>

            </div>


            <div class="review-detail-card">

                <span>Amount</span>

                <strong class="review-amount">
                    ${escapeHtml(
                        formatCurrency(amount)
                    )}
                </strong>

            </div>


            <div class="review-detail-card">

                <span>Payment Method</span>

                <strong>
                    ${escapeHtml(
                        methodLabel(method)
                    )}
                </strong>

            </div>


            <div class="review-detail-card">

                <span>Reference</span>

                <strong>
                    ${escapeHtml(reference)}
                </strong>

            </div>


            <div class="review-detail-card">

                <span>Status</span>

                <strong>
                    ${escapeHtml(
                        statusLabel(status)
                    )}
                </strong>

            </div>


            <div class="review-detail-card">

                <span>Submitted</span>

                <strong>
                    ${escapeHtml(
                        formatDate(created)
                    )}
                </strong>

            </div>

        </div>
    `;


    if (checkbox) {

        checkbox.checked =
            false;

        checkbox.disabled =
            alreadyProcessed;
    }


    if (approveButton) {

        approveButton.disabled =
            alreadyProcessed;

        approveButton.style.display =
            alreadyProcessed
                ? "none"
                : "";
    }


    modal.classList.add(
        "active"
    );

    modal.setAttribute(
        "aria-hidden",
        "false"
    );

    document.body.classList.add(
        "modal-open"
    );
}


function closeDepositModal() {

    const modal =
        getElement(
            "depositModal"
        );


    if (!modal) {
        return;
    }


    modal.classList.remove(
        "active"
    );

    modal.setAttribute(
        "aria-hidden",
        "true"
    );

    document.body.classList.remove(
        "modal-open"
    );


    depositState.currentDeposit =
        null;


    const checkbox =
        getElement(
            "paymentVerified"
        );


    if (checkbox) {
        checkbox.checked =
            false;
    }
}


/* =========================================================
   REVIEW BUTTON
   ========================================================= */

function viewDeposit(
    depositId
) {

    const deposit =
        depositState.deposits.find(
            item =>
                getDepositId(item) ===
                String(depositId)
        );


    if (!deposit) {

        showMessage(
            "The selected deposit could not be found.",
            "error"
        );

        return;
    }


    openDepositModal(
        deposit
    );
}


/* =========================================================
   PROCESS DEPOSIT
   ========================================================= */

async function processDeposit(
    action
) {

    const deposit =
        depositState.currentDeposit;


    if (!deposit) {

        showMessage(
            "No deposit is currently selected.",
            "error"
        );

        return;
    }


    const depositId =
        getDepositId(
            deposit
        );


    if (!depositId) {

        showMessage(
            "The selected deposit has no valid ID.",
            "error"
        );

        return;
    }


    const currentStatus =
        normalizeStatus(
            deposit.status
        );


    if (
        currentStatus !== "pending"
    ) {

        showMessage(
            "This deposit has already been processed.",
            "error"
        );

        return;
    }


    let paymentVerified =
        false;


    if (
        action === "approve"
    ) {

        const checkbox =
            getElement(
                "paymentVerified"
            );


        paymentVerified =
            Boolean(
                checkbox &&
                checkbox.checked
            );


        if (
            !paymentVerified
        ) {

            showMessage(
                "Please confirm that you have verified the customer's payment before approving this deposit.",
                "error"
            );

            return;
        }
    }


    const approveButton =
        getElement(
            "approveDepositButton"
        );


    const rejectButton =
        getElement(
            "rejectDepositButton"
        );


    if (approveButton) {
        approveButton.disabled =
            true;
    }


    if (rejectButton) {
        rejectButton.disabled =
            true;
    }


    try {

        const payload = {
            deposit_id:
                depositId,

            action:
                action,

            payment_verified:
                paymentVerified
        };


        const {
            response,
            data
        } = await fetchJson(
            DEPOSITS_API,
            {
                method: "POST",

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


        if (
            response.status === 401
        ) {

            showMessage(
                "Your administrator session has expired. Please login again.",
                "error"
            );

            closeDepositModal();

            return;
        }


        if (
            response.status === 403
        ) {

            showMessage(
                "You are not authorized to process deposits.",
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
                "Unable to process the deposit."
            );
        }


        closeDepositModal();


        showMessage(
            data.message ||
            (
                action === "approve"
                    ? "Deposit approved successfully."
                    : "Deposit rejected successfully."
            ),
            "success"
        );


        await loadDeposits();

    } catch (error) {

        console.error(
            "Deposit processing error:",
            error
        );


        showMessage(
            error.message ||
            "Unable to process the deposit.",
            "error"
        );

    } finally {

        if (approveButton) {
            approveButton.disabled =
                false;
        }

        if (rejectButton) {
            rejectButton.disabled =
                false;
        }
    }
}


/* =========================================================
   EVENT DELEGATION
   ========================================================= */

function attachDepositEvents() {

    document.addEventListener(
        "click",
        event => {

            const reviewButton =
                event.target.closest(
                    ".view-deposit-button"
                );


            if (
                reviewButton
            ) {

                const id =
                    reviewButton.dataset.depositId;


                if (id) {
                    viewDeposit(id);
                }

                return;
            }


            const paginationButton =
                event.target.closest(
                    ".pagination-button"
                );


            if (
                paginationButton
            ) {
                return;
            }
        }
    );


    const refreshButton =
        getElement(
            "refreshDepositsBtn"
        );


    if (
        refreshButton
    ) {

        refreshButton.addEventListener(
            "click",
            async () => {

                refreshButton.disabled =
                    true;

                await loadDeposits();

                refreshButton.disabled =
                    false;
            }
        );
    }


    const statusFilter =
        getElement(
            "statusFilter"
        );


    if (
        statusFilter
    ) {

        statusFilter.addEventListener(
            "change",
            applyFilters
        );
    }


    const methodFilter =
        getElement(
            "methodFilter"
        );


    if (
        methodFilter
    ) {

        methodFilter.addEventListener(
            "change",
            applyFilters
        );
    }


    const closeModal =
        getElement(
            "closeDepositModal"
        );


    if (
        closeModal
    ) {

        closeModal.addEventListener(
            "click",
            closeDepositModal
        );
    }


    const cancelReview =
        getElement(
            "cancelDepositReview"
        );


    if (
        cancelReview
    ) {

        cancelReview.addEventListener(
            "click",
            closeDepositModal
        );
    }


    const approveButton =
        getElement(
            "approveDepositButton"
        );


    if (
        approveButton
    ) {

        approveButton.addEventListener(
            "click",
            () => {

                processDeposit(
                    "approve"
                );
            }
        );
    }


    const rejectButton =
        getElement(
            "rejectDepositButton"
        );


    if (
        rejectButton
    ) {

        rejectButton.addEventListener(
            "click",
            () => {

                processDeposit(
                    "reject"
                );
            }
        );
    }


    const modal =
        getElement(
            "depositModal"
        );


    if (
        modal
    ) {

        modal.addEventListener(
            "click",
            event => {

                if (
                    event.target === modal
                ) {
                    closeDepositModal();
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
                closeDepositModal();
            }
        }
    );
}


/* =========================================================
   SIDEBAR
   ========================================================= */

function setupSidebar() {

    const sidebar =
        getElement("sidebar");

    const overlay =
        getElement(
            "sidebarOverlay"
        );

    const menuButton =
        getElement(
            "menuButton"
        );

    const closeButton =
        getElement(
            "sidebarClose"
        );


    function openSidebar() {

        if (!sidebar) return;

        sidebar.classList.add(
            "open"
        );

        if (overlay) {
            overlay.classList.add(
                "active"
            );
        }

        document.body.classList.add(
            "sidebar-open"
        );
    }


    function closeSidebar() {

        if (!sidebar) return;

        sidebar.classList.remove(
            "open"
        );

        if (overlay) {
            overlay.classList.remove(
                "active"
            );
        }

        document.body.classList.remove(
            "sidebar-open"
        );
    }


    if (
        menuButton
    ) {

        menuButton.addEventListener(
            "click",
            openSidebar
        );
    }


    if (
        closeButton
    ) {

        closeButton.addEventListener(
            "click",
            closeSidebar
        );
    }


    if (
        overlay
    ) {

        overlay.addEventListener(
            "click",
            closeSidebar
        );
    }


    document
        .querySelectorAll(
            ".sidebar a"
        )
        .forEach(
            link => {

                link.addEventListener(
                    "click",
                    () => {

                        if (
                            window.innerWidth <=
                            900
                        ) {
                            closeSidebar();
                        }
                    }
                );
            }
        );
}


/* =========================================================
   LOGOUT
   ========================================================= */

async function logoutAdmin() {

    const button =
        getElement(
            "logoutButton"
        );


    if (button) {
        button.disabled =
            true;
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


/* =========================================================
   LOGOUT EVENT
   ========================================================= */

function setupLogout() {

    const button =
        getElement(
            "logoutButton"
        );


    if (!button) {
        return;
    }


    button.addEventListener(
        "click",
        event => {

            event.preventDefault();

            logoutAdmin();
        }
    );
}


/* =========================================================
   INITIALIZATION
   ========================================================= */

async function initializeAdminDeposits() {

    showPageLoader();


    try {

        const authenticated =
            await verifyAdministrator();


        if (!authenticated) {

            setText(
                "adminName",
                "Administrator"
            );

            setText(
                "adminEmail",
                "Access verification required"
            );


            const tableBody =
                getElement(
                    "depositsTableBody"
                );


            if (tableBody) {

                tableBody.innerHTML = `
                    <tr>
                        <td colspan="7">
                            <div class="admin-empty-state">

                                <div class="empty-icon">
                                    <svg viewBox="0 0 24 24"
                                         aria-hidden="true">
                                        <path d="M12 3 3 7.5
                                                 12 12l9-4.5L12 3Z"/>
                                        <path d="M3 12l9 4.5
                                                 9-4.5"/>
                                        <path d="M3 16.5
                                                 12 21l9-4.5"/>
                                    </svg>
                                </div>

                                <h3>
                                    Administrator verification required
                                </h3>

                                <p>
                                    Please sign in with your authorized
                                    administrator account.
                                </p>

                            </div>
                        </td>
                    </tr>
                `;
            }


            renderMobileDeposits([]);

            updateStatistics();

            return;
        }


        await Promise.allSettled([
            loadAdminProfile()
        ]);


        await loadDeposits();


    } catch (error) {

        console.error(
            "Admin deposits initialization error:",
            error
        );


        showMessage(
            "Unable to initialize the deposit management page.",
            "error"
        );

    } finally {

        /*
         * This is important.
         * The loader is hidden even when one of the
         * API requests fails.
         */

        hidePageLoader();
    }
}


/* =========================================================
   GLOBAL HELPERS
   ========================================================= */

window.CrownCashAdminDeposits = {

    reload:
        loadDeposits,

    refresh:
        loadDeposits,

    openDeposit:
        viewDeposit,

    closeModal:
        closeDepositModal,

    approve:
        () =>
            processDeposit(
                "approve"
            ),

    reject:
        () =>
            processDeposit(
                "reject"
            )
};


/* =========================================================
   START
   ========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    () => {

        setupSidebar();

        setupLogout();

        attachDepositEvents();

        initializeAdminDeposits();
    }
);