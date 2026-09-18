const API_URL = "https://crown-cash1.onrender.com";

let allInvestments = [];
let currentFilter = "all";

/* =========================================================
START
========================================================= */

document.addEventListener("DOMContentLoaded", () => {

setCurrentYear();

setupMobileMenu();

setupFilters();

setupRetry();

setupLogout();

loadInvestments();

});

/* =========================================================
LOAD INVESTMENTS
========================================================= */

async function loadInvestments() {

showState("loading");

try {

    const response = await fetch(
        `${API_URL}/my-investments.php`,
        {
            method: "GET",

            credentials: "include",

            headers: {
                "Accept": "application/json"
            },

            cache: "no-store"
        }
    );

    let data;

    try {
        data = await response.json();
    } catch (error) {
        throw new Error(
            "The investment server returned an invalid response."
        );
    }

    console.log(
        "My investments response:",
        data
    );

    if (!response.ok || !data.success) {

        if (response.status === 401) {
            throw new Error(
                "Your session has expired. Please log in again."
            );
        }

        throw new Error(
            data.message ||
            data.error ||
            "Unable to load your investments."
        );
    }

    allInvestments =
        Array.isArray(data.investments)
            ? data.investments
            : [];

    updateBalance(data);

    updateSummary(data);

    renderInvestments();

    if (allInvestments.length === 0) {
        showState("empty");
    } else {
        showState("list");
    }

} catch (error) {

    console.error(
        "My investments error:",
        error
    );

    const errorMessage =
        document.getElementById(
            "errorMessage"
        );

    if (errorMessage) {
        errorMessage.textContent =
            error.message ||
            "Please refresh the page and try again.";
    }

    showState("error");
}

}

/* =========================================================
BALANCE
========================================================= */

function updateBalance(data) {

const balanceElement =
    document.getElementById(
        "availableBalance"
    );

if (!balanceElement) {
    return;
}

const balance =
    getNumber(
        data.available_balance ??
        data.availableBalance ??
        data.balance ??
        0
    );

balanceElement.textContent =
    `UGX ${formatMoney(balance)}`;

}

/* =========================================================
SUMMARY
========================================================= */

function updateSummary(data) {

let total =
    Number(
        data.total_investments ??
        data.totalInvestments
    );

let active =
    Number(
        data.active_investments ??
        data.activeInvestments
    );

let pending =
    Number(
        data.pending_investments ??
        data.pendingInvestments
    );

let totalAmount =
    getNumber(
        data.total_invested ??
        data.totalInvested ??
        0
    );


/*
 * If the backend does not provide summary
 * values, calculate them from the investment list.
 */

if (!Number.isFinite(total)) {
    total = allInvestments.length;
}

if (!Number.isFinite(active)) {

    active =
        allInvestments.filter(
            investment =>
                normalizeStatus(
                    investment.status
                ) === "active"
        ).length;
}

if (!Number.isFinite(pending)) {

    pending =
        allInvestments.filter(
            investment =>
                normalizeStatus(
                    investment.status
                ) === "pending"
        ).length;
}

if (
    !data.total_invested &&
    !data.totalInvested
) {

    totalAmount =
        allInvestments.reduce(
            (sum, investment) => {

                return sum +
                    getNumber(
                        investment.amount
                    );

            },
            0
        );
}


setText(
    "totalInvestments",
    formatMoney(total)
);

setText(
    "activeInvestments",
    formatMoney(active)
);

setText(
    "pendingInvestments",
    formatMoney(pending)
);

setText(
    "totalInvested",
    `UGX ${formatMoney(totalAmount)}`
);

}

/* =========================================================
RENDER INVESTMENTS
========================================================= */

function renderInvestments() {

const list =
    document.getElementById(
        "investmentList"
    );

if (!list) {
    return;
}

const filtered =
    filterInvestments(
        allInvestments
    );

if (filtered.length === 0) {

    list.innerHTML = `
        <div class="state-box">
            <div class="state-icon">
                <i class="fa-solid fa-filter-circle-xmark"></i>
            </div>

            <h3>No investments found</h3>

            <p>
                There are no investments matching this filter.
            </p>
        </div>
    `;

    return;
}


list.innerHTML =
    filtered
        .map(
            investment =>
                createInvestmentCard(
                    investment
                )
        )
        .join("");

}

/* =========================================================
INVESTMENT CARD
========================================================= */

