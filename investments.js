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


                    
                        
                 async function createTestInvestment(plan, amount) {

    const confirmed = confirm(
        "Create a test investment?\n\n" +
        "Plan: " + plan + "\n" +
        "Amount: UGX " + Number(amount).toLocaleString() +
        "\n\nThis is a testing transaction only."
    );

    if (!confirmed) {
        return;
    }

    try {

        const response = await fetch(
            "https://crown-cash1.onrender.com/create_investment.php",
            {
                method: "POST",

                credentials: "include",

                headers: {
                    "Content-Type": "application/json"
                },

                body: JSON.stringify({
                    plan: plan,
                    amount: Number(amount)
                })
            }
        );

        /*
        ----------------------------------------------------------
        Read the server response as text first.
        This helps us see the real response if JSON parsing fails.
        ----------------------------------------------------------
        */

        const responseText = await response.text();

        console.log("HTTP status:", response.status);
        console.log("Server response:", responseText);

        let data;

        try {
            data = JSON.parse(responseText);
        } catch (jsonError) {

            alert(
                "Server returned an unexpected response.\n\n" +
                "HTTP Status: " + response.status +
                "\n\n" +
                responseText.substring(0, 500)
            );

            return;
        }


        /*
        ----------------------------------------------------------
        Check API response
        ----------------------------------------------------------
        */

        if (!response.ok || !data.success) {

            alert(
                data.message ||
                "Investment could not be created."
            );

            return;
        }


        /*
        ----------------------------------------------------------
        Success
        ----------------------------------------------------------
        */

        alert(
            "Test investment created successfully!\n\n" +

            "Plan: " +
            data.investment.plan +

            "\nAmount: UGX " +
            Number(
                data.investment.amount
            ).toLocaleString() +

            "\nStatus: " +
            data.investment.status
        );


        /*
        ----------------------------------------------------------
        Open My Investments
        ----------------------------------------------------------
        */

        window.location.href =
            "my-investments.html";


    } catch (error) {

        console.error(
            "Create investment error:",
            error
        );

        alert(
            "The browser could not complete the request.\n\n" +
            "Error: " +
            error.message
        );
    }
}

                 

                     

           