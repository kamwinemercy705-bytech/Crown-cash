document.addEventListener("DOMContentLoaded", function () {

    const sidebar =
        document.getElementById("sidebar");

    const openSidebar =
        document.getElementById("openSidebar");

    const closeSidebar =
        document.getElementById("closeSidebar");

    const supportForm =
        document.getElementById("supportForm");

    const category =
        document.getElementById("category");

    const formMessage =
        document.getElementById("formMessage");


    /* SIDEBAR */

    openSidebar.addEventListener("click", function () {
        sidebar.classList.add("open");
    });


    closeSidebar.addEventListener("click", function () {
        sidebar.classList.remove("open");
    });


    /* SUPPORT CATEGORY BUTTONS */

    document.querySelectorAll(".support-select")
        .forEach(function (button) {

            button.addEventListener("click", function () {

                const selectedCategory =
                    button.dataset.category;

                const categoryMap = {

                    "General Support": "general",

                    "Deposits": "deposit",

                    "Withdrawals": "withdrawal",

                    "Referrals": "referral"

                };

                category.value =
                    categoryMap[selectedCategory] || "general";

                document
                    .getElementById("supportForm")
                    .scrollIntoView({
                        behavior: "smooth"
                    });

            });

        });


    /* FORM */

    supportForm.addEventListener("submit", function (event) {

        event.preventDefault();

        formMessage.textContent =
            "Your support request is ready. PHP backend connection will be added in the backend stage.";

        formMessage.classList.add("success");

    });


    /* FAQ */

    document.querySelectorAll(".faq-question")
        .forEach(function (question) {

            question.addEventListener("click", function () {

                const item =
                    question.parentElement;

                const answer =
                    item.querySelector(".faq-answer");

                const isOpen =
                    item.classList.contains("open");


                document
                    .querySelectorAll(".faq-item")
                    .forEach(function (faq) {

                        faq.classList.remove("open");

                    });


                if (!isOpen) {

                    item.classList.add("open");

                }

            });

        });


    /* YEAR */

    document.getElementById("year").textContent =
        new Date().getFullYear();

});