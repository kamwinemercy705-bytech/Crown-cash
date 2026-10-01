/*
|--------------------------------------------------------------------------
| Crown Cash - User Dashboard
|--------------------------------------------------------------------------
*/

const API_BASE = "https://crown-cash1.onrender.com";

const DASHBOARD_API = `${API_BASE}/dashboard.php`;
const LOGOUT_API = `${API_BASE}/logout.php`;

const REQUEST_TIMEOUT = 15000;

/*
|--------------------------------------------------------------------------
| Helpers
|--------------------------------------------------------------------------
*/

const $ = (id) => document.getElementById(id);

function setText(id, value) {
    const element = $(id);

    if (element) {
        element.textContent = value;
    }
}

function formatCurrency(value) {
    const number = Number(value) || 0;

    return `UGX ${Math.round(number).toLocaleString("en-UG")}`;
}

function formatNumber(value) {
    const number = Number(value) || 0;

    return Math.round(number).toLocaleString("en-UG");
}

function formatAccountType(value) {

    const text = String(value || "User")
        .replace(/[_-]+/g, " ")
        .trim();

    if (!text) {
        return "User";
    }

    return text
        .split(" ")
        .map(word => {
            return word.charAt(0).toUpperCase() +
                   word.slice(1).toLowerCase();
        })
        .join(" ");
}

/*
|--------------------------------------------------------------------------
| Fetch
|--------------------------------------------------------------------------
*/

async function fetchWithTimeout(
    url,
    options = {},
    timeout = REQUEST_TIMEOUT
) {

    const controller =
        new AbortController();

    const timer =
        setTimeout(
            () => controller.abort(),
            timeout
        );

    try {

        return await fetch(
            url,
            {
                ...options,

                credentials: "include",

                signal:
                    controller.signal,

                headers: {
                    "Accept":
                        "application/json",

                    ...(options.headers || {})
                }
            }
        );

    } finally {

        clearTimeout(timer);
    }
}

async function readJson(response) {

    const text =
        await response.text();

    if (!text) {
        return {};
    }

    try {

        return JSON.parse(text);

    } catch (error) {

        console.error(
            "Invalid dashboard JSON:",
            text
        );

        throw new Error(
            "The server returned an invalid response."
        );
    }
}

/*
|--------------------------------------------------------------------------
| Dashboard
|--------------------------------------------------------------------------
*/

async function loadDashboard() {

    try {

        const response =
            await fetchWithTimeout(
                DASHBOARD_API,
                {
                    method: "GET",
                    cache: "no-store"
                }
            );

        const data =
            await readJson(response);

        console.log(
            "Crown Cash dashboard response:",
            data
        );

        /*
        |--------------------------------------------------------------------------
        | Login required
        |--------------------------------------------------------------------------
        */

        if (
            response.status === 401 ||
            response.status === 403
        ) {

            window.location.href =
                "login.html";

            return null;
        }

        /*
        |--------------------------------------------------------------------------
        | Server error
        |--------------------------------------------------------------------------
        */

        if (!response.ok) {

            throw new Error(
                data.message ||
                `Dashboard request failed (${response.status}).`
            );
        }

        if (data.success === false) {

            throw new Error(
                data.message ||
                "Unable to load dashboard."
            );
        }

        /*
        |--------------------------------------------------------------------------
        | Display user
        |--------------------------------------------------------------------------
        */

        displayUser(
            data.user || {}
        );

        /*
        |--------------------------------------------------------------------------
        | Display statistics
        |--------------------------------------------------------------------------
        */

        displayDashboardStats(
            data.stats || {},
            data.earnings || {},
            data.referrals || {}
        );

        /*
        |--------------------------------------------------------------------------
        | Admin panel
        |--------------------------------------------------------------------------
        */

        setupAdminPanel(
            data.user || {},
            data.admin || {}
        );

        /*
        |--------------------------------------------------------------------------
        | Dashboard event
        |--------------------------------------------------------------------------
        */

        window.dispatchEvent(
            new CustomEvent(
                "crownCashDashboardLoaded",
                {
                    detail: data
                }
            )
        );

        return data;

    } catch (error) {

        console.error(
            "Crown Cash dashboard error:",
            error
        );

        showDashboardError(
            error.message ||
            "Unable to load dashboard data."
        );

        return null;
    }
}

