// ============================================================
// CROWN CASH - LOGIN JAVASCRIPT
// File: login.js
// ============================================================

"use strict";

// Crown Cash backend
const API_URL = "https://crown-cash1.onrender.com";

// ------------------------------------------------------------
// Elements
// ------------------------------------------------------------

const loginForm =
    document.getElementById("loginForm");

const formMessage =
    document.getElementById("formMessage");

const passwordToggleButtons =
    document.querySelectorAll("[data-target]");


// ------------------------------------------------------------
// Show message
// ------------------------------------------------------------

function showMessage(message, type = "error") {

    if (!formMessage) {
        alert(message);
        return;
    }

    formMessage.textContent = message;

    formMessage.className =
        "form-message " + type;

    formMessage.style.display = "block";
}


// ------------------------------------------------------------
// Clear message
// ------------------------------------------------------------

function clearMessage() {

    if (!formMessage) {
        return;
    }

    formMessage.textContent = "";

    formMessage.className =
        "form-message";

    formMessage.style.display = "none";
}


// ------------------------------------------------------------
// Button loading state
// ------------------------------------------------------------

function setLoading(isLoading) {

    if (!loginForm) {
        return;
    }

    const button =
        loginForm.querySelector(
            'button[type="submit"]'
        );

    if (!button) {
        return;
    }

    if (isLoading) {

        button.disabled = true;

        button.dataset.originalText =
            button.innerHTML;

        button.innerHTML =
            '<i class="fa-solid fa-spinner fa-spin"></i> Signing In...';

    } else {

        button.disabled = false;

        button.innerHTML =
            button.dataset.originalText ||
            '<span>Login</span><i class="fa-solid fa-arrow-right"></i>';
    }
}


// ------------------------------------------------------------
// Password visibility
// ------------------------------------------------------------

passwordToggleButtons.forEach(button => {

    button.addEventListener(
        "click",
        function () {

            const targetId =
                this.getAttribute(
                    "data-target"
                );

            const passwordInput =
                document.getElementById(
                    targetId
                );

            if (!passwordInput) {
                return;
            }

            const icon =
                this.querySelector("i");

            if (
                passwordInput.type ===
                "password"
            ) {

                passwordInput.type =
                    "text";

                this.setAttribute(
                    "aria-label",
                    "Hide password"
                );

                if (icon) {

                    icon.classList.remove(
                        "fa-eye"
                    );

                    icon.classList.add(
                        "fa-eye-slash"
                    );
                }

            } else {

                passwordInput.type =
                    "password";

                this.setAttribute(
                    "aria-label",
                    "Show password"
                );

                if (icon) {

                    icon.classList.remove(
                        "fa-eye-slash"
                    );

                    icon.classList.add(
                        "fa-eye"
                    );
                }
            }
        }
    );

});


// ------------------------------------------------------------
// Validate email
// ------------------------------------------------------------

function isValidEmail(email) {

    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        .test(email);
}


// ------------------------------------------------------------
// Login form
// ------------------------------------------------------------

