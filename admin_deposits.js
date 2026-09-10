/* =========================================================
   CROWN CASH — ADMIN DEPOSITS
   Deposit management and approval controls
   ========================================================= */

const API_BASE = "https://crown-cash1.onrender.com";

/* =========================================================
   DOM ELEMENTS
   ========================================================= */

const sidebar = document.getElementById("sidebar");
const sidebarOverlay = document.getElementById("sidebarOverlay");
const menuBtn = document.getElementById("menuBtn");
const logoutBtn = document.getElementById("logoutBtn");

const adminName = document.getElementById("adminName");

const pendingCount = document.getElementById("pendingCount");
const pendingAmount = document.getElementById("pendingAmount");
const approvedCount = document.getElementById("approvedCount");
const rejectedCount = document.getElementById("rejectedCount");

const searchInput = document.getElementById("searchInput");
const statusFilter = document.getElementById("statusFilter");
const methodFilter = document.getElementById("methodFilter");
const refreshBtn = document.getElementById("refreshBtn");

const recordCount = document.getElementById("recordCount");
const depositTableBody = document.getElementById("depositTableBody");

const actionModal = document.getElementById("actionModal");
const modalBackdrop = document.getElementById("modalBackdrop");
const modalClose = document.getElementById("modalClose");
const modalIcon = document.getElementById("modalIcon");
const modalTitle = document.getElementById("modalTitle");
const modalMessage = document.getElementById("modalMessage");
const modalCancel = document.getElementById("modalCancel");
const modalConfirm = document.getElementById("modalConfirm");

const loadingOverlay = document.getElementById("loadingOverlay");
const loadingText = document.getElementById("loadingText");

const currentYear = document.getElementById("currentYear");

/* =========================================================
   STATE
   ========================================================= */

let deposits = [];
let filteredDeposits = [];

let selectedDepositId = null;
let selectedAction = null;

/* =========================================================
   START
   ========================================================= */

document.addEventListener("DOMContentLoaded", () => {
    setupMenu();
    setupFilters();
    setupRefresh();
    setupModal();
    setupLogout();
    setupYear();

    loadAdmin();
    loadDeposits();
});

/* =========================================================
   ADMIN INFORMATION
   ========================================================= */

function loadAdmin() {
    try {
        const savedUser = localStorage.getItem("crowncash_user");

        if (!savedUser) {
            redirectToLogin();
            return;
        }

        const user = JSON.parse(savedUser);

        const firstName = user.firstName || "";
        const lastName = user.lastName || "";

        const fullName = `${firstName} ${lastName}`.trim();

        if (adminName) {
            adminName.textContent = fullName || "Administrator";
        }
    } catch (error) {
        console.error("Unable to load admin information:", error);
    }
}

/* =========================================================
   LOAD DEPOSITS
   ========================================================= */

async function loadDeposits() {
    setLoading(true, "Loading deposits...");

    try {
        const response = await fetch(
            `${API_BASE}/admin_deposits.php`,
            {
                method: "GET",
                credentials: "include",
                headers: {
                    "Accept": "application/json"
                }
            }
        );

        const result = await parseJsonResponse(response);

        if (!response.ok || !result.success) {
            throw new Error(
                result.message || "Unable to load deposits."
            );
        }

        deposits = Array.isArray(result.deposits)
            ? result.deposits
            : [];

        applyFilters();

    } catch (error) {
        console.error("Load deposits error:", error);

        deposits = [];
        filteredDeposits = [];

        updateStats();
        renderDeposits();

        showTableMessage(
            error.message ||
            "Unable to load deposits. Please try again."
        );

    } finally {
        setLoading(false);
    }
}

/* =========================================================
   FILTERS
   ========================================================= */

function setupFilters() {

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
}

