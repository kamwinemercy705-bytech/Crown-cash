const API_BASE = "https://crown-cash1.onrender.com";

document.addEventListener("DOMContentLoaded", () => {
    loadDashboard();
    setupCalculator();
    setupMobileMenu();
    setupLogout();

    const year = document.getElementById("currentYear");

    if (year) {
        year.textContent = new Date().getFullYear();
    }
});


/* =========================================================
   API
========================================================= */

async function apiFetch(path, options = {}) {

    const requestOptions = {
        credentials: "include",
        ...options
    };

    if (
        requestOptions.body &&
        typeof requestOptions.body === "string"
    ) {
        requestOptions.headers = {
            "Content-Type": "application/json",
            ...(requestOptions.headers || {})
        };
    }

    const response = await fetch(
        `${API_BASE}/${path}`,
        requestOptions
    );

    let data = {};

    try {
        data = await response.json();
    } catch (error) {
        data = {};
    }

    if (!response.ok || data.success === false) {
        throw new Error(
            data.message ||
            `Request failed (${response.status})`
        );
    }

    return data;
}


/* =========================================================
   LOAD DASHBOARD
========================================================= */

async function loadDashboard() {

    try {

        const data =
            await apiFetch("dashboard.php");

        console.log(
            "Dashboard user:",
            data.user
        );

        if (data.user) {

            displayUser(data.user);

            setupAdminPanel(
                data.user
            );
        }

        loadStatistics(data);

    } catch (error) {

        console.error(
            "Dashboard loading error:",
            error
        );

        try {

            const profile =
                await apiFetch("profile.php");

            const user =
                profile.user ||
                profile ||
                {};

            displayUser(user);

            setupAdminPanel(user);

        } catch (profileError) {

            console.error(
                "Profile fallback failed:",
                profileError
            );
        }
    }
}


/* =========================================================
   USER
========================================================= */

function displayUser(user) {

    const firstName =
        user.firstName ||
        user.first_name ||
        "";

    const lastName =
        user.lastName ||
        user.last_name ||
        "";

    const fullName =
        user.full_name ||
        `${firstName} ${lastName}`.trim() ||
        "Member";


    document
        .querySelectorAll(
            "#welcomeName, " +
            "#sidebarUserName, " +
            "[data-user-name], " +
            ".user-name"
        )
        .forEach(element => {

            element.textContent =
                fullName;

        });


    document
        .querySelectorAll(
            "#userEmail, " +
            "[data-user-email]"
        )
        .forEach(element => {

            element.textContent =
                user.email || "";

        });


    const role =
        String(
            user.role || "user"
        )
        .trim()
        .toLowerCase();


    const accountType =
        document.getElementById(
            "sidebarAccountType"
        );


    if (accountType) {

        accountType.textContent =
            role === "admin"
                ? "Administrator Account"
                : "Personal Account";
    }


    /*
     * Save only basic interface data.
     * Backend authorization remains authoritative.
     */

    try {

        localStorage.setItem(
            "user",
            JSON.stringify({
                id: user.id || "",
                name: fullName,
                email: user.email || "",
                role: role
            })
        );

    } catch (error) {

        console.warn(
            "Could not save user information."
        );
    }
}


/* =========================================================
   ADMIN PANEL VISIBILITY
========================================================= */

function setupAdminPanel(user) {

    const role =
        String(
            user.role || ""
        )
        .trim()
        .toLowerCase();


    const adminNav =
        document.getElementById(
            "adminNavLink"
        );


    const adminCard =
        document.getElementById(
            "adminActionCard"
        );


    /*
     * Only administrators can see
     * the Admin Panel.
     */

    if (role === "admin") {

        if (adminNav) {

            adminNav.classList.remove(
                "hidden"
            );

            adminNav.style.display =
                "flex";
        }


        if (adminCard) {

            adminCard.classList.remove(
                "hidden"
            );

            adminCard.style.display =
                "flex";
        }


        console.log(
            "Admin Panel enabled."
        );

    } else {

        if (adminNav) {

            adminNav.classList.add(
                "hidden"
            );

            adminNav.style.display =
                "none";
        }


        if (adminCard) {

            adminCard.classList.add(
                "hidden"
            );

            adminCard.style.display =
                "none";
        }


        console.log(
            "Regular member account."
        );
    }
}


/* =========================================================
   STATISTICS
========================================================= */

