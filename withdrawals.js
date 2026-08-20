document.addEventListener("DOMContentLoaded", function () {

    const sidebar =
        document.getElementById("sidebar");

    const openSidebar =
        document.getElementById("openSidebar");

    const closeSidebar =
        document.getElementById("closeSidebar");

    const withdrawalForm =
        document.getElementById("withdrawalForm");


    /* OPEN SIDEBAR */

    if (openSidebar) {

        openSidebar.addEventListener("click", function () {

            sidebar.classList.add("open");

        });

    }


    /* CLOSE SIDEBAR */

    if (closeSidebar) {

        closeSidebar.addEventListener("click", function () {

            sidebar.classList.remove("open");

        });

    }


    /* CLOSE WHEN CLICKING OUTSIDE */

    document.addEventListener("click", function (event) {

        if (
            window.innerWidth <= 900 &&
            sidebar.classList.contains("open") &&
            !sidebar.contains(event.target) &&
            !openSidebar.contains(event.target)
        ) {

            sidebar.classList.remove("open");

        }

    });


    /* WITHDRAWAL FORM */

    if (withdrawalForm) {

        withdrawalForm.addEventListener(
            "submit",
            function (event) {

                event.preventDefault();


                const amount =
                    document.getElementById("amount").value;

                const network =
                    document.getElementById("network").value;

                const phone =
                    document.getElementById("phone").value;


                if (!amount || !network || !phone) {

                    alert(
                        "Please complete all withdrawal fields."
                    );

                    return;

                }


                if (phone.length < 9) {

                    alert(
                        "Please enter a valid Mobile Money number."
                    );

                    return;

                }


                alert(
                    "Withdrawal request interface is ready. Backend verification and authorized payout processing will be connected later."
                );

            }
        );

    }


    /* YEAR */

    const year =
        document.getElementById("year");

    if (year) {

        year.textContent =
            new Date().getFullYear();

    }

});