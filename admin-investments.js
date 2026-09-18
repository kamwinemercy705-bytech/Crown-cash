/* =========================================================
CROWN CASH - ADMIN INVESTMENTS JAVASCRIPT
File: admin-investments.js
========================================================= */

"use strict";

// =========================================================
// API CONFIGURATION
// =========================================================

const API_URL = "https://crown-cash1.onrender.com";

const ADMIN_INVESTMENTS_API =
"${API_URL}/admin-investments.php";

// =========================================================
// GLOBAL VARIABLES
// =========================================================

let allInvestments = [];

let currentFilter = "all";

let selectedInvestment = null;

let selectedAction = null;

// =========================================================
// DOM READY
// =========================================================

document.addEventListener("DOMContentLoaded", () => {

initializePage();

});

// =========================================================
// INITIALIZE PAGE
// =========================================================

function initializePage() {

setCurrentYear();

setupMobileMenu();

setupFilters();

setupRefresh();

setupRetry();

setupModal();

setupLogout();

loadInvestments();

}

// =========================================================
// CURRENT YEAR
// =========================================================

function setCurrentYear() {

const yearElement =
    document.getElementById("currentYear");

if (yearElement) {

    yearElement.textContent =
        new Date().getFullYear();

}

}

// =========================================================
// MOBILE MENU
// =========================================================

function setupMobileMenu() {

const menuToggle =
    document.getElementById("menuToggle");

const sidebar =
    document.getElementById("sidebar");

if (!menuToggle || !sidebar) {
    return;
}

menuToggle.addEventListener("click", () => {

    sidebar.classList.toggle("open");

});


// Close sidebar after clicking a link
const links =
    sidebar.querySelectorAll("a");

links.forEach(link => {

    link.addEventListener("click", () => {

        sidebar.classList.remove("open");

    });

});

}

// =========================================================
// FILTER BUTTONS
// =========================================================

function setupFilters() {

const buttons =
    document.querySelectorAll(".filter-btn");

buttons.forEach(button => {

    button.addEventListener("click", () => {

        buttons.forEach(btn => {

            btn.classList.remove("active");

        });

        button.classList.add("active");

        currentFilter =
            button.dataset.status || "all";

        renderInvestments();

    });

});

}

// =========================================================
// REFRESH BUTTON
// =========================================================

function setupRefresh() {

const refreshBtn =
    document.getElementById("refreshBtn");

if (!refreshBtn) {
    return;
}

refreshBtn.addEventListener("click", () => {

    loadInvestments(true);

});

}

// =========================================================
// RETRY BUTTON
// =========================================================

function setupRetry() {

const retryBtn =
    document.getElementById("retryBtn");

if (!retryBtn) {
    return;
}

retryBtn.addEventListener("click", () => {

    loadInvestments();

});

}

// =========================================================
// LOAD INVESTMENTS
// =========================================================

