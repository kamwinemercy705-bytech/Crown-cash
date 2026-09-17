/* =========================================================
   CROWN CASH — REFERRAL TEAM
   team.js
========================================================= */

"use strict";


/* =========================================================
   API CONFIGURATION
========================================================= */

const API_URL = "https://crown-cash1.onrender.com";


/* =========================================================
   DOM ELEMENTS
========================================================= */

const menuBtn = document.getElementById("menuBtn");
const sidebar = document.getElementById("sidebar");

const logoutBtn = document.getElementById("logoutBtn");

const referralLink = document.getElementById("referralLink");
const referralCode = document.getElementById("referralCode");

const copyLinkBtn = document.getElementById("copyLinkBtn");
const copyCodeBtn = document.getElementById("copyCodeBtn");
const emptyCopyBtn = document.getElementById("emptyCopyBtn");

const copyMessage = document.getElementById("copyMessage");

const totalReferrals = document.getElementById("totalReferrals");
const activeMembers = document.getElementById("activeMembers");
const referralEarnings = document.getElementById("referralEarnings");

const teamMessage = document.getElementById("teamMessage");
const teamList = document.getElementById("teamList");
const emptyTeam = document.getElementById("emptyTeam");

const currentYear = document.getElementById("currentYear");


/* =========================================================
   CURRENT YEAR
========================================================= */

if (currentYear) {
    currentYear.textContent = new Date().getFullYear();
}


/* =========================================================
   MOBILE SIDEBAR
========================================================= */

if (menuBtn && sidebar) {

    menuBtn.addEventListener("click", function () {

        sidebar.classList.toggle("open");

    });
}


/* =========================================================
   CLOSE SIDEBAR WHEN LINK IS CLICKED
========================================================= */

document.querySelectorAll(".nav-item").forEach(function (item) {

    item.addEventListener("click", function () {

        if (window.innerWidth <= 768 && sidebar) {

            sidebar.classList.remove("open");

        }

    });

});


/* =========================================================
   FORMAT UGX
========================================================= */

