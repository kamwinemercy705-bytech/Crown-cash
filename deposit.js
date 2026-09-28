/* =========================================================
   CROWN CASH — DEPOSIT JAVASCRIPT
   ========================================================= */

"use strict";

/* =========================================================
   API CONFIGURATION
   ========================================================= */

const API_BASE = "https://crown-cash1.onrender.com";

const DEPOSIT_API = `${API_BASE}/deposit.php`;
const BALANCE_API = `${API_BASE}/balance.php`;
const LOGOUT_API = `${API_BASE}/logout.php`;


/* =========================================================
   CROWN CASH MERCHANT CODES
   ========================================================= */

const MERCHANT_CODES = {
    mtn: {
        name: "MTN Mobile Money",
        code: "80257065",
        instruction:
            "Send your deposit to the Crown Cash MTN Mobile Money merchant code shown above, then enter the transaction reference you receive.",
        icon: "fa-mobile-screen-button"
    },

    airtel: {
        name: "Airtel Money",
        code: "7229487",
        instruction:
            "Send your deposit to the Crown Cash Airtel Money merchant code shown above, then enter the transaction reference you receive.",
        icon: "fa-mobile-screen-button"
    }
};


/* =========================================================
   GLOBAL STATE
   ========================================================= */

let selectedPaymentMethod = null;
let isSubmitting = false;


/* =========================================================
   DOM HELPERS
   ========================================================= */

function getElement(id) {
    return document.getElementById(id);
}


/* =========================================================
   MESSAGE HELPERS
   ========================================================= */

function showMessage(message, type = "info") {

    const messageBox = getElement("formMessage");

    if (!messageBox) {
        return;
    }

    messageBox.textContent = message;

    messageBox.className = `form-message ${type}`;

    messageBox.style.display = "block";

    messageBox.scrollIntoView({
        behavior: "smooth",
        block: "nearest"
    });
}


function clearMessage() {

    const messageBox = getElement("formMessage");

    if (!messageBox) {
        return;
    }

    messageBox.textContent = "";

    messageBox.className = "form-message";

    messageBox.style.display = "none";
}


/* =========================================================
   FORMAT CURRENCY
   ========================================================= */

function formatCurrency(value) {

    const amount = Number(value);

    if (!Number.isFinite(amount)) {
        return "UGX 0";
    }

    return `UGX ${amount.toLocaleString("en-UG")}`;
}


/* =========================================================
   SELECT PAYMENT METHOD
   ========================================================= */

function updateMerchantDetails(method) {

    const merchantBox = getElement("merchantPaymentBox");
    const merchantName = getElement("merchantNetworkName");
    const merchantCode = getElement("merchantCode");
    const merchantInstruction = getElement("merchantInstruction");
    const copyButton = getElement("copyMerchantCodeBtn");
    const merchantIcon = getElement("merchantNetworkIcon");

    if (!merchantName || !merchantCode || !merchantInstruction) {
        return;
    }

    const payment = MERCHANT_CODES[method];

    if (!payment) {

        selectedPaymentMethod = null;

        merchantName.textContent = "Select a payment method";
        merchantCode.textContent = "—";

        merchantInstruction.textContent =
            "Select MTN Mobile Money or Airtel Money above to view the payment details.";

        if (copyButton) {
            copyButton.disabled = true;
        }

        return;
    }


    selectedPaymentMethod = method;


    /* Network name */

    merchantName.textContent = payment.name;


    /* Merchant code */

    merchantCode.textContent = payment.code;


    /* Instruction */

    merchantInstruction.textContent = payment.instruction;


    /* Enable copy button */

    if (copyButton) {
        copyButton.disabled = false;
    }


    /* Icon */

    if (merchantIcon) {

        merchantIcon.className =
            `fa-solid ${payment.icon}`;

    }


    /* Add network class */

    if (merchantBox) {

        merchantBox.classList.remove(
            "merchant-mtn",
            "merchant-airtel"
        );

        merchantBox.classList.add(
            `merchant-${method}`
        );

    }


    /* Reset copy message */

    const copyMessage = getElement("copyMessage");

    if (copyMessage) {
        copyMessage.textContent = "";
        copyMessage.className = "copy-message";
    }

}


/* =========================================================
   PAYMENT METHOD EVENTS
   ========================================================= */