function applyFilters() {

    const search = (
        searchInput?.value || ""
    )
        .trim()
        .toLowerCase();

    const status = (
        statusFilter?.value || "all"
    )
        .trim()
        .toLowerCase();

    const method = (
        methodFilter?.value || "all"
    )
        .trim()
        .toLowerCase();

    filteredDeposits = deposits.filter((deposit) => {

        const reference = String(
            deposit.reference || ""
        ).toLowerCase();

        const userName = String(
            deposit.user_name || deposit.userName || ""
        ).toLowerCase();

        const userEmail = String(
            deposit.user_email || deposit.userEmail || ""
        ).toLowerCase();

        const phone = String(
            deposit.phone || ""
        ).toLowerCase();

        const account = String(
            deposit.account || deposit.phone || ""
        ).toLowerCase();

        const depositStatus = String(
            deposit.status ||
            deposit.payment_status ||
            ""
        ).toLowerCase();

        const depositMethod = String(
            deposit.payment_method ||
            deposit.method ||
            ""
        ).toLowerCase();

        const matchesSearch =
            search === "" ||
            reference.includes(search) ||
            userName.includes(search) ||
            userEmail.includes(search) ||
            phone.includes(search) ||
            account.includes(search);

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
    });

    updateStats();
    renderDeposits();
}

/* =========================================================
   STATISTICS
   ========================================================= */

function updateStats() {

    let pending = 0;
    let pendingTotal = 0;

    let approved = 0;
    let rejected = 0;

    deposits.forEach((deposit) => {

        const status = String(
            deposit.status ||
            deposit.payment_status ||
            ""
        ).toLowerCase();

        const amount = Number(
            deposit.amount || 0
        );

        if (status === "pending") {
            pending++;
            pendingTotal += amount;
        }

        if (
            status === "approved" ||
            status === "completed" ||
            status === "verified"
        ) {
            approved++;
        }

        if (status === "rejected") {
            rejected++;
        }
    });

    if (pendingCount) {
        pendingCount.textContent =
            formatNumber(pending);
    }

    if (pendingAmount) {
        pendingAmount.textContent =
            `UGX ${formatNumber(pendingTotal)}`;
    }

    if (approvedCount) {
        approvedCount.textContent =
            formatNumber(approved);
    }

    if (rejectedCount) {
        rejectedCount.textContent =
            formatNumber(rejected);
    }
}

/* =========================================================
   RENDER TABLE
   ========================================================= */

function renderDeposits() {

    if (!depositTableBody) {
        return;
    }

    depositTableBody.innerHTML = "";

    if (recordCount) {
        recordCount.textContent =
            `${filteredDeposits.length} record${
                filteredDeposits.length === 1 ? "" : "s"
            }`;
    }

    if (filteredDeposits.length === 0) {
        showEmptyState();
        return;
    }

    filteredDeposits.forEach((deposit) => {

        const row = document.createElement("tr");

        const reference =
            escapeHtml(
                deposit.reference || "—"
            );

        const userName =
            escapeHtml(
                deposit.user_name ||
                deposit.userName ||
                "Unknown User"
            );

        const userEmail =
            escapeHtml(
                deposit.user_email ||
                deposit.userEmail ||
                ""
            );

        const amount =
            Number(deposit.amount || 0);

        const method =
            String(
                deposit.payment_method ||
                deposit.method ||
                "—"
            ).toUpperCase();

        const account =
            escapeHtml(
                deposit.phone ||
                deposit.account ||
                "—"
            );

        const status =
            normalizeStatus(
                deposit.status ||
                deposit.payment_status ||
                "pending"
            );

        const date =
            formatDate(
                deposit.created_at ||
                deposit.createdAt ||
                deposit.date
            );

        const initials =
            getInitials(
                deposit.user_name ||
                deposit.userName ||
                "U"
            );

        row.innerHTML = `
            <td>
                <span class="reference">
                    ${reference}
                </span>
            </td>

            <td>
                <div class="user-cell">

                    <div class="user-avatar">
                        ${escapeHtml(initials)}
                    </div>

                    <div class="user-details">
                        <strong>
                            ${userName}
                        </strong>

                        <span>
                            ${userEmail}
                        </span>
                    </div>

                </div>
            </td>

            <td>
                <span class="amount">
                    UGX ${formatNumber(amount)}
                </span>
            </td>

            <td>
                <span class="method">

                    <span class="method-dot ${
                        method === "AIRTEL"
                            ? "airtel"
                            : ""
                    }"></span>

                    ${escapeHtml(method)}

                </span>
            </td>

            <td>
                <span class="account">
                    ${account}
                </span>
            </td>

            <td>
                <span class="date">
                    ${escapeHtml(date)}
                </span>
            </td>

            <td>
                ${renderStatus(status)}
            </td>

            <td>
                ${renderActions(deposit, status)}
            </td>
        `;

        depositTableBody.appendChild(row);
    });
}

