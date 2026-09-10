const API_BASE = "https://crown-cash1.onrender.com";

let allDeposits = [];
let selectedDepositId = "";
let selectedAction = "";


/* ================================
   ELEMENTS
================================ */

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


/* ================================
   START
================================ */

document.addEventListener("DOMContentLoaded", function () {

    setupYear();
    setupMenu();
    setupFilters();
    setupModal();
    setupLogout();
    loadAdmin();
    loadDeposits();

});


/* ================================
   YEAR
================================ */

function setupYear() {

    if (currentYear) {
        currentYear.textContent =
            new Date().getFullYear();
    }

}


/* ================================
   MOBILE MENU
================================ */

function setupMenu() {

    if (!menuBtn || !sidebar) {
        return;
    }

    menuBtn.addEventListener("click", function () {

        sidebar.classList.toggle("open");

        if (sidebarOverlay) {
            sidebarOverlay.classList.toggle("show");
        }

    });


    if (sidebarOverlay) {

        sidebarOverlay.addEventListener(
            "click",
            closeMenu
        );

    }

}


function closeMenu() {

    if (sidebar) {
        sidebar.classList.remove("open");
    }

    if (sidebarOverlay) {
        sidebarOverlay.classList.remove("show");
    }

}


/* ================================
   ADMIN NAME
================================ */

function loadAdmin() {

    try {

        const stored =
            localStorage.getItem("crowncash_user");

        if (!stored) {
            return;
        }

        const user =
            JSON.parse(stored);

        const name =
            `${user.firstName || ""} ${user.lastName || ""}`
                .trim();

        if (adminName) {

            adminName.textContent =
                name || "Administrator";

        }

    } catch (error) {

        console.error(
            "Admin information error:",
            error
        );

    }

}


/* ================================
   LOAD DEPOSITS
================================ */

async function loadDeposits() {

    showLoading(
        true,
        "Connecting to Crown Cash server..."
    );

    try {

        const response = await fetch(
            `${API_BASE}/admin_deposit.php`,
            {
                method: "GET",

                credentials: "include",

                headers: {
                    "Accept":
                        "application/json"
                },

                cache: "no-store"
            }
        );


        /*
         * Read the response as text first.
         * This helps us see PHP errors instead of
         * simply showing "Failed to fetch".
         */

        const responseText =
            await response.text();


        let result;

        try {

            result =
                JSON.parse(responseText);

        } catch (jsonError) {

            console.error(
                "Server returned non-JSON:",
                responseText
            );

            throw new Error(
                `Server returned an invalid response (HTTP ${response.status}).`
            );
        }


        console.log(
            "Admin deposit API response:",
            result
        );


        if (
            response.status === 401 ||
            response.status === 403
        ) {

            alert(
                result.message ||
                "Administrator access required."
            );

            window.location.href =
                "login.html";

            return;
        }


        if (!response.ok) {

            throw new Error(
                result.message ||
                `Server error: HTTP ${response.status}`
            );
        }


        if (!result.success) {

            throw new Error(
                result.message ||
                "Unable to load deposits."
            );
        }


        allDeposits =
            Array.isArray(result.deposits)
                ? result.deposits
                : [];


        updateStats(
            result.stats || {}
        );


        renderDeposits();


    } catch (error) {

        console.error(
            "ADMIN DEPOSIT ERROR:",
            error
        );


        showTableMessage(
            error.message ||
            "Unable to connect to the server."
        );


    } finally {

        showLoading(false);

    }

}


/* ================================
   STATS
================================ */

function updateStats(stats) {

    if (pendingCount) {

        pendingCount.textContent =
            Number(
                stats.pending_count || 0
            ).toLocaleString();

    }


    if (pendingAmount) {

        pendingAmount.textContent =
            formatCurrency(
                stats.pending_amount || 0
            );

    }


    if (approvedCount) {

        approvedCount.textContent =
            Number(
                stats.approved_count || 0
            ).toLocaleString();

    }


    if (rejectedCount) {

        rejectedCount.textContent =
            Number(
                stats.rejected_count || 0
            ).toLocaleString();

    }

}