function formatUGX(amount) {

    const number = Number(amount) || 0;

    return "UGX " + number.toLocaleString("en-UG", {
        maximumFractionDigits: 0
    });
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
   GET INITIALS
========================================================= */

function getInitials(name) {

    const text = String(name || "User").trim();

    if (!text) {
        return "U";
    }

    const parts = text
        .split(/\s+/)
        .filter(Boolean);

    if (parts.length === 1) {

        return parts[0]
            .substring(0, 2)
            .toUpperCase();

    }

    return (
        parts[0].charAt(0) +
        parts[parts.length - 1].charAt(0)
    ).toUpperCase();
}


/* =========================================================
   NORMALIZE STATUS
========================================================= */

function normalizeStatus(status) {

    const value = String(status || "active")
        .trim()
        .toLowerCase();

    if (
        value === "blocked" ||
        value === "suspended" ||
        value === "disabled"
    ) {
        return value;
    }

    if (value === "pending") {
        return "pending";
    }

    return "active";
}


/* =========================================================
   DISPLAY STATUS
========================================================= */

function displayStatus(status) {

    const normalized = normalizeStatus(status);

    return normalized.charAt(0).toUpperCase() +
        normalized.slice(1);
}


/* =========================================================
   SHOW COPY MESSAGE
========================================================= */

function showCopyMessage(message) {

    if (!copyMessage) {
        return;
    }

    copyMessage.textContent = message;

    clearTimeout(window.copyMessageTimer);

    window.copyMessageTimer = setTimeout(function () {

        copyMessage.textContent = "";

    }, 2500);
}


/* =========================================================
   COPY TEXT
========================================================= */

async function copyText(text, successMessage) {

    const value = String(text || "").trim();

    if (!value) {

        showCopyMessage("Nothing to copy.");

        return;

    }

    try {

        await navigator.clipboard.writeText(value);

        showCopyMessage(successMessage);

    } catch (error) {

        /*
        ---------------------------------------------------------
        Fallback for browsers where Clipboard API is unavailable
        ---------------------------------------------------------
        */

        const temporaryInput =
            document.createElement("textarea");

        temporaryInput.value = value;

        temporaryInput.style.position = "fixed";
        temporaryInput.style.opacity = "0";

        document.body.appendChild(temporaryInput);

        temporaryInput.focus();
        temporaryInput.select();

        try {

            document.execCommand("copy");

            showCopyMessage(successMessage);

        } catch (copyError) {

            showCopyMessage(
                "Unable to copy. Please copy it manually."
            );

        }

        document.body.removeChild(temporaryInput);
    }
}


/* =========================================================
   COPY REFERRAL LINK
========================================================= */

if (copyLinkBtn) {

    copyLinkBtn.addEventListener("click", function () {

        const value =
            referralLink
                ? referralLink.value
                : "";

        copyText(
            value,
            "Referral link copied!"
        );

    });

}


/* =========================================================
   COPY REFERRAL CODE
========================================================= */

if (copyCodeBtn) {

    copyCodeBtn.addEventListener("click", function () {

        const value =
            referralCode
                ? referralCode.textContent
                : "";

        copyText(
            value,
            "Referral code copied!"
        );

    });

}


/* =========================================================
   COPY FROM EMPTY STATE
========================================================= */

if (emptyCopyBtn) {

    emptyCopyBtn.addEventListener("click", function () {

        const value =
            referralLink
                ? referralLink.value
                : "";

        copyText(
            value,
            "Referral link copied!"
        );

    });

}


/* =========================================================
   GET REFERRAL INFORMATION
========================================================= */

async function loadReferralInformation() {

    try {

        /*
        ---------------------------------------------------------
        profile.php already exists in Crown Cash.
        It gives us the logged-in user's referral code.
        ---------------------------------------------------------
        */

        const response = await fetch(
            `${API_URL}/profile.php`,
            {
                method: "GET",
                credentials: "include",
                headers: {
                    "Accept": "application/json"
                }
            }
        );


        if (response.status === 401) {

            window.location.href = "login.html";

            return;

        }


        const data = await response.json();


        if (!response.ok || !data.success) {

            throw new Error(
                data.message ||
                "Unable to load referral information."
            );

        }


        /*
        ---------------------------------------------------------
        Get referral code from possible field names
        ---------------------------------------------------------
        */

        const code =
            data.referral_code ||
            data.referralCode ||
            data.user?.referral_code ||
            data.user?.referralCode ||
            "";


        if (referralCode) {

            referralCode.textContent =
                code || "Not available";

        }


        /*
        ---------------------------------------------------------
        Build referral link
        ---------------------------------------------------------
        */

        if (referralLink) {

            if (code) {

                const baseURL =
                    window.location.origin;

                referralLink.value =
                    `${baseURL}/register.html?ref=${encodeURIComponent(code)}`;

            } else {

                referralLink.value =
                    "Referral link unavailable";

            }

        }

    } catch (error) {

        console.error(
            "Referral information error:",
            error
        );


        if (referralCode) {

            referralCode.textContent =
                "Unavailable";

        }


        if (referralLink) {

            referralLink.value =
                "Unable to load referral link";

        }

    }
}


/* =========================================================
   LOAD REFERRAL TEAM
========================================================= */

async function loadReferralTeam() {

    if (!teamMessage || !teamList) {
        return;
    }


    teamMessage.textContent =
        "Loading your referral team...";

    teamList.innerHTML = "";

    if (emptyTeam) {
        emptyTeam.style.display = "none";
    }


    try {

        /*
        ---------------------------------------------------------
        team.php will be created next.
        ---------------------------------------------------------
        */

        const response = await fetch(
            `${API_URL}/team.php`,
            {
                method: "GET",
                credentials: "include",
                headers: {
                    "Accept": "application/json"
                }
            }
        );


        if (response.status === 401) {

            window.location.href = "login.html";

            return;

        }


        const data = await response.json();


        if (!response.ok || !data.success) {

            throw new Error(
                data.message ||
                "Unable to load referral team."
            );

        }


        const members =
            Array.isArray(data.members)
                ? data.members
                : [];


        /*
        ---------------------------------------------------------
        Statistics
        ---------------------------------------------------------
        */

        const total =
            Number(
                data.total_referrals ??
                data.total ??
                members.length
            ) || 0;


        const active =
            Number(
                data.active_members ??
                data.active ??
                members.filter(function (member) {

                    return normalizeStatus(
                        member.status
                    ) === "active";

                }).length
            ) || 0;


        const earnings =
            Number(
                data.referral_earnings ??
                data.earnings ??
                0
            ) || 0;


        if (totalReferrals) {
            totalReferrals.textContent = total;
        }


        if (activeMembers) {
            activeMembers.textContent = active;
        }


        if (referralEarnings) {
            referralEarnings.textContent =
                formatUGX(earnings);
        }


        /*
        ---------------------------------------------------------
        No members
        ---------------------------------------------------------
        */

        if (members.length === 0) {

            teamMessage.style.display = "none";

            if (emptyTeam) {
                emptyTeam.style.display = "block";
            }

            return;

        }


        /*
        ---------------------------------------------------------
        Display members
        ---------------------------------------------------------
        */

        teamMessage.style.display = "none";

        members.forEach(function (member) {

            const html =
                createMemberHTML(member);

            teamList.insertAdjacentHTML(
                "beforeend",
                html
            );

        });

    } catch (error) {

        console.error(
            "Referral team error:",
            error
        );


        teamMessage.style.display = "block";

        teamMessage.textContent =
            error.message ||
            "Unable to load your referral team.";

        if (emptyTeam) {
            emptyTeam.style.display = "none";
        }

    }
}


/* =========================================================
   CREATE MEMBER HTML
========================================================= */

function createMemberHTML(member) {

    const name =
        member.name ||
        member.full_name ||
        member.fullName ||
        (
            String(member.first_name || "").trim() +
            " " +
            String(member.last_name || "").trim()
        ).trim() ||
        "Crown Cash Member";


    const status =
        normalizeStatus(
            member.status
        );


    const initials =
        getInitials(name);


    const joinedDate =
        formatDate(
            member.created_at ||
            member.joined_at ||
            member.member_since
        );


    return `
        <div class="team-member">

            <div class="member-avatar">
                ${escapeHTML(initials)}
            </div>

            <div class="member-details">

                <strong>
                    ${escapeHTML(name)}
                </strong>

                <span>
                    Joined ${escapeHTML(joinedDate)}
                </span>

            </div>

            <div class="member-status ${escapeHTML(status)}">
                ${escapeHTML(displayStatus(status))}
            </div>

        </div>
    `;
}


/* =========================================================
   FORMAT DATE
========================================================= */

function formatDate(value) {

    if (!value) {
        return "Date unavailable";
    }


    let date;


    /*
    ---------------------------------------------------------
    MongoDB date may sometimes arrive as:
    { "$date": "..." }
    ---------------------------------------------------------
    */

    if (
        typeof value === "object" &&
        value.$date
    ) {

        value = value.$date;

    }


    date = new Date(value);


    if (Number.isNaN(date.getTime())) {

        return "Date unavailable";

    }


    return date.toLocaleDateString(
        "en-UG",
        {
            day: "2-digit",
            month: "short",
            year: "numeric"
        }
    );
}


/* =========================================================
   LOGOUT
========================================================= */

if (logoutBtn) {

    logoutBtn.addEventListener(
        "click",
        async function () {

            logoutBtn.disabled = true;

            try {

                await fetch(
                    `${API_URL}/logout.php`,
                    {
                        method: "POST",
                        credentials: "include",
                        headers: {
                            "Content-Type":
                                "application/json"
                        }
                    }
                );

            } catch (error) {

                console.error(
                    "Logout error:",
                    error
                );

            } finally {

                window.location.href =
                    "login.html";

            }

        }
    );

}


/* =========================================================
   INITIALIZE
========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    function () {

        loadReferralInformation();

        loadReferralTeam();

    }
);