/* =========================================================
   STATUS
   ========================================================= */

function normalizeStatus(status) {

    const value =
        String(status || "")
            .trim()
            .toLowerCase();

    if (
        value === "approved" ||
        value === "completed" ||
        value === "verified"
    ) {
        return "approved";
    }

    if (value === "rejected") {
        return "rejected";
    }

    return "pending";
}

function renderStatus(status) {

    const normalized =
        normalizeStatus(status);

    const label =
        normalized.charAt(0).toUpperCase() +
        normalized.slice(1);

    return `
        <span class="status ${normalized}">
            ${label}
        </span>
    `;
}

/* =========================================================
   ACTION BUTTONS
   ========================================================= */

function renderActions(deposit, status) {

    if (status !== "pending") {
        return `
            <span class="action-completed">
                Completed
            </span>
        `;
    }

    const id =
        escapeHtml(
            deposit.id ||
            deposit._id ||
            deposit.reference ||
            ""
        );

    return `
        <div class="action-buttons">

            <button
                type="button"
                class="action-btn approve"
                data-action="approve"
                data-id="${id}"
            >
                <svg
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                >
                    <path
                        d="M5 12.5 9.5 17 19 7"
                    />
                </svg>

                Approve
            </button>

            <button
                type="button"
                class="action-btn reject"
                data-action="reject"
                data-id="${id}"
            >
                <svg
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                >
                    <path d="m7 7 10 10" />
                    <path d="m17 7-10 10" />
                </svg>

                Reject
            </button>

        </div>
    `;
}

/* =========================================================
   TABLE CLICK HANDLER
   ========================================================= */

if (depositTableBody) {

    depositTableBody.addEventListener(
        "click",
        (event) => {

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

            if (!id) {
                return;
            }

            openActionModal(
                id,
                action
            );
        }
    );
}

/* =========================================================
   ACTION MODAL
   ========================================================= */

function setupModal() {

    if (modalBackdrop) {
        modalBackdrop.addEventListener(
            "click",
            closeModal
        );
    }

    if (modalClose) {
        modalClose.addEventListener(
            "click",
            closeModal
        );
    }

    if (modalCancel) {
        modalCancel.addEventListener(
            "click",
            closeModal
        );
    }

    if (modalConfirm) {
        modalConfirm.addEventListener(
            "click",
            confirmAction
        );
    }

    document.addEventListener(
        "keydown",
        (event) => {

            if (
                event.key === "Escape" &&
                actionModal?.classList.contains("show")
            ) {
                closeModal();
            }
        }
    );
}

