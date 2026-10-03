/* =========================================================
   CROWN CASH — INVESTMENTS.JS
   Production Investment Version
   ========================================================= */

"use strict";


/* =========================================================
   API
   ========================================================= */

const API_URL =
    "https://crown-cash1.onrender.com";


const INVESTMENT_API =
    `${API_URL}/investment.php`;

const DASHBOARD_API =
    `${API_URL}/dashboard.php`;


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
    function () {

        setupMobileMenu();

        setupLogout();

        calculateInvestment();

    }
);


/* =========================================================
   INVESTMENT
   ========================================================= */

/*
 * This is the ONLY function that starts an investment.
 *
 * It sends the investment directly to:
 *
 * investment.php
 *
 * The backend is responsible for:
 *
 * 1. Checking login
 * 2. Checking wallet balance
 * 3. Deducting the investment amount
 * 4. Creating the investment
 * 5. Recording the transaction
 * 6. Returning the new wallet balance
 *
 */

async function createInvestment(planKey) {

    const plan =
        PLANS[planKey];


    if (!plan) {

        showMessage(
            "Invalid investment plan.",
            "error"
        );

        return;
    }


    /*
     * Confirm with user before submitting.
     */

    const confirmed =
        window.confirm(

            `You selected the ${plan.name}.\n\n` +

            `Investment amount: UGX ${formatMoney(plan.amount)}\n` +

            `Daily return rate: ${plan.rate}%\n` +

            `Investment period: ${plan.days} days\n\n` +

            `Do you want to continue?`
        );


    if (!confirmed) {
        return;
    }


    /*
     * Get all investment buttons.
     */

    const buttons =
        document.querySelectorAll(
            ".invest-btn"
        );


    setButtonsLoading(
        buttons,
        true
    );


    showMessage(
        "Checking your wallet balance...",
        "info"
    );


    try {

        /*
         * First get the actual current
         * wallet balance.
         */

        const wallet =
            await getWalletBalance();


        if (
            wallet !== null &&
            plan.amount > wallet
        ) {

            throw new Error(

                "Insufficient wallet balance.\n\n" +

                `Required: UGX ${formatMoney(plan.amount)}\n` +

                `Available: UGX ${formatMoney(wallet)}`
            );
        }


        showMessage(
            "Submitting your investment...",
            "info"
        );


        /*
         * IMPORTANT:
         *
         * We send the plan key and amount
         * directly to investment.php.
         */

        const response =
            await fetch(
                INVESTMENT_API,
                {
                    method: "POST",

                    credentials: "include",

                    cache: "no-store",

                    headers: {

                        "Content-Type":
                            "application/json",

                        "Accept":
                            "application/json"
                    },

                    body:
                        JSON.stringify({

                            plan:
                                planKey,

                            plan_name:
                                plan.name,

                            amount:
                                plan.amount,

                            currency:
                                "UGX",

                            duration:
                                plan.days,

                            duration_days:
                                plan.days,

                            daily_rate:
                                0.10
                        })
                }
            );


        let data = null;


        try {

            data =
                await response.json();

        } catch (error) {

            throw new Error(
                "The investment server returned an invalid response."
            );
        }


        console.log(
            "Crown Cash investment response:",
            data
        );


        /*
         * Login/session failure.
         */

        if (response.status === 401) {

            throw new Error(
                "Your session has expired. Please log in again."
            );
        }


        /*
         * Backend failure.
         */

        if (!response.ok) {

            throw new Error(

                data?.message ||

                data?.error ||

                "Unable to create the investment."
            );
        }


        /*
         * Backend may explicitly return
         * success false.
         */

        if (
            data &&
            data.success === false
        ) {

            throw new Error(

                data.message ||

                "Investment could not be completed."
            );
        }


        /*
         * =============================================
         * CRITICAL WALLET LOGIC
         * =============================================
         *
         * investment.php returns the wallet AFTER
         * deducting the investment.
         *
         * Example:
         *
         * Before = 40,000
         * Investment = 10,000
         * After = 30,000
         *
         * We MUST display new_balance.
         *
         * We must NEVER add the investment amount.
         */

        const walletData =
            data?.wallet ||
            data?.data?.wallet ||
            {};


        const newBalance =
            firstValue(
                walletData,
                [
                    "new_balance",
                    "newBalance",
                    "balance_after",
                    "balanceAfter"
                ],
                firstValue(
                    data,
                    [
                        "new_balance",
                        "newBalance",
                        "balance_after",
                        "balanceAfter"
                    ],
                    null
                )
            );


        /*
         * Update wallet if backend returned
         * the new balance.
         */

        if (newBalance !== null) {

            updateWalletDisplays(
                newBalance
            );

        } else {

            /*
             * If no balance was returned,
             * reload the actual dashboard balance.
             */

            await getWalletBalance();
        }


        /*
         * Investment successfully created.
         */

        showMessage(

            data?.message ||

            "Investment submitted successfully. Your investment is now pending admin approval.",

            "success"
        );


        /*
         * Show reference if supplied.
         */

        const investment =
            data?.investment ||
            data?.data?.investment ||
            {};


        const reference =
            firstValue(
                investment,
                [
                    "reference",
                    "investment_reference",
                    "investmentReference"
                ],
                firstValue(
                    data,
                    [
                        "reference",
                        "investment_reference"
                    ],
                    null
                )
            );


        if (reference) {

            setTimeout(
                function () {

                    alert(

                        "Investment submitted successfully.\n\n" +

                        `Reference: ${reference}\n` +

                        "Status: Pending approval."
                    );

                },
                300
            );
        }


        /*
         * Refresh the real wallet from the
         * backend shortly afterwards.
         */

        setTimeout(
            function () {

                getWalletBalance();

            },
            800
        );


        /*
         * Do NOT automatically redirect to
         * deposit.html.
         *
         * The investment has already been
         * submitted through investment.php.
         *
         * Send the user to My Investments
         * after successful submission.
         */

        setTimeout(
            function () {

                window.location.href =
                    "my-investments.html";

            },
            1800
        );


    } catch (error) {

        console.error(
            "Crown Cash investment error:",
            error
        );


        showMessage(
            error.message ||
            "Unable to submit the investment.",
            "error"
        );


    } finally {

        setButtonsLoading(
            buttons,
            false
        );
    }

}


