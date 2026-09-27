/* =========================================================
   CROWN CASH — ADMIN SUPPORT
   Administrator Support Ticket Management
   ========================================================= */

"use strict";


/* =========================================================
   API CONFIGURATION
   ========================================================= */

const API_BASE = "https://crown-cash1.onrender.com";

const ADMIN_AUTH_API =
    `${API_BASE}/admin-auth.php`;

const SUPPORT_API =
    `${API_BASE}/admin-support.php`;


/* =========================================================
   SETTINGS
   ========================================================= */

const REQUEST_TIMEOUT = 12000;

const ITEMS_PER_PAGE = 10;


/* =========================================================
   STATE
   ========================================================= */

const state = {
    tickets: [],
    filteredTickets: [],
    currentPage: 1,
    selectedTicket: null,
    loading: false,
    authenticated: false
};


/* =========================================================
   DOM HELPERS
   ========================================================= */

function $(selector) {
    return document.querySelector(selector);
}


function $all(selector) {
    return Array.from(document.querySelectorAll(selector));
}


/* =========================================================
   ELEMENTS
   ========================================================= */

const pageLoader =
    $("#pageLoader");

const loaderMessage =
    $("#loaderMessage");

const supportMessage =
    $("#supportMessage");

const supportTableBody =
    $("#supportTableBody");

const supportMobileList =
    $("#supportMobileList");

const supportPagination =
    $("#supportPagination");

const totalTickets =
    $("#totalTickets");

const openTickets =
    $("#openTickets");

const resolvedTickets =
    $("#resolvedTickets");

const closedTickets =
    $("#closedTickets");

const ticketCount =
    $("#ticketCount");

const statusFilter =
    $("#statusFilter");

const categoryFilter =
    $("#categoryFilter");

const supportSearch =
    $("#supportSearch");

const refreshSupportBtn =
    $("#refreshSupportBtn");

const supportModal =
    $("#supportModal");

const closeSupportModal =
    $("#closeSupportModal");

const closeTicketModal =
    $("#closeTicketModal");

const supportTicketDetails =
    $("#supportTicketDetails");

const supportModalMessage =
    $("#supportModalMessage");

const resolveTicketBtn =
    $("#resolveTicketBtn");


/* =========================================================
   GENERAL HELPERS
   ========================================================= */

