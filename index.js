/* =========================================================
   CROWN CASH — INDEX PAGE JAVASCRIPT
   ========================================================= */

document.addEventListener("DOMContentLoaded", () => {

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

    const mobileMenuBtn = document.getElementById("mobileMenuBtn");
    const mobileNav = document.getElementById("mobileNav");

    if (mobileMenuBtn && mobileNav) {

        mobileMenuBtn.addEventListener("click", (event) => {

            event.stopPropagation();

            mobileNav.classList.toggle("open");

            const isOpen =
                mobileNav.classList.contains("open");

            mobileMenuBtn.setAttribute(
                "aria-expanded",
                isOpen ? "true" : "false"
            );

            mobileMenuBtn.innerHTML = isOpen
                ? `
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M6 6L18 18M18 6L6 18"/>
                    </svg>
                  `
                : `
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M4 7H20M4 12H20M4 17H20"/>
                    </svg>
                  `;

        });


        /* Close menu after selecting a link */

        const mobileLinks =
            mobileNav.querySelectorAll("a");

        mobileLinks.forEach((link) => {

            link.addEventListener("click", () => {

                mobileNav.classList.remove("open");

                mobileMenuBtn.setAttribute(
                    "aria-expanded",
                    "false"
                );

                mobileMenuBtn.innerHTML = `
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M4 7H20M4 12H20M4 17H20"/>
                    </svg>
                `;

            });

        });

    }


    /* =====================================================
       CLOSE MOBILE MENU WHEN CLICKING OUTSIDE
       ===================================================== */

    document.addEventListener("click", (event) => {

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

            mobileMenuBtn.setAttribute(
                "aria-expanded",
                "false"
            );

            mobileMenuBtn.innerHTML = `
                <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M4 7H20M4 12H20M4 17H20"/>
                </svg>
            `;

        }

    });


    /* =====================================================
       HEADER SCROLL EFFECT
       ===================================================== */

    const header =
        document.querySelector(".site-header");

    const updateHeader = () => {

        if (!header) {
            return;
        }

        if (window.scrollY > 30) {

            header.classList.add("scrolled");

        } else {

            header.classList.remove("scrolled");

        }

    };

    window.addEventListener(
        "scroll",
        updateHeader,
        { passive: true }
    );

    updateHeader();


    /* =====================================================
       SMOOTH SCROLL
       ===================================================== */

    const internalLinks =
        document.querySelectorAll(
            'a[href^="#"]'
        );

    internalLinks.forEach((link) => {

        link.addEventListener("click", (event) => {

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

            if (!target) {
                return;
            }

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

        });

    });


    /* =====================================================
       ACTIVE NAVIGATION
       ===================================================== */

    const navLinks =
        document.querySelectorAll(
            ".main-nav a"
        );

    navLinks.forEach((link) => {

        link.addEventListener("click", () => {

            navLinks.forEach((item) => {
                item.classList.remove("active");
            });

            link.classList.add("active");

        });

    });


    /* =====================================================
       BUTTON CLICK EFFECT
       ===================================================== */

    const actionButtons =
        document.querySelectorAll(
            ".primary-btn, .header-btn, .return-btn"
        );

    actionButtons.forEach((button) => {

        button.addEventListener("click", () => {

            button.classList.add("clicked");

            setTimeout(() => {
                button.classList.remove("clicked");
            }, 450);

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
       CHANGE GET STARTED LINKS FOR LOGGED-IN USERS
       ===================================================== */

    if (storedUser) {

        const registerLinks =
            document.querySelectorAll(
                'a[href="register.html"]'
            );

        registerLinks.forEach((link) => {

            link.setAttribute(
                "href",
                "dashboard.html"
            );

            link.textContent =
                "Open Dashboard";

        });

    }


    /* =====================================================
       LOGO HOVER EFFECT
       ===================================================== */

    const logo =
        document.querySelector(".brand-logo");

    if (logo) {

        logo.addEventListener("mouseenter", () => {
            logo.classList.add("logo-active");
        });

        logo.addEventListener("mouseleave", () => {
            logo.classList.remove("logo-active");
        });

    }


    /* =====================================================
       INTERSECTION ANIMATIONS
       ===================================================== */

    const animatedElements =
        document.querySelectorAll(
            ".feature-card, .step-card, .hero-card, .info-card"
        );

    if ("IntersectionObserver" in window) {

        const observer =
            new IntersectionObserver(
                (entries, observerInstance) => {

                    entries.forEach((entry) => {

                        if (entry.isIntersecting) {

                            entry.target.classList.add(
                                "visible"
                            );

                            observerInstance.unobserve(
                                entry.target
                            );

                        }

                    });

                },
                {
                    threshold: 0.12
                }
            );

        animatedElements.forEach((element) => {
            observer.observe(element);
        });

    }


    /* =====================================================
       ACCESSIBILITY — KEYBOARD MENU
       ===================================================== */

    document.addEventListener("keydown", (event) => {

        if (
            event.key === "Escape" &&
            mobileNav &&
            mobileNav.classList.contains("open")
        ) {

            mobileNav.classList.remove("open");

            mobileMenuBtn.setAttribute(
                "aria-expanded",
                "false"
            );

            mobileMenuBtn.innerHTML = `
                <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M4 7H20M4 12H20M4 17H20"/>
                </svg>
            `;

        }

    });


    /* =====================================================
       CROWN CASH READY
       ===================================================== */

    console.log(
        "Crown Cash homepage loaded successfully."
    );

});