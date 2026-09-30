/* =========================================================
   CROWN CASH — DASHBOARD JS
   ========================================================= */

const API = "https://crown-cash1.onrender.com";

document.addEventListener("DOMContentLoaded", () => {

    loadDashboard();

    setupCalculator();

    setupMobileMenu();

    setupLogout();

    const year =
        document.getElementById("currentYear");

    if (year) {
        year.textContent =
            new Date().getFullYear();
    }

});


/* =========================================================
   LOAD DASHBOARD
   ========================================================= */

async function loadDashboard() {

    try {

        const response =
            await fetch(
                `${API}/dashboard.php`,
                {
                    method: "GET",
                    credentials: "include",
                    headers: {
                        "Accept": "application/json"
                    },
                    cache: "no-store"
                }
            );


        if (
            response.status === 401
        ) {

            window.location.href =
                "login.html";

            return;

        }


        if (!response.ok) {

            throw new Error(
                `Dashboard request failed: ${response.status}`
            );

        }


        const data =
            await response.json();


        if (
            !data ||
            data.success !== true
        ) {

            throw new Error(
                data?.message ||
                "Dashboard data unavailable."
            );

        }


        /*
         * Display user information.
         */

        if (data.user) {

            displayUser(
                data.user
            );

        }


        /*
         * Display financial statistics.
         */

        displayStatistics(
            data
        );

    }

    catch (error) {

        console.error(
            "Dashboard loading error:",
            error
        );


        /*
         * Try profile information as fallback.
         */

        await loadProfile();

    }

}


/* =========================================================
   LOAD PROFILE FALLBACK
   ========================================================= */

async function loadProfile() {

    try {

        const response =
            await fetch(
                `${API}/profile.php`,
                {
                    method: "GET",
                    credentials: "include",
                    headers: {
                        "Accept": "application/json"
                    },
                    cache: "no-store"
                }
            );


        if (!response.ok) {
            throw new Error(
                "Profile request failed."
            );
        }


        const data =
            await response.json();


        if (
            data.success === true ||
            data.user
        ) {

            displayUser(
                data.user ||
                data.profile ||
                data
            );

        }

    }

    catch (error) {

        console.warn(
            "Profile unavailable:",
            error
        );

        loadLocalUser();

    }

}


/* =========================================================
   DISPLAY USER
   ========================================================= */

function displayUser(user) {

    if (!user) {
        return;
    }


    const firstName =
        user.first_name ||
        user.firstName ||
        "";


    const lastName =
        user.last_name ||
        user.lastName ||
        "";


    const fullName =
        user.full_name ||
        user.fullName ||
        user.name ||
        `${firstName} ${lastName}`.trim();


    const finalName =
        fullName ||
        firstName ||
        "Member";


    /*
     * Welcome name.
     */

    const welcomeName =
        document.getElementById(
            "welcomeName"
        );


    if (welcomeName) {

        welcomeName.textContent =
            firstName ||
            finalName.split(" ")[0];

    }


    /*
     * Sidebar name.
     */

    const sidebarName =
        document.getElementById(
            "sidebarUserName"
        );


    if (sidebarName) {

        sidebarName.textContent =
            finalName;

    }


    /*
     * Account type.
     */

    const role =
        String(
            user.role ||
            user.account_type ||
            user.accountType ||
            ""
        ).toLowerCase();


    const accountElement =
        document.getElementById(
            "sidebarAccountType"
        );


    if (accountElement) {

        accountElement.textContent =
            role === "admin"
                ? "Administrator"
                : "Personal Account";

    }


    /*
     * Admin panel.
     */

    if (role === "admin") {

        showAdminPanel();

    }
    else {

        hideAdminPanel();

    }


    /*
     * Temporary local display information.
     */

    try {

        localStorage.setItem(
            "crown_cash_user",
            JSON.stringify({
                first_name: firstName,
                last_name: lastName,
                full_name: finalName,
                role: role
            })
        );

    }

    catch (error) {}

}


/* =========================================================
   DISPLAY STATISTICS
   ========================================================= */

function displayStatistics(data) {

    /*
     * Balance
     */

    setText(
        "availableBalance",
        formatUGX(
            data.balance ??
            data.available_balance ??
            0
        )
    );


    /*
     * Total deposits.
     *
     * If the HTML does not yet contain totalDeposits,
     * nothing breaks.
     */

    setText(
        "totalDeposits",
        formatUGX(
            data.total_deposits ??
            data.totalDeposits ??
            0
        )
    );


    /*
     * Total investments.
     */

    setText(
        "totalInvested",
        formatUGX(
            data.total_invested ??
            data.totalInvested ??
            0
        )
    );


    /*
     * Total accumulated earnings.
     */

    setText(
        "totalEarnings",
        formatUGX(
            data.total_earnings ??
            data.totalEarnings ??
            0
        )
    );


    /*
     * Current daily return.
     */

    setText(
        "dailyReturnAmount",
        formatUGX(
            data.daily_return ??
            data.dailyReturn ??
            0
        )
    );


    /*
     * Referral team.
     */

    setText(
        "referralTeam",
        data.referral_team ??
        data.referralTeam ??
        data.total_team ??
        0
    );


    /*
     * Transactions.
     */

    setText(
        "transactionCount",
        data.transaction_count ??
        data.transactionCount ??
        data.transactions ??
        0
    );


    /*
     * Optional active investment count.
     */

    setText(
        "activeInvestments",
        data.active_investments ??
        data.activeInvestments ??
        0
    );

}


