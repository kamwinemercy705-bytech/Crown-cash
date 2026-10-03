/* =========================================================
   CROWN CASH - INVESTMENTS PAGE
   File: investments.js
========================================================= */

"use strict";

const API_URL = "https://crown-cash1.onrender.com";

const INVESTMENT_API =
    `${API_URL}/investment.php`;

const PROFILE_API =
    `${API_URL}/profile.php`;

const LOGOUT_API =
    `${API_URL}/logout.php`;


/* =========================================================
   INVESTMENT PLANS
========================================================= */

const PLANS = {

    starter: {
        name: "Starter Plan",
        amount: 10000,
        rate: 10,
        days: 30
    },

    standard: {
        name: "Standard Plan",
        amount: 15000,
        rate: 10,
        days: 30
    },

    advanced: {
        name: "Advanced Plan",
        amount: 25000,
        rate: 10,
        days: 30
    }

};


/* =========================================================
   DOM READY
========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    () => {

        setupInvestmentButtons();

        setupCalculator();

        setupMobileMenu();

        setupLogout();

        loadWalletBalance();

    }
);


/* =========================================================
   FETCH HELPER
========================================================= */

async function fetchJson(
    url,
    options = {}
) {

    const response =
        await fetch(
            url,
            {
                credentials: "include",

                ...options,

                headers: {
                    "Accept":
                        "application/json",

                    "Content-Type":
                        "application/json",

                    ...(options.headers || {})
                }
            }
        );


    let data = null;

    try {

        data =
            await response.json();

    } catch (error) {

        data = null;
    }


    if (!response.ok) {

        const backendMessage =
            data?.message ||
            data?.error ||
            `Server returned HTTP ${response.status}.`;

        throw new Error(
            backendMessage
        );
    }


    if (
        data &&
        data.success === false
    ) {

        throw new Error(
            data.message ||
            data.error ||
            "The investment request was rejected."
        );
    }


    return data;
}


/* =========================================================
   INVESTMENT BUTTONS
========================================================= */

function setupInvestmentButtons() {

    const buttons =
        document.querySelectorAll(
            ".invest-btn, .investment-btn, [data-plan]"
        );


    buttons.forEach(
        (button) => {

            button.addEventListener(
                "click",
                function (event) {

                    event.preventDefault();

                    const plan =
                        getPlanFromButton(
                            this
                        );


                    if (!plan) {

                        showMessage(
                            "Investment Failed",
                            "The selected investment plan could not be identified.",
                            "error"
                        );

                        return;
                    }


                    confirmInvestment(
                        plan
                    );

                }
            );

        }
    );

}


/* =========================================================
   GET PLAN FROM BUTTON
========================================================= */

function getPlanFromButton(
    button
) {

    let planKey =
        button.dataset.plan ||
        button.dataset.package ||
        button.dataset.planName ||
        "";


    planKey =
        String(planKey)
            .trim()
            .toLowerCase();


    if (
        PLANS[planKey]
    ) {

        return planKey;
    }


    const text =
        button.textContent
            .toLowerCase();


    if (
        text.includes("starter")
    ) {

        return "starter";
    }


    if (
        text.includes("standard")
    ) {

        return "standard";
    }


    if (
        text.includes("advanced")
    ) {

        return "advanced";
    }


    const amount =
        button.dataset.amount;


    if (
        amount === "10000"
    ) {

        return "starter";
    }


    if (
        amount === "15000"
    ) {

        return "standard";
    }


    if (
        amount === "25000"
    ) {

        return "advanced";
    }


    return null;
}


/* =========================================================
   GLOBAL selectPlan()
   Supports existing HTML:

   onclick="selectPlan('Starter Plan',10000,10,30)"
========================================================= */

window.selectPlan =
function (
    planName,
    minimum,
    rate,
    duration
) {

    const name =
        String(
            planName || ""
        )
        .toLowerCase();


    let planKey = null;


    if (
        name.includes("starter")
    ) {

        planKey =
            "starter";

    } else if (
        name.includes("standard")
    ) {

        planKey =
            "standard";

    } else if (
        name.includes("advanced")
    ) {

        planKey =
            "advanced";

    } else {

        if (
            Number(minimum) === 10000
        ) {

            planKey =
                "starter";

        } else if (
            Number(minimum) === 15000
        ) {

            planKey =
                "standard";

        } else if (
            Number(minimum) === 25000
        ) {

            planKey =
                "advanced";
        }
    }


    if (!planKey) {

        showMessage(
            "Investment Failed",
            "Invalid investment plan selected.",
            "error"
        );

        return;
    }


    confirmInvestment(
        planKey
    );
};