function openActionModal(
    depositId,
    action
) {

    selectedDepositId = depositId;
    selectedAction = action;

    const deposit =
        deposits.find((item) => {

            const id = String(
                item.id ||
                item._id ||
                item.reference ||
                ""
            );

            return id === String(depositId);
        });

    if (!deposit) {
        return;
    }

    const amount =
        Number(deposit.amount || 0);

    const reference =
        deposit.reference || "this deposit";

    if (modalTitle) {
        modalTitle.textContent =
            action === "approve"
                ? "Approve Deposit?"
                : "Reject Deposit?";
    }

    if (modalMessage) {

        if (action === "approve") {

            modalMessage.textContent =
                `You are about to approve deposit ` +
                `${reference} for UGX ` +
                `${formatNumber(amount)}. ` +
                `Only approve after independently ` +
                `verifying that the payment was received.`;

        } else {

            modalMessage.textContent =
                `You are about to reject deposit ` +
                `${reference} for UGX ` +
                `${formatNumber(amount)}. ` +
                `The user's balance will not be credited.`;
        }
    }

    if (modalConfirm) {

        modalConfirm.textContent =
            action === "approve"
                ? "Approve Deposit"
                : "Reject Deposit";

        modalConfirm.classList.toggle(
            "reject",
            action === "reject"
        );
    }

    if (modalIcon) {

        modalIcon.innerHTML =
            action === "approve"
                ? `
                    <svg
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                    >
                        <path d="M5 12.5 9.5 17 19 7" />
                    </svg>
                `
                : `
                    <svg
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                    >
                        <path d="m7 7 10 10" />
                        <path d="m17 7-10 10" />
                    </svg>
                `;
    }

    if (actionModal) {
        actionModal.classList.add("show");
    }
}

function closeModal() {

    selectedDepositId = null;
    selectedAction = null;

    if (actionModal) {
        actionModal.classList.remove("show");
    }
}

/* =========================================================
   CONFIRM ADMIN ACTION
   ========================================================= */

async function confirmAction() {

    if (
        !selectedDepositId ||
        !selectedAction
    ) {
        return;
    }

    const depositId =
        selectedDepositId;

    const action =
        selectedAction;

    closeModal();

    setLoading(
        true,
        action === "approve"
            ? "Approving deposit..."
            : "Rejecting deposit..."
    );

    try {

        const response = await fetch(
            `${API_BASE}/admin_deposits.php`,
            {
                method: "POST",
                credentials: "include",

                headers: {
                    "Content-Type":
                        "application/json",

                    "Accept":
                        "application/json"
                },

                body: JSON.stringify({
                    depositId,
                    action
                })
            }
        );

        const result =
            await parseJsonResponse(response);

        if (
            !response.ok ||
            !result.success
        ) {
            throw new Error(
                result.message ||
                `Unable to ${action} deposit.`
            );
        }

        alert(
            result.message ||
            (
                action === "approve"
                    ? "Deposit approved successfully."
                    : "Deposit rejected successfully."
            )
        );

        await loadDeposits();

    } catch (error) {

        console.error(
            "Deposit action error:",
            error
        );

        alert(
            error.message ||
            "The deposit action could not be completed."
        );

    } finally {
        setLoading(false);
    }
}

/* =========================================================
   REFRESH
   ========================================================= */

function setupRefresh() {

    if (!refreshBtn) {
        return;
    }

    refreshBtn.addEventListener(
        "click",
        async () => {

            refreshBtn.classList.add(
                "loading"
            );

            try {
                await loadDeposits();
            } finally {
                refreshBtn.classList.remove(
                    "loading"
                );
            }
        }
    );
}

/* =========================================================
   MOBILE MENU
   ========================================================= */

function setupMenu() {

    if (menuBtn) {

        menuBtn.addEventListener(
            "click",
            () => {

                sidebar?.classList.toggle(
                    "open"
                );

                sidebarOverlay?.classList.toggle(
                    "show"
                );
            }
        );
    }

    if (sidebarOverlay) {

        sidebarOverlay.addEventListener(
            "click",
            closeMobileMenu
        );
    }

    if (sidebar) {

        sidebar.querySelectorAll(
            "a"
        ).forEach((link) => {

            link.addEventListener(
                "click",
                closeMobileMenu
            );
        });
    }
}

function closeMobileMenu() {

    sidebar?.classList.remove(
        "open"
    );

    sidebarOverlay?.classList.remove(
        "show"
    );
}

/* =========================================================
   LOGOUT
   ========================================================= */

