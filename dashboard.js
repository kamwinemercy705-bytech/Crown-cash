/*
|--------------------------------------------------------------------------
| Crown Cash Dashboard
|--------------------------------------------------------------------------
*/

const API_BASE = "https://crown-cash1.onrender.com";

const DASHBOARD_API = `${API_BASE}/dashboard.php`;
const LOGOUT_API = `${API_BASE}/logout.php`;

document.addEventListener("DOMContentLoaded", () => {
    initDashboard();
});

async function initDashboard() {
    try {
        setupMenu();
        setupLogout();
        setupCalculator();

        await loadDashboard();

    } catch (error) {
        console.error("Dashboard initialization error:", error);
    }
}

/*
|--------------------------------------------------------------------------
| Load dashboard
|--------------------------------------------------------------------------
*/

async function loadDashboard() {
    try {
        const response = await fetch(
            `${DASHBOARD_API}?_=${Date.now()}`,
            {
                method: "GET",
                credentials: "include",
                cache: "no-store",
                headers: {
                    "Accept": "application/json",
                    "Cache-Control": "no-cache"
                }
            }
        );

        const rawText = await response.text();

        console.log("Dashboard HTTP status:", response.status);
        console.log("Dashboard raw response:", rawText);

        let data;

        try {
            data = JSON.parse(rawText);
        } catch (error) {
            console.error("Dashboard returned invalid JSON:", rawText);

            showWalletError("Unable to load");

            return;
        }

        console.log("Dashboard parsed data:", data);

        if (
            response.status === 401 ||
            response.status === 403
        ) {
            window.location.href = "login.html";
            return;
        }

        if (!response.ok || data.success === false) {
            console.error(
                "Dashboard API error:",
                data.message || "Unknown dashboard error"
            );

            showWalletError("Unable to load");

            /*
             * Still attempt admin detection if the API returned
             * user/admin information.
             */
            setupAdminPanel(
                data.user || {},
                data.admin || {},
                data
            );

            return;
        }

        const user = data.user || {};
        const admin = data.admin || {};

        displayUser(user);
        displayDashboardStats(data);
        setupAdminPanel(user, admin, data);

    } catch (error) {
        console.error("Failed to load dashboard:", error);

        showWalletError("Unable to load");
    }
}

/*
|--------------------------------------------------------------------------
| Display user
|--------------------------------------------------------------------------
*/

function displayUser(user) {

    const name =
        user.name ||
        user.full_name ||
        user.fullName ||
        user.username ||
        user.first_name ||
        user.firstName ||
        "Member";

    setText("welcomeName", name);
    setText("sidebarUserName", name);

    const accountType =
        user.account_type ||
        user.accountType ||
        user.role ||
        "Member";

    setText(
        "sidebarAccountType",
        formatAccountType(accountType)
    );
}

/*
|--------------------------------------------------------------------------
| Display dashboard statistics
|--------------------------------------------------------------------------
*/

function displayDashboardStats(data) {

    /*
     * Wallet
     */
    const balance = firstNumber([
        data.balance,
        data.available_balance,
        data.availableBalance,
        data.wallet_balance,
        data.walletBalance,

        data.user?.balance,
        data.user?.available_balance,
        data.user?.availableBalance,
        data.user?.wallet_balance,
        data.user?.walletBalance,

        data.user?.wallet?.balance
    ]);

    if (balance !== null) {
        setMoney("availableBalance", balance);
    } else {
        showWalletError("Unable to load");
    }

    /*
     * Total invested
     */
    const totalInvested = firstNumber([
        data.total_invested,
        data.totalInvested,

        data.stats?.total_invested,
        data.stats?.totalInvested,

        data.user?.total_invested,
        data.user?.totalInvested
    ]);

    setMoney(
        "totalInvested",
        totalInvested ?? 0
    );

    /*
     * Total earnings
     */
    const totalEarnings = firstNumber([
        data.total_earnings,
        data.totalEarnings,

        data.stats?.total_earnings,
        data.stats?.totalEarnings,

        data.user?.total_earnings,
        data.user?.totalEarnings
    ]);

    setMoney(
        "totalEarnings",
        totalEarnings ?? 0
    );

    /*
     * Referral team
     */
    const referralTeam = firstNumber([
        data.referral_team,
        data.referralTeam,

        data.team,
        data.team_count,

        data.stats?.referral_team,
        data.stats?.referralTeam,

        data.referrals?.total
    ]);

    setText(
        "referralTeam",
        formatNumber(referralTeam ?? 0)
    );

    /*
     * Transactions
     */
    const transactionCount = firstNumber([
        data.transaction_count,
        data.transactionCount,

        data.stats?.transaction_count,
        data.stats?.transactionCount,

        data.transactions?.total
    ]);

    setText(
        "transactionCount",
        formatNumber(transactionCount ?? 0)
    );
}

/*
|--------------------------------------------------------------------------
| Admin panel
|--------------------------------------------------------------------------
*/

