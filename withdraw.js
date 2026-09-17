/* =========================================================
   CROWN CASH — WITHDRAW JAVASCRIPT
   =========================================================
   Backend:
   - profile.php       → loads available balance
   - withdrawal.php    → submits withdrawal request
   - withdrawals.php   → loads withdrawal history
   ========================================================= */


/* =========================================================
   API URL
   ========================================================= */

const API_URL = "https://crown-cash1.onrender.com";


/* =========================================================
   ELEMENTS
   ========================================================= */

const withdrawForm =
    document.getElementById("withdrawForm");

const amountInput =
    document.getElementById("amount");

const paymentMethod =
    document.getElementById("paymentMethod");

const phoneNumber =
    document.getElementById("phoneNumber");

const withdrawBtn =
    document.getElementById("withdrawBtn");

const formMessage =
    document.getElementById("formMessage");

const availableBalance =
    document.getElementById("availableBalance");

const withdrawalHistory =
    document.getElementById("withdrawalHistory");

const menuBtn =
    document.getElementById("menuBtn");

const sidebar =
    document.getElementById("sidebar");

const overlay =
    document.getElementById("overlay");

const logoutBtn =
    document.getElementById("logoutBtn");


/* =========================================================
   CURRENT YEAR
   ========================================================= */

const yearElement =
    document.getElementById("year");

if (yearElement) {

    yearElement.textContent =
        new Date().getFullYear();

}


/* =========================================================
   MOBILE SIDEBAR
   ========================================================= */

if (menuBtn && sidebar) {

    menuBtn.addEventListener(
        "click",
        function () {

            sidebar.classList.toggle("open");

            if (overlay) {
                overlay.classList.toggle("show");
            }

        }
    );

}


if (overlay) {

    overlay.addEventListener(
        "click",
        function () {

            sidebar.classList.remove("open");

            overlay.classList.remove("show");

        }
    );

}


/* =========================================================
   SHOW MESSAGE
   ========================================================= */

function showMessage(message, type) {

    if (!formMessage) {
        return;
    }

    formMessage.textContent =
        message;

    formMessage.className =
        "form-message " + type;

}


/* =========================================================
   CLEAR MESSAGE
   ========================================================= */

function clearMessage() {

    if (!formMessage) {
        return;
    }

    formMessage.textContent = "";

    formMessage.className =
        "form-message";

}


/* =========================================================
   FORMAT UGX
   ========================================================= */

function formatUGX(amount) {

    const number =
        Number(amount) || 0;

    return (
        "UGX " +
        number.toLocaleString("en-UG")
    );

}


/* =========================================================
   LOAD USER BALANCE
   ========================================================= */

async function loadBalance() {

    try {

        const response =
            await fetch(
                `${API_URL}/profile.php`,
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

            if (availableBalance) {

                availableBalance.textContent =
                    "UGX 0";

            }

            return;

        }


        const user =
            data.user || data;


        let balance =
            user.balance ??
            user.wallet_balance ??
            0;


        /*
         * Handle MongoDB Decimal128
         * if returned as an object.
         */

        if (
            typeof balance === "object" &&
            balance !== null
        ) {

            if (
                balance.$numberDecimal
            ) {

                balance =
                    balance.$numberDecimal;

            }

        }


        balance =
            Number(balance) || 0;


        if (availableBalance) {

            availableBalance.textContent =
                formatUGX(balance);

        }


        /*
         * Store balance locally for validation.
         */

        window.crownCashBalance =
            balance;


    } catch (error) {

        console.error(
            "Balance loading error:",
            error
        );


        if (availableBalance) {

            availableBalance.textContent =
                "UGX 0";

        }

    }

}


/* =========================================================
   LOAD WITHDRAWAL HISTORY
   ========================================================= */

