/* =========================================================
CROWN CASH - ADMIN WITHDRAWALS JS
========================================================= */

const API_URL = "https://crown-cash1.onrender.com";

let withdrawals = [];
let currentFilter = "all";
let selectedWithdrawal = null;
let selectedAction = null;

/* =========================================================
DOM ELEMENTS
========================================================= */

const tableBody = document.getElementById("withdrawalsTableBody");
const mobileWithdrawals = document.getElementById("mobileWithdrawals");

const loadingState = document.getElementById("loadingState");
const errorState = document.getElementById("errorState");
const emptyState = document.getElementById("emptyState");
const tableWrapper = document.getElementById("tableWrapper");

const errorText = document.getElementById("errorText");
const message = document.getElementById("message");

const pendingCount = document.getElementById("pendingCount");
const approvedCount = document.getElementById("approvedCount");
const paidCount = document.getElementById("paidCount");
const rejectedCount = document.getElementById("rejectedCount");
const totalCount = document.getElementById("totalCount");

const refreshBtn = document.getElementById("refreshBtn");
const retryBtn = document.getElementById("retryBtn");

const filterButtons = document.querySelectorAll(".filter-btn");

const actionModal = document.getElementById("actionModal");
const modalClose = document.getElementById("modalClose");
const cancelAction = document.getElementById("cancelAction");
const confirmAction = document.getElementById("confirmAction");

const modalIcon = document.getElementById("modalIcon");
const modalTitle = document.getElementById("modalTitle");
const modalText = document.getElementById("modalText");

const modalUser = document.getElementById("modalUser");
const modalAmount = document.getElementById("modalAmount");
const modalMethod = document.getElementById("modalMethod");
const modalAccount = document.getElementById("modalAccount");

const modalWarningText = document.getElementById("modalWarningText");

const menuBtn = document.getElementById("menuBtn");
const closeSidebar = document.getElementById("closeSidebar");
const sidebar = document.getElementById("sidebar");
const sidebarOverlay = document.getElementById("sidebarOverlay");

const logoutBtn = document.getElementById("logoutBtn");
const currentYear = document.getElementById("currentYear");

/* =========================================================
INITIALIZATION
========================================================= */

document.addEventListener("DOMContentLoaded", () => {

if (currentYear) {
    currentYear.textContent = new Date().getFullYear();
}

loadWithdrawals();

});

/* =========================================================
HELPERS
========================================================= */

function escapeHTML(value) {

if (value === null || value === undefined) {
    return "";
}

return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

}

function getValue(...values) {

for (const value of values) {

    if (
        value !== undefined &&
        value !== null &&
        String(value).trim() !== ""
    ) {
        return value;
    }
}

return "";

}

function getWithdrawalId(item) {

return getValue(
    item.withdrawal_id,
    item.id,
    item._id
);

}

function getUserName(item) {

return getValue(
    item.user_name,
    item.name,
    item.full_name,
    item.username,
    "Unknown User"
);

}

function getUserEmail(item) {

return getValue(
    item.user_email,
    item.email,
    ""
);

}

function getAmount(item) {

const value = getValue(
    item.amount,
    item.withdrawal_amount,
    item.value,
    0
);

if (typeof value === "object" && value !== null) {

    if (value.$numberDecimal !== undefined) {
        return Number(value.$numberDecimal);
    }

    if (value.$numberLong !== undefined) {
        return Number(value.$numberLong);
    }
}

const number = Number(value);

return Number.isFinite(number) ? number : 0;

}

function formatMoney(amount) {

return "UGX " + Number(amount || 0).toLocaleString("en-UG");

}

function normalizeStatus(status) {

const value = String(status || "pending")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");

if (value === "complete") {
    return "paid";
}

if (value === "completed") {
    return "paid";
}

if (value === "success") {
    return "paid";
}

return value;

}

function formatStatus(status) {

const normalized = normalizeStatus(status);

switch (normalized) {

    case "pending":
        return "Pending";

    case "approved":
        return "Approved";

    case "paid":
        return "Paid";

    case "rejected":
        return "Rejected";

    case "approval_error":
        return "Approval Error";

    default:
        return normalized
            .replace(/_/g, " ")
            .replace(/\b\w/g, char => char.toUpperCase());
}

}

function statusIcon(status) {

const normalized = normalizeStatus(status);

switch (normalized) {

    case "pending":
        return "fa-clock";

    case "approved":
        return "fa-circle-check";

    case "paid":
        return "fa-money-bill-wave";

    case "rejected":
        return "fa-circle-xmark";

    case "approval_error":
        return "fa-triangle-exclamation";

    default:
        return "fa-circle-question";
}

}

