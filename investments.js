const API_URL = "https://crown-cash1.onrender.com";

const PLANS = {
starter: {
name: "Starter Plan",
amount: 10000,
days: 30
},
standard: {
name: "Standard Plan",
amount: 15000,
days: 30
},
advanced: {
name: "Advanced Plan",
amount: 25000,
days: 30
}
};

document.addEventListener("DOMContentLoaded", () => {
setupInvestmentButtons();
setupMobileMenu();
setupLogout();
});

/* =========================================================
INVESTMENT BUTTONS
========================================================= */

function setupInvestmentButtons() {
/*
* This supports buttons such as:
*
* data-plan="starter"
* data-plan="standard"
* data-plan="advanced"
*
* Example:
* <button class="invest-btn" data-plan="starter">
*     Invest Now
* </button>
*/

const buttons = document.querySelectorAll(
    "[data-plan], .invest-btn, .investment-btn"
);

buttons.forEach(button => {
    button.addEventListener("click", () => {

        let plan = button.dataset.plan;

        if (!plan) {
            const card = button.closest(
                "[data-plan], .investment-card, .plan-card"
            );

            if (card) {
                plan = card.dataset.plan;
            }
        }

        if (!plan) {
            const text = button.textContent.toLowerCase();

            if (text.includes("starter")) {
                plan = "starter";
            } else if (text.includes("standard")) {
                plan = "standard";
            } else if (text.includes("advanced")) {
                plan = "advanced";
            }
        }

        if (!plan || !PLANS[plan]) {
            showMessage(
                "Unable to identify the investment plan.",
                "error"
            );
            return;
        }

        confirmInvestment(plan);
    });
});

}

/* =========================================================
CONFIRM INVESTMENT
========================================================= */

function confirmInvestment(planKey) {

const plan = PLANS[planKey];

if (!plan) {
    showMessage("Invalid investment plan.", "error");
    return;
}

const confirmed = window.confirm(
    `You selected the ${plan.name}.\n\n` +
    `Investment amount: UGX ${formatMoney(plan.amount)}\n` +
    `Investment period: ${plan.days} days\n\n` +
    `Do you want to continue?`
);

if (!confirmed) {
    return;
}

createInvestment(planKey);

}

/* =========================================================
CREATE INVESTMENT
========================================================= */

async function createInvestment(planKey) {

const plan = PLANS[planKey];

if (!plan) {
    showMessage("Invalid investment plan.", "error");
    return;
}

const buttons = document.querySelectorAll(
    `[data-plan="${planKey}"], .invest-btn, .investment-btn`
);

setButtonsLoading(buttons, true);

showMessage(
    "Submitting your investment request...",
    "info"
);

try {

    const response = await fetch(
        `${API_URL}/investment.php`,
        {
            method: "POST",

            credentials: "include",

            headers: {
                "Content-Type": "application/json",
                "Accept": "application/json"
            },

            body: JSON.stringify({
                plan: planKey,
                amount: plan.amount
            })
        }
    );

    let data;

    try {
        data = await response.json();
    } catch (jsonError) {
        throw new Error(
            "The investment server returned an invalid response."
        );
    }

    console.log("Investment response:", data);

    if (!response.ok || !data.success) {

        let message =
            data.message ||
            data.error ||
            "Unable to create the investment request.";

        if (response.status === 401) {
            message =
                "Your session has expired. Please log in again.";
        }

        throw new Error(message);
    }

    showMessage(
        data.message ||
        "Investment request submitted successfully.",
        "success"
    );

    /*
     * The backend currently creates the investment as PENDING.
     * Do not show it as completed until funding/approval
     * has actually been verified.
     */

    setTimeout(() => {

        if (
            data.investment &&
            data.investment.reference
        ) {

            alert(
                "Investment request submitted successfully.\n\n" +
                `Reference: ${data.investment.reference}\n` +
                "Status: Pending"
            );
        }

        /*
         * Send the user to their investments page if it exists.
         */

        if (
            window.location.pathname.includes("investments.html")
        ) {

            /*
             * Keep the user on this page if there is no
             * my-investments page.
             */

            const hasMyInvestmentsPage =
                true;

            if (hasMyInvestmentsPage) {
                window.location.href =
                    "/my-investments.html";
            }
        }

    }, 700);

} catch (error) {

    console.error(
        "Investment error:",
        error
    );

    showMessage(
        error.message ||
        "Unable to submit investment request.",
        "error"
    );

} finally {

    setButtonsLoading(buttons, false);
}

}

/* =========================================================
BUTTON LOADING STATE
========================================================= */

function setButtonsLoading(buttons, loading) {

buttons.forEach(button => {

    if (loading) {

        if (!button.dataset.originalText) {
            button.dataset.originalText =
                button.innerHTML;
        }

        button.disabled = true;

        button.innerHTML =
            '<i class="fa-solid fa-spinner fa-spin"></i> Processing...';

    } else {

        button.disabled = false;

        if (button.dataset.originalText) {
            button.innerHTML =
                button.dataset.originalText;
        }
    }
});

}

