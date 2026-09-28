/* =========================================================
   CROWN CASH - DEPOSIT JAVASCRIPT
   ========================================================= */

"use strict";

/* =========================================================
   CONFIGURATION
   ========================================================= */

const API_BASE = "https://crown-cash1.onrender.com";
const DEPOSIT_API = `${API_BASE}/deposit.php`;

/*
 * Crown Cash merchant accounts
 */
const MERCHANT_CODES = {
    mtn: "80257065",
    airtel: "7229487"
};


/* =========================================================
   DOM ELEMENTS
   ========================================================= */

const depositForm = document.getElementById("depositForm");
const amountInput = document.getElementById("amount");
const transactionReferenceInput =
    document.getElementById("transactionReference");

const depositButton = document.getElementById("depositButton");

const availableBalance =
    document.getElementById("availableBalance");

const merchantCode =
    document.getElementById("merchantCode");

const copyMerchantCodeButton =
    document.getElementById("copyMerchantCode");

const paymentDetailsTitle =
    document.getElementById("paymentDetailsTitle");

const paymentDetailsText =
    document.getElementById("paymentDetailsText");

const depositHistory =
    document.getElementById("depositHistory");

const formMessage =
    document.getElementById("formMessage") ||
    document.getElementById("depositMessage") ||
    document.getElementById("message");


/* =========================================================
   PAYMENT METHOD ELEMENTS
   ========================================================= */

const paymentMethodInputs =
    document.querySelectorAll(
        'input[name="paymentMethod"], input[name="payment_method"], input[type="radio"][value="mtn"], input[type="radio"][value="airtel"]'
    );


/* =========================================================
   HELPERS
   ========================================================= */

function showMessage(message, type = "info") {
    if (!formMessage) return;

    formMessage.textContent = message;

    formMessage.className = "admin-message";

    if (type === "success") {
        formMessage.classList.add("success");
    } else if (type === "error") {
        formMessage.classList.add("error");
    } else {
        formMessage.classList.add("info");
    }

    formMessage.style.display = "block";
}


function clearMessage() {
    if (!formMessage) return;

    formMessage.textContent = "";
    formMessage.style.display = "none";
}


