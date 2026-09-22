const API_BASE = "https://crown-cash1.onrender.com";

const MINIMUM_WITHDRAWAL = 5000;
const WITHDRAWAL_FEE_RATE = 0.20;


// ======================================================
// ELEMENTS
// ======================================================

const withdrawForm = document.getElementById("withdrawForm");

const amountInput = document.getElementById("amount");

const availableBalanceElement =
    document.getElementById("availableBalance");

const displayAmountElement =
    document.getElementById("displayAmount");

const withdrawalFeeElement =
    document.getElementById("withdrawalFee");

const payoutAmountElement =
    document.getElementById("payoutAmount");

const registeredPhoneElement =
    document.getElementById("registeredPhone");

const phoneInput =
    document.getElementById("phone");

const accountNameInput =
    document.getElementById("accountName");

const confirmWithdrawal =
    document.getElementById("confirmWithdrawal");

const withdrawButton =
    document.getElementById("withdrawButton");

const formMessage =
    document.getElementById("formMessage");


// ======================================================
// VARIABLES
// ======================================================

let availableBalance = 0;

let registeredPhone = "";

let registeredFullName = "";


// ======================================================
// FORMAT MONEY
// ======================================================

function formatMoney(amount) {

    const value = Number(amount) || 0;

    return new Intl.NumberFormat("en-UG", {
        maximumFractionDigits: 0
    }).format(value);

}


// ======================================================
// SHOW MESSAGE
// ======================================================

function showMessage(message, type = "error") {

    if (!formMessage) {
        return;
    }

    formMessage.textContent = message;

    formMessage.className =
        "form-message " + type;

}


// ======================================================
// CLEAR MESSAGE
// ======================================================

function clearMessage() {

    if (!formMessage) {
        return;
    }

    formMessage.textContent = "";

    formMessage.className =
        "form-message";

}


// ======================================================
// NORMALIZE UGANDAN PHONE NUMBER
// ======================================================

function normalizeUgandaPhone(phone) {

    let value = String(phone || "")
        .trim()
        .replace(/[\s\-()]/g, "");


    if (value.startsWith("+256")) {

        value =
            "0" +
            value.substring(4);

    } else if (value.startsWith("256")) {

        value =
            "0" +
            value.substring(3);

    }


    return value;

}


// ======================================================
// VALIDATE UGANDAN PHONE
// ======================================================

function isValidUgandaPhone(phone) {

    return /^07[0-9]{8}$/.test(phone);

}


// ======================================================
// LOAD USER PROFILE
// ======================================================

async function loadUserProfile() {

    try {

        registeredPhoneElement.textContent =
            "Loading...";


        const response = await fetch(
            `${API_BASE}/profile.php`,
            {
                method: "GET",
                credentials: "include",
                cache: "no-store"
            }
        );


        if (response.status === 401) {

            window.location.href =
                "/login.html?redirect=withdraw";

            return;

        }


        const data = await response.json();


        if (
            !response.ok ||
            !data.success ||
            !data.user
        ) {

            throw new Error(
                data.message ||
                "Unable to load your account."
            );

        }


        const user = data.user;


        // ----------------------------------------------
        // Registered phone
        // ----------------------------------------------

        registeredPhone =
            normalizeUgandaPhone(
                user.phone ||
                user.phone_number ||
                user.mobile ||
                ""
            );


        if (!registeredPhone) {

            registeredPhoneElement.textContent =
                "No registered phone";

            showMessage(
                "Your account does not have a registered mobile number. Please contact support.",
                "error"
            );

            if (withdrawButton) {
                withdrawButton.disabled = true;
            }

            return;

        }


        if (!isValidUgandaPhone(registeredPhone)) {

            registeredPhoneElement.textContent =
                "Invalid registered phone";

            showMessage(
                "Your registered mobile number is invalid. Please contact support.",
                "error"
            );

            if (withdrawButton) {
                withdrawButton.disabled = true;
            }

            return;

        }


        // ----------------------------------------------
        // Display registered phone
        // ----------------------------------------------

        if (registeredPhoneElement) {

            registeredPhoneElement.textContent =
                registeredPhone;

        }


        // ----------------------------------------------
        // Hidden phone field
        // ----------------------------------------------

        if (phoneInput) {

            phoneInput.value =
                registeredPhone;

        }


        // ----------------------------------------------
        // Account name
        // ----------------------------------------------

        registeredFullName =
            user.full_name ||
            `${user.first_name || ""} ${user.last_name || ""}`.trim();


        if (accountNameInput) {

            accountNameInput.value =
                registeredFullName;

        }


        // ----------------------------------------------
        // Balance
        // ----------------------------------------------

        availableBalance =
            Number(user.balance) || 0;


        if (availableBalanceElement) {

            availableBalanceElement.textContent =
                `UGX ${formatMoney(availableBalance)}`;

        }


        // ----------------------------------------------
        // Make sure button is available
        // ----------------------------------------------

        if (withdrawButton) {
            withdrawButton.disabled = false;
        }


        updateCalculator();


    } catch (error) {

        console.error(
            "Profile loading error:",
            error
        );


        if (registeredPhoneElement) {

            registeredPhoneElement.textContent =
                "Unable to load";

        }


        showMessage(
            error.message ||
            "Unable to load your account information. Please try again.",
            "error"
        );

    }

}


