/* =========================================================
CROWN CASH - TRANSACTIONS JAVASCRIPT
========================================================= */

const API_URL = "https://crown-cash1.onrender.com";

let allTransactions = [];
let currentFilter = "all";

/* =========================================================
DOM
========================================================= */

const loadingState = document.getElementById("loadingState");
const errorState = document.getElementById("errorState");
const errorMessage = document.getElementById("errorMessage");
const emptyState = document.getElementById("emptyState");
const transactionsList = document.getElementById("transactionsList");

const availableBalance = document.getElementById("availableBalance");
const totalDeposits = document.getElementById("totalDeposits");
const totalWithdrawals = document.getElementById("totalWithdrawals");
const totalInvestments = document.getElementById("totalInvestments");
const totalIncome = document.getElementById("totalIncome");

const transactionSearch = document.getElementById("transactionSearch");
const statusFilter = document.getElementById("statusFilter");

const refreshBtn = document.getElementById("refreshBtn");
const retryBtn = document.getElementById("retryBtn");

const sidebar = document.getElementById("sidebar");
const menuToggle = document.getElementById("menuToggle");
const logoutBtn = document.getElementById("logoutBtn");

const sidebarUserName = document.getElementById("sidebarUserName");
const sidebarUserEmail = document.getElementById("sidebarUserEmail");

/* =========================================================
START
========================================================= */

document.addEventListener("DOMContentLoaded", () => {

setupMenu();
setupFilters();
setupRefresh();
setupLogout();

loadSavedUser();
loadTransactions();

});

/* =========================================================
LOAD SAVED USER
========================================================= */

function loadSavedUser() {

try {

    const savedUser = localStorage.getItem("crownCashUser");

    if (!savedUser) {
        return;
    }

    const user = JSON.parse(savedUser);

    const name =
        user.full_name ||
        user.fullName ||
        user.name ||
        [user.first_name, user.last_name]
            .filter(Boolean)
            .join(" ") ||
        "Crown Cash User";

    const email =
        user.email ||
        user.user_email ||
        "Account";

    if (sidebarUserName) {
        sidebarUserName.textContent = name;
    }

    if (sidebarUserEmail) {
        sidebarUserEmail.textContent = email;
    }

    const balance =
        user.balance ??
        user.wallet_balance ??
        user.walletBalance;

    if (balance !== undefined && balance !== null) {
        availableBalance.textContent =
            formatUGX(balance);
    }

} catch (error) {

    console.warn(
        "Could not read saved user:",
        error
    );

}

}

/* =========================================================
LOAD TRANSACTIONS
========================================================= */

async function loadTransactions() {

showLoading();

try {

    const response = await fetch(
        `${API_URL}/transactions.php`,
        {
            method: "GET",
            credentials: "include",
            cache: "no-store",
            headers: {
                "Accept": "application/json"
            }
        }
    );

    let data;

    try {
        data = await response.json();
    } catch (jsonError) {

        throw new Error(
            `Server returned an invalid response (${response.status}).`
        );

    }

    console.log("Crown Cash transactions response:", data);

    if (!response.ok) {

        if (response.status === 401) {
            throw new Error(
                "Your session has expired. Please log in again."
            );
        }

        throw new Error(
            data.message ||
            data.error ||
            `Unable to load transactions (${response.status}).`
        );
    }

    if (data.success === false) {

        throw new Error(
            data.message ||
            data.error ||
            "Unable to load transaction data."
        );

    }

    allTransactions =
        normalizeTransactions(
            data.transactions ||
            data.data ||
            data.results ||
            []
        );

    updateBalance(data);

    calculateSummary();

    renderTransactions();

} catch (error) {

    console.error(
        "Transaction loading error:",
        error
    );

    showError(
        error.message ||
        "Unable to load transactions."
    );

}

}

/* =========================================================
NORMALIZE TRANSACTIONS
========================================================= */