/* =========================================================
MESSAGE
========================================================= */

function showMessage(message, type = "info") {

let messageBox =
    document.getElementById("investmentMessage");

/*
 * If the HTML does not already contain a message box,
 * create one automatically.
 */

if (!messageBox) {

    messageBox =
        document.createElement("div");

    messageBox.id =
        "investmentMessage";

    messageBox.style.margin =
        "20px 0";

    messageBox.style.padding =
        "14px 18px";

    messageBox.style.borderRadius =
        "12px";

    messageBox.style.fontWeight =
        "600";

    const container =
        document.querySelector(
            ".investments-container"
        ) ||
        document.querySelector(
            ".investment-container"
        ) ||
        document.querySelector(
            "main"
        ) ||
        document.body;

    container.prepend(messageBox);
}

messageBox.textContent =
    message;

messageBox.className =
    `investment-message ${type}`;

messageBox.style.display =
    "block";

if (type === "success") {

    messageBox.style.background =
        "rgba(0, 200, 120, 0.12)";

    messageBox.style.border =
        "1px solid rgba(0, 200, 120, 0.35)";

    messageBox.style.color =
        "#58e6a8";

} else if (type === "error") {

    messageBox.style.background =
        "rgba(255, 70, 90, 0.12)";

    messageBox.style.border =
        "1px solid rgba(255, 70, 90, 0.35)";

    messageBox.style.color =
        "#ff7b8a";

} else {

    messageBox.style.background =
        "rgba(140, 80, 255, 0.12)";

    messageBox.style.border =
        "1px solid rgba(140, 80, 255, 0.35)";

    messageBox.style.color =
        "#c9a7ff";
}

}

/* =========================================================
MONEY FORMAT
========================================================= */

function formatMoney(amount) {

const number =
    Number(amount);

if (!Number.isFinite(number)) {
    return "0";
}

return number.toLocaleString(
    "en-UG"
);

}

/* =========================================================
MOBILE MENU
========================================================= */

function setupMobileMenu() {

const menuToggle =
    document.getElementById("menuToggle");

const sidebar =
    document.querySelector(".sidebar");

const overlay =
    document.querySelector(".sidebar-overlay");

if (!menuToggle || !sidebar) {
    return;
}

menuToggle.addEventListener(
    "click",
    () => {

        sidebar.classList.toggle(
            "active"
        );

        if (overlay) {
            overlay.classList.toggle(
                "active"
            );
        }
    }
);

if (overlay) {

    overlay.addEventListener(
        "click",
        () => {

            sidebar.classList.remove(
                "active"
            );

            overlay.classList.remove(
                "active"
            );
        }
    );
}

const sidebarLinks =
    sidebar.querySelectorAll("a");

sidebarLinks.forEach(link => {

    link.addEventListener(
        "click",
        () => {

            sidebar.classList.remove(
                "active"
            );

            if (overlay) {
                overlay.classList.remove(
                    "active"
                );
            }
        }
    );
});

}

/* =========================================================
LOGOUT
========================================================= */

function setupLogout() {

const logoutButtons =
    document.querySelectorAll(
        "#logoutBtn, .logout-btn, [data-action='logout']"
    );

logoutButtons.forEach(button => {

    button.addEventListener(
        "click",
        async event => {

            event.preventDefault();

            try {

                await fetch(
                    `${API_URL}/logout.php`,
                    {
                        method: "POST",
                        credentials: "include",
                        headers: {
                            "Accept":
                                "application/json"
                        }
                    }
                );

            } catch (error) {

                console.error(
                    "Logout error:",
                    error
                );
            }

            localStorage.removeItem(
                "crownCashUser"
            );

            localStorage.removeItem(
                "currentUser"
            );

            window.location.href =
                "/login.html";
        }
    );
});

}

/* =========================================================
GLOBAL FUNCTIONS
========================================================= */

window.CrownCashInvestments = {

plans: PLANS,

invest: createInvestment,

confirm: confirmInvestment,

formatMoney: formatMoney

};

/*

* Compatibility function.
* 
* If your investments.html already has:
* 
* onclick="selectPlan('starter')"
* 
* this will still work.
  */

window.selectPlan = function(plan) {

if (!PLANS[plan]) {
    showMessage(
        "Invalid investment plan.",
        "error"
    );
    return;
}

confirmInvestment(plan);

};

/*

* Compatibility function for:
* 
* onclick="investNow('starter')"
  */

window.investNow = function(plan) {

if (!PLANS[plan]) {
    showMessage(
        "Invalid investment plan.",
        "error"
    );
    return;
}

confirmInvestment(plan);

};