if (loginForm) {

    loginForm.addEventListener(
        "submit",
        async function (event) {

            event.preventDefault();

            clearMessage();

            // ------------------------------------------------
            // Inputs
            // ------------------------------------------------

            const emailInput =
                document.getElementById(
                    "email"
                );

            const passwordInput =
                document.getElementById(
                    "password"
                );

            const rememberInput =
                document.getElementById(
                    "remember"
                );


            // ------------------------------------------------
            // Values
            // ------------------------------------------------

            const email =
                emailInput
                    ? emailInput.value
                        .trim()
                        .toLowerCase()
                    : "";

            const password =
                passwordInput
                    ? passwordInput.value
                    : "";

            const remember =
                rememberInput
                    ? rememberInput.checked
                    : false;


            // ------------------------------------------------
            // Validate email
            // ------------------------------------------------

            if (!isValidEmail(email)) {

                showMessage(
                    "Please enter a valid email address."
                );

                if (emailInput) {
                    emailInput.focus();
                }

                return;
            }


            // ------------------------------------------------
            // Validate password
            // ------------------------------------------------

            if (password === "") {

                showMessage(
                    "Please enter your password."
                );

                if (passwordInput) {
                    passwordInput.focus();
                }

                return;
            }


            // ------------------------------------------------
            // Save email if Remember Me is selected
            // ------------------------------------------------

            try {

                if (remember) {

                    localStorage.setItem(
                        "crownCashRememberedEmail",
                        email
                    );

                } else {

                    localStorage.removeItem(
                        "crownCashRememberedEmail"
                    );
                }

            } catch (storageError) {

                console.warn(
                    "Local storage unavailable.",
                    storageError
                );
            }


            // ------------------------------------------------
            // Loading
            // ------------------------------------------------

            setLoading(true);


            try {

                // ------------------------------------------------
                // Send login request
                // ------------------------------------------------

                const response =
                    await fetch(
                        `${API_URL}/login.php`,
                        {
                            method: "POST",

                            credentials: "include",

                            headers: {
                                "Content-Type":
                                    "application/json"
                            },

                            body: JSON.stringify({

                                email: email,

                                password: password

                            })
                        }
                    );


                // ------------------------------------------------
                // Read response
                // ------------------------------------------------

                let data = null;

                try {

                    data =
                        await response.json();

                } catch (jsonError) {

                    console.error(
                        "Invalid server response.",
                        jsonError
                    );
                }


                // ------------------------------------------------
                // Failed login
                // ------------------------------------------------

                if (
                    !response.ok ||
                    !data ||
                    data.success !== true
                ) {

                    let message =
                        "Invalid email or password.";

                    if (
                        data &&
                        data.message
                    ) {

                        message =
                            data.message;
                    }

                    showMessage(
                        message,
                        "error"
                    );

                    return;
                }


                // ------------------------------------------------
                // Successful login
                // ------------------------------------------------

                showMessage(
                    "Login successful! Redirecting...",
                    "success"
                );


                // ------------------------------------------------
                // Save user information
                // ------------------------------------------------

                if (data.user) {

                    try {

                        localStorage.setItem(
                            "crownCashUser",
                            JSON.stringify(
                                data.user
                            )
                        );

                    } catch (storageError) {

                        console.warn(
                            "Could not save user data.",
                            storageError
                        );
                    }
                }


                // ------------------------------------------------
                // Small delay before redirect
                // ------------------------------------------------

                setTimeout(
                    function () {

                        window.location.href =
                            "/dashboard.html";

                    },
                    800
                );


            } catch (error) {

                console.error(
                    "Login request failed:",
                    error
                );

                showMessage(
                    "Unable to connect to the Crown Cash server. Please check your internet connection and try again.",
                    "error"
                );

            } finally {

                setLoading(false);
            }

        }
    );

}


// ------------------------------------------------------------
// Load remembered email
// ------------------------------------------------------------

try {

    const rememberedEmail =
        localStorage.getItem(
            "crownCashRememberedEmail"
        );

    const emailInput =
        document.getElementById(
            "email"
        );

    const rememberInput =
        document.getElementById(
            "remember"
        );

    if (
        rememberedEmail &&
        emailInput
    ) {

        emailInput.value =
            rememberedEmail;

        if (rememberInput) {
            rememberInput.checked =
                true;
        }
    }

} catch (error) {

    console.warn(
        "Could not load remembered email.",
        error
    );
}


// ------------------------------------------------------------
// Mobile menu support
// ------------------------------------------------------------

const menuToggle =
    document.getElementById(
        "menuToggle"
    );

const sidebar =
    document.querySelector(
        ".sidebar"
    );

if (
    menuToggle &&
    sidebar
) {

    menuToggle.addEventListener(
        "click",
        function () {

            sidebar.classList.toggle(
                "active"
            );

        }
    );
}