async function loadInvestments(showRefreshAnimation = false) {

const loadingState =
    document.getElementById("loadingState");

const errorState =
    document.getElementById("errorState");

const emptyState =
    document.getElementById("emptyState");

const tableWrapper =
    document.getElementById("tableWrapper");

const mobileList =
    document.getElementById("mobileInvestmentList");

const refreshBtn =
    document.getElementById("refreshBtn");


if (showRefreshAnimation && refreshBtn) {

    refreshBtn.classList.add("loading");

    refreshBtn.disabled = true;

}


if (loadingState) {
    loadingState.style.display = "flex";
}

if (errorState) {
    errorState.style.display = "none";
}

if (emptyState) {
    emptyState.style.display = "none";
}

if (tableWrapper) {
    tableWrapper.style.display = "none";
}

if (mobileList) {
    mobileList.style.display = "none";
}


try {

    const response =
        await fetch(
            ADMIN_INVESTMENTS_API,
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


    let result;

    try {

        result =
            await response.json();

    } catch (jsonError) {

        throw new Error(
            "The server returned an invalid response."
        );

    }


    // -------------------------------------------------
    // Authentication error
    // -------------------------------------------------

    if (response.status === 401) {

        showError(
            "Your admin session has expired. Please log in again."
        );

        return;
    }


    // -------------------------------------------------
    // Permission error
    // -------------------------------------------------

    if (response.status === 403) {

        showError(
            result.message ||
            "Administrator access is required."
        );

        return;
    }


    // -------------------------------------------------
    // Other server errors
    // -------------------------------------------------

    if (!response.ok || result.success !== true) {

        throw new Error(
            result.message ||
            "Unable to load investments."
        );

    }


    // -------------------------------------------------
    // Store data
    // -------------------------------------------------

    allInvestments =
        Array.isArray(result.investments)
            ? result.investments
            : [];


    // -------------------------------------------------
    // Update counts
    // -------------------------------------------------

    updateCounts(
        result.counts || {}
    );


    // -------------------------------------------------
    // Render
    // -------------------------------------------------

    renderInvestments();


} catch (error) {

    console.error(
        "Admin investments error:",
        error
    );

    showError(
        error.message ||
        "Unable to connect to the investment server."
    );


} finally {

    if (loadingState) {
        loadingState.style.display = "none";
    }

    if (refreshBtn) {

        refreshBtn.classList.remove("loading");

        refreshBtn.disabled = false;

    }

}

}

// =========================================================
// UPDATE STATISTICS
// =========================================================

function updateCounts(counts) {

setText(
    "pendingCount",
    formatNumber(
        counts.pending || 0
    )
);

setText(
    "activeCount",
    formatNumber(
        counts.active || 0
    )
);

setText(
    "completedCount",
    formatNumber(
        counts.completed || 0
    )
);

setText(
    "rejectedCount",
    formatNumber(
        counts.rejected || 0
    )
);

}

// =========================================================
// FILTER INVESTMENTS
// =========================================================

function getFilteredInvestments() {

if (currentFilter === "all") {

    return allInvestments;

}

return allInvestments.filter(
    investment => {

        const status =
            normalizeStatus(
                investment.status
            );

        return status === currentFilter;

    }
);

}

// =========================================================
// RENDER INVESTMENTS
// =========================================================

function renderInvestments() {

const investments =
    getFilteredInvestments();


setText(
    "recordCount",
    formatNumber(
        investments.length
    )
);


const loadingState =
    document.getElementById("loadingState");

const errorState =
    document.getElementById("errorState");

const emptyState =
    document.getElementById("emptyState");

const tableWrapper =
    document.getElementById("tableWrapper");

const mobileList =
    document.getElementById("mobileInvestmentList");


if (loadingState) {
    loadingState.style.display = "none";
}

if (errorState) {
    errorState.style.display = "none";
}


// -------------------------------------------------
// Empty state
// -------------------------------------------------

if (investments.length === 0) {

    if (emptyState) {
        emptyState.style.display = "flex";
    }

    if (tableWrapper) {
        tableWrapper.style.display = "none";
    }

    if (mobileList) {
        mobileList.style.display = "none";
    }

    return;

}


// -------------------------------------------------
// Desktop table
// -------------------------------------------------

if (tableWrapper) {

    tableWrapper.style.display = "block";

}


const tableBody =
    document.getElementById(
        "investmentTableBody"
    );


if (tableBody) {

    tableBody.innerHTML =
        investments
            .map(
                investment =>
                    createTableRow(
                        investment
                    )
            )
            .join("");

}


// -------------------------------------------------
// Mobile cards
// -------------------------------------------------

if (mobileList) {

    mobileList.style.display = "block";

    mobileList.innerHTML =
        investments
            .map(
                investment =>
                    createMobileCard(
                        investment
                    )
            )
            .join("");

}


attachActionButtons();

}

// =========================================================
// CREATE DESKTOP TABLE ROW
// =========================================================

function createTableRow(investment) {

const id =
    escapeHTML(
        investment.id || ""
    );

const name =
    escapeHTML(
        getUserName(investment)
    );

const phone =
    escapeHTML(
        getUserPhone(investment)
    );

const email =
    escapeHTML(
        getUserEmail(investment)
    );

const plan =
    getPlanName(investment);

const amount =
    getAmount(investment);

const duration =
    Number(
        investment.duration_days || 30
    );

const status =
    normalizeStatus(
        investment.status
    );

const reference =
    escapeHTML(
        investment.reference || "—"
    );

const date =
    formatDate(
        investment.created_at
    );


const initials =
    getInitials(name);


const planIcon =
    getPlanIcon(plan);


const canProcess =
    status === "pending";


return `

    <tr>

        <td>

            <div class="user-cell">

                <div class="user-avatar">
                    ${initials}
                </div>

                <div>

                    <span class="user-name">
                        ${name}
                    </span>

                    <span class="user-phone">
                        ${phone || email || "—"}
                    </span>

                </div>

            </div>

        </td>


        <td>

            <div class="plan-cell">

                <div class="plan-icon">
                    <i class="${planIcon}"></i>
                </div>

                <div>

                    <span class="plan-name">
                        ${escapeHTML(plan)}
                    </span>

                    <span class="plan-duration">
                        ${duration} days
                    </span>

                </div>

            </div>

        </td>


        <td>

            <div class="amount-cell">

                <span class="amount-currency">
                    UGX
                </span>

                ${formatMoney(amount)}

            </div>

        </td>


        <td>
            ${duration} days
        </td>


        <td>

            <span class="status-pill ${status}">

                <i class="${getStatusIcon(status)}"></i>

                ${escapeHTML(status)}

            </span>

        </td>


        <td>

            <span class="reference">
                ${reference}
            </span>

        </td>


        <td>

            <span class="date-cell">
                ${date}
            </span>

        </td>


        <td>

            ${canProcess
                ? createActionButtons(id)
                : `
                    <span class="date-cell">
                        No action
                    </span>
                  `
            }

        </td>

    </tr>

`;

}

// =========================================================
// CREATE MOBILE CARD
// =========================================================

function createMobileCard(investment) {

const id =
    escapeHTML(
        investment.id || ""
    );

const name =
    escapeHTML(
        getUserName(investment)
    );

const phone =
    escapeHTML(
        getUserPhone(investment)
    );

const email =
    escapeHTML(
        getUserEmail(investment)
    );

const plan =
    getPlanName(investment);

const amount =
    getAmount(investment);

const duration =
    Number(
        investment.duration_days || 30
    );

const status =
    normalizeStatus(
        investment.status
    );

const reference =
    escapeHTML(
        investment.reference || "—"
    );

const date =
    formatDate(
        investment.created_at
    );


const initials =
    getInitials(name);


const canProcess =
    status === "pending";


return `

    <div class="mobile-investment">

        <div class="mobile-investment-header">

            <div class="mobile-user">

                <div class="mobile-user-avatar">
                    ${initials}
                </div>

                <div>

                    <div class="mobile-user-name">
                        ${name}
                    </div>

                    <div class="mobile-user-phone">
                        ${phone || email || "—"}
                    </div>

                </div>

            </div>


            <span class="status-pill ${status}">

                <i class="${getStatusIcon(status)}"></i>

                ${escapeHTML(status)}

            </span>

        </div>


        <div class="mobile-details">

            <div class="mobile-detail">

                <label>Plan</label>

                <strong>
                    ${escapeHTML(plan)}
                </strong>

            </div>


            <div class="mobile-detail">

                <label>Amount</label>

                <strong>
                    UGX ${formatMoney(amount)}
                </strong>

            </div>


            <div class="mobile-detail">

                <label>Duration</label>

                <span>
                    ${duration} days
                </span>

            </div>


            <div class="mobile-detail">

                <label>Date</label>

                <span>
                    ${date}
                </span>

            </div>


            <div class="mobile-detail">

                <label>Reference</label>

                <span>
                    ${reference}
                </span>

            </div>

        </div>


        ${
            canProcess
            ? `
                <div class="mobile-actions">

                    ${createActionButtons(id)}

                </div>
              `
            : ""
        }

    </div>

`;

}

// =========================================================
// ACTION BUTTONS
// =========================================================

function createActionButtons(id) {

return `

    <button
        type="button"
        class="action-btn approve-btn"
        data-action="approve"
        data-id="${id}"
    >
        <i class="fa-solid fa-check"></i>
        Approve
    </button>


    <button
        type="button"
        class="action-btn reject-btn"
        data-action="reject"
        data-id="${id}"
    >
        <i class="fa-solid fa-xmark"></i>
        Reject
    </button>

`;

}

// =========================================================
// ATTACH APPROVE / REJECT BUTTONS
// =========================================================

function attachActionButtons() {

const buttons =
    document.querySelectorAll(
        ".action-btn[data-action]"
    );


buttons.forEach(button => {

    button.addEventListener(
        "click",
        () => {

            const id =
                button.dataset.id;

            const action =
                button.dataset.action;

            const investment =
                allInvestments.find(
                    item =>
                        String(item.id) ===
                        String(id)
                );


            if (!investment) {

                showMessage(
                    "Investment record could not be found.",
                    "error"
                );

                return;
            }


            openConfirmation(
                investment,
                action
            );

        }
    );

});

}

// =========================================================
// MODAL SETUP
// =========================================================

function setupModal() {

const modal =
    document.getElementById("confirmModal");

const close =
    document.getElementById("modalClose");

const cancel =
    document.getElementById("modalCancel");

const confirm =
    document.getElementById("modalConfirm");


if (close) {

    close.addEventListener(
        "click",
        closeModal
    );

}


if (cancel) {

    cancel.addEventListener(
        "click",
        closeModal
    );

}


if (confirm) {

    confirm.addEventListener(
        "click",
        processSelectedInvestment
    );

}


if (modal) {

    modal.addEventListener(
        "click",
        event => {

            if (
                event.target === modal
            ) {

                closeModal();

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

            closeModal();

        }

    }
);

}

// =========================================================
// OPEN CONFIRMATION MODAL
// =========================================================

function openConfirmation(
investment,
action
) {

selectedInvestment =
    investment;

selectedAction =
    action;


const modal =
    document.getElementById(
        "confirmModal"
    );

const title =
    document.getElementById(
        "modalTitle"
    );

const text =
    document.getElementById(
        "modalText"
    );

const details =
    document.getElementById(
        "modalDetails"
    );

const icon =
    document.getElementById(
        "modalIcon"
    );

const confirm =
    document.getElementById(
        "modalConfirm"
    );


const name =
    getUserName(investment);

const plan =
    getPlanName(investment);

const amount =
    getAmount(investment);

const reference =
    investment.reference || "—";


if (action === "approve") {

    if (title) {
        title.textContent =
            "Approve Investment?";
    }

    if (text) {

        text.textContent =
            "Confirm that this investment has been properly verified before activating it.";

    }

    if (icon) {

        icon.innerHTML =
            '<i class="fa-solid fa-circle-check"></i>';

    }

    if (confirm) {

        confirm.textContent =
            "Approve Investment";

        confirm.classList.remove(
            "danger"
        );

    }

} else {

    if (title) {
        title.textContent =
            "Reject Investment?";
    }

    if (text) {

        text.textContent =
            "This will mark the investment request as rejected.";

    }

    if (icon) {

        icon.innerHTML =
            '<i class="fa-solid fa-circle-xmark"></i>';

    }

    if (confirm) {

        confirm.textContent =
            "Reject Investment";

        confirm.classList.add(
            "danger"
        );

    }

}


if (details) {

    details.innerHTML = `

        <strong>
            ${escapeHTML(name)}
        </strong>

        <br>

        Plan:
        ${escapeHTML(plan)}

        <br>

        Amount:
        UGX ${formatMoney(amount)}

        <br>

        Reference:
        ${escapeHTML(reference)}

    `;

}


if (modal) {

    modal.style.display = "flex";

}

}

// =========================================================
// CLOSE MODAL
// =========================================================

function closeModal() {

const modal =
    document.getElementById(
        "confirmModal"
    );

if (modal) {

    modal.style.display = "none";

}

selectedInvestment = null;

selectedAction = null;

}

// =========================================================
// PROCESS SELECTED INVESTMENT
// =========================================================

async function processSelectedInvestment() {

if (
    !selectedInvestment ||
    !selectedAction
) {
    return;
}


const investment =
    selectedInvestment;

const action =
    selectedAction;


const confirmButton =
    document.getElementById(
        "modalConfirm"
    );


if (confirmButton) {

    confirmButton.disabled = true;

    confirmButton.innerHTML = `
        <i class="fa-solid fa-spinner fa-spin"></i>
        Processing...
    `;

}


try {

    const response =
        await fetch(
            ADMIN_INVESTMENTS_API,
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

                    investment_id:
                        investment.id,

                    action:
                        action

                })

            }
        );


    let result;

    try {

        result =
            await response.json();

    } catch (jsonError) {

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
            result.message ||
            "Administrator access is required."
        );

    }


    if (
        !response.ok ||
        result.success !== true
    ) {

        throw new Error(
            result.message ||
            "The investment could not be processed."
        );

    }


    // -------------------------------------------------
    // Success
    // -------------------------------------------------

    closeModal();


    showMessage(
        result.message ||
        (
            action === "approve"
                ? "Investment approved successfully."
                : "Investment rejected successfully."
        ),
        "success"
    );


    // Reload latest investment records
    await loadInvestments();


} catch (error) {

    console.error(
        "Investment action error:",
        error
    );


    showMessage(
        error.message ||
        "Unable to process investment.",
        "error"
    );


} finally {

    if (confirmButton) {

        confirmButton.disabled = false;

        confirmButton.textContent =
            action === "approve"
                ? "Approve Investment"
                : "Reject Investment";

    }

}

}

