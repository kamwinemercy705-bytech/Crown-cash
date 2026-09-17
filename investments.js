document.addEventListener("DOMContentLoaded", () => {

    const API_BASE =
        "https://crown-cash1.onrender.com";


    /* =========================================================
       MOBILE SIDEBAR
    ========================================================= */

    const menuToggle =
        document.getElementById("menuToggle");

    const sidebar =
        document.querySelector(".dashboard-sidebar");

    const sidebarOverlay =
        document.querySelector(".sidebar-overlay");


    function openSidebar() {

        if (sidebar) {
            sidebar.classList.add("open");
        }

        if (sidebarOverlay) {
            sidebarOverlay.classList.add("show");
        }
    }


    function closeSidebar() {

        if (sidebar) {
            sidebar.classList.remove("open");
        }

        if (sidebarOverlay) {
            sidebarOverlay.classList.remove("show");
        }
    }


    if (menuToggle) {

        menuToggle.addEventListener(
            "click",
            openSidebar
        );

    }


    if (sidebarOverlay) {

        sidebarOverlay.addEventListener(
            "click",
            closeSidebar
        );

    }


    /* =========================================================
       YEAR
    ========================================================= */

    const yearElement =
        document.getElementById("currentYear");

    if (yearElement) {

        yearElement.textContent =
            new Date().getFullYear();

    }


    /* =========================================================
       PLAN DATA
    ========================================================= */

    const plans = {

        "Starter Plan": {

            minimum: 10000,

            label: "UGX 10,000"

        },

        "Standard Plan": {

            minimum: 15000,

            label: "UGX 15,000"

        },

        "Advanced Plan": {

            minimum: 25000,

            label: "UGX 25,000"

        }

    };


    /* =========================================================
       FORMAT UGX
    ========================================================= */

    function formatUGX(amount) {

        return "UGX " +
            Number(amount).toLocaleString(
                "en-UG"
            );

    }


    /* =========================================================
       CREATE TEST INVESTMENT
    ========================================================= */

    window.createTestInvestment =
        async function(plan, amount) {

            if (!plans[plan]) {

                alert(
                    "Invalid investment plan."
                );

                return;

            }


            const minimum =
                plans[plan].minimum;


            amount =
                Number(amount);


            if (!Number.isFinite(amount)) {

                alert(
                    "Please enter a valid investment amount."
                );

                return;

            }


            if (!Number.isInteger(amount)) {

                alert(
                    "Investment amount must be a whole UGX amount."
                );

                return;

            }


            if (amount < minimum) {

                alert(
                    `${plan} requires a minimum investment of ${formatUGX(minimum)}.`
                );

                return;

            }


            const confirmed =
                confirm(

                    `You selected ${plan}.\n\n` +

                    `Investment amount: ${formatUGX(amount)}\n` +

                    `Minimum required: ${formatUGX(minimum)}\n\n` +

                    `Continue with this test investment?`

                );


            if (!confirmed) {

                return;

            }


            try {

                const response =
                    await fetch(
                        `${API_BASE}/create_investment.php`,
                        {

                            method: "POST",

                            credentials: "include",

                            headers: {

                                "Content-Type":
                                    "application/json"

                            },

                            body:
                                JSON.stringify({

                                    plan: plan,

                                    amount: amount

                                })

                        }
                    );


                const text =
                    await response.text();


                let data;


                try {

                    data =
                        JSON.parse(text);

                } catch (error) {

                    console.error(
                        "Invalid server response:",
                        text
                    );

                    alert(
                        "The investment server returned an invalid response."
                    );

                    return;

                }


                if (!response.ok ||
                    !data.success) {

                    alert(
                        data.message ||
                        "Unable to create investment."
                    );

                    return;

                }


                alert(

                    `${data.message}\n\n` +

                    `${data.investment.plan}\n` +

                    `${formatUGX(data.investment.amount)}\n\n` +

                    `Duration: ${data.investment.duration_days} days`

                );


                window.location.href =
                    "my-investments.html";


            } catch (error) {

                console.error(
                    "Investment error:",
                    error
                );


                alert(
                    "Unable to connect to the investment server. Please try again."
                );

            }

        };


    /* =========================================================
       PLAN BUTTONS
       Automatically connect buttons that contain:
       data-plan="Starter Plan"
       data-plan="Standard Plan"
       data-plan="Advanced Plan"
    ========================================================= */

    const planButtons =
        document.querySelectorAll(
            "[data-plan]"
        );


    planButtons.forEach(button => {

        button.addEventListener(
            "click",
            () => {

                const plan =
                    button.dataset.plan;


                if (!plans[plan]) {

                    return;

                }


                const amount =
                    plans[plan].minimum;


                createTestInvestment(
                    plan,
                    amount
                );

            }
        );

    });

});