function escapeHTML(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


function normalize(value) {
    return String(value ?? "")
        .trim()
        .toLowerCase();
}


function formatNumber(value) {
    const number = Number(value);

    if (!Number.isFinite(number)) {
        return "0";
    }

    return new Intl.NumberFormat("en-US").format(number);
}


function formatDate(value) {
    if (!value) {
        return "—";
    }

    let date;

    try {
        if (
            typeof value === "object" &&
            value.$date
        ) {
            date = new Date(value.$date);
        } else {
            date = new Date(value);
        }

        if (Number.isNaN(date.getTime())) {
            return String(value);
        }

        return new Intl.DateTimeFormat(
            "en-GB",
            {
                day: "2-digit",
                month: "short",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit"
            }
        ).format(date);

    } catch (error) {
        return String(value);
    }
}


function formatShortDate(value) {
    if (!value) {
        return "—";
    }

    try {
        const date = new Date(value);

        if (Number.isNaN(date.getTime())) {
            return String(value);
        }

        return new Intl.DateTimeFormat(
            "en-GB",
            {
                day: "2-digit",
                month: "short",
                year: "numeric"
            }
        ).format(date);

    } catch (error) {
        return String(value);
    }
}


/* =========================================================
   LOADER
   ========================================================= */

function showLoader(message) {

    if (!pageLoader) {
        return;
    }

    pageLoader.hidden = false;

    if (loaderMessage) {
        loaderMessage.textContent =
            message || "Loading...";
    }
}


function hideLoader() {

    if (!pageLoader) {
        return;
    }

    pageLoader.hidden = true;
}


/* =========================================================
   MESSAGE
   ========================================================= */

function showMessage(
    message,
    type = "info"
) {

    if (!supportMessage) {
        return;
    }

    supportMessage.hidden = false;

    supportMessage.className =
        `page-message ${type}`;

    supportMessage.textContent =
        message;
}


function hideMessage() {

    if (!supportMessage) {
        return;
    }

    supportMessage.hidden = true;
    supportMessage.textContent = "";
    supportMessage.className =
        "page-message";
}


function showModalMessage(
    message,
    type = "info"
) {

    if (!supportModalMessage) {
        return;
    }

    supportModalMessage.hidden = false;

    supportModalMessage.className =
        `modal-message ${type}`;

    supportModalMessage.textContent =
        message;
}


function hideModalMessage() {

    if (!supportModalMessage) {
        return;
    }

    supportModalMessage.hidden = true;

    supportModalMessage.textContent = "";

    supportModalMessage.className =
        "modal-message";
}


/* =========================================================
   REQUEST WITH TIMEOUT
   ========================================================= */

async function fetchWithTimeout(
    url,
    options = {},
    timeout = REQUEST_TIMEOUT
) {

    const controller =
        new AbortController();

    const timeoutId =
        setTimeout(
            () => controller.abort(),
            timeout
        );

    try {

        const response =
            await fetch(
                url,
                {
                    ...options,
                    signal: controller.signal,
                    cache: "no-store",
                    credentials: "include"
                }
            );

        return response;

    } finally {

        clearTimeout(timeoutId);
    }
}


/* =========================================================
   JSON REQUEST
   ========================================================= */

async function fetchJSON(
    url,
    options = {}
) {

    let response;

    try {

        response =
            await fetchWithTimeout(
                url,
                options
            );

    } catch (error) {

        if (
            error &&
            error.name === "AbortError"
        ) {
            throw new Error(
                "The server took too long to respond."
            );
        }

        throw new Error(
            "Unable to connect to the Crown Cash server."
        );
    }


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

        try {

            data =
                await response.json();

        } catch (error) {

            throw new Error(
                "The server returned invalid JSON."
            );
        }

    } else {

        const text =
            await response.text();

        if (text) {

            try {
                data = JSON.parse(text);
            } catch (error) {

                throw new Error(
                    "The server returned an unexpected response."
                );
            }
        }
    }


    if (!response.ok) {

        if (
            response.status === 401 ||
            response.status === 403
        ) {

            const error =
                new Error(
                    data?.message ||
                    "Administrator authorization is required."
                );

            error.status =
                response.status;

            throw error;
        }


        const error =
            new Error(
                data?.message ||
                `Server error (${response.status}).`
            );

        error.status =
            response.status;

        throw error;
    }


    if (
        data &&
        data.success === false
    ) {

        const error =
            new Error(
                data.message ||
                "The request was not successful."
            );

        error.status =
            response.status;

        throw error;
    }


    return data || {};
}


/* =========================================================
   ADMINISTRATOR VERIFICATION
   ========================================================= */

async function verifyAdministrator() {

    showLoader(
        "Verifying administrator access..."
    );

    try {

        const data =
            await fetchJSON(
                ADMIN_AUTH_API,
                {
                    method: "GET",
                    headers: {
                        "Accept":
                            "application/json"
                    }
                }
            );


        if (
            data.success === true &&
            (
                data.authorized === true ||
                data.authenticated === true
            )
        ) {

            state.authenticated = true;

            hideLoader();

            return true;
        }


        throw new Error(
            data.message ||
            "Administrator access was not confirmed."
        );

    } catch (error) {

        state.authenticated = false;

        hideLoader();

        renderAuthorizationError(
            error
        );

        return false;
    }
}


/* =========================================================
   AUTHORIZATION ERROR
   ========================================================= */

