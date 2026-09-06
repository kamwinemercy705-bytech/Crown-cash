/* =========================================================
   CROWN CASH — ADMIN WITHDRAWALS
   ========================================================= */

const API_BASE = "https://crown-cash1.onrender.com";

let allWithdrawals = [];
let filteredWithdrawals = [];

let selectedWithdrawal = null;
let selectedAction = null;


/* =========================================================
   ELEMENTS
   ========================================================= */

const sidebar = document.getElementById("sidebar");
const sidebarOverlay = document.getElementById("sidebarOverlay");
const menuButton = document.getElementById("menuButton");

const tableBody = document.getElementById("withdrawalTableBody");
const emptyState = document.getElementById("emptyState");

const pendingCount = document.getElementById("pendingCount");
const pendingAmount = document.getElementById("pendingAmount");
const approvedCount = document.getElementById("approvedCount");
const rejectedCount = document.getElementById("rejectedCount");

const sidebarPendingBadge =
    document.getElementById("sidebarPendingBadge");

const requestCount =
    document.getElementById("requestCount");

const searchInput =
    document.getElementById("searchInput");

const statusFilter =
    document.getElementById("statusFilter");

const methodFilter =
    document.getElementById("methodFilter");

const refreshButton =
    document.getElementById("refreshButton");

const pageMessage =
    document.getElementById("pageMessage");

const adminName =
    document.getElementById("adminName");

const currentYear =
    document.getElementById("currentYear");

const logoutButton =
    document.getElementById("logoutButton");


/* MODAL */

const confirmationModal =
    document.getElementById("confirmationModal");

const modalClose =
    document.getElementById("modalClose");

const modalCancel =
    document.getElementById("modalCancel");

const modalConfirm =
    document.getElementById("modalConfirm");

const modalTitle =
    document.getElementById("modalTitle");

const modalMessage =
    document.getElementById("modalMessage");

const modalDetails =
    document.getElementById("modalDetails");

const modalIcon =
    document.getElementById("modalIcon");


/* LOADING */

const loadingOverlay =
    document.getElementById("loadingOverlay");


/* =========================================================
   START
   ========================================================= */

document.addEventListener("DOMContentLoaded", () => {

    setYear();

    setupSidebar();

    setupFilters();

    setupModal();

    setupLogout();

    loadAdminInformation();

    loadWithdrawals();

});


/* =========================================================
   YEAR
   ========================================================= */

function setYear() {

    if (currentYear) {
        currentYear.textContent =
            new Date().getFullYear();
    }

}


/* =========================================================
   ADMIN INFORMATION
   ========================================================= */

function loadAdminInformation() {

    try {

        const savedUser =
            localStorage.getItem("crowncash_user");

        if (!savedUser) {
            return;
        }

        const user =
            JSON.parse(savedUser);

        const name =
            [
                user.firstName || "",
                user.lastName || ""
            ]
                .join(" ")
                .trim();

        if (name && adminName) {
            adminName.textContent = name;
        }

    } catch (error) {

        console.error(
            "Unable to load admin information:",
            error
        );

    }

}


/* =========================================================
   SIDEBAR
   ========================================================= */

function setupSidebar() {

    if (menuButton) {

        menuButton.addEventListener(
            "click",
            () => {

                sidebar.classList.add("open");

                sidebarOverlay.classList.add("show");

            }
        );

    }


    if (sidebarOverlay) {

        sidebarOverlay.addEventListener(
            "click",
            closeSidebar
        );

    }


    document
        .querySelectorAll(".sidebar .nav-item")
        .forEach(link => {

            link.addEventListener(
                "click",
                closeSidebar
            );

        });

}


