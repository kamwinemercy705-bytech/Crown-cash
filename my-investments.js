/* ==========================================================================
   CROWN CASH - MY INVESTMENTS
   New Custom Investment System
   ========================================================================== */

"use strict";

const API_URL = "https://crown-cash1.onrender.com";

let allInvestments = [];
let currentFilter = "all";


/* ==========================================================================
   START
   ========================================================================== */

document.addEventListener("DOMContentLoaded", () => {

    setCurrentYear();

    setupMobileMenu();

    setupFilters();

    setupRetry();

    setupLogout();

    loadInvestments();

});


/* ==========================================================================
   LOAD INVESTMENTS
   ========================================================================== */

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
            "Crown Cash My Investments:",
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

        showState(
            allInvestments.length > 0
                ? "list"
                : "empty"
        );


    } catch (error) {

        console.error(
            "Crown Cash My Investments Error:",
            error
        );


        const errorMessage =
            document.getElementById(
                "errorMessage"
            );


        if (errorMessage) {

            errorMessage.textContent =
                error.message ||
                "Unable to load your investments.";

        }


        showState("error");

    }

}


/* ==========================================================================
   BALANCE
   ========================================================================== */

function updateBalance(data) {

    const element =
        document.getElementById(
            "availableBalance"
        );


    if (!element) {
        return;
    }


    const balance =
        getNumber(
            data.available_balance ??
            data.availableBalance ??
            data.wallet_balance ??
            data.walletBalance ??
            data.balance ??
            data.wallet?.balance ??
            data.wallet?.new_balance ??
            0
        );


    element.textContent =
        `UGX ${formatMoney(balance)}`;

}


