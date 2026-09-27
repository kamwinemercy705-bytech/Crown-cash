/* =========================================================
   CROWN CASH ADMIN
   SECURITY & AUDIT
   admin-security.js
   ========================================================= */

"use strict";


/* =========================================================
   API CONFIGURATION
   ========================================================= */

const API_BASE = "https://crown-cash1.onrender.com";

const ADMIN_AUTH_API =
    `${API_BASE}/admin-auth.php`;

const SECURITY_API =
    `${API_BASE}/admin-security.php`;

const REQUEST_TIMEOUT = 12000;

const ITEMS_PER_PAGE = 10;


/* =========================================================
   STATE
   ========================================================= */

const state = {

    authenticated: false,

    auditRecords: [],

    filteredAuditRecords: [],

    currentPage: 1,

    maintenanceEnabled: false,

    maintenanceMessage: "",

    allowAdminAccess: true,

    pendingMaintenanceState: false

};


/* =========================================================
   DOM HELPERS
   ========================================================= */

function getElement(id) {
    return document.getElementById(id);
}


function showElement(element) {
    if (element) {
        element.hidden = false;
    }
}


function hideElement(element) {
    if (element) {
        element.hidden = true;
    }
}


/* =========================================================
   PAGE LOADER
   ========================================================= */

function setLoaderMessage(message) {

    const loaderMessage =
        getElement("loaderMessage");

    if (loaderMessage) {
        loaderMessage.textContent = message;
    }
}


function hidePageLoader() {

    const loader =
        getElement("pageLoader");

    if (!loader) {
        return;
    }

    loader.hidden = true;
}


function showPageLoader(message) {

    const loader =
        getElement("pageLoader");

    if (!loader) {
        return;
    }

    setLoaderMessage(message || "Loading...");

    loader.hidden = false;
}


/* =========================================================
   MESSAGE
   ========================================================= */

function showMessage(
    message,
    type = "success"
) {

    const element =
        getElement("securityMessage");

    if (!element) {
        return;
    }

    element.textContent = message;

    element.className =
        `page-message show ${type}`;

}


function clearMessage() {

    const element =
        getElement("securityMessage");

    if (!element) {
        return;
    }

    element.textContent = "";

    element.className =
        "page-message";
}


/* =========================================================
   FETCH WITH TIMEOUT
   ========================================================= */

async function fetchJson(
    url,
    options = {},
    timeout = REQUEST_TIMEOUT
) {

    const controller =
        new AbortController();

    const timer =
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

                    credentials: "include",

                    cache: "no-store",

                    signal:
                        controller.signal
                }
            );

        const text =
            await response.text();

        let data = {};

        if (text) {

            try {
                data = JSON.parse(text);
            } catch (error) {

                throw new Error(
                    "The server returned an invalid response."
                );

            }

        }

        if (!response.ok) {

            const error =
                new Error(
                    data.message ||
                    `Request failed (${response.status}).`
                );

            error.status =
                response.status;

            error.data =
                data;

            throw error;
        }

        return data;

    } catch (error) {

        if (error.name === "AbortError") {

            throw new Error(
                "The request timed out. Please try again."
            );

        }

        throw error;

    } finally {

        clearTimeout(timer);

    }

}


/* =========================================================
   ADMIN VERIFICATION
   ========================================================= */

async function verifyAdministrator() {

    setLoaderMessage(
        "Verifying administrator access..."
    );

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
            data.authenticated !== true ||
            data.authorized !== true
        ) {

            throw new Error(
                data?.message ||
                "Administrator access was not authorized."
            );

        }

        state.authenticated = true;

        return true;

    } catch (error) {

        state.authenticated = false;

        hidePageLoader();

        showElement(
            getElement("adminSecurityPage")
        );

        showMessage(
            error.message ||
            "Administrator verification failed.",
            "error"
        );

        return false;
    }

}


/* =========================================================
   NORMALIZE AUDIT RECORD
   ========================================================= */

