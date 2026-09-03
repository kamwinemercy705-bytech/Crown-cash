/* =========================================================
   CROWN CASH — DEPOSIT JAVASCRIPT
========================================================= */

document.addEventListener("DOMContentLoaded", function () {

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

    const paymentMethodInput =
        document.getElementById("paymentMethod");

    const depositBtn =
        document.getElementById("depositBtn");

    const depositMessage =
        document.getElementById("depositMessage");

    const balanceElement =
        document.getElementById("balance");

    const topUserName =
        document.getElementById("topUserName");

    const avatar =
        document.getElementById("avatar");

    const merchantCode =
        document.getElementById("merchantCode");

    const merchantLabel =
        document.getElementById("merchantLabel");

    const copyMerchant =
        document.getElementById("copyMerchant");

    const menuBtn =
        document.getElementById("menuBtn");

    const sidebar =
        document.getElementById("sidebar");

    const logoutBtn =
        document.getElementById("logoutBtn");

    const currentYear =
        document.getElementById("currentYear");


    /* =====================================================
       MERCHANT CODES — DEMO
    ===================================================== */

    /*
     * These are DEMO PLACEHOLDERS.
     *
     * Replace them with your actual merchant codes when
     * you have them.
     *
     * Do not use a personal phone number here.
     */

    const MERCHANT_CODES = {

        MTN: "YOUR_MTN_MERCHANT_CODE",

        AIRTEL: "YOUR_AIRTEL_MERCHANT_CODE"

    };


    /* =====================================================
       CURRENT YEAR
    ===================================================== */

    if (currentYear) {
        currentYear.textContent =
            new Date().getFullYear();
    }


    /* =====================================================
       LOAD USER
    ===================================================== */

    let savedUser = null;

    try {

        savedUser =
            JSON.parse(
                localStorage.getItem(
                    "crowncash_user"
                )
            );

    } catch (error) {

        savedUser = null;

    }


    if (savedUser) {

        const firstName =
            savedUser.firstName || "User";

        const lastName =
            savedUser.lastName || "";

        const fullName =
            `${firstName} ${lastName}`.trim();

        if (topUserName) {
            topUserName.textContent =
                fullName;
        }

        if (avatar) {
            avatar.textContent =
                firstName
                    .charAt(0)
                    .toUpperCase();
        }

        if (
            savedUser.balance !== undefined
        ) {

            balanceElement.textContent =
                Number(
                    savedUser.balance || 0
                ).toLocaleString();

        }

    }


    /* =====================================================
       MOBILE MENU
    ===================================================== */

    if (menuBtn && sidebar) {

        menuBtn.addEventListener(
            "click",
            function () {

                sidebar.classList.toggle(
                    "open"
                );

            }
        );

    }


    /* =====================================================
       UPDATE MERCHANT CODE
    ===================================================== */

    function updateMerchantCode(method) {

        const code =
            MERCHANT_CODES[method] ||
            "Merchant code unavailable";

        if (merchantCode) {
            merchantCode.textContent =
                code;
        }

        if (merchantLabel) {

            merchantLabel.textContent =
                method === "MTN"
                    ? "MTN Merchant Code"
                    : "Airtel Merchant Code";

        }

    }


    updateMerchantCode("MTN");


    /* =====================================================
       PAYMENT METHOD SELECTION
    ===================================================== */

    const methodButtons =
        document.querySelectorAll(
            ".method-btn"
        );


    methodButtons.forEach(
        function (button) {

            button.addEventListener(
                "click",
                function () {

                    methodButtons.forEach(
                        function (item) {

                            item.classList.remove(
                                "active"
                            );

                        }
                    );


                    button.classList.add(
                        "active"
                    );


                    const method =
                        button.dataset.method;


                    paymentMethodInput.value =
                        method;


                    updateMerchantCode(
                        method
                    );

                }
            );

        }
    );


    /* =====================================================
       COPY MERCHANT CODE
    ===================================================== */

    if (copyMerchant) {

        copyMerchant.addEventListener(
            "click",
            async function () {

                const code =
                    merchantCode.textContent.trim();

                if (
                    !code ||
                    code === "Loading..." ||
                    code.includes("YOUR_")
                ) {

                    showMessage(
                        "Set the actual merchant code before copying.",
                        "error"
                    );

                    return;

                }


                try {

                    await navigator.clipboard.writeText(
                        code
                    );

                    copyMerchant.textContent =
                        "Copied";

                    setTimeout(
                        function () {

                            copyMerchant.textContent =
                                "Copy";

                        },
                        1500
                    );

                } catch (error) {

                    showMessage(
                        "Unable to copy merchant code.",
                        "error"
                    );

                }

            }
        );

    }


    /* =====================================================
       MESSAGE
    ===================================================== */

    function showMessage(
        message,
        type = "info"
    ) {

        if (!depositMessage) {
            return;
        }

        depositMessage.textContent =
            message;

        if (type === "success") {

            depositMessage.style.color =
                "#3ddc97";

        } else if (type === "error") {

            depositMessage.style.color =
                "#ff6b7a";

        } else {

            depositMessage.style.color =
                "#a89fba";

        }

    }


    /* =====================================================
       VALIDATE PHONE
    ===================================================== */

    function normalizePhone(phone) {

        let value =
            phone
                .trim()
                .replace(/[\s\-]/g, "");


        if (
            value.startsWith("+256")
        ) {

            value =
                "0" +
                value.substring(4);

        }


        if (
            value.startsWith("256")
        ) {

            value =
                "0" +
                value.substring(3);

        }


        return value;

    }


    /* =====================================================
       DEPOSIT SUBMISSION
    ===================================================== */

    if (depositForm) {

        depositForm.addEventListener(
            "submit",
            async function (event) {

                event.preventDefault();


                showMessage(
                    "",
                    "info"
                );


                const amount =
                    Number(
                        amountInput.value
                    );


                const phone =
                    normalizePhone(
                        phoneInput.value
                    );


                const paymentMethod =
                    paymentMethodInput.value;


                /* -----------------------------------------
                   VALIDATE AMOUNT
                ----------------------------------------- */

                if (
                    !Number.isFinite(amount) ||
                    amount < 1000
                ) {

                    showMessage(
                        "Minimum deposit is UGX 1,000.",
                        "error"
                    );

                    return;

                }


                if (
                    !Number.isInteger(amount)
                ) {

                    showMessage(
                        "Deposit amount must be a whole UGX amount.",
                        "error"
                    );

                    return;

                }


                /* -----------------------------------------
                   VALIDATE PHONE
                ----------------------------------------- */

                if (
                    !/^07\d{8}$/.test(phone)
                ) {

                    showMessage(
                        "Enter a valid Uganda mobile-money number.",
                        "error"
                    );

                    return;

                }


                /* -----------------------------------------
                   VALIDATE METHOD
                ----------------------------------------- */

                if (
                    paymentMethod !== "MTN" &&
                    paymentMethod !== "AIRTEL"
                ) {

                    showMessage(
                        "Please select MTN or Airtel.",
                        "error"
                    );

                    return;

                }


                /* -----------------------------------------
                   BUTTON
                ----------------------------------------- */

                depositBtn.disabled = true;

                depositBtn.querySelector(
                    "span"
                ).textContent =
                    "Submitting...";


                try {

                    const response =
                        await fetch(
                            `${API_BASE}/create_deposit.php`,
                            {
                                method: "POST",

                                credentials: "include",

                                headers: {
                                    "Content-Type":
                                        "application/json"
                                },

                                body:
                                    JSON.stringify({

                                        amount:
                                            amount,

                                        phone:
                                            phone,

                                        paymentMethod:
                                            paymentMethod

                                    })

                            }
                        );


                    const result =
                        await response.json();


                    if (
                        !response.ok ||
                        !result.success
                    ) {

                        throw new Error(
                            result.message ||
                            "Deposit request failed."
                        );

                    }


                    /* -------------------------------------
                       UPDATE LOCAL USER BALANCE
                       Balance should remain unchanged because
                       deposit is still pending.
                    ------------------------------------- */

                    if (
                        result.user
                    ) {

                        localStorage.setItem(
                            "crowncash_user",
                            JSON.stringify(
                                result.user
                            )
                        );

                    }


                    showMessage(
                        `Deposit request ${result.deposit.reference} created successfully. Payment remains pending until verified.`,
                        "success"
                    );


                    depositForm.reset();


                    paymentMethodInput.value =
                        "MTN";


                    methodButtons.forEach(
                        function (button) {

                            button.classList.remove(
                                "active"
                            );

                        }
                    );


                    const mtnButton =
                        document.querySelector(
                            '.method-btn[data-method="MTN"]'
                        );


                    if (mtnButton) {

                        mtnButton.classList.add(
                            "active"
                        );

                    }


                    updateMerchantCode(
                        "MTN"
                    );


                } catch (error) {

                    console.error(
                        "Deposit error:",
                        error
                    );


                    showMessage(
                        error.message ||
                        "Unable to create deposit request.",
                        "error"
                    );

                } finally {

                    depositBtn.disabled =
                        false;

                    depositBtn.querySelector(
                        "span"
                    ).textContent =
                        "Submit Deposit Request";

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
                        `${API_BASE}/logout.php`,
                        {
                            method: "POST",
                            credentials: "include"
                        }
                    );

                } catch (error) {

                    console.log(
                        "Logout request error:",
                        error
                    );

                }


                localStorage.removeItem(
                    "crowncash_user"
                );


                window.location.href =
                    "login.html";

            }
        );

    }

});