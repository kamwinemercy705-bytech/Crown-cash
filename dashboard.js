/*
|--------------------------------------------------------------------------
| CROWN CASH DASHBOARD
| VERSION: 2026-10-03-TEST-01
|--------------------------------------------------------------------------
*/

(() => {
    "use strict";

    const VERSION = "2026-10-03-TEST-01";

    const API_BASE =
        "https://crown-cash1.onrender.com";

    const DASHBOARD_API =
        `${API_BASE}/dashboard.php`;

    console.log("======================================");
    console.log("CROWN CASH DASHBOARD JS LOADED");
    console.log("VERSION:", VERSION);
    console.log("API:", DASHBOARD_API);
    console.log("======================================");


    /*
    |--------------------------------------------------------------------------
    | DOM READY
    |--------------------------------------------------------------------------
    */

    document.addEventListener("DOMContentLoaded", () => {

        console.log(
            "CROWN CASH: DOMContentLoaded"
        );

        setupCalculator();
        setupMenu();
        setupLogout();
        setYear();

        /*
        |--------------------------------------------------------------------------
        | Visible diagnostic
        |--------------------------------------------------------------------------
        */

        showApiStatus(
            "Connecting to Crown Cash server..."
        );

        loadDashboard();
    });


    /*
    |--------------------------------------------------------------------------
    | ELEMENT HELPER
    |--------------------------------------------------------------------------
    */

    function get(id) {
        return document.getElementById(id);
    }


    /*
    |--------------------------------------------------------------------------
    | API STATUS MESSAGE
    |--------------------------------------------------------------------------
    */

    function showApiStatus(message) {

        let box =
            document.getElementById(
                "crownCashApiStatus"
            );

        if (!box) {

            box =
                document.createElement("div");

            box.id =
                "crownCashApiStatus";

            box.style.cssText = `
                position: fixed;
                left: 10px;
                right: 10px;
                bottom: 10px;
                z-index: 999999;
                padding: 12px 15px;
                border-radius: 8px;
                background: #111827;
                color: white;
                font-family: Arial, sans-serif;
                font-size: 13px;
                line-height: 1.4;
                box-shadow: 0 4px 20px rgba(0,0,0,.25);
            `;

            document.body.appendChild(box);
        }

        box.textContent =
            "Crown Cash API: " + message;
    }


    /*
    |--------------------------------------------------------------------------
    | LOAD DASHBOARD
    |--------------------------------------------------------------------------
    */

    async function loadDashboard() {

        console.log(
            "CROWN CASH: Calling dashboard API..."
        );

        showApiStatus(
            "Calling dashboard.php..."
        );


        try {

            const response =
                await fetch(
                    DASHBOARD_API,
                    {
                        method: "GET",

                        credentials: "include",

                        cache: "no-store",

                        headers: {
                            "Accept":
                                "application/json",
                            "Cache-Control":
                                "no-cache"
                        }
                    }
                );


            console.log(
                "CROWN CASH: HTTP STATUS:",
                response.status
            );

            console.log(
                "CROWN CASH: RESPONSE URL:",
                response.url
            );


            const raw =
                await response.text();


            console.log(
                "CROWN CASH: RAW RESPONSE:",
                raw
            );


            let data = null;


            try {

                data =
                    JSON.parse(raw);

            } catch (jsonError) {

                console.error(
                    "CROWN CASH: INVALID JSON",
                    jsonError
                );

                showApiStatus(
                    "Server returned invalid JSON. HTTP " +
                    response.status
                );

                setWalletError(
                    "Invalid server response"
                );

                return;
            }


            console.log(
                "CROWN CASH: PARSED DATA:",
                data
            );


            /*
            |--------------------------------------------------------------------------
            | Authentication failure
            |--------------------------------------------------------------------------
            */

            if (
                response.status === 401
            ) {

                console.error(
                    "CROWN CASH: SESSION NOT AUTHENTICATED",
                    data
                );

                showApiStatus(
                    "Not authenticated. Please log in again."
                );

                setWalletError(
                    "Please log in again"
                );

                return;
            }


            /*
            |--------------------------------------------------------------------------
            | Authorization failure
            |--------------------------------------------------------------------------
            */

            if (
                response.status === 403
            ) {

                console.error(
                    "CROWN CASH: ACCESS DENIED",
                    data
                );

                showApiStatus(
                    "Access denied by server."
                );

                setWalletError(
                    "Access denied"
                );

                return;
            }


            /*
            |--------------------------------------------------------------------------
            | Other HTTP errors
            |--------------------------------------------------------------------------
            */

            if (!response.ok) {

                console.error(
                    "CROWN CASH: HTTP ERROR",
                    response.status,
                    data
                );

                showApiStatus(
                    "Server error. HTTP " +
                    response.status
                );

                setWalletError(
                    "Server error"
                );

                return;
            }


            /*
            |--------------------------------------------------------------------------
            | API SUCCESS FALSE
            |--------------------------------------------------------------------------
            */

            if (
                data &&
                data.success === false
            ) {

                console.error(
                    "CROWN CASH: API ERROR:",
                    data.message,
                    data
                );

                showApiStatus(
                    data.message ||
                    "Dashboard API returned an error."
                );

                setWalletError(
                    "Unable to load"
                );

                return;
            }


            /*
            |--------------------------------------------------------------------------
            | SUCCESS
            |--------------------------------------------------------------------------
            */

            console.log(
                "CROWN CASH: DASHBOARD SUCCESS",
                data
            );


            showApiStatus(
                "Connected successfully."
            );


            updateDashboard(
                data
            );


            /*
            |--------------------------------------------------------------------------
            | Hide diagnostic after successful load
            |--------------------------------------------------------------------------
            */

            setTimeout(() => {

                const box =
                    get("crownCashApiStatus");

                if (box) {
                    box.remove();
                }

            }, 4000);


        } catch (error) {

            console.error(
                "CROWN CASH: FETCH ERROR:",
                error
            );


            showApiStatus(
                "Connection failed: " +
                (error.message || "Unknown error")
            );


            setWalletError(
                "Unable to connect"
            );
        }
    }


    /*
    |--------------------------------------------------------------------------
    | UPDATE DASHBOARD
    |--------------------------------------------------------------------------
    */

    function updateDashboard(data) {

        console.log(
            "CROWN CASH: Updating dashboard with:",
            data
        );


        const user =
            data.user || {};


        /*
        |--------------------------------------------------------------------------
        | USER NAME
        |--------------------------------------------------------------------------
        */

        const name =
            user.name ||
            user.full_name ||
            user.fullName ||
            user.username ||
            data.name ||
            "Member";


        setText(
            "welcomeName",
            name
        );


        setText(
            "sidebarUserName",
            name
        );


        /*
        |--------------------------------------------------------------------------
        | ACCOUNT TYPE
        |--------------------------------------------------------------------------
        */

        const role =
            user.role ||
            user.account_type ||
            user.accountType ||
            data.role ||
            "Member";


        setText(
            "sidebarAccountType",
            formatRole(role)
        );


        /*
        |--------------------------------------------------------------------------
        | WALLET
        |--------------------------------------------------------------------------
        */

        const balance =
            firstNumber([

                data.balance,

                data.wallet_balance,

                data.walletBalance,

                data.available_balance,

                data.availableBalance,

                user.balance,

                user.wallet_balance,

                user.walletBalance,

                user.available_balance,

                user.availableBalance,

                user.wallet &&
                    user.wallet.balance,

                user.wallet &&
                    user.wallet_balance

            ]);


        console.log(
            "CROWN CASH: WALLET BALANCE:",
            balance
        );


        setMoney(
            "availableBalance",
            balance
        );


        /*
        |--------------------------------------------------------------------------
        | TOTAL INVESTED
        |--------------------------------------------------------------------------
        */

        const invested =
            firstNumber([

                data.total_invested,

                data.totalInvested,

                data.invested,

                data.investments_total,

                data.investmentsTotal

            ]);


        setMoney(
            "totalInvested",
            invested
        );


        /*
        |--------------------------------------------------------------------------
        | TOTAL EARNINGS
        |--------------------------------------------------------------------------
        */

        const earnings =
            firstNumber([

                data.total_earnings,

                data.totalEarnings,

                data.earnings,

                data.total_earning,

                data.profit

            ]);


        setMoney(
            "totalEarnings",
            earnings
        );


        /*
        |--------------------------------------------------------------------------
        | REFERRAL TEAM
        |--------------------------------------------------------------------------
        */

        const referralTeam =
            firstNumber([

                data.referral_team,

                data.referralTeam,

                data.team_count,

                data.teamCount,

                data.referrals_count,

                data.referralsCount

            ]);


        setNumber(
            "referralTeam",
            referralTeam
        );


        /*
        |--------------------------------------------------------------------------
        | TRANSACTIONS
        |--------------------------------------------------------------------------
        */

        const transactionCount =
            firstNumber([

                data.transaction_count,

                data.transactionCount,

                data.transactions_count,

                data.transactionsCount,

                data.transactions_total

            ]);


        setNumber(
            "transactionCount",
            transactionCount
        );


        /*
        |--------------------------------------------------------------------------
        | ADMIN
        |--------------------------------------------------------------------------
        */

        const isAdmin =
            detectAdmin(
                data,
                user
            );


        console.log(
            "CROWN CASH: ADMIN:",
            isAdmin
        );


        updateAdminVisibility(
            isAdmin
        );
    }


    /*
    |--------------------------------------------------------------------------
    | ADMIN DETECTION
    |--------------------------------------------------------------------------
    */

    function detectAdmin(
        data,
        user
    ) {

        if (
            data.is_admin === true ||
            data.isAdmin === true ||
            data.admin_user === true
        ) {
            return true;
        }


        if (
            user.is_admin === true ||
            user.isAdmin === true
        ) {
            return true;
        }


        if (
            data.admin &&
            typeof data.admin === "object"
        ) {

            if (
                data.admin.is_admin === true ||
                data.admin.isAdmin === true ||
                data.admin.authorized === true
            ) {
                return true;
            }
        }


        const roles = [

            user.role,
            user.account_type,
            user.accountType,
            data.role,
            data.account_type,
            data.accountType

        ];


        return roles.some(
            role => {

                const value =
                    String(
                        role || ""
                    ).toLowerCase().trim();

                return [
                    "admin",
                    "administrator",
                    "superadmin",
                    "super_admin"
                ].includes(value);
            }
        );
    }


    /*
    |--------------------------------------------------------------------------
    | ADMIN VISIBILITY
    |--------------------------------------------------------------------------
    */

    function updateAdminVisibility(
        isAdmin
    ) {

        const nav =
            get("adminNavLink");

        const card =
            get("adminActionCard");


        if (nav) {

            nav.style.display =
                isAdmin ? "" : "none";
        }


        if (card) {

            card.style.display =
                isAdmin ? "" : "none";
        }
    }


    /*
    |--------------------------------------------------------------------------
    | WALLET ERROR
    |--------------------------------------------------------------------------
    */

    function setWalletError(
        message
    ) {

        const element =
            get("availableBalance");

        if (!element) {
            return;
        }

        element.textContent =
            message;

        element.setAttribute(
            "data-value",
            "0"
        );
    }


    /*
    |--------------------------------------------------------------------------
    | MONEY
    |--------------------------------------------------------------------------
    */

    function setMoney(
        id,
        value
    ) {

        const element =
            get(id);

        if (!element) {
            return;
        }


        const amount =
            Number(value) || 0;


        element.textContent =
            "UGX " +
            amount.toLocaleString(
                "en-UG"
            );


        element.setAttribute(
            "data-value",
            String(amount)
        );
    }


    /*
    |--------------------------------------------------------------------------
    | NUMBER
    |--------------------------------------------------------------------------
    */

    function setNumber(
        id,
        value
    ) {

        const element =
            get(id);

        if (!element) {
            return;
        }


        const amount =
            Number(value) || 0;


        element.textContent =
            amount.toLocaleString(
                "en-UG"
            );
    }


    /*
    |--------------------------------------------------------------------------
    | TEXT
    |--------------------------------------------------------------------------
    */

    function setText(
        id,
        value
    ) {

        const element =
            get(id);

        if (element) {
            element.textContent =
                value;
        }
    }


    /*
    |--------------------------------------------------------------------------
    | FIRST NUMBER
    |--------------------------------------------------------------------------
    */

    function firstNumber(
        values
    ) {

        for (
            const value of values
        ) {

            if (
                value !== undefined &&
                value !== null &&
                value !== "" &&
                !Number.isNaN(
                    Number(value)
                )
            ) {

                return Number(value);
            }
        }


        return 0;
    }


    /*
    |--------------------------------------------------------------------------
    | ROLE FORMAT
    |--------------------------------------------------------------------------
    */

    function formatRole(
        role
    ) {

        const value =
            String(
                role || "Member"
            );


        if (
            value.toLowerCase() ===
            "admin"
        ) {
            return "Administrator";
        }


        return value
            .charAt(0)
            .toUpperCase() +
            value.slice(1);
    }


    /*
    |--------------------------------------------------------------------------
    | CALCULATOR
    |--------------------------------------------------------------------------
    */

    function setupCalculator() {

        const input =
            get("investmentAmount");

        if (!input) {
            return;
        }


        const daily =
            get("dailyReturn");

        const monthly =
            get("monthlyReturn");

        const total =
            get("totalAfter30");


        function calculate() {

            const amount =
                Number(
                    String(
                        input.value
                    ).replace(
                        /,/g,
                        ""
                    )
                ) || 0;


            const dailyAmount =
                amount * 0.10;

            const monthlyAmount =
                dailyAmount * 30;

            const totalAmount =
                amount +
                monthlyAmount;


            if (daily) {

                daily.textContent =
                    "UGX " +
                    dailyAmount.toLocaleString(
                        "en-UG"
                    );
            }


            if (monthly) {

                monthly.textContent =
                    "UGX " +
                    monthlyAmount.toLocaleString(
                        "en-UG"
                    );
            }


            if (total) {

                total.textContent =
                    "UGX " +
                    totalAmount.toLocaleString(
                        "en-UG"
                    );
            }
        }


        input.addEventListener(
            "input",
            calculate
        );


        calculate();
    }


    /*
    |--------------------------------------------------------------------------
    | MOBILE MENU
    |--------------------------------------------------------------------------
    */

    function setupMenu() {

        const button =
            get("menuToggle");

        const menu =
            document.querySelector(
                ".sidebar"
            );


        if (
            !button ||
            !menu
        ) {
            return;
        }


        button.addEventListener(
            "click",
            () => {

                menu.classList.toggle(
                    "open"
                );
            }
        );
    }


    /*
    |--------------------------------------------------------------------------
    | LOGOUT
    |--------------------------------------------------------------------------
    */

    function setupLogout() {

        const button =
            get("logoutBtn");

        if (!button) {
            return;
        }


        button.addEventListener(
            "click",
            async () => {

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
                        "Logout error:",
                        error
                    );

                } finally {

                    window.location.href =
                        "index.html";
                }
            }
        );
    }


    /*
    |--------------------------------------------------------------------------
    | YEAR
    |--------------------------------------------------------------------------
    */

    function setYear() {

        const year =
            document.querySelector(
                "#year"
            );


        if (year) {

            year.textContent =
                new Date()
                    .getFullYear();
        }
    }

})();