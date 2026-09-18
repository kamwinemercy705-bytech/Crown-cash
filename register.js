// ============================================================
// CROWN CASH - REGISTRATION JAVASCRIPT
// File: register.js
// ============================================================

"use strict";

// Crown Cash backend
const API_URL = "https://crown-cash1.onrender.com";

// ------------------------------------------------------------
// Get form elements
// ------------------------------------------------------------

const registerForm = document.getElementById("registerForm");
const formMessage = document.getElementById("formMessage");

// Password visibility buttons
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
    formMessage.className = "form-message " + type;
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
    formMessage.className = "form-message";
    formMessage.style.display = "none";
}

// ------------------------------------------------------------
// Loading state
// ------------------------------------------------------------

function setLoading(loading) {

    if (!registerForm) {
        return;
    }

    const submitButton =
        registerForm.querySelector(
            'button[type="submit"], input[type="submit"]'
        );

    if (!submitButton) {
        return;
    }

    if (loading) {

        submitButton.disabled = true;

        if (submitButton.tagName.toLowerCase() === "button") {

            submitButton.dataset.originalText =
                submitButton.textContent;

            submitButton.innerHTML =
                '<i class="fa-solid fa-spinner fa-spin"></i> Creating Account...';
        }

    } else {

        submitButton.disabled = false;

        if (submitButton.tagName.toLowerCase() === "button") {

            submitButton.textContent =
                submitButton.dataset.originalText ||
                "Create Account";
        }
    }
}

// ------------------------------------------------------------
// Password visibility
// ------------------------------------------------------------

passwordToggleButtons.forEach(button => {

    button.addEventListener("click", function () {

        const targetId =
            this.getAttribute("data-target");

        const passwordInput =
            document.getElementById(targetId);

        if (!passwordInput) {
            return;
        }

        const icon =
            this.querySelector("i");

        if (passwordInput.type === "password") {

            passwordInput.type = "text";

            if (icon) {

                icon.classList.remove(
                    "fa-eye"
                );

                icon.classList.add(
                    "fa-eye-slash"
                );
            }

        } else {

            passwordInput.type = "password";

            if (icon) {

                icon.classList.remove(
                    "fa-eye-slash"
                );

                icon.classList.add(
                    "fa-eye"
                );
            }
        }

    });

});

// ------------------------------------------------------------
// Get referral code from URL
// Example:
// https://crown-cash.vercel.app/?ref=CC12345678
// ------------------------------------------------------------

function loadReferralCodeFromURL() {

    const params =
        new URLSearchParams(
            window.location.search
        );

    const referralCode =
        params.get("ref");

    if (!referralCode) {
        return;
    }

    const referralInput =
        document.getElementById("referral_code");

    if (!referralInput) {
        return;
    }

    referralInput.value =
        referralCode.trim().toUpperCase();

    // Prevent accidental modification when
    // a referral link was used.
    referralInput.dataset.fromReferralLink = "true";
}

// ------------------------------------------------------------
// Validate Ugandan phone number
// ------------------------------------------------------------

function isValidUgandanPhone(phone) {

    const cleaned =
        phone.replace(/[\s-]/g, "");

    const patterns = [

        /^07[0-9]{8}$/,

        /^\+2567[0-9]{8}$/,

        /^2567[0-9]{8}$/
    ];

    return patterns.some(
        pattern => pattern.test(cleaned)
    );
}

// ------------------------------------------------------------
// Normalize phone number
// ------------------------------------------------------------

function normalizePhone(phone) {

    let cleaned =
        phone.replace(/[\s-]/g, "");

    if (cleaned.startsWith("+256")) {

        return "0" + cleaned.substring(4);
    }

    if (cleaned.startsWith("256")) {

        return "0" + cleaned.substring(3);
    }

    return cleaned;
}

// ------------------------------------------------------------
// Validate email
// ------------------------------------------------------------

function isValidEmail(email) {

    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
        email
    );
}

// ------------------------------------------------------------
// Form submission
// ------------------------------------------------------------

