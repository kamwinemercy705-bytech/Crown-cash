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

const number = Number(amount || 0);

return "UGX " + number.toLocaleString("en-UG");

}

// ==========================================
// LOAD REFERRAL DATA
// ==========================================

async function loadReferralData() {

if (teamMembers) {

    teamMembers.innerHTML = `
        <div class="loading-state">
            <i class="fa-solid fa-spinner fa-spin"></i>
            <p>Loading your referral information...</p>
        </div>
    `;
}


try {

    const response = await fetch(
        `${API_URL}/referral.php`,
        {
            method: "GET",

            credentials: "include",

            headers: {
                "Accept": "application/json"
            },

            cache: "no-store"
        }
    );


    let data;

    try {
        data = await response.json();
    } catch (jsonError) {

        throw new Error(
            "The referral server returned an invalid response."
        );
    }


    console.log("Referral API response:", data);


    if (!response.ok || !data.success) {

        throw new Error(
            data.message ||
            "Unable to load referral data."
        );
    }


    // ==================================
    // REFERRAL CODE
    // ==================================

    const code =
        data.referral_code ||
        data.referralCode ||
        "";


    if (referralCodeInput) {

        referralCodeInput.value = code;
    }


    // ==================================
    // REFERRAL LINK
    // ==================================

    let link =
        data.referral_link ||
        data.referralLink ||
        "";


    if (!link && code) {

        link =
            "https://crown-cash.vercel.app/register.html?ref=" +
            encodeURIComponent(code);
    }


    if (referralLinkInput) {

        referralLinkInput.value = link;
    }


    // ==================================
    // COUNTS
    // ==================================

    const counts =
        data.counts ||
        data.team_counts ||
        {};


    if (totalTeam) {

        totalTeam.textContent =
            Number(counts.total || 0);
    }


    if (level1Count) {

        level1Count.textContent =
            Number(
                counts.l1 ||
                counts.level1 ||
                0
            );
    }


    if (level2Count) {

        level2Count.textContent =
            Number(
                counts.l2 ||
                counts.level2 ||
                0
            );
    }


    if (level3Count) {

        level3Count.textContent =
            Number(
                counts.l3 ||
                counts.level3 ||
                0
            );
    }


    // ==================================
    // EARNINGS
    // ==================================

    const earnings =
        data.earnings ||
        data.referral_earnings ||
        {};


    if (level1Income) {

        level1Income.textContent =
            formatMoney(
                earnings.l1 ||
                earnings.level1 ||
                0
            );
    }


    if (level2Income) {

        level2Income.textContent =
            formatMoney(
                earnings.l2 ||
                earnings.level2 ||
                0
            );
    }


    if (level3Income) {

        level3Income.textContent =
            formatMoney(
                earnings.l3 ||
                earnings.level3 ||
                0
            );
    }


    if (totalIncome) {

        totalIncome.textContent =
            formatMoney(
                earnings.total ||
                0
            );
    }


    // ==================================
    // MEMBERS
    // ==================================

    renderMembers(
        data.members || []
    );


} catch (error) {

    console.error(
        "Referral loading error:",
        error
    );


    if (teamMembers) {

        teamMembers.innerHTML = `

            <div class="error-state">

                <div class="error-icon">
                    <i class="fa-solid fa-triangle-exclamation"></i>
                </div>

                <h3>
                    Unable to load referral data
                </h3>

                <p>
                    ${
                        error.message ||
                        "Please refresh the page and try again."
                    }
                </p>

                <button
                    type="button"
                    onclick="loadReferralData()"
                    class="retry-btn"
                >
                    <i class="fa-solid fa-rotate-right"></i>
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


if (!Array.isArray(members) || members.length === 0) {

    teamMembers.innerHTML = `

        <div class="empty-state">

            <div class="empty-icon">
                <i class="fa-solid fa-users"></i>
            </div>

            <h3>No Team Members Yet</h3>

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
        member.name ||
        "Crown Cash Member";

    const level =
        member.level ||
        "L1";

    const phone =
        member.phone ||
        "";

    const initials =
        name
            .split(" ")
            .filter(Boolean)
            .slice(0, 2)
            .map(word => word.charAt(0))
            .join("")
            .toUpperCase();


    const card =
        document.createElement("div");

    card.className =
        "team-member-card";

    card.dataset.level =
        level;


    card.innerHTML = `

        <div class="member-avatar">
            ${initials || "CC"}
        </div>

        <div class="member-info">

            <h4>
                ${escapeHtml(name)}
            </h4>

            ${
                phone
                ? `<p>${escapeHtml(phone)}</p>`
                : ""
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
// ESCAPE HTML
// ==========================================

function escapeHtml(value) {

return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

}

// ==========================================
// FILTERS
// ==========================================

function setupFilters() {

const filterButtons =
    document.querySelectorAll(
        "[data-filter]"
    );


filterButtons.forEach(button => {

    button.addEventListener(
        "click",
        () => {

            filterButtons.forEach(btn => {
                btn.classList.remove("active");
            });


            button.classList.add("active");


            const filter =
                button.dataset.filter;


            const cards =
                document.querySelectorAll(
                    ".team-member-card"
                );


            cards.forEach(card => {

                if (
                    filter === "all" ||
                    card.dataset.level === filter
                ) {

                    card.style.display = "flex";

                } else {

                    card.style.display = "none";
                }
            });

        }
    );

});

}

// ==========================================
// COPY REFERRAL CODE
// ==========================================

async function copyReferralCode() {

const code =
    referralCodeInput
    ? referralCodeInput.value
    : "";


if (!code) {
    return;
}


try {

    await navigator.clipboard.writeText(code);

    showCopyMessage(
        "Referral code copied successfully."
    );

} catch (error) {

    fallbackCopy(code);
}

}

// ==========================================
// COPY REFERRAL LINK
// ==========================================

async function copyReferralLink() {

const link =
    referralLinkInput
    ? referralLinkInput.value
    : "";


if (!link) {
    return;
}


try {

    await navigator.clipboard.writeText(link);

    showCopyMessage(
        "Referral link copied successfully."
    );

} catch (error) {

    fallbackCopy(link);
}

}

// ==========================================
// FALLBACK COPY
// ==========================================

function fallbackCopy(text) {

const textarea =
    document.createElement("textarea");

textarea.value = text;

textarea.style.position = "fixed";
textarea.style.opacity = "0";

document.body.appendChild(textarea);

textarea.select();

document.execCommand("copy");

textarea.remove();

showCopyMessage(
    "Copied successfully."
);

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
        document.createElement("div");

    messageBox.id =
        "copyMessage";

    messageBox.className =
        "copy-message";

    document.body.appendChild(
        messageBox
    );
}


messageBox.innerHTML = `
    <i class="fa-solid fa-circle-check"></i>
    ${escapeHtml(message)}
`;


messageBox.classList.add("show");


setTimeout(() => {

    messageBox.classList.remove("show");

}, 2500);

}

// ==========================================
// SHARE REFERRAL LINK
// ==========================================

async function shareReferralLink() {

const link =
    referralLinkInput
    ? referralLinkInput.value
    : "";


const code =
    referralCodeInput
    ? referralCodeInput.value
    : "";


if (!link) {
    return;
}


if (
    navigator.share &&
    window.isSecureContext
) {

    try {

        await navigator.share({

            title:
                "Join Crown Cash",

            text:
                "Join Crown Cash using my referral link.",

            url: link

        });

        return;

    } catch (error) {

        if (
            error.name ===
            "AbortError"
        ) {
            return;
        }
    }
}


// WhatsApp fallback

const message =
    "Join Crown Cash using my referral link: " +
    link;


window.open(
    "https://wa.me/?text=" +
    encodeURIComponent(message),
    "_blank"
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

if (!menuToggle || !sidebar) {
    return;
}


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