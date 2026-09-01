document.addEventListener("DOMContentLoaded", function () {

    /* =========================
       SIDEBAR
    ========================= */

    const sidebar =
        document.getElementById("sidebar");

    const openSidebar =
        document.getElementById("openSidebar");

    const closeSidebar =
        document.getElementById("closeSidebar");


    if (openSidebar && sidebar) {

        openSidebar.addEventListener(
            "click",
            function () {

                sidebar.classList.add("open");

            }
        );

    }


    if (closeSidebar && sidebar) {

        closeSidebar.addEventListener(
            "click",
            function () {

                sidebar.classList.remove("open");

            }
        );

    }


    /* =========================
       MOBILE SIDEBAR
    ========================= */

    document.addEventListener(
        "click",
        function (event) {

            if (
                window.innerWidth <= 900 &&
                sidebar &&
                sidebar.classList.contains("open") &&
                !sidebar.contains(event.target) &&
                openSidebar &&
                !openSidebar.contains(event.target)
            ) {

                sidebar.classList.remove("open");

            }

        }
    );


    /* =========================
       YEAR
    ========================= */

    const year =
        document.getElementById("year");

    if (year) {

        year.textContent =
            new Date().getFullYear();

    }

});


/* =========================
   CREATE TEST INVESTMENT
========================= */

async function createTestInvestment(
    plan,
    amount
) {

    const confirmed =
        confirm(
            "Create a test investment?\n\n" +
            "Plan: " + plan + "\n" +
            "Amount: UGX " +
            Number(amount).toLocaleString() +
            "\n\n" +
            "This is a testing transaction only."
        );


    if (!confirmed) {

        return;

    }


    try {

        const response =
            await fetch(
                "https://crown-cash1.onrender.com/create-investment.php",
                {
                    method: "POST",

                    credentials: "include",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body: JSON.stringify({

                        plan: plan,

                        amount: amount

                    })
                }
            );


        const data =
            await response.json();


        console.log(
            "Investment response:",
            data
        );


        if (!response.ok || !data.success) {

            alert(
                data.message ||
                "Investment could not be created."
            );

            return;

        }


        alert(
            "Test investment created successfully!\n\n" +
            "Plan: " +
            data.investment.plan +
            "\n" +
            "Amount: UGX " +
            Number(
                data.investment.amount
            ).toLocaleString() +
            "\n" +
            "Status: " +
            data.investment.status
        );


        /*
         * Go to My Investments after success.
         *
         * Change this filename if your page
         * uses a different name.
         */

        window.location.href =
            "my-investments.html";


    } catch (error) {

        console.error(
            "Create investment error:",
            error
        );


        alert(
            "Unable to connect to Crown Cash server. " +
            "Please try again."
        );

    }

}