/* ==========================================================================
   SUMMARY
   ========================================================================== */

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


    let completed =
        Number(
            data.completed_investments ??
            data.completedInvestments
        );


    let totalAmount =
        getNumber(
            data.total_invested ??
            data.totalInvested ??
            0
        );


    if (!Number.isFinite(total)) {

        total =
            allInvestments.length;

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


    if (!Number.isFinite(completed)) {

        completed =
            allInvestments.filter(
                investment =>
                    normalizeStatus(
                        investment.status
                    ) === "completed"
            ).length;

    }


    if (
        data.total_invested === undefined &&
        data.totalInvested === undefined
    ) {

        totalAmount =
            allInvestments.reduce(
                (sum, investment) => {

                    return sum +
                        getNumber(
                            investment.amount ??
                            investment.investment_amount ??
                            investment.principal
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
        "completedInvestments",
        formatMoney(completed)
    );


    setText(
        "totalInvested",
        `UGX ${formatMoney(totalAmount)}`
    );

}


/* ==========================================================================
   RENDER
   ========================================================================== */

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

                <h3>
                    No investments found
                </h3>

                <p>
                    There are no investments matching this filter.
                </p>

                <a
                    href="/investments.html"
                    class="empty-action-btn"
                >
                    <i class="fa-solid fa-plus"></i>
                    Start New Investment
                </a>

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


/* ==========================================================================
   INVESTMENT CARD
   ========================================================================== */

function createInvestmentCard(investment) {

    const amount =
        getNumber(
            investment.amount ??
            investment.investment_amount ??
            investment.investmentAmount ??
            investment.principal ??
            investment.reserved_amount
        );


    const status =
        normalizeStatus(
            investment.status
        );


    const reference =
        investment.reference ??
        investment.investment_reference ??
        investment.investmentReference ??
        investment.transaction_reference ??
        investment.transactionReference ??
        investment._id ??
        "Not available";


    const startDate =
        getDate(
            investment.start_date ??
            investment.startDate ??
            investment.started_at ??
            investment.startedAt ??
            investment.activated_at ??
            investment.activatedAt ??
            investment.created_at ??
            investment.createdAt
        );


    let endDate =
        getDate(
            investment.end_date ??
            investment.endDate ??
            investment.matures_at ??
            investment.maturesAt ??
            investment.completed_at ??
            investment.completedAt
        );


    const duration =
        getNumber(
            investment.duration_days ??
            investment.durationDays ??
            investment.days ??
            investment.term_days ??
            investment.termDays ??
            30
        );


    /*
     * If the backend did not provide an end date,
     * calculate it from the server-provided start date
     * and duration.
     */

    if (
        !endDate.date &&
        startDate.date &&
        duration > 0
    ) {

        const calculatedEnd =
            new Date(
                startDate.date.getTime() +
                duration *
                24 *
                60 *
                60 *
                1000
            );


        endDate = {
            date: calculatedEnd,
            display:
                formatDate(
                    calculatedEnd
                )
        };

    }


    const progress =
        calculateProgress(
            investment,
            status,
            startDate,
            endDate,
            duration
        );


    const dailyIncome =
        getNumber(
            investment.daily_income ??
            investment.dailyIncome ??
            investment.daily_earning ??
            investment.dailyEarning ??
            investment.daily_return_amount ??
            investment.dailyReturnAmount ??
            investment.daily_profit ??
            investment.dailyProfit
        );


    const totalEarnings =
        getNumber(
            investment.total_earnings ??
            investment.totalEarnings ??
            investment.earnings ??
            investment.total_income ??
            investment.totalIncome ??
            investment.profit ??
            investment.profits
        );


    const dailyRate =
        getNumber(
            investment.daily_rate ??
            investment.dailyRate ??
            0
        );


    const icon =
        getInvestmentIcon(
            status
        );


    const statusIcon =
        getStatusIcon(
            status
        );


    const statusLabel =
        getStatusLabel(
            status
        );


    return `
        <article
            class="investment-item"
            data-status="${escapeHTML(status)}"
        >

            <!-- TOP -->
            <div class="investment-top">

                <div class="investment-title">

                    <div class="investment-plan-icon">
                        <i class="${icon}"></i>
                    </div>

                    <div>

                        <h3>
                            Crown Cash Investment
                        </h3>

                        <div class="investment-reference">
                            Reference:
                            ${escapeHTML(
                                String(reference)
                            )}
                        </div>

                    </div>

                </div>


                <div
                    class="investment-status ${escapeHTML(status)}"
                >

                    <i class="${statusIcon}"></i>

                    ${escapeHTML(statusLabel)}

                </div>

            </div>


            <!-- MAIN DETAILS -->
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
                        Daily Income
                    </span>

                    <strong>
                        UGX ${formatMoney(dailyIncome)}
                    </strong>

                </div>


                <div class="investment-detail">

                    <span>
                        Total Earnings
                    </span>

                    <strong>
                        UGX ${formatMoney(totalEarnings)}
                    </strong>

                </div>


                <div class="investment-detail">

                    <span>
                        Daily Rate
                    </span>

                    <strong>
                        ${formatRate(dailyRate)}
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


            <!-- PROGRESS -->
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


/* ==========================================================================
   FILTERS
   ========================================================================== */

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
                    )
                    .toLowerCase()
                    .trim();


                renderInvestments();

            }
        );

    });

}


function filterInvestments(
    investments
) {

    if (
        currentFilter === "all"
    ) {

        return investments;

    }


    return investments.filter(
        investment => {

            return (
                normalizeStatus(
                    investment.status
                ) === currentFilter
            );

        }
    );

}


/* ==========================================================================
   PROGRESS
   ========================================================================== */

function calculateProgress(
    investment,
    status,
    startDate,
    endDate,
    duration
) {

    if (
        status === "completed"
    ) {

        return 100;

    }


    if (
        status === "rejected" ||
        status === "failed" ||
        status === "cancelled"
    ) {

        return 0;

    }


    /*
     * New investments are active immediately.
     */

    if (
        status === "active"
    ) {

        if (
            !startDate.date
        ) {

            return 0;

        }


        let end =
            endDate.date;


        if (
            !end &&
            duration > 0
        ) {

            end =
                new Date(
                    startDate.date.getTime() +
                    duration *
                    24 *
                    60 *
                    60 *
                    1000
                );

        }


        if (
            !end ||
            end <= startDate.date
        ) {

            return 0;

        }


        const now =
            new Date();


        if (
            now <= startDate.date
        ) {

            return 0;

        }


        if (
            now >= end
        ) {

            return 100;

        }


        const total =
            end.getTime() -
            startDate.date.getTime();


        const elapsed =
            now.getTime() -
            startDate.date.getTime();


        const percentage =
            (
                elapsed /
                total
            ) * 100;


        return Math.round(
            Math.max(
                0,
                Math.min(
                    100,
                    percentage
                )
            )
        );

    }


    return 0;

}


/* ==========================================================================
   DATE
   ========================================================================== */

function getDate(value) {

    if (!value) {

        return {
            date: null,
            display: "Not available"
        };

    }


    if (
        typeof value === "object"
    ) {

        if (
            value.$date !== undefined
        ) {

            value =
                value.$date;

        } else if (
            value.date !== undefined
        ) {

            value =
                value.date;

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
            formatDate(date)

    };

}


function formatDate(date) {

    if (!date) {
        return "Not available";
    }


    return date.toLocaleDateString(
        "en-UG",
        {
            day: "2-digit",
            month: "short",
            year: "numeric"
        }
    );

}


/* ==========================================================================
   STATUS
   ========================================================================== */

function normalizeStatus(value) {

    const status =
        String(
            value || "active"
        )
        .toLowerCase()
        .trim();


    /*
     * Legacy statuses are normalized to
     * the new system.
     */

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


function getStatusLabel(status) {

    const labels = {

        active:
            "Active",

        completed:
            "Completed",

        rejected:
            "Rejected",

        failed:
            "Failed",

        cancelled:
            "Cancelled"

    };


    return (
        labels[status] ||
        "Active"
    );

}


function getStatusIcon(status) {

    const icons = {

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
        "fa-solid fa-circle-check"
    );

}


/* ==========================================================================
   INVESTMENT ICON
   ========================================================================== */

function getInvestmentIcon(status) {

    if (
        status === "completed"
    ) {

        return "fa-solid fa-flag-checkered";

    }


    if (
        status === "rejected" ||
        status === "failed" ||
        status === "cancelled"
    ) {

        return "fa-solid fa-circle-xmark";

    }


    return "fa-solid fa-chart-line";

}


/* ==========================================================================
   NUMBER HELPERS
   ========================================================================== */

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

            return (
                Number(
                    value.$numberDecimal
                ) || 0
            );

        }


        if (
            value.$numberLong !==
            undefined
        ) {

            return (
                Number(
                    value.$numberLong
                ) || 0
            );

        }


        if (
            value.value !==
            undefined
        ) {

            return (
                Number(
                    value.value
                ) || 0
            );

        }

    }


    return (
        Number(
            String(value)
                .replace(
                    /,/g,
                    ""
                )
        ) || 0
    );

}


function formatMoney(value) {

    return getNumber(value)
        .toLocaleString(
            "en-UG",
            {
                maximumFractionDigits: 0
            }
        );

}


function formatRate(value) {

    const rate =
        getNumber(value);


    if (
        rate === 0
    ) {

        return "Server configured";

    }


    /*
     * Backend may return either:
     *
     * 0.10 = 10%
     * 10   = 10%
     */

    const percentage =
        rate <= 1
            ? rate * 100
            : rate;


    return (
        Number.isInteger(
            percentage
        )
            ? `${percentage}%`
            : `${percentage.toFixed(2)}%`
    );

}


/* ==========================================================================
   UI HELPERS
   ========================================================================== */

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


/* ==========================================================================
   RETRY
   ========================================================================== */

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


/* ==========================================================================
   MOBILE MENU
   ========================================================================== */

function setupMobileMenu() {

    const menuToggle =
        document.getElementById(
            "menuToggle"
        ) ||
        document.getElementById(
            "menuBtn"
        );


    const sidebar =
        document.getElementById(
            "sidebar"
        );


    const overlay =
        document.getElementById(
            "sidebarOverlay"
        ) ||
        document.getElementById(
            "menuOverlay"
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


            sidebar.classList.toggle(
                "open"
            );


            if (overlay) {

                overlay.classList.toggle(
                    "active"
                );

                overlay.classList.toggle(
                    "show"
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


    sidebar
        .querySelectorAll("a")
        .forEach(link => {

            link.addEventListener(
                "click",
                closeSidebar
            );

        });


    function closeSidebar() {

        sidebar.classList.remove(
            "active"
        );

        sidebar.classList.remove(
            "open"
        );


        if (overlay) {

            overlay.classList.remove(
                "active"
            );

            overlay.classList.remove(
                "show"
            );

        }

    }

}


/* ==========================================================================
   LOGOUT
   ========================================================================== */

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


/* ==========================================================================
   CURRENT YEAR
   ========================================================================== */

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


/* ==========================================================================
   HTML ESCAPING
   ========================================================================== */

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