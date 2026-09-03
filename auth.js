/* =========================================================
   CROWN CASH
   AUTHENTICATION JAVASCRIPT
========================================================= */

document.addEventListener("DOMContentLoaded", function () {


    /* =====================================================
       YEAR
    ===================================================== */

    const year = new Date().getFullYear();

    const brandYear =
        document.getElementById("brandYear");

    const registerBrandYear =
        document.getElementById("registerBrandYear");

    if (brandYear) {
        brandYear.textContent = year;
    }

    if (registerBrandYear) {
        registerBrandYear.textContent = year;
    }



    /* =====================================================
       PASSWORD SHOW / HIDE
    ===================================================== */

    document
        .querySelectorAll(".password-toggle")
        .forEach(function (button) {

            button.addEventListener(
                "click",
                function () {

                    let targetId =
                        button.dataset.target;

                    if (!targetId) {

                        targetId =
                            "password";

                    }

                    const input =
                        document.getElementById(
                            targetId
                        );

                    if (!input) {
                        return;
                    }


                    if (
                        input.type === "password"
                    ) {

                        input.type = "text";

                        button.classList.add(
                            "show"
                        );

                        button.setAttribute(
                            "aria-label",
                            "Hide password"
                        );

                    } else {

                        input.type = "password";

                        button.classList.remove(
                            "show"
                        );

                        button.setAttribute(
                            "aria-label",
                            "Show password"
                        );

                    }

                }
            );

        });



    /* =====================================================
       LOGIN PASSWORD TOGGLE
    ===================================================== */

    const loginPasswordToggle =
        document.getElementById(
            "passwordToggle"
        );

    if (loginPasswordToggle) {

        loginPasswordToggle.dataset.target =
            "password";

    }



    /* =====================================================
       PASSWORD STRENGTH
    ===================================================== */

    const registerPassword =
        document.getElementById(
            "registerPassword"
        );

    const strengthBar =
        document.getElementById(
            "strengthBar"
        );

    const passwordHint =
        document.getElementById(
            "passwordHint"
        );


    if (
        registerPassword &&
        strengthBar
    ) {

        registerPassword.addEventListener(
            "input",
            function () {

                const password =
                    registerPassword.value;

                let strength = 0;


                if (password.length >= 8) {
                    strength++;
                }

                if (/[A-Z]/.test(password)) {
                    strength++;
                }

                if (/[0-9]/.test(password)) {
                    strength++;
                }

                if (
                    /[^A-Za-z0-9]/.test(password)
                ) {
                    strength++;
                }


                if (strength === 0) {

                    strengthBar.style.width =
                        "0%";

                    if (passwordHint) {
                        passwordHint.textContent =
                            "Use at least 8 characters.";
                    }

                }

                else if (strength === 1) {

                    strengthBar.style.width =
                        "25%";

                    if (passwordHint) {
                        passwordHint.textContent =
                            "Weak password.";
                    }

                }

                else if (strength === 2) {

                    strengthBar.style.width =
                        "50%";

                    if (passwordHint) {
                        passwordHint.textContent =
                            "Fair password.";
                    }

                }

                else if (strength === 3) {

                    strengthBar.style.width =
                        "75%";

                    if (passwordHint) {
                        passwordHint.textContent =
                            "Good password.";
                    }

                }

                else {

                    strengthBar.style.width =
                        "100%";

                    if (passwordHint) {
                        passwordHint.textContent =
                            "Strong password.";
                    }

                }

            }
        );

    }



    /* =====================================================
       LOGIN FORM
    ===================================================== */

    const loginForm =
        document.getElementById(
            "loginForm"
        );


    if (loginForm) {

        loginForm.addEventListener(
            "submit",
            async function (event) {

                event.preventDefault();


                const email =
                    document.getElementById(
                        "email"
                    ).value.trim();

                const password =
                    document.getElementById(
                        "password"
                    ).value;

                const message =
                    document.getElementById(
                        "loginMessage"
                    );

                const button =
                    document.getElementById(
                        "loginButton"
                    );


                clearErrors();


                if (!email) {

                    showError(
                        "emailError",
                        "Please enter your email address."
                    );

                    return;

                }


                if (!isValidEmail(email)) {

                    showError(
                        "emailError",
                        "Please enter a valid email address."
                    );

                    return;

                }


                if (!password) {

                    showError(
                        "passwordError",
                        "Please enter your password."
                    );

                    return;

                }


                setMessage(
                    message,
                    "",
                    ""
                );


                button.classList.add(
                    "loading"
                );


                try {

                    const response =
                        await fetch(
                            "https://crown-cash1.onrender.com/login.php",
                            {
                                method: "POST",

                                credentials: "include",

                                headers: {
                                    "Content-Type":
                                        "application/json"
                                },

                                body:
                                    JSON.stringify({
                                        email:
                                            email.toLowerCase(),
                                        password:
                                            password
                                    })
                            }
                        );


                    const result =
                        await response.json();


                    if (
                        !response.ok ||
                        !result.success
                    ) {

                        throw new Error(
                            result.message ||
                            "Login failed."
                        );

                    }


                    /* Save user information */

                    if (result.user) {

                        localStorage.setItem(
                            "crowncash_user",
                            JSON.stringify(
                                result.user
                            )
                        );

                    }


                    setMessage(
                        message,
                        "Login successful. Redirecting...",
                        "success"
                    );


                    setTimeout(
                        function () {

                            window.location.href =
                                "dashboard.html";

                        },
                        700
                    );


                } catch (error) {

                    console.error(
                        "Login error:",
                        error
                    );


                    setMessage(
                        message,
                        error.message ||
                        "Unable to sign in. Please try again.",
                        "error"
                    );


                } finally {

                    button.classList.remove(
                        "loading"
                    );

                }

            }
        );

    }



    /* =====================================================
       REGISTER FORM
    ===================================================== */

    const registerForm =
        document.getElementById(
            "registerForm"
        );


    if (registerForm) {

        registerForm.addEventListener(
            "submit",
            async function (event) {

                event.preventDefault();


                clearErrors();


                const firstName =
                    document.getElementById(
                        "firstName"
                    ).value.trim();

                const lastName =
                    document.getElementById(
                        "lastName"
                    ).value.trim();

                const email =
                    document.getElementById(
                        "registerEmail"
                    ).value.trim();

                const phone =
                    document.getElementById(
                        "phone"
                    ).value.trim();

                const password =
                    document.getElementById(
                        "registerPassword"
                    ).value;

                const confirmPassword =
                    document.getElementById(
                        "confirmPassword"
                    ).value;

                const referralCode =
                    document.getElementById(
                        "referralCode"
                    ).value.trim();

                const agreeTerms =
                    document.getElementById(
                        "agreeTerms"
                    ).checked;

                const message =
                    document.getElementById(
                        "registerMessage"
                    );

                const button =
                    document.getElementById(
                        "registerButton"
                    );


                /* -----------------------------------------
                   VALIDATION
                ----------------------------------------- */

                let valid = true;


                if (!firstName) {

                    showError(
                        "firstNameError",
                        "First name is required."
                    );

                    valid = false;

                }


                if (!lastName) {

                    showError(
                        "lastNameError",
                        "Last name is required."
                    );

                    valid = false;

                }


                if (!email) {

                    showError(
                        "registerEmailError",
                        "Email address is required."
                    );

                    valid = false;

                } else if (
                    !isValidEmail(email)
                ) {

                    showError(
                        "registerEmailError",
                        "Enter a valid email address."
                    );

                    valid = false;

                }


                if (!phone) {

                    showError(
                        "phoneError",
                        "Phone number is required."
                    );

                    valid = false;

                }


                if (password.length < 8) {

                    showError(
                        "registerPasswordError",
                        "Password must contain at least 8 characters."
                    );

                    valid = false;

                }


                if (
                    password !== confirmPassword
                ) {

                    showError(
                        "confirmPasswordError",
                        "Passwords do not match."
                    );

                    valid = false;

                }


                if (!agreeTerms) {

                    setMessage(
                        message,
                        "Please accept the Terms & Conditions and Privacy Policy.",
                        "error"
                    );

                    valid = false;

                }


                if (!valid) {
                    return;
                }


                button.classList.add(
                    "loading"
                );


                try {

                    /*
                     * IMPORTANT:
                     * Change this URL only if your
                     * registration backend has a
                     * different filename.
                     */

                    const response =
                        await fetch(
                            "https://crown-cash1.onrender.com/register.php",
                            {
                                method: "POST",

                                credentials: "include",

                                headers: {
                                    "Content-Type":
                                        "application/json"
                                },

                                body:
                                    JSON.stringify({

                                        firstName:
                                            firstName,

                                        lastName:
                                            lastName,

                                        email:
                                            email.toLowerCase(),

                                        phone:
                                            phone,

                                        password:
                                            password,

                                        referralCode:
                                            referralCode

                                    })
                            }
                        );


                    const result =
                        await response.json();


                    if (
                        !response.ok ||
                        !result.success
                    ) {

                        throw new Error(
                            result.message ||
                            "Registration failed."
                        );

                    }


                    setMessage(
                        message,
                        "Account created successfully. Redirecting to sign in...",
                        "success"
                    );


                    setTimeout(
                        function () {

                            window.location.href =
                                "login.html";

                        },
                        1000
                    );


                } catch (error) {

                    console.error(
                        "Registration error:",
                        error
                    );


                    setMessage(
                        message,
                        error.message ||
                        "Unable to create account.",
                        "error"
                    );


                } finally {

                    button.classList.remove(
                        "loading"
                    );

                }

            }
        );

    }



    /* =====================================================
       FORGOT PASSWORD
    ===================================================== */

    const forgotPassword =
        document.getElementById(
            "forgotPassword"
        );


    if (forgotPassword) {

        forgotPassword.addEventListener(
            "click",
            function (event) {

                event.preventDefault();

                alert(
                    "Password reset will be available after the password recovery system is connected."
                );

            }
        );

    }



    /* =====================================================
       HELPER FUNCTIONS
    ===================================================== */

    function isValidEmail(email) {

        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/
            .test(email);

    }


    function showError(
        elementId,
        text
    ) {

        const element =
            document.getElementById(
                elementId
            );

        if (element) {
            element.textContent = text;
        }

    }


    function clearErrors() {

        document
            .querySelectorAll(".field-error")
            .forEach(function (element) {

                element.textContent = "";

            });

    }


    function setMessage(
        element,
        text,
        type
    ) {

        if (!element) {
            return;
        }

        element.textContent = text;

        element.className =
            "auth-message";

        if (text) {

            element.classList.add(
                "show"
            );

        }

        if (type) {

            element.classList.add(
                type
            );

        }

    }

});