/* =========================================================
   CROWN CASH — DASHBOARD.JS
   Production Version
   ========================================================= */

"use strict";

/* =========================================================
   API
   ========================================================= */

const DASHBOARD_API =
    "https://crown-cash1.onrender.com/dashboard.php";

const LOGOUT_API =
    "https://crown-cash1.onrender.com/logout.php";


/* =========================================================
   HELPERS
   ========================================================= */

function byId(id) {
    return document.getElementById(id);
}


function money(value) {

    const number = Number(value);

    if (!Number.isFinite(number)) {
        return "UGX 0";
    }

    return "UGX " + Math.round(number).toLocaleString("en-UG");
}


function numberValue(value) {

    const number = Number(value);

    if (!Number.isFinite(number)) {
        return 0;
    }

    return number;
}


function firstValue(object, keys, fallback = null) {

    if (!object || typeof object !== "object") {
        return fallback;
    }

    for (const key of keys) {

        if (
            object[key] !== undefined &&
            object[key] !== null &&
            object[key] !== ""
        ) {
            return object[key];
        }
    }

    return fallback;
}


/* =========================================================
   UPDATE USER DISPLAY
   ========================================================= */

function updateUserDisplay(data) {

    const user =
        data?.user ||
        data?.data?.user ||
        data?.account ||
        {};

    const name =
        firstValue(
            user,
            [
                "name",
                "full_name",
                "fullName",
                "username",
                "first_name",
                "firstName",
                "email"
            ],
            "Member"
        );

    const accountType =
        firstValue(
            user,
            [
                "account_type",
                "accountType",
                "role"
            ],
            "Personal Account"
        );


    const welcomeName = byId("welcomeName");

    if (welcomeName) {
        welcomeName.textContent = String(name);
    }


    const sidebarUserName = byId("sidebarUserName");

    if (sidebarUserName) {
        sidebarUserName.textContent = String(name);
    }


    const sidebarAccountType = byId("sidebarAccountType");

    if (sidebarAccountType) {
        sidebarAccountType.textContent =
            String(accountType);
    }
}


/* =========================================================
   UPDATE WALLET
   ========================================================= */

function updateWallet(data) {

    const wallet =
        data?.wallet ||
        data?.data?.wallet ||
        {};

    const balance = firstValue(
        wallet,
        [
            "available",
            "available_balance",
            "availableBalance",
            "balance",
            "wallet_balance",
            "walletBalance"
        ],
        firstValue(
            data,
            [
                "available_balance",
                "availableBalance",
                "balance",
                "wallet_balance",
                "walletBalance"
            ],
            0
        )
    );


    const walletElement =
        byId("availableBalance");

    if (walletElement) {

        const amount = numberValue(balance);

        walletElement.textContent = money(amount);

        walletElement.dataset.value = String(amount);
    }
}


/* =========================================================
   UPDATE OVERVIEW
   ========================================================= */

function updateOverview(data) {

    const overview =
        data?.overview ||
        data?.stats ||
        data?.data?.overview ||
        data?.data?.stats ||
        {};


    const totalInvested = numberValue(
        firstValue(
            overview,
            [
                "total_invested",
                "totalInvested",
                "invested",
                "investment_total"
            ],
            firstValue(
                data,
                [
                    "total_invested",
                    "totalInvested"
                ],
                0
            )
        )
    );


    const totalEarnings = numberValue(
        firstValue(
            overview,
            [
                "total_earnings",
                "totalEarnings",
                "earnings",
                "total_profit"
            ],
            firstValue(
                data,
                [
                    "total_earnings",
                    "totalEarnings"
                ],
                0
            )
        )
    );


    const referralTeam = numberValue(
        firstValue(
            overview,
            [
                "referral_team",
                "referralTeam",
                "team_count",
                "teamCount",
                "total_referrals",
                "totalReferrals"
            ],
            firstValue(
                data,
                [
                    "referral_team",
                    "referralTeam"
                ],
                0
            )
        )
    );


    const transactionCount = numberValue(
        firstValue(
            overview,
            [
                "transaction_count",
                "transactionCount",
                "transactions_count",
                "transactionsCount"
            ],
            firstValue(
                data,
                [
                    "transaction_count",
                    "transactionCount"
                ],
                0
            )
        )
    );


    const investedElement =
        byId("totalInvested");

    if (investedElement) {
        investedElement.textContent =
            money(totalInvested);
    }


    const earningsElement =
        byId("totalEarnings");

    if (earningsElement) {
        earningsElement.textContent =
            money(totalEarnings);
    }


    const referralElement =
        byId("referralTeam");

    if (referralElement) {
        referralElement.textContent =
            referralTeam.toLocaleString("en-UG");
    }


    const transactionElement =
        byId("transactionCount");

    if (transactionElement) {
        transactionElement.textContent =
            transactionCount.toLocaleString("en-UG");
    }
}


/* =========================================================
   ADMIN ACCESS
   ========================================================= */