/* =========================================================
   SELECT PLAN
   ========================================================= */

/*
 * This function is kept because your existing
 * investments.html buttons currently use:
 *
 * onclick="selectPlan(...)"
 *
 * We support those buttons without redirecting
 * to deposit.html.
 */

window.selectPlan =
    function (
        planName,
        amount,
        rate,
        duration
    ) {

        let planKey = "";


        const normalized =
            String(
                planName || ""
            )
            .toLowerCase()
            .trim();


        if (
            normalized.includes("starter")
        ) {

            planKey = "starter";

        } else if (
            normalized.includes("standard")
        ) {

            planKey = "standard";

        } else if (
            normalized.includes("advanced")
        ) {

            planKey = "advanced";
        }


        /*
         * If the name wasn't recognized,
         * try the amount.
         */

        if (!planKey) {

            const numericAmount =
                Number(amount);


            if (
                numericAmount === 10000
            ) {

                planKey = "starter";

            } else if (
                numericAmount === 15000
            ) {

                planKey = "standard";

            } else if (
                numericAmount === 25000
            ) {

                planKey = "advanced";
            }
        }


        if (!planKey) {

            showMessage(
                "Unable to identify the selected investment plan.",
                "error"
            );

            return;
        }


        createInvestment(
            planKey
        );
    };


/* =========================================================
   COMPATIBILITY FUNCTION
   ========================================================= */

window.investNow =
    function (plan) {

        let planKey =
            String(
                plan || ""
            )
            .toLowerCase()
            .trim();


        if (
            planKey.includes("starter")
        ) {

            planKey = "starter";

        } else if (
            planKey.includes("standard")
        ) {

            planKey = "standard";

        } else if (
            planKey.includes("advanced")
        ) {

            planKey = "advanced";
        }


        if (!PLANS[planKey]) {

            showMessage(
                "Invalid investment plan.",
                "error"
            );

            return;
        }


        createInvestment(
            planKey
        );
    };


/* =========================================================
   WALLET
   ========================================================= */