/* ================================
   FILTERS
================================ */

function setupFilters() {

    if (searchInput) {

        searchInput.addEventListener(
            "input",
            renderDeposits
        );

    }


    if (statusFilter) {

        statusFilter.addEventListener(
            "change",
            renderDeposits
        );

    }


    if (methodFilter) {

        methodFilter.addEventListener(
            "change",
            renderDeposits
        );

    }


    if (refreshBtn) {

        refreshBtn.addEventListener(
            "click",
            loadDeposits
        );

    }

}


/* ================================
   FILTER DATA
================================ */

function getFilteredDeposits() {

    const search =
        (
            searchInput?.value || ""
        )
            .trim()
            .toLowerCase();


    const selectedStatus =
        (
            statusFilter?.value || ""
        )
            .trim()
            .toLowerCase();


    const selectedMethod =
        (
            methodFilter?.value || ""
        )
            .trim()
            .toLowerCase();


    return allDeposits.filter(
        function (deposit) {

            const reference =
                String(
                    deposit.reference || ""
                ).toLowerCase();


            const userName =
                String(
                    deposit.user?.name || ""
                ).toLowerCase();


            const email =
                String(
                    deposit.user?.email || ""
                ).toLowerCase();


            const account =
                String(
                    deposit.account || ""
                ).toLowerCase();


            const method =
                String(
                    deposit.method || ""
                ).toLowerCase();


            const status =
                String(
                    deposit.status || ""
                ).toLowerCase();


            const matchesSearch =
                !search ||
                reference.includes(search) ||
                userName.includes(search) ||
                email.includes(search) ||
                account.includes(search);


            const matchesStatus =
                !selectedStatus ||
                status === selectedStatus;


            const matchesMethod =
                !selectedMethod ||
                method === selectedMethod;


            return (
                matchesSearch &&
                matchesStatus &&
                matchesMethod
            );

        }
    );

}


/* ================================
   RENDER
================================ */

function renderDeposits() {

    if (!depositTableBody) {
        return;
    }


    const deposits =
        getFilteredDeposits();


    if (recordCount) {

        recordCount.textContent =
            `${deposits.length} record${
                deposits.length === 1
                    ? ""
                    : "s"
            }`;

    }


    if (deposits.length === 0) {

        showEmptyState();

        return;
    }


    depositTableBody.innerHTML =
        deposits
            .map(createDepositRow)
            .join("");

}


/* ================================
   TABLE ROW
================================ */

function createDepositRow(deposit) {

    const status =
        String(
            deposit.status || "pending"
        ).toLowerCase();


    const method =
        String(
            deposit.method || ""
        ).toUpperCase();


    const reference =
        escapeHtml(
            deposit.reference || "—"
        );


    const userName =
        escapeHtml(
            deposit.user?.name ||
            "Unknown User"
        );


    const email =
        escapeHtml(
            deposit.user?.email || ""
        );


    const account =
        escapeHtml(
            deposit.account || "—"
        );


    const amount =
        formatCurrency(
            deposit.amount || 0
        );


    const date =
        formatDate(
            deposit.created_at
        );


    let action = "";


    if (status === "pending") {

        action = `
            <div class="action-buttons">

                <button
                    type="button"
                    class="action-btn approve-btn"
                    data-action="approve"
                    data-id="${escapeAttribute(
                        deposit.id
                    )}"
                >
                    ✓ Approve
                </button>

                <button
                    type="button"
                    class="action-btn reject-btn"
                    data-action="reject"
                    data-id="${escapeAttribute(
                        deposit.id
                    )}"
                >
                    × Reject
                </button>

            </div>
        `;

    } else {

        action = `
            <span class="processed-label">
                Processed
            </span>
        `;

    }


    return `
        <tr>

            <td>
                <strong>
                    ${reference}
                </strong>
            </td>

            <td>
                <div class="user-cell">

                    <strong>
                        ${userName}
                    </strong>

                    ${
                        email
                            ? `<small>${email}</small>`
                            : ""
                    }

                </div>
            </td>

            <td>
                <strong class="amount-cell">
                    ${amount}
                </strong>
            </td>

            <td>
                <span class="method-badge">
                    ${escapeHtml(method || "—")}
                </span>
            </td>

            <td>
                ${account}
            </td>

            <td>
                ${date}
            </td>

            <td>
                ${createStatusBadge(status)}
            </td>

            <td>
                ${action}
            </td>

        </tr>
    `;

}


