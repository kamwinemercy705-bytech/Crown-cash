/* =========================================================
   CROWN CASH - REFERRAL TEAM JAVASCRIPT
   ========================================================= */

"use strict";


/* =========================================================
   CONFIGURATION
   ========================================================= */

const API_URL = "https://crown-cash1.onrender.com";

const REFERRAL_PERCENTAGES = {
    L1: 15,
    L2: 5,
    L3: 2
};


/* =========================================================
   ELEMENTS
   ========================================================= */

const totalTeamEl = document.getElementById("totalTeam");

const level1CountEl = document.getElementById("level1Count");
const level2CountEl = document.getElementById("level2Count");
const level3CountEl = document.getElementById("level3Count");

const referralCodeEl = document.getElementById("referralCode");
const referralLinkEl = document.getElementById("referralLink");

const level1IncomeEl = document.getElementById("level1Income");
const level2IncomeEl = document.getElementById("level2Income");
const level3IncomeEl = document.getElementById("level3Income");
const totalIncomeEl = document.getElementById("totalIncome");

const teamListEl = document.getElementById("teamList");

const copyCodeBtn = document.getElementById("copyCodeBtn");
const copyLinkBtn = document.getElementById("copyLinkBtn");
const shareBtn = document.getElementById("shareBtn");

const copyMessageEl = document.getElementById("copyMessage");

const toastEl = document.getElementById("toast");
const toastMessageEl = document.getElementById("toastMessage");

const filterButtons = document.querySelectorAll(".filter-btn");

const menuToggle = document.getElementById("menuToggle");
const closeSidebar = document.getElementById("closeSidebar");
const sidebar = document.getElementById("sidebar");
const sidebarOverlay = document.getElementById("sidebarOverlay");

const logoutBtn = document.getElementById("logoutBtn");


/* =========================================================
   STATE
   ========================================================= */

let teamMembers = [];

let currentFilter = "all";

let referralData = {
    referral_code: "",
    referral_link: "",

    counts: {
        total: 0,
        L1: 0,
        L2: 0,
        L3: 0
    },

    earnings: {
        L1: 0,
        L2: 0,
        L3: 0,
        total: 0
    },

    members: []
};


/* =========================================================
   INITIALIZE COMMISSION PERCENTAGES
   ========================================================= */

function initializeCommissionPercentages() {

    const l1 = document.getElementById("level1Percent");
    const l2 = document.getElementById("level2Percent");
    const l3 = document.getElementById("level3Percent");

    if (l1) {
        l1.textContent = REFERRAL_PERCENTAGES.L1 + "%";
    }

    if (l2) {
        l2.textContent = REFERRAL_PERCENTAGES.L2 + "%";
    }

    if (l3) {
        l3.textContent = REFERRAL_PERCENTAGES.L3 + "%";
    }

}


/* =========================================================
   FORMAT UGX
   ========================================================= */

function formatUGX(value) {

    const number = Number(value) || 0;

    return "UGX " + new Intl.NumberFormat("en-UG", {
        maximumFractionDigits: 0
    }).format(number);

}


/* =========================================================
   ESCAPE HTML
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
   INITIALS
   ========================================================= */

function getInitials(name) {

    const cleanName = String(name || "").trim();

    if (!cleanName) {
        return "U";
    }

    const parts = cleanName.split(/\s+/);

    if (parts.length === 1) {
        return parts[0].substring(0, 2).toUpperCase();
    }

    return (
        parts[0].charAt(0) +
        parts[parts.length - 1].charAt(0)
    ).toUpperCase();

}


/* =========================================================
   DATE FORMAT
   ========================================================= */

function formatDate(value) {

    if (!value) {
        return "—";
    }

    try {

        const date = new Date(value);

        if (Number.isNaN(date.getTime())) {
            return "—";
        }

        return date.toLocaleDateString("en-UG", {
            day: "2-digit",
            month: "short",
            year: "numeric"
        });

    } catch (error) {

        return "—";

    }

}


/* =========================================================
   SHOW TOAST
   ========================================================= */

function showToast(message) {

    if (!toastEl || !toastMessageEl) {
        return;
    }

    toastMessageEl.textContent = message;

    toastEl.classList.add("show");

    setTimeout(() => {
        toastEl.classList.remove("show");
    }, 2500);

}


/* =========================================================
   COPY TEXT
   ========================================================= */

