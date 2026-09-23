/* ============================================================
   CROWN CASH - REFERRAL TEAM
   File: team.js
   ============================================================ */

"use strict";

const API_URL = "https://crown-cash1.onrender.com";

/* ============================================================
   PAGE ELEMENTS
   ============================================================ */

const referralCodeInput =
    document.getElementById("referralCode");

const referralLinkInput =
    document.getElementById("referralLink");

const copyCodeBtn =
    document.getElementById("copyCodeBtn");

const copyLinkBtn =
    document.getElementById("copyLinkBtn");

const shareBtn =
    document.getElementById("shareBtn");

const copyMessage =
    document.getElementById("copyMessage");

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

/*
 * IMPORTANT:
 * team.html uses id="teamList".
 */
const teamList =
    document.getElementById("teamList");

/* ============================================================
   FORMAT MONEY
   ============================================================ */

function formatMoney(amount) {

    const number = Number(amount || 0);

    return (
        "UGX " +
        number.toLocaleString("en-UG")
    );
}

/* ============================================================
   ESCAPE HTML
   ============================================================ */

function escapeHtml(value) {

    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

/* ============================================================
   SHOW COPY MESSAGE
   ============================================================ */

function showCopyMessage(message, success = true) {

    const box =
        document.getElementById("copyMessage");

    if (!box) {
        return;
    }

    box.textContent = message;

    box.classList.remove(
        "show",
        "success",
        "error"
    );

    box.classList.add(
        success ? "success" : "error"
    );

    /*
     * Force animation restart.
     */
    void box.offsetWidth;

    box.classList.add("show");

    clearTimeout(
        window.crownCashCopyMessageTimer
    );

    window.crownCashCopyMessageTimer =
        setTimeout(() => {

            box.classList.remove("show");

        }, 3000);
}

/* ============================================================
   COPY TEXT
   ============================================================ */

async function copyText(text) {

    const value =
        String(text || "").trim();

    if (!value) {
        return false;
    }

    /*
     * METHOD 1:
     * Modern Clipboard API.
     */
    try {

        if (
            navigator.clipboard &&
            typeof navigator.clipboard.writeText ===
                "function"
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

    /*
     * METHOD 2:
     * Older browser fallback.
     */
    try {

        const textarea =
            document.createElement("textarea");

        textarea.value = value;

        textarea.setAttribute(
            "readonly",
            ""
        );

        textarea.style.position =
            "fixed";

        textarea.style.left =
            "-99999px";

        textarea.style.top =
            "0";

        textarea.style.width =
            "1px";

        textarea.style.height =
            "1px";

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

        const successful =
            document.execCommand("copy");

        document.body.removeChild(
            textarea
        );

        return successful === true;

    } catch (error) {

        console.error(
            "Copy fallback failed:",
            error
        );

        return false;
    }
}

/* ============================================================
   COPY REFERRAL CODE
   ============================================================ */

async function copyReferralCode() {

    if (!referralCodeInput) {

        showCopyMessage(
            "Referral code field was not found.",
            false
        );

        return;
    }

    const code =
        referralCodeInput.value.trim();

    if (
        !code ||
        code.toLowerCase() === "loading..."
    ) {

        showCopyMessage(
            "Your referral code is still loading.",
            false
        );

        return;
    }

    const copied =
        await copyText(code);

    if (copied) {

        showCopyMessage(
            "Referral code copied successfully!",
            true
        );

        /*
         * Change button temporarily.
         */
        if (copyCodeBtn) {

            const original =
                copyCodeBtn.innerHTML;

            copyCodeBtn.innerHTML = `
                <i class="fa-solid fa-check"></i>
                <span>Copied!</span>
            `;

            copyCodeBtn.classList.add(
                "copied"
            );

            setTimeout(() => {

                copyCodeBtn.innerHTML =
                    original;

                copyCodeBtn.classList.remove(
                    "copied"
                );

            }, 2000);
        }

    } else {

        /*
         * If browser blocks clipboard,
         * select the input so the user can
         * manually copy it.
         */
        referralCodeInput.focus();

        referralCodeInput.select();

        showCopyMessage(
            "Copy was blocked by your browser. The code has been selected; tap Copy.",
            false
        );
    }
}

/* ============================================================
   COPY REFERRAL LINK
   ============================================================ */

async function copyReferralLink() {

    if (!referralLinkInput) {

        showCopyMessage(
            "Referral link field was not found.",
            false
        );

        return;
    }

    const link =
        referralLinkInput.value.trim();

    if (
        !link ||
        link.toLowerCase() === "loading..."
    ) {

        showCopyMessage(
            "Your referral link is still loading.",
            false
        );

        return;
    }

    const copied =
        await copyText(link);

    if (copied) {

        showCopyMessage(
            "Referral link copied successfully!",
            true
        );

        if (copyLinkBtn) {

            const original =
                copyLinkBtn.innerHTML;

            copyLinkBtn.innerHTML = `
                <i class="fa-solid fa-check"></i>
                <span>Copied!</span>
            `;

            copyLinkBtn.classList.add(
                "copied"
            );

            setTimeout(() => {

                copyLinkBtn.innerHTML =
                    original;

                copyLinkBtn.classList.remove(
                    "copied"
                );

            }, 2000);
        }

    } else {

        referralLinkInput.focus();

        referralLinkInput.select();

        showCopyMessage(
            "Copy was blocked by your browser. The link has been selected; tap Copy.",
            false
        );
    }
}

/* ============================================================
   SHARE REFERRAL LINK
   ============================================================ */

async function shareReferralLink() {

    const link =
        referralLinkInput
            ? referralLinkInput.value.trim()
            : "";

    const code =
        referralCodeInput
            ? referralCodeInput.value.trim()
            : "";

    if (
        !link ||
        link.toLowerCase() === "loading..."
    ) {

        showCopyMessage(
            "Your referral link is still loading.",
            false
        );

        return;
    }

    /*
     * Native Android / browser sharing.
     */
    if (
        navigator.share &&
        typeof navigator.share === "function"
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

            /*
             * User simply cancelled sharing.
             */
            if (
                error &&
                error.name === "AbortError"
            ) {
                return;
            }

            console.warn(
                "Native sharing failed:",
                error
            );
        }
    }

    /*
     * WhatsApp fallback.
     */
    const message =
        "Join Crown Cash using my referral link:\n\n" +
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

/* ============================================================
   SHOW TEAM LOADING
   ============================================================ */

function showLoadingState() {

    if (!teamList) {
        return;
    }

    teamList.innerHTML = `

        <div class="loading-team">

            <div class="loading-spinner"></div>

            <p>Loading team members...</p>

        </div>

    `;
}

/* ============================================================
   SHOW TEAM ERROR
   ============================================================ */

function showTeamError(message) {

    if (!teamList) {
        return;
    }

    teamList.innerHTML = `

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
                ${escapeHtml(
                    message ||
                    "Please try again."
                )}
            </p>

            <button
                type="button"
                class="retry-btn"
                id="retryTeamBtn"
            >
                <i class="fa-solid fa-rotate-right"></i>
                Try Again
            </button>

        </div>

    `;

    const retryButton =
        document.getElementById(
            "retryTeamBtn"
        );

    if (retryButton) {

        retryButton.addEventListener(
            "click",
            loadReferralData
        );
    }
}

/* ============================================================
   SHOW EMPTY TEAM
   ============================================================ */

function showEmptyTeam() {

    if (!teamList) {
        return;
    }

    teamList.innerHTML = `

        <div class="empty-state">

            <div class="empty-icon">

                <svg
                    viewBox="0 0 24 24"
                    width="32"
                    height="32"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.8"
                    stroke-linecap="round"
                    stroke-linejoin="round"
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
}

/* ============================================================
   LOAD REFERRAL DATA
   ============================================================ */

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

        let data = null;

        try {

            data =
                await response.json();

        } catch (error) {

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
                data?.message ||
                `Referral request failed (${response.status}).`
            );
        }

        if (
            !data ||
            data.success !== true
        ) {

            throw new Error(
                data?.message ||
                "Unable to load referral data."
            );
        }

        /* ====================================================
           REFERRAL CODE
           ==================================================== */

        const code =
            String(
                data.referral_code ||
                data.referralCode ||
                ""
            ).trim();

        if (referralCodeInput) {

            referralCodeInput.value =
                code || "Unavailable";
        }

        /* ====================================================
           REFERRAL LINK
           ==================================================== */

        let link =
            String(
                data.referral_link ||
                data.referralLink ||
                ""
            ).trim();

        /*
         * Build the link ourselves if backend
         * doesn't return one.
         */
        if (
            !link &&
            code
        ) {

            link =
                "https://crown-cash.vercel.app/register.html?ref=" +
                encodeURIComponent(code);
        }

        if (referralLinkInput) {

            referralLinkInput.value =
                link || "Unavailable";
        }

        /* ====================================================
           COUNTS
           ==================================================== */

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

        /* ====================================================
           EARNINGS
           ==================================================== */

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

        /* ====================================================
           COMMISSION STRUCTURE
           ==================================================== */

        const commission =
            data.commission_structure ||
            {};

        const level1Percent =
            document.getElementById(
                "level1Percent"
            );

        const level2Percent =
            document.getElementById(
                "level2Percent"
            );

        const level3Percent =
            document.getElementById(
                "level3Percent"
            );

        if (level1Percent) {

            level1Percent.textContent =
                Number(
                    commission.l1 ??
                    15
                ) + "%";
        }

        if (level2Percent) {

            level2Percent.textContent =
                Number(
                    commission.l2 ??
                    5
                ) + "%";
        }

        if (level3Percent) {

            level3Percent.textContent =
                Number(
                    commission.l3 ??
                    2
                ) + "%";
        }

        /* ====================================================
           TEAM MEMBERS
           ==================================================== */

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

        showTeamError(
            error.message ||
            "Unable to load team members."
        );
    }
}

/* ============================================================
   RENDER TEAM MEMBERS
   ============================================================ */

function renderMembers(members) {

    if (!teamList) {
        return;
    }

    if (
        !Array.isArray(members) ||
        members.length === 0
    ) {

        showEmptyTeam();

        return;
    }

    teamList.innerHTML = "";

    members.forEach(member => {

        const name =
            String(
                member.name ||
                member.full_name ||
                "Crown Cash Member"
            ).trim();

        const level =
            String(
                member.level ||
                member.referral_level ||
                "L1"
            ).toUpperCase();

        const phone =
            String(
                member.phone ||
                member.phone_number ||
                ""
            ).trim();

        const status =
            String(
                member.status ||
                "active"
            );

        const card =
            document.createElement(
                "div"
            );

        card.className =
            "team-member-card";

        card.dataset.level =
            level;

        card.innerHTML = `

            <div class="member-avatar">

                <svg
                    viewBox="0 0 24 24"
                    width="23"
                    height="23"
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

                <p>
                    ${
                        phone
                            ? escapeHtml(phone)
                            : "Crown Cash Member"
                    }
                </p>

            </div>

            <div class="member-meta">

                <span class="member-level">
                    ${escapeHtml(level)}
                </span>

                <small>
                    ${escapeHtml(status)}
                </small>

            </div>

        `;

        teamList.appendChild(card);
    });

    applyCurrentFilter();
}

/* ============================================================
   FILTERS
   ============================================================ */

function setupFilters() {

    const filterButtons =
        document.querySelectorAll(
            ".filter-btn[data-level]"
        );

    if (!filterButtons.length) {
        return;
    }

    filterButtons.forEach(button => {

        if (
            button.dataset.filterReady ===
            "true"
        ) {
            return;
        }

        button.dataset.filterReady =
            "true";

        button.addEventListener(
            "click",
            function () {

                filterButtons.forEach(btn => {

                    btn.classList.remove(
                        "active"
                    );
                });

                this.classList.add(
                    "active"
                );

                applyCurrentFilter();
            }
        );
    });
}

/* ============================================================
   APPLY CURRENT FILTER
   ============================================================ */

function applyCurrentFilter() {

    const activeButton =
        document.querySelector(
            ".filter-btn.active[data-level]"
        );

    const filter =
        activeButton
            ? activeButton.dataset.level
            : "all";

    const cards =
        document.querySelectorAll(
            ".team-member-card"
        );

    cards.forEach(card => {

        const cardLevel =
            String(
                card.dataset.level ||
                ""
            ).toUpperCase();

        if (
            filter === "all" ||
            cardLevel ===
                String(filter).toUpperCase()
        ) {

            card.style.display =
                "flex";

        } else {

            card.style.display =
                "none";
        }
    });
}

/* ============================================================
   LOGOUT
   ============================================================ */

async function logoutUser() {

    try {

        await fetch(
            `${API_URL}/logout.php`,
            {
                method: "POST",
                credentials: "include"
            }
        );

    } catch (error) {

        console.warn(
            "Logout request failed:",
            error
        );
    }

    try {

        localStorage.removeItem(
            "crownCashUser"
        );

        localStorage.removeItem(
            "user"
        );

        localStorage.removeItem(
            "loggedIn"
        );

    } catch (error) {

        console.warn(
            "Could not clear local storage:",
            error
        );
    }

    window.location.href =
        "/login.html";
}

/* ============================================================
   MOBILE MENU
   ============================================================ */

function setupMobileMenu() {

    const menuToggle =
        document.getElementById(
            "menuToggle"
        );

    const sidebar =
        document.getElementById(
            "sidebar"
        );

    const closeSidebar =
        document.getElementById(
            "closeSidebar"
        );

    const overlay =
        document.getElementById(
            "sidebarOverlay"
        );

    if (
        menuToggle &&
        sidebar
    ) {

        menuToggle.addEventListener(
            "click",
            function () {

                sidebar.classList.add(
                    "active"
                );

                if (overlay) {

                    overlay.classList.add(
                        "active"
                    );
                }
            }
        );
    }

    if (closeSidebar) {

        closeSidebar.addEventListener(
            "click",
            closeMobileSidebar
        );
    }

    if (overlay) {

        overlay.addEventListener(
            "click",
            closeMobileSidebar
        );
    }
}

function closeMobileSidebar() {

    const sidebar =
        document.getElementById(
            "sidebar"
        );

    const overlay =
        document.getElementById(
            "sidebarOverlay"
        );

    if (sidebar) {

        sidebar.classList.remove(
            "active"
        );
    }

    if (overlay) {

        overlay.classList.remove(
            "active"
        );
    }
}

/* ============================================================
   BUTTON EVENTS
   ============================================================ */

function setupButtonEvents() {

    /*
     * COPY REFERRAL CODE
     */
    if (copyCodeBtn) {

        copyCodeBtn.addEventListener(
            "click",
            copyReferralCode
        );
    }

    /*
     * COPY REFERRAL LINK
     */
    if (copyLinkBtn) {

        copyLinkBtn.addEventListener(
            "click",
            copyReferralLink
        );
    }

    /*
     * SHARE
     */
    if (shareBtn) {

        shareBtn.addEventListener(
            "click",
            shareReferralLink
        );
    }

    /*
     * LOGOUT
     */
    const logoutBtn =
        document.getElementById(
            "logoutBtn"
        );

    if (logoutBtn) {

        logoutBtn.addEventListener(
            "click",
            logoutUser
        );
    }
}

/* ============================================================
   START PAGE
   ============================================================ */

function initializeReferralPage() {

    setupMobileMenu();

    setupButtonEvents();

    setupFilters();

    loadReferralData();
}

/* ============================================================
   DOM READY
   ============================================================ */

if (
    document.readyState ===
    "loading"
) {

    document.addEventListener(
        "DOMContentLoaded",
        initializeReferralPage
    );

} else {

    initializeReferralPage();
}

/* ============================================================
   GLOBAL FUNCTIONS
   ============================================================ */

window.loadReferralData =
    loadReferralData;

window.copyReferralCode =
    copyReferralCode;

window.copyReferralLink =
    copyReferralLink;

window.shareReferralLink =
    shareReferralLink;

window.logoutUser =
    logoutUser;