// =========================================================
// LOGOUT
// =========================================================

function setupLogout() {

const logoutBtn =
    document.getElementById(
        "logoutBtn"
    );

if (!logoutBtn) {
    return;
}


logoutBtn.addEventListener(
    "click",
    async () => {

        logoutBtn.disabled = true;


        try {

            await fetch(
                `${API_URL}/logout.php`,
                {
                    method: "POST",

                    credentials: "include",

                    headers: {
                        "Accept":
                            "application/json"
                    }
                }
            );

        } catch (error) {

            console.warn(
                "Logout request failed:",
                error
            );

        }


        try {

            localStorage.removeItem(
                "crowncash_user"
            );

            localStorage.removeItem(
                "user"
            );

            localStorage.removeItem(
                "token"
            );

        } catch (error) {
            // Ignore localStorage errors
        }


        window.location.href =
            "/login.html";

    }
);

}

// =========================================================
// ERROR STATE
// =========================================================

function showError(message) {

const loadingState =
    document.getElementById(
        "loadingState"
    );

const errorState =
    document.getElementById(
        "errorState"
    );

const tableWrapper =
    document.getElementById(
        "tableWrapper"
    );

const mobileList =
    document.getElementById(
        "mobileInvestmentList"
    );

const errorMessage =
    document.getElementById(
        "errorMessage"
    );


if (loadingState) {
    loadingState.style.display = "none";
}

if (tableWrapper) {
    tableWrapper.style.display = "none";
}

if (mobileList) {
    mobileList.style.display = "none";
}

if (errorMessage) {

    errorMessage.textContent =
        message;

}

if (errorState) {

    errorState.style.display =
        "flex";

}

}