function createInvestmentCard(investment) {

const plan =
    normalizePlan(
        investment.plan ||
        investment.plan_name ||
        investment.planName ||
        investment.package
    );

const amount =
    getNumber(
        investment.amount
    );

const status =
    normalizeStatus(
        investment.status
    );

const reference =
    investment.reference ||
    investment.transaction_reference ||
    investment.transactionReference ||
    investment.investment_reference ||
    "Not available";


const startDate =
    getDate(
        investment.start_date ??
        investment.startDate ??
        investment.started_at ??
        investment.created_at
    );


const endDate =
    getDate(
        investment.end_date ??
        investment.endDate ??
        investment.matures_at ??
        investment.completed_at
    );


const duration =
    Number(
        investment.duration_days ??
        investment.durationDays ??
        investment.days ??
        30
    );


const progress =
    calculateProgress(
        investment,
        status,
        startDate,
        endDate,
        duration
    );


const icon =
    getPlanIcon(plan);


const statusIcon =
    getStatusIcon(status);


const statusLabel =
    capitalize(status);


return `
    <article class="investment-item">

        <div class="investment-top">

            <div class="investment-title">

                <div class="investment-plan-icon">
                    <i class="${icon}"></i>
                </div>

                <div>

                    <h3>
                        ${escapeHTML(
                            getPlanName(plan)
                        )}
                    </h3>

                    <div class="investment-reference">
                        Reference:
                        ${escapeHTML(
                            String(reference)
                        )}
                    </div>

                </div>

            </div>


            <div class="investment-status ${escapeHTML(status)}">

                <i class="${statusIcon}"></i>

                ${escapeHTML(statusLabel)}

            </div>

        </div>


        <div class="investment-details">

            <div class="investment-detail">

                <span>
                    Investment Amount
                </span>

                <strong>
                    UGX ${formatMoney(amount)}
                </strong>

            </div>


            <div class="investment-detail">

                <span>
                    Period
                </span>

                <strong>
                    ${formatMoney(duration)} days
                </strong>

            </div>


            <div class="investment-detail">

                <span>
                    Start Date
                </span>

                <strong>
                    ${escapeHTML(
                        startDate.display
                    )}
                </strong>

            </div>


            <div class="investment-detail">

                <span>
                    End Date
                </span>

                <strong>
                    ${escapeHTML(
                        endDate.display
                    )}
                </strong>

            </div>

        </div>


        <div class="investment-progress">

            <div class="progress-header">

                <span>
                    Investment Progress
                </span>

                <strong>
                    ${progress}%
                </strong>

            </div>

            <div class="progress-bar">

                <div
                    class="progress-fill"
                    style="width:${progress}%"
                ></div>

            </div>

        </div>

    </article>
`;

}

/* =========================================================
FILTERS
========================================================= */

function setupFilters() {

const buttons =
    document.querySelectorAll(
        ".filter-btn"
    );

buttons.forEach(button => {

    button.addEventListener(
        "click",
        () => {

            buttons.forEach(
                item =>
                    item.classList.remove(
                        "active"
                    )
            );

            button.classList.add(
                "active"
            );

            currentFilter =
                (
                    button.dataset.filter ||
                    "all"
                ).toLowerCase();

            renderInvestments();
        }
    );
});

}

function filterInvestments(investments) {

if (currentFilter === "all") {
    return investments;
}

return investments.filter(
    investment => {

        const status =
            normalizeStatus(
                investment.status
            );

        return status ===
            currentFilter;
    }
);

}

/* =========================================================
PROGRESS
========================================================= */

function calculateProgress(
investment,
status,
startDate,
endDate,
duration
) {

if (status === "completed") {
    return 100;
}

if (
    status === "pending" ||
    status === "rejected" ||
    status === "failed" ||
    status === "cancelled"
) {
    return 0;
}

const start =
    startDate.date;

const end =
    endDate.date;


if (
    !start ||
    !end ||
    end <= start
) {
    return 0;
}


const now =
    new Date();


if (now <= start) {
    return 0;
}

if (now >= end) {
    return 100;
}


const total =
    end.getTime() -
    start.getTime();

const elapsed =
    now.getTime() -
    start.getTime();


let percentage =
    (elapsed / total) * 100;


if (!Number.isFinite(percentage)) {
    percentage = 0;
}


percentage =
    Math.max(
        0,
        Math.min(
            100,
            percentage
        )
    );


return Math.round(
    percentage
);

}

/* =========================================================
DATE
========================================================= */

function getDate(value) {

if (!value) {

    return {
        date: null,
        display: "Not available"
    };
}


/*
 * MongoDB date formats sometimes arrive as:
 *
 * ISO string
 * { "$date": "..." }
 * { date: "..." }
 */

if (
    typeof value === "object"
) {

    if (value.$date) {
        value = value.$date;
    } else if (value.date) {
        value = value.date;
    }
}


const date =
    new Date(value);


if (
    Number.isNaN(
        date.getTime()
    )
) {

    return {
        date: null,
        display: "Not available"
    };
}


return {
    date,
    display:
        date.toLocaleDateString(
            "en-UG",
            {
                day: "2-digit",
                month: "short",
                year: "numeric"
            }
        )
};

}

/* =========================================================
PLAN
========================================================= */

function normalizePlan(value) {

const plan =
    String(
        value || ""
    )
    .toLowerCase()
    .trim();


if (
    plan.includes("starter")
) {
    return "starter";
}

if (
    plan.includes("standard")
) {
    return "standard";
}

if (
    plan.includes("advanced")
) {
    return "advanced";
}

return "starter";

}

function getPlanName(plan) {

const names = {
    starter: "Starter Plan",
    standard: "Standard Plan",
    advanced: "Advanced Plan"
};

return (
    names[plan] ||
    "Investment Plan"
);

}

