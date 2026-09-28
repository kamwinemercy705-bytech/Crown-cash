"use strict";

/* =========================================================
   CROWN CASH — ADMIN SECURITY & AUDIT
   ========================================================= */

const API_BASE = "https://crown-cash1.onrender.com";

const ADMIN_AUTH_API = `${API_BASE}/admin-auth.php`;
const SECURITY_API = `${API_BASE}/admin-security.php`;

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

    pendingMaintenanceState: null
};

/* =========================================================
   HELPERS
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
        console.error("Crown Cash: #adminSecurityPage was not found.");
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

function showLoader(message = "Verifying administrator access...") {
    const loader = $("pageLoader");
    const loaderMessage = $("loaderMessage");

    if (loaderMessage) {
        loaderMessage.textContent = message;
    }

    if (loader) {
        loader.classList.remove("hidden");

        loader.style.display = "flex";
        loader.style.visibility = "visible";
        loader.style.opacity = "1";
        loader.style.pointerEvents = "auto";
    }
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

/* =========================================================
   MESSAGE
   ========================================================= */

function showMessage(message, type = "info") {
    const element = $("securityMessage");

    if (!element) {
        return;
    }

    element.textContent = message;
    element.className = `security-message ${type}`;

    element.style.display = "block";

    clearTimeout(showMessage.timer);

    showMessage.timer = setTimeout(() => {
        element.style.display = "none";
    }, 5000);
}

/* =========================================================
   FETCH WITH TIMEOUT
   ========================================================= */

async function fetchJson(url, options = {}) {

    const controller = new AbortController();

    const timeout = setTimeout(() => {
        controller.abort();
    }, REQUEST_TIMEOUT);

    try {

        const response = await fetch(url, {
            credentials: "include",
            cache: "no-store",
            ...options,
            signal: controller.signal,
            headers: {
                "Accept": "application/json",
                ...(options.headers || {})
            }
        });

        const text = await response.text();

        let data = {};

        try {
            data = text ? JSON.parse(text) : {};
        } catch (error) {
            throw new Error(
                `Invalid server response (${response.status}).`
            );
        }

        if (!response.ok) {

            throw new Error(
                data.message ||
                data.error ||
                `Request failed with status ${response.status}.`
            );
        }

        return data;

    } catch (error) {

        if (error.name === "AbortError") {
            throw new Error(
                "The server took too long to respond. Please try again."
            );
        }

        throw error;

    } finally {

        clearTimeout(timeout);
    }
}

/* =========================================================
   ADMIN VERIFICATION
   ========================================================= */

async function verifyAdministrator() {

    const data = await fetchJson(ADMIN_AUTH_API, {
        method: "GET"
    });

    if (
        data.success !== true ||
        data.authorized !== true
    ) {
        throw new Error(
            data.message ||
            "Administrator access could not be verified."
        );
    }

    state.authenticated = true;

    return data;
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
   NUMBER FORMAT
   ========================================================= */

function formatNumber(value) {

    const number = Number(value || 0);

    if (!Number.isFinite(number)) {
        return "0";
    }

    return number.toLocaleString("en-US");
}

/* =========================================================
   DATE FORMAT
   ========================================================= */

function formatDate(value) {

    if (!value) {
        return "—";
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return String(value);
    }

    return date.toLocaleString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
    });
}

/* =========================================================
   BOOLEAN STATUS
   ========================================================= */

function formatBooleanStatus(value) {

    const active =
        value === true ||
        value === "true" ||
        value === 1 ||
        value === "1";

    return active
        ? `<span class="status-pill active">ACTIVE</span>`
        : `<span class="status-pill inactive">INACTIVE</span>`;
}

/* =========================================================
   AUDIT STATUS
   ========================================================= */

function normalizeStatus(value) {

    const status = String(value || "")
        .trim()
        .toLowerCase();

    if (
        status === "success" ||
        status === "successful" ||
        status === "completed" ||
        status === "approved"
    ) {
        return "success";
    }

    if (
        status === "pending" ||
        status === "processing"
    ) {
        return "pending";
    }

    if (
        status === "failed" ||
        status === "error" ||
        status === "rejected"
    ) {
        return "failed";
    }

    return "info";
}

