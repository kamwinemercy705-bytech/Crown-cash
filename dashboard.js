/* =========================================================
   CROWN CASH - DASHBOARD JAVASCRIPT
   ========================================================= */


/* =========================================================
   SETTINGS
   ========================================================= */

const DAILY_RATE = 0.10;
const INVESTMENT_DAYS = 30;


/* =========================================================
   API
   ========================================================= */

const DASHBOARD_API =
    "https://crown-cash1.onrender.com/dashboard.php";


/* =========================================================
   FORMAT UGX
   ========================================================= */

function formatUGX(amount) {

    const number = Number(amount) || 0;

    return "UGX " + Math.round(number).toLocaleString("en-UG");

}


/* =========================================================
   LOAD DASHBOARD
   ========================================================= */

async function loadDashboard() {

    try {

        const response = await fetch(
            DASHBOARD_API,
            {
                method: "GET",
                credentials: "include",
                headers: {
                    "Accept": "application/json"
                }
            }
        );


        if (!response.ok) {

            throw new Error(
                "Dashboard request failed: " +
                response.status
            );

        }


        const data = await response.json();


        if (!data.success) {

            window.location.href = "login.html";

            return;

        }


        const user = data.user || {};


        /* -----------------------------------------
           WELCOME NAME
           ----------------------------------------- */

        const welcomeName =
            document.getElementById("welcomeName");

        if (welcomeName) {

            welcomeName.textContent =
                user.firstName ||
                user.first_name ||
                "Member";

        }


        /* -----------------------------------------
           USER NAME
           ----------------------------------------- */

        const userName =
            document.getElementById("userName");

        if (userName) {

            userName.textContent =
                user.full_name ||
                user.fullName ||
                (
                    (user.firstName || "") +
                    " " +
                    (user.lastName || "")
                ).trim() ||
                "Member";

        }


        /* -----------------------------------------
           BALANCE
           ----------------------------------------- */

        const userBalance =
            document.getElementById("userBalance");

        if (userBalance) {

            userBalance.textContent =
                formatUGX(user.balance);

        }


        /* -----------------------------------------
           ACCOUNT STATUS
           ----------------------------------------- */

        const accountStatus =
            document.getElementById("accountStatus");

        if (accountStatus) {

            accountStatus.textContent =
                user.status || "Active";

        }


        const accountStatus2 =
            document.getElementById("accountStatus2");

        if (accountStatus2) {

            accountStatus2.textContent =
                user.status || "Active";

        }


        /* -----------------------------------------
           EMAIL
           ----------------------------------------- */

        const userEmail =
            document.getElementById("userEmail");

        if (userEmail) {

            userEmail.textContent =
                user.email || "Not available";

        }


        /* -----------------------------------------
           PHONE
           ----------------------------------------- */

        const userPhone =
            document.getElementById("userPhone");

        if (userPhone) {

            userPhone.textContent =
                user.phone || "Not available";

        }


        /* -----------------------------------------
           FULL NAME
           ----------------------------------------- */

        const userFullName =
            document.getElementById("userFullName");

        if (userFullName) {

            userFullName.textContent =
                user.full_name ||
                user.fullName ||
                (
                    (user.firstName || "") +
                    " " +
                    (user.lastName || "")
                ).trim() ||
                "Not available";

        }


        /* -----------------------------------------
           REFERRAL CODE
           ----------------------------------------- */

        const referral =
            user.referralCode ||
            user.referral_code ||
            "Not available";


        const referralCode =
            document.getElementById("referralCode");

        if (referralCode) {

            referralCode.textContent =
                referral;

        }


        const referralCode2 =
            document.getElementById("referralCode2");

        if (referralCode2) {

            referralCode2.textContent =
                referral;

        }


        /* -----------------------------------------
           AVATAR
           ----------------------------------------- */

        const avatar =
            document.getElementById("userAvatar");

        if (avatar) {

            const firstName =
                user.firstName ||
                user.first_name ||
                "U";

            avatar.textContent =
                firstName.charAt(0).toUpperCase();

        }


        /* -----------------------------------------
           DASHBOARD STATISTICS
           ----------------------------------------- */

        const totalEarnings =
            document.getElementById("totalEarnings");

        if (totalEarnings) {

            totalEarnings.textContent =
                formatUGX(
                    user.totalEarnings ||
                    user.total_earnings ||
                    user.earnings ||
                    0
                );

        }


        const todayEarnings =
            document.getElementById("todayEarnings");

        if (todayEarnings) {

            todayEarnings.textContent =
                formatUGX(
                    user.todayEarnings ||
                    user.today_earnings ||
                    0
                );

        }


        const totalInvested =
            document.getElementById("totalInvested");

        if (totalInvested) {

            totalInvested.textContent =
                formatUGX(
                    user.totalInvested ||
                    user.total_invested ||
                    0
                );

        }


        /* -----------------------------------------
           INVESTMENTS
           ----------------------------------------- */

        if (Array.isArray(data.investments)) {

            displayInvestments(data.investments);

        }


    } catch (error) {

        console.error(
            "Crown Cash dashboard error:",
            error
        );

        /*
         * Do not immediately redirect on every network
         * error. This allows the user to see the dashboard
         * while Render/backend is temporarily unavailable.
         */

    }

}


/* =========================================================
   INVESTMENT CALCULATOR
   ========================================================= */