function setupAdminPanel(user = {}, admin = {}, data = {}) {

    console.log("Checking admin status...");
    console.log("User:", user);
    console.log("Admin:", admin);

    /*
     * Check every admin flag supported by the backend.
     */
    const isAdmin =
        isTrue(user.is_admin) ||
        isTrue(user.isAdmin) ||

        isTrue(admin.is_admin) ||
        isTrue(admin.isAdmin) ||

        isTrue(data.is_admin) ||
        isTrue(data.isAdmin) ||

        isTrue(data.admin_user) ||

        isAdminRole(user.role) ||
        isAdminRole(user.account_type) ||
        isAdminRole(user.accountType) ||

        isAdminRole(admin.role) ||
        isAdminRole(admin.account_type);

    console.log("Final admin status:", isAdmin);

    const adminNav =
        document.getElementById("adminNavLink");

    const adminAction =
        document.getElementById("adminActionCard");

    if (isAdmin) {

        if (adminNav) {
            adminNav.classList.remove("hidden");
            adminNav.style.display = "";
            adminNav.removeAttribute("aria-hidden");
        }

        if (adminAction) {
            adminAction.classList.remove("hidden");
            adminAction.style.display = "";
            adminAction.removeAttribute("aria-hidden");
        }

        console.log("Admin Panel enabled.");

    } else {

        /*
         * Keep hidden for ordinary members.
         */
        if (adminNav) {
            adminNav.classList.add("hidden");
        }

        if (adminAction) {
            adminAction.classList.add("hidden");
        }

        console.log("Admin Panel hidden for non-admin user.");
    }
}

/*
|--------------------------------------------------------------------------
| Admin helpers
|--------------------------------------------------------------------------
*/

function isTrue(value) {

    if (value === true) {
        return true;
    }

    if (value === 1) {
        return true;
    }

    if (typeof value === "string") {

        const normalized =
            value.trim().toLowerCase();

        return [
            "true",
            "1",
            "yes",
            "admin",
            "administrator"
        ].includes(normalized);
    }

    return false;
}

function isAdminRole(value) {

    if (!value) {
        return false;
    }

    const role =
        String(value)
            .trim()
            .toLowerCase();

    return [
        "admin",
        "administrator",
        "superadmin",
        "super_admin"
    ].includes(role);
}

/*
|--------------------------------------------------------------------------
| Wallet error
|--------------------------------------------------------------------------
*/

function showWalletError(message) {

    const element =
        document.getElementById("availableBalance");

    if (!element) {
        return;
    }

    element.textContent = message;

    element.classList.add("wallet-error");
}

/*
|--------------------------------------------------------------------------
| Calculator
|--------------------------------------------------------------------------
*/

function setupCalculator() {

    const amountInput =
        document.getElementById("investmentAmount");

    const dailyReturn =
        document.getElementById("dailyReturn");

    const monthlyReturn =
        document.getElementById("monthlyReturn");

    const totalAfter30 =
        document.getElementById("totalAfter30");

    if (!amountInput) {
        return;
    }

    function calculate() {

        const amount =
            Number(
                String(amountInput.value)
                    .replace(/,/g, "")
            ) || 0;

        const daily =
            Math.round(amount * 0.10);

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

/*
|--------------------------------------------------------------------------
| Menu
|--------------------------------------------------------------------------
*/

function setupMenu() {

    const menuToggle =
        document.getElementById("menuToggle");

    if (!menuToggle) {
        return;
    }

    menuToggle.addEventListener(
        "click",
        () => {

            document.body.classList.toggle(
                "menu-open"
            );

            const sidebar =
                document.querySelector(".sidebar");

            if (sidebar) {
                sidebar.classList.toggle(
                    "open"
                );
            }
        }
    );
}

/*
|--------------------------------------------------------------------------
| Logout
|--------------------------------------------------------------------------
*/

function setupLogout() {

    const logoutButton =
        document.getElementById("logoutBtn");

    if (!logoutButton) {
        return;
    }

    logoutButton.addEventListener(
        "click",
        async () => {

            logoutButton.disabled = true;

            try {

                await fetch(
                    LOGOUT_API,
                    {
                        method: "POST",
                        credentials: "include",
                        headers: {
                            "Accept": "application/json"
                        }
                    }
                );

            } catch (error) {

                console.error(
                    "Logout error:",
                    error
                );
            }

            window.location.href =
                "login.html";
        }
    );
}

/*
|--------------------------------------------------------------------------
| DOM helpers
|--------------------------------------------------------------------------
*/

function setText(id, value) {

    const element =
        document.getElementById(id);

    if (!element) {
        return;
    }

    element.textContent =
        value ?? "";
}

function setMoney(id, value) {

    const element =
        document.getElementById(id);

    if (!element) {
        return;
    }

    element.textContent =
        formatMoney(value);

    element.classList.remove(
        "wallet-error"
    );
}

function firstNumber(values) {

    for (const value of values) {

        if (
            value !== undefined &&
            value !== null &&
            value !== "" &&
            !Number.isNaN(Number(value))
        ) {
            return Number(value);
        }
    }

    return null;
}

function formatNumber(value) {

    return Number(value || 0)
        .toLocaleString("en-US");
}

function formatMoney(value) {

    return (
        "UGX " +
        Number(value || 0)
            .toLocaleString("en-US")
    );
}

function formatAccountType(value) {

    const text =
        String(value || "Member")
            .replace(/[_-]/g, " ");

    return text
        .charAt(0)
        .toUpperCase() +
        text.slice(1);
}