function getMethod(item) {

return String(
    getValue(
        item.payment_method,
        item.method,
        ""
    )
).toLowerCase();

}

function formatMethod(method) {

const value = String(method || "").toLowerCase();

if (value.includes("mtn")) {
    return "MTN Mobile Money";
}

if (value.includes("airtel")) {
    return "Airtel Money";
}

return value
    ? value.charAt(0).toUpperCase() + value.slice(1)
    : "—";

}

function methodIcon(method) {

const value = String(method || "").toLowerCase();

if (value.includes("mtn")) {
    return "fa-mobile-screen-button";
}

if (value.includes("airtel")) {
    return "fa-mobile-screen-button";
}

return "fa-wallet";

}

function getAccount(item) {

return getValue(
    item.account,
    item.phone_number,
    item.phone,
    item.mobile_number,
    item.account_number,
    "—"
);

}

function formatDate(value) {

if (!value) {
    return "—";
}

let dateValue = value;

if (typeof value === "object" && value !== null) {

    if (value.$date !== undefined) {
        dateValue = value.$date;
    }
}

const date = new Date(dateValue);

if (Number.isNaN(date.getTime())) {
    return "—";
}

return date.toLocaleString("en-UG", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
});

}

function getDate(item) {

return getValue(
    item.created_at,
    item.createdAt,
    item.date,
    item.requested_at,
    item.created,
    ""
);

}

function getInitials(name) {

const text = String(name || "User").trim();

if (!text) {
    return "U";
}

const parts = text.split(/\s+/);

if (parts.length === 1) {
    return parts[0].substring(0, 2).toUpperCase();
}

return (
    parts[0].charAt(0) +
    parts[parts.length - 1].charAt(0)
).toUpperCase();

}

/* =========================================================
LOAD WITHDRAWALS
========================================================= */

async function loadWithdrawals() {

showLoading();
hideMessage();

try {

    const response = await fetch(
        `${API_URL}/admin-withdrawals.php?status=all`,
        {
            method: "GET",
            credentials: "include",
            headers: {
                "Accept": "application/json"
            }
        }
    );

    const rawText = await response.text();

    let data;

    try {
        data = JSON.parse(rawText);
    } catch (error) {

        throw new Error(
            "The server returned an invalid response."
        );
    }


    if (response.status === 401) {

        throw new Error(
            "Your admin session has expired. Please log in again."
        );
    }


    if (response.status === 403) {

        throw new Error(
            "Access denied. This account does not have administrator permission."
        );
    }


    if (!response.ok || data.success === false) {

        throw new Error(
            data.message ||
            data.error ||
            "Unable to load withdrawal requests."
        );
    }


    withdrawals = Array.isArray(data.withdrawals)
        ? data.withdrawals
        : [];


    updateStatistics(data);

    renderWithdrawals();

    hideLoading();


} catch (error) {

    console.error("Admin withdrawals error:", error);

    showError(
        error.message ||
        "Unable to load withdrawal requests."
    );
}

}

/* =========================================================
STATISTICS
========================================================= */

function updateStatistics(data) {

const counts = data.counts || {};

const pending = getValue(
    counts.pending,
    data.pending,
    0
);

const approved = getValue(
    counts.approved,
    data.approved,
    0
);

const paid = getValue(
    counts.paid,
    data.paid,
    0
);

const rejected = getValue(
    counts.rejected,
    data.rejected,
    0
);

const total = getValue(
    counts.total,
    data.total,
    withdrawals.length
);


pendingCount.textContent = Number(pending) || 0;
approvedCount.textContent = Number(approved) || 0;
paidCount.textContent = Number(paid) || 0;
rejectedCount.textContent = Number(rejected) || 0;
totalCount.textContent = Number(total) || 0;

}

/* =========================================================
FILTER
========================================================= */

filterButtons.forEach(button => {

button.addEventListener("click", () => {

    filterButtons.forEach(btn => {
        btn.classList.remove("active");
    });

    button.classList.add("active");

    currentFilter = button.dataset.status || "all";

    renderWithdrawals();
});

});

function getFilteredWithdrawals() {

if (currentFilter === "all") {
    return withdrawals;
}

return withdrawals.filter(item => {

    const status = normalizeStatus(
        item.status
    );

    return status === currentFilter;
});

}

/* =========================================================
RENDER
========================================================= */