async function copyText(text, successMessage) {

    if (!text) {
        return;
    }

    try {

        if (navigator.clipboard &&
            window.isSecureContext) {

            await navigator.clipboard.writeText(text);

        } else {

            const temporaryInput =
                document.createElement("textarea");

            temporaryInput.value = text;

            temporaryInput.style.position = "fixed";
            temporaryInput.style.opacity = "0";

            document.body.appendChild(temporaryInput);

            temporaryInput.focus();
            temporaryInput.select();

            document.execCommand("copy");

            temporaryInput.remove();
        }

        if (copyMessageEl) {
            copyMessageEl.textContent = successMessage;

            setTimeout(() => {
                copyMessageEl.textContent = "";
            }, 2500);
        }

        showToast(successMessage);

    } catch (error) {

        showToast("Unable to copy. Please copy it manually.");

    }

}


/* =========================================================
   BUILD REFERRAL LINK
   ========================================================= */

function buildReferralLink(code) {

    if (!code) {
        return "";
    }

    /*
       Your Crown Cash frontend is hosted on Vercel.

       The referral link points to the homepage and adds
       the referral code as ?ref=CODE.
    */

    return (
        "https://crown-cash.vercel.app/" +
        "?ref=" +
        encodeURIComponent(code)
    );

}


/* =========================================================
   DISPLAY REFERRAL INFORMATION
   ========================================================= */

function displayReferralInformation() {

    const code =
        referralData.referral_code || "";

    let link =
        referralData.referral_link || "";

    if (!link && code) {
        link = buildReferralLink(code);
    }

    referralCodeEl.value =
        code || "Not available";

    referralLinkEl.value =
        link || "Not available";

}


/* =========================================================
   DISPLAY SUMMARY
   ========================================================= */

function displaySummary() {

    const counts = referralData.counts || {};

    totalTeamEl.textContent =
        Number(counts.total || 0);

    level1CountEl.textContent =
        Number(counts.L1 || 0);

    level2CountEl.textContent =
        Number(counts.L2 || 0);

    level3CountEl.textContent =
        Number(counts.L3 || 0);

}


/* =========================================================
   DISPLAY EARNINGS
   ========================================================= */

function displayEarnings() {

    const earnings = referralData.earnings || {};

    const l1 = Number(earnings.L1 || 0);
    const l2 = Number(earnings.L2 || 0);
    const l3 = Number(earnings.L3 || 0);

    let total = Number(earnings.total);

    /*
       If backend does not provide total, calculate it
       from the three returned earning values.
    */

    if (!Number.isFinite(total)) {
        total = l1 + l2 + l3;
    }

    level1IncomeEl.textContent =
        formatUGX(l1);

    level2IncomeEl.textContent =
        formatUGX(l2);

    level3IncomeEl.textContent =
        formatUGX(l3);

    totalIncomeEl.textContent =
        formatUGX(total);

}


/* =========================================================
   NORMALIZE MEMBER
   ========================================================= */

function normalizeMember(member) {

    if (!member || typeof member !== "object") {
        return null;
    }

    const name =
        member.name ||
        member.full_name ||
        member.fullName ||
        (
            [
                member.first_name,
                member.last_name
            ]
            .filter(Boolean)
            .join(" ")
        ) ||
        "Crown Cash Member";

    const level =
        String(
            member.level ||
            member.referral_level ||
            member.referralLevel ||
            "L1"
        ).toUpperCase();

    const date =
        member.created_at ||
        member.joined_at ||
        member.member_since ||
        member.date ||
        null;

    const phone =
        member.phone ||
        member.phone_number ||
        "";

    return {
        name,
        level: ["L1", "L2", "L3"].includes(level)
            ? level
            : "L1",
        date,
        phone
    };

}


/* =========================================================
   DISPLAY TEAM
   ========================================================= */