async function loadWithdrawalHistory() {

    if (!withdrawalHistory) {
        return;
    }


    withdrawalHistory.innerHTML = `

        <div class="loading">

            <i class="fa-solid fa-spinner fa-spin"></i>

            Loading withdrawal history...

        </div>

    `;


    try {

        const response =
            await fetch(
                `${API_URL}/withdrawals.php`,
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
            response.status === 401
        ) {

            withdrawalHistory.innerHTML = `

                <div class="empty-history">

                    <i class="fa-solid fa-lock"></i>

                    Please log in to view your withdrawals.

                </div>

            `;

            return;

        }


        if (
            !response.ok ||
            !data.success
        ) {

            throw new Error(
                data.message ||
                "Unable to load withdrawal history."
            );

        }


        const withdrawals =
            Array.isArray(data.withdrawals)
                ? data.withdrawals
                : [];


        /*
         * No withdrawals
         */

        if (withdrawals.length === 0) {

            withdrawalHistory.innerHTML = `

                <div class="empty-history">

                    <i class="fa-solid fa-receipt"></i>

                    <p>No withdrawal requests yet.</p>

                </div>

            `;

            return;

        }


        /*
         * Display withdrawals
         */

        withdrawalHistory.innerHTML =
            withdrawals
                .map(
                    createWithdrawalHTML
                )
                .join("");


    } catch (error) {

        console.error(
            "Withdrawal history error:",
            error
        );


        withdrawalHistory.innerHTML = `

            <div class="empty-history">

                <i class="fa-solid fa-circle-exclamation"></i>

                <p>
                    Unable to load withdrawal history.
                </p>

            </div>

        `;

    }

}


/* =========================================================
   CREATE WITHDRAWAL HISTORY HTML
   ========================================================= */

function createWithdrawalHTML(withdrawal) {

    const amount =
        Number(
            withdrawal.amount || 0
        );


    const status =
        String(
            withdrawal.status ||
            "pending"
        ).toLowerCase();


    const method =
        withdrawal.payment_method ||
        withdrawal.method ||
        "Mobile Money";


    const account =
        withdrawal.phone ||
        withdrawal.account ||
        "";


    /*
     * Format date
     */

    let dateText =
        "Date unavailable";


    if (withdrawal.created_at) {

        const date =
            new Date(
                withdrawal.created_at
            );


        if (!isNaN(date.getTime())) {

            dateText =
                date.toLocaleString(
                    "en-UG",
                    {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit"
                    }
                );

        }

    }


    /*
     * Status icon
     */

    let statusIcon =
        "fa-clock";


    if (status === "approved") {

        statusIcon =
            "fa-circle-check";

    }

    else if (status === "rejected") {

        statusIcon =
            "fa-circle-xmark";

    }

    else if (status === "paid") {

        statusIcon =
            "fa-money-bill-transfer";

    }


    /*
     * Mask phone number
     */

    let maskedAccount =
        account;


    if (account.length >= 7) {

        maskedAccount =
            account.substring(0, 4) +
            "****" +
            account.substring(
                account.length - 2
            );

    }


    return `

        <div class="withdrawal-item">

            <div class="withdrawal-top">

                <div>

                    <div class="withdrawal-amount">

                        ${formatUGX(amount)}

                    </div>


                    <div class="withdrawal-method">

                        <i class="fa-solid fa-mobile-screen-button"></i>

                        ${escapeHTML(
                            String(method).toUpperCase()
                        )}

                        ${maskedAccount
                            ? " • " +
                              escapeHTML(maskedAccount)
                            : ""
                        }

                    </div>


                    <div class="withdrawal-date">

                        <i class="fa-regular fa-calendar"></i>

                        ${escapeHTML(dateText)}

                    </div>

                </div>


                <span class="status ${escapeHTML(status)}">

                    <i class="fa-solid ${statusIcon}"></i>

                    ${escapeHTML(
                        capitalize(status)
                    )}

                </span>

            </div>

        </div>

    `;

}


/* =========================================================
   ESCAPE HTML
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


/* =========================================================
   CAPITALIZE
   ========================================================= */

function capitalize(value) {

    if (!value) {
        return "";
    }

    return (
        value.charAt(0).toUpperCase() +
        value.slice(1)
    );

}


/* =========================================================
   VALIDATE UGANDAN PHONE
   ========================================================= */

function normalizePhone(phone) {

    let cleaned =
        String(phone)
            .trim()
            .replace(
                /[\s\-]/g,
                ""
            );


    /*
     * Convert +256XXXXXXXXX
     * to 07XXXXXXXX
     */

    if (
        cleaned.startsWith("+256")
    ) {

        cleaned =
            "0" +
            cleaned.substring(4);

    }


    /*
     * Convert 256XXXXXXXXX
     */

    else if (
        cleaned.startsWith("256")
    ) {

        cleaned =
            "0" +
            cleaned.substring(3);

    }


    return cleaned;

}


/* =========================================================
   CHECK PHONE NETWORK
   ========================================================= */

