const API_BASE = "https://crown-cash1.onrender.com";

const ADMIN_AUTH_API =
    `${API_BASE}/admin-auth.php`;

const SECURITY_API =
    `${API_BASE}/admin-security.php`;

const REQUEST_TIMEOUT = 15000;
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
   DOM HELPERS
========================================================= */

function $(id) {
    return document.getElementById(id);
}


function showElement(element) {
    if (element) {
        element.style.display = "";
    }
}


function hideElement(element) {
    if (element) {
        element.style.display = "none";
    }
}


/* =========================================================
   MESSAGE
========================================================= */

function showMessage(message, type = "error") {

    const box = $("securityMessage");

    if (!box) {
        return;
    }

    box.textContent = message;

    box.className =
        `security-message ${type}`;

    box.style.display = "block";
}


function hideMessage() {

    const box = $("securityMessage");

    if (!box) {
        return;
    }

    box.style.display = "none";
}


/* =========================================================
   LOADER
========================================================= */

function setLoaderMessage(message) {

    const loaderMessage =
        $("loaderMessage");

    if (loaderMessage) {
        loaderMessage.textContent = message;
    }
}


function hideLoader() {

    const loader =
        $("pageLoader");

    if (!loader) {
        return;
    }

    loader.classList.add("hidden");

    setTimeout(() => {
        loader.style.display = "none";
    }, 300);
}


function showLoader(message = "Verifying administrator access...") {

    const loader =
        $("pageLoader");

    if (!loader) {
        return;
    }

    loader.style.display = "flex";

    requestAnimationFrame(() => {
        loader.classList.remove("hidden");
    });

    setLoaderMessage(message);
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
                        controller.signal,

                    headers: {
                        "Accept":
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
                    : null;
        } catch (error) {

            throw new Error(
                `Server returned an invalid response (${response.status}).`
            );
        }


        if (!response.ok) {

            throw new Error(
                data?.message ||
                `Request failed with HTTP ${response.status}.`
            );
        }


        if (
            data &&
            data.success === false
        ) {

            throw new Error(
                data.message ||
                "The server rejected the request."
            );
        }


        return data;

    } catch (error) {

        if (
            error.name ===
            "AbortError"
        ) {

            throw new Error(
                "The server is taking too long to respond. Please try again."
            );
        }

        throw error;

    } finally {

        clearTimeout(timer);
    }
}


/* =========================================================
   VERIFY ADMINISTRATOR
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
            data.success !== true
        ) {

            throw new Error(
                data?.message ||
                "Administrator access could not be verified."
            );
        }


        /*
         * Accept the different successful
         * response formats used by the
         * existing Crown Cash admin APIs.
         */

        if (
            data.authenticated === false ||
            data.authorized === false
        ) {

            throw new Error(
                data.message ||
                "You are not authorized to access this page."
            );
        }


        state.authenticated = true;

        return true;

    } catch (error) {

        state.authenticated = false;

        hideLoader();

        showMessage(
            error.message ||
            "Administrator verification failed.",
            "error"
        );

        return false;
    }
}


/* =========================================================
   LOAD SECURITY DATA
========================================================= */

async function loadSecurityData() {

    try {

        setLoaderMessage(
            "Loading security information..."
        );


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
                "Security information could not be loaded."
            );
        }


        updateSecurityOverview(
            data
        );


        loadAuditRecords(
            data
        );


        loadMaintenanceSettings(
            data
        );


        hideLoader();

        hideMessage();


        return true;

    } catch (error) {

        hideLoader();

        showMessage(
            error.message ||
            "Unable to load security information.",
            "error"
        );

        return false;
    }
}


/* =========================================================
   SECURITY OVERVIEW
========================================================= */