function setupPaymentMethods() {

    const paymentInputs = document.querySelectorAll(
        'input[name="payment_method"]'
    );

    if (!paymentInputs.length) {
        return;
    }


    paymentInputs.forEach(input => {

        input.addEventListener("change", function () {

            if (this.checked) {

                updateMerchantDetails(
                    this.value
                );

            }

        });

    });


    /* Restore selected method if already checked */

    const checkedInput = document.querySelector(
        'input[name="payment_method"]:checked'
    );

    if (checkedInput) {

        updateMerchantDetails(
            checkedInput.value
        );

    }

}


/* =========================================================
   COPY MERCHANT CODE
   ========================================================= */

async function copyMerchantCode() {

    const merchantCodeElement = getElement("merchantCode");
    const copyButton = getElement("copyMerchantCodeBtn");
    const copyMessage = getElement("copyMessage");

    if (!merchantCodeElement) {
        return;
    }

    const code = merchantCodeElement.textContent.trim();

    if (!code || code === "—") {

        if (copyMessage) {
            copyMessage.textContent =
                "Please select a payment method first.";
            copyMessage.className =
                "copy-message error";
        }

        return;
    }


    try {

        await navigator.clipboard.writeText(code);

        if (copyMessage) {

            copyMessage.textContent =
                "Merchant code copied successfully.";

            copyMessage.className =
                "copy-message success";

        }


        if (copyButton) {

            const originalHTML =
                copyButton.innerHTML;

            copyButton.innerHTML =
                '<i class="fa-solid fa-check"></i><span>Copied</span>';

            setTimeout(() => {

                copyButton.innerHTML =
                    originalHTML;

            }, 2000);

        }

    } catch (error) {

        /* Fallback for browsers where clipboard API is unavailable */

        try {

            const temporaryInput =
                document.createElement("input");

            temporaryInput.value = code;

            document.body.appendChild(
                temporaryInput
            );

            temporaryInput.select();

            document.execCommand("copy");

            temporaryInput.remove();


            if (copyMessage) {

                copyMessage.textContent =
                    "Merchant code copied successfully.";

                copyMessage.className =
                    "copy-message success";

            }

        } catch (fallbackError) {

            if (copyMessage) {

                copyMessage.textContent =
                    `Merchant Code: ${code}`;

                copyMessage.className =
                    "copy-message error";

            }

        }

    }

}


/* =========================================================
   COPY BUTTON EVENT
   ========================================================= */

function setupCopyButton() {

    const button =
        getElement("copyMerchantCodeBtn");

    if (!button) {
        return;
    }

    button.addEventListener(
        "click",
        copyMerchantCode
    );

}


/* =========================================================
   GET LOGGED-IN USER
   ========================================================= */

function getStoredUser() {

    const possibleKeys = [
        "crownCashUser",
        "crown_cash_user",
        "user",
        "currentUser",
        "loggedInUser"
    ];


    for (const key of possibleKeys) {

        try {

            const stored =
                localStorage.getItem(key);

            if (!stored) {
                continue;
            }

            const parsed =
                JSON.parse(stored);

            if (parsed) {
                return parsed;
            }

        } catch (error) {

            /* Ignore invalid local storage */

        }

    }


    return null;
}


/* =========================================================
   LOAD BALANCE
   ========================================================= */

async function loadBalance() {

    const balanceElement =
        getElement("availableBalance");

    if (!balanceElement) {
        return;
    }


    try {

        const response =
            await fetch(BALANCE_API, {
                method: "GET",
                credentials: "include",
                headers: {
                    "Accept": "application/json"
                }
            });


        if (!response.ok) {
            throw new Error(
                `Balance request failed: ${response.status}`
            );
        }


        const data =
            await response.json();


        let balance = 0;


        if (typeof data.balance === "number") {

            balance = data.balance;

        } else if (
            data.balance &&
            typeof data.balance.amount === "number"
        ) {

            balance = data.balance.amount;

        } else if (
            data.user &&
            typeof data.user.balance === "number"
        ) {

            balance = data.user.balance;

        } else if (
            data.data &&
            typeof data.data.balance === "number"
        ) {

            balance = data.data.balance;

        }


        balanceElement.textContent =
            formatCurrency(balance);


    } catch (error) {

        console.warn(
            "Unable to load balance:",
            error
        );

        /*
         * Do not show a frightening error to the user.
         * Keep the default balance visible.
         */

        if (!balanceElement.textContent.trim()) {
            balanceElement.textContent =
                "UGX 0";
        }

    }

}


/* =========================================================
   VALIDATE DEPOSIT FORM
   ========================================================= */