function renderAuthorizationError(error) {

    const message =
        error?.message ||
        "Administrator verification failed.";


    showMessage(
        message,
        "error"
    );


    if (supportTableBody) {

        supportTableBody.innerHTML = `
            <tr>
                <td
                    colspan="7"
                    class="table-state">
                    <strong>
                        Administrator access could not be verified.
                    </strong>
                    <br>
                    <span style="display:block;margin-top:6px;">
                        ${escapeHTML(message)}
                    </span>
                    <br>
                    <button
                        type="button"
                        class="button button-primary"
                        id="retryAdminSupportBtn">
                        Retry
                    </button>
                </td>
            </tr>
        `;
    }


    if (supportMobileList) {

        supportMobileList.innerHTML = `
            <div class="mobile-list-state">
                <strong>
                    Administrator access could not be verified.
                </strong>
                <br>
                <span style="display:block;margin-top:7px;">
                    ${escapeHTML(message)}
                </span>
                <br>
                <button
                    type="button"
                    class="button button-primary"
                    id="retryAdminSupportMobileBtn">
                    Retry
                </button>
            </div>
        `;
    }


    const retryDesktop =
        $("#retryAdminSupportBtn");

    const retryMobile =
        $("#retryAdminSupportMobileBtn");


    if (retryDesktop) {

        retryDesktop.addEventListener(
            "click",
            initializeAdminSupport
        );
    }


    if (retryMobile) {

        retryMobile.addEventListener(
            "click",
            initializeAdminSupport
        );
    }
}


/* =========================================================
   LOAD SUPPORT TICKETS
   ========================================================= */

async function loadSupportTickets() {

    if (!state.authenticated) {
        return;
    }


    state.loading = true;

    hideMessage();


    if (supportTableBody) {

        supportTableBody.innerHTML = `
            <tr>
                <td
                    colspan="7"
                    class="table-state">
                    Loading support tickets...
                </td>
            </tr>
        `;
    }


    if (supportMobileList) {

        supportMobileList.innerHTML = `
            <div class="mobile-list-state">
                Loading support tickets...
            </div>
        `;
    }


    try {

        const data =
            await fetchJSON(
                SUPPORT_API,
                {
                    method: "GET",
                    headers: {
                        "Accept":
                            "application/json"
                    }
                }
            );


        const rawTickets =
            data.tickets ||
            data.items ||
            data.records ||
            data.support_tickets ||
            data.data ||
            [];


        state.tickets =
            Array.isArray(rawTickets)
                ? rawTickets
                : [];


        updateStatistics();

        applyFilters();


    } catch (error) {

        console.error(
            "Admin support loading error:",
            error
        );


        state.tickets = [];
        state.filteredTickets = [];


        updateStatistics();

        renderEmptyState(
            error.message ||
            "Unable to load support tickets."
        );


        showMessage(
            error.message ||
            "Unable to load support tickets.",
            "error"
        );

    } finally {

        state.loading = false;
    }
}


/* =========================================================
   GET TICKET FIELD
   ========================================================= */

function getTicketId(ticket) {

    return (
        ticket.ticket_id ||
        ticket.ticketId ||
        ticket.id ||
        ticket._id ||
        ticket.support_id ||
        "—"
    );
}


function getCustomerName(ticket) {

    if (ticket.user) {

        return (
            ticket.user.full_name ||
            ticket.user.name ||
            ticket.user.username ||
            ticket.user.email ||
            "Customer"
        );
    }


    return (
        ticket.full_name ||
        ticket.user_name ||
        ticket.customer_name ||
        ticket.name ||
        ticket.username ||
        "Customer"
    );
}


function getCustomerEmail(ticket) {

    if (ticket.user) {

        return (
            ticket.user.email ||
            ""
        );
    }


    return (
        ticket.email ||
        ticket.customer_email ||
        ticket.user_email ||
        ""
    );
}


function getCategory(ticket) {

    return (
        ticket.category ||
        ticket.support_category ||
        "other"
    );
}


function getSubject(ticket) {

    return (
        ticket.subject ||
        ticket.title ||
        "Support request"
    );
}


function getMessage(ticket) {

    return (
        ticket.message ||
        ticket.description ||
        ticket.content ||
        ""
    );
}


function getStatus(ticket) {

    return normalize(
        ticket.status ||
        ticket.ticket_status ||
        "open"
    );
}


function getCreatedAt(ticket) {

    return (
        ticket.created_at ||
        ticket.createdAt ||
        ticket.submitted_at ||
        ticket.date ||
        ticket.timestamp ||
        ""
    );
}


