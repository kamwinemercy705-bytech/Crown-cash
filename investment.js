/* =========================================================
   CROWN CASH — INVESTMENT.JS
   Production Version
   ========================================================= */

"use strict";

/* =========================================================
   API
   ========================================================= */

const INVESTMENT_API =
    "https://crown-cash1.onrender.com/investment.php";

const DASHBOARD_API =
    "https://crown-cash1.onrender.com/dashboard.php";


/* =========================================================
   HELPERS
   ========================================================= */

function byId(id) {
    return document.getElementById(id);
}


function money(value) {

    const number = Number(value);

    if (!Number.isFinite(number)) {
        return "UGX 0";
    }

    return (
        "UGX " +
        Math.round(number).toLocaleString("en-UG")
    );
}


function numberValue(value) {

    const number = Number(value);

    return Number.isFinite(number)
        ? number
        : 0;
}


function firstValue(object, keys, fallback = null) {

    if (!object || typeof object !== "object") {
        return fallback;
    }

    for (const key of keys) {

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
   SHOW MESSAGE
   ========================================================= */

function showMessage(message, type = "info") {

    const messageElement =
        byId("investmentMessage");

    if (!messageElement) {
        alert(message);
        return;
    }

    messageElement.textContent =
        String(message);

    messageElement.className =
        "investment-message " + type;

    messageElement.style.display =
        "block";
}


/* =========================================================
   HIDE MESSAGE
   ========================================================= */

function hideMessage() {

    const messageElement =
        byId("investmentMessage");

    if (!messageElement) {
        return;
    }

    messageElement.textContent = "";

    messageElement.style.display =
        "none";
}


/* =========================================================
   GET INVESTMENT AMOUNT
   ========================================================= */

function getInvestmentAmount() {

    const amountInput =
        byId("investmentAmount");

    if (!amountInput) {
        return 0;
    }

    return numberValue(
        amountInput.value
    );
}


/* =========================================================
   UPDATE WALLET DISPLAY
   ========================================================= */

function updateWalletDisplay(balance) {

    const amount =
        numberValue(balance);


    const possibleIds = [
        "availableBalance",
        "walletBalance",
        "balance",
        "currentBalance",
        "userBalance"
    ];


    possibleIds.forEach(function (id) {

        const element =
            byId(id);

        if (!element) {
            return;
        }

        element.textContent =
            money(amount);

        element.dataset.value =
            String(amount);
    });
}


/* =========================================================
   LOAD CURRENT WALLET
   ========================================================= */

async function loadWalletBalance() {

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


        updateWalletDisplay(
            balance
        );


        return numberValue(
            balance
        );

    } catch (error) {

        console.error(
            "Wallet loading error:",
            error
        );

        return null;
    }
}


/* =========================================================
   SET BUTTON LOADING
   ========================================================= */

function setInvestmentButtonLoading(
    loading
) {

    const button =
        byId("investmentSubmit") ||
        byId("investButton") ||
        byId("submitInvestment");


    if (!button) {
        return;
    }


    if (loading) {

        if (!button.dataset.originalText) {

            button.dataset.originalText =
                button.textContent;
        }

        button.disabled = true;

        button.textContent =
            "Processing Investment...";

    } else {

        button.disabled = false;

        button.textContent =
            button.dataset.originalText ||
            "Invest";
    }
}


/* =========================================================
   FIND SELECTED PLAN
   ========================================================= */

function getSelectedPlan() {

    /*
     * Supports either a select element or
     * radio buttons.
     */

    const select =
        byId("investmentPlan") ||
        byId("plan");


    if (select && select.value) {

        return String(
            select.value
        ).trim().toLowerCase();
    }


    const checked =
        document.querySelector(
            'input[name="plan"]:checked'
        );


    if (checked && checked.value) {

        return String(
            checked.value
        ).trim().toLowerCase();
    }


    const checkedPlan =
        document.querySelector(
            'input[name="investmentPlan"]:checked'
        );


    if (
        checkedPlan &&
        checkedPlan.value
    ) {

        return String(
            checkedPlan.value
        ).trim().toLowerCase();
    }


    return "";
}


/* =========================================================
   SUBMIT INVESTMENT
   ========================================================= */

async function submitInvestment() {

    hideMessage();


    const amount =
        getInvestmentAmount();


    const plan =
        getSelectedPlan();


    /*
     * Validate amount.
     */

    if (!Number.isFinite(amount) || amount <= 0) {

        showMessage(
            "Please enter a valid investment amount.",
            "error"
        );

        return;
    }


    /*
     * Crown Cash investment rules.
     */

    if (amount < 10000) {

        showMessage(
            "The minimum investment is UGX 10,000.",
            "error"
        );

        return;
    }


    if (amount % 1000 !== 0) {

        showMessage(
            "Investment amount must be in multiples of UGX 1,000.",
            "error"
        );

        return;
    }


    /*
     * Check current wallet before
     * submitting.
     */

    const currentBalance =
        await loadWalletBalance();


    if (
        currentBalance !== null &&
        amount > currentBalance
    ) {

        showMessage(
            "Insufficient wallet balance. Your available balance is " +
            money(currentBalance) +
            ".",
            "error"
        );

        return;
    }


    setInvestmentButtonLoading(true);


    try {

        const payload = {

            amount: amount,

            currency: "UGX",

            plan: plan,

            plan_name: plan,

            investment_amount: amount
        };


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
                        JSON.stringify(payload)
                }
            );


        let data = null;


        try {

            data =
                await response.json();

        } catch (error) {

            data = null;
        }


        /*
         * Authentication failure.
         */

        if (response.status === 401) {

            showMessage(
                "Your session has expired. Please log in again.",
                "error"
            );

            setTimeout(
                function () {

                    window.location.href =
                        "login.html";

                },
                1200
            );

            return;
        }


        /*
         * Backend rejected request.
         */

        if (!response.ok) {

            const message =
                data?.message ||
                data?.error ||
                "Investment could not be completed.";

            showMessage(
                message,
                "error"
            );

            return;
        }


        /*
         * Backend may explicitly return
         * success false.
         */

        if (
            data &&
            data.success === false
        ) {

            showMessage(
                data.message ||
                "Investment could not be completed.",
                "error"
            );

            return;
        }


        /*
         * IMPORTANT:
         *
         * investment.php returns:
         *
         * previous_balance
         * amount_deducted
         * new_balance
         *
         * We MUST use new_balance.
         *
         * We do NOT add the investment amount
         * to the wallet.
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
                    "balance"
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
         * Update wallet immediately
         * using backend's actual balance.
         */

        if (newBalance !== null) {

            updateWalletDisplay(
                newBalance
            );

        } else {

            /*
             * If backend did not return the
             * new balance, reload it from
             * dashboard.php.
             */

            await loadWalletBalance();
        }


        /*
         * Success message.
         */

        showMessage(
            data?.message ||
            "Investment submitted successfully. Your investment is pending admin approval.",
            "success"
        );


        /*
         * Clear amount field.
         */

        const amountInput =
            byId("investmentAmount");

        if (amountInput) {

            amountInput.value = "";

            amountInput.dispatchEvent(
                new Event("input", {
                    bubbles: true
                })
            );
        }


        /*
         * Refresh wallet from backend after
         * a short delay to guarantee that the
         * displayed value matches the database.
         */

        setTimeout(
            async function () {

                await loadWalletBalance();

            },
            800
        );


        /*
         * Refresh investment history if
         * the page has such a function.
         */

        if (
            typeof window.loadInvestments ===
            "function"
        ) {

            try {

                await window.loadInvestments();

            } catch (error) {

                console.error(
                    "Investment history refresh error:",
                    error
                );
            }
        }


    } catch (error) {

        console.error(
            "Investment submission error:",
            error
        );


        showMessage(
            "Unable to connect to the investment server. Please try again.",
            "error"
        );

    } finally {

        setInvestmentButtonLoading(
            false
        );
    }
}