function setupLogout() {

    if (!logoutBtn) {
        return;
    }

    logoutBtn.addEventListener(
        "click",
        async (event) => {

            event.preventDefault();

            const confirmed =
                window.confirm(
                    "Are you sure you want to log out?"
                );

            if (!confirmed) {
                return;
            }

            try {

                await fetch(
                    `${API_BASE}/logout.php`,
                    {
                        method: "POST",
                        credentials: "include"
                    }
                );

            } catch (error) {

                console.warn(
                    "Logout request failed:",
                    error
                );

            } finally {

                localStorage.removeItem(
                    "crowncash_user"
                );

                window.location.href =
                    "login.html";
            }
        }
    );
}

/* =========================================================
   YEAR
   ========================================================= */

function setupYear() {

    if (currentYear) {
        currentYear.textContent =
            new Date().getFullYear();
    }
}

/* =========================================================
   LOADING
   ========================================================= */

function setLoading(
    visible,
    message = "Loading..."
) {

    if (loadingText) {
        loadingText.textContent =
            message;
    }

    if (loadingOverlay) {

        loadingOverlay.classList.toggle(
            "show",
            visible
        );
    }
}

/* =========================================================
   EMPTY STATE
   ========================================================= */

function showEmptyState() {

    if (!depositTableBody) {
        return;
    }

    depositTableBody.innerHTML = `
        <tr>
            <td colspan="8">

                <div class="empty-state">

                    <div class="empty-icon">

                        <svg
                            viewBox="0 0 24 24"
                            aria-hidden="true"
                        >
                            <rect
                                x="3"
                                y="5"
                                width="18"
                                height="14"
                                rx="2"
                            />

                            <path d="M7 10h10" />
                            <path d="M7 14h6" />
                        </svg>

                    </div>

                    <h3>
                        No deposits found
                    </h3>

                    <p>
                        There are no deposits matching
                        your current search or filters.
                    </p>

                </div>

            </td>
        </tr>
    `;
}

function showTableMessage(message) {

    if (!depositTableBody) {
        return;
    }

    depositTableBody.innerHTML = `
        <tr>
            <td colspan="8">

                <div class="empty-state">

                    <div class="empty-icon">

                        <svg
                            viewBox="0 0 24 24"
                            aria-hidden="true"
                        >
                            <circle
                                cx="12"
                                cy="12"
                                r="9"
                            />

                            <path d="M12 8v5" />
                            <path d="M12 16h.01" />
                        </svg>

                    </div>

                    <h3>
                        Unable to load deposits
                    </h3>

                    <p>
                        ${escapeHtml(message)}
                    </p>

                </div>

            </td>
        </tr>
    `;
}

/* =========================================================
   JSON RESPONSE
   ========================================================= */

async function parseJsonResponse(response) {

    const text =
        await response.text();

    if (!text) {
        throw new Error(
            "The server returned an empty response."
        );
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
   FORMATTING
   ========================================================= */

function formatNumber(value) {

    const number =
        Number(value || 0);

    return number.toLocaleString(
        "en-UG",
        {
            maximumFractionDigits: 0
        }
    );
}

function formatDate(value) {

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
            return "—";
        }

        return date.toLocaleString(
            "en-UG",
            {
                day: "2-digit",
                month: "short",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit"
            }
        );

    } catch (error) {

        return "—";
    }
}

function getInitials(name) {

    const parts =
        String(name || "U")
            .trim()
            .split(/\s+/)
            .filter(Boolean);

    if (parts.length === 0) {
        return "U";
    }

    if (parts.length === 1) {
        return parts[0]
            .substring(0, 2)
            .toUpperCase();
    }

    return (
        parts[0][0] +
        parts[parts.length - 1][0]
    ).toUpperCase();
}

/* =========================================================
   SECURITY HELPERS
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
   LOGIN REDIRECT
   ========================================================= */

function redirectToLogin() {

    localStorage.removeItem(
        "crowncash_user"
    );

    window.location.href =
        "login.html";
}