function statusLabel(status) {

    const normalized = normalizeStatus(status);

    const labels = {
        success: "Success",
        pending: "Pending",
        failed: "Failed",
        info: "Info"
    };

    return labels[normalized] || "Info";
}

/* =========================================================
   AUDIT EVENT NAME
   ========================================================= */

function cleanEventName(value) {

    let name = String(value || "")
        .trim();

    if (!name) {
        return "Security Event";
    }

    /*
     * Prevent duplicated names such as:
     *
     * deposit_approved deposit_approved
     */

    const parts = name.split(/\s+/);

    if (
        parts.length === 2 &&
        parts[0].toLowerCase() === parts[1].toLowerCase()
    ) {
        name = parts[0];
    }

    return name;
}

/* =========================================================
   AUDIT EVENT DISPLAY LABEL
   ========================================================= */

function eventLabel(value) {

    const event = cleanEventName(value);

    return event
        .replace(/[_-]+/g, " ")
        .replace(/\b\w/g, letter => letter.toUpperCase());
}

/* =========================================================
   NORMALIZE AUDIT RECORD
   ========================================================= */

function normalizeAuditRecord(record) {

    const item = record || {};

    const event =
        item.event ||
        item.event_type ||
        item.type ||
        item.action ||
        item.activity ||
        "security_event";

    const status =
        item.status ||
        item.result ||
        item.outcome ||
        item.state ||
        "info";

    const description =
        item.description ||
        item.message ||
        item.details ||
        item.note ||
        "Security event recorded.";

    const actor =
        item.actor ||
        item.actor_name ||
        item.performed_by ||
        item.admin_name ||
        item.username ||
        "System";

    const createdAt =
        item.created_at ||
        item.createdAt ||
        item.timestamp ||
        item.date ||
        item.time ||
        "";

    const id =
        item._id ||
        item.id ||
        item.audit_id ||
        "";

    return {
        id: String(id),

        event: cleanEventName(event),

        eventLabel: eventLabel(event),

        status: normalizeStatus(status),

        description: String(description),

        actor: String(actor),

        createdAt: createdAt,

        raw: item
    };
}

/* =========================================================
   LOAD SECURITY DATA
   ========================================================= */

async function loadSecurityData() {

    const data = await fetchJson(SECURITY_API, {
        method: "GET"
    });

    if (data.success !== true) {

        throw new Error(
            data.message ||
            "Unable to load security information."
        );
    }

    return data;
}

/* =========================================================
   SECURITY OVERVIEW
   ========================================================= */

function renderSecurityOverview(data) {

    const security = data.security || {};
    const stats = data.stats || {};

    const securityStatus =
        security.status ||
        data.security_status ||
        "Secure";

    const adminSessions =
        stats.admin_sessions ??
        data.admin_sessions ??
        0;

    const failedAttempts =
        stats.failed_attempts ??
        data.failed_attempts ??
        0;

    const securityEvents =
        stats.security_events ??
        stats.total_events ??
        data.security_events ??
        data.total_events ??
        0;

    const statusElement = $("securityStatus");

    if (statusElement) {

        const safeStatus =
            String(securityStatus);

        statusElement.textContent =
            safeStatus;
    }

    const statusText = $("securityStatusText");

    if (statusText) {

        if (
            String(securityStatus)
                .toLowerCase()
                === "secure"
        ) {

            statusText.textContent =
                "Platform protection active";

        } else {

            statusText.textContent =
                "Security review recommended";
        }
    }

    const sessionsElement = $("adminSessions");

    if (sessionsElement) {
        sessionsElement.textContent =
            formatNumber(adminSessions);
    }

    const failedElement = $("failedAttempts");

    if (failedElement) {
        failedElement.textContent =
            formatNumber(failedAttempts);
    }

    const eventsElement = $("securityEvents");

    if (eventsElement) {
        eventsElement.textContent =
            formatNumber(securityEvents);
    }
}

/* =========================================================
   SECURITY CONTROLS
   ========================================================= */

