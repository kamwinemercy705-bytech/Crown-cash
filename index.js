/* =========================================================
   CROWN CASH — INDEX PAGE JAVASCRIPT
   ========================================================= */

document.addEventListener("DOMContentLoaded", function () {

    /* =====================================================
       CURRENT YEAR
       ===================================================== */

    const yearElement = document.getElementById("currentYear");

    if (yearElement) {
        yearElement.textContent = new Date().getFullYear();
    }


    /* =====================================================
       MOBILE MENU
       ===================================================== */

    const mobileMenuBtn =
        document.getElementById("mobileMenuBtn");

    const mobileNav =
        document.getElementById("mobileNav");


    if (mobileMenuBtn && mobileNav) {

        mobileMenuBtn.addEventListener("click", function () {

            mobileNav.classList.toggle("open");

            if (mobileNav.classList.contains("open")) {
                mobileMenuBtn.textContent = "✕";
            } else {
                mobileMenuBtn.textContent = "☰";
            }

        });


        /* Close mobile menu after clicking a link */

        const mobileLinks =
            mobileNav.querySelectorAll("a");

        mobileLinks.forEach(function (link) {

            link.addEventListener("click", function () {

                mobileNav.classList.remove("open");

                mobileMenuBtn.textContent = "☰";

            });

        });

    }


    /* =====================================================
       CLOSE MOBILE MENU WHEN CLICKING OUTSIDE
       ===================================================== */

    document.addEventListener("click", function (event) {

        if (!mobileNav || !mobileMenuBtn) {
            return;
        }

        const clickedInsideMenu =
            mobileNav.contains(event.target);

        const clickedButton =
            mobileMenuBtn.contains(event.target);

        if (
            !clickedInsideMenu &&
            !clickedButton &&
            mobileNav.classList.contains("open")
        ) {

            mobileNav.classList.remove("open");

            mobileMenuBtn.textContent = "☰";

        }

    });


    /* =====================================================
       HEADER SCROLL EFFECT
       ===================================================== */

    const header =
        document.querySelector(".site-header");


    function updateHeader() {

        if (!header) {
            return;
        }

        if (window.scrollY > 30) {

            header.style.background =
                "rgba(7, 5, 13, 0.94)";

            header.style.boxShadow =
                "0 10px 35px rgba(0,0,0,0.30)";

        } else {

            header.style.background =
                "rgba(7, 5, 13, 0.78)";

            header.style.boxShadow =
                "none";

        }

    }


    window.addEventListener(
        "scroll",
        updateHeader,
        { passive: true }
    );

    updateHeader();


    /* =====================================================
       SMOOTH SCROLL FOR INTERNAL LINKS
       ===================================================== */

    const internalLinks =
        document.querySelectorAll(
            'a[href^="#"]'
        );


    internalLinks.forEach(function (link) {

        link.addEventListener("click", function (event) {

            const targetId =
                link.getAttribute("href");

            if (
                !targetId ||
                targetId === "#"
            ) {
                return;
            }


            const target =
                document.querySelector(targetId);


            if (target) {

                event.preventDefault();

                const headerHeight =
                    header
                        ? header.offsetHeight
                        : 0;

                const targetPosition =
                    target.getBoundingClientRect().top +
                    window.pageYOffset -
                    headerHeight -
                    15;


                window.scrollTo({

                    top: targetPosition,

                    behavior: "smooth"

                });

            }

        });

    });


    /* =====================================================
       ACTIVE NAVIGATION
       ===================================================== */

    const navLinks =
        document.querySelectorAll(
            ".main-nav a"
        );


    navLinks.forEach(function (link) {

        link.addEventListener("click", function () {

            navLinks.forEach(function (item) {

                item.classList.remove("active");

            });

            link.classList.add("active");

        });

    });


    /* =====================================================
       PREVENT DOUBLE CLICK ON BUTTONS
       ===================================================== */

    const actionButtons =
        document.querySelectorAll(
            ".primary-btn, .header-btn, .return-btn"
        );


    actionButtons.forEach(function (button) {

        button.addEventListener("click", function () {

            button.style.opacity = "0.85";

            setTimeout(function () {

                button.style.opacity = "1";

            }, 500);

        });

    });


    /* =====================================================
       CHECK LOGIN STATE
       ===================================================== */

    let storedUser = null;


    try {

        const savedUser =
            localStorage.getItem(
                "crowncash_user"
            );


        if (savedUser) {

            storedUser =
                JSON.parse(savedUser);

        }

    } catch (error) {

        console.warn(
            "Unable to read Crown Cash user data."
        );

    }


    /* =====================================================
       CHANGE GET STARTED EXPERIENCE
       ===================================================== */

    if (storedUser) {

        const registerLinks =
            document.querySelectorAll(
                'a[href="register.html"]'
            );


        registerLinks.forEach(function (link) {

            /*
             * Keep the homepage simple.
             * Existing users can still choose to
             * create another account if needed.
             */

            link.setAttribute(
                "href",
                "dashboard.html"
            );

            link.textContent =
                "Open Dashboard →";

        });

    }


    /* =====================================================
       CONSOLE MESSAGE
       ===================================================== */

    console.log(
        "Crown Cash homepage loaded successfully."
    );

});