function closeSidebar() {

    if (sidebar) {
        sidebar.classList.remove("open");
    }

    if (sidebarOverlay) {
        sidebarOverlay.classList.remove("show");
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


    if (refreshButton) {

        refreshButton.addEventListener(
            "click",
            loadWithdrawals
        );

    }

}


/* =========================================================
   LOAD WITHDRAWALS
   ========================================================= */

async function loadWithdrawals() {

    showMessage("", "");

    setLoading(true);

    try {

        const response =
            await fetch(
                `${API_BASE}/admin_withdrawals.php`,
                {
                    method: "GET",
                    credentials: "include",
                    headers: {
                        "Accept":
                            "application/json"
                    }
                }
            );


        const result =
            await parseJsonResponse(response);


        if (!response.ok || !result.success) {

            throw new Error(
                result.message ||
                "Unable to load withdrawal requests."
            );

        }


        allWithdrawals =
            Array.isArray(result.withdrawals)
                ? result.withdrawals
                : [];


        updateStatistics();

        applyFilters();

    } catch (error) {

        console.error(
            "LOAD WITHDRAWALS ERROR:",
            error
        );


        allWithdrawals = [];

        updateStatistics();

        renderWithdrawals();


        showMessage(
            error.message ||
            "Unable to load withdrawal requests.",
            "error"
        );

    } finally {

        setLoading(false);

    }

}


/* =========================================================
   APPLY FILTERS
   ========================================================= */

function applyFilters() {

    const search =
        (
            searchInput?.value ||
            ""
        )
            .trim()
            .toLowerCase();


    const selectedStatus =
        (
            statusFilter?.value ||
            "all"
        )
            .toLowerCase();


    const selectedMethod =
        (
            methodFilter?.value ||
            "all"
        )
            .toUpperCase();


    filteredWithdrawals =
        allWithdrawals.filter(
            withdrawal => {

                const status =
                    String(
                        withdrawal.status ||
                        ""
                    )
                        .toLowerCase();


                const method =
                    String(
                        withdrawal.method ||
                        ""
                    )
                        .toUpperCase();


                const reference =
                    String(
                        withdrawal.reference ||
                        ""
                    )
                        .toLowerCase();


                const account =
                    String(
                        withdrawal.account ||
                        ""
                    )
                        .toLowerCase();


                const userName =
                    String(
                        withdrawal.user_name ||
                        withdrawal.name ||
                        ""
                    )
                        .toLowerCase();


                const userEmail =
                    String(
                        withdrawal.user_email ||
                        withdrawal.email ||
                        ""
                    )
                        .toLowerCase();


                const matchesSearch =
                    !search ||
                    reference.includes(search) ||
                    account.includes(search) ||
                    userName.includes(search) ||
                    userEmail.includes(search);


                const matchesStatus =
                    selectedStatus === "all" ||
                    status === selectedStatus;


                const matchesMethod =
                    selectedMethod === "all" ||
                    method === selectedMethod;


                return (
                    matchesSearch &&
                    matchesStatus &&
                    matchesMethod
                );

            }
        );


    renderWithdrawals();

}


/* =========================================================
   STATISTICS
   ========================================================= */

function updateStatistics() {

    let pending = 0;
    let approved = 0;
    let rejected = 0;

    let pendingTotal = 0;


    allWithdrawals.forEach(
        withdrawal => {

            const status =
                String(
                    withdrawal.status || ""
                )
                    .toLowerCase();


            const amount =
                Number(
                    withdrawal.amount || 0
                );


            if (status === "pending") {

                pending++;

                pendingTotal += amount;

            }


            if (status === "approved") {
                approved++;
            }


            if (status === "rejected") {
                rejected++;
            }

        }
    );


    if (pendingCount) {
        pendingCount.textContent =
            pending;
    }


    if (pendingAmount) {

        pendingAmount.textContent =
            formatUGX(
                pendingTotal
            );

    }


    if (approvedCount) {
        approvedCount.textContent =
            approved;
    }


    if (rejectedCount) {
        rejectedCount.textContent =
            rejected;
    }


    if (sidebarPendingBadge) {
        sidebarPendingBadge.textContent =
            pending;
    }

}


/* =========================================================
   RENDER TABLE
   ========================================================= */

function renderWithdrawals() {

    if (!tableBody) {
        return;
    }


    tableBody.innerHTML = "";


    if (
        !filteredWithdrawals ||
        filteredWithdrawals.length === 0
    ) {

        if (emptyState) {
            emptyState.style.display =
                "block";
        }

        if (requestCount) {
            requestCount.textContent =
                "0 requests";
        }

        return;

    }


    if (emptyState) {
        emptyState.style.display =
            "none";
    }


    if (requestCount) {

        requestCount.textContent =
            `${filteredWithdrawals.length} ${
                filteredWithdrawals.length === 1
                    ? "request"
                    : "requests"
            }`;

    }


    filteredWithdrawals.forEach(
        withdrawal => {

            const row =
                createWithdrawalRow(
                    withdrawal
                );

            tableBody.appendChild(row);

        }
    );

}


/* =========================================================
   CREATE TABLE ROW
   ========================================================= */

function createWithdrawalRow(withdrawal) {

    const row =
        document.createElement("tr");


    const reference =
        escapeHtml(
            withdrawal.reference ||
            "N/A"
        );


    const userName =
        withdrawal.user_name ||
        withdrawal.name ||
        "Unknown User";


    const userEmail =
        withdrawal.user_email ||
        withdrawal.email ||
        "";


    const amount =
        Number(
            withdrawal.amount || 0
        );


    const method =
        String(
            withdrawal.method || ""
        )
            .toUpperCase();


    const account =
        withdrawal.account ||
        "N/A";


    const status =
        String(
            withdrawal.status ||
            "pending"
        )
            .toLowerCase();


    const date =
        formatDate(
            withdrawal.created_at
        );


    row.innerHTML = `

        <td>
            <span class="reference-cell">
                ${reference}
            </span>
        </td>


        <td>

            <div class="user-cell">

                <div class="user-mini-avatar">

                    <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="1.8"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                    >

                        <circle
                            cx="12"
                            cy="8"
                            r="4"
                        />

                        <path
                            d="M4 21a8 8 0 0 1 16 0"
                        />

                    </svg>

                </div>


                <div class="user-details">

                    <strong>
                        ${escapeHtml(userName)}
                    </strong>

                    <span>
                        ${escapeHtml(userEmail)}
                    </span>

                </div>

            </div>

        </td>


        <td>

            <span class="amount-cell">
                ${formatUGX(amount)}
            </span>

        </td>


        <td>

            <span class="
                method-badge
                ${
                    method === "MTN"
                        ? "method-mtn"
                        : "method-airtel"
                }
            ">

                ${
                    method === "MTN"
                        ? "MTN Mobile Money"
                        : "Airtel Money"
                }

            </span>

        </td>


        <td>
            ${escapeHtml(account)}
        </td>


        <td>
            ${escapeHtml(date)}
        </td>


        <td>

            <span class="
                status-badge
                status-${escapeHtml(status)}
            ">

                ${escapeHtml(status)}

            </span>

        </td>


        <td>

            ${createActionButtons(withdrawal)}

        </td>

    `;


    return row;

}


/* =========================================================
   ACTION BUTTONS
   ========================================================= */

function createActionButtons(withdrawal) {

    const status =
        String(
            withdrawal.status ||
            ""
        )
            .toLowerCase();


    if (status !== "pending") {

        return `
            <span style="
                color:#766d81;
                font-size:10px;
            ">
                Completed
            </span>
        `;

    }


    const encodedId =
        escapeHtml(
            withdrawal.id ||
            withdrawal._id ||
            withdrawal.reference ||
            ""
        );


    return `

        <div class="action-buttons">

            <button
                type="button"
                class="action-button approve-button"
                data-action="approve"
                data-id="${encodedId}"
            >

                <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.8"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                >

                    <path d="M5 12l4 4L19 6"/>

                </svg>

                Approve

            </button>


            <button
                type="button"
                class="action-button reject-button"
                data-action="reject"
                data-id="${encodedId}"
            >

                <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.8"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                >

                    <path d="M6 6l12 12"/>

                    <path d="M18 6L6 18"/>

                </svg>

                Reject

            </button>

        </div>

    `;

}


/* =========================================================
   TABLE ACTION LISTENER
   ========================================================= */

document.addEventListener(
    "click",
    event => {

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


        const withdrawal =
            findWithdrawalById(id);


        if (!withdrawal) {

            showMessage(
                "Withdrawal request could not be found.",
                "error"
            );

            return;

        }


        openConfirmation(
            withdrawal,
            action
        );

    }
);


/* =========================================================
   FIND WITHDRAWAL
   ========================================================= */

function findWithdrawalById(id) {

    return allWithdrawals.find(
        withdrawal => {

            const withdrawalId =
                String(
                    withdrawal.id ||
                    withdrawal._id ||
                    withdrawal.reference ||
                    ""
                );

            return withdrawalId ===
                String(id);

        }
    );

}


/* =========================================================
   MODAL SETUP
   ========================================================= */

function setupModal() {

    if (modalClose) {

        modalClose.addEventListener(
            "click",
            closeConfirmation
        );

    }


    if (modalCancel) {

        modalCancel.addEventListener(
            "click",
            closeConfirmation
        );

    }


    if (confirmationModal) {

        confirmationModal.addEventListener(
            "click",
            event => {

                if (
                    event.target ===
                    confirmationModal
                ) {

                    closeConfirmation();

                }

            }
        );

    }


    if (modalConfirm) {

        modalConfirm.addEventListener(
            "click",
            processSelectedAction
        );

    }


    document.addEventListener(
        "keydown",
        event => {

            if (
                event.key === "Escape"
            ) {

                closeConfirmation();

            }

        }
    );

}


/* =========================================================
   OPEN CONFIRMATION
   ========================================================= */

function openConfirmation(
    withdrawal,
    action
) {

    selectedWithdrawal =
        withdrawal;

    selectedAction =
        action;


    const isApprove =
        action === "approve";


    if (modalTitle) {

        modalTitle.textContent =
            isApprove
                ? "Approve Withdrawal"
                : "Reject Withdrawal";

    }


    if (modalMessage) {

        modalMessage.textContent =
            isApprove
                ? "Are you sure you want to approve this withdrawal request?"
                : "Are you sure you want to reject this withdrawal request?";

    }


    if (modalConfirm) {

        modalConfirm.textContent =
            isApprove
                ? "Approve Withdrawal"
                : "Reject Withdrawal";

    }


    if (modalIcon) {

        modalIcon.innerHTML =
            isApprove

                ? `

                    <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="1.8"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                    >

                        <circle
                            cx="12"
                            cy="12"
                            r="9"
                        />

                        <path
                            d="M8 12l3 3 5-6"
                        />

                    </svg>

                `

                : `

                    <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="1.8"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                    >

                        <circle
                            cx="12"
                            cy="12"
                            r="9"
                        />

                        <path d="M9 9l6 6"/>

                        <path d="M15 9l-6 6"/>

                    </svg>

                `;

    }


    if (modalDetails) {

        const method =
            String(
                withdrawal.method ||
                ""
            )
                .toUpperCase();


        const account =
            withdrawal.account ||
            "N/A";


        modalDetails.innerHTML = `

            <div class="modal-detail-row">

                <span>
                    Reference
                </span>

                <span>
                    ${escapeHtml(
                        withdrawal.reference ||
                        "N/A"
                    )}
                </span>

            </div>


            <div class="modal-detail-row">

                <span>
                    Amount
                </span>

                <span>
                    ${formatUGX(
                        Number(
                            withdrawal.amount ||
                            0
                        )
                    )}
                </span>

            </div>


            <div class="modal-detail-row">

                <span>
                    Method
                </span>

                <span>
                    ${
                        method === "MTN"
                            ? "MTN Mobile Money"
                            : "Airtel Money"
                    }
                </span>

            </div>


            <div class="modal-detail-row">

                <span>
                    Account
                </span>

                <span>
                    ${escapeHtml(account)}
                </span>

            </div>

        `;

    }


    if (confirmationModal) {

        confirmationModal.classList.add(
            "show"
        );

        confirmationModal.setAttribute(
            "aria-hidden",
            "false"
        );

    }

}


/* =========================================================
   CLOSE CONFIRMATION
   ========================================================= */

function closeConfirmation() {

    selectedWithdrawal = null;

    selectedAction = null;


    if (confirmationModal) {

        confirmationModal.classList.remove(
            "show"
        );

        confirmationModal.setAttribute(
            "aria-hidden",
            "true"
        );

    }

}


/* =========================================================
   PROCESS ACTION
   ========================================================= */

async function processSelectedAction() {

    if (
        !selectedWithdrawal ||
        !selectedAction
    ) {
        return;
    }


    const withdrawal =
        selectedWithdrawal;

    const action =
        selectedAction;


    closeConfirmation();

    setLoading(true);


    try {

        const response =
            await fetch(
                `${API_BASE}/admin_withdrawals.php`,
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

                        withdrawalId:
                            withdrawal.id ||
                            withdrawal._id ||
                            withdrawal.reference,

                        action:
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
                `Unable to ${action} withdrawal.`
            );

        }


        showMessage(
            result.message ||
            (
                action === "approve"
                    ? "Withdrawal approved successfully."
                    : "Withdrawal rejected successfully."
            ),
            "success"
        );


        await loadWithdrawals();

    } catch (error) {

        console.error(
            "WITHDRAWAL ACTION ERROR:",
            error
        );


        showMessage(
            error.message ||
            "Unable to process withdrawal request.",
            "error"
        );

    } finally {

        setLoading(false);

    }

}