function updateInvestmentPreview() {

    const investmentAmountInput =
        document.getElementById("investmentAmount");

    const previewDaily =
        document.getElementById("dailyReturn");

    const previewMonthly =
        document.getElementById("monthlyReturn");

    const previewTotal =
        document.getElementById("totalAfter30");


    if (!investmentAmountInput) {

        return;

    }


    const amount =
        Number(investmentAmountInput.value) || 0;


    /* 10% estimated daily return */

    const estimatedDailyReturn =
        amount * DAILY_RATE;


    /* Simple projection for 30 days */

    const estimated30DayReturn =
        estimatedDailyReturn * INVESTMENT_DAYS;


    /* Principal + projected return */

    const estimatedTotal =
        amount + estimated30DayReturn;


    if (previewDaily) {

        previewDaily.textContent =
            formatUGX(estimatedDailyReturn);

    }


    if (previewMonthly) {

        previewMonthly.textContent =
            formatUGX(estimated30DayReturn);

    }


    if (previewTotal) {

        previewTotal.textContent =
            formatUGX(estimatedTotal);

    }

}


/* =========================================================
   INVESTMENT INPUT
   ========================================================= */

const investmentAmountInput =
    document.getElementById("investmentAmount");


if (investmentAmountInput) {

    investmentAmountInput.addEventListener(
        "input",
        updateInvestmentPreview
    );

}


/* =========================================================
   GO TO INVESTMENT
   ========================================================= */

function goToInvestment() {

    const input =
        document.getElementById("investmentAmount");


    if (!input) {

        window.location.href =
            "investments.html";

        return;

    }


    const amount =
        Number(input.value) || 0;


    if (amount <= 0) {

        alert(
            "Please enter the amount you want to invest."
        );

        input.focus();

        return;

    }


    /*
     * Send the amount to the investment page.
     */

    window.location.href =
        "investments.html?amount=" +
        encodeURIComponent(amount);

}


/* =========================================================
   DISPLAY ACTIVE INVESTMENTS
   ========================================================= */

function displayInvestments(investments) {

    const investmentList =
        document.getElementById("investmentList");


    if (!investmentList) {

        return;

    }


    if (!investments.length) {

        return;

    }


    investmentList.innerHTML = "";


    investments.forEach(function (investment) {

        const amount =
            Number(
                investment.amount ||
                investment.investedAmount ||
                investment.invested_amount ||
                0
            );


        const dailyReturn =
            amount * DAILY_RATE;


        const card =
            document.createElement("div");


        card.style.padding = "20px";
        card.style.borderRadius = "15px";
        card.style.background = "#0f1d30";
        card.style.border =
            "1px solid rgba(255,255,255,0.08)";


        card.innerHTML = `

            <div style="
                display:flex;
                justify-content:space-between;
                gap:15px;
                flex-wrap:wrap;
            ">

                <div>

                    <span style="
                        color:#9aa8b8;
                        font-size:10px;
                    ">
                        INVESTMENT
                    </span>

                    <h3 style="
                        margin:6px 0;
                        font-size:20px;
                    ">
                        ${formatUGX(amount)}
                    </h3>

                </div>


                <div style="
                    text-align:right;
                ">

                    <span style="
                        color:#9aa8b8;
                        font-size:10px;
                    ">
                        ESTIMATED DAILY RETURN
                    </span>

                    <strong style="
                        display:block;
                        margin-top:6px;
                        color:#28d17c;
                        font-size:18px;
                    ">
                        ${formatUGX(dailyReturn)}
                    </strong>

                </div>

            </div>


            <div style="
                margin-top:15px;
                height:1px;
                background:rgba(255,255,255,0.07);
            "></div>


            <div style="
                display:flex;
                justify-content:space-between;
                margin-top:13px;
                color:#9aa8b8;
                font-size:10px;
            ">

                <span>
                    Daily Rate
                </span>

                <strong style="
                    color:#d4af37;
                ">
                    10% estimated
                </strong>

            </div>

        `;


        investmentList.appendChild(card);

    });

}


/* =========================================================
   COPY REFERRAL CODE
   ========================================================= */

function copyReferralCode() {

    const referralElement =
        document.getElementById("referralCode2");


    if (!referralElement) {

        return;

    }


    const code =
        referralElement.textContent.trim();


    if (
        !code ||
        code === "Not available"
    ) {

        alert(
            "Your referral code is not available yet."
        );

        return;

    }


    if (
        navigator.clipboard &&
        navigator.clipboard.writeText
    ) {

        navigator.clipboard.writeText(code)
            .then(function () {

                alert(
                    "Referral code copied!"
                );

            })
            .catch(function () {

                alert(
                    "Unable to copy the referral code."
                );

            });

    } else {

        alert(
            "Copy this referral code: " +
            code
        );

    }

}


/* =========================================================
   MOBILE SIDEBAR
   ========================================================= */

function toggleSidebar() {

    const sidebar =
        document.querySelector(".sidebar");


    if (!sidebar) {

        return;

    }


    sidebar.classList.toggle("open");

}


/* =========================================================
   LOGOUT
   ========================================================= */

async function logoutUser() {

    const confirmed =
        confirm(
            "Are you sure you want to logout?"
        );


    if (!confirmed) {

        return;

    }


    try {

        /*
         * Change this URL if your backend uses
         * another logout endpoint.
         */

        await fetch(
            "https://crown-cash1.onrender.com/logout.php",
            {
                method: "GET",
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


/* =========================================================
   INITIALIZE DASHBOARD
   ========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    function () {

        updateInvestmentPreview();

        loadDashboard();

    }
);