/*
|--------------------------------------------------------------------------
| User
|--------------------------------------------------------------------------
*/

function displayUser(user) {

    const name =
        user.name ||
        user.full_name ||
        user.username ||
        "Crown Cash User";

    const firstName =
        user.first_name ||
        name.split(" ")[0] ||
        "User";

    setText(
        "welcomeName",
        name
    );

    setText(
        "sidebarUserName",
        name
    );

    setText(
        "sidebarAccountType",
        formatAccountType(
            user.account_type ||
            user.role ||
            "User"
        )
    );
}

/*
|--------------------------------------------------------------------------
| Statistics
|--------------------------------------------------------------------------
*/

function displayDashboardStats(
    stats,
    earnings = {},
    referrals = {}
) {

    /*
    |--------------------------------------------------------------------------
    | Wallet
    |--------------------------------------------------------------------------
    */

    const walletBalance =
        Number(
            stats.available_balance ??
            stats.wallet_balance ??
            0
        );

    /*
    |--------------------------------------------------------------------------
    | Investment
    |--------------------------------------------------------------------------
    */

    const totalInvested =
        Number(
            stats.total_invested ??
            0
        );

    /*
    |--------------------------------------------------------------------------
    | Earnings
    |--------------------------------------------------------------------------
    */

    const investmentEarnings =
        Number(
            stats.investment_earnings ??
            earnings.investment ??
            0
        );

    const referralEarnings =
        Number(
            stats.referral_earnings ??
            earnings.referral ??
            referrals.earnings ??
            0
        );

    const totalEarnings =
        Number(
            stats.total_earnings ??
            earnings.total ??
            (
                investmentEarnings +
                referralEarnings
            )
        );

    /*
    |--------------------------------------------------------------------------
    | Referral team
    |--------------------------------------------------------------------------
    */

    const referralTeam =
        Number(
            stats.referral_team ??
            referrals.team ??
            0
        );

    /*
    |--------------------------------------------------------------------------
    | Transactions
    |--------------------------------------------------------------------------
    */

    const transactionCount =
        Number(
            stats.transaction_count ??
            0
        );

    /*
    |--------------------------------------------------------------------------
    | Main cards
    |--------------------------------------------------------------------------
    */

    setText(
        "availableBalance",
        formatCurrency(
            walletBalance
        )
    );

    setText(
        "totalInvested",
        formatCurrency(
            totalInvested
        )
    );

    setText(
        "totalEarnings",
        formatCurrency(
            totalEarnings
        )
    );

    setText(
        "referralTeam",
        formatNumber(
            referralTeam
        )
    );

    setText(
        "transactionCount",
        formatNumber(
            transactionCount
        )
    );

    /*
    |--------------------------------------------------------------------------
    | Optional earnings fields
    |--------------------------------------------------------------------------
    */

    setText(
        "investmentEarnings",
        formatCurrency(
            investmentEarnings
        )
    );

    setText(
        "referralEarnings",
        formatCurrency(
            referralEarnings
        )
    );

    setText(
        "totalInvestmentEarnings",
        formatCurrency(
            investmentEarnings
        )
    );

    setText(
        "totalReferralEarnings",
        formatCurrency(
            referralEarnings
        )
    );

    setText(
        "totalEarningsBreakdown",
        formatCurrency(
            totalEarnings
        )
    );
}

/*
|--------------------------------------------------------------------------
| Error
|--------------------------------------------------------------------------
*/

function showDashboardError(message) {

    console.error(
        "Crown Cash:",
        message
    );

    const balance =
        $("availableBalance");

    if (balance) {

        balance.textContent =
            "Unable to load";
    }
}

/*
|--------------------------------------------------------------------------
| Admin Panel
|--------------------------------------------------------------------------
*/

