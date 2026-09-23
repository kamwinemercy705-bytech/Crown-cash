/* =========================================================
   CROWN CASH — SUPPORT CENTER
   support.js
========================================================= */

"use strict";


/* =========================================================
   CONFIGURATION
========================================================= */

const API_BASE = "https://crown-cash1.onrender.com";

const SUPPORT_API = `${API_BASE}/support.php`;

const PROFILE_API = `${API_BASE}/profile.php`;


/* =========================================================
   DOM ELEMENTS
========================================================= */

const sidebar = document.getElementById("sidebar");
const sidebarOverlay = document.getElementById("sidebarOverlay");
const sidebarClose = document.getElementById("sidebarClose");
const menuButton = document.getElementById("menuButton");

const supportForm = document.getElementById("supportForm");

const categoryInput = document.getElementById("category");
const subjectInput = document.getElementById("subject");
const messageInput = document.getElementById("message");

const messageCount = document.getElementById("messageCount");

const formMessage = document.getElementById("formMessage");

const submitSupportBtn =
    document.getElementById("submitSupportBtn");

const ticketsContainer =
    document.getElementById("ticketsContainer");

const headerUserName =
    document.getElementById("headerUserName");

const accountAvatar =
    document.getElementById("accountAvatar");


/* =========================================================
   APPLICATION STATE
========================================================= */

let currentUser = null;

let supportTickets = [];

let isSubmitting = false;


/* =========================================================
   INITIALIZE
========================================================= */

document.addEventListener("DOMContentLoaded", () => {

    initializeSupportPage();

});


async function initializeSupportPage() {

    setupSidebar();

    setupFAQ();

    setupCategoryCards();

    setupMessageCounter();

    setupSupportForm();

    await loadUserProfile();

    await loadSupportTickets();

}


/* =========================================================
   SIDEBAR
========================================================= */

function setupSidebar() {

    if (menuButton) {

        menuButton.addEventListener("click", () => {

            openSidebar();

        });

    }


    if (sidebarClose) {

        sidebarClose.addEventListener("click", () => {

            closeSidebar();

        });

    }


    if (sidebarOverlay) {

        sidebarOverlay.addEventListener("click", () => {

            closeSidebar();

        });

    }


    document.querySelectorAll(".nav-link").forEach(link => {

        link.addEventListener("click", () => {

            closeSidebar();

        });

    });


    window.addEventListener("resize", () => {

        if (window.innerWidth > 800) {

            closeSidebar();

        }

    });

}


function openSidebar() {

    if (!sidebar) {
        return;
    }

    sidebar.classList.add("open");

    if (sidebarOverlay) {
        sidebarOverlay.classList.add("active");
    }

    document.body.style.overflow = "hidden";

}


function closeSidebar() {

    if (sidebar) {
        sidebar.classList.remove("open");
    }

    if (sidebarOverlay) {
        sidebarOverlay.classList.remove("active");
    }

    document.body.style.overflow = "";

}


/* =========================================================
   FAQ
========================================================= */

function setupFAQ() {

    const questions =
        document.querySelectorAll(".faq-question");


    questions.forEach(question => {

        question.addEventListener("click", () => {

            const faqItem =
                question.closest(".faq-item");

            if (!faqItem) {
                return;
            }


            const isOpen =
                faqItem.classList.contains("active");


            /*
             * Close other FAQ items.
             */
            document
                .querySelectorAll(".faq-item.active")
                .forEach(item => {

                    if (item !== faqItem) {

                        item.classList.remove("active");

                        const itemQuestion =
                            item.querySelector(".faq-question");

                        if (itemQuestion) {

                            itemQuestion.setAttribute(
                                "aria-expanded",
                                "false"
                            );

                        }

                    }

                });


            /*
             * Toggle selected item.
             */
            if (isOpen) {

                faqItem.classList.remove("active");

                question.setAttribute(
                    "aria-expanded",
                    "false"
                );

            } else {

                faqItem.classList.add("active");

                question.setAttribute(
                    "aria-expanded",
                    "true"
                );

            }

        });

    });

}