/* ================================
   STATUS
================================ */

function createStatusBadge(status) {

    const cleanStatus =
        String(
            status || "pending"
        ).toLowerCase();


    const label =
        cleanStatus
            .charAt(0)
            .toUpperCase() +
        cleanStatus.slice(1);


    return `
        <span
            class="status-badge status-${escapeAttribute(
                cleanStatus
            )}"
        >
            ${escapeHtml(label)}
        </span>
    `;

}


/* ================================
   EMPTY STATE
================================ */

function showEmptyState() {

    depositTableBody.innerHTML = `
        <tr>

            <td
                colspan="8"
                class="empty-state"
            >

                <div class="empty-icon">
                    ◇
                </div>

                <h3>
                    No deposits found
                </h3>

                <p>
                    There are no deposits matching
                    your current filters.
                </p>

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

            <td
                colspan="8"
                class="empty-state"
            >

                <div class="empty-icon">
                    !
                </div>

                <h3>
                    Unable to load deposits
                </h3>

                <p>
                    ${escapeHtml(message)}
                </p>

            </td>

        </tr>
    `;

}


/* ================================
   BUTTON EVENTS
================================ */

if (depositTableBody) {

    depositTableBody.addEventListener(
        "click",
        function (event) {

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


            if (!id || !action) {
                return;
            }


            openActionModal(
                id,
                action
            );

        }
    );

}


/* ================================
   MODAL
================================ */

function setupModal() {

    if (modalBackdrop) {

        modalBackdrop.addEventListener(
            "click",
            closeActionModal
        );

    }


    if (modalClose) {

        modalClose.addEventListener(
            "click",
            closeActionModal
        );

    }


    if (modalCancel) {

        modalCancel.addEventListener(
            "click",
            closeActionModal
        );

    }


    if (modalConfirm) {

        modalConfirm.addEventListener(
            "click",
            processSelectedAction
        );

    }

}


function openActionModal(
    depositId,
    action
) {

    const deposit =
        allDeposits.find(
            function (item) {

                return String(item.id) ===
                    String(depositId);

            }
        );


    if (!deposit) {
        return;
    }


    selectedDepositId =
        depositId;

    selectedAction =
        action;


    const amount =
        formatCurrency(
            deposit.amount || 0
        );


    const reference =
        deposit.reference || "—";


    const userName =
        deposit.user?.name ||
        "Unknown User";


    if (modalIcon) {

        modalIcon.textContent =
            action === "approve"
                ? "✓"
                : "×";

    }


    if (modalTitle) {

        modalTitle.textContent =
            action === "approve"
                ? "Approve Deposit"
                : "Reject Deposit";

    }


    if (modalMessage) {

        if (action === "approve") {

            modalMessage.innerHTML = `
                You are about to approve
                deposit
                <strong>
                    ${escapeHtml(reference)}
                </strong>
                for
                <strong>
                    ${escapeHtml(userName)}
                </strong>
                in the amount of
                <strong>
                    ${escapeHtml(amount)}
                </strong>.

                <br><br>

                Only continue after independently
                verifying the MTN/Airtel payment.
            `;

        } else {

            modalMessage.innerHTML = `
                You are about to reject
                deposit
                <strong>
                    ${escapeHtml(reference)}
                </strong>
                for
                <strong>
                    ${escapeHtml(userName)}
                </strong>
                in the amount of
                <strong>
                    ${escapeHtml(amount)}
                </strong>.

                <br><br>

                The deposit will not be credited
                to the user's Crown Cash balance.
            `;

        }

    }


    if (modalConfirm) {

        modalConfirm.textContent =
            action === "approve"
                ? "Approve Deposit"
                : "Reject Deposit";

    }


    if (actionModal) {

        actionModal.classList.add("show");

    }

}


