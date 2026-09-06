/* =========================================================
   CROWN CASH — WITHDRAWALS JS
   ========================================================= */

const API_BASE = "https://crown-cash1.onrender.com";


// =========================================================
// ELEMENTS
// =========================================================

const withdrawalForm =
    document.getElementById("withdrawalForm");

const withdrawalAmount =
    document.getElementById("withdrawalAmount");

const withdrawalMethod =
    document.getElementById("withdrawalMethod");

const withdrawalAccount =
    document.getElementById("withdrawalAccount");

const withdrawalSubmit =
    document.getElementById("withdrawalSubmit");

const withdrawalMessage =
    document.getElementById("withdrawalMessage");

const availableBalance =
    document.getElementById("availableBalance");

const topUserName =
    document.getElementById("topUserName");

const logoutBtn =
    document.getElementById("logoutBtn");

const currentYear =
    document.getElementById("currentYear");

const menuBtn =
    document.getElementById("menuBtn");

const sidebar =
    document.getElementById("sidebar");

const sidebarOverlay =
    document.getElementById("sidebarOverlay");

const mtnMethod =
    document.getElementById("mtnMethod");

const airtelMethod =
    document.getElementById("airtelMethod");


// =========================================================
// CONSTANTS
// =========================================================

const MIN_WITHDRAWAL = 1000;


// =========================================================
// USER DATA
// =========================================================

let currentUser = null;
let currentBalance = 0;


// =========================================================
// PAGE START
// =========================================================

document.addEventListener("DOMContentLoaded", () => {

    loadUser();

    setupMenu();

    setupPaymentMethods();

    setupWithdrawalForm();

    setupLogout();

    setupYear();

});


// =========================================================
// LOAD USER FROM LOCAL STORAGE
// =========================================================

function loadUser() {

    try {

        const savedUser =
            localStorage.getItem("crowncash_user");

        if (!savedUser) {

            redirectToLogin();

            return;
        }

        currentUser =
            JSON.parse(savedUser);

        if (!currentUser) {

            redirectToLogin();

            return;
        }

        updateUserDisplay();

    } catch (error) {

        console.error(
            "Unable to load user:",
            error
        );

        redirectToLogin();
    }
}


// =========================================================
// UPDATE USER DISPLAY
// =========================================================

function updateUserDisplay() {

    const firstName =
        currentUser.firstName || "";

    const lastName =
        currentUser.lastName || "";

    const fullName =
        `${firstName} ${lastName}`.trim();

    if (topUserName) {

        topUserName.textContent =
            fullName || "Crown Cash User";

    }


    currentBalance =
        Number(currentUser.balance || 0);

    updateBalanceDisplay();
}


// =========================================================
// BALANCE DISPLAY
// =========================================================

function updateBalanceDisplay() {

    if (!availableBalance) {
        return;
    }

    availableBalance.textContent =
        `UGX ${formatMoney(currentBalance)}`;
}


// =========================================================
// FORMAT MONEY
// =========================================================

function formatMoney(amount) {

    return Number(amount || 0).toLocaleString(
        "en-US",
        {
            maximumFractionDigits: 0
        }
    );
}


// =========================================================
// MOBILE MENU
// =========================================================

function setupMenu() {

    if (menuBtn) {

        menuBtn.addEventListener(
            "click",
            openSidebar
        );

    }

    if (sidebarOverlay) {

        sidebarOverlay.addEventListener(
            "click",
            closeSidebar
        );

    }

}


function openSidebar() {

    if (sidebar) {
        sidebar.classList.add("open");
    }

    if (sidebarOverlay) {
        sidebarOverlay.classList.add("active");
    }

}


function closeSidebar() {

    if (sidebar) {
        sidebar.classList.remove("open");
    }

    if (sidebarOverlay) {
        sidebarOverlay.classList.remove("active");
    }

}


// =========================================================
// PAYMENT METHOD SELECTION
// =========================================================

function setupPaymentMethods() {

    if (mtnMethod) {

        mtnMethod.addEventListener(
            "click",
            () => selectPaymentMethod("MTN")
        );

    }


    if (airtelMethod) {

        airtelMethod.addEventListener(
            "click",
            () => selectPaymentMethod("AIRTEL")
        );

    }

}