async function getWalletBalance() {

    try {

        const response =
            await fetch(
                DASHBOARD_API +
                "?_=" +
                Date.now(),
                {
                    method: "GET",

                    credentials: "include",

                    cache: "no-store",

                    headers: {
                        "Accept":
                            "application/json"
                    }
                }
            );


        if (response.status === 401) {

            window.location.href =
                "login.html";

            return null;
        }


        if (!response.ok) {

            return null;
        }


        const data =
            await response.json();


        const wallet =
            data?.wallet ||
            data?.data?.wallet ||
            {};


        const balance =
            firstValue(
                wallet,
                [
                    "available",
                    "available_balance",
                    "availableBalance",
                    "balance",
                    "wallet_balance",
                    "walletBalance"
                ],
                firstValue(
                    data,
                    [
                        "available_balance",
                        "availableBalance",
                        "balance",
                        "wallet_balance",
                        "walletBalance"
                    ],
                    0
                )
            );


        const numericBalance =
            Number(balance);


        updateWalletDisplays(
            numericBalance
        );


        return Number.isFinite(
            numericBalance
        )
            ? numericBalance
            : 0;


    } catch (error) {

        console.error(
            "Wallet balance error:",
            error
        );

        return null;
    }
}


/* =========================================================
   UPDATE WALLET DISPLAYS
   ========================================================= */

function updateWalletDisplays(
    balance
) {

    const amount =
        Number(balance);


    if (!Number.isFinite(amount)) {
        return;
    }


    const walletElements =
        document.querySelectorAll(
            "#availableBalance, #walletBalance, #currentBalance, #userBalance"
        );


    walletElements.forEach(
        function (element) {

            element.textContent =
                "UGX " +
                Math.round(
                    amount
                ).toLocaleString(
                    "en-UG"
                );

            element.dataset.value =
                String(amount);

        }
    );
}


/* =========================================================
   FIRST VALUE
   ========================================================= */

function firstValue(
    object,
    keys,
    fallback = null
) {

    if (
        !object ||
        typeof object !== "object"
    ) {

        return fallback;
    }


    for (
        const key of keys
    ) {

        if (
            object[key] !== undefined &&
            object[key] !== null &&
            object[key] !== ""
        ) {

            return object[key];
        }
    }


    return fallback;
}


/* =========================================================
   BUTTON LOADING
   ========================================================= */

function setButtonsLoading(
    buttons,
    loading
) {

    buttons.forEach(
        function (button) {

            if (loading) {

                if (
                    !button.dataset.originalText
                ) {

                    button.dataset.originalText =
                        button.innerHTML;
                }


                button.disabled =
                    true;


                button.innerHTML =
                    '<i class="fa-solid fa-spinner fa-spin"></i> Processing...';

            } else {

                button.disabled =
                    false;


                if (
                    button.dataset.originalText
                ) {

                    button.innerHTML =
                        button.dataset.originalText;
                }
            }
        }
    );
}


/* =========================================================
   MESSAGE
   ========================================================= */

function showMessage(
    message,
    type = "info"
) {

    let messageBox =
        document.getElementById(
            "investmentMessage"
        );


    if (!messageBox) {

        messageBox =
            document.createElement(
                "div"
            );


        messageBox.id =
            "investmentMessage";


        messageBox.style.margin =
            "20px 0";


        messageBox.style.padding =
            "14px 18px";


        messageBox.style.borderRadius =
            "12px";


        messageBox.style.fontWeight =
            "600";


        messageBox.style.whiteSpace =
            "pre-line";


        const container =
            document.querySelector(
                ".main-content"
            ) ||
            document.querySelector(
                "main"
            ) ||
            document.body;


        container.prepend(
            messageBox
        );
    }


    messageBox.textContent =
        message;


    messageBox.className =
        "investment-message " +
        type;


    messageBox.style.display =
        "block";


    if (
        type === "success"
    ) {

        messageBox.style.background =
            "rgba(0, 200, 120, 0.12)";

        messageBox.style.border =
            "1px solid rgba(0, 200, 120, 0.35)";

        messageBox.style.color =
            "#58e6a8";


    } else if (
        type === "error"
    ) {

        messageBox.style.background =
            "rgba(255, 70, 90, 0.12)";

        messageBox.style.border =
            "1px solid rgba(255, 70, 90, 0.35)";

        messageBox.style.color =
            "#ff7b8a";


    } else {

        messageBox.style.background =
            "rgba(140, 80, 255, 0.12)";

        messageBox.style.border =
            "1px solid rgba(140, 80, 255, 0.35)";

        messageBox.style.color =
            "#c9a7ff";
    }
}


