document.addEventListener("DOMContentLoaded", () => {

    const API_BASE =
        "https://crown-cash1.onrender.com";


    // ==============================
    // ELEMENTS
    // ==============================

    const withdrawForm =
        document.getElementById("withdrawForm");

    const amountInput =
        document.getElementById("amount");

    const methodInput =
        document.getElementById("method");

    const phoneInput =
        document.getElementById("phone");

    const accountInput =
        document.getElementById("account");

    const availableBalanceElement =
        document.getElementById("availableBalance");

    const requestedAmountElement =
        document.getElementById("requestedAmount");

    const withdrawalFeeElement =
        document.getElementById("withdrawalFee");

    const payoutAmountElement =
        document.getElementById("payoutAmount");

    const formMessage =
        document.getElementById("formMessage");

    const withdrawButton =
        document.getElementById("withdrawButton");

    const buttonText =
        document.getElementById("buttonText");

    const buttonLoader =
        document.getElementById("buttonLoader");


    // ==============================
    // SETTINGS
    // ==============================

    const MINIMUM_WITHDRAWAL = 5000;

    const WITHDRAWAL_FEE_RATE = 0.10;

    let availableBalance = 0;


    // ==============================
    // FORMAT UGX
    // ==============================

    function formatUGX(amount) {

        const number =
            Number(amount) || 0;

        return "UGX " +
            Math.round(number).toLocaleString("en-UG");

    }


    // ==============================
    // SHOW MESSAGE
    // ==============================

    function showMessage(message, type = "error") {

        formMessage.textContent = message;

        formMessage.className =
            "form-message " + type;

        formMessage.style.display = "block";

    }


    // ==============================
    // CLEAR MESSAGE
    // ==============================

    function clearMessage() {

        formMessage.textContent = "";

        formMessage.className =
            "form-message";

        formMessage.style.display = "none";

    }


    // ==============================
    // CALCULATE WITHDRAWAL
    // ==============================

    function calculateWithdrawal() {

        let amount =
            Number(amountInput.value) || 0;


        if (amount < 0) {
            amount = 0;
        }


        // 10% fee
        const fee =
            Math.round(
                amount * WITHDRAWAL_FEE_RATE
            );


        // Amount user receives
        const payout =
            amount - fee;


        requestedAmountElement.textContent =
            formatUGX(amount);


        withdrawalFeeElement.textContent =
            formatUGX(fee);


        payoutAmountElement.textContent =
            formatUGX(payout);


        // Highlight invalid amount
        if (
            amount > 0 &&
            amount < MINIMUM_WITHDRAWAL
        ) {

            amountInput.classList.add("invalid");

        } else {

            amountInput.classList.remove("invalid");

        }

    }


    // ==============================
    // LOAD USER PROFILE
    // ==============================

    async function loadProfile() {

        try {

            const response =
                await fetch(
                    `${API_BASE}/profile.php`,
                    {
                        method: "GET",
                        credentials: "include",
                        headers: {
                            "Accept":
                                "application/json"
                        }
                    }
                );


            const data =
                await response.json();


            if (
                !response.ok ||
                !data.success
            ) {

                if (response.status === 401) {

                    window.location.href =
                        "/login.html";

                    return;

                }

                throw new Error(
                    data.message ||
                    "Unable to load account."
                );

            }


            const user =
                data.user || {};


            availableBalance =
                Number(user.balance) || 0;


            availableBalanceElement.textContent =
                formatUGX(availableBalance);


            // Automatically fill account name
            if (
                accountInput &&
                !accountInput.value
            ) {

                accountInput.value =
                    user.full_name || "";

            }


            // Automatically fill phone
            if (
                phoneInput &&
                !phoneInput.value
            ) {

                phoneInput.value =
                    user.phone || "";

            }

        } catch (error) {

            console.error(
                "Profile error:",
                error
            );

            showMessage(
                error.message ||
                "Unable to load your account.",
                "error"
            );

        }

    }


    // ==============================
    // CHECK PHONE NUMBER
    // ==============================

    function isValidUgandaPhone(phone) {

        const cleaned =
            phone.replace(
                /[\s-]/g,
                ""
            );


        const pattern =
            /^(?:\+256|256|0)(?:7[0-9]|3[0-9])[0-9]{7}$/;


        return pattern.test(cleaned);

    }


    // ==============================
    // SUBMIT WITHDRAWAL
    // ==============================

    withdrawForm.addEventListener(
        "submit",
        async (event) => {

            event.preventDefault();

            clearMessage();


            // --------------------------
            // GET VALUES
            // --------------------------

            const amount =
                Number(amountInput.value);


            const method =
                methodInput.value.trim();


            const phone =
                phoneInput.value.trim();


            const account =
                accountInput.value.trim();


            // --------------------------
            // BASIC VALIDATION
            // --------------------------

            if (
                !Number.isFinite(amount) ||
                amount <= 0
            ) {

                showMessage(
                    "Please enter a valid withdrawal amount.",
                    "error"
                );

                amountInput.focus();

                return;

            }


            if (
                amount < MINIMUM_WITHDRAWAL
            ) {

                showMessage(
                    "Minimum withdrawal is UGX 5,000.",
                    "error"
                );

                amountInput.focus();

                return;

            }


            // Amount must be a whole thousand
            if (
                amount % 1000 !== 0
            ) {

                showMessage(
                    "Withdrawal amount must be in multiples of UGX 1,000.",
                    "error"
                );

                amountInput.focus();

                return;

            }


            // --------------------------
            // BALANCE CHECK
            // --------------------------

            if (
                amount > availableBalance
            ) {

                showMessage(
                    `Insufficient balance. Your available balance is ${formatUGX(availableBalance)}.`,
                    "error"
                );

                amountInput.focus();

                return;

            }


            // --------------------------
            // METHOD CHECK
            // --------------------------

            if (
                method !== "MTN" &&
                method !== "Airtel"
            ) {

                showMessage(
                    "Please select MTN Mobile Money or Airtel Money.",
                    "error"
                );

                methodInput.focus();

                return;

            }


            // --------------------------
            // PHONE CHECK
            // --------------------------

            if (
                !isValidUgandaPhone(phone)
            ) {

                showMessage(
                    "Please enter a valid Ugandan mobile number.",
                    "error"
                );

                phoneInput.focus();

                return;

            }


            // --------------------------
            // ACCOUNT NAME
            // --------------------------

            if (
                account.length < 2
            ) {

                showMessage(
                    "Please enter the Mobile Money account name.",
                    "error"
                );

                accountInput.focus();

                return;

            }


            // --------------------------
            // CALCULATE FEE
            // --------------------------

            const fee =
                Math.round(
                    amount * WITHDRAWAL_FEE_RATE
                );


            const payout =
                amount - fee;


            // --------------------------
            // CONFIRM
            // --------------------------

            const confirmation =
                `Withdrawal: ${formatUGX(amount)}\n` +
                `10% Fee: ${formatUGX(fee)}\n` +
                `You Receive: ${formatUGX(payout)}\n\n` +
                `Payment Method: ${method}\n` +
                `Mobile Number: ${phone}\n\n` +
                `Submit this withdrawal request?`;


            if (
                !window.confirm(
                    confirmation
                )
            ) {

                return;

            }


            // --------------------------
            // LOADING
            // --------------------------

            withdrawButton.disabled =
                true;

            buttonText.hidden =
                true;

            buttonLoader.hidden =
                false;


            try {

                const response =
                    await fetch(
                        `${API_BASE}/withdrawal.php`,
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

                                method: method,

                                phone: phone,

                                account: account,

                                payment_method:
                                    method

                            })

                        }
                    );


                const data =
                    await response.json();


                if (
                    !response.ok ||
                    !data.success
                ) {

                    if (
                        response.status === 401
                    ) {

                        window.location.href =
                            "/login.html";

                        return;

                    }


                    throw new Error(
                        data.message ||
                        "Withdrawal request failed."
                    );

                }


                // --------------------------
                // SUCCESS
                // --------------------------

                const serverPayout =
                    Number(
                        data.payout_amount
                    );


                const serverFee =
                    Number(
                        data.fee
                    );


                let successMessage =
                    "Withdrawal request submitted successfully.";


                if (
                    Number.isFinite(
                        serverPayout
                    ) &&
                    Number.isFinite(
                        serverFee
                    )
                ) {

                    successMessage +=
                        ` You will receive ${formatUGX(serverPayout)} after the ${formatUGX(serverFee)} fee.`;

                }


                showMessage(
                    successMessage,
                    "success"
                );


                // Update displayed balance
                availableBalance -= amount;


                if (
                    availableBalance < 0
                ) {

                    availableBalance = 0;

                }


                availableBalanceElement.textContent =
                    formatUGX(
                        availableBalance
                    );


                // Clear form
                amountInput.value = "";

                methodInput.value = "";

                calculateWithdrawal();


            } catch (error) {

                console.error(
                    "Withdrawal error:",
                    error
                );


                showMessage(
                    error.message ||
                    "Unable to submit withdrawal request.",
                    "error"
                );

            } finally {

                withdrawButton.disabled =
                    false;

                buttonText.hidden =
                    false;

                buttonLoader.hidden =
                    true;

            }

        }
    );


    // ==============================
    // LIVE CALCULATION
    // ==============================

    amountInput.addEventListener(
        "input",
        calculateWithdrawal
    );


    // ==============================
    // INITIAL CALCULATION
    // ==============================

    calculateWithdrawal();


    // ==============================
    // LOAD ACCOUNT
    // ==============================

    loadProfile();

});