function formatCurrency(amount) {
    const number = Number(amount || 0);

    return new Intl.NumberFormat("en-UG", {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(number);
}


function escapeHTML(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


/* =========================================================
   GET SELECTED PAYMENT METHOD
   ========================================================= */

function getSelectedPaymentMethod() {
    const selected = document.querySelector(
        'input[name="paymentMethod"]:checked, input[name="payment_method"]:checked'
    );

    if (selected) {
        return String(selected.value).toLowerCase();
    }

    return "";
}


/* =========================================================
   UPDATE MERCHANT CODE
   ========================================================= */

function updateMerchantCode() {

    const method = getSelectedPaymentMethod();

    if (!merchantCode) {
        return;
    }

    /*
     * Nothing selected
     */
    if (!method) {

        merchantCode.textContent = "—";

        if (paymentDetailsTitle) {
            paymentDetailsTitle.textContent =
                "Select a payment method";
        }

        if (paymentDetailsText) {
            paymentDetailsText.textContent =
                "Select MTN Mobile Money or Airtel Money above to view the payment details.";
        }

        if (copyMerchantCodeButton) {
            copyMerchantCodeButton.disabled = true;
            copyMerchantCodeButton.style.opacity = "0.5";
            copyMerchantCodeButton.style.pointerEvents = "none";
        }

        return;
    }


    /*
     * MTN
     */
    if (method === "mtn") {

        merchantCode.textContent =
            MERCHANT_CODES.mtn;

        if (paymentDetailsTitle) {
            paymentDetailsTitle.textContent =
                "MTN Mobile Money Payment";
        }

        if (paymentDetailsText) {
            paymentDetailsText.textContent =
                "Send your deposit to the Crown Cash MTN Mobile Money merchant account using the merchant code below.";
        }

        if (copyMerchantCodeButton) {
            copyMerchantCodeButton.disabled = false;
            copyMerchantCodeButton.style.opacity = "1";
            copyMerchantCodeButton.style.pointerEvents = "auto";
        }

        return;
    }


    /*
     * Airtel
     */
    if (method === "airtel") {

        merchantCode.textContent =
            MERCHANT_CODES.airtel;

        if (paymentDetailsTitle) {
            paymentDetailsTitle.textContent =
                "Airtel Money Payment";
        }

        if (paymentDetailsText) {
            paymentDetailsText.textContent =
                "Send your deposit to the Crown Cash Airtel Money merchant account using the merchant code below.";
        }

        if (copyMerchantCodeButton) {
            copyMerchantCodeButton.disabled = false;
            copyMerchantCodeButton.style.opacity = "1";
            copyMerchantCodeButton.style.pointerEvents = "auto";
        }

        return;
    }


    /*
     * Unknown method
     */
    merchantCode.textContent = "—";

    if (copyMerchantCodeButton) {
        copyMerchantCodeButton.disabled = true;
    }
}


/* =========================================================
   COPY MERCHANT CODE
   ========================================================= */

async function copyMerchantCode() {

    const method = getSelectedPaymentMethod();

    if (!method || !MERCHANT_CODES[method]) {
        showMessage(
            "Please select MTN Mobile Money or Airtel Money first.",
            "error"
        );
        return;
    }

    const code = MERCHANT_CODES[method];

    try {

        await navigator.clipboard.writeText(code);

        showMessage(
            `Merchant code ${code} copied successfully.`,
            "success"
        );

        /*
         * Change button text temporarily
         */
        if (copyMerchantCodeButton) {

            const originalText =
                copyMerchantCodeButton.innerHTML;

            copyMerchantCodeButton.innerHTML =
                "Copied";

            setTimeout(() => {

                copyMerchantCodeButton.innerHTML =
                    originalText;

            }, 2000);
        }

    } catch (error) {

        /*
         * Fallback for browsers where clipboard API
         * is unavailable.
         */
        const temporaryInput =
            document.createElement("input");

        temporaryInput.value = code;

        document.body.appendChild(
            temporaryInput
        );

        temporaryInput.select();

        try {
            document.execCommand("copy");

            showMessage(
                `Merchant code ${code} copied successfully.`,
                "success"
            );

        } catch (copyError) {

            showMessage(
                `Merchant code: ${code}`,
                "info"
            );
        }

        document.body.removeChild(
            temporaryInput
        );
    }
}


/* =========================================================
   LOAD BALANCE
   ========================================================= */

async function loadBalance() {

    /*
     * If your existing dashboard/auth system already
     * displays the balance, this function safely does
     * nothing when no balance API is available.
     */

    try {

        const response = await fetch(
            `${DEPOSIT_API}`,
            {
                method: "GET",
                credentials: "include",
                headers: {
                    "Accept": "application/json"
                }
            }
        );

        if (!response.ok) {
            return;
        }

        const data = await response.json();

        /*
         * Support several possible response formats.
         */
        const balance =
            data.balance ??
            data.available_balance ??
            data.availableBalance ??
            data.user?.balance ??
            data.user?.available_balance ??
            null;

        if (
            balance !== null &&
            availableBalance
        ) {

            availableBalance.textContent =
                `UGX ${formatCurrency(balance)}`;
        }

    } catch (error) {

        console.warn(
            "Could not load balance:",
            error
        );
    }
}


/* =========================================================
   LOAD RECENT DEPOSITS
   ========================================================= */

async function loadDeposits() {

    if (!depositHistory) {
        return;
    }

    depositHistory.innerHTML = `
        <div class="deposit-loading">
            Loading deposits...
        </div>
    `;

    try {

        const response = await fetch(
            DEPOSIT_API,
            {
                method: "GET",
                credentials: "include",
                headers: {
                    "Accept": "application/json"
                }
            }
        );

        const data = await response.json();

        if (!response.ok) {

            throw new Error(
                data.message ||
                "Unable to load deposits."
            );
        }

        const deposits =
            Array.isArray(data.deposits)
                ? data.deposits
                : [];

        renderDeposits(deposits);

    } catch (error) {

        console.error(
            "Deposit loading error:",
            error
        );

        depositHistory.innerHTML = `
            <div class="deposit-empty">
                Unable to load deposit history.
            </div>
        `;
    }
}


/* =========================================================
   RENDER DEPOSITS
   ========================================================= */

function renderDeposits(deposits) {

    if (!depositHistory) {
        return;
    }

    if (!deposits.length) {

        depositHistory.innerHTML = `
            <div class="deposit-empty">
                No deposits found yet.
            </div>
        `;

        return;
    }


    depositHistory.innerHTML =
        deposits.map(deposit => {

            const amount =
                Number(deposit.amount || 0);

            const method =
                String(
                    deposit.payment_method ||
                    deposit.paymentMethod ||
                    ""
                ).toLowerCase();

            const reference =
                deposit.transaction_reference ||
                deposit.transactionReference ||
                "—";

            const status =
                String(
                    deposit.status || "pending"
                ).toLowerCase();

            const date =
                deposit.created_at ||
                deposit.createdAt ||
                "";


            let formattedDate = "—";

            if (date) {

                const parsedDate =
                    new Date(date);

                if (!isNaN(parsedDate.getTime())) {

                    formattedDate =
                        parsedDate.toLocaleString(
                            "en-UG",
                            {
                                dateStyle: "medium",
                                timeStyle: "short"
                            }
                        );
                }
            }


            const network =
                method === "mtn"
                    ? "MTN Mobile Money"
                    : method === "airtel"
                        ? "Airtel Money"
                        : "Mobile Money";


            const statusClass =
                status === "approved"
                    ? "approved"
                    : status === "rejected"
                        ? "rejected"
                        : "pending";


            return `
                <div class="deposit-history-item">

                    <div class="deposit-history-main">

                        <div class="deposit-network">
                            ${escapeHTML(network)}
                        </div>

                        <div class="deposit-reference">
                            Ref:
                            ${escapeHTML(reference)}
                        </div>

                        <div class="deposit-date">
                            ${escapeHTML(formattedDate)}
                        </div>

                    </div>

                    <div class="deposit-history-side">

                        <div class="deposit-history-amount">
                            UGX ${formatCurrency(amount)}
                        </div>

                        <span class="deposit-status ${statusClass}">
                            ${escapeHTML(
                                status.charAt(0).toUpperCase() +
                                status.slice(1)
                            )}
                        </span>

                    </div>

                </div>
            `;

        }).join("");
}


/* =========================================================
   SUBMIT DEPOSIT
   ========================================================= */

async function submitDeposit(event) {

    event.preventDefault();

    clearMessage();


    const amount =
        Number(
            amountInput?.value || 0
        );

    const method =
        getSelectedPaymentMethod();

    const reference =
        String(
            transactionReferenceInput?.value || ""
        ).trim();


    /* ---------------------------------------------
       Validate amount
       --------------------------------------------- */

    if (!amount || amount < 10000) {

        showMessage(
            "Minimum deposit amount is UGX 10,000.",
            "error"
        );

        amountInput?.focus();

        return;
    }


    if (amount % 1000 !== 0) {

        showMessage(
            "Deposit amount must be in multiples of UGX 1,000.",
            "error"
        );

        amountInput?.focus();

        return;
    }


    /* ---------------------------------------------
       Validate payment method
       --------------------------------------------- */

    if (
        method !== "mtn" &&
        method !== "airtel"
    ) {

        showMessage(
            "Please select MTN Mobile Money or Airtel Money.",
            "error"
        );

        return;
    }


    /* ---------------------------------------------
       Validate reference
       --------------------------------------------- */

    if (!reference) {

        showMessage(
            "Please enter the transaction reference from your Mobile Money confirmation message.",
            "error"
        );

        transactionReferenceInput?.focus();

        return;
    }


    /* ---------------------------------------------
       Disable button
       --------------------------------------------- */

    const originalButtonText =
        depositButton?.innerHTML ||
        "Submit Deposit";


    if (depositButton) {

        depositButton.disabled = true;

        depositButton.innerHTML =
            "Submitting...";
    }


    try {

        const response =
            await fetch(
                DEPOSIT_API,
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

                        amount: amount,

                        payment_method:
                            method,

                        transaction_reference:
                            reference

                    })
                }
            );


        const data =
            await response.json();


        if (!response.ok) {

            throw new Error(
                data.message ||
                "Deposit submission failed."
            );
        }


        /* -----------------------------------------
           Success
           ----------------------------------------- */

        showMessage(
            data.message ||
            "Deposit submitted successfully. Your deposit is pending verification.",
            "success"
        );


        /*
         * Reset only the form fields.
         */
        if (depositForm) {
            depositForm.reset();
        }


        /*
         * Reset merchant display.
         */
        updateMerchantCode();


        /*
         * Refresh history.
         */
        await loadDeposits();

        await loadBalance();


    } catch (error) {

        console.error(
            "Deposit submission error:",
            error
        );

        showMessage(
            error.message ||
            "Unable to submit your deposit. Please try again.",
            "error"
        );


    } finally {

        if (depositButton) {

            depositButton.disabled = false;

            depositButton.innerHTML =
                originalButtonText;
        }
    }
}