/* =========================================================
   HELP CATEGORY CARDS
========================================================= */

function setupCategoryCards() {

    const categoryCards =
        document.querySelectorAll(".help-card");


    categoryCards.forEach(card => {

        card.addEventListener("click", () => {

            const category =
                card.getAttribute("data-category");

            if (!categoryInput || !category) {
                return;
            }


            const option =
                Array.from(categoryInput.options)
                    .find(item =>
                        item.value === category
                    );


            if (option) {

                categoryInput.value = category;

            }


            /*
             * Scroll to support form.
             */
            if (supportForm) {

                supportForm.scrollIntoView({
                    behavior: "smooth",
                    block: "start"
                });

            }


            /*
             * Focus subject field.
             */
            setTimeout(() => {

                if (subjectInput) {

                    subjectInput.focus();

                }

            }, 500);

        });

    });

}


/* =========================================================
   MESSAGE CHARACTER COUNTER
========================================================= */

function setupMessageCounter() {

    if (!messageInput || !messageCount) {
        return;
    }


    updateMessageCounter();


    messageInput.addEventListener(
        "input",
        updateMessageCounter
    );

}


function updateMessageCounter() {

    if (!messageInput || !messageCount) {
        return;
    }


    const length =
        messageInput.value.length;


    messageCount.textContent =
        String(length);


    if (length >= 1800) {

        messageCount.style.color = "#ff9ca5";

    } else if (length >= 1500) {

        messageCount.style.color = "#ffe48a";

    } else {

        messageCount.style.color = "";

    }

}


/* =========================================================
   LOAD USER PROFILE
========================================================= */

async function loadUserProfile() {

    try {

        const response = await fetch(
            PROFILE_API,
            {
                method: "GET",
                credentials: "include",
                headers: {
                    "Accept": "application/json"
                }
            }
        );


        const data =
            await parseJSONResponse(response);


        if (!response.ok || !data.success) {

            /*
             * We do not immediately redirect here.
             * The backend support endpoint will also enforce
             * authentication.
             */

            return;

        }


        currentUser =
            data.user || null;


        updateUserDisplay();


    } catch (error) {

        console.error(
            "Unable to load profile:",
            error
        );

    }

}


/* =========================================================
   UPDATE USER DISPLAY
========================================================= */

function updateUserDisplay() {

    if (!currentUser) {
        return;
    }


    const fullName =
        String(
            currentUser.full_name ||
            ""
        ).trim();


    const firstName =
        String(
            currentUser.first_name ||
            ""
        ).trim();


    const displayName =
        fullName ||
        firstName ||
        "User Account";


    if (headerUserName) {

        headerUserName.textContent =
            displayName;

    }


    if (accountAvatar) {

        const firstCharacter =
            displayName
                .charAt(0)
                .toUpperCase();


        accountAvatar.textContent =
            firstCharacter || "U";

    }

}


/* =========================================================
   SUPPORT FORM
========================================================= */

function setupSupportForm() {

    if (!supportForm) {
        return;
    }


    supportForm.addEventListener(
        "submit",
        handleSupportSubmit
    );

}


/* =========================================================
   SUBMIT SUPPORT REQUEST
========================================================= */