function updateSecurityOverview(data) {

    const security =
        data.security ||
        data.stats ||
        {};


    const status =
        security.status ||
        "Secure";


    const statusElement =
        $("securityStatus");

    const statusText =
        $("securityStatusText");


    if (statusElement) {

        statusElement.textContent =
            status;
    }


    if (statusText) {

        statusText.textContent =
            status === "Review"
                ? "Review required"
                : "Platform protection active";
    }


    const adminSessions =
        security.admin_sessions ??
        security.adminSessions ??
        1;


    const failedAttempts =
        security.failed_attempts ??
        security.failedAttempts ??
        0;


    const securityEvents =
        security.security_events ??
        security.securityEvents ??
        data.audit_count ??
        data.auditCount ??
        0;


    if ($("adminSessions")) {

        $("adminSessions").textContent =
            formatNumber(adminSessions);
    }


    if ($("failedAttempts")) {

        $("failedAttempts").textContent =
            formatNumber(failedAttempts);
    }


    if ($("securityEvents")) {

        $("securityEvents").textContent =
            formatNumber(securityEvents);
    }


    const loginProtection =
        security.login_protection ??
        security.loginProtection ??
        true;


    const sessionSecurity =
        security.session_security ??
        security.sessionSecurity ??
        true;


    if ($("loginProtectionStatus")) {

        $("loginProtectionStatus").textContent =
            loginProtection
                ? "Active"
                : "Review";
    }


    if ($("sessionSecurityStatus")) {

        $("sessionSecurityStatus").textContent =
            sessionSecurity
                ? "2 Hours"
                : "Review";
    }
}


/* =========================================================
   AUDIT RECORDS
========================================================= */

function loadAuditRecords(data) {

    let records =
        data.audit_logs ||
        data.auditLogs ||
        data.records ||
        [];


    if (!Array.isArray(records)) {
        records = [];
    }


    state.auditRecords =
        records.map(
            normalizeAuditRecord
        );


    state.filteredAuditRecords =
        [...state.auditRecords];


    state.currentPage = 1;


    renderAuditRecords();
}


/* =========================================================
   NORMALIZE AUDIT RECORD
========================================================= */

function normalizeAuditRecord(record) {

    if (!record || typeof record !== "object") {

        return {
            id: "",
            user: "System",
            action: "System Event",
            event: "Security Event",
            ip: "—",
            status: "info",
            date: ""
        };
    }


    const details =
        record.details || {};


    return {

        id:
            record.id ||
            record._id ||
            "",

        user:
            record.admin_email ||
            record.user_email ||
            record.email ||
            record.user_name ||
            record.full_name ||
            "System",

        action:
            record.action ||
            record.event ||
            record.type ||
            "System Event",

        event:
            record.event ||
            record.action ||
            record.type ||
            "Security Event",

        ip:
            record.ip_address ||
            record.ip ||
            record.ipAddress ||
            "—",

        status:
            record.status ||
            record.result ||
            record.outcome ||
            "info",

        date:
            record.created_at ||
            record.timestamp ||
            record.date ||
            "",

        details:
            details
    };
}


/* =========================================================
   RENDER AUDIT RECORDS
========================================================= */

function renderAuditRecords() {

    const search =
        (
            $("auditSearch")?.value ||
            ""
        )
            .trim()
            .toLowerCase();


    const type =
        $("auditTypeFilter")?.value ||
        "all";


    const status =
        $("auditStatusFilter")?.value ||
        "all";


    state.filteredAuditRecords =
        state.auditRecords.filter(
            record => {

                const searchable =
                    [
                        record.user,
                        record.action,
                        record.event,
                        record.ip,
                        record.status
                    ]
                        .join(" ")
                        .toLowerCase();


                const matchesSearch =
                    !search ||
                    searchable.includes(
                        search
                    );


                const matchesType =
                    type === "all" ||
                    normalizeFilterValue(
                        record.action
                    ) ===
                    normalizeFilterValue(
                        type
                    ) ||
                    normalizeFilterValue(
                        record.event
                    ) ===
                    normalizeFilterValue(
                        type
                    );


                const matchesStatus =
                    status === "all" ||
                    normalizeFilterValue(
                        record.status
                    ) ===
                    normalizeFilterValue(
                        status
                    );


                return (
                    matchesSearch &&
                    matchesType &&
                    matchesStatus
                );
            }
        );


    state.currentPage = 1;


    const total =
        state.filteredAuditRecords.length;


    if ($("auditCount")) {

        $("auditCount").textContent =
            `${total} ${
                total === 1
                    ? "event"
                    : "events"
            }`;
    }


    if ($("auditTableCount")) {

        $("auditTableCount").textContent =
            `${total} ${
                total === 1
                    ? "record"
                    : "records"
            }`;
    }


    renderAuditTable();
    renderAuditMobile();
    renderAuditPagination();
}