function renderWithdrawals() {

const filtered = getFilteredWithdrawals();

tableBody.innerHTML = "";
mobileWithdrawals.innerHTML = "";


if (!filtered.length) {

    tableWrapper.style.display = "none";
    mobileWithdrawals.style.display = "";

    loadingState.style.display = "none";
    errorState.style.display = "none";
    emptyState.style.display = "block";

    return;
}


emptyState.style.display = "none";
errorState.style.display = "none";
loadingState.style.display = "none";


filtered.forEach(item => {

    tableBody.insertAdjacentHTML(
        "beforeend",
        createTableRow(item)
    );

    mobileWithdrawals.insertAdjacentHTML(
        "beforeend",
        createMobileCard(item)
    );
});


if (window.innerWidth <= 700) {

    tableWrapper.style.display = "none";
    mobileWithdrawals.style.display = "block";

} else {

    tableWrapper.style.display = "block";
    mobileWithdrawals.style.display = "none";
}

}

/* =========================================================
TABLE ROW
========================================================= */

function createTableRow(item) {

const id = getWithdrawalId(item);

const name = getUserName(item);
const email = getUserEmail(item);

const amount = getAmount(item);

const method = getMethod(item);
const account = getAccount(item);

const status = normalizeStatus(item.status);

const date = formatDate(getDate(item));

const initials = getInitials(name);


let actions = `
    <span class="status-badge ${escapeHTML(status)}">
        <i class="fa-solid ${statusIcon(status)}"></i>
        ${escapeHTML(formatStatus(status))}
    </span>
`;


if (status === "pending") {

    actions = `
        <div class="action-buttons">

            <button
                class="action-btn approve"
                title="Approve withdrawal"
                data-action="approve"
                data-id="${escapeHTML(id)}"
            >
                <i class="fa-solid fa-check"></i>
            </button>

            <button
                class="action-btn reject"
                title="Reject withdrawal"
                data-action="reject"
                data-id="${escapeHTML(id)}"
            >
                <i class="fa-solid fa-xmark"></i>
            </button>

        </div>
    `;
}


return `
    <tr>

        <td>
            <div class="user-cell">

                <div class="user-avatar">
                    ${escapeHTML(initials)}
                </div>

                <div class="user-details">

                    <strong>
                        ${escapeHTML(name)}
                    </strong>

                    <span>
                        ${escapeHTML(email || "No email")}
                    </span>

                </div>

            </div>
        </td>


        <td class="amount-cell">
            ${escapeHTML(formatMoney(amount))}
        </td>


        <td>

            <div class="method-cell">

                <div class="method-icon ${escapeHTML(method)}">
                    <i class="fa-solid ${methodIcon(method)}"></i>
                </div>

                <span>
                    ${escapeHTML(formatMethod(method))}
                </span>

            </div>

        </td>


        <td class="account-cell">
            ${escapeHTML(account)}
        </td>


        <td>

            <span class="status-badge ${escapeHTML(status)}">
                <i class="fa-solid ${statusIcon(status)}"></i>
                ${escapeHTML(formatStatus(status))}
            </span>

        </td>


        <td>
            ${escapeHTML(date)}
        </td>


        <td>
            ${actions}
        </td>

    </tr>
`;

}

/* =========================================================
MOBILE CARD
========================================================= */

function createMobileCard(item) {

const id = getWithdrawalId(item);

const name = getUserName(item);
const email = getUserEmail(item);

const amount = getAmount(item);

const method = getMethod(item);
const account = getAccount(item);

const status = normalizeStatus(item.status);

const date = formatDate(getDate(item));

const initials = getInitials(name);


let actionHTML = "";


if (status === "pending") {

    actionHTML = `
        <div class="mobile-card-actions">

            <button
                class="mobile-approve"
                data-action="approve"
                data-id="${escapeHTML(id)}"
            >
                <i class="fa-solid fa-check"></i>
                Approve
            </button>

            <button
                class="mobile-reject"
                data-action="reject"
                data-id="${escapeHTML(id)}"
            >
                <i class="fa-solid fa-xmark"></i>
                Reject
            </button>

        </div>
    `;
}


return `
    <div class="withdrawal-card">

        <div class="withdrawal-card-header">

            <div class="withdrawal-card-user">

                <div class="user-avatar">
                    ${escapeHTML(initials)}
                </div>

                <div>
                    <strong>
                        ${escapeHTML(name)}
                    </strong>

                    <span>
                        ${escapeHTML(email || "No email")}
                    </span>
                </div>

            </div>


            <span class="status-badge ${escapeHTML(status)}">
                <i class="fa-solid ${statusIcon(status)}"></i>
                ${escapeHTML(formatStatus(status))}
            </span>

        </div>


        <div class="withdrawal-card-amount">
            ${escapeHTML(formatMoney(amount))}
        </div>


        <div class="withdrawal-card-grid">

            <div class="withdrawal-detail">

                <span>Payment Method</span>

                <strong>
                    ${escapeHTML(formatMethod(method))}
                </strong>

            </div>


            <div class="withdrawal-detail">

                <span>Account</span>

                <strong>
                    ${escapeHTML(account)}
                </strong>

            </div>


            <div class="withdrawal-detail">

                <span>Requested</span>

                <strong>
                    ${escapeHTML(date)}
                </strong>

            </div>


            <div class="withdrawal-detail">

                <span>Reference</span>

                <strong>
                    ${escapeHTML(
                        getValue(
                            item.reference,
                            item.withdrawal_reference,
                            "—"
                        )
                    )}
                </strong>

            </div>

        </div>


        ${actionHTML}

    </div>
`;

}

