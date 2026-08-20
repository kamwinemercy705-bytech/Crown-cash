// =====================================================
// CROWN CASH — REGISTRATION JAVASCRIPT
// FRONTEND VALIDATION
// =====================================================


document.addEventListener("DOMContentLoaded", function () {


    const form =
        document.getElementById("registerForm");


    const message =
        document.getElementById("formMessage");


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

    form.addEventListener("submit", function (event) {

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
         * SUCCESS
         */

        if (valid) {

            message.style.color = "#3274e8";

            message.textContent =
                "Registration details are valid. Backend connection will be added next.";

            /*
             * IMPORTANT:
             *
             * We are NOT creating the real account here.
             *
             * Later this form will send the data to PHP:
             *
             * register.php
             *
             * which will safely store the user
             * inside MySQL.
             */

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