function getPlanIcon(plan) {

const icons = {
    starter:
        "fa-solid fa-seedling",

    standard:
        "fa-solid fa-chart-line",

    advanced:
        "fa-solid fa-crown"
};

return (
    icons[plan] ||
    "fa-solid fa-briefcase"
);

}

/* =========================================================
STATUS
========================================================= */

function normalizeStatus(value) {

const status =
    String(
        value || "pending"
    )
    .toLowerCase()
    .trim();


if (
    status === "approved" ||
    status === "running" ||
    status === "in_progress"
) {
    return "active";
}


if (
    status === "complete" ||
    status === "matured" ||
    status === "finished"
) {
    return "completed";
}


if (
    status === "declined"
) {
    return "rejected";
}


return status;

}

function getStatusIcon(status) {

const icons = {

    pending:
        "fa-solid fa-clock",

    active:
        "fa-solid fa-circle-check",

    completed:
        "fa-solid fa-flag-checkered",

    rejected:
        "fa-solid fa-circle-xmark",

    failed:
        "fa-solid fa-triangle-exclamation",

    cancelled:
        "fa-solid fa-ban"
};


return (
    icons[status] ||
    "fa-solid fa-circle-info"
);

}

/* =========================================================
NUMBER HELPERS
========================================================= */

function getNumber(value) {

if (
    value === null ||
    value === undefined
) {
    return 0;
}


if (
    typeof value === "number"
) {
    return Number.isFinite(value)
        ? value
        : 0;
}


if (
    typeof value === "object"
) {

    if (
        value.$numberDecimal !==
        undefined
    ) {
        return Number(
            value.$numberDecimal
        ) || 0;
    }

    if (
        value.$numberLong !==
        undefined
    ) {
        return Number(
            value.$numberLong
        ) || 0;
    }

    if (
        value.numberDecimal !==
        undefined
    ) {
        return Number(
            value.numberDecimal
        ) || 0;
    }

    if (
        value.value !== undefined
    ) {
        return Number(
            value.value
        ) || 0;
    }
}


return (
    Number(
        String(value)
    ) || 0
);

}

function formatMoney(value) {

const number =
    getNumber(value);

return number.toLocaleString(
    "en-UG"
);

}

/* =========================================================
UI HELPERS
========================================================= */

function setText(
id,
value
) {

const element =
    document.getElementById(id);

if (element) {
    element.textContent = value;
}

}

function showState(state) {

const loading =
    document.getElementById(
        "loadingState"
    );

const error =
    document.getElementById(
        "errorState"
    );

const empty =
    document.getElementById(
        "emptyState"
    );

const list =
    document.getElementById(
        "investmentList"
    );


if (loading) {
    loading.style.display =
        state === "loading"
            ? "block"
            : "none";
}

if (error) {
    error.style.display =
        state === "error"
            ? "block"
            : "none";
}

if (empty) {
    empty.style.display =
        state === "empty"
            ? "block"
            : "none";
}

if (list) {
    list.style.display =
        state === "list"
            ? "flex"
            : "none";
}

}

/* =========================================================
RETRY
========================================================= */

function setupRetry() {

const button =
    document.getElementById(
        "retryBtn"
    );

if (!button) {
    return;
}

button.addEventListener(
    "click",
    () => {
        loadInvestments();
    }
);

}

/* =========================================================
MOBILE MENU
========================================================= */

function setupMobileMenu() {

const menuToggle =
    document.getElementById(
        "menuToggle"
    );

const sidebar =
    document.getElementById(
        "sidebar"
    );

const overlay =
    document.getElementById(
        "sidebarOverlay"
    );


if (
    !menuToggle ||
    !sidebar
) {
    return;
}


menuToggle.addEventListener(
    "click",
    () => {

        sidebar.classList.toggle(
            "active"
        );

        if (overlay) {
            overlay.classList.toggle(
                "active"
            );
        }
    }
);


if (overlay) {

    overlay.addEventListener(
        "click",
        closeSidebar
    );
}


const links =
    sidebar.querySelectorAll(
        "a"
    );


links.forEach(link => {

    link.addEventListener(
        "click",
        closeSidebar
    );

});


function closeSidebar() {

    sidebar.classList.remove(
        "active"
    );

    if (overlay) {
        overlay.classList.remove(
            "active"
        );
    }
}

}

/* =========================================================
LOGOUT
========================================================= */

function setupLogout() {

const buttons =
    document.querySelectorAll(
        "#logoutBtn, .logout-btn, [data-action='logout']"
    );


buttons.forEach(button => {

    button.addEventListener(
        "click",
        async event => {

            event.preventDefault();

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

                console.error(
                    "Logout error:",
                    error
                );
            }


            localStorage.removeItem(
                "crownCashUser"
            );

            localStorage.removeItem(
                "currentUser"
            );


            window.location.href =
                "/login.html";
        }
    );

});

}

/* =========================================================
CURRENT YEAR
========================================================= */

function setCurrentYear() {

const year =
    document.getElementById(
        "currentYear"
    );

if (year) {
    year.textContent =
        new Date().getFullYear();
}

}

/* =========================================================
HTML ESCAPING
========================================================= */

function escapeHTML(value) {

return String(value)
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