/* =========================================================
ACTION BUTTON EVENTS
========================================================= */

document.addEventListener("click", event => {

const button = event.target.closest(
    "[data-action][data-id]"
);

if (!button) {
    return;
}

const action = button.dataset.action;
const id = button.dataset.id;

openActionModal(id, action);

});

/* =========================================================
OPEN MODAL
========================================================= */

function openActionModal(id, action) {

selectedWithdrawal = withdrawals.find(item => {

    return String(getWithdrawalId(item)) === String(id);

});


if (!selectedWithdrawal) {

    showMessage(
        "The selected withdrawal could not be found.",
        "error"
    );

    return;
}


selectedAction = action;


const name = getUserName(selectedWithdrawal);

const amount = getAmount(selectedWithdrawal);

const method = getMethod(selectedWithdrawal);

const account = getAccount(selectedWithdrawal);


modalUser.textContent = name;
modalAmount.textContent = formatMoney(amount);
modalMethod.textContent = formatMethod(method);
modalAccount.textContent = account;


if (action === "approve") {

    modalIcon.innerHTML =
        '<i class="fa-solid fa-circle-check"></i>';

    modalTitle.textContent =
        "Approve Withdrawal";

    modalText.textContent =
        "Are you sure you want to approve this withdrawal request?";


    modalWarningText.textContent =
        "Confirm that the request is valid and that the required balance and security checks have been completed. Approval places the request into the payout queue; it does not send Mobile Money automatically.";

    confirmAction.innerHTML =
        '<i class="fa-solid fa-check"></i> Approve';

    confirmAction.classList.remove("danger");

} else {

    modalIcon.innerHTML =
        '<i class="fa-solid fa-circle-xmark"></i>';

    modalTitle.textContent =
        "Reject Withdrawal";

    modalText.textContent =
        "Are you sure you want to reject this withdrawal request?";


    modalWarningText.textContent =
        "Only reject a request when there is a valid reason. The withdrawal will remain rejected and will not enter the payout queue.";

    confirmAction.innerHTML =
        '<i class="fa-solid fa-xmark"></i> Reject';

    confirmAction.classList.add("danger");
}


actionModal.classList.add("show");

document.body.style.overflow = "hidden";

}

/* =========================================================
CLOSE MODAL
========================================================= */

function closeActionModal() {

actionModal.classList.remove("show");

document.body.style.overflow = "";

selectedWithdrawal = null;
selectedAction = null;

}

modalClose.addEventListener(
"click",
closeActionModal
);

cancelAction.addEventListener(
"click",
closeActionModal
);

actionModal.addEventListener("click", event => {

if (event.target === actionModal) {
    closeActionModal();
}

});

document.addEventListener("keydown", event => {

if (event.key === "Escape") {
    closeActionModal();
}

});

/* =========================================================
CONFIRM ACTION
========================================================= */

