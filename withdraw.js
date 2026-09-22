/*
|--------------------------------------------------------------------------
| CROWN CASH — WITHDRAWAL JAVASCRIPT
|--------------------------------------------------------------------------
| Withdrawal fee:
| 20%
|
| Example:
| UGX 10,000 requested
| UGX 2,000 fee
| UGX 8,000 received
|--------------------------------------------------------------------------
*/

document.addEventListener("DOMContentLoaded", () => {

    /*
    |--------------------------------------------------------------------------
    | CONFIGURATION
    |--------------------------------------------------------------------------
    */

    const API_BASE =
        "https://crown-cash1.onrender.com";

    const PROFILE_API =
        `${API_BASE}/profile.php`;

    const WITHDRAWAL_API =
        `${API_BASE}/withdrawal.php`;

    const MINIMUM_WITHDRAWAL = 5000;

    const WITHDRAWAL_FEE_RATE = 0.20;


    /*
    |--------------------------------------------------------------------------
    | ELEMENTS
    |--------------------------------------------------------------------------
    */

    const form =
        document.getElementById("withdrawForm");

    const amountInput =
        document.getElementById("amount");

    const methodInput =
        document.getElementById("paymentMethod");

    const phoneInput =
        document.getElementById("phone");

    const accountNameInput =
        document.getElementById("accountName");

    const balanceDisplay =
        document.getElementById("availableBalance");

    const feeDisplay =
        document.getElementById("withdrawalFee");

    const payoutDisplay =
        document.getElementById("payoutAmount");

    const messageBox =
        document.getElementById("formMessage");

    const submitButton =
        document.getElementById("withdrawButton");


    /*
    |--------------------------------------------------------------------------
    | HELPER — FORMAT UGX
    |--------------------------------------------------------------------------
    */

    function formatUGX(amount) {

        const value =
            Number(amount) || 0;

        return (
            "UGX " +
            Math.round(value).toLocaleString("en-UG")
        );

    }


    /*
    |--------------------------------------------------------------------------
    | SHOW MESSAGE
    |--------------------------------------------------------------------------
    */

    function showMessage(message, type = "error") {

        if (!messageBox) {
            alert(message);
            return;
        }

        messageBox.textContent = message;

        messageBox.className =
            `form-message ${type}`;

        messageBox.style.display = "block";
    }


    /*
    |--------------------------------------------------------------------------
    | CLEAR MESSAGE
    |--------------------------------------------------------------------------
    */

    function clearMessage() {

        if (!messageBox) {
            return;
        }

        messageBox.textContent = "";

        messageBox.className =
            "form-message";

        messageBox.style.display =
            "none";
    }


    /*
    |--------------------------------------------------------------------------
    | USER BALANCE
    |--------------------------------------------------------------------------
    */

    let availableBalance = 0;


    /*
    |--------------------------------------------------------------------------
    | LOAD USER PROFILE
    |--------------------------------------------------------------------------
    */

    async function loadProfile() {

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
                    "Unable to load your profile."
                );
            }


            /*
            |--------------------------------------------------------------------------
            | GET BALANCE
            |--------------------------------------------------------------------------
            */

            availableBalance =
                Number(
                    data.user?.balance ?? 0
                );


            /*
            |--------------------------------------------------------------------------
            | DISPLAY BALANCE
            |--------------------------------------------------------------------------
            */

            if (balanceDisplay) {

                balanceDisplay.textContent =
                    formatUGX(
                        availableBalance
                    );

            }


            /*
            |--------------------------------------------------------------------------
            | OPTIONAL ACCOUNT NAME
            |--------------------------------------------------------------------------
            */

            if (
                accountNameInput &&
                !accountNameInput.value
            ) {

                accountNameInput.value =
                    data.user?.full_name ||
                    "";

            }


            /*
            |--------------------------------------------------------------------------
            | OPTIONAL PHONE
            |--------------------------------------------------------------------------
            */

            if (
                phoneInput &&
                !phoneInput.value
            ) {

                phoneInput.value =
                    data.user?.phone ||
                    "";

            }


        } catch (error) {

            console.error(
                "Profile loading error:",
                error
            );

            showMessage(
                error.message ||
                "Unable to load your account balance."
            );

        }

    }


    /*
    |--------------------------------------------------------------------------
    | CALCULATE WITHDRAWAL
    |--------------------------------------------------------------------------
    */

    function calculateWithdrawal() {

        const amount =
            Number(
                amountInput?.value || 0
            );


        if (
            !amount ||
            amount <= 0
        ) {

            if (feeDisplay) {

                feeDisplay.textContent =
                    formatUGX(0);

            }

            if (payoutDisplay) {

                payoutDisplay.textContent =
                    formatUGX(0);

            }

            return {
                amount: 0,
                fee: 0,
                payout: 0
            };

        }


        /*
        |--------------------------------------------------------------------------
        | 20% FEE
        |--------------------------------------------------------------------------
        */

        const fee =
            Math.round(
                amount *
                WITHDRAWAL_FEE_RATE
            );


        /*
        |--------------------------------------------------------------------------
        | PAYOUT
        |--------------------------------------------------------------------------
        */

        const payout =
            amount - fee;


        /*
        |--------------------------------------------------------------------------
        | UPDATE UI
        |--------------------------------------------------------------------------
        */

        if (feeDisplay) {

            feeDisplay.textContent =
                formatUGX(fee);

        }


        if (payoutDisplay) {

            payoutDisplay.textContent =
                formatUGX(payout);

        }


        return {
            amount,
            fee,
            payout
        };

    }


    /*
    |--------------------------------------------------------------------------
    | UPDATE CALCULATION WHILE TYPING
    |--------------------------------------------------------------------------
    */

    if (amountInput) {

        amountInput.addEventListener(
            "input",
            () => {

                clearMessage();

                calculateWithdrawal();

            }
        );

    }


    /*
    |--------------------------------------------------------------------------
    | FORMAT PHONE NUMBER
    |--------------------------------------------------------------------------
    */

    function normalizePhone(phone) {

        let value =
            String(phone || "")
                .trim()
                .replace(/[\s\-]/g, "");


        if (
            value.startsWith("+256")
        ) {

            value =
                "0" +
                value.substring(4);

        }


        return value;

    }


    /*
    |--------------------------------------------------------------------------
    | VALIDATE PHONE NUMBER
    |--------------------------------------------------------------------------
    */

    function validatePhone(
        phone,
        method
    ) {

        const normalized =
            normalizePhone(phone);


        if (!/^07[0-9]{8}$/.test(normalized)) {

            return {
                valid: false,
                message:
                    "Enter a valid Ugandan Mobile Money number."
            };

        }


        const prefix =
            normalized.substring(0, 3);


        const mtnPrefixes = [
            "077",
            "078",
            "076"
        ];


        const airtelPrefixes = [
            "070",
            "075",
            "074"
        ];


        if (
            method === "MTN" &&
            !mtnPrefixes.includes(prefix)
        ) {

            return {
                valid: false,
                message:
                    "The number does not appear to be an MTN number."
            };

        }


        if (
            method === "Airtel" &&
            !airtelPrefixes.includes(prefix)
        ) {

            return {
                valid: false,
                message:
                    "The number does not appear to be an Airtel number."
            };

        }


        return {
            valid: true,
            phone: normalized
        };

    }


    /*
    |--------------------------------------------------------------------------
    | SUBMIT WITHDRAWAL
    |--------------------------------------------------------------------------
    */

    if (form) {

        form.addEventListener(
            "submit",
            async (event) => {

                event.preventDefault();

                clearMessage();


                /*
                |--------------------------------------------------------------------------
                | GET AMOUNT
                |--------------------------------------------------------------------------
                */

                const amount =
                    Number(
                        amountInput?.value || 0
                    );


                /*
                |--------------------------------------------------------------------------
                | GET METHOD
                |--------------------------------------------------------------------------
                */

                let method =
                    String(
                        methodInput?.value || ""
                    )
                    .trim()
                    .toLowerCase();


                if (method === "mtn") {

                    method = "MTN";

                }

                else if (
                    method === "airtel"
                ) {

                    method = "Airtel";

                }


                /*
                |--------------------------------------------------------------------------
                | GET PHONE
                |--------------------------------------------------------------------------
                */

                const phone =
                    normalizePhone(
                        phoneInput?.value || ""
                    );


                /*
                |--------------------------------------------------------------------------
                | VALIDATE AMOUNT
                |--------------------------------------------------------------------------
                */

                if (
                    !amount ||
                    !Number.isFinite(amount)
                ) {

                    showMessage(
                        "Enter a valid withdrawal amount."
                    );

                    return;

                }


                /*
                |--------------------------------------------------------------------------
                | MINIMUM
                |--------------------------------------------------------------------------
                */

                if (
                    amount <
                    MINIMUM_WITHDRAWAL
                ) {

                    showMessage(
                        "Minimum withdrawal amount is UGX 5,000."
                    );

                    return;

                }


                /*
                |--------------------------------------------------------------------------
                | WHOLE UGX
                |--------------------------------------------------------------------------
                */

                if (
                    !Number.isInteger(amount)
                ) {

                    showMessage(
                        "Withdrawal amount must be a whole UGX amount."
                    );

                    return;

                }


                /*
                |--------------------------------------------------------------------------
                | BALANCE CHECK
                |--------------------------------------------------------------------------
                */

                if (
                    amount >
                    availableBalance
                ) {

                    showMessage(
                        `Insufficient available balance. Your balance is ${formatUGX(availableBalance)}.`
                    );

                    return;

                }


                /*
                |--------------------------------------------------------------------------
                | METHOD CHECK
                |--------------------------------------------------------------------------
                */

                if (
                    method !== "MTN" &&
                    method !== "Airtel"
                ) {

                    showMessage(
                        "Please select MTN or Airtel Mobile Money."
                    );

                    return;

                }


                /*
                |--------------------------------------------------------------------------
                | PHONE CHECK
                |--------------------------------------------------------------------------
                */

                const phoneResult =
                    validatePhone(
                        phone,
                        method
                    );


                if (!phoneResult.valid) {

                    showMessage(
                        phoneResult.message
                    );

                    return;

                }


                /*
                |--------------------------------------------------------------------------
                | CALCULATE FINAL VALUES
                |--------------------------------------------------------------------------
                */

                const calculation =
                    calculateWithdrawal();


                const fee =
                    calculation.fee;

                const payout =
                    calculation.payout;


                if (payout <= 0) {

                    showMessage(
                        "Invalid withdrawal amount."
                    );

                    return;

                }


                /*
                |--------------------------------------------------------------------------
                | CONFIRMATION
                |--------------------------------------------------------------------------
                */

                const confirmed =
                    window.confirm(
                        "Please confirm your withdrawal:\n\n" +

                        `Requested: ${formatUGX(amount)}\n` +

                        `Withdrawal fee (20%): ${formatUGX(fee)}\n` +

                        `You will receive: ${formatUGX(payout)}\n\n` +

                        `Method: ${method}\n` +

                        `Mobile Money: ${phone}\n\n` +

                        "Continue with this withdrawal?"
                    );


                if (!confirmed) {

                    return;

                }


                /*
                |--------------------------------------------------------------------------
                | DISABLE BUTTON
                |--------------------------------------------------------------------------
                */

                if (submitButton) {

                    submitButton.disabled =
                        true;

                    submitButton.textContent =
                        "Submitting...";

                }


                try {

                    /*
                    |--------------------------------------------------------------------------
                    | SEND REQUEST
                    |--------------------------------------------------------------------------
                    */

                    const response =
                        await fetch(
                            WITHDRAWAL_API,
                            {
                                method: "POST",

                                credentials: "include",

                                headers: {
                                    "Content-Type":
                                        "application/json",

                                    "Accept":
                                        "application/json"
                                },

                                body:
                                    JSON.stringify({

                                        amount:
                                            amount,

                                        payment_method:
                                            method,

                                        phone:
                                            phone

                                    })
                            }
                        );


                    let data = null;


                    try {

                        data =
                            await response.json();

                    } catch (jsonError) {

                        throw new Error(
                            "The server returned an invalid response."
                        );

                    }


                    /*
                    |--------------------------------------------------------------------------
                    | HANDLE ERROR
                    |--------------------------------------------------------------------------
                    */

                    if (
                        !response.ok ||
                        !data.success
                    ) {

                        throw new Error(
                            data.message ||
                            "Withdrawal request failed."
                        );

                    }


                    /*
                    |--------------------------------------------------------------------------
                    | SERVER VALUES
                    |--------------------------------------------------------------------------
                    */

                    const serverFee =
                        Number(
                            data.fee ??
                            fee
                        );


                    const serverPayout =
                        Number(
                            data.payout_amount ??
                            payout
                        );


                    /*
                    |--------------------------------------------------------------------------
                    | SUCCESS
                    |--------------------------------------------------------------------------
                    */

                    showMessage(
                        `Withdrawal submitted successfully. Requested ${formatUGX(amount)}, fee ${formatUGX(serverFee)}, you will receive ${formatUGX(serverPayout)} after approval.`,
                        "success"
                    );


                    /*
                    |--------------------------------------------------------------------------
                    | RESET FORM
                    |--------------------------------------------------------------------------
                    */

                    if (amountInput) {

                        amountInput.value = "";

                    }


                    calculateWithdrawal();


                    /*
                    |--------------------------------------------------------------------------
                    | REFRESH BALANCE
                    |--------------------------------------------------------------------------
                    |
                    | The withdrawal is still pending, so the server has
                    | not deducted the balance yet.
                    |--------------------------------------------------------------------------
                    */

                    setTimeout(
                        loadProfile,
                        500
                    );


                } catch (error) {

                    console.error(
                        "Withdrawal error:",
                        error
                    );


                    showMessage(
                        error.message ||
                        "Unable to submit withdrawal."
                    );

                } finally {

                    /*
                    |--------------------------------------------------------------------------
                    | ENABLE BUTTON AGAIN
                    |--------------------------------------------------------------------------
                    */

                    if (submitButton) {

                        submitButton.disabled =
                            false;

                        submitButton.textContent =
                            "Request Withdrawal";

                    }

                }

            }
        );

    }


    /*
    |--------------------------------------------------------------------------
    | INITIALIZE
    |--------------------------------------------------------------------------
    */

    calculateWithdrawal();

    loadProfile();

});