/* =========================================================
   DISPLAY STATUS
   ========================================================= */

function prettyStatus(status) {

    const value =
        normalize(status);

    const labels = {
        open: "Open",
        pending: "Pending",
        in_progress: "In progress",
        resolved: "Resolved",
        closed: "Closed",
        rejected: "Rejected"
    };


    return (
        labels[value] ||
        value
            .replace(/_/g, " ")
            .replace(/\b\w/g, char =>
                char.toUpperCase()
            ) ||
        "Open"
    );
}


/* =========================================================
   STATUS CLASS
   ========================================================= */

function statusClass(status) {

    const value =
        normalize(status)
            .replace(/\s+/g, "-");


    return (
        `status-${value}`
    );
}


/* =========================================================
   UPDATE STATISTICS
   ========================================================= */

function updateStatistics() {

    const tickets =
        state.tickets;


    const total =
        tickets.length;


    const open =
        tickets.filter(ticket => {

            const status =
                getStatus(ticket);

            return (
                status === "open" ||
                status === "pending" ||
                status === "in_progress"
            );

        }).length;


    const resolved =
        tickets.filter(ticket =>
            getStatus(ticket) === "resolved"
        ).length;


    const closed =
        tickets.filter(ticket =>
            getStatus(ticket) === "closed"
        ).length;


    if (totalTickets) {
        totalTickets.textContent =
            formatNumber(total);
    }


    if (openTickets) {
        openTickets.textContent =
            formatNumber(open);
    }


    if (resolvedTickets) {
        resolvedTickets.textContent =
            formatNumber(resolved);
    }


    if (closedTickets) {
        closedTickets.textContent =
            formatNumber(closed);
    }
}


/* =========================================================
   APPLY FILTERS
   ========================================================= */

function applyFilters() {

    const status =
        normalize(
            statusFilter?.value || "all"
        );


    const category =
        normalize(
            categoryFilter?.value || "all"
        );


    const search =
        normalize(
            supportSearch?.value || ""
        );


    state.filteredTickets =
        state.tickets.filter(ticket => {

            const ticketStatus =
                getStatus(ticket);

            const ticketCategory =
                normalize(
                    getCategory(ticket)
                );


            const id =
                normalize(
                    getTicketId(ticket)
                );

            const customer =
                normalize(
                    getCustomerName(ticket)
                );

            const email =
                normalize(
                    getCustomerEmail(ticket)
                );

            const subject =
                normalize(
                    getSubject(ticket)
                );


            const statusMatches =
                status === "all" ||
                ticketStatus === status;


            const categoryMatches =
                category === "all" ||
                ticketCategory === category;


            const searchMatches =
                !search ||
                id.includes(search) ||
                customer.includes(search) ||
                email.includes(search) ||
                subject.includes(search);


            return (
                statusMatches &&
                categoryMatches &&
                searchMatches
            );
        });


    state.currentPage = 1;

    renderTickets();
}


/* =========================================================
   RENDER TICKETS
   ========================================================= */

function renderTickets() {

    const tickets =
        state.filteredTickets;


    if (ticketCount) {

        ticketCount.textContent =
            `${formatNumber(tickets.length)} ${
                tickets.length === 1
                    ? "ticket"
                    : "tickets"
            }`;
    }


    if (!tickets.length) {

        renderEmptyState(
            "No support tickets match the current filters."
        );

        return;
    }


    const start =
        (
            state.currentPage - 1
        ) * ITEMS_PER_PAGE;


    const end =
        start + ITEMS_PER_PAGE;


    const pageTickets =
        tickets.slice(
            start,
            end
        );


    renderDesktopTable(
        pageTickets
    );


    renderMobileTickets(
        pageTickets
    );


    renderPagination(
        tickets.length
    );
}


/* =========================================================
   DESKTOP TABLE
   ========================================================= */