confirmAction.addEventListener("click", async () => {

if (!selectedWithdrawal || !selectedAction) {
    return;
}


const withdrawalId =
    getWithdrawalId(selectedWithdrawal);

const action = selectedAction;


confirmAction.disabled = true;

confirmAction.innerHTML =
    '<i class="fa-solid fa-spinner fa-spin"></i> Processing...';


try {

    const response = await fetch(
        `${API_URL}/admin-withdrawals.php`,
        {
            method: "POST",

            credentials: "include",

            headers: {
                "Content-Type": "application/json",
                "Accept": "application/json"
            },

            body: JSON.stringify({
                withdrawal_id: withdrawalId,
                action: action
            })
        }
    );


    const rawText = await response.text();

    let data;

    try {
        data = JSON.parse(rawText);
    } catch (error) {

        throw new Error(
            "The server returned an invalid response."
        );
    }


    if (response.status === 401) {

        throw new Error(
            "Your admin session has expired. Please log in again."
        );
    }


    if (response.status === 403) {

        throw new Error(
            "Access denied. Administrator permission is required."
        );
    }


    if (!response.ok || data.success === false) {

        throw new Error(
            data.message ||
            data.error ||
            "The withdrawal action could not be completed."
        );
    }


    closeActionModal();


    showMessage(
        data.message ||
        (
            action === "approve"
                ? "Withdrawal approved and placed in the payout queue."
                : "Withdrawal rejected successfully."
        ),
        "success"
    );


    await loadWithdrawals();


} catch (error) {

    console.error(
        "Withdrawal action error:",
        error
    );


    showMessage(
        error.message ||
        "Unable to process the withdrawal.",
        "error"
    );


} finally {

    confirmAction.disabled = false;

    if (selectedAction === "reject") {

        confirmAction.innerHTML =
            '<i class="fa-solid fa-xmark"></i> Reject';

    } else {

        confirmAction.innerHTML =
            '<i class="fa-solid fa-check"></i> Approve';
    }
}

});

/* =========================================================
MESSAGE
========================================================= */

function showMessage(text, type = "success") {

if (!message) {
    return;
}

message.textContent = text;

message.className = "message " + type;

message.scrollIntoView({
    behavior: "smooth",
    block: "nearest"
});

}

function hideMessage() {

if (!message) {
    return;
}

message.textContent = "";

message.className = "message";

}

/* =========================================================
LOADING
========================================================= */

function showLoading() {

loadingState.style.display = "block";

errorState.style.display = "none";
emptyState.style.display = "none";

tableWrapper.style.display = "none";
mobileWithdrawals.style.display = "none";

}

function hideLoading() {

loadingState.style.display = "none";

}

function showError(text) {

loadingState.style.display = "none";

emptyState.style.display = "none";

tableWrapper.style.display = "none";
mobileWithdrawals.style.display = "none";

errorState.style.display = "block";

errorText.textContent = text;

}

/* =========================================================
REFRESH
========================================================= */

refreshBtn.addEventListener("click", async () => {

const icon = refreshBtn.querySelector("i");

if (icon) {
    icon.classList.add("fa-spin");
}

await loadWithdrawals();

if (icon) {
    icon.classList.remove("fa-spin");
}

});

retryBtn.addEventListener(
"click",
loadWithdrawals
);

/* =========================================================
RESPONSIVE VIEW
========================================================= */

window.addEventListener("resize", () => {

if (!getFilteredWithdrawals().length) {
    return;
}

if (window.innerWidth <= 700) {

    tableWrapper.style.display = "none";
    mobileWithdrawals.style.display = "block";

} else {

    tableWrapper.style.display = "block";
    mobileWithdrawals.style.display = "none";
}

});

/* =========================================================
MOBILE SIDEBAR
========================================================= */

function openSidebar() {

sidebar.classList.add("open");

sidebarOverlay.classList.add("show");

document.body.style.overflow = "hidden";

}

function closeSidebarMenu() {

sidebar.classList.remove("open");

sidebarOverlay.classList.remove("show");

document.body.style.overflow = "";

}

if (menuBtn) {

menuBtn.addEventListener(
    "click",
    openSidebar
);

}

if (closeSidebar) {

closeSidebar.addEventListener(
    "click",
    closeSidebarMenu
);

}

if (sidebarOverlay) {

sidebarOverlay.addEventListener(
    "click",
    closeSidebarMenu
);

}

/* =========================================================
LOGOUT
========================================================= */

if (logoutBtn) {

logoutBtn.addEventListener(
    "click",
    async () => {

        logoutBtn.disabled = true;

        logoutBtn.innerHTML =
            '<i class="fa-solid fa-spinner fa-spin"></i> Logging out...';


        try {

            await fetch(
                `${API_URL}/logout.php`,
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

            localStorage.removeItem("crownCashUser");
            localStorage.removeItem("user");
            localStorage.removeItem("loggedIn");

            window.location.href =
                "login.html";
        }
    }
);

}