function validateDepositForm() {

    const amountInput =
        getElement("amount");

    const transactionInput =
        getElement("transactionReference");


    if (!amountInput) {

        return {
            valid: false,
            message: "Deposit amount field is missing."
        };

    }


    if (!selectedPaymentMethod) {

        return {
            valid: false,
            message:
                "Please select MTN Mobile Money or Airtel Money."
        };

    }


    const amount =
        Number(amountInput.value);


    if (
        !Number.isFinite(amount) ||
        amount < 10000
    ) {

        return {
            valid: false,
            message:
                "The minimum deposit amount is UGX 10,000."
        };

    }


    if (amount % 1000 !== 0) {

        return {
            valid: false,
            message:
                "Deposit amounts must be in multiples of UGX 1,000."
        };

    }


    if (!transactionInput) {

        return {
            valid: false,
            message:
                "Transaction reference field is missing."
        };

    }


    const reference =
        transactionInput.value.trim();


    if (!reference) {

        return {
            valid: false,
            message:
                "Please enter your Mobile Money transaction reference."
        };

    }


    if (reference.length < 3) {

        return {
            valid: false,
            message:
                "Please enter a valid transaction reference."
        };

    }


    return {
        valid: true,
        amount,
        paymentMethod: selectedPaymentMethod,
        transactionReference: reference
    };

}


/* =========================================================
   SET SUBMIT BUTTON STATE
   ========================================================= */

function setSubmitLoading(loading) {

    const button =
        getElement("depositButton");

    if (!button) {
        return;
    }


    if (loading) {

        button.disabled = true;

        button.innerHTML =
            `
            <i class="fa-solid fa-spinner fa-spin"></i>
            <span>Submitting Deposit...</span>
            `;

    } else {

        button.disabled = false;

        button.innerHTML =
            `
            <i class="fa-solid fa-wallet"></i>
            <span>Submit Deposit</span>
            `;

    }

}


/* =========================================================
   SUBMIT DEPOSIT
   ========================================================= */

async function submitDeposit(event) {

    event.preventDefault();


    if (isSubmitting) {
        return;
    }


    clearMessage();


    const validation =
        validateDepositForm();


    if (!validation.valid) {

        showMessage(
            validation.message,
            "error"
        );

        return;
    }


    isSubmitting = true;

    setSubmitLoading(true);


    const depositData = {

        amount: validation.amount,

        payment_method:
            validation.paymentMethod,

        paymentMethod:
            validation.paymentMethod,

        transaction_reference:
            validation.transactionReference,

        transactionReference:
            validation.transactionReference,

        merchant_code:
            MERCHANT_CODES[
                validation.paymentMethod
            ].code,

        merchantCode:
            MERCHANT_CODES[
                validation.paymentMethod
            ].code

    };


    try {

        const response =
            await fetch(DEPOSIT_API, {

                method: "POST",

                credentials: "include",

                headers: {
                    "Content-Type":
                        "application/json",

                    "Accept":
                        "application/json"
                },

                body:
                    JSON.stringify(depositData)

            });


        let data = {};

        try {

            data =
                await response.json();

        } catch (jsonError) {

            data = {};

        }


        if (!response.ok) {

            throw new Error(
                data.message ||
                data.error ||
                `Deposit request failed (${response.status}).`
            );

        }


        if (
            data.success === false
        ) {

            throw new Error(
                data.message ||
                data.error ||
                "The deposit could not be submitted."
            );

        }


        /* Successful deposit */

        showMessage(
            data.message ||
            "Deposit submitted successfully. Your payment will be verified before your balance is updated.",
            "success"
        );


        /* Reset form */

        const form =
            getElement("depositForm");

        if (form) {
            form.reset();
        }


        /* Reset merchant display */

        updateMerchantDetails(null);


        /* Refresh history */

        await loadDepositHistory();


        /* Refresh balance */

        await loadBalance();


        /*
         * Keep the success message visible.
         */

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

        isSubmitting = false;

        setSubmitLoading(false);

    }

}


/* =========================================================
   LOAD DEPOSIT HISTORY
   ========================================================= */

