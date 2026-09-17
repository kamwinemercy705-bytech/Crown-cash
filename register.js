/* =========================================================
   CROWN CASH — REGISTRATION
   register.js
   ========================================================= */

const API_URL = "https://crown-cash1.onrender.com";

document.addEventListener("DOMContentLoaded", () => {

    const form = document.getElementById("registerForm");
    const message = document.getElementById("formMessage");

    const firstNameInput = document.getElementById("firstName");
    const lastNameInput = document.getElementById("lastName");
    const phoneInput = document.getElementById("phone");
    const emailInput = document.getElementById("email");
    const passwordInput = document.getElementById("password");
    const confirmPasswordInput = document.getElementById("confirmPassword");
    const referralInput = document.getElementById("referralCode");
    const termsInput = document.getElementById("terms");

    /* ---------------------------------------------------------
       SHOW MESSAGE
    --------------------------------------------------------- */

    function showMessage(text, type = "error") {

        if (!message) return;

        message.textContent = text;
        message.className = `form-message ${type}`;
        message.style.display = "block";

        message.scrollIntoView({
            behavior: "smooth",
            block: "nearest"
        });
    }


    /* ---------------------------------------------------------
       GET REFERRAL CODE FROM URL
       
       Example:
       register.html?ref=CC123456
    --------------------------------------------------------- */

    const urlParams = new URLSearchParams(window.location.search);

    let referralFromURL = urlParams.get("ref");

    if (referralFromURL) {

        referralFromURL = referralFromURL.trim();

        // Save referral code temporarily
        sessionStorage.setItem(
            "crownCashReferralCode",
            referralFromURL
        );

        localStorage.setItem(
            "crownCashReferralCode",
            referralFromURL
        );
    }


    /* ---------------------------------------------------------
       LOAD SAVED REFERRAL CODE
    --------------------------------------------------------- */

    const savedReferral =
        referralFromURL ||
        sessionStorage.getItem("crownCashReferralCode") ||
        localStorage.getItem("crownCashReferralCode") ||
        "";


    if (referralInput && savedReferral) {

        referralInput.value = savedReferral;

        // Make it visually clear that the referral was detected
        referralInput.classList.add("referral-detected");
    }


    /* ---------------------------------------------------------
       PASSWORD SHOW / HIDE BUTTONS
    --------------------------------------------------------- */

    const passwordToggleButtons =
        document.querySelectorAll("[data-target]");

    passwordToggleButtons.forEach(button => {

        button.addEventListener("click", () => {

            const targetId =
                button.getAttribute("data-target");

            const target =
                document.getElementById(targetId);

            if (!target) return;

            if (target.type === "password") {

                target.type = "text";

                button.innerHTML =
                    '<i class="fa-solid fa-eye-slash"></i>';

            } else {

                target.type = "password";

                button.innerHTML =
                    '<i class="fa-solid fa-eye"></i>';
            }

        });

    });


    /* ---------------------------------------------------------
       PHONE NUMBER CLEANING
    --------------------------------------------------------- */

    if (phoneInput) {

        phoneInput.addEventListener("input", () => {

            let value = phoneInput.value;

            // Keep only numbers and +
            value = value.replace(/[^\d+]/g, "");

            // Only allow + at the beginning
            if (value.indexOf("+") > 0) {
                value =
                    value.replace(/\+/g, "");
            }

            phoneInput.value = value;
        });

    }


    /* ---------------------------------------------------------
       PASSWORD STRENGTH CHECK
    --------------------------------------------------------- */

    if (passwordInput) {

        passwordInput.addEventListener("input", () => {

            const password =
                passwordInput.value;

            if (password.length < 8) {

                passwordInput.setCustomValidity(
                    "Password must contain at least 8 characters."
                );

            } else {

                passwordInput.setCustomValidity("");
            }

        });

    }


    /* ---------------------------------------------------------
       CONFIRM PASSWORD CHECK
    --------------------------------------------------------- */

    if (confirmPasswordInput && passwordInput) {

        confirmPasswordInput.addEventListener("input", () => {

            if (
                confirmPasswordInput.value !==
                passwordInput.value
            ) {

                confirmPasswordInput.setCustomValidity(
                    "Passwords do not match."
                );

            } else {

                confirmPasswordInput.setCustomValidity("");
            }

        });

    }


    /* ---------------------------------------------------------
       FORM SUBMISSION
    --------------------------------------------------------- */

    if (!form) {

        console.error(
            "Crown Cash: registerForm was not found."
        );

        return;
    }


    form.addEventListener("submit", async (event) => {

        event.preventDefault();


        /* ---------------------------------------------
           CLEAR OLD MESSAGE
        --------------------------------------------- */

        if (message) {

            message.style.display = "none";
            message.textContent = "";
        }


        /* ---------------------------------------------
           GET FORM VALUES
        --------------------------------------------- */

        const firstName =
            firstNameInput?.value.trim() || "";

        const lastName =
            lastNameInput?.value.trim() || "";

        const phone =
            phoneInput?.value.trim() || "";

        const email =
            emailInput?.value.trim().toLowerCase() || "";

        const password =
            passwordInput?.value || "";

        const confirmPassword =
            confirmPasswordInput?.value || "";

        const referralCode =
            referralInput?.value.trim() ||
            savedReferral ||
            "";


        /* ---------------------------------------------
           BASIC VALIDATION
        --------------------------------------------- */

        if (!firstName) {

            showMessage(
                "Please enter your first name."
            );

            firstNameInput?.focus();

            return;
        }


        if (!lastName) {

            showMessage(
                "Please enter your last name."
            );

            lastNameInput?.focus();

            return;
        }


        if (!phone) {

            showMessage(
                "Please enter your phone number."
            );

            phoneInput?.focus();

            return;
        }


        if (!email) {

            showMessage(
                "Please enter your email address."
            );

            emailInput?.focus();

            return;
        }


        if (!password) {

            showMessage(
                "Please create a password."
            );

            passwordInput?.focus();

            return;
        }


        if (password.length < 8) {

            showMessage(
                "Password must contain at least 8 characters."
            );

            passwordInput?.focus();

            return;
        }


        if (password !== confirmPassword) {

            showMessage(
                "Passwords do not match."
            );

            confirmPasswordInput?.focus();

            return;
        }


        if (termsInput && !termsInput.checked) {

            showMessage(
                "Please accept the Terms & Conditions and Privacy Policy."
            );

            termsInput.focus();

            return;
        }


        /* ---------------------------------------------
           DISABLE SUBMIT BUTTON
        --------------------------------------------- */

        const submitButton =
            form.querySelector(
                'button[type="submit"], input[type="submit"]'
            );

        const originalButtonText =
            submitButton?.innerHTML || "";

        if (submitButton) {

            submitButton.disabled = true;

            submitButton.innerHTML =
                '<i class="fa-solid fa-spinner fa-spin"></i> Creating Account...';
        }


        try {

            /* -----------------------------------------
               SEND REGISTRATION DATA TO PHP BACKEND
            ----------------------------------------- */

            const response = await fetch(
                `${API_URL}/register.php`,
                {
                    method: "POST",

                    credentials: "include",

                    headers: {
                        "Content-Type": "application/json",
                        "Accept": "application/json"
                    },

                    body: JSON.stringify({

                        first_name: firstName,

                        last_name: lastName,

                        full_name:
                            `${firstName} ${lastName}`.trim(),

                        phone: phone,

                        email: email,

                        password: password,

                        confirm_password:
                            confirmPassword,

                        referral_code:
                            referralCode

                    })
                }
            );


            /* -----------------------------------------
               READ SERVER RESPONSE
            ----------------------------------------- */

            let data;

            try {

                data = await response.json();

            } catch (jsonError) {

                throw new Error(
                    "The registration server returned an invalid response."
                );
            }


            /* -----------------------------------------
               HANDLE FAILED REGISTRATION
            ----------------------------------------- */

            if (!response.ok || !data.success) {

                showMessage(
                    data.message ||
                    "Registration failed. Please try again."
                );

                return;
            }


            /* -----------------------------------------
               REGISTRATION SUCCESS
            ----------------------------------------- */

            showMessage(
                data.message ||
                "Account created successfully!",
                "success"
            );


            /* -----------------------------------------
               REMOVE USED REFERRAL CODE
            ----------------------------------------- */

            sessionStorage.removeItem(
                "crownCashReferralCode"
            );

            localStorage.removeItem(
                "crownCashReferralCode"
            );


            /* -----------------------------------------
               REDIRECT TO LOGIN
            ----------------------------------------- */

            setTimeout(() => {

                window.location.href =
                    "/login.html";

            }, 1800);


        } catch (error) {

            console.error(
                "Crown Cash registration error:",
                error
            );


            showMessage(
                "Unable to connect to the registration server. Please try again."
            );


        } finally {

            /* -----------------------------------------
               RESTORE BUTTON
            ----------------------------------------- */

            if (submitButton) {

                submitButton.disabled = false;

                submitButton.innerHTML =
                    originalButtonText ||
                    "Create Account";
            }

        }

    });

});