function displayTeam() {

    if (!teamListEl) {
        return;
    }

    let members =
        Array.isArray(teamMembers)
            ? teamMembers
            : [];

    if (currentFilter !== "all") {

        members = members.filter(
            member =>
                String(member.level).toUpperCase() ===
                currentFilter
        );

    }


    /* EMPTY */

    if (members.length === 0) {

        teamListEl.innerHTML = `
            <div class="empty-team">

                <i class="fa-solid fa-users"></i>

                <h3>
                    ${
                        currentFilter === "all"
                            ? "No team members yet"
                            : "No members in " + currentFilter
                    }
                </h3>

                <p>
                    ${
                        currentFilter === "all"
                            ? "Share your referral link to start building your Crown Cash team."
                            : "There are currently no members at this referral level."
                    }
                </p>

            </div>
        `;

        return;
    }


    /* MEMBERS */

    teamListEl.innerHTML =
        members.map(member => {

            const name =
                escapeHTML(member.name);

            const level =
                escapeHTML(member.level);

            const phone =
                escapeHTML(member.phone);

            const date =
                formatDate(member.date);

            const initials =
                escapeHTML(getInitials(member.name));

            return `
                <div class="team-member">

                    <div class="member-avatar">
                        ${initials}
                    </div>

                    <div class="member-info">

                        <strong>
                            ${name}
                        </strong>

                        <span>
                            ${
                                phone
                                    ? phone
                                    : "Crown Cash member"
                            }
                        </span>

                    </div>

                    <div class="member-level">
                        ${level}
                    </div>

                    <div class="member-date">
                        ${date}
                    </div>

                </div>
            `;

        }).join("");

}


/* =========================================================
   FETCH REFERRAL DATA
   ========================================================= */

async function loadReferralData() {

    try {

        /*
           This endpoint should return the authenticated
           user's referral information.

           Expected response example:

           {
             "success": true,
             "referral_code": "CROWN1234",
             "counts": {
                "total": 3,
                "L1": 2,
                "L2": 1,
                "L3": 0
             },
             "earnings": {
                "L1": 5000,
                "L2": 1000,
                "L3": 0,
                "total": 6000
             },
             "members": []
           }
        */

        const response = await fetch(
            API_URL + "/referral.php",
            {
                method: "GET",

                credentials: "include",

                headers: {
                    "Accept": "application/json"
                }
            }
        );


        const text =
            await response.text();

        let data;

        try {

            data = JSON.parse(text);

        } catch (parseError) {

            throw new Error(
                "The referral server returned an invalid response."
            );

        }


        if (!response.ok || data.success === false) {

            throw new Error(
                data.message ||
                "Unable to load referral information."
            );

        }


        /*
           Accept several possible backend field names
           so the frontend remains flexible.
        */

        const counts =
            data.counts ||
            data.team_counts ||
            data.team ||
            {};

        const earnings =
            data.earnings ||
            data.referral_earnings ||
            data.income ||
            {};


        referralData = {

            referral_code:
                data.referral_code ||
                data.referralCode ||
                data.code ||
                "",

            referral_link:
                data.referral_link ||
                data.referralLink ||
                "",

            counts: {

                total:
                    counts.total ??
                    counts.total_team ??
                    data.total_team ??
                    data.total_referrals ??
                    0,

                L1:
                    counts.L1 ??
                    counts.l1 ??
                    data.level1_count ??
                    0,

                L2:
                    counts.L2 ??
                    counts.l2 ??
                    data.level2_count ??
                    0,

                L3:
                    counts.L3 ??
                    counts.l3 ??
                    data.level3_count ??
                    0

            },

            earnings: {

                L1:
                    earnings.L1 ??
                    earnings.l1 ??
                    earnings.level1 ??
                    data.level1_income ??
                    0,

                L2:
                    earnings.L2 ??
                    earnings.l2 ??
                    earnings.level2 ??
                    data.level2_income ??
                    0,

                L3:
                    earnings.L3 ??
                    earnings.l3 ??
                    earnings.level3 ??
                    data.level3_income ??
                    0,

                total:
                    earnings.total ??
                    earnings.total_income ??
                    data.total_referral_income

            },

            members:
                Array.isArray(data.members)
                    ? data.members
                        .map(normalizeMember)
                        .filter(Boolean)
                    : []

        };


        /*
           Save normalized members.
        */

        teamMembers =
            referralData.members;


        displayReferralInformation();

        displaySummary();

        displayEarnings();

        displayTeam();


    } catch (error) {

        console.error(
            "Referral loading error:",
            error
        );


        /*
           Do not destroy the page if the backend
           is temporarily unavailable.
        */

        referralCodeEl.value =
            "Unable to load";

        referralLinkEl.value =
            "Unable to load";


        teamListEl.innerHTML = `
            <div class="empty-team">

                <i class="fa-solid fa-cloud-arrow-down"></i>

                <h3>
                    Unable to load referral data
                </h3>

                <p>
                    Please refresh the page and try again.
                </p>

            </div>
        `;

    }

}