/* ================================
   CLOSE MODAL
================================ */

function closeActionModal() {

    selectedDepositId = "";
    selectedAction = "";


    if (actionModal) {

        actionModal.classList.remove(
            "show"
        );

    }

}


/* ================================
   PROCESS ACTION
================================ */

async function processSelectedAction() {

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


    if (modalConfirm) {

        modalConfirm.disabled =
            true;

        modalConfirm.textContent =
            action === "approve"
                ? "Approving..."
                : "Rejecting...";

    }


    showLoading(
        true,
        action === "approve"
            ? "Approving deposit..."
            : "Rejecting deposit..."
    );


    try {

        const response =
            await fetch(
                `${API_BASE}/admin_deposit.php`,
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

                        depositId:
                            depositId,

                        action:
                            action

                    })
                }
            );


        const responseText =
            await response.text();


        let result;

        try {

            result =
                JSON.parse(responseText);

        } catch (error) {

            console.error(
                "Invalid POST response:",
                responseText
            );

            throw new Error(
                `Server returned an invalid response (HTTP ${response.status}).`
            );

        }


        if (
            response.status === 401 ||
            response.status === 403
        ) {

            alert(
                result.message ||
                "Administrator access required."
            );

            window.location.href =
                "login.html";

            return;
        }


        if (!response.ok) {

            throw new Error(
                result.message ||
                `Server error: HTTP ${response.status}`
            );

        }


        if (!result.success) {

            throw new Error(
                result.message ||
                "Unable to process deposit."
            );

        }


        closeActionModal();


        alert(
            result.message ||
            "Deposit processed successfully."
        );


        await loadDeposits();


    } catch (error) {

        console.error(
            "Deposit processing error:",
            error
        );


        alert(
            error.message ||
            "Unable to process deposit."
        );


    } finally {

        showLoading(false);


        if (modalConfirm) {

            modalConfirm.disabled =
                false;

            modalConfirm.textContent =
                action === "approve"
                    ? "Approve Deposit"
                    : "Reject Deposit";

        }

    }

}


/* ================================
   LOGOUT
================================ */

function setupLogout() {

    if (!logoutBtn) {
        return;
    }


    logoutBtn.addEventListener(
        "click",
        async function (event) {

            event.preventDefault();


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

            }


            localStorage.removeItem(
                "crowncash_user"
            );


            window.location.href =
                "login.html";

        }
    );

}


/* ================================
   LOADING
================================ */

function showLoading(
    show,
    message = "Loading..."
) {

    if (loadingText) {

        loadingText.textContent =
            message;

    }


    if (!loadingOverlay) {
        return;
    }


    if (show) {

        loadingOverlay.classList.add(
            "show"
        );

    } else {

        loadingOverlay.classList.remove(
            "show"
        );

    }

}


/* ================================
   CURRENCY
================================ */

function formatCurrency(amount) {

    return (
        "UGX " +
        Number(amount || 0).toLocaleString(
            "en-UG",
            {
                minimumFractionDigits: 0,
                maximumFractionDigits: 0
            }
        )
    );

}


/* ================================
   DATE
================================ */

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
        return "—";
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


/* ================================
   SECURITY
================================ */

function escapeHtml(value) {

    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");

}


function escapeAttribute(value) {

    return escapeHtml(value);

}