/* =========================================================
   MONEY FORMAT
   ========================================================= */

function formatMoney(
    amount
) {

    const number =
        Number(amount);


    if (
        !Number.isFinite(number)
    ) {

        return "0";
    }


    return Math.round(
        number
    ).toLocaleString(
        "en-UG"
    );
}


/* =========================================================
   CALCULATOR
   ========================================================= */

function calculateInvestment() {

    const input =
        document.getElementById(
            "investmentAmount"
        );


    if (!input) {
        return;
    }


    const amount =
        Number(input.value) || 0;


    const dailyRate =
        0.10;


    const days =
        30;


    const daily =
        amount * dailyRate;


    const monthly =
        daily * days;


    const total =
        amount + monthly;


    const dailyElement =
        document.getElementById(
            "dailyReturn"
        );


    const monthlyElement =
        document.getElementById(
            "monthlyReturn"
        );


    const totalElement =
        document.getElementById(
            "totalAfter30"
        );


    if (dailyElement) {

        dailyElement.textContent =
            "UGX " +
            Math.round(
                daily
            ).toLocaleString();
    }


    if (monthlyElement) {

        monthlyElement.textContent =
            "UGX " +
            Math.round(
                monthly
            ).toLocaleString();
    }


    if (totalElement) {

        totalElement.textContent =
            "UGX " +
            Math.round(
                total
            ).toLocaleString();
    }
}


/* =========================================================
   MOBILE MENU
   ========================================================= */

function setupMobileMenu() {

    /*
     * Your HTML uses menuBtn, not menuToggle.
     */

    const menuButton =
        document.getElementById(
            "menuBtn"
        );


    const sidebar =
        document.getElementById(
            "sidebar"
        );


    if (
        !menuButton ||
        !sidebar
    ) {

        return;
    }


    menuButton.addEventListener(
        "click",
        function () {

            sidebar.classList.toggle(
                "open"
            );


            sidebar.classList.toggle(
                "active"
            );


            const icon =
                menuButton.querySelector(
                    "i"
                );


            if (
                icon &&
                (
                    sidebar.classList.contains(
                        "open"
                    ) ||
                    sidebar.classList.contains(
                        "active"
                    )
                )
            ) {

                icon.classList.remove(
                    "fa-bars"
                );

                icon.classList.add(
                    "fa-xmark"
                );

            } else if (icon) {

                icon.classList.remove(
                    "fa-xmark"
                );

                icon.classList.add(
                    "fa-bars"
                );
            }

        }
    );


    const links =
        sidebar.querySelectorAll(
            "a"
        );


    links.forEach(
        function (link) {

            link.addEventListener(
                "click",
                function () {

                    sidebar.classList.remove(
                        "open"
                    );

                    sidebar.classList.remove(
                        "active"
                    );
                }
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
            ".logout, .logout-btn, #logoutBtn"
        );


    logoutButtons.forEach(
        function (button) {

            button.addEventListener(
                "click",
                async function (event) {

                    event.preventDefault();


                    try {

                        await fetch(
                            `${API_URL}/logout.php`,
                            {
                                method:
                                    "POST",

                                credentials:
                                    "include",

                                cache:
                                    "no-store",

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

                    } finally {

                        localStorage.removeItem(
                            "crownCashUser"
                        );

                        localStorage.removeItem(
                            "currentUser"
                        );


                        window.location.href =
                            "login.html";
                    }

                }
            );
        }
    );
}


/* =========================================================
   GLOBAL API
   ========================================================= */

window.CrownCashInvestments = {

    plans: PLANS,

    invest:
        createInvestment,

    confirm:
        createInvestment,

    formatMoney:
        formatMoney,

    getWalletBalance:
        getWalletBalance

};