// =========================================================
// SHOW MESSAGE
// =========================================================

function showMessage(
message,
type = "success"
) {

const element =
    document.getElementById(
        "pageMessage"
    );

if (!element) {
    return;
}


element.textContent =
    message;

element.className =
    `page-message ${type}`;


window.scrollTo({
    top: 0,
    behavior: "smooth"
});


window.setTimeout(
    () => {

        element.className =
            "page-message";

        element.textContent =
            "";

    },
    5000
);

}

// =========================================================
// GET USER NAME
// =========================================================

function getUserName(investment) {

if (
    investment.user &&
    typeof investment.user === "object"
) {

    const user =
        investment.user;


    const fullName =
        user.name ||
        user.full_name;


    if (fullName) {

        return String(
            fullName
        ).trim();

    }


    const combined =
        `${user.first_name || ""} ${user.last_name || ""}`
            .trim();


    if (combined) {
        return combined;
    }

}


return "Unknown User";

}

// =========================================================
// GET USER PHONE
// =========================================================

function getUserPhone(investment) {

if (
    investment.user &&
    typeof investment.user === "object"
) {

    return String(
        investment.user.phone ||
        ""
    ).trim();

}

return "";

}

// =========================================================
// GET USER EMAIL
// =========================================================

function getUserEmail(investment) {

if (
    investment.user &&
    typeof investment.user === "object"
) {

    return String(
        investment.user.email ||
        ""
    ).trim();

}

return "";

}

