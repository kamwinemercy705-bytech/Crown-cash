"use strict";

const API_BASE =
    "https://crown-cash1.onrender.com";

const CHANGE_PASSWORD_API =
    `${API_BASE}/change-password.php`;


// ======================================================
// ELEMENTS
// ======================================================

const form =
    document.getElementById(
        "changePasswordForm"
    );

const currentPassword =
    document.getElementById(
        "currentPassword"
    );

const newPassword =
    document.getElementById(
        "newPassword"
    );

const confirmPassword =
    document.getElementById(
        "confirmPassword"
    );

const formMessage =
    document.getElementById(
        "formMessage"
    );

const submitButton =
    document.getElementById(
        "changePasswordButton"
    );

const buttonText =
    document.getElementById(
        "buttonText"
    );

const buttonIcon =
    document.getElementById(
        "buttonIcon"
    );

const strengthBar =
    document.getElementById(
        "strengthBar"
    );

const strengthText =
    document.getElementById(
        "strengthText"
    );


// ======================================================
// MESSAGE
// ======================================================

function showMessage(
    message,
    type = "error"
) {

    if (!formMessage) {
        return;
    }

    formMessage.textContent =
        message;

    formMessage.className =
        `form-message ${type}`;

    formMessage.hidden =
        false;
}


function hideMessage() {

    if (!formMessage) {
        return;
    }

    formMessage.textContent =
        "";

    formMessage.hidden =
        true;

    formMessage.className =
        "form-message";
}


// ======================================================
// PASSWORD TOGGLES
// ======================================================

document
    .querySelectorAll(".password-toggle")
    .forEach(button => {

        button.addEventListener(
            "click",
            function () {

                const targetId =
                    this.dataset.target;

                const input =
                    document.getElementById(
                        targetId
                    );

                if (!input) {
                    return;
                }

                const icon =
                    this.querySelector("i");


                if (
                    input.type ===
                    "password"
                ) {

                    input.type =
                        "text";

                    if (icon) {

                        icon.className =
                            "fa-solid fa-eye-slash";
                    }

                    this.setAttribute(
                        "aria-label",
                        "Hide password"
                    );

                } else {

                    input.type =
                        "password";

                    if (icon) {

                        icon.className =
                            "fa-solid fa-eye";
                    }

                    this.setAttribute(
                        "aria-label",
                        "Show password"
                    );
                }

            }
        );

    });


// ======================================================
// PASSWORD REQUIREMENTS
// ======================================================

function updateRequirements() {

    const password =
        newPassword?.value || "";

    const confirmation =
        confirmPassword?.value || "";


    const lengthValid =
        password.length >= 8;


    const uppercaseValid =
        /[A-Z]/.test(password);


    const numberValid =
        /[0-9]/.test(password);


    const matchValid =
        password.length > 0 &&
        password === confirmation;


    setRequirement(
        "lengthRequirement",
        lengthValid
    );


    setRequirement(
        "uppercaseRequirement",
        uppercaseValid
    );


    setRequirement(
        "numberRequirement",
        numberValid
    );


    setRequirement(
        "matchRequirement",
        matchValid
    );


    updateStrength(password);
}


function setRequirement(
    id,
    valid
) {

    const element =
        document.getElementById(id);

    if (!element) {
        return;
    }


    element.classList.toggle(
        "valid",
        valid
    );
}


// ======================================================
// PASSWORD STRENGTH
// ======================================================

function updateStrength(password) {

    if (!strengthBar ||
        !strengthText) {
        return;
    }


    if (!password) {

        strengthBar.style.width =
            "0%";

        strengthText.textContent =
            "Enter a password";

        return;
    }


    let score = 0;


    if (password.length >= 8) {
        score++;
    }


    if (/[A-Z]/.test(password)) {
        score++;
    }


    if (/[a-z]/.test(password)) {
        score++;
    }


    if (/[0-9]/.test(password)) {
        score++;
    }


    if (
        /[^A-Za-z0-9]/.test(password)
    ) {
        score++;
    }


    const widths = [
        "20%",
        "40%",
        "60%",
        "80%",
        "100%"
    ];


    const labels = [
        "Very weak",
        "Weak",
        "Fair",
        "Strong",
        "Very strong"
    ];


    const index =
        Math.max(
            0,
            Math.min(
                score - 1,
                4
            )
        );


    strengthBar.style.width =
        widths[index];


    strengthText.textContent =
        labels[index];
}