/* =========================================================
   AUDIT DESKTOP TABLE
========================================================= */

function renderAuditTable() {

    const tbody =
        $("auditTableBody");

    if (!tbody) {
        return;
    }


    const start =
        (
            state.currentPage - 1
        ) * ITEMS_PER_PAGE;


    const pageRecords =
        state.filteredAuditRecords.slice(
            start,
            start + ITEMS_PER_PAGE
        );


    if (!pageRecords.length) {

        tbody.innerHTML = `
            <tr>
                <td
                    colspan="7"
                    class="empty-state"
                >
                    No audit activity found.
                </td>
            </tr>
        `;

        return;
    }


    tbody.innerHTML =
        pageRecords
            .map(
                record => `
                    <tr>

                        <td>
                            ${escapeHtml(
                                record.user
                            )}
                        </td>

                        <td>
                            ${escapeHtml(
                                formatLabel(
                                    record.action
                                )
                            )}
                        </td>

                        <td>
                            ${escapeHtml(
                                formatLabel(
                                    record.event
                                )
                            )}
                        </td>

                        <td>
                            ${escapeHtml(
                                record.ip
                            )}
                        </td>

                        <td>
                            <span
                                class="status-pill ${statusClass(
                                    record.status
                                )}"
                            >
                                ${escapeHtml(
                                    formatLabel(
                                        record.status
                                    )
                                )}
                            </span>
                        </td>

                        <td>
                            ${escapeHtml(
                                formatDate(
                                    record.date
                                )
                            )}
                        </td>

                        <td>
                            <button
                                class="view-button"
                                type="button"
                                data-audit-id="${escapeAttribute(
                                    record.id
                                )}"
                            >
                                View
                            </button>
                        </td>

                    </tr>
                `
            )
            .join("");
}


/* =========================================================
   AUDIT MOBILE CARDS
========================================================= */

function renderAuditMobile() {

    const container =
        $("auditMobileList");

    if (!container) {
        return;
    }


    const start =
        (
            state.currentPage - 1
        ) * ITEMS_PER_PAGE;


    const pageRecords =
        state.filteredAuditRecords.slice(
            start,
            start + ITEMS_PER_PAGE
        );


    if (!pageRecords.length) {

        container.innerHTML = `
            <div class="empty-state">
                No audit activity found.
            </div>
        `;

        return;
    }


    container.innerHTML =
        pageRecords
            .map(
                record => `
                    <article
                        class="mobile-audit-card"
                    >

                        <div
                            class="mobile-audit-top"
                        >

                            <div>

                                <strong>
                                    ${escapeHtml(
                                        formatLabel(
                                            record.action
                                        )
                                    )}
                                </strong>

                                <span>
                                    ${escapeHtml(
                                        record.user
                                    )}
                                </span>

                            </div>

                            <span
                                class="status-pill ${statusClass(
                                    record.status
                                )}"
                            >
                                ${escapeHtml(
                                    formatLabel(
                                        record.status
                                    )
                                )}
                            </span>

                        </div>


                        <div
                            class="mobile-audit-meta"
                        >

                            <span>
                                ${escapeHtml(
                                    formatLabel(
                                        record.event
                                    )
                                )}
                            </span>

                            <span>
                                ${escapeHtml(
                                    record.ip
                                )}
                            </span>

                            <span>
                                ${escapeHtml(
                                    formatDate(
                                        record.date
                                    )
                                )}
                            </span>

                        </div>


                        <button
                            type="button"
                            class="view-button"
                            data-audit-id="${escapeAttribute(
                                record.id
                            )}"
                        >
                            View Details
                        </button>

                    </article>
                `
            )
            .join("");
}


/* =========================================================
   PAGINATION
========================================================= */

function renderAuditPagination() {

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


    if (state.currentPage > 1) {

        html += `
            <button
                type="button"
                data-page="${state.currentPage - 1}"
            >
                Previous
            </button>
        `;
    }


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
    }


    if (
        state.currentPage <
        totalPages
    ) {

        html += `
            <button
                type="button"
                data-page="${state.currentPage + 1}"
            >
                Next
            </button>
        `;
    }


    container.innerHTML = html;
}


/* =========================================================
   MAINTENANCE SETTINGS
========================================================= */