function selectPaymentMethod(method) {

    if (!withdrawalMethod) {
        return;
    }

    withdrawalMethod.value =
        method;


    if (mtnMethod) {

        mtnMethod.classList.toggle(
            "selected",
            method === "MTN"
        );

    }


    if (airtelMethod) {

        airtelMethod.classList.toggle(
            "selected",
            method === "AIRTEL"
        );

    }


    clearMessage();

}


// =========================================================
// WITHDRAWAL FORM
// =========================================================

function setupWithdrawalForm() {

    if (!withdrawalForm) {
        return;
    }

    withdrawalForm.addEventListener(
        "submit",
        handleWithdrawal
    );

}


// =========================================================
// HANDLE WITHDRAWAL
// =========================================================

async function handleWithdrawal(event) {

    event.preventDefault();


    clearMessage();


    // -----------------------------------------
    // Amount
    // -----------------------------------------

    const amount =
        Number(
            withdrawalAmount?.value || 0
        );


    // -----------------------------------------
    // Method
    // -----------------------------------------

    const method =
        withdrawalMethod?.value || "";


    // -----------------------------------------
    // Phone
    // -----------------------------------------

    const account =
        withdrawalAccount?.value
            .trim()
            .replace(/\s+/g, "");


    // -----------------------------------------
    // Validate amount
    // -----------------------------------------

    if (!Number.isFinite(amount) || amount <= 0) {

        showMessage(
            "Please enter a valid withdrawal amount.",
            "error"
        );

        return;
    }


    if (amount < MIN_WITHDRAWAL) {

        showMessage(
            "Minimum withdrawal amount is UGX 1,000.",
            "error"
        );

        return;
    }


    // -----------------------------------------
    // Validate whole UGX
    // -----------------------------------------

    if (!Number.isInteger(amount)) {

        showMessage(
            "Withdrawal amount must be a whole UGX amount.",
            "error"
        );

        return;
    }


    // -----------------------------------------
    // Check balance
    // -----------------------------------------

    if (amount > currentBalance) {

        showMessage(
            "Insufficient available balance.",
            "error"
        );

        return;
    }


    // -----------------------------------------
    // Validate method
    // -----------------------------------------

    if (
        method !== "MTN" &&
        method !== "AIRTEL"
    ) {

        showMessage(
            "Please select MTN Mobile Money or Airtel Money.",
            "error"
        );

        return;
    }


    // -----------------------------------------
    // Validate Uganda number
    // -----------------------------------------

    const normalizedPhone =
        normalizeUgandaPhone(account);


    if (!normalizedPhone) {

        showMessage(
            "Please enter a valid Uganda mobile money number, for example 07XXXXXXXX.",
            "error"
        );

        return;
    }


    // -----------------------------------------
    // Confirmation
    // -----------------------------------------

    const confirmed =
        window.confirm(
            `Request withdrawal of UGX ${formatMoney(amount)} to ${normalizedPhone} using ${method === "MTN" ? "MTN Mobile Money" : "Airtel Money"}?`
        );


    if (!confirmed) {
        return;
    }


    // -----------------------------------------
    // Disable button
    // -----------------------------------------

    setSubmitting(true);


    try {

        const response =
            await fetch(
                `${API_BASE}/create_withdrawal.php`,
                {
                    method: "POST",

                    credentials: "include",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body: JSON.stringify({

                        amount: amount,

                        method: method,

                        account: normalizedPhone

                    })
                }
            );


        const result =
            await response.json();


        if (!response.ok || !result.success) {

            throw new Error(
                result.message ||
                "Withdrawal request failed."
            );
        }


        // -----------------------------------------
        // Update local user balance
        // -----------------------------------------

        if (
            result.user &&
            typeof result.user.balance !== "undefined"
        ) {

            currentUser.balance =
                Number(result.user.balance);

            currentBalance =
                Number(result.user.balance);

        } else {

            /*
             * The backend should reserve/deduct
             * the requested amount from the
             * available balance when creating
             * the pending withdrawal.
             */

            currentBalance -= amount;

            currentUser.balance =
                currentBalance;
        }


        localStorage.setItem(
            "crowncash_user",
            JSON.stringify(currentUser)
        );


        updateBalanceDisplay();


        // -----------------------------------------
        // Show success
        // -----------------------------------------

        const reference =
            result.withdrawal?.reference ||
            result.reference ||
            "";


        let successMessage =
            "Withdrawal request submitted successfully. Your request is now pending review.";

        if (reference) {

            successMessage +=
                ` Reference: ${reference}`;

        }


        showMessage(
            successMessage,
            "success"
        );


        // -----------------------------------------
        // Clear form
        // -----------------------------------------

        if (withdrawalAmount) {
            withdrawalAmount.value = "";
        }

        if (withdrawalAccount) {
            withdrawalAccount.value = "";
        }

        if (withdrawalMethod) {
            withdrawalMethod.value = "";
        }


        if (mtnMethod) {
            mtnMethod.classList.remove(
                "selected"
            );
        }


        if (airtelMethod) {
            airtelMethod.classList.remove(
                "selected"
            );
        }


        // -----------------------------------------
        // Reload withdrawal history
        // -----------------------------------------

        loadWithdrawalHistory();

    } catch (error) {

        console.error(
            "Withdrawal error:",
            error
        );


        showMessage(
            error.message ||
            "Unable to submit withdrawal request. Please try again.",
            "error"
        );

    } finally {

        setSubmitting(false);

    }

}