function setupAdminPanel(
    user = {},
    admin = {}
) {

    const role =
        String(
            user.role ||
            ""
        )
        .trim()
        .toLowerCase();

    const accountType =
        String(
            user.account_type ||
            ""
        )
        .trim()
        .toLowerCase();

    /*
    |--------------------------------------------------------------------------
    | Primary server-side admin flag
    |--------------------------------------------------------------------------
    */

    const serverAdmin =
        user.is_admin === true ||
        admin.is_admin === true;

    /*
    |--------------------------------------------------------------------------
    | Fallback role detection
    |--------------------------------------------------------------------------
    */

    const roleAdmin =
        role === "admin" ||
        role === "administrator" ||
        accountType === "admin" ||
        accountType === "administrator";

    const isAdmin =
        serverAdmin ||
        roleAdmin;

    console.log(
        "Crown Cash admin status:",
        {
            isAdmin,
            serverAdmin,
            role,
            accountType
        }
    );

    const adminNavLink =
        $("adminNavLink");

    const adminActionCard =
        $("adminActionCard");

    if (isAdmin) {

        /*
        | Sidebar Admin Panel
        */

        if (adminNavLink) {

            adminNavLink.classList.remove(
                "hidden"
            );

            adminNavLink.style.display =
                "flex";

            adminNavLink.removeAttribute(
                "aria-hidden"
            );
        }

        /*
        | Quick Action Admin Panel
        */

        if (adminActionCard) {

            adminActionCard.classList.remove(
                "hidden"
            );

            adminActionCard.style.display =
                "flex";

            adminActionCard.removeAttribute(
                "aria-hidden"
            );
        }

    } else {

        if (adminNavLink) {

            adminNavLink.classList.add(
                "hidden"
            );

            adminNavLink.style.display =
                "none";
        }

        if (adminActionCard) {

            adminActionCard.classList.add(
                "hidden"
            );

            adminActionCard.style.display =
                "none";
        }
    }
}

/*
|--------------------------------------------------------------------------
| Investment Calculator
|--------------------------------------------------------------------------
*/

function setupInvestmentCalculator() {

    const amountInput =
        $("investmentAmount");

    const dailyReturn =
        $("dailyReturn");

    const monthlyReturn =
        $("monthlyReturn");

    const totalAfter30 =
        $("totalAfter30");

    if (!amountInput) {
        return;
    }

    function calculate() {

        const amount =
            Number(
                amountInput.value
            ) || 0;

        const rate = 0.10;

        const daily =
            amount * rate;

        const monthly =
            daily * 30;

        const total =
            amount + monthly;

        if (dailyReturn) {

            dailyReturn.textContent =
                formatCurrency(
                    daily
                );
        }

        if (monthlyReturn) {

            monthlyReturn.textContent =
                formatCurrency(
                    monthly
                );
        }

        if (totalAfter30) {

            totalAfter30.textContent =
                formatCurrency(
                    total
                );
        }
    }

    amountInput.addEventListener(
        "input",
        calculate
    );

    calculate();
}

/*
|--------------------------------------------------------------------------
| Mobile Menu
|--------------------------------------------------------------------------
*/

function setupMobileMenu() {

    const menuToggle =
        $("menuToggle");

    const sidebar =
        document.querySelector(
            ".sidebar"
        );

    if (
        !menuToggle ||
        !sidebar
    ) {
        return;
    }

    menuToggle.addEventListener(
        "click",
        () => {

            sidebar.classList.toggle(
                "mobile-open"
            );
        }
    );
}

/*
|--------------------------------------------------------------------------
| Logout
|--------------------------------------------------------------------------
*/

async function logoutUser() {

    try {

        await fetchWithTimeout(
            LOGOUT_API,
            {
                method: "POST",

                headers: {
                    "Content-Type":
                        "application/json"
                },

                body:
                    JSON.stringify({})
            }
        );

    } catch (error) {

        console.warn(
            "Logout request failed:",
            error
        );

    } finally {

        window.location.href =
            "login.html";
    }
}

function setupLogout() {

    const logoutButton =
        $("logoutBtn");

    if (!logoutButton) {
        return;
    }

    logoutButton.addEventListener(
        "click",
        async (event) => {

            event.preventDefault();

            await logoutUser();
        }
    );
}

/*
|--------------------------------------------------------------------------
| Initialize
|--------------------------------------------------------------------------
*/

document.addEventListener(
    "DOMContentLoaded",
    async () => {

        setupInvestmentCalculator();

        setupMobileMenu();

        setupLogout();

        await loadDashboard();
    }
);

/*
|--------------------------------------------------------------------------
| Global API
|--------------------------------------------------------------------------
*/

window.CrownCashDashboard = {

    reload:
        loadDashboard,

    logout:
        logoutUser
};