/*
|--------------------------------------------------------------------------
| Crown Cash — Withdrawal Frontend
|--------------------------------------------------------------------------
*/

const API_BASE = "https://crown-cash1.onrender.com";

const MIN_WITHDRAWAL = 1000;

let selectedMethod = "MTN";


// =====================================================
// PAGE START
// =====================================================

document.addEventListener("DOMContentLoaded", () => {

    setupMobileMenu();
    setupPaymentMethods();
    setupWithdrawalForm();
    loadUser();
    setCurrentYear();

});


// =====================================================
// LOAD USER
// =====================================================

function loadUser() {

    const storedUser = localStorage.getItem("crowncash_user");

    if (!storedUser) {

        window.location.href = "login.html";

        return;
    }

    try {

        const user = JSON.parse(storedUser);

        const firstName = user.firstName || "";
        const lastName = user.lastName || "";

        const fullName =
            `${firstName} ${lastName}`.trim() || "User";

        const topUserName =
            document.getElementById("topUserName");

        const availableBalance =
            document.getElementById("availableBalance");

        if (topUserName) {
            topUserName.textContent = fullName;
        }

        if (availableBalance) {

            const balance =
                Number(user.balance || 0);

            availableBalance.textContent =
                `UGX ${formatMoney(balance)}`;
        }

    } catch (error) {

        console.error("Unable to read user data:", error);

        localStorage.removeItem("crowncash_user");

        window.location.href = "login.html";
    }
}


// =====================================================
// PAYMENT METHODS
// =====================================================

function setupPaymentMethods() {

    const methodCards =
        document.querySelectorAll(".method-card");

    const methodInput =
        document.getElementById("withdrawMethod");

    methodCards.forEach(card => {

        card.addEventListener("click", () => {

            methodCards.forEach(item => {
                item.classList.remove("selected");
            });

            card.classList.add("selected");

            selectedMethod =
                card.dataset.method || "MTN";

            if (methodInput) {
                methodInput.value = selectedMethod;
            }

        });

    });
}


// =====================================================
// WITHDRAWAL FORM
// =====================================================

function setupWithdrawalForm() {

    const form =
        document.getElementById("withdrawForm");

    if (!form) {
        return;
    }

    form.addEventListener("submit", async (event) => {

        event.preventDefault();

        await submitWithdrawal();

    });

}


// =====================================================
// SUBMIT WITHDRAWAL
// =====================================================

async function submitWithdrawal() {

    const amountInput =
        document.getElementById("withdrawAmount");

    const phoneInput =
        document.getElementById("withdrawPhone");

    const button =
        document.getElementById("withdrawBtn");

    const buttonText =
        document.getElementById("withdrawBtnText");


    const amount =
        Number(amountInput?.value || 0);

    const phone =
        String(phoneInput?.value || "").trim();


    // -----------------------------
    // AMOUNT VALIDATION
    // -----------------------------

    if (!Number.isFinite(amount) ||
        amount < MIN_WITHDRAWAL) {

        alert(
            `Minimum withdrawal is UGX ${formatMoney(MIN_WITHDRAWAL)}.`
        );

        return;
    }


    if (!Number.isInteger(amount)) {

        alert(
            "Withdrawal amount must be a whole UGX amount."
        );

        return;
    }


    // -----------------------------
    // PHONE VALIDATION
    // -----------------------------

    const cleanPhone =
        normalizeUgandaPhone(phone);

    if (!cleanPhone) {

        alert(
            "Please enter a valid Ugandan Mobile Money number, for example 07XXXXXXXX."
        );

        return;
    }


    // -----------------------------
    // CONFIRMATION
    // -----------------------------

    const confirmed =
        confirm(
            `Request withdrawal of UGX ${formatMoney(amount)} through ${selectedMethod} to ${cleanPhone}?`
        );

    if (!confirmed) {
        return;
    }


    // -----------------------------
    // BUTTON STATE
    // -----------------------------

    if (button) {
        button.disabled = true;
    }

    if (buttonText) {
        buttonText.textContent = "Submitting Request...";
    }


    try {

        const response =
            await fetch(
                `${API_BASE}/create_withdrawal.php`,
                {
                    method: "POST",

                    credentials: "include",

                    headers: {
                        "Content-Type": "application/json"
                    },

                    body: JSON.stringify({

                        amount: amount,

                        phone: cleanPhone,

                        paymentMethod: selectedMethod

                    })
                }
            );


        const result =
            await response.json();


        if (!response.ok || !result.success) {

            throw new Error(
                result.message ||
                "Unable to submit withdrawal request."
            );
        }


        // Update local balance if backend returned it

        if (
            result.user &&
            typeof result.user.balance !== "undefined"
        ) {

            updateStoredBalance(
                result.user.balance
            );

            const balanceElement =
                document.getElementById("availableBalance");

            if (balanceElement) {

                balanceElement.textContent =
                    `UGX ${formatMoney(result.user.balance)}`;
            }
        }


        alert(
            result.message ||
            "Withdrawal request submitted successfully."
        );


        formReset();


        // Show request immediately

        if (result.withdrawal) {

            addWithdrawalToHistory(
                result.withdrawal
            );
        }


    } catch (error) {

        console.error(
            "Withdrawal error:",
            error
        );

        alert(
            error.message ||
            "Unable to submit withdrawal request."
        );


    } finally {

        if (button) {
            button.disabled = false;
        }

        if (buttonText) {
            buttonText.textContent =
                "Submit Withdrawal Request";
        }

    }
}