// =========================================================
// NORMALIZE UGANDA PHONE
// =========================================================

function normalizeUgandaPhone(phone) {

    let value =
        String(phone || "")
            .trim()
            .replace(/[\s\-()]/g, "");


    if (
        value.startsWith("+256")
    ) {

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


    if (
        !/^07\d{8}$/.test(value)
    ) {

        return null;
    }


    return value;
}


// =========================================================
// SUBMITTING STATE
// =========================================================

function setSubmitting(isSubmitting) {

    if (!withdrawalSubmit) {
        return;
    }


    withdrawalSubmit.disabled =
        isSubmitting;


    if (isSubmitting) {

        withdrawalSubmit.dataset.originalText =
            withdrawalSubmit.innerText;

        withdrawalSubmit.innerText =
            "Submitting Request...";

    } else {

        withdrawalSubmit.innerText =
            "Request Withdrawal";

    }

}


// =========================================================
// MESSAGE
// =========================================================

function showMessage(
    message,
    type
) {

    if (!withdrawalMessage) {
        return;
    }


    withdrawalMessage.textContent =
        message;


    withdrawalMessage.className =
        `form-message ${type}`;


    withdrawalMessage.scrollIntoView({
        behavior: "smooth",
        block: "nearest"
    });

}


function clearMessage() {

    if (!withdrawalMessage) {
        return;
    }


    withdrawalMessage.textContent = "";

    withdrawalMessage.className =
        "form-message";

}


// =========================================================
// WITHDRAWAL HISTORY
// =========================================================

async function loadWithdrawalHistory() {

    const history =
        document.getElementById(
            "withdrawalHistory"
        );


    if (!history) {
        return;
    }


    /*
     * The history API will be connected
     * after create_withdrawal.php.
     *
     * We intentionally do not invent
     * withdrawal records here.
     */

}


// =========================================================
// LOGOUT
// =========================================================

function setupLogout() {

    if (!logoutBtn) {
        return;
    }


    logoutBtn.addEventListener(
        "click",
        async () => {

            const confirmed =
                window.confirm(
                    "Are you sure you want to logout?"
                );


            if (!confirmed) {
                return;
            }


            try {

                await fetch(
                    `${API_BASE}/logout.php`,
                    {
                        method: "POST",

                        credentials: "include"
                    }
                );

            } catch (error) {

                console.error(
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


// =========================================================
// REDIRECT TO LOGIN
// =========================================================

function redirectToLogin() {

    window.location.href =
        "login.html";

}


// =========================================================
// YEAR
// =========================================================

function setupYear() {

    if (currentYear) {

        currentYear.textContent =
            new Date().getFullYear();

    }

}