if (registerForm) {

    registerForm.addEventListener(
        "submit",
        async function (event) {

            event.preventDefault();

            clearMessage();

            // ------------------------------------------------
            // Read form fields
            // ------------------------------------------------

            const firstNameInput =
                document.getElementById("first_name");

            const lastNameInput =
                document.getElementById("last_name");

            const fullNameInput =
                document.getElementById("full_name");

            const emailInput =
                document.getElementById("email");

            const phoneInput =
                document.getElementById("phone");

            const passwordInput =
                document.getElementById("password");

            const confirmPasswordInput =
                document.getElementById("confirm_password");

            const referralInput =
                document.getElementById("referral_code");

            const termsInput =
                document.getElementById("terms");

            // ------------------------------------------------
            // Get values
            // ------------------------------------------------

            const firstName =
                firstNameInput
                    ? firstNameInput.value.trim()
                    : "";

            const lastName =
                lastNameInput
                    ? lastNameInput.value.trim()
                    : "";

            const fullName =
                fullNameInput
                    ? fullNameInput.value.trim()
                    : "";

            const email =
                emailInput
                    ? emailInput.value.trim().toLowerCase()
                    : "";

            const phone =
                phoneInput
                    ? normalizePhone(
                        phoneInput.value.trim()
                    )
                    : "";

            const password =
                passwordInput
                    ? passwordInput.value
                    : "";

            const confirmPassword =
                confirmPasswordInput
                    ? confirmPasswordInput.value
                    : "";

            const referralCode =
                referralInput
                    ? referralInput.value
                        .trim()
                        .toUpperCase()
                    : "";

            // ------------------------------------------------
            // Validate name
            // ------------------------------------------------

            if (
                firstName === "" &&
                fullName === ""
            ) {

                showMessage(
                    "Please enter your first name."
                );

                return;
            }

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
            // Validate phone
            // ------------------------------------------------

            if (!isValidUgandanPhone(phone)) {

                showMessage(
                    "Please enter a valid Ugandan phone number."
                );

                if (phoneInput) {
                    phoneInput.focus();
                }

                return;
            }

            // ------------------------------------------------
            // Validate password
            // ------------------------------------------------

            if (password.length < 8) {

                showMessage(
                    "Password must contain at least 8 characters."
                );

                if (passwordInput) {
                    passwordInput.focus();
                }

                return;
            }

            // ------------------------------------------------
            // Confirm password
            // ------------------------------------------------

            if (password !== confirmPassword) {

                showMessage(
                    "Passwords do not match."
                );

                if (confirmPasswordInput) {
                    confirmPasswordInput.focus();
                }

                return;
            }

            // ------------------------------------------------
            // Terms and conditions
            // ------------------------------------------------

            if (
                termsInput &&
                !termsInput.checked
            ) {

                showMessage(
                    "Please agree to the Terms & Conditions and Privacy Policy."
                );

                return;
            }

            // ------------------------------------------------
            // Prepare request
            // ------------------------------------------------

            const requestData = {

                first_name: firstName,

                last_name: lastName,

                full_name:
                    fullName ||
                    [firstName, lastName]
                        .filter(Boolean)
                        .join(" "),

                email: email,

                phone: phone,

                password: password,

                confirm_password:
                    confirmPassword,

                referral_code:
                    referralCode
            };

            // ------------------------------------------------
            // Send registration request
            // ------------------------------------------------

            setLoading(true);

            try {

                const response =
                    await fetch(
                        `${API_URL}/register.php`,
                        {
                            method: "POST",

                            credentials: "include",

                            headers: {
                                "Content-Type":
                                    "application/json"
                            },

                            body:
                                JSON.stringify(
                                    requestData
                                )
                        }
                    );

                // ------------------------------------------------
                // Try to read JSON response
                // ------------------------------------------------

                let data = null;

                try {

                    data =
                        await response.json();

                } catch (jsonError) {

                    data = null;
                }

                // ------------------------------------------------
                // Handle unsuccessful response
                // ------------------------------------------------

                if (
                    !response.ok ||
                    !data ||
                    data.success !== true
                ) {

                    let errorMessage =
                        "Registration could not be completed.";

                    if (
                        data &&
                        data.message
                    ) {

                        errorMessage =
                            data.message;
                    }

                    // Development-only database error
                    if (
                        data &&
                        data.error
                    ) {

                        console.error(
                            "Registration API error:",
                            data.error
                        );
                    }

                    showMessage(
                        errorMessage,
                        "error"
                    );

                    return;
                }

                // ------------------------------------------------
                // Successful registration
                // ------------------------------------------------

                showMessage(
                    "Account created successfully! Redirecting...",
                    "success"
                );

                // ------------------------------------------------
                // Store basic user information locally
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
                            "Could not save user information.",
                            storageError
                        );
                    }
                }

                // ------------------------------------------------
                // Redirect
                // ------------------------------------------------

                setTimeout(
                    function () {

                        window.location.href =
                            "/dashboard.html";

                    },
                    1200
                );

            } catch (error) {

                console.error(
                    "Registration request failed:",
                    error
                );

                showMessage(
                    "Unable to connect to the registration server. Please check your internet connection and try again.",
                    "error"
                );

            } finally {

                setLoading(false);
            }

        }
    );
}

// ------------------------------------------------------------
// Automatically load referral code from URL
// ------------------------------------------------------------

loadReferralCodeFromURL();

// ------------------------------------------------------------
// Mobile menu
// ------------------------------------------------------------

const menuToggle =
    document.getElementById("menuToggle");

const sidebar =
    document.querySelector(".sidebar");

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