async function loadDepositHistory() {

    const history =
        getElement("depositHistory");

    if (!history) {
        return;
    }


    history.innerHTML =
        `
        <div class="history-loading">
            <i class="fa-solid fa-spinner fa-spin"></i>
            <span>Loading deposits...</span>
        </div>
        `;


    try {

        /*
         * We use the deposit endpoint for history.
         * If your backend has a separate history endpoint,
         * it can be changed here later.
         */

        const response =
            await fetch(DEPOSIT_API, {

                method: "GET",

                credentials: "include",

                headers: {
                    "Accept":
                        "application/json"
                }

            });


        if (!response.ok) {

            throw new Error(
                `History request failed: ${response.status}`
            );

        }


        const data =
            await response.json();


        let deposits = [];


        if (Array.isArray(data.deposits)) {

            deposits =
                data.deposits;

        } else if (
            data.data &&
            Array.isArray(data.data.deposits)
        ) {

            deposits =
                data.data.deposits;

        } else if (
            Array.isArray(data.data)
        ) {

            deposits =
                data.data;

        } else if (
            Array.isArray(data.results)
        ) {

            deposits =
                data.results;

        }


        renderDepositHistory(deposits);


    } catch (error) {

        console.warn(
            "Unable to load deposit history:",
            error
        );


        /*
         * Do not make the whole deposit page unusable
         * if the history endpoint is unavailable.
         */

        history.innerHTML =
            `
            <div class="history-empty">
                <div class="history-empty-icon">
                    <i class="fa-solid fa-receipt"></i>
                </div>

                <h3>No recent deposits</h3>

                <p>
                    Your deposit requests will appear here.
                </p>
            </div>
            `;

    }

}


/* =========================================================
   NORMALIZE DEPOSIT STATUS
   ========================================================= */

function normalizeDepositStatus(status) {

    const value =
        String(status || "")
            .trim()
            .toLowerCase();


    if (
        value === "approved" ||
        value === "success" ||
        value === "successful" ||
        value === "completed"
    ) {

        return {
            label: "Approved",
            className: "status-approved"
        };

    }


    if (
        value === "rejected" ||
        value === "declined" ||
        value === "cancelled" ||
        value === "canceled"
    ) {

        return {
            label: "Rejected",
            className: "status-rejected"
        };

    }


    return {
        label: "Pending",
        className: "status-pending"
    };

}


/* =========================================================
   GET DEPOSIT DATE
   ========================================================= */

function getDepositDate(deposit) {

    const possibleDates = [
        deposit.created_at,
        deposit.createdAt,
        deposit.date,
        deposit.created,
        deposit.timestamp
    ];


    for (const value of possibleDates) {

        if (!value) {
            continue;
        }


        const date =
            new Date(value);


        if (!Number.isNaN(date.getTime())) {

            return date.toLocaleDateString(
                "en-UG",
                {
                    year: "numeric",
                    month: "short",
                    day: "numeric"
                }
            );

        }

    }


    return "—";

}


/* =========================================================
   RENDER DEPOSIT HISTORY
   ========================================================= */

function renderDepositHistory(deposits) {

    const history =
        getElement("depositHistory");

    if (!history) {
        return;
    }


    if (
        !Array.isArray(deposits) ||
        deposits.length === 0
    ) {

        history.innerHTML =
            `
            <div class="history-empty">

                <div class="history-empty-icon">
                    <i class="fa-solid fa-receipt"></i>
                </div>

                <h3>No recent deposits</h3>

                <p>
                    Your deposit requests will appear here.
                </p>

            </div>
            `;

        return;

    }


    /*
     * Display newest deposits first.
     */

    const sorted =
        [...deposits].sort(
            (a, b) => {

                const dateA =
                    new Date(
                        a.created_at ||
                        a.createdAt ||
                        a.date ||
                        0
                    ).getTime();

                const dateB =
                    new Date(
                        b.created_at ||
                        b.createdAt ||
                        b.date ||
                        0
                    ).getTime();

                return dateB - dateA;

            }
        );


    /*
     * Limit the page to recent deposits.
     */

    const recent =
        sorted.slice(0, 10);


    history.innerHTML =
        recent.map(deposit => {

            const amount =
                deposit.amount ??
                deposit.deposit_amount ??
                deposit.depositAmount ??
                0;


            const method =
                deposit.payment_method ||
                deposit.paymentMethod ||
                "mobile money";


            const methodLabel =
                String(method)
                    .toLowerCase()
                    .includes("airtel")
                    ? "Airtel Money"
                    : "MTN Mobile Money";


            const reference =
                deposit.transaction_reference ||
                deposit.transactionReference ||
                deposit.reference ||
                deposit.transaction_id ||
                deposit.transactionId ||
                "—";


            const status =
                normalizeDepositStatus(
                    deposit.status
                );


            const date =
                getDepositDate(deposit);


            return `
                <div class="deposit-history-item">

                    <div class="history-method-icon">
                        <i class="fa-solid fa-mobile-screen-button"></i>
                    </div>

                    <div class="history-main">

                        <strong>
                            ${escapeHTML(methodLabel)}
                        </strong>

                        <span>
                            Ref:
                            ${escapeHTML(
                                String(reference)
                            )}
                        </span>

                    </div>

                    <div class="history-amount">

                        <strong>
                            ${formatCurrency(amount)}
                        </strong>

                        <span>
                            ${escapeHTML(date)}
                        </span>

                    </div>

                    <div class="history-status">

                        <span class="status-pill ${status.className}">
                            ${status.label}
                        </span>

                    </div>

                </div>
            `;

        }).join("");

}


