/* =========================================================
   CROWN CASH — DASHBOARD JAVASCRIPT
   PREMIUM DASHBOARD
   ========================================================= */

document.addEventListener("DOMContentLoaded", function () {

    /* =====================================================
       SETTINGS
       ===================================================== */

    const API_BASE =
        "https://crown-cash1.onrender.com";

    /*
     * Crown Cash projected daily return.
     *
     * IMPORTANT:
     * This is a projection displayed by the dashboard.
     * It is not a guarantee of investment performance.
     */
    const DAILY_RETURN_RATE = 0.10;


    /* =====================================================
       ELEMENTS
       ===================================================== */

    const sidebar =
        document.getElementById("dashboardSidebar");

    const sidebarToggle =
        document.getElementById("sidebarToggle");

    const logoutBtn =
        document.getElementById("logoutBtn");

    const welcomeName =
        document.getElementById("welcomeName");

    const sidebarUserName =
        document.getElementById("sidebarUserName");

    const topbarUserName =
        document.getElementById("topbarUserName");

    const sidebarAvatar =
        document.getElementById("sidebarAvatar");

    const topbarAvatar =
        document.getElementById("topbarAvatar");

    const userBalance =
        document.getElementById("userBalance");

    const totalEarnings =
        document.getElementById("totalEarnings");

    const todayEarnings =
        document.getElementById("todayEarnings");

    const totalInvested =
        document.getElementById("totalInvested");

    const referralBonus =
        document.getElementById("referralBonus");

    const currentDate =
        document.getElementById("currentDate");

    const returnAmount =
        document.getElementById("returnAmount");

    const dailyReturnValue =
        document.getElementById("dailyReturnValue");

    const activityList =
        document.getElementById("activityList");


    /* =====================================================
       LOCAL USER
       ===================================================== */

    let savedUser = null;

    try {

        const storedUser =
            localStorage.getItem("crowncash_user");

        if (storedUser) {
            savedUser = JSON.parse(storedUser);
        }

    } catch (error) {

        console.error(
            "Unable to read saved Crown Cash user:",
            error
        );

    }


    /* =====================================================
       LOGIN CHECK
       ===================================================== */

    if (!savedUser) {

        /*
         * Give the browser a moment in case another page
         * has just completed login and stored the user.
         */

        setTimeout(function () {

            const retryUser =
                localStorage.getItem("crowncash_user");

            if (!retryUser) {
                window.location.href = "login.html";
            }

        }, 300);

    }


    /* =====================================================
       USER NAME
       ===================================================== */

    function getUserName() {

        if (!savedUser) {
            return "User";
        }

        const firstName =
            savedUser.firstName ||
            savedUser.firstname ||
            "";

        const lastName =
            savedUser.lastName ||
            savedUser.lastname ||
            "";

        const fullName =
            `${firstName} ${lastName}`.trim();

        if (fullName) {
            return fullName;
        }

        if (savedUser.name) {
            return savedUser.name;
        }

        if (savedUser.email) {
            return savedUser.email.split("@")[0];
        }

        return "User";
    }


    const currentUserName =
        getUserName();


    /* =====================================================
       SET USER INFORMATION
       ===================================================== */

    function displayUserInformation() {

        if (welcomeName) {
            welcomeName.textContent =
                currentUserName;
        }

        if (sidebarUserName) {
            sidebarUserName.textContent =
                currentUserName;
        }

        if (topbarUserName) {
            topbarUserName.textContent =
                currentUserName;
        }

        const initials =
            getInitials(currentUserName);

        if (sidebarAvatar) {
            sidebarAvatar.textContent =
                initials;
        }

        if (topbarAvatar) {
            topbarAvatar.textContent =
                initials;
        }

    }


    /* =====================================================
       GET INITIALS
       ===================================================== */

    function getInitials(name) {

        if (!name) {
            return "CC";
        }

        const words =
            name.trim().split(/\s+/);

        if (words.length === 1) {

            return words[0]
                .substring(0, 2)
                .toUpperCase();

        }

        return (
            words[0].charAt(0) +
            words[words.length - 1].charAt(0)
        ).toUpperCase();

    }


    displayUserInformation();


    /* =====================================================
       FORMAT UGX
       ===================================================== */

    function formatUGX(amount) {

        const numericAmount =
            Number(amount) || 0;

        return (
            "UGX " +
            Math.round(numericAmount)
                .toLocaleString("en-US")
        );

    }


    /* =====================================================
       DISPLAY DATE
       ===================================================== */

    function displayCurrentDate() {

        if (!currentDate) {
            return;
        }

        const today =
            new Date();

        const options = {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric"
        };

        currentDate.textContent =
            today.toLocaleDateString(
                "en-US",
                options
            );

    }


    displayCurrentDate();


    /* =====================================================
       DAILY RETURN CALCULATOR
       ===================================================== */

    function calculateDailyReturn() {

        if (!returnAmount ||
            !dailyReturnValue) {
            return;
        }

        let amount =
            Number(returnAmount.value);

        if (!Number.isFinite(amount) ||
            amount < 0) {

            amount = 0;

        }

        const projectedReturn =
            amount * DAILY_RETURN_RATE;

        dailyReturnValue.textContent =
            formatUGX(projectedReturn);

    }


    /* =====================================================
       RETURN INPUT
       ===================================================== */

    if (returnAmount) {

        returnAmount.addEventListener(
            "input",
            function () {

                calculateDailyReturn();

                updateQuickAmountButtons();

            }
        );

        returnAmount.addEventListener(
            "change",
            function () {

                calculateDailyReturn();

                updateQuickAmountButtons();

            }
        );

    }


    /* =====================================================
       QUICK AMOUNT BUTTONS
       ===================================================== */

    const quickAmountButtons =
        document.querySelectorAll(
            ".quick-amounts button"
        );


    quickAmountButtons.forEach(
        function (button) {

            button.addEventListener(
                "click",
                function () {

                    const amount =
                        Number(
                            button.dataset.amount
                        );

                    if (!returnAmount ||
                        !Number.isFinite(amount)) {
                        return;
                    }

                    returnAmount.value =
                        amount;

                    calculateDailyReturn();

                    updateQuickAmountButtons();

                    /*
                     * Small visual feedback.
                     */
                    button.classList.add("clicked");

                    setTimeout(
                        function () {
                            button.classList.remove(
                                "clicked"
                            );
                        },
                        180
                    );

                }
            );

        }
    );


    /* =====================================================
       ACTIVE QUICK AMOUNT
       ===================================================== */

    function updateQuickAmountButtons() {

        if (!returnAmount) {
            return;
        }

        const amount =
            Number(returnAmount.value);

        quickAmountButtons.forEach(
            function (button) {

                const buttonAmount =
                    Number(
                        button.dataset.amount
                    );

                if (buttonAmount === amount) {

                    button.classList.add(
                        "active"
                    );

                } else {

                    button.classList.remove(
                        "active"
                    );

                }

            }
        );

    }


    calculateDailyReturn();
    updateQuickAmountButtons();


    /* =====================================================
       LOAD INVESTMENTS
       ===================================================== */

    async function loadInvestments() {

        try {

            const response =
                await fetch(
                    `${API_BASE}/investments.php`,
                    {
                        method: "GET",

                        credentials: "include",

                        headers: {
                            "Accept":
                                "application/json"
                        }
                    }
                );


            if (!response.ok) {

                throw new Error(
                    `Investment request failed: ${response.status}`
                );

            }


            const data =
                await response.json();


            if (!data.success) {

                throw new Error(
                    data.message ||
                    "Unable to load investments."
                );

            }


            const investments =
                Array.isArray(data.investments)
                    ? data.investments
                    : [];


            processInvestmentData(
                investments
            );


        } catch (error) {

            console.error(
                "Crown Cash investment loading error:",
                error
            );

            /*
             * We do not destroy the dashboard if
             * investments cannot be loaded.
             *
             * The locally saved balance can still
             * be displayed.
             */

            displaySavedBalance();

            showEmptyActivity();

        }

    }


    /* =====================================================
       PROCESS INVESTMENTS
       ===================================================== */

    function processInvestmentData(
        investments
    ) {

        let investedTotal = 0;

        let projectedTotal = 0;

        let activeInvestments = 0;


        investments.forEach(
            function (investment) {

                const amount =
                    Number(
                        investment.amount
                    ) || 0;

                investedTotal += amount;


                const status =
                    String(
                        investment.status ||
                        "active"
                    ).toLowerCase();


                if (
                    status === "active" ||
                    status === "approved"
                ) {

                    activeInvestments++;

                    projectedTotal +=
                        amount *
                        DAILY_RETURN_RATE;

                }

            }
        );


        /*
         * Total invested.
         */

        if (totalInvested) {

            totalInvested.textContent =
                formatUGX(
                    investedTotal
                );

        }


        /*
         * If the user has investments,
         * automatically use the total invested
         * amount in the calculator.
         */

        if (
            investedTotal > 0 &&
            returnAmount
        ) {

            returnAmount.value =
                investedTotal;

            calculateDailyReturn();

            updateQuickAmountButtons();

        }


        /*
         * Today's projected earnings.
         *
         * This is a projection based on the
         * displayed 10% rate, not a confirmed
         * payment.
         */

        if (todayEarnings) {

            todayEarnings.textContent =
                formatUGX(
                    projectedTotal
                );

        }


        /*
         * Total earnings remains zero until
         * the backend records actual earnings.
         *
         * We do NOT pretend projected earnings
         * are already paid earnings.
         */

        if (totalEarnings) {

            totalEarnings.textContent =
                formatUGX(0);

        }


        /*
         * Referral bonus.
         *
         * Use the saved user's referralBonus
         * when available.
         */

        const savedReferralBonus =
            savedUser &&
            (
                savedUser.referralBonus ??
                savedUser.referral_bonus ??
                0
            );

        if (referralBonus) {

            referralBonus.textContent =
                formatUGX(
                    savedReferralBonus
                );

        }


        /*
         * Display recent investments.
         */

        renderRecentActivity(
            investments
        );

    }


    /* =====================================================
       RECENT ACTIVITY
       ===================================================== */

    function renderRecentActivity(
        investments
    ) {

        if (!activityList) {
            return;
        }


        if (!investments.length) {

            showEmptyActivity();

            return;

        }


        const recent =
            investments
                .slice()
                .sort(
                    function (a, b) {

                        const dateA =
                            new Date(
                                a.created_at ||
                                a.createdAt ||
                                0
                            ).getTime();

                        const dateB =
                            new Date(
                                b.created_at ||
                                b.createdAt ||
                                0
                            ).getTime();

                        return dateB - dateA;

                    }
                )
                .slice(0, 5);


        activityList.innerHTML = "";


        recent.forEach(
            function (investment) {

                const amount =
                    Number(
                        investment.amount
                    ) || 0;


                const plan =
                    investment.plan ||
                    "Investment";


                const status =
                    investment.status ||
                    "active";


                const activity =
                    document.createElement(
                        "div"
                    );

                activity.className =
                    "activity-item";


                activity.innerHTML = `

                    <div class="activity-icon">

                        <svg viewBox="0 0 24 24">

                            <path d="M4 19V5"/>

                            <path d="M4 19H20"/>

                            <path d="M7 15L11 11L14 14L20 7"/>

                        </svg>

                    </div>

                    <div class="activity-details">

                        <strong>
                            ${escapeHTML(plan)}
                        </strong>

                        <span>
                            Investment created
                        </span>

                    </div>

                    <div class="activity-right">

                        <strong>
                            ${formatUGX(amount)}
                        </strong>

                        <span class="activity-status">
                            ${escapeHTML(
                                capitalize(status)
                            )}
                        </span>

                    </div>

                `;


                activityList.appendChild(
                    activity
                );

            }
        );

    }


    /* =====================================================
       EMPTY ACTIVITY
       ===================================================== */

    function showEmptyActivity() {

        if (!activityList) {
            return;
        }

        activityList.innerHTML = `

            <div class="empty-activity">

                <div class="empty-icon">

                    <svg viewBox="0 0 24 24">

                        <path d="M7 7H20L16 3"/>

                        <path d="M17 17H4L8 21"/>

                        <path d="M20 7C20 12 17 14 13 14H4"/>

                        <path d="M4 17C4 12 7 10 11 10H20"/>

                    </svg>

                </div>

                <strong>
                    No recent activity
                </strong>

                <span>
                    Your investments and transactions
                    will appear here.
                </span>

            </div>

        `;

    }


    /* =====================================================
       DISPLAY SAVED BALANCE
       ===================================================== */

    function displaySavedBalance() {

        if (!userBalance) {
            return;
        }


        const balance =
            savedUser
                ? (
                    savedUser.balance ??
                    savedUser.walletBalance ??
                    0
                )
                : 0;


        userBalance.textContent =
            formatUGX(balance);

    }


    displaySavedBalance();


    /* =====================================================
       LOAD USER BALANCE
       ===================================================== */

    function updateBalanceFromSavedUser() {

        if (!savedUser ||
            !userBalance) {
            return;
        }


        const balance =
            Number(
                savedUser.balance ??
                savedUser.walletBalance ??
                0
            );


        userBalance.textContent =
            formatUGX(balance);

    }


    updateBalanceFromSavedUser();


    /* =====================================================
       MOBILE SIDEBAR
       ===================================================== */

    function createSidebarOverlay() {

        let overlay =
            document.querySelector(
                ".sidebar-overlay"
            );


        if (!overlay) {

            overlay =
                document.createElement(
                    "div"
                );

            overlay.className =
                "sidebar-overlay";

            document.body.appendChild(
                overlay
            );

        }


        return overlay;

    }


    const sidebarOverlay =
        createSidebarOverlay();


    function openSidebar() {

        if (!sidebar) {
            return;
        }

        sidebar.classList.add("open");

        sidebarOverlay.classList.add(
            "active"
        );

        document.body.style.overflow =
            "hidden";

    }


    function closeSidebar() {

        if (!sidebar) {
            return;
        }

        sidebar.classList.remove("open");

        sidebarOverlay.classList.remove(
            "active"
        );

        document.body.style.overflow =
            "";

    }


    if (sidebarToggle) {

        sidebarToggle.addEventListener(
            "click",
            function () {

                if (
                    sidebar &&
                    sidebar.classList.contains(
                        "open"
                    )
                ) {

                    closeSidebar();

                } else {

                    openSidebar();

                }

            }
        );

    }


    sidebarOverlay.addEventListener(
        "click",
        closeSidebar
    );


    /* =====================================================
       CLOSE SIDEBAR AFTER NAVIGATION
       ===================================================== */

    const navigationLinks =
        document.querySelectorAll(
            ".dashboard-nav-link"
        );


    navigationLinks.forEach(
        function (link) {

            link.addEventListener(
                "click",
                function () {

                    closeSidebar();

                }
            );

        }
    );


    /* =====================================================
       SETTINGS BUTTON
       ===================================================== */

    const settingsLink =
        document.getElementById(
            "settingsLink"
        );


    if (settingsLink) {

        settingsLink.addEventListener(
            "click",
            function (event) {

                event.preventDefault();

                /*
                 * Settings page can be added later.
                 * For now provide clear feedback.
                 */

                alert(
                    "Crown Cash Settings will be available soon."
                );

            }
        );

    }


    /* =====================================================
       NOTIFICATION BUTTON
       ===================================================== */

    const notificationButton =
        document.querySelector(
            ".notification-btn"
        );


    if (notificationButton) {

        notificationButton.addEventListener(
            "click",
            function () {

                alert(
                    "You currently have no new notifications."
                );

            }
        );

    }


    /* =====================================================
       LOGOUT
       ===================================================== */

    if (logoutBtn) {

        logoutBtn.addEventListener(
            "click",
            async function () {

                const confirmed =
                    confirm(
                        "Are you sure you want to logout?"
                    );


                if (!confirmed) {
                    return;
                }


                logoutBtn.disabled = true;

                logoutBtn.style.opacity =
                    "0.6";


                try {

                    /*
                     * Ask the backend to destroy
                     * the PHP session.
                     */

                    await fetch(
                        `${API_BASE}/logout.php`,
                        {
                            method: "POST",

                            credentials: "include"
                        }
                    );

                } catch (error) {

                    console.warn(
                        "Server logout request failed:",
                        error
                    );

                }


                /*
                 * Clear browser-side login data.
                 */

                localStorage.removeItem(
                    "crowncash_user"
                );


                /*
                 * Redirect to login.
                 */

                window.location.href =
                    "login.html";

            }
        );

    }


    /* =====================================================
       ESCAPE HTML
       ===================================================== */

    function escapeHTML(value) {

        const div =
            document.createElement("div");

        div.textContent =
            String(value ?? "");

        return div.innerHTML;

    }


    /* =====================================================
       CAPITALIZE
       ===================================================== */

    function capitalize(value) {

        if (!value) {
            return "";
        }

        const text =
            String(value);

        return (
            text.charAt(0).toUpperCase() +
            text.slice(1)
        );

    }


    /* =====================================================
       CARD ANIMATION
       ===================================================== */

    function animateDashboardCards() {

        const cards =
            document.querySelectorAll(
                ".stat-card, .quick-action-card, .dashboard-panel, .important-card"
            );


        cards.forEach(
            function (card, index) {

                card.style.opacity = "0";

                card.style.transform =
                    "translateY(15px)";


                setTimeout(
                    function () {

                        card.style.transition =
                            "opacity 0.55s ease, transform 0.55s ease";

                        card.style.opacity =
                            "1";

                        card.style.transform =
                            "translateY(0)";

                    },
                    80 + (index * 60)
                );

            }
        );

    }


    animateDashboardCards();


    /* =====================================================
       LOAD DASHBOARD DATA
       ===================================================== */

    loadInvestments();


    /* =====================================================
       REFRESH DATE AT MIDNIGHT
       ===================================================== */

    setInterval(
        function () {

            displayCurrentDate();

        },
        60 * 1000
    );


    /* =====================================================
       PREVENT NEGATIVE RETURN VALUES
       ===================================================== */

    if (returnAmount) {

        returnAmount.addEventListener(
            "input",
            function () {

                if (
                    Number(returnAmount.value) < 0
                ) {

                    returnAmount.value =
                        0;

                }

            }
        );

    }


    /* =====================================================
       CONSOLE
       ===================================================== */

    console.log(
        "Crown Cash Dashboard loaded successfully."
    );

});