function renderSecurityControls(data) {

    const controls =
        data.controls ||
        data.security_controls ||
        {};

    const loginProtection =
        controls.login_protection ??
        controls.loginProtection ??
        true;

    const sessionSecurity =
        controls.session_security ??
        controls.sessionSecurity ??
        true;

    const loginElement =
        $("loginProtectionStatus");

    if (loginElement) {

        loginElement.innerHTML =
            formatBooleanStatus(loginProtection);
    }

    const sessionElement =
        $("sessionSecurityStatus");

    if (sessionElement) {

        sessionElement.innerHTML =
            formatBooleanStatus(sessionSecurity);
    }
}

/* =========================================================
   AUDIT DATA
   ========================================================= */

function getAuditRecords(data) {

    let records = [];

    if (Array.isArray(data.audit)) {
        records = data.audit;
    } else if (Array.isArray(data.audit_logs)) {
        records = data.audit_logs;
    } else if (Array.isArray(data.auditRecords)) {
        records = data.auditRecords;
    } else if (Array.isArray(data.records)) {
        records = data.records;
    } else if (Array.isArray(data.events)) {
        records = data.events;
    }

    return records.map(normalizeAuditRecord);
}

/* =========================================================
   RENDER AUDIT COUNT
   ========================================================= */

function renderAuditCount() {

    const count =
        state.filteredAuditRecords.length;

    const auditCount = $("auditCount");

    if (auditCount) {

        auditCount.textContent =
            `${formatNumber(count)} event${count === 1 ? "" : "s"}`;
    }

    const tableCount =
        $("auditTableCount");

    if (tableCount) {

        tableCount.textContent =
            `${formatNumber(count)} record${count === 1 ? "" : "s"}`;
    }
}

/* =========================================================
   AUDIT FILTERS
   ========================================================= */

function applyAuditFilters() {

    const search =
        String(
            $("auditSearch")?.value || ""
        )
            .trim()
            .toLowerCase();

    const type =
        String(
            $("auditTypeFilter")?.value || ""
        )
            .trim()
            .toLowerCase();

    const status =
        String(
            $("auditStatusFilter")?.value || ""
        )
            .trim()
            .toLowerCase();

    state.filteredAuditRecords =
        state.auditRecords.filter(record => {

            const searchableText = [
                record.event,
                record.eventLabel,
                record.description,
                record.actor,
                record.status,
                record.createdAt
            ]
                .join(" ")
                .toLowerCase();

            const matchesSearch =
                !search ||
                searchableText.includes(search);

            const matchesType =
                !type ||
                type === "all" ||
                record.event.toLowerCase() === type ||
                record.eventLabel.toLowerCase() === type;

            const matchesStatus =
                !status ||
                status === "all" ||
                record.status === status;

            return (
                matchesSearch &&
                matchesType &&
                matchesStatus
            );
        });

    state.currentPage = 1;

    renderAuditRecords();
}

/* =========================================================
   AUDIT TABLE
   ========================================================= */