function loadMaintenanceSettings(data) {

    const maintenance =
        data.maintenance ||
        {};


    state.maintenanceEnabled =
        Boolean(
            maintenance.enabled
        );


    state.maintenanceMessage =
        maintenance.message ||
        "";


    state.allowAdminAccess =
        maintenance.allow_admin_access !== false;


    if ($("maintenanceToggle")) {

        $("maintenanceToggle").checked =
            state.maintenanceEnabled;
    }


    if ($("maintenanceMessage")) {

        $("maintenanceMessage").value =
            state.maintenanceMessage;
    }


    if ($("allowAdminAccess")) {

        $("allowAdminAccess").checked =
            state.allowAdminAccess;
    }


    updateMaintenanceDisplay();

    updateMessageCount();
}


/* =========================================================
   MAINTENANCE DISPLAY
========================================================= */

function updateMaintenanceDisplay() {

    const status =
        $("maintenanceStatusText");

    if (!status) {
        return;
    }


    if (state.maintenanceEnabled) {

        status.textContent =
            "Maintenance mode is active.";

        status.classList.add(
            "maintenance-active"
        );

    } else {

        status.textContent =
            "Customer access is currently available.";

        status.classList.remove(
            "maintenance-active"
        );
    }
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

    if (!modal) {
        return;
    }


    const title =
        $("maintenanceConfirmTitle");


    const text =
        $("maintenanceConfirmText");


    if (title) {

        title.textContent =
            enabled
                ? "Enable Maintenance Mode"
                : "Disable Maintenance Mode";
    }


    if (text) {

        text.textContent =
            enabled
                ? "Customer access will be restricted while maintenance mode is active."
                : "Customer access will be restored when maintenance mode is disabled.";
    }


    modal.classList.add(
        "active"
    );
}


/* =========================================================
   CLOSE MAINTENANCE MODAL
========================================================= */

function closeMaintenanceConfirmation(
    resetToggle = true
) {

    const modal =
        $("maintenanceConfirmModal");

    if (modal) {

        modal.classList.remove(
            "active"
        );
    }


    if (
        resetToggle &&
        $("maintenanceToggle")
    ) {

        $("maintenanceToggle").checked =
            state.maintenanceEnabled;
    }


    state.pendingMaintenanceState =
        null;
}


/* =========================================================
   SAVE MAINTENANCE
========================================================= */

async function saveMaintenanceSettings() {

    const enabled =
        state.pendingMaintenanceState !== null
            ? state.pendingMaintenanceState
            : Boolean(
                $("maintenanceToggle")?.checked
            );


    const message =
        (
            $("maintenanceMessage")?.value ||
            ""
        ).trim();


    const allowAdminAccess =
        $("allowAdminAccess")
            ? Boolean(
                $("allowAdminAccess").checked
            )
            : true;


    const button =
        $("confirmMaintenanceBtn");


    if (button) {

        button.disabled = true;

        button.textContent =
            "Saving...";
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

                        enabled:
                            enabled,

                        message:
                            message,

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
                "Maintenance settings could not be saved."
            );
        }


        const maintenance =
            data.maintenance ||
            {};


        state.maintenanceEnabled =
            Boolean(
                maintenance.enabled
            );


        state.maintenanceMessage =
            maintenance.message ||
            message;


        state.allowAdminAccess =
            maintenance.allow_admin_access !== false;


        if ($("maintenanceToggle")) {

            $("maintenanceToggle").checked =
                state.maintenanceEnabled;
        }


        if ($("maintenanceMessage")) {

            $("maintenanceMessage").value =
                state.maintenanceMessage;
        }


        if ($("allowAdminAccess")) {

            $("allowAdminAccess").checked =
                state.allowAdminAccess;
        }


        updateMaintenanceDisplay();
        updateMessageCount();


        closeMaintenanceConfirmation(
            false
        );


        showMessage(
            data.message ||
            "Maintenance settings saved successfully.",
            "success"
        );


    } catch (error) {

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
                "Confirm";
        }
    }
}


/* =========================================================
   AUDIT MODAL
========================================================= */

