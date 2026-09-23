// ============================================================
// CROWN CASH - REGISTRATION JAVASCRIPT
// File: register.js
// ============================================================

"use strict";

// ============================================================
// CROWN CASH BACKEND
// ============================================================

const API_URL = "https://crown-cash1.onrender.com";

// ============================================================
// GET FORM ELEMENTS
// ============================================================

const registerForm =
    document.getElementById("registerForm");

const formMessage =
    document.getElementById("formMessage");

// Password visibility buttons
const passwordToggleButtons =
    document.querySelectorAll("[data-target]");

// ============================================================
// REFERRAL CODE
// ============================================================

let referralCodeFromURL = "";

// ============================================================
// SHOW MESSAGE
// ============================================================

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

// ============================================================
// CLEAR MESSAGE
// ============================================================

function clearMessage() {

    if (!formMessage) {
        return;
    }

    formMessage.textContent = "";

    formMessage.className =
        "form-message";

    formMessage.style.display = "none";
}

// ============================================================
// LOADING STATE
// ============================================================

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

        if (
            submitButton.tagName.toLowerCase() ===
            "button"
        ) {

            submitButton.dataset.originalText =
                submitButton.textContent;

            submitButton.innerHTML =
                '<i class="fa-solid fa-spinner fa-spin"></i> Creating Account...';
        }

    } else {

        submitButton.disabled = false;

        if (
            submitButton.tagName.toLowerCase() ===
            "button"
        ) {

            submitButton.textContent =
                submitButton.dataset.originalText ||
                "Create Account";
        }
    }
}

// ============================================================
// PASSWORD VISIBILITY
// ============================================================