// ======================================================
// CALCULATE WITHDRAWAL
// ======================================================

function updateCalculator() {

    const amount =
        Number(amountInput?.value) || 0;


    if (amount <= 0) {

        if (displayAmountElement) {
            displayAmountElement.textContent =
                "UGX 0";
        }

        if (withdrawalFeeElement) {
            withdrawalFeeElement.textContent =
                "UGX 0";
        }

        if (payoutAmountElement) {
            payoutAmountElement.textContent =
                "UGX 0";
        }

        return;

    }


    const fee =
        amount * WITHDRAWAL_FEE_RATE;


    const payout =
        amount - fee;


    if (displayAmountElement) {

        displayAmountElement.textContent =
            `UGX ${formatMoney(amount)}`;

    }


    if (withdrawalFeeElement) {

        withdrawalFeeElement.textContent =
            `UGX ${formatMoney(fee)}`;

    }


    if (payoutAmountElement) {

        payoutAmountElement.textContent =
            `UGX ${formatMoney(payout)}`;

    }

}


// ======================================================
// AMOUNT INPUT
// ======================================================

if (amountInput) {

    amountInput.addEventListener(
        "input",
        function () {

            clearMessage();

            updateCalculator();

        }
    );

}


// ======================================================
// VALIDATE AMOUNT
// ======================================================

function validateAmount(amount) {

    if (!Number.isFinite(amount)) {

        return {
            valid: false,
            message: "Please enter a valid withdrawal amount."
        };

    }


    if (amount < MINIMUM_WITHDRAWAL) {

        return {
            valid: false,
            message:
                `Minimum withdrawal is UGX ${formatMoney(MINIMUM_WITHDRAWAL)}.`
        };

    }


    if (!Number.isInteger(amount)) {

        return {
            valid: false,
            message:
                "Withdrawal amount must be a whole Uganda Shilling amount."
        };

    }


    if (amount > availableBalance) {

        return {
            valid: false,
            message:
                `Insufficient balance. Your available balance is UGX ${formatMoney(availableBalance)}.`
        };

    }


    return {
        valid: true
    };

}


// ======================================================
// GET PAYMENT METHOD
// ======================================================

function getPaymentMethod() {

    const selected =
        document.querySelector(
            'input[name="payment_method"]:checked'
        );


    if (!selected) {
        return "";
    }


    return selected.value;

}


// ======================================================
// VALIDATE PAYMENT METHOD
// ======================================================

function validatePaymentMethod(method) {

    if (!method) {

        return {
            valid: false,
            message:
                "Please select MTN Mobile Money or Airtel Money."
        };

    }


    const normalized =
        method.toLowerCase();


    if (
        normalized !== "mtn" &&
        normalized !== "airtel"
    ) {

        return {
            valid: false,
            message:
                "Please select a valid payment method."
        };

    }


    return {
        valid: true
    };

}


// ======================================================
// CONFIRM WITHDRAWAL
// ======================================================