function normalizeAuditRecord(record) {

    record =
        record || {};

    const user =
        record.user ||
        record.admin ||
        {};

    const id =
        record.id ||
        record._id ||
        record.audit_id ||
        record.event_id ||
        "";

    const userName =
        record.user_name ||
        record.full_name ||
        record.name ||
        user.full_name ||
        user.name ||
        record.email ||
        user.email ||
        "System";

    const email =
        record.email ||
        user.email ||
        "";

    const action =
        record.action ||
        record.activity ||
        record.operation ||
        "Unknown";

    const event =
        record.event ||
        record.event_type ||
        record.type ||
        record.description ||
        action;

    const status =
        String(
            record.status ||
            record.result ||
            "success"
        ).toLowerCase();

    const ipAddress =
        record.ip_address ||
        record.ip ||
        record.client_ip ||
        "—";

    const userAgent =
        record.user_agent ||
        record.browser ||
        "";

    const createdAt =
        record.created_at ||
        record.timestamp ||
        record.date ||
        record.logged_at ||
        "";

    const details =
        record.details ||
        record.metadata ||
        record.description ||
        "";

    return {

        id: String(id),

        userName: String(userName),

        email: String(email),

        action: String(action),

        event: String(event),

        status,

        ipAddress: String(ipAddress),

        userAgent: String(userAgent),

        createdAt,

        details

    };

}


/* =========================================================
   FORMAT DATE
   ========================================================= */

