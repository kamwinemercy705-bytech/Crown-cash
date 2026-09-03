/* =========================================================
   CROWN CASH — DEPOSIT PAGE JAVASCRIPT
   ========================================================= */

document.addEventListener("DOMContentLoaded", function () {

    /* =====================================================
       CONFIGURATION
    ===================================================== */

    const API_BASE =
        "https://crown-cash1.onrender.com";


    /* =====================================================
       ELEMENTS
    ===================================================== */

    const depositForm =
        document.getElementById("depositForm");

    const amountInput =
        document.getElementById("amount");

    const phoneInput =
        document.getElementById("phone");

    const depositBtn =
        document.getElementById("depositBtn");

    const formMessage =
        document.getElementById("formMessage");

    const currentBalance =
        document.getElementById("currentBalance");

    const topUserName =
        document.getElementById("topUserName");

    const currentYear =
        document.getElementById("currentYear");

    const menuBtn =
        document.getElementById("menuBtn");

    const sidebar =
        document.getElementById("sidebar");

    const sidebarOverlay =
        document.getElementById("sidebarOverlay");

    const logoutBtn =
        document.getElementById("logoutBtn");


    /* =====================================================
       CURRENT YEAR
    ===================================================== */

    if (currentYear) {
        currentYear.textContent =
            new Date().getFullYear();
    }


    /* =====================================================
       FORMAT UGX
    ===================================================== */

    function formatUGX(value) {

        const number =
            Number(value) || 0;

        return number.toLocaleString("en-UG", {
            maximumFractionDigits: 0
        });

    }


    /* =====================================================
       MESSAGE
    ===================================================== */

    function showMessage(message, type) {

        if (!formMessage) {
            return;
        }

        formMessage.textContent =
            message || "";

        formMessage.className =
            "form-message " + (type || "");

    }


    /* =====================================================
       LOAD SAVED USER
    ===================================================== */

    function loadSavedUser() {

        try {

            const savedUser =
                localStorage.getItem(
                    "crowncash_user"
                );

            if (!savedUser) {
                return;
            }

            const user =
                JSON.parse(savedUser);

            if (
                topUserName &&
                user
            ) {

                const firstName =
                    user.firstName || "";

                topUserName.textContent =
                    firstName || "User";

            }

            if (
                currentBalance &&
                user
            ) {

                currentBalance.textContent =
                    formatUGX(
                        user.balance || 0
                    );

            }

            if (
                phoneInput &&
                user.phone
            ) {

                phoneInput.value =
                    user.phone;

            }

        } catch (error) {

            console.error(
                "Unable to load saved user:",
                error
            );

        }

    }

    loadSavedUser();


    /* =====================================================
       MOBILE MENU
    ===================================================== */

    function openSidebar() {

        if (sidebar) {
            sidebar.classList.add("open");
        }

        if (sidebarOverlay) {
            sidebarOverlay.classList.add("show");
        }

    }


    function closeSidebar() {

        if (sidebar) {
            sidebar.classList.remove("open");
        }

        if (sidebarOverlay) {
            sidebarOverlay.classList.remove("show");
        }

    }


    if (menuBtn) {

        menuBtn.addEventListener(
            "click",
            function () {

                if (
                    sidebar &&
                    sidebar.classList.contains("open")
                ) {

                    closeSidebar();

                } else {

                    openSidebar();

                }

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
        .querySelectorAll(".nav-item")
        .forEach(function (item) {

            item.addEventListener(
                "click",
                closeSidebar
            );

        });


    /* =====================================================
       PHONE NORMALIZATION
    ===================================================== */

    function normalizeUgandaPhone(phone) {

        let value =
            String(phone || "")
                .trim()
                .replace(/\s+/g, "")
                .replace(/-/g, "");

        if (value.startsWith("+256")) {

            value =
                "0" +
                value.substring(4);

        } else if (
            value.startsWith("256")
        ) {

            value =
                "0" +
                value.substring(3);

        }

        return value;

    }


    /* =====================================================
       PHONE VALIDATION
    ===================================================== */

    function validUgandaPhone(phone) {

        return /^07\d{8}$/.test(phone);

    }


    /* =====================================================
       AMOUNT VALIDATION
    ===================================================== */

    function validAmount(amount) {

        return (
            Number.isFinite(amount) &&
            amount >= 1000
        );

    }


    /* =====================================================
       GET PAYMENT METHOD
    ===================================================== */

    function getPaymentMethod() {

        const selected =
            document.querySelector(
                'input[name="paymentMethod"]:checked'
            );

        return selected
            ? selected.value
            : "";

    }


    /* =====================================================
       DEPOSIT SUBMISSION
    ===================================================== */

    if (depositForm) {

        depositForm.addEventListener(
            "submit",
            async function (event) {

                event.preventDefault();

                showMessage("", "");

                const amount =
                    Number(
                        amountInput
                            ? amountInput.value
                            : 0
                    );

                const phone =
                    normalizeUgandaPhone(
                        phoneInput
                            ? phoneInput.value
                            : ""
                    );

                const paymentMethod =
                    getPaymentMethod();


                /* -----------------------------------------
                   VALIDATION
                ----------------------------------------- */

                if (!validAmount(amount)) {

                    showMessage(
                        "Minimum deposit is UGX 1,000.",
                        "error"
                    );

                    if (amountInput) {
                        amountInput.focus();
                    }

                    return;

                }


                if (!validUgandaPhone(phone)) {

                    showMessage(
                        "Enter a valid Uganda mobile-money number.",
                        "error"
                    );

                    if (phoneInput) {
                        phoneInput.focus();
                    }

                    return;

                }


                if (
                    paymentMethod !== "MTN" &&
                    paymentMethod !== "AIRTEL"
                ) {

                    showMessage(
                        "Please select a payment method.",
                        "error"
                    );

                    return;

                }


                /* -----------------------------------------
                   BUTTON STATE
                ----------------------------------------- */

                const originalButtonHTML =
                    depositBtn
                        ? depositBtn.innerHTML
                        : "";

                if (depositBtn) {

                    depositBtn.disabled = true;

                    depositBtn.innerHTML = `
                        <span class="btn-icon">
                            <svg viewBox="0 0 24 24"
                                 fill="none"
                                 stroke="currentColor"
                                 stroke-width="1.8"
                                 stroke-linecap="round"
                                 stroke-linejoin="round">
                                <circle cx="12" cy="12" r="8"/>
                                <path d="M12 8v4l2.5 2"/>
                            </svg>
                        </span>
                        <span>Processing...</span>
                    `;

                }


                try {

                    /* -------------------------------------
                       SEND REQUEST TO RENDER BACKEND
                    ------------------------------------- */

                    const response =
                        await fetch(
                            API_BASE +
                            "/create_deposit.php",
                            {
                                method: "POST",

                                credentials: "include",

                                headers: {
                                    "Content-Type":
                                        "application/json"
                                },

                                body: JSON.stringify({

                                    amount: amount,

                                    phone: phone,

                                    paymentMethod:
                                        paymentMethod

                                })

                            }
                        );


                    const result =
                        await response.json();


                    /* -------------------------------------
                       BACKEND ERROR
                    ------------------------------------- */

                    if (!response.ok) {

                        throw new Error(
                            result.message ||
                            "Unable to create deposit request."
                        );

                    }


                    if (!result.success) {

                        throw new Error(
                            result.message ||
                            "Deposit request was not successful."
                        );

                    }


                    /* -------------------------------------
                       SUCCESS
                    ------------------------------------- */

                    showMessage(
                        result.message ||
                        "Deposit request created successfully.",
                        "success"
                    );


                    /*
                     * IMPORTANT:
                     *
                     * The frontend does NOT automatically
                     * increase the user's balance.
                     *
                     * The balance should only change after
                     * the payment provider confirms payment.
                     */


                    if (
                        result.deposit &&
                        result.deposit.status
                    ) {

                        console.log(
                            "Deposit status:",
                            result.deposit.status
                        );

                    }


                    /*
                     * Refresh saved user information if
                     * the backend returned updated data.
                     */

                    if (result.user) {

                        try {

                            localStorage.setItem(
                                "crowncash_user",
                                JSON.stringify(
                                    result.user
                                )
                            );

                            if (
                                currentBalance &&
                                result.user.balance !== undefined
                            ) {

                                currentBalance.textContent =
                                    formatUGX(
                                        result.user.balance
                                    );

                            }

                        } catch (storageError) {

                            console.warn(
                                "Could not update saved user.",
                                storageError
                            );

                        }

                    }


                } catch (error) {

                    console.error(
                        "Deposit error:",
                        error
                    );

                    showMessage(
                        error.message ||
                        "Unable to connect to the deposit server.",
                        "error"
                    );

                } finally {

                    if (depositBtn) {

                        depositBtn.disabled = false;

                        depositBtn.innerHTML =
                            originalButtonHTML;

                    }

                }

            }
        );

    }


    /* =====================================================
       LOGOUT
    ===================================================== */

    if (logoutBtn) {

        logoutBtn.addEventListener(
            "click",
            async function () {

                try {

                    await fetch(
                        API_BASE + "/logout.php",
                        {
                            method: "POST",
                            credentials: "include"
                        }
                    );

                } catch (error) {

                    console.warn(
                        "Logout request failed:",
                        error
                    );

                } finally {

                    localStorage.removeItem(
                        "crowncash_user"
                    );

                    window.location.href =
                        "login.html";

                }

            }
        );

    }


    /* =====================================================
       AMOUNT INPUT CLEANUP
    ===================================================== */

    if (amountInput) {

        amountInput.addEventListener(
            "input",
            function () {

                if (
                    Number(this.value) < 0
                ) {

                    this.value = "";

                }

                showMessage("", "");

            }
        );

    }


    /* =====================================================
       PHONE INPUT CLEANUP
    ===================================================== */

    if (phoneInput) {

        phoneInput.addEventListener(
            "input",
            function () {

                this.value =
                    this.value
                        .replace(/[^\d+]/g, "")
                        .slice(0, 13);

                showMessage("", "");

            }
        );

    }


    /* =====================================================
       CLOSE MENU WITH ESCAPE
    ===================================================== */

    document.addEventListener(
        "keydown",
        function (event) {

            if (event.key === "Escape") {
                closeSidebar();
            }

        }
    );

});