function openAuditDetails(id) {

    const record =
        state.auditRecords.find(
            item =>
                String(item.id) ===
                String(id)
        );


    if (!record) {
        return;
    }


    const details =
        $("auditDetails");

    if (!details) {
        return;
    }


    const extraDetails =
        record.details &&
        typeof record.details === "object"
            ? Object.entries(
                record.details
            )
            : [];


    let extraHtml = "";


    if (extraDetails.length) {

        extraHtml = `
            <div class="audit-extra-details">

                ${extraDetails
                    .map(
                        ([key, value]) => `
                            <div>
                                <span>
                                    ${escapeHtml(
                                        formatLabel(
                                            key
                                        )
                                    )}
                                </span>

                                <strong>
                                    ${escapeHtml(
                                        formatValue(
                                            value
                                        )
                                    )}
                                </strong>
                            </div>
                        `
                    )
                    .join("")}

            </div>
        `;
    }


    details.innerHTML = `

        <div class="audit-detail-grid">

            <div>
                <span>User</span>
                <strong>
                    ${escapeHtml(
                        record.user
                    )}
                </strong>
            </div>

            <div>
                <span>Action</span>
                <strong>
                    ${escapeHtml(
                        formatLabel(
                            record.action
                        )
                    )}
                </strong>
            </div>

            <div>
                <span>Event</span>
                <strong>
                    ${escapeHtml(
                        formatLabel(
                            record.event
                        )
                    )}
                </strong>
            </div>

            <div>
                <span>Status</span>
                <strong>
                    ${escapeHtml(
                        formatLabel(
                            record.status
                        )
                    )}
                </strong>
            </div>

            <div>
                <span>IP Address</span>
                <strong>
                    ${escapeHtml(
                        record.ip
                    )}
                </strong>
            </div>

            <div>
                <span>Date & Time</span>
                <strong>
                    ${escapeHtml(
                        formatDate(
                            record.date
                        )
                    )}
                </strong>
            </div>

            <div>
                <span>Audit ID</span>
                <strong>
                    ${escapeHtml(
                        record.id ||
                        "—"
                    )}
                </strong>
            </div>

        </div>

        ${extraHtml}
    `;


    const modal =
        $("auditModal");

    if (modal) {

        modal.classList.add(
            "active"
        );
    }
}


function closeAuditModal() {

    const modal =
        $("auditModal");

    if (modal) {

        modal.classList.remove(
            "active"
        );
    }
}


/* =========================================================
   MESSAGE COUNTER
========================================================= */

function updateMessageCount() {

    const textarea =
        $("maintenanceMessage");

    const counter =
        $("maintenanceMessageCount");


    if (!textarea || !counter) {
        return;
    }


    counter.textContent =
        `${textarea.value.length} / 300`;
}


/* =========================================================
   HELPERS
========================================================= */

function formatNumber(value) {

    const number =
        Number(value) || 0;

    return number.toLocaleString();
}


function formatLabel(value) {

    return String(
        value || ""
    )
        .replace(/[_-]+/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .replace(
            /\b\w/g,
            char => char.toUpperCase()
        );
}


function normalizeFilterValue(value) {

    return String(
        value || ""
    )
        .trim()
        .toLowerCase()
        .replace(/[_-]+/g, " ");
}


function formatValue(value) {

    if (
        value === null ||
        value === undefined
    ) {

        return "—";
    }


    if (
        typeof value === "object"
    ) {

        try {
            return JSON.stringify(
                value
            );
        } catch (error) {
            return String(value);
        }
    }


    return String(value);
}


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
        undefined,
        {
            year: "numeric",
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit"
        }
    );
}


function statusClass(status) {

    const normalized =
        normalizeFilterValue(
            status
        );


    if (
        normalized.includes(
            "success"
        ) ||
        normalized.includes(
            "approved"
        ) ||
        normalized.includes(
            "active"
        )
    ) {

        return "status-success";
    }


    if (
        normalized.includes(
            "failed"
        ) ||
        normalized.includes(
            "rejected"
        ) ||
        normalized.includes(
            "error"
        )
    ) {

        return "status-danger";
    }


    if (
        normalized.includes(
            "pending"
        ) ||
        normalized.includes(
            "warning"
        )
    ) {

        return "status-warning";
    }


    return "status-info";
}


function escapeHtml(value) {

    return String(
        value ?? ""
    )
        .replace(
            /&/g,
            "&amp;"
        )
        .replace(
            /</g,
            "&lt;"
        )
        .replace(
            />/g,
            "&gt;"
        )
        .replace(
            /"/g,
            "&quot;"
        )
        .replace(
            /'/g,
            "&#039;"
        );
}


