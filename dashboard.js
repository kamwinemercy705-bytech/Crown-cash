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
   API HELPER
========================================================= */

async function apiFetch(path, options = {}) {
    const requestOptions = {
        credentials: "include",
        ...options
    };

    /*
     * Only add JSON content type when a body is actually
     * being sent as JSON.
     */
    if (requestOptions.body && typeof requestOptions.body === "string") {
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
        /*
         * dashboard.php now returns both user information
         * and all dashboard statistics.
         */
        const data = await apiFetch("dashboard.php");

        if (data.user) {
            displayUser(data.user);
        }

        loadStatistics(data);

    } catch (error) {

        console.error(
            "Dashboard loading error:",
            error
        );

        /*
         * Try profile.php as a fallback if the dashboard
         * endpoint temporarily fails.
         */
        try {
            const profile = await apiFetch("profile.php");

            displayUser(
                profile.user ||
                profile ||
                {}
            );

        } catch (profileError) {
            console.error(
                "Profile fallback failed:",
                profileError
            );
        }
    }
}


/* =========================================================
   DISPLAY USER INFORMATION
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
        "User";

    /*
     * User name
     */
    document
        .querySelectorAll(
            "[data-user-name], #userName, .user-name"
        )
        .forEach(element => {
            element.textContent = fullName;
        });


    /*
     * Email
     */
    document
        .querySelectorAll(
            "[data-user-email], #userEmail"
        )
        .forEach(element => {
            element.textContent =
                user.email || "";
        });


    /*
     * Phone
     */
    document
        .querySelectorAll(
            "[data-user-phone], #userPhone"
        )
        .forEach(element => {
            element.textContent =
                user.phone || "";
        });


    /*
     * Referral code
     */
    document
        .querySelectorAll(
            "[data-referral-code], #referralCode"
        )
        .forEach(element => {
            element.textContent =
                user.referralCode ||
                user.referral_code ||
                "";
        });


    /*
     * Admin-only sections
     */
    const role = String(
        user.role || ""
    ).toLowerCase();

    document
        .querySelectorAll(
            ".admin-only, [data-admin-only]"
        )
        .forEach(element => {

            if (role === "admin") {
                element.style.display = "";
            } else {
                element.style.display = "none";
            }
        });
}


/* =========================================================
   LOAD DASHBOARD STATISTICS
========================================================= */

function loadStatistics(data) {

    /*
     * Wallet balance
     */
    const balance = Number(
        data.balance ??
        data.available_balance ??
        data.wallet_balance ??
        0
    );


    /*
     * Total deposits
     */
    const deposits = Number(
        data.totalDeposits ??
        data.total_deposits ??
        0
    );


    /*
     * Total invested
     */
    const invested = Number(
        data.totalInvested ??
        data.total_invested ??
        0
    );


    /*
     * Total earnings
     */
    const earnings = Number(
        data.totalEarnings ??
        data.total_earnings ??
        0
    );


    /*
     * Today's return
     */
    const daily = Number(
        data.dailyReturnAmount ??
        data.daily_return ??
        0
    );


    /*
     * Active investments
     */
    const active = Number(
        data.activeInvestments ??
        data.active_investments ??
        0
    );


    /*
     * Referral team
     */
    const referrals = Number(
        data.referralTeam ??
        data.referral_team ??
        0
    );


    /*
     * Transaction count
     */
    const transactions = Number(
        data.transactionCount ??
        data.transaction_count ??
        0
    );


    /* -----------------------------------------------------
       MONEY VALUES
    ----------------------------------------------------- */

    setMoney(
        [
            "#balance",
            "#availableBalance",
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


    /* -----------------------------------------------------
       COUNTS
    ----------------------------------------------------- */

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
   MONEY FORMATTER
========================================================= */

function setMoney(selectors, value) {

    const safeValue =
        Number.isFinite(Number(value))
            ? Number(value)
            : 0;

    const formatted =
        `UGX ${Math.round(safeValue).toLocaleString()}`;

    selectors.forEach(selector => {

        document
            .querySelectorAll(selector)
            .forEach(element => {
                element.textContent = formatted;
            });

    });
}


/* =========================================================
   TEXT FORMATTER
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
   INVESTMENT CALCULATOR
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

    const result =
        document.querySelector(
            "#calculatorResult, #calcResult"
        );

    /*
     * If the current dashboard doesn't contain the
     * calculator, simply stop here.
     */
    if (!amountInput || !result) {
        return;
    }


    const calculate = () => {

        const amount =
            Number(amountInput.value || 0);

        const days =
            Number(daysInput?.value || 30);


        /*
         * This is the configured application rate.
         *
         * It is illustrative and must not be presented
         * as a guaranteed investment return.
         */
        const DAILY_RATE = 0.10;


        const daily =
            amount * DAILY_RATE;

        const total =
            daily * days;


        result.innerHTML = `
            <div>
                Daily return:
                <strong>
                    UGX ${Math.round(daily).toLocaleString()}
                </strong>
            </div>

            <div>
                Total illustrative return:
                <strong>
                    UGX ${Math.round(total).toLocaleString()}
                </strong>
            </div>

            <small>
                This calculator is illustrative.
                Actual credits depend on approved investments
                and the configured application rate.
            </small>
        `;
    };


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
        document.querySelector(
            "#menuToggle, .menu-toggle"
        );

    const menu =
        document.querySelector(
            "#mobileMenu, .mobile-menu"
        );


    if (!button || !menu) {
        return;
    }


    button.addEventListener(
        "click",
        () => {

            menu.classList.toggle(
                "active"
            );

        }
    );
}


/* =========================================================
   LOGOUT
========================================================= */

function setupLogout() {

    document
        .querySelectorAll(
            "#logoutBtn, [data-logout]"
        )
        .forEach(button => {

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
                            "Logout request failed:",
                            error
                        );
                    }


                    /*
                     * Clear locally stored user information.
                     */
                    localStorage.removeItem(
                        "user"
                    );

                    localStorage.removeItem(
                        "userData"
                    );


                    /*
                     * Redirect to login.
                     */
                    window.location.href =
                        "/login.html";
                }
            );

        });
}