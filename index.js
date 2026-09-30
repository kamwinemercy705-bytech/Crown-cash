/* ============================================================
   CROWN CASH - HOME PAGE
   File: index.js

   Handles:
   - Mobile navigation
   - Referral links
   - Referral-code preservation
   - Registration navigation
   - Current year
   ============================================================ */

"use strict";

document.addEventListener(
    "DOMContentLoaded",
    function () {

        /* ====================================================
           CURRENT YEAR
           ==================================================== */

        const yearElement =
            document.getElementById(
                "currentYear"
            );

        if (yearElement) {

            yearElement.textContent =
                new Date().getFullYear();
        }


        /* ====================================================
           MOBILE MENU
           ==================================================== */

        const mobileMenuBtn =
            document.getElementById(
                "mobileMenuBtn"
            );

        const mobileNav =
            document.getElementById(
                "mobileNav"
            );

        if (
            mobileMenuBtn &&
            mobileNav
        ) {

            mobileMenuBtn.addEventListener(
                "click",
                function () {

                    const isOpen =
                        mobileNav.classList.toggle(
                            "active"
                        );

                    mobileMenuBtn.setAttribute(
                        "aria-expanded",
                        isOpen
                            ? "true"
                            : "false"
                    );
                }
            );
        }


        /* ====================================================
           READ REFERRAL CODE FROM HOME PAGE

           Example:

           https://crown-cash.vercel.app/?ref=CC88D54467
           ==================================================== */

        const params =
            new URLSearchParams(
                window.location.search
            );

        const referralCode =
            params.get("ref");


        /* ====================================================
           CLEAN REFERRAL CODE
           ==================================================== */

        const cleanReferralCode =
            referralCode
                ? referralCode
                    .trim()
                    .toUpperCase()
                : "";


        /* ====================================================
           SAVE REFERRAL CODE
           ==================================================== */

        if (cleanReferralCode) {

            try {

                sessionStorage.setItem(
                    "crownCashReferralCode",
                    cleanReferralCode
                );

            } catch (error) {

                console.warn(
                    "Could not save referral code:",
                    error
                );
            }
        }


        /* ====================================================
           BUILD REGISTRATION URL
           ==================================================== */

        function getRegistrationURL() {

            if (cleanReferralCode) {

                return (
                    "register.html?ref=" +
                    encodeURIComponent(
                        cleanReferralCode
                    )
                );
            }

            return "register.html";
        }


        /* ====================================================
           UPDATE REGISTRATION LINKS
           ==================================================== */

        const registrationLinks =
            document.querySelectorAll(
                'a[href="register.html"], ' +
                'a[href="./register.html"], ' +
                'a[href="/register.html"]'
            );


        registrationLinks.forEach(
            function (link) {

                link.href =
                    getRegistrationURL();
            }
        );


        /* ====================================================
           CLOSE MOBILE MENU WHEN LINK IS CLICKED
           ==================================================== */

        if (mobileNav) {

            const mobileLinks =
                mobileNav.querySelectorAll(
                    "a"
                );

            mobileLinks.forEach(
                function (link) {

                    link.addEventListener(
                        "click",
                        function () {

                            mobileNav.classList.remove(
                                "active"
                            );

                            if (
                                mobileMenuBtn
                            ) {

                                mobileMenuBtn.setAttribute(
                                    "aria-expanded",
                                    "false"
                                );
                            }
                        }
                    );
                }
            );
        }

    }
);