function renderAuditRecords() {

    renderAuditCount();

    const tableBody =
        $("auditTableBody");

    const mobileList =
        $("auditMobileList");

    const records =
        state.filteredAuditRecords;

    if (!records.length) {

        if (tableBody) {

            tableBody.innerHTML = `
                <tr>
                    <td colspan="5" class="empty-state">
                        No security events found.
                    </td>
                </tr>
            `;
        }

        if (mobileList) {

            mobileList.innerHTML = `
                <div class="empty-state">
                    No security events found.
                </div>
            `;
        }

        renderAuditPagination();

        return;
    }

    const start =
        (state.currentPage - 1) *
        ITEMS_PER_PAGE;

    const end =
        start + ITEMS_PER_PAGE;

    const pageRecords =
        records.slice(start, end);

    if (tableBody) {

        tableBody.innerHTML =
            pageRecords.map(record => {

                return `
                    <tr>

                        <td>
                            <div class="audit-event-name">
                                ${escapeHtml(record.eventLabel)}
                            </div>

                            <div class="audit-event-code">
                                ${escapeHtml(record.event)}
                            </div>
                        </td>

                        <td>
                            <span class="status-pill ${escapeHtml(record.status)}">
                                ${escapeHtml(statusLabel(record.status))}
                            </span>
                        </td>

                        <td>
                            ${escapeHtml(record.description)}
                        </td>

                        <td>
                            ${escapeHtml(record.actor)}
                        </td>

                        <td>
                            ${escapeHtml(formatDate(record.createdAt))}
                        </td>

                        <td>
                            <button
                                type="button"
                                class="view-button"
                                data-audit-id="${escapeHtml(record.id)}"
                            >
                                <svg
                                    viewBox="0 0 24 24"
                                    aria-hidden="true"
                                >
                                    <path
                                        d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z"
                                    ></path>
                                    <circle
                                        cx="12"
                                        cy="12"
                                        r="2.5"
                                    ></circle>
                                </svg>

                                View Event
                            </button>
                        </td>

                    </tr>
                `;

            }).join("");
    }

    if (mobileList) {

        mobileList.innerHTML =
            pageRecords.map(record => {

                return `
                    <article class="mobile-audit-card">

                        <div class="mobile-audit-top">

                            <div>
                                <strong>
                                    ${escapeHtml(record.eventLabel)}
                                </strong>

                                <small>
                                    ${escapeHtml(record.event)}
                                </small>
                            </div>

                            <span class="status-pill ${escapeHtml(record.status)}">
                                ${escapeHtml(statusLabel(record.status))}
                            </span>

                        </div>

                        <p>
                            ${escapeHtml(record.description)}
                        </p>

                        <div class="mobile-audit-meta">

                            <span>
                                ${escapeHtml(record.actor)}
                            </span>

                            <span>
                                ${escapeHtml(formatDate(record.createdAt))}
                            </span>

                        </div>

                        <button
                            type="button"
                            class="view-button"
                            data-audit-id="${escapeHtml(record.id)}"
                        >
                            <svg
                                viewBox="0 0 24 24"
                                aria-hidden="true"
                            >
                                <path
                                    d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z"
                                ></path>

                                <circle
                                    cx="12"
                                    cy="12"
                                    r="2.5"
                                ></circle>
                            </svg>

                            View Event
                        </button>

                    </article>
                `;

            }).join("");
    }

    attachAuditViewButtons();

    renderAuditPagination();
}

/* =========================================================
   AUDIT PAGINATION
   ========================================================= */

