/* =========================================================
   CROWN CASH — REFERRAL SYSTEM
   referral.js
   ========================================================= */

const API_URL = "https://crown-cash1.onrender.com";

document.addEventListener("DOMContentLoaded", () => {

    /* ---------------------------------------------------------
       ELEMENTS
    --------------------------------------------------------- */

    const referralCodeElement =
        document.getElementById("referralCode");

    const referralLinkElement =
        document.getElementById("referralLink");

    const totalReferralsElement =
        document.getElementById("totalReferrals");

    const activeMembersElement =
        document.getElementById("activeMembers");

    const referralEarningsElement =
        document.getElementById("referralEarnings");

    const teamListElement =
        document.getElementById("teamList");

    const teamMessageElement =
        document.getElementById("teamMessage");

    const copyReferralCodeButton =
        document.getElementById("copyReferralCode");

    const copyReferralLinkButton =
        document.getElementById("copyReferralLink");

    const logoutButton =
        document.getElementById("logoutButton");


    /* ---------------------------------------------------------
       HELPERS
    --------------------------------------------------------- */

    function formatUGX(amount) {

        const number = Number(amount) || 0;

        return "UGX " +
            number.toLocaleString("en-UG", {
                maximumFractionDigits: 0
            });
    }


    function escapeHTML(value) {

        return String(value ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }


    function getInitials(name) {

        const words =
            String(name || "")
                .trim()
                .split(/\s+/)
                .filter(Boolean);

        if (words.length === 0) {
            return "CC";
        }

        if (words.length === 1) {
            return words[0]
                .substring(0, 2)
                .toUpperCase();
        }

        return (
            words[0].charAt(0) +
            words[1].charAt(0)
        ).toUpperCase();
    }


    function formatDate(dateValue) {

        if (!dateValue) {
            return "Date unavailable";
        }

        const date =
            new Date(dateValue);

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


    function statusClass(status) {

        const normalized =
            String(status || "")
                .toLowerCase();

        if (
            normalized === "active" ||
            normalized === "approved"
        ) {
            return "active";
        }

        if (
            normalized === "pending"
        ) {
            return "pending";
        }

        if (
            normalized === "blocked" ||
            normalized === "suspended" ||
            normalized === "disabled"
        ) {
            return "blocked";
        }

        return "pending";
    }


    function showMessage(text, type = "info") {

        if (!teamMessageElement) {
            return;
        }

        teamMessageElement.textContent =
            text;

        teamMessageElement.className =
            `team-message ${type}`;

        teamMessageElement.style.display =
            "block";
    }


    function hideMessage() {

        if (!teamMessageElement) {
            return;
        }

        teamMessageElement.style.display =
            "none";
    }


    /* ---------------------------------------------------------
       CREATE REFERRAL LINK
    --------------------------------------------------------- */

    function buildReferralLink(code) {

        if (!code) {
            return "";
        }

        const baseURL =
            window.location.origin;

        return (
            baseURL +
            "/register.html?ref=" +
            encodeURIComponent(code)
        );
    }


    /* ---------------------------------------------------------
       DISPLAY REFERRAL INFORMATION
    --------------------------------------------------------- */

    function displayReferralInformation(data) {

        const code =
            data.referral_code || "";

        /*
        | Referral code
        */

        if (referralCodeElement) {

            referralCodeElement.textContent =
                code || "Not available";
        }


        /*
        | Referral link
        */

        const referralLink =
            buildReferralLink(code);


        if (referralLinkElement) {

            if (
                referralLinkElement.tagName ===
                "INPUT"
            ) {

                referralLinkElement.value =
                    referralLink;

            } else {

                referralLinkElement.textContent =
                    referralLink;
            }
        }


        /*
        | Statistics
        */

        if (totalReferralsElement) {

            totalReferralsElement.textContent =
                Number(
                    data.total_referrals || 0
                );
        }


        if (activeMembersElement) {

            activeMembersElement.textContent =
                Number(
                    data.active_members || 0
                );
        }


        if (referralEarningsElement) {

            referralEarningsElement.textContent =
                formatUGX(
                    data.referral_earnings || 0
                );
        }
    }


    /* ---------------------------------------------------------
       CREATE MEMBER CARD
    --------------------------------------------------------- */

    function createMemberCard(member) {

        const name =
            member.name ||
            `${member.first_name || ""} ${member.last_name || ""}`
                .trim() ||
            "Crown Cash Member";

        const status =
            String(
                member.status || "active"
            ).toLowerCase();

        const safeName =
            escapeHTML(name);

        const initials =
            escapeHTML(
                getInitials(name)
            );

        const safeStatus =
            escapeHTML(status);

        const date =
            formatDate(
                member.created_at
            );


        return `
            <div class="team-member-card">

                <div class="member-avatar">
                    ${initials}
                </div>

                <div class="member-info">

                    <h3>
                        ${safeName}
                    </h3>

                    <p>
                        <i class="fa-regular fa-calendar"></i>
                        Joined ${escapeHTML(date)}
                    </p>

                </div>

                <div class="member-status ${statusClass(status)}">

                    <span class="status-dot"></span>

                    ${safeStatus}

                </div>

            </div>
        `;
    }


    /* ---------------------------------------------------------
       DISPLAY TEAM MEMBERS
    --------------------------------------------------------- */

    function displayTeamMembers(members) {

        if (!teamListElement) {
            return;
        }

        if (
            !Array.isArray(members) ||
            members.length === 0
        ) {

            teamListElement.innerHTML = `
                <div class="empty-team">

                    <div class="empty-team-icon">
                        <i class="fa-solid fa-users"></i>
                    </div>

                    <h3>
                        No referrals yet
                    </h3>

                    <p>
                        Share your referral link
                        and start building your team.
                    </p>

                </div>
            `;

            return;
        }


        teamListElement.innerHTML =
            members
                .map(createMemberCard)
                .join("");
    }


    /* ---------------------------------------------------------
       LOAD REFERRAL DATA
    --------------------------------------------------------- */

    async function loadReferralData() {

        hideMessage();

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
                        }
                    }
                );


            let data;

            try {

                data =
                    await response.json();

            } catch (error) {

                throw new Error(
                    "Invalid server response."
                );
            }


            if (
                response.status === 401
            ) {

                window.location.href =
                    "/login.html";

                return;
            }


            if (
                !response.ok ||
                !data.success
            ) {

                throw new Error(
                    data.message ||
                    "Unable to load referral information."
                );
            }


            displayReferralInformation(
                data
            );

            displayTeamMembers(
                data.members || []
            );


        } catch (error) {

            console.error(
                "Referral loading error:",
                error
            );

            showMessage(
                error.message ||
                "Unable to load referral information.",
                "error"
            );

            if (teamListElement) {

                teamListElement.innerHTML = `
                    <div class="empty-team">

                        <div class="empty-team-icon">
                            <i class="fa-solid fa-triangle-exclamation"></i>
                        </div>

                        <h3>
                            Unable to load your team
                        </h3>

                        <p>
                            Please refresh the page
                            and try again.
                        </p>

                    </div>
                `;
            }
        }
    }


    /* ---------------------------------------------------------
       COPY TEXT
    --------------------------------------------------------- */

    async function copyText(
        text,
        button,
        successText
    ) {

        if (!text) {
            return;
        }

        try {

            await navigator.clipboard.writeText(
                text
            );

            if (button) {

                const original =
                    button.innerHTML;

                button.innerHTML =
                    '<i class="fa-solid fa-check"></i> Copied';

                button.classList.add(
                    "copied"
                );


                setTimeout(() => {

                    button.innerHTML =
                        original;

                    button.classList.remove(
                        "copied"
                    );

                }, 1800);
            }


            showMessage(
                successText,
                "success"
            );


            setTimeout(
                hideMessage,
                2500
            );


        } catch (error) {

            console.error(
                "Copy error:",
                error
            );


            showMessage(
                "Could not copy. Please copy it manually.",
                "error"
            );
        }
    }


    /* ---------------------------------------------------------
       COPY REFERRAL CODE
    --------------------------------------------------------- */

    if (copyReferralCodeButton) {

        copyReferralCodeButton.addEventListener(
            "click",
            () => {

                const code =
                    referralCodeElement?.textContent
                        ?.trim() || "";

                copyText(
                    code,
                    copyReferralCodeButton,
                    "Referral code copied."
                );
            }
        );
    }


    /* ---------------------------------------------------------
       COPY REFERRAL LINK
    --------------------------------------------------------- */

    if (copyReferralLinkButton) {

        copyReferralLinkButton.addEventListener(
            "click",
            () => {

                let link = "";

                if (
                    referralLinkElement?.tagName ===
                    "INPUT"
                ) {

                    link =
                        referralLinkElement.value;

                } else {

                    link =
                        referralLinkElement
                            ?.textContent
                            ?.trim() || "";
                }


                copyText(
                    link,
                    copyReferralLinkButton,
                    "Referral link copied."
                );
            }
        );
    }


    /* ---------------------------------------------------------
       LOGOUT
    --------------------------------------------------------- */

    if (logoutButton) {

        logoutButton.addEventListener(
            "click",
            async (event) => {

                event.preventDefault();

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

                } finally {

                    window.location.href =
                        "/login.html";
                }

            }
        );
    }


    /* ---------------------------------------------------------
       MOBILE SIDEBAR
    --------------------------------------------------------- */

    const menuToggle =
        document.getElementById("menuToggle");

    const sidebar =
        document.querySelector(".sidebar");

    const sidebarOverlay =
        document.querySelector(".sidebar-overlay");


    function closeSidebar() {

        sidebar?.classList.remove(
            "open"
        );

        sidebarOverlay?.classList.remove(
            "show"
        );
    }


    if (menuToggle) {

        menuToggle.addEventListener(
            "click",
            () => {

                sidebar?.classList.toggle(
                    "open"
                );

                sidebarOverlay?.classList.toggle(
                    "show"
                );
            }
        );
    }


    if (sidebarOverlay) {

        sidebarOverlay.addEventListener(
            "click",
            closeSidebar
        );
    }


    document
        .querySelectorAll(".sidebar a")
        .forEach(link => {

            link.addEventListener(
                "click",
                closeSidebar
            );

        });


    /* ---------------------------------------------------------
       START
    --------------------------------------------------------- */

    loadReferralData();

});