/* =========================================================
   HTML ESCAPE
   ========================================================= */

function escapeHTML(value) {

    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");

}


/* =========================================================
   MOBILE SIDEBAR
   ========================================================= */

function setupMobileMenu() {

    const menuToggle =
        getElement("menuToggle");

    const sidebar =
        getElement("sidebar");

    const overlay =
        getElement("sidebarOverlay");


    if (!menuToggle || !sidebar) {
        return;
    }


    menuToggle.addEventListener(
        "click",
        () => {

            sidebar.classList.toggle(
                "open"
            );

            if (overlay) {

                overlay.classList.toggle(
                    "active"
                );

            }

            document.body.classList.toggle(
                "sidebar-open"
            );

        }
    );


    if (overlay) {

        overlay.addEventListener(
            "click",
            closeMobileMenu
        );

    }


    const navItems =
        sidebar.querySelectorAll(
            ".nav-item"
        );


    navItems.forEach(item => {

        item.addEventListener(
            "click",
            () => {

                if (
                    window.innerWidth <= 900
                ) {

                    closeMobileMenu();

                }

            }
        );

    });

}


function closeMobileMenu() {

    const sidebar =
        getElement("sidebar");

    const overlay =
        getElement("sidebarOverlay");


    if (sidebar) {

        sidebar.classList.remove(
            "open"
        );

    }


    if (overlay) {

        overlay.classList.remove(
            "active"
        );

    }


    document.body.classList.remove(
        "sidebar-open"
    );

}


/* =========================================================
   LOGOUT
   ========================================================= */

async function logout() {

    const logoutButton =
        getElement("logoutBtn");


    if (logoutButton) {

        logoutButton.disabled = true;

        logoutButton.innerHTML =
            `
            <i class="fa-solid fa-spinner fa-spin"></i>
            <span>Logging out...</span>
            `;

    }


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
            "Logout API request failed:",
            error
        );

    } finally {

        /*
         * Clear locally stored authentication data.
         */

        const keysToRemove = [
            "crownCashUser",
            "crown_cash_user",
            "user",
            "currentUser",
            "loggedInUser",
            "authUser",
            "token",
            "authToken"
        ];


        keysToRemove.forEach(key => {

            try {
                localStorage.removeItem(key);
                sessionStorage.removeItem(key);
            } catch (error) {
                /* Ignore storage errors */
            }

        });


        window.location.href =
            "login.html";

    }

}


/* =========================================================
   LOGOUT EVENT
   ========================================================= */

function setupLogout() {

    const logoutButton =
        getElement("logoutBtn");

    if (!logoutButton) {
        return;
    }

    logoutButton.addEventListener(
        "click",
        logout
    );

}


/* =========================================================
   AMOUNT INPUT FORMATTING
   ========================================================= */

function setupAmountInput() {

    const amountInput =
        getElement("amount");

    if (!amountInput) {
        return;
    }


    amountInput.addEventListener(
        "input",
        () => {

            /*
             * Prevent negative numbers.
             */

            if (
                Number(amountInput.value) < 0
            ) {

                amountInput.value = "";

            }

        }
    );

}


/* =========================================================
   TRANSACTION REFERENCE CLEANUP
   ========================================================= */

function setupTransactionReference() {

    const input =
        getElement("transactionReference");

    if (!input) {
        return;
    }


    input.addEventListener(
        "input",
        () => {

            input.value =
                input.value.trimStart();

        }
    );

}


/* =========================================================
   FORM EVENT
   ========================================================= */

function setupDepositForm() {

    const form =
        getElement("depositForm");

    if (!form) {
        return;
    }


    form.addEventListener(
        "submit",
        submitDeposit
    );

}


/* =========================================================
   PREVENT DOUBLE SUBMISSION
   ========================================================= */

function preventDuplicateSubmission() {

    const form =
        getElement("depositForm");

    if (!form) {
        return;
    }


    form.addEventListener(
        "keydown",
        event => {

            if (
                event.key === "Enter" &&
                isSubmitting
            ) {

                event.preventDefault();

            }

        }
    );

}


/* =========================================================
   INITIALIZATION
   ========================================================= */

async function initializeDepositPage() {

    setupPaymentMethods();

    setupCopyButton();

    setupDepositForm();

    setupMobileMenu();

    setupLogout