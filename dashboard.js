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

function escapeHtml(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
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

    const controller = new AbortController();

    const timer = setTimeout(
        () => controller.abort(),
        timeout
    );

    try {

        return await fetch(url, {
            ...options,
            credentials: "include",
            signal: controller.signal,
            headers: {
                "Accept": "application/json",
                ...(options.headers || {})
            }
        });

    } finally {

        clearTimeout(timer);
    }
}

async function readJson(response) {

    const text = await response.text();

    if (!text) {
        return {};
    }

    try {

        return JSON.parse(text);

    } catch (error) {

        console.error(
            "Invalid JSON response:",
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

        const response = await fetchWithTimeout(
            DASHBOARD_API,
            {
                method: "GET"
            }
        );

        const data = await readJson(response);

        if (
            response.status === 401 ||
            response.status === 403
        ) {

            window.location.href = "login.html";
            return;
        }

        if (!response.ok || data.success === false) {

            throw new Error(
                data.message ||
                "Unable to load dashboard."
            );
        }

        displayUser(data.user || {});

        displayDashboardStats(
            data.stats || {},
            data.earnings || {},
            data.referrals || {}
        );

        setupAdminPanel(
            data.user || {}
        );

        /*
        |--------------------------------------------------------------------------
        | Dispatch event for other dashboard components
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
            "Dashboard error:",
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
| User information
|--------------------------------------------------------------------------
*/

function displayUser(user) {

    const name =
        user.name ||
        user.full_name ||
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
| Dashboard statistics
|--------------------------------------------------------------------------
*/

function displayDashboardStats(
    stats,
    earnings = {},
    referrals = {}
) {

    const walletBalance =
        Number(
            stats.available_balance ??
            stats.wallet_balance ??
            0
        );

    const totalInvested =
        Number(
            stats.total_invested ??
            0
        );

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

    const referralTeam =
        Number(
            stats.referral_team ??
            referrals.team ??
            0
        );

    const transactionCount =
        Number(
            stats.transaction_count ??
            0
        );

    /*
    |--------------------------------------------------------------------------
    | Existing dashboard cards
    |--------------------------------------------------------------------------
    */

    setText(
        "availableBalance",
        formatCurrency(walletBalance)
    );

    setText(
        "totalInvested",
        formatCurrency(totalInvested)
    );

    setText(
        "totalEarnings",
        formatCurrency(totalEarnings)
    );

    setText(
        "referralTeam",
        formatNumber(referralTeam)
    );

    setText(
        "transactionCount",
        formatNumber(transactionCount)
    );

    /*
    |--------------------------------------------------------------------------
    | Optional detailed earnings elements
    |--------------------------------------------------------------------------
    |
    | These will work automatically if you later add these IDs to HTML.
    |--------------------------------------------------------------------------
    */

    setText(
        "investmentEarnings",
        formatCurrency(investmentEarnings)
    );

    setText(
        "referralEarnings",
        formatCurrency(referralEarnings)
    );

    setText(
        "totalInvestmentEarnings",
        formatCurrency(investmentEarnings)
    );

    setText(
        "totalReferralEarnings",
        formatCurrency(referralEarnings)
    );

    setText(
        "totalEarningsBreakdown",
        formatCurrency(totalEarnings)
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
| Admin panel
|--------------------------------------------------------------------------
*/

function setupAdminPanel(user) {

    const role =
        String(
            user.role ||
            user.account_type ||
            ""
        )
        .trim()
        .toLowerCase();

    const isAdmin =
        role === "admin" ||
        role === "administrator" ||
        String(user.account_type || "")
            .trim()
            .toLowerCase() === "admin" ||
        String(user.account_type || "")
            .trim()
            .toLowerCase() === "administrator";

    const adminNavLink =
        $("adminNavLink");

    const adminActionCard =
        $("adminActionCard");

    if (isAdmin) {

        if (adminNavLink) {
            adminNavLink.classList.remove(
                "hidden"
            );

            adminNavLink.style.display = "flex";
        }

        if (adminActionCard) {
            adminActionCard.classList.remove(
                "hidden"
            );

            adminActionCard.style.display = "flex";
        }

    } else {

        if (adminNavLink) {
            adminNavLink.classList.add(
                "hidden"
            );

            adminNavLink.style.display = "none";
        }

        if (adminActionCard) {
            adminActionCard.classList.add(
                "hidden"
            );

            adminActionCard.style.display = "none";
        }
    }
}

/*
|--------------------------------------------------------------------------
| Investment calculator
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
            Number(amountInput.value) || 0;

        const rate = 0.10;

        const daily =
            amount * rate;

        const monthly =
            daily * 30;

        const total =
            amount + monthly;

        if (dailyReturn) {

            dailyReturn.textContent =
                formatCurrency(daily);
        }

        if (monthlyReturn) {

            monthlyReturn.textContent =
                formatCurrency(monthly);
        }

        if (totalAfter30) {

            totalAfter30.textContent =
                formatCurrency(total);
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
| Mobile menu
|--------------------------------------------------------------------------
*/

function setupMobileMenu() {

    const menuToggle =
        $("menuToggle");

    const sidebar =
        document.querySelector(".sidebar");

    if (!menuToggle || !sidebar) {
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
                body: JSON.stringify({})
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

    reload: loadDashboard,

    logout: logoutUser
};