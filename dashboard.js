/*
=========================================================
CROWN CASH - DASHBOARD.JS
=========================================================
*/

(() => {
    "use strict";

    const API_BASE = "https://crown-cash1.onrender.com";
    const DASHBOARD_API =
        `${API_BASE}/dashboard.php`;

    const LOGIN_PAGE = "login.html";


    /* =====================================================
       ELEMENT HELPER
    ===================================================== */

    function el(id) {
        return document.getElementById(id);
    }


    /* =====================================================
       FORMAT MONEY
    ===================================================== */

    function formatMoney(value) {

        let number = Number(value);

        if (!Number.isFinite(number)) {
            number = 0;
        }

        return "UGX " + Math.round(number).toLocaleString("en-UG");
    }


    /* =====================================================
       FORMAT NUMBER
    ===================================================== */

    function formatNumber(value) {

        let number = Number(value);

        if (!Number.isFinite(number)) {
            number = 0;
        }

        return Math.round(number).toLocaleString("en-UG");
    }


    /* =====================================================
       GET FIRST AVAILABLE VALUE
    ===================================================== */

    function firstValue(...values) {

        for (const value of values) {

            if (
                value !== undefined &&
                value !== null &&
                value !== ""
            ) {
                return value;
            }
        }

        return 0;
    }


    /* =====================================================
       SHOW DASHBOARD ERROR
    ===================================================== */

    function showDashboardError(message) {

        const balance = el("availableBalance");

        if (balance) {
            balance.textContent = "Unable to load";
            balance.title = message;
        }

        console.error(
            "CROWN CASH DASHBOARD ERROR:",
            message
        );
    }


    /* =====================================================
       UPDATE USER
    ===================================================== */

    function updateUser(data) {

        const user = data?.user || {};

        const name =
            firstValue(
                user.name,
                user.full_name,
                user.fullName,
                data.name,
                data.full_name,
                data.fullName,
                "Member"
            );


        const accountType =
            firstValue(
                user.account_type,
                user.accountType,
                data.account_type,
                data.accountType,
                "Personal Account"
            );


        const welcomeName = el("welcomeName");

        if (welcomeName) {
            welcomeName.textContent = String(name);
        }


        const sidebarName =
            el("sidebarUserName");

        if (sidebarName) {
            sidebarName.textContent = String(name);
        }


        const sidebarType =
            el("sidebarAccountType");

        if (sidebarType) {
            sidebarType.textContent =
                String(accountType);
        }
    }


    /* =====================================================
       UPDATE WALLET
    ===================================================== */

    function updateWallet(data) {

        const user = data?.user || {};
        const wallet = user?.wallet || {};


        const balance = firstValue(

            data.balance,

            data.available_balance,

            data.availableBalance,

            user.balance,

            user.wallet_balance,

            user.walletBalance,

            user.available_balance,

            user.availableBalance,

            wallet.balance,

            wallet.available_balance,

            wallet.availableBalance

        );


        const balanceElement =
            el("availableBalance");


        if (!balanceElement) {
            return;
        }


        balanceElement.textContent =
            formatMoney(balance);


        balanceElement.dataset.value =
            String(Number(balance) || 0);
    }


    /* =====================================================
       UPDATE STATISTICS
    ===================================================== */

    function updateStatistics(data) {

        const user = data?.user || {};


        const invested = firstValue(

            data.total_invested,

            data.totalInvested,

            user.total_invested,

            user.totalInvested,

            0

        );


        const earnings = firstValue(

            data.total_earnings,

            data.totalEarnings,

            user.total_earnings,

            user.totalEarnings,

            0

        );


        const referralTeam = firstValue(

            data.referral_team,

            data.referralTeam,

            user.referral_team,

            user.referralTeam,

            0

        );


        const transactionCount = firstValue(

            data.transaction_count,

            data.transactionCount,

            user.transaction_count,

            user.transactionCount,

            0

        );


        const totalInvested =
            el("totalInvested");

        if (totalInvested) {

            totalInvested.textContent =
                formatMoney(invested);

        }


        const totalEarnings =
            el("totalEarnings");

        if (totalEarnings) {

            totalEarnings.textContent =
                formatMoney(earnings);

        }


        const referralElement =
            el("referralTeam");

        if (referralElement) {

            referralElement.textContent =
                formatNumber(referralTeam);

        }


        const transactionElement =
            el("transactionCount");

        if (transactionElement) {

            transactionElement.textContent =
                formatNumber(transactionCount);

        }
    }


    /* =====================================================
       ADMIN DETECTION
    ===================================================== */

    function isAdmin(data) {

        const user = data?.user || {};
        const admin = data?.admin || {};


        const possibleFlags = [

            data.is_admin,
            data.isAdmin,
            data.admin_user,

            admin.is_admin,
            admin.isAdmin,
            admin.authorized,

            user.is_admin,
            user.isAdmin,

            user.admin,
            user.administrator

        ];


        for (const flag of possibleFlags) {

            if (
                flag === true ||
                flag === 1 ||
                flag === "1" ||
                String(flag).toLowerCase() === "true"
            ) {
                return true;
            }
        }


        const roles = [

            data.role,
            data.account_type,
            data.accountType,

            admin.role,
            admin.account_type,

            user.role,
            user.account_type,
            user.accountType

        ];


        for (const role of roles) {

            const normalized =
                String(role || "")
                    .trim()
                    .toLowerCase()
                    .replace(/[\s-]+/g, "_");


            if (
                normalized === "admin" ||
                normalized === "administrator" ||
                normalized === "superadmin" ||
                normalized === "super_admin"
            ) {
                return true;
            }
        }


        return false;
    }


    /* =====================================================
       SHOW / HIDE ADMIN
    ===================================================== */

    function updateAdminVisibility(data) {

        const adminLink =
            el("adminNavLink");

        const adminCard =
            el("adminActionCard");


        const admin = isAdmin(data);


        console.log(
            "CROWN CASH ADMIN STATUS:",
            admin
        );


        if (adminLink) {

            adminLink.style.display =
                admin ? "flex" : "none";

            adminLink.classList.toggle(
                "hidden",
                !admin
            );
        }


        if (adminCard) {

            adminCard.style.display =
                admin ? "flex" : "none";

            adminCard.classList.toggle(
                "hidden",
                !admin
            );
        }
    }


    /* =====================================================
       LOAD DASHBOARD
    ===================================================== */

    async function loadDashboard() {

        console.log(
            "CROWN CASH: Loading dashboard..."
        );

        console.log(
            "CROWN CASH API:",
            DASHBOARD_API
        );


        try {

            const response = await fetch(
                DASHBOARD_API,
                {
                    method: "GET",

                    credentials: "include",

                    cache: "no-store",

                    headers: {
                        "Accept":
                            "application/json",

                        "Content-Type":
                            "application/json",

                        "Cache-Control":
                            "no-cache"
                    }
                }
            );


            console.log(
                "CROWN CASH HTTP STATUS:",
                response.status
            );


            const raw =
                await response.text();


            console.log(
                "CROWN CASH RAW API RESPONSE:",
                raw
            );


            let data;


            try {

                data = JSON.parse(raw);

            } catch (jsonError) {

                throw new Error(
                    "Dashboard API returned invalid JSON. " +
                    "HTTP " +
                    response.status +
                    ". Response: " +
                    raw.substring(0, 500)
                );
            }


            console.log(
                "CROWN CASH PARSED DATA:",
                data
            );


            if (
                response.status === 401 ||
                response.status === 403
            ) {

                console.error(
                    "CROWN CASH: Session is not authorized."
                );

                /*
                 * Do not immediately redirect.
                 * Keeping the error visible makes debugging
                 * much easier.
                 */

                showDashboardError(
                    data.message ||
                    "Your session has expired."
                );

                return;
            }


            if (!response.ok) {

                throw new Error(
                    data.message ||
                    `Dashboard API returned HTTP ${response.status}`
                );
            }


            if (
                data.success === false
            ) {

                throw new Error(
                    data.message ||
                    "Dashboard API reported an error."
                );
            }


            /*
             * Everything succeeded.
             */

            updateUser(data);

            updateWallet(data);

            updateStatistics(data);

            updateAdminVisibility(data);


            console.log(
                "CROWN CASH: Dashboard loaded successfully."
            );


        } catch (error) {

            console.error(
                "CROWN CASH DASHBOARD FETCH FAILED:",
                error
            );


            showDashboardError(
                error.message ||
                "Unable to connect to dashboard API."
            );
        }
    }


    /* =====================================================
       CALCULATOR
    ===================================================== */

    function setupCalculator() {

        const amountInput =
            el("investmentAmount");

        const dailyReturn =
            el("dailyReturn");

        const monthlyReturn =
            el("monthlyReturn");

        const totalAfter30 =
            el("totalAfter30");


        if (!amountInput) {
            return;
        }


        function calculate() {

            let amount =
                Number(amountInput.value);


            if (
                !Number.isFinite(amount) ||
                amount < 0
            ) {
                amount = 0;
            }


            const daily =
                amount * 0.10;


            const monthly =
                daily * 30;


            const total =
                amount + monthly;


            if (dailyReturn) {

                dailyReturn.textContent =
                    formatMoney(daily);

            }


            if (monthlyReturn) {

                monthlyReturn.textContent =
                    formatMoney(monthly);

            }


            if (totalAfter30) {

                totalAfter30.textContent =
                    formatMoney(total);

            }

        }


        amountInput.addEventListener(
            "input",
            calculate
        );


        calculate();
    }


    /* =====================================================
       MOBILE MENU
    ===================================================== */

    function setupMenu() {

        const menuToggle =
            el("menuToggle");

        const sidebar =
            document.querySelector(".sidebar");


        if (!menuToggle || !sidebar) {
            return;
        }


        menuToggle.addEventListener(
            "click",
            () => {

                sidebar.classList.toggle(
                    "open"
                );

            }
        );
    }


    /* =====================================================
       LOGOUT
    ===================================================== */

    function setupLogout() {

        const logoutBtn =
            el("logoutBtn");


        if (!logoutBtn) {
            return;
        }


        logoutBtn.addEventListener(
            "click",
            async () => {

                logoutBtn.disabled = true;

                logoutBtn.textContent =
                    "Logging out...";


                try {

                    await fetch(
                        `${API_BASE}/logout.php`,
                        {
                            method: "POST",

                            credentials: "include",

                            cache: "no-store"
                        }
                    );

                } catch (error) {

                    console.error(
                        "Logout request failed:",
                        error
                    );

                }


                window.location.href =
                    LOGIN_PAGE;
            }
        );
    }


    /* =====================================================
       YEAR
    ===================================================== */

    function setupYear() {

        const year =
            el("currentYear");


        if (year) {

            year.textContent =
                new Date().getFullYear();

        }
    }


    /* =====================================================
       INITIALIZE
    ===================================================== */

    document.addEventListener(
        "DOMContentLoaded",
        () => {

            setupCalculator();

            setupMenu();

            setupLogout();

            setupYear();

            loadDashboard();

        }
    );

})();