/* =========================================================
   SHOW ADMIN
   ========================================================= */

function showAdminPanel() {

    const adminNav =
        document.getElementById(
            "adminNavLink"
        );

    const adminCard =
        document.getElementById(
            "adminActionCard"
        );


    if (adminNav) {

        adminNav.classList.remove(
            "hidden"
        );

    }


    if (adminCard) {

        adminCard.classList.remove(
            "hidden"
        );

    }

}


/* =========================================================
   HIDE ADMIN
   ========================================================= */

function hideAdminPanel() {

    const adminNav =
        document.getElementById(
            "adminNavLink"
        );

    const adminCard =
        document.getElementById(
            "adminActionCard"
        );


    if (adminNav) {

        adminNav.classList.add(
            "hidden"
        );

    }


    if (adminCard) {

        adminCard.classList.add(
            "hidden"
        );

    }

}


/* =========================================================
   LOCAL USER FALLBACK
   ========================================================= */

function loadLocalUser() {

    try {

        const stored =
            localStorage.getItem(
                "crown_cash_user"
            );


        if (!stored) {
            return;
        }


        displayUser(
            JSON.parse(stored)
        );

    }

    catch (error) {

        console.warn(
            "Local user data unavailable."
        );

    }

}


/* =========================================================
   CALCULATOR
   ========================================================= */

function setupCalculator() {

    const input =
        document.getElementById(
            "investmentAmount"
        );


    if (!input) {
        return;
    }


    input.addEventListener(
        "input",
        calculateReturns
    );


    calculateReturns();

}


function calculateReturns() {

    const input =
        document.getElementById(
            "investmentAmount"
        );


    if (!input) {
        return;
    }


    let amount =
        Number(input.value) || 0;


    if (amount < 0) {
        amount = 0;
    }


    const DAILY_RATE = 0.10;


    const dailyReturn =
        amount *
        DAILY_RATE;


    const thirtyDayReturn =
        dailyReturn *
        30;


    const totalAfter30 =
        amount +
        thirtyDayReturn;


    setText(
        "dailyReturn",
        formatUGX(
            dailyReturn
        )
    );


    /*
     * Also support the new dashboard ID.
     */

    setText(
        "dailyReturnAmount",
        formatUGX(
            dailyReturn
        )
    );


    setText(
        "monthlyReturn",
        formatUGX(
            thirtyDayReturn
        )
    );


    setText(
        "totalAfter30",
        formatUGX(
            totalAfter30
        )
    );

}


/* =========================================================
   FORMAT UGX
   ========================================================= */

function formatUGX(value) {

    const number =
        Number(value) || 0;


    return (
        "UGX " +
        Math.round(number)
            .toLocaleString("en-UG")
    );

}


/* =========================================================
   SET TEXT
   ========================================================= */

function setText(
    id,
    value
) {

    const element =
        document.getElementById(id);


    if (element) {

        element.textContent =
            value;

    }

}


/* =========================================================
   MOBILE MENU
   ========================================================= */

function setupMobileMenu() {

    const button =
        document.getElementById(
            "menuToggle"
        );


    if (!button) {
        return;
    }


    button.addEventListener(
        "click",
        () => {

            button.classList.toggle(
                "active"
            );

        }
    );

}


/* =========================================================
   LOGOUT
   ========================================================= */

function setupLogout() {

    const button =
        document.getElementById(
            "logoutBtn"
        );


    if (!button) {
        return;
    }


    button.addEventListener(
        "click",
        async () => {

            button.disabled = true;


            try {

                await fetch(
                    `${API}/logout.php`,
                    {
                        method: "GET",
                        credentials: "include"
                    }
                );

            }

            catch (error) {

                console.warn(
                    "Logout request failed:",
                    error
                );

            }


            try {

                localStorage.removeItem(
                    "crown_cash_user"
                );

                localStorage.removeItem(
                    "user"
                );

                localStorage.removeItem(
                    "loggedIn"
                );

            }

            catch (error) {}


            window.location.href =
                "login.html";

        }
    );

}


/* =========================================================
   GLOBAL COMPATIBILITY
   ========================================================= */

window.CrownCashDashboard = {

    loadDashboard,

    calculateReturns,

    formatUGX,

    displayStatistics

};