function escapeAttribute(value) {

    return escapeHtml(
        value
    );
}


/* =========================================================
   EVENT LISTENERS
========================================================= */

function setupEvents() {

    /*
     * Refresh
     */

    $("refreshSecurityBtn")
        ?.addEventListener(
            "click",
            async () => {

                showLoader(
                    "Refreshing security information..."
                );

                await initializeSecurityPage();
            }
        );


    /*
     * Audit Search
     */

    $("auditSearch")
        ?.addEventListener(
            "input",
            renderAuditRecords
        );


    /*
     * Audit Filters
     */

    $("auditTypeFilter")
        ?.addEventListener(
            "change",
            renderAuditRecords
        );


    $("auditStatusFilter")
        ?.addEventListener(
            "change",
            renderAuditRecords
        );


    /*
     * Audit View Buttons
     */

    document.addEventListener(
        "click",
        event => {

            const button =
                event.target.closest(
                    "[data-audit-id]"
                );


            if (!button) {
                return;
            }


            openAuditDetails(
                button.dataset.auditId
            );
        }
    );


    /*
     * Audit Pagination
     */

    $("auditPagination")
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


                const page =
                    Number(
                        button.dataset.page
                    );


                if (
                    !Number.isInteger(page)
                ) {
                    return;
                }


                state.currentPage =
                    page;


                renderAuditTable();
                renderAuditMobile();
                renderAuditPagination();

                window.scrollTo({
                    top: 0,
                    behavior: "smooth"
                });
            }
        );


    /*
     * Maintenance Toggle
     */

    $("maintenanceToggle")
        ?.addEventListener(
            "change",
            event => {

                openMaintenanceConfirmation(
                    Boolean(
                        event.target.checked
                    )
                );
            }
        );


    /*
     * Save Maintenance
     */

    $("saveMaintenanceBtn")
        ?.addEventListener(
            "click",
            () => {

                const enabled =
                    Boolean(
                        $("maintenanceToggle")
                            ?.checked
                    );

                openMaintenanceConfirmation(
                    enabled
                );
            }
        );


    /*
     * Confirm Maintenance
     */

    $("confirmMaintenanceBtn")
        ?.addEventListener(
            "click",
            saveMaintenanceSettings
        );


    /*
     * Cancel Maintenance
     */

    $("cancelMaintenanceBtn")
        ?.addEventListener(
            "click",
            () => {

                closeMaintenanceConfirmation(
                    true
                );
            }
        );


    /*
     * Close Maintenance Overlay
     */

    $("closeMaintenanceConfirmOverlay")
        ?.addEventListener(
            "click",
            () => {

                closeMaintenanceConfirmation(
                    true
                );
            }
        );


    /*
     * Maintenance Message Counter
     */

    $("maintenanceMessage")
        ?.addEventListener(
            "input",
            updateMessageCount
        );


    /*
     * Close Audit Modal
     */

    $("closeAuditModal")
        ?.addEventListener(
            "click",
            closeAuditModal
        );


    $("closeAuditModalOverlay")
        ?.addEventListener(
            "click",
            closeAuditModal
        );


    $("closeAuditDetailsBtn")
        ?.addEventListener(
            "click",
            closeAuditModal
        );


    /*
     * Escape Key
     */

    document.addEventListener(
        "keydown",
        event => {

            if (
                event.key !==
                "Escape"
            ) {
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
   INITIALIZE
========================================================= */

async function initializeSecurityPage() {

    showLoader(
        "Verifying administrator access..."
    );


    const verified =
        await verifyAdministrator();


    if (!verified) {
        return;
    }


    const loaded =
        await loadSecurityData();


    if (!loaded) {
        return;
    }
}


/* =========================================================
   START
========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    () => {

        setupEvents();

        /*
         * Give the page a moment to finish
         * rendering before starting the
         * administrator request.
         */

        setTimeout(
            initializeSecurityPage,
            50
        );
    }
);


/* =========================================================
   GLOBAL DEBUG HELPERS
========================================================= */

window.CrownCashAdminSecurity = {

    refresh: initializeSecurityPage,

    loadSecurity:
        loadSecurityData,

    verifyAdministrator,

    getState: () => ({
        ...state
    })
};