// =====================================================
// NORMALIZE UGANDAN PHONE
// =====================================================

function normalizeUgandaPhone(phone) {

    let value =
        String(phone || "")
            .replace(/\s+/g, "")
            .trim();


    if (value.startsWith("+256")) {

        value =
            "0" +
            value.substring(4);

    } else if (value.startsWith("256")) {

        value =
            "0" +
            value.substring(3);
    }


    if (!/^07\d{8}$/.test(value)) {

        return null;
    }

    return value;
}


// =====================================================
// RESET FORM
// =====================================================

function formReset() {

    const form =
        document.getElementById("withdrawForm");

    const methodInput =
        document.getElementById("withdrawMethod");

    const amountInput =
        document.getElementById("withdrawAmount");

    const phoneInput =
        document.getElementById("withdrawPhone");


    if (form) {
        form.reset();
    }

    selectedMethod = "MTN";

    if (methodInput) {
        methodInput.value = "MTN";
    }

    if (amountInput) {
        amountInput.value = "";
    }

    if (phoneInput) {
        phoneInput.value = "";
    }


    document
        .querySelectorAll(".method-card")
        .forEach(card => {

            if (card.dataset.method === "MTN") {

                card.classList.add("selected");

            } else {

                card.classList.remove("selected");
            }

        });
}


// =====================================================
// ADD HISTORY ITEM
// =====================================================

function addWithdrawalToHistory(withdrawal) {

    const history =
        document.getElementById("withdrawalHistory");

    if (!history || !withdrawal) {
        return;
    }


    const empty =
        history.querySelector(".empty-history");

    if (empty) {
        empty.remove();
    }


    const item =
        document.createElement("div");

    item.className =
        "history-item";


    const amount =
        Number(withdrawal.amount || 0);

    const method =
        withdrawal.payment_method ||
        withdrawal.paymentMethod ||
        selectedMethod;


    const reference =
        withdrawal.reference ||
        "Pending";


    item.innerHTML = `

        <div class="history-main">

            <strong>${escapeHtml(method)} Withdrawal</strong>

            <span>
                Reference: ${escapeHtml(reference)}
            </span>

        </div>


        <div class="history-amount">
            UGX ${formatMoney(amount)}
        </div>


        <div class="history-status status-pending">
            PENDING
        </div>

    `;


    history.prepend(item);
}


// =====================================================
// UPDATE LOCAL USER BALANCE
// =====================================================

function updateStoredBalance(balance) {

    try {

        const storedUser =
            localStorage.getItem("crowncash_user");

        if (!storedUser) {
            return;
        }

        const user =
            JSON.parse(storedUser);

        user.balance =
            Number(balance || 0);

        localStorage.setItem(
            "crowncash_user",
            JSON.stringify(user)
        );

    } catch (error) {

        console.error(
            "Unable to update stored balance:",
            error
        );
    }
}


// =====================================================
// MONEY FORMAT
// =====================================================

function formatMoney(value) {

    return Number(value || 0)
        .toLocaleString("en-UG", {
            maximumFractionDigits: 0
        });
}


// =====================================================
// ESCAPE HTML
// =====================================================

function escapeHtml(value) {

    return String(value || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


// =====================================================
// MOBILE MENU
// =====================================================

function setupMobileMenu() {

    const menu =
        document.getElementById("mobileMenuBtn");

    const sidebar =
        document.getElementById("sidebar");

    const overlay =
        document.getElementById("sidebarOverlay");


    if (!menu || !sidebar || !overlay) {
        return;
    }


    menu.addEventListener("click", () => {

        sidebar.classList.toggle("open");

        overlay.classList.toggle("active");

    });


    overlay.addEventListener("click", () => {

        sidebar.classList.remove("open");

        overlay.classList.remove("active");

    });


    document
        .querySelectorAll(".nav-item")
        .forEach(item => {

            item.addEventListener("click", () => {

                sidebar.classList.remove("open");

                overlay.classList.remove("active");

            });

        });
}


// =====================================================
// YEAR
// =====================================================

function setCurrentYear() {

    const year =
        document.getElementById("currentYear");

    if (year) {

        year.textContent =
            new Date().getFullYear();
    }
}