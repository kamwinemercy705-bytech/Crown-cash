/* =========================================================
   CROWN CASH — DEPOSIT SYSTEM
   deposit.js
   ========================================================= */

const API_URL = "https://crown-cash1.onrender.com";


document.addEventListener("DOMContentLoaded", () => {

    /* =====================================================
       ELEMENTS
    ===================================================== */

    const depositForm =
        document.getElementById("depositForm");

    const amountInput =
        document.getElementById("amount");

    const transactionReferenceInput =
        document.getElementById("transactionReference");

    const availableBalance =
        document.getElementById("availableBalance");

    const formMessage =
        document.getElementById("formMessage");

    const depositButton =
        document.getElementById("depositButton");

    const depositHistory =
        document.getElementById("depositHistory");

    const logoutButton =
        document.getElementById("logoutButton");

    const menuToggle =
        document.getElementById("menuToggle");

    const sidebar =
        document.getElementById("sidebar");

    const sidebarOverlay =
        document.getElementById("sidebarOverlay");


    /* =====================================================
       HELPERS
    ===================================================== */

    function formatUGX(amount) {

        const number = Number(amount) || 0;

        return "UGX " +
            number.toLocaleString("en-UG", {
                maximumFractionDigits: 0
            });
    }


    function escapeHTML(value) {

        return String(value ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }


    function showMessage(
        text,
        type = "error"
    ) {

        if (!formMessage) return;

        formMessage.textContent = text;

        formMessage.className =
            `form-message ${type}`;

        formMessage.style.display =
            "block";
    }


    function hideMessage() {

        if (!formMessage) return;

        formMessage.style.display =
            "none";

        formMessage.textContent = "";
    }


    function formatDate(dateValue) {

        if (!dateValue) {
            return "Date unavailable";
        }

        const date =
            new Date(dateValue);

        if (
            Number.isNaN(
                date.getTime()
            )
        ) {
            return "Date unavailable";
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


    function formatTime(dateValue) {

        if (!dateValue) {
            return "";
        }

        const date =
            new Date(dateValue);

        if (
            Number.isNaN(
                date.getTime()
            )
        ) {
            return "";
        }

        return date.toLocaleTimeString(
            "en-UG",
            {
                hour: "2-digit",
                minute: "2-digit"
            }
        );
    }


    function getSelectedPaymentMethod() {

        const selected =
            document.querySelector(
                'input[name="payment_method"]:checked'
            );

        return selected
            ? selected.value
            : "";
    }


    function getStatusClass(status) {

        const normalized =
            String(status || "pending")
                .toLowerCase();

        if (
            normalized === "approved" ||
            normalized === "completed" ||
            normalized === "success"
        ) {
            return "approved";
        }

        if (
            normalized === "rejected" ||
            normalized === "failed"
        ) {
            return "rejected";
        }

        return "pending";
    }


    function getMethodIcon(method) {

        const normalized =
            String(method || "")
                .toLowerCase();

        if (normalized === "mtn") {

            return `
                <i class="fa-solid fa-mobile-screen"></i>
            `;
        }

        if (normalized === "airtel") {

            return `
                <i class="fa-solid fa-mobile-screen"></i>
            `;
        }

        return `
            <i class="fa-solid fa-wallet"></i>
        `;
    }


    /* =====================================================
       LOAD USER BALANCE
    ===================================================== */

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


            if (
                response.status === 401
            ) {

                window.location.href =
                    "/login.html";

                return;
            }


            const data =
                await response.json();


            if (
                !response.ok ||
                !data.success
            ) {

                throw new Error(
                    data.message ||
                    "Unable to load balance."
                );
            }


            const balance =
                data.balance ??
                data.wallet_balance ??
                0;


            if (availableBalance) {

                availableBalance.textContent =
                    formatUGX(balance);
            }


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


    /* =====================================================
       LOAD DEPOSIT HISTORY
    ===================================================== */

    async function loadDepositHistory() {

        if (!depositHistory) {
            return;
        }


        depositHistory.innerHTML = `

            <div class="history-loading">

                <i class="fa-solid fa-spinner fa-spin"></i>

                Loading deposits...

            </div>

        `;


        try {

            const response =
                await fetch(
                    `${API_URL}/deposits.php`,
                    {
                        method: "GET",

                        credentials: "include",

                        headers: {
                            "Accept":
                                "application/json"
                        }
                    }
                );


            if (
                response.status === 401
            ) {

                window.location.href =
                    "/login.html";

                return;
            }


            const data =
                await response.json();


            if (
                !response.ok ||
                !data.success
            ) {

                throw new Error(
                    data.message ||
                    "Unable to load deposit history."
                );
            }


            displayDepositHistory(
                data.deposits || []
            );


        } catch (error) {

            console.error(
                "Deposit history error:",
                error
            );


            depositHistory.innerHTML = `

                <div class="empty-deposits">

                    <i class="fa-solid fa-triangle-exclamation"></i>

                    <h3>
                        Unable to load deposits
                    </h3>

                    <p>
                        Please refresh the page
                        and try again.
                    </p>

                </div>

            `;
        }
    }


    /* =====================================================
       DISPLAY DEPOSIT HISTORY
    ===================================================== */

    function displayDepositHistory(
        deposits
    ) {

        if (!depositHistory) {
            return;
        }


        if (
            !Array.isArray(deposits) ||
            deposits.length === 0
        ) {

            depositHistory.innerHTML = `

                <div class="empty-deposits">

                    <i class="fa-solid fa-wallet"></i>

                    <h3>
                        No deposits yet
                    </h3>

                    <p>
                        Your deposit history
                        will appear here.
                    </p>

                </div>

            `;

            return;
        }


        depositHistory.innerHTML =
            deposits
                .map(createDepositRow)
                .join("");
    }


    /* =====================================================
       CREATE DEPOSIT ROW
    ===================================================== */

    function createDepositRow(
        deposit
    ) {

        const amount =
            Number(
                deposit.amount || 0
            );


        const method =
            String(
                deposit.payment_method ||
                deposit.method ||
                "mobile money"
            )
            .toLowerCase();


        const status =
            String(
                deposit.status ||
                "pending"
            )
            .toLowerCase();


        const reference =
            deposit.transaction_reference ||
            deposit.reference ||
            deposit.transaction_id ||
            "Reference unavailable";


        const createdAt =
            deposit.created_at ||
            deposit.date ||
            "";


        const safeReference =
            escapeHTML(reference);


        const displayMethod =
            method === "mtn"
                ? "MTN Mobile Money"
                : method === "airtel"
                    ? "Airtel Money"
                    : method;


        const safeMethod =
            escapeHTML(
                displayMethod
            );


        const safeStatus =
            escapeHTML(status);


        return `

            <div class="deposit-row">

                <div class="deposit-history-icon">

                    ${getMethodIcon(method)}

                </div>


                <div class="deposit-row-info">

                    <strong>
                        ${safeMethod}
                    </strong>

                    <small>
                        ${safeReference}
                        •
                        ${escapeHTML(
                            formatDate(createdAt)
                        )}
                        ${escapeHTML(
                            formatTime(createdAt)
                        )}
                    </small>

                </div>


                <div class="deposit-amount">

                    ${formatUGX(amount)}

                </div>


                <div
                    class="deposit-status ${getStatusClass(status)}"
                >

                    ${safeStatus}

                </div>

            </div>

        `;
    }


    /* =====================================================
       FORM VALIDATION
    ===================================================== */

    function validateAmount(amount) {

        if (!Number.isFinite(amount)) {

            return {
                valid: false,
                message:
                    "Please enter a valid deposit amount."
            };
        }


        if (amount < 10000) {

            return {
                valid: false,
                message:
                    "The minimum deposit is UGX 10,000."
            };
        }


        if (amount % 1000 !== 0) {

            return {
                valid: false,
                message:
                    "Deposit amounts must be in multiples of UGX 1,000."
            };
        }


        return {
            valid: true
        };
    }


    /* =====================================================
       SUBMIT DEPOSIT
    ===================================================== */

    if (depositForm) {

        depositForm.addEventListener(
            "submit",
            async (event) => {

                event.preventDefault();

                hideMessage();


                const amount =
                    Number(
                        amountInput?.value
                    );


                const paymentMethod =
                    getSelectedPaymentMethod();


                const transactionReference =
                    transactionReferenceInput
                        ?.value
                        .trim() || "";


                /* -----------------------------------------
                   VALIDATE AMOUNT
                ----------------------------------------- */

                const amountValidation =
                    validateAmount(amount);


                if (
                    !amountValidation.valid
                ) {

                    showMessage(
                        amountValidation.message
                    );

                    amountInput?.focus();

                    return;
                }


                /* -----------------------------------------
                   VALIDATE METHOD
                ----------------------------------------- */

                if (
                    paymentMethod !== "mtn" &&
                    paymentMethod !== "airtel"
                ) {

                    showMessage(
                        "Please select MTN Mobile Money or Airtel Money."
                    );

                    return;
                }


                /* -----------------------------------------
                   VALIDATE REFERENCE
                ----------------------------------------- */

                if (
                    transactionReference.length < 4
                ) {

                    showMessage(
                        "Please enter your Mobile Money transaction reference."
                    );

                    transactionReferenceInput?.focus();

                    return;
                }


                /* -----------------------------------------
                   DISABLE BUTTON
                ----------------------------------------- */

                const originalButtonHTML =
                    depositButton?.innerHTML ||
                    "";


                if (depositButton) {

                    depositButton.disabled =
                        true;

                    depositButton.innerHTML = `
                        <i class="fa-solid fa-spinner fa-spin"></i>
                        Submitting...
                    `;
                }


                try {

                    /* -------------------------------------
                       SEND TO BACKEND
                    ------------------------------------- */

                    const response =
                        await fetch(
                            `${API_URL}/deposit.php`,
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

                                    amount:
                                        amount,

                                    payment_method:
                                        paymentMethod,

                                    transaction_reference:
                                        transactionReference

                                })
                            }
                        );


                    /* -------------------------------------
                       HANDLE LOGIN
                    ------------------------------------- */

                    if (
                        response.status === 401
                    ) {

                        window.location.href =
                            "/login.html";

                        return;
                    }


                    /* -------------------------------------
                       READ RESPONSE
                    ------------------------------------- */

                    let data;


                    try {

                        data =
                            await response.json();

                    } catch (error) {

                        throw new Error(
                            "The deposit server returned an invalid response."
                        );
                    }


                    /* -------------------------------------
                       FAILED REQUEST
                    ------------------------------------- */

                    if (
                        !response.ok ||
                        !data.success
                    ) {

                        throw new Error(
                            data.message ||
                            "Deposit request failed."
                        );
                    }


                    /* -------------------------------------
                       SUCCESS
                    ------------------------------------- */

                    showMessage(
                        data.message ||
                        "Deposit submitted successfully. Your request is pending verification.",
                        "success"
                    );


                    /* -------------------------------------
                       CLEAR FORM
                    ------------------------------------- */

                    depositForm.reset();


                    /* -------------------------------------
                       REFRESH DATA
                    ------------------------------------- */

                    await loadBalance();

                    await loadDepositHistory();


                    /* -------------------------------------
                       SCROLL TO MESSAGE
                    ------------------------------------- */

                    formMessage?.scrollIntoView({
                        behavior: "smooth",
                        block: "center"
                    });


                } catch (error) {

                    console.error(
                        "Deposit submission error:",
                        error
                    );


                    showMessage(
                        error.message ||
                        "Unable to submit your deposit. Please try again."
                    );


                } finally {

                    /* -------------------------------------
                       RESTORE BUTTON
                    ------------------------------------- */

                    if (depositButton) {

                        depositButton.disabled =
                            false;

                        depositButton.innerHTML =
                            originalButtonHTML ||
                            `
                                <i class="fa-solid fa-circle-plus"></i>
                                Submit Deposit
                            `;
                    }

                }

            }
        );
    }


    /* =====================================================
       AMOUNT INPUT
    ===================================================== */

    if (amountInput) {

        amountInput.addEventListener(
            "input",
            () => {

                let value =
                    amountInput.value;

                if (
                    Number(value) < 0
                ) {

                    amountInput.value =
                        "0";
                }

            }
        );
    }


    /* =====================================================
       TRANSACTION REFERENCE
    ===================================================== */

    if (
        transactionReferenceInput
    ) {

        transactionReferenceInput
            .addEventListener(
                "input",
                () => {

                    transactionReferenceInput.value =
                        transactionReferenceInput.value
                            .replace(
                                /[^a-zA-Z0-9\-]/g,
                                ""
                            )
                            .toUpperCase();

                }
            );
    }


    /* =====================================================
       MOBILE SIDEBAR
    ===================================================== */

    function closeSidebar() {

        sidebar?.classList.remove(
            "open"
        );

        sidebarOverlay?.classList.remove(
            "show"
        );
    }


    if (menuToggle) {

        menuToggle.addEventListener(
            "click",
            () => {

                sidebar?.classList.toggle(
                    "open"
                );

                sidebarOverlay?.classList.toggle(
                    "show"
                );

            }
        );
    }


    if (sidebarOverlay) {

        sidebarOverlay.addEventListener(
            "click",
            closeSidebar
        );
    }


    document
        .querySelectorAll(".sidebar-nav a")
        .forEach(link => {

            link.addEventListener(
                "click",
                closeSidebar
            );

        });


    /* =====================================================
       LOGOUT
    ===================================================== */

    if (logoutButton) {

        logoutButton.addEventListener(
            "click",
            async (event) => {

                event.preventDefault();


                try {

                    await fetch(
                        `${API_URL}/logout.php`,
                        {
                            method: "POST",

                            credentials: "include"
                        }
                    );

                } catch (error) {

                    console.error(
                        "Logout error:",
                        error
                    );

                } finally {

                    window.location.href =
                        "/login.html";
                }

            }
        );
    }


    /* =====================================================
       INITIAL LOAD
    ===================================================== */

    loadBalance();

    loadDepositHistory();

});