function renderDesktopTable(tickets) {

    if (!supportTableBody) {
        return;
    }


    supportTableBody.innerHTML =
        tickets.map(ticket => {

            const id =
                getTicketId(ticket);

            const customer =
                getCustomerName(ticket);

            const email =
                getCustomerEmail(ticket);

            const category =
                getCategory(ticket);

            const subject =
                getSubject(ticket);

            const status =
                getStatus(ticket);

            const date =
                getCreatedAt(ticket);


            return `
                <tr>

                    <td>
                        <span class="ticket-id">
                            ${escapeHTML(id)}
                        </span>
                    </td>

                    <td>
                        <span class="customer-name">
                            ${escapeHTML(customer)}
                        </span>

                        ${
                            email
                                ? `
                                    <span class="customer-email">
                                        ${escapeHTML(email)}
                                    </span>
                                `
                                : ""
                        }
                    </td>

                    <td>
                        ${escapeHTML(
                            prettyCategory(category)
                        )}
                    </td>

                    <td>
                        <span
                            class="subject-text"
                            title="${escapeHTML(subject)}">
                            ${escapeHTML(subject)}
                        </span>
                    </td>

                    <td>
                        <span
                            class="status-pill ${statusClass(status)}">
                            ${escapeHTML(
                                prettyStatus(status)
                            )}
                        </span>
                    </td>

                    <td>
                        ${escapeHTML(
                            formatDate(date)
                        )}
                    </td>

                    <td>
                        <button
                            type="button"
                            class="view-button"
                            data-ticket-id="${escapeHTML(id)}"
                            aria-label="View support ticket"
                            title="View ticket">

                            <svg
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                stroke-width="1.8"
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                aria-hidden="true">

                                <path
                                    d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z"/>

                                <circle
                                    cx="12"
                                    cy="12"
                                    r="2.5"/>
                            </svg>

                        </button>
                    </td>

                </tr>
            `;

        }).join("");
}


/* =========================================================
   MOBILE TICKETS
   ========================================================= */

function renderMobileTickets(tickets) {

    if (!supportMobileList) {
        return;
    }


    supportMobileList.innerHTML =
        tickets.map(ticket => {

            const id =
                getTicketId(ticket);

            const customer =
                getCustomerName(ticket);

            const category =
                getCategory(ticket);

            const subject =
                getSubject(ticket);

            const status =
                getStatus(ticket);

            const date =
                getCreatedAt(ticket);


            return `
                <article class="mobile-ticket-card">

                    <div class="mobile-ticket-top">

                        <div>
                            <div class="mobile-ticket-id">
                                ${escapeHTML(id)}
                            </div>

                            <div class="mobile-ticket-date">
                                ${escapeHTML(
                                    formatShortDate(date)
                                )}
                            </div>
                        </div>

                        <span
                            class="status-pill ${statusClass(status)}">
                            ${escapeHTML(
                                prettyStatus(status)
                            )}
                        </span>

                    </div>


                    <h3 class="mobile-ticket-subject">
                        ${escapeHTML(subject)}
                    </h3>


                    <div class="mobile-ticket-customer">
                        ${escapeHTML(customer)}
                    </div>


                    <div class="mobile-ticket-category">
                        ${escapeHTML(
                            prettyCategory(category)
                        )}
                    </div>


                    <div class="mobile-ticket-bottom">

                        <span
                            class="ticket-id">
                            Support Request
                        </span>

                        <button
                            type="button"
                            class="view-button"
                            data-ticket-id="${escapeHTML(id)}"
                            aria-label="View support ticket"
                            title="View ticket">

                            <svg
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                stroke-width="1.8"
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                aria-hidden="true">

                                <path
                                    d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z"/>

                                <circle
                                    cx="12"
                                    cy="12"
                                    r="2.5"/>
                            </svg>

                        </button>

                    </div>

                </article>
            `;

        }).join("");
}


/* =========================================================
   EMPTY STATE
   ========================================================= */

function renderEmptyState(message) {

    if (supportTableBody) {

        supportTableBody.innerHTML = `
            <tr>
                <td
                    colspan="7"
                    class="table-state">
                    ${escapeHTML(message)}
                </td>
            </tr>
        `;
    }


    if (supportMobileList) {

        supportMobileList.innerHTML = `
            <div class="mobile-list-state">
                ${escapeHTML(message)}
            </div>
        `;
    }


    if (supportPagination) {
        supportPagination.hidden = true;
    }
}


