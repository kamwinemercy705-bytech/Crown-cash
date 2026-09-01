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


    if (openSidebar) {

        openSidebar.addEventListener(
            "click",
            function () {

                sidebar.classList.add("open");

            }
        );

    }


    if (closeSidebar) {

        closeSidebar.addEventListener(
            "click",
            function () {

                sidebar.classList.remove("open");

            }
        );

    }


    /* =========================
       YEAR
    ========================= */

    const year =
        document.getElementById("year");

    if (year) {

        year.textContent =
            new Date().getFullYear();

    }


    /* =========================
       LOAD INVESTMENTS
    ========================= */

    loadInvestments();

});


/*
|--------------------------------------------------------------------------
| LOAD USER INVESTMENTS
|--------------------------------------------------------------------------
*/

async function loadInvestments() {

    try {

        const response = await fetch(
            "https://crown-cash1.onrender.com/investments.php",
            {
                method: "GET",
                credentials: "include"
            }
        );


        const data =
            await response.json();


        if (!data.success) {

            console.error(
                data.message
            );

            return;
        }


        console.log(
            "User investments:",
            data.investments
        );


        /*
         * For now we display the results
         * in the browser console.
         *
         * We will connect them to a
         * My Investments page next.
         */

    } catch (error) {

        console.error(
            "Unable to load investments:",
            error
        );

    }

}


/*
|--------------------------------------------------------------------------
| CREATE TEST INVESTMENT
|--------------------------------------------------------------------------
*/

async function createTestInvestment(
    plan,
    amount
) {

    try {

        const response = await fetch(
            "https://crown-cash1.onrender.com/investments.php",
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


        if (!data.success) {

            alert(
                data.message ||
                "Unable to create test investment."
            );

            return;

        }


        alert(
            "Test investment created successfully."
        );


        console.log(
            "Test investment:",
            data.investment
        );


        /*
         * Reload investments after creation.
         */

        loadInvestments();


    } catch (error) {

        console.error(
            "Investment error:",
            error
        );

        alert(
            "Unable to connect to Crown Cash server."
        );

    }

}