/* =========================================================
   CONFIRM INVESTMENT
========================================================= */

async function confirmInvestment(
    planKey
) {

    const plan =
        PLANS[planKey];


    if (!plan) {

        showMessage(
            "Investment Failed",
            "Invalid investment plan.",
            "error"
        );

        return;
    }


    const confirmed =
        window.confirm(
            `Confirm ${plan.name}\n\n` +
            `Investment Amount: UGX ${formatMoney(plan.amount)}\n` +
            `Daily Return: ${plan.rate}%\n` +
            `Duration: ${plan.days} days\n\n` +
            `UGX ${formatMoney(plan.amount)} will be deducted from your Crown Cash wallet.\n\n` +
            `Do you want to continue?`
        );


    if (!confirmed) {

        return;
    }


    await createInvestment(
        planKey
    );

}


/* =========================================================
   CREATE INVESTMENT
========================================================= */

async function createInvestment(
    planKey
) {

    const plan =
        PLANS[planKey];


    if (!plan) {

        return;
    }


    showMessage(
        "Creating Investment",
        "Please wait while your investment is being created...",
        "info"
    );


    try {

        const data =
            await fetchJson(
                INVESTMENT_API,
                {
                    method: "POST",

                    body: JSON.stringify({

                        plan:
                            planKey,

                        plan_name:
                            plan.name,

                        amount:
                            plan.amount

                    })
                }
            );


        console.log(
            "Crown Cash investment response:",
            data
        );


        if (
            !data ||
            data.success !== true
        ) {

            throw new Error(
                data?.message ||
                data?.error ||
                "Unable to create investment."
            );
        }


        const newBalance =
            Number(
                data?.wallet?.new_balance ??
                data?.new_balance
            );


        showMessage(
            "Investment Created",
            data.message ||
            `${plan.name} was created successfully.`,
            "success"
        );


        /*
         * Update wallet immediately if the backend
         * returned the new balance.
         */

        if (
            Number.isFinite(
                newBalance
            )
        ) {

            updateWalletDisplay(
                newBalance
            );
        }


        /*
         * Give the success message time to display,
         * then open My Investments.
         */

        setTimeout(
            () => {

                window.location.href =
                    "my-investments.html";

            },
            1200
        );


    } catch (error) {

        console.error(
            "Crown Cash investment error:",
            error
        );


        /*
         * IMPORTANT:
         * Show the REAL backend message.
         * This will expose the exact reason if the
         * server rejects the investment.
         */

        showMessage(
            "Investment Failed",
            error?.message ||
            "Unable to create investment.",
            "error"
        );

    }

}


/* =========================================================
   LOAD WALLET BALANCE
========================================================= */

async function loadWalletBalance() {

    try {

        const response =
            await fetch(
                PROFILE_API,
                {
                    method: "GET",
                    credentials: "include",
                    headers: {
                        "Accept":
                            "application/json"
                    }
                }
            );


        if (!response.ok) {

            return;
        }


        const data =
            await response.json();


        if (
            data?.success === false
        ) {

            return;
        }


        const user =
            data.user ||
            data.profile ||
            data;


        const balance =
            Number(
                user?.balance ??
                user?.wallet_balance ??
                user?.walletBalance ??
                user?.wallet?.balance ??
                data?.balance ??
                data?.wallet_balance
            );


        if (
            Number.isFinite(balance)
        ) {

            updateWalletDisplay(
                balance
            );
        }

    } catch (error) {

        console.warn(
            "Wallet balance could not be loaded:",
            error
        );

    }

}


/* =========================================================
   UPDATE WALLET DISPLAY
========================================================= */

function updateWalletDisplay(
    balance
) {

    const elements =
        document.querySelectorAll(
            "#availableBalance, #walletBalance, .wallet-balance"
        );


    elements.forEach(
        (element) => {

            element.textContent =
                `UGX ${formatMoney(balance)}`;

        }
    );

}