function updateAdminVisibility(data) {

    const admin =
        data?.admin ||
        data?.data?.admin ||
        {};


    const authorized =
        Boolean(
            data?.authorized ||
            data?.is_admin ||
            data?.isAdmin ||
            admin?.authorized ||
            admin?.is_admin ||
            admin?.isAdmin ||
            admin?.role === "admin"
        );


    const adminNav =
        byId("adminNavLink");

    const adminCard =
        byId("adminActionCard");


    if (authorized) {

        if (adminNav) {
            adminNav.style.display = "";
        }

        if (adminCard) {
            adminCard.style.display = "";
        }

    } else {

        if (adminNav) {
            adminNav.style.display = "none";
        }

        if (adminCard) {
            adminCard.style.display = "none";
        }
    }
}


/* =========================================================
   FETCH DASHBOARD
   ========================================================= */

async function loadDashboard() {

    try {

        const response = await fetch(
            DASHBOARD_API + "?_=" + Date.now(),
            {
                method: "GET",

                credentials: "include",

                cache: "no-store",

                headers: {
                    "Accept": "application/json"
                }
            }
        );


        /*
         * User is not logged in.
         */
        if (response.status === 401) {

            window.location.href = "login.html";

            return;
        }


        /*
         * User does not have permission.
         */
        if (response.status === 403) {

            return;
        }


        /*
         * Other HTTP errors.
         */
        if (!response.ok) {

            return;
        }


        const data =
            await response.json();


        /*
         * Backend may explicitly say authentication
         * is required.
         */
        if (
            data &&
            data.authenticated === false
        ) {

            window.location.href = "login.html";

            return;
        }


        /*
         * Backend returned an unsuccessful response.
         */
        if (
            data &&
            data.success === false &&
            data.authenticated !== true
        ) {

            return;
        }


        updateUserDisplay(data);

        updateWallet(data);

        updateOverview(data);

        updateAdminVisibility(data);

    } catch (error) {

        /*
         * Do NOT display the old diagnostic message.
         *
         * The dashboard remains visually usable while
         * the backend connection is unavailable.
         */

        console.error(
            "Crown Cash dashboard API error:",
            error
        );
    }
}


/* =========================================================
   CALCULATOR
   ========================================================= */

function calculateReturns() {

    const input =
        byId("investmentAmount");

    const dailyReturn =
        byId("dailyReturn");

    const monthlyReturn =
        byId("monthlyReturn");

    const totalAfter30 =
        byId("totalAfter30");


    if (
        !input ||
        !dailyReturn ||
        !monthlyReturn ||
        !totalAfter30
    ) {
        return;
    }


    let amount =
        Number(input.value);


    if (!Number.isFinite(amount)) {
        amount = 0;
    }


    if (amount < 0) {
        amount = 0;
    }


    const daily =
        amount * 0.10;

    const thirtyDay =
        daily * 30;

    const total =
        amount + thirtyDay;


    dailyReturn.textContent =
        money(daily);

    monthlyReturn.textContent =
        money(thirtyDay);

    totalAfter30.textContent =
        money(total);
}


/* =========================================================
   LOGOUT
   ========================================================= */

async function logout() {

    try {

        await fetch(
            LOGOUT_API,
            {
                method: "POST",

                credentials: "include",

                cache: "no-store",

                headers: {
                    "Accept": "application/json",
                    "Content-Type": "application/json"
                },

                body: JSON.stringify({})
            }
        );

    } catch (error) {

        console.error(
            "Logout error:",
            error
        );

    } finally {

        window.location.href =
            "login.html";
    }
}


/* =========================================================
   MOBILE MENU
   ========================================================= */

function setupMobileMenu() {

    const menuToggle =
        byId("menuToggle");

    const sidebar =
        document.querySelector(".sidebar");

    if (!menuToggle || !sidebar) {
        return;
    }


    menuToggle.addEventListener(
        "click",
        function () {

            sidebar.classList.toggle(
                "open"
            );
        }
    );


    const navLinks =
        sidebar.querySelectorAll(
            "a"
        );


    navLinks.forEach(
        function (link) {

            link.addEventListener(
                "click",
                function () {

                    sidebar.classList.remove(
                        "open"
                    );
                }
            );
        }
    );
}


/* =========================================================
   YEAR
   ========================================================= */

function setCurrentYear() {

    const yearElement =
        byId("currentYear");

    if (yearElement) {

        yearElement.textContent =
            new Date().getFullYear();
    }
}


/* =========================================================
   EVENTS
   ========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    function () {

        const investmentInput =
            byId("investmentAmount");


        if (investmentInput) {

            investmentInput.addEventListener(
                "input",
                calculateReturns
            );
        }


        calculateReturns();

        setupMobileMenu();

        setCurrentYear();


        const logoutButton =
            byId("logoutBtn");


        if (logoutButton) {

            logoutButton.addEventListener(
                "click",
                function (event) {

                    event.preventDefault();

                    logout();
                }
            );
        }


        /*
         * Load real account data.
         */
        loadDashboard();
    }
);