function loadStatistics(data) {

    const balance =
        Number(
            data.balance ??
            data.available_balance ??
            data.wallet_balance ??
            0
        );


    const deposits =
        Number(
            data.totalDeposits ??
            data.total_deposits ??
            0
        );


    const invested =
        Number(
            data.totalInvested ??
            data.total_invested ??
            0
        );


    const earnings =
        Number(
            data.totalEarnings ??
            data.total_earnings ??
            0
        );


    const daily =
        Number(
            data.dailyReturnAmount ??
            data.daily_return ??
            0
        );


    const active =
        Number(
            data.activeInvestments ??
            data.active_investments ??
            0
        );


    const referrals =
        Number(
            data.referralTeam ??
            data.referral_team ??
            0
        );


    const transactions =
        Number(
            data.transactionCount ??
            data.transaction_count ??
            0
        );


    setMoney(
        [
            "#availableBalance",
            "#balance",
            "[data-balance]"
        ],
        balance
    );


    setMoney(
        [
            "#totalDeposits",
            "[data-total-deposits]"
        ],
        deposits
    );


    setMoney(
        [
            "#totalInvested",
            "[data-total-invested]"
        ],
        invested
    );


    setMoney(
        [
            "#totalEarnings",
            "[data-total-earnings]"
        ],
        earnings
    );


    setMoney(
        [
            "#dailyReturn",
            "#dailyReturnAmount",
            "[data-daily-return]"
        ],
        daily
    );


    setText(
        [
            "#activeInvestments",
            "[data-active-investments]"
        ],
        active
    );


    setText(
        [
            "#referralTeam",
            "[data-referral-team]"
        ],
        referrals
    );


    setText(
        [
            "#transactionCount",
            "[data-transaction-count]"
        ],
        transactions
    );
}


/* =========================================================
   MONEY
========================================================= */

function setMoney(selectors, value) {

    const number =
        Number(value);

    const safeValue =
        Number.isFinite(number)
            ? number
            : 0;


    const formatted =
        `UGX ${Math.round(
            safeValue
        ).toLocaleString()}`;


    selectors.forEach(selector => {

        document
            .querySelectorAll(selector)
            .forEach(element => {

                element.textContent =
                    formatted;

            });

    });
}


/* =========================================================
   TEXT
========================================================= */

function setText(selectors, value) {

    selectors.forEach(selector => {

        document
            .querySelectorAll(selector)
            .forEach(element => {

                element.textContent =
                    String(value);

            });

    });
}


/* =========================================================
   CALCULATOR
========================================================= */

function setupCalculator() {

    const amountInput =
        document.querySelector(
            "#investmentAmount, #calcAmount"
        );

    const daysInput =
        document.querySelector(
            "#investmentDays, #calcDays"
        );

    const dailyResult =
        document.getElementById(
            "dailyReturn"
        );

    const monthlyResult =
        document.getElementById(
            "monthlyReturn"
        );

    const totalResult =
        document.getElementById(
            "totalAfter30"
        );


    if (!amountInput) {
        return;
    }


    function calculate() {

        const amount =
            Number(
                amountInput.value || 0
            );


        const days =
            Number(
                daysInput?.value || 30
            );


        const DAILY_RATE =
            0.10;


        const daily =
            amount * DAILY_RATE;


        const totalReturn =
            daily * days;


        const total =
            amount + totalReturn;


        if (dailyResult) {

            dailyResult.textContent =
                `UGX ${Math.round(
                    daily
                ).toLocaleString()}`;
        }


        if (monthlyResult) {

            monthlyResult.textContent =
                `UGX ${Math.round(
                    totalReturn
                ).toLocaleString()}`;
        }


        if (totalResult) {

            totalResult.textContent =
                `UGX ${Math.round(
                    total
                ).toLocaleString()}`;
        }
    }


    amountInput.addEventListener(
        "input",
        calculate
    );


    if (daysInput) {

        daysInput.addEventListener(
            "input",
            calculate
        );
    }


    calculate();
}


/* =========================================================
   MOBILE MENU
========================================================= */

function setupMobileMenu() {

    const button =
        document.getElementById(
            "menuToggle"
        );

    const sidebar =
        document.querySelector(
            ".sidebar"
        );


    if (!button || !sidebar) {
        return;
    }


    button.addEventListener(
        "click",
        () => {

            sidebar.classList.toggle(
                "mobile-open"
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
        async event => {

            event.preventDefault();


            try {

                await fetch(
                    `${API_BASE}/logout.php`,
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


            localStorage.removeItem(
                "user"
            );

            localStorage.removeItem(
                "userData"
            );


            window.location.href =
                "/login.html";
        }
    );
}