// =========================================================
// GET PLAN NAME
// =========================================================

function getPlanName(investment) {

const raw =
    String(
        investment.plan ||
        investment.plan_name ||
        ""
    )
    .trim()
    .toLowerCase();


if (raw === "starter") {
    return "Starter";
}

if (raw === "standard") {
    return "Standard";
}

if (raw === "advanced") {
    return "Advanced";
}


if (!raw) {
    return "Investment";
}


return raw.charAt(0).toUpperCase()
    + raw.slice(1);

}

// =========================================================
// GET PLAN ICON
// =========================================================

function getPlanIcon(plan) {

const name =
    String(plan)
        .toLowerCase();


if (name === "starter") {

    return "fa-solid fa-seedling";

}

if (name === "standard") {

    return "fa-solid fa-chart-line";

}

if (name === "advanced") {

    return "fa-solid fa-crown";

}


return "fa-solid fa-chart-pie";

}

// =========================================================
// GET STATUS ICON
// =========================================================

function getStatusIcon(status) {

switch (
    normalizeStatus(status)
) {

    case "pending":

        return "fa-solid fa-clock";

    case "active":

        return "fa-solid fa-circle-check";

    case "completed":

        return "fa-solid fa-flag-checkered";

    case "rejected":

        return "fa-solid fa-circle-xmark";

    default:

        return "fa-solid fa-circle-info";

}

}

