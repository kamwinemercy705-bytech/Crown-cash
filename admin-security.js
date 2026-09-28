/* =========================================================
   CROWN CASH ADMIN
   SECURITY & AUDIT MANAGEMENT
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
   PAGE STATE
   ========================================================= */

const state = {
    authenticated: false,

    auditRecords: [],
    filteredAuditRecords: [],

    currentPage: 1,

    maintenanceEnabled: false,
    maintenanceMessage: "",
    allowAdminAccess: true,

    pendingMaintenanceState: null,

    securityLoaded: false
};


/* =========================================================
   DOM HELPER
   ========================================================= */

function $(id) {
    return document.getElementById(id);
}


/* =========================================================
   PAGE VISIBILITY
   ========================================================= */

function showSecurityPage() {

    const page = $("adminSecurityPage");

    if (!page) {
        console.error(
            "Crown Cash: #adminSecurityPage was not found."
        );
        return;
    }

    page.hidden = false;

    page.style.display = "block";
    page.style.visibility = "visible";
    page.style.opacity = "1";
    page.style.pointerEvents = "auto";
    page.style.position = "relative";
    page.style.zIndex = "1";

    page.classList.add("page-ready");
}


function hideLoader() {

    const loader = $("pageLoader");

    if (!loader) {
        return;
    }

    loader.classList.add("hidden");

    loader.style.opacity = "0";
    loader.style.visibility = "hidden";
    loader.style.pointerEvents = "none";

    setTimeout(() => {

        loader.style.display = "none";

    }, 300);
}


function showLoader(message = "Verifying administrator access...") {

    const loader = $("pageLoader");
    const loaderMessage = $("loaderMessage");

    if (loaderMessage) {
        loaderMessage.textContent = message;
    }

    if (loader) {

        loader.style.display = "flex";
        loader.style.visibility = "visible";
        loader.style.opacity = "1";
        loader.style.pointerEvents = "auto";

        loader.classList.remove("hidden");
    }
}


/* =========================================================
   MESSAGE SYSTEM
   ========================================================= */

function showMessage(message, type = "error") {

    const box = $("securityMessage");

    if (!box) {
        console.warn(message);
        return;
    }

    box.textContent = message;

    box.className = "security-message";

    if (type === "success") {
        box.classList.add("success");
    } else if (type === "warning") {
        box.classList.add("warning");
    } else {
        box.classList.add("error");
    }

    box.style.display = "block";
}


function hideMessage() {

    const box = $("securityMessage");

    if (!box) {
        return;
    }

    box.style.display = "none";
    box.textContent = "";
}


/* =========================================================
   FETCH WITH TIMEOUT
   ========================================================= */

