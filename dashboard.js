/* =========================================================
   CROWN CASH — DASHBOARD JS
========================================================= */

document.addEventListener("DOMContentLoaded", function () {

    /* =====================================================
       SIDEBAR
    ===================================================== */

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


    document.addEventListener(
        "click",
        function (event) {

            if (
                window.innerWidth <= 950 &&
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



    /* =====================================================
       CURRENT YEAR
    ===================================================== */

    const year =
        document.getElementById("year");

    if (year) {

        year.textContent =
            new Date().getFullYear();

    }



    /* =====================================================
       LOAD USER INFORMATION
    ===================================================== */

    loadUserData();



    /* =====================================================
       DAILY RETURN CALCULATOR
    ===================================================== */

    setupReturnCalculator();

});



/* =========================================================
   USER DATA
========================================================= */

function loadUserData() {

    const storedUser =
        localStorage.getItem("crowncash_user");


    if (!storedUser) {

        return;

    }


    try {

        const user =
            JSON.parse(storedUser);


        const firstName =
            user.firstName ||
            user.firstname ||
            "";


        const lastName =
            user.lastName ||
            user.lastname ||
            "";


        const fullName =
            (
                firstName +
                " " +
                lastName
            ).trim();


        const displayName =
            fullName ||
            user.name ||
            "Member";


        const welcomeName =
            document.getElementById(
                "welcomeName"
            );


        const topUserName =
            document.getElementById(
                "topUserName"
            );


        const avatar =
            document.getElementById(
                "avatar"
            );


        if (welcomeName) {

            welcomeName.textContent =
                firstName ||
                displayName;

        }


        if (topUserName) {

            topUserName.textContent =
                displayName;

        }


        if (avatar) {

            avatar.textContent =
                displayName
                    .charAt(0)
                    .toUpperCase();

        }


        /* BALANCE */

        const balance =
            Number(
                user.balance || 0
            );


        const balanceElement =
            document.getElementById(
                "balance"
            );


        if (balanceElement) {

            balanceElement.textContent =
                "UGX " +
                balance.toLocaleString();

        }


        /* REFERRALS */

        const referralCount =
            Number(
                user.referralCount ||
                user.referrals ||
                0
            );


        const referralElement =
            document.getElementById(
                "referralCount"
            );


        if (referralElement) {

            referralElement.textContent =
                referralCount.toLocaleString();

        }


        /* INVESTMENT COUNT */

        const investmentCount =
            Number(
                user.investmentCount ||
                0
            );


        const investmentElement =
            document.getElementById(
                "investmentCount"
            );


        if (investmentElement) {

            investmentElement.textContent =
                investmentCount.toLocaleString();

        }


    } catch (error) {

        console.error(
            "Could not load Crown Cash user data:",
            error
        );

    }

}



/* =========================================================
   DAILY RETURN CALCULATOR
========================================================= */

function setupReturnCalculator() {

    const input =
        document.getElementById(
            "investmentAmount"
        );


    const result =
        document.getElementById(
            "dailyReturnAmount"
        );


    const chips =
        document.querySelectorAll(
            ".amount-chip"
        );


    if (!input || !result) {

        return;

    }


    /* -----------------------------------------------------
       Calculate 10%
    ----------------------------------------------------- */

    function calculateReturn() {

        let amount =
            Number(
                input.value
            );


        /* Minimum investment preview */

        if (
            !Number.isFinite(amount) ||
            amount < 10000
        ) {

            amount = 10000;

        }


        const dailyReturn =
            amount * 0.10;


        result.textContent =
            "UGX " +
            dailyReturn.toLocaleString(
                undefined,
                {
                    maximumFractionDigits: 0
                }
            );

    }



    /* -----------------------------------------------------
       Input
    ----------------------------------------------------- */

    input.addEventListener(
        "input",
        function () {

            updateActiveChip();

            calculateReturn();

        }
    );



    /* -----------------------------------------------------
       Quick amount buttons
    ----------------------------------------------------- */

    chips.forEach(
        function (chip) {

            chip.addEventListener(
                "click",
                function () {

                    const amount =
                        Number(
                            chip.dataset.amount
                        );


                    input.value =
                        amount;


                    chips.forEach(
                        function (item) {

                            item.classList.remove(
                                "active"
                            );

                        }
                    );


                    chip.classList.add(
                        "active"
                    );


                    calculateReturn();

                }
            );

        }
    );



    /* -----------------------------------------------------
       Keep correct chip active
    ----------------------------------------------------- */

    function updateActiveChip() {

        const currentAmount =
            Number(
                input.value
            );


        chips.forEach(
            function (chip) {

                const chipAmount =
                    Number(
                        chip.dataset.amount
                    );


                if (
                    chipAmount ===
                    currentAmount
                ) {

                    chip.classList.add(
                        "active"
                    );

                } else {

                    chip.classList.remove(
                        "active"
                    );

                }

            }
        );

    }



    /* Initial calculation */

    calculateReturn();

}