/* =========================================================
   COPY REFERRAL CODE
   ========================================================= */

copyCodeBtn.addEventListener(
    "click",
    () => {

        const code =
            referralData.referral_code ||
            referralCodeEl.value;

        if (
            !code ||
            code === "Not available" ||
            code === "Unable to load"
        ) {

            showToast(
                "Referral code is not available."
            );

            return;
        }

        copyText(
            code,
            "Referral code copied."
        );

    }
);


/* =========================================================
   COPY REFERRAL LINK
   ========================================================= */

copyLinkBtn.addEventListener(
    "click",
    () => {

        let link =
            referralData.referral_link;

        if (!link && referralData.referral_code) {

            link =
                buildReferralLink(
                    referralData.referral_code
                );

        }

        if (
            !link ||
            link === "Not available" ||
            link === "Unable to load"
        ) {

            showToast(
                "Referral link is not available."
            );

            return;
        }

        copyText(
            link,
            "Referral link copied."
        );

    }
);


/* =========================================================
   SHARE
   ========================================================= */

shareBtn.addEventListener(
    "click",
    async () => {

        let link =
            referralData.referral_link;

        if (!link && referralData.referral_code) {

            link =
                buildReferralLink(
                    referralData.referral_code
                );

        }

        if (!link) {

            showToast(
                "Referral link is not available."
            );

            return;
        }


        const shareText =
            "Join me on Crown Cash and start building your financial future.";


        /*
           Native phone share
        */

        if (
            navigator.share
        ) {

            try {

                await navigator.share({
                    title: "Join Crown Cash",
                    text: shareText,
                    url: link
                });

                return;

            } catch (error) {

                /*
                   User cancelled share.
                   Do nothing.
                */

                if (
                    error &&
                    error.name === "AbortError"
                ) {
                    return;
                }

            }

        }


        /*
           If native share is unavailable,
           copy the referral link.
        */

        await copyText(
            link,
            "Referral link copied. You can share it with your friends."
        );

    }
);


/* =========================================================
   FILTERS
   ========================================================= */

filterButtons.forEach(button => {

    button.addEventListener(
        "click",
        () => {

            filterButtons.forEach(
                item =>
                    item.classList.remove("active")
            );

            button.classList.add("active");

            currentFilter =
                button.dataset.level ||
                "all";

            displayTeam();

        }
    );

});


/* =========================================================
   MOBILE SIDEBAR
   ========================================================= */

function openSidebar() {

    if (sidebar) {
        sidebar.classList.add("open");
    }

    if (sidebarOverlay) {
        sidebarOverlay.style.display = "block";
    }

}


function closeSidebarMenu() {

    if (sidebar) {
        sidebar.classList.remove("open");
    }

    if (sidebarOverlay) {
        sidebarOverlay.style.display = "none";
    }

}


if (menuToggle) {

    menuToggle.addEventListener(
        "click",
        openSidebar
    );

}


if (closeSidebar) {

    closeSidebar.addEventListener(
        "click",
        closeSidebarMenu
    );

}


if (sidebarOverlay) {

    sidebarOverlay.addEventListener(
        "click",
        closeSidebarMenu
    );

}


/* =========================================================
   LOGOUT
   ========================================================= */

if (logoutBtn) {

    logoutBtn.addEventListener(
        "click",
        async () => {

            try {

                /*
                   If you have logout.php, use it here.
                   The frontend also clears the local session
                   state before returning to login.
                */

                await fetch(
                    API_URL + "/logout.php",
                    {
                        method: "POST",
                        credentials: "include"
                    }
                );

            } catch (error) {

                console.warn(
                    "Logout endpoint unavailable.",
                    error
                );

            }


            localStorage.removeItem(
                "crownCashUser"
            );

            sessionStorage.clear();

            window.location.href =
                "login.html";

        }
    );

}


/* =========================================================
   CLOSE SIDEBAR WHEN NAVIGATION LINK IS CLICKED
   ========================================================= */

document.querySelectorAll(
    ".sidebar-nav a"
).forEach(link => {

    link.addEventListener(
        "click",
        closeSidebarMenu
    );

});


/* =========================================================
   START
   ========================================================= */

initializeCommissionPercentages();

loadReferralData();