/* =========================================================
   PAYMENT METHOD EVENTS
   ========================================================= */

function setupPaymentMethods() {

    /*
     * Find all MTN/Airtel radio buttons.
     */
    const inputs =
        document.querySelectorAll(
            'input[type="radio"]'
        );


    inputs.forEach(input => {

        const value =
            String(input.value || "")
                .toLowerCase();


        if (
            value === "mtn" ||
            value === "airtel"
        ) {

            input.addEventListener(
                "change",
                updateMerchantCode
            );
        }

    });


    /*
     * Run once when page opens.
     */
    updateMerchantCode();
}


/* =========================================================
   COPY BUTTON EVENT
   ========================================================= */

function setupCopyButton() {

    if (!copyMerchantCodeButton) {
        return;
    }

    copyMerchantCodeButton.addEventListener(
        "click",
        copyMerchantCode
    );
}


/* =========================================================
   FORM EVENT
   ========================================================= */

function setupForm() {

    if (!depositForm) {
        console.warn(
            "Deposit form #depositForm was not found."
        );

        return;
    }

    depositForm.addEventListener(
        "submit",
        submitDeposit
    );
}


/* =========================================================
   AMOUNT VALIDATION
   ========================================================= */

function setupAmountInput() {

    if (!amountInput) {
        return;
    }

    amountInput.addEventListener(
        "input",
        () => {

            const value =
                Number(
                    amountInput.value || 0
                );

            if (
                value > 0 &&
                value < 10000
            ) {

                amountInput.setCustomValidity(
                    "Minimum deposit is UGX 10,000."
                );

            } else {

                amountInput.setCustomValidity(
                    ""
                );
            }
        }
    );
}


/* =========================================================
   INITIALIZE
   ========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    async () => {

        console.log(
            "Crown Cash Deposit page initialized."
        );

        setupPaymentMethods();

        setupCopyButton();

        setupForm();

        setupAmountInput();

        await loadDeposits();

        await loadBalance();

    }
);


/* =========================================================
   GLOBAL API
   ========================================================= */

window.CrownCashDeposit = {

    updateMerchantCode,

    copyMerchantCode,

    loadDeposits,

    loadBalance,

    submitDeposit

};