function normalizeTransactions(transactions) {

if (!Array.isArray(transactions)) {
    return [];
}

return transactions.map((transaction, index) => {

    const rawType =
        transaction.type ||
        transaction.transaction_type ||
        transaction.transactionType ||
        transaction.category ||
        transaction.kind ||
        "";

    const type = normalizeType(rawType);

    const rawStatus =
        transaction.status ||
        transaction.state ||
        "pending";

    const status =
        normalizeStatus(rawStatus);

    const amount =
        getNumericValue(
            transaction.amount ??
            transaction.value ??
            transaction.total ??
            0
        );

    const reference =
        transaction.transaction_reference ||
        transaction.reference ||
        transaction.transaction_id ||
        transaction.transactionId ||
        transaction.ref ||
        transaction._id ||
        `TX-${index + 1}`;

    const date =
        transaction.created_at ||
        transaction.createdAt ||
        transaction.date ||
        transaction.timestamp ||
        null;

    const description =
        transaction.description ||
        transaction.title ||
        transaction.name ||
        getDefaultTitle(type);

    return {
        ...transaction,
        normalizedType: type,
        normalizedStatus: status,
        normalizedAmount: amount,
        normalizedReference: String(reference),
        normalizedDate: date,
        normalizedTitle: description
    };

});

}

/* =========================================================
NORMALIZE TYPE
========================================================= */

function normalizeType(type) {

const value =
    String(type || "")
        .trim()
        .toLowerCase();

if (
    value.includes("deposit") ||
    value === "credit" ||
    value === "funding" ||
    value === "topup" ||
    value === "top-up"
) {
    return "deposit";
}

if (
    value.includes("withdraw") ||
    value === "debit"
) {
    return "withdrawal";
}

if (
    value.includes("invest")
) {
    return "investment";
}

if (
    value.includes("income") ||
    value.includes("earning") ||
    value.includes("profit") ||
    value.includes("return") ||
    value.includes("commission") ||
    value.includes("referral")
) {
    return "income";
}

return "other";

}

/* =========================================================
NORMALIZE STATUS
========================================================= */

function normalizeStatus(status) {

const value =
    String(status || "")
        .trim()
        .toLowerCase();

if (
    value === "complete" ||
    value === "completed" ||
    value === "success" ||
    value === "successful" ||
    value === "approved"
) {
    return "completed";
}

if (
    value === "failed" ||
    value === "failure" ||
    value === "error"
) {
    return "failed";
}

if (
    value === "rejected" ||
    value === "declined" ||
    value === "denied"
) {
    return "rejected";
}

return "pending";

}

/* =========================================================
DEFAULT TITLES
========================================================= */

function getDefaultTitle(type) {

switch (type) {

    case "deposit":
        return "Deposit";

    case "withdrawal":
        return "Withdrawal";

    case "investment":
        return "Investment";

    case "income":
        return "Income";

    default:
        return "Transaction";

}

}

/* =========================================================
ICONS
========================================================= */

function getTransactionIcon(type) {

switch (type) {

    case "deposit":
        return "fa-circle-arrow-down";

    case "withdrawal":
        return "fa-circle-arrow-up";

    case "investment":
        return "fa-chart-line";

    case "income":
        return "fa-coins";

    default:
        return "fa-receipt";

}

}

/* =========================================================
UPDATE BALANCE
========================================================= */

function updateBalance(data) {

const balance =
    data.balance ??
    data.available_balance ??
    data.availableBalance ??
    data.wallet_balance ??
    data.walletBalance;

if (
    balance !== undefined &&
    balance !== null
) {

    availableBalance.textContent =
        formatUGX(balance);

}

}

/* =========================================================
CALCULATE SUMMARY
========================================================= */

function calculateSummary() {

let deposits = 0;
let withdrawals = 0;
let investments = 0;
let income = 0;

allTransactions.forEach(transaction => {

    const amount =
        Number(transaction.normalizedAmount) || 0;

    switch (transaction.normalizedType) {

        case "deposit":
            deposits += amount;
            break;

        case "withdrawal":
            withdrawals += amount;
            break;

        case "investment":
            investments += amount;
            break;

        case "income":
            income += amount;
            break;

    }

});

totalDeposits.textContent =
    formatUGX(deposits);

totalWithdrawals.textContent =
    formatUGX(withdrawals);

totalInvestments.textContent =
    formatUGX(investments);

totalIncome.textContent =
    formatUGX(income);

}

/* =========================================================
RENDER TRANSACTIONS
========================================================= */