/* =========================================================
   LOGOUT
   ========================================================= */

function setupLogout() {

    if (!logoutButton) {
        return;
    }


    logoutButton.addEventListener(
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

                await fetch(
                    `${API_BASE}/logout.php`,
                    {
                        method: "POST",
                        credentials: "include"
                    }
                );

            } catch (error) {

                console.error(
                    "Logout error:",
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
   LOADING
   ========================================================= */

function setLoading(isLoading) {

    if (!loadingOverlay) {
        return;
    }


    if (isLoading) {

        loadingOverlay.classList.add(
            "show"
        );

        loadingOverlay.setAttribute(
            "aria-hidden",
            "false"
        );

    } else {

        loadingOverlay.classList.remove(
            "show"
        );

        loadingOverlay.setAttribute(
            "aria-hidden",
            "true"
        );

    }

}


/* =========================================================
   PAGE MESSAGE
   ========================================================= */

function showMessage(
    message,
    type
) {

    if (!pageMessage) {
        return;
    }


    pageMessage.textContent =
        message || "";


    pageMessage.className =
        "page-message";


    if (
        message &&
        (
            type === "success" ||
            type === "error"
        )
    ) {

        pageMessage.classList.add(
            type
        );

    }

}


/* =========================================================
   JSON RESPONSE
   ========================================================= */

async function parseJsonResponse(
    response
) {

    const text =
        await response.text();


    if (!text) {

        return {
            success: false,
            message:
                "The server returned an empty response."
        };

    }


    try {

        return JSON.parse(text);

    } catch (error) {

        console.error(
            "Invalid JSON response:",
            text
        );


        return {
            success: false,
            message:
                "The server returned an invalid response."
        };

    }

}


/* =========================================================
   FORMAT UGX
   ========================================================= */

function formatUGX(amount) {

    const value =
        Number(amount) || 0;


    return (
        "UGX " +
        value.toLocaleString(
            "en-UG",
            {
                maximumFractionDigits: 0
            }
        )
    );

}


/* =========================================================
   FORMAT DATE
   ========================================================= */

function formatDate(value) {

    if (!value) {
        return "N/A";
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

        return "N/A";

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
   HTML ESCAPING
   ========================================================= */

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