passwordToggleButtons.forEach(button => {

    button.addEventListener(
        "click",
        function () {

            const targetId =
                this.getAttribute("data-target");

            const passwordInput =
                document.getElementById(targetId);

            if (!passwordInput) {
                return;
            }

            const icon =
                this.querySelector("i");

            if (
                passwordInput.type ===
                "password"
            ) {

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

                passwordInput.type =
                    "password";

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

// ============================================================
// LOAD REFERRAL CODE FROM URL
//
// Example:
//
// https://crown-cash.vercel.app/register.html?ref=CC88D54467
//
// ============================================================

function loadReferralCodeFromURL() {

    try {

        const params =
            new URLSearchParams(
                window.location.search
            );

        const referralCode =
            params.get("ref");

        if (!referralCode) {
            return;
        }

        referralCodeFromURL =
            referralCode
                .trim()
                .toUpperCase();

        if (!referralCodeFromURL) {
            return;
        }

        const referralInput =
            document.getElementById(
                "referral_code"
            );

        if (referralInput) {

            referralInput.value =
                referralCodeFromURL;

            referralInput.dataset.fromReferralLink =
                "true";

            // Keep the referral code even if
            // the user clicks into the field.
            referralInput.dataset.referralCode =
                referralCodeFromURL;
        }

        // Save temporarily so the code survives
        // page/form interaction.
        try {

            sessionStorage.setItem(
                "crownCashReferralCode",
                referralCodeFromURL
            );

        } catch (storageError) {

            console.warn(
                "Could not save referral code:",
                storageError
            );
        }

    } catch (error) {

        console.warn(
            "Could not read referral code from URL:",
            error
        );
    }
}

// ============================================================
// GET SAVED REFERRAL CODE
// ============================================================

function getReferralCode() {

    // --------------------------------------------------------
    // 1. Referral code captured directly from URL
    // --------------------------------------------------------

    if (referralCodeFromURL) {

        return referralCodeFromURL
            .trim()
            .toUpperCase();
    }

    // --------------------------------------------------------
    // 2. Referral input
    // --------------------------------------------------------

    const referralInput =
        document.getElementById(
            "referral_code"
        );

    if (
        referralInput &&
        referralInput.value.trim()
    ) {

        return referralInput.value
            .trim()
            .toUpperCase();
    }

    // --------------------------------------------------------
    // 3. Session storage fallback
    // --------------------------------------------------------

    try {

        const savedCode =
            sessionStorage.getItem(
                "crownCashReferralCode"
            );

        if (savedCode) {

            return savedCode
                .trim()
                .toUpperCase();
        }

    } catch (error) {

        console.warn(
            "Could not read saved referral code:",
            error
        );
    }

    return "";
}

// ============================================================
// VALIDATE UGANDAN PHONE NUMBER
// ============================================================

function isValidUgandanPhone(phone) {

    const cleaned =
        phone.replace(
            /[\s-]/g,
            ""
        );

    const patterns = [

        /^07[0-9]{8}$/,

        /^\+2567[0-9]{8}$/,

        /^2567[0-9]{8}$/
    ];

    return patterns.some(
        pattern =>
            pattern.test(cleaned)
    );
}

// ============================================================
// NORMALIZE PHONE NUMBER
// ============================================================

function normalizePhone(phone) {

    let cleaned =
        phone.replace(
            /[\s-]/g,
            ""
        );

    if (
        cleaned.startsWith("+256")
    ) {

        return "0" +
            cleaned.substring(4);
    }

    if (
        cleaned.startsWith("256")
    ) {

        return "0" +
            cleaned.substring(3);
    }

    return cleaned;
}

// ============================================================
// VALIDATE EMAIL
// ============================================================

function isValidEmail(email) {

    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
        email
    );
}

// ============================================================
// FORM SUBMISSION
// ============================================================

if (registerForm) {

    registerForm.addEventListener(
        "submit",
        async function (event) {

            event.preventDefault();

            clearMessage();

            // =================================================
            // GET FORM FIELDS
            // =================================================

            const firstNameInput =
                document.getElementById(
                    "first_name"
                );

            const lastNameInput =
                document.getElementById(
                    "last_name"
                );

            const fullNameInput =
                document.getElementById(
                    "full_name"
                );

            const emailInput =
                document.getElementById(
                    "email"
                );

            const phoneInput =
                document.getElementById(
                    "phone"
                );

            const passwordInput =
                document.getElementById(
                    "password"
                );

            const confirmPasswordInput =
                document.getElementById(
                    "confirm_password"
                );

            const referralInput =
                document.getElementById(
                    "referral_code"
                );

            const termsInput =
                document.getElementById(
                    "terms"
                );

            // =================================================
            // GET VALUES
            // =================================================

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
                    ? emailInput.value
                        .trim()
                        .toLowerCase()
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

            // =================================================
            // GET REFERRAL CODE
            // =================================================

            const referralCode =
                getReferralCode();

            // Make sure the referral input also
            // contains the final referral code.
            if (
                referralInput &&
                referralCode
            ) {

                referralInput.value =
                    referralCode;
            }

            // =================================================
            // VALIDATE NAME
            // =================================================

            if (
                firstName === "" &&
                fullName === ""
            ) {

                showMessage(
                    "Please enter your first name."
                );

                if (firstNameInput) {
                    firstNameInput.focus();
                }

                return;
            }

            // =================================================
            // VALIDATE EMAIL
            // =================================================

            if (
                !isValidEmail(email)
            ) {

                showMessage(
                    "Please enter a valid email address."
                );

                if (emailInput) {
                    emailInput.focus();
                }

                return;
            }

            // =================================================
            // VALIDATE PHONE
            // =================================================

            if (
                !isValidUgandanPhone(phone)
            ) {

                showMessage(
                    "Please enter a valid Ugandan phone number."
                );

                if (phoneInput) {
                    phoneInput.focus();
                }

                return;
            }

            // =================================================
            // VALIDATE PASSWORD
            // =================================================

            if (
                password.length < 8
            ) {

                showMessage(
                    "Password must contain at least 8 characters."
                );

                if (passwordInput) {
                    passwordInput.focus();
                }

                return;
            }

            // =================================================
            // CONFIRM PASSWORD
            // =================================================

            if (
                password !==
                confirmPassword
            ) {

                showMessage(
                    "Passwords do not match."
                );

                if (confirmPasswordInput) {
                    confirmPasswordInput.focus();
                }

                return;
            }

            // =================================================
            // TERMS AND CONDITIONS
            // =================================================

            if (
                termsInput &&
                !termsInput.checked
            ) {

                showMessage(
                    "Please agree to the Terms & Conditions and Privacy Policy."
                );

                return;
            }

            // =================================================
            // PREPARE FULL NAME
            // =================================================

            const finalFullName =
                fullName ||
                [firstName, lastName]
                    .filter(Boolean)
                    .join(" ");

            // =================================================
            // PREPARE REQUEST
            // =================================================

            const requestData = {

                first_name:
                    firstName,

                last_name:
                    lastName,

                full_name:
                    finalFullName,

                email:
                    email,

                phone:
                    phone,

                password:
                    password,

                confirm_password:
                    confirmPassword,

                // IMPORTANT:
                // This is the field expected by
                // register.php.
                referral_code:
                    referralCode
            };

            // =================================================
            // DEBUG REFERRAL INFORMATION
            // =================================================

            console.log(
                "Crown Cash registration data:",
                {
                    email: email,
                    phone: phone,
                    referral_code:
                        referralCode
                }
            );

            // =================================================
            // START LOADING
            // =================================================

            setLoading(true);

            try {

                // =================================================
                // SEND REGISTRATION REQUEST
                // =================================================

                const response =
                    await fetch(
                        `${API_URL}/register.php`,
                        {
                            method: "POST",

                            credentials:
                                "include",

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

                // =================================================
                // READ JSON RESPONSE
                // =================================================

                let data = null;

                try {

                    data =
                        await response.json();

                } catch (jsonError) {

                    console.error(
                        "Invalid registration response:",
                        jsonError
                    );

                    data = null;
                }

                // =================================================
                // HANDLE ERROR
                // =================================================

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

                // =================================================
                // SUCCESS
                // =================================================

                showMessage(
                    "Account created successfully! Redirecting...",
                    "success"
                );

                // =================================================
                // SAVE USER INFORMATION
                // =================================================

                if (data.user) {

                    try {

                        localStorage.setItem(
                            "crownCashUser",
                            JSON.stringify(
                                data.user
                            )
                        );

                    } catch (
                        storageError
                    ) {

                        console.warn(
                            "Could not save user information.",
                            storageError
                        );
                    }
                }

                // =================================================
                // CLEAR TEMPORARY REFERRAL STORAGE
                // =================================================

                try {

                    sessionStorage.removeItem(
                        "crownCashReferralCode"
                    );

                } catch (error) {

                    console.warn(
                        "Could not clear referral storage.",
                        error
                    );
                }

                // =================================================
                // REDIRECT TO DASHBOARD
                // =================================================

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

// ============================================================
// LOAD REFERRAL CODE IMMEDIATELY
// ============================================================

loadReferralCodeFromURL();

// ============================================================
// MOBILE MENU
// ============================================================

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