function renderTransactions() {

const search =
    String(
        transactionSearch?.value || ""
    )
        .trim()
        .toLowerCase();

const selectedStatus =
    statusFilter?.value || "all";

let filtered =
    allTransactions.filter(transaction => {

        /* TYPE FILTER */

        if (
            currentFilter !== "all" &&
            transaction.normalizedType !== currentFilter
        ) {
            return false;
        }


        /* STATUS FILTER */

        if (
            selectedStatus !== "all" &&
            transaction.normalizedStatus !== selectedStatus
        ) {
            return false;
        }


        /* SEARCH */

        if (search) {

            const searchableText = [

                transaction.normalizedTitle,

                transaction.normalizedType,

                transaction.normalizedStatus,

                transaction.normalizedReference,

                transaction.description || "",

                transaction.payment_method || "",

                transaction.method || ""

            ]
                .join(" ")
                .toLowerCase();

            if (!searchableText.includes(search)) {
                return false;
            }

        }

        return true;

    });


transactionsList.innerHTML = "";


if (filtered.length === 0) {

    showEmpty();

    return;

}


hideAllStates();

transactionsList.hidden = false;


filtered.forEach(transaction => {

    const item =
        createTransactionElement(
            transaction
        );

    transactionsList.appendChild(item);

});

}

/* =========================================================
CREATE TRANSACTION ELEMENT
========================================================= */

function createTransactionElement(transaction) {

const item =
    document.createElement("div");

item.className =
    `transaction-item type-${transaction.normalizedType}`;


/* ICON */

const iconWrapper =
    document.createElement("div");

iconWrapper.className =
    "transaction-icon";

const icon =
    document.createElement("i");

icon.className =
    `fa-solid ${getTransactionIcon(
        transaction.normalizedType
    )}`;

iconWrapper.appendChild(icon);


/* DETAILS */

const details =
    document.createElement("div");

details.className =
    "transaction-details";


const titleRow =
    document.createElement("div");

titleRow.className =
    "transaction-title-row";


const title =
    document.createElement("h3");

title.className =
    "transaction-title";

title.textContent =
    transaction.normalizedTitle;


const status =
    document.createElement("span");

status.className =
    `transaction-status ${transaction.normalizedStatus}`;

status.textContent =
    capitalize(
        transaction.normalizedStatus
    );


titleRow.appendChild(title);
titleRow.appendChild(status);


const reference =
    document.createElement("p");

reference.className =
    "transaction-reference";

reference.textContent =
    `Reference: ${transaction.normalizedReference}`;


const date =
    document.createElement("small");

date.className =
    "transaction-date";

date.textContent =
    formatDate(
        transaction.normalizedDate
    );


details.appendChild(titleRow);
details.appendChild(reference);
details.appendChild(date);


/* AMOUNT */

const amountWrapper =
    document.createElement("div");

amountWrapper.className =
    "transaction-amount";


const amount =
    document.createElement("strong");

const amountPrefix =
    transaction.normalizedType === "withdrawal"
        ? "-"
        : "+";


amount.textContent =
    `${amountPrefix}${formatUGX(
        transaction.normalizedAmount
    )}`;


const direction =
    document.createElement("span");

direction.className =
    `transaction-direction ${
        transaction.normalizedType === "withdrawal"
            ? "outgoing"
            : "incoming"
    }`;

direction.textContent =
    transaction.normalizedType === "withdrawal"
        ? "Money out"
        : "Money in";


amountWrapper.appendChild(amount);
amountWrapper.appendChild(direction);


/* APPEND */

item.appendChild(iconWrapper);
item.appendChild(details);
item.appendChild(amountWrapper);


return item;

}

/* =========================================================
FILTERS
========================================================= */

function setupFilters() {

const filterButtons =
    document.querySelectorAll(
        ".filter-btn"
    );

filterButtons.forEach(button => {

    button.addEventListener(
        "click",
        () => {

            filterButtons.forEach(btn => {
                btn.classList.remove("active");
            });

            button.classList.add("active");

            currentFilter =
                button.dataset.filter ||
                "all";

            renderTransactions();

        }
    );

});


if (transactionSearch) {

    transactionSearch.addEventListener(
        "input",
        renderTransactions
    );

}


if (statusFilter) {

    statusFilter.addEventListener(
        "change",
        renderTransactions
    );

}

}

/* =========================================================
REFRESH
========================================================= */