/* =========================================================
   CATEGORY DISPLAY
   ========================================================= */

function prettyCategory(category) {

    const value =
        normalize(category);


    const labels = {
        account: "Account",
        deposit: "Deposits",
        withdrawal: "Withdrawals",
        investment: "Investments",
        referral: "Referrals",
        technical: "Technical",
        other: "Other"
    };


    return (
        labels[value] ||
        value
            .replace(/_/g, " ")
            .replace(/\b\w/g, char =>
                char.toUpperCase()
            ) ||
        "Other"
    );
}


/* =========================================================
   PAGINATION
   ========================================================= */

function renderPagination(totalItems) {

    if (!supportPagination) {
        return;
    }


    const totalPages =
        Math.ceil(
            totalItems /
            ITEMS_PER_PAGE
        );


    if (totalPages <= 1) {

        supportPagination.hidden = true;

        supportPagination.innerHTML = "";

        return;
    }


    supportPagination.hidden = false;


    let html = "";


    html += `
        <button
            type="button"
            data-page="${state.currentPage - 1}"
            ${state.currentPage <= 1 ? "disabled" : ""}>
            Previous
        </button>
    `;


    for (
        let page = 1;
        page <= totalPages;
        page++
    ) {

        if (
            totalPages > 7 &&
            page !== 1 &&
            page !== totalPages &&
            Math.abs(
                page - state.currentPage
            ) > 1
        ) {

            if (
                page === 2 ||
                page === totalPages - 1
            ) {

                html += `
                    <span
                        style="
                            color:#77717d;
                            padding:0 3px;
                            font-size:10px;
                        ">
                        ...
                    </span>
                `;
            }

            continue;
        }


        html += `
            <button
                type="button"
                class="${
                    page === state.currentPage
                        ? "active"
                        : ""
                }"
                data-page="${page}">
                ${page}
            </button>
        `;
    }


    html += `
        <button
            type="button"
            data-page="${state.currentPage + 1}"
            ${
                state.currentPage >= totalPages
                    ? "disabled"
                    : ""
            }>
            Next
        </button>
    `;


    supportPagination.innerHTML =
        html;
}


/* =========================================================
   OPEN TICKET MODAL
   ========================================================= */

function openTicketModal(ticket) {

    if (!supportModal) {
        return;
    }


    state.selectedTicket =
        ticket;


    hideModalMessage();


    renderTicketDetails(
        ticket
    );


    const status =
        getStatus(ticket);


    if (resolveTicketBtn) {

        resolveTicketBtn.disabled =
            (
                status === "resolved" ||
                status === "closed"
            );
    }


    supportModal.hidden = false;

    document.body.style.overflow =
        "hidden";
}


/* =========================================================
   RENDER TICKET DETAILS
   ========================================================= */