async function handleSupportSubmit(event) {

    event.preventDefault();


    if (isSubmitting) {
        return;
    }


    clearFormMessage();


    const category =
        categoryInput
            ? categoryInput.value.trim()
            : "";


    const subject =
        subjectInput
            ? subjectInput.value.trim()
            : "";


    const message =
        messageInput
            ? messageInput.value.trim()
            : "";


    /*
     * Client-side validation.
     */

    if (!category) {

        showFormMessage(
            "Please select a support category.",
            "error"
        );

        if (categoryInput) {
            categoryInput.focus();
        }

        return;

    }


    if (!subject) {

        showFormMessage(
            "Please enter a subject for your support request.",
            "error"
        );

        if (subjectInput) {
            subjectInput.focus();
        }

        return;

    }


    if (subject.length < 3) {

        showFormMessage(
            "Your subject is too short. Please provide a clearer subject.",
            "error"
        );

        if (subjectInput) {
            subjectInput.focus();
        }

        return;

    }


    if (!message) {

        showFormMessage(
            "Please describe your issue.",
            "error"
        );

        if (messageInput) {
            messageInput.focus();
        }

        return;

    }


    if (message.length < 10) {

        showFormMessage(
            "Please provide more details so the support team can assist you.",
            "error"
        );

        if (messageInput) {
            messageInput.focus();
        }

        return;

    }


    if (message.length > 2000) {

        showFormMessage(
            "Your message is too long. Please keep it within 2000 characters.",
            "error"
        );

        return;

    }


    /*
     * Security:
     * Do not send password, PIN or OTP fields.
     */

    const payload = {
        category: category,
        subject: subject,
        message: message
    };


    setSubmitLoading(true);


    try {

        const response = await fetch(
            SUPPORT_API,
            {
                method: "POST",
                credentials: "include",

                headers: {
                    "Content-Type": "application/json",
                    "Accept": "application/json"
                },

                body: JSON.stringify(payload)
            }
        );


        const data =
            await parseJSONResponse(response);


        if (!response.ok || !data.success) {

            const errorMessage =
                data.message ||
                "Unable to submit your support request.";

            throw new Error(errorMessage);

        }


        /*
         * Successful submission.
         */

        let successMessage =
            "Your support request has been submitted successfully.";


        const ticketReference =
            data.ticket_reference ||
            data.ticket_id ||
            data.reference ||
            "";


        if (ticketReference) {

            successMessage +=
                ` Ticket reference: ${ticketReference}`;

        }


        showFormMessage(
            successMessage,
            "success"
        );


        /*
         * Clear the form.
         */

        resetSupportForm();


        /*
         * Reload support tickets.
         */

        await loadSupportTickets();


        /*
         * Scroll user toward the ticket list.
         */

        setTimeout(() => {

            if (ticketsContainer) {

                ticketsContainer.scrollIntoView({
                    behavior: "smooth",
                    block: "center"
                });

            }

        }, 250);


    } catch (error) {

        console.error(
            "Support submission error:",
            error
        );


        showFormMessage(
            error.message ||
            "Something went wrong while submitting your request.",
            "error"
        );

    } finally {

        setSubmitLoading(false);

    }

}


/* =========================================================
   RESET FORM
========================================================= */

function resetSupportForm() {

    if (!supportForm) {
        return;
    }


    supportForm.reset();


    updateMessageCounter();

}


/* =========================================================
   SUBMIT BUTTON LOADING
========================================================= */

function setSubmitLoading(loading) {

    isSubmitting = loading;


    if (!submitSupportBtn) {
        return;
    }


    submitSupportBtn.disabled =
        loading;


    if (loading) {

        submitSupportBtn.classList.add(
            "loading"
        );

    } else {

        submitSupportBtn.classList.remove(
            "loading"
        );

    }

}


/* =========================================================
   FORM MESSAGE
========================================================= */

function showFormMessage(message, type) {

    if (!formMessage) {
        return;
    }


    formMessage.textContent =
        message;


    formMessage.className =
        `form-message ${type}`;


    formMessage.scrollIntoView({
        behavior: "smooth",
        block: "nearest"
    });

}


function clearFormMessage() {

    if (!formMessage) {
        return;
    }


    formMessage.textContent = "";

    formMessage.className =
        "form-message";

}


/* =========================================================
   LOAD SUPPORT TICKETS
========================================================= */

async function loadSupportTickets() {

    if (!ticketsContainer) {
        return;
    }


    showTicketsLoading();


    try {

        const response = await fetch(
            SUPPORT_API,
            {
                method: "GET",
                credentials: "include",

                headers: {
                    "Accept": "application/json"
                }
            }
        );


        const data =
            await parseJSONResponse(response);


        if (!response.ok || !data.success) {

            throw new Error(
                data.message ||
                "Unable to load support requests."
            );

        }


        supportTickets =
            normalizeTickets(data);


        renderSupportTickets();


    } catch (error) {

        console.error(
            "Unable to load support tickets:",
            error
        );


        showTicketsError(
            error.message ||
            "Unable to load your support requests."
        );

    }

}


