document.addEventListener("DOMContentLoaded", function () {

    const sidebar =
        document.getElementById("sidebar");

    const openSidebar =
        document.getElementById("openSidebar");

    const closeSidebar =
        document.getElementById("closeSidebar");

    const copyButton =
        document.getElementById("copyButton");

    const referralLink =
        document.getElementById("referralLink");

    const copyMessage =
        document.getElementById("copyMessage");


    if (openSidebar) {

        openSidebar.addEventListener("click", function () {

            sidebar.classList.add("open");

        });

    }


    if (closeSidebar) {

        closeSidebar.addEventListener("click", function () {

            sidebar.classList.remove("open");

        });

    }


    if (copyButton) {

        copyButton.addEventListener("click", async function () {

            try {

                await navigator.clipboard.writeText(
                    referralLink.value
                );

                copyMessage.textContent =
                    "Referral link copied successfully.";

                copyButton.textContent =
                    "Copied";

                setTimeout(function () {

                    copyButton.textContent =
                        "Copy Link";

                    copyMessage.textContent =
                        "";

                }, 2500);

            } catch (error) {

                referralLink.select();

                document.execCommand("copy");

                copyMessage.textContent =
                    "Referral link copied.";

            }

        });

    }


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


    const year =
        document.getElementById("year");

    if (year) {

        year.textContent =
            new Date().getFullYear();

    }

});