/* =========================================================
   CALCULATOR
========================================================= */

function setupCalculator() {

    const amountInput =
        document.getElementById(
            "investmentAmount"
        );


    const dailyReturn =
        document.getElementById(
            "dailyReturn"
        );


    const monthlyReturn =
        document.getElementById(
            "monthlyReturn"
        );


    const totalAfter30 =
        document.getElementById(
            "totalAfter30"
        );


    if (!amountInput) {

        return;
    }


    function calculate() {

        const amount =
            Number(
                amountInput.value
            ) || 0;


        const rate =
            Number(
                dailyReturn?.value
            ) || 10;


        const daily =
            amount *
            (rate / 100);


        const thirtyDayIncome =
            daily *
            30;


        const total =
            amount +
            thirtyDayIncome;


        if (monthlyReturn) {

            monthlyReturn.textContent =
                `UGX ${formatMoney(
                    thirtyDayIncome
                )}`;

        }


        /*
         * Some versions of the page use a separate
         * daily income element.
         */

        const dailyIncome =
            document.getElementById(
                "dailyIncome"
            );


        if (dailyIncome) {

            dailyIncome.textContent =
                `UGX ${formatMoney(
                    daily
                )}`;

        }


        if (totalAfter30) {

            totalAfter30.textContent =
                `UGX ${formatMoney(
                    total
                )}`;

        }

    }


    amountInput.addEventListener(
        "input",
        calculate
    );


    dailyReturn?.addEventListener(
        "input",
        calculate
    );


    calculate();

}


/* =========================================================
   MOBILE MENU
========================================================= */

function setupMobileMenu() {

    const menuButton =
        document.getElementById(
            "menuBtn"
        ) ||
        document.getElementById(
            "menuToggle"
        );


    const sidebar =
        document.querySelector(
            ".sidebar"
        );


    if (
        !menuButton ||
        !sidebar
    ) {

        return;
    }


    menuButton.addEventListener(
        "click",
        () => {

            sidebar.classList.toggle(
                "active"
            );

        }
    );

}


/* =========================================================
   LOGOUT
========================================================= */

function setupLogout() {

    const logoutButtons =
        document.querySelectorAll(
            "#logoutBtn, .logout-btn, [data-logout]"
        );


    logoutButtons.forEach(
        (button) => {

            button.addEventListener(
                "click",
                async function (event) {

                    event.preventDefault();


                    try {

                        await fetch(
                            LOGOUT_API,
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


                    window.location.href =
                        "index.html";

                }
            );

        }
    );

}


/* =========================================================
   MESSAGE / TOAST
========================================================= */

function showMessage(
    title,
    message,
    type = "info"
) {

    /*
     * Remove existing Crown Cash message.
     */

    const existing =
        document.getElementById(
            "crownCashMessage"
        );


    if (existing) {

        existing.remove();
    }


    const box =
        document.createElement(
            "div"
        );


    box.id =
        "crownCashMessage";


    box.className =
        `crown-cash-message ${type}`;


    box.innerHTML = `

        <div class="crown-cash-message-title">
            ${escapeHtml(title)}
        </div>

        <div class="crown-cash-message-text">
            ${escapeHtml(message)}
        </div>

    `;


    document.body.appendChild(
        box
    );


    setTimeout(
        () => {

            box.classList.add(
                "show"
            );

        },
        10
    );


    if (
        type !== "error"
    ) {

        setTimeout(
            () => {

                box.classList.remove(
                    "show"
                );

                setTimeout(
                    () => {

                        box.remove();

                    },
                    300
                );

            },
            3500
        );

    }

}


/* =========================================================
   ESCAPE HTML
========================================================= */

function escapeHtml(
    value
) {

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


/* =========================================================
   FORMAT MONEY
========================================================= */

function formatMoney(
    amount
) {

    return Number(
        amount || 0
    ).toLocaleString(
        "en-UG",
        {
            maximumFractionDigits: 0
        }
    );

}


/* =========================================================
   GLOBAL INVEST NOW
========================================================= */

window.investNow =
function (
    planKey
) {

    confirmInvestment(
        planKey
    );

};