/* =========================================================
   NORMALIZE TICKETS
========================================================= */

function normalizeTickets(data) {

    const possibleTickets =
        data.tickets ||
        data.support_tickets ||
        data.requests ||
        data.data ||
        [];


    if (!Array.isArray(possibleTickets)) {

        return [];

    }


    return possibleTickets.map(ticket => {

        return {

            id:
                ticket.id ||
                ticket._id ||
                "",

            reference:
                ticket.ticket_reference ||
                ticket.reference ||
                ticket.ticket_id ||
                ticket.id ||
                "",

            category:
                ticket.category ||
                "General Support",

            subject:
                ticket.subject ||
                "Support Request",

            message:
                ticket.message ||
                "",

            status:
                ticket.status ||
                "pending",

            createdAt:
                ticket.created_at ||
                ticket.createdAt ||
                ticket.date ||
                "",

            updatedAt:
                ticket.updated_at ||
                ticket.updatedAt ||
                ""

        };

    });

}


/* =========================================================
   RENDER SUPPORT TICKETS
========================================================= */

function renderSupportTickets() {

    if (!ticketsContainer) {
        return;
    }


    if (!supportTickets.length) {

        ticketsContainer.innerHTML = `
            <div class="empty-tickets">

                <div class="empty-ticket-icon">

                    <svg viewBox="0 0 24 24" fill="none">

                        <path
                            d="M4 5.5C4 4.7 4.7 4 5.5 4H18.5C19.3 4 20 4.7 20 5.5V15.5C20 16.3 19.3 17 18.5 17H13L8 20V17H5.5C4.7 17 4 16.3 4 15.5V5.5Z"
                            stroke="currentColor"
                            stroke-width="1.8"
                            stroke-linejoin="round"
                        />

                        <path
                            d="M8 9H16"
                            stroke="currentColor"
                            stroke-width="1.8"
                            stroke-linecap="round"
                        />

                        <path
                            d="M8 13H13"
                            stroke="currentColor"
                            stroke-width="1.8"
                            stroke-linecap="round"
                        />

                    </svg>

                </div>

                <strong>
                    No support requests yet
                </strong>

                <p>
                    Your submitted support requests will appear here.
                </p>

            </div>
        `;

        return;

    }


    ticketsContainer.innerHTML =
        supportTickets
            .map(ticket =>
                createTicketHTML(ticket)
            )
            .join("");

}


/* =========================================================
   CREATE TICKET HTML
========================================================= */

function createTicketHTML(ticket) {

    const safeSubject =
        escapeHTML(
            ticket.subject ||
            "Support Request"
        );


    const safeCategory =
        escapeHTML(
            ticket.category ||
            "General Support"
        );


    const safeReference =
        escapeHTML(
            ticket.reference ||
            ticket.id ||
            "Pending"
        );


    const status =
        normalizeStatus(
            ticket.status
        );


    const statusClass =
        getStatusClass(status);


    const formattedDate =
        formatDate(
            ticket.createdAt
        );


    return `
        <article class="ticket-card">

            <div class="ticket-main">

                <h3>
                    ${safeSubject}
                </h3>

                <div class="ticket-category">
                    ${safeCategory}
                </div>

                <div class="ticket-reference">
                    Ticket: ${safeReference}
                </div>

                ${
                    formattedDate
                        ? `
                            <div class="ticket-date">
                                Submitted ${formattedDate}
                            </div>
                        `
                        : ""
                }

            </div>

            <div
                class="ticket-status ${statusClass}"
            >
                ${escapeHTML(status)}
            </div>

        </article>
    `;

}


/* =========================================================
   STATUS NORMALIZATION
========================================================= */