async function submitWithdrawal() {

    clearMessage();


    // ----------------------------------------------
    // Make sure profile is loaded
    // ----------------------------------------------

    if (!registeredPhone) {

        showMessage(
            "Your registered mobile number has not loaded yet. Please wait and try again.",
            "error"
        );

        return;

    }


    // ----------------------------------------------
    // Amount
    // ----------------------------------------------

    const amount =
        Number(amountInput?.value);


    const amountValidation =
        validateAmount(amount);


    if (!amountValidation.valid) {

        showMessage(
            amountValidation.message,
            "error"
        );

        amountInput?.focus();

        return;

    }


    // ----------------------------------------------
    // Payment method
    // ----------------------------------------------

    const paymentMethod =
        getPaymentMethod();


    const methodValidation =
        validatePaymentMethod(paymentMethod);


    if (!methodValidation.valid) {

        showMessage(
            methodValidation.message,
            "error"
        );

        return;

    }


    // ----------------------------------------------
    // Phone validation
    // ----------------------------------------------

    const normalizedPhone =
        normalizeUgandaPhone(registeredPhone);


    if (!isValidUgandaPhone(normalizedPhone)) {

        showMessage(
            "Your registered mobile number is invalid. Please contact support.",
            "error"
        );

        return;

    }


    // ----------------------------------------------
    // Confirmation checkbox
    // ----------------------------------------------

    if (
        !confirmWithdrawal ||
        !confirmWithdrawal.checked
    ) {

        showMessage(
            "Please confirm the withdrawal information before continuing.",
            "error"
        );

        return;

    }


    // ----------------------------------------------
    // Calculate amounts
    // ----------------------------------------------

    const fee =
        amount * WITHDRAWAL_FEE_RATE;


    const payout =
        amount - fee;


    // ----------------------------------------------
    // Final confirmation
    // ----------------------------------------------

    const confirmationMessage =
        `Confirm your withdrawal?\n\n` +

        `Requested amount: UGX ${formatMoney(amount)}\n` +

        `Withdrawal fee: UGX ${formatMoney(fee)} (20%)\n` +

        `You will receive: UGX ${formatMoney(payout)}\n\n` +

        `Payment method: ${paymentMethod}\n` +

        `Registered number: ${normalizedPhone}\n\n` +

        `The withdrawal will be submitted for admin approval.`;


    const confirmed =
        window.confirm(
            confirmationMessage
        );


    if (!confirmed) {
        return;
    }


    // ----------------------------------------------
    // Disable button
    // ----------------------------------------------

    if (withdrawButton) {

        withdrawButton.disabled = true;

        withdrawButton.dataset.originalText =
            withdrawButton.innerHTML;

        withdrawButton.innerHTML =
            "⏳ Processing...";

    }


    try {

        // ------------------------------------------
        // Keep hidden field synchronized
        // ------------------------------------------

        if (phoneInput) {

            phoneInput.value =
                normalizedPhone;

        }


        // ------------------------------------------
        // Send request
        // ------------------------------------------

        const response = await fetch(
            `${API_BASE}/withdrawal.php`,
            {
                method: "POST",

                credentials: "include",

                headers: {
                    "Content-Type":
                        "application/json"
                },

                body: JSON.stringify({

                    amount: amount,

                    payment_method:
                        paymentMethod,

                    phone:
                        normalizedPhone

                })
            }
        );


        let data = null;


        try {

            data =
                await response.json();

        } catch (jsonError) {

            data = null;

        }


        if (response.status === 401) {

            window.location.href =
                "/login.html?redirect=withdraw";

            return;

        }


        if (!response.ok || !data?.success) {

            throw new Error(
                data?.message ||
                "Withdrawal request failed."
            );

        }


        // ------------------------------------------
        // Server response
        // ------------------------------------------

        const serverFee =
            Number(data.fee) || fee;


        const serverPayout =
            Number(data.payout_amount) || payout;


        showMessage(
            `Withdrawal request submitted successfully. Requested: UGX ${formatMoney(amount)}. Fee: UGX ${formatMoney(serverFee)}. You will receive: UGX ${formatMoney(serverPayout)} after approval.`,
            "success"
        );


        // ------------------------------------------
        // Reset form
        // ------------------------------------------

        if (amountInput) {
            amountInput.value = "";
        }


        const selectedMethod =
            document.querySelector(
                'input[name="payment_method"]:checked'
            );


        if (selectedMethod) {
            selectedMethod.checked = false;
        }


        if (confirmWithdrawal) {
            confirmWithdrawal.checked = false;
        }


        updateCalculator();


        // ------------------------------------------
        // Refresh balance/profile
        // ------------------------------------------

        await loadUserProfile();


    } catch (error) {

        console.error(
            "Withdrawal error:",
            error
        );


        showMessage(
            error.message ||
            "Unable to submit your withdrawal request. Please try again.",
            "error"
        );

    } finally {

        // ------------------------------------------
        // Restore button
        // ------------------------------------------

        if (withdrawButton) {

            withdrawButton.disabled = false;

            withdrawButton.innerHTML =
                withdrawButton.dataset.originalText ||
                "💸 Request Withdrawal";

        }

    }

}


// ======================================================
// FORM SUBMISSION
// ======================================================

if (withdrawForm) {

    withdrawForm.addEventListener(
        "submit",
        function (event) {

            event.preventDefault();

            submitWithdrawal();

        }
    );

}


// ======================================================
// PAYMENT METHOD MESSAGE CLEAR
// ======================================================

document
    .querySelectorAll(
        'input[name="payment_method"]'
    )
    .forEach(function (radio) {

        radio.addEventListener(
            "change",
            function () {

                clearMessage();

            }
        );

    });


// ======================================================
// INITIALIZATION
// ======================================================

document.addEventListener(
    "DOMContentLoaded",
    function () {

        updateCalculator();

        loadUserProfile();

    }
);