function formatDateTime(value) {

    if (!value) {
        return "—";
    }

    try {

        let date;

        if (
            typeof value === "object" &&
            value.$date
        ) {
            date =
                new Date(value.$date);
        } else {
            date =
                new Date(value);
        }

        if (
            Number.isNaN(
                date.getTime()
            )
        ) {
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


/* =========================================================
   ESCAPE HTML
   ========================================================= */

function escapeHtml(value) {

    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");

}


/* =========================================================
   STATUS CLASS
   ========================================================= */

function getStatusClass(status) {

    const normalized =
        String(status || "")
            .toLowerCase();

    if (
        normalized === "success" ||
        normalized === "successful" ||
        normalized === "active"
    ) {
        return "status-success";
    }

    if (
        normalized === "failed" ||
        normalized === "failure" ||
        normalized === "error"
    ) {
        return "status-failed";
    }

    if (
        normalized === "warning" ||
        normalized === "pending"
    ) {
        return "status-warning";
    }

    return "status-inactive";

}


/* =========================================================
   STATUS LABEL
   ========================================================= */

function formatStatus(status) {

    if (!status) {
        return "Unknown";
    }

    return String(status)
        .replace(/[_-]+/g, " ")
        .replace(/\b\w/g, char =>
            char.toUpperCase()
        );

}


/* =========================================================
   LOAD SECURITY DATA
   ========================================================= */

async function loadSecurityData() {

    clearMessage();

    try {

        const data =
            await fetchJson(
                SECURITY_API,
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
                "Unable to load security information."
            );

        }

        updateSecurityStats(data);

        updateSecurityControls(data);

        loadAuditData(data);

        loadMaintenanceSettings(data);

    } catch (error) {

        showMessage(
            error.message ||
            "Unable to load security information.",
            "error"
        );

        renderAuditError(
            error.message ||
            "Unable to load audit activity."
        );

    }

}


/* =========================================================
   UPDATE SECURITY STATS
   ========================================================= */

function updateSecurityStats(data) {

    const stats =
        data.stats ||
        data.summary ||
        {};

    const securityStatus =
        getElement("securityStatus");

    const securityStatusText =
        getElement("securityStatusText");

    const adminSessions =
        getElement("adminSessions");

    const failedAttempts =
        getElement("failedAttempts");

    const securityEvents =
        getElement("securityEvents");


    const status =
        stats.security_status ||
        stats.securityStatus ||
        data.security_status ||
        "Secure";


    const sessions =
        stats.admin_sessions ??
        stats.adminSessions ??
        data.admin_sessions ??
        0;


    const failed =
        stats.failed_attempts ??
        stats.failedAttempts ??
        data.failed_attempts ??
        0;


    const events =
        stats.security_events ??
        stats.securityEvents ??
        stats.audit_events ??
        data.security_events ??
        data.audit_count ??
        0;


    if (securityStatus) {
        securityStatus.textContent =
            formatStatus(status);
    }


    if (securityStatusText) {

        const normalized =
            String(status).toLowerCase();

        if (
            normalized === "secure" ||
            normalized === "active" ||
            normalized === "protected"
        ) {

            securityStatusText.textContent =
                "Platform protection active";

        } else {

            securityStatusText.textContent =
                "Review security activity";

        }

    }


    if (adminSessions) {
        adminSessions.textContent =
            Number(sessions).toLocaleString();
    }


    if (failedAttempts) {
        failedAttempts.textContent =
            Number(failed).toLocaleString();
    }


    if (securityEvents) {
        securityEvents.textContent =
            Number(events).toLocaleString();
    }

}


/* =========================================================
   UPDATE SECURITY CONTROLS
   ========================================================= */

function updateSecurityControls(data) {

    const controls =
        data.controls ||
        data.security_controls ||
        {};


    const loginProtection =
        controls.login_protection ??
        controls.loginProtection ??
        data.login_protection ??
        true;


    const sessionTimeout =
        controls.session_timeout ??
        controls.sessionTimeout ??
        data.session_timeout ??
        7200;


    const loginStatus =
        getElement(
            "loginProtectionStatus"
        );

    const sessionStatus =
        getElement(
            "sessionSecurityStatus"
        );


    if (loginStatus) {

        loginStatus.textContent =
            loginProtection
                ? "Active"
                : "Inactive";

        loginStatus.className =
            loginProtection
                ? "status-pill status-active"
                : "status-pill status-inactive";

    }


    if (sessionStatus) {

        const hours =
            Math.round(
                Number(sessionTimeout) / 3600
            );

        sessionStatus.textContent =
            hours > 0
                ? `${hours} Hours`
                : "Active";

    }

}


/* =========================================================
   LOAD AUDIT DATA
   ========================================================= */

function loadAuditData(data) {

    const raw =
        data.audit_logs ||
        data.auditLogs ||
        data.audit ||
        data.events ||
        data.records ||
        [];


    state.auditRecords =
        Array.isArray(raw)
            ? raw.map(normalizeAuditRecord)
            : [];


    state.currentPage = 1;

    applyAuditFilters();

}


/* =========================================================
   AUDIT FILTERS
   ========================================================= */

function applyAuditFilters() {

    const searchInput =
        getElement("auditSearch");

    const typeFilter =
        getElement("auditTypeFilter");

    const statusFilter =
        getElement("auditStatusFilter");


    const search =
        String(
            searchInput?.value || ""
        )
            .trim()
            .toLowerCase();


    const type =
        String(
            typeFilter?.value || ""
        )
            .trim()
            .toLowerCase();


    const status =
        String(
            statusFilter?.value || ""
        )
            .trim()
            .toLowerCase();


    state.filteredAuditRecords =
        state.auditRecords.filter(
            record => {

                const searchable = [
                    record.userName,
                    record.email,
                    record.action,
                    record.event,
                    record.ipAddress,
                    record.details
                ]
                    .join(" ")
                    .toLowerCase();


                const matchesSearch =
                    !search ||
                    searchable.includes(search);


                const normalizedEvent =
                    String(
                        record.event
                    ).toLowerCase();


                const normalizedAction =
                    String(
                        record.action
                    ).toLowerCase();


                let matchesType = true;

                if (type) {

                    matchesType =
                        normalizedEvent.includes(type) ||
                        normalizedAction.includes(type);

                }


                const matchesStatus =
                    !status ||
                    String(record.status)
                        .toLowerCase() === status;


                return (
                    matchesSearch &&
                    matchesType &&
                    matchesStatus
                );

            }
        );


    updateAuditCounts();

    renderAuditRecords();

}


/* =========================================================
   AUDIT COUNTS
   ========================================================= */

function updateAuditCounts() {

    const total =
        state.filteredAuditRecords.length;


    const auditCount =
        getElement("auditCount");

    const auditTableCount =
        getElement("auditTableCount");


    const label =
        `${total.toLocaleString()} ${
            total === 1
                ? "event"
                : "events"
        }`;


    if (auditCount) {
        auditCount.textContent =
            label;
    }


    if (auditTableCount) {

        auditTableCount.textContent =
            `${total.toLocaleString()} ${
                total === 1
                    ? "record"
                    : "records"
            }`;

    }

}


/* =========================================================
   RENDER AUDIT RECORDS
   ========================================================= */

function renderAuditRecords() {

    const totalPages =
        Math.max(
            1,
            Math.ceil(
                state.filteredAuditRecords.length /
                ITEMS_PER_PAGE
            )
        );


    if (
        state.currentPage >
        totalPages
    ) {
        state.currentPage =
            totalPages;
    }


    const start =
        (state.currentPage - 1) *
        ITEMS_PER_PAGE;


    const records =
        state.filteredAuditRecords.slice(
            start,
            start + ITEMS_PER_PAGE
        );


    renderAuditTable(records);

    renderAuditMobile(records);

    renderPagination(totalPages);

}


/* =========================================================
   RENDER TABLE
   ========================================================= */

function renderAuditTable(records) {

    const tbody =
        getElement("auditTableBody");

    if (!tbody) {
        return;
    }


    if (!records.length) {

        tbody.innerHTML = `
            <tr>
                <td
                    colspan="7"
                    class="table-state"
                >
                    No audit activity found.
                </td>
            </tr>
        `;

        return;
    }


    tbody.innerHTML =
        records.map(record => {

            const statusClass =
                getStatusClass(
                    record.status
                );


            return `
                <tr>

                    <td>
                        <strong>
                            ${escapeHtml(record.userName)}
                        </strong>
                    </td>

                    <td>
                        ${escapeHtml(record.action)}
                    </td>

                    <td>
                        ${escapeHtml(record.event)}
                    </td>

                    <td>
                        ${escapeHtml(record.ipAddress)}
                    </td>

                    <td>
                        <span
                            class="status-pill ${statusClass}"
                        >
                            ${escapeHtml(
                                formatStatus(
                                    record.status
                                )
                            )}
                        </span>
                    </td>

                    <td>
                        ${escapeHtml(
                            formatDateTime(
                                record.createdAt
                            )
                        )}
                    </td>

                    <td>

                        <button
                            type="button"
                            class="view-button"
                            data-audit-id="${escapeHtml(
                                record.id
                            )}"
                            title="View audit details"
                            aria-label="View audit details"
                        >

                            <svg
                                viewBox="0 0 24 24"
                                aria-hidden="true"
                            >
                                <path
                                    d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12z"
                                ></path>

                                <circle
                                    cx="12"
                                    cy="12"
                                    r="2.5"
                                ></circle>

                            </svg>

                        </button>

                    </td>

                </tr>
            `;

        }).join("");


    attachAuditViewButtons();

}


/* =========================================================
   RENDER MOBILE
   ========================================================= */

function renderAuditMobile(records) {

    const container =
        getElement("auditMobileList");

    if (!container) {
        return;
    }


    if (!records.length) {

        container.innerHTML = `
            <div class="mobile-list-state">
                No audit activity found.
            </div>
        `;

        return;
    }


    container.innerHTML =
        records.map(record => {

            const statusClass =
                getStatusClass(
                    record.status
                );


            return `
                <article
                    class="mobile-audit-card"
                >

                    <div class="mobile-audit-top">

                        <div class="mobile-audit-user">

                            <strong>
                                ${escapeHtml(
                                    record.userName
                                )}
                            </strong>

                            <span>
                                ${escapeHtml(
                                    record.email ||
                                    "Administrator activity"
                                )}
                            </span>

                        </div>

                        <span
                            class="status-pill ${statusClass}"
                        >
                            ${escapeHtml(
                                formatStatus(
                                    record.status
                                )
                            )}
                        </span>

                    </div>


                    <div class="mobile-audit-event">

                        ${escapeHtml(
                            record.action
                        )}

                        <span>
                            ·
                        </span>

                        ${escapeHtml(
                            record.event
                        )}

                    </div>


                    <div class="mobile-audit-meta">

                        <div class="audit-meta-item">

                            <span>
                                IP Address
                            </span>

                            <strong>
                                ${escapeHtml(
                                    record.ipAddress
                                )}
                            </strong>

                        </div>


                        <div class="audit-meta-item">

                            <span>
                                Date &amp; Time
                            </span>

                            <strong>
                                ${escapeHtml(
                                    formatDateTime(
                                        record.createdAt
                                    )
                                )}
                            </strong>

                        </div>

                    </div>


                    <div class="mobile-audit-footer">

                        <span>
                            Audit ID:
                            ${escapeHtml(
                                record.id || "—"
                            )}
                        </span>

                        <button
                            type="button"
                            class="view-button"
                            data-audit-id="${escapeHtml(
                                record.id
                            )}"
                            title="View audit details"
                            aria-label="View audit details"
                        >

                            <svg
                                viewBox="0 0 24 24"
                                aria-hidden="true"
                            >
                                <path
                                    d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12z"
                                ></path>

                                <circle
                                    cx="12"
                                    cy="12"
                                    r="2.5"
                                ></circle>

                            </svg>

                        </button>

                    </div>

                </article>
            `;

        }).join("");


    attachAuditViewButtons();

}


/* =========================================================
   AUDIT VIEW BUTTONS
   ========================================================= */

function attachAuditViewButtons() {

    document
        .querySelectorAll(
            "[data-audit-id]"
        )
        .forEach(button => {

            button.addEventListener(
                "click",
                () => {

                    const id =
                        button.dataset.auditId;

                    openAuditModal(id);

                }
            );

        });

}


/* =========================================================
   AUDIT PAGINATION
   ========================================================= */

function renderPagination(totalPages) {

    const container =
        getElement("auditPagination");

    if (!container) {
        return;
    }


    if (totalPages <= 1) {

        container.innerHTML = "";

        return;
    }


    let html = "";


    html += `
        <button
            type="button"
            data-page="${state.currentPage - 1}"
            ${state.currentPage <= 1
                ? "disabled"
                : ""}
        >
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
            page > 3 &&
            page < totalPages - 2 &&
            Math.abs(
                page - state.currentPage
            ) > 1
        ) {

            if (
                page === 4 ||
                page === totalPages - 3
            ) {

                html += `
                    <button
                        type="button"
                        disabled
                    >
                        …
                    </button>
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
                data-page="${page}"
            >
                ${page}
            </button>
        `;

    }


    html += `
        <button
            type="button"
            data-page="${state.currentPage + 1}"
            ${state.currentPage >= totalPages
                ? "disabled"
                : ""}
        >
            Next
        </button>
    `;


    container.innerHTML =
        html;


    container
        .querySelectorAll(
            "button[data-page]"
        )
        .forEach(button => {

            button.addEventListener(
                "click",
                () => {

                    const page =
                        Number(
                            button.dataset.page
                        );

                    if (
                        page < 1 ||
                        page > totalPages
                    ) {
                        return;
                    }

                    state.currentPage =
                        page;

                    renderAuditRecords();

                    window.scrollTo({
                        top: 0,
                        behavior: "smooth"
                    });

                }
            );

        });

}


/* =========================================================
   AUDIT ERROR
   ========================================================= */

function renderAuditError(message) {

    const tbody =
        getElement("auditTableBody");

    const mobile =
        getElement("auditMobileList");


    if (tbody) {

        tbody.innerHTML = `
            <tr>
                <td
                    colspan="7"
                    class="table-state"
                >
                    ${escapeHtml(message)}
                </td>
            </tr>
        `;

    }


    if (mobile) {

        mobile.innerHTML = `
            <div class="mobile-list-state">
                ${escapeHtml(message)}
            </div>
        `;

    }

}


/* =========================================================
   AUDIT MODAL
   ========================================================= */

function openAuditModal(id) {

    const record =
        state.auditRecords.find(
            item =>
                String(item.id) === String(id)
        );


    if (!record) {

        showMessage(
            "Audit record could not be found.",
            "error"
        );

        return;
    }


    const modal =
        getElement("auditModal");

    const details =
        getElement("auditDetails");


    if (!modal || !details) {
        return;
    }


    details.innerHTML = `

        <div class="details-grid">

            <div class="detail-item">

                <span class="detail-label">
                    User
                </span>

                <span class="detail-value">
                    ${escapeHtml(
                        record.userName
                    )}
                </span>

            </div>


            <div class="detail-item">

                <span class="detail-label">
                    Email
                </span>

                <span class="detail-value">
                    ${escapeHtml(
                        record.email || "—"
                    )}
                </span>

            </div>


            <div class="detail-item">

                <span class="detail-label">
                    Action
                </span>

                <span class="detail-value">
                    ${escapeHtml(
                        record.action
                    )}
                </span>

            </div>


            <div class="detail-item">

                <span class="detail-label">
                    Event
                </span>

                <span class="detail-value">
                    ${escapeHtml(
                        record.event
                    )}
                </span>

            </div>


            <div class="detail-item">

                <span class="detail-label">
                    Status
                </span>

                <span class="detail-value">

                    <span
                        class="status-pill ${getStatusClass(
                            record.status
                        )}"
                    >
                        ${escapeHtml(
                            formatStatus(
                                record.status
                            )
                        )}
                    </span>

                </span>

            </div>


            <div class="detail-item">

                <span class="detail-label">
                    IP Address
                </span>

                <span class="detail-value">
                    ${escapeHtml(
                        record.ipAddress
                    )}
                </span>

            </div>


            <div class="detail-item">

                <span class="detail-label">
                    Date &amp; Time
                </span>

                <span class="detail-value">
                    ${escapeHtml(
                        formatDateTime(
                            record.createdAt
                        )
                    )}
                </span>

            </div>


            <div class="detail-item">

                <span class="detail-label">
                    Audit ID
                </span>

                <span class="detail-value">
                    ${escapeHtml(
                        record.id || "—"
                    )}
                </span>

            </div>

        </div>


        ${
            record.details
                ? `
                    <div class="message-detail">
                        ${escapeHtml(
                            typeof record.details === "object"
                                ? JSON.stringify(
                                    record.details,
                                    null,
                                    2
                                )
                                : record.details
                        )}
                    </div>
                `
                : ""
        }


        ${
            record.userAgent
                ? `
                    <div class="message-detail">
                        <strong>
                            User Agent
                        </strong>

                        <br>

                        ${escapeHtml(
                            record.userAgent
                        )}
                    </div>
                `
                : ""
        }

    `;


    modal.hidden = false;

    modal.setAttribute(
        "aria-hidden",
        "false"
    );

}


/* =========================================================
   CLOSE AUDIT MODAL
   ========================================================= */

function closeAuditModal() {

    const modal =
        getElement("auditModal");

    if (!modal) {
        return;
    }

    modal.hidden = true;

    modal.setAttribute(
        "aria-hidden",
        "true"
    );

}


/* =========================================================
   LOAD MAINTENANCE SETTINGS
   ========================================================= */

function loadMaintenanceSettings(data) {

    const maintenance =
        data.maintenance ||
        data.maintenance_settings ||
        data.maintenanceSettings ||
        {};


    const enabled =
        maintenance.enabled ??
        maintenance.maintenance_mode ??
        data.maintenance_mode ??
        false;


    const message =
        maintenance.message ||
        maintenance.maintenance_message ||
        data.maintenance_message ||
        "Crown Cash is currently undergoing scheduled maintenance.";


    const allowAdmin =
        maintenance.allow_admin_access ??
        maintenance.allowAdminAccess ??
        data.allow_admin_access ??
        true;


    state.maintenanceEnabled =
        Boolean(enabled);

    state.maintenanceMessage =
        String(message);

    state.allowAdminAccess =
        Boolean(allowAdmin);


    const toggle =
        getElement("maintenanceToggle");

    const messageInput =
        getElement("maintenanceMessage");

    const allowAdmin =
        getElement("allowAdminAccess");


    if (toggle) {
        toggle.checked =
            state.maintenanceEnabled;
    }


    if (messageInput) {
        messageInput.value =
            state.maintenanceMessage;
    }


    if (allowAdmin) {
        allowAdmin.checked =
            state.allowAdminAccess;
    }


    updateMaintenanceUI();

    updateMaintenanceCharacterCount();

}


/* =========================================================
   UPDATE MAINTENANCE UI
   ========================================================= */

function updateMaintenanceUI() {

    const statusText =
        getElement(
            "maintenanceStatusText"
        );


    if (!statusText) {
        return;
    }


    if (state.maintenanceEnabled) {

        statusText.textContent =
            "Maintenance mode is currently enabled.";

    } else {

        statusText.textContent =
            "Customer access is currently available.";

    }

}


/* =========================================================
   MAINTENANCE CHARACTER COUNT
   ========================================================= */

function updateMaintenanceCharacterCount() {

    const input =
        getElement(
            "maintenanceMessage"
        );

    const count =
        getElement(
            "maintenanceMessageCount"
        );


    if (!input || !count) {
        return;
    }


    count.textContent =
        input.value.length;

}


/* =========================================================
   OPEN MAINTENANCE CONFIRMATION
   ========================================================= */

function openMaintenanceConfirmation() {

    const toggle =
        getElement(
            "maintenanceToggle"
        );

    if (!toggle) {
        return;
    }


    state.pendingMaintenanceState =
        toggle.checked;


    const modal =
        getElement(
            "maintenanceConfirmModal"
        );

    const text =
        getElement(
            "maintenanceConfirmText"
        );


    if (!modal) {
        return;
    }


    if (text) {

        text.textContent =
            state.pendingMaintenanceState
                ? "Maintenance mode will temporarily restrict customer access to Crown Cash. Do you want to continue?"
                : "Maintenance mode will be disabled and normal customer access will resume. Do you want to continue?";

    }


    modal.hidden = false;

    modal.setAttribute(
        "aria-hidden",
        "false"
    );

}


/* =========================================================
   CLOSE MAINTENANCE CONFIRMATION
   ========================================================= */

function closeMaintenanceConfirmation(
    restoreToggle = true
) {

    const modal =
        getElement(
            "maintenanceConfirmModal"
        );

    const toggle =
        getElement(
            "maintenanceToggle"
        );


    if (restoreToggle && toggle) {

        toggle.checked =
            state.maintenanceEnabled;

    }


    if (modal) {

        modal.hidden = true;

        modal.setAttribute(
            "aria-hidden",
            "true"
        );

    }

}


/* =========================================================
   SAVE MAINTENANCE
   ========================================================= */

async function saveMaintenanceSettings() {

    const toggle =
        getElement(
            "maintenanceToggle"
        );

    const messageInput =
        getElement(
            "maintenanceMessage"
        );

    const allowAdmin =
        getElement(
            "allowAdminAccess"
        );

    const saveButton =
        getElement(
            "saveMaintenanceBtn"
        );


    if (
        !toggle ||
        !messageInput ||
        !allowAdmin
    ) {
        return;
    }


    const enabled =
        state.pendingMaintenanceState;


    const message =
        messageInput.value.trim();


    if (
        enabled &&
        message.length < 5
    ) {

        closeMaintenanceConfirmation();

        showMessage(
            "Please enter a maintenance message.",
            "warning"
        );

        return;
    }


    const originalButton =
        saveButton?.innerHTML;


    if (saveButton) {

        saveButton.disabled = true;

        saveButton.innerHTML = `
            <span>
                Saving...
            </span>
        `;

    }


    try {

        const data =
            await fetchJson(
                SECURITY_API,
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body: JSON.stringify({

                        action:
                            "maintenance",

                        enabled,

                        message,

                        allow_admin_access:
                            allowAdmin.checked

                    })
                }
            );


        if (
            !data ||
            data.success !== true
        ) {

            throw new Error(
                data?.message ||
                "Unable to update maintenance mode."
            );

        }


        state.maintenanceEnabled =
            enabled;

        state.maintenanceMessage =
            message;

        state.allowAdminAccess =
            allowAdmin.checked;


        updateMaintenanceUI();

        closeMaintenanceConfirmation(
            false
        );


        showMessage(
            data.message ||
            "Maintenance settings updated successfully.",
            "success"
        );


    } catch (error) {

        closeMaintenanceConfirmation();

        showMessage(
            error.message ||
            "Unable to update maintenance settings.",
            "error"
        );

    } finally {

        if (saveButton) {

            saveButton.disabled =
                false;

            saveButton.innerHTML =
                originalButton ||
                `
                    <svg
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                    >
                        <path d="M5 4h12l2 2v14H5z"></path>
                        <path d="M8 4v5h8V4"></path>
                        <path d="M8 15h8"></path>
                    </svg>

                    <span>
                        Save Maintenance Settings
                    </span>
                `;

        }

    }

}


/* =========================================================
   EVENT LISTENERS
   ========================================================= */

function setupEventListeners() {


    /* Refresh */

    const refreshButton =
        getElement(
            "refreshSecurityBtn"
        );

    if (refreshButton) {

        refreshButton.addEventListener(
            "click",
            async () => {

                refreshButton.disabled =
                    true;

                clearMessage();

                try {

                    await loadSecurityData();

                } finally {

                    refreshButton.disabled =
                        false;

                }

            }
        );

    }


    /* Search */

    const auditSearch =
        getElement(
            "auditSearch"
        );

    if (auditSearch) {

        auditSearch.addEventListener(
            "input",
            () => {

                state.currentPage = 1;

                applyAuditFilters();

            }
        );

    }


    /* Event type */

    const auditTypeFilter =
        getElement(
            "auditTypeFilter"
        );

    if (auditTypeFilter) {

        auditTypeFilter.addEventListener(
            "change",
            () => {

                state.currentPage = 1;

                applyAuditFilters();

            }
        );

    }


    /* Status */

    const auditStatusFilter =
        getElement(
            "auditStatusFilter"
        );

    if (auditStatusFilter) {

        auditStatusFilter.addEventListener(
            "change",
            () => {

                state.currentPage = 1;

                applyAuditFilters();

            }
        );

    }


    /* Maintenance toggle */

    const maintenanceToggle =
        getElement(
            "maintenanceToggle"
        );

    if (maintenanceToggle) {

        maintenanceToggle.addEventListener(
            "change",
            openMaintenanceConfirmation
        );

    }


    /* Maintenance message */

    const maintenanceMessage =
        getElement(
            "maintenanceMessage"
        );

    if (maintenanceMessage) {

        maintenanceMessage.addEventListener(
            "input",
            updateMaintenanceCharacterCount
        );

    }


    /* Save */

    const saveMaintenanceButton =
        getElement(
            "saveMaintenanceBtn"
        );

    if (saveMaintenanceButton) {

        saveMaintenanceButton.addEventListener(
            "click",
            openMaintenanceConfirmation
        );

    }


    /* Confirm maintenance */

    const confirmMaintenanceButton =
        getElement(
            "confirmMaintenanceBtn"
        );

    if (confirmMaintenanceButton) {

        confirmMaintenanceButton.addEventListener(
            "click",
            saveMaintenanceSettings
        );

    }


    /* Cancel maintenance */

    const cancelMaintenanceButton =
        getElement(
            "cancelMaintenanceBtn"
        );

    if (cancelMaintenanceButton) {

        cancelMaintenanceButton.addEventListener(
            "click",
            () => {

                closeMaintenanceConfirmation(
                    true
                );

            }
        );

    }


    /* Close maintenance overlay */

    const maintenanceOverlay =
        getElement(
            "closeMaintenanceConfirmOverlay"
        );

    if (maintenanceOverlay) {

        maintenanceOverlay.addEventListener(
            "click",
            () => {

                closeMaintenanceConfirmation(
                    true
                );

            }
        );

    }


    /* Close audit modal */

    const closeAuditButton =
        getElement(
            "closeAuditModal"
        );

    if (closeAuditButton) {

        closeAuditButton.addEventListener(
            "click",
            closeAuditModal
        );

    }


    const closeAuditDetailsButton =
        getElement(
            "closeAuditDetailsBtn"
        );

    if (closeAuditDetailsButton) {

        closeAuditDetailsButton.addEventListener(
            "click",
            closeAuditModal
        );

    }


    const auditOverlay =
        getElement(
            "closeAuditModalOverlay"
        );

    if (auditOverlay) {

        auditOverlay.addEventListener(
            "click",
            closeAuditModal
        );

    }


    /* Escape key */

    document.addEventListener(
        "keydown",
        event => {

            if (
                event.key !== "Escape"
            ) {
                return;
            }


            const auditModal =
                getElement(
                    "auditModal"
                );

            const maintenanceModal =
                getElement(
                    "maintenanceConfirmModal"
                );


            if (
                auditModal &&
                !auditModal.hidden
            ) {

                closeAuditModal();

            }


            if (
                maintenanceModal &&
                !maintenanceModal.hidden
            ) {

                closeMaintenanceConfirmation(
                    true
                );

            }

        }
    );

}


/* =========================================================
   INITIALIZE
   ========================================================= */

async function initializeAdminSecurity() {

    try {

        const authorized =
            await verifyAdministrator();


        if (!authorized) {
            return;
        }


        hidePageLoader();

        showElement(
            getElement(
                "adminSecurityPage"
            )
        );


        setupEventListeners();

        await loadSecurityData();


    } catch (error) {

        hidePageLoader();

        showElement(
            getElement(
                "adminSecurityPage"
            )
        );

        showMessage(
            error.message ||
            "Unable to initialize security administration.",
            "error"
        );

    }

}


/* =========================================================
   GLOBAL HELPERS
   ========================================================= */

window.CrownCashAdminSecurity = {

    refresh: loadSecurityData,

    applyFilters: applyAuditFilters,

    openAudit: openAuditModal,

    closeAudit: closeAuditModal,

    saveMaintenance:
        saveMaintenanceSettings

};


/* =========================================================
   START
   ========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    initializeAdminSecurity
);