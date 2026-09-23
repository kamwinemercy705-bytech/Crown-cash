/* ==========================================
   CROWN CASH - REFERRAL TEAM
   File: team.js
========================================== */

const API_URL = "https://crown-cash1.onrender.com";


// ==========================================
// PAGE ELEMENTS
// ==========================================

const referralCodeInput =
    document.getElementById("referralCode");

const referralLinkInput =
    document.getElementById("referralLink");

const totalTeam =
    document.getElementById("totalTeam");

const level1Count =
    document.getElementById("level1Count");

const level2Count =
    document.getElementById("level2Count");

const level3Count =
    document.getElementById("level3Count");

const level1Income =
    document.getElementById("level1Income");

const level2Income =
    document.getElementById("level2Income");

const level3Income =
    document.getElementById("level3Income");

const totalIncome =
    document.getElementById("totalIncome");

const teamMembers =
    document.getElementById("teamMembers");


// ==========================================
// FORMAT MONEY
// ==========================================

function formatMoney(amount) {

    const number =
        Number(amount || 0);

    return (
        "UGX " +
        number.toLocaleString("en-UG")
    );
}


// ==========================================
// ESCAPE HTML
// ==========================================

function escapeHtml(value) {

    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


// ==========================================
// LOADING STATE
// ==========================================

function showLoadingState() {

    if (!teamMembers) {
        return;
    }

    teamMembers.innerHTML = `
        <div class="loading-state">

            <div class="loading-icon">
                <svg
                    viewBox="0 0 24 24"
                    width="28"
                    height="28"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.8"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    aria-hidden="true"
                >
                    <path d="M12 2v4"></path>
                    <path d="M12 18v4"></path>
                    <path d="m4.93 4.93 2.83 2.83"></path>
                    <path d="m16.24 16.24 2.83 2.83"></path>
                    <path d="M2 12h4"></path>
                    <path d="M18 12h4"></path>
                    <path d="m4.93 19.07 2.83-2.83"></path>
                    <path d="m16.24 7.76 2.83-2.83"></path>
                </svg>
            </div>

            <p>Loading your team...</p>

        </div>
    `;
}


// ==========================================
// LOAD REFERRAL DATA
// ==========================================

async function loadReferralData() {

    showLoadingState();

    try {

        const response =
            await fetch(
                `${API_URL}/referral.php`,
                {
                    method: "GET",

                    credentials: "include",

                    headers: {
                        "Accept":
                            "application/json"
                    },

                    cache: "no-store"
                }
            );


        let data;

        try {

            data =
                await response.json();

        } catch (jsonError) {

            throw new Error(
                "The referral server returned an invalid response."
            );
        }


        console.log(
            "Crown Cash referral response:",
            data
        );


        if (!response.ok) {

            throw new Error(
                data.message ||
                `Referral request failed (${response.status}).`
            );
        }


        if (!data.success) {

            throw new Error(
                data.message ||
                "Unable to load referral data."
            );
        }


        // ==================================
        // REFERRAL CODE
        // ==================================

        const code =
            String(
                data.referral_code ||
                data.referralCode ||
                ""
            ).trim();


        if (referralCodeInput) {

            referralCodeInput.value =
                code;
        }


        // ==================================
        // REFERRAL LINK
        // ==================================

        let link =
            String(
                data.referral_link ||
                data.referralLink ||
                ""
            ).trim();


        if (!link && code) {

            link =
                "https://crown-cash.vercel.app/register.html?ref=" +
                encodeURIComponent(code);
        }


        if (referralLinkInput) {

            referralLinkInput.value =
                link;
        }


        // ==================================
        // COUNTS
        // ==================================

        const counts =
            data.counts ||
            data.team_counts ||
            {};


        const l1 =
            Number(
                counts.l1 ??
                counts.level1 ??
                0
            );


        const l2 =
            Number(
                counts.l2 ??
                counts.level2 ??
                0
            );


        const l3 =
            Number(
                counts.l3 ??
                counts.level3 ??
                0
            );


        const total =
            Number(
                counts.total ??
                (l1 + l2 + l3)
            );


        if (totalTeam) {
            totalTeam.textContent =
                total;
        }


        if (level1Count) {
            level1Count.textContent =
                l1;
        }


        if (level2Count) {
            level2Count.textContent =
                l2;
        }


        if (level3Count) {
            level3Count.textContent =
                l3;
        }


        // ==================================
        // EARNINGS
        // ==================================

        const earnings =
            data.earnings ||
            data.referral_earnings ||
            {};


        const incomeL1 =
            Number(
                earnings.l1 ??
                earnings.level1 ??
                0
            );


        const incomeL2 =
            Number(
                earnings.l2 ??
                earnings.level2 ??
                0
            );


        const incomeL3 =
            Number(
                earnings.l3 ??
                earnings.level3 ??
                0
            );


        const incomeTotal =
            Number(
                earnings.total ??
                (
                    incomeL1 +
                    incomeL2 +
                    incomeL3
                )
            );


        if (level1Income) {

            level1Income.textContent =
                formatMoney(incomeL1);
        }


        if (level2Income) {

            level2Income.textContent =
                formatMoney(incomeL2);
        }


        if (level3Income) {

            level3Income.textContent =
                formatMoney(incomeL3);
        }


        if (totalIncome) {

            totalIncome.textContent =
                formatMoney(incomeTotal);
        }


        // ==================================
        // MEMBERS
        // ==================================

        const members =
            Array.isArray(data.members)
                ? data.members
                : [];


        renderMembers(members);


    } catch (error) {

        console.error(
            "Crown Cash referral loading error:",
            error
        );


        if (teamMembers) {

            teamMembers.innerHTML = `

                <div class="error-state">

                    <div class="error-icon">

                        <svg
                            viewBox="0 0 24 24"
                            width="30"
                            height="30"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="1.8"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            aria-hidden="true"
                        >
                            <path d="M10.3 3.2 2.6 17a2 2 0 0 0 1.7 3h15.4a2 2 0 0 0 1.7-3L13.7 3.2a2 2 0 0 0-3.4 0Z"></path>
                            <path d="M12 9v4"></path>
                            <path d="M12 17h.01"></path>
                        </svg>

                    </div>

                    <h3>
                        Unable to load your team
                    </h3>

                    <p>
                        ${
                            escapeHtml(
                                error.message ||
                                "Please refresh the page and try again."
                            )
                        }
                    </p>

                    <button
                        type="button"
                        class="retry-btn"
                        onclick="loadReferralData()"
                    >

                        <svg
                            viewBox="0 0 24 24"
                            width="18"
                            height="18"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="2"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            aria-hidden="true"
                        >
                            <path d="M21 12a9 9 0 1 1-2.64-6.36"></path>
                            <path d="M21 3v6h-6"></path>
                        </svg>

                        Try Again

                    </button>

                </div>
            `;
        }
    }
}


// ==========================================
// RENDER MEMBERS
// ==========================================

function renderMembers(members) {

    if (!teamMembers) {
        return;
    }


    if (
        !Array.isArray(members) ||
        members.length === 0
    ) {

        teamMembers.innerHTML = `

            <div class="empty-state">

                <div class="empty-icon">

                    <svg
                        viewBox="0 0 24 24"
                        width="30"
                        height="30"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="1.8"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        aria-hidden="true"
                    >
                        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path>
                        <circle cx="9" cy="7" r="4"></circle>
                        <path d="M22 21v-2a4 4 0 0 0-3-3.87"></path>
                        <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                    </svg>

                </div>

                <h3>
                    No Team Members Yet
                </h3>

                <p>
                    Share your referral link to start
                    building your Crown Cash team.
                </p>

            </div>
        `;

        return;
    }


    teamMembers.innerHTML = "";


    members.forEach(member => {

        const name =
            String(
                member.name ||
                "Crown Cash Member"
            );


        const level =
            String(
                member.level ||
                "L1"
            );


        const phone =
            String(
                member.phone ||
                ""
            );


        const initials =
            name
                .split(/\s+/)
                .filter(Boolean)
                .slice(0, 2)
                .map(
                    word =>
                        word
                            .charAt(0)
                            .toUpperCase()
                )
                .join("");


        const card =
            document.createElement("div");


        card.className =
            "team-member-card";


        card.dataset.level =
            level;


        card.innerHTML = `

            <div class="member-avatar">

                <svg
                    viewBox="0 0 24 24"
                    width="22"
                    height="22"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.7"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    aria-hidden="true"
                >
                    <path d="M20 21a8 8 0 0 0-16 0"></path>
                    <circle cx="12" cy="7" r="4"></circle>
                </svg>

            </div>

            <div class="member-info">

                <h4>
                    ${escapeHtml(name)}
                </h4>

                ${
                    phone
                        ? `
                            <p>
                                ${escapeHtml(phone)}
                            </p>
                        `
                        : `
                            <p>
                                Crown Cash Member
                            </p>
                        `
                }

            </div>

            <span class="member-level">
                ${escapeHtml(level)}
            </span>

        `;


        teamMembers.appendChild(card);

    });


    setupFilters();
}


// ==========================================
// FILTERS
// ==========================================

function setupFilters() {

    const filterButtons =
        document.querySelectorAll(
            "[data-filter]"
        );


    if (!filterButtons.length) {
        return;
    }


    filterButtons.forEach(button => {

        // Prevent duplicate listeners
        if (
            button.dataset.filterReady === "true"
        ) {
            return;
        }


        button.dataset.filterReady =
            "true";


        button.addEventListener(
            "click",
            () => {

                filterButtons.forEach(btn => {

                    btn.classList.remove(
                        "active"
                    );

                });


                button.classList.add(
                    "active"
                );


                const filter =
                    button.dataset.filter ||
                    "all";


                const cards =
                    document.querySelectorAll(
                        ".team-member-card"
                    );


                cards.forEach(card => {

                    if (
                        filter === "all" ||
                        card.dataset.level === filter
                    ) {

                        card.style.display =
                            "flex";

                    } else {

                        card.style.display =
                            "none";
                    }

                });

            }
        );

    });
}


// ==========================================
// COPY TEXT
// ==========================================

async function copyText(text) {

    const value =
        String(text || "").trim();


    if (!value) {

        showCopyMessage(
            "Nothing to copy."
        );

        return false;
    }


    // --------------------------------------
    // Modern clipboard
    // --------------------------------------

    try {

        if (
            navigator.clipboard &&
            window.isSecureContext
        ) {

            await navigator.clipboard.writeText(
                value
            );

            return true;
        }

    } catch (error) {

        console.warn(
            "Clipboard API failed:",
            error
        );
    }


    // --------------------------------------
    // Fallback
    // --------------------------------------

    try {

        const textarea =
            document.createElement(
                "textarea"
            );


        textarea.value =
            value;


        textarea.setAttribute(
            "readonly",
            ""
        );


        textarea.style.position =
            "fixed";

        textarea.style.left =
            "-9999px";

        textarea.style.top =
            "0";

        textarea.style.opacity =
            "0";

        textarea.style.pointerEvents =
            "none";


        document.body.appendChild(
            textarea
        );


        textarea.focus();

        textarea.select();

        textarea.setSelectionRange(
            0,
            textarea.value.length
        );


        const copied =
            document.execCommand(
                "copy"
            );


        textarea.remove();


        if (copied) {
            return true;
        }

    } catch (error) {

        console.error(
            "Fallback copy failed:",
            error
        );
    }


    return false;
}


// ==========================================
// COPY REFERRAL CODE
// ==========================================

async function copyReferralCode() {

    const code =
        referralCodeInput
            ? referralCodeInput.value.trim()
            : "";


    if (!code) {

        showCopyMessage(
            "Your referral code is not available yet."
        );

        return;
    }


    const copied =
        await copyText(code);


    if (copied) {

        showCopyMessage(
            "Referral code copied successfully."
        );

    } else {

        showCopyMessage(
            "Copy failed. Please select the code and copy it manually."
        );
    }
}


// ==========================================
// COPY REFERRAL LINK
// ==========================================

async function copyReferralLink() {

    const link =
        referralLinkInput
            ? referralLinkInput.value.trim()
            : "";


    if (!link) {

        showCopyMessage(
            "Your referral link is not available yet."
        );

        return;
    }


    const copied =
        await copyText(link);


    if (copied) {

        showCopyMessage(
            "Referral link copied successfully."
        );

    } else {

        showCopyMessage(
            "Copy failed. Please select the link and copy it manually."
        );
    }
}


// ==========================================
// COPY MESSAGE
// ==========================================

function showCopyMessage(message) {

    let messageBox =
        document.getElementById(
            "copyMessage"
        );


    if (!messageBox) {

        messageBox =
            document.createElement(
                "div"
            );


        messageBox.id =
            "copyMessage";


        messageBox.className =
            "copy-message";


        document.body.appendChild(
            messageBox
        );
    }


    messageBox.innerHTML = `

        <span class="copy-message-icon">

            <svg
                viewBox="0 0 24 24"
                width="18"
                height="18"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                aria-hidden="true"
            >
                <path d="m9 12 2 2 4-4"></path>
                <circle cx="12" cy="12" r="9"></circle>
            </svg>

        </span>

        <span>
            ${escapeHtml(message)}
        </span>

    `;


    messageBox.classList.remove(
        "show"
    );


    // Restart animation
    void messageBox.offsetWidth;


    messageBox.classList.add(
        "show"
    );


    clearTimeout(
        window.copyMessageTimer
    );


    window.copyMessageTimer =
        setTimeout(() => {

            messageBox.classList.remove(
                "show"
            );

        }, 2800);
}


// ==========================================
// SHARE REFERRAL LINK
// ==========================================

async function shareReferralLink() {

    const link =
        referralLinkInput
            ? referralLinkInput.value.trim()
            : "";


    const code =
        referralCodeInput
            ? referralCodeInput.value.trim()
            : "";


    if (!link) {

        showCopyMessage(
            "Your referral link is not available yet."
        );

        return;
    }


    // --------------------------------------
    // Native mobile/browser sharing
    // --------------------------------------

    if (
        navigator.share &&
        window.isSecureContext
    ) {

        try {

            await navigator.share({

                title:
                    "Join Crown Cash",

                text:
                    code
                        ? `Join Crown Cash using my referral code ${code}.`
                        : "Join Crown Cash using my referral link.",

                url:
                    link

            });


            return;

        } catch (error) {

            if (
                error &&
                error.name === "AbortError"
            ) {
                return;
            }


            console.warn(
                "Native share failed:",
                error
            );
        }
    }


    // --------------------------------------
    // WhatsApp fallback
    // --------------------------------------

    const message =
        "Join Crown Cash using my referral link:\n" +
        link;


    const whatsappUrl =
        "https://wa.me/?text=" +
        encodeURIComponent(message);


    window.open(
        whatsappUrl,
        "_blank",
        "noopener,noreferrer"
    );
}


// ==========================================
// LOGOUT
// ==========================================

async function logoutUserFromTeam() {

    try {

        await fetch(
            `${API_URL}/logout.php`,
            {
                method: "POST",
                credentials: "include"
            }
        );

    } catch (error) {

        console.error(
            "Logout error:",
            error
        );
    }


    localStorage.removeItem(
        "crownCashUser"
    );

    localStorage.removeItem(
        "user"
    );

    localStorage.removeItem(
        "loggedIn"
    );


    window.location.href =
        "/login.html";
}


// ==========================================
// MOBILE MENU
// ==========================================

function setupMobileMenu() {

    const menuToggle =
        document.getElementById(
            "menuToggle"
        );


    const sidebar =
        document.querySelector(
            ".sidebar"
        );


    if (
        !menuToggle ||
        !sidebar
    ) {
        return;
    }


    if (
        menuToggle.dataset.menuReady ===
        "true"
    ) {
        return;
    }


    menuToggle.dataset.menuReady =
        "true";


    menuToggle.addEventListener(
        "click",
        () => {

            sidebar.classList.toggle(
                "active"
            );

        }
    );
}


// ==========================================
// START
// ==========================================

document.addEventListener(
    "DOMContentLoaded",
    () => {

        setupMobileMenu();

        setupFilters();

        loadReferralData();

    }
);


// ==========================================
// GLOBAL FUNCTIONS
// ==========================================

window.loadReferralData =
    loadReferralData;

window.copyReferralCode =
    copyReferralCode;

window.copyReferralLink =
    copyReferralLink;

window.shareReferralLink =
    shareReferralLink;

window.logoutUserFromTeam =
    logoutUserFromTeam;