function setupRefresh() {

if (refreshBtn) {

    refreshBtn.addEventListener(
        "click",
        async () => {

            refreshBtn.disabled = true;

            const icon =
                refreshBtn.querySelector("i");

            if (icon) {
                icon.classList.add("fa-spin");
            }

            await loadTransactions();

            if (icon) {
                icon.classList.remove("fa-spin");
            }

            refreshBtn.disabled = false;

        }
    );

}


if (retryBtn) {

    retryBtn.addEventListener(
        "click",
        loadTransactions
    );

}

}

/* =========================================================
MENU
========================================================= */

function setupMenu() {

if (!menuToggle || !sidebar) {
    return;
}

menuToggle.addEventListener(
    "click",
    () => {

        sidebar.classList.toggle("open");

        const icon =
            menuToggle.querySelector("i");

        if (!icon) {
            return;
        }

        if (
            sidebar.classList.contains("open")
        ) {

            icon.classList.remove(
                "fa-bars"
            );

            icon.classList.add(
                "fa-xmark"
            );

        } else {

            icon.classList.remove(
                "fa-xmark"
            );

            icon.classList.add(
                "fa-bars"
            );

        }

    }
);


document.addEventListener(
    "click",
    event => {

        if (
            window.innerWidth > 800 ||
            !sidebar.classList.contains("open")
        ) {
            return;
        }

        if (
            sidebar.contains(event.target) ||
            menuToggle.contains(event.target)
        ) {
            return;
        }

        sidebar.classList.remove("open");

        const icon =
            menuToggle.querySelector("i");

        if (icon) {

            icon.classList.remove(
                "fa-xmark"
            );

            icon.classList.add(
                "fa-bars"
            );

        }

    }
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
    async () => {

        logoutBtn.disabled = true;

        try {

            await fetch(
                `${API_URL}/logout.php`,
                {
                    method: "GET",
                    credentials: "include",
                    cache: "no-store"
                }
            );

        } catch (error) {

            console.warn(
                "Logout request failed:",
                error
            );

        }


        localStorage.removeItem(
            "crownCashUser"
        );

        localStorage.removeItem(
            "user"
        );

        window.location.href =
            "/login.html";

    }
);

}

/* =========================================================
STATES
========================================================= */

function hideAllStates() {

loadingState.hidden = true;
errorState.hidden = true;
emptyState.hidden = true;

}

function showLoading() {

hideAllStates();

loadingState.hidden = false;

transactionsList.hidden = true;

}

function showError(message) {

hideAllStates();

errorState.hidden = false;

transactionsList.hidden = true;

if (errorMessage) {

    errorMessage.textContent =
        message ||
        "Please refresh the page and try again.";

}

}

function showEmpty() {

hideAllStates();

emptyState.hidden = false;

transactionsList.hidden = true;

}

/* =========================================================
NUMBER HELPERS
========================================================= */

function getNumericValue(value) {

if (
    value === null ||
    value === undefined
) {
    return 0;
}

if (
    typeof value === "object"
) {

    if (
        value.$numberDecimal !== undefined
    ) {
        return Number(
            value.$numberDecimal
        ) || 0;
    }

    if (
        value.$numberInt !== undefined
    ) {
        return Number(
            value.$numberInt
        ) || 0;
    }

    if (
        value.$numberLong !== undefined
    ) {
        return Number(
            value.$numberLong
        ) || 0;
    }

    if (
        value.toString
    ) {
        return Number(
            value.toString()
        ) || 0;
    }

}

return Number(value) || 0;

}

/* =========================================================
FORMAT UGX
========================================================= */

function formatUGX(amount) {

const number =
    getNumericValue(amount);

return `UGX ${number.toLocaleString(
    "en-UG",
    {
        maximumFractionDigits: 0
    }
)}`;

}

/* =========================================================
FORMAT DATE
========================================================= */

function formatDate(dateValue) {

if (!dateValue) {
    return "Date unavailable";
}

try {

    let date;

    if (
        typeof dateValue === "object" &&
        dateValue.$date
    ) {

        date =
            new Date(dateValue.$date);

    } else {

        date =
            new Date(dateValue);

    }

    if (
        Number.isNaN(date.getTime())
    ) {
        return "Date unavailable";
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

} catch (error) {

    return "Date unavailable";

}

}

/* =========================================================
CAPITALIZE
========================================================= */

function capitalize(value) {

const text =
    String(value || "");

if (!text) {
    return "";
}

return (
    text.charAt(0).toUpperCase() +
    text.slice(1)
);

}