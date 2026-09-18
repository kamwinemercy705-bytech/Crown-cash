/* =========================================================
   CROWN CASH DASHBOARD JS
   ========================================================= */

const API = "https://crown-cash1.onrender.com";

document.addEventListener("DOMContentLoaded", () => {

    loadDashboard();

    setupCalculator();

    setupMobileMenu();

    setupLogout();

    document.getElementById("currentYear").textContent =
        new Date().getFullYear();

});


/* =========================================================
   LOAD DASHBOARD
   ========================================================= */

async function loadDashboard() {

    try {

        /*
         * First check the current PHP session.
         */

        const authResponse = await fetch(
            `${API}/auth-check.php`,
            {
                method: "GET",
                credentials: "include",
                headers: {
                    "Accept": "application/json"
                }
            }
        );

        let authData = null;

        try {
            authData = await authResponse.json();
        } catch (e) {
            authData = null;
        }


        /*
         * If session is valid, use the returned user data.
         */

        if (
            authData &&
            authData.success === true
        ) {

            displayUser(authData.user || authData);

        }


        /*
         * Load profile information.
         */

        await loadProfile();


        /*
         * Load dashboard statistics if dashboard.php exists.
         */

        await loadStatistics();

    }

    catch (error) {

        console.error(
            "Dashboard loading error:",
            error
        );

        /*
         * Even if the backend is temporarily unavailable,
         * don't destroy the dashboard interface.
         */

        loadLocalUser();

    }

}


/* =========================================================
   LOAD PROFILE
   ========================================================= */

async function loadProfile() {

    try {

        const response = await fetch(
            `${API}/profile.php`,
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
                `Profile request failed: ${response.status}`
            );
        }

        const data = await response.json();

        if (
            data.success === true ||
            data.user
        ) {

            const user =
                data.user ||
                data.profile ||
                data;

            displayUser(user);

        }

    }

    catch (error) {

        console.warn(
            "Profile could not be loaded:",
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
     * Welcome heading
     */

    const welcomeName =
        document.getElementById(
            "welcomeName"
        );

    if (welcomeName) {
        welcomeName.textContent =
            firstName || finalName.split(" ")[0];
    }


    /*
     * Sidebar name
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
     * Account type
     */

    const accountType =
        user.account_type ||
        user.accountType ||
        user.role ||
        "Personal Account";

    const accountElement =
        document.getElementById(
            "sidebarAccountType"
        );

    if (accountElement) {

        accountElement.textContent =
            accountType === "admin"
                ? "Administrator"
                : "Personal Account";

    }


    /*
     * ADMIN VISIBILITY
     */

    const role =
        String(
            user.role ||
            user.account_type ||
            user.accountType ||
            ""
        ).toLowerCase();


    if (role === "admin") {

        showAdminPanel();

    }
    else {

        hideAdminPanel();

    }


    /*
     * Save useful non-sensitive display information
     * for temporary UI fallback.
     */

    try {

        const storedUser = {
            first_name: firstName,
            last_name: lastName,
            full_name: finalName,
            role: role
        };

        localStorage.setItem(
            "crown_cash_user",
            JSON.stringify(storedUser)
        );

    }

    catch (e) {}

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

        const user =
            JSON.parse(stored);

        displayUser(user);

    }

    catch (error) {

        console.warn(
            "Local user data unavailable"
        );

    }

}


/* =========================================================
   DASHBOARD STATISTICS
   ========================================================= */

async function loadStatistics() {

    try {

        const response = await fetch(
            `${API}/dashboard.php`,
            {
                method: "GET",
                credentials: "include",
                headers: {
                    "Accept": "application/json"
                }
            }
        );


        if (!response.ok) {

            /*
             * If dashboard.php isn't currently available,
             * keep the default zero values.
             */

            return;

        }


        const data =
            await response.json();


        if (!data) {
            return;
        }


        const source =
            data.data ||
            data.dashboard ||
            data;


        /*
         * Balance
         */

        const balance =
            source.balance ??
            source.available_balance ??
            source.wallet_balance ??
            0;


        setText(
            "availableBalance",
            formatUGX(balance)
        );


        /*
         * Total invested
         */

        setText(
            "totalInvested",
            formatUGX(
                source.total_invested ??
                source.totalInvested ??
                0
            )
        );


        /*
         * Earnings
         */

        setText(
            "totalEarnings",
            formatUGX(
                source.total_earnings ??
                source.totalEarnings ??
                0
            )
        );


        /*
         * Referral team
         */

        setText(
            "referralTeam",
            source.referral_team ??
            source.referralTeam ??
            source.total_team ??
            0
        );


        /*
         * Transactions
         */

        setText(
            "transactionCount",
            source.transaction_count ??
            source.transactionCount ??
            source.transactions ??
            0
        );

    }

    catch (error) {

        console.warn(
            "Statistics unavailable:",
            error
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


    /*
     * Configured interface rate.
     *
     * This is an illustrative calculation and should
     * not be treated as a guaranteed investment return.
     */

    const DAILY_RATE = 0.10;

    const dailyReturn =
        amount * DAILY_RATE;

    const thirtyDayReturn =
        dailyReturn * 30;

    const totalAfter30 =
        amount + thirtyDayReturn;


    setText(
        "dailyReturn",
        formatUGX(dailyReturn)
    );


    setText(
        "monthlyReturn",
        formatUGX(thirtyDayReturn)
    );


    setText(
        "totalAfter30",
        formatUGX(totalAfter30)
    );

}


/* =========================================================
   FORMAT UGX
   ========================================================= */

function formatUGX(value) {

    let number = 0;

    if (
        typeof value === "number"
    ) {

        number = value;

    }
    else {

        number =
            Number(value) || 0;

    }


    return (
        "UGX " +
        Math.round(number)
            .toLocaleString("en-UG")
    );

}


/* =========================================================
   SET TEXT
   ========================================================= */

function setText(id, value) {

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

            /*
             * Your current mobile design uses the
             * bottom navigation, so this button simply
             * gives a visual interaction.
             */

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
                    "Logout request failed",
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

            }

            catch (e) {}


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
    formatUGX
};