function renderAuditPagination() {

    const pagination =
        $("auditPagination");

    if (!pagination) {
        return;
    }

    const total =
        state.filteredAuditRecords.length;

    const pages =
        Math.max(
            1,
            Math.ceil(total / ITEMS_PER_PAGE)
        );

    if (pages <= 1) {

        pagination.innerHTML = "";

        return;
    }

    let html = "";

    html += `
        <button
            type="button"
            class="pagination-button"
            data-page="${state.currentPage - 1}"
            ${state.currentPage <= 1 ? "disabled" : ""}
        >
            Previous
        </button>
    `;

    for (let page = 1; page <= pages; page++) {

        if (
            page === 1 ||
            page === pages ||
            Math.abs(page - state.currentPage) <= 1
        ) {

            html += `
                <button
                    type="button"
                    class="pagination-button ${page === state.currentPage ? "active" : ""}"
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
            data-page="${state.currentPage + 1}"
            ${state.currentPage >= pages ? "disabled" : ""}
        >
            Next
        </button>
    `;

    pagination.innerHTML = html;

    pagination
        .querySelectorAll("[data-page]")
        .forEach(button => {

            button.addEventListener(
                "click",
                function () {

                    const page =
                        Number(
                            this.dataset.page
                        );

                    if (
                        !Number.isFinite(page) ||
                        page < 1 ||
                        page > pages
                    ) {
                        return;
                    }

                    state.currentPage = page;

                    renderAuditRecords();
                }
            );
        });
}

/* =========================================================
   AUDIT VIEW BUTTONS
   ========================================================= */

function attachAuditViewButtons() {

    document
        .querySelectorAll("[data-audit-id]")
        .forEach(button => {

            button.addEventListener(
                "click",
                function () {

                    const id =
                        this.dataset.auditId;

                    openAuditModal(id);
                }
            );
        });
}

/* =========================================================
   AUDIT MODAL
   ========================================================= */

function openAuditModal(id) {

    const record =
        state.auditRecords.find(
            item => item.id === id
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
        <div class="detail-row">
            <span>Event</span>
            <strong>
                ${escapeHtml(record.eventLabel)}
            </strong>
        </div>

        <div class="detail-row">
            <span>Event Code</span>
            <strong>
                ${escapeHtml(record.event)}
            </strong>
        </div>

        <div class="detail-row">
            <span>Status</span>
            <strong>
                <span class="status-pill ${escapeHtml(record.status)}">
                    ${escapeHtml(statusLabel(record.status))}
                </span>
            </strong>
        </div>

        <div class="detail-row">
            <span>Description</span>
            <strong>
                ${escapeHtml(record.description)}
            </strong>
        </div>

        <div class="detail-row">
            <span>Performed By</span>
            <strong>
                ${escapeHtml(record.actor)}
            </strong>
        </div>

        <div class="detail-row">
            <span>Date</span>
            <strong>
                ${escapeHtml(formatDate(record.createdAt))}
            </strong>
        </div>

        <div class="detail-row">
            <span>Event ID</span>
            <strong>
                ${escapeHtml(record.id || "—")}
            </strong>
        </div>
    `;

    modal.classList.add("open");

    modal.style.display = "flex";
    modal.style.visibility = "visible";
    modal.style.opacity = "1";
}

/* =========================================================
   CLOSE AUDIT MODAL
   ========================================================= */

function closeAuditModal() {

    const modal =
        $("auditModal");

    if (!modal) {
        return;
    }

    modal.classList.remove("open");

    modal.style.opacity = "0";
    modal.style.visibility = "hidden";

    setTimeout(() => {

        if (!modal.classList.contains("open")) {
            modal.style.display = "none";
        }

    }, 200);
}

/* =========================================================
   MAINTENANCE SETTINGS
   ========================================================= */

function renderMaintenance(data) {

    const maintenance =
        data.maintenance ||
        data.system_maintenance ||
        data.settings?.maintenance ||
        {};

    const enabled =
        maintenance.enabled ??
        maintenance.maintenance_enabled ??
        false;

    const message =
        maintenance.message ||
        "Crown Cash is temporarily unavailable while maintenance is being performed.";

    const allowAdmin =
        maintenance.allow_admin_access ??
        maintenance.allowAdminAccess ??
        true;

    state.maintenanceEnabled =
        Boolean(enabled);

    state.maintenanceMessage =
        String(message);

    state.allowAdminAccess =
        Boolean(allowAdmin);

    const toggle =
        $("maintenanceToggle");

    if (toggle) {

        toggle.checked =
            state.maintenanceEnabled;
    }

    const messageInput =
        $("maintenanceMessage");

    if (messageInput) {

        messageInput.value =
            state.maintenanceMessage;

        updateMaintenanceCounter();
    }

    const adminAccess =
        $("allowAdminAccess");

    if (adminAccess) {

        adminAccess.checked =
            state.allowAdminAccess;
    }

    const statusText =
        $("maintenanceStatusText");

    if (statusText) {

        statusText.textContent =
            state.maintenanceEnabled
                ? "Maintenance mode active"
                : "Customer access available";
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

    const length =
        input.value.length;

    counter.textContent =
        `${length} / 300`;
}

/* =========================================================
   MAINTENANCE CONFIRMATION
   ========================================================= */

function openMaintenanceConfirmation(enabled) {

    const modal =
        $("maintenanceConfirmModal");

    if (!modal) {
        return;
    }

    state.pendingMaintenanceState =
        Boolean(enabled);

    const title =
        $("maintenanceConfirmTitle");

    const text =
        $("maintenanceConfirmText");

    if (title) {

        title.textContent =
            enabled
                ? "Enable Maintenance Mode?"
                : "Disable Maintenance Mode?";
    }

    if (text) {

        text.textContent =
            enabled
                ? "Customer access will be restricted while maintenance mode is active."
                : "Customer access will become available again.";
    }

    modal.classList.add("open");

    modal.style.display = "flex";
    modal.style.visibility = "visible";
    modal.style.opacity = "1";
}

/* =========================================================
   CLOSE MAINTENANCE CONFIRMATION
   ========================================================= */

function closeMaintenanceConfirmation() {

    const modal =
        $("maintenanceConfirmModal");

    if (!modal) {
        return;
    }

    modal.classList.remove("open");

    modal.style.opacity = "0";
    modal.style.visibility = "hidden";

    setTimeout(() => {

        if (!modal.classList.contains("open")) {
            modal.style.display = "none";
        }

    }, 200);

    state.pendingMaintenanceState =
        null;

    const toggle =
        $("maintenanceToggle");

    if (toggle) {

        toggle.checked =
            state.maintenanceEnabled;
    }
}

/* =========================================================
   SAVE MAINTENANCE
   ========================================================= */

async function saveMaintenanceSettings() {

    const enabled =
        state.pendingMaintenanceState;

    if (enabled === null) {
        return;
    }

    const message =
        String(
            $("maintenanceMessage")?.value || ""
        ).trim();

    const allowAdmin =
        Boolean(
            $("allowAdminAccess")?.checked
        );

    if (message.length > 300) {

        showMessage(
            "Maintenance message cannot exceed 300 characters.",
            "error"
        );

        return;
    }

    const button =
        $("confirmMaintenanceBtn");

    if (button) {

        button.disabled = true;
        button.textContent = "Saving...";
    }

    try {

        const data =
            await fetchJson(SECURITY_API, {

                method: "POST",

                headers: {
                    "Content-Type":
                        "application/json"
                },

                body: JSON.stringify({
                    action: "maintenance",
                    enabled: Boolean(enabled),
                    message: message,
                    allow_admin_access:
                        allowAdmin
                })
            });

        if (data.success !== true) {

            throw new Error(
                data.message ||
                "Unable to save maintenance settings."
            );
        }

        state.maintenanceEnabled =
            Boolean(enabled);

        state.maintenanceMessage =
            message;

        state.allowAdminAccess =
            allowAdmin;

        closeMaintenanceConfirmation();

        renderMaintenance({
            maintenance: {
                enabled:
                    state.maintenanceEnabled,

                message:
                    state.maintenanceMessage,

                allow_admin_access:
                    state.allowAdminAccess
            }
        });

        showMessage(
            "Maintenance settings saved successfully.",
            "success"
        );

        await loadSecurityPageData();

    } catch (error) {

        showMessage(
            error.message ||
            "Unable to save maintenance settings.",
            "error"
        );

    } finally {

        if (button) {

            button.disabled = false;
            button.textContent =
                "Confirm Changes";
        }
    }
}

/* =========================================================
   LOAD EVERYTHING
   ========================================================= */

async function loadSecurityPageData() {

    showSecurityPage();

    try {

        const data =
            await loadSecurityData();

        renderSecurityOverview(data);

        renderSecurityControls(data);

        state.auditRecords =
            getAuditRecords(data);

        state.filteredAuditRecords =
            [...state.auditRecords];

        state.currentPage = 1;

        renderAuditRecords();

        renderMaintenance(data);

        showSecurityPage();

    } catch (error) {

        console.error(
            "Crown Cash Security:",
            error
        );

        showSecurityPage();

        showMessage(
            error.message ||
            "Unable to load security information.",
            "error"
        );

        /*
         * Keep the page visible even if
         * the backend temporarily fails.
         */

        state.auditRecords = [];
        state.filteredAuditRecords = [];

        renderAuditRecords();

    } finally {

        hideLoader();
    }
}

/* =========================================================
   REFRESH
   ========================================================= */

async function refreshSecurityPage() {

    const button =
        $("refreshSecurityBtn");

    if (button) {

        button.disabled = true;

        button.classList.add(
            "is-loading"
        );
    }

    try {

        await loadSecurityPageData();

        showMessage(
            "Security information refreshed.",
            "success"
        );

    } finally {

        if (button) {

            button.disabled = false;

            button.classList.remove(
                "is-loading"
            );
        }
    }
}

/* =========================================================
   EVENTS
   ========================================================= */

function attachEvents() {

    /* Refresh */

    const refreshButton =
        $("refreshSecurityBtn");

    if (refreshButton) {

        refreshButton.addEventListener(
            "click",
            refreshSecurityPage
        );
    }

    /* Audit Search */

    const auditSearch =
        $("auditSearch");

    if (auditSearch) {

        auditSearch.addEventListener(
            "input",
            applyAuditFilters
        );
    }

    /* Audit Type */

    const auditType =
        $("auditTypeFilter");

    if (auditType) {

        auditType.addEventListener(
            "change",
            applyAuditFilters
        );
    }

    /* Audit Status */

    const auditStatus =
        $("auditStatusFilter");

    if (auditStatus) {

        auditStatus.addEventListener(
            "change",
            applyAuditFilters
        );
    }

    /* Maintenance message counter */

    const maintenanceMessage =
        $("maintenanceMessage");

    if (maintenanceMessage) {

        maintenanceMessage.addEventListener(
            "input",
            updateMaintenanceCounter
        );
    }

    /* Maintenance toggle */

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

    /* Save maintenance */

    const saveMaintenance =
        $("saveMaintenanceBtn");

    if (saveMaintenance) {

        saveMaintenance.addEventListener(
            "click",
            function () {

                const enabled =
                    Boolean(
                        $("maintenanceToggle")?.checked
                    );

                openMaintenanceConfirmation(
                    enabled
                );
            }
        );
    }

    /* Audit modal close */

    const closeAudit =
        $("closeAuditModal");

    if (closeAudit) {

        closeAudit.addEventListener(
            "click",
            closeAuditModal
        );
    }

    const closeAuditOverlay =
        $("closeAuditModalOverlay");

    if (closeAuditOverlay) {

        closeAuditOverlay.addEventListener(
            "click",
            closeAuditModal
        );
    }

    const closeAuditDetails =
        $("closeAuditDetailsBtn");

    if (closeAuditDetails) {

        closeAuditDetails.addEventListener(
            "click",
            closeAuditModal
        );
    }

    /* Maintenance confirmation close */

    const closeMaintenance =
        $("closeMaintenanceConfirmOverlay");

    if (closeMaintenance) {

        closeMaintenance.addEventListener(
            "click",
            closeMaintenanceConfirmation
        );
    }

    const cancelMaintenance =
        $("cancelMaintenanceBtn");

    if (cancelMaintenance) {

        cancelMaintenance.addEventListener(
            "click",
            closeMaintenanceConfirmation
        );
    }

    /* Confirm maintenance */

    const confirmMaintenance =
        $("confirmMaintenanceBtn");

    if (confirmMaintenance) {

        confirmMaintenance.addEventListener(
            "click",
            saveMaintenanceSettings
        );
    }

    /* Escape key */

    document.addEventListener(
        "keydown",
        function (event) {

            if (event.key !== "Escape") {
                return;
            }

            closeAuditModal();

            closeMaintenanceConfirmation();
        }
    );
}

/* =========================================================
   INITIALIZATION
   ========================================================= */

async function initializeSecurityPage() {

    showLoader(
        "Verifying administrator access..."
    );

    /*
     * Always make the page available.
     * This prevents a blank screen if the API
     * is slow or temporarily unavailable.
     */

    showSecurityPage();

    try {

        await verifyAdministrator();

        showLoader(
            "Loading security information..."
        );

        await loadSecurityPageData();

    } catch (error) {

        console.error(
            "Crown Cash administrator verification:",
            error
        );

        showSecurityPage();

        hideLoader();

        showMessage(
            error.message ||
            "Administrator verification failed.",
            "error"
        );

        /*
         * Do not leave a blank page.
         */

        const auditTableBody =
            $("auditTableBody");

        if (auditTableBody) {

            auditTableBody.innerHTML = `
                <tr>
                    <td colspan="6" class="empty-state">
                        Unable to load security information.
                        Please refresh and try again.
                    </td>
                </tr>
            `;
        }

        const mobileList =
            $("auditMobileList");

        if (mobileList) {

            mobileList.innerHTML = `
                <div class="empty-state">
                    Unable to load security information.
                    Please refresh and try again.
                </div>
            `;
        }
    }
}

/* =========================================================
   GLOBAL API
   ========================================================= */

window.CrownCashAdminSecurity = {

    refresh:
        refreshSecurityPage,

    load:
        loadSecurityPageData,

    openAudit:
        openAuditModal,

    closeAudit:
        closeAuditModal,

    openMaintenance:
        openMaintenanceConfirmation,

    closeMaintenance:
        closeMaintenanceConfirmation
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
        function () {

            attachEvents();

            initializeSecurityPage();
        }
    );

} else {

    attachEvents();

    initializeSecurityPage();
}