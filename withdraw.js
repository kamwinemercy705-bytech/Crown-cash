/* =========================================
   CROWN CASH WITHDRAW JAVASCRIPT
========================================= */

const API_URL = "https://crown-cash1.onrender.com";

const withdrawForm = document.getElementById("withdrawForm");
const amountInput = document.getElementById("amount");
const paymentMethod = document.getElementById("paymentMethod");
const phoneNumber = document.getElementById("phoneNumber");
const withdrawBtn = document.getElementById("withdrawBtn");
const formMessage = document.getElementById("formMessage");

const availableBalance =
    document.getElementById("availableBalance");

const withdrawalHistory =
    document.getElementById("withdrawalHistory");

const menuBtn = document.getElementById("menuBtn");
const sidebar = document.getElementById("sidebar");
const overlay = document.getElementById("overlay");
const logoutBtn = document.getElementById("logoutBtn");


/* =========================================
   CURRENT YEAR
========================================= */

document.getElementById("year").textContent =
    new Date().getFullYear();


/* =========================================
   MOBILE SIDEBAR
========================================= */

if (menuBtn) {

    menuBtn.addEventListener("click", () => {

        sidebar.classList.toggle("open");
        overlay.classList.toggle("show");

    });

}


if (overlay) {

    overlay.addEventListener("click", () => {

        sidebar.classList.remove("open");
        overlay.classList.remove("show");

    });

}


/* =========================================
   MESSAGE
========================================= */

function showMessage(message, type) {

    formMessage.textContent = message;

    formMessage.className = "form-message " + type;

}


/* =========================================
   LOAD PROFILE / BALANCE
========================================= */

async function loadBalance() {

    try {

        const response = await fetch(
            `${API_URL}/profile.php`,
            {
                method: "GET",
                credentials: "include"
            }
        );

        const data = await response.json();

        if (!response.ok || !data.success) {

            availableBalance.textContent = "UGX 0";
            return;

        }

        const user = data.user || data;

        const balance =
            Number(
                user.balance ??
                user.wallet_balance ??
                0
            );

        availableBalance.textContent =
            "UGX " + balance.toLocaleString();

    } catch (error) {

        console.error(
            "Unable to load balance:",
            error
        );

        availableBalance.textContent = "UGX 0";
    }
}


/* =========================================
   LOAD WITHDRAWAL HISTORY
========================================= */

async function loadWithdrawals() {

    try {

        /*
         * This expects withdrawals.php to return
         * the user's withdrawal history.
         */

        const response = await fetch(
            `${API_URL}/withdrawals.php`,
            {
                method: "GET",
                credentials: "include"
            }
        );

        const data = await response.json();

        if (!response.ok || !data.success) {

            withdrawalHistory.innerHTML = `
                <div class="empty-history">
                    <i class="fa-solid fa-receipt"></i>
                    No withdrawal history available.
                </div>
            `;

            return;
        }

        const withdrawals =
            data.withdrawals || [];

        if (withdrawals.length === 0) {

            withdrawalHistory.innerHTML = `
                <div class="empty-history">
                    <i class="fa-solid fa-receipt"></i>
                    No withdrawal requests yet.
                </div>
            `;

            return;
        }

        withdrawalHistory.innerHTML =
            withdrawals.map(withdrawal => {

                const amount =
                    Number(withdrawal.amount || 0);

                const status =
                    String(
                        withdrawal.status || "pending"
                    ).toLowerCase();

                const method =
                    String(
                        withdrawal.payment_method ||
                        withdrawal.method ||
                        "Mobile Money"
                    ).toUpperCase();

                let date = "";

                if (withdrawal.created_at) {

                    const parsedDate =
                        new Date(withdrawal.created_at);

                    if (!isNaN(parsedDate)) {

                        date =
                            parsedDate.toLocaleString();

                    }

                }

                return `
                    <div class="withdrawal-item">

                        <div class="withdrawal-top">

                            <div>
                                <div class="withdrawal-amount">
                                    UGX ${amount.toLocaleString()}
                                </div>

                                <div class="withdrawal-method">
                                    <i class="fa-solid fa-mobile-screen-button"></i>
                                    ${method}
                                </div>

                                <div class="withdrawal-date">
                                    ${date}
                                </div>
                            </div>

                            <span class="status ${status}">
                                ${status}
                            </span>

                        </div>

                    </div>
                `;

            }).join("");

    } catch (error) {

        console.error(
            "Withdrawal history error:",
            error
        );

        withdrawalHistory.innerHTML = `
            <div class="empty-history">
                Withdrawal history could not be loaded.
            </div>
        `;
    }
}


/* =========================================
   SUBMIT WITHDRAWAL
========================================= */

withdrawForm.addEventListener(
    "submit",
    async function(event) {

        event.preventDefault();

        formMessage.className =
            "form-message";

        formMessage.textContent = "";

        const amount =
            Number(amountInput.value);

        const method =
            paymentMethod.value;

        const phone =
            phoneNumber.value.trim();


        /* -------------------------------------
           VALIDATION
        ------------------------------------- */

        if (!amount || amount < 10000) {

            showMessage(
                "Minimum withdrawal amount is UGX 10,000.",
                "error"
            );

            return;
        }


        if (!method) {

            showMessage(
                "Please select MTN or Airtel Mobile Money.",
                "error"
            );

            return;
        }


        if (!phone) {

            showMessage(
                "Please enter your Mobile Money number.",
                "error"
            );

            return;
        }


        if (!/^[0-9+ ]{10,15}$/.test(phone)) {

            showMessage(
                "Please enter a valid Mobile Money number.",
                "error"
            );

            return;
        }


        /* -------------------------------------
           DISABLE BUTTON
        ------------------------------------- */

        withdrawBtn.disabled = true;

        withdrawBtn.innerHTML = `
            <i class="fa-solid fa-spinner fa-spin"></i>
            <span>Submitting...</span>
        `;


        try {

            const response = await fetch(
                `${API_URL}/withdraw.php`,
                {
                    method: "POST",

                    credentials: "include",

                    headers: {
                        "Content-Type": "application/json"
                    },

                    body: JSON.stringify({

                        amount: amount,

                        payment_method: method,

                        phone: phone

                    })
                }
            );


            const data =
                await response.json();


            /* -------------------------------------
               SERVER ERROR
            ------------------------------------- */

            if (!response.ok || !data.success) {

                throw new Error(
                    data.message ||
                    "Withdrawal request failed."
                );

            }


            /* -------------------------------------
               SUCCESS
            ------------------------------------- */

            showMessage(
                "Withdrawal request submitted successfully. It is now pending admin approval.",
                "success"
            );


            withdrawForm.reset();


            /* Reload balance/history */

            await loadBalance();
            await loadWithdrawals();


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

            withdrawBtn.disabled = false;

            withdrawBtn.innerHTML = `
                <i class="fa-solid fa-paper-plane"></i>
                <span>Submit Withdrawal Request</span>
            `;

        }

    }
);


/* =========================================
   LOGOUT
========================================= */

if (logoutBtn) {

    logoutBtn.addEventListener(
        "click",
        async function(event) {

            event.preventDefault();

            try {

                /*
                 * Change this URL if your logout
                 * backend uses another filename.
                 */

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

            }

            window.location.href =
                "login.html";

        }
    );

}


/* =========================================
   START PAGE
========================================= */

loadBalance();
loadWithdrawals();