// ======================================================
// INPUT EVENTS
// ======================================================

if (newPassword) {

    newPassword.addEventListener(
        "input",
        updateRequirements
    );
}


if (confirmPassword) {

    confirmPassword.addEventListener(
        "input",
        updateRequirements
    );
}


// ======================================================
// FORM SUBMISSION
// ======================================================

if (form) {

    form.addEventListener(
        "submit",
        async function (event) {

            event.preventDefault();

            hideMessage();


            const current =
                currentPassword?.value.trim() ||
                "";

            const newPass =
                newPassword?.value ||
                "";

            const confirm =
                confirmPassword?.value ||
                "";


            // ==========================================
            // VALIDATION
            // ==========================================

            if (!current) {

                showMessage(
                    "Please enter your current password."
                );

                currentPassword?.focus();

                return;
            }


            if (newPass.length < 8) {

                showMessage(
                    "Your new password must contain at least 8 characters."
                );

                newPassword?.focus();

                return;
            }


            if (!/[A-Z]/.test(newPass)) {

                showMessage(
                    "Your new password must contain at least one uppercase letter."
                );

                newPassword?.focus();

                return;
            }


            if (!/[0-9]/.test(newPass)) {

                showMessage(
                    "Your new password must contain at least one number."
                );

                newPassword?.focus();

                return;
            }


            if (newPass !== confirm) {

                showMessage(
                    "The new passwords do not match."
                );

                confirmPassword?.focus();

                return;
            }


            if (current === newPass) {

                showMessage(
                    "Your new password must be different from your current password."
                );

                newPassword?.focus();

                return;
            }


            // ==========================================
            // LOADING
            // ==========================================

            if (submitButton) {

                submitButton.disabled =
                    true;
            }


            if (buttonText) {

                buttonText.textContent =
                    "Updating Password...";
            }


            if (buttonIcon) {

                buttonIcon.className =
                    "fa-solid fa-spinner fa-spin";
            }


            try {

                const response =
                    await fetch(
                        CHANGE_PASSWORD_API,
                        {
                            method: "POST",

                            credentials: "include",

                            headers: {
                                "Content-Type":
                                    "application/json",

                                "Accept":
                                    "application/json"
                            },

                            body: JSON.stringify({

                                current_password:
                                    current,

                                new_password:
                                    newPass,

                                confirm_password:
                                    confirm
                            })
                        }
                    );


                const data =
                    await response.json();


                if (
                    response.status === 401
                ) {

                    window.location.href =
                        "login.html";

                    return;
                }


                if (
                    !response.ok ||
                    !data.success
                ) {

                    throw new Error(
                        data.message ||
                        "Unable to change your password."
                    );
                }


                // ======================================
                // SUCCESS
                // ======================================

                showMessage(
                    "Your password has been changed successfully.",
                    "success"
                );


                form.reset();

                updateRequirements();


                if (submitButton) {

                    submitButton.disabled =
                        false;
                }


                if (buttonText) {

                    buttonText.textContent =
                        "Password Changed";
                }


                if (buttonIcon) {

                    buttonIcon.className =
                        "fa-solid fa-circle-check";
                }


                /*
                 * Return to Profile after a short delay.
                 */

                setTimeout(
                    function () {

                        window.location.href =
                            "profile.html";

                    },
                    1800
                );


            } catch (error) {

                console.error(
                    "Change password error:",
                    error
                );


                showMessage(
                    error.message ||
                    "Unable to change your password. Please try again."
                );


                if (submitButton) {

                    submitButton.disabled =
                        false;
                }


                if (buttonText) {

                    buttonText.textContent =
                        "Change Password";
                }


                if (buttonIcon) {

                    buttonIcon.className =
                        "fa-solid fa-arrow-right";
                }

            }

        }
    );
}


// ======================================================
// MOBILE SIDEBAR
// ======================================================

const menuToggle =
    document.getElementById(
        "menuToggle"
    );

const sidebar =
    document.getElementById(
        "sidebar"
    );


if (menuToggle && sidebar) {

    menuToggle.addEventListener(
        "click",
        function () {

            sidebar.classList.toggle(
                "open"
            );

        }
    );

}


// ======================================================
// CLOSE SIDEBAR WHEN LINK CLICKED
// ======================================================

if (sidebar) {

    sidebar
        .querySelectorAll("a")
        .forEach(link => {

            link.addEventListener(
                "click",
                function () {

                    sidebar.classList.remove(
                        "open"
                    );

                }
            );

        });

}