async function fetchJson(
    url,
    options = {},
    timeout = REQUEST_TIMEOUT
) {

    const controller = new AbortController();

    const timeoutId = setTimeout(() => {
        controller.abort();
    }, timeout);

    try {

        const response = await fetch(url, {
            ...options,

            credentials: "include",

            cache: "no-store",

            signal: controller.signal,

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

        const text = await response.text();

        let data = null;

        try {
            data = text ? JSON.parse(text) : null;
        } catch (error) {

            throw new Error(
                `Server returned invalid JSON. HTTP ${response.status}`
            );
        }

        if (!response.ok) {

            throw new Error(
                data?.message ||
                `Request failed with HTTP ${response.status}`
            );
        }

        return data;

    } catch (error) {

        if (error.name === "AbortError") {

            throw new Error(
                "The server took too long to respond."
            );
        }

        throw error;

    } finally {

        clearTimeout(timeoutId);
    }
}


/* =========================================================
   ADMIN VERIFICATION
   ========================================================= */

async function verifyAdministrator() {

    const data = await fetchJson(
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
            "Administrator access was not confirmed."
        );
    }

    state.authenticated = true;

    return data;
}


/* =========================================================
   HTML ESCAPING
   ========================================================= */

function escapeHtml(value) {

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
   DATE FORMATTER
   ========================================================= */

function formatDate(value) {

    if (!value) {
        return "—";
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return String(value);
    }

    return date.toLocaleString(
        "en-UG",
        {
            year: "numeric",
            month: "short",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit"
        }
    );
}


/* =========================================================
   NUMBER FORMATTER
   ========================================================= */

function formatNumber(value) {

    const number = Number(value || 0);

    if (!Number.isFinite(number)) {
        return "0";
    }

    return number.toLocaleString("en-UG");
}


/* =========================================================
   GENERIC VALUE PICKER
   ========================================================= */

function firstValue(object, fields, fallback = "") {

    for (const field of fields) {

        if (
            object &&
            object[field] !== undefined &&
            object[field] !== null &&
            object[field] !== ""
        ) {
            return object[field];
        }
    }

    return fallback;
}


/* =========================================================
   NORMALIZE AUDIT RECORD
   ========================================================= */

function normalizeAuditRecord(record = {}) {

    return {

        id: firstValue(
            record,
            [
                "id",
                "_id",
                "audit_id",
                "event_id"
            ],
            ""
        ),

        type: firstValue(
            record,
            [
                "event_type",
                "type",
                "action",
                "event"
            ],
            "system"
        ),

        action: firstValue(
            record,
            [
                "action",
                "event_action",
                "type",
                "event_type"
            ],
            "System Event"
        ),

        description: firstValue(
            record,
            [
                "description",
                "message",
                "details",
                "reason"
            ],
            "Security event recorded."
        ),

        status: firstValue(
            record,
            [
                "status",
                "result",
                "outcome"
            ],
            "info"
        ),

        user: firstValue(
            record,
            [
                "user_name",
                "full_name",
                "username",
                "email"
            ],
            "System"
        ),

        email: firstValue(
            record,
            [
                "email",
                "user_email"
            ],
            ""
        ),

        ip: firstValue(
            record,
            [
                "ip",
                "ip_address",
                "client_ip"
            ],
            "—"
        ),

        createdAt: firstValue(
            record,
            [
                "created_at",
                "timestamp",
                "date",
                "createdAt"
            ],
            ""
        ),

        raw: record
    };
}


/* =========================================================
   LOAD SECURITY DATA
   ========================================================= */

async function loadSecurityData() {

    showSecurityPage();

    showLoader(
        "Loading security information..."
    );

    try {

        const data = await fetchJson(
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

        state.securityLoaded = true;

        showSecurityPage();

        hideLoader();

        hideMessage();

        updateSecurityOverview(data);

        updateSecurityControls(data);

        updateMaintenanceSettings(data);

        loadAuditRecords(data);

    } catch (error) {

        console.error(
            "Crown Cash Security Error:",
            error
        );

        /*
         * IMPORTANT:
         * The page is deliberately revealed even
         * when the API request fails.
         */
        showSecurityPage();

        hideLoader();

        showMessage(
            error.message ||
            "Unable to load security information.",
            "error"
        );

        renderAuditError(
            error.message
        );
    }
}


/* =========================================================
   SECURITY OVERVIEW
   ========================================================= */

function updateSecurityOverview(data) {

    const stats =
        data.stats ||
        data.security ||
        data.overview ||
        {};

    const securityStatus =
        firstValue(
            stats,
            [
                "security_status",
                "status"
            ],
            "Secure"
        );

    const adminSessions = Number(
        firstValue(
            stats,
            [
                "admin_sessions",
                "active_admin_sessions",
                "sessions"
            ],
            0
        )
    );

    const failedAttempts = Number(
        firstValue(
            stats,
            [
                "failed_attempts",
                "failed_logins",
                "failed"
            ],
            0
        )
    );

    const securityEvents = Number(
        firstValue(
            stats,
            [
                "security_events",
                "events",
                "audit_events",
                "total_events"
            ],
            0
        )
    );


    const statusElement =
        $("securityStatus");

    const statusTextElement =
        $("securityStatusText");

    const sessionsElement =
        $("adminSessions");

    const failedElement =
        $("failedAttempts");

    const eventsElement =
        $("securityEvents");


    if (statusElement) {

        statusElement.textContent =
            securityStatus;

        statusElement.classList.remove(
            "secure",
            "warning",
            "danger"
        );

        const normalized =
            String(
                securityStatus
            ).toLowerCase();

        if (
            normalized.includes("secure") ||
            normalized.includes("active") ||
            normalized.includes("good")
        ) {

            statusElement.classList.add(
                "secure"
            );

        } else if (
            normalized.includes("review") ||
            normalized.includes("warning")
        ) {

            statusElement.classList.add(
                "warning"
            );

        } else {

            statusElement.classList.add(
                "danger"
            );
        }
    }


    if (statusTextElement) {

        statusTextElement.textContent =
            securityStatus === "Secure"
                ? "Platform protection active"
                : "Review security activity";
    }


    if (sessionsElement) {
        sessionsElement.textContent =
            formatNumber(adminSessions);
    }


    if (failedElement) {
        failedElement.textContent =
            formatNumber(failedAttempts);
    }


    if (eventsElement) {
        eventsElement.textContent =
            formatNumber(securityEvents);
    }
}


/* =========================================================
   SECURITY CONTROLS
   ========================================================= */

function updateSecurityControls(data) {

    const controls =
        data.controls ||
        data.security_controls ||
        {};

    const loginProtection =
        firstValue(
            controls,
            [
                "login_protection",
                "login_protection_status"
            ],
            "Active"
        );

    const sessionSecurity =
        firstValue(
            controls,
            [
                "session_security",
                "session_security_status"
            ],
            "2 Hours"
        );


    const loginElement =
        $("loginProtectionStatus");

    const sessionElement =
        $("sessionSecurityStatus");


    if (loginElement) {

        loginElement.textContent =
            loginProtection;

        loginElement.classList.add(
            "active"
        );
    }


    if (sessionElement) {

        sessionElement.textContent =
            sessionSecurity;

        sessionElement.classList.add(
            "active"
        );
    }
}


/* =========================================================
   MAINTENANCE SETTINGS
   ========================================================= */

function updateMaintenanceSettings(data) {

    const maintenance =
        data.maintenance ||
        data.maintenance_settings ||
        {};

    state.maintenanceEnabled =
        Boolean(
            firstValue(
                maintenance,
                [
                    "enabled",
                    "maintenance_enabled"
                ],
                false
            )
        );

    state.maintenanceMessage =
        firstValue(
            maintenance,
            [
                "message",
                "maintenance_message"
            ],
            "Crown Cash is currently undergoing scheduled maintenance."
        );

    state.allowAdminAccess =
        Boolean(
            firstValue(
                maintenance,
                [
                    "allow_admin_access",
                    "admin_access"
                ],
                true
            )
        );


    const toggle =
        $("maintenanceToggle");

    const message =
        $("maintenanceMessage");

    const counter =
        $("maintenanceMessageCount");

    const allowAdmin =
        $("allowAdminAccess");

    const statusText =
        $("maintenanceStatusText");


    if (toggle) {

        toggle.checked =
            state.maintenanceEnabled;
    }


    if (message) {

        message.value =
            state.maintenanceMessage;

        updateMaintenanceCounter();
    }


    if (allowAdmin) {

        allowAdmin.checked =
            state.allowAdminAccess;
    }


    if (statusText) {

        statusText.textContent =
            state.maintenanceEnabled
                ? "Maintenance mode enabled"
                : "Customer access available";

        statusText.classList.toggle(
            "active",
            state.maintenanceEnabled
        );
    }


    if (counter) {
        updateMaintenanceCounter();
    }
}


/* =========================================================
   MAINTENANCE COUNTER
   ========================================================= */

function updateMaintenanceCounter() {

    const input =
        $("maintenanceMessage");

    const counter =
        $("maintenanceMessageCount");

    if (!input || !counter) {
        return;
    }

    counter.textContent =
        `${input.value.length}/300`;
}


/* =========================================================
   LOAD AUDIT RECORDS
   ========================================================= */

function loadAuditRecords(data) {

    let records =
        data.audit_logs ||
        data.auditRecords ||
        data.audit ||
        data.records ||
        data.events ||
        [];


    if (!Array.isArray(records)) {
        records = [];
    }


    state.auditRecords =
        records.map(
            normalizeAuditRecord
        );


    const auditCount =
        $("auditCount");

    if (auditCount) {

        auditCount.textContent =
            `${state.auditRecords.length} ${
                state.auditRecords.length === 1
                    ? "event"
                    : "events"
            }`;
    }


    applyAuditFilters();
}


/* =========================================================
   AUDIT FILTERS
   ========================================================= */

function applyAuditFilters() {

    const search =
        (
            $("auditSearch")?.value ||
            ""
        )
        .trim()
        .toLowerCase();


    const type =
        (
            $("auditTypeFilter")?.value ||
            "all"
        )
        .toLowerCase();


    const status =
        (
            $("auditStatusFilter")?.value ||
            "all"
        )
        .toLowerCase();


    state.filteredAuditRecords =
        state.auditRecords.filter(
            record => {

                const searchText = [
                    record.type,
                    record.action,
                    record.description,
                    record.user,
                    record.email,
                    record.ip
                ]
                    .join(" ")
                    .toLowerCase();


                const matchesSearch =
                    !search ||
                    searchText.includes(search);


                const matchesType =
                    type === "all" ||
                    record.type
                        .toLowerCase()
                        .includes(type) ||
                    record.action
                        .toLowerCase()
                        .includes(type);


                const matchesStatus =
                    status === "all" ||
                    record.status
                        .toLowerCase()
                        .includes(status);


                return (
                    matchesSearch &&
                    matchesType &&
                    matchesStatus
                );
            }
        );


    state.currentPage = 1;

    renderAuditRecords();
}


/* =========================================================
   AUDIT STATUS CLASS
   ========================================================= */

function getStatusClass(status) {

    const value =
        String(status || "")
            .toLowerCase();


    if (
        value.includes("success") ||
        value.includes("approved") ||
        value.includes("active") ||
        value.includes("secure")
    ) {
        return "success";
    }


    if (
        value.includes("fail") ||
        value.includes("danger") ||
        value.includes("blocked") ||
        value.includes("rejected")
    ) {
        return "danger";
    }


    if (
        value.includes("warning") ||
        value.includes("review") ||
        value.includes("pending")
    ) {
        return "warning";
    }


    return "info";
}


/* =========================================================
   RENDER AUDIT RECORDS
   ========================================================= */

function renderAuditRecords() {

    const tableBody =
        $("auditTableBody");

    const mobileList =
        $("auditMobileList");

    const tableCount =
        $("auditTableCount");


    const total =
        state.filteredAuditRecords.length;


    if (tableCount) {

        tableCount.textContent =
            `${total} ${
                total === 1
                    ? "record"
                    : "records"
            }`;
    }


    if (total === 0) {

        if (tableBody) {

            tableBody.innerHTML = `
                <tr>
                    <td
                        colspan="7"
                        class="empty-state"
                    >
                        <div class="empty-icon">
                            <svg
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                stroke-width="1.8"
                            >
                                <circle
                                    cx="12"
                                    cy="12"
                                    r="9"
                                />
                                <path
                                    d="M9 12h6"
                                />
                            </svg>
                        </div>

                        <strong>
                            No audit records
                        </strong>

                        <span>
                            Security activity will appear here.
                        </span>
                    </td>
                </tr>
            `;
        }


        if (mobileList) {

            mobileList.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">
                        <svg
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="1.8"
                        >
                            <circle
                                cx="12"
                                cy="12"
                                r="9"
                            />
                            <path
                                d="M9 12h6"
                            />
                        </svg>
                    </div>

                    <strong>
                        No audit records
                    </strong>

                    <span>
                        Security activity will appear here.
                    </span>
                </div>
            `;
        }


        renderPagination();

        return;
    }


    const start =
        (
            state.currentPage - 1
        ) *
        ITEMS_PER_PAGE;


    const end =
        start +
        ITEMS_PER_PAGE;


    const pageRecords =
        state.filteredAuditRecords.slice(
            start,
            end
        );


    if (tableBody) {

        tableBody.innerHTML =
            pageRecords
                .map(
                    record => `
                        <tr>

                            <td>
                                <div class="audit-event-cell">

                                    <span class="audit-event-icon">

                                        <svg
                                            viewBox="0 0 24 24"
                                            fill="none"
                                            stroke="currentColor"
                                            stroke-width="1.8"
                                        >
                                            <path
                                                d="M12 3l8 4v5c0 5-3.5 8-8 9-4.5-1-8-4-8-9V7l8-4z"
                                            />

                                            <path
                                                d="M9 12l2 2 4-4"
                                            />
                                        </svg>

                                    </span>

                                    <div>
                                        <strong>
                                            ${escapeHtml(record.action)}
                                        </strong>

                                        <small>
                                            ${escapeHtml(record.type)}
                                        </small>
                                    </div>

                                </div>
                            </td>


                            <td>
                                ${escapeHtml(record.description)}
                            </td>


                            <td>
                                ${escapeHtml(record.user)}
                            </td>


                            <td>
                                ${escapeHtml(record.ip)}
                            </td>


                            <td>
                                <span
                                    class="status-pill ${getStatusClass(record.status)}"
                                >
                                    ${escapeHtml(record.status)}
                                </span>
                            </td>


                            <td>
                                ${escapeHtml(
                                    formatDate(
                                        record.createdAt
                                    )
                                )}
                            </td>


                            <td>

                                <button
                                    type="button"
                                    class="view-button"
                                    data-audit-id="${escapeHtml(record.id)}"
                                >

                                    <svg
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        stroke-width="1.8"
                                    >
                                        <path
                                            d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6z"
                                        />

                                        <circle
                                            cx="12"
                                            cy="12"
                                            r="2.5"
                                        />
                                    </svg>

                                    View

                                </button>

                            </td>

                        </tr>
                    `
                )
                .join("");


        tableBody
            .querySelectorAll(
                "[data-audit-id]"
            )
            .forEach(button => {

                button.addEventListener(
                    "click",
                    () => {

                        openAuditModal(
                            button.dataset.auditId
                        );
                    }
                );
            });
    }


    if (mobileList) {

        mobileList.innerHTML =
            pageRecords
                .map(
                    record => `
                        <div class="mobile-audit-card">

                            <div class="mobile-audit-top">

                                <div class="audit-event-cell">

                                    <span class="audit-event-icon">

                                        <svg
                                            viewBox="0 0 24 24"
                                            fill="none"
                                            stroke="currentColor"
                                            stroke-width="1.8"
                                        >
                                            <path
                                                d="M12 3l8 4v5c0 5-3.5 8-8 9-4.5-1-8-4-8-9V7l8-4z"
                                            />

                                            <path
                                                d="M9 12l2 2 4-4"
                                            />
                                        </svg>

                                    </span>

                                    <div>

                                        <strong>
                                            ${escapeHtml(record.action)}
                                        </strong>

                                        <small>
                                            ${escapeHtml(record.type)}
                                        </small>

                                    </div>

                                </div>


                                <span
                                    class="status-pill ${getStatusClass(record.status)}"
                                >
                                    ${escapeHtml(record.status)}
                                </span>

                            </div>


                            <p class="mobile-audit-description">
                                ${escapeHtml(record.description)}
                            </p>


                            <div class="mobile-audit-meta">

                                <span>
                                    ${escapeHtml(record.user)}
                                </span>

                                <span>
                                    ${escapeHtml(record.ip)}
                                </span>

                                <span>
                                    ${escapeHtml(
                                        formatDate(
                                            record.createdAt
                                        )
                                    )}
                                </span>

                            </div>


                            <button
                                type="button"
                                class="view-button"
                                data-audit-id="${escapeHtml(record.id)}"
                            >

                                <svg
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    stroke-width="1.8"
                                >
                                    <path
                                        d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6z"
                                    />

                                    <circle
                                        cx="12"
                                        cy="12"
                                        r="2.5"
                                    />
                                </svg>

                                View Event

                            </button>

                        </div>
                    `
                )
                .join("");


        mobileList
            .querySelectorAll(
                "[data-audit-id]"
            )
            .forEach(button => {

                button.addEventListener(
                    "click",
                    () => {

                        openAuditModal(
                            button.dataset.auditId
                        );
                    }
                );
            });
    }


    renderPagination();
}


/* =========================================================
   AUDIT ERROR
   ========================================================= */

function renderAuditError(message) {

    const tableBody =
        $("auditTableBody");

    const mobileList =
        $("auditMobileList");


    const safeMessage =
        escapeHtml(
            message ||
            "Unable to load audit records."
        );


    if (tableBody) {

        tableBody.innerHTML = `
            <tr>
                <td
                    colspan="7"
                    class="empty-state error-state"
                >

                    <div class="empty-icon">

                        <svg
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="1.8"
                        >
                            <circle
                                cx="12"
                                cy="12"
                                r="9"
                            />

                            <path
                                d="M12 8v5"
                            />

                            <path
                                d="M12 16h.01"
                            />
                        </svg>

                    </div>

                    <strong>
                        Security information could not be loaded
                    </strong>

                    <span>
                        ${safeMessage}
                    </span>

                </td>
            </tr>
        `;
    }


    if (mobileList) {

        mobileList.innerHTML = `
            <div class="empty-state error-state">

                <div class="empty-icon">

                    <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="1.8"
                    >
                        <circle
                            cx="12"
                            cy="12"
                            r="9"
                        />

                        <path
                            d="M12 8v5"
                        />

                        <path
                            d="M12 16h.01"
                        />
                    </svg>

                </div>

                <strong>
                    Security information could not be loaded
                </strong>

                <span>
                    ${safeMessage}
                </span>

            </div>
        `;
    }
}


/* =========================================================
   PAGINATION
   ========================================================= */

function renderPagination() {

    const container =
        $("auditPagination");

    if (!container) {
        return;
    }


    const totalPages =
        Math.ceil(
            state.filteredAuditRecords.length /
            ITEMS_PER_PAGE
        );


    if (totalPages <= 1) {

        container.innerHTML = "";

        return;
    }


    let html = "";


    html += `
        <button
            type="button"
            class="pagination-button"
            data-page-action="prev"
            ${state.currentPage <= 1 ? "disabled" : ""}
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
            page === 1 ||
            page === totalPages ||
            Math.abs(
                page - state.currentPage
            ) <= 1
        ) {

            html += `
                <button
                    type="button"
                    class="pagination-button ${
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
    }


    html += `
        <button
            type="button"
            class="pagination-button"
            data-page-action="next"
            ${
                state.currentPage >= totalPages
                    ? "disabled"
                    : ""
            }
        >
            Next
        </button>
    `;


    container.innerHTML = html;


    container
        .querySelectorAll(
            "[data-page]"
        )
        .forEach(button => {

            button.addEventListener(
                "click",
                () => {

                    state.currentPage =
                        Number(
                            button.dataset.page
                        );

                    renderAuditRecords();
                }
            );
        });


    const previous =
        container.querySelector(
            '[data-page-action="prev"]'
        );

    const next =
        container.querySelector(
            '[data-page-action="next"]'
        );


    if (previous) {

        previous.addEventListener(
            "click",
            () => {

                if (
                    state.currentPage > 1
                ) {

                    state.currentPage--;

                    renderAuditRecords();
                }
            }
        );
    }


    if (next) {

        next.addEventListener(
            "click",
            () => {

                if (
                    state.currentPage <
                    totalPages
                ) {

                    state.currentPage++;

                    renderAuditRecords();
                }
            }
        );
    }
}


/* =========================================================
   AUDIT MODAL
   ========================================================= */

function openAuditModal(id) {

    const record =
        state.auditRecords.find(
            item =>
                String(item.id) ===
                String(id)
        );


    if (!record) {
        return;
    }


    const modal =
        $("auditModal");

    const details =
        $("auditDetails");


    if (!modal || !details) {
        return;
    }


    details.innerHTML = `

        <div class="detail-grid">

            <div class="detail-item">
                <span>Event</span>
                <strong>
                    ${escapeHtml(record.action)}
                </strong>
            </div>


            <div class="detail-item">
                <span>Type</span>
                <strong>
                    ${escapeHtml(record.type)}
                </strong>
            </div>


            <div class="detail-item">
                <span>Status</span>
                <strong>
                    ${escapeHtml(record.status)}
                </strong>
            </div>


            <div class="detail-item">
                <span>User</span>
                <strong>
                    ${escapeHtml(record.user)}
                </strong>
            </div>


            <div class="detail-item">
                <span>Email</span>
                <strong>
                    ${escapeHtml(record.email || "—")}
                </strong>
            </div>


            <div class="detail-item">
                <span>IP Address</span>
                <strong>
                    ${escapeHtml(record.ip)}
                </strong>
            </div>


            <div class="detail-item">
                <span>Date</span>
                <strong>
                    ${escapeHtml(
                        formatDate(
                            record.createdAt
                        )
                    )}
                </strong>
            </div>


            <div class="detail-item detail-full">
                <span>Description</span>
                <strong>
                    ${escapeHtml(record.description)}
                </strong>
            </div>


            <div class="detail-item detail-full">
                <span>Event ID</span>
                <strong>
                    ${escapeHtml(
                        record.id || "—"
                    )}
                </strong>
            </div>

        </div>
    `;


    modal.classList.add("show");

    modal.style.display = "flex";
    modal.style.visibility = "visible";
    modal.style.opacity = "1";
}


function closeAuditModal() {

    const modal =
        $("auditModal");

    if (!modal) {
        return;
    }

    modal.classList.remove("show");

    modal.style.opacity = "0";
    modal.style.visibility = "hidden";

    setTimeout(() => {

        modal.style.display = "none";

    }, 200);
}


/* =========================================================
   MAINTENANCE CONFIRMATION
   ========================================================= */

function openMaintenanceConfirmation(
    enabled
) {

    state.pendingMaintenanceState =
        enabled;


    const modal =
        $("maintenanceConfirmModal");

    const title =
        $("maintenanceConfirmTitle");

    const text =
        $("maintenanceConfirmText");


    if (!modal) {
        return;
    }


    if (title) {

        title.textContent =
            enabled
                ? "Enable Maintenance Mode"
                : "Disable Maintenance Mode";
    }


    if (text) {

        text.textContent =
            enabled

                ? "Customers will see the maintenance message and normal customer access may be restricted."

                : "Customer access will be restored and the maintenance message will no longer be active.";
    }


    modal.classList.add("show");

    modal.style.display = "flex";
    modal.style.visibility = "visible";
    modal.style.opacity = "1";
}


function closeMaintenanceConfirmation(
    restoreToggle = true
) {

    const modal =
        $("maintenanceConfirmModal");


    if (restoreToggle) {

        const toggle =
            $("maintenanceToggle");

        if (toggle) {

            toggle.checked =
                state.maintenanceEnabled;
        }
    }


    state.pendingMaintenanceState =
        null;


    if (!modal) {
        return;
    }


    modal.classList.remove("show");

    modal.style.opacity = "0";
    modal.style.visibility = "hidden";


    setTimeout(() => {

        modal.style.display = "none";

    }, 200);
}


/* =========================================================
   SAVE MAINTENANCE SETTINGS
   ========================================================= */

async function saveMaintenanceSettings() {

    if (!state.authenticated) {

        showMessage(
            "Administrator authentication is required.",
            "error"
        );

        return;
    }


    const toggle =
        $("maintenanceToggle");

    const message =
        $("maintenanceMessage");

    const allowAdmin =
        $("allowAdminAccess");


    const enabled =
        Boolean(
            toggle?.checked
        );


    const maintenanceMessage =
        (
            message?.value ||
            ""
        ).trim();


    const allowAdminAccess =
        Boolean(
            allowAdmin?.checked
        );


    if (
        maintenanceMessage.length >
        300
    ) {

        showMessage(
            "Maintenance message must not exceed 300 characters.",
            "error"
        );

        return;
    }


    const button =
        $("saveMaintenanceBtn");


    if (button) {

        button.disabled = true;

        button.dataset.originalText =
            button.textContent;

        button.textContent =
            "Saving...";
    }


    try {

        const data =
            await fetchJson(
                SECURITY_API,
                {
                    method: "POST",

                    body: JSON.stringify({
                        action: "maintenance",

                        enabled,

                        message:
                            maintenanceMessage,

                        allow_admin_access:
                            allowAdminAccess
                    })
                }
            );


        if (
            !data ||
            data.success !== true
        ) {

            throw new Error(
                data?.message ||
                "Unable to save maintenance settings."
            );
        }


        state.maintenanceEnabled =
            enabled;

        state.maintenanceMessage =
            maintenanceMessage;

        state.allowAdminAccess =
            allowAdminAccess;


        const statusText =
            $("maintenanceStatusText");


        if (statusText) {

            statusText.textContent =
                enabled
                    ? "Maintenance mode enabled"
                    : "Customer access available";
        }


        showMessage(
            data.message ||
            "Maintenance settings saved successfully.",
            "success"
        );


        closeMaintenanceConfirmation(
            false
        );


        updateMaintenanceCounter();

    } catch (error) {

        console.error(
            "Maintenance update error:",
            error
        );


        showMessage(
            error.message ||
            "Unable to save maintenance settings.",
            "error"
        );


        closeMaintenanceConfirmation(
            true
        );

    } finally {

        if (button) {

            button.disabled = false;

            button.textContent =
                button.dataset.originalText ||
                "Save Maintenance Settings";
        }
    }
}


/* =========================================================
   REFRESH
   ========================================================= */

async function refreshSecurityPage() {

    hideMessage();

    await loadSecurityData();
}


/* =========================================================
   EVENT LISTENERS
   ========================================================= */

function setupEventListeners() {

    const refreshButton =
        $("refreshSecurityBtn");


    if (refreshButton) {

        refreshButton.addEventListener(
            "click",
            refreshSecurityPage
        );
    }


    const search =
        $("auditSearch");


    if (search) {

        search.addEventListener(
            "input",
            applyAuditFilters
        );
    }


    const typeFilter =
        $("auditTypeFilter");


    if (typeFilter) {

        typeFilter.addEventListener(
            "change",
            applyAuditFilters
        );
    }


    const statusFilter =
        $("auditStatusFilter");


    if (statusFilter) {

        statusFilter.addEventListener(
            "change",
            applyAuditFilters
        );
    }


    const message =
        $("maintenanceMessage");


    if (message) {

        message.addEventListener(
            "input",
            updateMaintenanceCounter
        );
    }


    const maintenanceToggle =
        $("maintenanceToggle");


    if (maintenanceToggle) {

        maintenanceToggle.addEventListener(
            "change",
            function () {

                openMaintenanceConfirmation(
                    this.checked
                );
            }
        );
    }


    const saveMaintenance =
        $("saveMaintenanceBtn");


    if (saveMaintenance) {

        saveMaintenance.addEventListener(
            "click",
            function () {

                const toggle =
                    $("maintenanceToggle");

                openMaintenanceConfirmation(
                    Boolean(
                        toggle?.checked
                    )
                );
            }
        );
    }


    const closeAuditOverlay =
        $("closeAuditModalOverlay");


    const closeAuditButton =
        $("closeAuditModal");


    const closeAuditDetailsButton =
        $("closeAuditDetailsBtn");


    if (closeAuditOverlay) {

        closeAuditOverlay.addEventListener(
            "click",
            closeAuditModal
        );
    }


    if (closeAuditButton) {

        closeAuditButton.addEventListener(
            "click",
            closeAuditModal
        );
    }


    if (closeAuditDetailsButton) {

        closeAuditDetailsButton.addEventListener(
            "click",
            closeAuditModal
        );
    }


    const closeMaintenanceOverlay =
        $("closeMaintenanceConfirmOverlay");


    const cancelMaintenance =
        $("cancelMaintenanceBtn");


    const confirmMaintenance =
        $("confirmMaintenanceBtn");


    if (closeMaintenanceOverlay) {

        closeMaintenanceOverlay.addEventListener(
            "click",
            () =>
                closeMaintenanceConfirmation(
                    true
                )
        );
    }


    if (cancelMaintenance) {

        cancelMaintenance.addEventListener(
            "click",
            () =>
                closeMaintenanceConfirmation(
                    true
                )
        );
    }


    if (confirmMaintenance) {

        confirmMaintenance.addEventListener(
            "click",
            saveMaintenanceSettings
        );
    }


    document.addEventListener(
        "keydown",
        function (event) {

            if (event.key !== "Escape") {
                return;
            }


            closeAuditModal();

            closeMaintenanceConfirmation(
                true
            );
        }
    );
}


/* =========================================================
   INITIALIZE PAGE
   ========================================================= */

async function initializeSecurityPage() {

    /*
     * CRITICAL FIX:
     * Make the actual page visible BEFORE
     * administrator verification begins.
     */
    showSecurityPage();

    showLoader(
        "Verifying administrator access..."
    );


    try {

        await verifyAdministrator();

        showSecurityPage();

        await loadSecurityData();

    } catch (error) {

        console.error(
            "Administrator verification failed:",
            error
        );


        /*
         * Do NOT leave a completely blank page.
         */
        showSecurityPage();

        hideLoader();

        showMessage(
            error.message ||
            "Administrator verification failed.",
            "error"
        );


        renderAuditError(
            error.message ||
            "Administrator verification failed."
        );
    }
}


/* =========================================================
   GLOBAL HELPERS
   ========================================================= */

window.CrownCashAdminSecurity = {

    refresh:
        refreshSecurityPage,

    load:
        loadSecurityData,

    verify:
        verifyAdministrator,

    openAudit:
        openAuditModal,

    closeAudit:
        closeAuditModal,

    saveMaintenance:
        saveMaintenanceSettings
};


/* =========================================================
   START
   ========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    function () {

        /*
         * Reveal page immediately.
         * This prevents the completely blank
         * dark screen problem.
         */
        showSecurityPage();

        setupEventListeners();

        initializeSecurityPage();
    }
);