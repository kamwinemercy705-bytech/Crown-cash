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
            data.message || `Request failed (${response.status})`
        );
    }

    return data;
}


/* =========================================================
   LOAD DASHBOARD
========================================================= */

async function loadDashboard() {
    try {
        const data = await apiFetch("dashboard.php");

        if (data.user) {
            displayUser(data.user);
            setupAdminPanel(data.user);
        }

        loadStatistics(data);

    } catch (error) {
        console.error("Dashboard loading error:", error);

        try {
            const profile = await apiFetch("profile.php");

            const user = profile.user || profile || {};

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
   DISPLAY USER
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


    document
        .querySelectorAll(
            "[data-user-name], #userName, .user-name"
        )
        .forEach(element => {
            element.textContent = fullName;
        });


    document
        .querySelectorAll(
            "[data-user-email], #userEmail"
        )
        .forEach(element => {
            element.textContent = user.email || "";
        });


    document
        .querySelectorAll(
            "[data-user-phone], #userPhone"
        )
        .forEach(element => {
            element.textContent = user.phone || "";
        });


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


    const role = String(
        user.role || ""
    ).trim().toLowerCase();


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


    /*
     * Store user information locally only for
     * interface convenience.
     *
     * Authorization is still handled by PHP.
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
            "Unable to store user information."
        );
    }
}


/* =========================================================
   ADMIN PANEL
========================================================= */

function setupAdminPanel(user) {

    const role = String(
        user.role || ""
    ).trim().toLowerCase();

    const existingAdminLinks =
        document.querySelectorAll(
            ".admin-only, [data-admin-only]"
        );


    /*
     * Hide all admin elements for normal users.
     */
    if (role !== "admin") {

        existingAdminLinks.forEach(element => {
            element.style.display = "none";
        });

        return;
    }


    /*
     * Admin user.
     *
     * If an Admin Panel link already exists,
     * simply make it visible.
     */

    if (existingAdminLinks.length > 0) {

        existingAdminLinks.forEach(element => {
            element.style.display = "";
        });

        return;
    }


    /*
     * No Admin Panel link exists in the HTML.
     *
     * Create one automatically.
     */

    createAdminPanelLink();
}


/* =========================================================
   CREATE ADMIN PANEL LINK
========================================================= */

function createAdminPanelLink() {

    /*
     * Do not create it twice.
     */
    if (
        document.querySelector(
            "#dynamicAdminPanel"
        )
    ) {
        return;
    }


    const adminLink =
        document.createElement("a");

    adminLink.id =
        "dynamicAdminPanel";

    adminLink.className =
        "admin-panel-link admin-only";

    adminLink.href =
        "/admin-dashboard.html";

    adminLink.innerHTML = `
        <span class="admin-panel-icon">
            ⚙️
        </span>

        <span class="admin-panel-content">
            <strong>Admin Panel</strong>
            <small>
                Manage Crown Cash
            </small>
        </span>

        <span class="admin-panel-arrow">
            →
        </span>
    `;


    /*
     * Try to place it in the sidebar first.
     */

    const sidebar =
        document.querySelector(
            ".sidebar .nav, " +
            ".sidebar-nav, " +
            ".admin-nav, " +
            "aside nav"
        );


    if (sidebar) {

        sidebar.appendChild(adminLink);

        addAdminPanelStyles();

        return;
    }


    /*
     * If no sidebar exists, place it
     * inside the quick actions section.
     */

    const quickActions =
        document.querySelector(
            ".quick-actions, " +
            "#quickActions, " +
            "[data-quick-actions]"
        );


    if (quickActions) {

        quickActions.prepend(adminLink);

        addAdminPanelStyles();

        return;
    }


    /*
     * Final fallback:
     * place it near the top of the dashboard.
     */

    const main =
        document.querySelector(
            "main, .main, .dashboard-main"
        );

    if (main) {

        main.prepend(adminLink);

        addAdminPanelStyles();
    }
}


/* =========================================================
   ADMIN PANEL STYLES
========================================================= */

function addAdminPanelStyles() {

    if (
        document.querySelector(
            "#dynamicAdminPanelStyles"
        )
    ) {
        return;
    }


    const style =
        document.createElement("style");

    style.id =
        "dynamicAdminPanelStyles";


    style.textContent = `
        .admin-panel-link {
            display: flex !important;
            align-items: center;
            gap: 12px;
            width: 100%;
            box-sizing: border-box;
            padding: 13px 15px;
            margin-top: 10px;
            color: #f7f3fa;
            text-decoration: none;
            background:
                linear-gradient(
                    135deg,
                    rgba(114,16,74,.95),
                    rgba(77,9,47,.95)
                );
            border: 1px solid rgba(255,211,77,.28);
            border-radius: 14px;
            box-shadow:
                0 8px 25px rgba(0,0,0,.22),
                0 0 18px rgba(228,92,255,.08);
            transition:
                transform .2s ease,
                border-color .2s ease,
                box-shadow .2s ease;
        }

        .admin-panel-link:hover {
            transform: translateY(-2px);
            border-color: rgba(255,211,77,.7);
            box-shadow:
                0 12px 30px rgba(0,0,0,.3),
                0 0 22px rgba(228,92,255,.16);
        }

        .admin-panel-icon {
            width: 38px;
            height: 38px;
            flex: 0 0 38px;
            display: flex;
            align-items: center;
            justify-content: center;
            background: rgba(255,211,77,.12);
            border: 1px solid rgba(255,211,77,.2);
            border-radius: 10px;
            font-size: 18px;
        }

        .admin-panel-content {
            display: flex;
            flex-direction: column;
            min-width: 0;
            flex: 1;
        }

        .admin-panel-content strong {
            color: #fff;
            font-size: 14px;
            font-weight: 800;
        }

        .admin-panel-content small {
            margin-top: 2px;
            color: #aaa1b0;
            font-size: 11px;
        }

        .admin-panel-arrow {
            color: #ffd34d;
            font-size: 18px;
            font-weight: 900;
        }

        @media (max-width: 700px) {
            .admin-panel-link {
                margin-top: 8px;
            }
        }
    `;


    document.head.appendChild(style);
}


/* =========================================================
   DASHBOARD STATISTICS
========================================================= */

function loadStatistics(data) {

    const balance = Number(
        data.balance ??
        data.available_balance ??
        data.wallet_balance ??
        0
    );

    const deposits = Number(
        data.totalDeposits ??
        data.total_deposits ??
        0
    );

    const invested = Number(
        data.totalInvested ??
        data.total_invested ??
        0
    );

    const earnings = Number(
        data.totalEarnings ??
        data.total_earnings ??
        0
    );

    const daily = Number(
        data.dailyReturnAmount ??
        data.daily_return ??
        0
    );

    const active = Number(
        data.activeInvestments ??
        data.active_investments ??
        0
    );

    const referrals = Number(
        data.referralTeam ??
        data.referral_team ??
        0
    );

    const transactions = Number(
        data.transactionCount ??
        data.transaction_count ??
        0
    );


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

                element.textContent =
                    formatted;

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


    if (!amountInput || !result) {
        return;
    }


    const calculate = () => {

        const amount =
            Number(amountInput.value || 0);

        const days =
            Number(daysInput?.value || 30);

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
                Actual credits depend on approved
                investments and the configured
                application rate.
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
            menu.classList.toggle("active");
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

        });
}