/* =========================================================
   INVESTMENT FORM
   ========================================================= */

function setupInvestmentForm() {

    const form =
        byId("investmentForm");


    if (form) {

        form.addEventListener(
            "submit",
            function (event) {

                event.preventDefault();

                submitInvestment();
            }
        );

        return;
    }


    /*
     * If the page does not use a form,
     * attach directly to the investment
     * button.
     */

    const button =
        byId("investmentSubmit") ||
        byId("investButton") ||
        byId("submitInvestment");


    if (button) {

        button.addEventListener(
            "click",
            function (event) {

                event.preventDefault();

                submitInvestment();
            }
        );
    }
}


/* =========================================================
   PLAN SELECTION
   ========================================================= */

function setupPlanSelection() {

    const planInputs =
        document.querySelectorAll(
            'input[name="plan"], input[name="investmentPlan"]'
        );


    planInputs.forEach(
        function (input) {

            input.addEventListener(
                "change",
                function () {

                    const amountInput =
                        byId("investmentAmount");


                    /*
                     * Only automatically fill the
                     * amount when a known fixed plan
                     * is selected.
                     */

                    const value =
                        String(
                            input.value || ""
                        ).toLowerCase();


                    const planAmounts = {

                        starter: 10000,

                        standard: 15000,

                        advanced: 25000
                    };


                    if (
                        amountInput &&
                        planAmounts[value]
                    ) {

                        amountInput.value =
                            planAmounts[value];

                        amountInput.dispatchEvent(
                            new Event(
                                "input",
                                {
                                    bubbles: true
                                }
                            )
                        );
                    }
                }
            );
        }
    );
}


/* =========================================================
   DOM READY
   ========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    async function () {

        setupInvestmentForm();

        setupPlanSelection();

        /*
         * Load the real wallet balance.
         */

        await loadWalletBalance();
    }
);


/* =========================================================
   GLOBAL FUNCTIONS
   ========================================================= */

window.submitInvestment =
    submitInvestment;

window.loadWalletBalance =
    loadWalletBalance;