function renderTicketDetails(ticket) {

    if (!supportTicketDetails) {
        return;
    }


    const id =
        getTicketId(ticket);

    const customer =
        getCustomerName(ticket);

    const email =
        getCustomerEmail(ticket);

    const category =
        getCategory(ticket);

    const subject =
        getSubject(ticket);

    const message =
        getMessage(ticket);

    const status =
        getStatus(ticket);

    const date =
        getCreatedAt(ticket);


    supportTicketDetails.innerHTML = `

        <div class="details-grid">

            <div class="detail-item">
                <span class="detail-label">
                    Ticket ID
                </span>

                <span class="detail-value highlight">
                    ${escapeHTML(id)}
                </span>
            </div>


            <div class="detail-item">
                <span class="detail-label">
                    Status
                </span>

                <span class="detail-value">
                    <span
                        class="status-pill ${statusClass(status)}">
                        ${escapeHTML(
                            prettyStatus(status)
                        )}
                    </span>
                </span>
            </div>


            <div class="detail-item">
                <span class="detail-label">
                    Customer
                </span>

                <span class="detail-value">
                    ${escapeHTML(customer)}
                </span>
            </div>


            <div class="detail-item">
                <span class="detail-label">
                    Email
                </span>

                <span class="detail-value">
                    ${escapeHTML(
                        email || "—"
                    )}
                </span>
            </div>


            <div class="detail-item">
                <span class="detail-label">
                    Category
                </span>

                <span class="detail-value">
                    ${escapeHTML(
                        prettyCategory(category)
                    )}
                </span>
            </div>


            <div class="detail-item">
                <span class="detail-label">
                    Submitted
                </span>

                <span class="detail-value">
                    ${escapeHTML(
                        formatDate(date)
                    )}
                </span>
            </div>

        </div>


        <div class="detail-item"
             style="margin-bottom:10px;">

            <span class="detail-label">
                Subject
            </span>

            <span class="detail-value">
                ${escapeHTML(subject)}
            </span>

        </div>


        <div class="message-detail">

            <span class="detail-label">
                Customer Message
            </span>

            <div class="message-content">
                ${escapeHTML(
                    message ||
                    "No message was provided."
                )}
            </div>

        </div>
    `;
}


/* =========================================================
   CLOSE MODAL
   ========================================================= */

function closeTicketModalWindow() {

    if (!supportModal) {
        return;
    }


    supportModal.hidden = true;

    document.body.style.overflow =
        "";


    state.selectedTicket =
        null;


    hideModalMessage();
}


/* =========================================================
   RESOLVE TICKET
   ========================================================= */

async function resolveSelectedTicket() {

    const ticket =
        state.selectedTicket;


    if (!ticket) {
        return;
    }


    const ticketId =
        getTicketId(ticket);


    if (!ticketId || ticketId === "—") {

        showModalMessage(
            "This ticket does not have a valid ticket ID.",
            "error"
        );

        return;
    }


    const currentStatus =
        getStatus(ticket);


    if (
        currentStatus === "resolved" ||
        currentStatus === "closed"
    ) {
        return;
    }


    if (
        !window.confirm(
            "Mark this support ticket as resolved?"
        )
    ) {
        return;
    }


    if (resolveTicketBtn) {

        resolveTicketBtn.disabled =
            true;

        resolveTicketBtn.dataset.originalText =
            resolveTicketBtn.textContent;

        resolveTicketBtn.textContent =
            "Updating...";
    }


    hideModalMessage();


    try {

        const data =
            await fetchJSON(
                SUPPORT_API,
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json",

                        "Accept":
                            "application/json"
                    },

                    body: JSON.stringify({
                        action: "resolve",
                        ticket_id: ticketId
                    })
                }
            );


        if (
            data.success !== true
        ) {

            throw new Error(
                data.message ||
                "Unable to update ticket."
            );
        }


        showModalMessage(
            data.message ||
            "Support ticket marked as resolved.",
            "success"
        );


        /* Update local ticket immediately */

        ticket.status =
            "resolved";


        updateStatistics();

        applyFilters();


        setTimeout(
            () => {

                if (supportModal) {
                    closeTicketModalWindow();
                }

            },
            700
        );


    } catch (error) {

        console.error(
            "Resolve support ticket error:",
            error
        );


        showModalMessage(
            error.message ||
            "Unable to update the support ticket.",
            "error"
        );


        if (resolveTicketBtn) {
            resolveTicketBtn.disabled =
                false;
        }

    } finally {

        if (resolveTicketBtn) {

            resolveTicketBtn.textContent =
                "Mark Resolved";
        }
    }
}


/* =========================================================
   REFRESH
   ========================================================= */

async function refreshSupportTickets() {

    if (!state.authenticated) {
        return;
    }


    if (refreshSupportBtn) {

        refreshSupportBtn.disabled =
            true;

        refreshSupportBtn.style.opacity =
            "0.55";
    }


    try {

        await loadSupportTickets();

    } finally {

        if (refreshSupportBtn) {

            refreshSupportBtn.disabled =
                false;

            refreshSupportBtn.style.opacity =
                "";
        }
    }
}


