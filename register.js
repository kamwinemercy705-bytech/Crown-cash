// =====================================================
// CROWN CASH — REGISTRATION JAVASCRIPT
// FRONTEND VALIDATION + BACKEND CONNECTION
// =====================================================

document.addEventListener("DOMContentLoaded", function () {

    const form = document.getElementById("registerForm");
    const message = document.getElementById("formMessage");

    /*
     * PASSWORD VISIBILITY
     */

    const passwordButtons =
        document.querySelectorAll(".password-toggle");

    passwordButtons.forEach(function (button) {

        button.addEventListener("click", function () {

            const targetId =
                button.getAttribute("data-target");

            const input =
                document.getElementById(targetId);

            if (input.type === "password") {

                input.type = "text";
                button.textContent = "Hide";

            } else {

                input.type = "password";
                button.textContent = "Show";

            }

        });

    });


    /*
     * FORM SUBMISSION
     */

    form.addEventListener("submit", async function (event) {

        event.preventDefault();

        clearErrors();

        const firstName =
            document.getElementById("firstName").value.trim();

        const lastName =
            document.getElementById("lastName").value.trim();

        const phone =
            document.getElementById("phone").value.trim();

        const email =
            document.getElementById("email").value.trim();

        const password =
            document.getElementById("password").value;

        const confirmPassword =
            document.getElementById("confirmPassword").value;

        const referralCode =
            document.getElementById("referralCode").value.trim();

        const terms =
            document.getElementById("terms").checked;

        let valid = true;


        /*
         * FIRST NAME
         */

        if (firstName.length < 2) {

            showError(
                "firstNameError",
                "Please enter your first name."
            );

            valid = false;

        }


        /*
         * LAST NAME
         */

        if (lastName.length < 2) {

            showError(
                "lastNameError",
                "Please enter your last name."
            );

            valid = false;

        }


        /*
         * PHONE
         */

        const phonePattern =
            /^(?:\+256|0)\d{9}$/;

        if (!phonePattern.test(phone)) {

            showError(
                "phoneError",
                "Enter a valid Uganda phone number."
            );

            valid = false;

        }


        /*
         * EMAIL
         */

        const emailPattern =
            /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        if (!emailPattern.test(email)) {

            showError(
                "emailError",
                "Enter a valid email address."
            );

            valid = false;

        }


        /*
         * PASSWORD
         */

        if (password.length < 8) {

            showError(
                "passwordError",
                "Password must contain at least 8 characters."
            );

            valid = false;

        }


        /*
         * CONFIRM PASSWORD
         */

        if (password !== confirmPassword) {

            showError(
                "confirmPasswordError",
                "Passwords do not match."
            );

            valid = false;

        }


        /*
         * TERMS
         */

        if (!terms) {

            showError(
                "termsError",
                "You must accept the terms and privacy policy."
            );

            valid = false;

        }


        /*
         * STOP IF INVALID
         */

        if (!valid) {
            return;
        }


        /*
         * SEND REGISTRATION TO PHP
         */

        message.style.color = "#3274e8";
        message.textContent = "Creating your account...";

        const registrationData = {

            firstName: firstName,
            lastName: lastName,
            phone: phone,
            email: email,
            password: password,
            referralCode: referralCode

        };


        try {

            const response = await fetch("register.php", {

                method: "POST",

                headers: {
                    "Content-Type": "application/json"
                },

                body: JSON.stringify(registrationData)

            });


            const data = await response.json();


            /*
             * SUCCESS
             */

            if (response.ok && data.success) {

                message.style.color = "#28a745";

                message.textContent =
                    "Account created successfully. Redirecting to login...";

                form.reset();


                setTimeout(function () {

                    window.location.href = "login.html";

                }, 1500);

                return;
            }


            /*
             * SERVER ERROR
             */

            message.style.color = "#dc3545";

            message.textContent =
                data.message || "Registration failed.";

        }


        catch (error) {

            console.error(
                "Registration error:",
                error
            );

            message.style.color = "#dc3545";

            message.textContent =
                "Unable to connect to the registration server. Please try again.";

        }

    });


    /*
     * ERROR FUNCTION
     */

    function showError(id, text) {

        const element =
            document.getElementById(id);

        if (element) {

            element.textContent = text;

        }

    }


    /*
     * CLEAR ERRORS
     */

    function clearErrors() {

        const errors =
            document.querySelectorAll(".error-message");

        errors.forEach(function (error) {

            error.textContent = "";

        });

        message.textContent = "";

    }


    /*
     * CURRENT YEAR
     */

    const year =
        document.getElementById("year");

    if (year) {

        year.textContent =
            new Date().getFullYear();

    }

});