// =========================================================
// NORMALIZE STATUS
// =========================================================

function normalizeStatus(status) {

const value =
    String(
        status || "pending"
    )
    .trim()
    .toLowerCase();


if (
    value === "approved" ||
    value === "running" ||
    value === "in_progress"
) {

    return "active";

}


if (
    value === "complete" ||
    value === "finished"
) {

    return "completed";

}


if (
    value === "declined" ||
    value === "cancelled" ||
    value === "canceled"
) {

    return "rejected";

}


return value || "pending";

}

// =========================================================
// GET AMOUNT
// =========================================================

function getAmount(investment) {

let value =
    investment.amount ??
    investment.investment_amount ??
    0;


if (
    typeof value === "object" &&
    value !== null
) {

    if (
        value.$numberDecimal !==
        undefined
    ) {

        value =
            value.$numberDecimal;

    } else if (
        value.$numberLong !==
        undefined
    ) {

        value =
            value.$numberLong;

    }

}


const number =
    Number(value);


return Number.isFinite(number)
    ? number
    : 0;

}

// =========================================================
// FORMAT MONEY
// =========================================================

function formatMoney(amount) {

const number =
    Number(amount) || 0;


return new Intl.NumberFormat(
    "en-UG",
    {
        maximumFractionDigits: 0
    }
).format(number);

}

// =========================================================
// FORMAT NUMBER
// =========================================================

function formatNumber(number) {

const value =
    Number(number) || 0;


return new Intl.NumberFormat(
    "en-UG"
).format(value);

}

// =========================================================
// FORMAT DATE
// =========================================================

function formatDate(value) {

if (!value) {
    return "—";
}


try {

    let dateValue =
        value;


    if (
        typeof value === "object" &&
        value !== null
    ) {

        if (
            value.$date !==
            undefined
        ) {

            dateValue =
                value.$date;

        }

    }


    const date =
        new Date(dateValue);


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
            year: "numeric",
            month: "short",
            day: "numeric",

            hour: "2-digit",
            minute: "2-digit"
        }
    ).format(date);


} catch (error) {

    return "—";

}

}

// =========================================================
// GET INITIALS
// =========================================================

function getInitials(name) {

const value =
    String(name || "")
        .trim();


if (!value) {
    return "CC";
}


const parts =
    value
        .split(/\s+/)
        .filter(Boolean);


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

// =========================================================
// SET TEXT
// =========================================================

function setText(
id,
value
) {

const element =
    document.getElementById(id);


if (element) {

    element.textContent =
        value;

}

}

// =========================================================
// HTML ESCAPING
// =========================================================

function escapeHTML(value) {

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