/* =========================================================
   EVENT DELEGATION — VIEW BUTTONS
   ========================================================= */

function handleTicketViewClick(event) {

    const button =
        event.target.closest(
            "[data-ticket-id]"
        );


    if (!button) {
        return;
    }


    const ticketId =
        button.dataset.ticketId;


    if (!ticketId) {
        return;
    }


    const ticket =
        state.tickets.find(
            item =>
                String(
                    getTicketId(item)
                ) === String(ticketId)
        );


    if (!ticket) {

        showMessage(
            "The selected support ticket could not be found.",
            "error"
        );

        return;
    }


    openTicketModal(
        ticket
    );
}


/* =========================================================
   PAGINATION CLICK
   ========================================================= */

function handlePaginationClick(event) {

    const button =
        event.target.closest(
            "button[data-page]"
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
        !Number.isInteger(page) ||
        page < 1
    ) {
        return;
    }


    state.currentPage =
        page;


    renderTickets();


    const recordsSection =
        document.querySelector(
            ".records-section"
        );


    if (recordsSection) {

        recordsSection.scrollIntoView({
            behavior: "smooth",
            block: "start"
        });
    }
}


/* =========================================================
   EVENTS
   ========================================================= */

function setupEvents() {

    if (statusFilter) {

        statusFilter.addEventListener(
            "change",
            applyFilters
        );
    }


    if (categoryFilter) {

        categoryFilter.addEventListener(
            "change",
            applyFilters
        );
    }


    if (supportSearch) {

        let searchTimer;


        supportSearch.addEventListener(
            "input",
            () => {

                clearTimeout(
                    searchTimer
                );


                searchTimer =
                    setTimeout(
                        applyFilters,
                        180
                    );
            }
        );
    }


    if (refreshSupportBtn) {

        refreshSupportBtn.addEventListener(
            "click",
            refreshSupportTickets
        );
    }


    if (supportTableBody) {

        supportTableBody.addEventListener(
            "click",
            handleTicketViewClick
        );
    }


    if (supportMobileList) {

        supportMobileList.addEventListener(
            "click",
            handleTicketViewClick
        );
    }


    if (supportPagination) {

        supportPagination.addEventListener(
            "click",
            handlePaginationClick
        );
    }


    if (closeSupportModal) {

        closeSupportModal.addEventListener(
            "click",
            closeTicketModalWindow
        );
    }


    if (closeTicketModal) {

        closeTicketModal.addEventListener(
            "click",
            closeTicketModalWindow
        );
    }


    if (resolveTicketBtn) {

        resolveTicketBtn.addEventListener(
            "click",
            resolveSelectedTicket
        );
    }


    if (supportModal) {

        supportModal.addEventListener(
            "click",
            event => {

                if (
                    event.target ===
                    supportModal
                ) {

                    closeTicketModalWindow();
                }
            }
        );
    }


    document.addEventListener(
        "keydown",
        event => {

            if (
                event.key === "Escape" &&
                supportModal &&
                !supportModal.hidden
            ) {

                closeTicketModalWindow();
            }
        }
    );
}


/* =========================================================
   INITIALIZATION
   ========================================================= */

async function initializeAdminSupport() {

    state.authenticated =
        false;

    showLoader(
        "Verifying administrator access..."
    );


    const authorized =
        await verifyAdministrator();


    if (!authorized) {
        return;
    }


    showLoader(
        "Loading support requests..."
    );


    await loadSupportTickets();


    hideLoader();
}


/* =========================================================
   START
   ========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    () => {

        setupEvents();

        initializeAdminSupport();
    }
);


/* =========================================================
   GLOBAL SUPPORT OBJECT
   ========================================================= */

window.CrownCashAdminSupport = {

    reload:
        loadSupportTickets,

    refresh:
        refreshSupportTickets,

    verifyAdministrator:
        verifyAdministrator,

    initialize:
        initializeAdminSupport,

    getState:
        () => ({
            ...state,
            tickets: [
                ...state.tickets
            ],
            filteredTickets: [
                ...state.filteredTickets
            ]
        })
};