function normalizeStatus(status) {

    const value =
        String(
            status ||
            "pending"
        )
            .trim()
            .toLowerCase()
            .replace(/[_-]+/g, " ");


    switch (value) {

        case "pending":
            return "Pending";

        case "in review":
            return "In Review";

        case "review":
            return "In Review";

        case "responded":
            return "Responded";

        case "resolved":
            return "Resolved";

        case "closed":
            return "Closed";

        case "rejected":
            return "Rejected";

        default:
            return (
                value.charAt(0).toUpperCase() +
                value.slice(1)
            );

    }

}


/* =========================================================
   STATUS CSS CLASS
========================================================= */

function getStatusClass(status) {

    const value =
        String(status)
            .toLowerCase()
            .replace(/\s+/g, "-");


    const allowed = [
        "pending",
        "in-review",
        "responded",
        "resolved",
        "rejected",
        "closed"
    ];


    if (allowed.includes(value)) {

        return value;

    }


    return "pending";

}


/* =========================================================
   TICKETS LOADING STATE
========================================================= */

function showTicketsLoading() {

    if (!ticketsContainer) {
        return;
    }


    ticketsContainer.innerHTML = `
        <div class="tickets-loading">

            <div class="loading-spinner"></div>

            <p>
                Loading your support requests...
            </p>

        </div>
    `;

}


/* =========================================================
   TICKETS ERROR
========================================================= */

function showTicketsError(message) {

    if (!ticketsContainer) {
        return;
    }


    ticketsContainer.innerHTML = `
        <div class="empty-tickets">

            <div class="empty-ticket-icon">

                <svg viewBox="0 0 24 24" fill="none">

                    <path
                        d="M12 3L20 18H4L12 3Z"
                        stroke="currentColor"
                        stroke-width="1.8"
                        stroke-linejoin="round"
                    />

                    <path
                        d="M12 9V13"
                        stroke="currentColor"
                        stroke-width="1.8"
                        stroke-linecap="round"
                    />

                    <circle
                        cx="12"
                        cy="16"
                        r="0.8"
                        fill="currentColor"
                    />

                </svg>

            </div>

            <strong>
                Unable to load support requests
            </strong>

            <p>
                ${escapeHTML(message)}
            </p>

            <button
                type="button"
                id="retryTicketsBtn"
                style="
                    margin-top:12px;
                    padding:9px 14px;
                    border-radius:10px;
                    border:1px solid rgba(244,197,66,.18);
                    background:rgba(244,197,66,.07);
                    color:#ffe48a;
                    cursor:pointer;
                    font-size:10px;
                    font-weight:700;
                "
            >
                Try Again
            </button>

        </div>
    `;


    const retryButton =
        document.getElementById(
            "retryTicketsBtn"
        );


    if (retryButton) {

        retryButton.addEventListener(
            "click",
            loadSupportTickets
        );

    }

}


/* =========================================================
   DATE FORMAT
========================================================= */

function formatDate(dateValue) {

    if (!dateValue) {
        return "";
    }


    const date =
        new Date(dateValue);


    if (Number.isNaN(date.getTime())) {

        return String(dateValue);

    }


    return date.toLocaleString(
        undefined,
        {
            year: "numeric",
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit"
        }
    );

}


/* =========================================================
   JSON RESPONSE PARSER
========================================================= */

async function parseJSONResponse(response) {

    const text =
        await response.text();


    if (!text) {

        return {};

    }


    try {

        return JSON.parse(text);

    } catch (error) {

        console.error(
            "Invalid JSON response:",
            text
        );


        return {
            success: false,
            message:
                "The server returned an invalid response."
        };

    }

}


/* =========================================================
   HTML ESCAPE
========================================================= */

function escapeHTML(value) {

    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");

}


/* =========================================================
   KEYBOARD ACCESSIBILITY
========================================================= */

document.addEventListener(
    "keydown",
    event => {

        if (event.key === "Escape") {

            closeSidebar();

        }

    }
);


/* =========================================================
   PUBLIC HELPERS
========================================================= */

window.CrownCashSupport = {

    reloadTickets: loadSupportTickets,

    reloadProfile: loadUserProfile,

    openSidebar: openSidebar,

    closeSidebar: closeSidebar

};