function checkNetwork(phone, method) {

    const prefix =
        phone.substring(0, 3);


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


    if (method === "mtn") {

        return mtnPrefixes.includes(
            prefix
        );

    }


    if (method === "airtel") {

        return airtelPrefixes.includes(
            prefix
        );

    }


    return false;

}


/* =========================================================
   SUBMIT WITHDRAWAL
   ========================================================= */

if (withdrawForm) {

    withdrawForm.addEventListener(
        "submit",
        async function (event) {

            event.preventDefault();


            clearMessage();


            /*
             * Get values
             */

            const amount =
                Number(
                    amountInput.value
                );


            const method =
                paymentMethod.value;


            let phone =
                normalizePhone(
                    phoneNumber.value
                );


            /*
             * Validate amount
             */

            if (
                !Number.isFinite(amount) ||
                amount <= 0
            ) {

                showMessage(
                    "Please enter a valid withdrawal amount.",
                    "error"
                );

                return;

            }


            /*
             * Minimum withdrawal
             */

            if (amount < 10000) {

                showMessage(
                    "Minimum withdrawal amount is UGX 10,000.",
                    "error"
                );

                return;

            }


            /*
             * Whole UGX only
             */

            if (
                !Number.isInteger(amount)
            ) {

                showMessage(
                    "Withdrawal amount must be a whole UGX amount.",
                    "error"
                );

                return;

            }


            /*
             * Select network
             */

            if (!method) {

                showMessage(
                    "Please select MTN or Airtel Mobile Money.",
                    "error"
                );

                return;

            }


            /*
             * Validate phone
             */

            if (
                !/^07[0-9]{8}$/.test(phone)
            ) {

                showMessage(
                    "Please enter a valid Ugandan Mobile Money number.",
                    "error"
                );

                return;

            }


            /*
             * Check selected network
             */

            if (
                !checkNetwork(
                    phone,
                    method
                )
            ) {

                if (method === "mtn") {

                    showMessage(
                        "The number does not appear to be an MTN number.",
                        "error"
                    );

                } else {

                    showMessage(
                        "The number does not appear to be an Airtel number.",
                        "error"
                    );

                }

                return;

            }


            /*
             * Check locally loaded balance.
             *
             * The backend will perform
             * the final balance check too.
             */

            if (
                typeof window.crownCashBalance ===
                "number" &&
                amount >
                window.crownCashBalance
            ) {

                showMessage(
                    "Insufficient available balance.",
                    "error"
                );

                return;

            }


            /*
             * Disable button
             */

            withdrawBtn.disabled = true;


            withdrawBtn.innerHTML = `

                <i class="fa-solid fa-spinner fa-spin"></i>

                <span>Submitting...</span>

            `;


            try {

                /*
                 * Send request to your existing
                 * withdrawal.php
                 */

                const response =
                    await fetch(
                        `${API_URL}/withdrawal.php`,
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


                /*
                 * Try to read JSON
                 */

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
                 * Not logged in
                 */

                if (
                    response.status === 401
                ) {

                    throw new Error(
                        "Your session has expired. Please log in again."
                    );

                }


                /*
                 * Server rejected request
                 */

                if (
                    !response.ok ||
                    !data.success
                ) {

                    throw new Error(
                        data.message ||
                        "Unable to submit withdrawal request."
                    );

                }


                /*
                 * SUCCESS
                 */

                showMessage(
                    data.message ||
                    "Withdrawal request submitted successfully. It is pending admin approval.",
                    "success"
                );


                /*
                 * Clear form
                 */

                withdrawForm.reset();


                /*
                 * Reload balance and history
                 */

                await loadBalance();

                await loadWithdrawalHistory();


            } catch (error) {

                console.error(
                    "Withdrawal submission error:",
                    error
                );


                showMessage(
                    error.message ||
                    "Unable to submit withdrawal request. Please try again.",
                    "error"
                );


            } finally {

                /*
                 * Enable button again
                 */

                withdrawBtn.disabled = false;


                withdrawBtn.innerHTML = `

                    <i class="fa-solid fa-paper-plane"></i>

                    <span>
                        Submit Withdrawal Request
                    </span>

                `;

            }

        }
    );

}


/* =========================================================
   LOGOUT
   ========================================================= */

if (logoutBtn) {

    logoutBtn.addEventListener(
        "click",
        async function (event) {

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


            /*
             * Always return to login
             */

            window.location.href =
                "login.html";

        }
    );

}


/* =========================================================
   INITIALIZE PAGE
   ========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    function () {

        loadBalance();

        loadWithdrawalHistory();

    }
);